const MOBILE_STORAGE_KEY = "d2CrmDemoFiles";
const MOBILE_REVENUE_KEY = "d2CrmRevenueRows";
const MOBILE_PRICE_KEY = "d2PriceDatabase";
const MOBILE_DELETED_PRICE_KEY = "d2PriceDeletedIds";
const MOBILE_EXTERNAL_CALENDAR_KEY = "d2ExternalCalendarEvents";
const MOBILE_GOOGLE_SCRIPT_KEY = "d2GoogleScriptUrl";
const MOBILE_RESTORE_VERSION_KEY = "d2MobileDashboardRestoreVersion";
const MOBILE_DEFAULT_GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzZkie1W4LplkKwFoMq19suIHWsamKYNUwCt9xjnihTdy_dN271ou3lscTgq09bAGIG2w/exec";
const MOBILE_CLOUDFLARE_DASHBOARD_API = "https://animus-v-1.pages.dev/api/dashboard";
const MOBILE_CLOUDFLARE_RECEIPT_API = "https://animus-v-1.pages.dev/api/receipt";
const MOBILE_DEFAULT_EXPENSE_TAX_RATE = 0.065;

const mobileCurrency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const mobileStatusDetails = {
  "New Lead": ["Needs Contact", "Contact Scheduled"],
  "Contact Established": ["Inspection Date Set", "Inspection Pending"],
  "Contact Attempted": ["Follow Up Tomorrow"],
  "Inspection Completed": ["Estimate Pending", "Estimate Sent"],
  "In Negotiation": ["Follow-Up Scheduled", "Waiting on Customer"],
  "Job Won": ["Start Date Established", "Start Date Pending"],
  "In Progress": ["On Schedule", "Completion Date Needed"],
  "Work Completed": ["Closing Call Made", "Closing Call Needed"],
  "Closed / Paid": ["Invoice Sent", "Invoice Not Sent"],
  "Job Lost / Closed": ["Future Marketing Follow-Up"],
};
const mobileStatuses = Object.keys(mobileStatusDetails);
const mobileProjectTypes = ["Closet", "Pantry", "Cabinetry", "Refinishing", "Built-In", "Other"];
const mobileExpenseCategories = ["Supplies", "Materials", "Hardware", "Paint / Finish", "Equipment", "Labor", "Fuel", "Other"];
const mobileFilters = {
  all: "All Files",
  new: "New Leads",
  contact: "Pending Contact",
  estimate: "Pending Estimates",
  negotiation: "In Negotiation",
  active: "Active Jobs",
  archive: "Closed Files",
};

let mobileFiles = [];
let mobileRevenueRows = [];
let mobilePriceRows = [];
let mobileDeletedPriceIds = [];
let mobileExternalCalendarEvents = [];
let mobileActiveFileId = "";
let mobileCurrentTab = "files";
let mobileCalendarCursor = new Date();
let mobileSelectedDate = dateKey(new Date());
let mobileReceiptDraft = blankMobileReceiptDraft();

const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseMoney(value) {
  const number = Number.parseFloat(String(value || "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function dateKey(date) {
  const value = new Date(date);
  const yyyy = value.getFullYear();
  const mm = String(value.getMonth() + 1).padStart(2, "0");
  const dd = String(value.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function blankMobileReceiptLine(line = {}) {
  return {
    id: line.id || makeId("receiptLine"),
    use: line.use !== false,
    description: line.description || line.name || line.product || "",
    category: normalizeMobileExpenseCategory(line.category || "Supplies"),
    price: line.price === undefined ? (line.total || line.amount || "") : line.price,
    addTax: line.addTax !== false,
  };
}

function blankMobileReceiptDraft() {
  return {
    editingReceiptGroupId: "",
    isEditingSavedReceipt: false,
    imageDataUrl: "",
    fileName: "",
    imageTitle: "",
    vendor: "",
    date: dateKey(new Date()),
    category: "Supplies",
    amount: "",
    paymentType: "",
    cardName: "Chase Business",
    notes: "",
    lines: [],
    aiAvailable: false,
    status: "",
  };
}

function normalizeMobileExpenseCategory(value = "") {
  const match = mobileExpenseCategories.find((category) => category.toLowerCase() === String(value || "").toLowerCase());
  if (match) return match;
  const text = String(value || "").toLowerCase();
  if (/(paint|primer|stain|renner|sherwin|roller|brush|finish|urethane|sealer)/.test(text)) return "Paint / Finish";
  if (/(screw|hinge|slide|hardware|pull|handle|bracket|nail|tapcon)/.test(text)) return "Hardware";
  if (/(plywood|birch|mdf|lumber|stud|wood|board|trim|poplar|maple)/.test(text)) return "Materials";
  if (/(blade|saw|tool|drill|sander|router|ladder|equipment)/.test(text)) return "Equipment";
  if (/(gas|fuel|shell|mobil|chevron|wawa|racetrac)/.test(text)) return "Fuel";
  if (/(labor|helper|installer|subcontractor)/.test(text)) return "Labor";
  return "Supplies";
}

function expenseCategoryOptions(selected = "Supplies") {
  return mobileExpenseCategories.map((category) => `<option${category === selected ? " selected" : ""}>${escapeHtml(category)}</option>`).join("");
}

function categoryForFile(file = {}) {
  const status = file.fileStatus || "New Lead";
  if (["Closed / Paid", "Job Lost / Closed"].includes(status)) return "archive";
  if (status === "In Negotiation") return "negotiation";
  if (["Job Won", "In Progress", "Work Completed"].includes(status)) return "active";
  if (status === "Inspection Completed" || ["Estimate Pending", "Estimate Sent", "Estimate Attached"].includes(file.statusDetail) || ["Pending", "Sent", "Approved"].includes(file.estimateStatus)) return "estimate";
  if (["Contact Established", "Contact Attempted"].includes(status)) return "contact";
  return "new";
}

function normalizeFile(file = {}) {
  const normalized = {
    id: file.id || makeId("file"),
    fileNumber: file.fileNumber || "New File",
    clientName: file.clientName || "",
    clientPhone: file.clientPhone || "",
    clientEmail: file.clientEmail || "",
    projectAddress: file.projectAddress || "",
    leadSource: file.leadSource || "",
    fileStatus: file.fileStatus || "New Lead",
    statusDetail: file.statusDetail || mobileStatusDetails[file.fileStatus || "New Lead"]?.[0] || "",
    projectType: file.projectType || "Other",
    estimateTotal: Number(file.estimateTotal ?? file.estimateAmount) || 0,
    materialTotal: Number(file.materialTotal) || 0,
    initialDeposit: file.initialDeposit || "",
    midpointDeposit: file.midpointDeposit || "",
    finalPaymentAmount: file.finalPaymentAmount || "",
    paidInFull: file.paidInFull || "No",
    inspectionDate: file.inspectionDate || "",
    inspectionTime: file.inspectionTime || "",
    startDate: file.startDate || "",
    followUpDate: file.followUpDate || "",
    anticipatedCompletionDate: file.anticipatedCompletionDate || "",
    editableEstimate: file.editableEstimate || null,
    freshExpenseReceipts: Array.isArray(file.freshExpenseReceipts) ? file.freshExpenseReceipts : [],
    expenseReceipts: Array.isArray(file.expenseReceipts) ? file.expenseReceipts : [],
    expenseLines: Array.isArray(file.expenseLines) ? file.expenseLines : [],
    receiptHistory: Array.isArray(file.receiptHistory) ? file.receiptHistory : [],
    notes: Array.isArray(file.notes) ? file.notes : [],
    timeline: Array.isArray(file.timeline) ? file.timeline : [],
    ...file,
  };
  normalized.expenseLines = Array.isArray(normalized.expenseLines) ? normalized.expenseLines : [];
  normalized.receiptHistory = Array.isArray(normalized.receiptHistory) ? normalized.receiptHistory : [];
  restoreMobileExpenseLinesFromReceiptHistory(normalized);
  return normalized;
}

function normalizeMobileCalendarEvent(event = {}) {
  const startDate = event.date || (event.startIso ? dateKey(new Date(event.startIso)) : "");
  if (!startDate) return null;
  return {
    eventId: event.eventId || event.id || "",
    eventKey: event.eventKey || `google-${event.eventId || event.id || startDate}-${event.title || "event"}`,
    source: event.source || "google",
    type: event.type || "google",
    title: event.title || "Google Calendar Event",
    clientName: event.clientName || event.title || "Calendar Event",
    date: startDate,
    time: event.time || "",
    startIso: event.startIso || "",
    endIso: event.endIso || "",
    notes: event.notes || "",
    address: event.address || "",
    calendarName: event.calendarName || "",
  };
}

function restoredMobileDashboard() {
  return window.D2_DASHBOARD_RESTORE || {};
}

function restoredMobileVersion() {
  return String(restoredMobileDashboard().restoredAt || "");
}

function shouldApplyMobileRestore() {
  const version = restoredMobileVersion();
  if (!version) return false;
  try {
    return localStorage.getItem(MOBILE_RESTORE_VERSION_KEY) !== version;
  } catch (error) {
    return true;
  }
}

function markMobileRestoreApplied() {
  const version = restoredMobileVersion();
  if (!version) return;
  try {
    localStorage.setItem(MOBILE_RESTORE_VERSION_KEY, version);
  } catch (error) {
    // Some mobile privacy modes block localStorage writes.
  }
}

function mobileRowKey(row = {}) {
  return String(row.fileNumber || row.id || row.clientName || row.clientJob || row.name || "").trim().toLowerCase();
}

function mobileExpenseGroupKey(line = {}) {
  return String(line.receiptGroupId || line.id || "").trim();
}

function mergeMobileExpenseLines(primary = [], secondary = []) {
  const merged = new Map();
  [...primary, ...secondary].forEach((line) => {
    if (!line) return;
    const key = String(line.id || mobileExpenseGroupKey(line)).trim();
    if (!key) return;
    merged.set(key, { ...(merged.get(key) || {}), ...line });
  });
  return [...merged.values()];
}

function mergeMobileReceiptHistory(primary = [], secondary = []) {
  const merged = new Map();
  [...primary, ...secondary].forEach((entry) => {
    if (!entry) return;
    const key = String(entry.id || "").trim();
    if (!key) return;
    const prior = merged.get(key) || {};
    merged.set(key, {
      ...prior,
      ...entry,
      lines: mergeMobileExpenseLines(prior.lines, entry.lines),
    });
  });
  return [...merged.values()];
}

function mergeMobileRows(primary = [], secondary = []) {
  const merged = new Map();
  [...primary, ...secondary].forEach((row) => {
    const key = mobileRowKey(row);
    if (!key) return;
    if (!merged.has(key)) {
      merged.set(key, { ...row });
      return;
    }
    const prior = merged.get(key);
    merged.set(key, {
      ...prior,
      ...row,
      freshExpenseReceipts: mergeMobileReceiptHistory(prior.freshExpenseReceipts, row.freshExpenseReceipts),
      expenseReceipts: mergeMobileReceiptHistory(prior.expenseReceipts, row.expenseReceipts),
      expenseLines: mergeMobileExpenseLines(prior.expenseLines, row.expenseLines),
      receiptHistory: mergeMobileReceiptHistory(prior.receiptHistory, row.receiptHistory),
    });
  });
  return [...merged.values()];
}

function activeFile() {
  return mobileFiles.find((file) => file.id === mobileActiveFileId) || mobileFiles[0] || null;
}

function loadLocalData() {
  const restore = restoredMobileDashboard();
  const applyRestore = shouldApplyMobileRestore();
  const restoredFiles = Array.isArray(restore.files) ? restore.files.map((file) => ({ ...file })) : [];
  const restoredRevenue = Array.isArray(restore.revenue) ? restore.revenue.map((row) => ({ ...row })) : [];
  const restoredPrices = Array.isArray(restore.prices) ? restore.prices.map((row) => ({ ...row })) : [];
  try {
    const savedFiles = JSON.parse(localStorage.getItem(MOBILE_STORAGE_KEY) || "[]");
    const fileSource = applyRestore && restoredFiles.length
      ? mergeMobileRows(restoredFiles, Array.isArray(savedFiles) ? savedFiles : [])
      : Array.isArray(savedFiles) && savedFiles.length
        ? savedFiles
        : restoredFiles;
    mobileFiles = fileSource.map(normalizeFile);
  } catch (error) {
    mobileFiles = restoredFiles.map(normalizeFile);
  }
  try {
    const savedRevenue = JSON.parse(localStorage.getItem(MOBILE_REVENUE_KEY) || "[]");
    const revenueSource = applyRestore && restoredRevenue.length
      ? mergeMobileRows(restoredRevenue, Array.isArray(savedRevenue) ? savedRevenue : [])
      : Array.isArray(savedRevenue) && savedRevenue.length
        ? savedRevenue
        : restoredRevenue;
    mobileRevenueRows = revenueSource;
  } catch (error) {
    mobileRevenueRows = restoredRevenue;
  }
  try {
    const savedPrices = JSON.parse(localStorage.getItem(MOBILE_PRICE_KEY) || "[]");
    const priceSource = applyRestore && restoredPrices.length
      ? mergeMobileRows(restoredPrices, Array.isArray(savedPrices) ? savedPrices : [])
      : Array.isArray(savedPrices) && savedPrices.length
        ? savedPrices
        : restoredPrices;
    mobilePriceRows = priceSource;
  } catch (error) {
    mobilePriceRows = restoredPrices;
  }
  try {
    mobileDeletedPriceIds = JSON.parse(localStorage.getItem(MOBILE_DELETED_PRICE_KEY) || "[]");
  } catch (error) {
    mobileDeletedPriceIds = [];
  }
  try {
    const savedEvents = JSON.parse(localStorage.getItem(MOBILE_EXTERNAL_CALENDAR_KEY) || "[]");
    mobileExternalCalendarEvents = Array.isArray(savedEvents) ? savedEvents.map(normalizeMobileCalendarEvent).filter(Boolean) : [];
  } catch (error) {
    mobileExternalCalendarEvents = [];
  }
  if (applyRestore && restoredFiles.length) {
    saveLocalData();
    markMobileRestoreApplied();
  }
  hydrateMobileExpensesFromRevenue();
  if (!mobileActiveFileId && mobileFiles[0]) mobileActiveFileId = mobileFiles[0].id;
}

function saveLocalData() {
  mobileFiles.forEach((file) => {
    restoreMobileExpenseLinesFromReceiptHistory(file);
    syncMobileReceiptHistoryFromExpenseLines(file);
  });
  localStorage.setItem(MOBILE_STORAGE_KEY, JSON.stringify(mobileFiles));
  localStorage.setItem(MOBILE_REVENUE_KEY, JSON.stringify(mobileRevenueRows));
  localStorage.setItem(MOBILE_PRICE_KEY, JSON.stringify(mobilePriceRows));
  localStorage.setItem(MOBILE_DELETED_PRICE_KEY, JSON.stringify(mobileDeletedPriceIds));
  localStorage.setItem(MOBILE_EXTERNAL_CALENDAR_KEY, JSON.stringify(mobileExternalCalendarEvents));
}

function googleScriptUrl() {
  return localStorage.getItem(MOBILE_GOOGLE_SCRIPT_KEY) || MOBILE_DEFAULT_GOOGLE_SCRIPT_URL;
}

function syncPayload() {
  captureDetailFields();
  syncAllMobileFileExpensesToRevenue();
  return {
    action: "dashboardSync",
    syncedAt: new Date().toISOString(),
    source: "ANIMUS Mobile",
    dashboardFiles: mobileFiles,
    revenueRows: mobileRevenueRows,
    priceRows: mobilePriceRows,
    deletedPriceIds: mobileDeletedPriceIds,
  };
}

function postToGoogle(payload) {
  const body = new FormData();
  body.append("payload", JSON.stringify(payload));
  fetch(googleScriptUrl(), { method: "POST", mode: "no-cors", keepalive: true, body }).catch(() => {});
  return Promise.resolve(true);
}

async function fetchCloudDashboard() {
  const response = await fetch(`${MOBILE_CLOUDFLARE_DASHBOARD_API}?t=${Date.now()}`, {
    cache: "no-store",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok === false) {
    throw new Error(result.error || `Cloud load failed with status ${response.status}.`);
  }
  return result.dashboard || null;
}

function fetchGoogleCalendarEvents(startDate, endDate) {
  return new Promise((resolve, reject) => {
    const callbackName = `animusMobileCalendar${Date.now()}${Math.random().toString(16).slice(2)}`;
    const script = document.createElement("script");
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("Google Calendar import timed out."));
    }, 20000);
    function cleanup() {
      window.clearTimeout(timer);
      delete window[callbackName];
      script.remove();
    }
    window[callbackName] = (response) => {
      cleanup();
      if (!response || response.ok === false) {
        reject(new Error(response?.error || "Google Calendar import failed."));
        return;
      }
      resolve(Array.isArray(response.events) ? response.events : []);
    };
    const url = new URL(googleScriptUrl());
    url.searchParams.set("action", "calendarEvents");
    url.searchParams.set("start", startDate);
    url.searchParams.set("end", endDate);
    url.searchParams.set("callback", callbackName);
    script.onerror = () => {
      cleanup();
      reject(new Error("Google Calendar import could not connect."));
    };
    script.src = url.toString();
    document.body.appendChild(script);
  });
}

async function saveCloud() {
  saveLocalData();
  $("mobileSaveCloud").classList.add("saving");
  const response = await fetch(MOBILE_CLOUDFLARE_DASHBOARD_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(syncPayload()),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok === false) {
    throw new Error(result.error || `Cloud save failed with status ${response.status}.`);
  }
  $("mobileSaveCloud").classList.remove("saving");
  $("mobileSaveCloud").classList.add("saved");
  window.setTimeout(() => $("mobileSaveCloud").classList.remove("saved"), 900);
  return result;
}

async function loadCloud() {
  const dashboard = await fetchCloudDashboard();
  if (!dashboard) {
    window.alert("No cloud dashboard was found yet.");
    return;
  }
  mobileFiles = Array.isArray(dashboard.dashboardFiles) ? dashboard.dashboardFiles.map(normalizeFile) : [];
  mobileRevenueRows = Array.isArray(dashboard.revenueRows) ? dashboard.revenueRows : [];
  mobilePriceRows = Array.isArray(dashboard.priceRows) ? dashboard.priceRows : [];
  mobileDeletedPriceIds = Array.isArray(dashboard.deletedPriceIds) ? dashboard.deletedPriceIds : [];
  hydrateMobileExpensesFromRevenue();
  mobileActiveFileId = mobileFiles[0]?.id || "";
  saveLocalData();
  renderAll();
  window.alert("ANIMUS Mobile loaded the latest cloud data.");
}

async function loadCloudOnStartup() {
  try {
    const dashboard = await fetchCloudDashboard();
    if (!dashboard) return false;
    mobileFiles = Array.isArray(dashboard.dashboardFiles) ? dashboard.dashboardFiles.map(normalizeFile) : [];
    mobileRevenueRows = Array.isArray(dashboard.revenueRows) ? dashboard.revenueRows : [];
    mobilePriceRows = Array.isArray(dashboard.priceRows) ? dashboard.priceRows : [];
    mobileDeletedPriceIds = Array.isArray(dashboard.deletedPriceIds) ? dashboard.deletedPriceIds : [];
    hydrateMobileExpensesFromRevenue();
    mobileActiveFileId = mobileFiles[0]?.id || "";
    saveLocalData();
    renderAll();
    return true;
  } catch (error) {
    return false;
  }
}

function setTab(tab) {
  captureDetailFields();
  mobileCurrentTab = tab;
  document.querySelectorAll(".mobile-view").forEach((view) => view.classList.remove("active"));
  document.querySelectorAll("[data-mobile-tab]").forEach((button) => button.classList.toggle("active", button.dataset.mobileTab === tab));
  const titleMap = { files: "Command Center", detail: "File Details", calendar: "Calendar", estimate: "Estimator", revenue: "Revenue", expenses: "Expenses", more: "More" };
  $("mobileViewTitle").textContent = titleMap[tab] || "ANIMUS";
  const view = $(`mobile${tab[0].toUpperCase()}${tab.slice(1)}View`);
  if (view) view.classList.add("active");
  if (tab === "calendar") renderCalendar();
  if (tab === "revenue") renderRevenue();
  if (tab === "expenses") renderMobileExpenses();
  if (tab === "estimate") loadMobileEstimator();
}

function openMobileMenu() {
  $("mobileMenuBackdrop").hidden = false;
  $("mobileMenuPanel").hidden = false;
  $("mobileMenuButton").setAttribute("aria-expanded", "true");
}

function closeMobileMenu() {
  $("mobileMenuBackdrop").hidden = true;
  $("mobileMenuPanel").hidden = true;
  $("mobileMenuButton").setAttribute("aria-expanded", "false");
}

function setupMobileCollapsibles() {
  document.querySelectorAll("[data-mobile-toggle-section]").forEach((button) => {
    button.addEventListener("click", () => {
      button.closest(".mobile-collapsible")?.classList.toggle("is-open");
    });
  });
}

function filteredFiles() {
  const filter = $("mobileFileFilter").value;
  const query = $("mobileSearch").value.trim().toLowerCase();
  return mobileFiles.filter((file) => {
    const matchesFilter = filter === "all" || categoryForFile(file) === filter;
    const haystack = `${file.fileNumber} ${file.clientName} ${file.clientPhone} ${file.clientEmail} ${file.projectAddress}`.toLowerCase();
    return matchesFilter && (!query || haystack.includes(query));
  });
}

function renderFiles() {
  const files = filteredFiles();
  $("mobileFileList").innerHTML = files.length ? files.map((file) => `
    <button type="button" class="mobile-file-card" data-file-id="${escapeHtml(file.id)}">
      <strong>${escapeHtml(file.fileNumber || "New File")}</strong>
      <h3>${escapeHtml(file.clientName || "Unnamed Client")}</h3>
      <p>${escapeHtml(file.fileStatus || "New Lead")} · ${escapeHtml(file.projectType || "Other")}</p>
      <p>${escapeHtml(file.nextAction || file.statusDetail || "No next action set")}</p>
    </button>
  `).join("") : `<article class="mobile-card"><p class="mobile-helper">No files found.</p></article>`;
  document.querySelectorAll("[data-file-id]").forEach((button) => {
    button.addEventListener("click", () => {
      mobileActiveFileId = button.dataset.fileId;
      renderDetail();
      setTab("detail");
    });
  });
}

function populateSelect(select, options, selected) {
  select.innerHTML = options.map((option) => `<option${option === selected ? " selected" : ""}>${escapeHtml(option)}</option>`).join("");
}

function renderStatusDetailOptions(file) {
  populateSelect($("mobileFileStatus"), mobileStatuses, file.fileStatus);
  populateSelect($("mobileStatusDetail"), mobileStatusDetails[file.fileStatus] || [file.statusDetail || ""], file.statusDetail);
  populateSelect($("mobileProjectType"), mobileProjectTypes, file.projectType || "Other");
}

function paidTotal(file) {
  if (file.paidInFull === "Yes") return Number(file.estimateTotal) || 0;
  return parseMoney(file.initialDeposit) + parseMoney(file.midpointDeposit) + parseMoney(file.finalPaymentAmount);
}

function renderDetail() {
  const file = activeFile();
  if (!file) return;
  renderStatusDetailOptions(file);
  $("mobileDetailNumber").textContent = `Project # ${file.fileNumber || "New File"}`;
  $("mobileClientName").value = file.clientName || "";
  $("mobileClientPhone").value = file.clientPhone || "";
  $("mobileClientEmail").value = file.clientEmail || "";
  $("mobileProjectAddress").value = file.projectAddress || "";
  $("mobileLeadSource").value = file.leadSource || "";
  $("mobileEstimateTotal").value = Number(file.estimateTotal) || "";
  $("mobileMaterialTotal").value = Number(file.materialTotal) || "";
  $("mobileInitialDeposit").value = file.initialDeposit || "";
  $("mobileMidpointDeposit").value = file.midpointDeposit || "";
  $("mobileFinalPaymentAmount").value = file.finalPaymentAmount || "";
  $("mobilePaidInFull").value = file.paidInFull || "No";
  $("mobileInspectionDate").value = file.inspectionDate || "";
  $("mobileInspectionTime").value = file.inspectionTime || "";
  $("mobileStartDate").value = file.startDate || "";
  $("mobileFollowUpDate").value = file.followUpDate || "";
  $("mobileAnticipatedCompletionDate").value = file.anticipatedCompletionDate || "";
  const total = Number(file.estimateTotal) || 0;
  const balance = Math.max(total - paidTotal(file), 0);
  $("mobileMoneyTitle").textContent = mobileCurrency.format(total);
  $("mobileBalanceBadge").textContent = `${mobileCurrency.format(balance)} due`;
  renderNotes(file);
}

function captureDetailFields() {
  const file = activeFile();
  if (!file || !$("mobileClientName")) return;
  file.clientName = $("mobileClientName").value;
  file.clientPhone = $("mobileClientPhone").value;
  file.clientEmail = $("mobileClientEmail").value;
  file.projectAddress = $("mobileProjectAddress").value;
  file.fileStatus = $("mobileFileStatus").value;
  file.statusDetail = $("mobileStatusDetail").value;
  file.projectType = $("mobileProjectType").value;
  file.leadSource = $("mobileLeadSource").value;
  file.estimateTotal = parseMoney($("mobileEstimateTotal").value);
  file.materialTotal = parseMoney($("mobileMaterialTotal").value);
  file.initialDeposit = $("mobileInitialDeposit").value;
  file.midpointDeposit = $("mobileMidpointDeposit").value;
  file.finalPaymentAmount = $("mobileFinalPaymentAmount").value;
  file.paidInFull = $("mobilePaidInFull").value;
  file.inspectionDate = $("mobileInspectionDate").value;
  file.inspectionTime = $("mobileInspectionTime").value;
  file.startDate = $("mobileStartDate").value;
  file.followUpDate = $("mobileFollowUpDate").value;
  file.anticipatedCompletionDate = $("mobileAnticipatedCompletionDate").value;
  saveLocalData();
}

function renderNotes(file) {
  const notes = Array.isArray(file.notes) ? [...file.notes].reverse() : [];
  $("mobileNotes").innerHTML = notes.length ? notes.map((note) => `
    <article class="mobile-note-entry">
      <time>${escapeHtml(note.at ? new Date(note.at).toLocaleString() : "")}</time>
      <p>${escapeHtml(note.text || "")}</p>
    </article>
  `).join("") : `<p class="mobile-helper">No notes yet.</p>`;
}

function addNote() {
  const file = activeFile();
  const text = $("mobileNewNote").value.trim();
  if (!file || !text) return;
  file.notes = [...(file.notes || []), { at: new Date().toISOString(), text }];
  $("mobileNewNote").value = "";
  saveLocalData();
  renderNotes(file);
}

function newFile() {
  const year = String(new Date().getFullYear()).slice(-2);
  const nextNumber = mobileFiles.length + 1001;
  const file = normalizeFile({
    id: makeId("file"),
    fileNumber: `${year}-A${nextNumber}`,
    clientName: "New Client",
    fileStatus: "New Lead",
    statusDetail: "Needs Contact",
    projectType: "Other",
    notes: [{ at: new Date().toISOString(), text: "File created from ANIMUS Mobile." }],
  });
  mobileFiles.unshift(file);
  mobileActiveFileId = file.id;
  saveLocalData();
  renderAll();
  setTab("detail");
}

function eventList() {
  const events = [];
  mobileFiles.forEach((file) => {
    [
      ["Inspection", file.inspectionDate, file.inspectionTime],
      ["Start", file.startDate, ""],
      ["Follow-Up", file.followUpDate, ""],
      ["Completion", file.anticipatedCompletionDate, ""],
    ].forEach(([type, date, time]) => {
      if (!date) return;
      events.push({
        eventKey: `${file.id}-${type.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        source: "dashboard",
        fileId: file.id,
        date,
        time,
        title: `${type} · ${file.clientName || file.fileNumber}`,
        clientName: file.clientName || file.fileNumber || "",
        address: file.projectAddress || "",
        notes: file.nextAction || file.statusDetail || "",
        type,
      });
    });
  });
  mobileExternalCalendarEvents.forEach((event) => {
    const normalized = normalizeMobileCalendarEvent(event);
    if (normalized) events.push(normalized);
  });
  return events.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}

function calendarEventPayload(event) {
  return {
    eventKey: event.eventKey,
    title: event.title || "D2 Calendar Event",
    date: event.date,
    time: event.time || "09:00",
    startIso: event.startIso || "",
    endIso: event.endIso || "",
    address: event.address || "",
    notes: event.notes || "",
  };
}

function postCalendarEventToGoogle(event) {
  return postToGoogle({
    action: "calendarEvent",
    calendarEvent: calendarEventPayload(event),
  });
}

function dedupeMobileCalendarEvents(events = []) {
  const seen = new Set();
  return events.filter((event) => {
    const key = String(event.eventKey || `${event.date}-${event.time}-${event.title}`).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function importMobileGoogleCalendar() {
  const button = $("mobileImportGoogleCalendar");
  const originalText = button.textContent;
  button.textContent = "Importing...";
  const start = new Date(mobileCalendarCursor.getFullYear(), mobileCalendarCursor.getMonth() - 1, 1);
  const end = new Date(mobileCalendarCursor.getFullYear() + 1, mobileCalendarCursor.getMonth() + 1, 0);
  try {
    const events = await fetchGoogleCalendarEvents(dateKey(start), dateKey(end));
    mobileExternalCalendarEvents = dedupeMobileCalendarEvents(events.map(normalizeMobileCalendarEvent).filter(Boolean));
    saveLocalData();
    renderCalendar();
    window.alert(`${mobileExternalCalendarEvents.length} Google Calendar event${mobileExternalCalendarEvents.length === 1 ? "" : "s"} imported into mobile.`);
  } finally {
    button.textContent = originalText;
  }
}

async function syncMobileUpcomingCalendar() {
  const today = dateKey(new Date());
  const events = eventList().filter((event) => event.source !== "google" && event.date >= today);
  if (!events.length) {
    window.alert("No upcoming dashboard calendar events to sync.");
    return;
  }
  for (const event of events) {
    await postCalendarEventToGoogle(event);
  }
  window.alert(`${events.length} upcoming event${events.length === 1 ? "" : "s"} sent to Google Calendar.`);
}

function renderCalendar() {
  const monthStart = new Date(mobileCalendarCursor.getFullYear(), mobileCalendarCursor.getMonth(), 1);
  const monthTitle = monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  $("mobileMonthTitle").textContent = monthTitle;
  const firstDay = monthStart.getDay();
  const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  const events = eventList();
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => `<div class="mobile-day-label">${day}</div>`);
  const blanks = Array.from({ length: firstDay }, () => `<div></div>`);
  const cells = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const key = dateKey(new Date(monthStart.getFullYear(), monthStart.getMonth(), day));
    const hasEvent = events.some((event) => event.date === key);
    return `<button type="button" class="mobile-day-cell${hasEvent ? " has-event" : ""}${key === mobileSelectedDate ? " selected" : ""}" data-calendar-date="${key}">${day}</button>`;
  });
  $("mobileCalendarGrid").innerHTML = [...labels, ...blanks, ...cells].join("");
  document.querySelectorAll("[data-calendar-date]").forEach((button) => {
    button.addEventListener("click", () => {
      mobileSelectedDate = button.dataset.calendarDate;
      renderCalendar();
    });
  });
  renderSelectedDay();
}

function renderSelectedDay() {
  const events = eventList().filter((event) => event.date === mobileSelectedDate);
  $("mobileSelectedDayTitle").textContent = formatDate(mobileSelectedDate);
  $("mobileSelectedDayEvents").innerHTML = events.length ? events.map((event) => `
    <button type="button" class="mobile-event-pill" data-file-id="${escapeHtml(event.fileId || "")}" data-calendar-info="${escapeHtml(event.eventKey || "")}">
      ${escapeHtml(event.time ? `${event.time} · ` : "")}${escapeHtml(event.title)}
    </button>
  `).join("") : `<p class="mobile-helper">No events on this day.</p>`;
  document.querySelectorAll(".mobile-event-pill").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.fileId) {
        mobileActiveFileId = button.dataset.fileId;
        renderDetail();
        setTab("detail");
        return;
      }
      const event = eventList().find((entry) => entry.eventKey === button.dataset.calendarInfo);
      if (event) window.alert(`${event.title}\n${formatDate(event.date)}${event.time ? ` at ${event.time}` : ""}${event.notes ? `\n\n${event.notes}` : ""}`);
    });
  });
}

function renderRevenue() {
  const totals = mobileRevenueRows.reduce((sum, row) => {
    sum.gross += Number(row.gross) || 0;
    sum.expenses += Number(row.expenses) || 0;
    sum.labor += Number(row.labor) || 0;
    sum.profit += Number(row.profit) || (Number(row.gross) || 0) - (Number(row.expenses) || 0) - (Number(row.labor) || 0);
    return sum;
  }, { gross: 0, expenses: 0, labor: 0, profit: 0 });
  $("mobileRevenueGross").textContent = mobileCurrency.format(totals.gross);
  $("mobileRevenueExpenses").textContent = mobileCurrency.format(totals.expenses);
  $("mobileRevenueLabor").textContent = mobileCurrency.format(totals.labor);
  $("mobileRevenueProfit").textContent = mobileCurrency.format(totals.profit);
  $("mobileRevenueList").innerHTML = mobileRevenueRows.length ? mobileRevenueRows.map((row) => `
    <article class="mobile-revenue-row">
      <h3>${escapeHtml(row.clientJob || "Revenue Row")}</h3>
      <p>${escapeHtml(row.date || "")} · ${mobileCurrency.format(Number(row.gross) || 0)} gross · ${mobileCurrency.format(Number(row.expenses) || 0)} expenses</p>
    </article>
  `).join("") : `<article class="mobile-card"><p class="mobile-helper">No revenue rows yet.</p></article>`;
}

function mobileExpenseBaseAmount(line = {}) {
  if (line.baseAmount !== undefined && line.baseAmount !== "") return parseMoney(line.baseAmount);
  if (line.price !== undefined && line.price !== "") return parseMoney(line.price);
  return parseMoney(line.amount);
}

function mobileExpenseTaxAmount(line = {}) {
  return line.addTax ? mobileExpenseBaseAmount(line) * (Number(line.taxRate) || MOBILE_DEFAULT_EXPENSE_TAX_RATE) : 0;
}

function mobileExpenseFinalAmount(line = {}) {
  if (line.addTax) return mobileExpenseBaseAmount(line) + mobileExpenseTaxAmount(line);
  return Number(line.amount) || mobileExpenseBaseAmount(line);
}

function mobileFileExpenseTotal(file = activeFile()) {
  restoreMobileExpenseLinesFromReceiptHistory(file);
  return (Array.isArray(file?.expenseLines) ? file.expenseLines : []).reduce((sum, line) => sum + mobileExpenseFinalAmount(line), 0);
}

function findMobileRevenueRowForFile(file) {
  if (!file) return null;
  const fileNumber = String(file.fileNumber || "").trim().toLowerCase();
  const clientName = String(file.clientName || "").trim().toLowerCase();
  const cleanClientName = clientName.replace(/[^a-z0-9]/g, "");
  return mobileRevenueRows.find((row) => {
    const rowFileNumber = String(row.fileNumber || "").trim().toLowerCase();
    const rowClient = String(row.clientJob || row.clientName || row.name || "").trim().toLowerCase();
    const cleanRowClient = rowClient.replace(/[^a-z0-9]/g, "");
    return (fileNumber && rowFileNumber === fileNumber)
      || (fileNumber && rowClient.includes(fileNumber))
      || (clientName && rowClient.includes(clientName))
      || (cleanClientName && cleanRowClient.includes(cleanClientName));
  }) || null;
}

function syncMobileFileExpensesToRevenue(file = activeFile()) {
  restoreMobileExpenseLinesFromReceiptHistory(file);
  syncMobileReceiptHistoryFromExpenseLines(file);
  const row = ensureMobileRevenueRowForFile(file);
  if (!row) return;
  row.expenses = mobileFileExpenseTotal(file);
  row.profit = (Number(row.gross) || 0) - (Number(row.expenses) || 0) - (Number(row.labor) || 0);
  row.expenseLines = Array.isArray(file.expenseLines) ? file.expenseLines.map((line) => ({ ...line })) : [];
}

function ensureMobileRevenueRowForFile(file) {
  if (!file) return null;
  const existing = findMobileRevenueRowForFile(file);
  if (existing) return existing;
  const expenseTotal = mobileFileExpenseTotal(file);
  if (!expenseTotal && !Number(file.estimateTotal)) return null;
  const row = {
    id: makeId("rev-file"),
    date: dateKey(new Date()),
    dashboardFileId: file.id || "",
    fileNumber: file.fileNumber || "",
    clientJob: `${file.clientName || "Unnamed Client"}${file.fileNumber ? ` - ${file.fileNumber}` : ""}`,
    gross: Number(file.estimateTotal) || 0,
    expenses: expenseTotal,
    labor: 0,
    profit: (Number(file.estimateTotal) || 0) - expenseTotal,
    receiptNotes: "",
    laborAssigns: "",
    expenseLines: Array.isArray(file.expenseLines) ? file.expenseLines.map((line) => ({ ...line })) : [],
  };
  mobileRevenueRows.unshift(row);
  return row;
}

function syncAllMobileFileExpensesToRevenue() {
  mobileFiles.forEach((file) => {
    if (Array.isArray(file.expenseLines) && file.expenseLines.length) {
      syncMobileFileExpensesToRevenue(file);
    }
  });
}

function showMobileReceiptLoading(message = "ANIMUS is reviewing the image and preparing the expense lines.") {
  const modal = $("mobileReceiptLoadingModal");
  if (!modal) return;
  const messageElement = $("mobileReceiptLoadingMessage");
  if (messageElement) messageElement.textContent = message;
  modal.hidden = false;
}

function hideMobileReceiptLoading() {
  const modal = $("mobileReceiptLoadingModal");
  if (modal) modal.hidden = true;
}

function hydrateMobileExpensesFromRevenue(fileToHydrate = null) {
  const files = fileToHydrate ? [fileToHydrate] : mobileFiles;
  files.forEach((file) => {
    if (!file) return;
    file.expenseLines = Array.isArray(file.expenseLines) ? file.expenseLines : [];
    if (file.expenseLines.length) return;
    const row = findMobileRevenueRowForFile(file);
    if (!row) return;
    if (Array.isArray(row.expenseLines) && row.expenseLines.length) {
      file.expenseLines = row.expenseLines.map((line) => ({ ...line }));
      return;
    }
    const expenseTotal = Number(row.expenses) || 0;
    const receiptNotes = String(row.receiptNotes || "").trim();
    if (!expenseTotal && !receiptNotes) return;
    file.expenseLines = [{
      id: `revenue-expense-${row.id || file.id || makeId("expense")}`,
      receiptGroupId: `revenue-expense-${row.id || file.id || "summary"}`,
      date: row.date || "",
      category: "Supplies",
      vendor: "",
      note: receiptNotes || "Revenue expense total",
      baseAmount: expenseTotal,
      amount: expenseTotal,
      tax: 0,
      addTax: false,
      taxRate: MOBILE_DEFAULT_EXPENSE_TAX_RATE,
      paymentType: "",
      receiptFileName: "",
      receiptDataUrl: "",
      receiptSource: "Revenue backup",
    }];
  });
}

function readMobileFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function readMobileReceiptWithAi(imageDataUrl, file) {
  const response = await fetch(MOBILE_CLOUDFLARE_RECEIPT_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      imageDataUrl,
      fileName: file?.name || "",
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok === false) {
    throw new Error(result.error || `Receipt read failed with status ${response.status}.`);
  }
  return result;
}

function normalizeMobilePayment(value = "") {
  const clean = String(value || "").toLowerCase();
  if (/(credit|card|debit|visa|mastercard|amex|chase|bank)/.test(clean)) return "Credit";
  if (/cash/.test(clean)) return "Cash";
  return value || "";
}

function mobileReceiptResultToDraft(result = {}, fallback = {}) {
  const receipt = result.receipt || result || {};
  const lineItems = Array.isArray(receipt.lineItems) ? receipt.lineItems : [];
  const lines = lineItems
    .map((item) => blankMobileReceiptLine({
      description: item.name || item.description || "",
      category: item.category || receipt.category || fallback.category || "Supplies",
      price: item.total || item.amount || item.price || "",
      addTax: true,
    }))
    .filter((line) => line.description || parseMoney(line.price));
  const notes = [receipt.notes || "", lineItems.map((item) => item.name || item.description || "").filter(Boolean).join(", ")].filter(Boolean).join("\n").trim();
  return {
    ...blankMobileReceiptDraft(),
    imageDataUrl: fallback.imageDataUrl || "",
    fileName: fallback.fileName || "",
    imageTitle: fallback.fileName || "",
    vendor: receipt.vendor || fallback.vendor || "",
    date: receipt.date || fallback.date || dateKey(new Date()),
    category: normalizeMobileExpenseCategory(receipt.category || fallback.category || notes),
    amount: receipt.total || receipt.amount || fallback.amount || "",
    paymentType: normalizeMobilePayment(receipt.paymentType || receipt.payment || fallback.paymentType || ""),
    notes: notes || fallback.notes || "",
    lines: lines.length ? lines : [blankMobileReceiptLine({
      description: receipt.notes || receipt.vendor || fallback.fileName || "Receipt expense",
      category: receipt.category || fallback.category || "Supplies",
      price: receipt.total || receipt.amount || "",
      addTax: true,
    })],
    aiAvailable: Boolean(result.aiAvailable),
    status: result.aiAvailable
      ? "Receipt read with AI. Review the lines, then save."
      : (result.message || result.error || "Receipt attached. Review the fields, then save."),
  };
}

function captureMobileReceiptDraft() {
  if (!$("mobileReceiptDate")) return;
  mobileReceiptDraft.date = $("mobileReceiptDate").value || dateKey(new Date());
  mobileReceiptDraft.vendor = $("mobileReceiptVendor").value.trim();
  mobileReceiptDraft.category = $("mobileReceiptCategory").value || "Supplies";
  mobileReceiptDraft.amount = $("mobileReceiptTotal").value;
  mobileReceiptDraft.paymentType = $("mobileReceiptPaidBy").value;
  mobileReceiptDraft.cardName = $("mobileReceiptCard").value;
  mobileReceiptDraft.imageTitle = $("mobileReceiptImageTitle").value.trim();
  mobileReceiptDraft.notes = $("mobileReceiptNotes").value.trim();
  mobileReceiptDraft.lines = Array.from(document.querySelectorAll("[data-mobile-receipt-line]")).map((row) => {
    const id = row.dataset.mobileReceiptLine;
    return blankMobileReceiptLine({
      id,
      use: Boolean(row.querySelector("[data-mobile-receipt-field='use']")?.checked),
      description: row.querySelector("[data-mobile-receipt-field='description']")?.value.trim() || "",
      category: row.querySelector("[data-mobile-receipt-field='category']")?.value || "Supplies",
      price: row.querySelector("[data-mobile-receipt-field='price']")?.value || "",
      addTax: Boolean(row.querySelector("[data-mobile-receipt-field='addTax']")?.checked),
    });
  });
}

function mobileReceiptLineTotal(line = {}) {
  const price = parseMoney(line.price);
  return line.addTax ? price + (price * MOBILE_DEFAULT_EXPENSE_TAX_RATE) : price;
}

function mobileReceiptDraftTotal() {
  const lineTotal = mobileReceiptDraft.lines.reduce((sum, line) => line.use === false ? sum : sum + mobileReceiptLineTotal(line), 0);
  return lineTotal || parseMoney(mobileReceiptDraft.amount);
}

function mobileReceiptPaymentLabel() {
  if (mobileReceiptDraft.paymentType === "Credit") return mobileReceiptDraft.cardName || "Credit";
  return mobileReceiptDraft.paymentType || "";
}

function mobileExpenseLinesFromDraft(groupId = makeId("receiptGroup")) {
  const selectedLines = mobileReceiptDraft.lines.filter((line) => line.use !== false && (line.description || parseMoney(line.price)));
  const source = mobileReceiptDraft.aiAvailable ? "AI receipt reader" : "Mobile receipt review";
  if (!selectedLines.length && (parseMoney(mobileReceiptDraft.amount) || mobileReceiptDraft.vendor || mobileReceiptDraft.notes)) {
    const baseAmount = parseMoney(mobileReceiptDraft.amount);
    return [{
      id: makeId("expense"),
      receiptGroupId: groupId,
      date: mobileReceiptDraft.date || dateKey(new Date()),
      category: normalizeMobileExpenseCategory(mobileReceiptDraft.category),
      vendor: mobileReceiptDraft.vendor || "",
      note: mobileReceiptDraft.notes || mobileReceiptDraft.imageTitle || mobileReceiptDraft.fileName || "Receipt expense",
      baseAmount,
      amount: baseAmount,
      tax: 0,
      addTax: false,
      taxRate: MOBILE_DEFAULT_EXPENSE_TAX_RATE,
      paymentType: mobileReceiptPaymentLabel(),
      receiptFileName: mobileReceiptDraft.imageTitle || mobileReceiptDraft.fileName || "",
      receiptDataUrl: mobileReceiptDraft.imageDataUrl || "",
      receiptSource: source,
    }];
  }
  return selectedLines.map((line, index) => {
    const baseAmount = parseMoney(line.price);
    const tax = line.addTax ? baseAmount * MOBILE_DEFAULT_EXPENSE_TAX_RATE : 0;
    return {
      id: makeId("expense"),
      receiptGroupId: groupId,
      date: mobileReceiptDraft.date || dateKey(new Date()),
      category: normalizeMobileExpenseCategory(line.category || mobileReceiptDraft.category),
      vendor: mobileReceiptDraft.vendor || "",
      note: line.description || mobileReceiptDraft.notes || "Receipt expense",
      baseAmount,
      amount: baseAmount + tax,
      tax,
      addTax: Boolean(line.addTax),
      taxRate: MOBILE_DEFAULT_EXPENSE_TAX_RATE,
      paymentType: mobileReceiptPaymentLabel(),
      receiptFileName: mobileReceiptDraft.imageTitle || mobileReceiptDraft.fileName || "",
      receiptDataUrl: index === 0 ? (mobileReceiptDraft.imageDataUrl || "") : "",
      receiptSource: source,
    };
  });
}

function mobileReceiptHistoryEntryFromLines(groupId, lines = [], existing = {}) {
  const groupLines = Array.isArray(lines) ? lines.map((line) => ({ ...line })) : [];
  const first = groupLines.find((line) => line.receiptDataUrl) || groupLines[0] || {};
  const total = groupLines.reduce((sum, line) => sum + mobileExpenseFinalAmount(line), 0);
  return {
    ...existing,
    id: groupId,
    savedAt: existing.savedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    label: first.vendor || first.receiptFileName || first.note || existing.label || "Saved expense",
    date: first.date || existing.date || dateKey(new Date()),
    vendor: first.vendor || existing.vendor || "",
    category: first.category || existing.category || "",
    paymentType: first.paymentType || existing.paymentType || "",
    total,
    lineCount: groupLines.length,
    lines: groupLines,
  };
}

function upsertMobileReceiptHistoryGroup(file, groupId, lines = []) {
  if (!file || !groupId) return;
  file.receiptHistory = Array.isArray(file.receiptHistory) ? file.receiptHistory : [];
  const index = file.receiptHistory.findIndex((entry) => entry.id === groupId);
  const existing = index >= 0 ? file.receiptHistory[index] : {};
  const nextEntry = mobileReceiptHistoryEntryFromLines(groupId, lines, existing);
  if (index >= 0) file.receiptHistory[index] = nextEntry;
  else file.receiptHistory.unshift(nextEntry);
}

function syncMobileReceiptHistoryFromExpenseLines(file) {
  if (!file) return;
  file.receiptHistory = Array.isArray(file.receiptHistory) ? file.receiptHistory : [];
  const groups = new Map();
  (Array.isArray(file.expenseLines) ? file.expenseLines : []).forEach((line) => {
    const groupId = line.receiptGroupId || line.id;
    if (!groupId) return;
    if (!groups.has(groupId)) groups.set(groupId, []);
    groups.get(groupId).push(line);
  });
  groups.forEach((lines, groupId) => upsertMobileReceiptHistoryGroup(file, groupId, lines));
}

function restoreMobileExpenseLinesFromReceiptHistory(file) {
  if (!file) return;
  file.expenseLines = Array.isArray(file.expenseLines) ? file.expenseLines : [];
  file.receiptHistory = Array.isArray(file.receiptHistory) ? file.receiptHistory : [];
  const existingGroups = new Set(file.expenseLines.map((line) => line.receiptGroupId || line.id).filter(Boolean));
  file.receiptHistory.forEach((entry) => {
    const groupId = entry?.id;
    const lines = Array.isArray(entry?.lines) ? entry.lines : [];
    if (!groupId || !lines.length || existingGroups.has(groupId)) return;
    lines.forEach((line) => {
      file.expenseLines.push({
        ...line,
        id: line.id || makeId("expense"),
        receiptGroupId: line.receiptGroupId || groupId,
      });
    });
    existingGroups.add(groupId);
  });
}

function refreshMobileReceiptHistoryGroup(file, groupId) {
  if (!file || !groupId) return;
  const lines = (Array.isArray(file.expenseLines) ? file.expenseLines : []).filter((line) => (line.receiptGroupId || line.id) === groupId);
  if (lines.length) {
    upsertMobileReceiptHistoryGroup(file, groupId, lines);
  } else if (Array.isArray(file.receiptHistory)) {
    file.receiptHistory = file.receiptHistory.filter((entry) => entry.id !== groupId);
  }
}

function mobileReceiptHistoryGroups(file) {
  if (!file) return [];
  restoreMobileExpenseLinesFromReceiptHistory(file);
  syncMobileReceiptHistoryFromExpenseLines(file);
  return (Array.isArray(file.receiptHistory) ? file.receiptHistory : [])
    .filter((entry) => entry && entry.id)
    .sort((a, b) => String(b.updatedAt || b.savedAt || "").localeCompare(String(a.updatedAt || a.savedAt || "")));
}

function renderMobileExpenses() {
  const file = activeFile();
  const title = $("mobileExpensesFileTitle");
  if (!title) return;
  populateSelect($("mobileReceiptCategory"), mobileExpenseCategories, mobileReceiptDraft.category || "Supplies");
  populateSelect($("mobileManualExpenseCategory"), mobileExpenseCategories, "Supplies");
  $("mobileManualExpenseDate").value = $("mobileManualExpenseDate").value || dateKey(new Date());
  if (!file) {
    title.textContent = "Select a file";
    $("mobileExpensesFileMeta").textContent = "Use the file list first, then add receipts here.";
    $("mobileExpensesFileTotal").textContent = mobileCurrency.format(0);
    $("mobileSavedExpenseList").innerHTML = `<p class="mobile-helper">No file selected.</p>`;
    return;
  }
  hydrateMobileExpensesFromRevenue(file);
  title.textContent = file.clientName || "Unnamed Client";
  $("mobileExpensesFileMeta").textContent = `${file.fileNumber || "New File"} · ${file.projectType || "Other"}`;
  $("mobileExpensesFileTotal").textContent = mobileCurrency.format(mobileFileExpenseTotal(file));
  renderMobileReceiptReview();
  renderMobileSavedExpenses(file);
}

function renderMobileReceiptReview() {
  const card = $("mobileReceiptReviewCard");
  if (!card) return;
  card.hidden = !mobileReceiptDraft.imageDataUrl && !mobileReceiptDraft.lines.length && !mobileReceiptDraft.editingReceiptGroupId;
  $("mobileReceiptDate").value = mobileReceiptDraft.date || dateKey(new Date());
  $("mobileReceiptVendor").value = mobileReceiptDraft.vendor || "";
  populateSelect($("mobileReceiptCategory"), mobileExpenseCategories, mobileReceiptDraft.category || "Supplies");
  $("mobileReceiptTotal").value = mobileReceiptDraft.amount || "";
  $("mobileReceiptPaidBy").value = mobileReceiptDraft.paymentType || "";
  $("mobileReceiptCard").value = mobileReceiptDraft.cardName || "Chase Business";
  $("mobileReceiptCardWrap").hidden = $("mobileReceiptPaidBy").value !== "Credit";
  $("mobileReceiptImageTitle").value = mobileReceiptDraft.imageTitle || mobileReceiptDraft.fileName || "";
  $("mobileReceiptNotes").value = mobileReceiptDraft.notes || "";
  $("mobileReceiptPreview").innerHTML = mobileReceiptDraft.imageDataUrl
    ? `<img src="${mobileReceiptDraft.imageDataUrl}" alt="${escapeHtml(mobileReceiptDraft.imageTitle || mobileReceiptDraft.fileName || "Receipt")}">`
    : `<p class="mobile-helper">No receipt image attached.</p>`;
  const lines = mobileReceiptDraft.lines.length ? mobileReceiptDraft.lines : [blankMobileReceiptLine()];
  $("mobileReceiptLines").innerHTML = lines.map((line) => `
    <article class="mobile-receipt-line-card" data-mobile-receipt-line="${escapeHtml(line.id)}">
      <div class="mobile-line-top">
        <label class="mobile-check-row"><input type="checkbox" data-mobile-receipt-field="use" ${line.use !== false ? "checked" : ""}> Use</label>
        <strong>${mobileCurrency.format(line.use === false ? 0 : mobileReceiptLineTotal(line))}</strong>
      </div>
      <label>Item / Notes<textarea data-mobile-receipt-field="description" rows="3">${escapeHtml(line.description || "")}</textarea></label>
      <div class="mobile-grid mobile-expense-form-grid">
        <label>Category<select data-mobile-receipt-field="category">${expenseCategoryOptions(line.category || "Supplies")}</select></label>
        <label>Price<input data-mobile-receipt-field="price" type="text" inputmode="decimal" value="${escapeHtml(line.price || "")}" placeholder="0.00"></label>
        <label class="mobile-check-row full"><input data-mobile-receipt-field="addTax" type="checkbox" ${line.addTax ? "checked" : ""}> Add sales tax</label>
      </div>
      <button type="button" class="mobile-small-button" data-mobile-receipt-line-delete="${escapeHtml(line.id)}">Delete Line</button>
    </article>
  `).join("");
  $("mobileReceiptReviewTotal").textContent = mobileCurrency.format(mobileReceiptDraftTotal());
  $("mobileReceiptStatus").textContent = mobileReceiptDraft.status || "";
  document.querySelectorAll("[data-mobile-receipt-field]").forEach((field) => {
    field.addEventListener("input", () => {
      captureMobileReceiptDraft();
      $("mobileReceiptReviewTotal").textContent = mobileCurrency.format(mobileReceiptDraftTotal());
    });
    field.addEventListener("change", () => {
      captureMobileReceiptDraft();
      renderMobileReceiptReview();
    });
  });
  document.querySelectorAll("[data-mobile-receipt-line-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      captureMobileReceiptDraft();
      mobileReceiptDraft.lines = mobileReceiptDraft.lines.filter((line) => line.id !== button.dataset.mobileReceiptLineDelete);
      renderMobileReceiptReview();
    });
  });
}

function renderMobileSavedExpenses(file = activeFile()) {
  const receiptGroups = mobileReceiptHistoryGroups(file);
  const count = $("mobileSavedExpenseCount");
  if (count) count.textContent = String(receiptGroups.length);
  const list = $("mobileSavedExpenseList");
  if (!list) return;
  if (!receiptGroups.length) {
    list.innerHTML = `<p class="mobile-helper">No saved receipts or expenses yet.</p>`;
    return;
  }
  list.innerHTML = receiptGroups.map((entry) => {
    return `
      <article class="mobile-expense-item">
        <button type="button" data-mobile-expense-open="${escapeHtml(entry.id)}">
          <span>${escapeHtml(entry.label || "Saved expense")}</span>
          <strong>${mobileCurrency.format(Number(entry.total) || 0)}</strong>
          <small>${escapeHtml(formatDate(entry.date) || "No date")} · ${Number(entry.lineCount) || 0} line${Number(entry.lineCount) === 1 ? "" : "s"}</small>
        </button>
        <button type="button" class="mobile-small-button danger" data-mobile-expense-delete="${escapeHtml(entry.id)}">Delete</button>
      </article>
    `;
  }).join("");
  document.querySelectorAll("[data-mobile-expense-open]").forEach((button) => {
    button.addEventListener("click", () => openMobileSavedExpense(button.dataset.mobileExpenseOpen));
  });
  document.querySelectorAll("[data-mobile-expense-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteMobileExpenseGroup(button.dataset.mobileExpenseDelete));
  });
}

async function handleMobileReceiptFile(file) {
  const active = activeFile();
  if (!active) {
    window.alert("Select a customer file before adding a receipt.");
    return;
  }
  if (!file) return;
  showMobileReceiptLoading("Uploading receipt photo and reading it with AI...");
  const freshDraft = {
    ...blankMobileReceiptDraft(),
    fileName: file.name || "Receipt photo",
    imageTitle: file.name || "Receipt photo",
  };
  mobileReceiptDraft = {
    ...freshDraft,
    status: "Reading receipt with AI...",
  };
  try {
    const imageDataUrl = await readMobileFileAsDataUrl(file);
    mobileReceiptDraft = {
      ...freshDraft,
      imageDataUrl,
      status: "Reading receipt with AI...",
    };
    renderMobileExpenses();
    const result = await readMobileReceiptWithAi(imageDataUrl, file);
    mobileReceiptDraft = mobileReceiptResultToDraft(result, {
      imageDataUrl,
      fileName: file.name || "Receipt photo",
      date: dateKey(new Date()),
    });
  } catch (error) {
    mobileReceiptDraft = {
      ...freshDraft,
      imageDataUrl: mobileReceiptDraft.imageDataUrl || "",
      lines: [blankMobileReceiptLine({ description: file.name || "Receipt expense", addTax: true })],
      status: error.message || "Receipt attached. Review manually, then save.",
    };
  } finally {
    hideMobileReceiptLoading();
  }
  renderMobileExpenses();
}

async function saveMobileReceiptExpense() {
  const file = activeFile();
  if (!file) {
    window.alert("Select a customer file before saving a receipt.");
    return;
  }
  captureMobileReceiptDraft();
  const isEditingSavedReceipt = Boolean(mobileReceiptDraft.isEditingSavedReceipt && mobileReceiptDraft.editingReceiptGroupId);
  const groupId = isEditingSavedReceipt ? mobileReceiptDraft.editingReceiptGroupId : makeId("receiptGroup");
  const lines = mobileExpenseLinesFromDraft(groupId);
  if (!lines.length) {
    $("mobileReceiptStatus").textContent = "Add at least one receipt line before saving.";
    return;
  }
  file.expenseLines = Array.isArray(file.expenseLines) ? file.expenseLines : [];
  if (isEditingSavedReceipt) {
    file.expenseLines = file.expenseLines.filter((line) => (line.receiptGroupId || line.id) !== mobileReceiptDraft.editingReceiptGroupId);
  }
  file.expenseLines.push(...lines);
  upsertMobileReceiptHistoryGroup(file, groupId, lines);
  file.notes = Array.isArray(file.notes) ? file.notes : [];
  file.notes.push({
    at: new Date().toISOString(),
    text: `Mobile receipt ${isEditingSavedReceipt ? "updated" : "saved"}${mobileReceiptDraft.vendor ? ` from ${mobileReceiptDraft.vendor}` : ""} for ${mobileCurrency.format(mobileReceiptDraftTotal())}.`,
  });
  syncMobileFileExpensesToRevenue(file);
  mobileReceiptDraft = blankMobileReceiptDraft();
  saveLocalData();
  renderAll();
  setTab("expenses");
  try {
    await saveCloud();
  } catch (error) {
    window.alert("Expense saved on this device, but cloud save did not complete. Tap Save when your connection is working.");
  }
}

function openMobileSavedExpense(groupId) {
  const file = activeFile();
  const historyEntry = (file?.receiptHistory || []).find((entry) => entry.id === groupId);
  const groupLines = (file?.expenseLines || []).filter((line) => (line.receiptGroupId || line.id) === groupId);
  const sourceLines = groupLines.length ? groupLines : (Array.isArray(historyEntry?.lines) ? historyEntry.lines : []);
  if (!sourceLines.length) return;
  const first = sourceLines.find((line) => line.receiptDataUrl) || sourceLines[0];
  mobileReceiptDraft = {
    ...blankMobileReceiptDraft(),
    editingReceiptGroupId: groupId,
    isEditingSavedReceipt: true,
    imageDataUrl: first.receiptDataUrl || "",
    fileName: first.receiptFileName || "",
    imageTitle: first.receiptFileName || "",
    vendor: first.vendor || "",
    date: first.date || dateKey(new Date()),
    category: normalizeMobileExpenseCategory(first.category || "Supplies"),
    amount: sourceLines.reduce((sum, line) => sum + mobileExpenseFinalAmount(line), 0).toFixed(2),
    paymentType: first.paymentType && ["Cash", "Credit", "Other"].includes(first.paymentType) ? first.paymentType : "",
    cardName: first.paymentType && !["Cash", "Credit", "Other"].includes(first.paymentType) ? first.paymentType : "Chase Business",
    notes: sourceLines.map((line) => line.note || "").filter(Boolean).join("\n"),
    lines: sourceLines.map((line) => blankMobileReceiptLine({
      description: line.note || "",
      category: line.category || "Supplies",
      price: mobileExpenseBaseAmount(line) || "",
      addTax: Boolean(line.addTax),
    })),
    status: "Editing a saved receipt. Save Receipt will update it.",
  };
  renderMobileExpenses();
  $("mobileReceiptReviewCard")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function deleteMobileExpenseGroup(groupId) {
  const file = activeFile();
  if (!file) return;
  const ok = window.confirm("Delete this saved expense from the file?");
  if (!ok) return;
  file.expenseLines = (file.expenseLines || []).filter((line) => (line.receiptGroupId || line.id) !== groupId);
  refreshMobileReceiptHistoryGroup(file, groupId);
  syncMobileFileExpensesToRevenue(file);
  saveLocalData();
  renderAll();
  setTab("expenses");
  saveCloud().catch(() => {});
}

async function addMobileManualExpense() {
  const file = activeFile();
  if (!file) {
    window.alert("Select a customer file before adding an expense.");
    return;
  }
  const baseAmount = parseMoney($("mobileManualExpenseAmount").value);
  const vendor = $("mobileManualExpenseVendor").value.trim();
  const note = $("mobileManualExpenseNotes").value.trim();
  if (!baseAmount && !vendor && !note) {
    window.alert("Add an amount, vendor, or note first.");
    return;
  }
  const addTax = Boolean($("mobileManualExpenseTax").checked);
  const tax = addTax ? baseAmount * MOBILE_DEFAULT_EXPENSE_TAX_RATE : 0;
  file.expenseLines = Array.isArray(file.expenseLines) ? file.expenseLines : [];
  const manualLine = {
    id: makeId("expense"),
    receiptGroupId: makeId("manualExpense"),
    date: $("mobileManualExpenseDate").value || dateKey(new Date()),
    category: normalizeMobileExpenseCategory($("mobileManualExpenseCategory").value || "Supplies"),
    vendor,
    note: note || vendor || "Manual expense",
    baseAmount,
    amount: baseAmount + tax,
    tax,
    addTax,
    taxRate: MOBILE_DEFAULT_EXPENSE_TAX_RATE,
    paymentType: "",
    receiptFileName: "",
    receiptDataUrl: "",
    receiptSource: "Mobile manual entry",
  };
  file.expenseLines.push(manualLine);
  upsertMobileReceiptHistoryGroup(file, manualLine.receiptGroupId, [manualLine]);
  syncMobileFileExpensesToRevenue(file);
  $("mobileManualExpenseVendor").value = "";
  $("mobileManualExpenseAmount").value = "";
  $("mobileManualExpenseNotes").value = "";
  $("mobileManualExpenseTax").checked = true;
  saveLocalData();
  renderAll();
  setTab("expenses");
  try {
    await saveCloud();
  } catch (error) {
    window.alert("Expense saved on this device, but cloud save did not complete. Tap Save when your connection is working.");
  }
}

function loadMobileEstimator() {
  const frame = $("mobileEstimatorFrame");
  if (!frame.getAttribute("src")) {
    const url = new URL("index.html", window.location.href);
    url.searchParams.set("embedded", "1");
    url.searchParams.set("mobile", "1");
    frame.src = url.toString();
  }
}

function openEstimateForFile() {
  const file = activeFile();
  const frame = $("mobileEstimatorFrame");
  if (file?.editableEstimate) {
    localStorage.setItem("d2EstimateStudio", JSON.stringify(file.editableEstimate));
    const url = new URL("index.html", window.location.href);
    url.searchParams.set("fromDashboard", "1");
    url.searchParams.set("embedded", "1");
    url.searchParams.set("mobile", "1");
    url.searchParams.set("open", Date.now().toString());
    frame.src = url.toString();
  }
  setTab("estimate");
}

function renderAll() {
  renderFiles();
  renderDetail();
  renderCalendar();
  renderRevenue();
  renderMobileExpenses();
}

document.querySelectorAll("[data-mobile-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    setTab(button.dataset.mobileTab);
    closeMobileMenu();
  });
});

$("mobileMenuButton").addEventListener("click", openMobileMenu);
$("mobileMenuClose").addEventListener("click", closeMobileMenu);
$("mobileMenuBackdrop").addEventListener("click", closeMobileMenu);
$("mobileFileFilter").addEventListener("change", renderFiles);
$("mobileSearch").addEventListener("input", renderFiles);
$("mobileNewFile").addEventListener("click", () => {
  newFile();
  closeMobileMenu();
});
$("mobileSaveCloud").addEventListener("click", () => {
  saveCloud().then(closeMobileMenu).catch(() => window.alert("Cloud save could not complete."));
});
$("mobileLoadCloud").addEventListener("click", () => {
  loadCloud().then(closeMobileMenu).catch(() => window.alert("Cloud load could not complete."));
});
$("mobileAddNote").addEventListener("click", addNote);
$("mobileFileStatus").addEventListener("change", () => {
  const file = activeFile();
  if (!file) return;
  file.fileStatus = $("mobileFileStatus").value;
  file.statusDetail = mobileStatusDetails[file.fileStatus]?.[0] || "";
  renderStatusDetailOptions(file);
  captureDetailFields();
  renderFiles();
});
$("mobileOpenEstimate").addEventListener("click", openEstimateForFile);
$("mobileOpenExpenses").addEventListener("click", () => setTab("expenses"));
$("mobilePrevMonth").addEventListener("click", () => {
  mobileCalendarCursor = new Date(mobileCalendarCursor.getFullYear(), mobileCalendarCursor.getMonth() - 1, 1);
  renderCalendar();
});
$("mobileNextMonth").addEventListener("click", () => {
  mobileCalendarCursor = new Date(mobileCalendarCursor.getFullYear(), mobileCalendarCursor.getMonth() + 1, 1);
  renderCalendar();
});
$("mobileImportGoogleCalendar").addEventListener("click", () => {
  importMobileGoogleCalendar().catch(() => window.alert("Google Calendar could not be imported. Confirm the Google Apps Script is deployed and authorized."));
});
$("mobileSyncCalendar").addEventListener("click", () => {
  syncMobileUpcomingCalendar().catch(() => window.alert("Calendar sync could not be sent. Check the Google connection and try again."));
});
$("mobileOpenGoogleCalendar").addEventListener("click", () => {
  window.open("https://calendar.google.com/calendar/u/0/r", "_blank", "noopener");
});
$("mobileOpenDesktop").addEventListener("click", () => {
  window.location.href = "crm.html";
});
$("mobileOpenPriceDb").addEventListener("click", () => {
  window.location.href = "crm.html?view=prices";
});
$("mobileTakeReceiptPhoto").addEventListener("click", () => $("mobileReceiptCameraInput").click());
$("mobileUploadReceiptPhoto").addEventListener("click", () => $("mobileReceiptUploadInput").click());
$("mobileReceiptCameraInput").addEventListener("change", (event) => {
  handleMobileReceiptFile(event.target.files?.[0]).catch(() => window.alert("The receipt photo could not be read."));
  event.target.value = "";
});
$("mobileReceiptUploadInput").addEventListener("change", (event) => {
  handleMobileReceiptFile(event.target.files?.[0]).catch(() => window.alert("The receipt image could not be read."));
  event.target.value = "";
});
$("mobileReceiptPaidBy").addEventListener("change", () => {
  captureMobileReceiptDraft();
  renderMobileReceiptReview();
});
$("mobileClearReceiptDraft").addEventListener("click", () => {
  mobileReceiptDraft = blankMobileReceiptDraft();
  renderMobileExpenses();
});
$("mobileAddReceiptLine").addEventListener("click", () => {
  captureMobileReceiptDraft();
  mobileReceiptDraft.lines.push(blankMobileReceiptLine({ addTax: true }));
  renderMobileReceiptReview();
});
$("mobileSaveReceiptExpense").addEventListener("click", saveMobileReceiptExpense);
$("mobileAddManualExpense").addEventListener("click", addMobileManualExpense);

setupMobileCollapsibles();

document.querySelectorAll("#mobileDetailView input, #mobileDetailView select, #mobileDetailView textarea").forEach((field) => {
  if (field.id === "mobileNewNote") return;
  field.addEventListener("change", () => {
    captureDetailFields();
    renderDetail();
    renderFiles();
  });
});

loadLocalData();
renderAll();
setTab("files");
loadCloudOnStartup().then((loaded) => {
  if (loaded) setTab(mobileCurrentTab || "files");
});
