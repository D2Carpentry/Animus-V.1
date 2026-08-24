const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const DEFAULT_GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzZkie1W4LplkKwFoMq19suIHWsamKYNUwCt9xjnihTdy_dN271ou3lscTgq09bAGIG2w/exec";
const OLD_GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxFBQzWViCApvF-c95kAyT0oSNImMgzhf30gP10H2WJT_S5XkejFctq5bT7IjCALMi5Qg/exec";
const GOOGLE_SCRIPT_URL_STORAGE_KEY = "d2GoogleScriptUrl";
const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/4gMdRagjk60Rdlw0xV7AI01";
const ZELLE_ID = "D2carpentry";
const MATERIAL_PERCENT = 0.25;
const STORAGE_KEY = "d2EstimateStudio";
const ESTIMATE_SEQUENCE_KEY = "d2EstimateSequence";
const DASHBOARD_STORAGE_KEY = "d2CrmDemoFiles";
const PRICE_DATABASE_KEY = "d2PriceDatabase";
const PRICE_DELETED_KEY = "d2PriceDeletedIds";
const COMPANY_DEFAULTS = {
  name: "D2 Carpentry & Design",
  phone: "239-469-8555",
  email: "D2CarpentryandDesign@gmail.com",
  address: "2710 Del Prado Blvd S #2-184 Cape Coral, FL 33904",
};

const FOOTER_VALUE_NOTE = "At D2 Carpentry & Design, our goal as a company is to provide exceptional value alongside quality craftsmanship and an outstanding customer experience. We understand that every project and budget is unique, and we are committed to helping our clients achieve the best possible outcome for their investment. When appropriate, we are happy to discuss alternative materials, design modifications, or review comparable proposals for potential price matching. Our goal is to ensure that price alone is not the only factor considered when selecting the right partner for your project.";

const COPY_MODE_LABELS = {
  customer: "Customer",
  internal: "Office",
  team: "Team",
  supply: "Supplies",
};

const PROJECT_TYPES = ["Built-in", "Cabinetry", "Closet", "Other", "Other Carpentry", "Pantry", "Refacing", "Refinishing"];

function normalizeProjectType(value) {
  const cleaned = String(value || "").trim().toLowerCase();
  if (["built-in", "built in", "builtin"].includes(cleaned)) return "Built-in";
  const match = PROJECT_TYPES.find((type) => type.toLowerCase() === cleaned);
  return match || "Other";
}

function getGoogleScriptUrl() {
  const savedUrl = localStorage.getItem(GOOGLE_SCRIPT_URL_STORAGE_KEY) || "";
  if (savedUrl && savedUrl !== OLD_GOOGLE_SCRIPT_URL) return savedUrl;
  if (savedUrl === OLD_GOOGLE_SCRIPT_URL) localStorage.removeItem(GOOGLE_SCRIPT_URL_STORAGE_KEY);
  return DEFAULT_GOOGLE_SCRIPT_URL;
}

function requestGoogleScriptUrl() {
  const existing = getGoogleScriptUrl();
  const value = window.prompt("Paste the NEW D2carpentryanddesign@gmail.com Google Apps Script Web App URL here. You only need to do this once on this device.", existing);
  if (!value) return "";
  const cleanValue = value.trim();
  localStorage.setItem(GOOGLE_SCRIPT_URL_STORAGE_KEY, cleanValue);
  return cleanValue;
}

const OLD_LINE_EXAMPLES = new Set([
  "Custom shelf tower",
  "Customer shelf tower",
]);

const presets = {
  shelves: { name: "Adjustable shelves", qty: 8, price: 42 },
  drawers: { name: "Soft-close drawer boxes", qty: 4, price: 185 },
  rods: { name: "Hanging rods", qty: 3, price: 58 },
  doors: { name: "Shaker cabinet doors", qty: 4, price: 145 },
  install: { name: "Installation labor", qty: 1, price: 650 },
};

const fields = [
  "companyName",
  "estimateTitle",
  "companyPhone",
  "companyEmail",
  "companyAddress",
  "estimateNumber",
  "showEstimateNumber",
  "estimateDate",
  "leadSource",
  "fileStatus",
  "estimateStatus",
  "warrantyStatus",
  "inspectionDate",
  "inspectionTime",
  "nextActionDate",
  "nextAction",
  "clientName",
  "clientPhone",
  "clientEmail",
  "projectAddress",
  "projectType",
  "projectTypeOther",
  "finishLevel",
  "widthFeet",
  "heightFeet",
  "linearFeet",
  "linearRate",
  "squareLength",
  "squareWidth",
  "squareRate",
  "flatTotal",
  "discount",
  "discountType",
  "taxRate",
  "taxType",
  "depositRate",
  "invoiceInitialDeposit",
  "invoiceSecondDeposit",
  "invoiceFinalPayment",
  "notes",
  "additionalNotes",
  "addFooterValueNote",
  "assignmentLanguage",
  "assignmentStartDate",
  "assignmentArrivalTime",
  "assignmentScope",
  "useSpanishScope",
  "assignmentScopeSpanish",
  "assignmentNotes",
];

const state = {
  lineItems: [],
  materialItems: [],
  photos: [],
  assignmentPhotos: [],
  dashboardFileId: "",
  supplementFor: "",
  supplementId: "",
  autoEstimateNumber: false,
  estimateNumberCommitted: false,
  estimateSequence: {},
  invoicePaid: false,
};

function isInvoiceMode() {
  return new URLSearchParams(window.location.search).has("invoice")
    || String($("estimateTitle")?.value || "").trim().toLowerCase() === "invoice";
}

function applyInvoiceMode() {
  const invoiceMode = isInvoiceMode();
  document.body.classList.toggle("invoice-mode", invoiceMode);
  if (invoiceMode) {
    $("estimateTitle").value = "Invoice";
    if ($("taxRate").value === "6.5") $("taxRate").value = "";
    $("depositRate").value = "";
  }
}

let editableDownloadUrl = "";

const $ = (id) => document.getElementById(id);

function formatDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00`);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function numberValue(id) {
  return Number.parseFloat($(id).value) || 0;
}

function calculateLinearTotal() {
  return numberValue("linearFeet") * numberValue("linearRate");
}

function calculateSquareTotal() {
  return numberValue("squareLength") * numberValue("squareWidth") * numberValue("squareRate");
}

function updateCalculationPanel() {
  $("linearCalcTotal").textContent = currency.format(calculateLinearTotal());
  $("squareCalcTotal").textContent = currency.format(calculateSquareTotal());
}

function useCalculatedTotal(type) {
  const total = type === "linear" ? calculateLinearTotal() : calculateSquareTotal();
  $("flatTotal").value = total ? total.toFixed(2) : "";
  updateCalculationPanel();
  updatePreview();
}

function createId() {
  return globalThis.crypto && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readEstimateSequence() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ESTIMATE_SEQUENCE_KEY) || "{}");
    state.estimateSequence = parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    state.estimateSequence = state.estimateSequence || {};
  }
  return state.estimateSequence;
}

function writeEstimateSequence(sequence) {
  state.estimateSequence = sequence;
  try {
    localStorage.setItem(ESTIMATE_SEQUENCE_KEY, JSON.stringify(sequence));
  } catch (error) {
    // Direct file previews can block storage; keep the sequence in memory for this session.
  }
}

function formatPercent(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function formatPhone(value) {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function formatPhoneInput(input) {
  input.value = formatPhone(input.value);
}

function phoneHref(value) {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  return digits.length === 10 ? `tel:+1${digits}` : "";
}

function emailHref(value) {
  const email = value.trim();
  return email ? `mailto:${email}` : "";
}

function mapHref(value) {
  const address = String(value || "").trim();
  return address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : "";
}

function getFinishLabel() {
  const select = $("finishLevel");
  return select.options[select.selectedIndex].text;
}

function formatCompanyAddress(value) {
  const address = normalizeCompanyAddress(value);
  if (!address) return "";
  const cityMatch = address.match(/\s(Cape Coral,\s*(?:FL|Florida)\s*\d{5})$/i);
  if (cityMatch) {
    return `${address.slice(0, cityMatch.index).trim()}<br>${cityMatch[1].trim()}`;
  }
  return address;
}

function normalizeCompanyAddress(value) {
  const address = String(value || "").trim();
  if (!address) return "";
  const compact = address.replace(/\s+/g, " ").toLowerCase();
  if (
    compact.includes("2710 del prado") &&
    compact.includes("cape coral") &&
    compact.includes("33904")
  ) {
    return COMPANY_DEFAULTS.address;
  }
  return address;
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy.toISOString().slice(0, 10);
}

function todayInputValue() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
}

function getEstimateNumberParts() {
  const date = new Date();
  const year = String(date.getFullYear()).slice(2);
  const sequence = readEstimateSequence();
  for (let code = 65; code <= 90; code += 1) {
    const series = String.fromCharCode(code);
    const sequenceKey = `${year}-${series}`;
    const current = sequence[sequenceKey] || 1000;
    if (current < 9999) return { year, series, sequenceKey };
  }
  return { year, series: "Z", sequenceKey: `${year}-Z` };
}

function makeEstimateNumber(commit = false) {
  const { year, series, sequenceKey } = getEstimateNumberParts();
  const sequence = readEstimateSequence();
  const nextNumber = (sequence[sequenceKey] || 1000) + 1;
  if (commit) {
    sequence[sequenceKey] = nextNumber;
    writeEstimateSequence(sequence);
    state.estimateNumberCommitted = true;
  }
  return `${year}-${series}${String(nextNumber).padStart(4, "0")}`;
}

function ensureEstimateNumber() {
  if (!$("estimateNumber").value.trim()) {
    $("estimateNumber").value = makeEstimateNumber(true);
    state.autoEstimateNumber = true;
    updatePreview();
    return;
  }
  if (state.autoEstimateNumber && !state.estimateNumberCommitted) {
    commitEstimateNumber($("estimateNumber").value.trim());
  }
}

function commitEstimateNumber(value) {
  const match = value.match(/^([0-9]{2})-([A-Z])([0-9]{4})$/);
  if (!match) return;
  const [, year, series, number] = match;
  const sequenceKey = `${year}-${series}`;
  const sequence = readEstimateSequence();
  sequence[sequenceKey] = Math.max(sequence[sequenceKey] || 0, Number(number));
  writeEstimateSequence(sequence);
  state.estimateNumberCommitted = true;
}

function refreshAutoEstimateNumber() {
  if (!state.autoEstimateNumber || state.estimateNumberCommitted || !$("estimateNumber").value.trim()) return;
  updatePreview();
}

function addLineItem(item = { name: "", qty: "", price: "" }) {
  state.lineItems.push({
    id: createId(),
    type: "item",
    name: cleanLineItemName(item.name),
    qty: item.qty,
    price: item.price,
  });
  renderLineItems();
  updatePreview();
}

function cleanLineItemName(name) {
  const value = String(name || "").trim();
  return OLD_LINE_EXAMPLES.has(value) ? "" : name || "";
}

function materialSearchTerms(value) {
  const normalized = String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (!normalized) return [];
  const terms = new Set([normalized]);
  normalized.split(" ").filter(Boolean).forEach((token) => {
    terms.add(token);
    if (token.endsWith("s") && token.length > 3) terms.add(token.slice(0, -1));
  });
  if (normalized.includes("paintbrush")) {
    terms.add("paint brush");
    terms.add("brush");
  }
  return Array.from(terms).filter((term) => term.length > 1);
}

function estimatorMaterialRows() {
  const baseMaterials = Array.isArray(window.D2_MATERIALS_DATABASE) ? window.D2_MATERIALS_DATABASE : [];
  let customMaterials = [];
  let deletedMaterialIds = [];
  try {
    const saved = JSON.parse(localStorage.getItem(PRICE_DATABASE_KEY) || "[]");
    customMaterials = Array.isArray(saved) ? saved : [];
  } catch (error) {
    customMaterials = [];
  }
  try {
    const savedDeleted = JSON.parse(localStorage.getItem(PRICE_DELETED_KEY) || "[]");
    deletedMaterialIds = Array.isArray(savedDeleted) ? savedDeleted : [];
  } catch (error) {
    deletedMaterialIds = [];
  }
  const deletedIds = new Set(deletedMaterialIds);
  const overriddenIds = new Set(customMaterials.map((material) => material.sourceId).filter(Boolean));
  return [
    ...customMaterials.filter((material) => !deletedIds.has(material.id) && !deletedIds.has(material.sourceId)),
    ...baseMaterials.filter((material) => !overriddenIds.has(material.id) && !deletedIds.has(material.id)),
  ];
}

function materialPrice(material) {
  return Number(material?.defaultPrice ?? material?.price ?? material?.priceLow ?? 0) || 0;
}

function materialMatches(value) {
  const materials = estimatorMaterialRows();
  const terms = materialSearchTerms(value);
  if (terms.length === 0) return [];
  return materials
    .filter((material) => {
      const haystack = [
        material.product,
        material.category,
        material.id,
        material.unit,
      ].join(" ").toLowerCase().replace(/[^a-z0-9]+/g, " ");
      return terms.some((term) => haystack.includes(term));
    })
    .slice(0, 8);
}

function renderMaterialSuggestions(row, value) {
  const panel = row.querySelector(".material-suggestions");
  if (!panel) return;
  const matches = materialMatches(value);
  panel.hidden = matches.length === 0;
  panel.innerHTML = matches.map((material) => `
    <button type="button" class="material-suggestion" data-material-id="${escapeHtml(material.id)}">
      <span>${escapeHtml(material.product)}</span>
      <strong>${currency.format(materialPrice(material))}</strong>
    </button>
  `).join("");
}

function closeMaterialSuggestions(row) {
  const panel = row.querySelector(".material-suggestions");
  if (!panel) return;
  panel.hidden = true;
  panel.innerHTML = "";
}

function applyMaterialSuggestion(row, materialItem, materialId) {
  const material = estimatorMaterialRows().find((entry) => entry.id === materialId);
  if (!material) return;
  const price = materialPrice(material);
  materialItem.name = material.product;
  materialItem.price = price;
  materialItem.unit = material.unit;
  if (!(Number.parseFloat(materialItem.qty) > 0)) materialItem.qty = 1;
  const nameInput = row.querySelector('[data-field="name"]');
  const qtyInput = row.querySelector('[data-field="qty"]');
  const priceInput = row.querySelector('[data-field="price"]');
  const panel = row.querySelector(".material-suggestions");
  if (nameInput) {
    nameInput.value = material.product;
    autoGrowTextArea(nameInput);
  }
  if (qtyInput) qtyInput.value = materialItem.qty;
  if (priceInput) priceInput.value = price;
  if (panel) closeMaterialSuggestions(row);
  updatePreview();
}

function addMaterialItem(item = { name: "", qty: "", price: "", unit: "" }) {
  state.materialItems.push({
    id: createId(),
    name: item.name || "",
    qty: item.qty === "" ? "" : wholeNumberValue(item.qty),
    price: item.price || "",
    unit: item.unit || "",
  });
  renderMaterialItems();
  updatePreview();
}

function insertMaterialItemAfter(id) {
  const currentIndex = state.materialItems.findIndex((item) => item.id === id);
  const insertAt = currentIndex >= 0 ? currentIndex + 1 : state.materialItems.length;
  const material = { id: createId(), name: "", qty: "", price: "", unit: "" };
  state.materialItems.splice(insertAt, 0, material);
  renderMaterialItems();
  requestAnimationFrame(() => {
    const row = document.querySelector(`[data-id="${material.id}"]`);
    const textarea = row ? row.querySelector('[data-field="name"]') : null;
    if (textarea) textarea.focus();
  });
  updatePreview();
}

function ensureMaterialRowAfter(item) {
  const currentIndex = state.materialItems.findIndex((entry) => entry.id === item.id);
  if (currentIndex === -1) return;
  const nextItem = state.materialItems[currentIndex + 1];
  const nextIsBlank = nextItem &&
    !String(nextItem.name || "").trim() &&
    !(Number.parseFloat(nextItem.qty) > 0) &&
    !(Number.parseFloat(nextItem.price) > 0);
  if (nextIsBlank) return;
  insertMaterialItemAfter(item.id);
}

function removeMaterialItem(id) {
  state.materialItems = state.materialItems.filter((item) => item.id !== id);
  if (state.materialItems.length === 0) {
    state.materialItems = [{ id: createId(), name: "", qty: "", price: "", unit: "" }];
  }
  renderMaterialItems();
  updatePreview();
}

function calculateMaterialCost() {
  return state.materialItems.reduce((sum, item) => {
    return sum + wholeNumberValue(item.qty) * (Number.parseFloat(item.price) || 0);
  }, 0);
}

function isCompleteEntry(item) {
  return Boolean(String(item.name || "").trim()) &&
    Number.parseFloat(item.qty) > 0 &&
    Number.parseFloat(item.price) > 0;
}

function wholeNumberValue(value) {
  return Math.max(0, Math.round(Number.parseFloat(value) || 0));
}

function wholeNumberText(value) {
  const match = String(value || "").match(/\d+/);
  return match ? match[0] : "";
}

function maybeAddBlankMaterialRow(item) {
  const lastItem = state.materialItems[state.materialItems.length - 1];
  if (!lastItem || lastItem.id !== item.id || !isCompleteEntry(item)) return false;
  state.materialItems.push({ id: createId(), name: "", qty: "", price: "", unit: "" });
  renderMaterialItems();
  updatePreview();
  return true;
}

function maybeAddBlankLineItemRow(item) {
  const visibleItems = state.lineItems.filter((entry) => entry.type !== "subline");
  const lastItem = visibleItems[visibleItems.length - 1];
  if (!lastItem || lastItem.id !== item.id || !isCompleteEntry(item)) return false;
  state.lineItems.push({ id: createId(), type: "item", name: "", qty: "", price: "" });
  renderLineItems();
  updatePreview();
  return true;
}

function getLineItemDepth(item) {
  let depth = 0;
  let parentId = item.parentId;
  const seen = new Set();
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = state.lineItems.find((entry) => entry.id === parentId);
    if (!parent) break;
    depth += 1;
    parentId = parent.parentId;
  }
  return depth;
}

function isLineItemDescendant(entry, ancestorId) {
  let parentId = entry.parentId;
  const seen = new Set();
  while (parentId && !seen.has(parentId)) {
    if (parentId === ancestorId) return true;
    seen.add(parentId);
    const parent = state.lineItems.find((item) => item.id === parentId);
    parentId = parent ? parent.parentId : "";
  }
  return false;
}

function lineItemBlockRange(index) {
  const item = state.lineItems[index];
  if (!item) return null;
  let end = index + 1;
  while (end < state.lineItems.length && isLineItemDescendant(state.lineItems[end], item.id)) {
    end += 1;
  }
  return { start: index, end };
}

function moveLineItem(id, direction) {
  const index = state.lineItems.findIndex((item) => item.id === id);
  if (index === -1) return;
  const block = lineItemBlockRange(index);
  if (!block) return;
  if (direction === "up") {
    let previousStart = index - 1;
    while (previousStart >= 0 && isLineItemDescendant(state.lineItems[index], state.lineItems[previousStart].id)) {
      previousStart -= 1;
    }
    if (previousStart < 0) return;
    const previousBlock = lineItemBlockRange(previousStart);
    if (!previousBlock) return;
    const moving = state.lineItems.splice(block.start, block.end - block.start);
    state.lineItems.splice(previousBlock.start, 0, ...moving);
  }
  if (direction === "down") {
    const nextStart = block.end;
    if (nextStart >= state.lineItems.length) return;
    const nextBlock = lineItemBlockRange(nextStart);
    if (!nextBlock) return;
    const moving = state.lineItems.splice(block.start, block.end - block.start);
    const insertAt = nextBlock.end - moving.length;
    state.lineItems.splice(insertAt, 0, ...moving);
  }
  renderLineItems();
  updatePreview();
}

function renderMaterialItems() {
  const container = $("materialItems");
  container.innerHTML = "";

  state.materialItems.forEach((item) => {
    const row = document.createElement("div");
    row.className = "material-row";
    row.dataset.id = item.id;
    row.innerHTML = `
      <label>
        Material / Supply
        <textarea data-field="name" rows="1">${escapeHtml(item.name)}</textarea>
        <div class="material-suggestions" hidden></div>
      </label>
      <label>
        Qty
        <input data-field="qty" type="text" inputmode="numeric" pattern="[0-9]*" value="${item.qty === "" ? "" : wholeNumberText(item.qty)}">
      </label>
      <label>
        Unit Cost
        <input data-field="price" type="number" min="0" step="0.01" value="${item.price}">
      </label>
      <div class="material-actions">
        <button type="button" data-action="add" title="Add supply item below" aria-label="Add supply item below">+</button>
        <button type="button" data-action="remove" title="Remove material" aria-label="Remove material">x</button>
      </div>
    `;

    row.addEventListener("input", (event) => {
      const target = event.target;
      const field = target.dataset.field;
      if (!field) return;
      const materialItem = state.materialItems.find((entry) => entry.id === item.id);
      if (field === "name") {
        materialItem[field] = target.value;
      } else if (field === "qty") {
        const cleanedQty = wholeNumberText(target.value);
        materialItem[field] = cleanedQty;
        target.value = cleanedQty;
      } else {
        materialItem[field] = Number.parseFloat(target.value) || 0;
        if (materialItem[field] > 0 && !(wholeNumberValue(materialItem.qty) > 0)) {
          materialItem.qty = 1;
          const qtyInput = row.querySelector('[data-field="qty"]');
          if (qtyInput) qtyInput.value = "1";
        }
      }
      if (field === "name") {
        if (String(target.value || "").trim()) {
          renderMaterialSuggestions(row, target.value);
        } else {
          closeMaterialSuggestions(row);
        }
      }
      if (target.tagName === "TEXTAREA") autoGrowTextArea(target);
      updatePreview();
    });

    row.addEventListener("change", (event) => {
      const target = event.target;
      if (target.dataset.field !== "qty") return;
      const materialItem = state.materialItems.find((entry) => entry.id === item.id);
      materialItem.qty = wholeNumberText(target.value);
      target.value = materialItem.qty;
      updatePreview();
    });

    row.addEventListener("keydown", (event) => {
      const target = event.target;
      if (event.key !== "Enter") return;
      if (target.dataset.field === "name") {
        event.preventDefault();
        closeMaterialSuggestions(row);
        target.blur();
        updatePreview();
        return;
      }
      if (target.dataset.field !== "price") return;
      event.preventDefault();
      closeMaterialSuggestions(row);
      const materialItem = state.materialItems.find((entry) => entry.id === item.id);
      ensureMaterialRowAfter(materialItem);
      requestAnimationFrame(() => {
        const currentIndex = state.materialItems.findIndex((entry) => entry.id === materialItem.id);
        const nextItem = state.materialItems[currentIndex + 1];
        const nextRow = nextItem ? document.querySelector(`[data-id="${nextItem.id}"]`) : null;
        const textarea = nextRow ? nextRow.querySelector('[data-field="name"]') : null;
        if (textarea) textarea.focus();
      });
      updatePreview();
    });

    row.addEventListener("focusout", () => {
      setTimeout(() => {
        if (!row.contains(document.activeElement)) closeMaterialSuggestions(row);
      }, 120);
    });

    row.addEventListener("click", (event) => {
      const materialButton = event.target.closest("[data-material-id]");
      if (materialButton) {
        const materialItem = state.materialItems.find((entry) => entry.id === item.id);
        applyMaterialSuggestion(row, materialItem, materialButton.dataset.materialId);
        closeMaterialSuggestions(row);
        ensureMaterialRowAfter(materialItem);
        return;
      }
      if (event.target.dataset.action === "add") insertMaterialItemAfter(item.id);
      if (event.target.dataset.action === "remove") removeMaterialItem(item.id);
    });

    container.appendChild(row);
    row.querySelectorAll("textarea").forEach(autoGrowTextArea);
  });
}

function addSubLine(parentId) {
  const parentIndex = state.lineItems.findIndex((item) => item.id === parentId);
  if (parentIndex === -1) return;
  let insertAt = parentIndex + 1;
  while (insertAt < state.lineItems.length && isLineItemDescendant(state.lineItems[insertAt], parentId)) {
    insertAt += 1;
  }
  const subline = {
    id: createId(),
    parentId,
    type: "subline",
    name: "",
    qty: 0,
    price: 0,
  };

  state.lineItems.splice(insertAt, 0, subline);
  renderLineItems();
  requestAnimationFrame(() => {
    const row = document.querySelector(`[data-id="${subline.id}"]`);
    const textarea = row ? row.querySelector('[data-field="name"]') : null;
    if (textarea) textarea.focus();
  });
  updatePreview();
}

function addSubLineAfter(sublineId) {
  const currentIndex = state.lineItems.findIndex((item) => item.id === sublineId);
  if (currentIndex === -1) return;
  const current = state.lineItems[currentIndex];
  if (current.type !== "subline" || !current.parentId) return;
  const subline = {
    id: createId(),
    parentId: current.parentId,
    type: "subline",
    name: "",
    qty: 0,
    price: 0,
  };
  state.lineItems.splice(currentIndex + 1, 0, subline);
  renderLineItems();
  requestAnimationFrame(() => {
    const row = document.querySelector(`[data-id="${subline.id}"]`);
    const textarea = row ? row.querySelector('[data-field="name"]') : null;
    if (textarea) textarea.focus();
  });
  updatePreview();
}

function removeLineItem(id) {
  state.lineItems = state.lineItems.filter((item) => item.id !== id && !isLineItemDescendant(item, id));
  renderLineItems();
  updatePreview();
}

function addPhotos(files) {
  Array.from(files)
    .filter((file) => file.type.startsWith("image/"))
    .forEach((file) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        state.photos.push({
          id: createId(),
          name: file.name,
          label: "",
          dataUrl: reader.result,
        });
        renderPhotos();
        updatePreview();
      });
      reader.readAsDataURL(file);
    });
}

function addAssignmentPhotos(files) {
  Array.from(files)
    .filter((file) => file.type.startsWith("image/"))
    .forEach((file) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        state.assignmentPhotos.push({
          id: createId(),
          name: file.name,
          label: "",
          dataUrl: reader.result,
        });
        renderAssignmentPhotos();
      });
      reader.readAsDataURL(file);
    });
}

function removePhoto(id) {
  state.photos = state.photos.filter((photo) => photo.id !== id);
  renderPhotos();
  updatePreview();
}

function removeAssignmentPhoto(id) {
  state.assignmentPhotos = state.assignmentPhotos.filter((photo) => photo.id !== id);
  renderAssignmentPhotos();
}

function renderPhotos() {
  const container = $("photoEditorList");
  container.innerHTML = "";

  state.photos.forEach((photo) => {
    const card = document.createElement("div");
    card.className = "photo-editor-card";
    card.dataset.id = photo.id;
    card.innerHTML = `
      <img src="${photo.dataUrl}" alt="${escapeHtml(photo.label || photo.name)}">
      <label>
        Image Label
        <input data-field="label" value="${escapeHtml(photo.label)}" placeholder="Example: Existing closet">
      </label>
      <button type="button" data-action="remove" title="Remove photo" aria-label="Remove photo">x</button>
    `;

    card.addEventListener("input", (event) => {
      if (event.target.dataset.field !== "label") return;
      const entry = state.photos.find((item) => item.id === photo.id);
      if (entry) entry.label = event.target.value;
      updatePreview();
    });

    card.addEventListener("click", (event) => {
      if (event.target.dataset.action === "remove") removePhoto(photo.id);
    });

    container.appendChild(card);
  });
}

function renderAssignmentPhotos() {
  const container = $("assignmentPhotoEditorList");
  container.innerHTML = "";

  state.assignmentPhotos.forEach((photo) => {
    const card = document.createElement("div");
    card.className = "photo-editor-card";
    card.dataset.id = photo.id;
    card.innerHTML = `
      <img src="${photo.dataUrl}" alt="${escapeHtml(photo.label || photo.name)}">
      <label>
        Image Label
        <input data-field="label" value="${escapeHtml(photo.label)}" placeholder="Example: Wall condition">
      </label>
      <button type="button" data-action="remove" title="Remove assignment photo" aria-label="Remove assignment photo">x</button>
    `;

    card.addEventListener("input", (event) => {
      if (event.target.dataset.field !== "label") return;
      const entry = state.assignmentPhotos.find((item) => item.id === photo.id);
      if (entry) entry.label = event.target.value;
    });

    card.addEventListener("click", (event) => {
      if (event.target.dataset.action === "remove") removeAssignmentPhoto(photo.id);
    });

    container.appendChild(card);
  });
}

function autoGrowTextArea(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function renderLineItems() {
  const container = $("lineItems");
  container.innerHTML = "";

  state.lineItems.forEach((item) => {
    const row = document.createElement("div");
    row.className = item.type === "subline" ? "line-row subline-editor-row" : "line-row";
    row.dataset.id = item.id;
    const depth = item.type === "subline" ? Math.max(getLineItemDepth(item), 1) : 0;
    row.style.setProperty("--subline-depth", depth);
    row.style.setProperty("--subline-indent", `${Math.max(depth - 1, 0) * 22}px`);
    row.innerHTML = item.type === "subline"
      ? `
        <div class="line-move-controls">
          <button type="button" data-action="up" title="Move up" aria-label="Move subline up">↑</button>
          <button type="button" data-action="down" title="Move down" aria-label="Move subline down">↓</button>
        </div>
        <label>
          Subline
          <textarea data-field="name" rows="1">${escapeHtml(item.name)}</textarea>
        </label>
        <div class="line-actions">
          <button type="button" data-action="subline" title="Add nested subline" aria-label="Add nested subline">+</button>
          <button type="button" data-action="remove" title="Remove subline" aria-label="Remove subline">x</button>
        </div>
      `
      : `
        <div class="line-move-controls">
          <button type="button" data-action="up" title="Move up" aria-label="Move item up">↑</button>
          <button type="button" data-action="down" title="Move down" aria-label="Move item down">↓</button>
        </div>
        <label>
          Description
          <textarea data-field="name" rows="1">${escapeHtml(item.name)}</textarea>
        </label>
        <label>
          Qty
          <input data-field="qty" type="number" min="0" step="0.01" value="${item.qty}">
        </label>
        <label>
          Unit Price
          <input data-field="price" type="number" min="0" step="0.01" value="${item.price}">
        </label>
        <div class="line-actions">
          <button type="button" data-action="subline" title="Add subline" aria-label="Add subline">+</button>
          <button type="button" data-action="remove" title="Remove item" aria-label="Remove item">x</button>
        </div>
      `;

    row.addEventListener("input", (event) => {
      const target = event.target;
      const field = target.dataset.field;
      if (!field) return;

      const lineItem = state.lineItems.find((entry) => entry.id === item.id);
      lineItem[field] = field === "name" ? target.value : Number.parseFloat(target.value) || 0;
      if (field === "price" && Number.parseFloat(target.value) > 0 && !(Number.parseFloat(lineItem.qty) > 0)) {
        lineItem.qty = 1;
        const qtyInput = row.querySelector('[data-field="qty"]');
        if (qtyInput) qtyInput.value = 1;
      }
      if (target.tagName === "TEXTAREA") autoGrowTextArea(target);
      updatePreview();
    });

    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      const target = event.target;
      if (target.tagName === "TEXTAREA" && (event.altKey || event.ctrlKey || event.shiftKey || event.metaKey)) {
        requestAnimationFrame(() => autoGrowTextArea(target));
        return;
      }
      if (item.type === "subline" && target.dataset.field === "name") {
        event.preventDefault();
        addSubLineAfter(item.id);
        return;
      }
      if (item.type !== "subline" && target.dataset.field === "name") {
        const lineItem = state.lineItems.find((entry) => entry.id === item.id);
        if (!String(lineItem.name || "").trim()) return;
        event.preventDefault();
        addLineItem();
        requestAnimationFrame(() => {
          const rows = document.querySelectorAll("#lineItems .line-row:not(.subline-editor-row)");
          const nextRow = rows[rows.length - 1];
          const textarea = nextRow ? nextRow.querySelector('[data-field="name"]') : null;
          if (textarea) textarea.focus();
        });
        return;
      }
      if (target.dataset.field !== "price" || item.type === "subline") return;
      const lineItem = state.lineItems.find((entry) => entry.id === item.id);
      if (!isCompleteEntry(lineItem)) return;
      event.preventDefault();
      maybeAddBlankLineItemRow(lineItem);
    });

    row.addEventListener("click", (event) => {
      const action = event.target.dataset.action;
      if (action === "up") moveLineItem(item.id, "up");
      if (action === "down") moveLineItem(item.id, "down");
      if (action === "remove") removeLineItem(item.id);
      if (action === "subline") addSubLine(item.id);
    });
    container.appendChild(row);
    row.querySelectorAll("textarea").forEach(autoGrowTextArea);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function calculateTotals() {
  if (isInvoiceMode() && $("taxRate").value === "6.5") $("taxRate").value = "";
  if (isInvoiceMode()) $("depositRate").value = "";
  const finishMultiplier = $("projectType").value === "Other" ? 1 : numberValue("finishLevel") || 1;
  const lineSubtotal = state.lineItems.reduce((sum, item) => {
    if (item.type === "subline") return sum;
    return sum + (Number.parseFloat(item.qty) || 0) * (Number.parseFloat(item.price) || 0) * finishMultiplier;
  }, 0);
  const discountInput = $("discount").value.trim();
  const taxEnabled = $("taxEnabled") ? $("taxEnabled").checked : Boolean($("taxRate").value.trim());
  const taxInput = taxEnabled ? $("taxRate").value.trim() : "";
  const depositInput = $("depositRate").value.trim();
  const flatTotalInput = $("flatTotal").value.trim();
  const flatTotal = flatTotalInput ? numberValue("flatTotal") : 0;
  const hasFlatTotal = flatTotal > 0;
  const subtotal = hasFlatTotal ? flatTotal : lineSubtotal;
  const discountValue = numberValue("discount");
  const discountType = $("discountType").value;
  const rawDiscount = discountType === "percent" ? subtotal * (discountValue / 100) : discountValue;
  const discount = discountInput ? Math.min(rawDiscount, subtotal) : 0;
  const taxable = Math.max(subtotal - discount, 0);
  const taxValue = numberValue("taxRate");
  const taxType = $("taxType") ? $("taxType").value : "percent";
  const rawTax = taxType === "dollar" ? taxValue : taxable * (taxValue / 100);
  const tax = taxInput ? Math.max(rawTax, 0) : 0;
  const total = taxable + tax;
  const depositRate = numberValue("depositRate");
  const deposit = depositInput ? total * (depositRate / 100) : 0;

  return {
    subtotal,
    discount,
    tax,
    total,
    deposit,
    finishMultiplier,
    hasFlatTotal,
    discountType,
    discountValue,
    taxType,
    taxValue,
    depositRate,
    lineSubtotal,
    showDiscount: discount > 0,
    showTax: tax > 0,
    showDeposit: deposit > 0,
    showSubtotal: discount > 0 || tax > 0,
  };
}

function updatePreview() {
  updateCalculationPanel();
  const totals = calculateTotals();
  const materialCost = calculateMaterialCost();
  $("materialCostTotal").textContent = currency.format(materialCost);
  $("internalMaterialCost").textContent = currency.format(materialCost);
  $("internalEstimateTotal").textContent = currency.format(totals.total);
  $("internalGrossProfit").textContent = currency.format(totals.total - materialCost);
  const internalMaterials = state.materialItems.filter((item) => {
    return String(item.name || "").trim() || Number.parseFloat(item.qty) > 0 || Number.parseFloat(item.price) > 0;
  });
  $("internalMaterialList").innerHTML = internalMaterials.length
    ? `
      <table>
        <thead>
          <tr>
            <th>Supply</th>
            <th>Qty</th>
            <th>Cost</th>
          </tr>
        </thead>
        <tbody>
          ${internalMaterials.map((item) => {
            const qty = wholeNumberValue(item.qty);
            const price = Number.parseFloat(item.price) || 0;
            return `
              <tr>
                <td>${escapeHtml(item.name)}</td>
                <td>${qty || ""}</td>
                <td>${price ? currency.format(qty * price) : ""}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    `
    : "";
  const estimateNumber = $("estimateNumber").value.trim();
  $("estimateSheet").classList.toggle("flat-total-mode", totals.hasFlatTotal);
  $("previewCompany").textContent = $("companyName").value || COMPANY_DEFAULTS.name;
  $("previewEstimateTitle").textContent = $("estimateTitle").value || "Estimate";
  const invoiceMode = isInvoiceMode();
  document.body.classList.toggle("invoice-mode", invoiceMode);
  $("toggleInvoicePaidStamp").hidden = !invoiceMode;
  $("invoicePaidStamp").hidden = !invoiceMode || !state.invoicePaid;
  $("toggleInvoicePaidStamp").textContent = state.invoicePaid ? "Remove Paid Stamp" : "Paid Stamp";
  $("invoicePaidCheckbox").checked = state.invoicePaid;
  if ($("visibleEstimateNumber")) $("visibleEstimateNumber").value = estimateNumber;
  $("previewEstimateNumber").textContent = estimateNumber;
  $("previewEstimateNumber").hidden = !$("showEstimateNumber").checked || !estimateNumber;
  const companyPhone = $("companyPhone").value || COMPANY_DEFAULTS.phone;
  const companyEmail = $("companyEmail").value || COMPANY_DEFAULTS.email;
  $("previewCompanyPhone").textContent = formatPhone(companyPhone);
  $("previewCompanyPhone").href = phoneHref(companyPhone);
  $("previewCompanyEmail").textContent = companyEmail;
  $("previewCompanyEmail").href = emailHref(companyEmail);
  $("companyAddress").value = normalizeCompanyAddress($("companyAddress").value || COMPANY_DEFAULTS.address);
  $("previewCompanyAddress").innerHTML = formatCompanyAddress($("companyAddress").value);
  $("previewFooterPhone").textContent = formatPhone($("companyPhone").value || COMPANY_DEFAULTS.phone);
  $("previewFooterEmail").textContent = $("companyEmail").value || COMPANY_DEFAULTS.email;
  $("previewFooterAddress").innerHTML = formatCompanyAddress($("companyAddress").value);
  $("previewDate").textContent = $("estimateDate").value ? formatDate($("estimateDate").value) : "";
  $("previewClient").textContent = $("clientName").value || "Client name";
  $("previewPhone").textContent = formatPhone($("clientPhone").value);
  $("previewPhone").href = phoneHref($("clientPhone").value);
  $("previewClientEmail").textContent = $("clientEmail").value;
  $("previewClientEmail").href = emailHref($("clientEmail").value);
  $("previewAddress").textContent = $("projectAddress").value;
  $("previewAddress").href = mapHref($("projectAddress").value);
  $("previewNotes").textContent = $("notes").value;
  const additionalNotes = $("additionalNotes").value.trim();
  $("previewAdditionalNotes").textContent = additionalNotes;
  $("previewAdditionalNotesBlock").hidden = !additionalNotes;
  $("previewFooterValueNote").textContent = FOOTER_VALUE_NOTE;
  $("previewFooterValueNoteBlock").hidden = !$("addFooterValueNote").checked;

  const tbody = $("previewRows");
  tbody.innerHTML = "";
  state.lineItems.forEach((item) => {
    const tr = document.createElement("tr");
    if (item.type === "subline") {
      tr.className = "subline-preview-row";
      tr.style.setProperty("--subline-depth", Math.max(getLineItemDepth(item), 1));
      tr.style.setProperty("--subline-indent", `${Math.max(getLineItemDepth(item) - 1, 0) * 18}px`);
      tr.innerHTML = `
        <td><span>${escapeHtml(item.name)}</span></td>
        <td></td>
        <td></td>
      `;
      tbody.appendChild(tr);
      return;
    }

    const qty = Number.parseFloat(item.qty);
    const price = Number.parseFloat(item.price);
    const hasQty = Number.isFinite(qty) && qty > 0;
    const hasPrice = Number.isFinite(price) && price > 0;
    const total = hasQty && hasPrice ? qty * price * totals.finishMultiplier : 0;
    tr.className = "description-preview-row";
    tr.innerHTML = `
      <td>${escapeHtml(item.name)}</td>
      <td>${!totals.hasFlatTotal && hasQty ? qty : ""}</td>
      <td>${!totals.hasFlatTotal && hasQty && hasPrice ? currency.format(total) : ""}</td>
    `;
    tbody.appendChild(tr);
  });

  $("subtotal").textContent = currency.format(totals.subtotal);
  $("subtotalRow").hidden = !totals.showSubtotal;
  $("discountRow").hidden = !totals.showDiscount;
  $("taxRow").hidden = !totals.showTax;
  $("depositRow").hidden = !totals.showDeposit;
  $("discountTotal").textContent = `-${currency.format(totals.discount)}`;
  $("taxTotal").textContent = currency.format(totals.tax);
  $("grandTotal").textContent = currency.format(totals.total);
  $("depositLabel").textContent = totals.showDeposit
    ? `Deposit Due (${formatPercent(totals.depositRate)}%)`
    : "Deposit Due";
  $("depositDue").textContent = currency.format(totals.deposit);

  $("previewPhotosSection").hidden = state.photos.length === 0;
  $("previewPhotos").innerHTML = state.photos.map((photo) => `
    <figure>
      <img src="${photo.dataUrl}" alt="${escapeHtml(photo.label || photo.name)}">
      <figcaption>${escapeHtml(photo.label || photo.name)}</figcaption>
    </figure>
  `).join("");
}

function setCopyMode(mode) {
  const allowedModes = new Set(["customer", "internal", "supply", "team"]);
  const copyMode = allowedModes.has(mode) ? mode : "customer";
  const showsInternal = copyMode === "internal" || copyMode === "supply" || copyMode === "team";
  document.body.dataset.copyMode = copyMode;
  $("internalSummary").hidden = !showsInternal;
  document.querySelectorAll(".copy-mode-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.copyMode === copyMode && !button.dataset.documentView);
  });
  document.querySelectorAll("[data-document-view]").forEach((button) => button.classList.remove("active"));
  updatePreview();
}

function showEstimateDocument(mode) {
  setCopyMode(mode);
  $("paymentInvoicePreview").hidden = true;
  $("assignmentSheetPreview").hidden = true;
  $("estimatePreview").hidden = false;
  $("estimatePreview").scrollIntoView({ behavior: "smooth", block: "start" });
}

function showPaymentDocument() {
  document.querySelectorAll(".copy-mode-button").forEach((button) => button.classList.remove("active"));
  document.querySelectorAll("[data-document-view='payment']").forEach((button) => button.classList.add("active"));
  generatePaymentInvoice();
}

function showAssignmentDocument() {
  document.querySelectorAll(".copy-mode-button").forEach((button) => button.classList.remove("active"));
  document.querySelectorAll("[data-document-view='assignment']").forEach((button) => button.classList.add("active"));
  generateAssignmentSheet();
}

function setDocumentView(value) {
  if (!value) return;
  if (value === "payment") {
    showPaymentDocument();
  } else if (value === "assignment") {
    showAssignmentDocument();
  } else {
    showEstimateDocument(value);
  }
  document.querySelectorAll("#documentViewSelect, [data-document-view-select]").forEach((select) => {
    select.value = "";
  });
}

function buildEstimateHtmlCopy(label) {
  const stylesheetUrl = new URL("styles.css", window.location.href).href;
  const logoUrl = new URL("assets/d2-logo.png", window.location.href).href;
  const sheetHtml = $("estimateSheet").outerHTML.replaceAll("assets/d2-logo.png", logoUrl);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml($("estimateNumber").value || "Estimate")} - ${escapeHtml(label)}</title>
    <link rel="stylesheet" href="${stylesheetUrl}">
  </head>
  <body data-copy-mode="${document.body.dataset.copyMode || "customer"}">
    <main class="app-shell">
      <section class="workspace">
        <aside class="preview">
          ${sheetHtml}
        </aside>
      </section>
    </main>
  </body>
</html>`;
}

function buildSubmittedCopies() {
  const currentMode = document.body.dataset.copyMode || "customer";
  const copies = {};
  Object.entries(COPY_MODE_LABELS).forEach(([mode, label]) => {
    setCopyMode(mode);
    updatePreview();
    copies[mode] = {
      label,
      html: buildEstimateHtmlCopy(label),
    };
  });
  setCopyMode(currentMode);
  updatePreview();
  return copies;
}

function getPaymentInvoiceDate() {
  const dateValue = $("estimateDate").value;
  const date = dateValue ? new Date(`${dateValue}T12:00:00`) : new Date();
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getPaymentProjectDescription() {
  const descriptions = state.lineItems
    .filter((item) => item.type !== "subline")
    .map((item) => String(item.name || "").trim())
    .filter(Boolean);
  if (descriptions.length) return descriptions.join(", ");
  if ($("projectType").value === "Other" && $("projectTypeOther")?.value.trim()) return $("projectTypeOther").value.trim();
  if ($("projectType").value && $("projectType").value !== "Other") return $("projectType").value;
  return "Project payment";
}

function formatPaymentAddressHtml(value) {
  return escapeHtml(normalizeCompanyAddress(value)).replace(" Cape Coral", "<br>Cape Coral");
}

function buildPaymentInvoiceHtml() {
  const totals = calculateTotals();
  const logoUrl = new URL("assets/d2-logo.png", window.location.href).href;
  const companyPhone = $("companyPhone").value || COMPANY_DEFAULTS.phone;
  const companyEmail = $("companyEmail").value || COMPANY_DEFAULTS.email;
  const companyAddress = normalizeCompanyAddress($("companyAddress").value || COMPANY_DEFAULTS.address);
  const clientName = $("clientName").value.trim() || "Client";
  const clientPhone = formatPhone($("clientPhone").value || "");
  const clientEmail = $("clientEmail").value.trim();
  const projectAddress = $("projectAddress").value.trim();
  const projectMapHref = mapHref(projectAddress);
  const estimateNumber = $("showEstimateNumber").checked ? $("estimateNumber").value.trim() : "";
  const invoiceTitle = estimateNumber ? `Payment Invoice ${estimateNumber}` : "Payment Invoice";
  const projectDescription = getPaymentProjectDescription();
  const paymentMemo = estimateNumber
    ? `D2 Carpentry & Design payment for estimate ${estimateNumber}`
    : "D2 Carpentry & Design project payment";
  const amountDue = currency.format(totals.total);
  const stripeButton = STRIPE_PAYMENT_LINK
    ? `<a class="action-button" href="${escapeHtml(STRIPE_PAYMENT_LINK)}" target="_blank" rel="noopener">Pay With Stripe</a>`
    : `<span class="action-button disabled">Stripe Link Needed</span>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(clientName)} - D2 Payment Invoice</title>
    <style>
      :root { color-scheme: light; --ink: #202124; --muted: #6b7280; --line: #d7dce5; --paper: #fff; --surface: #eef1f5; --blue: #0d4a91; --soft: #f8fafc; --green: #1f7a4c; --gold: #766022; --shadow: 0 18px 42px rgba(32,33,36,.14); }
      * { box-sizing: border-box; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      body { margin: 0; min-width: 320px; background: var(--surface); color: var(--ink); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      main { width: min(820px, 100%); margin: 0 auto; padding: 24px; }
      .invoice-sheet { min-height: 720px; border: 1px solid #c8d0dc; border-radius: 8px; background: var(--paper); box-shadow: var(--shadow); padding: 28px; }
      .sheet-header { display: grid; grid-template-columns: 126px minmax(0, 1fr) 220px; gap: 12px; align-items: start; padding-bottom: 12px; border-bottom: 4px solid var(--blue); }
      .logo-card { display: grid; width: 126px; height: 96px; place-items: center; }
      .logo-card img { display: block; width: 100%; height: 100%; object-fit: contain; }
      .brand-title-lockup { display: inline-grid; justify-items: center; align-self: center; width: max-content; }
      .brand-title-lockup h1 { margin: 0; color: var(--blue); font-size: clamp(1.38rem, 2.4vw, 1.8rem); line-height: 1.05; letter-spacing: 0; }
      .brand-title-lockup p { margin: 6px 0 0; color: var(--muted); font-size: .8rem; line-height: 1.25; text-align: center; width: 100%; }
      .document-info { justify-self: end; width: 220px; display: grid; gap: 8px; }
      .document-info h2 { margin: 0; color: var(--blue); font-size: 1.18rem; line-height: 1.08; text-align: right; text-transform: uppercase; }
      .document-info dl { display: grid; gap: 4px; margin: 0; }
      .document-info dl div { display: grid; grid-template-columns: 82px minmax(0, 1fr); gap: 8px; }
      dt, .section-label { color: var(--muted); font-size: .68rem; font-weight: 900; line-height: 1.18; text-transform: uppercase; }
      .document-info dt { color: var(--ink); text-align: right; }
      dd { margin: 0; font-size: .74rem; line-height: 1.2; text-align: right; white-space: nowrap; }
      .client-grid { display: grid; grid-template-columns: minmax(0, 1fr) 260px; gap: 16px; margin-top: 42px; }
      .client-card, .notes, .method-row { border: 1px solid var(--line); border-radius: 8px; background: var(--soft); }
      .client-card { display: grid; gap: 7px; padding: 14px; }
      .client-card strong { font-size: 1.08rem; }
      .client-card p { margin: 0; color: var(--muted); font-size: .88rem; line-height: 1.35; }
      .client-card a { color: var(--muted); text-decoration: none; }
      .amount-due { display: grid; align-content: center; gap: 7px; border: 2px solid var(--blue); border-radius: 8px; padding: 16px; text-align: right; }
      .amount-due span { color: var(--muted); font-size: .72rem; font-weight: 900; text-transform: uppercase; }
      .amount-due strong { color: var(--blue); font-size: 2rem; line-height: 1; }
      .payment-methods { display: grid; gap: 12px; margin-top: 22px; }
      .method-row { display: grid; grid-template-columns: 128px minmax(0, 1fr) 170px; gap: 16px; align-items: center; min-height: 106px; padding: 14px; }
      .method-heading { display: grid; gap: 6px; }
      .method-heading h3 { display: flex; align-items: center; gap: 8px; margin: 0; color: var(--blue); font-size: 1rem; }
      .method-dot { width: 10px; height: 10px; border-radius: 999px; background: var(--blue); }
      .zelle .method-dot { background: var(--green); }
      .cash .method-dot { background: var(--gold); }
      .method-copy { display: grid; gap: 6px; }
      .method-copy p, .notes p { margin: 0; color: var(--muted); font-size: .95rem; line-height: 1.42; }
      .method-link { color: var(--blue); font-size: .82rem; font-weight: 900; overflow-wrap: anywhere; text-decoration: none; }
      .inline-emphasis { color: var(--ink); font-size: 1.04rem; font-weight: 900; }
      .action-button { display: inline-flex; min-height: 42px; align-items: center; justify-content: center; width: 100%; border-radius: 8px; background: var(--blue); color: #fff; font-size: .88rem; font-weight: 900; padding: 0 14px; text-decoration: none; white-space: nowrap; }
      .action-button.zelle-button { background: var(--green); }
      .action-button.cash-button { background: var(--gold); }
      .action-button.disabled { background: var(--muted); }
      .notes { display: grid; gap: 6px; margin: 24px 0 0; padding: 14px; }
      .notes strong { color: var(--ink); }
      .invoice-footer { display: grid; grid-template-columns: 132px minmax(0, 220px) minmax(0, 1fr); align-items: start; gap: 10px; margin-top: 48px; padding-top: 16px; border-top: 1px solid var(--line); color: var(--muted); font-size: .56rem; }
      .footer-contact { display: flex; align-items: flex-start; gap: 4px; min-width: 0; white-space: nowrap; }
      .invoice-footer strong { color: var(--ink); }
      .invoice-footer > span:nth-child(3) { justify-content: flex-end; text-align: right; }
      @media (max-width: 760px) {
        main { padding: 12px; }
        .invoice-sheet { padding: 18px; }
        .sheet-header, .client-grid, .method-row, .invoice-footer { grid-template-columns: 1fr; }
        .document-info, .logo-card { width: 100%; justify-self: stretch; }
        .logo-card { height: 90px; }
        .brand-title-lockup, .document-info h2, .document-info dt, dd, .amount-due, .invoice-footer > span:nth-child(3) { justify-items: start; text-align: left; }
      }
      @media print {
        @page { size: letter; margin: .35in; }
        body { background: #fff; }
        main { width: 100%; padding: 0; }
        .invoice-sheet { border: 0; box-shadow: none; padding: 18px; }
      }
    </style>
  </head>
  <body>
    <main>
      <article class="invoice-sheet">
        <header class="sheet-header">
          <div class="logo-card"><img src="${escapeHtml(logoUrl)}" alt="D2 Carpentry and Design logo"></div>
          <div class="brand-title-lockup">
            <h1>${escapeHtml($("companyName").value || COMPANY_DEFAULTS.name)}</h1>
            <p>-Crafting Your Vision One Nail At A Time-</p>
          </div>
          <div class="document-info">
            <h2>${escapeHtml(invoiceTitle)}</h2>
            <dl>
              <div><dt>Date</dt><dd>${escapeHtml(getPaymentInvoiceDate())}</dd></div>
              <div><dt>Due</dt><dd>Upon receipt</dd></div>
            </dl>
          </div>
        </header>

        <section class="client-grid" aria-label="Client and amount due">
          <div class="client-card">
            <span class="section-label">Client Information</span>
            <strong>${escapeHtml(clientName)}</strong>
            ${clientPhone ? `<p><a href="${escapeHtml(phoneHref($("clientPhone").value || ""))}">${escapeHtml(clientPhone)}</a></p>` : ""}
            ${clientEmail ? `<p><a href="${escapeHtml(emailHref(clientEmail))}">${escapeHtml(clientEmail)}</a></p>` : ""}
            ${projectAddress ? `<p><a href="${escapeHtml(projectMapHref)}" target="_blank" rel="noopener">${escapeHtml(projectAddress)}</a></p>` : ""}
          </div>
          <div class="amount-due">
            <span>Amount Due</span>
            <strong>${escapeHtml(amountDue)}</strong>
          </div>
        </section>

        <section class="notes">
          <p><strong>Summary:</strong> ${escapeHtml(projectDescription)} - ${escapeHtml(amountDue)}</p>
          <p><strong>Memo:</strong> ${escapeHtml(paymentMemo)}</p>
        </section>

        <section class="payment-methods" aria-label="Payment methods">
          <div class="method-row stripe">
            <div class="method-heading">
              <h3><span class="method-dot"></span>Stripe</h3>
              <span class="section-label">Card Payment</span>
            </div>
            <div class="method-copy">
              <p>Pay securely online using the Stripe payment page.</p>
              <a class="method-link" href="https://support.stripe.com/questions/faq-for-customers-of-businesses-using-stripe#what-is-stripe" target="_blank" rel="noopener">What is Stripe?</a>
            </div>
            ${stripeButton}
          </div>

          <div class="method-row zelle">
            <div class="method-heading">
              <h3><span class="method-dot"></span>Zelle</h3>
              <span class="section-label">Bank Transfer</span>
            </div>
            <div class="method-copy">
              <p>Send payment to our Zelle ID <strong class="inline-emphasis">${escapeHtml(ZELLE_ID)}</strong>.</p>
              <p>This Zelle ID is linked to our business bank legal name <strong class="inline-emphasis">PB II AU LLC</strong>.</p>
            </div>
            <a class="action-button zelle-button" href="mailto:${escapeHtml(companyEmail)}?subject=${encodeURIComponent(paymentMemo)}">Use Zelle ID</a>
          </div>

          <div class="method-row cash">
            <div class="method-heading">
              <h3><span class="method-dot"></span>Cash / Check</h3>
              <span class="section-label">Pickup</span>
            </div>
            <div class="method-copy">
              <p>Cash and check payments can be arranged at your convenience. Simply give us a call, and we will coordinate a time to stop by and collect the payment.</p>
            </div>
            <a class="action-button cash-button" href="${escapeHtml(phoneHref(companyPhone))}">Call To Schedule</a>
          </div>
        </section>

        <section class="notes">
          <p>Thank you for your prompt payment. We truly appreciate your business and are grateful for the opportunity to bring your project to life.</p>
        </section>

        <footer class="invoice-footer">
          <span class="footer-contact"><strong>Office:</strong> <span>${escapeHtml(formatPhone(companyPhone))}</span></span>
          <span class="footer-contact"><strong>Email:</strong> <span>${escapeHtml(companyEmail)}</span></span>
          <span class="footer-contact"><strong>Address:</strong> <span>${formatPaymentAddressHtml(companyAddress)}</span></span>
        </footer>
      </article>
    </main>
  </body>
</html>`;
}

function showPaymentInvoicePreview(html) {
  const preview = $("paymentInvoicePreview");
  const frame = $("paymentInvoiceFrame");
  frame.srcdoc = html;
  preview.hidden = false;
  preview.scrollIntoView({ behavior: "smooth", block: "start" });
}

function setPaymentInvoiceStatus() {
  const status = $("submitStatus");
  status.innerHTML = "";
  status.textContent = "Payment invoice is ready below.";
}

function setSubmitStatus(message) {
  const status = $("submitStatus");
  if (!status) return;
  status.textContent = message;
}

function generatePaymentInvoice() {
  updatePreview();
  const html = buildPaymentInvoiceHtml();
  showPaymentInvoicePreview(html);
  setPaymentInvoiceStatus();
}

function printPaymentInvoice() {
  generatePaymentPdf().catch(() => printPaymentInvoiceFallback());
}

function printPaymentInvoiceFallback() {
  const frame = $("paymentInvoiceFrame");
  if (!frame.srcdoc) {
    generatePaymentInvoice();
    return;
  }
  if (frame.contentWindow) frame.contentWindow.print();
}

function buildAssignmentScopeHtml() {
  const useSpanishScope = $("assignmentLanguage").value === "es" && $("useSpanishScope").checked;
  const manualScope = useSpanishScope
    ? $("assignmentScopeSpanish").value.trim()
    : $("assignmentScope").value.trim();
  if (manualScope) return `<p class="scope-text">${escapeHtml(manualScope)}</p>`;

  const rows = state.lineItems
    .map((item) => {
      const name = String(item.name || "").trim();
      if (!name) return "";
      if (item.type === "subline") return `<li class="subline">${escapeHtml(name)}</li>`;
      return `<li>${escapeHtml(name)}</li>`;
    })
    .filter(Boolean)
    .join("");
  return rows ? `<ul class="scope-list">${rows}</ul>` : `<div class="blank-box tall"></div>`;
}

function buildAssignmentPhotosHtml() {
  const photos = state.assignmentPhotos.length ? state.assignmentPhotos : state.photos;
  if (!photos.length) return "";
  return `
    <div class="assignment-image-grid">
      ${photos.map((photo) => `
        <figure>
          <img src="${photo.dataUrl}" alt="${escapeHtml(photo.label || photo.name)}">
          <figcaption>${escapeHtml(photo.label || photo.name)}</figcaption>
        </figure>
      `).join("")}
    </div>
  `;
}

function getAssignmentLabels() {
  const spanish = $("assignmentLanguage").value === "es";
  return spanish
    ? {
        htmlLang: "es",
        pageTitle: "Asignación",
        clientInfo: "Información del Cliente",
        schedule: "Horario",
        projectNumber: "Número de Proyecto",
        dateToStart: "Fecha de Inicio",
        expectedArrival: "Hora Estimada de Llegada",
        workScope: "Alcance del Trabajo",
        employeeNotes: "Notas para el Empleado",
        assignmentImages: "Imágenes de la Asignación",
        open: "Abierto",
        office: "Oficina:",
        email: "Email:",
        address: "Dirección:",
      }
    : {
        htmlLang: "en",
        pageTitle: "Assignment",
        clientInfo: "Client Information",
        schedule: "Schedule",
        projectNumber: "Project Number",
        dateToStart: "Date to Start",
        expectedArrival: "Expected Arrival",
        workScope: "Work Scope",
        employeeNotes: "Employee Notes",
        assignmentImages: "Assignment Images",
        open: "Open",
        office: "Office:",
        email: "Email:",
        address: "Address:",
      };
}

function buildAssignmentSheetHtml() {
  const logoUrl = new URL("assets/d2-logo.png", window.location.href).href;
  const labels = getAssignmentLabels();
  const companyPhone = $("companyPhone").value || COMPANY_DEFAULTS.phone;
  const companyEmail = $("companyEmail").value || COMPANY_DEFAULTS.email;
  const companyAddress = normalizeCompanyAddress($("companyAddress").value || COMPANY_DEFAULTS.address);
  const clientName = $("clientName").value.trim() || "Client";
  const clientPhone = formatPhone($("clientPhone").value || "");
  const clientEmail = $("clientEmail").value.trim();
  const projectAddress = $("projectAddress").value.trim();
  const assignmentMapHref = mapHref(projectAddress);
  const estimateNumber = $("showEstimateNumber").checked ? $("estimateNumber").value.trim() : "";
  const assignmentNotes = $("assignmentNotes").value.trim();
  const startDate = $("assignmentStartDate").value ? formatDate($("assignmentStartDate").value) : "";
  const arrivalTime = $("assignmentArrivalTime").value || "Open";
  const displayArrivalTime = arrivalTime === "Open" ? labels.open : arrivalTime;
  const assignmentPhotosHtml = buildAssignmentPhotosHtml();

  return `<!doctype html>
<html lang="${labels.htmlLang}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(clientName)} - D2 ${escapeHtml(labels.pageTitle)}</title>
    <style>
      :root { color-scheme: light; --ink: #202124; --muted: #6b7280; --line: #d7dce5; --paper: #fff; --surface: #eef1f5; --blue: #0d4a91; --soft: #f8fafc; --shadow: 0 18px 42px rgba(32,33,36,.14); }
      * { box-sizing: border-box; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      body { margin: 0; min-width: 320px; background: #fff; color: var(--ink); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      main { width: min(760px, 100%); margin: 0 auto; padding: 0; }
      .sheet { min-height: 720px; border: 0; border-radius: 0; background: var(--paper); box-shadow: none; padding: 28px; }
      .sheet-header { display: grid; grid-template-columns: 110px minmax(0, 1fr) 170px; gap: 14px; align-items: center; padding-bottom: 12px; border-bottom: 4px solid var(--blue); overflow: hidden; }
      .logo-card { display: block; width: 110px; height: 84px; overflow: hidden; }
      .logo-card img, .assignment-logo { display: block !important; width: 110px !important; max-width: 110px !important; height: 84px !important; max-height: 84px !important; object-fit: contain !important; }
      .brand-title-lockup { display: inline-grid; justify-items: center; align-self: center; width: max-content; max-width: 100%; }
      .brand-title-lockup h1 { margin: 0; color: var(--blue); font-size: clamp(1.34rem, 2.15vw, 1.72rem); line-height: 1.05; letter-spacing: 0; white-space: nowrap; }
      .brand-title-lockup p { margin: 5px 0 0; color: var(--muted); font-size: .76rem; line-height: 1.25; text-align: center; width: 100%; }
      .document-info { justify-self: end; width: 170px; display: grid; align-content: start; }
      .document-info h2 { margin: 0; color: var(--blue); font-size: 1.26rem; line-height: 1.08; text-align: right; text-transform: uppercase; }
      .content-grid { display: grid; grid-template-columns: minmax(0, 1fr) 240px; gap: 16px; margin-top: 16px; }
      .card { border: 1px solid var(--line); border-radius: 8px; background: var(--soft); padding: 14px; }
      .section-label { display: block; margin-bottom: 8px; color: var(--blue); font-size: .72rem; font-weight: 900; text-transform: uppercase; }
      .client-card strong { display: block; margin-bottom: 6px; font-size: 1.08rem; }
      .client-card p { margin: 0 0 4px; color: #374151; font-size: .9rem; line-height: 1.35; }
      .client-card a { color: #374151; text-decoration: none; }
      .client-card a:hover { color: var(--blue); text-decoration: underline; }
      .schedule-card { display: grid; align-content: start; gap: 10px; }
      .schedule-card div { display: grid; gap: 3px; }
      .schedule-card small { color: var(--muted); font-size: .68rem; font-weight: 900; text-transform: uppercase; }
      .schedule-card strong { color: var(--ink); font-size: 1rem; line-height: 1.15; }
      .notes-card, .scope-card, .image-card { margin-top: 18px; }
      .notes-card p { min-height: 140px; margin: 0; color: var(--ink); font-size: .96rem; line-height: 1.45; white-space: pre-wrap; }
      .blank-box { min-height: 140px; border: 1px dashed #b9c2cf; border-radius: 8px; background: #fff; }
      .blank-box.tall { min-height: 150px; }
      .scope-list { margin: 0; padding-left: 20px; color: var(--ink); font-size: .96rem; line-height: 1.45; }
      .scope-list li { margin: 0 0 6px; }
      .scope-list .subline { color: var(--muted); margin-left: 16px; }
      .scope-text { min-height: 150px; margin: 0; color: var(--ink); font-size: .96rem; line-height: 1.45; white-space: pre-wrap; }
      .assignment-image-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
      figure { margin: 0; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; background: #fff; }
      figure img { display: block; width: 100%; height: 210px; object-fit: cover; }
      figcaption { padding: 8px; color: var(--muted); font-size: .78rem; font-weight: 800; }
      .sheet-footer { display: grid; grid-template-columns: max-content minmax(0, 1fr) minmax(0, 1.25fr); align-items: start; gap: 14px; margin-top: 42px; padding-top: 16px; border-top: 1px solid var(--line); color: #4b5563; font-size: .58rem; }
      .footer-contact { display: flex; align-items: flex-start; gap: 4px; min-width: 0; white-space: nowrap; }
      .sheet-footer strong { color: var(--ink); }
      .sheet-footer > span:nth-child(3) { justify-content: flex-end; text-align: right; }
      .sheet-footer a { color: #4b5563; text-decoration: none; }
      @media (max-width: 760px) {
        main { padding: 12px; }
        .sheet { padding: 18px; }
        .assignment-image-grid { grid-template-columns: 1fr; }
        .sheet-footer > span:nth-child(3) { justify-content: flex-start; text-align: left; }
      }
      @media (max-width: 520px) {
        .sheet-header { grid-template-columns: 1fr; }
        .content-grid { grid-template-columns: 1fr; }
        .sheet-footer { grid-template-columns: 1fr; }
        .document-info, .logo-card { width: 100%; justify-self: stretch; }
        .logo-card { width: 110px; height: 84px; }
        .brand-title-lockup, .document-info h2 { justify-items: start; text-align: left; }
      }
      @media print {
        @page { size: letter; margin: .35in; }
        body { background: #fff; }
        main { width: 100%; padding: 0; }
        .sheet { border: 0; box-shadow: none; padding: 18px; }
        .logo-card { width: 110px !important; height: 84px !important; overflow: hidden !important; }
        .logo-card img, .assignment-logo { width: 110px !important; max-width: 110px !important; height: 84px !important; max-height: 84px !important; object-fit: contain !important; }
      }
    </style>
  </head>
  <body>
    <main>
      <article class="sheet">
        <header class="sheet-header">
          <div class="logo-card"><img class="assignment-logo" src="${escapeHtml(logoUrl)}" width="110" height="84" alt="D2 Carpentry and Design logo"></div>
          <div class="brand-title-lockup">
            <h1>${escapeHtml($("companyName").value || COMPANY_DEFAULTS.name)}</h1>
            <p>-Crafting Your Vision One Nail At A Time-</p>
          </div>
          <div class="document-info">
            <h2>${escapeHtml(labels.pageTitle)}</h2>
          </div>
        </header>

        <section class="content-grid">
          <div class="card client-card">
            <span class="section-label">${escapeHtml(labels.clientInfo)}</span>
            <strong>${escapeHtml(clientName)}</strong>
            ${clientPhone ? `<p><a href="${escapeHtml(phoneHref($("clientPhone").value || ""))}">${escapeHtml(clientPhone)}</a></p>` : ""}
            ${clientEmail ? `<p><a href="${escapeHtml(emailHref(clientEmail))}">${escapeHtml(clientEmail)}</a></p>` : ""}
            ${projectAddress ? `<p><a href="${escapeHtml(assignmentMapHref)}" target="_blank" rel="noopener">${escapeHtml(projectAddress)}</a></p>` : ""}
          </div>
          <div class="card schedule-card">
            <span class="section-label">${escapeHtml(labels.schedule)}</span>
            <div>
              <small>${escapeHtml(labels.projectNumber)}</small>
              <strong>${escapeHtml(estimateNumber || labels.open)}</strong>
            </div>
            <div>
              <small>${escapeHtml(labels.dateToStart)}</small>
              <strong>${escapeHtml(startDate || labels.open)}</strong>
            </div>
            <div>
              <small>${escapeHtml(labels.expectedArrival)}</small>
              <strong>${escapeHtml(displayArrivalTime)}</strong>
            </div>
          </div>
        </section>

        <section class="card scope-card">
          <span class="section-label">${escapeHtml(labels.workScope)}</span>
          ${buildAssignmentScopeHtml()}
        </section>

        <section class="card notes-card">
          <span class="section-label">${escapeHtml(labels.employeeNotes)}</span>
          ${assignmentNotes ? `<p>${escapeHtml(assignmentNotes)}</p>` : `<div class="blank-box"></div>`}
        </section>

        ${assignmentPhotosHtml ? `<section class="card image-card">
          <span class="section-label">${escapeHtml(labels.assignmentImages)}</span>
          ${assignmentPhotosHtml}
        </section>` : ""}

        <footer class="sheet-footer">
          <span class="footer-contact"><strong>${escapeHtml(labels.office)}</strong> <a href="${escapeHtml(phoneHref(companyPhone))}">${escapeHtml(formatPhone(companyPhone))}</a></span>
          <span class="footer-contact"><strong>${escapeHtml(labels.email)}</strong> <a href="${escapeHtml(emailHref(companyEmail))}">${escapeHtml(companyEmail)}</a></span>
          <span class="footer-contact"><strong>${escapeHtml(labels.address)}</strong> <span>${formatPaymentAddressHtml(companyAddress)}</span></span>
        </footer>
      </article>
    </main>
  </body>
</html>`;
}

function showAssignmentSheetPreview(html) {
  const preview = $("assignmentSheetPreview");
  const frame = $("assignmentSheetFrame");
  frame.style.display = "block";
  frame.style.width = "100%";
  frame.style.minHeight = "820px";
  frame.srcdoc = html;
  preview.hidden = false;
  preview.scrollIntoView({ behavior: "smooth", block: "start" });
}

function generateAssignmentSheet() {
  updatePreview();
  showAssignmentSheetPreview(buildAssignmentSheetHtml());
  $("submitStatus").textContent = "Assignment sheet is ready below.";
}

function generateAssignmentSheetLanguage(language) {
  $("assignmentLanguage").value = language;
  generateAssignmentSheet();
}

function printAssignmentSheet() {
  generateAssignmentPdf().catch(() => printAssignmentSheetFallback());
}

function printAssignmentSheetFallback() {
  const frame = $("assignmentSheetFrame");
  if (!frame.srcdoc) {
    generateAssignmentSheet();
    return;
  }
  if (frame.contentWindow) frame.contentWindow.print();
}

function printHtmlDocument(html) {
  let frame = document.getElementById("dedicatedPrintFrame");
  if (!frame) {
    frame = document.createElement("iframe");
    frame.id = "dedicatedPrintFrame";
    frame.title = "Dedicated print preview";
    frame.style.position = "fixed";
    frame.style.width = "1px";
    frame.style.height = "1px";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.opacity = "0";
    frame.style.pointerEvents = "none";
    frame.setAttribute("aria-hidden", "true");
    document.body.appendChild(frame);
  }
  frame.onload = () => {
    if (frame.contentWindow) frame.contentWindow.print();
  };
  frame.srcdoc = html;
}

function getJsPdf() {
  const root = window.jspdf || globalThis.jspdf || self.jspdf;
  return root && root.jsPDF ? root.jsPDF : null;
}

function getHtml2Canvas() {
  return window.html2canvas || globalThis.html2canvas || self.html2canvas || null;
}

function loadPdfScript(src, globalCheck) {
  return new Promise((resolve, reject) => {
    if (globalCheck()) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = `${src}${src.includes("?") ? "&" : "?"}reload=${Date.now()}`;
    script.onload = () => {
      if (globalCheck()) resolve();
      else reject(new Error(`${src} loaded but was not available.`));
    };
    script.onerror = () => reject(new Error(`${src} could not be loaded.`));
    document.head.appendChild(script);
  });
}

async function ensurePdfLibraries() {
  if (!getJsPdf()) {
    await loadPdfScript("vendor/jspdf.umd.min.js", () => Boolean(getJsPdf()));
  }
  if (!getHtml2Canvas()) {
    await loadPdfScript("vendor/html2canvas.min.js", () => Boolean(getHtml2Canvas()));
  }
  return Boolean(getJsPdf() && getHtml2Canvas());
}

function getPdfFileName(label) {
  const client = fileSafeName($("clientName").value) || "Client";
  const estimateNumber = fileSafeName($("estimateNumber").value) || "Estimate";
  return `${client} - ${estimateNumber} ${label}.pdf`;
}

function waitForPdfFrameAssets(frameDocument) {
  const imagePromises = Array.from(frameDocument.images).map((image) => {
    if (image.complete) return Promise.resolve();
    return new Promise((resolve) => {
      image.onload = resolve;
      image.onerror = resolve;
    });
  });
  const fontPromise = frameDocument.fonts && frameDocument.fonts.ready ? frameDocument.fonts.ready.catch(() => {}) : Promise.resolve();
  return Promise.all([fontPromise, ...imagePromises]);
}

function waitForPdfHostAssets(host) {
  const imagePromises = Array.from(host.querySelectorAll("img")).map((image) => {
    if (image.complete) return Promise.resolve();
    return new Promise((resolve) => {
      image.onload = resolve;
      image.onerror = resolve;
    });
  });
  return Promise.all(imagePromises);
}

function createPdfRenderFrame(html) {
  return new Promise((resolve) => {
    const frame = document.createElement("iframe");
    frame.title = "PDF render source";
    frame.style.position = "fixed";
    frame.style.left = "-10000px";
    frame.style.top = "0";
    frame.style.width = "900px";
    frame.style.height = "1200px";
    frame.style.opacity = "0";
    frame.style.pointerEvents = "none";
    frame.setAttribute("aria-hidden", "true");
    frame.onload = async () => {
      await waitForPdfFrameAssets(frame.contentDocument);
      resolve(frame);
    };
    document.body.appendChild(frame);
    frame.srcdoc = html;
  });
}

async function createPdfRenderHost(html, sourceSelector) {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(html, "text/html");
  const host = document.createElement("div");
  host.className = "pdf-render-host";
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "0";
  host.style.width = "900px";
  host.style.background = "#ffffff";
  host.style.zIndex = "-1";
  host.style.pointerEvents = "none";
  host.setAttribute("aria-hidden", "true");

  parsed.querySelectorAll("style, link[rel='stylesheet']").forEach((node) => {
    host.appendChild(node.cloneNode(true));
  });
  Array.from(parsed.body.children).forEach((node) => {
    host.appendChild(node.cloneNode(true));
  });
  document.body.appendChild(host);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  await waitForPdfHostAssets(host);
  return {
    host,
    source: host.querySelector(sourceSelector) || host,
  };
}

async function createPdfRenderClone(sourceElement) {
  const host = document.createElement("div");
  host.className = "pdf-render-host";
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "0";
  host.style.width = `${sourceElement.getBoundingClientRect().width || 760}px`;
  host.style.background = "#ffffff";
  host.style.zIndex = "-1";
  host.style.pointerEvents = "none";
  host.setAttribute("aria-hidden", "true");
  host.appendChild(sourceElement.cloneNode(true));
  document.body.appendChild(host);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  await waitForPdfHostAssets(host);
  return {
    host,
    source: host.firstElementChild,
  };
}

async function generateVisualPdfFromHtml(html, fileName, sourceSelector) {
  await ensurePdfLibraries().catch(() => {});
  const JsPdf = getJsPdf();
  const html2canvas = getHtml2Canvas();
  if (!JsPdf || !html2canvas) {
    printHtmlDocument(html);
    return false;
  }

  const { host, source } = await createPdfRenderHost(html, sourceSelector);
  try {
    const sourceRect = source.getBoundingClientRect();
    const canvas = await html2canvas(source, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      windowWidth: Math.ceil(source.scrollWidth || sourceRect.width),
      windowHeight: Math.ceil(source.scrollHeight || sourceRect.height),
    });

    const doc = new JsPdf({ unit: "mm", format: "letter" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 8.9;
    const imageWidth = pageWidth - margin * 2;
    const imageHeight = (canvas.height * imageWidth) / canvas.width;
    const pageImageHeight = pageHeight - margin * 2;
    const pageCanvasHeight = Math.floor((pageImageHeight * canvas.width) / imageWidth);
    const pageCount = Math.max(1, Math.ceil(canvas.height / pageCanvasHeight));
    const links = Array.from(source.querySelectorAll("a[href]"))
      .map((anchor) => {
        const href = anchor.getAttribute("href");
        if (!href || href === "#") return null;
        const rect = anchor.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        return {
          href: anchor.href || href,
          x: ((rect.left - sourceRect.left) * imageWidth) / sourceRect.width,
          y: ((rect.top - sourceRect.top) * imageWidth) / sourceRect.width,
          width: (rect.width * imageWidth) / sourceRect.width,
          height: (rect.height * imageWidth) / sourceRect.width,
        };
      })
      .filter(Boolean);

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
      if (pageIndex > 0) doc.addPage("letter");
      const sliceY = pageIndex * pageCanvasHeight;
      const sliceHeight = Math.min(pageCanvasHeight, canvas.height - sliceY);
      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = sliceHeight;
      const context = sliceCanvas.getContext("2d");
      context.drawImage(canvas, 0, sliceY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
      const sliceImageHeight = (sliceHeight * imageWidth) / canvas.width;
      doc.addImage(sliceCanvas.toDataURL("image/png"), "PNG", margin, margin, imageWidth, sliceImageHeight, undefined, "FAST");

      links.forEach((link) => {
        const pageTop = pageIndex * pageImageHeight;
        const pageBottom = pageTop + pageImageHeight;
        if (link.y + link.height < pageTop || link.y > pageBottom) return;
        doc.link(margin + link.x, margin + link.y - pageTop, link.width, link.height, { url: link.href });
      });
    }

    doc.save(fileName);
    return true;
  } finally {
    host.remove();
  }
}

async function generateVisualPdfFromElement(sourceElement, fileName) {
  await ensurePdfLibraries().catch(() => {});
  const JsPdf = getJsPdf();
  const html2canvas = getHtml2Canvas();
  if (!JsPdf || !html2canvas) {
    const label = COPY_MODE_LABELS[document.body.dataset.copyMode || "customer"] || "Customer";
    printHtmlDocument(buildEstimateHtmlCopy(label));
    return false;
  }

  const { host, source } = await createPdfRenderClone(sourceElement);
  try {
    const sourceRect = source.getBoundingClientRect();
    const canvas = await html2canvas(source, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      windowWidth: Math.ceil(source.scrollWidth || sourceRect.width),
      windowHeight: Math.ceil(source.scrollHeight || sourceRect.height),
    });

    const doc = new JsPdf({ unit: "mm", format: "letter" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 8.9;
    const imageWidth = pageWidth - margin * 2;
    const imageHeight = (canvas.height * imageWidth) / canvas.width;
    doc.addImage(canvas.toDataURL("image/png"), "PNG", margin, margin, imageWidth, imageHeight, undefined, "FAST");

    Array.from(source.querySelectorAll("a[href]")).forEach((anchor) => {
      const href = anchor.getAttribute("href");
      if (!href || href === "#") return;
      const rect = anchor.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      doc.link(
        margin + ((rect.left - sourceRect.left) * imageWidth) / sourceRect.width,
        margin + ((rect.top - sourceRect.top) * imageWidth) / sourceRect.width,
        (rect.width * imageWidth) / sourceRect.width,
        (rect.height * imageWidth) / sourceRect.width,
        { url: anchor.href || href }
      );
    });

    doc.save(fileName);
    return true;
  } finally {
    host.remove();
  }
}

async function getLogoDataUrl() {
  const image = new Image();
  image.src = new URL("assets/d2-logo.png", window.location.href).href;
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
  });
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || 400;
  canvas.height = image.naturalHeight || 300;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);
  return canvas.toDataURL("image/png");
}

function addPdfWrappedText(doc, text, x, y, width, options = {}) {
  const lineHeight = options.lineHeight || 5;
  const lines = doc.splitTextToSize(String(text || ""), width);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function addPdfLinkText(doc, text, x, y, url, options = {}) {
  const value = String(text || "");
  if (!value) return y;
  if (url) {
    doc.textWithLink(value, x, y, { url });
  } else {
    doc.text(value, x, y);
  }
  return y + (options.lineHeight || 5);
}

function drawPdfCard(doc, x, y, width, height) {
  doc.setDrawColor(215, 220, 229);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(x, y, width, height, 2, 2, "FD");
}

function addPdfPageIfNeeded(doc, y, neededHeight = 24) {
  if (y + neededHeight <= 270) return y;
  addPdfFooter(doc);
  doc.addPage("letter");
  return 18;
}

async function addPdfHeader(doc, title) {
  const blue = [13, 74, 145];
  const logo = await getLogoDataUrl().catch(() => "");
  if (logo) doc.addImage(logo, "PNG", 14, 12, 32, 24);
  doc.setTextColor(...blue);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text($("companyName").value || COMPANY_DEFAULTS.name, 52, 22);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text("-Crafting Your Vision One Nail At A Time-", 52, 28);
  doc.setTextColor(...blue);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(title, 196, 22, { align: "right" });
  doc.setDrawColor(...blue);
  doc.setLineWidth(1.4);
  doc.line(14, 42, 196, 42);
}

function addPdfFooter(doc) {
  const y = 282;
  const companyPhone = $("companyPhone").value || COMPANY_DEFAULTS.phone;
  const companyEmail = $("companyEmail").value || COMPANY_DEFAULTS.email;
  const companyAddress = normalizeCompanyAddress($("companyAddress").value || COMPANY_DEFAULTS.address);
  doc.setDrawColor(215, 220, 229);
  doc.line(14, y - 7, 196, y - 7);
  doc.setFontSize(7);
  doc.setTextColor(75, 85, 99);
  doc.setFont("helvetica", "bold");
  doc.text("Office:", 14, y);
  doc.setFont("helvetica", "normal");
  doc.textWithLink(formatPhone(companyPhone), 26, y, { url: phoneHref(companyPhone) });
  doc.setFont("helvetica", "bold");
  doc.text("Email:", 62, y);
  doc.setFont("helvetica", "normal");
  doc.textWithLink(companyEmail, 74, y, { url: emailHref(companyEmail) });
  doc.setFont("helvetica", "bold");
  doc.text("Address:", 128, y);
  doc.setFont("helvetica", "normal");
  doc.text(companyAddress, 144, y, { maxWidth: 50 });
}

function addPdfClientCard(doc, x, y, width, height) {
  const clientPhone = formatPhone($("clientPhone").value);
  const clientEmail = $("clientEmail").value.trim();
  const projectAddress = $("projectAddress").value.trim();
  drawPdfCard(doc, x, y, width, height);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(13, 74, 145);
  doc.text("CLIENT INFORMATION", x + 5, y + 7);
  doc.setFontSize(11);
  doc.setTextColor(32, 33, 36);
  doc.text($("clientName").value || "Client", x + 5, y + 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(55, 65, 81);
  let nextY = y + 23;
  nextY = addPdfLinkText(doc, clientPhone, x + 5, nextY, phoneHref($("clientPhone").value));
  nextY = addPdfLinkText(doc, clientEmail, x + 5, nextY, emailHref(clientEmail));
  addPdfLinkText(doc, projectAddress, x + 5, nextY, mapHref(projectAddress));
}

function addPdfPhotos(doc, photos, startY, title) {
  if (!photos.length) return startY;
  let y = addPdfPageIfNeeded(doc, startY, 78);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(13, 74, 145);
  doc.text(title.toUpperCase(), 14, y);
  y += 7;
  let x = 14;
  photos.forEach((photo, index) => {
    y = addPdfPageIfNeeded(doc, y, 68);
    x = index % 2 === 0 ? 14 : 106;
    if (index % 2 === 0 && index > 0) y += 62;
    y = addPdfPageIfNeeded(doc, y, 68);
    doc.setDrawColor(215, 220, 229);
    doc.roundedRect(x, y, 84, 55, 2, 2, "S");
    try {
      doc.addImage(photo.dataUrl, "JPEG", x + 2, y + 2, 80, 43, undefined, "FAST");
    } catch (error) {
      try {
        doc.addImage(photo.dataUrl, "PNG", x + 2, y + 2, 80, 43, undefined, "FAST");
      } catch (_error) {
        doc.text("Image attached", x + 5, y + 24);
      }
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(75, 85, 99);
    doc.text(String(photo.label || photo.name || "Photo"), x + 3, y + 51, { maxWidth: 78 });
  });
  return y + 66;
}

async function generateEstimatePdf() {
  ensureEstimateNumber();
  updatePreview();
  const sheet = $("estimateSheet");
  if (!sheet) {
    throw new Error("The estimate preview is not ready yet. Refresh the estimate and try PDF again.");
  }
  return generateVisualPdfFromElement(sheet, getPdfFileName("Estimate"));
}

async function generateAssignmentPdf() {
  ensureEstimateNumber();
  updatePreview();
  const labels = getAssignmentLabels();
  await generateVisualPdfFromHtml(buildAssignmentSheetHtml(), getPdfFileName(labels.pageTitle), ".sheet");
}

async function generatePaymentPdf() {
  ensureEstimateNumber();
  updatePreview();
  await generateVisualPdfFromHtml(buildPaymentInvoiceHtml(), getPdfFileName("Payment Invoice"), ".invoice-sheet");
}

async function printEstimateCopy(options = {}) {
  if (!options.userRequested) return;
  ensureEstimateNumber();
  updatePreview();
  setSubmitStatus("Browser print preview opened. Choose Save as PDF to rename and save.");
  window.print();
}

function buildEstimateEmailBody() {
  ensureEstimateNumber();
  updatePreview();
  const totals = calculateTotals();
  const firstName = ($("clientName").value || "there").trim().split(/\s+/)[0] || "there";
  const lines = [
    `Hi ${firstName},`,
    "",
    "Thank you for giving D2 Carpentry & Design the opportunity to review your project.",
    "",
    `Estimate #: ${$("estimateNumber").value || ""}`,
    `Date: ${$("estimateDate").value ? formatDate($("estimateDate").value) : ""}`,
    `Total: ${currency.format(totals.total)}`,
    "",
    "Estimate details:",
  ];
  state.lineItems.forEach((item) => {
    const name = String(item.name || "").trim();
    if (!name) return;
    const qty = Number.parseFloat(item.qty);
    const price = Number.parseFloat(item.price);
    if (item.type === "subline") {
      lines.push(`  - ${name}`);
      return;
    }
    const amount = Number.isFinite(qty) && Number.isFinite(price) && qty > 0 && price > 0
      ? ` - ${currency.format(qty * price * totals.finishMultiplier)}`
      : "";
    lines.push(`- ${name}${amount}`);
  });
  const notes = $("notes").value.trim();
  const additionalNotes = $("additionalNotes").value.trim();
  if (notes) lines.push("", "Notes:", notes);
  if (additionalNotes) lines.push("", additionalNotes);
  lines.push("", "Please let me know if you have any questions.", "", "David", "D2 Carpentry & Design");
  return lines.join("\n");
}

function emailEstimateCopy() {
  const clientEmail = $("clientEmail").value.trim();
  const estimateNumber = $("estimateNumber").value.trim();
  const subject = `Estimate - D2 Carpentry & Design${estimateNumber ? ` ${estimateNumber}` : ""}`;
  const body = buildEstimateEmailBody();
  const href = `mailto:${encodeURIComponent(clientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = href;
  setSubmitStatus("Email draft opened in your mail app. Attach the saved PDF if needed.");
}

function closeShareMenus() {
  document.querySelectorAll(".share-options").forEach((menu) => {
    menu.hidden = true;
    const toggle = menu.parentElement?.querySelector("[data-share-toggle], #shareEstimate");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
  });
}

function closeEstimateActionMenu() {
  const toolbar = document.querySelector(".toolbar-strip");
  const button = $("estimateActionsMenuButton");
  if (!toolbar || !button) return;
  toolbar.classList.remove("menu-open");
  button.setAttribute("aria-expanded", "false");
}

function toggleEstimateActionMenu(event) {
  event.stopPropagation();
  const toolbar = document.querySelector(".toolbar-strip");
  const button = $("estimateActionsMenuButton");
  if (!toolbar || !button) return;
  const isOpen = toolbar.classList.toggle("menu-open");
  button.setAttribute("aria-expanded", String(isOpen));
}

function toggleShareMenu(button) {
  const menu = button.parentElement?.querySelector(".share-options");
  if (!menu) return;
  const willOpen = menu.hidden;
  closeShareMenus();
  menu.hidden = !willOpen;
  button.setAttribute("aria-expanded", String(willOpen));
}

function toggleCollapsiblePanel(button) {
  const target = $(button.dataset.collapseTarget);
  if (!target) return;
  const willOpen = target.hidden;
  target.hidden = !willOpen;
  button.setAttribute("aria-expanded", String(willOpen));
  button.textContent = willOpen ? "Hide" : button.dataset.collapseTarget === "estimateDetailsBody" ? "Details" : "Show";
  const panel = button.closest(".collapsible-panel");
  if (panel) panel.classList.toggle("collapsed", !willOpen);
}

function serializeEstimate() {
  const totals = calculateTotals();
  const data = {
    fileType: "D2_ESTIMATE_EDITABLE",
    fileVersion: 1,
    lineItems: state.lineItems,
    materialItems: state.materialItems,
    photos: state.photos,
    assignmentPhotos: state.assignmentPhotos,
    totals,
    backend: {
      estimatedMaterialCost: calculateMaterialCost(),
      fallbackMaterialCost: totals.total * MATERIAL_PERCENT,
      estimatedGrossProfit: totals.total - calculateMaterialCost(),
      materialPercent: MATERIAL_PERCENT * 100,
    },
    dashboardFileId: state.dashboardFileId || "",
    supplementFor: state.supplementFor || "",
    supplementId: state.supplementId || "",
    submittedAt: new Date().toISOString(),
  };
  fields.forEach((field) => {
    data[field] = $(field).value;
  });
  data.taxEnabled = $("taxEnabled") ? $("taxEnabled").checked : false;
  data.showEstimateNumber = $("showEstimateNumber").checked;
  data.useSpanishScope = $("useSpanishScope").checked;
  data.addFooterValueNote = $("addFooterValueNote").checked;
  data.invoicePaid = state.invoicePaid === true;
  return data;
}

function fileSafeName(value) {
  return String(value || "")
    .trim()
    .replace(/[\\/:*?"<>|#%{}~&]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

function getEditableEstimateFileName() {
  const client = fileSafeName($("clientName").value) || "Unnamed Client";
  const estimateNumber = fileSafeName($("estimateNumber").value) || "Estimate";
  return `${client} - ${estimateNumber}.d2estimate`;
}

function createEditableDownloadLink(blob, fileName) {
  if (editableDownloadUrl) URL.revokeObjectURL(editableDownloadUrl);
  editableDownloadUrl = URL.createObjectURL(blob);
  const status = $("submitStatus");
  status.innerHTML = "";
  const message = document.createElement("span");
  message.textContent = "Editable estimate is ready. ";
  const link = document.createElement("a");
  link.href = editableDownloadUrl;
  link.download = fileName;
  link.textContent = "Download editable file";
  link.style.fontWeight = "900";
  link.style.color = "var(--pine)";
  status.appendChild(message);
  status.appendChild(link);
  return link;
}

function loadLocalDashboardFiles() {
  try {
    return JSON.parse(localStorage.getItem(DASHBOARD_STORAGE_KEY) || "[]");
  } catch (error) {
    return [];
  }
}

function saveLocalDashboardFiles(files) {
  try {
    localStorage.setItem(DASHBOARD_STORAGE_KEY, JSON.stringify(files));
    return true;
  } catch (error) {
    return false;
  }
}

function makeDashboardNote(text) {
  return text ? [{ at: new Date().toISOString(), text }] : [];
}

function saveEstimateToLocalDashboard(payloadData) {
  const totals = payloadData.totals || {};
  const backend = payloadData.backend || {};
  const fileNumber = payloadData.estimateNumber || `D2-${Date.now()}`;
  const files = loadLocalDashboardFiles();
  const existingIndex = files.findIndex((file) => {
    return (payloadData.dashboardFileId && file.id === payloadData.dashboardFileId)
      || file.fileNumber === fileNumber;
  });
  const existing = existingIndex >= 0 ? files[existingIndex] : {};
  const importedAt = new Date().toISOString();
  const dashboardFile = {
    ...existing,
    id: existing.id || payloadData.dashboardFileId || `file-${Date.now()}`,
    fileNumber,
    clientName: payloadData.clientName || "Unnamed Client",
    clientPhone: payloadData.clientPhone || "",
    clientEmail: payloadData.clientEmail || "",
    projectAddress: payloadData.projectAddress || "",
    leadSource: payloadData.leadSource || existing.leadSource || "Manual",
    fileStatus: payloadData.fileStatus || existing.fileStatus || "Inspection Completed",
    statusDetail: payloadData.statusDetail || existing.statusDetail || "Estimate Pending",
    projectType: normalizeProjectType(payloadData.projectType),
    inspectionDate: payloadData.inspectionDate || existing.inspectionDate || "",
    inspectionTime: payloadData.inspectionTime || existing.inspectionTime || "",
    startDate: payloadData.assignmentStartDate || existing.startDate || "",
    arrivalWindow: payloadData.assignmentArrivalTime || existing.arrivalWindow || "Open",
    nextAction: payloadData.nextAction || existing.nextAction || "",
    nextActionDate: payloadData.nextActionDate || existing.nextActionDate || "",
    warrantyStatus: payloadData.warrantyStatus || existing.warrantyStatus || "Not Sent",
    estimateTotal: Number(totals.total) || 0,
    depositTotal: Number(totals.deposit) || 0,
    materialTotal: Number(backend.estimatedMaterialCost) || 0,
    invoicePaid: payloadData.invoicePaid === true ? "Yes" : existing.invoicePaid || "No",
    paidInFull: payloadData.invoicePaid === true ? "Yes" : existing.paidInFull || "No",
    editableEstimate: payloadData,
    notes: Array.isArray(existing.notes) && existing.notes.length
      ? existing.notes
      : makeDashboardNote(payloadData.notes || ""),
    timeline: [
      ...(Array.isArray(existing.timeline) ? existing.timeline : []),
      existingIndex >= 0 ? `Estimate saved from Estimator ${formatDateTimeForDashboard(importedAt)}` : `Estimate imported ${formatDateTimeForDashboard(importedAt)}`,
    ],
  };

  if (existingIndex >= 0) {
    files[existingIndex] = dashboardFile;
  } else {
    files.unshift(dashboardFile);
  }
  return saveLocalDashboardFiles(files);
}

function dashboardFileExistsForEstimate(payloadData) {
  const fileNumber = payloadData.estimateNumber || "";
  return loadLocalDashboardFiles().some((file) => {
    return (payloadData.dashboardFileId && file.id === payloadData.dashboardFileId)
      || (fileNumber && file.fileNumber === fileNumber);
  });
}

function syncEstimateToLinkedDashboard(payloadData) {
  if (payloadData?.supplementFor && payloadData?.supplementId) return false;
  if (!payloadData || (!payloadData.dashboardFileId && !dashboardFileExistsForEstimate(payloadData))) return false;
  return saveEstimateToLocalDashboard(payloadData);
}

function buildDashboardEstimatePayload() {
  ensureEstimateNumber();
  if (!$("estimateDate").value) {
    $("estimateDate").value = new Date().toISOString().slice(0, 10);
  }
  if (!$("fileStatus").value) $("fileStatus").value = "New Lead";
  if (!$("estimateStatus").value) $("estimateStatus").value = "Pending";
  if (!$("leadSource").value) $("leadSource").value = "Manual";
  updatePreview();
  const payloadData = serializeEstimate();
  payloadData.copies = buildSubmittedCopies();
  return payloadData;
}

function postEstimatePayloadToGoogle(payloadData) {
  const googleScriptUrl = getGoogleScriptUrl() || requestGoogleScriptUrl();
  if (!googleScriptUrl) return Promise.resolve(false);

  const body = new FormData();
  body.append("payload", JSON.stringify(payloadData));
  fetch(googleScriptUrl, {
    method: "POST",
    mode: "no-cors",
    keepalive: true,
    body,
  }).catch(() => {});
  return Promise.resolve(true);
}

function showDashboardImportStatus(message, includeDashboardLink = false) {
  const status = $("submitStatus");
  status.innerHTML = "";
  const span = document.createElement("span");
  span.textContent = message;
  status.appendChild(span);
  if (includeDashboardLink) {
    status.appendChild(document.createTextNode(" "));
    const link = document.createElement("a");
    link.href = "crm.html";
    link.textContent = "Open Dashboard";
    link.style.fontWeight = "900";
    link.style.color = "var(--pine)";
    status.appendChild(link);
  }
}

function dashboardLeadUrl(estimateNumber) {
  const url = new URL("crm.html", window.location.href);
  url.searchParams.set("file", estimateNumber || $("estimateNumber").value || "");
  return url.toString();
}

function openDashboardLead(estimateNumber) {
  const target = dashboardLeadUrl(estimateNumber);
  const opened = window.open(target, "_blank", "noopener");
  if (!opened) {
    const status = $("submitStatus");
    status.appendChild(document.createTextNode(" "));
    const link = document.createElement("a");
    link.href = target;
    link.textContent = "Open lead";
    link.target = "_blank";
    link.rel = "noopener";
    link.style.fontWeight = "900";
    link.style.color = "var(--pine)";
    status.appendChild(link);
  }
}

async function importEstimateToDashboard() {
  const importButton = $("submitEstimate");
  if (importButton) importButton.textContent = "Importing...";
  saveEstimate({ silent: true });
  const payloadData = buildDashboardEstimatePayload();
  const savedLocally = saveEstimateToLocalDashboard(payloadData);
  const postedToGoogle = await postEstimatePayloadToGoogle(payloadData);

  if (importButton) {
    importButton.textContent = "Imported";
    setTimeout(() => {
      importButton.textContent = "Create Lead";
    }, 1400);
  }

  if (savedLocally && postedToGoogle) {
    showDashboardImportStatus(`Imported ${payloadData.estimateNumber} to Dashboard and sent it to Google Drive.`, true);
  } else if (savedLocally) {
    showDashboardImportStatus(`Imported ${payloadData.estimateNumber} to the local Dashboard. Google Drive sync is not connected on this device.`, true);
  } else if (postedToGoogle) {
    showDashboardImportStatus(`Sent ${payloadData.estimateNumber} to Google Drive, but this browser blocked local Dashboard storage.`, true);
  } else {
    showDashboardImportStatus("Dashboard import could not be completed. Check browser storage and the Google Drive connection.");
  }
  if (savedLocally) openDashboardLead(payloadData.estimateNumber);
}

function formatDateTimeForDashboard(value) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function downloadEditableEstimate() {
  ensureEstimateNumber();
  updatePreview();
  const estimate = serializeEstimate();
  const fileName = getEditableEstimateFileName();
  const estimateText = JSON.stringify(estimate, null, 2);
  if (!estimateText || estimateText.length < 10) {
    window.alert("The editable estimate file could not be prepared. Please try again.");
    return;
  }
  const blob = new Blob([estimateText], { type: "application/octet-stream" });
  const syncedToDashboard = syncEstimateToLinkedDashboard(estimate);

  try {
    const link = createEditableDownloadLink(blob, fileName);
    link.click();
    if (syncedToDashboard) {
      $("submitStatus").appendChild(document.createTextNode(" Dashboard file updated."));
    }
  } catch (error) {
    window.alert("The editable estimate file is ready, but this browser blocked the automatic download. Use the download link shown near the Notes/Adjustments area.");
  }
}

function applyEstimateData(data) {
  if (!data || typeof data !== "object") return false;
  const looksLikeEstimate =
    data.fileType === "D2_ESTIMATE_EDITABLE" ||
    Array.isArray(data.lineItems) ||
    data.estimateNumber !== undefined ||
    data.clientName !== undefined;
  if (!looksLikeEstimate) return false;
  fields.forEach((field) => {
    if (data[field] !== undefined) $(field).value = data[field];
  });
  if (!$("taxType").value) $("taxType").value = "percent";
  if ($("taxEnabled")) $("taxEnabled").checked = data.taxEnabled === true || Boolean($("taxRate").value.trim());
  $("projectType").value = normalizeProjectType($("projectType").value);
  $("showEstimateNumber").checked = data.showEstimateNumber !== false;
  $("useSpanishScope").checked = data.useSpanishScope === true;
  $("addFooterValueNote").checked = data.addFooterValueNote === true || data.addFooterValueNote === "Yes" || data.addFooterValueNote === "on";
  state.dashboardFileId = data.dashboardFileId || "";
  state.supplementFor = data.supplementFor || "";
  state.supplementId = data.supplementId || "";
  refreshSupplementActions();
  state.invoicePaid = data.invoicePaid === true || data.invoicePaid === "Yes";
  $("invoicePaidCheckbox").checked = state.invoicePaid;
  applyCompanyDefaults();
  $("companyAddress").value = normalizeCompanyAddress($("companyAddress").value);
  state.autoEstimateNumber = !$("estimateNumber").value.trim();
  state.lineItems = Array.isArray(data.lineItems)
    ? data.lineItems.map((item) => ({ type: "item", ...item, name: cleanLineItemName(item.name) }))
    : [];
  state.materialItems = Array.isArray(data.materialItems)
    ? data.materialItems.map((item) => ({
        id: item.id || createId(),
        ...item,
        qty: item.qty === "" ? "" : wholeNumberValue(item.qty),
      }))
    : [];
  if (state.materialItems.length === 0) {
    state.materialItems = [{ id: createId(), name: "", qty: "", price: "", unit: "" }];
  }
  if (state.lineItems.length === 0) {
    state.lineItems = [{ id: createId(), type: "item", name: "", qty: "", price: "" }];
  }
  state.photos = Array.isArray(data.photos) ? data.photos : [];
  state.assignmentPhotos = Array.isArray(data.assignmentPhotos) ? data.assignmentPhotos : [];
  renderLineItems();
  renderMaterialItems();
  renderPhotos();
  renderAssignmentPhotos();
  syncProjectMode();
  updateCalculationPanel();
  updatePreview();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeEstimate()));
  } catch (error) {
    // Browser storage can be unavailable in some file previews.
  }
  return true;
}

function parseEditableEstimateText(text) {
  const raw = String(text || "").trim().replace(/^\uFEFF/, "");
  if (!raw) throw new Error("The file is empty.");
  if (raw.startsWith("%PDF")) {
    throw new Error("That is a PDF. Open the editable .d2estimate file instead.");
  }
  if (/^<!doctype html|^<html/i.test(raw)) {
    throw new Error("That is an estimate copy, not the editable estimate file.");
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(raw.slice(start, end + 1));
    }
    throw error;
  }
}

function openEditableEstimateFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const data = parseEditableEstimateText(reader.result);
      if (!applyEstimateData(data)) throw new Error("Invalid estimate file");
      $("submitStatus").textContent = "Editable estimate file opened.";
    } catch (error) {
      window.alert(`${error.message || "That file could not be opened."} Please choose the editable D2 estimate file saved with Save.`);
    }
  });
  reader.readAsText(file);
}

async function openEditableEstimatePicker() {
  if (window.showOpenFilePicker) {
    try {
      const [handle] = await window.showOpenFilePicker({
        multiple: false,
        types: [
          {
            description: "D2 editable estimate",
            accept: {
              "application/json": [".d2estimate", ".json"],
              "text/plain": [".txt"],
            },
          },
        ],
      });
      if (!handle) return;
      openEditableEstimateFile(await handle.getFile());
      return;
    } catch (error) {
      if (error && error.name === "AbortError") return;
    }
  }
  $("editableEstimateUpload").click();
}

function runButtonAction(action) {
  try {
    const result = action();
    if (result && typeof result.catch === "function") {
      result.catch((error) => {
        console.error(error);
        setSubmitStatus("That button hit a snag. Refresh the estimate and try again.");
      });
    }
  } catch (error) {
    console.error(error);
    setSubmitStatus("That button hit a snag. Refresh the estimate and try again.");
  }
}

function saveEstimate(options = {}) {
  const estimate = serializeEstimate();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(estimate));
  } catch (error) {
    // Some direct file previews block storage; PDF saving still works.
  }
  syncEstimateToLinkedDashboard(estimate);
  if (!options.silent) {
    $("saveEstimate").textContent = "Saved";
    setTimeout(() => {
      $("saveEstimate").textContent = "Save";
    }, 1000);
  }
}

function refreshSupplementActions() {
  const isSupplement = Boolean(state.supplementFor && state.supplementId);
  const saveButton = $("saveSupplementToWorkFile");
  const discardButton = $("discardSupplementDraft");
  if (saveButton) saveButton.hidden = !isSupplement;
  if (discardButton) discardButton.hidden = !isSupplement;
}

function saveSupplementToWorkFile() {
  if (!state.supplementFor || !state.supplementId) return;
  const estimate = serializeEstimate();
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(estimate)); } catch (error) { /* Local draft is optional. */ }
  if (window.parent !== window) {
    window.parent.postMessage({ type: "animus-supplement-saved", estimate }, window.location.origin === "null" ? "*" : window.location.origin);
    setSubmitStatus("Supplement saved to this work file.");
  } else {
    setSubmitStatus("This supplement is ready. Open it from its linked work file to save it there.");
  }
}

function discardSupplementDraft() {
  const fileId = state.supplementFor;
  if (!fileId) return;
  if (!window.confirm("Delete this unsaved supplement draft? It has not been added to the work file.")) return;
  if (window.parent !== window) {
    window.parent.postMessage({ type: "animus-supplement-discarded", fileId }, window.location.origin === "null" ? "*" : window.location.origin);
    return;
  }
  resetEstimate();
  setSubmitStatus("Supplement draft deleted.");
}

function generateEstimatePreview() {
  updatePreview();
  $("estimatePreview").scrollIntoView({ behavior: "smooth", block: "start" });
}

function toggleInvoicePaidStamp() {
  state.invoicePaid = !state.invoicePaid;
  $("invoicePaidCheckbox").checked = state.invoicePaid;
  saveDraftBeforeLeaving();
  updatePreview();
}

function setInvoicePaidStamp(checked) {
  state.invoicePaid = checked;
  $("invoicePaidCheckbox").checked = state.invoicePaid;
  saveDraftBeforeLeaving();
  updatePreview();
}

function createCrmFile() {
  ensureEstimateNumber();
  if (!$("estimateDate").value) {
    $("estimateDate").value = new Date().toISOString().slice(0, 10);
  }
  if (!$("fileStatus").value) $("fileStatus").value = "New Lead";
  if (!$("estimateStatus").value) $("estimateStatus").value = "Pending";
  if (!$("leadSource").value) $("leadSource").value = "Manual";
  $("submitStatus").textContent = `Dashboard file ${$("estimateNumber").value} is ready. When the estimate is finished, click Create Lead to send it to the Dashboard.`;
  updatePreview();
}

function hasWorkInProgress() {
  const changedFields = [
    "leadSource",
    "fileStatus",
    "estimateStatus",
    "warrantyStatus",
    "inspectionDate",
    "inspectionTime",
    "nextActionDate",
    "nextAction",
    "clientName",
    "clientPhone",
    "clientEmail",
    "projectAddress",
    "flatTotal",
    "discount",
    "depositRate",
    "notes",
    "additionalNotes",
    "addFooterValueNote",
    "assignmentLanguage",
    "assignmentStartDate",
    "assignmentArrivalTime",
    "assignmentScope",
    "assignmentScopeSpanish",
    "assignmentNotes",
  ];
  const hasFieldContent = changedFields.some((field) => $(field).value.trim());
  const hasLineContent = state.lineItems.some((item) => {
    return item.name.trim() || Number.parseFloat(item.qty) > 0 || Number.parseFloat(item.price) > 0;
  });
  const hasMaterialContent = state.materialItems.some((item) => {
    return item.name.trim() || Number.parseFloat(item.qty) > 0 || Number.parseFloat(item.price) > 0;
  });
  return hasFieldContent || hasLineContent || hasMaterialContent || state.photos.length > 0 || state.assignmentPhotos.length > 0;
}

function saveDraftBeforeLeaving() {
  if (!hasWorkInProgress()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeEstimate()));
  } catch (error) {
    // Closing/navigating browsers may block storage; the warning still protects the user.
  }
}

function warnBeforeLeaving(event) {
  saveDraftBeforeLeaving();
  return undefined;
}

function openFreshEstimateWindow() {
  const url = new URL(window.location.href);
  url.searchParams.set("new", Date.now());
  window.open(url.toString(), "_blank", "noopener");
}

async function startNewEstimate() {
  if (!hasWorkInProgress()) {
    resetEstimate();
    return;
  }

  const clearCurrent = window.confirm("Clear this estimate and start a fresh blank copy?");
  if (clearCurrent) {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      // Keep clearing the visible estimate even if browser storage is unavailable.
    }
    resetEstimate();
    return;
  }

  const saveFirst = window.confirm("Save this estimate as a PDF before opening a fresh estimate?");
  if (!saveFirst) return;

  saveEstimate({ silent: true });
  await printEstimateCopy({ userRequested: true });
  const openAfterSave = window.confirm("After saving/printing the PDF, open a fresh estimate in a new window?");
  if (openAfterSave) {
    openFreshEstimateWindow();
  }
}

async function submitEstimateToGoogle() {
  await importEstimateToDashboard();
}

function loadEstimate() {
  let saved = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    return false;
  }
  if (!saved) return false;

  let data = {};
  try {
    data = JSON.parse(saved);
  } catch (error) {
    return false;
  }
  return applyEstimateData(data);
}

function clearSavedEstimateDraft() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    // A fresh visible estimate still works even when browser storage is unavailable.
  }
}

function applyCompanyDefaults() {
  if (!$("companyName").value.trim()) $("companyName").value = COMPANY_DEFAULTS.name;
  if (!$("companyPhone").value.trim()) $("companyPhone").value = COMPANY_DEFAULTS.phone;
  if (!$("companyEmail").value.trim()) $("companyEmail").value = COMPANY_DEFAULTS.email;
  if (!$("companyAddress").value.trim()) $("companyAddress").value = COMPANY_DEFAULTS.address;
}

function syncProjectMode() {
  const isOther = $("projectType").value === "Other";
  document.querySelectorAll("[data-project-pricing]").forEach((element) => {
    element.hidden = isOther;
  });
  if ($("projectTypeOtherWrap")) $("projectTypeOtherWrap").hidden = !isOther;
}

function clearManualEstimate() {
  state.lineItems = [{ id: createId(), type: "item", name: "", qty: "", price: "" }];
  state.materialItems = [{ id: createId(), name: "", qty: "", price: "", unit: "" }];
  $("finishLevel").value = "";
  $("widthFeet").value = "";
  $("heightFeet").value = "";
  renderLineItems();
  renderMaterialItems();
  updatePreview();
}

function resetEstimate() {
  const today = new Date();
  $("estimateNumber").value = "";
  $("showEstimateNumber").checked = true;
  state.autoEstimateNumber = true;
  state.estimateNumberCommitted = false;
  $("estimateDate").value = todayInputValue();
  $("companyName").value = COMPANY_DEFAULTS.name;
  $("estimateTitle").value = "Estimate";
  $("companyPhone").value = COMPANY_DEFAULTS.phone;
  $("companyEmail").value = COMPANY_DEFAULTS.email;
  $("companyAddress").value = COMPANY_DEFAULTS.address;
  $("leadSource").value = "Manual";
  $("fileStatus").value = "New Lead";
  $("estimateStatus").value = "Pending";
  $("warrantyStatus").value = "Not Sent";
  $("inspectionDate").value = "";
  $("inspectionTime").value = "";
  $("nextActionDate").value = "";
  $("nextAction").value = "";
  $("clientName").value = "";
  $("clientPhone").value = "";
  $("clientEmail").value = "";
  $("projectAddress").value = "";
  $("projectType").value = "Other";
  if ($("projectTypeOther")) $("projectTypeOther").value = "";
  $("estimateNumber").value = "";
  $("finishLevel").value = "";
  $("widthFeet").value = "";
  $("heightFeet").value = "";
  $("linearFeet").value = "";
  $("linearRate").value = "500";
  $("squareLength").value = "";
  $("squareWidth").value = "";
  $("squareRate").value = "75";
  $("flatTotal").value = "";
  $("discount").value = "";
  $("discountType").value = "dollar";
  $("taxRate").value = "";
  $("taxType").value = "percent";
  if ($("taxEnabled")) $("taxEnabled").checked = false;
  $("depositRate").value = "";
  $("invoiceInitialDeposit").value = "";
  $("invoiceSecondDeposit").value = "";
  $("invoiceFinalPayment").value = "";
  $("invoicePaidCheckbox").checked = false;
  state.invoicePaid = false;
  $("notes").value = "";
  $("additionalNotes").value = "";
  $("addFooterValueNote").checked = false;
  $("assignmentLanguage").value = "en";
  $("assignmentStartDate").value = "";
  $("assignmentArrivalTime").value = "Open";
  $("assignmentScope").value = "";
  $("useSpanishScope").checked = false;
  $("assignmentScopeSpanish").value = "";
  $("assignmentNotes").value = "";
  state.lineItems = [{ id: createId(), type: "item", name: "", qty: "", price: "" }];
  state.materialItems = [{ id: createId(), name: "", qty: "", price: "", unit: "" }];
  state.photos = [];
  state.assignmentPhotos = [];
  state.dashboardFileId = "";
  state.supplementFor = "";
  state.supplementId = "";
  refreshSupplementActions();
  renderLineItems();
  renderMaterialItems();
  renderPhotos();
  renderAssignmentPhotos();
  syncProjectMode();
  applyInvoiceMode();
  updateCalculationPanel();
  updatePreview();
}

fields.forEach((field) => {
  $(field).addEventListener("input", updatePreview);
  $(field).addEventListener("change", updatePreview);
});

["linearFeet", "linearRate", "squareLength", "squareWidth", "squareRate"].forEach((field) => {
  $(field).addEventListener("input", updateCalculationPanel);
  $(field).addEventListener("change", updateCalculationPanel);
});

$("useLinearTotal").addEventListener("click", () => useCalculatedTotal("linear"));
$("useSquareTotal").addEventListener("click", () => useCalculatedTotal("square"));
if ($("createCrmFile")) $("createCrmFile").addEventListener("click", () => createCrmFile());
$("estimateNumber").addEventListener("input", () => {
  state.autoEstimateNumber = false;
  state.estimateNumberCommitted = false;
});

["companyPhone", "clientPhone"].forEach((field) => {
  $(field).addEventListener("input", (event) => {
    formatPhoneInput(event.target);
    updatePreview();
  });
  $(field).addEventListener("blur", (event) => formatPhoneInput(event.target));
});

$("addLineItem").addEventListener("click", () => addLineItem());
$("addMaterialItem").addEventListener("click", () => addMaterialItem());
if ($("addMaterialSalesTax")) {
  $("addMaterialSalesTax").addEventListener("click", () => {
    if ($("taxEnabled")) $("taxEnabled").checked = true;
    if (!$("taxRate").value.trim()) $("taxRate").value = "6.5";
    $("taxType").value = "percent";
    updatePreview();
  });
}
if ($("taxEnabled")) {
  $("taxEnabled").addEventListener("change", updatePreview);
}
if ($("taxRate")) {
  $("taxRate").addEventListener("input", () => {
    if ($("taxRate").value.trim() && $("taxEnabled")) $("taxEnabled").checked = true;
    updatePreview();
  });
}
$("photoUpload").addEventListener("change", (event) => {
  addPhotos(event.target.files);
  event.target.value = "";
});
$("photoDropzone").addEventListener("click", () => $("photoUpload").click());
$("photoDropzone").addEventListener("dragover", (event) => {
  event.preventDefault();
  $("photoDropzone").classList.add("drag-over");
});
$("photoDropzone").addEventListener("dragleave", () => {
  $("photoDropzone").classList.remove("drag-over");
});
$("photoDropzone").addEventListener("drop", (event) => {
  event.preventDefault();
  $("photoDropzone").classList.remove("drag-over");
  addPhotos(event.dataTransfer.files);
});
$("assignmentPhotoUpload").addEventListener("change", (event) => {
  addAssignmentPhotos(event.target.files);
  event.target.value = "";
});
$("assignmentPhotoDropzone").addEventListener("click", () => $("assignmentPhotoUpload").click());
$("assignmentPhotoDropzone").addEventListener("dragover", (event) => {
  event.preventDefault();
  $("assignmentPhotoDropzone").classList.add("drag-over");
});
$("assignmentPhotoDropzone").addEventListener("dragleave", () => {
  $("assignmentPhotoDropzone").classList.remove("drag-over");
});
$("assignmentPhotoDropzone").addEventListener("drop", (event) => {
  event.preventDefault();
  $("assignmentPhotoDropzone").classList.remove("drag-over");
  addAssignmentPhotos(event.dataTransfer.files);
});
$("projectType").addEventListener("change", () => {
  if ($("projectType").value === "Other") {
    clearManualEstimate();
  }
  refreshAutoEstimateNumber();
  syncProjectMode();
});
$("newEstimate").addEventListener("click", () => {
  closeEstimateActionMenu();
  runButtonAction(startNewEstimate);
});
$("saveEstimate").addEventListener("click", () => {
  closeEstimateActionMenu();
  runButtonAction(downloadEditableEstimate);
});
$("saveSupplementToWorkFile")?.addEventListener("click", saveSupplementToWorkFile);
$("discardSupplementDraft")?.addEventListener("click", discardSupplementDraft);
$("openEditableEstimate").addEventListener("click", () => {
  closeEstimateActionMenu();
  runButtonAction(openEditableEstimatePicker);
});
$("editableEstimateUpload").addEventListener("change", (event) => {
  openEditableEstimateFile(event.target.files[0]);
  event.target.value = "";
});
$("submitEstimate").addEventListener("click", () => {
  closeEstimateActionMenu();
  submitEstimateToGoogle().catch(() => {});
});
if ($("printEstimate")) {
  $("printEstimate").addEventListener("click", () => runButtonAction(() => printEstimateCopy({ userRequested: true })));
}
$("toggleInvoicePaidStamp").addEventListener("click", toggleInvoicePaidStamp);
$("invoicePaidCheckbox").addEventListener("change", (event) => setInvoicePaidStamp(event.target.checked));
$("printPaymentInvoice").addEventListener("click", () => printPaymentInvoice());
$("assignmentEnglish").addEventListener("click", () => generateAssignmentSheetLanguage("en"));
$("assignmentSpanish").addEventListener("click", () => generateAssignmentSheetLanguage("es"));
$("printAssignmentSheet").addEventListener("click", () => printAssignmentSheet());
window.addEventListener("pagehide", saveDraftBeforeLeaving);
document.querySelectorAll("[data-copy-mode]").forEach((button) => {
  button.addEventListener("click", () => showEstimateDocument(button.dataset.copyMode));
});
document.querySelectorAll("[data-document-view]").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.documentView === "payment") showPaymentDocument();
    if (button.dataset.documentView === "assignment") showAssignmentDocument();
  });
});
document.querySelectorAll("#documentViewSelect, [data-document-view-select]").forEach((select) => {
  select.addEventListener("change", () => {
    setDocumentView(select.value);
    closeEstimateActionMenu();
  });
});
document.querySelectorAll("#shareEstimate, [data-share-toggle]").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleShareMenu(button);
  });
});
document.querySelectorAll("[data-share-action]").forEach((button) => {
  button.addEventListener("click", () => {
    closeShareMenus();
    closeEstimateActionMenu();
    if (button.dataset.shareAction === "pdf") runButtonAction(() => printEstimateCopy({ userRequested: true }));
    if (button.dataset.shareAction === "email") runButtonAction(emailEstimateCopy);
  });
});
document.querySelectorAll("[data-collapse-target]").forEach((button) => {
  button.addEventListener("click", () => toggleCollapsiblePanel(button));
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".share-menu")) closeShareMenus();
  if (!event.target.closest(".toolbar-strip")) closeEstimateActionMenu();
});
$("estimateActionsMenuButton")?.addEventListener("click", toggleEstimateActionMenu);
document.querySelectorAll("[data-action-button]").forEach((button) => {
  button.addEventListener("click", () => {
    const action = button.dataset.actionButton;
    if (action === "new") runButtonAction(startNewEstimate);
    if (action === "save") runButtonAction(downloadEditableEstimate);
    if (action === "open-file") runButtonAction(openEditableEstimatePicker);
    if (action === "submit") runButtonAction(submitEstimateToGoogle);
    if (action === "invoice") runButtonAction(showPaymentDocument);
    if (action === "print") runButtonAction(() => printEstimateCopy({ userRequested: true }));
    closeEstimateActionMenu();
  });
});

// Work-file estimates are also sent directly from the Command Center iframe.
// This avoids a browser storage timing race that could otherwise show a blank
// estimate immediately after a file is uploaded.
window.addEventListener("message", (event) => {
  const samePage = event.origin === window.location.origin || event.origin === "null";
  if (!samePage || event.data?.type !== "animus-open-estimate") return;
  if (applyEstimateData(event.data.estimate)) {
    $("submitStatus").textContent = "Current work-file estimate opened.";
  }
});

setCopyMode("customer");

const startupParams = new URLSearchParams(window.location.search);
document.body.classList.toggle("embedded-estimator", startupParams.has("embedded"));

if (startupParams.has("new")) {
  clearSavedEstimateDraft();
  resetEstimate();
} else if (!loadEstimate()) {
  resetEstimate();
} else {
  $("estimateDate").value = todayInputValue();
  saveEstimate({ silent: true });
  updatePreview();
}

if (new URLSearchParams(window.location.search).has("invoice")) {
  $("estimateTitle").value = "Invoice";
  applyInvoiceMode();
  updatePreview();
}

if (window.location.hash === "#assignment") {
  window.requestAnimationFrame(() => generateAssignmentSheet());
}
refreshSupplementActions();

if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("service-worker.js");
}
