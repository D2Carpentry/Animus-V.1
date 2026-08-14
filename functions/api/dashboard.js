const DASHBOARD_KEY = "dashboard/latest.json";

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
  return `dashboard/backups/${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
}

function missingBucketResponse() {
  return jsonResponse({
    ok: false,
    error: "Cloudflare R2 binding ANIMUS_BUCKET is not connected yet.",
  }, 500);
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

  const object = await env.ANIMUS_BUCKET.get(DASHBOARD_KEY);
  if (!object) {
    return jsonResponse({ ok: true, dashboard: null });
  }
  const dashboard = await object.json();
  return jsonResponse({ ok: true, dashboard });
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

  const dashboard = {
    ...payload,
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
