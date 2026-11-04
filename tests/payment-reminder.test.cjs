const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {stripTypeScriptTypes}=require('node:module');
const source=stripTypeScriptTypes(fs.readFileSync('supabase/functions/payment-reminder/index.ts','utf8').replace(/^import .*;$/m,'').replace(/export function/g,'function'));
let handler, sent=0, records=[], owner=true, approved=true, paid=false;
const quote={id:'q',numero:'D-1',client_id:'c',shared:true,accepted_at:'2026-11-01',invoices:[{id:'i',num:'INV-1',n:'Acompte',amt:450}]};
function query(table){let insert=null,update=null;const api={select(){return api},eq(){return api},like(){return api},gte(){return api},order(){return api},limit(){return api},insert(v){insert=v;return api},update(v){update=v;return api},maybeSingle(){return api},then(resolve){let data=null,error=null;if(insert){if(records.length)error={message:'duplicate'};else records.push(insert);}else if(update){Object.assign(records[0],update);}else if(table==='quotes'){data={...quote,accepted_at:approved?quote.accepted_at:null,invoices:[{...quote.invoices[0],paid}]};}else if(table==='clients')data={id:'c',nom:'Test',email:'test@example.com',contact:'+33612345678'};else data=records;return Promise.resolve({data,error}).then(resolve)}};return api;}
vm.runInNewContext(source,{Response,TextEncoder,TextDecoder,Uint8Array,crypto,Date,console,btoa,createClient:()=>({auth:{getUser:async()=>({data:{user:{app_metadata:{dzoft_owner:owner}}}})},rpc:async()=>({data:owner}),from:query}),Deno:{env:{get:()=> 'test'},serve:fn=>handler=fn},fetch:async()=>{sent++;return new Response('{}',{status:201})}});
async function call(action,extra={}){const r=await handler(new Request('https://test',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify({action,quote_id:'q',invoice_id:'i',...extra})}));return {status:r.status,body:await r.json()};}
(async()=>{
 owner=false;assert.equal((await call('email')).status,403);assert.equal(sent,0);owner=true;
 approved=false;assert.equal((await call('email')).status,409);approved=true;
 paid=true;assert.equal((await call('email')).status,409);paid=false;
 const preview=await call('preview');assert.equal(preview.status,200);assert.match(preview.body.message,/450,00/);assert.equal(sent,0);
 const english=await call('preview',{lang:'en'});assert.match(english.body.message,/Hello Test/);assert.match(english.body.message,/450.00/);
 const email=await call('email');assert.equal(email.status,200);assert.equal(sent,1);assert.equal(records[0].ok,true);
 assert.equal((await call('email')).status,409);assert.equal(sent,1);
 records=[];const wa=await call('whatsapp');assert.equal(wa.status,200);assert.match(wa.body.url,/^https:\/\/wa.me\/33612345678\?text=/);assert.equal(wa.body.status,'prepared');assert.equal(sent,1);
 records=[];assert.equal((await call('whatsapp',{phone:'invalid'})).status,400);
 console.log('PASS: owner authorization, accepted/unpaid invoice guards, preview without sending, email dispatch and audit, duplicate prevention, WhatsApp preparation and phone validation. All services mocked; no real messages sent.');
})().catch(e=>{console.error(e);process.exitCode=1});
