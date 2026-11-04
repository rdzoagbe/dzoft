// Owner-only payment reminders. Recipient, amount and attachment come from stored records.
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
export function eligible(q: any, inv: any) {
  return !!(q && q.shared && q.accepted_at && !q.deleted_at && inv?.id && inv.num && !inv.paid && !inv.payment_reported_at && Number.isFinite(Number(inv.amt)) && Number(inv.amt) > 0);
}
export function phone(value: unknown) {
  let p = String(value || "").replace(/[\s().-]/g, "");
  if (/^0[67]\d{8}$/.test(p)) p = "33" + p.slice(1);
  p = p.replace(/^00/, "").replace(/^\+/, "");
  return /^[1-9]\d{7,14}$/.test(p) ? p : "";
}
Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({error:"POST requis"},405);
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {auth:{persistSession:false}});
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const {data:{user}} = await db.auth.getUser(token);
    if (!user || user.app_metadata?.dzoft_owner !== true) return reply({error:"Accès administrateur requis"},403);
    const caller = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false}});
    const {data: owner, error: ownerError} = await caller.rpc("is_owner");
    if (ownerError || owner !== true) return reply({error:"Session administrateur expirée : reconnectez-vous"},403);
    const raw = await req.text();
    if (raw.length > 8000) return reply({error:"Requête trop longue"},413);
    const b = JSON.parse(raw);
    const english = b.lang === "en";
    if (!["preview","email","whatsapp"].includes(b.action)) return reply({error:"Action inconnue"},400);
    const {data:q,error:qe} = await db.from("quotes").select("id,numero,client_id,shared,accepted_at,deleted_at,invoices").eq("id",b.quote_id).maybeSingle();
    if (qe || !q || !q.shared || !q.accepted_at || q.deleted_at) return reply({error:"Le devis doit être accepté et visible dans l’espace client."},409);
    const {data:c,error:ce} = await db.from("clients").select("id,nom,email,contact,user_id").eq("id",q.client_id).maybeSingle();
    if (ce || !c) return reply({error:"Client introuvable"},404);
    const invoices = (q.invoices || []).filter((x:any) => eligible(q,x));
    const inv = invoices.find((x:any) => x.id === b.invoice_id) || (!b.invoice_id ? invoices[0] : null);
    if (!inv) return reply({error:"Ajoutez d’abord une facture impayée avec son numéro officiel et son montant dans la fiche projet."},409);
    const to = [c.email,c.contact].map(x=>String(x||"").trim()).find(x=>/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x)) || "";
    const link = "https://rdzoagbe.github.io/dzoft/espace/?projet=" + encodeURIComponent(q.id) + "&facture=" + encodeURIComponent(inv.id);
    const amount = Number(inv.amt).toLocaleString(english ? "en-GB" : "fr-FR",{minimumFractionDigits:2,maximumFractionDigits:2}) + " €";
    const message = english ? `Hello ${c.nom || ""}, a friendly reminder about invoice ${inv.num}, for ${amount}, relating to your accepted quote ${q.numero}. You can view the invoice and payment instructions here: ${link}\nIf you have already sent the payment, please let me know.\nBest wishes, Roland — DZOFT` : `Bonjour ${c.nom || ""}, petit rappel concernant ${inv.n || "la facture"} n° ${inv.num}, d’un montant de ${amount}, pour le devis ${q.numero} que vous avez accepté. Vous pouvez consulter la facture et les informations de paiement ici : ${link}\nSi vous avez déjà effectué le règlement, merci de me le signaler.\nÀ bientôt, Roland — DZOFT`;
    const ref = `payment:${q.id}:${inv.id}:${b.action}`;
    if (b.action === "preview") {
      const {data:history,error} = await db.from("notifications").select("kind,created_at,ok,error").eq("quote_id",q.id).like("ref",`payment:${q.id}:${inv.id}:%`).order("created_at",{ascending:false}).limit(8);
      if(error) throw error;
      return reply({invoice_id:inv.id,client:c.nom,email:to,phone:phone(c.contact),amount,number:inv.num,message,link,has_pdf:!!inv.file,invoices:invoices.map((x:any)=>({id:x.id,label:`${x.num} · ${x.n || "Facture"} · ${x.amt} €`})),history});
    }
    const recipient = b.action === "email" ? to : phone(b.phone || c.contact);
    if (!recipient) return reply({error:b.action === "email" ? "Ajoutez l’adresse e-mail à la fiche client." : "Saisissez un numéro WhatsApp valide avec indicatif international."},400);
    const text = String(b.message || message).trim();
    if (!text || text.length > 3000) return reply({error:"Message requis, 3 000 caractères maximum."},400);
    const since = new Date(Date.now()-30*60000).toISOString();
    const {data:recent,error:re} = await db.from("notifications").select("id").eq("ref",ref).gte("created_at",since).limit(1);
    if(re) throw re;
    if(recent?.length) return reply({error:"Une relance a déjà été préparée ou envoyée par ce canal dans les 30 dernières minutes. Vérifiez l’historique avant de recommencer."},409);
    // A deterministic reservation also stops concurrent sends in the same time window.
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(ref+":"+Math.floor(Date.now()/1800000))));
    digest[6]=(digest[6]&15)|64; digest[8]=(digest[8]&63)|128;
    const hex=Array.from(digest.slice(0,16),x=>x.toString(16).padStart(2,"0")).join("");
    const id=[hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join("-");
    const {error:reserve} = await db.from("notifications").insert({id,client_id:c.id,quote_id:q.id,kind:"payment_"+b.action,ref,recipient,ok:false,error:"Traitement en cours — résultat à vérifier"});
    if(reserve) return reply({error:"Relance déjà en cours ou journal indisponible."},409);
    try {
      if(b.action === "whatsapp") {
        const {error} = await db.from("notifications").update({ok:true,error:"Message préparé : envoi à confirmer dans WhatsApp"}).eq("id",id);
        if(error) throw error;
        return reply({ok:true,url:"https://wa.me/"+recipient+"?text="+encodeURIComponent(text),status:"prepared"});
      }
      const key=Deno.env.get("BREVO_API_KEY"); if(!key) throw new Error("Service e-mail non configuré");
      const attachment=[];
      if(b.attach_pdf === true) {
        const path=String(inv.file||"");
        if(!c.user_id || !path.startsWith(`u/${c.user_id}/factures/${q.id}/`) || path.includes("..") || !/\.pdf$/i.test(path)) throw new Error("PDF privé indisponible");
        const {data:file,error}=await db.storage.from("client-files").download(path);
        if(error || !file || file.size>7340032) throw new Error("PDF indisponible ou supérieur à 7 Mo");
        const bytes=new Uint8Array(await file.arrayBuffer());
        if(new TextDecoder().decode(bytes.slice(0,5))!=="%PDF-") throw new Error("PDF invalide");
        let binary=""; for(let i=0;i<bytes.length;i+=8192) binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
        attachment.push({name:String(inv.fileName||"facture.pdf").replace(/[\\/:*?"<>|\r\n]/g,"_").slice(0,120),content:btoa(binary)});
      }
      const sender=Deno.env.get("SENDER_EMAIL")||"roland.dzoagbe@hotmail.com";
      const response=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"api-key":key,"Content-Type":"application/json"},body:JSON.stringify({sender:{name:"Roland · DZOFT",email:sender},replyTo:{name:"Roland Dzoagbe",email:sender},to:[{email:to,name:c.nom}],subject:`${english ? "Payment reminder" : "Rappel de paiement"} · ${inv.num} · DZOFT`,textContent:text+"\n"+link,htmlContent:`<div style="font-family:Arial;max-width:560px;margin:auto"><h2>${english ? "Payment reminder" : "Rappel de paiement"}</h2><p style="white-space:pre-wrap">${esc(text)}</p><p><a href="${esc(link)}" style="display:inline-block;background:#4361ee;color:white;padding:14px 20px;border-radius:10px">${english ? "View invoice and pay" : "Consulter la facture et payer"}</a></p></div>`,...(attachment.length?{attachment}:{})})});
      if(!response.ok) throw new Error(`Envoi refusé par Brevo (${response.status})`);
      const {error:logged}=await db.from("notifications").update({ok:true,error:null}).eq("id",id);
      return reply({ok:true,status:"accepted",warning:logged?"E-mail accepté par Brevo, mais journal non mis à jour.":null});
    } catch(error) {
      await db.from("notifications").update({ok:false,error:String((error as Error).message).slice(0,300)}).eq("id",id);
      return reply({error:(error as Error).message},502);
    }
  } catch { return reply({error:"Impossible de traiter la relance. Aucun nouvel envoi automatique ne sera tenté."},500); }
});
