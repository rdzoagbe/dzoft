// DZOFT Brevo transactional delivery integration.
// /setup: one-time Vault-authorized registration + reconciliation.
// /: Brevo-only callback authenticated by a 256-bit secret custom header.
// No public access to customer identities, webhook secrets or message content.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const LEGACY_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY") ?? "";
const WEBHOOK_URL = "https://rzghbvmszbjlqkdjzpxc.supabase.co/functions/v1/brevo-delivery-events";
const EVENTS = ["delivered","hardBounce","softBounce","blocked","invalid","deferred","opened","uniqueOpened","spam"];
function serviceKey(): string {
  try {
    const values=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    if (typeof values.default === "string" && values.default) return values.default;
  } catch (_) {}
  return LEGACY_KEY;
}
function result(status:number, payload:Record<string,unknown>):Response {
 return Response.json(payload,{status,headers:{"cache-control":"no-store"}});
}
function validToken(value:string):boolean {return /^[a-f0-9]{64}$/.test(value);}
async function rpc(name:string,params:Record<string,unknown>):Promise<any> {
 const key=serviceKey();
 if(!SUPABASE_URL || !key)throw Error("Missing database credentials");
 const headers:Record<string,string>={"apikey":key,"Content-Type":"application/json"};
 if(key.startsWith("eyJ"))headers.Authorization="Bearer "+key;
 const r=await fetch(SUPABASE_URL+"/rest/v1/rpc/"+name,{
  method:"POST",headers,body:JSON.stringify(params),redirect:"error",signal:AbortSignal.timeout(9000)
 });
 if(!r.ok)throw Error("Database RPC rejected");
 return await r.json();
}
async function brevo(path:string,method="GET",payload?:Record<string,unknown>):Promise<any>{
 if(!BREVO_API_KEY)throw Error("Brevo API key unavailable");
 const r=await fetch("https://api.brevo.com/v3"+path,{
  method,headers:{"api-key":BREVO_API_KEY,"Accept":"application/json",
    ...(payload?{"Content-Type":"application/json"}:{})},
  ...(payload?{body:JSON.stringify(payload)}:{}),
  redirect:"error",signal:AbortSignal.timeout(10000)
 });
 if(!r.ok)throw Error("Brevo API returned HTTP "+r.status);
 return r.status===204?{}:await r.json();
}
function eventTimestamp(x:any):string|null {
 if(x && Number.isFinite(Number(x.ts_event)) && Number(x.ts_event)>1000000000)
   return new Date(Number(x.ts_event)*1000).toISOString();
 if(x && Number.isFinite(Number(x.ts)) && Number(x.ts)>1000000000)
   return new Date(Number(x.ts)*1000).toISOString();
 if(x && Number.isFinite(Number(x.ts_epoch)) && Number(x.ts_epoch)>1000000000000)
   return new Date(Number(x.ts_epoch)).toISOString();
 if(x && typeof x.date==="string" && /T\d\d:\d\d/.test(x.date)){
   const value=Date.parse(x.date);
   if(Number.isFinite(value))return new Date(value).toISOString();
 }
 return null;
}
function messageId(x:any):string {
 return typeof x?.["message-id"]==="string" ? x["message-id"] :
   typeof x?.messageId==="string" ? x.messageId : "";
}
function normalizeId(id:string):string{return id.trim().replace(/^</,"").replace(/>$/,"").toLowerCase();}
async function recordEvent(x:any):Promise<boolean>{
 if(!x || typeof x!=="object" || Array.isArray(x))return false;
 const id=messageId(x),email=typeof x.email==="string"?x.email:"";
 const kind=typeof x.event==="string"?x.event:"";
 const when=eventTimestamp(x);
 if(!id || !email || !kind || !when)return false;
 const answer=await rpc("record_brevo_delivery_event",{
  p_message_id:id,p_recipient:email,p_event:kind,p_occurred_at:when
 });
 return !!answer?.matched;
}
async function setup(token:string,reportPhase:(step:string)=>void):Promise<Response>{
 if(!validToken(token) || await rpc("verify_brevo_delivery_token",{
  p_token:token,p_kind:"setup"
 })!==true)return result(401,{error:"Unauthorized"});
 reportPhase('get_webhook_secret');
 const hookToken=await rpc("brevo_delivery_setup_credential",{p_setup_token:token});
 if(!validToken(hookToken))throw Error("Webhook signing secret unavailable");
 const cfg={
  description:"DZOFT transactional email delivery (client + owner)",
  url:WEBHOOK_URL,type:"transactional",channel:"email",
  events:EVENTS,
  headers:[{key:"X-DZOFT-Delivery-Token",value:hookToken}]
 };
 reportPhase("brevo_list_webhooks");
 // Some Brevo accounts reject the optional type filter with HTTP 400.
 // Try the unfiltered read before assuming webhook management is unavailable.
 let existing:any;
 try{existing=await brevo("/webhooks?type=transactional");}
 catch(_){reportPhase("brevo_list_unfiltered");existing=await brevo("/webhooks");}
 const hooks=Array.isArray(existing?.webhooks)?existing.webhooks:[];
 const owned=hooks.find((x:any)=>x&&x.url===WEBHOOK_URL&&x.type==="transactional");
 let id:number;
 if(owned && Number.isInteger(Number(owned.id))){
   id=Number(owned.id);
   reportPhase("brevo_update_webhook");
   await brevo("/webhooks/"+encodeURIComponent(String(id)),"PUT",cfg);
 } else {
   reportPhase("brevo_create_webhook");
   const added=await brevo("/webhooks","POST",cfg);
   id=Number(added?.id);
   if(!Number.isSafeInteger(id)||id<=0)throw Error("Brevo webhook ID unavailable");
 }
 reportPhase("mark_setup");
 await rpc("mark_brevo_delivery_setup",{p_webhook_id:id,p_backfill:false});

 // One-time retrospective provider verification, scoped to DZOFT's stored
 // sent-message IDs. This reads provider events; never sends or re-sends email.
 reportPhase("reconcile_history");
 let checked=0,matched=0,backfilled=true;
 try {
   const candidates=await rpc("brevo_delivery_candidates",{p_setup_token:token});
   if(!Array.isArray(candidates))throw Error("No verified reconciliation candidates");
   for(const c of candidates.slice(0,25)){
     if(typeof c?.message_id!=="string"||typeof c?.email!=="string")continue;
     const report=await brevo("/smtp/statistics/events?"+
       new URLSearchParams({messageId:c.message_id,email:c.email,limit:"100",days:"90"}));
     const events=Array.isArray(report?.events)?report.events:[];
     checked++;
     for(const event of events.slice(0,100)){
       if(normalizeId(messageId(event))!==normalizeId(c.message_id) ||
         String(event.email||"").trim().toLowerCase()!==c.email.trim().toLowerCase())continue;
       if(await recordEvent(event))matched++;
     }
   }
   await rpc("mark_brevo_delivery_setup",{p_webhook_id:id,p_backfill:true});
 } catch (_) {backfilled=false;}
 return result(200,{configured:true,backfill_complete:backfilled,
     checked_messages:checked,matched_events:matched});
}
// Official Brevo event-reporting API is available even when this account
// rejects webhook management. Polling is authenticated by a Vault setup token.
async function reconcile(token:string,recent:boolean):Promise<Response>{
 if(await rpc("verify_brevo_delivery_token",{p_token:token,p_kind:"setup"})!==true)
  return result(401,{error:"Unauthorized"});
 const candidates=await rpc(recent?"brevo_delivery_recent_candidates":"brevo_delivery_candidates",
  {p_setup_token:token});
 if(!Array.isArray(candidates))throw Error("Reconciliation source unavailable");
 let checked=0,matched=0;
 // Bound concurrent Brevo API calls to avoid account rate-limit bursts.
 for(let i=0;i<Math.min(candidates.length,recent?18:25);i+=3){
  const batch=candidates.slice(i,i+3);
  const outcomes=await Promise.all(batch.map(async(c:any)=>{
    if(typeof c?.message_id!=="string" || typeof c?.email!=="string")return 0;
    const report=await brevo("/smtp/statistics/events?"+
      new URLSearchParams({messageId:c.message_id,email:c.email,
        limit:"100",days:recent?"14":"90"}));
    if(!report || !Array.isArray(report.events))throw Error("Missing provider events");
    let found=0;
    for(const e of report.events.slice(0,100)){
      if(normalizeId(messageId(e))!==normalizeId(c.message_id) ||
         String(e.email||"").trim().toLowerCase()!==c.email.trim().toLowerCase())continue;
      if(await recordEvent(e))found++;
    }
    return found;
  }));
  matched+=outcomes.reduce((a:number,b:number)=>a+b,0);
  checked+=batch.length;
 }
 await rpc("mark_brevo_delivery_polling",{p_backfill:!recent});
 return result(200,{ok:true,mode:"scheduled_polling",checked,matched});
}

Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return result(405,{error:"Method not allowed"});
 const path=new URL(req.url).pathname;
 const isSetup=path.endsWith("/setup");
 const isProbe=path.endsWith("/probe");
 const isReconcile=path.endsWith("/reconcile");
 const isBackfill=path.endsWith("/backfill");
 const token=req.headers.get(isSetup||isProbe||isReconcile||isBackfill?
   "X-DZOFT-Setup-Token":"X-DZOFT-Delivery-Token") ?? "";
 if(!validToken(token))return result(401,{error:"Unauthorized"});
 let phase="authenticate_webhook";
 try{
  if(isSetup){phase="authenticate_setup";return await setup(token,function(p){phase=p;});}
  if(isReconcile || isBackfill){
    phase="brevo_event_reconciliation";
    return await reconcile(token,isReconcile);
  }
  if(isProbe){
   phase="authenticate_probe";
   if(await rpc("verify_brevo_delivery_token",{p_token:token,p_kind:"setup"})!==true)
     return result(401,{error:"Unauthorized"});
   phase="brevo_reporting_probe";
   await brevo("/smtp/statistics/events?days=1&limit=1");
   return result(200,{reporting_api_available:true});
  }
  if(await rpc("verify_brevo_delivery_token",{p_token:token,p_kind:"webhook"})!==true)
    return result(401,{error:"Unauthorized"});
  const length=Number(req.headers.get("content-length")||"0");
  if(length>20000)return result(413,{error:"Payload too large"});
  const body=await req.text();
  if(body.length>20000)return result(413,{error:"Payload too large"});
  let payload:any;
  try{payload=JSON.parse(body);}catch(_){return result(400,{error:"Invalid JSON"});}
  const entries=Array.isArray(payload)?payload:[payload];
  if(entries.length>20)return result(413,{error:"Too many events"});
  let matched=0;
  for(const event of entries)if(await recordEvent(event))matched++;
  return result(200,{ok:true,matched});
 }catch(error){
  // Only emit fixed stage labels and a safe HTTP status. Never provider responses,
  // client addresses, webhook tokens, message IDs or API keys.
  const detail=error instanceof Error?error.message:"";
  const status=/^Brevo API returned HTTP ([0-9]{3})$/.exec(detail);
  const diagnostic=status?"brevo_http_"+status[1]:
     detail==="Brevo API key unavailable"?"brevo_credentials_unavailable":
     detail==="Database RPC rejected"?"database_rpc_unavailable":"unavailable";
  return result(503,{error:"Delivery tracking temporarily unavailable",phase,diagnostic});
 }
});
