const DASHBOARD_KEY = "dashboard/latest.json";
const BACKUP_PREFIX = "dashboard/backups/";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function backupKey() {
  return `${BACKUP_PREFIX}${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
}

function missingBucketResponse() {
  return jsonResponse({
    ok: false,
    error: "Cloudflare R2 binding ANIMUS_BUCKET is not connected yet.",
  }, 500);
}

function fileMergeKey(file = {}) {
  return String(file.id || file.fileNumber || file.clientName || "").trim().toLowerCase();
}

function rowMergeKey(row = {}) {
  return String(row.id || row.dashboardFileId || row.fileNumber || row.clientJob || "").trim().toLowerCase();
}

function fileCategory(file = {}) {
  const status = file.fileStatus || "";
  const detail = file.statusDetail || "";
  const estimateStatus = file.estimateStatus || "";
  if (["Job Lost / Closed", "Closed / Paid"].includes(status)) return "archive";
  if (status === "In Negotiation") return "negotiation";
  if (["Job Won", "In Progress", "Work Completed"].includes(status)) return "active";
  if (
    status === "Inspection Completed" ||
    ["Inspection Pending", "Inspection Date Set", "Estimate Attached", "Estimate Pending", "Estimate Sent"].includes(detail) ||
    ["Pending", "Sent", "Approved"].includes(estimateStatus)
  ) return "estimate";
  if (["Contact Established", "Contact Attempted"].includes(status)) return "contact";
  return "new";
}

function fileCounts(files = []) {
  const counts = { new: 0, contact: 0, estimate: 0, negotiation: 0, active: 0, archive: 0 };
  files.forEach((file) => {
    const category = fileCategory(file);
    if (Object.prototype.hasOwnProperty.call(counts, category)) counts[category] += 1;
  });
  return counts;
}

function dashboardSummary(dashboard = {}, key = "") {
  const files = Array.isArray(dashboard.dashboardFiles) ? dashboard.dashboardFiles : [];
  return {
    key,
    syncedAt: dashboard.syncedAt || "",
    totalFiles: files.length,
    counts: fileCounts(files),
  };
}

function lineGroupKey(line = {}) {
  return String(line.receiptGroupId || line.id || "").trim();
}

function mergeReceiptHistory(existing = [], incoming = []) {
  const merged = new Map();
  [...existing, ...incoming].forEach((entry) => {
    if (!entry) return;
    const key = String(entry.id || "").trim();
    if (!key) return;
    const prior = merged.get(key) || {};
    const priorStamp = Date.parse(prior.updatedAt || prior.savedAt || "") || 0;
    const nextStamp = Date.parse(entry.updatedAt || entry.savedAt || "") || 0;
    merged.set(key, nextStamp >= priorStamp ? { ...prior, ...entry } : { ...entry, ...prior });
  });
  return [...merged.values()];
}

function mergeExpenseLines(existing = [], incoming = []) {
  const groups = new Map();
  existing.forEach((line) => {
    const key = lineGroupKey(line);
    if (!key) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ ...line });
  });
  incoming.forEach((line) => {
    const key = lineGroupKey(line);
    if (!key) return;
    if (!groups.has(key)) groups.set(key, []);
    const group = groups.get(key);
    const existingIndex = group.findIndex((entry) => entry.id === line.id);
    if (existingIndex >= 0) group[existingIndex] = { ...group[existingIndex], ...line };
    else group.push({ ...line });
  });
  return [...groups.values()].flat();
}

function mergeFiles(existing = [], incoming = []) {
  const merged = new Map();
  existing.forEach((file) => {
    const key = fileMergeKey(file);
    if (key) merged.set(key, { ...file });
  });
  incoming.forEach((file) => {
    const key = fileMergeKey(file);
    if (!key) return;
    const prior = merged.get(key) || {};
    merged.set(key, {
      ...prior,
      ...file,
      freshExpenseReceipts: mergeReceiptHistory(prior.freshExpenseReceipts, file.freshExpenseReceipts),
      expenseReceipts: mergeReceiptHistory(prior.expenseReceipts, file.expenseReceipts),
      expenseLines: mergeExpenseLines(prior.expenseLines, file.expenseLines),
      receiptHistory: mergeReceiptHistory(prior.receiptHistory, file.receiptHistory),
    });
  });
  return [...merged.values()];
}

function mergeRevenueRows(existing = [], incoming = []) {
  const merged = new Map();
  existing.forEach((row) => {
    const key = rowMergeKey(row);
    if (key) merged.set(key, { ...row });
  });
  incoming.forEach((row) => {
    const key = rowMergeKey(row);
    if (!key) return;
    const prior = merged.get(key) || {};
    merged.set(key, {
      ...prior,
      ...row,
      expenseLines: mergeExpenseLines(prior.expenseLines, row.expenseLines),
    });
  });
  return [...merged.values()];
}

async function readExistingDashboard(env) {
  if (!env.ANIMUS_BUCKET) return null;
  const object = await env.ANIMUS_BUCKET.get(DASHBOARD_KEY);
  if (!object) return null;
  try {
    return await object.json();
  } catch (error) {
    return null;
  }
}

function mergeDashboard(existing = {}, incoming = {}) {
  return {
    ...existing,
    ...incoming,
    dashboardFiles: mergeFiles(existing.dashboardFiles, incoming.dashboardFiles),
    revenueRows: mergeRevenueRows(existing.revenueRows, incoming.revenueRows),
    payrollRows: Array.isArray(incoming.payrollRows) ? incoming.payrollRows : (existing.payrollRows || []),
    priceRows: Array.isArray(incoming.priceRows) ? incoming.priceRows : (existing.priceRows || []),
    deletedPriceIds: Array.isArray(incoming.deletedPriceIds) ? incoming.deletedPriceIds : (existing.deletedPriceIds || []),
  };
}

async function readDashboardPayload(request) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return request.json();
  }

  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const form = await request.formData();
    const rawPayload = form.get("payload") || form.get("dashboard") || form.get("data");
    if (rawPayload) {
      const rawText = typeof rawPayload === "string" ? rawPayload : await rawPayload.text();
      return JSON.parse(rawText);
    }
    return Object.fromEntries(form.entries());
  }

  const text = await request.text();
  if (!text.trim()) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    const params = new URLSearchParams(text);
    const rawPayload = params.get("payload") || params.get("dashboard") || params.get("data");
    if (rawPayload) {
      return JSON.parse(rawPayload);
    }
    throw error;
  }
}

async function handleGet(context) {
  const { env } = context;
  if (!env.ANIMUS_BUCKET) {
    return missingBucketResponse();
  }

  const url = new URL(context.request.url);
  if (url.searchParams.get("backups") === "list") {
    return handleBackupList(context);
  }
  const summary = url.searchParams.get("summary");
  if (summary) {
    return handleBackupSummary(context, summary);
  }
  const backup = url.searchParams.get("backup");
  if (backup) {
    return handleBackupGet(context, backup);
  }

  const object = await env.ANIMUS_BUCKET.get(DASHBOARD_KEY);
  if (!object) {
    return jsonResponse({ ok: true, dashboard: null });
  }
  const dashboard = await object.json();
  return jsonResponse({ ok: true, dashboard });
}

async function handleBackupList(context) {
  const { env } = context;
  const url = new URL(context.request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 30, 1), 100);
  const listed = await env.ANIMUS_BUCKET.list({ prefix: BACKUP_PREFIX, limit });
  const objects = (listed.objects || [])
    .filter((object) => object.key.endsWith(".json"))
    .sort((a, b) => String(b.uploaded || "").localeCompare(String(a.uploaded || "")));
  const backups = objects.map((objectInfo) => ({
    key: objectInfo.key,
    uploaded: objectInfo.uploaded || "",
    size: objectInfo.size || 0,
  }));
  return jsonResponse({ ok: true, backups });
}

async function handleBackupSummary(context, key) {
  const { env } = context;
  if (!key.startsWith(BACKUP_PREFIX) || !key.endsWith(".json")) {
    return jsonResponse({ ok: false, error: "Invalid backup key." }, 400);
  }
  const object = await env.ANIMUS_BUCKET.get(key);
  if (!object) {
    return jsonResponse({ ok: false, error: "Backup was not found." }, 404);
  }
  const dashboard = await object.json();
  return jsonResponse({ ok: true, summary: dashboardSummary(dashboard, key) });
}

async function handleBackupGet(context, key) {
  const { env } = context;
  if (!key.startsWith(BACKUP_PREFIX) || !key.endsWith(".json")) {
    return jsonResponse({ ok: false, error: "Invalid backup key." }, 400);
  }
  const object = await env.ANIMUS_BUCKET.get(key);
  if (!object) {
    return jsonResponse({ ok: false, error: "Backup was not found." }, 404);
  }
  const dashboard = await object.json();
  return jsonResponse({ ok: true, dashboard, summary: dashboardSummary(dashboard, key) });
}

async function handlePost(context) {
  const { request, env } = context;
  if (!env.ANIMUS_BUCKET) {
    return missingBucketResponse();
  }

  let payload;
  try {
    payload = await readDashboardPayload(request);
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: "Invalid dashboard save data.",
      contentType: request.headers.get("content-type") || "",
    }, 400);
  }

  const existingDashboard = await readExistingDashboard(env);
  const dashboard = {
    ...mergeDashboard(existingDashboard || {}, payload),
    action: "dashboardSync",
    syncedAt: new Date().toISOString(),
    savedTo: "Cloudflare R2",
  };
  const body = JSON.stringify(dashboard, null, 2);
  const dryRun = new URL(request.url).searchParams.has("dryRun");

  if (!dryRun) {
    await env.ANIMUS_BUCKET.put(DASHBOARD_KEY, body, {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    });
    await env.ANIMUS_BUCKET.put(backupKey(), body, {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    });
  }

  const files = Array.isArray(dashboard.dashboardFiles) ? dashboard.dashboardFiles : [];
  const revenueRows = Array.isArray(dashboard.revenueRows) ? dashboard.revenueRows : [];
  const payrollRows = Array.isArray(dashboard.payrollRows) ? dashboard.payrollRows : [];
  const priceRows = Array.isArray(dashboard.priceRows) ? dashboard.priceRows : [];

  return jsonResponse({
    ok: true,
    dryRun,
    dashboard,
    fileCount: files.length,
    revenueCount: revenueRows.length,
    payrollCount: payrollRows.length,
    priceCount: priceRows.length,
  });
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestHead(context) {
  const response = await handleGet(context);
  return new Response(null, {
    status: response.status,
    headers: response.headers,
  });
}

export async function onRequestGet(context) {
  return handleGet(context);
}

export async function onRequestPost(context) {
  return handlePost(context);
}
