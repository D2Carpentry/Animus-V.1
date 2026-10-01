import { cleanId, json, migrationAuthorized, now, options, requireDatabase } from "./_shared.js";

export async function onRequestOptions() {
  return options();
}

function recordId(record, section, index) {
  return cleanId(record?.id || record?.dashboardFileId || record?.fileNumber) || `${section}-${index + 1}`;
}

export async function onRequestPost({ request, env }) {
  const missing = requireDatabase(env);
  if (missing) return missing;
  if (!migrationAuthorized(request, env)) return json({ ok: false, error: "Migration authorization failed." }, 403);
  const payload = await request.json();
  const migrationId = cleanId(payload.migrationId);
  const sourceHash = cleanId(payload.sourceHash);
  const section = cleanId(payload.section);
  const chunkIndex = Number(payload.chunkIndex);
  const records = Array.isArray(payload.records) ? payload.records : [];
  if (!migrationId || !sourceHash || !section || !Number.isInteger(chunkIndex) || records.length > 50) {
    return json({ ok: false, error: "Invalid migration chunk." }, 400);
  }
  const chunkKey = `migration:${migrationId}:${section}:${chunkIndex}`;
  const prior = await env.ANIMUS_DB.prepare("SELECT state_value FROM system_state WHERE state_key = ?").bind(chunkKey).first();
  if (prior) return json({ ok: true, alreadyImported: true, section, chunkIndex, imported: records.length });

  const stamp = now();
  const statements = [];
  records.forEach((record, index) => {
    const id = recordId(record, section, chunkIndex * 50 + index);
    if (section === "workfiles") {
      const fileNumber = cleanId(record.fileNumber || record.legacyFileNumber || id);
      statements.push(env.ANIMUS_DB.prepare(`INSERT INTO workfiles
        (id, file_number, client_name, status, record_json, version, created_at, updated_at, deleted_at)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?, NULL) ON CONFLICT(id) DO NOTHING`)
        .bind(id, fileNumber, cleanId(record.clientName), cleanId(record.fileStatus), JSON.stringify({ ...record, id, fileNumber, version: 1 }), stamp, stamp));
    } else if (section === "revenue") {
      statements.push(env.ANIMUS_DB.prepare(`INSERT INTO revenue_rows
        (id, workfile_id, file_number, record_json, version, created_at, updated_at, deleted_at)
        VALUES (?, NULL, ?, ?, 1, ?, ?, NULL) ON CONFLICT(id) DO NOTHING`)
        .bind(id, cleanId(record.fileNumber), JSON.stringify({ ...record, id, version: 1 }), stamp, stamp));
    } else if (section === "payroll" || section === "prices") {
      const table = section === "payroll" ? "payroll_rows" : "price_rows";
      statements.push(env.ANIMUS_DB.prepare(`INSERT INTO ${table}
        (id, record_json, version, created_at, updated_at, deleted_at)
        VALUES (?, ?, 1, ?, ?, NULL) ON CONFLICT(id) DO NOTHING`)
        .bind(id, JSON.stringify({ ...record, id, version: 1 }), stamp, stamp));
    }
  });
  if (!statements.length && records.length) return json({ ok: false, error: "Unknown migration section." }, 400);
  statements.push(env.ANIMUS_DB.prepare(`INSERT INTO system_state (state_key, state_value, updated_at)
    VALUES (?, ?, ?) ON CONFLICT(state_key) DO NOTHING`).bind(chunkKey, JSON.stringify({ sourceHash, records: records.length }), stamp));
  await env.ANIMUS_DB.batch(statements);
  return json({ ok: true, section, chunkIndex, imported: records.length });
}
