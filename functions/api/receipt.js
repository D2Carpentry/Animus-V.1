const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

function parseMoney(value) {
  const parsed = Number(String(value || "").replace(/[$,]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function categoryFromText(text = "") {
  const cleanText = text.toLowerCase();
  if (/(paint|primer|stain|renner|sherwin|roller|brush|finish|urethane|sealer)/.test(cleanText)) return "Paint / Finish";
  if (/(screw|hinge|slide|hardware|pull|handle|bracket|nail|tapcon)/.test(cleanText)) return "Hardware";
  if (/(plywood|birch|mdf|lumber|stud|wood|board|trim|poplar|maple)/.test(cleanText)) return "Materials";
  if (/(blade|saw|tool|drill|sander|router|ladder|equipment)/.test(cleanText)) return "Equipment";
  if (/(gas|fuel|shell|mobil|chevron|wawa|racetrac)/.test(cleanText)) return "Fuel";
  if (/(labor|helper|installer|subcontractor)/.test(cleanText)) return "Labor";
  return "Supplies";
}

function fallbackReceipt(fileName = "") {
  return {
    vendor: "",
    date: new Date().toISOString().slice(0, 10),
    total: "",
    tax: "",
    paymentType: "",
    category: categoryFromText(fileName),
    notes: fileName ? `Receipt photo: ${fileName}` : "",
    lineItems: [],
    confidence: "manual-review",
  };
}

function cleanJsonText(text = "") {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function normalizeCategory(value = "") {
  const categories = ["Supplies", "Materials", "Hardware", "Paint / Finish", "Equipment", "Labor", "Fuel", "Other"];
  const match = categories.find((category) => category.toLowerCase() === String(value || "").toLowerCase());
  return match || categoryFromText(value) || "Supplies";
}

function responseOutputText(data = {}) {
  if (data.output_text) return data.output_text;
  const content = data.output?.flatMap((item) => item.content || []) || [];
  const text = content.find((part) => part.type === "output_text")?.text;
  return text || "{}";
}

async function readReceiptWithOpenAi(env, imageDataUrl, fileName) {
  const model = env.OPENAI_MODEL || "gpt-5-mini";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                "Read this construction business receipt for D2 Carpentry.",
                "Extract only what is visible. Do not guess customer names or project names.",
                "For total, use the final paid/charged receipt total, not subtotal.",
                "For date, use YYYY-MM-DD when visible; otherwise leave it blank.",
                "For category, choose one of: Supplies, Materials, Hardware, Paint / Finish, Equipment, Labor, Fuel, Other.",
                "For notes, summarize key purchased items and anything useful for bookkeeping.",
                `File name: ${fileName || "receipt image"}.`,
              ].join("\n"),
            },
            {
              type: "input_image",
              image_url: imageDataUrl,
              detail: "high",
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "animus_receipt_expense",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              vendor: { type: "string" },
              date: { type: "string" },
              total: { type: "string" },
              tax: { type: "string" },
              paymentType: { type: "string" },
              category: { type: "string" },
              notes: { type: "string" },
              confidence: { type: "string" },
              lineItems: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    name: { type: "string" },
                    quantity: { type: "string" },
                    total: { type: "string" },
                    category: { type: "string" },
                  },
                  required: ["name", "quantity", "total", "category"],
                },
              },
            },
            required: ["vendor", "date", "total", "tax", "paymentType", "category", "notes", "confidence", "lineItems"],
          },
        },
      },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error?.message || `OpenAI receipt read failed with status ${response.status}.`);
  }

  const receipt = JSON.parse(cleanJsonText(responseOutputText(data)));
  return {
    vendor: receipt.vendor || "",
    date: receipt.date || new Date().toISOString().slice(0, 10),
    total: parseMoney(receipt.total || receipt.amount),
    tax: receipt.tax === "" || receipt.tax === undefined ? "" : parseMoney(receipt.tax),
    paymentType: receipt.paymentType || receipt.payment || "",
    category: normalizeCategory(receipt.category || `${receipt.vendor || ""} ${receipt.notes || ""}`),
    notes: receipt.notes || "",
    lineItems: Array.isArray(receipt.lineItems)
      ? receipt.lineItems.map((item) => ({
        name: item.name || "",
        quantity: item.quantity || "",
        total: item.total || "",
        category: normalizeCategory(item.category || receipt.category),
      }))
      : [],
    confidence: receipt.confidence || "needs-review",
  };
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestGet(context) {
  return jsonResponse({
    ok: true,
    receiptAiConfigured: Boolean(context.env.OPENAI_API_KEY),
    model: context.env.OPENAI_MODEL || "gpt-5-mini",
    message: context.env.OPENAI_API_KEY
      ? "Receipt AI key is connected."
      : "OPENAI_API_KEY is not connected in Cloudflare for this deployment.",
  });
}

export async function onRequestPost(context) {
  let body;
  try {
    body = await context.request.json();
  } catch (error) {
    return jsonResponse({ ok: false, error: "Receipt request was not valid JSON." }, 400);
  }

  const imageDataUrl = body.imageDataUrl || body.image || "";
  const fileName = body.fileName || "";
  if (!imageDataUrl) {
    return jsonResponse({ ok: false, error: "No receipt image was sent." }, 400);
  }

  if (!context.env.OPENAI_API_KEY) {
    return jsonResponse({
      ok: true,
      aiAvailable: false,
      receipt: fallbackReceipt(fileName),
      message: "OPENAI_API_KEY is not connected yet. Receipt was attached for manual review.",
    });
  }

  try {
    const receipt = await readReceiptWithOpenAi(context.env, imageDataUrl, fileName);
    return jsonResponse({
      ok: true,
      aiAvailable: true,
      receipt,
    });
  } catch (error) {
    return jsonResponse({
      ok: true,
      aiAvailable: false,
      receipt: fallbackReceipt(fileName),
      message: error.message || "Receipt AI could not read the image. Manual review is available.",
    });
  }
}
