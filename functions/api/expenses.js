const EXPENSE_PREFIX = "animus-expenses/v5/";
const RECEIPT_PHOTO_PREFIX = "animus-receipt-photos/v1/";

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

function receiptPhotoKeyFor(fileId, expenseId, contentType) {
  const subtype = String(contentType || "image/jpeg").split("/")[1] || "jpeg";
  const extension = subtype.replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpeg";
  return `${RECEIPT_PHOTO_PREFIX}${cleanSegment(fileId)}/${cleanSegment(expenseId)}.${extension}`;
}

function isReceiptPhotoKey(key = "") {
  return String(key).startsWith(RECEIPT_PHOTO_PREFIX) && !String(key).includes("..");
}

function receiptImageUrl(key = "") {
  return key ? `/api/expenses?receiptImageKey=${encodeURIComponent(key)}` : "";
}

async function readStoredExpense(bucket, fileId, expenseId) {
  const object = await bucket.get(keyFor(fileId, expenseId));
  if (!object) return null;
  try { return await object.json(); } catch (_) { return null; }
}

async function storeReceiptPhoto(bucket, fileId, expenseId, dataUrl) {
  const match = String(dataUrl || "").match(/^data:(image\/[a-zA-Z0-9.+-]+|application\/pdf);base64,/);
  if (!match) return "";
  const contentType = match[1].toLowerCase();
  const response = await fetch(dataUrl);
  if (!response.ok) throw new Error("Receipt photo could not be prepared for storage.");
  const photoKey = receiptPhotoKeyFor(fileId, expenseId, contentType);
  await bucket.put(photoKey, await response.arrayBuffer(), {
    httpMetadata: { contentType },
    customMetadata: { fileId: String(fileId), expenseId: String(expenseId) },
  });
  return photoKey;
}

function publicExpense(expense = {}) {
  const receiptImageKey = String(expense.receiptImageKey || "");
  return { ...expense, receiptImageUrl: receiptImageUrl(receiptImageKey) };
}

function cleanExpense(value = {}, fileId = "") {
  const amount = Number(String(value.amount ?? "").replace(/[$,]/g, ""));
  const items = Array.isArray(value.items) ? value.items.slice(0, 100).map((item) => ({
    name: String(item?.name || "").slice(0, 300),
    quantity: String(item?.quantity ?? "").slice(0, 50),
    price: Number(String(item?.price ?? "").replace(/[$,]/g, "")) || 0,
    lineTotal: Number(String(item?.lineTotal ?? item?.total ?? "").replace(/[$,]/g, "")) || 0,
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
    receiptImageKey: String(value.receiptImageKey || ""),
    receiptContentType: String(value.receiptContentType || "").slice(0, 100),
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
  const url = new URL(context.request.url);
  const photoKey = url.searchParams.get("receiptImageKey") || "";
  if (photoKey) {
    if (!isReceiptPhotoKey(photoKey)) return reply({ ok: false, error: "Receipt image was not available." }, 404);
    const photo = await context.env.ANIMUS_BUCKET.get(photoKey);
    if (!photo) return reply({ ok: false, error: "Receipt image was not found." }, 404);
    return new Response(photo.body, {
      headers: {
        ...headers,
        "Content-Type": photo.httpMetadata?.contentType || "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }
  const fileId = url.searchParams.get("fileId") || "";
  if (!fileId) return reply({ ok: false, error: "A customer file is required." }, 400);
  const listed = await context.env.ANIMUS_BUCKET.list({ prefix: `${EXPENSE_PREFIX}${cleanSegment(fileId)}/`, limit: 250 });
  const records = [];
  for (const object of listed.objects || []) {
    const stored = await context.env.ANIMUS_BUCKET.get(object.key);
    if (!stored) continue;
    try { records.push(publicExpense(await stored.json())); } catch (_) { /* skip unreadable old object */ }
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
  const existing = await readStoredExpense(context.env.ANIMUS_BUCKET, fileId, expense.id);
  const incomingImage = String(body.expense?.imageDataUrl || "");
  let receiptImageKey = expense.receiptImageKey || String(existing?.receiptImageKey || "");
  if (incomingImage.startsWith("data:image/") || incomingImage.startsWith("data:application/pdf")) {
    const previousKey = receiptImageKey;
    receiptImageKey = await storeReceiptPhoto(context.env.ANIMUS_BUCKET, fileId, expense.id, incomingImage);
    if (previousKey && previousKey !== receiptImageKey && isReceiptPhotoKey(previousKey)) {
      await context.env.ANIMUS_BUCKET.delete(previousKey);
    }
  }
  expense.receiptImageKey = receiptImageKey;
  if (incomingImage) expense.receiptContentType = incomingImage.slice(5, incomingImage.indexOf(";"));
  else if (existing?.receiptContentType) expense.receiptContentType = existing.receiptContentType;
  await context.env.ANIMUS_BUCKET.put(keyFor(fileId, expense.id), JSON.stringify(expense), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
  return reply({ ok: true, expense: publicExpense(expense) });
}

export async function onRequestDelete(context) {
  if (!context.env.ANIMUS_BUCKET) return reply({ ok: false, error: "ANIMUS cloud storage is not connected." }, 500);
  const url = new URL(context.request.url);
  const fileId = url.searchParams.get("fileId") || "";
  const expenseId = url.searchParams.get("expenseId") || "";
  if (!fileId || !expenseId) return reply({ ok: false, error: "Expense selection was incomplete." }, 400);
  const existing = await readStoredExpense(context.env.ANIMUS_BUCKET, fileId, expenseId);
  await context.env.ANIMUS_BUCKET.delete(keyFor(fileId, expenseId));
  if (existing?.receiptImageKey && isReceiptPhotoKey(existing.receiptImageKey)) {
    await context.env.ANIMUS_BUCKET.delete(existing.receiptImageKey);
  }
  return reply({ ok: true });
}
