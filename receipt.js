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

async function readReceiptWithOpenAi(env, imageDataUrl, fileName) {
  const model = env.OPENAI_MODEL || "gpt-4o-mini";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You read construction business receipts. Return only valid JSON with vendor, date as YYYY-MM-DD when visible, total, tax, paymentType, category, notes, lineItems, and confidence. Categories must be one of Supplies, Materials, Hardware, Paint / Finish, Equipment, Labor, Fuel, Other. Use blank strings when unsure.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Read this receipt for D2 Carpentry expenses. File name: ${fileName || "receipt image"}.`,
            },
            {
              type: "image_url",
              image_url: { url: imageDataUrl },
            },
          ],
        },
      ],
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error?.message || `OpenAI receipt read failed with status ${response.status}.`);
  }

  const content = data.choices?.[0]?.message?.content || "{}";
  const receipt = JSON.parse(cleanJsonText(content));
  return {
    vendor: receipt.vendor || "",
    date: receipt.date || new Date().toISOString().slice(0, 10),
    total: parseMoney(receipt.total || receipt.amount),
    tax: receipt.tax === "" || receipt.tax === undefined ? "" : parseMoney(receipt.tax),
    paymentType: receipt.paymentType || receipt.payment || "",
    category: receipt.category || categoryFromText(`${receipt.vendor || ""} ${receipt.notes || ""}`),
    notes: receipt.notes || "",
    lineItems: Array.isArray(receipt.lineItems) ? receipt.lineItems : [],
    confidence: receipt.confidence || "needs-review",
  };
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
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
