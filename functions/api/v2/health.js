import { json, options, requireDatabase } from "./_shared.js";

export async function onRequestOptions() {
  return options();
}

export async function onRequestGet({ env }) {
  const missing = requireDatabase(env);
  if (missing) return missing;
  try {
    const counts = await env.ANIMUS_DB.batch([
      env.ANIMUS_DB.prepare("SELECT COUNT(*) AS count FROM workfiles WHERE deleted_at IS NULL"),
      env.ANIMUS_DB.prepare("SELECT COUNT(*) AS count FROM revenue_rows WHERE deleted_at IS NULL"),
      env.ANIMUS_DB.prepare("SELECT state_value, updated_at FROM system_state WHERE state_key = 'migration_status'"),
    ]);
    return json({
      ok: true,
      storage: "record-based-d1",
      databaseReady: true,
    });
  } catch (error) {
    return json({ ok: false, error: "Record storage health check failed.", detail: error?.message || String(error) }, 503);
  }
}
