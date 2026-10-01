import { actor, cleanId, json, now, options, parseRecord, parseVersion, requestId, requireAdmin, requireDatabase, sha256 } from "./_shared.js";

export async function onRequestOptions() {
  return options();
}

export async function onRequestGet({ request, env }) {
  const missing = requireDatabase(env);
  if (missing) return missing;
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  const url = new URL(request.url);
  const id = cleanId(url.searchParams.get("id"));
  if (id) {
    const row = await env.ANIMUS_DB.prepare("SELECT * FROM workfiles WHERE id = ? AND deleted_at IS NULL").bind(id).first();
    return row ? json({ ok: true, workfile: parseRecord(row) }, 200, { ETag: `\"${row.version}\"` }) : json({ ok: false, error: "Workfile not found." }, 404);
  }
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 200);
  const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);
  const result = await env.ANIMUS_DB.prepare(
    "SELECT * FROM workfiles WHERE deleted_at IS NULL ORDER BY updated_at DESC LIMIT ? OFFSET ?",
  ).bind(limit, offset).all();
  return json({ ok: true, workfiles: (result.results || []).map(parseRecord), limit, offset });
}

export async function onRequestPost(context) {
  return saveWorkfile(context, true);
}

export async function onRequestPut(context) {
  return saveWorkfile(context, false);
}

async function saveWorkfile({ request, env }) {
  const missing = requireDatabase(env);
  if (missing) return missing;
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  const record = await request.json();
  const idempotencyKey = cleanId(request.headers.get("Idempotency-Key"));
  const requestHash = idempotencyKey ? await sha256(record) : "";
  if (idempotencyKey) {
    const priorRequest = await env.ANIMUS_DB.prepare("SELECT * FROM idempotency_keys WHERE key = ?").bind(idempotencyKey).first();
    if (priorRequest && priorRequest.request_hash !== requestHash) {
      return json({ ok: false, error: "That save request key was already used for different data." }, 409);
    }
    if (priorRequest) return json(JSON.parse(priorRequest.response_json), priorRequest.status_code);
  }
  const id = cleanId(record.id) || crypto.randomUUID();
  const fileNumber = cleanId(record.fileNumber);
  if (!fileNumber) return json({ ok: false, error: "fileNumber is required." }, 400);
  const stamp = now();
  const existing = await env.ANIMUS_DB.prepare("SELECT * FROM workfiles WHERE id = ?").bind(id).first();
  const expectedVersion = parseVersion(request);
  if (existing && expectedVersion !== existing.version) {
    return json({ ok: false, error: "This workfile changed on another device. Reload before saving.", currentVersion: existing.version }, 409);
  }
  const nextVersion = existing ? existing.version + 1 : 1;
  const saved = { ...record, id, fileNumber, version: nextVersion, updatedAt: stamp };
  const auditId = crypto.randomUUID();
  const responseBody = { ok: true, workfile: saved };
  const statements = [
    env.ANIMUS_DB.prepare(`INSERT INTO workfiles
      (id, file_number, client_name, status, record_json, version, created_at, updated_at, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
      ON CONFLICT(id) DO UPDATE SET file_number=excluded.file_number, client_name=excluded.client_name,
      status=excluded.status, record_json=excluded.record_json, version=excluded.version,
      updated_at=excluded.updated_at, deleted_at=NULL`)
      .bind(id, fileNumber, cleanId(record.clientName), cleanId(record.fileStatus), JSON.stringify(saved), nextVersion, existing?.created_at || stamp, stamp),
    env.ANIMUS_DB.prepare(`INSERT INTO audit_events
      (id, entity_type, entity_id, operation, prior_version, next_version, actor, request_id, changed_at, change_json)
      VALUES (?, 'workfile', ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(auditId, id, existing ? "update" : "create", existing?.version || null, nextVersion, actor(request), requestId(request), stamp, JSON.stringify(saved)),
  ];
  if (idempotencyKey) {
    statements.push(env.ANIMUS_DB.prepare(`INSERT INTO idempotency_keys
      (key, request_hash, response_json, status_code, created_at) VALUES (?, ?, ?, ?, ?)`)
      .bind(idempotencyKey, requestHash, JSON.stringify(responseBody), existing ? 200 : 201, stamp));
  }
  await env.ANIMUS_DB.batch(statements);
  return json(responseBody, existing ? 200 : 201, { ETag: `\"${nextVersion}\"` });
}

export async function onRequestDelete({ request, env }) {
  const missing = requireDatabase(env);
  if (missing) return missing;
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  const url = new URL(request.url);
  const id = cleanId(url.searchParams.get("id"));
  if (!id) return json({ ok: false, error: "id is required." }, 400);
  const existing = await env.ANIMUS_DB.prepare("SELECT * FROM workfiles WHERE id = ? AND deleted_at IS NULL").bind(id).first();
  if (!existing) return json({ ok: false, error: "Workfile not found." }, 404);
  const expectedVersion = parseVersion(request);
  if (expectedVersion !== existing.version) {
    return json({ ok: false, error: "This workfile changed on another device. Reload before deleting.", currentVersion: existing.version }, 409);
  }
  const stamp = now();
  await env.ANIMUS_DB.batch([
    env.ANIMUS_DB.prepare("UPDATE workfiles SET deleted_at = ?, updated_at = ?, version = version + 1 WHERE id = ?").bind(stamp, stamp, id),
    env.ANIMUS_DB.prepare(`INSERT INTO audit_events
      (id, entity_type, entity_id, operation, prior_version, next_version, actor, request_id, changed_at, change_json)
      VALUES (?, 'workfile', ?, 'delete', ?, ?, ?, ?, ?, '{}')`)
      .bind(crypto.randomUUID(), id, existing.version, existing.version + 1, actor(request), requestId(request), stamp),
  ]);
  return json({ ok: true, deleted: true, id });
}
