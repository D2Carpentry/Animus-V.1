const EXPENSE_PREFIX = "animus-expenses/v5/";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

function reply(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
  });
}

function cleanSegment(value = "") {
  return encodeURIComponent(String(value).trim()).replace(/%2F/gi, "_");
}

function keyFor(fileId, expenseId) {
  return `${EXPENSE_PREFIX}${cleanSegment(fileId)}/${cleanSegment(expenseId)}.json`;
}

function cleanExpense(value = {}, fileId = "") {
  const amount = Number(String(value.amount ?? "").replace(/[$,]/g, ""));
  const items = Array.isArray(value.items) ? value.items.slice(0, 100).map((item) => ({
    name: String(item?.name || "").slice(0, 300),
    price: Number(String(item?.price ?? "").replace(/[$,]/g, "")) || 0,
    category: String(item?.category || "Supplies").slice(0, 80),
  })) : [];
  return {
    id: String(value.id || crypto.randomUUID()),
    fileId: String(fileId),
    date: String(value.date || new Date().toISOString().slice(0, 10)),
    vendor: String(value.vendor || "").slice(0, 200),
    title: String(value.title || "").slice(0, 200),
    category: String(value.category || "Supplies").slice(0, 80),
    paymentType: String(value.paymentType || "").slice(0, 120),
    amount: Number.isFinite(amount) ? amount : 0,
    notes: String(value.notes || "").slice(0, 4000),
    imageDataUrl: String(value.imageDataUrl || ""),
    imageTitle: String(value.imageTitle || "").slice(0, 200),
    items,
    createdAt: value.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function onRequestOptions() {
  return new Response(null, { headers });
}

export async function onRequestGet(context) {
  if (!context.env.ANIMUS_BUCKET) return reply({ ok: false, error: "ANIMUS cloud storage is not connected." }, 500);
  const fileId = new URL(context.request.url).searchParams.get("fileId") || "";
  if (!fileId) return reply({ ok: false, error: "A customer file is required." }, 400);
  const listed = await context.env.ANIMUS_BUCKET.list({ prefix: `${EXPENSE_PREFIX}${cleanSegment(fileId)}/`, limit: 250 });
  const records = [];
  for (const object of listed.objects || []) {
    const stored = await context.env.ANIMUS_BUCKET.get(object.key);
    if (!stored) continue;
    try { records.push(await stored.json()); } catch (_) { /* skip unreadable old object */ }
  }
  records.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  return reply({ ok: true, expenses: records });
}

export async function onRequestPost(context) {
  if (!context.env.ANIMUS_BUCKET) return reply({ ok: false, error: "ANIMUS cloud storage is not connected." }, 500);
  let body;
  try { body = await context.request.json(); } catch (_) { return reply({ ok: false, error: "Expense data was not valid." }, 400); }
  const fileId = String(body.fileId || "").trim();
  if (!fileId) return reply({ ok: false, error: "A customer file is required." }, 400);
  const expense = cleanExpense(body.expense, fileId);
  await context.env.ANIMUS_BUCKET.put(keyFor(fileId, expense.id), JSON.stringify(expense), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
  return reply({ ok: true, expense });
}

export async function onRequestDelete(context) {
  if (!context.env.ANIMUS_BUCKET) return reply({ ok: false, error: "ANIMUS cloud storage is not connected." }, 500);
  const url = new URL(context.request.url);
  const fileId = url.searchParams.get("fileId") || "";
  const expenseId = url.searchParams.get("expenseId") || "";
  if (!fileId || !expenseId) return reply({ ok: false, error: "Expense selection was incomplete." }, 400);
  await context.env.ANIMUS_BUCKET.delete(keyFor(fileId, expenseId));
  return reply({ ok: true });
}
