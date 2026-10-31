// Sends a project e-mail to a client through Brevo. Only the owner of the private space can call it.
import { createClient } from "npm:@supabase/supabase-js@2";

const PORTAL = "https://rdzoagbe.github.io/dzoft/espace/";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
function esc(t: unknown) {
  return String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
function eur(n: number) {
  return (Math.round((+n || 0) * 100) / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}
function claims(token: string) {
  try {
    const p = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(p + "=".repeat((4 - p.length % 4) % 4)));
  } catch { return {}; }
}
function hasRecentTotp(payload: any) {
  const now = Math.floor(Date.now() / 1000);
  return Array.isArray(payload?.amr) && payload.amr.some((entry: any) => {
    const at = Number(entry?.timestamp);
    return entry?.method === "totp" && Number.isFinite(at) && at <= now + 120 && now - at <= 8 * 60 * 60;
  });
}
function mail(title: string, paras: string[], button: string, link: string) {
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#0B1020">
  <h2 style="color:#0B1020">${esc(title)}</h2>
  ${paras.map((p) => `<p>${p}</p>`).join("\n  ")}
  <p style="text-align:center;margin:28px 0"><a href="${esc(link)}" style="background:#4361EE;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:bold;display:inline-block">${esc(button)}</a></p>
  <p>Roland Dzoagbe<br>DZOFT · 07 82 88 46 46</p>
  <p style="font-size:12px;color:#5d6f83">Vous recevez cet e-mail parce que vous êtes client de DZOFT. Votre espace : <a href="${PORTAL}" style="color:#3448D6">rdzoagbe.github.io/dzoft/espace</a></p>
</div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "méthode non autorisée" }, 405);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: who } = await db.auth.getUser(token);
  const me = who?.user;
  if (!me || me.app_metadata?.dzoft_owner !== true) return json({ error: "non autorisé" }, 403);
  // with two-step sign-in turned on, the call must come from a session that passed it
  const verified = (me.factors || []).some((f: { status: string }) => f.status === "verified");
  const authClaims = claims(token);
  if (verified && (authClaims.aal !== "aal2" || !hasRecentTotp(authClaims))) {
    return json({ error: "double authentification requise : reconnectez-vous avec un nouveau code" }, 403);
  }

  const key = Deno.env.get("BREVO_API_KEY");
  if (!key) return json({ error: "clé Brevo absente : ajoutez le secret BREVO_API_KEY" }, 500);
  const sender = Deno.env.get("SENDER_EMAIL") || "roland.dzoagbe@hotmail.com";

  const b = await req.json().catch(() => ({}));
  const kind = String(b.kind || "");
  if (!["quote", "message", "step", "validate"].includes(kind)) return json({ error: "type d’e-mail inconnu" }, 400);

  let q: any = null;
  if (b.quote_id) {
    const r = await db.from("quotes").select("id,numero,client_id,total,accepted_at,accepted_total,shared,data").eq("id", b.quote_id).maybeSingle();
    q = r.data;
  }
  const clientId = b.client_id || q?.client_id;
  if (!clientId) return json({ error: "client introuvable" }, 400);
  const { data: c } = await db.from("clients").select("id,nom,email,contact,user_id,portal_token").eq("id", clientId).maybeSingle();
  if (!c) return json({ error: "client introuvable" }, 400);

  const to = [c.email, c.contact].map((x: string) => (x || "").trim()).find((x: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
  const ref = [kind, q?.id || "", String(b.step || "").slice(0, 80)].join(":");
  const log = (ok: boolean, error?: string) => db.from("notifications").insert({ client_id: c.id, quote_id: q?.id || null, kind, ref, recipient: to || "", ok, error: error || null });
  if (!to) { await log(false, "pas d’adresse e-mail"); return json({ error: "ce client n’a pas d’adresse e-mail" }, 400); }

  // the same e-mail is not sent twice within 30 minutes (a step ticked, unticked, ticked again)
  if (kind !== "message") {
    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: dup } = await db.from("notifications").select("id").eq("client_id", c.id).eq("ref", ref).eq("ok", true).gte("created_at", since).limit(1);
    if (dup && dup.length) return json({ ok: true, skipped: true, to });
  }

  const first = String(c.nom || "").trim().split(/\s+/)[0] || "";
  const heads = ((q?.data?.lines) || []).filter((l: any) => l.h && l.l).map((l: any) => l.l);
  const title = heads.length ? heads.join(" + ") : (q ? "Devis " + q.numero : "votre projet");
  const route = !q ? "#/messages" : kind === "quote" && !q.accepted_at ? "#/devis/" + q.id : "#/projets/" + q.id;
  const link = c.user_id ? PORTAL + (kind === "message" ? "#/messages" : route) : PORTAL + "#" + c.portal_token;
  const hello = "Bonjour" + (first ? " " + esc(first) : "") + ",";
  const step = esc(String(b.step || "").slice(0, 120));

  let subject = "", html = "";
  if (kind === "quote") {
    subject = "Votre devis " + (q?.numero || "") + " est disponible";
    html = mail("Votre devis est prêt", [hello, `Votre devis n° <b>${esc(q?.numero)}</b> pour « ${esc(title)} » (${eur(q?.total)}) est disponible dans votre espace client.`, "Vous pouvez le consulter, me poser vos questions et l’accepter en ligne."], "Voir mon devis", link);
  } else if (kind === "message") {
    const text = esc(String(b.text || "").slice(0, 600)).replace(/\n/g, "<br>");
    subject = "Nouveau message de Roland · DZOFT";
    html = mail("Vous avez un nouveau message", [hello, `<span style="display:block;background:#f3f7fb;border-radius:10px;padding:12px 14px">${text}</span>`, "Vous pouvez me répondre directement depuis votre espace client."], "Lire et répondre", link);
  } else if (kind === "step") {
    subject = "Votre projet avance : " + String(b.step || "").slice(0, 80) + " ✓";
    html = mail("Votre projet avance", [hello, `L’étape <b>« ${step} »</b> de votre projet « ${esc(title)} » est terminée.`, "Vous suivez toutes les étapes dans votre espace client."], "Suivre mon projet", link);
  } else {
    subject = "Votre validation est attendue : " + String(b.step || "").slice(0, 80);
    html = mail("Votre avis est attendu", [hello, `L’étape <b>« ${step} »</b> de votre projet « ${esc(title)} » est prête.`, "Merci de la vérifier puis de la valider dans votre espace client, ou de me dire ce qu’il faut changer."], "Voir et valider", link);
  }

  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": key, "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({
      sender: { name: "DZOFT", email: sender },
      to: [{ email: to, name: c.nom || undefined }],
      replyTo: { email: sender, name: "Roland Dzoagbe" },
      subject, htmlContent: html,
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    await log(false, ("Brevo " + r.status + " " + t).slice(0, 300));
    return json({ error: "Brevo a refusé l’envoi (" + r.status + ") : " + t.slice(0, 200) }, 502);
  }
  await log(true);
  return json({ ok: true, to });
});

