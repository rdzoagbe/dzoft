// DZOFT background GitHub sync. Invoked by Supabase Cron via a purpose-specific
// vaulted token. No raw commits, author data, code, AI attribution or session
// links leave this worker for Supabase Postgres, logs, or the client portal.
const PROJECT_URL = Deno.env.get("SUPABASE_URL") ?? "";
const LEGACY_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
function adminKey(): string {
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    if (typeof keys.default === "string" && keys.default) return keys.default;
  } catch (_) { /* Older projects may have only a legacy service role key. */ }
  return LEGACY_KEY;
}
const GITHUB_API = "https://api.github.com/repos/ProjectRodney/ProRod/commits?sha=main&per_page=100";
const PROJECT_QUOTE = "c8a50cee-3856-4539-98a3-f5df201dbff0";
const GROUPS: Array<[string, RegExp]> = [
  ["administration", /admin|dashboard|tableau de bord|back.?office|moderation|modération|management|portal/i],
  ["qr", /\bqr\b|qr code|scanner/i],
  ["evenements", /venue|lieu|event|événement|établissement/i],
  ["profils", /profil|profile|inscription|registration|onboard|signup|sign.up/i],
  ["securite", /secur|sécur|auth|login|password|mot de passe|permission|access|accès|privacy|confidential|consent|rls|pass|token/i],
  ["messagerie", /email|e-mail|notification|sms|brevo|message|chat|push/i],
  ["interface", /design|layout|ui\b|screen|écran|mobile|responsive|style|css|typograph|couleur|color|translation|traduction|wording|texte|photo|image|icon|icône/i],
  ["donnees", /database|supabase|sql\b|migration|data|données|db\b/i],
  ["tests", /test|regression|régression|fix|bug|correctif|correction|lint|stabil|quality|qualité/i],
  ["livraison", /deploy|release|production|mise en ligne|publish|build/i],
  ["fonctionnalites", /feature|form|account|compte|refus|report/i],
];
function group(subject: string): string {
  for (const [id, match] of GROUPS) if (match.test(subject)) return id;
  return "other";
}
function safeSummary(raw: unknown, now = new Date()): Array<{date: string; group: string}> {
  if (!Array.isArray(raw)) throw new Error("Unexpected GitHub response");
  const start = new Date(now.getTime() - 13 * 86400000).toISOString().slice(0,10);
  const end = new Date(now.getTime() + 86400000).toISOString().slice(0,10);
  const found = new Set<string>();
  const result: Array<{date: string; group: string}> = [];
  for (const row of raw.slice(0,100)) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const info = item.commit as Record<string, unknown> | undefined;
    if (!info || typeof info !== "object") continue;
    const committer = info.committer as Record<string, unknown> | undefined;
    const when = committer && typeof committer.date === "string" ? committer.date : "";
    if (!/^\d{4}-\d\d-\d\dT/.test(when)) continue;
    const date = when.slice(0,10);
    if (date < start || date > end) continue;
    const subject = typeof info.message === "string" ? info.message.split(/\r?\n/,1)[0].slice(0,240) : "";
    const label = group(subject);
    const unique = date + "|" + label;
    if (found.has(unique)) continue;
    found.add(unique);
    // ONLY these two allowed fields leave the function.
    result.push({date,group:label});
    if (result.length >= 40) break;
  }
  return result;
}
function response(status: number, data: Record<string, string | boolean | number>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {"content-type":"application/json; charset=utf-8","cache-control":"no-store"}
  });
}
async function supabaseRpc(name: string, body: Record<string, unknown>): Promise<unknown> {
  const key = adminKey();
  if (!PROJECT_URL || !key) throw new Error("missing_runtime_credentials");
  const headers: Record<string,string> = {"apikey":key,"content-type":"application/json"};
  if (key.startsWith("eyJ")) headers.Authorization = "Bearer " + key;
  const result = await fetch(PROJECT_URL + "/rest/v1/rpc/" + name, {
    method:"POST", headers, body:JSON.stringify(body), redirect:"error",
  });
  if (!result.ok) throw new Error("rpc_http_"+result.status);
  return await result.json();
}
// Retry only temporary GitHub/network failures. Explicit auth failures and
// exhausted rate limits are not retried. This never logs response bodies.
async function readGitHubWithRetry(): Promise<Response> {
  const waits = [0, 900, 1600];
  for (let attempt = 0; attempt < waits.length; attempt++) {
    if (waits[attempt]) await new Promise(resolve => setTimeout(resolve, waits[attempt]));
    let result: Response;
    try {
      result = await fetch(GITHUB_API, {
        headers: {
          "accept": "application/vnd.github+json",
          "user-agent": "DZOFT-Private-Background-Sync",
          "x-github-api-version": "2022-11-28"
        },
        cache: "no-store", redirect: "error", signal: AbortSignal.timeout(6500)
      });
    } catch (_) {
      if (attempt === waits.length - 1) throw new Error("github_network_unavailable");
      continue;
    }
    if (result.ok) return result;
    if ((result.status === 403 || result.status === 429) &&
        result.headers.get("x-ratelimit-remaining") === "0") {
      throw new Error("github_rate_limit");
    }
    const temporary = [408, 425, 429, 500, 502, 503, 504].includes(result.status);
    if (!temporary || attempt === waits.length - 1) {
      throw new Error("github_unavailable");
    }
  }
  throw new Error("github_unavailable");
}
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return response(405,{error:"Method not allowed"});
  const token = req.headers.get("X-DZOFT-Cron-Secret") ?? "";
  if (!/^[0-9a-f]{64}$/.test(token)) return response(401,{error:"Unauthorized"});
  let phase = "auth";
  try {
    const verified = await supabaseRpc("verify_rodney_sync_token",{p_token:token});
    if (verified !== true) return response(401,{error:"Unauthorized"});

    phase = "github";
    const source = await readGitHubWithRetry();
    const safe = safeSummary(await source.json());

    phase = "database";
    const added = await supabaseRpc("background_import_rodney_groups",{p_items:safe}) as
      {added?:number;checked?:number;client_notified?:boolean};
    if (added?.client_notified !== false) throw new Error("Unexpected write response");

    // Never log or echo GitHub messages, author info, code, SHA or AI metadata.
    return response(200,{
      ok:true,checked:Number(added.checked)||0,added:Number(added.added)||0,
      client_notified:false
    });
  } catch (error) {
    var status = error instanceof Error ? error.message : "";
    var diagnostic = /^rpc_http_(400|401|403|404|406|422|500|502|503)$/.test(status)
      || status==="missing_runtime_credentials" ? status : "unavailable";
    return response(503,{ok:false,error:"Private synchronization unavailable",phase,diagnostic});
  }
});
