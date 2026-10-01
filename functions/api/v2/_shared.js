export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, If-Match, Idempotency-Key, X-Animus-Actor, X-Animus-Migration-Key",
};

export function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

export function options() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export function requireDatabase(env) {
  if (!env.ANIMUS_DB) {
    return json({ ok: false, error: "ANIMUS_DB is not configured." }, 503);
  }
  return null;
}

export function now() {
  return new Date().toISOString();
}

export function requestId(request) {
  return request.headers.get("CF-Ray") || crypto.randomUUID();
}

export function actor(request) {
  return String(request.headers.get("X-Animus-Actor") || "ANIMUS user").slice(0, 120);
}

export function cleanId(value) {
  return String(value || "").trim();
}

export function parseVersion(request) {
  const value = String(request.headers.get("If-Match") || "").replace(/^W\//, "").replaceAll('"', "");
  const version = Number(value);
  return Number.isInteger(version) && version > 0 ? version : null;
}

export async function sha256(value) {
  const bytes = new TextEncoder().encode(typeof value === "string" ? value : JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function parseRecord(row) {
  if (!row) return null;
  const record = JSON.parse(row.record_json);
  return { ...record, id: row.id, version: row.version, updatedAt: row.updated_at };
}

export function migrationAuthorized(request, env) {
  if (!env.ANIMUS_MIGRATION_KEY) return false;
  return request.headers.get("X-Animus-Migration-Key") === env.ANIMUS_MIGRATION_KEY;
}

export function requireAdmin(request, env) {
  if (migrationAuthorized(request, env)) return null;
  return json({ ok: false, error: "Authorized ANIMUS access is required." }, 401);
}
