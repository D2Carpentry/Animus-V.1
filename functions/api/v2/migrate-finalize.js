import { cleanId, json, migrationAuthorized, now, options, requireDatabase } from "./_shared.js";

export async function onRequestOptions() {
  return options();
}

export async function onRequestPost({ request, env }) {
  const missing = requireDatabase(env);
  if (missing) return missing;
  if (!migrationAuthorized(request, env)) return json({ ok: false, error: "Migration authorization failed." }, 403);
  const payload = await request.json();
  const migrationId = cleanId(payload.migrationId);
  const sourceHash = cleanId(payload.sourceHash);
  const expected = payload.counts || {};
  if (!migrationId || !sourceHash) return json({ ok: false, error: "Invalid migration finalization." }, 400);
  const counts = await env.ANIMUS_DB.batch([
    env.ANIMUS_DB.prepare("SELECT COUNT(*) AS count FROM workfiles WHERE deleted_at IS NULL"),
    env.ANIMUS_DB.prepare("SELECT COUNT(*) AS count FROM revenue_rows WHERE deleted_at IS NULL"),
    env.ANIMUS_DB.prepare("SELECT COUNT(*) AS count FROM payroll_rows WHERE deleted_at IS NULL"),
    env.ANIMUS_DB.prepare("SELECT COUNT(*) AS count FROM price_rows WHERE deleted_at IS NULL"),
  ]);
  const actual = {
    workfiles: Number(counts[0]?.results?.[0]?.count || 0),
    revenue: Number(counts[1]?.results?.[0]?.count || 0),
    payroll: Number(counts[2]?.results?.[0]?.count || 0),
    prices: Number(counts[3]?.results?.[0]?.count || 0),
  };
  const matches = Object.keys(actual).every((key) => actual[key] === Number(expected[key] || 0));
  if (!matches) return json({ ok: false, error: "Migration counts do not match. Cutover is blocked.", expected, actual }, 409);
  const stamp = now();
  await env.ANIMUS_DB.batch([
    env.ANIMUS_DB.prepare(`INSERT INTO migration_runs
      (id, source_synced_at, source_hash, workfile_count, revenue_count, payroll_count, price_count, status, created_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'complete', ?, ?)`)
      .bind(migrationId, cleanId(payload.sourceSyncedAt), sourceHash, actual.workfiles, actual.revenue, actual.payroll, actual.prices, stamp, stamp),
    env.ANIMUS_DB.prepare(`INSERT INTO system_state (state_key, state_value, updated_at)
      VALUES ('migration_status', ?, ?) ON CONFLICT(state_key) DO UPDATE SET state_value=excluded.state_value, updated_at=excluded.updated_at`)
      .bind(JSON.stringify({ migrationId, sourceHash, counts: actual, cutoverReady: false }), stamp),
  ]);
  return json({ ok: true, migrationId, sourceHash, counts: actual, cutoverReady: false });
}
