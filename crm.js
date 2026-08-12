const crmCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const CRM_STORAGE_KEY = "d2CrmDemoFiles";
const CRM_REVENUE_STORAGE_KEY = "d2CrmRevenueRows";
const CRM_PRICE_DATABASE_KEY = "d2PriceDatabase";
const CRM_PRICE_DELETED_KEY = "d2PriceDeletedIds";
const CRM_EXTERNAL_CALENDAR_KEY = "d2ExternalCalendarEvents";
const CRM_STORAGE_BACKUP_KEY = "d2CrmDemoFilesBackup";
const CRM_REVENUE_BACKUP_KEY = "d2CrmRevenueRowsBackup";
const CRM_REVENUE_DELETED_KEY = "d2CrmRevenueDeletedIds";
const CRM_PRICE_BACKUP_KEY = "d2PriceDatabaseBackup";
const CRM_RECEIPT_DRAFT_KEY = "d2ReceiptScannerDraft";
const CRM_RESTORE_VERSION_KEY = "d2CrmRestoreVersion";
const DEFAULT_GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzZkie1W4LplkKwFoMq19suIHWsamKYNUwCt9xjnihTdy_dN271ou3lscTgq09bAGIG2w/exec";
const OLD_GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxFBQzWViCApvF-c95kAyT0oSNImMgzhf30gP10H2WJT_S5XkejFctq5bT7IjCALMi5Qg/exec";
const GOOGLE_SCRIPT_URL_STORAGE_KEY = "d2GoogleScriptUrl";
const CLOUDFLARE_DASHBOARD_API = "/api/dashboard";
const NOTE_EDIT_WINDOW_MS = 12 * 60 * 60 * 1000;

const CRM_STATUS_DESCRIPTIONS = {
  "New Lead": "Inquiry received from your website, social media, or local referral.",
  "Contact Established": "You have spoken to the client and are actively qualifying their project scope.",
  "Contact Attempted": "A contact attempt was made. Set a next-day follow-up reminder.",
  "Inspection Completed": "You met the client, took site dimensions, and discussed wood types/finishes.",
  "In Negotiation": "Customer is considering the estimate. Set a follow-up date and keep it out of active jobs.",
  "Job Won": "The customer approved the job. Confirm whether the start date is established.",
  "In Progress": "Job has started. Confirm expected completion date and midpoint deposit.",
  "Work Completed": "Work is complete. Confirm closing call, review request, and final payment.",
  "Closed / Paid": "Job folder is archived and contact info is saved for future marketing.",
  "Job Lost / Closed": "Archive the file and save contact info for future marketing.",
};

const CRM_STATUS_DETAILS = {
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

const CRM_PROJECT_TYPES = ["Closet", "Pantry", "Cabinetry", "Refinishing", "Built-In", "Other"];

const CRM_FILE_CATEGORY_RULES = {
  new: "new",
  contact: "contact",
  estimate: "estimate",
  negotiation: "negotiation",
  active: "active",
  archive: "archive",
};

function hasEstimateWorkflowDetail(file) {
  return ["Inspection Pending", "Inspection Date Set", "Estimate Attached", "Estimate Pending", "Estimate Sent"].includes(file.statusDetail)
    || ["Pending", "Sent", "Approved"].includes(file.estimateStatus);
}

function crmFileCategory(file = {}) {
  const status = file.fileStatus || "New Lead";
  if (["Job Lost / Closed", "Closed / Paid"].includes(status)) return CRM_FILE_CATEGORY_RULES.archive;
  if (status === "In Negotiation") return CRM_FILE_CATEGORY_RULES.negotiation;
  if (["Job Won", "In Progress", "Work Completed"].includes(status)) return CRM_FILE_CATEGORY_RULES.active;
  if (["Scheduled", "In Progress", "Completed"].includes(file.projectStage)) return CRM_FILE_CATEGORY_RULES.active;
  if (hasEstimateWorkflowDetail(file) || status === "Inspection Completed") return CRM_FILE_CATEGORY_RULES.estimate;
  if (["Contact Established", "Contact Attempted"].includes(status)) return CRM_FILE_CATEGORY_RULES.contact;
  if (status === "New Lead") return CRM_FILE_CATEGORY_RULES.new;
  return CRM_FILE_CATEGORY_RULES.new;
}

function repairCrmFileCategory(file) {
  const category = crmFileCategory(file);
  file.workflowCategory = category;
  return file;
}

function repairCrmFileCategories(files = crmFiles) {
  return files.map((file) => repairCrmFileCategory(file));
}


function normalizeProjectType(value) {
  const cleaned = String(value || "").trim().toLowerCase();
  const match = CRM_PROJECT_TYPES.find((type) => type.toLowerCase() === cleaned);
  return match || "Other";
}

const crmFields = [
  "clientName",
  "clientPhone",
  "clientEmail",
  "projectAddress",
  "leadSource",
  "fileStatus",
  "statusDetail",
  "projectType",
  "contactEmailSent",
  "contactTextSent",
  "inspectionDateSet",
  "inspectionDate",
  "inspectionTime",
  "startDate",
  "arrivalWindow",
  "followUpDate",
  "anticipatedCompletionDate",
  "nextAction",
  "nextActionDate",
  "warrantyStatus",
  "depositSecured",
  "initialDepositSecured",
  "initialDeposit",
  "midpointDepositSecured",
  "midpointDeposit",
  "paidInFull",
  "closingCallCompleted",
  "finalPaymentSecured",
  "finalPaymentAmount",
  "invoiceSent",
  "reviewRequested",
  "reviewSent",
  "estimateStatus",
  "invoiceStatus",
  "reviewStatus",
];

const trackedStatusFields = {
  fileStatus: "File status",
  estimateStatus: "Estimate status",
  invoiceStatus: "Invoice status",
  reviewStatus: "Review status",
};

const $ = (id) => document.getElementById(id);

let crmRestoreAppliedThisLoad = false;
let crmFiles = loadCrmFiles();
let activeFileId = crmFiles[0] ? crmFiles[0].id : null;
let crmRevenueRows = loadRevenueRows();
let activeRevenueId = crmRevenueRows[0] ? crmRevenueRows[0].id : null;
let crmRevenueDateSort = "newest";
let crmRevenueYearFilter = String(new Date().getFullYear());
let crmCalendarFilter = "upcoming";
let crmCalendarCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let crmSelectedCalendarDate = todayIso(0);
let crmSelectedCalendarEventKey = "";
let crmExternalCalendarEvents = loadExternalCalendarEvents();
let crmPriceRows = loadPriceRows();
let crmDeletedPriceIds = loadDeletedPriceIds();
let editingPriceId = "";
let receiptDraft = loadReceiptDraft();
let pendingEstimateUploadFileId = "";
let openEstimateAfterUpload = false;
let estimateChoiceTarget = "";

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

function todayIso(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

function makeCrmFileNumber() {
  const date = new Date();
  const year = String(date.getFullYear()).slice(2);
  const existingNumbers = crmFiles
    .map((file) => String(file.fileNumber || ""))
    .map((value) => value.match(new RegExp(`^${year}-([A-Z])(\\d{4})$`)))
    .filter(Boolean)
    .map((match) => ({ series: match[1], number: Number(match[2]) }));
  for (let code = 65; code <= 90; code += 1) {
    const series = String.fromCharCode(code);
    const maxInSeries = existingNumbers
      .filter((entry) => entry.series === series)
      .reduce((max, entry) => Math.max(max, entry.number), 1000);
    if (maxInSeries < 9999) return `${year}-${series}${String(maxInSeries + 1).padStart(4, "0")}`;
  }
  return `${year}-Z${Date.now()}`;
}

function makeCrmId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function defaultFiles() {
  return [];
}

function restoredDashboardFiles() {
  return Array.isArray(window.D2_DASHBOARD_RESTORE?.files)
    ? window.D2_DASHBOARD_RESTORE.files.map((file) => ({ ...file }))
    : [];
}

function dashboardRestoreVersion() {
  return String(window.D2_DASHBOARD_RESTORE?.restoredAt || "");
}

function shouldApplyDashboardRestore() {
  const version = dashboardRestoreVersion();
  if (!version) return false;
  try {
    return localStorage.getItem(CRM_RESTORE_VERSION_KEY) !== version;
  } catch (error) {
    return true;
  }
}

function markDashboardRestoreApplied() {
  const version = dashboardRestoreVersion();
  if (!version) return;
  try {
    localStorage.setItem(CRM_RESTORE_VERSION_KEY, version);
  } catch (error) {
    // Local storage can be blocked in some browser privacy modes.
  }
}

function mergeDashboardFiles(primary = [], secondary = []) {
  const merged = [];
  const seen = new Set();
  [...primary, ...secondary].forEach((file) => {
    const key = String(file.fileNumber || file.id || file.clientName || "").trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push({ ...file });
  });
  return merged;
}

function defaultRevenueRows() {
  if (Array.isArray(window.D2_REVENUE_ROWS)) {
    return window.D2_REVENUE_ROWS.map((row) => ({ ...row }));
  }
  return [
    {
      id: "rev-visible-1",
      date: "2026-03-25",
      clientJob: "Liz-Misc",
      gross: 100,
      expenses: 0,
      labor: 0,
      profit: 100,
      receiptNotes: "",
      laborAssigns: "",
    },
    {
      id: "rev-visible-2",
      date: "2026-03-25",
      clientJob: "David Neville - Drywall",
      gross: 50,
      expenses: 0,
      labor: 0,
      profit: 50,
      receiptNotes: "",
      laborAssigns: "",
    },
    {
      id: "rev-visible-3",
      date: "2026-03-26",
      clientJob: "Brian-Misc",
      gross: 450,
      expenses: 0,
      labor: 0,
      profit: 450,
      receiptNotes: "",
      laborAssigns: "",
    },
    {
      id: "rev-visible-4",
      date: "2026-04-07",
      clientJob: "Donna - Slide Outs",
      gross: 2990,
      expenses: 990,
      labor: 0,
      profit: 2000,
      receiptNotes: "",
      laborAssigns: "",
    },
    {
      id: "rev-visible-5",
      date: "2026-04-25",
      clientJob: "Bob-Planks",
      gross: 2290,
      expenses: 290,
      labor: 0,
      profit: 2000,
      receiptNotes: "",
      laborAssigns: "",
    },
    {
      id: "rev-visible-6",
      date: "2026-05-05",
      clientJob: "Jake - Fascia Board",
      gross: 596,
      expenses: 0,
      labor: 0,
      profit: 596,
      receiptNotes: "",
      laborAssigns: "",
    },
    {
      id: "rev-visible-7",
      date: "2026-05-08",
      clientJob: "Jake - Fascia Board",
      gross: 350,
      expenses: 0,
      labor: 0,
      profit: 350,
      receiptNotes: "",
      laborAssigns: "",
    },
    {
      id: "rev-visible-8",
      date: "2026-05-18",
      clientJob: "Jim Goodman-Cabinet Staining",
      gross: 600,
      expenses: 282.33,
      labor: 0,
      profit: 317.67,
      receiptNotes: "Home Depot $70.74",
      laborAssigns: "",
    },
    {
      id: "rev-visible-9",
      date: "2026-05-25",
      clientJob: "Laurie - Concrete Counters",
      gross: 3162,
      expenses: 393.72,
      labor: 1000,
      profit: 1768.28,
      receiptNotes: "SW: $18.09",
      laborAssigns: "Nesto",
    },
    {
      id: "rev-visible-10",
      date: "2026-06-01",
      clientJob: "Deb-Fan and Lights",
      gross: 542,
      expenses: 272.04,
      labor: 0,
      profit: 269.96,
      receiptNotes: "",
      laborAssigns: "",
    },
    {
      id: "rev-visible-11",
      date: "2026-06-11",
      clientJob: "Ana - Abi Closet",
      gross: 1850,
      expenses: 573.62,
      labor: 0,
      profit: 1276.38,
      receiptNotes: "IMECA-$237.96 + 72.85",
      laborAssigns: "",
    },
  ];
}

function loadCrmFiles() {
  const restoredFiles = restoredDashboardFiles();
  const applyRestore = shouldApplyDashboardRestore();
  try {
    const saved = localStorage.getItem(CRM_STORAGE_KEY);
    if (saved) {
      const files = JSON.parse(saved);
      if (Array.isArray(files) && files.length) {
        if (applyRestore && restoredFiles.length) {
          crmRestoreAppliedThisLoad = true;
          return repairCrmFileCategories(mergeDashboardFiles(restoredFiles, files).map((file) => normalizeCrmFile({ ...file })));
        }
        return repairCrmFileCategories(files.map((file) => normalizeCrmFile({ ...file })));
      }
      const backup = localStorage.getItem(CRM_STORAGE_BACKUP_KEY);
      const backupFiles = backup ? JSON.parse(backup) : [];
      if (Array.isArray(backupFiles) && backupFiles.length) {
        if (applyRestore && restoredFiles.length) {
          crmRestoreAppliedThisLoad = true;
          return repairCrmFileCategories(mergeDashboardFiles(restoredFiles, backupFiles).map((file) => normalizeCrmFile({ ...file })));
        }
        return repairCrmFileCategories(backupFiles.map((file) => normalizeCrmFile({ ...file })));
      }
      if (restoredFiles.length) {
        crmRestoreAppliedThisLoad = true;
        return repairCrmFileCategories(restoredFiles.map((file) => normalizeCrmFile({ ...file })));
      }
      return Array.isArray(files) && files.length ? files : defaultFiles();
    }
  } catch (error) {
    // Local demo storage may be unavailable in some browsers.
  }
  if (restoredFiles.length) {
    crmRestoreAppliedThisLoad = true;
    return repairCrmFileCategories(restoredFiles.map((file) => normalizeCrmFile({ ...file })));
  }
  return defaultFiles();
}

function loadRevenueRows() {
  const restoredRows = Array.isArray(window.D2_DASHBOARD_RESTORE?.revenue)
    ? window.D2_DASHBOARD_RESTORE.revenue.map((row) => ({ ...row }))
    : [];
  const spreadsheetRows = defaultRevenueRows();
  const deletedKeys = loadDeletedRevenueKeys();
  try {
    const saved = localStorage.getItem(CRM_REVENUE_STORAGE_KEY);
    if (saved) {
      const rows = JSON.parse(saved);
      if (Array.isArray(rows)) {
        if (!rows.length) {
          const backup = localStorage.getItem(CRM_REVENUE_BACKUP_KEY);
          const backupRows = backup ? JSON.parse(backup) : [];
          if (Array.isArray(backupRows) && backupRows.length) return filterDeletedRevenueRows(dedupeRevenueRows(backupRows), deletedKeys);
          if (restoredRows.length) return filterDeletedRevenueRows(dedupeRevenueRows(restoredRows), deletedKeys);
        }
        return filterDeletedRevenueRows(restoredRows.length ? dedupeRevenueRows(mergeRevenueRows(rows, restoredRows)) : dedupeRevenueRows(rows), deletedKeys);
      }
    }
  } catch (error) {
    // Local demo storage may be unavailable in some browsers.
  }
  if (restoredRows.length) return filterDeletedRevenueRows(dedupeRevenueRows(restoredRows), deletedKeys);
  return filterDeletedRevenueRows(dedupeRevenueRows(spreadsheetRows), deletedKeys);
}

function loadPriceRows() {
  const restoredRows = restoredPriceRows();
  try {
    const saved = localStorage.getItem(CRM_PRICE_DATABASE_KEY);
    const rows = saved ? JSON.parse(saved) : [];
    if (Array.isArray(rows) && rows.length) return mergePriceRows(restoredRows, rows);
    const backup = localStorage.getItem(CRM_PRICE_BACKUP_KEY);
    const backupRows = backup ? JSON.parse(backup) : [];
    if (Array.isArray(backupRows) && backupRows.length) return mergePriceRows(restoredRows, backupRows);
    if (restoredRows.length) return restoredRows;
    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    return restoredRows;
  }
}

function normalizedPriceRow(row = {}) {
  const product = row.product || row.name || row.item || "";
  const vendor = row.vendor || row.source || "";
  return {
    ...row,
    id: row.id || row.sourceId || makeCrmId("price"),
    product,
    name: row.name || product,
    vendor,
    source: row.source || vendor,
    category: row.category || "Custom",
    unit: row.unit || "each",
    defaultPrice: Number(row.defaultPrice ?? row.price ?? row.priceLow ?? row.priceHigh) || 0,
  };
}

function restoredPriceRows() {
  return Array.isArray(window.D2_DASHBOARD_RESTORE?.prices)
    ? window.D2_DASHBOARD_RESTORE.prices.map((row) => normalizedPriceRow(row))
    : [];
}

function priceRowKey(row = {}) {
  return String(row.sourceId || row.id || row.product || row.name || "")
    .trim()
    .toLowerCase();
}

function mergePriceRows(primary = [], secondary = []) {
  const merged = [];
  const seen = new Set();
  [...primary, ...secondary].forEach((row) => {
    const normalized = normalizedPriceRow(row);
    const key = priceRowKey(normalized);
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push(normalized);
  });
  return merged;
}

function loadDeletedPriceIds() {
  try {
    const saved = localStorage.getItem(CRM_PRICE_DELETED_KEY);
    const ids = saved ? JSON.parse(saved) : [];
    return Array.isArray(ids) ? ids : [];
  } catch (error) {
    return [];
  }
}

function saveCrmFiles() {
  try {
    if (Array.isArray(crmFiles) && crmFiles.length) {
      localStorage.setItem(CRM_STORAGE_BACKUP_KEY, JSON.stringify(crmFiles));
    }
    crmFiles = repairCrmFileCategories(crmFiles);
    localStorage.setItem(CRM_STORAGE_KEY, JSON.stringify(crmFiles));
  } catch (error) {
    // Google Drive will become the real storage layer.
  }
}

function refreshCrmFilesFromStorage() {
  try {
    const saved = localStorage.getItem(CRM_STORAGE_KEY);
    const files = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(files) || !files.length) return false;
    const currentActiveId = activeFileId;
    crmFiles = repairCrmFileCategories(files.map((file) => normalizeCrmFile(file)));
    if (currentActiveId && crmFiles.some((file) => file.id === currentActiveId)) {
      activeFileId = currentActiveId;
    } else {
      activeFileId = crmFiles[0] ? crmFiles[0].id : null;
    }
    return true;
  } catch (error) {
    return false;
  }
}

function saveRevenueRows() {
  try {
    crmRevenueRows = dedupeRevenueRows(crmRevenueRows);
    if (Array.isArray(crmRevenueRows) && crmRevenueRows.length) {
      localStorage.setItem(CRM_REVENUE_BACKUP_KEY, JSON.stringify(crmRevenueRows));
    }
    localStorage.setItem(CRM_REVENUE_STORAGE_KEY, JSON.stringify(crmRevenueRows));
  } catch (error) {
    // Google Drive will become the real storage layer.
  }
}

function savePriceRows() {
  try {
    if (Array.isArray(crmPriceRows) && crmPriceRows.length) {
      localStorage.setItem(CRM_PRICE_BACKUP_KEY, JSON.stringify(crmPriceRows));
    }
    localStorage.setItem(CRM_PRICE_DATABASE_KEY, JSON.stringify(crmPriceRows));
  } catch (error) {
    // Local storage can be blocked in some browser privacy modes.
  }
}

function saveDeletedPriceIds() {
  try {
    localStorage.setItem(CRM_PRICE_DELETED_KEY, JSON.stringify(crmDeletedPriceIds));
  } catch (error) {
    // Local storage can be blocked in some browser privacy modes.
  }
}

function loadExternalCalendarEvents() {
  try {
    const saved = localStorage.getItem(CRM_EXTERNAL_CALENDAR_KEY);
    const events = saved ? JSON.parse(saved) : [];
    return Array.isArray(events) ? events.map(normalizeExternalCalendarEvent).filter(Boolean) : [];
  } catch (error) {
    return [];
  }
}

function saveExternalCalendarEvents() {
  try {
    localStorage.setItem(CRM_EXTERNAL_CALENDAR_KEY, JSON.stringify(crmExternalCalendarEvents));
  } catch (error) {
    // Local storage can be blocked in some browser privacy modes.
  }
}

function persistRestoredDashboardIfNeeded() {
  if (!crmRestoreAppliedThisLoad) return;
  if (Array.isArray(crmFiles) && crmFiles.length) saveCrmFiles();
  if (Array.isArray(crmRevenueRows) && crmRevenueRows.length) saveRevenueRows();
  if (Array.isArray(crmPriceRows) && crmPriceRows.length) savePriceRows();
  markDashboardRestoreApplied();
  crmRestoreAppliedThisLoad = false;
}

function buildDashboardSyncPayload() {
  captureCurrentDashboardEdits();
  return {
    action: "dashboardSync",
    syncedAt: new Date().toISOString(),
    source: "D2 Command Center",
    dashboardFiles: crmFiles,
    revenueRows: crmRevenueRows,
    priceRows: crmPriceRows,
    deletedPriceIds: crmDeletedPriceIds,
  };
}

function dashboardCloudCounts(files = []) {
  const counts = {
    new: 0,
    contact: 0,
    estimate: 0,
    negotiation: 0,
    active: 0,
    archive: 0,
  };
  files.forEach((file) => {
    const category = file.category || crmFileCategory(file);
    if (Object.prototype.hasOwnProperty.call(counts, category)) counts[category] += 1;
  });
  return counts;
}

function dashboardCloudCountSummary(files = []) {
  const counts = dashboardCloudCounts(files);
  return [
    `New Leads ${counts.new}`,
    `Pending Contact ${counts.contact}`,
    `Pending Estimates ${counts.estimate}`,
    `In Negotiation ${counts.negotiation}`,
    `Active Jobs ${counts.active}`,
    `Closed Files ${counts.archive}`,
  ].join(" | ");
}

function showDashboardSaveStatus(message, isError = false) {
  const status = $("crmSaveStatus");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("error", isError);
  status.classList.add("visible");
  window.clearTimeout(showDashboardSaveStatus.timeoutId);
  showDashboardSaveStatus.timeoutId = window.setTimeout(() => {
    status.classList.remove("visible", "error");
    status.textContent = "";
  }, 6500);
}

function postPayloadToGoogle(payload) {
  const googleScriptUrl = getGoogleScriptUrl() || requestGoogleScriptUrl();
  if (!googleScriptUrl) return Promise.resolve(false);

  const body = new FormData();
  body.append("payload", JSON.stringify(payload));

  fetch(googleScriptUrl, {
    method: "POST",
    mode: "no-cors",
    keepalive: true,
    body,
  }).catch(() => {});
  return Promise.resolve(true);
}

async function postPayloadToCloudflare(payload) {
  const response = await fetch(CLOUDFLARE_DASHBOARD_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok === false) {
    throw new Error(result.error || `Cloudflare save failed with status ${response.status}.`);
  }
  return result;
}

async function fetchDashboardFromCloudflare() {
  const response = await fetch(`${CLOUDFLARE_DASHBOARD_API}?t=${Date.now()}`, {
    method: "GET",
    cache: "no-store",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok === false) {
    throw new Error(result.error || `Cloudflare load failed with status ${response.status}.`);
  }
  return result.dashboard || null;
}

function postCalendarEventToGoogle(event) {
  return postPayloadToGoogle({
    action: "calendarEvent",
    calendarEvent: event,
  });
}

function captureOpenFinancialEdits() {
  const file = normalizeCrmFile(activeFile());
  if (!file) return;
  const estimatePanel = $("crmEstimateEditPanel");
  const estimateInput = $("crmEstimateAmountInput");
  if (estimatePanel && estimateInput && !estimatePanel.hidden) {
    const oldAmount = Number(file.estimateTotal) || 0;
    const newAmount = parseMoney(estimateInput.value);
    file.estimateTotal = newAmount;
    if (file.editableEstimate?.totals) file.editableEstimate.totals.total = newAmount;
    if (oldAmount !== newAmount) {
      addSystemNote(file, `Estimate amount changed from ${crmCurrency.format(oldAmount)} to ${crmCurrency.format(newAmount)}.`);
    }
  }
  const materialPanel = $("crmMaterialEditPanel");
  const materialInput = $("crmMaterialAmountInput");
  if (materialPanel && materialInput && !materialPanel.hidden) {
    const oldAmount = Number(file.materialTotal) || 0;
    const newAmount = parseMoney(materialInput.value);
    file.materialTotal = newAmount;
    if (file.editableEstimate?.backend) file.editableEstimate.backend.estimatedMaterialCost = newAmount;
    if (oldAmount !== newAmount) {
      addSystemNote(file, `Materials amount changed from ${crmCurrency.format(oldAmount)} to ${crmCurrency.format(newAmount)}.`);
    }
  }
}

function captureVisibleRevenueEdits() {
  document.querySelectorAll("[data-revenue-edit]").forEach((field) => {
    const row = crmRevenueRows.find((entry) => entry.id === field.dataset.revenueEdit);
    if (!row) return;
    const key = field.dataset.revenueField;
    if (["gross", "expenses", "labor"].includes(key)) {
      row[key] = parseMoney(field.value);
    } else if (key === "date") {
      row[key] = normalizeDate(field.value);
    } else {
      row[key] = field.value;
    }
    row.profit = revenueProfit(row);
    syncRevenueExpenseTotal(row);
  });
  syncActiveExpenseDetailEdits();
}

function captureVisibleFileExpenseEdits() {
  const file = normalizeCrmFile(activeFile());
  if (!file || !Array.isArray(file.expenseLines)) return;
  document.querySelectorAll("[data-file-expense-field]").forEach((field) => {
    const line = file.expenseLines.find((entry) => entry.id === field.dataset.fileExpenseId);
    if (!line) return;
    const key = field.dataset.fileExpenseField;
    line[key] = key === "amount" ? parseMoney(field.value) : field.value;
  });
  syncFileExpensesToRevenue(file);
}

function captureCurrentDashboardEdits() {
  if (document.activeElement && typeof document.activeElement.blur === "function") {
    document.activeElement.blur();
  }
  saveActiveFile();
  captureOpenFinancialEdits();
  captureVisibleFileExpenseEdits();
  captureVisibleRevenueEdits();
}

function fetchGoogleCalendarEvents(startDate, endDate) {
  const googleScriptUrl = getGoogleScriptUrl() || requestGoogleScriptUrl();
  if (!googleScriptUrl) return Promise.resolve([]);
  return new Promise((resolve, reject) => {
    const callbackName = `d2CalendarImport${Date.now()}${Math.random().toString(16).slice(2)}`;
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Google Calendar import timed out."));
    }, 20000);

    function cleanup() {
      window.clearTimeout(timeout);
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

    const url = new URL(googleScriptUrl);
    url.searchParams.set("action", "calendarEvents");
    url.searchParams.set("start", startDate);
    url.searchParams.set("end", endDate);
    url.searchParams.set("callback", callbackName);
    script.onerror = () => {
      cleanup();
      reject(new Error("Google Calendar import could not load."));
    };
    script.src = url.toString();
    document.body.appendChild(script);
  });
}

function fetchDashboardFromGoogle() {
  const googleScriptUrl = getGoogleScriptUrl() || requestGoogleScriptUrl();
  if (!googleScriptUrl) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const callbackName = `d2DashboardImport${Date.now()}${Math.random().toString(16).slice(2)}`;
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Dashboard cloud load timed out."));
    }, 20000);

    function cleanup() {
      window.clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = (response) => {
      cleanup();
      if (!response || response.ok === false) {
        reject(new Error(response?.error || "Dashboard cloud load failed."));
        return;
      }
      resolve(response.dashboard || null);
    };

    const url = new URL(googleScriptUrl);
    url.searchParams.set("action", "dashboardData");
    url.searchParams.set("callback", callbackName);
    script.onerror = () => {
      cleanup();
      reject(new Error("Dashboard cloud load could not connect."));
    };
    script.src = url.toString();
    document.body.appendChild(script);
  });
}

async function saveDashboardToGoogle() {
  captureCurrentDashboardEdits();
  saveCrmFiles();
  saveRevenueRows();
  savePriceRows();
  saveDeletedPriceIds();
  const saveButton = $("crmSaveDemo");
  saveButton.disabled = true;
  saveButton.textContent = "Saving...";
  showDashboardSaveStatus("Saving current Command Center...");
  const payload = buildDashboardSyncPayload();
  try {
    const saved = await postPayloadToCloudflare(payload);
    saveButton.disabled = false;
    saveButton.textContent = "Saved";
    renderCrm();
    const savedFiles = Array.isArray(saved.dashboard?.dashboardFiles) ? saved.dashboard.dashboardFiles : payload.dashboardFiles;
    showDashboardSaveStatus(`Saved ${savedFiles.length} files to Cloudflare. ${dashboardCloudCountSummary(savedFiles)}.`);
    window.setTimeout(() => {
      saveButton.textContent = "Save";
    }, 1400);
  } catch (error) {
    saveButton.disabled = false;
    saveButton.textContent = "Save";
    showDashboardSaveStatus(error.message || "Cloudflare save failed.", true);
  }
}

async function loadDashboardFromGoogle() {
  const confirmed = window.confirm("Restore the latest Command Center backup from Cloudflare? This will replace the data currently shown in this browser.");
  if (!confirmed) return;
  const button = $("crmLoadCloud");
  if (button) button.textContent = "Loading...";
  try {
    let dashboard = null;
    try {
      dashboard = await fetchDashboardFromCloudflare();
    } catch (error) {
      dashboard = await fetchDashboardFromGoogle();
    }
    if (!dashboard) {
      window.alert("No cloud Command Center backup was found yet. Use Save first after the Cloudflare connection is live.");
      return;
    }
    const files = Array.isArray(dashboard.dashboardFiles) ? dashboard.dashboardFiles : [];
    const revenueRows = Array.isArray(dashboard.revenueRows) ? dashboard.revenueRows : [];
    const priceRows = Array.isArray(dashboard.priceRows) ? dashboard.priceRows : [];
    const deletedPriceIds = Array.isArray(dashboard.deletedPriceIds) ? dashboard.deletedPriceIds : [];
    crmFiles = repairCrmFileCategories(files.map((file) => normalizeCrmFile({ ...file })));
    crmRevenueRows = dedupeRevenueRows(revenueRows.map((row) => ({ ...row })));
    crmPriceRows = priceRows.map((row) => normalizedPriceRow(row));
    crmDeletedPriceIds = deletedPriceIds;
    activeFileId = crmFiles[0] ? crmFiles[0].id : null;
    activeRevenueId = crmRevenueRows[0] ? crmRevenueRows[0].id : null;
    saveCrmFiles();
    saveRevenueRows();
    savePriceRows();
    saveDeletedPriceIds();
    renderCrm();
    window.alert("Command Center restored from Cloudflare.");
  } finally {
    if (button) button.textContent = "Restore from Cloud";
  }
}

function activeFile() {
  return crmFiles.find((file) => file.id === activeFileId) || null;
}

function normalizeCrmFile(file) {
  if (!file) return file;
  if (!Array.isArray(file.notes)) file.notes = [];
  if (!Array.isArray(file.timeline)) file.timeline = [];
  if (!Array.isArray(file.expenseLines)) file.expenseLines = [];
  file.projectStage = file.projectStage || inferProjectStage(file.fileStatus);
  file.projectType = normalizeProjectType(file.projectType);
  file.estimateStatus = file.estimateStatus || inferEstimateStatus(file.fileStatus, file.statusDetail);
  file.invoiceStatus = file.invoiceStatus || (file.fileStatus === "Closed / Paid" ? "Paid" : "Not Created");
  file.reviewStatus = file.reviewStatus || (file.fileStatus === "Closed / Paid" ? "Requested" : "Not Ready");
  file.depositSecured = file.depositSecured || (Number(file.depositTotal) > 0 ? "Yes" : "No");
  file.initialDepositSecured = file.initialDepositSecured || file.depositSecured || (Number(file.depositTotal) > 0 ? "Yes" : "No");
  file.initialDeposit = file.initialDeposit === undefined ? file.depositTotal || "" : file.initialDeposit;
  file.midpointDepositSecured = file.midpointDepositSecured || (Number(file.midpointDeposit) > 0 ? "Yes" : "No");
  file.midpointDeposit = file.midpointDeposit === undefined ? "" : file.midpointDeposit;
  file.paidInFull = file.paidInFull || (file.invoiceStatus === "Paid" || file.fileStatus === "Closed / Paid" ? "Yes" : "No");
  file.contactEmailSent = file.contactEmailSent || "No";
  file.contactTextSent = file.contactTextSent || "No";
  file.inspectionDateSet = file.inspectionDateSet || (file.inspectionDate ? "Yes" : "No");
  file.statusDetail = file.statusDetail || (CRM_STATUS_DETAILS[file.fileStatus] || [""])[0] || "";
  file.followUpDate = file.followUpDate || "";
  file.anticipatedCompletionDate = file.anticipatedCompletionDate || "";
  file.closingCallCompleted = file.closingCallCompleted || "No";
  file.finalPaymentSecured = file.finalPaymentSecured || "No";
  file.finalPaymentAmount = file.finalPaymentAmount === undefined ? "" : file.finalPaymentAmount;
  file.invoiceSent = file.invoiceSent || (["Sent", "Deposit Paid", "Balance Due", "Paid"].includes(file.invoiceStatus) ? "Yes" : "No");
  file.invoicePaid = file.invoicePaid || file.paidInFull || "No";
  file.reviewRequested = file.reviewRequested || (["Requested", "Received"].includes(file.reviewStatus) || file.reviewSent === "Yes" ? "Yes" : "No");
  file.reviewSent = file.reviewSent || "No";
  if (file.fileNotes && !file.notes.length) {
    file.notes.push({ at: new Date().toISOString(), text: file.fileNotes });
    file.fileNotes = "";
  }
  return file;
}

function inferProjectStage(status = "") {
  if (["Job Won"].includes(status)) return "Scheduled";
  if (status === "In Progress") return "In Progress";
  if (status === "Work Completed") return "Completed";
  if (status === "Closed / Paid") return "Paid";
  if (status === "In Negotiation") return "Estimate";
  if (["Contact Established", "Inspection Completed"].includes(status)) return "Inspection";
  if (status === "Inspection Completed") return "Estimate";
  if (["Job Lost / Closed"].includes(status)) return "Closed";
  return "Lead";
}

function inferEstimateStatus(status = "", detail = "") {
  if (detail === "Estimate Pending") return "Pending";
  if (detail === "Estimate Sent") return "Sent";
  if (status === "In Negotiation") return "Sent";
  if (["Job Won", "In Progress", "Work Completed", "Closed / Paid"].includes(status)) return "Approved";
  if (status === "Job Lost / Closed") return "Declined";
  return "Not Started";
}


function isOpenCrmFile(file) {
  return crmFileCategory(file) !== CRM_FILE_CATEGORY_RULES.archive;
}

function isClosedCrmFile(file) {
  return crmFileCategory(file) === CRM_FILE_CATEGORY_RULES.archive;
}

function isPendingEstimateFile(file) {
  return crmFileCategory(file) === CRM_FILE_CATEGORY_RULES.estimate;
}

function isActiveCrmFile(file) {
  return crmFileCategory(file) === CRM_FILE_CATEGORY_RULES.active;
}

function filesInCategory(category) {
  return crmFiles.filter((file) => crmFileCategory(file) === category);
}

function visibleFiles() {
  const filter = $("crmFileFilter").value;
  if (filter === "all") return crmFiles;
  if (CRM_FILE_CATEGORY_RULES[filter]) return filesInCategory(filter);
  return crmFiles.filter(isOpenCrmFile);
}

function renderCounts() {
  repairCrmFileCategories();
  $("newLeadCount").textContent = filesInCategory("new").length;
  $("pendingContactCount").textContent = filesInCategory("contact").length;
  $("pendingEstimateCount").textContent = filesInCategory("estimate").length;
  $("negotiationCount").textContent = filesInCategory("negotiation").length;
  $("activeJobCount").textContent = filesInCategory("active").length;
  $("archivedCount").textContent = filesInCategory("archive").length;
}

function renderFileList() {
  const files = visibleFiles();
  $("crmListTitle").textContent = $("crmFileFilter").selectedOptions[0].textContent;
  $("crmFileList").innerHTML = files.map((file) => `
    <button type="button" class="crm-file-card ${file.id === activeFileId ? "active" : ""}" data-file-id="${file.id}">
      <span>${escapeHtml(file.fileNumber)}</span>
      <strong>${escapeHtml(file.clientName || "Unnamed Client")}</strong>
      <small>${escapeHtml(file.fileStatus)} · ${escapeHtml(file.projectType)} · ${escapeHtml(file.estimateStatus || "Not Started")}</small>
      <em>${escapeHtml(file.nextAction || "No next action set")}</em>
    </button>
  `).join("") || `<p class="crm-empty-state">No files in this view yet.</p>`;

  document.querySelectorAll("[data-file-id]").forEach((button) => {
    button.addEventListener("click", () => {
      saveActiveFile();
      activeFileId = button.dataset.fileId;
      renderCrm();
    });
  });
}

function renderMaterialBreakdown(file) {
  const container = $("crmMaterialBreakdown");
  if (!container) return;
  const materials = Array.isArray(file?.materialItems) ? file.materialItems : [];
  if (!materials.length) {
    container.innerHTML = `<p class="crm-empty-state">No estimate materials attached yet.</p>`;
    return;
  }
  container.innerHTML = `
    <div class="crm-material-heading">
      <span>Materials from Estimate</span>
      <strong>${crmCurrency.format(Number(file.materialTotal) || materials.reduce((sum, item) => sum + (Number(item.total) || materialItemCost(item)), 0))}</strong>
    </div>
    <div class="crm-material-list">
      ${materials.map((item) => `
        <div class="crm-material-row">
          <span>${escapeHtml(item.name || "Material")}</span>
          <small>${escapeHtml(item.qty || "")}${item.unit ? ` ${escapeHtml(item.unit)}` : ""}</small>
          <strong>${crmCurrency.format(Number(item.total) || materialItemCost(item))}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function renderStatusDetailOptions(file) {
  const select = $("crmStatusDetail");
  if (!select) return;
  const status = $("crmFileStatus").value || file?.fileStatus || "New Lead";
  const options = [...(CRM_STATUS_DETAILS[status] || [""])];
  const current = file?.statusDetail || select.value || options[0] || "";
  if (current && !options.includes(current)) options.push(current);
  select.innerHTML = options.map((option) => `<option>${escapeHtml(option)}</option>`).join("");
  select.value = options.includes(current) ? current : options[0] || "";
}

function renderActiveFile() {
  const file = normalizeCrmFile(activeFile());
  if (!file) {
    $("activeFileNumber").textContent = "No project selected";
    $("activeClientName").textContent = "Create or select a customer file";
    crmFields.forEach((field) => {
      const element = $(`crm${field[0].toUpperCase()}${field.slice(1)}`);
      if (element) element.value = "";
    });
    $("crmEstimateTotal").textContent = crmCurrency.format(0);
    $("crmMaterialTotal").textContent = crmCurrency.format(0);
    $("crmBalanceTotal").textContent = crmCurrency.format(0);
    $("crmPaidTotal").textContent = crmCurrency.format(0);
    $("crmStatusDescription").textContent = "";
    renderMaterialBreakdown(null);
    $("crmNewNote").value = "";
    $("crmNoteList").innerHTML = `<p class="crm-empty-state">No file selected.</p>`;
    $("crmTimeline").innerHTML = "<p>No timeline activity yet.</p>";
    return;
  }
  $("activeFileNumber").textContent = `Project # ${file.fileNumber}`;
  $("activeClientName").textContent = file.clientName || "Unnamed Client";
  crmFields.forEach((field) => {
    const element = $(`crm${field[0].toUpperCase()}${field.slice(1)}`);
    if (element) element.value = file[field] || "";
  });
  renderStatusDetailOptions(file);
  const estimateTotal = Number(file.estimateTotal) || 0;
  const initialDeposit = Number(file.initialDeposit) || Number(file.depositTotal) || 0;
  const midpointDeposit = Number(file.midpointDeposit) || 0;
  const finalPayment = Number(file.finalPaymentAmount) || 0;
  const paidInFull = file.paidInFull === "Yes";
  const securedTotal = paidInFull ? estimateTotal : initialDeposit + midpointDeposit + finalPayment;
  $("crmEstimateTotal").textContent = crmCurrency.format(estimateTotal);
  $("crmEstimateAmountInput").value = estimateTotal ? estimateTotal.toFixed(2) : "";
  $("crmMaterialTotal").textContent = crmCurrency.format(Number(file.materialTotal) || 0);
  $("crmMaterialAmountInput").value = Number(file.materialTotal) ? Number(file.materialTotal).toFixed(2) : "";
  $("crmBalanceTotal").textContent = crmCurrency.format(Math.max(estimateTotal - securedTotal, 0));
  $("crmPaidTotal").textContent = crmCurrency.format(Math.min(securedTotal, estimateTotal || securedTotal));
  $("crmStatusDescription").textContent = CRM_STATUS_DESCRIPTIONS[file.fileStatus] || "";
  renderMaterialBreakdown(file);
  $("crmNewNote").value = "";
  renderNotes(file);
  $("crmTimeline").innerHTML = (file.timeline || []).map((entry) => `<div>${escapeHtml(entry)}</div>`).join("") || "<p>No timeline activity yet.</p>";
}

function saveActiveFile() {
  const file = normalizeCrmFile(activeFile());
  if (!file) return;
  const changeNotes = [];
  crmFields.forEach((field) => {
    const element = $(`crm${field[0].toUpperCase()}${field.slice(1)}`);
    if (!element) return;
    const oldValue = file[field] || "";
    const newValue = element.value;
    file[field] = newValue;
    if (oldValue !== newValue) {
      const label = trackedStatusFields[field] || field.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
      changeNotes.push(`${label} changed from ${oldValue || "blank"} to ${newValue || "blank"}`);
    }
    if (trackedStatusFields[field] && oldValue && oldValue !== newValue) {
      file.timeline.push(`${trackedStatusFields[field]} changed from ${oldValue} to ${newValue} on ${formatNoteTimestamp(new Date().toISOString())}`);
    }
  });
  if (!file.timeline) file.timeline = [];
  if (changeNotes.length) {
    const timestamp = new Date().toISOString();
    file.notes.push({ at: timestamp, text: changeNotes.join("\n") });
    file.timeline.push(`File updated ${formatNoteTimestamp(timestamp)}`);
  }
  if (file.fileStatus === "In Progress") ensureRevenueRowForFile(file);
  saveCrmFiles();
}

function toggleEstimateAmountEdit() {
  const panel = $("crmEstimateEditPanel");
  panel.hidden = !panel.hidden;
  if (!panel.hidden) {
    $("crmEstimateAmountInput").focus();
    $("crmEstimateAmountInput").select();
  }
}

function saveEstimateAmountEdit() {
  const file = normalizeCrmFile(activeFile());
  if (!file) return;
  const oldAmount = Number(file.estimateTotal) || 0;
  const newAmount = parseMoney($("crmEstimateAmountInput").value);
  file.estimateTotal = newAmount;
  if (file.editableEstimate?.totals) file.editableEstimate.totals.total = newAmount;
  if (oldAmount !== newAmount) {
    addSystemNote(file, `Estimate amount changed from ${crmCurrency.format(oldAmount)} to ${crmCurrency.format(newAmount)}.`);
  }
  $("crmEstimateEditPanel").hidden = true;
  if (file.fileStatus === "In Progress") ensureRevenueRowForFile(file);
  saveCrmFiles();
  renderCrm();
}

function toggleMaterialAmountEdit() {
  const panel = $("crmMaterialEditPanel");
  panel.hidden = !panel.hidden;
  if (!panel.hidden) {
    $("crmMaterialAmountInput").focus();
    $("crmMaterialAmountInput").select();
  }
}

function saveMaterialAmountEdit() {
  const file = normalizeCrmFile(activeFile());
  if (!file) return;
  const oldAmount = Number(file.materialTotal) || 0;
  const newAmount = parseMoney($("crmMaterialAmountInput").value);
  file.materialTotal = newAmount;
  if (oldAmount !== newAmount) {
    addSystemNote(file, `Materials amount changed from ${crmCurrency.format(oldAmount)} to ${crmCurrency.format(newAmount)}.`);
  }
  $("crmMaterialEditPanel").hidden = true;
  if (file.editableEstimate?.backend) file.editableEstimate.backend.estimatedMaterialCost = newAmount;
  if (file.fileStatus === "In Progress") ensureRevenueRowForFile(file);
  saveCrmFiles();
  renderCrm();
}

function addSystemNote(file, text) {
  if (!text) return;
  const timestamp = new Date().toISOString();
  file.notes = [...(file.notes || []), { at: timestamp, text }];
  file.timeline = [...(file.timeline || []), `Workflow note added ${formatNoteTimestamp(timestamp)}`];
}

function openDateField(id) {
  const field = $(id);
  if (!field) return;
  field.focus();
  if (typeof field.showPicker === "function") {
    try {
      field.showPicker();
    } catch (error) {
      // Some browsers only allow date pickers from direct user gestures.
    }
  }
}

function requireCrmReason(message, notePrefix) {
  return;
}

function handleCrmControlWorkflow(event) {
  const element = event.target;
  if (!element || !element.id) return;
  if (element.id === "crmInspectionDateSet") {
    if (element.value === "Yes") {
      openDateField("crmInspectionDate");
    } else {
      requireCrmReason("Inspection date is not set. Add a note explaining why.", "Inspection date not set");
    }
  }
  if (element.id === "crmInitialDepositSecured" && element.value === "No") {
    requireCrmReason("Initial deposit is not secured. Add a note explaining why.", "Initial deposit not secured");
  }
  if (element.id === "crmMidpointDepositSecured" && element.value === "No") {
    requireCrmReason("Midpoint deposit is not secured. Add a note explaining why.", "Midpoint deposit not secured");
  }
  if (element.id === "crmFinalPaymentSecured" && element.value === "No") {
    requireCrmReason("Final payment is not secured. Add a note explaining why.", "Final payment not secured");
  }
  if (element.id === "crmInvoiceSent" && element.value === "No") {
    requireCrmReason("Invoice has not been sent. Add a note explaining why.", "Invoice not sent");
  }
  if (element.id === "crmReviewRequested" && element.value === "No") {
    requireCrmReason("Review has not been requested. Add a note explaining why.", "Review not requested");
  }
}

function handleStatusWorkflow() {
  const file = normalizeCrmFile(activeFile());
  if (!file) return;
  const status = $("crmFileStatus").value;
  const detail = $("crmStatusDetail").value;
  $("crmStatusDescription").textContent = CRM_STATUS_DESCRIPTIONS[status] || "";

  if (status === "Contact Attempted") {
    const tomorrow = todayIso(1);
    $("crmFollowUpDate").value = tomorrow;
    $("crmNextActionDate").value = tomorrow;
    $("crmNextAction").value = "Follow up after contact attempt";
    addSystemNote(file, "Contact attempted. Follow-up reminder set for next day.");
  }

  if (status === "Contact Established" && detail === "Inspection Pending") {
    $("crmNextAction").value = "Schedule inspection";
  }

  if (status === "Contact Established" && detail === "Inspection Date Set" && !$("crmInspectionDate").value) {
    $("crmNextAction").value = "Set inspection date";
    openDateField("crmInspectionDate");
  }

  if (status === "Inspection Completed" && detail === "Estimate Pending") {
    $("crmEstimateStatus").value = "Pending";
    $("crmNextAction").value = "Prepare estimate";
  }

  if (status === "Inspection Completed" && detail === "Estimate Sent") {
    $("crmEstimateStatus").value = "Sent";
    if (!$("crmFollowUpDate").value) {
      $("crmNextAction").value = "Set estimate follow-up date";
      openDateField("crmFollowUpDate");
    }
    addSystemNote(file, "Estimate sent.");
    $("crmNextAction").value = "Follow up on sent estimate";
  }

  if (status === "In Negotiation") {
    $("crmEstimateStatus").value = "Sent";
    if (!$("crmFollowUpDate").value) {
      openDateField("crmFollowUpDate");
    }
    $("crmNextAction").value = "Follow up on negotiation";
  }

  if (status === "Job Won" && detail === "Start Date Pending") {
    $("crmNextAction").value = "Establish start date";
  }

  if (status === "Job Won" && detail === "Start Date Established" && !$("crmStartDate").value) {
    $("crmNextAction").value = "Set start date";
    openDateField("crmStartDate");
  }

  if (status === "In Progress") {
    file.revenueExcluded = false;
    if (!$("crmAnticipatedCompletionDate").value) {
      $("crmNextAction").value = "Set anticipated completion date";
      openDateField("crmAnticipatedCompletionDate");
    }
    if (!$("crmMidpointDeposit").value) {
      $("crmNextAction").value = "Confirm midpoint deposit";
    }
  }

  if (status === "Work Completed") {
    if (detail === "Closing Call Made") {
      $("crmClosingCallCompleted").value = "Yes";
    }
    if (detail === "Closing Call Needed" || $("crmClosingCallCompleted").value !== "Yes") {
      $("crmNextAction").value = "Complete closing call";
    }
  }

  if (status === "Closed / Paid") {
    $("crmPaidInFull").value = "Yes";
    $("crmFinalPaymentSecured").value = "Yes";
    if (detail === "Invoice Not Sent") {
      $("crmNextAction").value = "Send invoice";
    } else {
      $("crmInvoiceStatus").value = "Sent";
      $("crmNextAction").value = "Archived for future marketing";
    }
    activateCrmFilter("archive");
  }

  if (status === "Job Lost / Closed") {
    $("crmNextAction").value = "Archived for future marketing";
    addSystemNote(file, "Job lost/closed. Contact information retained for future marketing follow-up.");
    activateCrmFilter("archive");
  }

  saveActiveFile();
  const savedFile = normalizeCrmFile(activeFile());
  ensureRevenueRowForFile(savedFile);
  saveCrmFiles();
  renderCrm();
}

function formatNoteTimestamp(value) {
  const date = value ? new Date(value) : new Date();
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function canEditLatestNote(notes, index) {
  if (!Array.isArray(notes) || index !== notes.length - 1) return false;
  const createdAt = new Date(notes[index]?.at || "");
  if (Number.isNaN(createdAt.getTime())) return false;
  return Date.now() - createdAt.getTime() <= NOTE_EDIT_WINDOW_MS;
}

function renderNotes(file) {
  const notes = Array.isArray(file.notes) ? file.notes : [];
  $("crmNoteList").innerHTML = notes.length
    ? notes
        .map((note, index) => ({ note, index }))
        .reverse()
        .map(({ note, index }) => `
          <article class="crm-note-entry">
            <div class="crm-note-meta">
              <time>${escapeHtml(formatNoteTimestamp(note.at))}${note.editedAt ? ` · Edited ${escapeHtml(formatNoteTimestamp(note.editedAt))}` : ""}</time>
              ${canEditLatestNote(notes, index) ? `<button type="button" data-note-edit="${index}">Edit</button>` : ""}
            </div>
            <p>${escapeHtml(note.text)}</p>
          </article>
        `)
        .join("")
    : `<p class="crm-empty-state">No notes yet. Add the first note above.</p>`;
  document.querySelectorAll("[data-note-edit]").forEach((button) => {
    button.addEventListener("click", () => editCrmNote(Number(button.dataset.noteEdit)));
  });
}

function addCrmNote() {
  const file = normalizeCrmFile(activeFile());
  if (!file) return;
  const text = $("crmNewNote").value.trim();
  if (!text) return;
  const timestamp = new Date().toISOString();
  file.notes.push({ at: timestamp, text });
  file.timeline = [...(file.timeline || []), `Note added ${formatNoteTimestamp(timestamp)}`];
  $("crmNewNote").value = "";
  saveCrmFiles();
  renderCrm();
}

function editCrmNote(index) {
  const file = normalizeCrmFile(activeFile());
  if (!file || !canEditLatestNote(file.notes, index)) {
    window.alert("Only the latest note can be edited, and only within 12 hours.");
    return;
  }
  const currentText = file.notes[index].text || "";
  const updatedText = window.prompt("Edit the latest note:", currentText);
  if (updatedText === null) return;
  const cleanText = updatedText.trim();
  if (!cleanText) {
    window.alert("A note cannot be blank.");
    return;
  }
  const timestamp = new Date().toISOString();
  file.notes[index] = {
    ...file.notes[index],
    text: cleanText,
    editedAt: timestamp,
  };
  file.timeline = [...(file.timeline || []), `Latest note edited ${formatNoteTimestamp(timestamp)}`];
  saveCrmFiles();
  renderCrm();
}

function newCrmFile() {
  saveActiveFile();
  const file = {
    id: makeCrmId("file"),
    fileNumber: makeCrmFileNumber(),
    clientName: "",
    clientPhone: "",
    clientEmail: "",
    projectAddress: "",
    leadSource: "Manual",
    fileStatus: "New Lead",
    statusDetail: "Needs Contact",
    projectType: "Other",
    projectStage: "Lead",
    contactEmailSent: "No",
    contactTextSent: "No",
    inspectionDateSet: "No",
    inspectionDate: "",
    inspectionTime: "",
    startDate: "",
    arrivalWindow: "Open",
    followUpDate: "",
    anticipatedCompletionDate: "",
    nextAction: "Contact customer",
    nextActionDate: todayIso(1),
    warrantyStatus: "Not Sent",
    depositSecured: "No",
    initialDepositSecured: "No",
    initialDeposit: "",
    midpointDepositSecured: "No",
    midpointDeposit: "",
    paidInFull: "No",
    closingCallCompleted: "No",
    finalPaymentSecured: "No",
    finalPaymentAmount: "",
    invoiceSent: "No",
    invoicePaid: "No",
    reviewRequested: "No",
    reviewSent: "No",
    estimateStatus: "Not Started",
    invoiceStatus: "Not Created",
    reviewStatus: "Not Ready",
    estimateTotal: 0,
    depositTotal: 0,
    materialTotal: 0,
    notes: [],
    timeline: ["File created"],
  };
  crmFiles.unshift(file);
  activeFileId = file.id;
  saveCrmFiles();
  renderCrm();
}

function deleteActiveFile() {
  const file = activeFile();
  if (!file) {
    window.alert("Select a file before deleting.");
    return;
  }

  const passcode = window.prompt(`Enter delete passcode D2 for ${file.fileNumber}.`);
  if (passcode === null) return;
  if (passcode.trim().toUpperCase() !== "D2") {
    window.alert("Incorrect passcode. File was not deleted.");
    return;
  }

  const confirmed = window.confirm(`Delete ${file.fileNumber} - ${file.clientName || "Unnamed Client"}? This removes it from this dashboard list.`);
  if (!confirmed) return;

  const deleteIndex = crmFiles.findIndex((entry) => entry.id === file.id);
  crmFiles = crmFiles.filter((entry) => entry.id !== file.id);
  const nextFile = crmFiles[deleteIndex] || crmFiles[deleteIndex - 1] || crmFiles[0] || null;
  activeFileId = nextFile ? nextFile.id : null;
  saveCrmFiles();
  renderCrm();
}

function estimateDataFromCrmFile(file) {
  const estimateTotal = Number(file.estimateTotal) || 0;
  const materialTotal = Number(file.materialTotal) || 0;
  const depositTotal = Number(file.depositTotal || file.initialDeposit) || 0;
  return {
    fileType: "D2_ESTIMATE_EDITABLE",
    fileVersion: 1,
    dashboardFileId: file.id || "",
    companyName: "D2 Carpentry & Design",
    estimateTitle: "Estimate",
    companyPhone: "239-469-8555",
    companyEmail: "D2CarpentryandDesign@gmail.com",
    companyAddress: "2710 Del Prado Blvd S #2-184 Cape Coral, FL 33904",
    estimateNumber: file.fileNumber || makeCrmFileNumber(),
    showEstimateNumber: true,
    estimateDate: todayIso(0),
    leadSource: file.leadSource || "Manual",
    fileStatus: file.fileStatus || "New Lead",
    estimateStatus: file.estimateStatus || "Pending",
    warrantyStatus: file.warrantyStatus || "Not Sent",
    inspectionDate: file.inspectionDate || "",
    inspectionTime: file.inspectionTime || "",
    nextActionDate: file.nextActionDate || file.followUpDate || "",
    nextAction: file.nextAction || "",
    clientName: file.clientName || "",
    clientPhone: file.clientPhone || "",
    clientEmail: file.clientEmail || "",
    projectAddress: file.projectAddress || "",
    projectType: normalizeProjectType(file.projectType),
    finishLevel: "",
    widthFeet: "",
    heightFeet: "",
    linearFeet: "",
    linearRate: "500",
    squareLength: "",
    squareWidth: "",
    squareRate: "75",
    flatTotal: estimateTotal ? String(estimateTotal) : "",
    discount: "",
    discountType: "dollar",
    taxRate: "",
    depositRate: "",
    invoiceInitialDeposit: file.initialDeposit || "",
    invoiceSecondDeposit: file.midpointDeposit || "",
    invoiceFinalPayment: file.finalPaymentAmount || "",
    notes: "",
    additionalNotes: "",
    addFooterValueNote: false,
    assignmentLanguage: "en",
    assignmentStartDate: file.startDate || "",
    assignmentArrivalTime: file.arrivalWindow || "Open",
    assignmentScope: "",
    useSpanishScope: false,
    assignmentScopeSpanish: "",
    assignmentNotes: "",
    lineItems: [{ id: makeCrmId("line"), type: "item", name: "", qty: "", price: "" }],
    materialItems: Array.isArray(file.materialItems) && file.materialItems.length
      ? file.materialItems.map((item) => ({ ...item }))
      : [{ id: makeCrmId("material"), name: "", qty: "", unit: "", price: "" }],
    photos: [],
    assignmentPhotos: [],
    totals: {
      subtotal: estimateTotal,
      discount: 0,
      tax: 0,
      total: estimateTotal,
      deposit: depositTotal,
      finishMultiplier: 1,
      hasFlatTotal: Boolean(estimateTotal),
      discountType: "dollar",
      discountValue: 0,
      depositRate: "",
      lineSubtotal: 0,
      showDiscount: false,
      showTax: false,
      showDeposit: Boolean(depositTotal),
      showSubtotal: false,
    },
    backend: {
      estimatedMaterialCost: materialTotal,
      fallbackMaterialCost: estimateTotal * 0.25,
      estimatedGrossProfit: estimateTotal - materialTotal,
      materialPercent: 25,
    },
    submittedAt: new Date().toISOString(),
  };
}

function openEstimatorInCommandCenter(url) {
  const frame = $("crmEstimatorFrame");
  if (!frame) {
    window.location.href = url;
    return;
  }
  frame.src = url;
  switchCrmView("estimator");
  $("crmEstimatorView")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function sendEstimateToEstimator(estimateData, target = "") {
  try {
    localStorage.setItem("d2EstimateStudio", JSON.stringify(estimateData));
  } catch (error) {
    window.alert("The estimate could not be loaded into this browser. Try refreshing and opening it again.");
    return false;
  }
  const estimatorUrl = new URL("index.html", window.location.href);
  if (target) estimatorUrl.hash = target.replace(/^#/, "");
  estimatorUrl.searchParams.set("fromDashboard", "1");
  estimatorUrl.searchParams.set("embedded", "1");
  estimatorUrl.searchParams.set("open", Date.now().toString());
  openEstimatorInCommandCenter(estimatorUrl.toString());
  return true;
}

function attachEditableEstimateToFile(file, data, fileName = "") {
  const totals = data.totals || {};
  file.editableEstimate = data;
  file.estimateTotal = Number(totals.total) || parseMoney(data.total) || Number(file.estimateTotal) || 0;
  file.depositTotal = Number(totals.deposit) || Number(file.depositTotal) || 0;
  file.materialTotal = estimateMaterialTotal(data) || Number(file.materialTotal) || 0;
  file.materialItems = estimateMaterialItems(data);
  file.clientName = file.clientName || data.clientName || "";
  file.clientPhone = file.clientPhone || data.clientPhone || "";
  file.clientEmail = file.clientEmail || data.clientEmail || "";
  file.projectAddress = file.projectAddress || data.projectAddress || data.clientAddress || "";
  file.projectType = normalizeProjectType(file.projectType || data.projectType);
  file.estimateStatus = data.estimateStatus || file.estimateStatus || "Pending";
  addSystemNote(file, `Editable estimate attached${fileName ? ` from ${fileName}` : ""}.`);
}

function uploadEstimateForActiveFile(file) {
  const targetId = pendingEstimateUploadFileId;
  const shouldOpen = openEstimateAfterUpload;
  const target = estimateChoiceTarget;
  pendingEstimateUploadFileId = "";
  openEstimateAfterUpload = false;
  estimateChoiceTarget = "";
  if (!file || !targetId) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const data = parseEstimateFileText(reader.result);
      const targetFile = crmFiles.find((entry) => entry.id === targetId);
      if (!targetFile) throw new Error("That customer file is no longer selected.");
      attachEditableEstimateToFile(targetFile, data, file.name);
      activeFileId = targetFile.id;
      saveCrmFiles();
      renderCrm();
      if (shouldOpen) sendEstimateToEstimator(targetFile.editableEstimate, target);
    } catch (error) {
      window.alert(`${error.message || "That file could not be uploaded."} Please choose an editable D2 estimate file ending in .d2estimate.`);
    }
  });
  reader.readAsText(file);
}

function closeEstimateChoiceDialog() {
  const modal = $("crmEstimateChoiceModal");
  if (modal) modal.hidden = true;
  estimateChoiceTarget = "";
}

function startEstimateUploadForFile(file, target = "") {
  if (!file) return;
  closeEstimateChoiceDialog();
  pendingEstimateUploadFileId = file.id;
  openEstimateAfterUpload = true;
  estimateChoiceTarget = target;
  $("crmEstimateFileUpload").click();
}

function createEstimateForFile(file, target = "") {
  if (!file) return;
  if (file.editableEstimate) {
    const replaceCurrent = window.confirm("This file already has an estimate attached. Create a new estimate and replace the current attached estimate?");
    if (!replaceCurrent) return;
  }
  const estimateData = estimateDataFromCrmFile(file);
  file.editableEstimate = estimateData;
  file.estimateStatus = file.estimateStatus || "Pending";
  addSystemNote(file, "New editable estimate started from this Dashboard file.");
  saveCrmFiles();
  renderCrm();
  closeEstimateChoiceDialog();
  sendEstimateToEstimator(estimateData, target);
}

function showEstimateChoiceDialog(target = "") {
  refreshCrmFilesFromStorage();
  saveActiveFile();
  const file = activeFile();
  if (!file) {
    window.alert("Select a customer file first.");
    return;
  }
  estimateChoiceTarget = target;
  const hasEstimate = Boolean(file.editableEstimate);
  $("crmEstimateChoiceTitle").textContent = file.clientName || file.fileNumber || "Estimate";
  $("crmEstimateChoiceStatus").textContent = hasEstimate
    ? `Current estimate attached${file.editableEstimate?.estimateNumber ? `: ${file.editableEstimate.estimateNumber}` : "."}`
    : "No estimate is attached yet. Create a new one or upload an existing .d2estimate file.";
  $("crmEstimateChoiceView").disabled = !hasEstimate;
  $("crmEstimateChoiceModal").hidden = false;
}

function openActiveEstimate(target = "") {
  refreshCrmFilesFromStorage();
  saveActiveFile();
  const file = activeFile();
  if (!file) {
    window.alert("Select a customer file first.");
    return;
  }
  if (!file.editableEstimate) {
    if (target) {
      window.alert("This customer file does not have an attached editable estimate yet. Open Estimate first, then create or upload one.");
      return;
    }
    showEstimateChoiceDialog(target);
    return;
  }
  sendEstimateToEstimator(file.editableEstimate, target);
}

function openActiveInvoice() {
  refreshCrmFilesFromStorage();
  saveActiveFile();
  const file = activeFile();
  if (!file) {
    window.alert("Select a customer file first.");
    return;
  }
  if (!file.editableEstimate) {
    window.alert("This customer file does not have an attached editable estimate yet. Import an approved estimate first.");
    return;
  }
  const invoiceEstimate = {
    ...file.editableEstimate,
    estimateTitle: "Invoice",
    invoicePaid: file.invoicePaid === "Yes" || file.paidInFull === "Yes",
  };
  if (file.invoice?.total) {
    invoiceEstimate.flatTotal = file.invoice.total;
    invoiceEstimate.totals = { ...(invoiceEstimate.totals || {}), total: Number(file.invoice.total) || 0 };
  }
  try {
    localStorage.setItem("d2EstimateStudio", JSON.stringify(invoiceEstimate));
  } catch (error) {
    window.alert("The invoice could not be loaded into this browser. Try refreshing and opening it again.");
    return;
  }
  window.open("index.html?invoice=1", "_blank", "noopener");
}

function searchCrmFile() {
  const query = String($("crmFileSearch").value || "").trim().toLowerCase();
  if (!query) return;
  const match = crmFiles.find((file) => {
    return String(file.fileNumber || "").toLowerCase().includes(query)
      || String(file.clientName || "").toLowerCase().includes(query)
      || String(file.clientPhone || "").toLowerCase().includes(query)
      || String(file.projectAddress || "").toLowerCase().includes(query);
  });
  if (!match) {
    window.alert("No matching project file was found.");
    return;
  }
  saveActiveFile();
  activeFileId = match.id;
  activateCrmFilter(filterForCrmFile(match));
  renderCrm();
}

function initialDashboardView() {
  const params = new URLSearchParams(window.location.search);
  const view = String(params.get("view") || "").trim().toLowerCase();
  return ["dashboard", "calendar", "revenue", "expenses", "prices", "invoice", "estimator"].includes(view) ? view : "dashboard";
}

function applyInitialFileRoute() {
  const params = new URLSearchParams(window.location.search);
  const target = String(params.get("file") || params.get("lead") || params.get("project") || "").trim().toLowerCase();
  if (!target) return;
  const match = crmFiles.find((file) => {
    return String(file.fileNumber || "").toLowerCase() === target
      || String(file.id || "").toLowerCase() === target
      || String(file.clientName || "").toLowerCase() === target
      || String(file.fileNumber || "").toLowerCase().includes(target)
      || String(file.clientName || "").toLowerCase().includes(target);
  });
  if (!match) return;
  activeFileId = match.id;
  activateCrmFilter(filterForCrmFile(match));
}

function filterForCrmFile(file) {
  return crmFileCategory(file);
}

function activateCrmFilter(filter) {
  document.querySelectorAll("[data-crm-filter]").forEach((item) => {
    item.classList.toggle("active", item.dataset.crmFilter === filter);
  });
  $("crmFileFilter").value = filter;
}

function renderCrm() {
  renderCounts();
  renderFileList();
  renderActiveFile();
  renderRevenue();
  if (!$("crmExpensesView")?.hidden) renderFileExpenses();
}

function parseMoney(value) {
  const cleaned = String(value || "").replace(/[$,]/g, "").trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function materialItemCost(item) {
  const qty = parseMoney(item.qty || item.quantity || 0);
  const price = parseMoney(item.price || item.unitCost || item.cost || 0);
  return qty * price;
}

function estimateMaterialItems(data) {
  if (!Array.isArray(data.materialItems)) return [];
  return data.materialItems
    .filter((item) => String(item.name || "").trim() || materialItemCost(item))
    .map((item) => ({
      name: String(item.name || "Material").trim(),
      qty: item.qty || item.quantity || "",
      unit: item.unit || "",
      price: parseMoney(item.price || item.unitCost || item.cost || 0),
      total: materialItemCost(item),
    }));
}

function estimateMaterialTotal(data) {
  if (data && data.backend && Number(data.backend.estimatedMaterialCost)) {
    return Number(data.backend.estimatedMaterialCost) || 0;
  }
  if (Array.isArray(data.materialItems)) {
    return data.materialItems.reduce((total, item) => total + materialItemCost(item), 0);
  }
  return 0;
}

function estimateReceiptNotes(data) {
  if (!Array.isArray(data.materialItems) || !data.materialItems.length) return "";
  return data.materialItems
    .filter((item) => String(item.name || "").trim() || materialItemCost(item))
    .map((item) => {
      const qty = item.qty || item.quantity || "";
      const price = parseMoney(item.price || item.unitCost || item.cost || 0);
      const total = materialItemCost(item);
      const parts = [String(item.name || "Material").trim()];
      if (qty !== "") parts.push(`qty ${qty}`);
      if (price) parts.push(crmCurrency.format(price));
      if (total) parts.push(`total ${crmCurrency.format(total)}`);
      return parts.join(" - ");
    })
    .join("\n");
}

function normalizeDate(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const date = new Date(text);
  if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  return text;
}

function displayDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function parseEstimateFileText(text) {
  const raw = String(text || "").trim().replace(/^\uFEFF/, "");
  if (!raw) throw new Error("The file is empty.");
  if (raw.startsWith("%PDF")) throw new Error("That is a PDF. Please upload the editable .d2estimate file.");
  if (/^<!doctype html|^<html/i.test(raw)) throw new Error("That is an HTML copy. Please upload the editable .d2estimate file.");
  try {
    return JSON.parse(raw);
  } catch (error) {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
    throw error;
  }
}

function isUsableEstimateNumber(value) {
  const text = String(value || "").trim();
  return Boolean(text) && text.toLowerCase() !== "estimate";
}

function estimateFileNumber(data, row) {
  const estimateNumber = data?.estimateNumber || row?.attachedEstimate?.estimateNumber || row?.attachedEstimate?.fileNumber;
  return isUsableEstimateNumber(estimateNumber) ? String(estimateNumber).trim() : makeCrmFileNumber();
}

function revenueRowFromEstimate(data, fileName) {
  if (!data || typeof data !== "object") throw new Error("That estimate file could not be read.");
  const estimateNumber = estimateFileNumber(data);
  const clientName = data.clientName || "Unnamed Client";
  const gross = Number(data.totals && data.totals.total) || parseMoney(data.total) || 0;
  const expenses = estimateMaterialTotal(data);
  const labor = 0;
  return {
    id: makeCrmId("rev-estimate"),
    date: normalizeDate(data.date || data.submittedAt || todayIso(0)),
    clientJob: `${clientName} - ${estimateNumber}`,
    gross,
    expenses,
    labor,
    profit: gross - expenses - labor,
    receiptNotes: estimateReceiptNotes(data),
    laborAssigns: "",
    attachedEstimate: {
      fileName: fileName || "",
      estimateNumber,
      clientName,
      clientPhone: data.clientPhone || "",
      clientEmail: data.clientEmail || "",
      projectAddress: data.clientAddress || data.projectAddress || "",
      total: gross,
      materialTotal: expenses,
      materialItems: estimateMaterialItems(data),
      savedAt: new Date().toISOString(),
    },
  };
}

function dashboardFileFromEstimate(data, row) {
  const importedAt = new Date().toISOString();
  const estimateNumber = estimateFileNumber(data, row);
  const existing = crmFiles.find((file) => file.fileNumber === estimateNumber);
  const estimateDeposit = Number(data.totals && data.totals.deposit) || 0;
  const file = {
    ...(existing || {}),
    id: existing?.id || makeCrmId("file"),
    fileNumber: estimateNumber,
    clientName: data.clientName || row.attachedEstimate?.clientName || "Unnamed Client",
    clientPhone: data.clientPhone || "",
    clientEmail: data.clientEmail || "",
    projectAddress: data.projectAddress || data.clientAddress || "",
    leadSource: data.leadSource || existing?.leadSource || "Estimate Upload",
    fileStatus: data.fileStatus || existing?.fileStatus || "New Lead",
    statusDetail: existing?.statusDetail || data.statusDetail || "Needs Contact",
    projectType: normalizeProjectType(data.projectType || existing?.projectType),
    projectStage: existing?.projectStage || "Lead",
    contactEmailSent: existing?.contactEmailSent || "No",
    contactTextSent: existing?.contactTextSent || "No",
    inspectionDateSet: existing?.inspectionDateSet || (data.inspectionDate ? "Yes" : "No"),
    inspectionDate: data.inspectionDate || existing?.inspectionDate || "",
    inspectionTime: data.inspectionTime || existing?.inspectionTime || "",
    startDate: data.assignmentStartDate || existing?.startDate || "",
    arrivalWindow: data.assignmentArrivalTime || existing?.arrivalWindow || "Open",
    followUpDate: existing?.followUpDate || "",
    anticipatedCompletionDate: existing?.anticipatedCompletionDate || "",
    nextAction: data.nextAction || existing?.nextAction || "Review estimate and contact customer",
    nextActionDate: data.nextActionDate || existing?.nextActionDate || todayIso(1),
    warrantyStatus: data.warrantyStatus || existing?.warrantyStatus || "Not Sent",
    depositSecured: existing?.depositSecured || (estimateDeposit > 0 ? "Yes" : "No"),
    initialDepositSecured: existing?.initialDepositSecured || (estimateDeposit > 0 ? "Yes" : "No"),
    initialDeposit: existing?.initialDeposit === undefined ? estimateDeposit || "" : existing.initialDeposit,
    midpointDepositSecured: existing?.midpointDepositSecured || (Number(existing?.midpointDeposit) > 0 ? "Yes" : "No"),
    midpointDeposit: existing?.midpointDeposit || "",
    paidInFull: existing?.paidInFull || "No",
    closingCallCompleted: existing?.closingCallCompleted || "No",
    finalPaymentSecured: existing?.finalPaymentSecured || "No",
    finalPaymentAmount: existing?.finalPaymentAmount || "",
    invoiceSent: existing?.invoiceSent || "No",
    invoicePaid: existing?.invoicePaid || existing?.paidInFull || "No",
    reviewRequested: existing?.reviewRequested || "No",
    reviewSent: existing?.reviewSent || "No",
    estimateStatus: data.estimateStatus || existing?.estimateStatus || "Estimate Completed",
    invoiceStatus: existing?.invoiceStatus || "Not Created",
    reviewStatus: existing?.reviewStatus || "Not Ready",
    estimateTotal: Number(row.gross) || 0,
    depositTotal: estimateDeposit,
    materialTotal: Number(row.expenses) || 0,
    materialItems: estimateMaterialItems(data),
    editableEstimate: data,
    notes: Array.isArray(existing?.notes) && existing.notes.length
      ? existing.notes
      : [{ at: importedAt, text: data.notes || "Estimate uploaded into Revenue. Treat as a new lead/customer file." }],
    timeline: [
      ...(Array.isArray(existing?.timeline) ? existing.timeline : []),
      existing ? `Estimate file updated ${formatNoteTimestamp(importedAt)}` : `Estimate file uploaded ${formatNoteTimestamp(importedAt)}`,
    ],
  };
  return file;
}

function dashboardApprovedFileFromEstimate(data, row) {
  const file = dashboardFileFromEstimate(data, row);
  const importedAt = new Date().toISOString();
  return {
    ...file,
    fileStatus: "Job Won",
    statusDetail: "Start Date Pending",
    projectStage: "Scheduled",
    estimateStatus: "Approved",
    invoiceStatus: "Not Created",
    nextAction: "Set start date, create invoice, and prepare assignment",
    nextActionDate: todayIso(1),
    notes: [
      ...(Array.isArray(file.notes) ? file.notes : []),
      { at: importedAt, text: "Approved estimate imported. Next step: set start date, prepare invoice/deposit, and build assignment." },
    ],
    timeline: [...(Array.isArray(file.timeline) ? file.timeline : []), `Approved estimate imported ${formatNoteTimestamp(importedAt)}`],
  };
}

function upsertDashboardFileFromEstimate(data, row, options = {}) {
  const file = options.approved ? dashboardApprovedFileFromEstimate(data, row) : dashboardFileFromEstimate(data, row);
  const existingIndex = crmFiles.findIndex((entry) => entry.id === file.id || entry.fileNumber === file.fileNumber);
  if (existingIndex >= 0) {
    crmFiles[existingIndex] = file;
  } else {
    crmFiles.unshift(file);
  }
  row.dashboardFileId = file.id;
  row.attachedEstimate = {
    ...(row.attachedEstimate || {}),
    dashboardFileId: file.id,
    fileNumber: file.fileNumber,
  };
  activeFileId = file.id;
  saveCrmFiles();
  return file;
}

function createDashboardFileFromRevenueRow(row) {
  const estimate = row.attachedEstimate || {};
  const importedAt = new Date().toISOString();
  const file = {
    id: makeCrmId("file"),
    fileNumber: estimate.fileNumber || estimate.estimateNumber || makeCrmFileNumber(),
    clientName: estimate.clientName || row.clientJob || "Unnamed Client",
    clientPhone: estimate.clientPhone || "",
    clientEmail: estimate.clientEmail || "",
    projectAddress: estimate.projectAddress || "",
    leadSource: "Estimate Upload",
    fileStatus: "New Lead",
    statusDetail: "Needs Contact",
    projectType: "Other",
    projectStage: "Lead",
    contactEmailSent: "No",
    contactTextSent: "No",
    inspectionDateSet: "No",
    inspectionDate: "",
    inspectionTime: "",
    startDate: "",
    arrivalWindow: "Open",
    followUpDate: "",
    anticipatedCompletionDate: "",
    nextAction: "Review estimate and contact customer",
    nextActionDate: todayIso(1),
    warrantyStatus: "Not Sent",
    depositSecured: "No",
    initialDepositSecured: "No",
    initialDeposit: "",
    midpointDepositSecured: "No",
    midpointDeposit: "",
    paidInFull: "No",
    closingCallCompleted: "No",
    finalPaymentSecured: "No",
    finalPaymentAmount: "",
    invoiceSent: "No",
    invoicePaid: "No",
    reviewRequested: "No",
    reviewSent: "No",
    estimateStatus: "Estimate Completed",
    invoiceStatus: "Not Created",
    reviewStatus: "Not Ready",
    estimateTotal: Number(row.gross) || 0,
    depositTotal: 0,
    materialTotal: Number(row.expenses) || 0,
    materialItems: Array.isArray(estimate.materialItems) ? estimate.materialItems : [],
    notes: [{ at: importedAt, text: "Lead file created from an attached Revenue estimate." }],
    timeline: [`Revenue estimate linked ${formatNoteTimestamp(importedAt)}`],
  };
  crmFiles.unshift(file);
  row.dashboardFileId = file.id;
  row.attachedEstimate = {
    ...estimate,
    dashboardFileId: file.id,
    fileNumber: file.fileNumber,
  };
  activeFileId = file.id;
  saveCrmFiles();
  saveRevenueRows();
  return file;
}

function revenueTotals() {
  return filteredRevenueRows().reduce(
    (totals, row) => {
      totals.gross += Number(row.gross) || 0;
      totals.expenses += Number(row.expenses) || 0;
      totals.labor += Number(row.labor) || 0;
      totals.profit += revenueProfit(row);
      return totals;
    },
    { gross: 0, expenses: 0, labor: 0, profit: 0 },
  );
}

function revenueProfit(row) {
  return (Number(row.gross) || 0) - (Number(row.expenses) || 0) - (Number(row.labor) || 0);
}

function expenseLineTotal(row) {
  if (!Array.isArray(row?.expenseLines)) return 0;
  return row.expenseLines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
}

function syncRevenueExpenseTotal(row) {
  const total = expenseLineTotal(row);
  if (total > 0 || (Array.isArray(row?.expenseLines) && row.expenseLines.length)) {
    row.expenses = total;
  }
  row.profit = revenueProfit(row);
}

function revenueDateValue(row) {
  const parsed = Date.parse(row.date || "");
  return Number.isNaN(parsed) ? 0 : parsed;
}

function revenueYear(row) {
  const rawDate = String(row.date || "").trim();
  const match = rawDate.match(/\b(20\d{2})\b/);
  if (match) return match[1];
  const parsed = Date.parse(rawDate);
  return Number.isNaN(parsed) ? "" : String(new Date(parsed).getFullYear());
}

function revenueYearOptions() {
  const years = new Set(crmRevenueRows.map((row) => revenueYear(row)).filter(Boolean));
  years.add(String(new Date().getFullYear()));
  return [...years].sort((a, b) => Number(b) - Number(a));
}

function filteredRevenueRows() {
  if (!crmRevenueYearFilter || crmRevenueYearFilter === "all") return [...crmRevenueRows];
  return crmRevenueRows.filter((row) => revenueYear(row) === crmRevenueYearFilter);
}

function sortedRevenueRows() {
  return filteredRevenueRows().sort((a, b) => {
    const difference = revenueDateValue(a) - revenueDateValue(b);
    return crmRevenueDateSort === "oldest" ? difference : -difference;
  });
}

function revenueRowKey(row) {
  return String(row.id || row.fileNumber || row.attachedEstimate?.fileNumber || row.dashboardFileId || row.clientJob || "")
    .trim()
    .toLowerCase();
}

function loadDeletedRevenueKeys() {
  try {
    const saved = localStorage.getItem(CRM_REVENUE_DELETED_KEY);
    const keys = saved ? JSON.parse(saved) : [];
    return new Set(Array.isArray(keys) ? keys : []);
  } catch (error) {
    return new Set();
  }
}

function saveDeletedRevenueKeys(keys) {
  try {
    localStorage.setItem(CRM_REVENUE_DELETED_KEY, JSON.stringify(Array.from(keys)));
  } catch (error) {
    // Local storage can be blocked in some browser privacy modes.
  }
}

function rememberDeletedRevenueRow(row) {
  const key = revenueRowKey(row);
  if (!key) return;
  const deletedKeys = loadDeletedRevenueKeys();
  deletedKeys.add(key);
  saveDeletedRevenueKeys(deletedKeys);
}

function filterDeletedRevenueRows(rows = [], deletedKeys = loadDeletedRevenueKeys()) {
  return rows.filter((row) => !deletedKeys.has(revenueRowKey(row)));
}

function mergeRevenueRows(primary = [], secondary = []) {
  const merged = [];
  const seen = new Set();
  [...primary, ...secondary].forEach((row) => {
    const key = revenueRowKey(row);
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push({ ...row });
  });
  return merged;
}

function dedupeRevenueRows(rows = []) {
  const merged = [];
  const seen = new Set();
  rows.forEach((row) => {
    const key = revenueRowKey(row);
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push({ ...row });
  });
  return merged;
}

function revenueRowForDashboardFile(file) {
  if (!file) return null;
  return crmRevenueRows.find((row) => {
    return row.dashboardFileId === file.id
      || row.attachedEstimate?.dashboardFileId === file.id
      || row.attachedEstimate?.fileNumber === file.fileNumber
      || row.fileNumber === file.fileNumber;
  }) || null;
}

function shouldCreateRevenueRowForFile(file) {
  return !!file && file.fileStatus === "In Progress" && file.revenueExcluded !== true;
}

function ensureRevenueRowForFile(file) {
  if (!shouldCreateRevenueRowForFile(file)) return null;
  const existing = revenueRowForDashboardFile(file);
  const estimateTotal = Number(file.estimateTotal) || Number(file.editableEstimate?.totals?.total) || 0;
  const materialTotal = Number(file.materialTotal) || Number(file.editableEstimate?.backend?.estimatedMaterialCost) || 0;
  const fileNumber = file.fileNumber || makeCrmFileNumber();
  const baseRow = existing || {
    id: makeCrmId("rev-file"),
    date: todayIso(0),
    labor: 0,
    receiptNotes: "",
    laborAssigns: "",
  };
  const row = {
    ...baseRow,
    dashboardFileId: file.id,
    fileNumber,
    clientJob: `${file.clientName || "Unnamed Client"} - ${fileNumber}`,
    gross: estimateTotal,
    expenses: materialTotal,
    profit: estimateTotal - materialTotal - (Number(baseRow.labor) || 0),
    attachedEstimate: {
      ...(baseRow.attachedEstimate || {}),
      ...(file.editableEstimate || {}),
      dashboardFileId: file.id,
      fileNumber,
      estimateNumber: fileNumber,
      clientName: file.clientName || "",
      clientPhone: file.clientPhone || "",
      clientEmail: file.clientEmail || "",
      projectAddress: file.projectAddress || "",
      total: estimateTotal,
      materialTotal,
      materialItems: Array.isArray(file.materialItems) ? file.materialItems : baseRow.attachedEstimate?.materialItems || [],
      savedAt: new Date().toISOString(),
    },
  };
  if (existing) {
    const index = crmRevenueRows.findIndex((entry) => entry.id === existing.id);
    if (index >= 0) crmRevenueRows[index] = row;
  } else {
    crmRevenueRows.unshift(row);
    activeRevenueId = row.id;
    addSystemNote(file, "Revenue row created because this file was marked In Progress.");
  }
  crmRevenueRows = dedupeRevenueRows(crmRevenueRows);
  saveRevenueRows();
  return row;
}

function findFileForRevenue(row) {
  if (row.dashboardFileId) {
    const linkedFile = crmFiles.find((file) => file.id === row.dashboardFileId);
    if (linkedFile) return linkedFile;
  }
  if (row.attachedEstimate?.dashboardFileId) {
    const linkedFile = crmFiles.find((file) => file.id === row.attachedEstimate.dashboardFileId);
    if (linkedFile) return linkedFile;
  }
  if (row.attachedEstimate?.fileNumber) {
    const numberedFile = crmFiles.find((file) => file.fileNumber === row.attachedEstimate.fileNumber);
    if (numberedFile) return numberedFile;
  }
  const needle = String(row.clientJob || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!needle) return null;
  return crmFiles.find((file) => {
    const haystack = `${file.clientName || ""} ${file.projectAddress || ""}`.toLowerCase().replace(/[^a-z0-9]/g, "");
    return haystack && (needle.includes(haystack) || haystack.includes(needle.slice(0, Math.min(needle.length, 10))));
  }) || null;
}

function renderRevenue() {
  const totals = revenueTotals();
  $("crmRevenueGross").textContent = crmCurrency.format(totals.gross);
  $("crmRevenueExpenses").textContent = crmCurrency.format(totals.expenses);
  $("crmRevenueLabor").textContent = crmCurrency.format(totals.labor);
  $("crmRevenueProfit").textContent = crmCurrency.format(totals.profit);

  const sortControl = $("crmRevenueDateSort");
  if (sortControl) sortControl.value = crmRevenueDateSort;
  const yearControl = $("crmRevenueYearFilter");
  if (yearControl) {
    const years = revenueYearOptions();
    yearControl.innerHTML = `<option value="all">All Years</option>${years
      .map((year) => `<option value="${escapeHtml(year)}">${escapeHtml(year)}</option>`)
      .join("")}`;
    if (crmRevenueYearFilter !== "all" && !years.includes(crmRevenueYearFilter)) {
      crmRevenueYearFilter = years[0] || "all";
    }
    yearControl.value = crmRevenueYearFilter;
  }

  const visibleRevenueRows = sortedRevenueRows();
  $("crmRevenueRows").innerHTML = visibleRevenueRows.length ? visibleRevenueRows
    .map((row) => {
      const file = findFileForRevenue(row);
      return `
        <tr class="${row.id === activeRevenueId ? "active" : ""}">
          <td><input class="crm-revenue-input crm-revenue-date" type="date" value="${escapeHtml(row.date || "")}" data-revenue-edit="${escapeHtml(row.id)}" data-revenue-field="date"></td>
          <td>
            <input class="crm-revenue-input crm-revenue-job" type="text" value="${escapeHtml(row.clientJob || "")}" data-revenue-edit="${escapeHtml(row.id)}" data-revenue-field="clientJob" placeholder="Client / job">
            ${file ? `<small>${escapeHtml(file.fileNumber)}</small>` : ""}
          </td>
          <td><input class="crm-revenue-input crm-money-input" inputmode="decimal" value="${escapeHtml(Number(row.gross) || "")}" data-revenue-edit="${escapeHtml(row.id)}" data-revenue-field="gross" placeholder="0"></td>
          <td><input class="crm-revenue-input crm-money-input" inputmode="decimal" value="${escapeHtml(Number(row.expenses) || "")}" data-revenue-edit="${escapeHtml(row.id)}" data-revenue-field="expenses" placeholder="0"></td>
          <td><input class="crm-revenue-input crm-money-input" inputmode="decimal" value="${escapeHtml(Number(row.labor) || "")}" data-revenue-edit="${escapeHtml(row.id)}" data-revenue-field="labor" placeholder="0"></td>
          <td><strong class="crm-profit-value">${crmCurrency.format(revenueProfit(row))}</strong></td>
          <td><textarea class="crm-revenue-input crm-revenue-notes" data-revenue-edit="${escapeHtml(row.id)}" data-revenue-field="receiptNotes" placeholder="Receipt notes">${escapeHtml(row.receiptNotes || "")}</textarea></td>
          <td><input class="crm-revenue-input" type="text" value="${escapeHtml(row.laborAssigns || "")}" data-revenue-edit="${escapeHtml(row.id)}" data-revenue-field="laborAssigns" placeholder="Labor"></td>
          <td class="crm-revenue-actions">
            <button type="button" data-revenue-delete="${escapeHtml(row.id)}">Delete</button>
          </td>
        </tr>
      `;
    })
    .join("") : `<tr><td colspan="9" class="crm-empty-row">No revenue rows for this year.</td></tr>`;
  document.querySelectorAll("[data-revenue-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteRevenueRow(button.dataset.revenueDelete));
  });
  document.querySelectorAll("[data-revenue-edit]").forEach((field) => {
    field.addEventListener("change", () => updateRevenueField(field));
    field.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && field.tagName !== "TEXTAREA") {
        event.preventDefault();
        field.blur();
      }
    });
  });
  renderExpenseDetail();
}

function updateRevenueRows() {
  document.querySelectorAll("[data-revenue-edit]").forEach((field) => {
    const row = crmRevenueRows.find((entry) => entry.id === field.dataset.revenueEdit);
    if (!row) return;
    const key = field.dataset.revenueField;
    if (["gross", "expenses", "labor"].includes(key)) {
      row[key] = parseMoney(field.value);
      field.value = row[key] ? row[key] : "";
    } else if (key === "date") {
      row[key] = normalizeDate(field.value);
      field.value = row[key];
    } else {
      row[key] = field.value;
    }
    syncRevenueExpenseTotal(row);
  });
  syncActiveExpenseDetailEdits();
  saveRevenueRows();
  renderRevenue();
  const button = $("crmUpdateRevenue");
  if (!button) return;
  button.textContent = "Updated";
  window.setTimeout(() => {
    const refreshedButton = $("crmUpdateRevenue");
    if (refreshedButton) refreshedButton.textContent = "Update Revenue";
  }, 1000);
}

function syncActiveExpenseDetailEdits() {
  const row = crmRevenueRows.find((entry) => entry.id === activeRevenueId);
  if (!row) return;
  document.querySelectorAll("[data-expense-detail-field]").forEach((field) => {
    row[field.dataset.expenseDetailField] = field.value;
  });
  const nextLines = [];
  document.querySelectorAll("[data-expense-line-id]").forEach((element) => {
    const id = element.dataset.expenseLineId;
    if (!id || nextLines.some((line) => line.id === id)) return;
    const category = document.querySelector(`[data-expense-line-category="${id}"]`)?.value || "Supplies";
    const note = document.querySelector(`[data-expense-line-note="${id}"]`)?.value || "";
    const amount = parseMoney(document.querySelector(`[data-expense-line-amount="${id}"]`)?.value || "");
    if (!category && !note && !amount) return;
    nextLines.push({ id, category, note, amount });
  });
  row.expenseLines = nextLines;
  syncRevenueExpenseTotal(row);
}

function renderExpenseDetail() {
  const row = crmRevenueRows.find((entry) => entry.id === activeRevenueId) || crmRevenueRows[0];
  if (!row) {
    $("crmExpenseDetail").innerHTML = `<p class="crm-empty-state">Select a revenue row to see expense details.</p>`;
    return;
  }
  const file = findFileForRevenue(row);
  const expenseLines = Array.isArray(row.expenseLines) ? row.expenseLines : [];
  $("crmExpenseDetail").innerHTML = `
    <p class="eyebrow">${escapeHtml(row.date || "No date")}</p>
    <h3>${escapeHtml(row.clientJob || "Unnamed Job")}</h3>
    <dl>
      <div><dt>Gross</dt><dd>${crmCurrency.format(Number(row.gross) || 0)}</dd></div>
      <div><dt>Expenses</dt><dd>${crmCurrency.format(Number(row.expenses) || 0)}</dd></div>
      <div><dt>Labor</dt><dd>${crmCurrency.format(Number(row.labor) || 0)}</dd></div>
      <div><dt>Profit</dt><dd>${crmCurrency.format(revenueProfit(row))}</dd></div>
    </dl>
    <label class="crm-revenue-editor">
      <span>Receipt Notes</span>
      <textarea rows="7" data-expense-detail-field="receiptNotes">${escapeHtml(row.receiptNotes || "")}</textarea>
    </label>
    <label class="crm-revenue-editor">
      <span>Labor Assigns</span>
      <input type="text" value="${escapeHtml(row.laborAssigns || "")}" data-expense-detail-field="laborAssigns">
    </label>
    <section class="crm-expense-lines">
      <div class="crm-expense-lines-heading">
        <span>Expense Lines</span>
        <strong>${crmCurrency.format(expenseLineTotal(row))}</strong>
      </div>
      ${
        expenseLines.length
          ? expenseLines.map((line) => `
              <div class="crm-expense-line" data-expense-line-id="${escapeHtml(line.id)}">
                <select data-expense-line-category="${escapeHtml(line.id)}">
                  <option${line.category === "Supplies" ? " selected" : ""}>Supplies</option>
                  <option${line.category === "Equipment" ? " selected" : ""}>Equipment</option>
                  <option${line.category === "Other" ? " selected" : ""}>Other</option>
                </select>
                <input type="text" value="${escapeHtml(line.note || "")}" data-expense-line-note="${escapeHtml(line.id)}" placeholder="Vendor or note">
                <input type="text" inputmode="decimal" value="${escapeHtml(Number(line.amount) || "")}" data-expense-line-amount="${escapeHtml(line.id)}" placeholder="0.00">
                <button type="button" data-expense-line-delete="${escapeHtml(line.id)}">Delete</button>
              </div>
            `).join("")
          : `<p class="crm-empty-state">No detailed expense lines yet.</p>`
      }
    </section>
    ${
      row.attachedEstimate
        ? `<div class="crm-attached-estimate">
            <p class="eyebrow">Attached Estimate</p>
            <strong>${escapeHtml(row.attachedEstimate.estimateNumber || "Estimate")}</strong>
            <span>${escapeHtml(row.attachedEstimate.clientName || row.clientJob || "")}</span>
            <span>${escapeHtml(row.attachedEstimate.fileName || "")}</span>
            <em>Next: open the lead file, contact the customer, and schedule the inspection or follow-up.</em>
          </div>`
        : `<p class="crm-empty-state">No estimate file attached yet.</p>`
    }
    <div class="crm-add-expense">
      <label>
        <span>Category</span>
        <select id="crmExpenseCategory">
          <option>Supplies</option>
          <option>Equipment</option>
          <option>Other</option>
        </select>
      </label>
      <label>
        <span>Vendor / Note</span>
        <input type="text" id="crmExpenseVendor" placeholder="Home Depot, Sherwin, Amazon">
      </label>
      <label>
        <span>Amount</span>
        <input type="text" inputmode="decimal" id="crmExpenseAmount" placeholder="0.00">
      </label>
      <button type="button" id="crmAddExpenseLine">Add Expense</button>
    </div>
    ${
      file || row.attachedEstimate
        ? `<button type="button" class="icon-button" id="crmOpenRevenueFile">${file ? "Open Lead File" : "Create Lead File"}</button>`
        : `<p class="crm-empty-state">No matching customer file linked yet.</p>`
    }
  `;
  document.querySelectorAll("[data-expense-detail-field]").forEach((field) => {
    field.addEventListener("change", () => {
      row[field.dataset.expenseDetailField] = field.value;
      saveRevenueRows();
      renderRevenue();
    });
  });
  const addExpenseButton = $("crmAddExpenseLine");
  if (addExpenseButton) {
    addExpenseButton.addEventListener("click", () => addExpenseLine(row.id));
  }
  document.querySelectorAll("[data-expense-line-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteExpenseLine(row.id, button.dataset.expenseLineDelete));
  });
  const openButton = $("crmOpenRevenueFile");
  if (openButton && (file || row.attachedEstimate)) {
    openButton.addEventListener("click", () => {
      const linkedFile = file || createDashboardFileFromRevenueRow(row);
      activeFileId = linkedFile.id;
      switchCrmView("dashboard");
      renderCrm();
    });
  }
}

function fileExpenseTotal(file) {
  return (Array.isArray(file?.expenseLines) ? file.expenseLines : []).reduce((sum, line) => {
    return sum + (Number(line.amount) || 0);
  }, 0);
}

function syncFileExpensesToRevenue(file) {
  if (!file) return;
  const row = revenueRowForDashboardFile(file);
  if (!row) return;
  row.expenseLines = Array.isArray(file.expenseLines) ? file.expenseLines.map((line) => ({ ...line })) : [];
  syncRevenueExpenseTotal(row);
  saveRevenueRows();
}

function renderFileExpenses() {
  const file = normalizeCrmFile(activeFile());
  const title = $("crmExpensesFileTitle");
  const heading = $("crmExpensesHeading");
  const total = $("crmFileExpenseTotal");
  const rows = $("crmFileExpenseRows");
  const preview = $("crmReceiptPreview");
  if (!file) {
    title.textContent = "Select a file to track expenses.";
    heading.textContent = "No file selected";
    total.textContent = crmCurrency.format(0);
    rows.innerHTML = `<tr><td colspan="7">No file selected.</td></tr>`;
    preview.innerHTML = "";
    return;
  }
  title.textContent = `${file.fileNumber || "Project"} · ${file.clientName || "Unnamed Client"}`;
  heading.textContent = file.clientName || "Unnamed Client";
  total.textContent = crmCurrency.format(fileExpenseTotal(file));
  rows.innerHTML = (file.expenseLines || []).map((line) => `
    <tr>
      <td><input class="crm-revenue-input" type="date" value="${escapeHtml(line.date || todayIso(0))}" data-file-expense-field="date" data-file-expense-id="${escapeHtml(line.id)}"></td>
      <td>
        <select class="crm-revenue-input" data-file-expense-field="category" data-file-expense-id="${escapeHtml(line.id)}">
          <option${line.category === "Supplies" ? " selected" : ""}>Supplies</option>
          <option${line.category === "Equipment" ? " selected" : ""}>Equipment</option>
          <option${line.category === "Labor" ? " selected" : ""}>Labor</option>
          <option${line.category === "Other" ? " selected" : ""}>Other</option>
        </select>
      </td>
      <td><input class="crm-revenue-input" type="text" value="${escapeHtml(line.vendor || "")}" data-file-expense-field="vendor" data-file-expense-id="${escapeHtml(line.id)}" placeholder="Store"></td>
      <td><textarea class="crm-revenue-input crm-revenue-notes" data-file-expense-field="note" data-file-expense-id="${escapeHtml(line.id)}" placeholder="Items / notes">${escapeHtml(line.note || "")}</textarea></td>
      <td><input class="crm-revenue-input crm-money-input" type="text" inputmode="decimal" value="${escapeHtml(Number(line.amount) || "")}" data-file-expense-field="amount" data-file-expense-id="${escapeHtml(line.id)}" placeholder="0.00"></td>
      <td>${line.receiptDataUrl ? `<button type="button" data-file-receipt-preview="${escapeHtml(line.id)}">View</button>` : `<span class="crm-muted">None</span>`}</td>
      <td><button type="button" data-file-expense-delete="${escapeHtml(line.id)}">Delete</button></td>
    </tr>
  `).join("") || `<tr><td colspan="7">No expenses added yet.</td></tr>`;

  const receiptLine = (file.expenseLines || []).find((line) => line.receiptDataUrl);
  preview.innerHTML = receiptLine
    ? `<img src="${escapeHtml(receiptLine.receiptDataUrl)}" alt="Receipt preview"><p>${escapeHtml(receiptLine.vendor || receiptLine.note || "Receipt attached")}</p>`
    : `<p class="crm-empty-state">No receipt photo attached yet.</p>`;

  document.querySelectorAll("[data-file-expense-field]").forEach((field) => {
    field.addEventListener("change", () => updateFileExpenseField(field));
  });
  document.querySelectorAll("[data-file-expense-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteFileExpenseLine(button.dataset.fileExpenseDelete));
  });
  document.querySelectorAll("[data-file-receipt-preview]").forEach((button) => {
    button.addEventListener("click", () => {
      const line = file.expenseLines.find((entry) => entry.id === button.dataset.fileReceiptPreview);
      preview.innerHTML = line?.receiptDataUrl
        ? `<img src="${escapeHtml(line.receiptDataUrl)}" alt="Receipt preview"><p>${escapeHtml(line.vendor || line.note || "Receipt attached")}</p>`
        : `<p class="crm-empty-state">No receipt photo attached yet.</p>`;
    });
  });
}

function addFileExpenseLine() {
  const file = normalizeCrmFile(activeFile());
  if (!file) {
    window.alert("Select a customer file before adding an expense.");
    return;
  }
  file.expenseLines.push({
    id: makeCrmId("expense"),
    date: todayIso(0),
    category: "Supplies",
    vendor: "",
    note: "",
    amount: "",
    receiptDataUrl: "",
  });
  addSystemNote(file, "Expense line added.");
  syncFileExpensesToRevenue(file);
  saveCrmFiles();
  renderFileExpenses();
}

function updateFileExpenseField(field) {
  const file = normalizeCrmFile(activeFile());
  if (!file) return;
  const line = file.expenseLines.find((entry) => entry.id === field.dataset.fileExpenseId);
  if (!line) return;
  const key = field.dataset.fileExpenseField;
  line[key] = key === "amount" ? parseMoney(field.value) : field.value;
  syncFileExpensesToRevenue(file);
  saveCrmFiles();
  renderFileExpenses();
}

function deleteFileExpenseLine(lineId) {
  const file = normalizeCrmFile(activeFile());
  if (!file) return;
  file.expenseLines = file.expenseLines.filter((line) => line.id !== lineId);
  addSystemNote(file, "Expense line deleted.");
  syncFileExpensesToRevenue(file);
  saveCrmFiles();
  renderFileExpenses();
}

function attachReceiptToFileExpense(uploadFile) {
  const file = normalizeCrmFile(activeFile());
  if (!file || !uploadFile) return;
  const openLines = file.expenseLines.filter((entry) => !entry.receiptDataUrl);
  const targetLine = openLines[openLines.length - 1] || {
    id: makeCrmId("expense"),
    date: todayIso(0),
    category: "Supplies",
    vendor: "",
    note: uploadFile.name || "Receipt photo",
    amount: "",
    receiptDataUrl: "",
  };
  if (!file.expenseLines.some((line) => line.id === targetLine.id)) file.expenseLines.push(targetLine);
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    targetLine.receiptDataUrl = reader.result;
    if (!targetLine.note) targetLine.note = uploadFile.name || "Receipt photo";
    addSystemNote(file, "Receipt photo attached to expenses.");
    syncFileExpensesToRevenue(file);
    saveCrmFiles();
    renderFileExpenses();
  });
  reader.readAsDataURL(uploadFile);
}

function updateRevenueField(field) {
  const row = crmRevenueRows.find((entry) => entry.id === field.dataset.revenueEdit);
  if (!row) return;
  const key = field.dataset.revenueField;
  if (["gross", "expenses", "labor"].includes(key)) {
    row[key] = parseMoney(field.value);
  } else if (key === "date") {
    row[key] = normalizeDate(field.value);
  } else {
    row[key] = field.value;
  }
  row.profit = revenueProfit(row);
  activeRevenueId = row.id;
  saveRevenueRows();
  renderRevenue();
}

function addExpenseLine(rowId) {
  const row = crmRevenueRows.find((entry) => entry.id === rowId);
  if (!row) return;
  syncActiveExpenseDetailEdits();
  const category = $("crmExpenseCategory")?.value || "Supplies";
  const vendor = $("crmExpenseVendor").value.trim();
  const amount = parseMoney($("crmExpenseAmount").value);
  if (!vendor && !amount) {
    window.alert("Add an expense note or amount first.");
    return;
  }
  row.expenseLines = Array.isArray(row.expenseLines) ? row.expenseLines : [];
  row.expenseLines.push({
    id: makeCrmId("expense"),
    category,
    note: vendor,
    amount,
  });
  const note = amount ? `${category} - ${vendor || "Expense"}: ${crmCurrency.format(amount)}` : `${category} - ${vendor}`;
  row.receiptNotes = [row.receiptNotes, note].filter(Boolean).join("\n");
  syncRevenueExpenseTotal(row);
  saveRevenueRows();
  renderRevenue();
}

function deleteExpenseLine(rowId, lineId) {
  const row = crmRevenueRows.find((entry) => entry.id === rowId);
  if (!row || !Array.isArray(row.expenseLines)) return;
  row.expenseLines = row.expenseLines.filter((line) => line.id !== lineId);
  syncRevenueExpenseTotal(row);
  saveRevenueRows();
  renderRevenue();
}

function deleteRevenueRow(rowId) {
  const row = crmRevenueRows.find((entry) => entry.id === rowId);
  if (!row) return;
  if (!window.confirm(`Delete the revenue row for ${row.clientJob || "this job"}?`)) return;
  rememberDeletedRevenueRow(row);
  const file = findFileForRevenue(row);
  if (file) {
    file.revenueExcluded = true;
    addSystemNote(file, "Revenue row removed manually. It will not be recreated unless the file is marked In Progress again.");
  }
  crmRevenueRows = crmRevenueRows.filter((entry) => entry.id !== rowId);
  activeRevenueId = crmRevenueRows[0] ? crmRevenueRows[0].id : null;
  saveCrmFiles();
  saveRevenueRows();
  renderRevenue();
}

function parseRevenueImport(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.split("\t"))
    .filter((cells) => cells.some((cell) => String(cell || "").trim()))
    .filter((cells) => !/^date$/i.test(String(cells[0] || "").trim()))
    .map((cells, index) => {
      const gross = parseMoney(cells[2]);
      const expenses = parseMoney(cells[3]);
      const labor = parseMoney(cells[4]);
      const profit = cells[5] === undefined || cells[5] === "" ? gross - expenses - labor : parseMoney(cells[5]);
      return {
        id: `rev-import-${Date.now()}-${index}`,
        date: normalizeDate(cells[0]),
        clientJob: String(cells[1] || "").trim(),
        gross,
        expenses,
        labor,
        profit,
        receiptNotes: String(cells[6] || "").trim(),
        laborAssigns: String(cells[7] || "").trim(),
      };
    })
    .filter((row) => row.clientJob || row.gross || row.expenses || row.labor);
}

function importRevenueRows() {
  const rows = parseRevenueImport($("crmRevenueImport").value);
  if (!rows.length) {
    window.alert("Paste revenue rows from Google Sheets first.");
    return;
  }
  crmRevenueRows = rows;
  activeRevenueId = rows[0].id;
  $("crmRevenueImport").value = "";
  saveRevenueRows();
  renderRevenue();
}

function addRevenueRow() {
  const row = {
    id: makeCrmId("rev"),
    date: todayIso(0),
    clientJob: "",
    gross: 0,
    expenses: 0,
    labor: 0,
    profit: 0,
    receiptNotes: "",
    laborAssigns: "",
  };
  crmRevenueRows.unshift(row);
  activeRevenueId = row.id;
  saveRevenueRows();
  renderRevenue();
}

function uploadEstimateToRevenue(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const data = parseEstimateFileText(reader.result);
      const row = revenueRowFromEstimate(data, file.name);
      const dashboardFile = upsertDashboardFileFromEstimate(data, row);
      crmRevenueRows.unshift(row);
      activeRevenueId = row.id;
      saveRevenueRows();
      renderRevenue();
      window.alert(`${dashboardFile.clientName || "Customer"} was added as a Dashboard lead and linked to Revenue.`);
    } catch (error) {
      window.alert(`${error.message || "That file could not be uploaded."} Please choose an editable D2 estimate file ending in .d2estimate.`);
    }
  });
  reader.readAsText(file);
}

function importApprovedEstimateFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const data = parseEstimateFileText(reader.result);
      const row = revenueRowFromEstimate(data, file.name);
      const dashboardFile = upsertDashboardFileFromEstimate(data, row, { approved: true });
      crmRevenueRows.unshift(row);
      activeRevenueId = row.id;
      activeFileId = dashboardFile.id;
      saveRevenueRows();
      switchCrmView("dashboard");
      renderCrm();
      window.alert(`${dashboardFile.clientName || "Approved estimate"} is now your active Dashboard file.`);
    } catch (error) {
      window.alert(`${error.message || "That file could not be imported."} Please choose an editable D2 estimate file ending in .d2estimate.`);
    }
  });
  reader.readAsText(file);
}

function priceDatabaseRows() {
  const deletedIds = new Set(crmDeletedPriceIds);
  const customRows = crmPriceRows.map((row) => ({ ...normalizedPriceRow(row), readonly: false }));
  const overriddenIds = new Set(customRows.map((row) => row.sourceId).filter(Boolean));
  const baseRows = Array.isArray(window.D2_MATERIALS_DATABASE)
    ? window.D2_MATERIALS_DATABASE
        .filter((row) => !overriddenIds.has(row.id) && !deletedIds.has(row.id))
        .map((row) => ({ ...normalizedPriceRow(row), readonly: true }))
    : [];
  return [...customRows.filter((row) => !deletedIds.has(row.id) && !deletedIds.has(row.sourceId)), ...baseRows];
}

function visiblePriceDatabaseRows() {
  const query = String($("crmPriceSearch")?.value || "").trim().toLowerCase();
  const sort = $("crmPriceSort")?.value || "name";
  const rows = priceDatabaseRows().filter((row) => {
    if (!query) return true;
    const haystack = [row.product, row.name, row.category, row.vendor, row.source, row.unit, row.id].join(" ").toLowerCase();
    return haystack.includes(query);
  });
  const textValue = (row, key) => String(row[key] || "").toLowerCase();
  return rows.sort((a, b) => {
    if (sort === "price") return (Number(a.defaultPrice) || 0) - (Number(b.defaultPrice) || 0);
    if (sort === "category") return textValue(a, "category").localeCompare(textValue(b, "category")) || textValue(a, "product").localeCompare(textValue(b, "product"));
    if (sort === "vendor") return textValue(a, "vendor").localeCompare(textValue(b, "vendor")) || textValue(a, "product").localeCompare(textValue(b, "product"));
    return textValue(a, "product").localeCompare(textValue(b, "product"));
  });
}

function renderPriceDatabase() {
  const rows = visiblePriceDatabaseRows();
  $("crmPriceList").innerHTML = rows.length
    ? rows.map((row) => `
      ${row.id === editingPriceId ? renderEditablePriceRow(row) : renderReadonlyPriceRow(row)}
    `).join("")
    : `<p class="crm-empty-state">No price lines yet.</p>`;
  document.querySelectorAll("[data-price-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      editingPriceId = button.dataset.priceEdit;
      renderPriceDatabase();
    });
  });
  document.querySelectorAll("[data-price-save]").forEach((button) => {
    button.addEventListener("click", () => savePriceLineEdit(button.dataset.priceSave));
  });
  document.querySelectorAll("[data-price-cancel]").forEach((button) => {
    button.addEventListener("click", () => {
      editingPriceId = "";
      renderPriceDatabase();
    });
  });
  document.querySelectorAll("[data-price-delete]").forEach((button) => {
    button.addEventListener("click", () => deletePriceLine(button.dataset.priceDelete));
  });
}

function renderReadonlyPriceRow(row) {
  const product = row.product || row.name || "Unnamed item";
  return `
    <div class="crm-price-row">
      <div>
        <strong>${escapeHtml(product)}</strong>
        <span>${escapeHtml([row.category, row.vendor].filter(Boolean).join(" - "))}</span>
      </div>
      <small>${escapeHtml(row.unit || "each")}</small>
      <strong>${crmCurrency.format(Number(row.defaultPrice) || 0)}</strong>
      <button type="button" data-price-edit="${escapeHtml(row.id)}">Edit</button>
      <button type="button" data-price-delete="${escapeHtml(row.id)}">Delete</button>
      ${row.readonly ? `<em>Estimator</em>` : ""}
    </div>
  `;
}

function renderEditablePriceRow(row) {
  const product = row.product || row.name || "";
  return `
    <div class="crm-price-row crm-price-row-editing">
      <input data-price-field="product" data-price-id="${escapeHtml(row.id)}" value="${escapeHtml(product)}" placeholder="Item name">
      <input data-price-field="defaultPrice" data-price-id="${escapeHtml(row.id)}" type="number" min="0" step="0.01" value="${escapeHtml(Number(row.defaultPrice) || "")}" placeholder="Price">
      <input data-price-field="unit" data-price-id="${escapeHtml(row.id)}" value="${escapeHtml(row.unit || "each")}" placeholder="Unit">
      <input data-price-field="category" data-price-id="${escapeHtml(row.id)}" value="${escapeHtml(row.category || "")}" placeholder="Category">
      <input data-price-field="vendor" data-price-id="${escapeHtml(row.id)}" value="${escapeHtml(row.vendor || row.source || "")}" placeholder="Vendor">
      <button type="button" data-price-save="${escapeHtml(row.id)}">Save</button>
      <button type="button" data-price-cancel="${escapeHtml(row.id)}">Cancel</button>
    </div>
  `;
}

function cssIdentifier(value) {
  if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(value);
  return String(value).replace(/["\\]/g, "\\$&");
}

function savePriceLineEdit(id) {
  const existing = priceDatabaseRows().find((row) => row.id === id);
  if (!existing) return;
  const fieldValue = (field) => {
    const input = document.querySelector(`[data-price-id="${cssIdentifier(id)}"][data-price-field="${field}"]`);
    return input ? input.value.trim() : "";
  };
  const price = parseMoney(fieldValue("defaultPrice"));
  const updated = {
    ...(existing.readonly ? {} : existing),
    id: existing.readonly ? `custom-${makeCrmId("price")}` : existing.id,
    sourceId: existing.readonly ? existing.id : existing.sourceId,
    product: fieldValue("product") || existing.product || existing.name,
    name: fieldValue("product") || existing.product || existing.name,
    category: fieldValue("category") || "Custom",
    unit: fieldValue("unit") || "each",
    vendor: fieldValue("vendor"),
    source: fieldValue("vendor"),
    priceLow: price,
    priceHigh: price,
    defaultPrice: price,
    lastChecked: new Date().toISOString().slice(0, 10),
  };
  if (!updated.product || !updated.defaultPrice) {
    window.alert("Add an item name and price first.");
    return;
  }
  const index = crmPriceRows.findIndex((row) => row.id === id);
  if (index >= 0) {
    crmPriceRows[index] = updated;
  } else {
    crmPriceRows.unshift(updated);
  }
  editingPriceId = "";
  savePriceRows();
  renderPriceDatabase();
}

function addPriceLine() {
  const product = $("crmPriceProduct").value.trim();
  const price = parseMoney($("crmPriceAmount").value);
  if (!product || !price) {
    window.alert("Add an item name and price first.");
    return;
  }
  const vendor = $("crmPriceVendor").value.trim();
  crmPriceRows.unshift({
    id: `custom-${makeCrmId("price")}`,
    product,
    category: $("crmPriceCategory").value.trim() || "Custom",
    unit: $("crmPriceUnit").value.trim() || "each",
    vendor,
    source: vendor,
    priceLow: price,
    priceHigh: price,
    defaultPrice: price,
    lastChecked: new Date().toISOString().slice(0, 10),
  });
  savePriceRows();
  ["crmPriceProduct", "crmPriceAmount", "crmPriceUnit", "crmPriceCategory", "crmPriceVendor"].forEach((id) => {
    $(id).value = "";
  });
  renderPriceDatabase();
}

function deletePriceLine(id) {
  const row = priceDatabaseRows().find((entry) => entry.id === id);
  if (!row) return;
  const confirmed = window.confirm(`Delete ${row.product || row.name || "this price line"} from the price database?`);
  if (!confirmed) return;
  crmPriceRows = crmPriceRows.filter((entry) => entry.id !== id);
  if (row.readonly || row.sourceId) {
    crmDeletedPriceIds = Array.from(new Set([...crmDeletedPriceIds, row.sourceId || row.id]));
    saveDeletedPriceIds();
  }
  savePriceRows();
  renderPriceDatabase();
}

function blankReceiptLine() {
  return {
    id: makeCrmId("receipt"),
    use: true,
    product: "",
    price: "",
    unit: "each",
    category: "",
  };
}

function loadReceiptDraft() {
  try {
    const saved = localStorage.getItem(CRM_RECEIPT_DRAFT_KEY);
    const draft = saved ? JSON.parse(saved) : null;
    if (!draft || typeof draft !== "object") throw new Error("No draft");
    return {
      vendor: draft.vendor || "",
      date: draft.date || todayIso(0),
      category: draft.category || "Supplies",
      image: draft.image || "",
      lines: Array.isArray(draft.lines) && draft.lines.length ? draft.lines : [blankReceiptLine()],
    };
  } catch (error) {
    return {
      vendor: "",
      date: todayIso(0),
      category: "Supplies",
      image: "",
      lines: [blankReceiptLine()],
    };
  }
}

function saveReceiptDraft() {
  try {
    localStorage.setItem(CRM_RECEIPT_DRAFT_KEY, JSON.stringify(receiptDraft));
  } catch (error) {
    // Receipt images can be too large for local storage; the visible form still works.
  }
}

function captureReceiptDraftFields() {
  if ($("crmReceiptVendor")) receiptDraft.vendor = $("crmReceiptVendor").value.trim();
  if ($("crmReceiptDate")) receiptDraft.date = $("crmReceiptDate").value || todayIso(0);
  if ($("crmReceiptCategory")) receiptDraft.category = $("crmReceiptCategory").value || "Supplies";
  document.querySelectorAll("[data-receipt-line]").forEach((row) => {
    const line = receiptDraft.lines.find((entry) => entry.id === row.dataset.receiptLine);
    if (!line) return;
    line.use = Boolean(row.querySelector("[data-receipt-field='use']")?.checked);
    line.product = row.querySelector("[data-receipt-field='product']")?.value.trim() || "";
    line.price = row.querySelector("[data-receipt-field='price']")?.value || "";
    line.unit = row.querySelector("[data-receipt-field='unit']")?.value.trim() || "each";
    line.category = row.querySelector("[data-receipt-field='category']")?.value.trim() || receiptDraft.category || "Supplies";
  });
  saveReceiptDraft();
}

function renderReceiptScanner() {
  if (!$("crmReceiptRows")) return;
  $("crmReceiptVendor").value = receiptDraft.vendor || "";
  $("crmReceiptDate").value = receiptDraft.date || todayIso(0);
  $("crmReceiptCategory").value = receiptDraft.category || "Supplies";
  $("crmPriceReceiptPreview").innerHTML = receiptDraft.image
    ? `<img src="${receiptDraft.image}" alt="Uploaded receipt">`
    : `<p>No receipt uploaded yet.</p>`;
  $("crmReceiptRows").innerHTML = (receiptDraft.lines.length ? receiptDraft.lines : [blankReceiptLine()])
    .map((line) => `
      <tr data-receipt-line="${escapeHtml(line.id)}">
        <td><input data-receipt-field="use" type="checkbox" ${line.use !== false ? "checked" : ""} aria-label="Use this receipt line"></td>
        <td><input data-receipt-field="product" value="${escapeHtml(line.product)}" placeholder="Item name"></td>
        <td><input data-receipt-field="price" type="number" min="0" step="0.01" value="${escapeHtml(line.price)}" placeholder="0.00"></td>
        <td><input data-receipt-field="unit" value="${escapeHtml(line.unit || "each")}" placeholder="each"></td>
        <td><input data-receipt-field="category" value="${escapeHtml(line.category || receiptDraft.category || "Supplies")}" placeholder="Supplies"></td>
        <td><button type="button" data-receipt-delete="${escapeHtml(line.id)}">Delete</button></td>
      </tr>
    `).join("");
  document.querySelectorAll("[data-receipt-field]").forEach((field) => {
    field.addEventListener("input", captureReceiptDraftFields);
    field.addEventListener("change", captureReceiptDraftFields);
  });
  document.querySelectorAll("[data-receipt-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteReceiptLine(button.dataset.receiptDelete));
  });
}

function addReceiptLine(line = {}) {
  captureReceiptDraftFields();
  receiptDraft.lines.push({
    ...blankReceiptLine(),
    ...line,
    id: line.id || makeCrmId("receipt"),
  });
  saveReceiptDraft();
  renderReceiptScanner();
}

function deleteReceiptLine(id) {
  captureReceiptDraftFields();
  receiptDraft.lines = receiptDraft.lines.filter((line) => line.id !== id);
  if (!receiptDraft.lines.length) receiptDraft.lines.push(blankReceiptLine());
  saveReceiptDraft();
  renderReceiptScanner();
}

function clearReceiptScanner() {
  const confirmed = window.confirm("Clear the current receipt draft?");
  if (!confirmed) return;
  receiptDraft = {
    vendor: "",
    date: todayIso(0),
    category: "Supplies",
    image: "",
    lines: [blankReceiptLine()],
  };
  localStorage.removeItem(CRM_RECEIPT_DRAFT_KEY);
  if ($("crmReceiptPaste")) $("crmReceiptPaste").value = "";
  renderReceiptScanner();
}

function uploadReceiptForPrices(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    captureReceiptDraftFields();
    receiptDraft.image = reader.result;
    saveReceiptDraft();
    renderReceiptScanner();
  };
  reader.readAsDataURL(file);
}

function parseReceiptPaste() {
  const text = $("crmReceiptPaste").value.trim();
  if (!text) return;
  captureReceiptDraftFields();
  const parsed = text.split(/\n+/)
    .map((rawLine) => rawLine.trim())
    .filter(Boolean)
    .map((rawLine) => {
      const amountMatch = rawLine.match(/(-?\$?\d+(?:,\d{3})*(?:\.\d{1,2})?)\s*$/);
      const price = amountMatch ? parseMoney(amountMatch[1]) : 0;
      const product = amountMatch ? rawLine.slice(0, amountMatch.index).replace(/[-:$\s]+$/g, "").trim() : rawLine;
      return {
        id: makeCrmId("receipt"),
        use: true,
        product,
        price: price ? String(price) : "",
        unit: "each",
        category: receiptDraft.category || "Supplies",
      };
    });
  if (!parsed.length) return;
  receiptDraft.lines = parsed;
  saveReceiptDraft();
  renderReceiptScanner();
}

function normalizeReceiptProduct(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ");
}

function updatePriceDatabaseFromReceipt() {
  captureReceiptDraftFields();
  const usableLines = receiptDraft.lines
    .filter((line) => line.use !== false && line.product && parseMoney(line.price) > 0);
  if (!usableLines.length) {
    window.alert("Add at least one checked receipt line with an item name and price.");
    return;
  }
  const today = receiptDraft.date || todayIso(0);
  let updatedCount = 0;
  let addedCount = 0;
  usableLines.forEach((line) => {
    const productKey = normalizeReceiptProduct(line.product);
    const existing = priceDatabaseRows().find((row) => normalizeReceiptProduct(row.product || row.name) === productKey);
    const price = parseMoney(line.price);
    const updated = {
      ...(existing && !existing.readonly ? existing : {}),
      id: existing?.readonly ? `custom-${makeCrmId("price")}` : (existing?.id || `custom-${makeCrmId("price")}`),
      sourceId: existing?.readonly ? existing.id : existing?.sourceId,
      product: line.product,
      name: line.product,
      category: line.category || receiptDraft.category || existing?.category || "Supplies",
      unit: line.unit || existing?.unit || "each",
      vendor: receiptDraft.vendor || existing?.vendor || existing?.source || "",
      source: receiptDraft.vendor || existing?.vendor || existing?.source || "",
      priceLow: price,
      priceHigh: price,
      defaultPrice: price,
      lastChecked: today,
    };
    const index = crmPriceRows.findIndex((row) => row.id === updated.id);
    if (index >= 0) {
      crmPriceRows[index] = updated;
      updatedCount += 1;
    } else {
      crmPriceRows.unshift(updated);
      if (existing) updatedCount += 1;
      else addedCount += 1;
    }
  });
  savePriceRows();
  renderPriceDatabase();
  $("crmReceiptStatus").textContent = `${updatedCount} updated, ${addedCount} added to the Price Database.`;
}

function invoiceLineItemsFromEstimate(file) {
  const items = Array.isArray(file?.editableEstimate?.lineItems) ? file.editableEstimate.lineItems : [];
  const rows = items
    .filter((item) => String(item.name || "").trim())
    .map((item) => ({
      description: String(item.name || "").trim(),
      qty: item.type === "subline" ? "" : (item.qty || "1"),
      total: item.type === "subline" ? "" : ((Number(item.qty) || 1) * (Number(item.price) || 0) || ""),
      type: item.type || "item",
    }));
  if (rows.length) return rows;
  return [{ description: file?.projectType || "Project total", qty: "1", total: Number(file?.estimateTotal) || 0, type: "item" }];
}

function invoiceData(file) {
  const existing = file.invoice || {};
  const rows = Array.isArray(existing.rows) && existing.rows.length ? existing.rows : invoiceLineItemsFromEstimate(file);
  return {
    date: existing.date || todayIso(0),
    title: existing.title || "Invoice",
    billTo: existing.billTo || file.clientName || "Client",
    phone: existing.phone || file.clientPhone || "",
    email: existing.email || file.clientEmail || "",
    address: existing.address || file.projectAddress || "",
    projectNumber: existing.projectNumber || file.fileNumber || "",
    notes: existing.notes || file.editableEstimate?.notes || "",
    rows,
    total: existing.total !== undefined && existing.total !== "" ? Number(existing.total) || 0 : invoiceTotal(rows, file.estimateTotal),
  };
}

function invoiceTotal(rows, fallback = 0) {
  const total = rows.reduce((sum, row) => sum + parseMoney(row.total), 0);
  return total || Number(fallback) || 0;
}

function crmPhoneHref(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits ? `tel:+1${digits.slice(-10)}` : "#";
}

function crmEmailHref(value) {
  return value ? `mailto:${value}` : "#";
}

function crmMapHref(value) {
  return value ? `https://maps.google.com/?q=${encodeURIComponent(value)}` : "#";
}

function crmCompanyAddressHtml() {
  return "2710 Del Prado Blvd S #2-184<br>Cape Coral, FL 33904";
}

function renderInvoiceView() {
  const file = normalizeCrmFile(activeFile());
  const paper = $("crmInvoicePaper");
  if (!paper) return;
  if (!file) {
    paper.innerHTML = `<p class="crm-empty-state">Select a customer file to create an invoice.</p>`;
    $("crmTogglePaidStamp").textContent = "Add Paid Stamp";
    return;
  }
  const invoice = invoiceData(file);
  const estimateTotal = Number(invoice.total) || invoiceTotal(invoice.rows, file.estimateTotal);
  const paid = file.paidInFull === "Yes" || file.invoicePaid === "Yes";
  $("crmTogglePaidStamp").textContent = paid ? "Remove Paid Stamp" : "Add Paid Stamp";
  paper.innerHTML = `
    <div class="simple-sheet-header">
      <div class="logo-card">
        <img src="assets/d2-logo.png" alt="D2 Carpentry and Design logo">
      </div>
      <div class="simple-title">
        <div class="brand-title-lockup">
          <h2>D2 Carpentry & Design</h2>
          <p>-Crafting Your Vision One Nail At A Time-</p>
        </div>
      </div>
      <div class="header-estimate-info">
        <span class="header-estimate-number">${escapeHtml(invoice.projectNumber || "")}</span>
        <div class="estimate-title-line">
          <h3 class="crm-inline-edit crm-invoice-title-input" data-invoice-field="title" contenteditable="true" aria-label="Invoice title">${escapeHtml(invoice.title || "Invoice")}</h3>
        </div>
        <dl>
          <div><dt>Date</dt><dd class="crm-inline-edit" data-invoice-field="date" contenteditable="true" aria-label="Invoice date">${escapeHtml(invoice.date || todayIso(0))}</dd></div>
          <div><dt>Office</dt><dd><a href="tel:+12394698555">(239) 469-8555</a></dd></div>
          <div><dt>Address</dt><dd>${crmCompanyAddressHtml()}</dd></div>
          <div><dt>Email</dt><dd><a href="mailto:D2CarpentryandDesign@gmail.com">D2CarpentryandDesign@gmail.com</a></dd></div>
        </dl>
      </div>
    </div>
    <section class="client-block crm-invoice-client-block">
      <div>
        <span>Client Information</span>
        <strong class="crm-inline-edit" data-invoice-field="billTo" contenteditable="true" aria-label="Bill to">${escapeHtml(invoice.billTo)}</strong>
        <p><span class="crm-inline-edit" data-invoice-field="phone" contenteditable="true" aria-label="Invoice phone">${escapeHtml(invoice.phone)}</span></p>
        <p><span class="crm-inline-edit" data-invoice-field="email" contenteditable="true" aria-label="Invoice email">${escapeHtml(invoice.email)}</span></p>
        <p><span class="crm-inline-edit" data-invoice-field="address" contenteditable="true" aria-label="Invoice address">${escapeHtml(invoice.address)}</span></p>
        <span class="crm-invoice-project-number crm-inline-edit" data-invoice-field="projectNumber" contenteditable="true" aria-label="Project number">${escapeHtml(invoice.projectNumber)}</span>
      </div>
    </section>
    <table>
      <colgroup>
        <col class="description-column">
        <col class="qty-column">
        <col class="total-column">
      </colgroup>
      <thead>
        <tr>
          <th>Description</th>
          <th>Qty</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        ${invoice.rows.map((item, index) => {
          return `
            <tr class="${item.type === "subline" ? "subline-preview-row crm-invoice-subline" : "description-preview-row"}">
              <td class="crm-inline-edit" data-invoice-row="${index}" data-invoice-row-field="description" contenteditable="true">${escapeHtml(item.description || "Project total")}</td>
              <td class="crm-inline-edit" data-invoice-row="${index}" data-invoice-row-field="qty" contenteditable="true">${escapeHtml(item.qty || "")}</td>
              <td class="crm-inline-edit" data-invoice-row="${index}" data-invoice-row-field="total" contenteditable="true">${escapeHtml(item.total || "")}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
    <div class="totals crm-invoice-total">
      ${paid ? `<strong class="crm-paid-stamp">PAID IN FULL</strong>` : ""}
      <div class="grand-total">
        <span>Total</span>
        <strong class="crm-inline-edit" data-invoice-field="total" contenteditable="true" aria-label="Invoice total">${escapeHtml(estimateTotal || "")}</strong>
      </div>
    </div>
    <div class="notes crm-invoice-notes">
      <span>Notes</span>
      <p class="crm-inline-edit" data-invoice-field="notes" contenteditable="true" aria-label="Invoice notes">${escapeHtml(invoice.notes)}</p>
    </div>
    <footer class="estimate-footer">
      <span><strong>Office:</strong> (239) 469-8555</span>
      <span><strong>Email:</strong> D2CarpentryandDesign@gmail.com</span>
      <span class="footer-address"><strong>Address:</strong> <span>${crmCompanyAddressHtml()}</span></span>
    </footer>
  `;
}

function saveInvoiceStatus() {
  const file = normalizeCrmFile(activeFile());
  if (!file) return;
  const paid = file.invoicePaid === "Yes" || file.paidInFull === "Yes" ? "Yes" : "No";
  const oldValue = file.invoicePaid || "No";
  const rowCount = document.querySelectorAll("[data-invoice-row-field='description']").length;
  const rows = Array.from({ length: rowCount }, (_, index) => {
    const descriptionField = document.querySelector(`[data-invoice-row="${index}"][data-invoice-row-field="description"]`);
    return {
      description: textFieldValue(descriptionField),
      qty: textFieldValue(document.querySelector(`[data-invoice-row="${index}"][data-invoice-row-field="qty"]`)),
      total: parseMoney(textFieldValue(document.querySelector(`[data-invoice-row="${index}"][data-invoice-row-field="total"]`))),
      type: descriptionField?.closest("tr")?.classList.contains("crm-invoice-subline") ? "subline" : "item",
    };
  }).filter((row) => row.description || row.qty || row.total);
  const fieldValue = (field) => textFieldValue(document.querySelector(`[data-invoice-field="${field}"]`));
  file.invoice = {
    title: fieldValue("title") || "Invoice",
    date: fieldValue("date") || todayIso(0),
    billTo: fieldValue("billTo"),
    phone: fieldValue("phone"),
    email: fieldValue("email"),
    address: fieldValue("address"),
    projectNumber: fieldValue("projectNumber") || file.fileNumber,
    notes: fieldValue("notes"),
    rows,
    total: parseMoney(fieldValue("total")) || invoiceTotal(rows, file.estimateTotal),
  };
  file.estimateTotal = Number(file.invoice.total) || invoiceTotal(rows, file.estimateTotal);
  file.invoicePaid = paid;
  file.paidInFull = paid;
  file.invoiceSent = "Yes";
  file.invoiceStatus = paid === "Yes" ? "Paid" : "Sent";
  if (oldValue !== paid) addSystemNote(file, `Invoice paid status changed to ${paid}.`);
  saveCrmFiles();
  renderInvoiceView();
  renderCrm();
}

function textFieldValue(element) {
  if (!element) return "";
  return ("value" in element ? element.value : element.textContent || "").trim();
}

function togglePaidStamp() {
  const file = normalizeCrmFile(activeFile());
  if (!file) return;
  saveInvoiceStatus();
  const isPaid = file.invoicePaid === "Yes" || file.paidInFull === "Yes";
  file.invoicePaid = isPaid ? "No" : "Yes";
  file.paidInFull = file.invoicePaid;
  file.invoiceStatus = file.invoicePaid === "Yes" ? "Paid" : "Sent";
  addSystemNote(file, file.invoicePaid === "Yes" ? "Paid in full stamp added to invoice." : "Paid in full stamp removed from invoice.");
  saveCrmFiles();
  renderInvoiceView();
  renderCrm();
}

function addInvoiceLine() {
  const file = normalizeCrmFile(activeFile());
  if (!file) return;
  saveInvoiceStatus();
  const freshFile = normalizeCrmFile(activeFile());
  freshFile.invoice = freshFile.invoice || invoiceData(freshFile);
  freshFile.invoice.rows = [...(freshFile.invoice.rows || []), { description: "", qty: "", total: "", type: "item" }];
  saveCrmFiles();
  renderInvoiceView();
}

function invoiceFileName(file) {
  const safeClient = String(file?.clientName || "D2 Invoice").replace(/[^a-z0-9]+/gi, " ").trim();
  const safeNumber = String(file?.fileNumber || "").replace(/[^a-z0-9-]+/gi, "");
  return `${safeClient}${safeNumber ? ` - ${safeNumber}` : ""} Invoice.pdf`;
}

function getCrmJsPdf() {
  return window.jspdf && window.jspdf.jsPDF ? window.jspdf.jsPDF : null;
}

function getCrmHtml2Canvas() {
  return window.html2canvas || null;
}

async function waitForCrmPdfAssets(host) {
  const images = Array.from(host.querySelectorAll("img"));
  await Promise.all(images.map((image) => {
    if (image.complete) return Promise.resolve();
    return new Promise((resolve) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", resolve, { once: true });
    });
  }));
}

function prepareInvoicePdfClone(source) {
  const clone = source.cloneNode(true);
  clone.querySelectorAll("[contenteditable]").forEach((element) => {
    element.removeAttribute("contenteditable");
  });
  clone.querySelectorAll("input, textarea").forEach((field) => {
    const replacement = document.createElement(field.matches("[data-invoice-field='title']") ? "h3" : "span");
    replacement.className = field.className || "";
    replacement.textContent = field.type === "date" && field.value ? displayDate(field.value) : field.value;
    if (field.matches("[data-invoice-field='total']")) {
      replacement.textContent = crmCurrency.format(parseMoney(field.value));
      replacement.classList.add("crm-invoice-total-text");
    }
    if (field.tagName === "TEXTAREA") {
      replacement.innerHTML = escapeHtml(field.value).replace(/\n/g, "<br>");
    }
    field.replaceWith(replacement);
  });
  return clone;
}

async function createInvoicePdfDocument(file, sourceElement) {
  const JsPdf = getCrmJsPdf();
  const html2canvas = getCrmHtml2Canvas();
  if (!JsPdf || !html2canvas || !sourceElement) return null;
  const host = document.createElement("div");
  host.className = "pdf-render-host";
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "0";
  host.style.width = `${sourceElement.getBoundingClientRect().width || 820}px`;
  host.style.background = "#ffffff";
  host.style.pointerEvents = "none";
  host.appendChild(prepareInvoicePdfClone(sourceElement));
  document.body.appendChild(host);
  try {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await waitForCrmPdfAssets(host);
    const source = host.firstElementChild;
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
    const pageImageHeight = pageHeight - margin * 2;
    const pageCanvasHeight = Math.floor((pageImageHeight * canvas.width) / imageWidth);
    const pageCount = Math.max(1, Math.ceil(canvas.height / pageCanvasHeight));
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
    }
    return doc;
  } catch (error) {
    console.warn("Invoice visual PDF generator failed; using simple PDF fallback.", error);
    return null;
  } finally {
    host.remove();
  }
}

function createSimpleInvoicePdfDocument(file) {
  const JsPdf = getCrmJsPdf();
  if (!JsPdf) return null;
  const invoice = invoiceData(file);
  const doc = new JsPdf({ unit: "mm", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = 18;
  const addPageIfNeeded = (needed = 10) => {
    if (y + needed < pageHeight - margin) return;
    doc.addPage("letter");
    y = margin;
  };
  const writeWrapped = (text, x, maxWidth, lineHeight = 5) => {
    const lines = doc.splitTextToSize(String(text || ""), maxWidth);
    lines.forEach((line) => {
      addPageIfNeeded(lineHeight);
      doc.text(line, x, y);
      y += lineHeight;
    });
  };

  doc.setFont("helvetica", "bold");
  doc.setTextColor(13, 74, 145);
  doc.setFontSize(20);
  doc.text("D2 Carpentry & Design", margin, y);
  doc.setFontSize(22);
  doc.text("INVOICE", pageWidth - margin, y, { align: "right" });
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(75, 85, 99);
  doc.setFontSize(9);
  doc.text("-Crafting Your Vision One Nail At A Time-", margin, y);
  doc.text(invoice.projectNumber || file.fileNumber || "", pageWidth - margin, y, { align: "right" });
  y += 10;
  doc.setDrawColor(13, 74, 145);
  doc.setLineWidth(1.2);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  doc.setTextColor(17, 24, 39);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Client Information", margin, y);
  doc.text("Invoice Details", pageWidth - 72, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const clientStartY = y;
  writeWrapped(invoice.billTo || file.clientName || "Client", margin, 80);
  writeWrapped(invoice.phone || file.clientPhone || "", margin, 80);
  writeWrapped(invoice.email || file.clientEmail || "", margin, 80);
  writeWrapped(invoice.address || file.projectAddress || "", margin, 80);
  const afterClientY = y;
  y = clientStartY;
  doc.text(displayDate(invoice.date || todayIso(0)), pageWidth - 72, y);
  y += 5;
  writeWrapped(`Project # ${invoice.projectNumber || file.fileNumber || ""}`, pageWidth - 72, 58);
  y = Math.max(afterClientY, y) + 8;

  doc.setFillColor(13, 74, 145);
  doc.rect(margin, y - 5, pageWidth - margin * 2, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("Description", margin + 2, y);
  doc.text("Qty", pageWidth - 52, y, { align: "right" });
  doc.text("Total", pageWidth - margin - 2, y, { align: "right" });
  y += 7;

  doc.setTextColor(17, 24, 39);
  doc.setFont("helvetica", "normal");
  (invoice.rows || []).forEach((row) => {
    addPageIfNeeded(14);
    const rowY = y;
    const descriptionLines = doc.splitTextToSize(String(row.description || ""), 112);
    descriptionLines.forEach((line, index) => {
      doc.text(line, row.type === "subline" ? margin + 7 : margin + 2, y + index * 5);
    });
    doc.text(String(row.qty || ""), pageWidth - 52, rowY, { align: "right" });
    doc.text(row.total ? crmCurrency.format(Number(row.total) || 0) : "", pageWidth - margin - 2, rowY, { align: "right" });
    y += Math.max(7, descriptionLines.length * 5 + 2);
    doc.setDrawColor(215, 220, 229);
    doc.line(margin, y - 2, pageWidth - margin, y - 2);
  });

  y += 8;
  const total = Number(invoice.total) || invoiceTotal(invoice.rows, file.estimateTotal);
  if (file.invoicePaid === "Yes" || file.paidInFull === "Yes") {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(185, 28, 28);
    doc.setFontSize(13);
    doc.text("PAID IN FULL", pageWidth - margin, y, { align: "right" });
    y += 7;
  }
  doc.setFont("helvetica", "bold");
  doc.setTextColor(13, 74, 145);
  doc.setFontSize(14);
  doc.text("Total", pageWidth - 65, y);
  doc.text(crmCurrency.format(total), pageWidth - margin, y, { align: "right" });
  y += 12;

  if (invoice.notes) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(13, 74, 145);
    doc.setFontSize(10);
    doc.text("Notes", margin, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(17, 24, 39);
    writeWrapped(invoice.notes, margin, pageWidth - margin * 2);
  }

  y = Math.max(y + 10, pageHeight - 25);
  doc.setDrawColor(215, 220, 229);
  doc.line(margin, y - 5, pageWidth - margin, y - 5);
  doc.setFontSize(8);
  doc.setTextColor(75, 85, 99);
  doc.text("Office: (239) 469-8555", margin, y);
  doc.text("Email: D2CarpentryandDesign@gmail.com", pageWidth / 2, y, { align: "center" });
  doc.text("Address: 2710 Del Prado Blvd S #2-184, Cape Coral, FL 33904", pageWidth - margin, y, { align: "right" });
  return doc;
}

async function saveInvoicePdf() {
  const file = normalizeCrmFile(activeFile());
  if (!file) return;
  saveInvoiceStatus();
  const sourceElement = $("crmInvoicePaper");
  const doc = await createInvoicePdfDocument(file, sourceElement);
  if (doc) {
    doc.save(invoiceFileName(file));
    return;
  }
  const simpleDoc = createSimpleInvoicePdfDocument(file);
  if (simpleDoc) {
    simpleDoc.save(invoiceFileName(file));
    return;
  }
  window.alert("The browser could not create the invoice PDF. Try refreshing the page, then click Save PDF again.");
}

async function emailInvoice() {
  const file = normalizeCrmFile(activeFile());
  if (!file) return;
  saveInvoiceStatus();
  const invoice = invoiceData(file);
  const total = crmCurrency.format(Number(invoice.total) || invoiceTotal(invoice.rows, file.estimateTotal));
  const subjectText = "Invoice - D2 Carpentry & Design";
  const bodyText = `Hi ${invoice.billTo || file.clientName || ""},\n\nPlease see your invoice from D2 Carpentry & Design.\n\nProject #: ${invoice.projectNumber || file.fileNumber || ""}\nTotal: ${total}\n\nThank you,\nD2 Carpentry & Design`;
  const sourceElement = $("crmInvoicePaper");
  const doc = await createInvoicePdfDocument(file, sourceElement) || createSimpleInvoicePdfDocument(file);
  if (doc && navigator.canShare && navigator.share && window.File) {
    const pdfFile = new File([doc.output("blob")], invoiceFileName(file), { type: "application/pdf" });
    if (navigator.canShare({ files: [pdfFile] })) {
      try {
        await navigator.share({
          files: [pdfFile],
          title: subjectText,
          text: bodyText,
        });
        return;
      } catch (error) {
        // If sharing is cancelled or blocked, continue with the save + email draft fallback.
      }
    }
  }
  if (doc) {
    doc.save(invoiceFileName(file));
    window.alert("The invoice PDF was saved. Your email draft will open next; attach the saved PDF to send it.");
  }
  const subject = encodeURIComponent(subjectText);
  const body = encodeURIComponent(bodyText);
  window.location.href = `mailto:${encodeURIComponent(invoice.email || file.clientEmail || "")}?subject=${subject}&body=${body}`;
}

const CRM_CALENDAR_TYPES = {
  inspection: { label: "Inspection", dateField: "inspectionDate", timeField: "inspectionTime", title: "Inspection" },
  followUp: { label: "Follow-Up", dateField: "followUpDate", timeField: "", title: "Follow-Up" },
  start: { label: "Job Start", dateField: "startDate", timeField: "", title: "Job Start" },
  completion: { label: "Completion", dateField: "anticipatedCompletionDate", timeField: "", title: "Anticipated Completion" },
};

function calendarDateTime(dateValue, timeValue = "") {
  if (!dateValue) return null;
  const date = new Date(`${dateValue}T${timeValue || "09:00"}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatCalendarDate(dateValue, timeValue = "") {
  const date = calendarDateTime(dateValue, timeValue);
  if (!date) return "";
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function normalizeExternalCalendarEvent(event = {}) {
  const startDate = String(event.date || "").slice(0, 10);
  if (!startDate) return null;
  return {
    eventKey: event.eventKey || `google-${event.eventId || event.id || startDate}-${event.title || "event"}`,
    source: "google",
    type: "google",
    typeLabel: "Google",
    title: event.title || "Google Calendar Event",
    fileId: "",
    fileNumber: "Google Calendar",
    clientName: event.clientName || event.title || "Calendar Event",
    phone: event.phone || "",
    email: event.email || "",
    address: event.address || "",
    date: startDate,
    time: event.time || "09:00",
    startIso: event.startIso || `${startDate}T${event.time || "09:00"}:00`,
    endIso: event.endIso || "",
    notes: event.notes || event.description || "",
    color: event.color || "",
    eventId: event.eventId || "",
  };
}

function calendarEventFromFile(file, type) {
  const config = CRM_CALENDAR_TYPES[type];
  if (!file || !config) return null;
  const dateValue = file[config.dateField] || "";
  const timeValue = config.timeField ? file[config.timeField] || "" : "";
  const start = calendarDateTime(dateValue, timeValue);
  if (!start) return null;
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const eventKey = `${file.id || file.fileNumber}-${type}`;
  return {
    eventKey,
    type,
    typeLabel: config.label,
    title: `${config.title} - ${file.clientName || "Customer"}`,
    fileId: file.id || "",
    fileNumber: file.fileNumber || "",
    clientName: file.clientName || "",
    phone: file.clientPhone || "",
    email: file.clientEmail || "",
    address: file.projectAddress || "",
    date: dateValue,
    time: timeValue || "09:00",
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    color: file.calendarColors?.[type] || "",
    notes: [
      `D2 file: ${file.fileNumber || ""}`,
      `Customer: ${file.clientName || ""}`,
      file.clientPhone ? `Phone: ${file.clientPhone}` : "",
      file.clientEmail ? `Email: ${file.clientEmail}` : "",
      file.projectAddress ? `Address: ${file.projectAddress}` : "",
      "",
      `CRM event key: ${eventKey}`,
    ].filter(Boolean).join("\n"),
  };
}

function allCrmCalendarEvents() {
  const events = [];
  crmFiles.forEach((rawFile) => {
    const file = normalizeCrmFile(rawFile);
    Object.keys(CRM_CALENDAR_TYPES).forEach((type) => {
      const event = calendarEventFromFile(file, type);
      if (event) events.push(event);
    });
  });
  crmExternalCalendarEvents.forEach((event) => {
    const normalized = normalizeExternalCalendarEvent(event);
    if (normalized) events.push(normalized);
  });
  return dedupeCalendarEvents(events).sort((a, b) => new Date(a.startIso) - new Date(b.startIso));
}

function dedupeCalendarEvents(events = []) {
  const seen = new Set();
  return events.filter((event) => {
    const key = String(event.eventKey || `${event.title}-${event.date}-${event.time}`).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function visibleCrmCalendarEvents() {
  const now = new Date();
  const weekEnd = new Date(now);
  weekEnd.setDate(now.getDate() + 7);
  return allCrmCalendarEvents().filter((event) => {
    const date = new Date(event.startIso);
    if (crmCalendarFilter === "week") return date >= now && date <= weekEnd;
    if (crmCalendarFilter !== "upcoming") return event.type === crmCalendarFilter;
    return date >= new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  });
}

function eventDateKey(event) {
  const range = calendarEventRange(event);
  return range ? dateKeyFromDate(range.start) : String(event.date || "").slice(0, 10);
}

function dateKeyFromDate(date) {
  return date.toISOString().slice(0, 10);
}

function dayStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function calendarEventRange(event = {}) {
  const start = event.startIso ? new Date(event.startIso) : calendarDateTime(event.date, event.time);
  if (!start || Number.isNaN(start.getTime())) return null;
  let end = event.endIso ? new Date(event.endIso) : null;
  if (!end || Number.isNaN(end.getTime()) || end < start) {
    end = new Date(start.getTime() + 60 * 60 * 1000);
  }
  let endDay = dayStart(end);
  if (end.getHours() === 0 && end.getMinutes() === 0 && end.getSeconds() === 0 && endDay > dayStart(start)) {
    endDay = new Date(endDay.getTime() - 24 * 60 * 60 * 1000);
  }
  return {
    start: dayStart(start),
    end: endDay,
    startTime: start,
    endTime: end,
  };
}

function calendarEventTouchesDate(event, dateKey) {
  const range = calendarEventRange(event);
  if (!range) return false;
  const date = dayStart(new Date(`${dateKey}T12:00:00`));
  return date >= range.start && date <= range.end;
}

function calendarEventsForDate(dateKey) {
  return allCrmCalendarEvents().filter((event) => calendarEventTouchesDate(event, dateKey));
}

function monthCalendarEvents() {
  const year = crmCalendarCursor.getFullYear();
  const month = crmCalendarCursor.getMonth();
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  return allCrmCalendarEvents().filter((event) => {
    const range = calendarEventRange(event);
    return range && range.start <= monthEnd && range.end >= monthStart;
  });
}

function renderCalendarFileOptions() {
  const select = $("crmCalendarFile");
  if (!select) return;
  select.innerHTML = crmFiles.map((file) => `
    <option value="${escapeHtml(file.id)}"${file.id === activeFileId ? " selected" : ""}>
      ${escapeHtml(`${file.fileNumber || "File"} - ${file.clientName || "Unnamed Client"}`)}
    </option>
  `).join("");
}

function selectedCalendarFile() {
  return crmFiles.find((file) => file.id === $("crmCalendarFile")?.value) || activeFile();
}

function renderCalendar() {
  renderCalendarFileOptions();
  if ($("crmCalendarFilter")) $("crmCalendarFilter").value = crmCalendarFilter;
  renderCalendarGrid();
  renderCalendarAgenda();
}

function renderCalendarEventList(targetId, events, emptyText = "No calendar events found for this view.") {
  const target = $(targetId);
  if (!target) return;
  target.innerHTML = events.length ? events.map((event) => `
    <article class="crm-calendar-event${event.eventKey === crmSelectedCalendarEventKey ? " selected" : ""}" data-calendar-select="${escapeHtml(event.eventKey)}">
      <div class="crm-calendar-date">
        <strong>${escapeHtml(formatCalendarDate(event.date, event.time))}</strong>
        <span>${escapeHtml(event.typeLabel)}</span>
      </div>
      <div class="crm-calendar-info">
        <h3>${escapeHtml(event.title)}</h3>
        <p>${escapeHtml(event.fileNumber)} · ${escapeHtml(event.address || "No address added")}</p>
        <p>${escapeHtml(event.phone || "No phone")}${event.email ? ` · ${escapeHtml(event.email)}` : ""}</p>
      </div>
      <div class="crm-calendar-event-actions">
        ${event.fileId ? `<button type="button" data-calendar-open="${escapeHtml(event.fileId)}">Open File</button>` : ""}
        ${event.source === "google" ? "" : `<button type="button" data-calendar-sync="${escapeHtml(event.eventKey)}">Sync</button>`}
      </div>
    </article>
  `).join("") : `<p class="crm-empty-state">${escapeHtml(emptyText)}</p>`;

  target.querySelectorAll("[data-calendar-open]").forEach((button) => {
    button.addEventListener("click", () => {
      activeFileId = button.dataset.calendarOpen;
      switchCrmView("dashboard");
      renderCrm();
    });
  });
  target.querySelectorAll("[data-calendar-sync]").forEach((button) => {
    button.addEventListener("click", () => syncCalendarEventByKey(button.dataset.calendarSync));
  });
  target.querySelectorAll("[data-calendar-select]").forEach((eventCard) => {
    eventCard.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      selectCalendarEvent(eventCard.dataset.calendarSelect);
    });
  });
}

function renderCalendarGrid() {
  const grid = $("crmCalendarGrid");
  if (!grid) return;
  const monthTitle = $("crmCalendarMonthTitle");
  if (monthTitle) {
    monthTitle.textContent = crmCalendarCursor.toLocaleString("en-US", { month: "long", year: "numeric" });
  }
  const year = crmCalendarCursor.getFullYear();
  const month = crmCalendarCursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - ((firstDay.getDay() + 6) % 7));
  const todayKey = todayIso(0);
  const monthEvents = monthCalendarEvents();
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const parts = [`<div class="crm-calendar-weekdays">${dayNames.map((day) => `<div class="crm-calendar-weekday">${day}</div>`).join("")}</div>`];
  for (let week = 0; week < 6; week += 1) {
    const weekStart = new Date(start);
    weekStart.setDate(start.getDate() + week * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const days = [];
    for (let day = 0; day < 7; day += 1) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + day);
      const key = dateKeyFromDate(date);
      const events = calendarEventsForDate(key);
      const isCurrentMonth = date.getMonth() === month;
      const isToday = key === todayKey;
      const isSelected = key === crmSelectedCalendarDate;
      days.push(`
        <button type="button" class="crm-calendar-day${isCurrentMonth ? "" : " muted"}${isToday ? " today" : ""}${isSelected ? " selected" : ""}" data-calendar-day="${escapeHtml(key)}">
          <span class="crm-calendar-day-number">${date.getDate()}</span>
          <span class="crm-calendar-day-count">${events.length ? `${events.length} event${events.length === 1 ? "" : "s"}` : ""}</span>
        </button>
      `);
    }
    const bars = calendarEventBarsForWeek(monthEvents, weekStart, weekEnd);
    parts.push(`
      <div class="crm-calendar-week-row">
        <div class="crm-calendar-week-days">${days.join("")}</div>
        <div class="crm-calendar-week-bars">
          ${bars.map((bar) => `
            <button type="button" class="crm-calendar-chip crm-calendar-bar ${escapeHtml(bar.event.type)}${bar.event.eventKey === crmSelectedCalendarEventKey ? " selected" : ""}" style="grid-column: ${bar.column} / span ${bar.span}; grid-row: ${bar.row};" data-calendar-event-key="${escapeHtml(bar.event.eventKey)}" data-calendar-event-day="${escapeHtml(bar.dateKey)}" title="${escapeHtml(bar.title)}">
              ${escapeHtml(bar.title)}
            </button>
          `).join("")}
        </div>
      </div>
    `);
  }
  grid.innerHTML = parts.join("");
  grid.querySelectorAll("[data-calendar-day]").forEach((button) => {
    button.addEventListener("click", () => {
      crmSelectedCalendarDate = button.dataset.calendarDay;
      crmSelectedCalendarEventKey = "";
      $("crmCalendarDate").value = crmSelectedCalendarDate;
      if ($("crmCalendarNotes")) $("crmCalendarNotes").value = "";
      renderCalendarGrid();
      renderCalendarSelectedDay();
    });
  });
  grid.querySelectorAll("[data-calendar-event-day]").forEach((button) => {
    button.addEventListener("click", () => {
      crmSelectedCalendarDate = button.dataset.calendarEventDay;
      $("crmCalendarDate").value = crmSelectedCalendarDate;
      selectCalendarEvent(button.dataset.calendarEventKey || "");
    });
  });
}

function selectCalendarEvent(eventKey) {
  const event = allCrmCalendarEvents().find((entry) => entry.eventKey === eventKey);
  if (!event) return;
  crmSelectedCalendarEventKey = event.eventKey;
  crmSelectedCalendarDate = eventDateKey(event);
  if ($("crmCalendarDate")) $("crmCalendarDate").value = crmSelectedCalendarDate;
  if ($("crmCalendarTime")) $("crmCalendarTime").value = event.time || "";
  if ($("crmCalendarNotes")) $("crmCalendarNotes").value = event.notes || "";
  if ($("crmCalendarType") && CRM_CALENDAR_TYPES[event.type]) $("crmCalendarType").value = event.type;
  if ($("crmCalendarFile") && event.fileId) $("crmCalendarFile").value = event.fileId;
  renderCalendarGrid();
  renderCalendarAgenda();
}

function calendarEventBarsForWeek(events, weekStart, weekEnd) {
  const lanes = [];
  return events
    .map((event) => {
      const range = calendarEventRange(event);
      if (!range || range.end < weekStart || range.start > weekEnd) return null;
      const spanStart = range.start < weekStart ? weekStart : range.start;
      const spanEnd = range.end > weekEnd ? weekEnd : range.end;
      const startOffset = Math.round((spanStart - weekStart) / (24 * 60 * 60 * 1000));
      const endOffset = Math.round((spanEnd - weekStart) / (24 * 60 * 60 * 1000));
      return {
        event,
        column: startOffset + 1,
        span: Math.max(1, endOffset - startOffset + 1),
        dateKey: dateKeyFromDate(spanStart),
        title: event.source === "google"
          ? event.title || event.clientName || "Google Calendar Event"
          : `${event.typeLabel || "Event"} · ${event.clientName || event.title || "Calendar Event"}`,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.column - b.column || b.span - a.span)
    .map((bar) => {
      let rowIndex = lanes.findIndex((laneEnd) => laneEnd < bar.column);
      if (rowIndex === -1) {
        rowIndex = lanes.length;
        lanes.push(0);
      }
      lanes[rowIndex] = bar.column + bar.span - 1;
      return { ...bar, row: rowIndex + 1 };
    });
}

function renderCalendarSelectedDay() {
  const events = calendarEventsForDate(crmSelectedCalendarDate);
  renderCalendarEventList("crmCalendarList", events, "No events on this selected day.");
}

function renderCalendarAgenda() {
  const events = visibleCrmCalendarEvents();
  renderCalendarEventList("crmCalendarAgenda", events, "No agenda events found.");
  renderCalendarSelectedDay();
}

function captureCalendarFormToFile() {
  const selectedEvent = allCrmCalendarEvents().find((entry) => entry.eventKey === crmSelectedCalendarEventKey);
  if (selectedEvent?.source === "google") {
    crmExternalCalendarEvents = crmExternalCalendarEvents.map((event) => (
      event.eventKey === selectedEvent.eventKey
        ? {
            ...event,
            date: $("crmCalendarDate").value || event.date,
            time: $("crmCalendarTime").value || event.time,
            notes: $("crmCalendarNotes").value.trim(),
          }
        : event
    ));
    saveExternalCalendarEvents();
    return normalizeExternalCalendarEvent(crmExternalCalendarEvents.find((event) => event.eventKey === selectedEvent.eventKey));
  }
  const file = selectedCalendarFile();
  if (!file) return null;
  const type = $("crmCalendarType").value;
  const config = CRM_CALENDAR_TYPES[type];
  if (!config) return null;
  const dateValue = $("crmCalendarDate").value;
  if (!dateValue) {
    window.alert("Choose a calendar date first.");
    return null;
  }
  file[config.dateField] = dateValue;
  if (config.timeField) file[config.timeField] = $("crmCalendarTime").value;
  if ($("crmCalendarColor")) {
    file.calendarColors = file.calendarColors || {};
    if ($("crmCalendarColor").value) {
      file.calendarColors[type] = $("crmCalendarColor").value;
    } else {
      delete file.calendarColors[type];
    }
  }
  const note = $("crmCalendarNotes").value.trim();
  if (note) addSystemNote(file, `${config.label} calendar note: ${note}`);
  saveCrmFiles();
  return calendarEventFromFile(file, type);
}

function saveCalendarEventToCrm() {
  saveActiveFile();
  const event = captureCalendarFormToFile();
  if (!event) return;
  renderCalendar();
  window.alert("Calendar event saved to the CRM.");
}

async function saveAndSyncCalendarEvent() {
  saveActiveFile();
  const event = captureCalendarFormToFile();
  if (!event) return;
  await postCalendarEventToGoogle(event);
  const file = crmFiles.find((entry) => entry.id === event.fileId);
  if (file) addSystemNote(file, `${event.typeLabel} synced to Google Calendar.`);
  saveCrmFiles();
  renderCalendar();
  window.alert("Calendar event sent to Google Calendar. It should appear on your phone/Mac after Google syncs.");
}

async function syncCalendarEventByKey(eventKey) {
  const event = allCrmCalendarEvents().find((entry) => entry.eventKey === eventKey);
  if (!event) return;
  await postCalendarEventToGoogle(event);
  const file = crmFiles.find((entry) => entry.id === event.fileId);
  if (file) addSystemNote(file, `${event.typeLabel} synced to Google Calendar.`);
  saveCrmFiles();
  renderCalendar();
}

async function syncUpcomingCalendarEvents() {
  saveActiveFile();
  const events = visibleCrmCalendarEvents();
  for (const event of events) {
    await postCalendarEventToGoogle(event);
  }
  window.alert(`${events.length} calendar event${events.length === 1 ? "" : "s"} sent to Google Calendar.`);
}

async function importGoogleCalendarEvents() {
  const button = $("crmImportGoogleCalendar");
  const originalText = button ? button.textContent : "";
  const start = new Date(crmCalendarCursor.getFullYear(), crmCalendarCursor.getMonth() - 1, 1);
  const end = new Date(crmCalendarCursor.getFullYear() + 1, crmCalendarCursor.getMonth() + 1, 0);
  if (button) button.textContent = "Importing...";
  try {
    const events = await fetchGoogleCalendarEvents(dateKeyFromDate(start), dateKeyFromDate(end));
    crmExternalCalendarEvents = dedupeCalendarEvents(events.map(normalizeExternalCalendarEvent).filter(Boolean));
    saveExternalCalendarEvents();
    renderCalendar();
    window.alert(`${crmExternalCalendarEvents.length} Google Calendar event${crmExternalCalendarEvents.length === 1 ? "" : "s"} imported into the CRM calendar.`);
  } finally {
    if (button) button.textContent = originalText || "Import Google Calendar";
  }
}

function switchCrmView(view) {
  const showRevenue = view === "revenue";
  const showCalendar = view === "calendar";
  const showInvoice = view === "invoice";
  const showExpenses = view === "expenses";
  const showReceipts = showExpenses;
  const showPrices = view === "prices";
  const showEstimator = view === "estimator";
  const estimatorShell = $("crmEstimatorView")?.closest(".crm-dashboard-view");
  document.body.classList.toggle("crm-estimator-active", showEstimator);
  document.querySelectorAll(".crm-dashboard-view").forEach((section) => {
    const keepEstimatorShell = showEstimator && estimatorShell && section === estimatorShell;
    section.hidden = !keepEstimatorShell && (showRevenue || showCalendar || showInvoice || showExpenses || showReceipts || showPrices || showEstimator);
  });
  $("crmRevenueView").hidden = !showRevenue;
  $("crmCalendarView").hidden = !showCalendar;
  $("crmInvoiceView").hidden = !showInvoice;
  $("crmExpensesView").hidden = !showExpenses;
  $("crmReceiptView").hidden = !showReceipts;
  $("crmPriceView").hidden = !showPrices;
  $("crmEstimatorView").hidden = !showEstimator;
  document.querySelectorAll("[data-crm-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.crmView === view);
  });
  if (showInvoice) renderInvoiceView();
  if (showCalendar) renderCalendar();
  if (showExpenses) renderFileExpenses();
  if (showReceipts) renderReceiptScanner();
  if (showPrices) renderPriceDatabase();
  if (showEstimator && !$("crmEstimatorFrame").getAttribute("src")) {
    const estimatorUrl = new URL("index.html", window.location.href);
    estimatorUrl.searchParams.set("new", "1");
    estimatorUrl.searchParams.set("embedded", "1");
    $("crmEstimatorFrame").src = estimatorUrl.toString();
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

document.querySelectorAll("[data-crm-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    activateCrmFilter(button.dataset.crmFilter);
    renderCrm();
  });
});

$("crmFileFilter").addEventListener("change", () => {
  activateCrmFilter($("crmFileFilter").value);
  renderCrm();
});
$("crmSearchFile").addEventListener("click", searchCrmFile);
$("crmFileSearch").addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    searchCrmFile();
  }
});
$("crmEditEstimateTotal").addEventListener("click", toggleEstimateAmountEdit);
$("crmSaveEstimateAmount").addEventListener("click", saveEstimateAmountEdit);
$("crmEditMaterialTotal").addEventListener("click", toggleMaterialAmountEdit);
$("crmSaveMaterialAmount").addEventListener("click", saveMaterialAmountEdit);
$("crmAddPriceLine").addEventListener("click", addPriceLine);
$("crmPriceSearch").addEventListener("input", renderPriceDatabase);
$("crmPriceSort").addEventListener("change", renderPriceDatabase);
$("crmReceiptAddLine").addEventListener("click", () => addReceiptLine());
$("crmReceiptUpdatePrices").addEventListener("click", updatePriceDatabaseFromReceipt);
$("crmReceiptClear").addEventListener("click", clearReceiptScanner);
$("crmReceiptParsePaste").addEventListener("click", parseReceiptPaste);
$("crmPriceReceiptUpload").addEventListener("change", (event) => {
  uploadReceiptForPrices(event.target.files[0]);
  event.target.value = "";
});
["crmReceiptVendor", "crmReceiptDate", "crmReceiptCategory"].forEach((id) => {
  $(id).addEventListener("input", captureReceiptDraftFields);
  $(id).addEventListener("change", captureReceiptDraftFields);
});
$("crmTogglePaidStamp").addEventListener("click", togglePaidStamp);
$("crmSaveInvoiceStatus").addEventListener("click", saveInvoiceStatus);
$("crmSaveInvoicePdf").addEventListener("click", () => {
  saveInvoicePdf().catch(() => window.alert("The invoice PDF could not be created. Try refreshing the page, then click Save PDF again."));
});
$("crmEmailInvoice").addEventListener("click", () => {
  emailInvoice().catch(() => window.alert("The invoice email could not be opened. Save the PDF first, then attach it manually."));
});
$("crmNewFile").addEventListener("click", newCrmFile);
$("crmAddNote").addEventListener("click", addCrmNote);
$("crmNewNote").addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    event.preventDefault();
    addCrmNote();
  }
});
$("crmSaveDemo").addEventListener("click", () => {
  saveDashboardToGoogle();
});
$("crmLoadCloud").addEventListener("click", () => {
  loadDashboardFromGoogle().catch(() => window.alert("Command Center could not be restored from Cloudflare. Confirm the Cloudflare R2 binding is connected."));
});
$("crmCalendarFilter").addEventListener("change", (event) => {
  crmCalendarFilter = event.target.value;
  renderCalendar();
});
$("crmCalendarPrev").addEventListener("click", () => {
  crmCalendarCursor = new Date(crmCalendarCursor.getFullYear(), crmCalendarCursor.getMonth() - 1, 1);
  renderCalendar();
});
$("crmCalendarNext").addEventListener("click", () => {
  crmCalendarCursor = new Date(crmCalendarCursor.getFullYear(), crmCalendarCursor.getMonth() + 1, 1);
  renderCalendar();
});
$("crmCalendarToday").addEventListener("click", () => {
  const today = new Date();
  crmCalendarCursor = new Date(today.getFullYear(), today.getMonth(), 1);
  crmSelectedCalendarDate = todayIso(0);
  if ($("crmCalendarDate")) $("crmCalendarDate").value = crmSelectedCalendarDate;
  renderCalendar();
});
$("crmSaveCalendarEvent").addEventListener("click", saveCalendarEventToCrm);
$("crmSaveAndSyncCalendarEvent").addEventListener("click", () => {
  saveAndSyncCalendarEvent().catch(() => window.alert("Calendar sync could not be sent. Check your Google connection and try again."));
});
$("crmImportGoogleCalendar").addEventListener("click", () => {
  importGoogleCalendarEvents().catch(() => window.alert("Google Calendar could not be imported. Confirm the Google Apps Script is updated and authorized."));
});
$("crmSyncAllCalendar").addEventListener("click", () => {
  syncUpcomingCalendarEvents().catch(() => window.alert("Calendar sync could not be sent. Check your Google connection and try again."));
});
$("crmOpenGoogleCalendar").addEventListener("click", () => {
  window.open("https://calendar.google.com/calendar/u/0/r", "_blank", "noopener");
});
$("crmArchiveFile").addEventListener("click", () => {
  const file = activeFile();
  if (!file) return;
  file.fileStatus = "Job Lost / Closed";
  file.timeline = [...(file.timeline || []), "File archived as Job Lost / Closed"];
  activateCrmFilter("archive");
  saveCrmFiles();
  renderCrm();
});
$("crmDeleteFile").addEventListener("click", deleteActiveFile);
$("crmOpenEstimate").addEventListener("click", () => showEstimateChoiceDialog(""));
$("crmOpenAssignment").addEventListener("click", () => openActiveEstimate("#assignment"));
$("crmOpenInvoice").addEventListener("click", openActiveInvoice);
$("crmOpenExpenses").addEventListener("click", () => {
  refreshCrmFilesFromStorage();
  saveActiveFile();
  switchCrmView("expenses");
});
$("crmEstimateChoiceClose").addEventListener("click", closeEstimateChoiceDialog);
$("crmEstimateChoiceModal").addEventListener("click", (event) => {
  if (event.target.id === "crmEstimateChoiceModal") closeEstimateChoiceDialog();
});
$("crmEstimateChoiceCreate").addEventListener("click", () => createEstimateForFile(activeFile(), estimateChoiceTarget));
$("crmEstimateChoiceUpload").addEventListener("click", () => startEstimateUploadForFile(activeFile(), estimateChoiceTarget));
$("crmEstimateChoiceView").addEventListener("click", () => {
  const file = activeFile();
  if (!file?.editableEstimate) return;
  const target = estimateChoiceTarget;
  closeEstimateChoiceDialog();
  sendEstimateToEstimator(file.editableEstimate, target);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !$("crmEstimateChoiceModal").hidden) closeEstimateChoiceDialog();
});
$("crmImportRevenue").addEventListener("click", importRevenueRows);
$("crmAddRevenueRow").addEventListener("click", addRevenueRow);
$("crmUpdateRevenue").addEventListener("click", updateRevenueRows);
$("crmRevenueDateSort").addEventListener("change", (event) => {
  crmRevenueDateSort = event.target.value;
  renderRevenue();
});
$("crmRevenueYearFilter").addEventListener("change", (event) => {
  crmRevenueYearFilter = event.target.value;
  renderRevenue();
});
$("crmAddFileExpense").addEventListener("click", addFileExpenseLine);
$("crmReceiptUpload").addEventListener("change", (event) => {
  attachReceiptToFileExpense(event.target.files[0]);
  event.target.value = "";
});
$("crmUploadEstimateFile").addEventListener("click", () => $("crmEstimateFileUpload").click());
$("crmEstimateFileUpload").addEventListener("change", (event) => {
  if (pendingEstimateUploadFileId) {
    uploadEstimateForActiveFile(event.target.files[0]);
  } else {
    uploadEstimateToRevenue(event.target.files[0]);
  }
  event.target.value = "";
});
document.querySelectorAll("[data-crm-view]").forEach((button) => {
  button.addEventListener("click", () => switchCrmView(button.dataset.crmView));
});
window.addEventListener("focus", () => {
  if (refreshCrmFilesFromStorage()) renderCrm();
});

$("crmFileStatus").addEventListener("change", () => {
  renderStatusDetailOptions(activeFile());
  handleStatusWorkflow();
});
$("crmStatusDetail").addEventListener("change", handleStatusWorkflow);

document.querySelectorAll("input, select, textarea").forEach((element) => {
  if (["crmFileStatus", "crmStatusDetail", "crmEstimateAmountInput", "crmMaterialAmountInput", "crmNewNote"].includes(element.id)) return;
  element.addEventListener("change", (event) => {
    handleCrmControlWorkflow(event);
    saveActiveFile();
    renderCrm();
  });
});

persistRestoredDashboardIfNeeded();
switchCrmView(initialDashboardView());
applyInitialFileRoute();
renderCrm();
