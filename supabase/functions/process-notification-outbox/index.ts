// Delivers significant project emails from the transactional outbox.
// Cron calls use a random value stored only in Supabase Vault. Manual calls
// require the authenticated owner session and the existing MFA check.
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const PORTAL = "https://rdzoagbe.github.io/dzoft/espace/";
const ADMIN = "https://rdzoagbe.github.io/dzoft/admin/";
const SENDER_FALLBACK = "roland.dzoagbe@hotmail.com";
const MAX_ATTACHMENT_BYTES = 7 * 1024 * 1024;
const allowedOrigins = new Set([
  "https://rdzoagbe.github.io",
  "http://127.0.0.1:8766",
  "http://localhost:8766",
]);

function cors(origin: string | null) {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-dzoft-cron-secret",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  if (origin && allowedOrigins.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}
function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
  });
}
function esc(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]!));
}
function eur(value: unknown) {
  const n = Number(value || 0);
  return (Math.round(n * 100) / 100).toLocaleString("fr-FR", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }) + " €";
}
function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return btoa(binary);
}
function jwtClaims(token: string) {
  try {
    const middle = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(middle + "=".repeat((4 - middle.length % 4) % 4)));
  } catch {
    return {};
  }
}
const DIGEST_GROUPS: Record<string, string> = { design: "Design", accounts: "Comptes", venue: "Lieux", chat: "Conversations", safety: "Sécurité", other: "Autres travaux" };
const DIGEST_STATUS: Record<string, string> = { planned: "Prévu", working: "En cours", built: "Construit", tested: "Testé" };
type DigestItem = { category: string; status: string; summary: string };
function digestHtml(items: DigestItem[]) {
  return `<ul style="padding-left:18px;margin:16px 0">${items.map((u) =>
    `<li style="margin:0 0 12px"><b>${esc(DIGEST_GROUPS[u.category] || "Autres travaux")}</b> · ${esc(DIGEST_STATUS[u.status] || "")}<br>${esc(u.summary)}</li>`).join("")}</ul>`;
}
// English wording for clients who chose English in their client area (clients.lang = 'en').
// Payment e-mails stay bilingual; the owner's copies stay in French.
const DIGEST_GROUPS_EN: Record<string, string> = { design: "Design", accounts: "Accounts", venue: "Venues", chat: "Conversations", safety: "Safety", other: "Other work" };
const DIGEST_STATUS_EN: Record<string, string> = { planned: "Planned", working: "In progress", built: "Built", tested: "Tested" };
function digestHtmlEn(items: DigestItem[]) {
  return `<ul style="padding-left:18px;margin:16px 0">${items.map((u) =>
    `<li style="margin:0 0 12px"><b>${esc(DIGEST_GROUPS_EN[u.category] || "Other work")}</b> · ${esc(DIGEST_STATUS_EN[u.status] || "")}<br>${esc(u.summary)}</li>`).join("")}</ul>`;
}
function eventCopyEn(type: string, summary: string, quote: any, message: string, digest: DigestItem[] = []) {
  const number = quote?.numero ? ` · quote ${quote.numero}` : "";
  const detail = summary.split(" · ").slice(1).join(" · ");
  const body = message
    ? `<div style="white-space:pre-wrap;background:#f3f6fc;border-radius:10px;padding:14px;margin:18px 0">${esc(message)}</div>`
    : "";
  if (type === "progress_digest") return {
    subject: `Your project is moving forward${number} · DZOFT`,
    intro: "Here is the latest progress on your project:",
    body: digestHtmlEn(digest) + "<p style=\"font-size:13px;color:#5d6f83\">“Tested” means checked on our side. You give your feedback and approvals in your client area.</p>",
  };
  if (type === "change_proposed" || type === "change_signed") {
    const ref = (summary.match(/^Proposition (?:complémentaire )?(\S+)/) || [])[1] || "";
    const amount = (summary.match(/·\s*([0-9][0-9\s\u202f\u00a0.,]*€)/) || [])[1] || "";
    const what = `${ref ? "no. " + ref : ""}${ref && amount ? ", " : ""}${amount}`;
    // Acknowledgement of the client's signature (Code civil art. 1127-2), same content as the French copy.
    if (type === "change_signed") return {
      subject: `Your signature has been recorded: proposal ${ref}${amount ? " · " + amount : ""} · DZOFT`,
      intro: `We have received your signature of the proposal for additional work${what ? " (" + what + ")" : ""}${quote?.numero ? ", in addition to quote " + quote.numero : ""}.`,
      body: `<p>It is subject to the same terms and conditions of sale as that quote. The signed details remain available in your client area. The additional invoice will be sent to you once the work is finished.</p>`,
    };
    return {
      subject: `Additional proposal ${ref} to sign${amount ? " · " + amount : ""} · DZOFT`,
      intro: `A proposal for additional work${what ? " (" + what + ")" : ""} is waiting in your client area. It lists each item with its price. Your signed quote and its invoices stay unchanged.`,
      body: `<p>You can read it, then sign it with a 6-digit code sent to your email address, or decline it. Nothing is charged without your signature.</p>`,
    };
  }
  const subjects: Record<string, string> = {
    quote_published: `Your quote${quote?.numero ? " no. " + quote.numero : ""} is ready · DZOFT`,
    quote_accepted: `Quote accepted${quote?.numero ? " no. " + quote.numero : ""} · DZOFT`,
    owner_message: `Reply from DZOFT${number}`,
    step_validation_requested: `Your approval is needed${number} · DZOFT`,
    step_progress: `Your project is moving forward${number} · DZOFT`,
    client_step_validated: `Approval received${number} · DZOFT`,
    invoice_shared: `Your invoice is available${number} · DZOFT`,
  };
  const intros: Record<string, string> = {
    quote_published: `Quote ${quote?.numero || ""} is ready and available in your client area.`,
    quote_accepted: `Quote ${quote?.numero || ""} has been accepted online.`,
    owner_message: "Roland has replied to you in your DZOFT client area.",
    step_validation_requested: `Please check the “${detail}” stage in your client area and let us know whether you approve it.`,
    step_progress: `The “${detail}” stage of your project is complete. Full progress details are in your client area.`,
    client_step_validated: `Your approval of the “${detail}” stage has been recorded.`,
    invoice_shared: `The invoice “${detail}” is available. You can also find it, with the payment details, in your client area.`,
  };
  return { subject: subjects[type] || `DZOFT update${number}`, intro: intros[type] || "There is an update on your project in your client area.", body };
}
function eventCopy(type: string, summary: string, quote: any, message: string, isOwner: boolean, digest: DigestItem[] = []) {
  // Grouped progress: one email listing every summary of the same publication.
  if (type === "progress_digest") {
    const ref = quote?.numero ? ` · devis ${quote.numero}` : "";
    return {
      subject: isOwner ? `Avancement publié au client${ref} · DZOFT` : `Votre projet avance${ref} · DZOFT`,
      intro: isOwner ? "Ce résumé vient d’être publié dans l’espace client :" : "Voici les dernières avancées de votre projet :",
      body: digestHtml(digest) + (isOwner ? "" : "<p style=\"font-size:13px;color:#5d6f83\">« Testé » signifie vérifié de notre côté. Votre avis et vos validations se donnent dans votre espace client.</p>"),
    };
  }
  if (['payment_reported', 'payment_received', 'payment_reopened'].includes(type)) return {
    subject: (type === 'payment_reported' ? 'Paiement déclaré / Payment reported' : type === 'payment_received' ? 'Paiement reçu / Payment received' : 'Confirmation corrigée / Confirmation corrected') + ' · DZOFT',
    intro: summary + (type === 'payment_reported' ? '. Le client déclare avoir effectué le virement. Vérifiez votre compte bancaire avant de confirmer sa réception.' : type === 'payment_received' ? '. La réception sur le compte a été confirmée par Roland.' : '. Le statut est de nouveau en cours de vérification. Contactez Roland pour toute question.'),
    body: `<hr><p lang="en">${type === 'payment_reported' ? 'The client has reported sending the payment. Please check your bank account before confirming receipt.' : type === 'payment_received' ? 'Roland has confirmed that the payment has reached his bank account.' : 'The payment confirmation has been corrected. Its status is being checked again. Please contact Roland if you have any questions.'}</p><p lang="en">Quote: ${esc(quote?.numero || '')}. See your workspace for the invoice and payment status.</p>`
  };
  const number = quote?.numero ? ` · devis ${quote.numero}` : "";
  const detail = summary.split(" · ").slice(1).join(" · ");
  // Priced extra-work proposal: "Proposition complémentaire D-2026-001-C1 · 400,00 € · …"
  if (type === "change_proposed" || type === "change_signed") {
    const ref = (summary.match(/^Proposition (?:complémentaire )?(\S+)/) || [])[1] || "";
    const amount = (summary.match(/·\s*([0-9][0-9\s\u202f\u00a0.,]*€)/) || [])[1] || "";
    const what = `${ref ? "n° " + ref : ""}${ref && amount ? ", " : ""}${amount}`;
    // Client copy: acknowledgement of the signature (Code civil art. 1127-2).
    if (type === "change_signed" && !isOwner) return {
      subject: `Votre signature est enregistrée : proposition ${ref}${amount ? " · " + amount : ""} · DZOFT`,
      intro: `Nous avons bien reçu votre signature de la proposition de travaux complémentaires${what ? " (" + what + ")" : ""}${quote?.numero ? ", en complément du devis " + quote.numero : ""}.`,
      body: `<p>Elle suit les mêmes conditions générales de vente que ce devis. Le détail signé reste consultable dans votre espace client. La facture complémentaire vous sera adressée une fois les travaux terminés.</p>`,
    };
    if (type === "change_signed") return {
      subject: `Proposition ${ref} signée par le client${amount ? " (" + amount + ")" : ""} · DZOFT`,
      intro: `${summary}. Vous pouvez marquer les travaux terminés puis créer la facture complémentaire depuis la fiche projet.`,
      body: "",
    };
    if (isOwner) return {
      subject: `Proposition ${ref} envoyée au client${amount ? " (" + amount + ")" : ""} · DZOFT`,
      intro: `La proposition ${what} a été envoyée au client. Il la signera avec un code reçu par e-mail.`,
      body: "",
    };
    return {
      subject: `Proposition complémentaire ${ref} à signer${amount ? " · " + amount : ""} · DZOFT`,
      intro: `Une proposition de travaux complémentaires${what ? " (" + what + ")" : ""} vous attend dans votre espace client. Elle détaille chaque prestation avec son prix. Le devis signé et ses factures restent inchangés.`,
      body: `<p>Vous pouvez la lire, puis la signer avec un code à 6 chiffres envoyé à votre adresse e-mail, ou la refuser. Rien ne vous est facturé sans votre signature.</p>`,
    };
  }
  const subjectByType: Record<string, string> = {
    quote_published: `Votre devis${quote?.numero ? " n° " + quote.numero : ""} est disponible · DZOFT`,
    quote_accepted: `Devis accepté${quote?.numero ? " n° " + quote.numero : ""} · DZOFT`,
    client_message: `Nouveau message client${number} · DZOFT`,
    owner_message: `Réponse de DZOFT${number}`,
    step_validation_requested: `Votre validation est attendue${number} · DZOFT`,
    step_progress: `Votre projet avance${number} · DZOFT`,
    client_step_validated: `Validation reçue${number} · DZOFT`,
    invoice_shared: `Votre facture est disponible${number} · DZOFT`,
    client_file_uploaded: `Nouveau fichier client${number} · DZOFT`,
    review_submitted: `Nouvel avis reçu${number} · DZOFT`,
  };
  let intro = summary;
  if (type === "quote_published") intro = `Le devis ${quote?.numero || ""} est prêt et disponible dans votre espace client.`;
  if (type === "quote_accepted") intro = `Le devis ${quote?.numero || ""} a été accepté en ligne.`;
  if (type === "client_message") intro = "Un nouveau message a été reçu dans l’espace client.";
  if (type === "owner_message") intro = "Roland vous a répondu depuis votre espace client DZOFT.";
  if (type === "step_validation_requested") intro = `Merci de vérifier l’étape « ${detail} » dans votre espace et de nous indiquer si vous la validez.`;
  if (type === "step_progress") intro = `L’étape « ${detail} » de votre projet est terminée. Le détail de l’avancement est dans votre espace client.`;
  if (type === "client_step_validated") intro = `Votre validation de l’étape « ${detail} » a bien été enregistrée.`;
  if (type === "invoice_shared") intro = `La facture « ${detail} » est disponible. Vous pouvez aussi retrouver la facture et les informations de règlement dans votre espace client.`;
  if (type === "client_file_uploaded") intro = `${summary}.`;
  if (type === "review_submitted") intro = `${summary}. Ouvrez la fiche du projet pour la relire.`;
  const body = message
    ? `<div style="white-space:pre-wrap;background:#f3f6fc;border-radius:10px;padding:14px;margin:18px 0">${esc(message)}</div>`
    : "";
  if (isOwner) {
    const ownerSubjects: Record<string, string> = {
      quote_published: `Devis envoyé${quote?.numero ? " n° " + quote.numero : ""} · DZOFT`,
      quote_accepted: `Devis accepté${quote?.numero ? " n° " + quote.numero : ""} · DZOFT`,
      client_message: `Nouveau message client${number} · DZOFT`,
      step_validation_requested: `Validation demandée au client${number} · DZOFT`,
      step_progress: `Jalon envoyé au client${number} · DZOFT`,
      client_step_validated: `Étape validée par le client${number} · DZOFT`,
      invoice_shared: `Facture envoyée au client${number} · DZOFT`,
      client_file_uploaded: `Fichier reçu du client${number} · DZOFT`,
      review_submitted: `Nouvel avis client${number} · DZOFT`,
      change_requested: `Nouvelle demande de modification du client${number} · DZOFT`,
      change_declined: `Proposition refusée par le client${number} · DZOFT`,
      change_withdrawn: `Demande retirée par le client${number} · DZOFT`,
    };
    if (type === "change_requested") return { subject: ownerSubjects[type], intro: `${summary}. Ouvrez la fiche projet pour la chiffrer : le client ne voit aucun prix tant que vous n’avez pas envoyé de proposition.`, body };
    if (type === "change_declined" || type === "change_withdrawn") return { subject: ownerSubjects[type], intro: `${summary}. Rien n’est facturé pour cette demande.`, body };
    return {
      subject: ownerSubjects[type] || `Mise à jour DZOFT${number}`,
      intro: summary,
      body,
    };
  }
  return {
    subject: subjectByType[type] || `Mise à jour DZOFT${number}`,
    intro,
    body,
  };
}

Deno.serve(async (req) => {
  const headers = cors(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405, headers);
  const length = Number(req.headers.get("Content-Length") || 0);
  if (length > 12000) return json({ error: "request too large" }, 413, headers);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const brevoKey = Deno.env.get("BREVO_API_KEY");
  if (!url || !serviceKey || !brevoKey) return json({ error: "notification service is not configured" }, 500, headers);

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const body = await req.json().catch(() => ({}));
  const cronSecret = req.headers.get("x-dzoft-cron-secret") || "";
  let ownerAuthorized = false;
  let ownerClient: ReturnType<typeof createClient> | null = null;
  if (cronSecret) {
    const { data: valid, error } = await db.rpc("verify_email_outbox_cron", { p_secret: cronSecret });
    if (error || valid !== true) return json({ error: "not authorized" }, 401, headers);
  } else {
    const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!bearer || !anonKey) return json({ error: "not authorized" }, 401, headers);
    const { data: authData } = await db.auth.getUser(bearer);
    if (!authData?.user) return json({ error: "not authorized" }, 401, headers);
    const caller = createClient(url, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    });
    const { data: isOwner, error: ownerError } = await caller.rpc("is_owner");
    if (ownerError || isOwner !== true) return json({ error: "owner access required" }, 403, headers);
    const verified = (authData.user.factors || []).some((f: { status: string }) => f.status === "verified");
    if (verified && jwtClaims(bearer).aal !== "aal2") return json({ error: "two-step verification required" }, 403, headers);
    ownerAuthorized = true;
    ownerClient = caller;
  }

  if (body.retry_id) {
    if (!ownerAuthorized || !ownerClient) return json({ error: "owner access required" }, 403, headers);
    const { error } = await ownerClient.rpc("retry_email_outbox", { p_id: String(body.retry_id) });
    if (error) return json({ error: "email could not be queued for retry" }, 409, headers);
  }

  const { data: jobs, error: claimError } = await db.rpc("claim_email_outbox", { p_limit: 10 });
  if (claimError) return json({ error: "email queue is temporarily unavailable" }, 503, headers);
  const sender = Deno.env.get("SENDER_EMAIL") || SENDER_FALLBACK;
  const results: Array<{ id: string; status: string }> = [];

  for (const job of jobs || []) {
    let retryable = true;
    try {
      const [{ data: event }, { data: client }] = await Promise.all([
        db.from("project_events").select("event_key,event_type,summary,message_id,quote_id,invoice_id,file_name").eq("id", job.event_id).maybeSingle(),
        job.client_id
          ? db.from("clients").select("id,nom,email,contact,user_id,portal_token,lang").eq("id", job.client_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      if (!event) throw Object.assign(new Error("project event is missing"), { retryable: false });
      const to = (job.recipient || (job.recipient_role === "client" ? client?.email || client?.contact : "") || "").trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
        throw Object.assign(new Error("recipient email address is missing or invalid"), { retryable: false });
      }

      let quote: any = null;
      if (event.quote_id) {
        const { data } = await db.from("quotes")
          .select("id,numero,client_id,total,accepted_total,data,invoices,shared,accepted_at")
          .eq("id", event.quote_id).maybeSingle();
        quote = data;
      }
      let message = "";
      if (event.message_id) {
        const { data } = await db.from("messages").select("body").eq("id", event.message_id).maybeSingle();
        message = String(data?.body || "").slice(0, 2000);
      }
      let digest: DigestItem[] = [];
      if (event.event_type === "progress_digest") {
        const batch = String(event.event_key || "").replace(/^digest:/, "");
        const { data, error } = await db.from("project_updates").select("category,status,summary,created_at")
          .eq("batch_id", batch).eq("quote_id", event.quote_id).order("created_at", { ascending: true });
        if (error) throw Object.assign(new Error("progress summaries could not be read"), { retryable: true });
        digest = data || [];
        if (!digest.length) throw Object.assign(new Error("progress summaries are missing"), { retryable: false });
      }
      const isOwner = job.recipient_role === "owner";
      const paymentEvent = event.event_type.startsWith("payment_");
      const english = !isOwner && client?.lang === "en";
      const copy = english && !paymentEvent ? eventCopyEn(event.event_type, event.summary, quote, message, digest) : eventCopy(event.event_type, event.summary, quote, message, isOwner, digest);
      const firstName = String(client?.nom || "").trim().split(/\s+/)[0] || "";
      let link = isOwner ? ADMIN : PORTAL;
      if (isOwner && quote?.id) link = `${ADMIN}suivi.html?q=${encodeURIComponent(quote.id)}`;
      else if (!isOwner && quote?.id && event.event_type === "quote_published") {
        const query = new URLSearchParams({ devis: String(quote.id) });
        if (!client?.user_id) query.set("inscription", "1");
        link = `${PORTAL}?${query.toString()}`;
      } else if (!isOwner && quote?.id && event.event_type === "invoice_shared") {
        const query = new URLSearchParams({ projet: String(quote.id) });
        if (event.invoice_id) query.set("facture", String(event.invoice_id));
        if (!client?.user_id) query.set("inscription", "1");
        link = `${PORTAL}?${query.toString()}`;
      }
      else if (!isOwner && client?.user_id) link = PORTAL + (event.event_type.includes("message") ? "#/messages" : quote?.id ? (event.event_type === "quote_published" ? `#/devis/${quote.id}` : `#/projets/${quote.id}`) : "#/messages");
      else if (!isOwner && client?.portal_token) link = PORTAL + "#" + client.portal_token;
      const hello = isOwner ? "Bonjour Roland," : `${english ? "Hello" : "Bonjour"}${firstName ? " " + esc(firstName) : ""},`;
      const heading = isOwner ? `Événement projet · ${esc(event.summary)}` : event.event_type === "change_proposed" ? (english ? "An additional proposal to sign" : "Une proposition complémentaire à signer") : event.event_type === "change_signed" ? (english ? "Your signature has been recorded" : "Votre signature est enregistrée") : (english ? "An update on your project" : "Une mise à jour de votre projet");
      let attachment: Array<{ name: string; content: string }> = [];

      if (job.attach_invoice_pdf) {
        if (!client?.user_id || !quote?.id || !event.invoice_id || event.event_type !== "invoice_shared") {
          throw Object.assign(new Error("invoice attachment cannot be verified"), { retryable: false });
        }
        const invoice = (Array.isArray(quote.invoices) ? quote.invoices : []).find((x: any) => String(x.id) === String(event.invoice_id));
        const path = String(invoice?.file || "");
        const prefix = `u/${client.user_id}/factures/${quote.id}/`;
        if (!invoice || invoice.attachPdf !== true || !path.startsWith(prefix) || path.includes("..") || !/\.pdf$/i.test(path)) {
          throw Object.assign(new Error("selected invoice PDF is no longer available"), { retryable: false });
        }
        const { data: file, error: fileError } = await db.storage.from("client-files").download(path);
        if (fileError || !file) throw Object.assign(new Error("selected invoice PDF could not be downloaded"), { retryable: true });
        if (file.size > MAX_ATTACHMENT_BYTES) {
          throw Object.assign(new Error("invoice PDF is over the 7 MB email attachment limit; upload a smaller PDF or deselect the attachment"), { retryable: false });
        }
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-") {
          throw Object.assign(new Error("selected attachment is not a valid PDF"), { retryable: false });
        }
        attachment = [{
          name: String(invoice.fileName || "facture.pdf").replace(/[\\/:*?"<>|\r\n]/g, "_").slice(0, 120),
          content: bytesToBase64(bytes),
        }];
      }

      const needsAccount = !isOwner && !client?.user_id && (event.event_type === "quote_published" || event.event_type === "invoice_shared");
      const portalLine = isOwner
        ? `Client : ${client?.nom || "fiche projet"}. Ouvrez la fiche pour voir l’historique et l’état des envois.`
        : english
        ? (needsAccount && event.event_type === "quote_published"
          ? "Create your account with the same email address as on the quote. Once confirmed, the quote opens automatically; if you confirm on another device, come back to this link to view and accept it online."
          : needsAccount && event.event_type === "invoice_shared"
          ? "Create your account with the same email address as on the quote to open the invoice. If you confirm on another device, come back to this link after signing in. An invoice is for payment; online acceptance and signature apply to the quote."
          : event.event_type === "invoice_shared" && !attachment.length
          ? "Your invoice is also available in your client area."
          : "You’ll find your project’s information and history in your DZOFT client area.")
        : needsAccount && event.event_type === "quote_published"
        ? "Créez votre espace avec la même adresse e-mail que celle indiquée sur le devis. Après confirmation, le devis s’ouvrira automatiquement ; si vous confirmez sur un autre appareil, revenez à ce lien pour le consulter et l’accepter en ligne."
        : needsAccount && event.event_type === "invoice_shared"
        ? "Créez votre espace avec la même adresse e-mail que celle indiquée sur le devis pour ouvrir la facture. Si vous confirmez sur un autre appareil, revenez à ce lien après connexion. Une facture sert au règlement ; l’acceptation et la signature en ligne concernent le devis."
        : event.event_type === "invoice_shared" && !attachment.length
        ? "Votre facture est également accessible dans votre espace client."
        : "Retrouvez les informations et l’historique de votre projet dans votre espace DZOFT.";
      const ctaLabel = isOwner ? "Ouvrir la fiche projet"
        : english
        ? (needsAccount && event.event_type === "quote_published" ? "Create my account and accept the quote"
          : needsAccount && event.event_type === "invoice_shared" ? "Create my account and view the invoice"
          : event.event_type === "quote_published" ? "View and accept my quote"
          : event.event_type === "invoice_shared" ? "Open my invoice"
          : event.event_type === "change_proposed" ? "Read and sign the proposal"
          : "Open my client area")
        : needsAccount && event.event_type === "quote_published" ? "Créer mon espace et accepter le devis"
        : needsAccount && event.event_type === "invoice_shared" ? "Créer mon espace et voir la facture"
        : event.event_type === "quote_published" ? "Voir et accepter mon devis"
        : event.event_type === "invoice_shared" ? "Ouvrir ma facture"
        : event.event_type === "change_proposed" ? "Lire et signer la proposition"
        : "Ouvrir mon espace client";
      const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#0B1020;line-height:1.6">
        <h2 style="color:#0B1020">${paymentEvent ? "Paiement / Payment update" : heading}</h2><p>${hello}</p>
        <p>${esc(copy.intro)}</p>${isOwner ? `<p><b>Client :</b> ${esc(client?.nom || "—")}</p>` : ""}${copy.body}
        <p>${esc(portalLine)}</p>
        <p style="text-align:center;margin:28px 0"><a href="${esc(link)}" style="background:#4361EE;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:bold;display:inline-block">${paymentEvent ? "Ouvrir mon espace / Open workspace" : ctaLabel}</a></p>
        <p>Roland Dzoagbe<br>DZOFT · <a href="mailto:${esc(sender)}" style="color:#3448D6">${esc(sender)}</a></p>
        <p style="font-size:12px;color:#5d6f83">${english ? "Project update email from DZOFT. Attachments are limited to invoice PDFs that Roland has explicitly chosen to send." : "E-mail de suivi de votre projet avec DZOFT. Les pièces jointes sont limitées aux factures PDF que Roland a explicitement choisi d’envoyer."}</p>
      </div>`;
      const textContent = `${isOwner ? "Bonjour Roland," : `${english ? "Hello" : "Bonjour"}${firstName ? " " + firstName : ""},`}\n\n${copy.intro}\n\n${paymentEvent || event.event_type === "change_proposed" || event.event_type === "change_signed" ? copy.body.replace(/<[^>]*>/g, " ").trim() : digest.length ? digest.map((u) => english ? `- ${DIGEST_GROUPS_EN[u.category] || "Other work"} · ${DIGEST_STATUS_EN[u.status] || ""}: ${u.summary}` : `- ${DIGEST_GROUPS[u.category] || "Autres travaux"} · ${DIGEST_STATUS[u.status] || ""} : ${u.summary}`).join("\n") : ""}\n\n${message}\n\n${portalLine}\n${link}\n\nRoland Dzoagbe · DZOFT`;
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": brevoKey, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          sender: { name: "DZOFT", email: sender },
          to: [{ email: to, name: isOwner ? "Roland Dzoagbe" : client?.nom || undefined }],
          replyTo: { email: sender, name: "DZOFT" },
          subject: copy.subject,
          htmlContent: html,
          textContent,
          ...(attachment.length ? { attachment } : {}),
          headers: { "IdempotencyKey": job.id },
          tags: ["dzoft-project", event.event_type],
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        retryable = response.status === 429 || response.status >= 500;
        throw new Error(`Brevo delivery failed (${response.status})`);
      }
      const { error: finishError } = await db.rpc("finish_email_outbox", {
        p_id: job.id, p_success: true, p_provider_message_id: result.messageId || null, p_error: null,
      });
      if (finishError) throw new Error("email sent but delivery status could not be saved");
      results.push({ id: job.id, status: "sent" });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "email delivery failed";
      await db.rpc("finish_email_outbox", {
        p_id: job.id, p_success: false, p_provider_message_id: null,
        p_error: msg.slice(0, 450), p_retryable: retryable,
      });
      results.push({ id: job.id, status: "failed" });
    }
  }
  return json({ ok: true, processed: results.length, results }, 200, headers);
});

