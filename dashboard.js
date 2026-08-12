const DASHBOARD_KEY = "dashboard/latest.json";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!env.ANIMUS_BUCKET) {
    return jsonResponse({
      ok: false,
      error: "Cloudflare R2 binding ANIMUS_BUCKET is not connected yet.",
    }, 500);
  }

  if (request.method === "GET") {
    const object = await env.ANIMUS_BUCKET.get(DASHBOARD_KEY);
    if (!object) {
      return jsonResponse({ ok: true, dashboard: null });
    }
    const dashboard = await object.json();
    return jsonResponse({ ok: true, dashboard });
  }

  if (request.method === "POST") {
    let payload;
    try {
      payload = await request.json();
    } catch (error) {
      return jsonResponse({ ok: false, error: "Invalid dashboard JSON." }, 400);
    }

    const dashboard = {
      ...payload,
      action: "dashboardSync",
      syncedAt: new Date().toISOString(),
      savedTo: "Cloudflare R2",
    };
    const body = JSON.stringify(dashboard, null, 2);

    await env.ANIMUS_BUCKET.put(DASHBOARD_KEY, body, {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    });
    await env.ANIMUS_BUCKET.put(backupKey(), body, {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    });

    const files = Array.isArray(dashboard.dashboardFiles) ? dashboard.dashboardFiles : [];
    const revenueRows = Array.isArray(dashboard.revenueRows) ? dashboard.revenueRows : [];
    const priceRows = Array.isArray(dashboard.priceRows) ? dashboard.priceRows : [];

    return jsonResponse({
      ok: true,
      dashboard,
      fileCount: files.length,
      revenueCount: revenueRows.length,
      priceCount: priceRows.length,
    });
  }

  return jsonResponse({ ok: false, error: "Method not allowed." }, 405);
}
