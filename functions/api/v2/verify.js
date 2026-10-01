import { json, options, requireAdmin, requireDatabase } from "./_shared.js";

export async function onRequestOptions() {
  return options();
}

function number(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export async function onRequestGet({ request, env }) {
  const missing = requireDatabase(env);
  if (missing) return missing;
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  try {
    const results = await env.ANIMUS_DB.batch([
      env.ANIMUS_DB.prepare("SELECT COUNT(*) AS count FROM workfiles WHERE deleted_at IS NULL"),
      env.ANIMUS_DB.prepare(`SELECT COUNT(*) AS count,
        SUM(CAST(json_extract(record_json, '$.gross') AS REAL)) AS gross,
        SUM(CAST(json_extract(record_json, '$.expenses') AS REAL)) AS expenses,
        SUM(CAST(json_extract(record_json, '$.labor') AS REAL)) AS labor,
        SUM(CAST(json_extract(record_json, '$.profit') AS REAL)) AS profit
        FROM revenue_rows WHERE deleted_at IS NULL`),
      env.ANIMUS_DB.prepare("SELECT COUNT(*) AS count FROM payroll_rows WHERE deleted_at IS NULL"),
      env.ANIMUS_DB.prepare("SELECT COUNT(*) AS count FROM price_rows WHERE deleted_at IS NULL"),
      env.ANIMUS_DB.prepare("SELECT * FROM migration_runs ORDER BY created_at DESC LIMIT 1"),
    ]);
    const revenue = results[1]?.results?.[0] || {};
    return json({
      ok: true,
      counts: {
        workfiles: Number(results[0]?.results?.[0]?.count || 0),
        revenue: Number(revenue.count || 0),
        payroll: Number(results[2]?.results?.[0]?.count || 0),
        prices: Number(results[3]?.results?.[0]?.count || 0),
      },
      financials: {
        gross: number(revenue.gross),
        expenses: number(revenue.expenses),
        labor: number(revenue.labor),
        profit: number(revenue.profit),
      },
      latestMigration: results[4]?.results?.[0] || null,
    });
  } catch (error) {
    return json({ ok: false, error: "Record reconciliation failed.", detail: error?.message || String(error) }, 500);
  }
}
