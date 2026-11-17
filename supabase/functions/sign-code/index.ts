// Sends the 6-digit code a client types back to sign a quote, by e-mail (Brevo).
// Reached with the client's account session, or with the client's secret link (portal token).
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
const maskMail = (m: string) => { const [u, d] = m.split("@"); return u.slice(0, 1) + "•••@" + d; };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "méthode non autorisée" }, 405);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const key = Deno.env.get("BREVO_API_KEY");
  if (!key) return json({ error: "service d’envoi indisponible" }, 500);
  const announced = Number(req.headers.get("content-length") || 0);
  if (announced > 8192) return json({ error: "requête trop longue" }, 413);
  const raw = await req.text();
  if (raw.length > 8192) return json({ error: "requête trop longue" }, 413);
  let b: any;
  try { b = JSON.parse(raw); } catch { return json({ error: "JSON invalide" }, 400); }
  if (!b || typeof b !== "object" || Array.isArray(b)) return json({ error: "données invalides" }, 400);
  // The client area sends its interface language; messages and the e-mail follow it.
  const en = b.lang === "en";
  const t = (fr: string, english: string) => (en ? english : fr);

  // who is signing: secret link, or signed-in client account
  let client: any = null;
  if (b.token) {
    const r = await db.from("clients").select("id,nom,email,contact,user_id").eq("portal_token", b.token).is("user_id", null).maybeSingle();
    client = r.data;
  } else {
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: who } = await db.auth.getUser(jwt);
    const u = who?.user;
    if (u && u.email_confirmed_at && u.app_metadata?.dzoft_owner !== true) {
      const r = await db.from("clients").select("id,nom,email,contact,user_id").eq("user_id", u.id).maybeSingle();
      client = r.data;
      if (client && !client.email) client.email = u.email;
    }
  }
  if (!client) return json({ error: t("accès refusé : reconnectez-vous", "access denied: please sign in again") }, 403);

  const { data: q } = await db.from("quotes").select("id,numero,client_id,shared,deleted_at,accepted_at,data").eq("id", b.quote_id).maybeSingle();
  if (!q || q.client_id !== client.id || !q.shared || q.deleted_at) return json({ error: t("devis introuvable", "quote not found") }, 404);
  if (q.accepted_at) return json({ error: t("ce devis est déjà accepté", "this quote is already accepted") }, 400);
  const valid = q.data?.f?.valid;
  if (/^\d{4}-\d{2}-\d{2}$/.test(valid || "") && new Date(valid + "T23:59:59") < new Date()) return json({ error: t("ce devis a expiré", "this quote has expired") }, 400);

  const target = [client.email, client.contact].map((x: string) => (x || "").trim()).find((x: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x)) || "";
  if (!target) return json({ error: t("aucune adresse e-mail connue : écrivez-moi pour l’ajouter", "no email address on file: message me to add one") }, 400);

  const n = new Uint32Array(1); crypto.getRandomValues(n);
  const code = String(n[0] % 1000000).padStart(6, "0");
  const s = new Uint8Array(16); crypto.getRandomValues(s);
  const salt = hex(s.buffer);
  const hash = hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + code)));
  const shown = maskMail(target);
  // Reserve quota under a database lock before sending, so parallel requests cannot bypass the limit.
  const reservation = await db.rpc("reserve_sign_code", {
    p_quote_id: q.id,
    p_client_id: client.id,
    p_salt: salt,
    p_code_hash: hash,
    p_target: shown,
    p_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
  if (reservation.error || !reservation.data?.ok) {
    const limited = reservation.data?.reason === "rate_limit";
    return json({ error: limited ? t("trop de codes demandés : réessayez dans un moment", "too many codes requested: please try again in a moment") : t("ce devis n’est plus disponible", "this quote is no longer available") }, limited ? 429 : 400);
  }

  let r: Response;
  try { r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST", signal: AbortSignal.timeout(12000), headers: { "api-key": key, "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({
      sender: { name: "DZOFT", email: Deno.env.get("SENDER_EMAIL") || "roland.dzoagbe@hotmail.com" },
      to: [{ email: target }], subject: t("Votre code de signature : ", "Your signature code: ") + code,
      htmlContent: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#0B1020"><h2 style="color:#0B1020">${t("Signature de votre devis", "Signing your quote")}</h2><p>${t("Votre code pour signer le devis n° ", "Your code to sign quote no. ")}<b>${String(q.numero || "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!))}</b>${t(" :", ":")}</p><p style="font-size:30px;font-weight:bold;letter-spacing:6px;text-align:center;margin:24px 0">${code}</p><p>${t("Il est valable 10 minutes. Ne le communiquez à personne : il vaut signature.", "It is valid for 10 minutes. Do not share it with anyone: it counts as your signature.")}</p><p>Roland Dzoagbe<br>DZOFT · 07 82 88 46 46</p></div>`,
    }),
  }); } catch {
    await db.rpc("cancel_sign_code_reservation", { p_sign_code_id: reservation.data.id });
    return json({ error: t("l’e-mail n’a pas pu être envoyé : réessayez dans un instant", "the email could not be sent: please try again in a moment") }, 502);
  }
  if (!r.ok) {
    console.error("Brevo rejected signature-code delivery; HTTP status", r.status);
    await db.rpc("cancel_sign_code_reservation", { p_sign_code_id: reservation.data.id });
    return json({ error: t("l’e-mail n’a pas pu être envoyé : réessayez dans un instant", "the email could not be sent: please try again in a moment") }, 502);
  }
  return json({ ok: true, channel: "email", target: shown });
});

