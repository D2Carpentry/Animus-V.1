const crmCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const CRM_STORAGE_KEY = "d2CrmDemoFiles";
const CRM_REVENUE_STORAGE_KEY = "d2CrmRevenueRows";
const CRM_PAYROLL_STORAGE_KEY = "d2CrmPayrollRows";
const CRM_PRICE_DATABASE_KEY = "d2PriceDatabase";
const CRM_PRICE_DELETED_KEY = "d2PriceDeletedIds";
const CRM_EXTERNAL_CALENDAR_KEY = "d2ExternalCalendarEvents";
const CRM_STORAGE_BACKUP_KEY = "d2CrmDemoFilesBackup";
const CRM_REVENUE_BACKUP_KEY = "d2CrmRevenueRowsBackup";
const CRM_PAYROLL_BACKUP_KEY = "d2CrmPayrollRowsBackup";
const CRM_REVENUE_DELETED_KEY = "d2CrmRevenueDeletedIds";
const CRM_REVENUE_HISTORY_RECOVERY_KEY = "d2CrmRevenueHistoryRecoveryV2";
const CRM_PRICE_BACKUP_KEY = "d2PriceDatabaseBackup";
const CRM_RECEIPT_DRAFT_KEY = "d2ReceiptScannerDraft";
const CRM_NEW_FILE_DRAFT_KEY = "animusNewWorkFileDraft";
const CRM_ACTIVE_FILE_DRAFT_KEY = "animusActiveWorkFileDraft";
const CRM_RESTORE_VERSION_KEY = "d2CrmRestoreVersion";
const CRM_CLOUD_SYNC_AT_KEY = "d2CrmCloudSyncAt";
const DEFAULT_GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzZkie1W4LplkKwFoMq19suIHWsamKYNUwCt9xjnihTdy_dN271ou3lscTgq09bAGIG2w/exec";
const OLD_GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxFBQzWViCApvF-c95kAyT0oSNImMgzhf30gP10H2WJT_S5XkejFctq5bT7IjCALMi5Qg/exec";
const GOOGLE_SCRIPT_URL_STORAGE_KEY = "d2GoogleScriptUrl";
const CLOUDFLARE_DASHBOARD_API = "https://animus-v-1.pages.dev/api/dashboard";
const CLOUDFLARE_RECEIPT_API = "https://animus-v-1.pages.dev/api/receipt";
const NOTE_EDIT_WINDOW_MS = 12 * 60 * 60 * 1000;
const DEFAULT_EXPENSE_TAX_RATE = 0.065;
// A delayed initial cloud read must never overwrite edits made in this tab.
let crmLocalChangeVersion = 0;

const CRM_STATUS_DESCRIPTIONS = {
  "New Lead": "Inquiry received from your website, social media, or local referral.",
  "Contact Established": "You have spoken to the client and are actively qualifying their project scope.",
  "Contact Attempted": "A contact attempt was made. Set a next-day follow-up reminder.",
  "Inspection Completed": "You met the client, took site dimensions, and discussed wood types/finishes.",
  "In Negotiation": "Customer is considering the estimate. Set a follow-up date and keep it out of active jobs.",
  "In Progress": "Job has started. Confirm expected completion date and midpoint deposit.",
  "Closed / Paid": "Job folder is archived and contact info is saved for future marketing.",
  "Job Lost / Closed": "Archive the file and save contact info for future marketing.",
};

const CRM_STATUS_DETAILS = {
  "New Lead": ["Needs Contact", "Contact Scheduled"],
  "Contact Established": ["Inspection Date Set", "Inspection Pending"],
  "Contact Attempted": ["Follow Up Tomorrow"],
  "Inspection Completed": ["Estimate Pending", "Estimate Sent"],
  "In Negotiation": ["Follow-Up Scheduled", "Waiting on Customer"],
  "In Progress": ["On Schedule", "Completion Date Needed"],
  "Closed / Paid": ["Invoice Sent", "Invoice Not Sent"],
  "Job Lost / Closed": ["Future Marketing Follow-Up"],
};

const CRM_PROJECT_TYPES = ["Built-in", "Cabinetry", "Closet", "Other", "Other Carpentry", "Pantry", "Refacing", "Refinishing"];

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
  if (status === "In Progress") return CRM_FILE_CATEGORY_RULES.active;
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
  if (["built-in", "built in", "builtin"].includes(cleaned)) return "Built-in";
  const match = CRM_PROJECT_TYPES.find((type) => type.toLowerCase() === cleaned);
  return match || "Other";
}

const crmFields = [
  "clientName",
  "clientPhone",
  "clientEmail",
  "projectAddress",
  "leadSource",
  "leadFee",
  "fileStatus",
  "statusDetail",
  "projectType",
  "otherProjectType",
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
  "totalPaidOverride",
  "laborTotal",
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
let crmPayrollRows = loadPayrollRows();
let activePayrollId = crmPayrollRows[0] ? crmPayrollRows[0].id : null;
let crmPayrollYearFilter = String(new Date().getFullYear());
let crmPayrollStatusFilter = "all";
let crmCalendarFilter = "upcoming";
let crmCalendarCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let crmSelectedCalendarDate = todayIso(0);
let crmSelectedCalendarEventKey = "";
let crmExternalCalendarEvents = loadExternalCalendarEvents();
let crmPriceRows = loadPriceRows();
let crmDeletedPriceIds = loadDeletedPriceIds();
let editingPriceId = "";
let receiptDraft = loadReceiptDraft();
let fileReceiptDraft = blankFileReceiptDraft();
let bulkReceiptDrafts = [];
let editingExpenseNoteLineId = "";
let pendingPartsImportLines = [];
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

function rememberCloudSync(dashboard = {}) {
  try {
    localStorage.setItem(CRM_CLOUD_SYNC_AT_KEY, dashboard.syncedAt || new Date().toISOString());
  } catch (error) {
    // Local storage can be blocked in some browser privacy modes.
  }
}

function fileRecordKey(file = {}) {
  return String(file.fileNumber || file.id || file.clientName || "").trim().toLowerCase();
}

function expenseGroupKey(line = {}) {
  return String(line.receiptGroupId || line.id || "").trim();
}

function mergeExpenseLineArrays(primary = [], secondary = []) {
  const merged = new Map();
  [...primary, ...secondary].forEach((line) => {
    if (!line) return;
    const groupKey = expenseGroupKey(line);
    const key = String(line.id || groupKey).trim();
    if (!key) return;
    merged.set(key, { ...(merged.get(key) || {}), ...line });
  });
  return [...merged.values()];
}

function mergeReceiptHistoryArrays(primary = [], secondary = []) {
  const merged = new Map();
  [...primary, ...secondary].forEach((entry) => {
    if (!entry) return;
    const key = String(entry.id || "").trim();
    if (!key) return;
    const prior = merged.get(key) || {};
    merged.set(key, {
      ...prior,
      ...entry,
      lines: mergeExpenseLineArrays(prior.lines, entry.lines),
    });
  });
  return [...merged.values()];
}

function mergeManualExpenseArrays(primary = [], secondary = []) {
  const merged = new Map();
  [...primary, ...secondary].forEach((expense) => {
    if (!expense) return;
    const key = String(expense.id || "").trim();
    if (!key) return;
    const prior = merged.get(key) || {};
    const priorStamp = Date.parse(prior.updatedAt || prior.createdAt || "") || 0;
    const nextStamp = Date.parse(expense.updatedAt || expense.createdAt || "") || 0;
    merged.set(key, nextStamp >= priorStamp ? { ...prior, ...expense } : { ...expense, ...prior });
  });
  return [...merged.values()].sort((a, b) => {
    const aStamp = Date.parse(a.updatedAt || a.createdAt || "") || 0;
    const bStamp = Date.parse(b.updatedAt || b.createdAt || "") || 0;
    return bStamp - aStamp;
  });
}

function mergeDashboardFileRecords(primaryFile = {}, secondaryFile = {}) {
  return {
    ...primaryFile,
    ...secondaryFile,
    freshExpenseReceipts: mergeReceiptHistoryArrays(primaryFile.freshExpenseReceipts, secondaryFile.freshExpenseReceipts),
    expenseReceipts: mergeReceiptHistoryArrays(primaryFile.expenseReceipts, secondaryFile.expenseReceipts),
    expenseLines: mergeExpenseLineArrays(primaryFile.expenseLines, secondaryFile.expenseLines),
    receiptHistory: mergeReceiptHistoryArrays(primaryFile.receiptHistory, secondaryFile.receiptHistory),
    animusManualExpenses: mergeManualExpenseArrays(primaryFile.animusManualExpenses, secondaryFile.animusManualExpenses),
    animusExpenseLedgerV4: mergeManualExpenseArrays(primaryFile.animusExpenseLedgerV4, secondaryFile.animusExpenseLedgerV4),
  };
}

function mergeDashboardFiles(primary = [], secondary = []) {
  const merged = new Map();
  [...primary, ...secondary].forEach((file) => {
    const key = fileRecordKey(file);
    if (!key) return;
    merged.set(key, merged.has(key) ? mergeDashboardFileRecords(merged.get(key), file) : { ...file });
  });
  return [...merged.values()];
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
  const verifiedHistoryRows = Array.isArray(window.D2_REVENUE_HISTORY_ROWS)
    ? window.D2_REVENUE_HISTORY_ROWS.map((row) => ({ ...row }))
    : [];
  const baselineRows = verifiedHistoryRows.length ? verifiedHistoryRows : defaultRevenueRows();
  try {
    // Clear only stale deletions once so the verified historical ledger can return.
    // New deletions made after this recovery remain respected.
    if (localStorage.getItem(CRM_REVENUE_HISTORY_RECOVERY_KEY) !== "20260822") {
      localStorage.removeItem(CRM_REVENUE_DELETED_KEY);
      localStorage.setItem(CRM_REVENUE_HISTORY_RECOVERY_KEY, "20260822");
    }
  } catch (error) {
    // Storage can be unavailable in private browser modes.
  }
  const deletedKeys = loadDeletedRevenueKeys();
  try {
    const saved = localStorage.getItem(CRM_REVENUE_STORAGE_KEY);
    if (saved) {
      const rows = JSON.parse(saved);
      if (Array.isArray(rows)) {
        if (!rows.length) {
          const backup = localStorage.getItem(CRM_REVENUE_BACKUP_KEY);
          const backupRows = backup ? JSON.parse(backup) : [];
          if (Array.isArray(backupRows) && backupRows.length) {
            return filterDeletedRevenueRows(dedupeRevenueRows(mergeRevenueRows(backupRows, baselineRows)), deletedKeys);
          }
        }
        const mergedBaseline = mergeRevenueRows(restoredRows, baselineRows);
        return filterDeletedRevenueRows(dedupeRevenueRows(mergeRevenueRows(rows, mergedBaseline)), deletedKeys);
      }
    }
  } catch (error) {
    // Local demo storage may be unavailable in some browsers.
  }
  return filterDeletedRevenueRows(dedupeRevenueRows(mergeRevenueRows(restoredRows, baselineRows)), deletedKeys);
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

function receiptHistoryToFreshReceipt(entry = {}) {
  return cleanFreshExpenseReceipt({
    id: entry.id,
    createdAt: entry.savedAt || entry.createdAt,
    updatedAt: entry.updatedAt || entry.savedAt || entry.createdAt,
    date: entry.date,
    vendor: entry.vendor,
    category: entry.category,
    paymentType: entry.paymentType,
    imageTitle: entry.label,
    lines: Array.isArray(entry.lines) ? entry.lines.map((line) => ({
      id: line.id,
      description: line.description || line.note || "",
      category: line.category || entry.category || "Supplies",
      price: line.price === undefined ? (line.baseAmount || line.amount || "") : line.price,
      addTax: line.addTax !== false,
      taxRate: line.taxRate || DEFAULT_EXPENSE_TAX_RATE,
      receiptDataUrl: line.receiptDataUrl || "",
    })) : [],
    imageDataUrl: Array.isArray(entry.lines) ? (entry.lines.find((line) => line.receiptDataUrl)?.receiptDataUrl || "") : "",
  });
}

function receiptStoreKey(receipt = {}) {
  return String(receipt.id || `${receipt.date || ""}|${receipt.vendor || ""}|${receipt.imageTitle || ""}|${receipt.notes || ""}`)
    .trim()
    .toLowerCase();
}

function mergeFileReceiptStores(file) {
  const merged = [];
  const seen = new Set();
  [
    ...(Array.isArray(file.freshExpenseReceipts) ? file.freshExpenseReceipts : []),
    ...(Array.isArray(file.expenseReceipts) ? file.expenseReceipts : []),
    ...(Array.isArray(file.receiptHistory) ? file.receiptHistory.map(receiptHistoryToFreshReceipt) : []),
  ].forEach((receipt) => {
    const clean = cleanFreshExpenseReceipt(receipt);
    const hasContent = clean.vendor || clean.imageTitle || clean.notes || clean.imageDataUrl || clean.lines.length;
    const key = receiptStoreKey(clean);
    if (!hasContent || !key || seen.has(key)) return;
    seen.add(key);
    merged.push(clean);
  });
  return merged.sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
}

function syncExpenseFileForStorage(file) {
  if (!file) return;
  if (Array.isArray(file.animusManualExpenses) && file.animusManualExpenses.length) {
    syncManualExpensesForFile(file);
    return;
  }
  const receipts = mergeFileReceiptStores(file);
  if (receipts.length) {
    file.freshExpenseReceipts = receipts;
    rebuildFreshFileExpenses(file);
    return;
  }
  restoreExpenseLinesFromReceiptHistory(file);
  syncReceiptHistoryFromExpenseLines(file);
}

function saveCrmFiles(options = {}) {
  const syncExpenses = options.syncExpenses !== false;
  try {
    // New/edit work-file intake does not modify receipts. Skipping this
    // expensive rebuild there keeps the focused form responsive, while every
    // receipt/expense workflow continues to use the normal full sync.
    if (syncExpenses) {
      crmFiles.forEach((file) => {
        syncExpenseFileForStorage(file);
      });
    }
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
    restoreVerifiedRevenueHistory();
    crmRevenueRows = dedupeRevenueRows(crmRevenueRows);
    if (Array.isArray(crmRevenueRows) && crmRevenueRows.length) {
      localStorage.setItem(CRM_REVENUE_BACKUP_KEY, JSON.stringify(crmRevenueRows));
    }
    localStorage.setItem(CRM_REVENUE_STORAGE_KEY, JSON.stringify(crmRevenueRows));
  } catch (error) {
    // Google Drive will become the real storage layer.
  }
}

function verifiedRevenueHistoryRows() {
  return Array.isArray(window.D2_REVENUE_HISTORY_ROWS)
    ? window.D2_REVENUE_HISTORY_ROWS.map((row) => ({ ...row }))
    : [];
}

function restoreVerifiedRevenueHistory() {
  const verifiedRows = verifiedRevenueHistoryRows();
  if (!verifiedRows.length) return false;
  const before = JSON.stringify(crmRevenueRows || []);
  crmRevenueRows = filterDeletedRevenueRows(dedupeRevenueRows(mergeRevenueRows(crmRevenueRows || [], verifiedRows)));
  return before !== JSON.stringify(crmRevenueRows);
}

function loadPayrollRows() {
  try {
    const saved = localStorage.getItem(CRM_PAYROLL_STORAGE_KEY);
    const rows = saved ? JSON.parse(saved) : [];
    if (Array.isArray(rows) && rows.length) return rows.map(normalizePayrollRow);
    const backup = localStorage.getItem(CRM_PAYROLL_BACKUP_KEY);
    const backupRows = backup ? JSON.parse(backup) : [];
    return Array.isArray(backupRows) ? backupRows.map(normalizePayrollRow) : [];
  } catch (error) {
    return [];
  }
}

function savePayrollRows() {
  try {
    if (Array.isArray(crmPayrollRows) && crmPayrollRows.length) {
      localStorage.setItem(CRM_PAYROLL_BACKUP_KEY, JSON.stringify(crmPayrollRows));
    }
    localStorage.setItem(CRM_PAYROLL_STORAGE_KEY, JSON.stringify(crmPayrollRows));
  } catch (error) {
    // Cloud save is the long-term storage layer.
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

function buildDashboardSyncPayload(options = {}) {
  const includeRevenue = options.includeRevenue !== false;
  const syncExpenses = options.syncExpenses !== false;
  const captureEdits = options.captureEdits !== false;
  const restoreRevenueHistory = options.restoreRevenueHistory !== false;
  if (captureEdits) captureCurrentDashboardEdits({ includeRevenue });
  // Revenue has its own cloud-save path. Do not even prepare or reconcile the
  // ledger for a file-only Command Center save; that was allowing a stale
  // browser table to interfere with otherwise unrelated file updates.
  if (includeRevenue && restoreRevenueHistory) restoreVerifiedRevenueHistory();
  crmFiles.forEach((file) => {
    syncExpenseFileForStorage(file);
  });
  if (includeRevenue && syncExpenses) syncAllFileExpensesToRevenue();
  const dashboard = {
    action: "dashboardSync",
    syncedAt: new Date().toISOString(),
    source: "D2 Command Center",
    dashboardFiles: crmFiles,
    ...(includeRevenue ? {
      revenueRows: crmRevenueRows,
      deletedRevenueKeys: Array.from(loadDeletedRevenueKeys()),
    } : {}),
    payrollRows: crmPayrollRows,
    priceRows: crmPriceRows,
    deletedPriceIds: crmDeletedPriceIds,
  };
  // Receipt details stay with their work file. Large photo data is left out of
  // the main cloud snapshot so a photo cannot overload the dashboard save.
  return JSON.parse(JSON.stringify(dashboard, (key, value) => {
    if (["imageDataUrl", "receiptDataUrl", "thumbnailDataUrl", "photoDataUrl"].includes(key) && typeof value === "string" && value.startsWith("data:")) return "";
    return value;
  }));
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

async function postPayloadToCloudflare(payload, options = {}) {
  const url = new URL(CLOUDFLARE_DASHBOARD_API, window.location.href);
  if (options.testSnapshot) url.searchParams.set("testSnapshot", "1");
  const response = await fetch(url.toString(), {
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

// R2 writes must stay in order. Without a queue, two quick expense saves can
// overlap and an older request may finish after the newer one, replacing the
// newer receipt list with an older snapshot.
let cloudDashboardWriteQueue = Promise.resolve();

function queueDashboardCloudSave(payload, options = {}) {
  const write = cloudDashboardWriteQueue.then(() => postPayloadToCloudflare(payload, options));
  // Keep the next save available even when one request fails.
  cloudDashboardWriteQueue = write.catch(() => {});
  return write;
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

async function fetchDashboardBackupsFromCloudflare() {
  const response = await fetch(`${CLOUDFLARE_DASHBOARD_API}?backups=list&limit=40&t=${Date.now()}`, {
    method: "GET",
    cache: "no-store",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok === false) {
    throw new Error(result.error || `Cloudflare backup list failed with status ${response.status}.`);
  }
  return Array.isArray(result.backups) ? result.backups : [];
}

async function fetchDashboardBackupSummaryFromCloudflare(key) {
  const response = await fetch(`${CLOUDFLARE_DASHBOARD_API}?summary=${encodeURIComponent(key)}&t=${Date.now()}`, {
    method: "GET",
    cache: "no-store",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok === false) {
    throw new Error(result.error || `Cloudflare backup summary failed with status ${response.status}.`);
  }
  return result.summary || null;
}

async function fetchDashboardBackupFromCloudflare(key) {
  const response = await fetch(`${CLOUDFLARE_DASHBOARD_API}?backup=${encodeURIComponent(key)}&t=${Date.now()}`, {
    method: "GET",
    cache: "no-store",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok === false) {
    throw new Error(result.error || `Cloudflare backup load failed with status ${response.status}.`);
  }
  return result.dashboard || null;
}

function saveExpenseChangeToCloud(message = "Expense saved to Cloudflare.") {
  saveCrmFiles();
  saveRevenueRows();
  const payload = buildDashboardSyncPayload();
  return queueDashboardCloudSave(payload)
    .then((result) => {
      // The Worker returns the merged copy it just stored. Keep this browser on
      // that same copy so the receipt history cannot fall back to an older list.
      if (result?.dashboard?.dashboardFiles) {
        crmFiles = mergeDashboardFiles(crmFiles, result.dashboard.dashboardFiles)
          .map((file) => normalizeCrmFile(file));
        if (Array.isArray(result.dashboard.revenueRows)) {
          crmRevenueRows = mergeRevenueRows(crmRevenueRows, result.dashboard.revenueRows);
        }
        saveCrmFiles();
        saveRevenueRows();
      }
      showDashboardSaveStatus(message);
    })
    .catch(() => showDashboardSaveStatus("Expense saved in this browser, but cloud save did not finish. Click Save when the connection is steady.", true));
}

// Revenue is saved on its own after a confirmed Revenue edit. Keeping it out
// of the general Command Center Save prevents unrelated file saves from ever
// replacing the job-profitability ledger.
function saveRevenueChangeToCloud(message = "Revenue saved to Cloudflare.") {
  saveRevenueRows();
  const payload = buildDashboardSyncPayload({ includeRevenue: true });
  return queueDashboardCloudSave(payload)
    .then((result) => {
      const cloudRows = Array.isArray(result?.dashboard?.revenueRows) ? result.dashboard.revenueRows : [];
      crmRevenueRows = filterDeletedRevenueRows(dedupeRevenueRows(mergeRevenueRowsForSave(cloudRows, payload.revenueRows)));
      saveRevenueRows();
      showDashboardSaveStatus(message);
    })
    .catch(() => showDashboardSaveStatus("Revenue is saved in this browser, but cloud save did not finish. Try again when the connection is steady.", true));
}

window.animusSaveRevenueChangeToCloud = saveRevenueChangeToCloud;

function showReceiptLoading(message = "ANIMUS is reviewing the image and preparing the expense lines.") {
  const modal = $("crmReceiptLoadingModal");
  if (!modal) return;
  const messageElement = $("crmReceiptLoadingMessage");
  if (messageElement) messageElement.textContent = message;
  modal.hidden = false;
}

function hideReceiptLoading() {
  const modal = $("crmReceiptLoadingModal");
  if (modal) modal.hidden = true;
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
    // The redesigned Revenue center uses data-revenue-edit on its Edit
    // buttons. Only actual, visible form fields may change ledger amounts.
    // Treating those buttons as inputs returned an empty value and turned
    // saved Revenue rows into $0 during a general Command Center save.
    if (!field.matches("input, select, textarea") || field.closest("[hidden]") || field.offsetParent === null) return;
    const row = crmRevenueRows.find((entry) => entry.id === field.dataset.revenueEdit);
    if (!row) return;
    const key = field.dataset.revenueField;
    if (["gross", "expenses", "labor"].includes(key)) {
      row[key] = parseMoney(field.value);
      if (key === "labor") syncRevenueLaborToFile(row);
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

function captureVisiblePayrollEdits() {
  document.querySelectorAll("[data-payroll-edit]").forEach((field) => {
    const row = crmPayrollRows.find((entry) => entry.id === field.dataset.payrollEdit);
    if (!row) return;
    const key = field.dataset.payrollField;
    if (["hours", "rate"].includes(key)) row[key] = parseMoney(field.value);
    else if (key === "date") row[key] = normalizeDate(field.value);
    else row[key] = field.value;
    if (key === "fileId") {
      const file = crmFiles.find((entry) => entry.id === row.fileId);
      row.fileNumber = file?.fileNumber || "";
      row.clientJob = file?.clientName || row.clientJob || "";
    }
    row.total = payrollRowTotal(row);
  });
}

function captureVisibleFileExpenseEdits() {
  const file = normalizeCrmFile(activeFile());
  if (!file || !Array.isArray(file.expenseLines)) return;
  document.querySelectorAll("[data-file-expense-field]").forEach((field) => {
    const line = file.expenseLines.find((entry) => entry.id === field.dataset.fileExpenseId);
    if (!line) return;
    const key = field.dataset.fileExpenseField;
    if (key === "addTax") {
      line.addTax = Boolean(field.checked);
    } else if (key === "baseAmount" || key === "amount") {
      line.baseAmount = parseMoney(field.value);
    } else {
      line[key] = field.value;
    }
    line.taxRate = line.taxRate || DEFAULT_EXPENSE_TAX_RATE;
    line.tax = line.addTax ? expenseLineTaxAmount(line) : 0;
    line.amount = receiptExpenseLineAmount(line);
    refreshReceiptHistoryGroup(file, line.receiptGroupId || line.id);
  });
  syncFileExpensesToRevenue(file);
  saveCrmFiles();
}

function captureCurrentDashboardEdits(options = {}) {
  const includeRevenue = options.includeRevenue !== false;
  // The redesigned Revenue table has its own inline editor. Commit that value
  // before collecting the dashboard snapshot so a typed amount is not dropped.
  if (typeof window.animusCommitPendingRevenueEdit === "function") {
    window.animusCommitPendingRevenueEdit();
  }
  crmLocalChangeVersion += 1;
  if (document.activeElement && typeof document.activeElement.blur === "function") {
    document.activeElement.blur();
  }
  saveActiveFile();
  captureOpenFinancialEdits();
  if (includeRevenue) {
    captureVisibleFileExpenseEdits();
    captureVisibleRevenueEdits();
  }
  captureVisiblePayrollEdits();
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
  const saveButton = $("crmSaveDemo");
  const intakeModal = $("animusNewFileModal");
  if (intakeModal && !intakeModal.hidden) {
    showDashboardSaveStatus("Finish creating the work file or cancel the form before using Save All. This keeps the cloud snapshot exact.", true);
    return;
  }
  saveButton.disabled = true;
  saveButton.textContent = "Checking...";
  showDashboardSaveStatus("Preparing the current Command Center for a push-only cloud save...");
  try {
    // Keep the visible work-file fields in the in-memory record, without
    // invoking the legacy full-form save that can read stale hidden controls.
    persistActiveFileDraftNow();

    // Save All is deliberately push-only. It must never read stale hidden form
    // controls, repair/merge older Revenue data, or apply a cloud response back
    // into the page. Restore Backup is the only action that pulls data down.
    const payload = buildDashboardSyncPayload({
      includeRevenue: true,
      syncExpenses: false,
      captureEdits: false,
      restoreRevenueHistory: false,
    });

    // First, exercise the exact full snapshot against a separate test object.
    // Nothing live is changed until Cloudflare returns a matching result.
    const tested = await queueDashboardCloudSave(payload, { testSnapshot: true });
    const testVerification = verifyDashboardTestSnapshot(payload, tested.dashboard);
    if (!testVerification.ok) {
      throw new Error(`Save All stopped before changing the live cloud copy. ${testVerification.missingFiles.length} file(s) or ${testVerification.mismatchedRevenue.length} revenue line(s) did not match.`);
    }

    saveButton.textContent = "Saving...";
    showDashboardSaveStatus("Save check passed. Saving the verified full Command Center to Cloudflare...");
    const saved = await queueDashboardCloudSave(payload);
    const liveVerification = verifyDashboardTestSnapshot(payload, saved.dashboard);
    if (!liveVerification.ok) {
      throw new Error(`Cloudflare protected existing data and did not accept ${liveVerification.missingFiles.length} file(s) or ${liveVerification.mismatchedRevenue.length} revenue line(s) exactly. Restore was not run.`);
    }

    const savedFiles = payload.dashboardFiles;
    rememberCloudSync(payload);
    const totals = dashboardTestTotals(payload.revenueRows || []);
    showDashboardSaveStatus(`Saved all data to Cloudflare. ${savedFiles.length} files and ${payload.revenueRows.length} revenue lines verified. Gross ${crmCurrency.format(totals.gross)} · Expenses ${crmCurrency.format(totals.expenses)}.`);
    saveButton.textContent = "Saved";
    window.setTimeout(() => {
      saveButton.textContent = "Save All";
    }, 1400);
  } catch (error) {
    showDashboardSaveStatus(error.message || "Save All could not be verified. The live cloud copy was not changed.", true);
  } finally {
    saveButton.disabled = false;
    if (saveButton.textContent !== "Saved") saveButton.textContent = "Save All";
  }
}

function dashboardTestTotals(rows = []) {
  return rows.reduce((totals, row) => ({
    gross: totals.gross + (Number(row?.gross) || 0),
    expenses: totals.expenses + (Number(row?.expenses) || 0),
    labor: totals.labor + (Number(row?.labor) || 0),
  }), { gross: 0, expenses: 0, labor: 0 });
}

function dashboardTestValueMatches(left, right) {
  return Math.abs((Number(left) || 0) - (Number(right) || 0)) < 0.005;
}

function verifyDashboardTestSnapshot(sent, received) {
  const receivedFiles = Array.isArray(received?.dashboardFiles) ? received.dashboardFiles : [];
  const receivedRevenue = Array.isArray(received?.revenueRows) ? received.revenueRows : [];
  const missingFiles = (sent.dashboardFiles || []).filter((file) => !receivedFiles.some((saved) => String(saved.id || saved.fileNumber) === String(file.id || file.fileNumber)));
  const mismatchedRevenue = (sent.revenueRows || []).filter((row) => {
    const saved = receivedRevenue.find((entry) => revenueRowKey(entry) === revenueRowKey(row));
    return !saved || !dashboardTestValueMatches(row.gross, saved.gross) || !dashboardTestValueMatches(row.expenses, saved.expenses) || !dashboardTestValueMatches(row.labor, saved.labor);
  });
  return { ok: !missingFiles.length && !mismatchedRevenue.length, missingFiles, mismatchedRevenue };
}

// Writes a separate Cloudflare test snapshot. It exercises the complete
// dashboard payload, including Revenue, without changing dashboard/latest.json.
async function saveDashboardTest() {
  const testButton = $("crmSaveTest");
  if (testButton) {
    testButton.disabled = true;
    testButton.textContent = "Testing...";
  }
  showDashboardSaveStatus("Testing the complete Command Center save without changing the live cloud copy...");
  try {
    const payload = buildDashboardSyncPayload({ includeRevenue: true, syncExpenses: false });
    const result = await queueDashboardCloudSave(payload, { testSnapshot: true });
    const verification = verifyDashboardTestSnapshot(payload, result.dashboard);
    if (!verification.ok) {
      throw new Error(`Save Test protected the live copy. ${verification.missingFiles.length} file(s) or ${verification.mismatchedRevenue.length} revenue line(s) did not match the test snapshot.`);
    }
    const totals = dashboardTestTotals(payload.revenueRows || []);
    showDashboardSaveStatus(`Save Test passed. ${payload.dashboardFiles.length} files and ${payload.revenueRows.length} revenue lines verified in Cloudflare. Gross ${crmCurrency.format(totals.gross)} · Expenses ${crmCurrency.format(totals.expenses)}.`);
  } catch (error) {
    showDashboardSaveStatus(error.message || "Save Test could not be verified. The live cloud copy was not changed.", true);
  } finally {
    if (testButton) {
      testButton.disabled = false;
      testButton.textContent = "Save Test";
    }
  }
}

window.animusSaveDashboardTest = saveDashboardTest;

function applyDashboardBackup(dashboard = {}, options = {}) {
  const preserveMissing = options.preserveMissing === true;
  const hasFiles = Array.isArray(dashboard.dashboardFiles) && dashboard.dashboardFiles.length;
  const hasRevenue = Array.isArray(dashboard.revenueRows) && dashboard.revenueRows.length;
  const hasPayroll = Array.isArray(dashboard.payrollRows) && dashboard.payrollRows.length;
  const hasPrices = Array.isArray(dashboard.priceRows) && dashboard.priceRows.length;
  const files = hasFiles ? dashboard.dashboardFiles : (preserveMissing ? crmFiles : []);
  const verifiedHistoryRows = Array.isArray(window.D2_REVENUE_HISTORY_ROWS)
    ? window.D2_REVENUE_HISTORY_ROWS
    : defaultRevenueRows();
  const revenueRows = mergeRevenueRows(
    hasRevenue ? dashboard.revenueRows : (preserveMissing ? crmRevenueRows : []),
    verifiedHistoryRows,
  );
  const payrollRows = hasPayroll ? dashboard.payrollRows : (preserveMissing ? crmPayrollRows : []);
  const priceRows = hasPrices ? dashboard.priceRows : (preserveMissing ? crmPriceRows : []);
  const deletedPriceIds = Array.isArray(dashboard.deletedPriceIds) ? dashboard.deletedPriceIds : (preserveMissing ? crmDeletedPriceIds : []);
  crmFiles = repairCrmFileCategories(files.map((file) => normalizeCrmFile({ ...file })));
  crmRevenueRows = dedupeRevenueRows(revenueRows.map((row) => ({ ...row })));
  crmPayrollRows = payrollRows.map((row) => normalizePayrollRow(row));
  crmPriceRows = priceRows.map((row) => normalizedPriceRow(row));
  crmDeletedPriceIds = deletedPriceIds;
  activeFileId = crmFiles[0] ? crmFiles[0].id : null;
  activeRevenueId = crmRevenueRows[0] ? crmRevenueRows[0].id : null;
  activePayrollId = crmPayrollRows[0] ? crmPayrollRows[0].id : null;
  saveCrmFiles();
  saveRevenueRows();
  savePayrollRows();
  savePriceRows();
  saveDeletedPriceIds();
  rememberCloudSync(dashboard);
}

async function loadDashboardFromGoogle() {
  const confirmed = window.confirm("Review Cloudflare backups and choose one to restore? This will replace the data currently shown in this browser only after you choose a backup.");
  if (!confirmed) return;
  const button = $("crmLoadCloud");
  if (button) button.textContent = "Checking...";
  try {
    const backupObjects = await fetchDashboardBackupsFromCloudflare();
    if (!backupObjects.length) {
      window.alert("No Cloudflare backup snapshots were found yet.");
      return;
    }
    showDashboardSaveStatus(`Checking ${Math.min(backupObjects.length, 20)} Cloudflare backups...`);
    const summaries = [];
    for (const backup of backupObjects.slice(0, 20)) {
      if (!backup?.key) continue;
      try {
        const summary = await fetchDashboardBackupSummaryFromCloudflare(backup.key);
        if (summary) summaries.push({ ...backup, ...summary });
      } catch (error) {
        summaries.push({ ...backup, error: error.message || "Could not inspect backup." });
      }
    }
    const candidates = summaries
      .filter((backup) => backup && backup.key && backup.totalFiles)
      .sort((a, b) => {
        const closedDelta = (b.counts?.archive || 0) - (a.counts?.archive || 0);
        if (closedDelta) return closedDelta;
        const totalDelta = (b.totalFiles || 0) - (a.totalFiles || 0);
        if (totalDelta) return totalDelta;
        return String(b.syncedAt || b.uploaded || "").localeCompare(String(a.syncedAt || a.uploaded || ""));
      })
      .slice(0, 10);
    if (!candidates.length) {
      window.alert("Cloudflare backup snapshots were found, but none could be inspected. Try again in a moment.");
      return;
    }
    const menu = candidates.map((backup, index) => {
      const counts = backup.counts || {};
      const savedAt = backup.syncedAt || backup.uploaded || "Unknown time";
      const receiptDetails = typeof backup.receiptCount === "number"
        ? ` | Receipts ${backup.receiptCount}`
        : "";
      return `${index + 1}. ${backup.totalFiles} files | Closed ${counts.archive || 0} | Pending Estimates ${counts.estimate || 0} | In Negotiation ${counts.negotiation || 0} | Active ${counts.active || 0}${receiptDetails} | ${savedAt}`;
    }).join("\n");
    const choice = window.prompt(`Choose the Cloudflare backup to restore by number:\n\n${menu}`, "1");
    if (!choice) return;
    const index = Number(choice) - 1;
    const selected = candidates[index];
    if (!selected) {
      window.alert("That backup number was not found. Try Restore from Cloud again.");
      return;
    }
    if (button) button.textContent = "Restoring...";
    const dashboard = await fetchDashboardBackupFromCloudflare(selected.key);
    if (!dashboard) {
      window.alert("That Cloudflare backup could not be opened.");
      return;
    }
    applyDashboardBackup(dashboard);
    renderCrm();
    const files = Array.isArray(dashboard.dashboardFiles) ? dashboard.dashboardFiles : [];
    window.alert(`Command Center restored from Cloudflare backup. ${files.length} files. ${dashboardCloudCountSummary(files)}.`);
  } finally {
    if (button) button.textContent = "Restore Backup";
  }
}

async function importDashboardBackupFile(file) {
  if (!file) return;
  let dashboard;
  try {
    dashboard = JSON.parse(await file.text());
  } catch (error) {
    window.alert("That backup file could not be read. Please choose a Cloudflare dashboard JSON backup.");
    return;
  }
  const files = Array.isArray(dashboard.dashboardFiles) ? dashboard.dashboardFiles : [];
  if (!files.length) {
    window.alert("That backup does not contain Command Center files.");
    return;
  }
  const summary = dashboardCloudCountSummary(files);
  const confirmed = window.confirm(`Import this backup file?\n\n${files.length} files\n${summary}\n\nThis will replace the data currently shown in this browser.`);
  if (!confirmed) return;
  applyDashboardBackup(dashboard);
  renderCrm();
  window.alert(`Backup file imported. ${files.length} files. ${summary}.\n\nDo not click Save until you confirm this is the correct version.`);
}

function shouldAutoRestoreFromCloud() {
  const params = new URLSearchParams(window.location.search);
  // Cloudflare is the source of truth for ANIMUS. Browser storage is only a
  // temporary fallback if the connection cannot reach the Command Center API.
  // `skipCloud` remains available for an intentional offline troubleshooting run.
  return !params.has("skipCloud");
}

async function autoRestoreDashboardFromCloud() {
  if (!shouldAutoRestoreFromCloud()) return;
  const openingChangeVersion = crmLocalChangeVersion;
  showDashboardSaveStatus("Loading the current Command Center from Cloudflare...");
  try {
    const dashboard = await fetchDashboardFromCloudflare();
    if (crmLocalChangeVersion !== openingChangeVersion) {
      showDashboardSaveStatus("Kept changes made while Command Center was opening.");
      return;
    }
    const files = Array.isArray(dashboard?.dashboardFiles) ? dashboard.dashboardFiles : [];
    if (!dashboard || !files.length) {
      showDashboardSaveStatus("Cloudflare does not have a saved Command Center yet. Showing this browser's temporary copy.", true);
      return;
    }
    const localFileCount = Array.isArray(crmFiles) ? crmFiles.length : 0;
    if (localFileCount && files.length < localFileCount) {
      showDashboardSaveStatus(`Cloud copy has only ${files.length} files while this device has ${localFileCount}. Kept this device's copy. Use Restore Backup to choose a full snapshot.`, true);
      return;
    }
    applyDashboardBackup(dashboard, { preserveMissing: true });
    renderCrm();
    showDashboardSaveStatus(`Loaded the current cloud copy: ${files.length} files. ${dashboardCloudCountSummary(files)}.`);
  } catch (error) {
    showDashboardSaveStatus("Cloudflare could not be reached. Showing this browser's temporary copy only.", true);
  }
}

function activeFile() {
  return crmFiles.find((file) => file.id === activeFileId) || null;
}

// Used by the Work File back control to return to the list without changing any file data.
window.clearActiveCrmFileSelection = function clearActiveCrmFileSelection() {
  activeFileId = null;
  activateCrmFilter("all");
  renderCrm();
};

function normalizeCrmFile(file) {
  if (!file) return file;
  if (!Array.isArray(file.notes)) file.notes = [];
  if (!Array.isArray(file.timeline)) file.timeline = [];
  if (!Array.isArray(file.expenseLines)) file.expenseLines = [];
  if (!Array.isArray(file.receiptHistory)) file.receiptHistory = [];
  if (!Array.isArray(file.expenseReceipts)) file.expenseReceipts = [];
  if (!Array.isArray(file.freshExpenseReceipts)) file.freshExpenseReceipts = [];
  if (!Array.isArray(file.animusManualExpenses)) file.animusManualExpenses = [];
  syncExpenseFileForStorage(file);
  // These two stages were retired from the working workflow. Keep every
  // record intact while placing old labels into the remaining active stage.
  if (["Job Won", "Work Completed"].includes(file.fileStatus)) {
    file.fileStatus = "In Progress";
    file.statusDetail = "Completion Date Needed";
  }
  file.projectStage = file.projectStage || inferProjectStage(file.fileStatus);
  file.projectType = normalizeProjectType(file.projectType);
  file.leadFee = Number.isFinite(Number(file.leadFee)) ? Number(file.leadFee) : 0;
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
  if (status === "In Progress") return "In Progress";
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
  if (["In Progress", "Closed / Paid"].includes(status)) return "Approved";
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
  const search = String($("animusWorkFileSearch")?.value || "").trim().toLowerCase();
  const sort = $("animusWorkFileSort")?.value || "updated";
  let files = filter === "all" ? [...crmFiles] : CRM_FILE_CATEGORY_RULES[filter] ? filesInCategory(filter) : crmFiles.filter(isOpenCrmFile);
  if (search) {
    files = files.filter((file) => [file.clientName, file.fileNumber, file.projectAddress, file.clientPhone, file.clientEmail]
      .some((value) => String(value || "").toLowerCase().includes(search)));
  }
  const timestamp = (file) => {
    const timeline = Array.isArray(file.timeline) ? file.timeline[file.timeline.length - 1] : null;
    const note = Array.isArray(file.notes) ? file.notes[file.notes.length - 1] : null;
    const raw = file.updatedAt || file.createdAt || timeline?.at || note?.editedAt || note?.at || "";
    const value = new Date(raw).getTime();
    return Number.isFinite(value) ? value : 0;
  };
  return files.sort((left, right) => {
    if (sort === "name") return String(left.clientName || "").localeCompare(String(right.clientName || ""));
    if (sort === "number") return String(left.fileNumber || "").localeCompare(String(right.fileNumber || ""), undefined, { numeric: true });
    return timestamp(right) - timestamp(left);
  });
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
  const filters = [
    ["all", "All Work Files", crmFiles.length],
    ["new", "New Leads", filesInCategory("new").length],
    ["contact", "Pending Contact", filesInCategory("contact").length],
    ["estimate", "Pending Estimates", filesInCategory("estimate").length],
    ["negotiation", "In Negotiation", filesInCategory("negotiation").length],
    ["active", "Active Jobs", filesInCategory("active").length],
    ["archive", "Closed Files", filesInCategory("archive").length],
  ];
  const filterMenu = $("animusWorkFileFilterMenu");
  if (filterMenu) {
    filterMenu.innerHTML = filters.map(([value, label, count]) => `<button type="button" class="animus-work-file-filter-option ${$("crmFileFilter").value === value ? "active" : ""}" data-animus-file-filter="${value}"><span>${label}</span><b>${count}</b></button>`).join("");
  }
  const statusTone = (file) => ({
    "New Lead": "new-lead",
    "Contact Established": "contact-established",
    "Contact Attempted": "contact-attempted",
    "Inspection Completed": "inspection-completed",
    "In Negotiation": "negotiation",
    "In Progress": "in-progress",
    "Closed / Paid": "closed-paid",
    "Job Lost / Closed": "lost-closed",
  }[file.fileStatus] || "new-lead");
  const initials = (name) => String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  $("crmFileList").innerHTML = files.map((file) => `
    <button type="button" class="crm-file-card ${file.id === activeFileId ? "active" : ""}" data-file-id="${file.id}">
      <span class="animus-file-card-copy">
        <strong>${escapeHtml(file.clientName || "Unnamed Client")}</strong>
        <small>${escapeHtml(file.fileNumber || "No file number")}</small>
        <span class="animus-file-status-inline ${statusTone(file)}">${escapeHtml(file.fileStatus || "New Lead")}</span>
      </span>
      <span class="animus-file-chevron" aria-hidden="true">›</span>
    </button>
  `).join("") || `<p class="crm-empty-state">No files match this view yet.</p>`;

  document.querySelectorAll("[data-file-id]").forEach((button) => {
    button.addEventListener("click", () => {
      saveActiveFile();
      activeFileId = button.dataset.fileId;
      renderCrm();
    });
  });
  document.querySelectorAll("[data-animus-file-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      activateCrmFilter(button.dataset.animusFileFilter);
      $("animusWorkFileFilterMenu").hidden = true;
      $("animusWorkFileFilterButton").setAttribute("aria-expanded", "false");
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

// Keep the legacy Financials card and the ANIMUS work-file Financials tab on
// one definition of "paid". A manually corrected Total Paid is authoritative;
// otherwise the three recorded payments determine the total.
function totalPaidForFile(file = {}) {
  const hasManualTotal = file.totalPaidOverride !== "" && file.totalPaidOverride !== undefined && file.totalPaidOverride !== null;
  const manualTotal = Number(file.totalPaidOverride);
  if (hasManualTotal && Number.isFinite(manualTotal)) return Math.max(manualTotal, 0);
  const estimateTotal = Number(file.estimateTotal) || 0;
  if (file.paidInFull === "Yes") return estimateTotal;
  return Math.max(0,
    (Number(file.initialDeposit) || Number(file.depositTotal) || 0)
    + (Number(file.midpointDeposit) || 0)
    + (Number(file.finalPaymentAmount) || 0)
  );
}

function renderActiveFile() {
  const file = normalizeCrmFile(activeFile());
  if (!file) {
    $("activeFileNumber").textContent = "No project selected";
    $("activeClientName").textContent = "Create or select a customer file";
    $("crmSupplementSummary").textContent = "";
    crmFields.forEach((field) => {
      const element = $(`crm${field[0].toUpperCase()}${field.slice(1)}`);
      if (element) element.value = "";
    });
    toggleAngiLeadFeeField();
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
  const supplements = Array.isArray(file.supplements) ? file.supplements : [];
  $("crmSupplementSummary").textContent = supplements.length
    ? `${supplements.length} saved supplement${supplements.length === 1 ? "" : "s"} · Latest ${supplements[supplements.length - 1].estimateNumber || "Supplement"}`
    : "";
  crmFields.forEach((field) => {
    const element = $(`crm${field[0].toUpperCase()}${field.slice(1)}`);
    if (element) element.value = file[field] || "";
  });
  toggleAngiLeadFeeField();
  renderStatusDetailOptions(file);
  const estimateTotal = Number(file.estimateTotal) || 0;
  const securedTotal = totalPaidForFile(file);
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

function isAngiLeadSource(value) {
  return String(value || "").trim().toLowerCase() === "angi";
}

function toggleAngiLeadFeeField() {
  const wrap = $("crmAngiLeadFeeField");
  if (!wrap) return;
  wrap.hidden = !isAngiLeadSource($("crmLeadSource")?.value || activeFile()?.leadSource);
}

function saveActiveFile(options = {}) {
  const intakeModal = $("animusNewFileModal");
  // A delayed save from the page beneath the modal must never run while the
  // user is entering a new file or editing a file in the focused popup.
  if (!options.allowWhileIntakeOpen && intakeModal && !intakeModal.hidden) return;
  const file = normalizeCrmFile(activeFile());
  if (!file) return;
  const changeNotes = [];
  let paymentChanged = false;
  crmFields.forEach((field) => {
    const element = $(`crm${field[0].toUpperCase()}${field.slice(1)}`);
    if (!element) return;
    const oldValue = file[field] || "";
    const newValue = element.value;
    file[field] = newValue;
    if (oldValue !== newValue) {
      if (["initialDeposit", "midpointDeposit", "finalPaymentAmount", "paidInFull"].includes(field)) paymentChanged = true;
      const label = trackedStatusFields[field] || field.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
      changeNotes.push(`${label} changed from ${oldValue || "blank"} to ${newValue || "blank"}`);
    }
    if (trackedStatusFields[field] && oldValue && oldValue !== newValue) {
      file.timeline.push(`${trackedStatusFields[field]} changed from ${oldValue} to ${newValue} on ${formatNoteTimestamp(new Date().toISOString())}`);
    }
  });
  // A deposit or payment change means the old manually entered total is no
  // longer authoritative. Recalculate Total Paid from the current payments.
  if (paymentChanged) file.totalPaidOverride = "";
  if (!file.timeline) file.timeline = [];
  if (changeNotes.length) {
    const timestamp = new Date().toISOString();
    file.notes.push({ at: timestamp, text: changeNotes.join("\n") });
    file.timeline.push(`File updated ${formatNoteTimestamp(timestamp)}`);
  }
  if (file.fileStatus === "In Progress") ensureRevenueRowForFile(file);
  saveCrmFiles();
}

function isActiveFileEditorVisible() {
  // The record editor beneath the intake popup remains in the DOM. Treat it
  // as inactive while the popup is open so dropdown blur events cannot save
  // stale background fields over the values being edited in the popup.
  const intakeModal = $("animusNewFileModal");
  if (intakeModal && !intakeModal.hidden) return false;
  const editor = document.querySelector(".animus-work-files-layout");
  // Preserve the legacy editor's behavior when the ANIMUS shell is unavailable.
  if (!editor) return true;
  return !editor.closest("[hidden]") && editor.offsetParent !== null;
}

// Capture a draft without adding a timeline note for every character typed.
// This runs immediately, before the normal debounced save, so copying details
// from another web page cannot discard an unfinished new customer file.
function persistActiveFileDraftNow() {
  const file = normalizeCrmFile(activeFile());
  if (!file || !isActiveFileEditorVisible()) return;
  const draft = { id: file.id, fields: {} };
  crmFields.forEach((field) => {
    const element = $(`crm${field[0].toUpperCase()}${field.slice(1)}`);
    if (element) {
      file[field] = element.value;
      draft.fields[field] = element.value;
    }
  });
  // Do not serialize every file, receipt, and photo for every character typed.
  // A small draft keeps the current work safe until the full save runs.
  try { localStorage.setItem(CRM_ACTIVE_FILE_DRAFT_KEY, JSON.stringify(draft)); } catch (error) { /* Draft storage is optional. */ }
}

// Keep a partially completed new file safe when the user switches away to copy
// customer information. The visible Save button remains the cloud-save action.
let crmDraftSaveTimer;
function saveActiveFileDraft() {
  if (!activeFile()) return;
  persistActiveFileDraftNow();
  window.clearTimeout(crmDraftSaveTimer);
  crmLocalChangeVersion += 1;
  crmDraftSaveTimer = window.setTimeout(() => {
    const intakeModal = $("animusNewFileModal");
    if (intakeModal && !intakeModal.hidden) return;
    saveActiveFile();
    try { localStorage.removeItem(CRM_ACTIVE_FILE_DRAFT_KEY); } catch (error) { /* Draft storage is optional. */ }
  }, 650);
}

function flushActiveFileDraft() {
  if (!activeFile()) return;
  window.clearTimeout(crmDraftSaveTimer);
  persistActiveFileDraftNow();
  if (isActiveFileEditorVisible()) {
    saveActiveFile();
    try { localStorage.removeItem(CRM_ACTIVE_FILE_DRAFT_KEY); } catch (error) { /* Draft storage is optional. */ }
  }
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

function newFileOptionMarkup(values, selected = "") {
  return values.map((value) => `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(value)}</option>`).join("");
}

function newFileDraftValues() {
  try {
    const raw = localStorage.getItem(CRM_NEW_FILE_DRAFT_KEY);
    const draft = raw ? JSON.parse(raw) : {};
    return draft && typeof draft === "object" ? draft : {};
  } catch (error) {
    return {};
  }
}

let newFileDraftSaveTimer;

function saveNewFileDraftNow() {
  const modal = $("animusNewFileModal");
  if (!modal || modal.hidden || modal.dataset.mode !== "new") return;
  const draft = {};
  modal.querySelectorAll("[data-new-file-field]").forEach((field) => {
    draft[field.dataset.newFileField] = field.type === "checkbox" ? field.checked : field.value;
  });
  try { localStorage.setItem(CRM_NEW_FILE_DRAFT_KEY, JSON.stringify(draft)); } catch (error) { /* Draft storage is optional. */ }
}

function saveNewFileDraft() {
  const modal = $("animusNewFileModal");
  // Edit File persists only when its Save Work File button is pressed. It
  // should not schedule browser draft writes for every field change.
  if (!modal || modal.hidden || modal.dataset.mode !== "new") return;
  // Browser storage is synchronous, so wait for a short pause while typing.
  window.clearTimeout(newFileDraftSaveTimer);
  newFileDraftSaveTimer = window.setTimeout(saveNewFileDraftNow, 350);
}

function clearNewFileDraft() {
  try { localStorage.removeItem(CRM_NEW_FILE_DRAFT_KEY); } catch (error) { /* Draft storage is optional. */ }
}

function closeNewCrmFileModal() {
  const modal = $("animusNewFileModal");
  if (modal) {
    window.clearTimeout(newFileDraftSaveTimer);
    modal.hidden = true;
    if (modal.dataset.mode === "new") clearNewFileDraft();
  }
}

function intakeValuesForFile(file = {}) {
  return {
    clientName: "", clientPhone: "", clientEmail: "", projectAddress: "", leadSource: "Manual", leadFee: "", projectType: "Other", otherProjectType: "",
    fileStatus: "New Lead", statusDetail: "Needs Contact", nextAction: "", hasNextActionDate: false, nextActionDate: "",
    contactEmailSent: "No", contactTextSent: "No", inspectionDateSet: "No", inspectionDate: "", inspectionTime: "", arrivalWindow: "Open", startDate: "", followUpDate: "", anticipatedCompletionDate: "",
    estimateTotal: "", materialTotal: "", initialDepositSecured: "No", initialDeposit: "", midpointDepositSecured: "No", midpointDeposit: "", finalPaymentSecured: "No", finalPaymentAmount: "", invoiceSent: "No", reviewRequested: "No", closingCallCompleted: "No", warrantyStatus: "Not Sent",
    ...file,
    hasNextActionDate: Boolean(file?.nextActionDate),
  };
}

function populateCrmFileIntakeModal(modal, file = null) {
  const mode = file ? "edit" : "new";
  const values = intakeValuesForFile(file || {});
  modal.dataset.mode = mode;
  modal.dataset.fileId = file?.id || "";
  modal.querySelector("header p").textContent = mode === "edit" ? "EDIT WORK FILE" : "NEW WORK FILE";
  modal.querySelector("header h2").textContent = mode === "edit" ? "Edit Customer File" : "Create a Customer File";
  modal.querySelector("header span").textContent = mode === "edit" ? "Update any detail below, then save it back to this work file." : "Enter the information you have now. Everything can be updated later.";
  modal.querySelector(".animus-new-file-create").textContent = mode === "edit" ? "Save Work File" : "Create Work File";
  modal.querySelectorAll("[data-new-file-field]").forEach((field) => {
    const value = values[field.dataset.newFileField];
    if (field.type === "checkbox") field.checked = Boolean(value);
    else field.value = value ?? "";
  });
  const status = values.fileStatus || "New Lead";
  const detailSelect = modal.querySelector("#animusNewFileStatusDetail");
  if (detailSelect) {
    const details = CRM_STATUS_DETAILS[status] || [""];
    detailSelect.innerHTML = newFileOptionMarkup(details, values.statusDetail || details[0]);
    detailSelect.value = details.includes(values.statusDetail) ? values.statusDetail : details[0];
  }
  const leadFeeWrap = modal.querySelector("#animusNewFileLeadFeeWrap");
  if (leadFeeWrap) leadFeeWrap.hidden = !isAngiLeadSource(values.leadSource);
  const otherProjectWrap = modal.querySelector("#animusNewFileOtherProjectWrap");
  if (otherProjectWrap) otherProjectWrap.hidden = values.projectType !== "Other";
  const nextActionDateWrap = modal.querySelector("#animusNewFileNextActionDateWrap");
  if (nextActionDateWrap) nextActionDateWrap.hidden = !values.hasNextActionDate;
  const error = $("animusNewFileError");
  if (error) error.hidden = true;
}

function openLegacyNewCrmFileModal(fileToEdit = null) {
  let modal = $("animusNewFileModal");
  if (!fileToEdit) clearNewFileDraft();
  const draft = fileToEdit ? intakeValuesForFile(fileToEdit) : {};
  if (!modal) {
    const status = draft.fileStatus || "New Lead";
    const detail = draft.statusDetail || CRM_STATUS_DETAILS[status]?.[0] || "Needs Contact";
    const hasNextActionDate = draft.hasNextActionDate === true || draft.hasNextActionDate === "true";
    modal = document.createElement("div");
    modal.id = "animusNewFileModal";
    modal.className = "animus-new-file-modal-backdrop";
    modal.innerHTML = `<section class="animus-new-file-modal" role="dialog" aria-modal="true" aria-labelledby="animusNewFileTitle">
      <header><div><p>NEW WORK FILE</p><h2 id="animusNewFileTitle">Create a Customer File</h2><span>Enter the information you have now. Everything can be updated later.</span></div><button type="button" class="animus-new-file-close" data-new-file-close aria-label="Close">×</button></header>
      <form id="animusNewFileForm">
        <section><h3>Customer</h3><div class="animus-new-file-grid"><label class="wide">Customer Name<input data-new-file-field="clientName" value="${escapeHtml(draft.clientName || "")}" autocomplete="name" required placeholder="Customer name"></label><label>Phone<input data-new-file-field="clientPhone" value="${escapeHtml(draft.clientPhone || "")}" autocomplete="tel" type="tel" placeholder="(239) 555-0100"></label><label>Email<input data-new-file-field="clientEmail" value="${escapeHtml(draft.clientEmail || "")}" autocomplete="email" type="email" placeholder="name@email.com"></label><label class="wide">Project Address<input data-new-file-field="projectAddress" value="${escapeHtml(draft.projectAddress || "")}" autocomplete="street-address" placeholder="Street, city, state, ZIP"></label></div></section>
        <section><h3>Project & Status</h3><div class="animus-new-file-grid"><label>Lead Source<select data-new-file-field="leadSource" id="animusNewFileLeadSource">${newFileOptionMarkup(["Manual", "Phone", "Website", "Angi", "Referral", "Social Media"], draft.leadSource || "Manual")}</select></label><label id="animusNewFileLeadFeeWrap"${isAngiLeadSource(draft.leadSource) ? "" : " hidden"}>Lead Fee<input data-new-file-field="leadFee" value="${escapeHtml(draft.leadFee || "")}" inputmode="decimal" type="number" min="0" step="0.01" placeholder="Enter fee"></label><label>Project Type<select data-new-file-field="projectType" id="animusNewFileProjectType">${newFileOptionMarkup(CRM_PROJECT_TYPES, draft.projectType || "Other")}</select></label><label id="animusNewFileOtherProjectWrap"${draft.projectType === "Other" ? "" : " hidden"}>Other Project Type<input data-new-file-field="otherProjectType" value="${escapeHtml(draft.otherProjectType || "")}" placeholder="Describe this project"></label><label>File Status<select data-new-file-field="fileStatus" id="animusNewFileStatus">${newFileOptionMarkup(Object.keys(CRM_STATUS_DETAILS), status)}</select></label><label>Status Detail<select data-new-file-field="statusDetail" id="animusNewFileStatusDetail">${newFileOptionMarkup(CRM_STATUS_DETAILS[status] || [], detail)}</select></label><label class="wide">Next Action<input data-new-file-field="nextAction" value="${escapeHtml(draft.nextAction || "")}" placeholder="Follow up, send estimate, set inspection"></label><label class="animus-new-file-check"><input data-new-file-field="hasNextActionDate" id="animusNewFileHasNextActionDate" type="checkbox"${hasNextActionDate ? " checked" : ""}><span>Set a Next Action Date</span></label><label id="animusNewFileNextActionDateWrap"${hasNextActionDate ? "" : " hidden"}>Next Action Date<input data-new-file-field="nextActionDate" value="${escapeHtml(draft.nextActionDate || "")}" type="date"></label></div></section>
        <section><h3>Contact & Schedule</h3><div class="animus-new-file-grid"><label>Contact Email Sent?<select data-new-file-field="contactEmailSent">${newFileOptionMarkup(["No", "Yes"], draft.contactEmailSent || "No")}</select></label><label>Contact Text Sent?<select data-new-file-field="contactTextSent">${newFileOptionMarkup(["No", "Yes"], draft.contactTextSent || "No")}</select></label><label>Inspection Date Set?<select data-new-file-field="inspectionDateSet">${newFileOptionMarkup(["No", "Yes"], draft.inspectionDateSet || "No")}</select></label><label>Inspection Date<input data-new-file-field="inspectionDate" value="${escapeHtml(draft.inspectionDate || "")}" type="date"></label><label>Inspection Time<input data-new-file-field="inspectionTime" value="${escapeHtml(draft.inspectionTime || "")}" type="time"></label><label>Arrival Window<select data-new-file-field="arrivalWindow">${newFileOptionMarkup(["Open", "7:00 AM", "8:00 AM", "9:00 AM", "10:00 AM", "Afternoon"], draft.arrivalWindow || "Open")}</select></label><label>Start Date<input data-new-file-field="startDate" value="${escapeHtml(draft.startDate || "")}" type="date"></label><label>Follow-Up Date<input data-new-file-field="followUpDate" value="${escapeHtml(draft.followUpDate || "")}" type="date"></label><label>Anticipated Completion<input data-new-file-field="anticipatedCompletionDate" value="${escapeHtml(draft.anticipatedCompletionDate || "")}" type="date"></label></div></section>
        <section><h3>Financials & Operations</h3><div class="animus-new-file-grid"><label>Estimate Amount<input data-new-file-field="estimateTotal" value="${escapeHtml(draft.estimateTotal || "")}" inputmode="decimal" type="number" min="0" step="0.01" placeholder="0.00"></label><label>Materials Amount<input data-new-file-field="materialTotal" value="${escapeHtml(draft.materialTotal || "")}" inputmode="decimal" type="number" min="0" step="0.01" placeholder="0.00"></label><label>Initial Deposit Secured?<select data-new-file-field="initialDepositSecured">${newFileOptionMarkup(["No", "Yes"], draft.initialDepositSecured || "No")}</select></label><label>Initial Deposit<input data-new-file-field="initialDeposit" value="${escapeHtml(draft.initialDeposit || "")}" inputmode="decimal" type="number" min="0" step="0.01" placeholder="0.00"></label><label>Midpoint Deposit Secured?<select data-new-file-field="midpointDepositSecured">${newFileOptionMarkup(["No", "Yes"], draft.midpointDepositSecured || "No")}</select></label><label>Midpoint Deposit<input data-new-file-field="midpointDeposit" value="${escapeHtml(draft.midpointDeposit || "")}" inputmode="decimal" type="number" min="0" step="0.01" placeholder="0.00"></label><label>Final Payment Secured?<select data-new-file-field="finalPaymentSecured">${newFileOptionMarkup(["No", "Yes"], draft.finalPaymentSecured || "No")}</select></label><label>Final Payment<input data-new-file-field="finalPaymentAmount" value="${escapeHtml(draft.finalPaymentAmount || "")}" inputmode="decimal" type="number" min="0" step="0.01" placeholder="0.00"></label><label>Invoice Sent?<select data-new-file-field="invoiceSent">${newFileOptionMarkup(["No", "Yes"], draft.invoiceSent || "No")}</select></label><label>Review Requested?<select data-new-file-field="reviewRequested">${newFileOptionMarkup(["No", "Yes"], draft.reviewRequested || "No")}</select></label><label>Closing Call Completed?<select data-new-file-field="closingCallCompleted">${newFileOptionMarkup(["No", "Yes"], draft.closingCallCompleted || "No")}</select></label><label>Warranty Details<select data-new-file-field="warrantyStatus">${newFileOptionMarkup(["Not Sent", "Sent"], draft.warrantyStatus || "Not Sent")}</select></label></div></section>
        <p class="animus-new-file-error" id="animusNewFileError" hidden></p><footer><button type="button" class="animus-new-file-cancel" data-new-file-close>Cancel</button><button type="submit" class="animus-new-file-create">Create Work File</button></footer>
      </form></section>`;
    document.body.appendChild(modal);
    modal.querySelectorAll("[data-new-file-field]").forEach((field) => {
      // Selects only change the visible form controls. Saving every dropdown
      // change synchronously is unnecessary and was causing a noticeable stall
      // on the Project Type picker. Text entry still gets a debounced draft;
      // page-hide saves the complete form if the user switches away to copy.
      if (field.matches("select, input[type='checkbox']")) return;
      field.addEventListener("input", saveNewFileDraft);
      field.addEventListener("change", saveNewFileDraft);
    });
    modal.querySelector("#animusNewFileStatus")?.addEventListener("change", (event) => {
      const details = CRM_STATUS_DETAILS[event.target.value] || [""];
      const target = modal.querySelector("#animusNewFileStatusDetail");
      target.innerHTML = newFileOptionMarkup(details, details[0]);
    });
    modal.querySelector("#animusNewFileLeadSource")?.addEventListener("change", (event) => {
      const leadFeeWrap = modal.querySelector("#animusNewFileLeadFeeWrap");
      if (leadFeeWrap) leadFeeWrap.hidden = !isAngiLeadSource(event.target.value);
    });
    modal.querySelector("#animusNewFileProjectType")?.addEventListener("change", (event) => {
      const otherProjectWrap = modal.querySelector("#animusNewFileOtherProjectWrap");
      if (otherProjectWrap) otherProjectWrap.hidden = event.target.value !== "Other";
      if (event.target.value !== "Other") {
        const otherProjectInput = otherProjectWrap?.querySelector("input");
        if (otherProjectInput) otherProjectInput.value = "";
      }
    });
    const nextActionDateToggle = modal.querySelector("#animusNewFileHasNextActionDate");
    const nextActionDateWrap = modal.querySelector("#animusNewFileNextActionDateWrap");
    nextActionDateToggle?.addEventListener("change", () => {
      if (nextActionDateWrap) nextActionDateWrap.hidden = !nextActionDateToggle.checked;
      const dateInput = nextActionDateWrap?.querySelector("input");
      if (!nextActionDateToggle.checked && dateInput) dateInput.value = "";
      if (nextActionDateToggle.checked && dateInput && !dateInput.value) dateInput.value = todayIso(1);
    });
    modal.querySelectorAll("[data-new-file-close]").forEach((button) => button.addEventListener("click", closeNewCrmFileModal));
    modal.addEventListener("click", (event) => { if (event.target === modal) closeNewCrmFileModal(); });
    modal.querySelector("form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const values = {};
      modal.querySelectorAll("[data-new-file-field]").forEach((field) => { values[field.dataset.newFileField] = field.type === "checkbox" ? field.checked : field.value; });
      if (!String(values.clientName || "").trim()) { const error = $("animusNewFileError"); error.hidden = false; error.textContent = modal.dataset.mode === "edit" ? "Enter the customer name before saving this work file." : "Enter the customer name before creating this work file."; return; }
      const button = modal.querySelector(".animus-new-file-create");
      const error = $("animusNewFileError");
      try {
        if (error) error.hidden = true;
        const isEdit = modal.dataset.mode === "edit";
        if (button) { button.disabled = true; button.textContent = isEdit ? "Saving..." : "Creating..."; }
        const file = isEdit ? updateCrmFileFromIntake(modal.dataset.fileId, values) : newCrmFile({ direct:true, values, skipRoute:true });
        if (!file?.id) throw new Error(isEdit ? "The work file was not updated." : "The work file was not created.");
        clearNewFileDraft();
        closeNewCrmFileModal();
        // A new file needs to leave the old editor before it is selected. An
        // edit is already on the work-files screen, so routing would let the
        // stale screen form overwrite the just-saved modal values.
        if (!isEdit && typeof switchCrmView === "function") switchCrmView("files");
        activeFileId = file.id;
        renderCrm();
        window.setTimeout(() => $("crmClientName")?.focus(), 0);
      } catch (createError) {
        if (error) { error.hidden = false; error.textContent = `${modal.dataset.mode === "edit" ? "Could not save this work file." : "Could not create this work file."} ${createError?.message || "Please try again."}`; }
        console.error("Work file intake save failed", createError);
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = modal.dataset.mode === "edit" ? "Save Work File" : "Create Work File";
        }
      }
    });
  }
  populateCrmFileIntakeModal(modal, fileToEdit);
  modal.hidden = false;
  window.setTimeout(() => modal.querySelector("[data-new-file-field='clientName']")?.focus(), 0);
}

// Lightweight replacement for the original intake dialog. It deliberately
// has no per-field persistence or background render work: the record changes
// only after the user presses Create Work File or Save Work File.
function openNewCrmFileModal(fileToEdit = null) {
  const existing = $("animusNewFileModal");
  if (existing) existing.remove();

  const mode = fileToEdit ? "edit" : "new";
  const values = intakeValuesForFile(fileToEdit || {});
  const status = values.fileStatus || "New Lead";
  const detailOptions = CRM_STATUS_DETAILS[status] || [""];
  const optionList = (options, value) => newFileOptionMarkup(options, value || "");
  const input = (key, label, type = "text", extra = "") => `<label>${label}<input data-new-file-field="${key}" type="${type}" value="${escapeHtml(values[key] ?? "")}" ${extra}></label>`;
  const select = (key, label, options, extra = "") => `<label ${extra}>${label}<select data-new-file-field="${key}" id="animusIntake${key[0].toUpperCase()}${key.slice(1)}">${optionList(options, values[key])}</select></label>`;

  const modal = document.createElement("div");
  modal.id = "animusNewFileModal";
  modal.className = "animus-new-file-modal-backdrop";
  modal.dataset.mode = mode;
  modal.dataset.fileId = fileToEdit?.id || "";
  modal.innerHTML = `<section class="animus-new-file-modal" role="dialog" aria-modal="true" aria-labelledby="animusNewFileTitle">
    <header><div><p>${mode === "edit" ? "EDIT WORK FILE" : "NEW WORK FILE"}</p><h2 id="animusNewFileTitle">${mode === "edit" ? "Edit Customer File" : "Create a Customer File"}</h2><span>Enter the details below. Nothing is changed until you save this form.</span></div><button type="button" class="animus-new-file-close" data-intake-close aria-label="Close">×</button></header>
    <form id="animusSimpleFileForm">
      <section><h3>Customer</h3><div class="animus-new-file-grid">${input("clientName", "Customer Name", "text", "autocomplete=\"name\" required placeholder=\"Customer name\"")}${input("clientPhone", "Phone", "tel", "autocomplete=\"tel\" placeholder=\"(239) 555-0100\"")}${input("clientEmail", "Email", "email", "autocomplete=\"email\" placeholder=\"name@email.com\"")}<label class="wide">Project Address<input data-new-file-field="projectAddress" value="${escapeHtml(values.projectAddress ?? "")}" autocomplete="street-address" placeholder="Street, city, state, ZIP"></label></div></section>
      <section><h3>Project &amp; Status</h3><div class="animus-new-file-grid">${select("leadSource", "Lead Source", ["Manual", "Phone", "Website", "Angi", "Referral", "Social Media"])}<label id="animusIntakeLeadFeeWrap"${isAngiLeadSource(values.leadSource) ? "" : " hidden"}>Lead Fee<input data-new-file-field="leadFee" type="number" min="0" step="0.01" inputmode="decimal" value="${escapeHtml(values.leadFee ?? "")}" placeholder="Enter fee"></label>${select("projectType", "Project Type", CRM_PROJECT_TYPES)}<label id="animusIntakeOtherProjectWrap"${values.projectType === "Other" ? "" : " hidden"}>Other Project Type<input data-new-file-field="otherProjectType" value="${escapeHtml(values.otherProjectType ?? "")}" placeholder="Describe this project"></label>${select("fileStatus", "File Status", Object.keys(CRM_STATUS_DETAILS))}<label>Status Detail<select data-new-file-field="statusDetail" id="animusIntakeStatusDetail">${optionList(detailOptions, values.statusDetail)}</select></label><label class="wide">Next Action<input data-new-file-field="nextAction" value="${escapeHtml(values.nextAction ?? "")}" placeholder="Follow up, send estimate, set inspection"></label><label class="animus-new-file-check"><input data-new-file-field="hasNextActionDate" id="animusIntakeHasNextActionDate" type="checkbox"${values.hasNextActionDate ? " checked" : ""}><span>Set a Next Action Date</span></label><label id="animusIntakeNextActionDateWrap"${values.hasNextActionDate ? "" : " hidden"}>Next Action Date<input data-new-file-field="nextActionDate" type="date" value="${escapeHtml(values.nextActionDate ?? "")}"></label></div></section>
      <section><h3>Contact &amp; Schedule</h3><div class="animus-new-file-grid">${select("contactEmailSent", "Contact Email Sent?", ["No", "Yes"])}${select("contactTextSent", "Contact Text Sent?", ["No", "Yes"])}${select("inspectionDateSet", "Inspection Date Set?", ["No", "Yes"])}${input("inspectionDate", "Inspection Date", "date")}${input("inspectionTime", "Inspection Time", "time")}${select("arrivalWindow", "Arrival Window", ["Open", "7:00 AM", "8:00 AM", "9:00 AM", "10:00 AM", "Afternoon"])}${input("startDate", "Start Date", "date")}${input("followUpDate", "Follow-Up Date", "date")}${input("anticipatedCompletionDate", "Anticipated Completion", "date")}</div></section>
      <section><h3>Financials &amp; Operations</h3><div class="animus-new-file-grid">${input("estimateTotal", "Estimate Amount", "number", "min=\"0\" step=\"0.01\"")}${input("materialTotal", "Materials Amount", "number", "min=\"0\" step=\"0.01\"")}${select("initialDepositSecured", "Initial Deposit Secured?", ["No", "Yes"])}${input("initialDeposit", "Initial Deposit", "number", "min=\"0\" step=\"0.01\"")}${select("midpointDepositSecured", "Midpoint Deposit Secured?", ["No", "Yes"])}${input("midpointDeposit", "Midpoint Deposit", "number", "min=\"0\" step=\"0.01\"")}${select("finalPaymentSecured", "Final Payment Secured?", ["No", "Yes"])}${input("finalPaymentAmount", "Final Payment", "number", "min=\"0\" step=\"0.01\"")}${select("invoiceSent", "Invoice Sent?", ["No", "Yes"])}${select("reviewRequested", "Review Requested?", ["No", "Yes"])}${select("closingCallCompleted", "Closing Call Completed?", ["No", "Yes"])}${select("warrantyStatus", "Warranty Details", ["Not Sent", "Sent"])}</div></section>
      <p class="animus-new-file-error" id="animusNewFileError" hidden></p><footer><button type="button" class="animus-new-file-cancel" data-intake-close>Cancel</button><button type="submit" class="animus-new-file-create">${mode === "edit" ? "Save Work File" : "Create Work File"}</button></footer>
    </form>
  </section>`;
  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelectorAll("[data-intake-close]").forEach((button) => button.addEventListener("click", close));
  modal.addEventListener("click", (event) => { if (event.target === modal) close(); });
  modal.querySelector("#animusIntakeLeadSource")?.addEventListener("change", (event) => { modal.querySelector("#animusIntakeLeadFeeWrap").hidden = !isAngiLeadSource(event.target.value); });
  modal.querySelector("#animusIntakeProjectType")?.addEventListener("change", (event) => {
    const wrap = modal.querySelector("#animusIntakeOtherProjectWrap");
    wrap.hidden = event.target.value !== "Other";
    if (wrap.hidden) wrap.querySelector("input").value = "";
  });
  modal.querySelector("#animusIntakeFileStatus")?.addEventListener("change", (event) => {
    const details = CRM_STATUS_DETAILS[event.target.value] || [""];
    modal.querySelector("#animusIntakeStatusDetail").innerHTML = optionList(details, details[0]);
  });
  modal.querySelector("#animusIntakeHasNextActionDate")?.addEventListener("change", (event) => {
    const wrap = modal.querySelector("#animusIntakeNextActionDateWrap");
    wrap.hidden = !event.target.checked;
    if (!event.target.checked) wrap.querySelector("input").value = "";
  });
  modal.querySelector("form").addEventListener("submit", (event) => {
    event.preventDefault();
    const formValues = {};
    modal.querySelectorAll("[data-new-file-field]").forEach((control) => { formValues[control.dataset.newFileField] = control.type === "checkbox" ? control.checked : control.value; });
    const error = modal.querySelector("#animusNewFileError");
    if (!String(formValues.clientName || "").trim()) { error.hidden = false; error.textContent = "Enter the customer name before saving this work file."; return; }
    const savedFile = mode === "edit" ? updateCrmFileFromIntake(fileToEdit.id, formValues) : newCrmFile({ direct: true, values: formValues, skipRoute: true });
    if (!savedFile?.id) { error.hidden = false; error.textContent = "The work file could not be saved."; return; }
    close();
    // Change views before selecting the new record. switchCrmView flushes the
    // legacy page fields; selecting first let those stale fields overwrite the
    // freshly created work file.
    if (mode === "new" && typeof switchCrmView === "function") switchCrmView("files");
    activeFileId = savedFile.id;
    renderCrm();
  });
  modal.hidden = false;
  window.setTimeout(() => modal.querySelector("[data-new-file-field='clientName']")?.focus(), 0);
}

function updateCrmFileFromIntake(fileId, values = {}) {
  const file = crmFiles.find((entry) => entry.id === fileId);
  if (!file) throw new Error("That work file could not be found.");
  const paymentFields = ["initialDeposit", "midpointDeposit", "finalPaymentAmount"];
  const paymentChanged = paymentFields.some((key) => values[key] !== undefined && parseMoney(values[key] || 0) !== parseMoney(file[key] || 0));
  const textFields = ["clientName", "clientPhone", "clientEmail", "projectAddress", "leadSource", "fileStatus", "statusDetail", "projectType", "otherProjectType", "contactEmailSent", "contactTextSent", "inspectionDateSet", "inspectionDate", "inspectionTime", "arrivalWindow", "startDate", "followUpDate", "anticipatedCompletionDate", "nextAction", "warrantyStatus", "initialDepositSecured", "midpointDepositSecured", "finalPaymentSecured", "invoiceSent", "reviewRequested", "closingCallCompleted"];
  textFields.forEach((key) => { if (values[key] !== undefined) file[key] = String(values[key] || "").trim(); });
  file.projectType = normalizeProjectType(file.projectType || "Other");
  file.leadFee = parseMoney(values.leadFee || 0);
  file.nextActionDate = values.hasNextActionDate ? (values.nextActionDate || todayIso(1)) : "";
  ["estimateTotal", "materialTotal", "initialDeposit", "midpointDeposit", "finalPaymentAmount"].forEach((key) => { file[key] = parseMoney(values[key] || 0); });
  if (paymentChanged) file.totalPaidOverride = "";
  file.depositSecured = file.initialDepositSecured || "No";
  file.updatedAt = new Date().toISOString();
  file.timeline = [...(Array.isArray(file.timeline) ? file.timeline : []), { at:file.updatedAt, text:"Work file updated" }];
  saveCrmFiles({ syncExpenses: false });
  return file;
}

window.openCrmFileIntakeEditor = function openCrmFileIntakeEditor() {
  const file = activeFile();
  if (!file) return;
  openNewCrmFileModal(file);
};

function newCrmFile(options = {}) {
  if (!options.direct) { openNewCrmFileModal(); return null; }
  const values = options.values || {};
  // Never read hidden form fields from another ANIMUS view. Those values can
  // be stale while the user is on the Dashboard, Contacts, or Revenue page.
  if (isActiveFileEditorVisible()) flushActiveFileDraft();
  const status = values.fileStatus || "New Lead";
  const detail = values.statusDetail || CRM_STATUS_DETAILS[status]?.[0] || "Needs Contact";
  const file = {
    id: makeCrmId("file"),
    fileNumber: makeCrmFileNumber(),
    clientName: String(values.clientName || "").trim(),
    clientPhone: String(values.clientPhone || "").trim(),
    clientEmail: String(values.clientEmail || "").trim(),
    projectAddress: String(values.projectAddress || "").trim(),
    leadSource: values.leadSource || "Manual",
    leadFee: parseMoney(values.leadFee || 0),
    fileStatus: status,
    statusDetail: detail,
    projectType: normalizeProjectType(values.projectType || "Other"),
    otherProjectType: values.projectType === "Other" ? String(values.otherProjectType || "").trim() : "",
    projectStage: "Lead",
    contactEmailSent: values.contactEmailSent || "No",
    contactTextSent: values.contactTextSent || "No",
    inspectionDateSet: values.inspectionDateSet || "No",
    inspectionDate: values.inspectionDate || "",
    inspectionTime: values.inspectionTime || "",
    startDate: values.startDate || "",
    arrivalWindow: values.arrivalWindow || "Open",
    followUpDate: values.followUpDate || "",
    anticipatedCompletionDate: values.anticipatedCompletionDate || "",
    nextAction: values.nextAction || "",
    nextActionDate: values.hasNextActionDate ? (values.nextActionDate || todayIso(1)) : "",
    warrantyStatus: values.warrantyStatus || "Not Sent",
    depositSecured: values.initialDepositSecured || "No",
    initialDepositSecured: values.initialDepositSecured || "No",
    initialDeposit: parseMoney(values.initialDeposit || 0),
    midpointDepositSecured: values.midpointDepositSecured || "No",
    midpointDeposit: parseMoney(values.midpointDeposit || 0),
    paidInFull: "No",
    closingCallCompleted: values.closingCallCompleted || "No",
    finalPaymentSecured: values.finalPaymentSecured || "No",
    finalPaymentAmount: parseMoney(values.finalPaymentAmount || 0),
    invoiceSent: values.invoiceSent || "No",
    invoicePaid: "No",
    reviewRequested: values.reviewRequested || "No",
    reviewSent: "No",
    estimateStatus: "Not Started",
    invoiceStatus: "Not Created",
    reviewStatus: "Not Ready",
    estimateTotal: parseMoney(values.estimateTotal || 0),
    depositTotal: 0,
    materialTotal: parseMoney(values.materialTotal || 0),
    notes: [],
    timeline: [{ at:new Date().toISOString(), text:"Work file created" }],
  };
  crmFiles.unshift(file);
  saveCrmFiles({ syncExpenses: false });
  if (!options.skipRoute) {
    // Route away from the current editor while its original file is still
    // selected. This stops stale fields on that screen from overwriting the
    // new file during the route's draft-save cleanup.
    if (typeof switchCrmView === "function") switchCrmView("files");
    activeFileId = file.id;
    renderCrm();
    window.setTimeout(() => $("crmClientName")?.focus(), 0);
  }
  return file;
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

function openEstimatorInCommandCenter(url, estimateData = null) {
  const frame = $("crmEstimatorFrame");
  if (!frame) {
    window.location.href = url;
    return;
  }
  const estimatorUrl = new URL(url, window.location.href);
  estimatorUrl.searchParams.set("embedded", "1");
  estimatorUrl.searchParams.set("open", Date.now().toString());
  if (estimateData) {
    frame.addEventListener("load", () => {
      frame.contentWindow?.postMessage({ type: "animus-open-estimate", estimate: estimateData }, window.location.origin);
    }, { once: true });
  }
  frame.src = estimatorUrl.toString();
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
  // The browser copy opens immediately, and the postMessage on iframe load
  // guarantees the same estimate arrives even when storage timing is slow.
  openEstimatorInCommandCenter(estimatorUrl.toString(), estimateData);
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
  file.otherProjectType = file.projectType === "Other" ? (file.otherProjectType || data.projectTypeOther || "") : "";
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
  reader.addEventListener("error", () => {
    window.alert("This estimate file could not be read. Please choose the editable .d2estimate file, not a PDF.");
  });
  reader.readAsText(file);
}

function chooseEstimateFileForActiveWorkFile() {
  // The old shared picker sits inside the Revenue view, which is hidden while
  // a work file is open. A temporary picker attached to the page body works
  // from every ANIMUS view and avoids the browser silently ignoring the click.
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".d2estimate,.json,.txt,application/json,text/plain";
  input.style.position = "fixed";
  input.style.left = "-10000px";
  input.style.top = "-10000px";
  input.addEventListener("change", () => {
    const selectedFile = input.files?.[0];
    input.remove();
    if (selectedFile) uploadEstimateForActiveFile(selectedFile);
  }, { once:true });
  input.addEventListener("cancel", () => {
    input.remove();
    pendingEstimateUploadFileId = "";
    openEstimateAfterUpload = false;
    estimateChoiceTarget = "";
  }, { once:true });
  document.body.appendChild(input);
  input.click();
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
  chooseEstimateFileForActiveWorkFile();
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

function createSupplementForFile(file = activeFile()) {
  if (!file) {
    window.alert("Select a work file before creating a supplement.");
    return;
  }
  if (!file.editableEstimate) {
    window.alert("This work file needs an estimate before a supplement can be created.");
    showEstimateChoiceDialog("");
    return;
  }
  const supplementNumber = (Array.isArray(file.supplements) ? file.supplements.length : 0) + 1;
  const supplementId = `supplement-${Date.now()}`;
  const data = JSON.parse(JSON.stringify(file.editableEstimate));
  const baseNumber = String(file.editableEstimate.estimateNumber || file.fileNumber || "Estimate").replace(/-S\d+$/i, "");
  data.estimateTitle = "Estimate Supplement";
  data.estimateNumber = `${baseNumber}-S${supplementNumber}`;
  data.lineItems = [];
  data.materialItems = [];
  data.flatTotal = "";
  data.total = 0;
  data.supplementFor = file.id;
  data.supplementId = supplementId;
  data.totals = {
    ...(data.totals || {}), subtotal:0, discount:0, tax:0, total:0, deposit:0,
    lineSubtotal:0, showDiscount:false, showTax:false, showDeposit:false, showSubtotal:false, hasFlatTotal:false,
  };
  // Keep the supplement as a draft until the estimator explicitly saves it.
  // Closing or deleting the draft must not add anything to this work file.
  sendEstimateToEstimator(data);
}

function syncSupplementFromEstimator(data) {
  if (!data?.supplementFor || !data?.supplementId) return;
  const file = crmFiles.find((entry) => entry.id === data.supplementFor);
  if (!file) return;
  file.supplements = Array.isArray(file.supplements) ? file.supplements : [];
  let supplement = file.supplements.find((entry) => entry.id === data.supplementId);
  if (!supplement) {
    supplement = {
      id: data.supplementId,
      title: `Supplement ${file.supplements.length + 1}`,
      estimateNumber: data.estimateNumber || `${file.fileNumber || "Estimate"}-S${file.supplements.length + 1}`,
      data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    file.supplements.push(supplement);
    addSystemNote(file, `${supplement.estimateNumber} saved to this work file.`);
  }
  supplement.data = data;
  supplement.estimateNumber = data.estimateNumber || supplement.estimateNumber;
  supplement.updatedAt = new Date().toISOString();
  saveCrmFiles();
  renderCrm();
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
  return ["dashboard", "calendar", "revenue", "expenses", "prices", "business", "invoice", "estimator"].includes(view) ? view : "dashboard";
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
  renderPayroll();
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
    fileStatus: "In Progress",
    statusDetail: "On Schedule",
    projectStage: "In Progress",
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

function normalizePayrollRow(row = {}) {
  return {
    id: row.id || makeCrmId("payroll"),
    revenueId: row.revenueId || "",
    date: normalizeDate(row.date || todayIso(0)),
    fileId: row.fileId || "",
    fileNumber: row.fileNumber || "",
    clientJob: row.clientJob || "",
    employee: row.employee || "",
    role: row.role || "",
    hours: parseMoney(row.hours),
    rate: parseMoney(row.rate),
    total: parseMoney(row.total) || (parseMoney(row.hours) * parseMoney(row.rate)),
    status: row.status === "Paid" ? "Paid" : "Pending",
    notes: row.notes || "",
  };
}

function payrollRowTotal(row = {}) {
  const hours = parseMoney(row.hours);
  const rate = parseMoney(row.rate);
  return parseMoney(row.total) || (hours * rate);
}

function payrollYear(row = {}) {
  const date = normalizeDate(row.date || "");
  return date ? date.slice(0, 4) : "";
}

function payrollYearOptions() {
  const years = new Set(crmPayrollRows.map((row) => payrollYear(row)).filter(Boolean));
  years.add(String(new Date().getFullYear()));
  return [...years].sort((a, b) => Number(b) - Number(a));
}

function filteredPayrollRows() {
  return crmPayrollRows
    .filter((row) => crmPayrollYearFilter === "all" || payrollYear(row) === crmPayrollYearFilter)
    .filter((row) => crmPayrollStatusFilter === "all" || row.status === crmPayrollStatusFilter);
}

function payrollTotals() {
  return filteredPayrollRows().reduce((totals, row) => {
    const amount = payrollRowTotal(row);
    totals.hours += parseMoney(row.hours);
    totals.gross += amount;
    if (row.status === "Paid") totals.paid += amount;
    else totals.pending += amount;
    return totals;
  }, { hours: 0, gross: 0, paid: 0, pending: 0 });
}

function payrollJobLabel(row = {}) {
  const file = row.fileId ? crmFiles.find((entry) => entry.id === row.fileId) : null;
  return file ? `${file.clientName || "Unnamed Client"} · ${file.fileNumber || "No file #"}` : (row.clientJob || row.fileNumber || "No file linked");
}

function payrollFileOptions(selectedFileId = "") {
  const options = crmFiles.map((file) => {
    const label = `${file.clientName || "Unnamed Client"} · ${file.fileNumber || "No file #"}`;
    return `<option value="${escapeHtml(file.id)}"${file.id === selectedFileId ? " selected" : ""}>${escapeHtml(label)}</option>`;
  }).join("");
  return `<option value="">No file linked</option>${options}`;
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
  const indexes = new Map();
  const hasFinancialValue = (row) => [row?.gross, row?.expenses, row?.labor, row?.profit]
    .some((value) => Math.abs(Number(value) || 0) > 0.0001);
  [...primary, ...secondary].forEach((row) => {
    const key = revenueRowKey(row);
    if (!key) return;
    const index = indexes.get(key);
    if (index === undefined) {
      indexes.set(key, merged.length);
      merged.push({ ...row });
      return;
    }
    const existing = merged[index];
    if (!hasFinancialValue(existing) && hasFinancialValue(row)) {
      merged[index] = {
        ...existing,
        ...row,
        dashboardFileId: existing.dashboardFileId || row.dashboardFileId || "",
        fileNumber: existing.fileNumber || row.fileNumber || "",
        attachedEstimate: existing.attachedEstimate || row.attachedEstimate,
      };
    }
  });
  return merged;
}

// Used only during an explicit Save. It keeps cloud-only rows, while the
// just-captured browser snapshot wins for rows the user actively changed.
function mergeRevenueRowsForSave(cloudRows = [], currentRows = []) {
  const merged = new Map();
  cloudRows.forEach((row) => {
    const key = revenueRowKey(row);
    if (key) merged.set(key, { ...row });
  });
  currentRows.forEach((row) => {
    const key = revenueRowKey(row);
    if (!key) return;
    const prior = merged.get(key) || {};
    merged.set(key, {
      ...prior,
      ...row,
      expenseLines: mergeExpenseLineArrays(prior.expenseLines, row.expenseLines),
    });
  });
  return [...merged.values()];
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
    labor: parseMoney(file.laborTotal),
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
    profit: estimateTotal - materialTotal - (Number(file.laborTotal) || Number(baseRow.labor) || 0),
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

// Labor is one shared financial value. Work-file Financials is the source when
// editing a file; Revenue can also update it through this same linked record.
function syncFileLaborToRevenue(file) {
  if (!file) return null;
  const row = revenueRowForDashboardFile(file) || ensureRevenueRowForFile(file);
  if (!row) return null;
  row.labor = parseMoney(file.laborTotal);
  row.profit = revenueProfit(row);
  saveRevenueRows();
  return row;
}

function syncRevenueLaborToFile(row) {
  if (!row) return null;
  const file = row.dashboardFileId
    ? crmFiles.find((entry) => entry.id === row.dashboardFileId)
    : findFileForRevenue(row);
  if (!file) return null;
  file.laborTotal = parseMoney(row.labor);
  saveCrmFiles();
  return file;
}

window.syncFileLaborToRevenue = syncFileLaborToRevenue;
window.syncRevenueLaborToFile = syncRevenueLaborToFile;

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

// Revenue is a reporting view of the work files, not a second source of truth.
// Rebuild only missing or empty linked rows so a browser/cache restore cannot zero
// the Revenue page, while honoring rows the user intentionally removed.
function revenueEligibleFile(file) {
  return !!file
    && file.revenueExcluded !== true
    && ["In Progress", "Closed / Paid"].includes(file.fileStatus);
}

function revenueEstimateForFile(file) {
  return parseMoney(file?.estimateTotal)
    || parseMoney(file?.editableEstimate?.totals?.total)
    || parseMoney(file?.editableEstimate?.backend?.total)
    || parseMoney(file?.editableEstimate?.flatTotal);
}

function revenueMaterialForFile(file) {
  return parseMoney(file?.materialTotal)
    || parseMoney(file?.editableEstimate?.backend?.estimatedMaterialCost)
    || 0;
}

function repairRevenueRowsFromFiles() {
  let changed = false;

  crmFiles.forEach((file) => {
    if (!revenueEligibleFile(file)) return;

    const gross = revenueEstimateForFile(file);
    const recordedExpenses = fileExpenseTotal(file);
    const materialExpense = revenueMaterialForFile(file);
    const expenses = recordedExpenses || materialExpense;
    const existing = revenueRowForDashboardFile(file);

    // A file with no money attached is not a revenue record yet.
    if (!existing && !gross && !expenses) return;

    if (!existing) {
      crmRevenueRows.unshift({
        id: makeCrmId("rev-file"),
        date: normalizeDate(file.startDate || file.anticipatedCompletionDate || todayIso(0)),
        dashboardFileId: file.id || "",
        fileNumber: file.fileNumber || "",
        clientJob: revenueLabelForFile(file),
        gross,
        expenses,
        labor: parseMoney(file.laborTotal),
        profit: gross - expenses - parseMoney(file.laborTotal),
        receiptNotes: "",
        laborAssigns: "",
        expenseLines: Array.isArray(file.expenseLines) ? file.expenseLines.map((line) => ({ ...line })) : [],
        attachedEstimate: file.editableEstimate
          ? { ...file.editableEstimate, dashboardFileId: file.id || "", fileNumber: file.fileNumber || "" }
          : { dashboardFileId: file.id || "", fileNumber: file.fileNumber || "" },
      });
      changed = true;
      return;
    }

    const before = JSON.stringify({
      dashboardFileId: existing.dashboardFileId,
      fileNumber: existing.fileNumber,
      clientJob: existing.clientJob,
      date: existing.date,
      gross: existing.gross,
      expenses: existing.expenses,
      labor: existing.labor,
      expenseLines: existing.expenseLines,
    });

    existing.dashboardFileId = existing.dashboardFileId || file.id || "";
    existing.fileNumber = existing.fileNumber || file.fileNumber || "";
    existing.clientJob = existing.clientJob || revenueLabelForFile(file);
    existing.date = existing.date || normalizeDate(file.startDate || file.anticipatedCompletionDate || todayIso(0));
    if (!(Number(existing.gross) || 0) && gross) existing.gross = gross;
    if (!(Number(existing.expenses) || 0) && expenses) existing.expenses = expenses;
    if (recordedExpenses) {
      existing.expenseLines = Array.isArray(file.expenseLines) ? file.expenseLines.map((line) => ({ ...line })) : [];
      existing.expenses = recordedExpenses;
    }
    if (file.laborTotal !== undefined && file.laborTotal !== "") existing.labor = parseMoney(file.laborTotal);
    existing.profit = revenueProfit(existing);
    syncRevenueExpenseTotal(existing);

    if (before !== JSON.stringify({
      dashboardFileId: existing.dashboardFileId,
      fileNumber: existing.fileNumber,
      clientJob: existing.clientJob,
      date: existing.date,
      gross: existing.gross,
      expenses: existing.expenses,
      labor: existing.labor,
      expenseLines: existing.expenseLines,
    })) changed = true;
  });

  if (changed) {
    crmRevenueRows = dedupeRevenueRows(crmRevenueRows);
    activeRevenueId = activeRevenueId || crmRevenueRows[0]?.id || null;
    saveRevenueRows();
  }
  return changed;
}

function renderRevenue() {
  reconcileSavedExpenseLedgersToRevenue();
  repairRevenueRowsFromFiles();
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
          <td><button type="button" class="crm-table-action-button" data-revenue-expenses="${escapeHtml(row.id)}">View Expenses</button></td>
          <td><button type="button" class="crm-table-action-button" data-revenue-payroll="${escapeHtml(row.id)}">Payroll</button></td>
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
  document.querySelectorAll("[data-revenue-expenses]").forEach((button) => {
    button.addEventListener("click", () => openRevenueExpenses(button.dataset.revenueExpenses));
  });
  document.querySelectorAll("[data-revenue-payroll]").forEach((button) => {
    button.addEventListener("click", () => openRevenuePayroll(button.dataset.revenuePayroll));
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

function openRevenueExpenses(rowId) {
  const row = crmRevenueRows.find((entry) => entry.id === rowId);
  if (!row) return;
  activeRevenueId = row.id;
  const file = findFileForRevenue(row);
  if (file) activeFileId = file.id;
  switchCrmView("expenses", { expenseScope: "file" });
  renderFileExpenses();
}

function openRevenuePayroll(rowId) {
  const row = crmRevenueRows.find((entry) => entry.id === rowId);
  if (!row) return;
  activeRevenueId = row.id;
  const file = findFileForRevenue(row);
  if (file) activeFileId = file.id;
  const existingPayroll = crmPayrollRows.find((entry) => {
    if (file?.id && entry.fileId === file.id) return true;
    return entry.revenueId === row.id;
  });
  if (existingPayroll) activePayrollId = existingPayroll.id;
  else {
    const payrollRow = normalizePayrollRow({
      id: makeCrmId("payroll"),
      revenueId: row.id,
      date: row.date || todayIso(0),
      fileId: file?.id || "",
      fileNumber: file?.fileNumber || "",
      clientJob: row.clientJob || file?.clientName || "",
      employee: row.laborAssigns || "",
      role: "",
      hours: "",
      rate: "",
      status: "Pending",
    });
    crmPayrollRows.unshift(payrollRow);
    activePayrollId = payrollRow.id;
    savePayrollRows();
  }
  switchCrmView("payroll");
  renderPayroll();
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

function renderPayroll() {
  const totals = payrollTotals();
  $("crmPayrollHours").textContent = String(Math.round(totals.hours * 100) / 100);
  $("crmPayrollGross").textContent = crmCurrency.format(totals.gross);
  $("crmPayrollPaid").textContent = crmCurrency.format(totals.paid);
  $("crmPayrollPending").textContent = crmCurrency.format(totals.pending);

  const yearControl = $("crmPayrollYearFilter");
  if (yearControl) {
    const years = payrollYearOptions();
    yearControl.innerHTML = `<option value="all">All Years</option>${years
      .map((year) => `<option value="${escapeHtml(year)}">${escapeHtml(year)}</option>`)
      .join("")}`;
    if (crmPayrollYearFilter !== "all" && !years.includes(crmPayrollYearFilter)) {
      crmPayrollYearFilter = years[0] || "all";
    }
    yearControl.value = crmPayrollYearFilter;
  }
  if ($("crmPayrollStatusFilter")) $("crmPayrollStatusFilter").value = crmPayrollStatusFilter;

  const rows = filteredPayrollRows().sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  $("crmPayrollRows").innerHTML = rows.length ? rows.map((row) => {
    const total = payrollRowTotal(row);
    return `
      <tr class="${row.id === activePayrollId ? "active" : ""}">
        <td><input class="crm-revenue-input crm-revenue-date" type="date" value="${escapeHtml(row.date || "")}" data-payroll-edit="${escapeHtml(row.id)}" data-payroll-field="date"></td>
        <td>
          <select class="crm-revenue-input crm-payroll-file-select" data-payroll-edit="${escapeHtml(row.id)}" data-payroll-field="fileId">
            ${payrollFileOptions(row.fileId)}
          </select>
          <small>${escapeHtml(payrollJobLabel(row))}</small>
        </td>
        <td><input class="crm-revenue-input" type="text" value="${escapeHtml(row.employee || "")}" data-payroll-edit="${escapeHtml(row.id)}" data-payroll-field="employee" placeholder="Employee"></td>
        <td><input class="crm-revenue-input" type="text" value="${escapeHtml(row.role || "")}" data-payroll-edit="${escapeHtml(row.id)}" data-payroll-field="role" placeholder="Installer, painter"></td>
        <td><input class="crm-revenue-input crm-money-input" inputmode="decimal" value="${escapeHtml(row.hours || "")}" data-payroll-edit="${escapeHtml(row.id)}" data-payroll-field="hours" placeholder="0"></td>
        <td><input class="crm-revenue-input crm-money-input" inputmode="decimal" value="${escapeHtml(row.rate || "")}" data-payroll-edit="${escapeHtml(row.id)}" data-payroll-field="rate" placeholder="0"></td>
        <td><strong class="crm-profit-value">${crmCurrency.format(total)}</strong></td>
        <td>
          <select class="crm-revenue-input" data-payroll-edit="${escapeHtml(row.id)}" data-payroll-field="status">
            <option${row.status !== "Paid" ? " selected" : ""}>Pending</option>
            <option${row.status === "Paid" ? " selected" : ""}>Paid</option>
          </select>
        </td>
        <td><input class="crm-revenue-input" type="text" value="${escapeHtml(row.notes || "")}" data-payroll-edit="${escapeHtml(row.id)}" data-payroll-field="notes" placeholder="Notes"></td>
        <td class="crm-revenue-actions"><button type="button" data-payroll-delete="${escapeHtml(row.id)}">Delete</button></td>
      </tr>
    `;
  }).join("") : `<tr><td colspan="10" class="crm-empty-row">No payroll rows yet.</td></tr>`;

  document.querySelectorAll("[data-payroll-edit]").forEach((field) => {
    field.addEventListener("change", () => updatePayrollField(field));
    field.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        field.blur();
      }
    });
  });
  document.querySelectorAll("[data-payroll-delete]").forEach((button) => {
    button.addEventListener("click", () => deletePayrollRow(button.dataset.payrollDelete));
  });
  renderPayrollDetail();
}

function renderPayrollDetail() {
  const row = crmPayrollRows.find((entry) => entry.id === activePayrollId) || crmPayrollRows[0];
  if (!row) {
    $("crmPayrollDetail").innerHTML = `<p class="crm-empty-state">Select or add a payroll row to see details.</p>`;
    return;
  }
  const total = payrollRowTotal(row);
  $("crmPayrollDetail").innerHTML = `
    <p class="eyebrow">${escapeHtml(row.status || "Pending")}</p>
    <h3>${escapeHtml(row.employee || "Unassigned Labor")}</h3>
    <dl>
      <div><dt>File</dt><dd>${escapeHtml(payrollJobLabel(row))}</dd></div>
      <div><dt>Hours</dt><dd>${escapeHtml(String(row.hours || 0))}</dd></div>
      <div><dt>Rate</dt><dd>${crmCurrency.format(parseMoney(row.rate))}</dd></div>
      <div><dt>Total</dt><dd>${crmCurrency.format(total)}</dd></div>
    </dl>
    <p class="crm-helper-text">Use this page to record who worked, what they did, how many hours, and whether they have been paid.</p>
  `;
}

function updatePayrollField(field) {
  const row = crmPayrollRows.find((entry) => entry.id === field.dataset.payrollEdit);
  if (!row) return;
  const key = field.dataset.payrollField;
  if (["hours", "rate"].includes(key)) row[key] = parseMoney(field.value);
  else if (key === "date") row[key] = normalizeDate(field.value);
  else row[key] = field.value;
  if (key === "fileId") {
    const file = crmFiles.find((entry) => entry.id === row.fileId);
    row.fileNumber = file?.fileNumber || "";
    row.clientJob = file?.clientName || row.clientJob || "";
  }
  row.total = payrollRowTotal(row);
  activePayrollId = row.id;
  savePayrollRows();
  renderPayroll();
}

function updatePayrollRows() {
  document.querySelectorAll("[data-payroll-edit]").forEach((field) => {
    const row = crmPayrollRows.find((entry) => entry.id === field.dataset.payrollEdit);
    if (!row) return;
    const key = field.dataset.payrollField;
    if (["hours", "rate"].includes(key)) row[key] = parseMoney(field.value);
    else if (key === "date") row[key] = normalizeDate(field.value);
    else row[key] = field.value;
    row.total = payrollRowTotal(row);
  });
  savePayrollRows();
  renderPayroll();
  const button = $("crmUpdatePayroll");
  if (!button) return;
  button.textContent = "Updated";
  window.setTimeout(() => {
    const refreshedButton = $("crmUpdatePayroll");
    if (refreshedButton) refreshedButton.textContent = "Update Payroll";
  }, 1000);
}

function addPayrollRow() {
  const file = activeFile();
  const row = normalizePayrollRow({
    id: makeCrmId("payroll"),
    date: todayIso(0),
    fileId: file?.id || "",
    fileNumber: file?.fileNumber || "",
    clientJob: file?.clientName || "",
    status: "Pending",
  });
  crmPayrollRows.unshift(row);
  activePayrollId = row.id;
  savePayrollRows();
  renderPayroll();
}

function deletePayrollRow(rowId) {
  const row = crmPayrollRows.find((entry) => entry.id === rowId);
  if (!row) return;
  if (!window.confirm(`Delete payroll row for ${row.employee || row.clientJob || "this job"}?`)) return;
  crmPayrollRows = crmPayrollRows.filter((entry) => entry.id !== rowId);
  activePayrollId = crmPayrollRows[0] ? crmPayrollRows[0].id : null;
  savePayrollRows();
  renderPayroll();
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

function expenseLineBaseAmount(line = {}) {
  const base = Number(line.baseAmount);
  return Number.isFinite(base) && base > 0 ? base : (Number(line.amount) || 0);
}

function expenseLineTaxRate(line = {}) {
  const rate = Number(line.taxRate);
  return Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_EXPENSE_TAX_RATE;
}

function expenseLineTaxAmount(line = {}) {
  if (!line.addTax) return Number(line.tax) || 0;
  return expenseLineBaseAmount(line) * expenseLineTaxRate(line);
}

function receiptExpenseLineAmount(line = {}) {
  if (line.addTax) return expenseLineBaseAmount(line) + expenseLineTaxAmount(line);
  return Number(line.amount) || expenseLineBaseAmount(line);
}

function fileExpenseTotal(file) {
  if (Array.isArray(file?.freshExpenseReceipts) && file.freshExpenseReceipts.length) {
    rebuildFreshFileExpenses(file);
  } else {
    restoreExpenseLinesFromReceiptHistory(file);
  }
  return (Array.isArray(file?.expenseLines) ? file.expenseLines : []).reduce((sum, line) => {
    return sum + receiptExpenseLineAmount(line);
  }, 0);
}

function revenueLabelForFile(file) {
  return `${file?.clientName || "Unnamed Client"}${file?.fileNumber ? ` - ${file.fileNumber}` : ""}`;
}

function ensureExpenseRevenueRowForFile(file) {
  if (!file) return null;
  const existing = revenueRowForDashboardFile(file);
  if (file.revenueExcluded === true) return existing;
  if (existing) return existing;
  const expenses = fileExpenseTotal(file);
  const gross = Number(file.estimateTotal) || Number(file.editableEstimate?.totals?.total) || 0;
  if (!expenses && !gross) return null;
  const row = {
    id: makeCrmId("rev-file"),
    date: todayIso(0),
    dashboardFileId: file.id || "",
    fileNumber: file.fileNumber || "",
    clientJob: revenueLabelForFile(file),
    gross,
    expenses,
    labor: 0,
    profit: gross - expenses,
    receiptNotes: "",
    laborAssigns: "",
    expenseLines: [],
    attachedEstimate: file.editableEstimate
      ? { ...file.editableEstimate, dashboardFileId: file.id || "", fileNumber: file.fileNumber || "" }
      : { dashboardFileId: file.id || "", fileNumber: file.fileNumber || "" },
  };
  crmRevenueRows.unshift(row);
  return row;
}

function syncFileExpensesToRevenue(file) {
  if (!file) return;
  if (Array.isArray(file.freshExpenseReceipts) && file.freshExpenseReceipts.length) {
    rebuildFreshFileExpenses(file);
  } else {
    restoreExpenseLinesFromReceiptHistory(file);
    syncReceiptHistoryFromExpenseLines(file);
  }
  const row = ensureExpenseRevenueRowForFile(file);
  if (!row) return;
  row.dashboardFileId = file.id || row.dashboardFileId || "";
  row.fileNumber = file.fileNumber || row.fileNumber || "";
  if (!row.clientJob || row.clientJob === "Unnamed Client") row.clientJob = revenueLabelForFile(file);
  row.expenseLines = Array.isArray(file.expenseLines) ? file.expenseLines.map((line) => ({ ...line })) : [];
  syncRevenueExpenseTotal(row);
  saveRevenueRows();
}

function syncAllFileExpensesToRevenue() {
  crmFiles.forEach((file) => {
    if (
      (Array.isArray(file.animusManualExpenses) && file.animusManualExpenses.length)
      || (Array.isArray(file.freshExpenseReceipts) && file.freshExpenseReceipts.length)
      || (Array.isArray(file.expenseLines) && file.expenseLines.length)
    ) {
      syncFileExpensesToRevenue(file);
    }
  });
}

function blankFileReceiptDraft() {
  return {
    imageDataUrl: "",
    fileName: "",
    imageTitle: "",
    vendor: "",
    date: "",
    category: "Supplies",
    customCategory: "",
    amount: "",
    tax: "",
    paymentType: "",
    paymentCard: "",
    notes: "",
    pastedText: "",
    lines: [],
    isEditingSavedReceipt: false,
    editingExpenseId: "",
    editingReceiptGroupId: "",
    status: "",
    aiAvailable: false,
  };
}

function blankFileReceiptLine(line = {}) {
  return {
    id: line.id || makeCrmId("receiptExpense"),
    use: line.use !== false,
    description: line.description || line.name || line.product || "",
    category: line.category || "Supplies",
    price: line.price || line.total || line.amount || "",
    addTax: line.addTax === false ? false : true,
  };
}

function categoryFromReceiptText(text = "") {
  const cleanText = text.toLowerCase();
  if (/(paint|primer|stain|renner|sherwin|roller|brush|finish|urethane|sealer)/.test(cleanText)) return "Paint / Finish";
  if (/(screw|hinge|slide|hardware|pull|handle|bracket|nail|tapcon)/.test(cleanText)) return "Hardware";
  if (/(plywood|birch|mdf|lumber|stud|wood|board|trim|poplar|maple)/.test(cleanText)) return "Materials";
  if (/(blade|saw|tool|drill|sander|router|ladder|equipment)/.test(cleanText)) return "Equipment";
  if (/(gas|fuel|shell|mobil|chevron|wawa|racetrac)/.test(cleanText)) return "Fuel";
  if (/(labor|helper|installer|subcontractor)/.test(cleanText)) return "Labor";
  return "Supplies";
}

function normalizeFileReceiptCategory(category = "") {
  const cleanCategory = String(category || "").trim().toLowerCase();
  if (cleanCategory === "materials" || cleanCategory === "material" || cleanCategory === "plywood") return "Materials";
  if (cleanCategory === "fuel") return "Fuel";
  if (cleanCategory === "equipment") return "Equipment";
  if (cleanCategory === "other") return "Other";
  if (cleanCategory === "hardware" || cleanCategory === "paint / finish" || cleanCategory === "finishing" || cleanCategory === "labor") return "Supplies";
  return "Supplies";
}

function vendorFromReceiptText(text = "") {
  const knownVendors = [
    "Home Depot",
    "Lowe's",
    "Sherwin-Williams",
    "Imeca",
    "American Paint Supplies",
    "Vision Ace Hardware",
    "Amazon",
    "Ace Hardware",
  ];
  const cleanText = text.toLowerCase();
  return knownVendors.find((vendor) => cleanText.includes(vendor.toLowerCase())) || "";
}

function parseDateFromReceiptText(text = "") {
  const match = String(text).match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/);
  if (!match) return "";
  let [, month, day, year] = match;
  if (year.length === 2) year = `20${year}`;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function parseReceiptText(text = "", fallback = {}) {
  const amounts = [...String(text).matchAll(/\$?\s?(\d{1,4}(?:,\d{3})*(?:\.\d{2}))/g)]
    .map((match) => parseMoney(match[1]))
    .filter((amount) => amount > 0);
  const totalMatch = String(text).match(/(?:grand\s+total|total|amount|sale)\D{0,16}\$?\s?(\d{1,4}(?:,\d{3})*(?:\.\d{2}))/i);
  const taxMatch = String(text).match(/(?:tax|sales\s+tax)\D{0,16}\$?\s?(\d{1,4}(?:,\d{3})*(?:\.\d{2}))/i);
  const amount = totalMatch ? parseMoney(totalMatch[1]) : (amounts.length ? Math.max(...amounts) : "");
  const tax = taxMatch ? parseMoney(taxMatch[1]) : "";
  const cleanText = String(text || "").trim();
  return {
    vendor: vendorFromReceiptText(cleanText) || fallback.vendor || "",
    date: parseDateFromReceiptText(cleanText) || fallback.date || todayIso(0),
    category: normalizeFileReceiptCategory(categoryFromReceiptText(cleanText || fallback.fileName || fallback.vendor || "")),
    amount,
    tax,
    paymentType: /cash/i.test(cleanText) ? "Cash" : (/visa|mastercard|amex|card|debit|credit/i.test(cleanText) ? "Card" : ""),
    notes: cleanText
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 12)
      .join("\n"),
    lines: amount
      ? [blankFileReceiptLine({
        description: fallback.fileName || "Receipt expense",
        category: normalizeFileReceiptCategory(categoryFromReceiptText(cleanText || fallback.fileName || fallback.vendor || "")),
        price: amount,
      })]
      : [],
  };
}

function receiptResultToDraft(result = {}, fallback = {}) {
  const receipt = result.receipt || result || {};
  const lineItems = Array.isArray(receipt.lineItems) ? receipt.lineItems : [];
  const reviewLines = lineItems
    .map((item) => blankFileReceiptLine({
      description: item.name || item.description || "",
      category: normalizeFileReceiptCategory(item.category || receipt.category || fallback.category || "Supplies"),
      price: item.total || item.amount || item.price || "",
    }))
    .filter((line) => line.description || parseMoney(line.price));
  const fallbackAmount = receipt.total || receipt.amount || fallback.amount || "";
  const itemNotes = lineItems
    .map((item) => {
      const name = item.name || item.description || "";
      const total = item.total || item.amount || item.price || "";
      return [name, total ? crmCurrency.format(parseMoney(total)) : ""].filter(Boolean).join(" - ");
    })
    .filter(Boolean)
    .join("\n");
  return {
    ...blankFileReceiptDraft(),
    ...fallback,
    vendor: receipt.vendor || fallback.vendor || "",
    date: receipt.date || fallback.date || todayIso(0),
    category: normalizeFileReceiptCategory(receipt.category || fallback.category || categoryFromReceiptText(`${receipt.vendor || ""} ${receipt.notes || ""} ${itemNotes}`)),
    amount: fallbackAmount,
    tax: receipt.tax || fallback.tax || "",
    paymentType: receipt.paymentType || receipt.payment || fallback.paymentType || "",
    notes: [receipt.notes || "", itemNotes].filter(Boolean).join("\n").trim() || fallback.notes || "",
    lines: reviewLines.length
      ? reviewLines
      : (fallbackAmount ? [blankFileReceiptLine({
        description: receipt.notes || fallback.notes || receipt.vendor || fallback.fileName || "Receipt expense",
        category: normalizeFileReceiptCategory(receipt.category || fallback.category || "Supplies"),
        price: fallbackAmount,
      })] : []),
    aiAvailable: Boolean(result.aiAvailable),
    status: result.aiAvailable
      ? "Receipt read with AI. Review the fields, then save the expense."
      : (result.message || result.error || "Receipt attached. AI reading is not connected yet, so review or paste receipt text before saving."),
  };
}

function receiptTaxRateForDraft(draft = fileReceiptDraft) {
  const tax = parseMoney(draft.tax);
  const total = parseMoney(draft.amount);
  const taxableBase = total > tax ? total - tax : 0;
  return tax > 0 && taxableBase > 0 ? tax / taxableBase : DEFAULT_EXPENSE_TAX_RATE;
}

function receiptTaxRate() {
  return receiptTaxRateForDraft(fileReceiptDraft);
}

function receiptLineFinalAmountForDraft(line = {}, draft = fileReceiptDraft) {
  const price = parseMoney(line.price);
  if (!line.addTax) return price;
  return price + (price * receiptTaxRateForDraft(draft));
}

function receiptLineFinalAmount(line = {}) {
  return receiptLineFinalAmountForDraft(line, fileReceiptDraft);
}

function receiptReviewLinesTotal() {
  return (Array.isArray(fileReceiptDraft.lines) ? fileReceiptDraft.lines : []).reduce((sum, line) => {
    return line.use === false ? sum : sum + receiptLineFinalAmount(line);
  }, 0);
}

function selectedFileReceiptCategory() {
  return selectedFileReceiptCategoryForDraft(fileReceiptDraft);
}

function selectedFileReceiptCategoryForDraft(draft = fileReceiptDraft) {
  if (draft.category === "Other" && draft.customCategory) {
    return draft.customCategory;
  }
  return draft.category || "Supplies";
}

function receiptPaymentLabelForDraft(draft = fileReceiptDraft) {
  return [draft.paymentType, draft.paymentCard].filter(Boolean).join(" - ");
}

function usableReceiptDraftLines(draft = fileReceiptDraft) {
  return (Array.isArray(draft.lines) ? draft.lines : [])
    .filter((line) => line.use !== false)
    .filter((line) => line.description || parseMoney(line.price));
}

function expenseLinesFromReceiptDraft(draft = fileReceiptDraft, receiptGroupId = makeCrmId("receiptGroup")) {
  const amount = parseMoney(draft.amount);
  const vendor = draft.vendor || "";
  const note = draft.notes || draft.fileName || "Receipt expense";
  const receiptCategory = selectedFileReceiptCategoryForDraft(draft);
  const paymentLabel = receiptPaymentLabelForDraft(draft);
  const sourceLabel = draft.aiAvailable ? "AI receipt reader" : "Receipt review";
  const receiptTax = parseMoney(draft.tax);
  const taxRate = receiptTaxRateForDraft(draft) || DEFAULT_EXPENSE_TAX_RATE;
  const lines = usableReceiptDraftLines(draft);
  if (lines.length) {
    return lines.map((line, index) => {
      const baseAmount = parseMoney(line.price);
      const finalAmount = receiptLineFinalAmountForDraft(line, draft);
      return {
        id: makeCrmId("expense"),
        receiptGroupId,
        date: draft.date || todayIso(0),
        category: line.category || receiptCategory,
        vendor,
        note: line.description || note,
        amount: finalAmount,
        baseAmount,
        tax: line.addTax ? Math.max(0, finalAmount - baseAmount) : 0,
        addTax: Boolean(line.addTax),
        taxRate,
        paymentType: paymentLabel,
        receiptFileName: draft.imageTitle || draft.fileName || "",
        receiptDataUrl: index === 0 ? (draft.imageDataUrl || "") : "",
        receiptSource: sourceLabel,
      };
    });
  }
  if (!amount && !vendor && !note && !draft.imageDataUrl) return [];
  return [{
    id: makeCrmId("expense"),
    receiptGroupId,
    date: draft.date || todayIso(0),
    category: receiptCategory,
    vendor,
    note,
    amount,
    baseAmount: amount,
    tax: receiptTax,
    addTax: false,
    taxRate,
    paymentType: paymentLabel,
    receiptFileName: draft.imageTitle || draft.fileName || "",
    receiptDataUrl: draft.imageDataUrl || "",
    receiptSource: sourceLabel,
  }];
}

function receiptDraftTotal(draft = fileReceiptDraft) {
  const lines = usableReceiptDraftLines(draft);
  const lineTotal = lines.reduce((sum, line) => sum + receiptLineFinalAmountForDraft(line, draft), 0);
  return lineTotal || parseMoney(draft.amount);
}

function captureFileReceiptLineRows() {
  const existingLines = Array.isArray(fileReceiptDraft.lines) ? fileReceiptDraft.lines : [];
  const nextLines = [];
  document.querySelectorAll("[data-file-receipt-line]").forEach((row) => {
    const id = row.dataset.fileReceiptLine;
    const original = existingLines.find((line) => line.id === id) || {};
    nextLines.push({
      ...original,
      id,
      use: Boolean(row.querySelector("[data-file-receipt-line-field='use']")?.checked),
      description: row.querySelector("[data-file-receipt-line-field='description']")?.value.trim() || "",
      category: row.querySelector("[data-file-receipt-line-field='category']")?.value || "Supplies",
      price: row.querySelector("[data-file-receipt-line-field='price']")?.value || "",
      addTax: Boolean(row.querySelector("[data-file-receipt-line-field='addTax']")?.checked),
    });
  });
  fileReceiptDraft.lines = nextLines;
}

function renderFileReceiptLineRows() {
  const rows = $("crmFileReceiptLineRows");
  const total = $("crmFileReceiptLinesTotal");
  if (!rows || !total) return;
  const lines = Array.isArray(fileReceiptDraft.lines) && fileReceiptDraft.lines.length
    ? fileReceiptDraft.lines
    : [blankFileReceiptLine({
      description: fileReceiptDraft.notes || fileReceiptDraft.fileName || "Receipt expense",
      category: fileReceiptDraft.category || "Supplies",
      price: fileReceiptDraft.amount || "",
    })];
  fileReceiptDraft.lines = lines;
  rows.innerHTML = lines.map((line) => `
    <tr data-file-receipt-line="${escapeHtml(line.id)}">
      <td><input type="checkbox" data-file-receipt-line-field="use" ${line.use !== false ? "checked" : ""} aria-label="Use this expense line"></td>
      <td><input type="text" data-file-receipt-line-field="description" value="${escapeHtml(line.description || "")}" placeholder="Item or material"></td>
      <td>
        <select data-file-receipt-line-field="category">
          <option${line.category === "Supplies" ? " selected" : ""}>Supplies</option>
          <option${line.category === "Materials" ? " selected" : ""}>Materials</option>
          <option${line.category === "Hardware" ? " selected" : ""}>Hardware</option>
          <option${line.category === "Paint / Finish" ? " selected" : ""}>Paint / Finish</option>
          <option${line.category === "Equipment" ? " selected" : ""}>Equipment</option>
          <option${line.category === "Labor" ? " selected" : ""}>Labor</option>
          <option${line.category === "Fuel" ? " selected" : ""}>Fuel</option>
          <option${line.category === "Other" ? " selected" : ""}>Other</option>
        </select>
      </td>
      <td><input type="text" inputmode="decimal" data-file-receipt-line-field="price" value="${escapeHtml(line.price ? String(line.price) : "")}" placeholder="0.00"></td>
      <td class="crm-receipt-tax-cell"><input type="checkbox" data-file-receipt-line-field="addTax" ${line.addTax ? "checked" : ""} aria-label="Add tax to this line"></td>
      <td><strong>${crmCurrency.format(line.use === false ? 0 : receiptLineFinalAmount(line))}</strong></td>
      <td><button type="button" data-file-receipt-line-delete="${escapeHtml(line.id)}">Delete</button></td>
    </tr>
  `).join("");
  total.textContent = crmCurrency.format(receiptReviewLinesTotal());
  document.querySelectorAll("[data-file-receipt-line-field]").forEach((field) => {
    field.addEventListener("input", () => {
      captureFileReceiptLineRows();
      if ($("crmFileReceiptLinesTotal")) {
        $("crmFileReceiptLinesTotal").textContent = crmCurrency.format(receiptReviewLinesTotal());
      }
    });
    field.addEventListener("change", () => {
      captureFileReceiptLineRows();
      renderFileReceiptLineRows();
    });
  });
  document.querySelectorAll("[data-file-receipt-line-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      captureFileReceiptLineRows();
      fileReceiptDraft.lines = fileReceiptDraft.lines.filter((line) => line.id !== button.dataset.fileReceiptLineDelete);
      if (!fileReceiptDraft.lines.length) fileReceiptDraft.lines.push(blankFileReceiptLine());
      renderFileReceiptLineRows();
    });
  });
}

function addFileReceiptExpenseLine() {
  captureFileReceiptReviewFields();
  fileReceiptDraft.lines = Array.isArray(fileReceiptDraft.lines) ? fileReceiptDraft.lines : [];
  fileReceiptDraft.lines.push(blankFileReceiptLine({ category: fileReceiptDraft.category || "Supplies" }));
  renderFileReceiptLineRows();
}

async function readFileReceiptWithAi(imageDataUrl, uploadFile) {
  const response = await fetch(CLOUDFLARE_RECEIPT_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      imageDataUrl,
      fileName: uploadFile?.name || "",
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok === false) {
    throw new Error(result.error || `Receipt reader failed with status ${response.status}.`);
  }
  return result;
}

function setFileReceiptStatus(message, kind = "") {
  const status = $("crmFileReceiptStatus");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("crm-receipt-status-good", kind === "good");
  status.classList.toggle("crm-receipt-status-warn", kind === "warn");
}

function toggleFileReceiptConditionalFields() {
  const paymentType = $("crmFileReceiptPayment")?.value || "";
  const category = $("crmFileReceiptCategory")?.value || "";
  if ($("crmFileReceiptCardWrap")) $("crmFileReceiptCardWrap").hidden = paymentType !== "Credit";
  if ($("crmFileReceiptOtherCategoryWrap")) $("crmFileReceiptOtherCategoryWrap").hidden = category !== "Other";
  if (paymentType !== "Credit" && $("crmFileReceiptCard")) $("crmFileReceiptCard").value = "";
  if (category !== "Other" && $("crmFileReceiptOtherCategory")) $("crmFileReceiptOtherCategory").value = "";
}

function captureFileReceiptReviewFields() {
  if (!$("crmFileReceiptReview") || $("crmFileReceiptReview").hidden) return;
  fileReceiptDraft.vendor = $("crmFileReceiptVendor").value.trim();
  fileReceiptDraft.date = $("crmFileReceiptDate").value || "";
  fileReceiptDraft.category = $("crmFileReceiptCategory").value || "Supplies";
  fileReceiptDraft.customCategory = $("crmFileReceiptOtherCategory").value.trim();
  fileReceiptDraft.amount = $("crmFileReceiptAmount").value;
  fileReceiptDraft.paymentType = $("crmFileReceiptPayment").value;
  fileReceiptDraft.paymentCard = $("crmFileReceiptCard").value;
  fileReceiptDraft.imageTitle = $("crmFileReceiptImageTitle").value.trim();
  fileReceiptDraft.notes = $("crmFileReceiptNotes").value.trim();
  fileReceiptDraft.pastedText = $("crmFileReceiptOcrText").value.trim();
  captureFileReceiptLineRows();
}

function renderFileReceiptDraft() {
  const preview = $("crmReceiptPreview");
  const review = $("crmFileReceiptReview");
  if (!preview || !review) return;
  const hasDraftLines = Array.isArray(fileReceiptDraft.lines) && fileReceiptDraft.lines.length > 0;
  if (!fileReceiptDraft.imageDataUrl && !fileReceiptDraft.vendor && !fileReceiptDraft.amount && !hasDraftLines) {
    preview.innerHTML = `<p class="crm-empty-state">No receipt photo attached yet.</p>`;
    review.hidden = true;
    return;
  }
  preview.innerHTML = fileReceiptDraft.imageDataUrl
    ? `<img src="${escapeHtml(fileReceiptDraft.imageDataUrl)}" alt="Receipt preview"><p>${escapeHtml(fileReceiptDraft.imageTitle || fileReceiptDraft.fileName || "Receipt photo")}</p>`
    : `<p class="crm-empty-state">No receipt photo attached yet.</p>`;
  review.hidden = false;
  $("crmFileReceiptVendor").value = fileReceiptDraft.vendor || "";
  $("crmFileReceiptDate").value = fileReceiptDraft.date || "";
  $("crmFileReceiptCategory").value = fileReceiptDraft.category || "Supplies";
  $("crmFileReceiptOtherCategory").value = fileReceiptDraft.customCategory || "";
  $("crmFileReceiptAmount").value = fileReceiptDraft.amount ? String(fileReceiptDraft.amount) : "";
  $("crmFileReceiptPayment").value = fileReceiptDraft.paymentType || "";
  $("crmFileReceiptCard").value = fileReceiptDraft.paymentCard || "";
  $("crmFileReceiptImageTitle").value = fileReceiptDraft.imageTitle || fileReceiptDraft.fileName || "";
  $("crmFileReceiptNotes").value = fileReceiptDraft.notes || "";
  $("crmFileReceiptOcrText").value = fileReceiptDraft.pastedText || "";
  toggleFileReceiptConditionalFields();
  renderFileReceiptLineRows();
  setFileReceiptStatus(fileReceiptDraft.status || "Review the receipt before saving.", fileReceiptDraft.aiAvailable ? "good" : "warn");
}

function receiptHistoryEntryFromLines(groupId, lines = [], existing = {}) {
  const groupLines = Array.isArray(lines) ? lines.map((line) => ({ ...line })) : [];
  const firstLine = groupLines.find((line) => line.receiptDataUrl) || groupLines[0] || {};
  const total = groupLines.reduce((sum, line) => sum + receiptExpenseLineAmount(line), 0);
  return {
    ...existing,
    id: groupId,
    savedAt: existing.savedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    label: firstLine.receiptFileName || firstLine.vendor || firstLine.note || existing.label || "Saved receipt",
    date: firstLine.date || existing.date || todayIso(0),
    vendor: firstLine.vendor || existing.vendor || "",
    category: firstLine.category || existing.category || "",
    paymentType: firstLine.paymentType || existing.paymentType || "",
    total,
    lineCount: groupLines.length,
    lines: groupLines,
  };
}

function upsertReceiptHistoryGroup(file, groupId, lines = []) {
  if (!file || !groupId) return;
  file.receiptHistory = Array.isArray(file.receiptHistory) ? file.receiptHistory : [];
  const index = file.receiptHistory.findIndex((entry) => entry.id === groupId);
  const existing = index >= 0 ? file.receiptHistory[index] : {};
  const nextEntry = receiptHistoryEntryFromLines(groupId, lines, existing);
  if (index >= 0) file.receiptHistory[index] = nextEntry;
  else file.receiptHistory.unshift(nextEntry);
}

function refreshReceiptHistoryGroup(file, groupId) {
  if (!file || !groupId) return;
  const lines = (Array.isArray(file.expenseLines) ? file.expenseLines : []).filter((line) => (line.receiptGroupId || line.id) === groupId);
  if (lines.length) {
    upsertReceiptHistoryGroup(file, groupId, lines);
  } else if (Array.isArray(file.receiptHistory)) {
    file.receiptHistory = file.receiptHistory.filter((entry) => entry.id !== groupId);
  }
}

function syncReceiptHistoryFromExpenseLines(file) {
  if (!file) return;
  file.receiptHistory = Array.isArray(file.receiptHistory) ? file.receiptHistory : [];
  const groupedReceipts = new Map();
  (Array.isArray(file.expenseLines) ? file.expenseLines : []).forEach((line) => {
    const groupId = line.receiptGroupId || line.id;
    if (!groupId) return;
    if (!groupedReceipts.has(groupId)) groupedReceipts.set(groupId, []);
    groupedReceipts.get(groupId).push(line);
  });
  groupedReceipts.forEach((lines, groupId) => upsertReceiptHistoryGroup(file, groupId, lines));
}

function restoreExpenseLinesFromReceiptHistory(file) {
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
        id: line.id || makeCrmId("expense"),
        receiptGroupId: line.receiptGroupId || groupId,
      });
    });
    existingGroups.add(groupId);
  });
}

function receiptHistoryGroupsForFile(file) {
  if (!file) return [];
  restoreExpenseLinesFromReceiptHistory(file);
  syncReceiptHistoryFromExpenseLines(file);
  return (Array.isArray(file.receiptHistory) ? file.receiptHistory : [])
    .filter((entry) => entry && entry.id)
    .sort((a, b) => String(b.updatedAt || b.savedAt || "").localeCompare(String(a.updatedAt || a.savedAt || "")));
}

function renderReceiptHistory(file) {
  const list = $("crmReceiptHistoryList");
  if (!list) return;
  if (!file) {
    list.innerHTML = `<p class="crm-empty-state">Select a file to see saved receipts and expenses.</p>`;
    return;
  }
  const receiptGroups = receiptHistoryGroupsForFile(file);
  if (!receiptGroups.length) {
    list.innerHTML = `<p class="crm-empty-state">No saved receipts or expenses yet.</p>`;
    return;
  }
  list.innerHTML = receiptGroups.map((entry) => {
    const groupId = entry.id;
    const meta = [
      entry.date || todayIso(0),
      entry.vendor || "",
      Number(entry.lineCount) > 1 ? `${entry.lineCount} lines` : (entry.category || ""),
      entry.paymentType || "",
    ].filter(Boolean).join(" · ");
    return `
      <button type="button" class="crm-receipt-history-item" data-file-receipt-group-open="${escapeHtml(groupId)}">
        <span>
          <strong>${escapeHtml(entry.label || "Saved receipt")}</strong>
          <small>${escapeHtml(meta || "Saved expense")}</small>
        </span>
        <b>${crmCurrency.format(Number(entry.total) || 0)}</b>
      </button>
    `;
  }).join("");
  document.querySelectorAll("[data-file-receipt-group-open]").forEach((button) => {
    button.addEventListener("click", () => openSavedExpenseGroupInReceiptEditor(button.dataset.fileReceiptGroupOpen));
  });
}

function renderBulkReceiptReview() {
  const panel = $("crmBulkReceiptPanel");
  const list = $("crmBulkReceiptList");
  const count = $("crmBulkReceiptCount");
  if (!panel || !list || !count) return;
  const drafts = Array.isArray(bulkReceiptDrafts) ? bulkReceiptDrafts : [];
  panel.hidden = drafts.length === 0;
  count.textContent = String(drafts.length);
  list.innerHTML = drafts.map((draft) => {
    const total = receiptDraftTotal(draft);
    const meta = [
      draft.date || "No date",
      draft.vendor || "No vendor",
      usableReceiptDraftLines(draft).length ? `${usableReceiptDraftLines(draft).length} lines` : "No lines",
    ].join(" · ");
    return `
      <article class="crm-bulk-receipt-card" data-bulk-receipt-id="${escapeHtml(draft.batchId)}">
        <div class="crm-bulk-receipt-thumb">
          ${draft.imageDataUrl ? `<img src="${escapeHtml(draft.imageDataUrl)}" alt="Receipt preview">` : ""}
        </div>
        <div>
          <strong>${escapeHtml(draft.imageTitle || draft.fileName || "Receipt")}</strong>
          <small>${escapeHtml(meta)}</small>
          <em>${escapeHtml(draft.status || "Waiting to read receipt.")}</em>
        </div>
        <b>${crmCurrency.format(total)}</b>
        <button type="button" data-bulk-receipt-review="${escapeHtml(draft.batchId)}">Review</button>
        <button type="button" data-bulk-receipt-remove="${escapeHtml(draft.batchId)}">Remove</button>
      </article>
    `;
  }).join("");
  document.querySelectorAll("[data-bulk-receipt-review]").forEach((button) => {
    button.addEventListener("click", () => {
      const draft = bulkReceiptDrafts.find((entry) => entry.batchId === button.dataset.bulkReceiptReview);
      if (!draft) return;
      fileReceiptDraft = { ...blankFileReceiptDraft(), ...draft, editingExpenseId: "", editingReceiptGroupId: "" };
      renderFileReceiptDraft();
      $("crmFileReceiptReview")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
  document.querySelectorAll("[data-bulk-receipt-remove]").forEach((button) => {
    button.addEventListener("click", () => {
      bulkReceiptDrafts = bulkReceiptDrafts.filter((entry) => entry.batchId !== button.dataset.bulkReceiptRemove);
      renderBulkReceiptReview();
    });
  });
}

function renderFileExpensesFresh() {
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
    rows.innerHTML = `<tr><td colspan="9">No file selected.</td></tr>`;
    fileReceiptDraft = blankFileReceiptDraft();
    bulkReceiptDrafts = [];
    renderFileReceiptDraft();
    renderReceiptHistory(null);
    renderBulkReceiptReview();
    return;
  }
  title.textContent = `${file.fileNumber || "Project"} · ${file.clientName || "Unnamed Client"}`;
  heading.textContent = file.clientName || "Unnamed Client";
  total.textContent = crmCurrency.format(fileExpenseTotal(file));
  rows.innerHTML = (file.expenseLines || []).map((line) => {
    const baseAmount = expenseLineBaseAmount(line);
    const taxAmount = expenseLineTaxAmount(line);
    const totalAmount = receiptExpenseLineAmount(line);
    const notePreview = line.note ? line.note.split(/\s+/).slice(0, 5).join(" ") : "Add details";
    return `
    <tr>
      <td><input class="crm-revenue-input" type="date" value="${escapeHtml(line.date || todayIso(0))}" data-file-expense-field="date" data-file-expense-id="${escapeHtml(line.id)}"></td>
      <td>
        <select class="crm-revenue-input" data-file-expense-field="category" data-file-expense-id="${escapeHtml(line.id)}">
          <option${line.category === "Supplies" ? " selected" : ""}>Supplies</option>
          <option${line.category === "Materials" ? " selected" : ""}>Materials</option>
          <option${line.category === "Hardware" ? " selected" : ""}>Hardware</option>
          <option${line.category === "Paint / Finish" ? " selected" : ""}>Paint / Finish</option>
          <option${line.category === "Equipment" ? " selected" : ""}>Equipment</option>
          <option${line.category === "Labor" ? " selected" : ""}>Labor</option>
          <option${line.category === "Fuel" ? " selected" : ""}>Fuel</option>
          <option${line.category === "Other" ? " selected" : ""}>Other</option>
        </select>
      </td>
      <td><input class="crm-revenue-input" type="text" value="${escapeHtml(line.vendor || "")}" data-file-expense-field="vendor" data-file-expense-id="${escapeHtml(line.id)}" placeholder="Store"></td>
      <td>
        <button type="button" class="crm-expense-note-button" data-file-expense-note="${escapeHtml(line.id)}">
          <span>${escapeHtml(notePreview)}</span>
        </button>
      </td>
      <td><input class="crm-revenue-input crm-money-input" type="text" inputmode="decimal" value="${escapeHtml(baseAmount || "")}" data-file-expense-field="baseAmount" data-file-expense-id="${escapeHtml(line.id)}" placeholder="0.00"></td>
      <td class="crm-expense-tax-toggle">
        <input type="checkbox" data-file-expense-field="addTax" data-file-expense-id="${escapeHtml(line.id)}" ${line.addTax ? "checked" : ""} aria-label="Add tax to this expense">
        <small>${taxAmount ? crmCurrency.format(taxAmount) : ""}</small>
      </td>
      <td><strong>${crmCurrency.format(totalAmount)}</strong></td>
      <td><button type="button" data-fresh-expense-open="${escapeHtml(line.receiptGroupId || line.id)}">${line.receiptDataUrl ? "Open" : "Edit"}</button></td>
      <td><button type="button" data-fresh-expense-delete="${escapeHtml(line.receiptGroupId || line.id)}">Delete</button></td>
    </tr>
  `;
  }).join("") || `<tr><td colspan="9">No expenses added yet.</td></tr>`;

  renderFileReceiptDraft();
  renderReceiptHistory(file);
  renderBulkReceiptReview();

  document.querySelectorAll("[data-file-expense-field]").forEach((field) => {
    field.addEventListener("change", () => updateFileExpenseField(field));
  });
  document.querySelectorAll("[data-file-expense-note]").forEach((button) => {
    button.addEventListener("click", () => openExpenseNoteModal(button.dataset.fileExpenseNote));
  });
  document.querySelectorAll("[data-fresh-expense-open]").forEach((button) => {
    button.addEventListener("click", () => freshExpenseOpenReceipt(button.dataset.freshExpenseOpen));
  });
  document.querySelectorAll("[data-fresh-expense-delete]").forEach((button) => {
    button.addEventListener("click", () => freshExpenseDeleteReceipt(button.dataset.freshExpenseDelete));
  });
}

function openSavedExpenseInReceiptEditor(lineId) {
  const file = normalizeCrmFile(activeFile());
  const line = file?.expenseLines?.find((entry) => entry.id === lineId);
  if (!line) return;
  openSavedExpenseGroupInReceiptEditor(line.receiptGroupId || line.id);
}

function openSavedExpenseGroupInReceiptEditor(groupId) {
  const file = normalizeCrmFile(activeFile());
  const historyEntry = (file?.receiptHistory || []).find((entry) => entry.id === groupId);
  const groupLines = (file?.expenseLines || []).filter((entry) => (entry.receiptGroupId || entry.id) === groupId);
  const sourceLines = groupLines.length ? groupLines : (Array.isArray(historyEntry?.lines) ? historyEntry.lines : []);
  const line = sourceLines.find((entry) => entry.receiptDataUrl) || sourceLines[0];
  if (!line) return;
  const paymentParts = String(line.paymentType || "").split(" - ");
  fileReceiptDraft = {
    ...blankFileReceiptDraft(),
    imageDataUrl: line.receiptDataUrl || "",
    fileName: line.receiptFileName || "",
    imageTitle: line.receiptFileName || "",
    vendor: line.vendor || "",
    date: line.date || "",
    category: ["Supplies", "Materials", "Fuel", "Equipment"].includes(line.category) ? line.category : (line.category ? "Other" : "Supplies"),
    customCategory: ["Supplies", "Materials", "Fuel", "Equipment"].includes(line.category) ? "" : (line.category || ""),
    amount: line.baseAmount || line.amount || "",
    tax: line.tax || "",
    paymentType: paymentParts[0] || "",
    paymentCard: paymentParts[1] || "",
    notes: line.note || "",
    lines: sourceLines.map((entry) => blankFileReceiptLine({
      id: makeCrmId("receiptExpense"),
      description: entry.note || "",
      category: ["Supplies", "Materials", "Fuel", "Equipment", "Hardware", "Paint / Finish", "Labor", "Other"].includes(entry.category) ? entry.category : "Other",
      price: entry.baseAmount || entry.amount || "",
      addTax: Boolean(entry.addTax),
    })),
    isEditingSavedReceipt: true,
    editingExpenseId: line.id,
    editingReceiptGroupId: groupId,
    status: "Editing a saved receipt. Save Expense will update this receipt group.",
    aiAvailable: false,
  };
  renderFileReceiptDraft();
  $("crmFileReceiptReview")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function addFileExpenseLine() {
  const file = normalizeCrmFile(activeFile());
  if (!file) {
    window.alert("Select a customer file before adding an expense.");
    return;
  }
  file.expenseLines.push({
    id: makeCrmId("expense"),
    receiptGroupId: makeCrmId("manualExpense"),
    date: todayIso(0),
    category: "Supplies",
    vendor: "",
    note: "",
    baseAmount: "",
    amount: "",
    tax: "",
    addTax: false,
    taxRate: DEFAULT_EXPENSE_TAX_RATE,
    paymentType: "",
    receiptFileName: "",
    receiptDataUrl: "",
  });
  upsertReceiptHistoryGroup(file, file.expenseLines[file.expenseLines.length - 1].receiptGroupId, [file.expenseLines[file.expenseLines.length - 1]]);
  addSystemNote(file, "Expense line added.");
  syncFileExpensesToRevenue(file);
  saveCrmFiles();
  renderFileExpenses();
  saveExpenseChangeToCloud("Expense line saved to Cloudflare.");
}

function updateFileExpenseField(field) {
  const file = normalizeCrmFile(activeFile());
  if (!file) return;
  const line = file.expenseLines.find((entry) => entry.id === field.dataset.fileExpenseId);
  if (!line) return;
  const key = field.dataset.fileExpenseField;
  if (key === "addTax") {
    line.addTax = Boolean(field.checked);
  } else if (key === "baseAmount" || key === "amount") {
    line.baseAmount = parseMoney(field.value);
  } else {
    line[key] = field.value;
  }
  line.taxRate = line.taxRate || DEFAULT_EXPENSE_TAX_RATE;
  line.tax = line.addTax ? expenseLineTaxAmount(line) : 0;
  line.amount = receiptExpenseLineAmount(line);
  refreshReceiptHistoryGroup(file, line.receiptGroupId || line.id);
  syncFileExpensesToRevenue(file);
  saveCrmFiles();
  renderFileExpenses();
}

function openExpenseNoteModal(lineId) {
  const file = normalizeCrmFile(activeFile());
  const line = file?.expenseLines?.find((entry) => entry.id === lineId);
  if (!line) return;
  editingExpenseNoteLineId = lineId;
  $("crmExpenseNoteTitle").textContent = `${line.vendor || file.clientName || "Expense"} Notes`;
  $("crmExpenseNoteText").value = line.note || "";
  $("crmExpenseNoteModal").hidden = false;
  $("crmExpenseNoteText").focus();
}

function closeExpenseNoteModal() {
  editingExpenseNoteLineId = "";
  $("crmExpenseNoteModal").hidden = true;
}

function saveExpenseNoteModal() {
  const file = normalizeCrmFile(activeFile());
  const line = file?.expenseLines?.find((entry) => entry.id === editingExpenseNoteLineId);
  if (!line) return closeExpenseNoteModal();
  line.note = $("crmExpenseNoteText").value.trim();
  const manualExpense = Array.isArray(file.animusManualExpenses)
    ? file.animusManualExpenses.find((expense) => expense.id === editingExpenseNoteLineId)
    : null;
  if (manualExpense) {
    manualExpense.notes = line.note;
    manualExpense.updatedAt = new Date().toISOString();
  }
  refreshReceiptHistoryGroup(file, line.receiptGroupId || line.id);
  syncFileExpensesToRevenue(file);
  saveCrmFiles();
  closeExpenseNoteModal();
  renderManualExpenses();
  renderFileExpenses();
}

function deleteFileExpenseLine(lineId) {
  const file = normalizeCrmFile(activeFile());
  if (!file) return;
  const line = file.expenseLines.find((entry) => entry.id === lineId);
  const groupId = line?.receiptGroupId || line?.id || lineId;
  file.expenseLines = file.expenseLines.filter((line) => line.id !== lineId);
  refreshReceiptHistoryGroup(file, groupId);
  addSystemNote(file, "Expense line deleted.");
  syncFileExpensesToRevenue(file);
  saveCrmFiles();
  renderFileExpenses();
  saveExpenseChangeToCloud("Expense deleted and saved to Cloudflare.");
}

function readUploadFileAsDataUrl(uploadFile) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(new Error("Receipt image could not be opened.")));
    reader.readAsDataURL(uploadFile);
  });
}

async function attachReceiptToFileExpense(uploadFile) {
  const file = normalizeCrmFile(activeFile());
  if (!file || !uploadFile) return;
  showReceiptLoading("Uploading receipt photo and reading it with AI...");
  const freshDraft = {
    ...blankFileReceiptDraft(),
    fileName: uploadFile.name || "",
    imageTitle: uploadFile.name || "",
  };
  fileReceiptDraft = {
    ...freshDraft,
    status: "Reading receipt photo...",
  };
  try {
    const imageDataUrl = await readUploadFileAsDataUrl(uploadFile);
    fileReceiptDraft = {
      ...freshDraft,
      imageDataUrl,
      status: "Reading receipt photo...",
    };
    renderFileReceiptDraft();
    const result = await readFileReceiptWithAi(imageDataUrl, uploadFile);
    fileReceiptDraft = receiptResultToDraft(result, {
      ...fileReceiptDraft,
      imageDataUrl,
      fileName: uploadFile.name || "",
    });
  } catch (error) {
    fileReceiptDraft = {
      ...freshDraft,
      imageDataUrl: fileReceiptDraft.imageDataUrl || "",
      status: error.message || "Receipt photo attached. AI reading is not connected yet, so review or paste receipt text before saving.",
      aiAvailable: false,
    };
  } finally {
    hideReceiptLoading();
  }
  renderFileReceiptDraft();
}

async function attachReceiptBatchToFileExpense(uploadFiles = []) {
  const file = normalizeCrmFile(activeFile());
  const files = [...uploadFiles].filter(Boolean);
  if (!file || !files.length) return;
  if (files.length === 1) {
    attachReceiptToFileExpense(files[0]);
    return;
  }
  showReceiptLoading(`Uploading and reading ${files.length} receipt photos...`);
  bulkReceiptDrafts = files.map((uploadFile) => ({
    ...blankFileReceiptDraft(),
    batchId: makeCrmId("receiptBatch"),
    fileName: uploadFile.name || "",
    imageTitle: uploadFile.name || "",
    status: "Waiting to read receipt...",
  }));
  renderBulkReceiptReview();
  try {
    await Promise.all(files.map(async (uploadFile, index) => {
      const batchId = bulkReceiptDrafts[index]?.batchId;
      try {
        const imageDataUrl = await readUploadFileAsDataUrl(uploadFile);
        bulkReceiptDrafts = bulkReceiptDrafts.map((draft) => draft.batchId === batchId
          ? { ...draft, imageDataUrl, status: "Reading receipt photo..." }
          : draft);
        renderBulkReceiptReview();
        const result = await readFileReceiptWithAi(imageDataUrl, uploadFile);
        const parsedDraft = receiptResultToDraft(result, {
          ...blankFileReceiptDraft(),
          batchId,
          imageDataUrl,
          fileName: uploadFile.name || "",
          imageTitle: uploadFile.name || "",
        });
        bulkReceiptDrafts = bulkReceiptDrafts.map((draft) => draft.batchId === batchId ? { ...parsedDraft, batchId } : draft);
      } catch (error) {
        bulkReceiptDrafts = bulkReceiptDrafts.map((draft) => draft.batchId === batchId
          ? {
            ...draft,
            status: error.message || "Receipt attached. Review or paste receipt text before saving.",
            aiAvailable: false,
          }
          : draft);
      }
      renderBulkReceiptReview();
    }));
  } finally {
    hideReceiptLoading();
  }
}

function clearBulkReceiptDrafts() {
  bulkReceiptDrafts = [];
  renderBulkReceiptReview();
}

function saveBulkReceiptsToFile() {
  const file = normalizeCrmFile(activeFile());
  if (!file) {
    window.alert("Select a customer file before saving receipts.");
    return;
  }
  const savedLines = [];
  bulkReceiptDrafts.forEach((draft) => {
    const groupId = makeCrmId("receiptGroup");
    const receiptLines = expenseLinesFromReceiptDraft(draft, groupId);
    savedLines.push(...receiptLines);
    upsertReceiptHistoryGroup(file, groupId, receiptLines);
  });
  if (!savedLines.length) {
    window.alert("No receipt details were ready to save.");
    return;
  }
  file.expenseLines.push(...savedLines);
  addSystemNote(file, `${bulkReceiptDrafts.length} receipt${bulkReceiptDrafts.length === 1 ? "" : "s"} saved to expenses.`);
  syncFileExpensesToRevenue(file);
  saveCrmFiles();
  bulkReceiptDrafts = [];
  renderFileExpenses();
  setFileReceiptStatus("Receipt batch saved to this file.", "good");
  saveExpenseChangeToCloud("Receipt batch saved to Cloudflare.");
}

function readPastedReceiptTextForFile() {
  captureFileReceiptReviewFields();
  if (!fileReceiptDraft.pastedText) {
    setFileReceiptStatus("Paste receipt text first, then click Read Text.", "warn");
    return;
  }
  const parsed = parseReceiptText(fileReceiptDraft.pastedText, fileReceiptDraft);
  fileReceiptDraft = {
    ...fileReceiptDraft,
    ...parsed,
    pastedText: fileReceiptDraft.pastedText,
    status: "Receipt text read. Review the fields, then save the expense.",
    aiAvailable: false,
  };
  renderFileReceiptDraft();
}

function clearFileReceiptDraft() {
  fileReceiptDraft = blankFileReceiptDraft();
  renderFileReceiptDraft();
}

function saveScannedReceiptToFile() {
  const file = normalizeCrmFile(activeFile());
  if (!file) {
    window.alert("Select a customer file before saving a receipt.");
    return;
  }
  captureFileReceiptReviewFields();
  const vendor = fileReceiptDraft.vendor || "";
  const receiptTotal = receiptDraftTotal(fileReceiptDraft);
  const isEditingSavedReceipt = Boolean(fileReceiptDraft.isEditingSavedReceipt && (fileReceiptDraft.editingReceiptGroupId || fileReceiptDraft.editingExpenseId));
  const receiptGroupId = isEditingSavedReceipt ? (fileReceiptDraft.editingReceiptGroupId || fileReceiptDraft.editingExpenseId) : makeCrmId("receiptGroup");
  const receiptLines = expenseLinesFromReceiptDraft(fileReceiptDraft, receiptGroupId);
  if (!receiptLines.length) {
    setFileReceiptStatus("Add receipt details before saving.", "warn");
    return;
  }
  if (isEditingSavedReceipt) {
    const targetGroupId = fileReceiptDraft.editingReceiptGroupId || fileReceiptDraft.editingExpenseId;
    file.expenseLines = file.expenseLines.filter((line) => (line.receiptGroupId || line.id) !== targetGroupId);
    file.expenseLines.push(...receiptLines);
  } else {
    file.expenseLines.push(...receiptLines);
  }
  upsertReceiptHistoryGroup(file, receiptGroupId, receiptLines);
  addSystemNote(file, `Receipt expense ${isEditingSavedReceipt ? "updated" : "saved"}${vendor ? ` from ${vendor}` : ""} for ${crmCurrency.format(receiptTotal)}.`);
  syncFileExpensesToRevenue(file);
  saveCrmFiles();
  fileReceiptDraft = blankFileReceiptDraft();
  renderFileExpenses();
  setFileReceiptStatus("Receipt saved to this file.", "good");
  saveExpenseChangeToCloud("Receipt saved to Cloudflare.");
}

function freshExpenseBaseCategory(category = "Supplies", customCategory = "") {
  if (category === "Other") return customCategory || "Other";
  return category || "Supplies";
}

function freshExpenseLineTotal(line = {}) {
  if (line.use === false) return 0;
  const price = parseMoney(line.price);
  return line.addTax ? price + (price * (Number(line.taxRate) || DEFAULT_EXPENSE_TAX_RATE)) : price;
}

function freshExpenseReceiptTotal(receipt = {}) {
  return (Array.isArray(receipt.lines) ? receipt.lines : [])
    .reduce((sum, line) => sum + freshExpenseLineTotal(line), 0);
}

function cleanFreshExpenseReceiptLine(line = {}) {
  return {
    id: line.id || makeCrmId("expense-line"),
    use: line.use !== false,
    description: line.description || line.note || "",
    category: line.category || "Supplies",
    price: line.price === undefined ? (line.baseAmount || line.amount || "") : line.price,
    addTax: line.addTax !== false,
    taxRate: Number(line.taxRate) || DEFAULT_EXPENSE_TAX_RATE,
  };
}

function cleanFreshExpenseReceipt(receipt = {}) {
  return {
    id: receipt.id || makeCrmId("fresh-receipt"),
    createdAt: receipt.createdAt || new Date().toISOString(),
    updatedAt: receipt.updatedAt || receipt.createdAt || new Date().toISOString(),
    date: receipt.date || todayIso(0),
    vendor: receipt.vendor || "",
    category: receipt.category || "Supplies",
    customCategory: receipt.customCategory || "",
    receiptTotal: receipt.receiptTotal === undefined ? "" : receipt.receiptTotal,
    paymentType: receipt.paymentType || "",
    paymentCard: receipt.paymentCard || "",
    imageTitle: receipt.imageTitle || receipt.receiptFileName || receipt.fileName || "",
    fileName: receipt.fileName || receipt.receiptFileName || "",
    imageDataUrl: receipt.imageDataUrl || receipt.receiptDataUrl || "",
    notes: receipt.notes || "",
    pastedText: receipt.pastedText || "",
    lines: (Array.isArray(receipt.lines) ? receipt.lines : []).map(cleanFreshExpenseReceiptLine),
  };
}

function freshExpenseReceiptsForFile(file) {
  if (!file) return [];
  file.freshExpenseReceipts = Array.isArray(file.freshExpenseReceipts)
    ? file.freshExpenseReceipts.map(cleanFreshExpenseReceipt)
    : [];
  return file.freshExpenseReceipts;
}

function rebuildFreshFileExpenses(file) {
  if (!file) return;
  const receipts = freshExpenseReceiptsForFile(file);
  file.expenseLines = receipts.flatMap((receipt) => {
    return (receipt.lines || [])
      .filter((line) => line.use !== false)
      .map((line, index) => {
        const baseAmount = parseMoney(line.price);
        const taxRate = Number(line.taxRate) || DEFAULT_EXPENSE_TAX_RATE;
        const tax = line.addTax ? baseAmount * taxRate : 0;
        return {
          id: line.id || makeCrmId("expense"),
          receiptGroupId: receipt.id,
          date: receipt.date || todayIso(0),
          category: line.category || freshExpenseBaseCategory(receipt.category, receipt.customCategory),
          vendor: receipt.vendor || "",
          note: line.description || receipt.notes || receipt.imageTitle || "Receipt expense",
          baseAmount,
          amount: baseAmount + tax,
          tax,
          addTax: Boolean(line.addTax),
          taxRate,
          paymentType: [receipt.paymentType, receipt.paymentCard].filter(Boolean).join(" - "),
          receiptFileName: receipt.imageTitle || receipt.fileName || "",
          receiptDataUrl: index === 0 ? (receipt.imageDataUrl || "") : "",
          receiptSource: "Saved receipt",
        };
      });
  });
  file.expenseReceipts = receipts.map((receipt) => ({ ...receipt, lines: receipt.lines.map((line) => ({ ...line })) }));
  file.receiptHistory = receipts.map((receipt) => receiptHistoryEntryFromLines(receipt.id, file.expenseLines.filter((line) => line.receiptGroupId === receipt.id), {
    savedAt: receipt.createdAt,
    updatedAt: receipt.updatedAt,
    label: receipt.imageTitle || receipt.vendor || receipt.notes || "Saved receipt",
    date: receipt.date,
    vendor: receipt.vendor,
    category: freshExpenseBaseCategory(receipt.category, receipt.customCategory),
    paymentType: [receipt.paymentType, receipt.paymentCard].filter(Boolean).join(" - "),
  }));
}

function freshExpenseCaptureDraft() {
  if (!$("crmFileReceiptReview") || $("crmFileReceiptReview").hidden) return;
  fileReceiptDraft.vendor = $("crmFileReceiptVendor")?.value.trim() || "";
  fileReceiptDraft.date = $("crmFileReceiptDate")?.value || "";
  fileReceiptDraft.category = $("crmFileReceiptCategory")?.value || "Supplies";
  fileReceiptDraft.customCategory = $("crmFileReceiptOtherCategory")?.value.trim() || "";
  fileReceiptDraft.amount = $("crmFileReceiptAmount")?.value || "";
  fileReceiptDraft.paymentType = $("crmFileReceiptPayment")?.value || "";
  fileReceiptDraft.paymentCard = $("crmFileReceiptCard")?.value || "";
  fileReceiptDraft.imageTitle = $("crmFileReceiptImageTitle")?.value.trim() || "";
  fileReceiptDraft.notes = $("crmFileReceiptNotes")?.value.trim() || "";
  fileReceiptDraft.pastedText = $("crmFileReceiptOcrText")?.value.trim() || "";
  captureFileReceiptLineRows();
}

function freshExpenseReceiptFromDraft(receiptId = makeCrmId("fresh-receipt")) {
  const category = freshExpenseBaseCategory(fileReceiptDraft.category, fileReceiptDraft.customCategory);
  const draftLines = usableReceiptDraftLines(fileReceiptDraft);
  const lines = draftLines.map((line) => cleanFreshExpenseReceiptLine({
    ...line,
    category: line.category || category,
    taxRate: receiptTaxRateForDraft(fileReceiptDraft) || DEFAULT_EXPENSE_TAX_RATE,
  }));
  if (!lines.length && (parseMoney(fileReceiptDraft.amount) || fileReceiptDraft.vendor || fileReceiptDraft.notes || fileReceiptDraft.imageDataUrl)) {
    lines.push(cleanFreshExpenseReceiptLine({
      description: fileReceiptDraft.notes || fileReceiptDraft.imageTitle || fileReceiptDraft.fileName || "Receipt expense",
      category,
      price: fileReceiptDraft.amount || "",
      addTax: false,
      taxRate: DEFAULT_EXPENSE_TAX_RATE,
    }));
  }
  return cleanFreshExpenseReceipt({
    id: receiptId,
    createdAt: fileReceiptDraft.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    date: fileReceiptDraft.date || todayIso(0),
    vendor: fileReceiptDraft.vendor || "",
    category: fileReceiptDraft.category || "Supplies",
    customCategory: fileReceiptDraft.customCategory || "",
    receiptTotal: fileReceiptDraft.amount || "",
    paymentType: fileReceiptDraft.paymentType || "",
    paymentCard: fileReceiptDraft.paymentCard || "",
    imageTitle: fileReceiptDraft.imageTitle || fileReceiptDraft.fileName || "",
    fileName: fileReceiptDraft.fileName || "",
    imageDataUrl: fileReceiptDraft.imageDataUrl || "",
    notes: fileReceiptDraft.notes || "",
    pastedText: fileReceiptDraft.pastedText || "",
    lines,
  });
}

function hasUnsavedFileReceiptDraft() {
  if (!fileReceiptDraft) return false;
  const hasLines = Array.isArray(fileReceiptDraft.lines) && fileReceiptDraft.lines.some((line) => {
    return line.description || line.price || line.category;
  });
  return Boolean(
    fileReceiptDraft.imageDataUrl ||
    fileReceiptDraft.fileName ||
    fileReceiptDraft.imageTitle ||
    fileReceiptDraft.vendor ||
    fileReceiptDraft.amount ||
    fileReceiptDraft.notes ||
    fileReceiptDraft.pastedText ||
    hasLines
  );
}

function freshExpenseSyncAndSave(file, message = "Expenses saved.") {
  rebuildFreshFileExpenses(file);
  syncFileExpensesToRevenue(file);
  saveCrmFiles();
  saveRevenueRows();
  renderFileExpenses();
  saveExpenseChangeToCloud(message);
}

function freshExpenseRenderReceiptHistory(file) {
  const list = $("crmReceiptHistoryList");
  if (!list) return;
  if (!file) {
    list.innerHTML = `<p class="crm-empty-state">Select a file to see saved receipts and expenses.</p>`;
    return;
  }
  const receipts = freshExpenseReceiptsForFile(file);
  if (!receipts.length) {
    list.innerHTML = `<p class="crm-empty-state">No saved receipts or expenses yet.</p>`;
    return;
  }
  list.innerHTML = receipts.map((receipt) => {
    const lineCount = (receipt.lines || []).length;
    const meta = [
      receipt.date || todayIso(0),
      receipt.vendor || "",
      `${lineCount} line${lineCount === 1 ? "" : "s"}`,
      [receipt.paymentType, receipt.paymentCard].filter(Boolean).join(" - "),
    ].filter(Boolean).join(" · ");
    return `
      <button type="button" class="crm-receipt-history-item" data-fresh-receipt-open="${escapeHtml(receipt.id)}">
        <span>
          <strong>${escapeHtml(receipt.imageTitle || receipt.vendor || receipt.notes || "Saved receipt")}</strong>
          <small>${escapeHtml(meta)}</small>
        </span>
        <b>${crmCurrency.format(freshExpenseReceiptTotal(receipt))}</b>
      </button>
    `;
  }).join("");
  list.querySelectorAll("[data-fresh-receipt-open]").forEach((button) => {
    button.addEventListener("click", () => freshExpenseOpenReceipt(button.dataset.freshReceiptOpen));
  });
}

function renderFileExpenses() {
  const file = normalizeCrmFile(activeFile());
  const title = $("crmExpensesFileTitle");
  const heading = $("crmExpensesHeading");
  const total = $("crmFileExpenseTotal");
  const rows = $("crmFileExpenseRows");
  if (!rows) return;
  if (!file) {
    if (title) title.textContent = "Select a file to track expenses.";
    if (heading) heading.textContent = "No file selected";
    if (total) total.textContent = crmCurrency.format(0);
    rows.innerHTML = `<tr><td colspan="9">No file selected.</td></tr>`;
    fileReceiptDraft = blankFileReceiptDraft();
    bulkReceiptDrafts = [];
    renderFileReceiptDraft();
    freshExpenseRenderReceiptHistory(null);
    renderBulkReceiptReview();
    return;
  }
  rebuildFreshFileExpenses(file);
  if (title) title.textContent = `${file.fileNumber || "Project"} · ${file.clientName || "Unnamed Client"}`;
  if (heading) heading.textContent = file.clientName || "Unnamed Client";
  if (total) total.textContent = crmCurrency.format(fileExpenseTotal(file));
  rows.innerHTML = (file.expenseLines || []).map((line) => {
    const baseAmount = expenseLineBaseAmount(line);
    const taxAmount = expenseLineTaxAmount(line);
    const totalAmount = receiptExpenseLineAmount(line);
    const notePreview = line.note ? line.note.split(/\s+/).slice(0, 5).join(" ") : "Add details";
    return `
      <tr>
        <td><input class="crm-revenue-input" type="date" value="${escapeHtml(line.date || todayIso(0))}" data-file-expense-field="date" data-file-expense-id="${escapeHtml(line.id)}"></td>
        <td>${escapeHtml(line.category || "Supplies")}</td>
        <td>${escapeHtml(line.vendor || "")}</td>
        <td><button type="button" class="crm-expense-note-button" data-file-expense-note="${escapeHtml(line.id)}"><span>${escapeHtml(notePreview)}</span></button></td>
        <td>${crmCurrency.format(baseAmount)}</td>
        <td class="crm-expense-tax-toggle">${line.addTax ? `Yes <small>${crmCurrency.format(taxAmount)}</small>` : "No"}</td>
        <td><strong>${crmCurrency.format(totalAmount)}</strong></td>
        <td><button type="button" data-fresh-expense-open="${escapeHtml(line.receiptGroupId || line.id)}">${line.receiptDataUrl ? "Open" : "Edit"}</button></td>
        <td><button type="button" data-fresh-expense-delete="${escapeHtml(line.receiptGroupId || line.id)}">Delete</button></td>
      </tr>
    `;
  }).join("") || `<tr><td colspan="9">No expenses added yet.</td></tr>`;
  renderFileReceiptDraft();
  freshExpenseRenderReceiptHistory(file);
  renderBulkReceiptReview();
  document.querySelectorAll("[data-file-expense-note]").forEach((button) => {
    button.addEventListener("click", () => openExpenseNoteModal(button.dataset.fileExpenseNote));
  });
  document.querySelectorAll("[data-fresh-expense-open]").forEach((button) => {
    button.addEventListener("click", () => freshExpenseOpenReceipt(button.dataset.freshExpenseOpen));
  });
  document.querySelectorAll("[data-fresh-expense-delete]").forEach((button) => {
    button.addEventListener("click", () => freshExpenseDeleteReceipt(button.dataset.freshExpenseDelete));
  });
}

function freshExpenseOpenReceipt(receiptId) {
  const file = normalizeCrmFile(activeFile());
  let targetReceiptId = receiptId;
  const matchingLine = (Array.isArray(file?.expenseLines) ? file.expenseLines : []).find((line) => line.id === receiptId);
  if (matchingLine?.receiptGroupId) targetReceiptId = matchingLine.receiptGroupId;
  const receipt = freshExpenseReceiptsForFile(file).find((entry) => entry.id === targetReceiptId);
  if (!receipt) return;
  fileReceiptDraft = {
    ...blankFileReceiptDraft(),
    imageDataUrl: receipt.imageDataUrl || "",
    fileName: receipt.fileName || "",
    imageTitle: receipt.imageTitle || receipt.fileName || "",
    vendor: receipt.vendor || "",
    date: receipt.date || todayIso(0),
    category: ["Supplies", "Materials", "Fuel", "Equipment", "Other"].includes(receipt.category) ? receipt.category : "Other",
    customCategory: receipt.customCategory || (["Supplies", "Materials", "Fuel", "Equipment", "Other"].includes(receipt.category) ? "" : receipt.category),
    amount: receipt.receiptTotal || freshExpenseReceiptTotal(receipt).toFixed(2),
    paymentType: receipt.paymentType || "",
    paymentCard: receipt.paymentCard || "",
    notes: receipt.notes || "",
    pastedText: receipt.pastedText || "",
    lines: receipt.lines.map((line) => blankFileReceiptLine(line)),
    isEditingSavedReceipt: true,
    editingReceiptGroupId: receipt.id,
    createdAt: receipt.createdAt || new Date().toISOString(),
    status: "Editing a saved receipt. Save Expense will update this receipt.",
    aiAvailable: false,
  };
  renderFileReceiptDraft();
  $("crmFileReceiptReview")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function freshExpenseDeleteReceipt(receiptId) {
  const file = normalizeCrmFile(activeFile());
  if (!file || !receiptId) return;
  let targetReceiptId = receiptId;
  const matchingLine = (Array.isArray(file.expenseLines) ? file.expenseLines : []).find((line) => line.id === receiptId);
  if (matchingLine?.receiptGroupId) targetReceiptId = matchingLine.receiptGroupId;
  file.freshExpenseReceipts = freshExpenseReceiptsForFile(file).filter((receipt) => receipt.id !== targetReceiptId);
  addSystemNote(file, "Expense receipt deleted.");
  freshExpenseSyncAndSave(file, "Expense deleted and saved to Cloudflare.");
}

function freshExpenseAddManualDraft() {
  const file = normalizeCrmFile(activeFile());
  if (!file) {
    window.alert("Select a customer file before adding an expense.");
    return;
  }
  fileReceiptDraft = {
    ...blankFileReceiptDraft(),
    date: todayIso(0),
    category: "Supplies",
    lines: [blankFileReceiptLine({ category: "Supplies", addTax: true })],
    status: "Add the expense details, then click Save Expense.",
    aiAvailable: false,
  };
  renderFileReceiptDraft();
  $("crmFileReceiptReview")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function freshExpenseAttachReceipt(uploadFiles = []) {
  const files = Array.from(uploadFiles || []);
  const file = normalizeCrmFile(activeFile());
  if (!file) {
    window.alert("Select a customer file before scanning a receipt.");
    return;
  }
  if (!files.length) return;
  if (hasUnsavedFileReceiptDraft()) {
    window.alert("Save or clear the current receipt before scanning another one.");
    return;
  }
  if (files.length > 1) {
    window.alert("For this fresh expense rebuild, upload one receipt at a time. Save it, then upload the next receipt.");
  }
  const uploadFile = files[0];
  showReceiptLoading("Reading receipt photo...");
  try {
    const imageDataUrl = await readUploadFileAsDataUrl(uploadFile);
    let nextDraft = {
      ...blankFileReceiptDraft(),
      imageDataUrl,
      fileName: uploadFile.name || "",
      imageTitle: uploadFile.name || "Receipt photo",
      date: todayIso(0),
      category: "Supplies",
      lines: [],
      status: "Receipt photo attached. Review the fields, then save the expense.",
    };
    try {
      const result = await readFileReceiptWithAi(imageDataUrl, uploadFile);
      nextDraft = {
        ...receiptResultToDraft(result, nextDraft),
        imageDataUrl,
        fileName: uploadFile.name || "",
        imageTitle: uploadFile.name || "Receipt photo",
      };
    } catch (error) {
      nextDraft.status = "Receipt photo attached. AI reading did not finish, so review or paste receipt text before saving.";
      nextDraft.lines = [blankFileReceiptLine({ category: "Supplies", addTax: false })];
    }
    fileReceiptDraft = nextDraft;
    renderFileReceiptDraft();
  } finally {
    hideReceiptLoading();
  }
}

function freshExpenseAddReceiptLine() {
  freshExpenseCaptureDraft();
  fileReceiptDraft.lines = Array.isArray(fileReceiptDraft.lines) ? fileReceiptDraft.lines : [];
  fileReceiptDraft.lines.push(blankFileReceiptLine({ category: fileReceiptDraft.category || "Supplies", addTax: true }));
  renderFileReceiptLineRows();
}

function freshExpenseClearDraft() {
  fileReceiptDraft = blankFileReceiptDraft();
  renderFileReceiptDraft();
  setFileReceiptStatus("Receipt cleared.", "warn");
}

function freshExpenseSave() {
  const file = normalizeCrmFile(activeFile());
  if (!file) {
    window.alert("Select a customer file before saving a receipt.");
    return;
  }
  freshExpenseCaptureDraft();
  const isEditing = Boolean(fileReceiptDraft.isEditingSavedReceipt && fileReceiptDraft.editingReceiptGroupId);
  const receiptId = isEditing ? fileReceiptDraft.editingReceiptGroupId : makeCrmId("fresh-receipt");
  const receipt = freshExpenseReceiptFromDraft(receiptId);
  if (!receipt.lines.length) {
    setFileReceiptStatus("Add receipt details before saving.", "warn");
    return;
  }
  const receipts = freshExpenseReceiptsForFile(file).filter((entry) => entry.id !== receiptId);
  file.freshExpenseReceipts = [{ ...receipt, updatedAt: new Date().toISOString() }, ...receipts];
  addSystemNote(file, `Receipt expense ${isEditing ? "updated" : "saved"}${receipt.vendor ? ` from ${receipt.vendor}` : ""} for ${crmCurrency.format(freshExpenseReceiptTotal(receipt))}.`);
  fileReceiptDraft = blankFileReceiptDraft();
  freshExpenseSyncAndSave(file, "Receipt saved to Cloudflare.");
  setFileReceiptStatus("Receipt saved to this file.", "good");
}

function freshExpenseSaveBatch() {
  window.alert("Bulk receipt upload is paused while we stabilize expenses. Upload one receipt at a time for now.");
}

function cleanExpenseReceiptLine(line = {}) {
  return {
    id: line.id || makeCrmId("expenseLine"),
    use: line.use !== false,
    description: line.description || line.note || "",
    category: line.category || "Supplies",
    price: line.price === undefined ? (line.baseAmount || line.amount || "") : line.price,
    addTax: line.addTax !== false,
    taxRate: Number(line.taxRate) || DEFAULT_EXPENSE_TAX_RATE,
  };
}

function expenseReceiptLineTotal(line = {}) {
  const price = parseMoney(line.price);
  if (line.use === false) return 0;
  return line.addTax ? price + (price * (Number(line.taxRate) || DEFAULT_EXPENSE_TAX_RATE)) : price;
}

function cleanExpenseReceipt(receipt = {}) {
  const lines = Array.isArray(receipt.lines) ? receipt.lines.map(cleanExpenseReceiptLine) : [];
  return {
    id: receipt.id || makeCrmId("receipt"),
    createdAt: receipt.createdAt || new Date().toISOString(),
    updatedAt: receipt.updatedAt || receipt.createdAt || new Date().toISOString(),
    date: receipt.date || todayIso(0),
    vendor: receipt.vendor || "",
    category: receipt.category || "Supplies",
    paymentType: receipt.paymentType || "",
    paymentCard: receipt.paymentCard || "",
    imageTitle: receipt.imageTitle || receipt.receiptFileName || receipt.fileName || "",
    fileName: receipt.fileName || receipt.receiptFileName || "",
    imageDataUrl: receipt.imageDataUrl || receipt.receiptDataUrl || "",
    notes: receipt.notes || "",
    lines,
  };
}

function receiptFromDraft(draft = fileReceiptDraft, receiptId = makeCrmId("receipt")) {
  const lines = usableReceiptDraftLines(draft).map((line) => cleanExpenseReceiptLine({
    description: line.description || draft.notes || draft.fileName || "Receipt expense",
    category: line.category || selectedFileReceiptCategoryForDraft(draft),
    price: line.price || draft.amount || "",
    addTax: line.addTax !== false,
    taxRate: receiptTaxRateForDraft(draft) || DEFAULT_EXPENSE_TAX_RATE,
  }));
  if (!lines.length && (parseMoney(draft.amount) || draft.vendor || draft.notes || draft.imageDataUrl)) {
    lines.push(cleanExpenseReceiptLine({
      description: draft.notes || draft.imageTitle || draft.fileName || "Receipt expense",
      category: selectedFileReceiptCategoryForDraft(draft),
      price: draft.amount || "",
      addTax: false,
      taxRate: DEFAULT_EXPENSE_TAX_RATE,
    }));
  }
  return cleanExpenseReceipt({
    id: receiptId,
    date: draft.date || todayIso(0),
    vendor: draft.vendor || "",
    category: selectedFileReceiptCategoryForDraft(draft),
    paymentType: draft.paymentType || "",
    paymentCard: draft.paymentCard || "",
    imageTitle: draft.imageTitle || draft.fileName || "",
    fileName: draft.fileName || "",
    imageDataUrl: draft.imageDataUrl || "",
    notes: draft.notes || "",
    lines,
  });
}

function receiptTotal(receipt = {}) {
  return (Array.isArray(receipt.lines) ? receipt.lines : []).reduce((sum, line) => sum + expenseReceiptLineTotal(line), 0);
}

function ensureExpenseReceipts(file) {
  if (!file) return [];
  file.expenseReceipts = Array.isArray(file.expenseReceipts) ? file.expenseReceipts.map(cleanExpenseReceipt) : [];
  if (!file.expenseReceipts.length && Array.isArray(file.receiptHistory) && file.receiptHistory.length) {
    file.expenseReceipts = file.receiptHistory.map((entry) => cleanExpenseReceipt({
      id: entry.id,
      createdAt: entry.savedAt,
      updatedAt: entry.updatedAt,
      date: entry.date,
      vendor: entry.vendor,
      category: entry.category,
      paymentType: entry.paymentType,
      imageTitle: entry.label,
      lines: Array.isArray(entry.lines) ? entry.lines.map((line) => ({
        id: line.id,
        description: line.note,
        category: line.category,
        price: line.baseAmount || line.amount,
        addTax: Boolean(line.addTax),
        taxRate: line.taxRate,
        receiptDataUrl: line.receiptDataUrl,
      })) : [],
      imageDataUrl: Array.isArray(entry.lines) ? (entry.lines.find((line) => line.receiptDataUrl)?.receiptDataUrl || "") : "",
    })).filter((receipt) => receipt.lines.length);
  }
  rebuildExpenseLinesFromReceipts(file);
  return file.expenseReceipts;
}

function rebuildExpenseLinesFromReceipts(file) {
  if (!file) return;
  file.expenseReceipts = Array.isArray(file.expenseReceipts) ? file.expenseReceipts.map(cleanExpenseReceipt) : [];
  file.expenseLines = file.expenseReceipts.flatMap((receipt) => {
    return receipt.lines
      .filter((line) => line.use !== false)
      .map((line, index) => {
        const baseAmount = parseMoney(line.price);
        const taxRate = Number(line.taxRate) || DEFAULT_EXPENSE_TAX_RATE;
        const tax = line.addTax ? baseAmount * taxRate : 0;
        return {
          id: line.id || makeCrmId("expense"),
          receiptGroupId: receipt.id,
          date: receipt.date || todayIso(0),
          category: line.category || receipt.category || "Supplies",
          vendor: receipt.vendor || "",
          note: line.description || receipt.notes || "Receipt expense",
          baseAmount,
          amount: baseAmount + tax,
          tax,
          addTax: Boolean(line.addTax),
          taxRate,
          paymentType: [receipt.paymentType, receipt.paymentCard].filter(Boolean).join(" - "),
          receiptFileName: receipt.imageTitle || receipt.fileName || "",
          receiptDataUrl: index === 0 ? (receipt.imageDataUrl || "") : "",
          receiptSource: "Saved receipt",
        };
      });
  });
  file.receiptHistory = file.expenseReceipts.map((receipt) => receiptHistoryEntryFromLines(receipt.id, file.expenseLines.filter((line) => line.receiptGroupId === receipt.id), {
    savedAt: receipt.createdAt,
    updatedAt: receipt.updatedAt,
    label: receipt.imageTitle || receipt.vendor || receipt.notes || "Saved receipt",
    date: receipt.date,
    vendor: receipt.vendor,
    category: receipt.category,
    paymentType: [receipt.paymentType, receipt.paymentCard].filter(Boolean).join(" - "),
  }));
}

function renderReceiptHistory(file) {
  const list = $("crmReceiptHistoryList");
  if (!list) return;
  if (!file) {
    list.innerHTML = `<p class="crm-empty-state">Select a file to see saved receipts and expenses.</p>`;
    return;
  }
  const receipts = ensureExpenseReceipts(file);
  if (!receipts.length) {
    list.innerHTML = `<p class="crm-empty-state">No saved receipts or expenses yet.</p>`;
    return;
  }
  list.innerHTML = receipts
    .slice()
    .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")))
    .map((receipt) => {
      const meta = [
        receipt.date || todayIso(0),
        receipt.vendor || "",
        receipt.lines.length ? `${receipt.lines.length} line${receipt.lines.length === 1 ? "" : "s"}` : "",
        [receipt.paymentType, receipt.paymentCard].filter(Boolean).join(" - "),
      ].filter(Boolean).join(" · ");
      return `
        <button type="button" class="crm-receipt-history-item" data-file-receipt-group-open="${escapeHtml(receipt.id)}">
          <span>
            <strong>${escapeHtml(receipt.imageTitle || receipt.vendor || receipt.notes || "Saved receipt")}</strong>
            <small>${escapeHtml(meta || "Saved expense")}</small>
          </span>
          <b>${crmCurrency.format(receiptTotal(receipt))}</b>
        </button>
      `;
    }).join("");
  document.querySelectorAll("[data-file-receipt-group-open]").forEach((button) => {
    button.addEventListener("click", () => openSavedExpenseGroupInReceiptEditor(button.dataset.fileReceiptGroupOpen));
  });
}

function renderFileExpenses() {
  const file = normalizeCrmFile(activeFile());
  const title = $("crmExpensesFileTitle");
  const heading = $("crmExpensesHeading");
  const total = $("crmFileExpenseTotal");
  const rows = $("crmFileExpenseRows");
  if (!file) {
    title.textContent = "Select a file to track expenses.";
    heading.textContent = "No file selected";
    total.textContent = crmCurrency.format(0);
    rows.innerHTML = `<tr><td colspan="9">No file selected.</td></tr>`;
    fileReceiptDraft = blankFileReceiptDraft();
    bulkReceiptDrafts = [];
    renderFileReceiptDraft();
    renderReceiptHistory(null);
    renderBulkReceiptReview();
    return;
  }
  ensureExpenseReceipts(file);
  title.textContent = `${file.fileNumber || "Project"} · ${file.clientName || "Unnamed Client"}`;
  heading.textContent = file.clientName || "Unnamed Client";
  total.textContent = crmCurrency.format(fileExpenseTotal(file));
  rows.innerHTML = (file.expenseLines || []).map((line) => {
    const baseAmount = expenseLineBaseAmount(line);
    const taxAmount = expenseLineTaxAmount(line);
    const totalAmount = receiptExpenseLineAmount(line);
    const notePreview = line.note ? line.note.split(/\s+/).slice(0, 5).join(" ") : "Add details";
    return `
      <tr>
        <td><input class="crm-revenue-input" type="date" value="${escapeHtml(line.date || todayIso(0))}" data-file-expense-field="date" data-file-expense-id="${escapeHtml(line.id)}"></td>
        <td>${escapeHtml(line.category || "Supplies")}</td>
        <td>${escapeHtml(line.vendor || "")}</td>
        <td><button type="button" class="crm-expense-note-button" data-file-expense-note="${escapeHtml(line.id)}"><span>${escapeHtml(notePreview)}</span></button></td>
        <td>${crmCurrency.format(baseAmount)}</td>
        <td class="crm-expense-tax-toggle">${line.addTax ? `Yes <small>${crmCurrency.format(taxAmount)}</small>` : "No"}</td>
        <td><strong>${crmCurrency.format(totalAmount)}</strong></td>
        <td><button type="button" data-file-expense-open="${escapeHtml(line.id)}">${line.receiptDataUrl ? "Open" : "Edit"}</button></td>
        <td><button type="button" data-file-expense-delete="${escapeHtml(line.id)}">Delete</button></td>
      </tr>
    `;
  }).join("") || `<tr><td colspan="9">No expenses added yet.</td></tr>`;
  renderFileReceiptDraft();
  renderReceiptHistory(file);
  renderBulkReceiptReview();
  document.querySelectorAll("[data-file-expense-note]").forEach((button) => {
    button.addEventListener("click", () => openExpenseNoteModal(button.dataset.fileExpenseNote));
  });
  document.querySelectorAll("[data-file-expense-open]").forEach((button) => {
    button.addEventListener("click", () => openSavedExpenseInReceiptEditor(button.dataset.fileExpenseOpen));
  });
  document.querySelectorAll("[data-file-expense-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteFileExpenseLine(button.dataset.fileExpenseDelete));
  });
}

renderFileExpenses = renderFileExpensesFresh;

function openSavedExpenseGroupInReceiptEditor(groupId) {
  const file = normalizeCrmFile(activeFile());
  const receipt = ensureExpenseReceipts(file).find((entry) => entry.id === groupId);
  if (!receipt) return;
  const paymentType = receipt.paymentType || "";
  fileReceiptDraft = {
    ...blankFileReceiptDraft(),
    imageDataUrl: receipt.imageDataUrl || "",
    fileName: receipt.fileName || "",
    imageTitle: receipt.imageTitle || receipt.fileName || "",
    vendor: receipt.vendor || "",
    date: receipt.date || "",
    category: ["Supplies", "Materials", "Fuel", "Equipment"].includes(receipt.category) ? receipt.category : (receipt.category ? "Other" : "Supplies"),
    customCategory: ["Supplies", "Materials", "Fuel", "Equipment"].includes(receipt.category) ? "" : (receipt.category || ""),
    amount: receiptTotal(receipt).toFixed(2),
    paymentType,
    paymentCard: receipt.paymentCard || "",
    notes: receipt.notes || "",
    lines: receipt.lines.map((line) => blankFileReceiptLine(line)),
    isEditingSavedReceipt: true,
    editingReceiptGroupId: receipt.id,
    status: "Editing a saved receipt. Save Expense will update this receipt.",
    aiAvailable: false,
  };
  renderFileReceiptDraft();
  $("crmFileReceiptReview")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function openSavedExpenseInReceiptEditor(lineId) {
  const file = normalizeCrmFile(activeFile());
  const line = file?.expenseLines?.find((entry) => entry.id === lineId);
  if (!line) return;
  openSavedExpenseGroupInReceiptEditor(line.receiptGroupId || line.id);
}

function addFileExpenseLine() {
  const file = normalizeCrmFile(activeFile());
  if (!file) {
    window.alert("Select a customer file before adding an expense.");
    return;
  }
  const receipt = cleanExpenseReceipt({
    imageTitle: "Manual Expense",
    notes: "",
    lines: [cleanExpenseReceiptLine({ description: "Manual expense", price: "", addTax: false })],
  });
  file.expenseReceipts.unshift(receipt);
  rebuildExpenseLinesFromReceipts(file);
  addSystemNote(file, "Manual expense added.");
  syncFileExpensesToRevenue(file);
  saveCrmFiles();
  renderFileExpenses();
  saveExpenseChangeToCloud("Expense line saved to Cloudflare.");
}

function deleteFileExpenseLine(lineId) {
  const file = normalizeCrmFile(activeFile());
  if (!file) return;
  const line = file.expenseLines.find((entry) => entry.id === lineId);
  const groupId = line?.receiptGroupId || line?.id || lineId;
  file.expenseReceipts = ensureExpenseReceipts(file).filter((receipt) => receipt.id !== groupId);
  rebuildExpenseLinesFromReceipts(file);
  addSystemNote(file, "Expense receipt deleted.");
  syncFileExpensesToRevenue(file);
  saveCrmFiles();
  renderFileExpenses();
  saveExpenseChangeToCloud("Expense deleted and saved to Cloudflare.");
}

function saveBulkReceiptsToFile() {
  const file = normalizeCrmFile(activeFile());
  if (!file) {
    window.alert("Select a customer file before saving receipts.");
    return;
  }
  const receipts = bulkReceiptDrafts.map((draft) => receiptFromDraft(draft)).filter((receipt) => receipt.lines.length);
  if (!receipts.length) {
    window.alert("No receipt details were ready to save.");
    return;
  }
  file.expenseReceipts = [...receipts, ...ensureExpenseReceipts(file)];
  rebuildExpenseLinesFromReceipts(file);
  addSystemNote(file, `${receipts.length} receipt${receipts.length === 1 ? "" : "s"} saved to expenses.`);
  syncFileExpensesToRevenue(file);
  saveCrmFiles();
  bulkReceiptDrafts = [];
  renderFileExpenses();
  setFileReceiptStatus("Receipt batch saved to this file.", "good");
  saveExpenseChangeToCloud("Receipt batch saved to Cloudflare.");
}

function saveScannedReceiptToFile() {
  const file = normalizeCrmFile(activeFile());
  if (!file) {
    window.alert("Select a customer file before saving a receipt.");
    return;
  }
  captureFileReceiptReviewFields();
  const isEditingSavedReceipt = Boolean(fileReceiptDraft.isEditingSavedReceipt && fileReceiptDraft.editingReceiptGroupId);
  const receiptId = isEditingSavedReceipt ? fileReceiptDraft.editingReceiptGroupId : makeCrmId("receipt");
  const receipt = receiptFromDraft(fileReceiptDraft, receiptId);
  if (!receipt.lines.length) {
    setFileReceiptStatus("Add receipt details before saving.", "warn");
    return;
  }
  file.expenseReceipts = ensureExpenseReceipts(file).filter((entry) => entry.id !== receiptId);
  file.expenseReceipts.unshift({ ...receipt, updatedAt: new Date().toISOString() });
  rebuildExpenseLinesFromReceipts(file);
  addSystemNote(file, `Receipt expense ${isEditingSavedReceipt ? "updated" : "saved"}${receipt.vendor ? ` from ${receipt.vendor}` : ""} for ${crmCurrency.format(receiptTotal(receipt))}.`);
  syncFileExpensesToRevenue(file);
  saveCrmFiles();
  fileReceiptDraft = blankFileReceiptDraft();
  renderFileExpenses();
  setFileReceiptStatus("Receipt saved to this file.", "good");
  saveExpenseChangeToCloud("Receipt saved to Cloudflare.");
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
  if (key === "labor") syncRevenueLaborToFile(row);
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
  saveRevenueChangeToCloud("Revenue row deleted from Cloudflare.");
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

function importLinesToPriceDatabase(lines = [], options = {}) {
  const usableLines = lines
    .map((line) => ({
      product: line.product || line.description || line.name || "",
      price: line.price || line.baseAmount || line.amount || "",
      category: line.category || options.category || "Supplies",
      unit: line.unit || "each",
      vendor: line.vendor || options.vendor || "",
      use: line.use,
    }))
    .filter((line) => line.use !== false && line.product && parseMoney(line.price) > 0);
  if (!usableLines.length) {
    window.alert("Add at least one checked receipt line with an item name and price.");
    return { updatedCount: 0, addedCount: 0 };
  }
  const today = options.date || todayIso(0);
  let updatedCount = 0;
  let addedCount = 0;
  usableLines.forEach((line) => {
    const productKey = normalizeReceiptProduct(line.product);
    const existing = priceDatabaseRows().find((row) => normalizeReceiptProduct(row.product || row.name) === productKey);
    const price = parseMoney(line.price);
    const vendor = line.vendor || options.vendor || "";
    const updated = {
      ...(existing && !existing.readonly ? existing : {}),
      id: existing?.readonly ? `custom-${makeCrmId("price")}` : (existing?.id || `custom-${makeCrmId("price")}`),
      sourceId: existing?.readonly ? existing.id : existing?.sourceId,
      product: line.product,
      name: line.product,
      category: line.category || options.category || existing?.category || "Supplies",
      unit: line.unit || existing?.unit || "each",
      vendor: vendor || existing?.vendor || existing?.source || "",
      source: vendor || existing?.vendor || existing?.source || "",
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
  return { updatedCount, addedCount };
}

function updatePriceDatabaseFromReceipt() {
  captureReceiptDraftFields();
  const { updatedCount, addedCount } = importLinesToPriceDatabase(receiptDraft.lines, {
    vendor: receiptDraft.vendor,
    date: receiptDraft.date,
    category: receiptDraft.category,
  });
  $("crmReceiptStatus").textContent = `${updatedCount} updated, ${addedCount} added to the Price Database.`;
}

function importFileReceiptToPriceDatabase() {
  captureFileReceiptReviewFields();
  const lines = (Array.isArray(fileReceiptDraft.lines) ? fileReceiptDraft.lines : [])
    .filter((line) => line.use !== false)
    .filter((line) => (line.description || line.product || line.name) && parseMoney(line.price || line.amount || line.baseAmount) > 0)
    .map((line) => {
      const product = line.product || line.description || line.name || "";
      const existing = priceDatabaseRows().find((row) => normalizeReceiptProduct(row.product || row.name) === normalizeReceiptProduct(product));
      return {
        ...line,
        product,
        category: line.category || selectedFileReceiptCategory(),
        vendor: fileReceiptDraft.vendor || "",
        existingId: existing?.id || "",
        existingPrice: existing?.defaultPrice || existing?.priceLow || existing?.price || "",
        importStatus: existing ? "Update existing" : "New item",
      };
    });
  if (!lines.length) {
    setFileReceiptStatus("Add at least one checked receipt detail with a name and price before importing.", "warn");
    return;
  }
  openPartsImportModal(lines);
}

function openPartsImportModal(lines = []) {
  pendingPartsImportLines = lines;
  const list = $("crmPartsImportList");
  const summary = $("crmPartsImportSummary");
  if (!list || !summary) return;
  summary.textContent = `${lines.length} receipt detail${lines.length === 1 ? "" : "s"} ready. Uncheck anything you do not want in the Parts Database.`;
  list.innerHTML = lines.map((line) => `
    <div class="crm-parts-import-row">
      <input type="checkbox" data-parts-import-id="${escapeHtml(line.id)}" checked>
      <span>
        <strong>${escapeHtml(line.importStatus || "New item")}${line.existingPrice ? ` · Current ${crmCurrency.format(parseMoney(line.existingPrice))}` : ""}</strong>
        <input data-parts-import-field="product" data-parts-import-id="${escapeHtml(line.id)}" value="${escapeHtml(line.product)}" placeholder="Item name">
        <input data-parts-import-field="price" data-parts-import-id="${escapeHtml(line.id)}" inputmode="decimal" value="${escapeHtml(parseMoney(line.price || line.amount || line.baseAmount) || "")}" placeholder="Price">
        <input data-parts-import-field="category" data-parts-import-id="${escapeHtml(line.id)}" value="${escapeHtml(line.category || "Supplies")}" placeholder="Category">
        <input data-parts-import-field="vendor" data-parts-import-id="${escapeHtml(line.id)}" value="${escapeHtml(line.vendor || "")}" placeholder="Vendor">
      </span>
    </div>
  `).join("");
  $("crmPartsImportModal").hidden = false;
}

function closePartsImportModal() {
  pendingPartsImportLines = [];
  $("crmPartsImportModal").hidden = true;
}

function confirmPartsImportModal() {
  const selectedIds = new Set([...document.querySelectorAll("[data-parts-import-id]")]
    .filter((checkbox) => checkbox.checked)
    .map((checkbox) => checkbox.dataset.partsImportId));
  const selectedLines = pendingPartsImportLines
    .filter((line) => selectedIds.has(line.id))
    .map((line) => {
      const field = (name) => document.querySelector(`[data-parts-import-id="${cssIdentifier(line.id)}"][data-parts-import-field="${name}"]`)?.value.trim() || "";
      return {
        ...line,
        product: field("product") || line.product,
        description: field("product") || line.product,
        price: field("price") || line.price,
        category: field("category") || line.category,
        vendor: field("vendor") || line.vendor,
      };
    });
  const { updatedCount, addedCount } = importLinesToPriceDatabase(selectedLines, {
    vendor: selectedLines[0]?.vendor || fileReceiptDraft.vendor,
    date: $("crmManualExpenseDate")?.value || fileReceiptDraft.date,
    category: selectedLines[0]?.category || selectedFileReceiptCategory(),
  });
  closePartsImportModal();
  setFileReceiptStatus(`${updatedCount} updated, ${addedCount} added to the Parts Database.`, "good");
  setManualExpenseStatus?.(`${updatedCount} updated, ${addedCount} added to the Price Database.`, "good");
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

async function importGoogleCalendarEvents(silent = false) {
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
    if (!silent) window.alert(`${crmExternalCalendarEvents.length} Google Calendar event${crmExternalCalendarEvents.length === 1 ? "" : "s"} imported into the CRM calendar.`);
  } finally {
    if (button) button.textContent = originalText || "Import Google Calendar";
  }
}

function switchCrmView(view) {
  // Changing Command Center sections must not discard a partially completed
  // customer file. The full dashboard still goes to cloud only through Save.
  flushActiveFileDraft();
  const showRevenue = view === "revenue";
  const showPayroll = view === "payroll";
  const showCalendar = view === "calendar";
  const showContacts = view === "contacts";
  const showInvoice = view === "invoice";
  const showExpenses = view === "expenses";
  const showPrices = view === "prices";
  const showBusiness = view === "business";
  const showEstimator = view === "estimator";
  const estimatorShell = $("crmEstimatorView")?.closest(".crm-dashboard-view");
  document.body.classList.toggle("crm-estimator-active", showEstimator);
  document.querySelectorAll(".crm-dashboard-view").forEach((section) => {
    const keepEstimatorShell = showEstimator && estimatorShell && section === estimatorShell;
    section.hidden = !keepEstimatorShell && (showRevenue || showPayroll || showCalendar || showContacts || showInvoice || showExpenses || showPrices || showBusiness || showEstimator);
  });
  $("crmRevenueView").hidden = !showRevenue;
  $("crmPayrollView").hidden = !showPayroll;
  $("crmCalendarView").hidden = !showCalendar;
  $("crmContactsView").hidden = !showContacts;
  $("crmInvoiceView").hidden = !showInvoice;
  $("crmExpensesView").hidden = !showExpenses;
  $("crmPriceView").hidden = !showPrices;
  $("crmBusinessView").hidden = !showBusiness;
  $("crmEstimatorView").hidden = !showEstimator;
document.querySelectorAll("[data-crm-view]").forEach((button) => {
  button.classList.toggle("active", button.dataset.crmView === view);
});
  if (showRevenue) {
    repairRevenueRowsFromFiles();
    crmFiles.forEach((file) => {
      if (revenueRowForDashboardFile(file)) syncFileExpensesToRevenue(file);
    });
    saveRevenueRows();
    renderRevenue();
  }
  if (showPayroll) renderPayroll();
  if (showInvoice) renderInvoiceView();
  if (showCalendar) {
    renderCalendar();
    if (Date.now() - (window.animusLastCalendarImport || 0) > 5 * 60 * 1000) {
      window.animusLastCalendarImport = Date.now();
      importGoogleCalendarEvents(true).catch(() => {
        window.animusLastCalendarImport = 0;
      });
    }
  }
  if (showContacts && typeof window.renderAnimusContacts === "function") window.renderAnimusContacts();
  if (showExpenses) renderFileExpenses();
  if (showPrices) renderPriceDatabase();
  if (showBusiness && typeof window.renderBusinessPerformance === "function") window.renderBusinessPerformance();
  if (showEstimator) {
    const frame = $("crmEstimatorFrame");
    const currentSrc = frame?.getAttribute("src") || "";
    const file = activeFile();
    const needsFileEstimate = Boolean(file?.editableEstimate) && (!currentSrc || currentSrc.includes("new=1"));
    if (needsFileEstimate) {
      sendEstimateToEstimator(file.editableEstimate);
      return;
    }
    if (frame && (!currentSrc || currentSrc === "about:blank")) {
      const estimatorUrl = new URL("index.html", window.location.href);
      estimatorUrl.searchParams.set("new", "1");
      estimatorUrl.searchParams.set("embedded", "1");
      estimatorUrl.searchParams.set("open", Date.now().toString());
      frame.src = estimatorUrl.toString();
    }
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

// Expenses page reset: old receipt and expense tools are intentionally inactive.
function renderExpenseRebuildPlaceholder() {
  const title = $("crmExpensesFileTitle");
  const file = activeFile();
  if (title) {
    title.textContent = file
      ? `${file.fileNumber || "Project"} · ${file.clientName || "Unnamed Client"} · Expense rebuild ready`
      : "Select a file when we rebuild expenses.";
  }
}

renderFileExpenses = renderExpenseRebuildPlaceholder;
freshExpenseAddManualDraft = function inactiveFreshExpenseAddManualDraft() {
  window.alert("The old expense system has been removed. We will rebuild this from scratch.");
};
freshExpenseAttachReceipt = function inactiveFreshExpenseAttachReceipt() {
  window.alert("The old receipt scanner has been removed. We will rebuild this from scratch.");
};
freshExpenseSave = function inactiveFreshExpenseSave() {
  window.alert("The old Save Expense button has been removed. We will rebuild this from scratch.");
};
freshExpenseClearDraft = function inactiveFreshExpenseClearDraft() {};
freshExpenseAddReceiptLine = function inactiveFreshExpenseAddReceiptLine() {};
freshExpenseSaveBatch = function inactiveFreshExpenseSaveBatch() {};

// ANIMUS Expenses v3: one receipt list is the source of truth.
function animusExpenseLineTotal(line = {}) {
  if (line.use === false) return 0;
  const base = parseMoney(line.price ?? line.baseAmount ?? line.amount ?? 0);
  const rate = Number(line.taxRate) || DEFAULT_EXPENSE_TAX_RATE;
  return line.addTax ? base + (base * rate) : base;
}

function animusCleanExpenseLine(line = {}) {
  return {
    id: line.id || makeCrmId("expenseLine"),
    use: line.use !== false,
    description: line.description || line.note || "",
    category: line.category || "Supplies",
    price: line.price === undefined ? (line.baseAmount || line.amount || "") : line.price,
    addTax: line.addTax !== false,
    taxRate: Number(line.taxRate) || DEFAULT_EXPENSE_TAX_RATE,
  };
}

function animusCleanExpenseReceipt(receipt = {}) {
  const lines = Array.isArray(receipt.lines) ? receipt.lines.map(animusCleanExpenseLine) : [];
  return {
    id: receipt.id || makeCrmId("receipt"),
    createdAt: receipt.createdAt || receipt.savedAt || new Date().toISOString(),
    updatedAt: receipt.updatedAt || receipt.createdAt || receipt.savedAt || new Date().toISOString(),
    date: receipt.date || todayIso(0),
    vendor: receipt.vendor || "",
    category: receipt.category || "Supplies",
    customCategory: receipt.customCategory || "",
    paymentType: receipt.paymentType || "",
    paymentCard: receipt.paymentCard || "",
    imageTitle: receipt.imageTitle || receipt.label || receipt.receiptFileName || receipt.fileName || "",
    fileName: receipt.fileName || receipt.receiptFileName || "",
    imageDataUrl: receipt.imageDataUrl || receipt.receiptDataUrl || "",
    notes: receipt.notes || "",
    pastedText: receipt.pastedText || "",
    lines,
  };
}

function animusReceiptTotal(receipt = {}) {
  return (Array.isArray(receipt.lines) ? receipt.lines : []).reduce((sum, line) => sum + animusExpenseLineTotal(line), 0);
}

function animusReceiptsForFile(file) {
  if (!file) return [];
  let receipts = Array.isArray(file.freshExpenseReceipts) ? file.freshExpenseReceipts : [];
  if (!receipts.length && Array.isArray(file.expenseReceipts) && file.expenseReceipts.length) receipts = file.expenseReceipts;
  if (!receipts.length && Array.isArray(file.receiptHistory) && file.receiptHistory.length) {
    receipts = file.receiptHistory.map((entry) => ({
      id: entry.id,
      createdAt: entry.savedAt,
      updatedAt: entry.updatedAt,
      date: entry.date,
      vendor: entry.vendor,
      category: entry.category,
      paymentType: entry.paymentType,
      imageTitle: entry.label,
      lines: Array.isArray(entry.lines) ? entry.lines.map((line) => ({
        id: line.id,
        description: line.description || line.note || "",
        category: line.category || entry.category || "Supplies",
        price: line.price === undefined ? (line.baseAmount || line.amount || "") : line.price,
        addTax: line.addTax !== false,
        taxRate: line.taxRate || DEFAULT_EXPENSE_TAX_RATE,
      })) : [],
    }));
  }
  file.freshExpenseReceipts = receipts.map(animusCleanExpenseReceipt).filter((receipt) => {
    return receipt.vendor || receipt.imageTitle || receipt.notes || receipt.lines.length || receipt.imageDataUrl;
  });
  return file.freshExpenseReceipts;
}

function animusSyncExpenseMirrors(file) {
  const receipts = animusReceiptsForFile(file);
  file.expenseLines = receipts.flatMap((receipt) => {
    return receipt.lines
      .filter((line) => line.use !== false)
      .map((line, index) => {
        const baseAmount = parseMoney(line.price);
        const taxRate = Number(line.taxRate) || DEFAULT_EXPENSE_TAX_RATE;
        const tax = line.addTax ? baseAmount * taxRate : 0;
        return {
          id: line.id || makeCrmId("expense"),
          receiptGroupId: receipt.id,
          date: receipt.date || todayIso(0),
          category: line.category || receipt.category || "Supplies",
          vendor: receipt.vendor || "",
          note: line.description || receipt.notes || receipt.imageTitle || "Receipt expense",
          baseAmount,
          amount: baseAmount + tax,
          tax,
          addTax: Boolean(line.addTax),
          taxRate,
          paymentType: [receipt.paymentType, receipt.paymentCard].filter(Boolean).join(" - "),
          receiptFileName: receipt.imageTitle || receipt.fileName || "",
          receiptDataUrl: index === 0 ? (receipt.imageDataUrl || "") : "",
          receiptSource: "ANIMUS expense receipt",
        };
      });
  });
  file.expenseReceipts = receipts.map((receipt) => ({ ...receipt, lines: receipt.lines.map((line) => ({ ...line })) }));
  file.receiptHistory = receipts.map((receipt) => receiptHistoryEntryFromLines(receipt.id, file.expenseLines.filter((line) => line.receiptGroupId === receipt.id), {
    savedAt: receipt.createdAt,
    updatedAt: receipt.updatedAt,
    label: receipt.imageTitle || receipt.vendor || receipt.notes || "Saved receipt",
    date: receipt.date,
    vendor: receipt.vendor,
    category: receipt.category,
    paymentType: [receipt.paymentType, receipt.paymentCard].filter(Boolean).join(" - "),
  }));
}

function animusExpenseSaveFile(file, message = "Expenses saved to Cloudflare.") {
  animusSyncExpenseMirrors(file);
  syncFileExpensesToRevenue(file);
  saveCrmFiles();
  saveRevenueRows();
  renderFileExpenses();
  saveExpenseChangeToCloud(message);
}

function animusCaptureDraft() {
  if (!$("crmFileReceiptReview") || $("crmFileReceiptReview").hidden) return;
  fileReceiptDraft.vendor = $("crmFileReceiptVendor")?.value.trim() || "";
  fileReceiptDraft.date = $("crmFileReceiptDate")?.value || todayIso(0);
  fileReceiptDraft.category = $("crmFileReceiptCategory")?.value || "Supplies";
  fileReceiptDraft.customCategory = $("crmFileReceiptOtherCategory")?.value.trim() || "";
  fileReceiptDraft.amount = $("crmFileReceiptAmount")?.value || "";
  fileReceiptDraft.paymentType = $("crmFileReceiptPayment")?.value || "";
  fileReceiptDraft.paymentCard = $("crmFileReceiptCard")?.value || "";
  fileReceiptDraft.imageTitle = $("crmFileReceiptImageTitle")?.value.trim() || "";
  fileReceiptDraft.notes = $("crmFileReceiptNotes")?.value.trim() || "";
  fileReceiptDraft.pastedText = $("crmFileReceiptOcrText")?.value.trim() || "";
  captureFileReceiptLineRows();
}

function animusDraftHasWork() {
  if (!fileReceiptDraft) return false;
  const lines = Array.isArray(fileReceiptDraft.lines) ? fileReceiptDraft.lines : [];
  return Boolean(
    fileReceiptDraft.imageDataUrl ||
    fileReceiptDraft.fileName ||
    fileReceiptDraft.imageTitle ||
    fileReceiptDraft.vendor ||
    fileReceiptDraft.amount ||
    fileReceiptDraft.notes ||
    fileReceiptDraft.pastedText ||
    lines.some((line) => line.description || line.price)
  );
}

function animusRenderDraft() {
  const review = $("crmFileReceiptReview");
  if (!review) return;
  const hasDraft = animusDraftHasWork();
  review.hidden = !hasDraft;
  if (!hasDraft) {
    setFileReceiptStatus("Use Add Expense or Scan Receipt to start.", "");
    return;
  }
  const preview = $("crmReceiptPreview");
  if (preview) {
    preview.innerHTML = fileReceiptDraft.imageDataUrl
      ? `<img src="${fileReceiptDraft.imageDataUrl}" alt="${escapeHtml(fileReceiptDraft.imageTitle || fileReceiptDraft.fileName || "Receipt image")}">`
      : `<div class="crm-receipt-preview-empty">No receipt image attached.</div>`;
  }
  if ($("crmFileReceiptDate")) $("crmFileReceiptDate").value = fileReceiptDraft.date || todayIso(0);
  if ($("crmFileReceiptVendor")) $("crmFileReceiptVendor").value = fileReceiptDraft.vendor || "";
  if ($("crmFileReceiptCategory")) $("crmFileReceiptCategory").value = ["Supplies", "Materials", "Fuel", "Equipment", "Other"].includes(fileReceiptDraft.category) ? fileReceiptDraft.category : "Other";
  if ($("crmFileReceiptOtherCategory")) $("crmFileReceiptOtherCategory").value = fileReceiptDraft.customCategory || "";
  if ($("crmFileReceiptAmount")) $("crmFileReceiptAmount").value = fileReceiptDraft.amount || "";
  if ($("crmFileReceiptPayment")) $("crmFileReceiptPayment").value = fileReceiptDraft.paymentType || "";
  if ($("crmFileReceiptCard")) $("crmFileReceiptCard").value = fileReceiptDraft.paymentCard || "";
  if ($("crmFileReceiptImageTitle")) $("crmFileReceiptImageTitle").value = fileReceiptDraft.imageTitle || "";
  if ($("crmFileReceiptNotes")) $("crmFileReceiptNotes").value = fileReceiptDraft.notes || "";
  if ($("crmFileReceiptOcrText")) $("crmFileReceiptOcrText").value = fileReceiptDraft.pastedText || "";
  toggleFileReceiptConditionalFields();
  renderFileReceiptLineRows();
  setFileReceiptStatus(fileReceiptDraft.status || "Review the receipt, then click Save Expense.", fileReceiptDraft.statusKind || "");
}

function animusBuildReceiptFromDraft(receiptId = makeCrmId("receipt")) {
  animusCaptureDraft();
  const category = fileReceiptDraft.category === "Other"
    ? (fileReceiptDraft.customCategory || "Other")
    : (fileReceiptDraft.category || "Supplies");
  const lines = usableReceiptDraftLines(fileReceiptDraft).map((line) => animusCleanExpenseLine({
    ...line,
    category: line.category || category,
    addTax: line.addTax !== false,
    taxRate: line.taxRate || DEFAULT_EXPENSE_TAX_RATE,
  }));
  if (!lines.length && (fileReceiptDraft.amount || fileReceiptDraft.vendor || fileReceiptDraft.notes || fileReceiptDraft.imageDataUrl)) {
    lines.push(animusCleanExpenseLine({
      description: fileReceiptDraft.notes || fileReceiptDraft.imageTitle || fileReceiptDraft.fileName || "Receipt expense",
      category,
      price: fileReceiptDraft.amount || "",
      addTax: false,
      taxRate: DEFAULT_EXPENSE_TAX_RATE,
    }));
  }
  return animusCleanExpenseReceipt({
    id: receiptId,
    createdAt: fileReceiptDraft.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    date: fileReceiptDraft.date || todayIso(0),
    vendor: fileReceiptDraft.vendor || "",
    category: fileReceiptDraft.category || "Supplies",
    customCategory: fileReceiptDraft.customCategory || "",
    paymentType: fileReceiptDraft.paymentType || "",
    paymentCard: fileReceiptDraft.paymentCard || "",
    imageTitle: fileReceiptDraft.imageTitle || fileReceiptDraft.fileName || "",
    fileName: fileReceiptDraft.fileName || "",
    imageDataUrl: fileReceiptDraft.imageDataUrl || "",
    notes: fileReceiptDraft.notes || "",
    pastedText: fileReceiptDraft.pastedText || "",
    lines,
  });
}

renderFileReceiptDraft = animusRenderDraft;
freshExpenseCaptureDraft = animusCaptureDraft;
freshExpenseReceiptsForFile = animusReceiptsForFile;
rebuildFreshFileExpenses = animusSyncExpenseMirrors;
fileExpenseTotal = function fileExpenseTotalV3(file) {
  animusSyncExpenseMirrors(file);
  return (Array.isArray(file?.expenseLines) ? file.expenseLines : []).reduce((sum, line) => sum + receiptExpenseLineAmount(line), 0);
};
syncFileExpensesToRevenue = function syncFileExpensesToRevenueV3(file) {
  if (!file) return;
  animusSyncExpenseMirrors(file);
  const row = ensureExpenseRevenueRowForFile(file);
  row.expenses = fileExpenseTotal(file);
  row.expenseLines = file.expenseLines.map((line) => ({ ...line }));
  syncRevenueExpenseTotal(row);
  saveRevenueRows();
};
renderFileExpenses = function renderFileExpensesV3() {
  const file = normalizeCrmFile(activeFile());
  const title = $("crmExpensesFileTitle");
  const heading = $("crmExpensesHeading");
  const total = $("crmFileExpenseTotal");
  const rows = $("crmFileExpenseRows");
  const historyList = $("crmReceiptHistoryList");
  if (!rows) return;
  if (!file) {
    if (title) title.textContent = "Select a file to track expenses.";
    if (heading) heading.textContent = "No file selected";
    if (total) total.textContent = crmCurrency.format(0);
    rows.innerHTML = `<tr><td colspan="9">No file selected.</td></tr>`;
    if (historyList) historyList.innerHTML = `<p class="crm-empty-state">Select a file to see saved receipts and expenses.</p>`;
    fileReceiptDraft = blankFileReceiptDraft();
    animusRenderDraft();
    if ($("crmBulkReceiptPanel")) $("crmBulkReceiptPanel").hidden = true;
    return;
  }
  animusSyncExpenseMirrors(file);
  if (title) title.textContent = `${file.fileNumber || "Project"} · ${file.clientName || "Unnamed Client"}`;
  if (heading) heading.textContent = file.clientName || "Unnamed Client";
  if (total) total.textContent = crmCurrency.format(fileExpenseTotal(file));
  rows.innerHTML = (file.expenseLines || []).map((line) => {
    const baseAmount = expenseLineBaseAmount(line);
    const taxAmount = expenseLineTaxAmount(line);
    const totalAmount = receiptExpenseLineAmount(line);
    const notePreview = line.note ? line.note.split(/\s+/).slice(0, 5).join(" ") : "Add details";
    return `
      <tr>
        <td><input class="crm-revenue-input" type="date" value="${escapeHtml(line.date || todayIso(0))}" data-file-expense-field="date" data-file-expense-id="${escapeHtml(line.id)}"></td>
        <td>${escapeHtml(line.category || "Supplies")}</td>
        <td>${escapeHtml(line.vendor || "")}</td>
        <td><button type="button" class="crm-expense-note-button" data-file-expense-note="${escapeHtml(line.id)}"><span>${escapeHtml(notePreview)}</span></button></td>
        <td>${crmCurrency.format(baseAmount)}</td>
        <td class="crm-expense-tax-toggle">${line.addTax ? `Yes <small>${crmCurrency.format(taxAmount)}</small>` : "No"}</td>
        <td><strong>${crmCurrency.format(totalAmount)}</strong></td>
        <td><button type="button" data-animus-expense-open="${escapeHtml(line.receiptGroupId || line.id)}">${line.receiptDataUrl ? "Open" : "Edit"}</button></td>
        <td><button type="button" data-animus-expense-delete="${escapeHtml(line.receiptGroupId || line.id)}">Delete</button></td>
      </tr>
    `;
  }).join("") || `<tr><td colspan="9">No expenses added yet.</td></tr>`;
  const receipts = animusReceiptsForFile(file).slice().sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
  if (historyList) {
    historyList.innerHTML = receipts.length
      ? receipts.map((receipt) => {
        const meta = [
          receipt.date || todayIso(0),
          receipt.vendor || "",
          `${receipt.lines.length} line${receipt.lines.length === 1 ? "" : "s"}`,
          [receipt.paymentType, receipt.paymentCard].filter(Boolean).join(" - "),
        ].filter(Boolean).join(" · ");
        return `
          <button type="button" class="crm-receipt-history-item" data-animus-expense-open="${escapeHtml(receipt.id)}">
            <span>
              <strong>${escapeHtml(receipt.imageTitle || receipt.vendor || receipt.notes || "Saved receipt")}</strong>
              <small>${escapeHtml(meta)}</small>
            </span>
            <b>${crmCurrency.format(animusReceiptTotal(receipt))}</b>
          </button>
        `;
      }).join("")
      : `<p class="crm-empty-state">No saved receipts or expenses yet.</p>`;
  }
  document.querySelectorAll("[data-file-expense-note]").forEach((button) => {
    button.addEventListener("click", () => openExpenseNoteModal(button.dataset.fileExpenseNote));
  });
  animusRenderDraft();
  if ($("crmBulkReceiptPanel")) $("crmBulkReceiptPanel").hidden = true;
};
freshExpenseAddManualDraft = function freshExpenseAddManualDraftV3() {
  const file = normalizeCrmFile(activeFile());
  if (!file) {
    window.alert("Select a customer file before adding an expense.");
    return;
  }
  fileReceiptDraft = {
    ...blankFileReceiptDraft(),
    date: todayIso(0),
    category: "Supplies",
    lines: [blankFileReceiptLine({ category: "Supplies", addTax: true })],
    status: "Add the expense details, then click Save Expense.",
  };
  animusRenderDraft();
  $("crmFileReceiptReview")?.scrollIntoView({ behavior: "smooth", block: "start" });
};
freshExpenseAttachReceipt = async function freshExpenseAttachReceiptV3(uploadFiles = []) {
  const files = Array.from(uploadFiles || []);
  const file = normalizeCrmFile(activeFile());
  if (!file) {
    window.alert("Select a customer file before scanning a receipt.");
    return;
  }
  if (!files.length) return;
  animusCaptureDraft();
  if (animusDraftHasWork()) {
    window.alert("Save or clear the current receipt before scanning another one.");
    return;
  }
  const uploadFile = files[0];
  showReceiptLoading("Reading receipt photo...");
  try {
    const imageDataUrl = await readUploadFileAsDataUrl(uploadFile);
    let nextDraft = {
      ...blankFileReceiptDraft(),
      imageDataUrl,
      fileName: uploadFile.name || "",
      imageTitle: uploadFile.name || "Receipt photo",
      date: todayIso(0),
      category: "Supplies",
      lines: [blankFileReceiptLine({ category: "Supplies", addTax: true })],
      status: "Receipt photo attached. Review the fields, then save the expense.",
    };
    try {
      const result = await readFileReceiptWithAi(imageDataUrl, uploadFile);
      nextDraft = {
        ...receiptResultToDraft(result, nextDraft),
        imageDataUrl,
        fileName: uploadFile.name || "",
        imageTitle: uploadFile.name || "Receipt photo",
      };
      nextDraft.lines = Array.isArray(nextDraft.lines) && nextDraft.lines.length
        ? nextDraft.lines.map((line) => ({ ...line, addTax: line.addTax !== false }))
        : [blankFileReceiptLine({ category: nextDraft.category || "Supplies", addTax: true })];
    } catch (error) {
      nextDraft.status = "Receipt photo attached. AI reading did not finish, so add the fields manually before saving.";
    }
    fileReceiptDraft = nextDraft;
    animusRenderDraft();
  } finally {
    hideReceiptLoading();
  }
};
freshExpenseAddReceiptLine = function freshExpenseAddReceiptLineV3() {
  animusCaptureDraft();
  fileReceiptDraft.lines = Array.isArray(fileReceiptDraft.lines) ? fileReceiptDraft.lines : [];
  fileReceiptDraft.lines.push(blankFileReceiptLine({ category: fileReceiptDraft.category || "Supplies", addTax: true }));
  renderFileReceiptLineRows();
};
freshExpenseClearDraft = function freshExpenseClearDraftV3() {
  fileReceiptDraft = blankFileReceiptDraft();
  animusRenderDraft();
  setFileReceiptStatus("Receipt cleared.", "warn");
};
freshExpenseOpenReceipt = function freshExpenseOpenReceiptV3(receiptId) {
  const file = normalizeCrmFile(activeFile());
  if (!file || !receiptId) return;
  let targetId = receiptId;
  const line = (Array.isArray(file.expenseLines) ? file.expenseLines : []).find((entry) => entry.id === receiptId);
  if (line?.receiptGroupId) targetId = line.receiptGroupId;
  const receipt = animusReceiptsForFile(file).find((entry) => entry.id === targetId);
  if (!receipt) return;
  fileReceiptDraft = {
    ...blankFileReceiptDraft(),
    ...receipt,
    lines: receipt.lines.map((lineItem) => blankFileReceiptLine(lineItem)),
    isEditingSavedReceipt: true,
    editingReceiptGroupId: receipt.id,
    status: "Editing a saved receipt. Save Expense will update this receipt.",
  };
  animusRenderDraft();
  $("crmFileReceiptReview")?.scrollIntoView({ behavior: "smooth", block: "start" });
};
freshExpenseDeleteReceipt = function freshExpenseDeleteReceiptV3(receiptId) {
  const file = normalizeCrmFile(activeFile());
  if (!file || !receiptId) return;
  let targetId = receiptId;
  const line = (Array.isArray(file.expenseLines) ? file.expenseLines : []).find((entry) => entry.id === receiptId);
  if (line?.receiptGroupId) targetId = line.receiptGroupId;
  file.freshExpenseReceipts = animusReceiptsForFile(file).filter((receipt) => receipt.id !== targetId);
  addSystemNote(file, "Expense receipt deleted.");
  animusExpenseSaveFile(file, "Expense deleted and saved to Cloudflare.");
};
freshExpenseSave = function freshExpenseSaveV3() {
  const file = normalizeCrmFile(activeFile());
  if (!file) {
    window.alert("Select a customer file before saving a receipt.");
    return;
  }
  const isEditing = Boolean(fileReceiptDraft.isEditingSavedReceipt && fileReceiptDraft.editingReceiptGroupId);
  const receiptId = isEditing ? fileReceiptDraft.editingReceiptGroupId : makeCrmId("receipt");
  const receipt = animusBuildReceiptFromDraft(receiptId);
  if (!receipt.lines.length) {
    setFileReceiptStatus("Add at least one expense line before saving.", "warn");
    return;
  }
  const currentReceipts = animusReceiptsForFile(file).filter((entry) => entry.id !== receipt.id);
  file.freshExpenseReceipts = [{ ...receipt, updatedAt: new Date().toISOString() }, ...currentReceipts];
  addSystemNote(file, `Expense ${isEditing ? "updated" : "saved"}${receipt.vendor ? ` from ${receipt.vendor}` : ""} for ${crmCurrency.format(animusReceiptTotal(receipt))}.`);
  fileReceiptDraft = blankFileReceiptDraft();
  animusExpenseSaveFile(file, "Expense saved to Cloudflare.");
  setFileReceiptStatus("Expense saved to this file.", "good");
};
freshExpenseSaveBatch = function freshExpenseSaveBatchV3() {
  window.alert("Upload and save one receipt at a time while the new expense page is active.");
};

// Expenses v1: rebuild from a clean manual expense list.
let manualExpenseEditingId = "";
let manualExpenseDraftItems = [];

function cleanManualExpense(expense = {}) {
  return {
    id: expense.id || makeCrmId("manual-expense"),
    createdAt: expense.createdAt || new Date().toISOString(),
    updatedAt: expense.updatedAt || expense.createdAt || new Date().toISOString(),
    date: expense.date || todayIso(0),
    vendor: expense.vendor || "",
    title: expense.title || expense.imageTitle || "",
    category: expense.category || "Supplies",
    paymentType: expense.paymentType || "",
    amount: parseMoney(expense.amount),
    notes: expense.notes || "",
    imageDataUrl: expense.imageDataUrl || "",
    imageTitle: expense.imageTitle || expense.title || "",
    items: Array.isArray(expense.items)
      ? expense.items.map((item) => ({
        id: item.id || makeCrmId("manual-item"),
        use: item.use !== false,
        description: item.description || item.product || item.name || "",
        category: item.category || expense.category || "Supplies",
        price: parseMoney(item.price || item.amount || item.total),
      }))
      : [],
  };
}

function manualExpensesForFile(file) {
  if (!file) return [];
  const expenses = Array.isArray(file.animusManualExpenses) ? file.animusManualExpenses : [];
  file.animusManualExpenses = expenses.map(cleanManualExpense);
  return file.animusManualExpenses;
}

function syncManualExpensesForFile(file) {
  const expenses = manualExpensesForFile(file);
  file.expenseLines = expenses.map((expense) => ({
    id: expense.id,
    date: expense.date,
    vendor: expense.vendor,
    category: expense.category,
    note: expense.notes,
    amount: expense.amount,
    baseAmount: expense.amount,
    tax: 0,
    addTax: false,
    paymentType: expense.paymentType,
    receiptFileName: expense.imageTitle || expense.title || "",
    receiptDataUrl: expense.imageDataUrl || "",
    receiptSource: "ANIMUS manual expense",
  }));
  file.expenseReceipts = [];
  file.freshExpenseReceipts = [];
  file.receiptHistory = [];
}

function manualExpenseTotal(file) {
  return manualExpensesForFile(file).reduce((sum, expense) => sum + parseMoney(expense.amount), 0);
}

function manualExpenseDisplayDate(dateValue) {
  const value = String(dateValue || "").trim();
  if (!value) return "";
  const parts = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (parts) return `${parts[2]}/${parts[3]}/${parts[1]}`;
  return value;
}

function clearManualExpenseForm() {
  manualExpenseEditingId = "";
  manualExpenseDraftItems = [];
  if ($("crmManualExpenseDate")) $("crmManualExpenseDate").value = todayIso(0);
  if ($("crmManualExpenseVendor")) $("crmManualExpenseVendor").value = "";
  if ($("crmManualExpenseTitle")) $("crmManualExpenseTitle").value = "";
  if ($("crmManualExpenseCategory")) $("crmManualExpenseCategory").value = "Supplies";
  if ($("crmManualExpensePayment")) $("crmManualExpensePayment").value = "";
  if ($("crmManualExpenseAmount")) $("crmManualExpenseAmount").value = "";
  if ($("crmManualExpenseNotes")) $("crmManualExpenseNotes").value = "";
  const preview = $("crmAiReceiptPreview");
  if (preview) {
    preview.hidden = false;
    preview.innerHTML = `<div class="crm-receipt-preview-empty">No receipt photo selected yet.</div>`;
  }
  renderManualExpenseItems();
}

function setManualExpenseStatus(message = "", kind = "") {
  const status = $("crmManualExpenseStatus");
  if (!status) return;
  status.textContent = message || "Add an expense manually or scan a receipt with AI.";
  status.classList.toggle("good", kind === "good");
  status.classList.toggle("warn", kind === "warn");
}

function manualExpenseSelectOptionValue(selectId, value = "") {
  const select = $(selectId);
  if (!select) return "";
  const normalized = String(value || "").trim().toLowerCase();
  const option = Array.from(select.options).find((item) => {
    return item.value.trim().toLowerCase() === normalized || item.textContent.trim().toLowerCase() === normalized;
  });
  return option ? option.value : "";
}

function manualExpensePaymentFromReceipt(value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "";
  if (normalized.includes("cash")) return "Cash";
  if (normalized.includes("chase business")) return "Credit - Chase Business";
  if (normalized.includes("bank of america")) return "Credit - Bank of America";
  if (normalized.includes("chase personal")) return "Credit - Chase Personal";
  if (normalized.includes("credit") || normalized.includes("card")) return "Credit - Chase Business";
  return manualExpenseSelectOptionValue("crmManualExpensePayment", value);
}

function manualExpenseNotesFromDraft(draft = {}) {
  const lineNotes = Array.isArray(draft.lines)
    ? draft.lines
      .map((line) => {
        const name = line.description || line.name || "";
        const amount = parseMoney(line.price || line.amount || line.total);
        return [name, amount ? crmCurrency.format(amount) : ""].filter(Boolean).join(" - ");
      })
      .filter(Boolean)
      .join("\n")
    : "";
  return [draft.notes || "", lineNotes].filter(Boolean).join("\n").trim();
}

function cleanManualExpenseItem(item = {}) {
  return {
    id: item.id || makeCrmId("manual-item"),
    use: item.use !== false,
    description: item.description || item.product || item.name || "",
    category: manualExpenseSelectOptionValue("crmManualExpenseCategory", item.category) || item.category || "Supplies",
    price: parseMoney(item.price || item.amount || item.total),
  };
}

function manualExpenseItemTotal() {
  return manualExpenseDraftItems.reduce((sum, item) => item.use === false ? sum : sum + parseMoney(item.price), 0);
}

function renderManualExpenseItems() {
  const rows = $("crmManualExpenseItemRows");
  const total = $("crmManualExpenseItemsTotal");
  if (total) total.textContent = crmCurrency.format(manualExpenseItemTotal());
  if (!rows) return;
  rows.innerHTML = manualExpenseDraftItems.length
    ? manualExpenseDraftItems.map((item) => `
      <tr>
        <td><input type="checkbox" data-manual-expense-item-field="use" data-manual-expense-item-id="${escapeHtml(item.id)}" ${item.use === false ? "" : "checked"}></td>
        <td><input data-manual-expense-item-field="description" data-manual-expense-item-id="${escapeHtml(item.id)}" value="${escapeHtml(item.description || "")}" placeholder="Item name"></td>
        <td>
          <select data-manual-expense-item-field="category" data-manual-expense-item-id="${escapeHtml(item.id)}">
            ${["Supplies", "Materials", "Fuel", "Equipment", "Labor", "Other"].map((category) => `<option${(item.category || "Supplies") === category ? " selected" : ""}>${category}</option>`).join("")}
          </select>
        </td>
        <td><input data-manual-expense-item-field="price" data-manual-expense-item-id="${escapeHtml(item.id)}" inputmode="decimal" value="${escapeHtml(item.price ? String(item.price) : "")}" placeholder="0.00"></td>
        <td>${crmCurrency.format(parseMoney(item.price))}</td>
        <td><button type="button" class="danger-link" data-manual-expense-item-delete="${escapeHtml(item.id)}">Delete</button></td>
      </tr>
    `).join("")
    : `<tr><td colspan="6">AI receipt items will appear here. You can also add a line manually.</td></tr>`;
}

function captureManualExpenseItems() {
  const rows = $("crmManualExpenseItemRows");
  if (!rows) return;
  manualExpenseDraftItems = manualExpenseDraftItems.map((item) => {
    const valueFor = (field) => rows.querySelector(`[data-manual-expense-item-id="${cssIdentifier(item.id)}"][data-manual-expense-item-field="${field}"]`);
    return cleanManualExpenseItem({
      ...item,
      use: valueFor("use") ? valueFor("use").checked : item.use,
      description: valueFor("description")?.value || "",
      category: valueFor("category")?.value || "Supplies",
      price: valueFor("price")?.value || "",
    });
  }).filter((item) => item.description || parseMoney(item.price));
  renderManualExpenseItems();
}

function addManualExpenseItem(item = {}) {
  captureManualExpenseItems();
  manualExpenseDraftItems.push(cleanManualExpenseItem({
    category: $("crmManualExpenseCategory")?.value || "Supplies",
    ...item,
  }));
  renderManualExpenseItems();
}

function deleteManualExpenseItem(itemId) {
  manualExpenseDraftItems = manualExpenseDraftItems.filter((item) => item.id !== itemId);
  renderManualExpenseItems();
}

function fillManualExpenseFromReceiptDraft(draft = {}, uploadFile = null, imageDataUrl = "") {
  const category = manualExpenseSelectOptionValue("crmManualExpenseCategory", draft.category) || "Supplies";
  const payment = manualExpensePaymentFromReceipt(draft.paymentType);
  if ($("crmManualExpenseDate")) $("crmManualExpenseDate").value = draft.date || todayIso(0);
  if ($("crmManualExpenseVendor")) $("crmManualExpenseVendor").value = draft.vendor || "";
  if ($("crmManualExpenseTitle")) $("crmManualExpenseTitle").value = draft.imageTitle || draft.fileName || draft.vendor || "";
  if ($("crmManualExpenseCategory")) $("crmManualExpenseCategory").value = category;
  if ($("crmManualExpensePayment")) $("crmManualExpensePayment").value = payment;
  if ($("crmManualExpenseAmount")) $("crmManualExpenseAmount").value = draft.amount ? String(draft.amount) : "";
  if ($("crmManualExpenseNotes")) $("crmManualExpenseNotes").value = manualExpenseNotesFromDraft(draft) || uploadFile?.name || "";
  manualExpenseDraftItems = Array.isArray(draft.lines) ? draft.lines.map(cleanManualExpenseItem).filter((item) => item.description || parseMoney(item.price)) : [];
  renderManualExpenseItems();
  const preview = $("crmAiReceiptPreview");
  if (preview) {
    preview.hidden = false;
    preview.innerHTML = imageDataUrl
      ? `<img src="${escapeHtml(imageDataUrl)}" alt="Receipt preview"><p>${escapeHtml(uploadFile?.name || "Receipt photo")}</p>`
      : `<p>${escapeHtml(uploadFile?.name || "Receipt scanned")}</p>`;
  }
}

async function scanManualExpenseReceipt(files) {
  const file = normalizeCrmFile(activeFile());
  const uploadFile = files && files[0];
  if (!file) {
    setManualExpenseStatus("Select a file before scanning a receipt.", "warn");
    return;
  }
  if (!uploadFile) return;
  try {
    showReceiptLoading("Reading receipt photo with AI...");
    const imageDataUrl = await readUploadFileAsDataUrl(uploadFile);
    const fallback = {
      fileName: uploadFile.name,
      date: todayIso(0),
      category: "Supplies",
      notes: uploadFile.name,
    };
    const result = await readFileReceiptWithAi(imageDataUrl, uploadFile);
    const draft = receiptResultToDraft(result, fallback);
    fillManualExpenseFromReceiptDraft(draft, uploadFile, imageDataUrl);
    setManualExpenseStatus(draft.status || "Receipt read with AI. Review the fields, then click Save Expense.", draft.aiAvailable ? "good" : "warn");
  } catch (error) {
    setManualExpenseStatus(error?.message || "Receipt could not be read. Add the expense manually.", "warn");
  } finally {
    hideReceiptLoading();
  }
}

function renderManualExpenses() {
  const file = normalizeCrmFile(activeFile());
  const title = $("crmExpensesFileTitle");
  const heading = $("crmManualExpenseHeading");
  const total = $("crmManualExpenseTotal");
  const rows = $("crmManualExpenseRows");
  const cards = $("crmManualExpenseCards");
  if (!rows) return;
  if (!file) {
    if (title) title.textContent = "Select a file to track expenses.";
    if (heading) heading.textContent = "No file selected";
    if (total) total.textContent = crmCurrency.format(0);
    if (cards) cards.innerHTML = `<p class="crm-empty-state">Select a file before adding expenses.</p>`;
    rows.innerHTML = `<tr><td colspan="8">Select a file before adding expenses.</td></tr>`;
    return;
  }
  const expenses = manualExpensesForFile(file);
  syncManualExpensesForFile(file);
  if (title) title.textContent = `${file.fileNumber || "Project"} · ${file.clientName || "Unnamed Client"}`;
  if (heading) heading.textContent = `${file.clientName || "Unnamed Client"} Expenses`;
  if (total) total.textContent = crmCurrency.format(manualExpenseTotal(file));
  if (cards) {
    cards.innerHTML = expenses.length
      ? expenses.map((expense) => `
        <article class="crm-manual-expense-card crm-receipt-history-item" data-manual-expense-open="${escapeHtml(expense.id)}">
          <span>
            <strong>${escapeHtml(expense.title || expense.vendor || "No vendor")}</strong>
            <small>${escapeHtml(manualExpenseDisplayDate(expense.date) || "No date")}</small>
          </span>
          <span class="crm-receipt-history-amount">
            <b>${crmCurrency.format(parseMoney(expense.amount))}</b>
            <button type="button" class="danger-link" data-manual-expense-delete="${escapeHtml(expense.id)}" aria-label="Delete expense">Delete</button>
          </span>
        </article>
      `).join("")
      : `<p class="crm-empty-state">No expenses saved for this file yet.</p>`;
  }
  rows.innerHTML = expenses.length
    ? expenses.map((expense) => `
      <tr>
        <td>${escapeHtml(manualExpenseDisplayDate(expense.date))}</td>
        <td>${escapeHtml(expense.title || "")}</td>
        <td>${escapeHtml(expense.vendor || "No vendor")}</td>
        <td>${escapeHtml(expense.category || "Supplies")}</td>
        <td>${escapeHtml(expense.paymentType || "")}</td>
        <td><button type="button" class="crm-expense-note-button" data-file-expense-note="${escapeHtml(expense.id)}"><span>${escapeHtml(expense.notes ? "View notes" : "No notes")}</span></button></td>
        <td>${crmCurrency.format(parseMoney(expense.amount))}</td>
        <td><button type="button" class="danger-link" data-manual-expense-delete="${escapeHtml(expense.id)}">Delete</button></td>
      </tr>
    `).join("")
    : `<tr><td colspan="8">No expenses saved for this file yet.</td></tr>`;
}

function openManualExpense(expenseId) {
  const file = normalizeCrmFile(activeFile());
  const expense = manualExpensesForFile(file).find((entry) => entry.id === expenseId);
  if (!expense) return;
  manualExpenseEditingId = expense.id;
  manualExpenseDraftItems = Array.isArray(expense.items) ? expense.items.map(cleanManualExpenseItem) : [];
  if ($("crmManualExpenseDate")) $("crmManualExpenseDate").value = expense.date || todayIso(0);
  if ($("crmManualExpenseVendor")) $("crmManualExpenseVendor").value = expense.vendor || "";
  if ($("crmManualExpenseTitle")) $("crmManualExpenseTitle").value = expense.title || "";
  if ($("crmManualExpenseCategory")) $("crmManualExpenseCategory").value = manualExpenseSelectOptionValue("crmManualExpenseCategory", expense.category) || "Supplies";
  if ($("crmManualExpensePayment")) $("crmManualExpensePayment").value = manualExpenseSelectOptionValue("crmManualExpensePayment", expense.paymentType) || "";
  if ($("crmManualExpenseAmount")) $("crmManualExpenseAmount").value = expense.amount ? String(expense.amount) : "";
  if ($("crmManualExpenseNotes")) $("crmManualExpenseNotes").value = expense.notes || "";
  const preview = $("crmAiReceiptPreview");
  if (preview) {
    preview.hidden = false;
    preview.innerHTML = expense.imageDataUrl
      ? `<img src="${escapeHtml(expense.imageDataUrl)}" alt="Receipt preview"><p>${escapeHtml(expense.title || expense.vendor || "Receipt photo")}</p>`
      : `<div class="crm-receipt-preview-empty">No receipt photo saved for this expense.</div>`;
  }
  renderManualExpenseItems();
  setManualExpenseStatus("Expense loaded for editing. Make changes, then click Save Expense.", "good");
  $("crmManualExpenseDate")?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function importManualExpenseItemsToPrices() {
  captureManualExpenseItems();
  const vendor = $("crmManualExpenseVendor")?.value.trim() || "";
  const category = $("crmManualExpenseCategory")?.value || "Supplies";
  const lines = manualExpenseDraftItems
    .filter((line) => line.use !== false)
    .filter((line) => line.description && parseMoney(line.price) > 0)
    .map((line) => {
      const existing = priceDatabaseRows().find((row) => normalizeReceiptProduct(row.product || row.name) === normalizeReceiptProduct(line.description));
      return {
        ...line,
        product: line.description,
        vendor,
        category: line.category || category,
        existingId: existing?.id || "",
        existingPrice: existing?.defaultPrice || existing?.priceLow || existing?.price || "",
        importStatus: existing ? "Update existing" : "New item",
      };
    });
  if (!lines.length) {
    setManualExpenseStatus("Add at least one item name and price before importing to the Price Database.", "warn");
    return;
  }
  openPartsImportModal(lines);
}

function saveManualExpense() {
  const file = normalizeCrmFile(activeFile());
  if (!file) {
    setManualExpenseStatus("Select a file before saving an expense.", "warn");
    return;
  }
  const amount = parseMoney($("crmManualExpenseAmount")?.value || 0);
  if (!amount) {
    setManualExpenseStatus("Add an amount before saving.", "warn");
    return;
  }
  captureManualExpenseItems();
  const expense = cleanManualExpense({
    id: manualExpenseEditingId || undefined,
    date: $("crmManualExpenseDate")?.value || todayIso(0),
    vendor: $("crmManualExpenseVendor")?.value.trim() || "",
    title: $("crmManualExpenseTitle")?.value.trim() || "",
    category: $("crmManualExpenseCategory")?.value || "Supplies",
    paymentType: $("crmManualExpensePayment")?.value || "",
    amount,
    notes: $("crmManualExpenseNotes")?.value.trim() || "",
    imageDataUrl: $("crmAiReceiptPreview")?.querySelector("img")?.src || "",
    imageTitle: $("crmManualExpenseTitle")?.value.trim() || "",
    items: manualExpenseDraftItems,
  });
  const existingExpenses = manualExpensesForFile(file).filter((entry) => entry.id !== expense.id);
  file.animusManualExpenses = [expense, ...existingExpenses];
  syncManualExpensesForFile(file);
  addSystemNote(file, `Expense ${manualExpenseEditingId ? "updated" : "saved"}${expense.vendor ? ` from ${expense.vendor}` : ""} for ${crmCurrency.format(expense.amount)}.`);
  syncFileExpensesToRevenue(file);
  saveCrmFiles();
  saveRevenueRows();
  clearManualExpenseForm();
  renderManualExpenses();
  renderRevenue();
  saveExpenseChangeToCloud("Expense saved to Cloudflare.");
  setManualExpenseStatus("Expense saved to this file.", "good");
}

function deleteManualExpense(expenseId) {
  const file = normalizeCrmFile(activeFile());
  if (!file || !expenseId) return;
  const before = manualExpensesForFile(file).length;
  file.animusManualExpenses = manualExpensesForFile(file).filter((expense) => expense.id !== expenseId);
  if (file.animusManualExpenses.length === before) return;
  syncManualExpensesForFile(file);
  addSystemNote(file, "Expense deleted.");
  syncFileExpensesToRevenue(file);
  saveCrmFiles();
  saveRevenueRows();
  renderManualExpenses();
  renderRevenue();
  saveExpenseChangeToCloud("Expense deleted and saved to Cloudflare.");
  setManualExpenseStatus("Expense deleted.", "good");
}

fileExpenseTotal = function fileExpenseTotalManual(file) {
  if (Array.isArray(file?.animusManualExpenses) && file.animusManualExpenses.length) {
    syncManualExpensesForFile(file);
  } else if (Array.isArray(file?.freshExpenseReceipts) && file.freshExpenseReceipts.length) {
    rebuildFreshFileExpenses(file);
  } else {
    restoreExpenseLinesFromReceiptHistory(file);
  }
  return (Array.isArray(file?.expenseLines) ? file.expenseLines : []).reduce((sum, line) => sum + receiptExpenseLineAmount(line), 0);
};

syncFileExpensesToRevenue = function syncFileExpensesToRevenueManual(file) {
  if (!file) return;
  if (Array.isArray(file.animusManualExpenses) && file.animusManualExpenses.length) {
    syncManualExpensesForFile(file);
  } else if (Array.isArray(file.freshExpenseReceipts) && file.freshExpenseReceipts.length) {
    rebuildFreshFileExpenses(file);
  } else {
    restoreExpenseLinesFromReceiptHistory(file);
    syncReceiptHistoryFromExpenseLines(file);
  }
  const row = ensureExpenseRevenueRowForFile(file);
  if (!row) return;
  row.dashboardFileId = file.id || row.dashboardFileId || "";
  row.fileNumber = file.fileNumber || row.fileNumber || "";
  if (!row.clientJob || row.clientJob === "Unnamed Client") row.clientJob = revenueLabelForFile(file);
  row.expenses = fileExpenseTotal(file);
  row.expenseLines = Array.isArray(file.expenseLines) ? file.expenseLines.map((line) => ({ ...line })) : [];
  syncRevenueExpenseTotal(row);
  saveRevenueRows();
};

renderFileExpenses = renderManualExpenses;
freshExpenseAddManualDraft = function inactiveFreshExpenseAddManualDraftFinal() {};
freshExpenseAttachReceipt = function inactiveFreshExpenseAttachReceiptFinal() {};
freshExpenseSave = function inactiveFreshExpenseSaveFinal() {};
freshExpenseClearDraft = function inactiveFreshExpenseClearDraftFinal() {};
freshExpenseAddReceiptLine = function inactiveFreshExpenseAddReceiptLineFinal() {};
freshExpenseSaveBatch = function inactiveFreshExpenseSaveBatchFinal() {};

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
document.addEventListener("click", (event) => {
  const filterToggle = event.target.closest?.("#animusWorkFileFilterButton");
  if (filterToggle) {
    event.preventDefault();
    event.stopPropagation();
    const menu = $("animusWorkFileFilterMenu");
    if (!menu) return;
    menu.hidden = !menu.hidden;
    filterToggle.setAttribute("aria-expanded", String(!menu.hidden));
    return;
  }
  const collapseToggle = event.target.closest?.("#animusWorkFilesCollapse");
  if (collapseToggle) {
    const layout = document.querySelector(".animus-work-files-layout");
    if (!layout) return;
    const collapsed = layout.classList.toggle("animus-work-files-collapsed");
    collapseToggle.setAttribute("aria-expanded", String(!collapsed));
    collapseToggle.setAttribute("title", collapsed ? "Expand Work Files" : "Collapse Work Files");
    collapseToggle.textContent = collapsed ? "›" : "‹";
    return;
  }
  if (!event.target.closest?.(".animus-work-file-filter-menu")) {
    const menu = $("animusWorkFileFilterMenu");
    if (menu && !menu.hidden) {
      menu.hidden = true;
      $("animusWorkFileFilterButton")?.setAttribute("aria-expanded", "false");
    }
  }
});
$("animusWorkFileSearch")?.addEventListener("input", renderCrm);
$("animusWorkFileSearchButton")?.addEventListener("click", renderCrm);
$("animusWorkFileSort")?.addEventListener("change", renderCrm);
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
$("crmReceiptAddLine")?.addEventListener("click", () => addReceiptLine());
$("crmReceiptUpdatePrices")?.addEventListener("click", updatePriceDatabaseFromReceipt);
$("crmReceiptClear")?.addEventListener("click", clearReceiptScanner);
$("crmReceiptParsePaste")?.addEventListener("click", parseReceiptPaste);
$("crmPriceReceiptUpload")?.addEventListener("change", (event) => {
  uploadReceiptForPrices(event.target.files[0]);
  event.target.value = "";
});
["crmReceiptVendor", "crmReceiptDate", "crmReceiptCategory"].forEach((id) => {
  const element = $(id);
  if (!element) return;
  element.addEventListener("input", captureReceiptDraftFields);
  element.addEventListener("change", captureReceiptDraftFields);
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
$("crmTopNotifications")?.addEventListener("click", () => {
  if (document.body.dataset.animusView !== "dashboard") {
    switchCrmView("dashboard");
    window.setTimeout(() => document.querySelector(".animus-attention-card")?.scrollIntoView({ behavior:"smooth", block:"start" }), 0);
    return;
  }
  document.querySelector(".animus-attention-card")?.scrollIntoView({ behavior:"smooth", block:"start" });
});
$("crmLoadCloud").addEventListener("click", () => {
  loadDashboardFromGoogle().catch((error) => {
    window.alert(error?.message || "Command Center could not be restored from Cloudflare.");
  });
});
$("crmImportBackupFile")?.addEventListener("click", () => $("crmBackupFileUpload")?.click());
$("crmBackupFileUpload")?.addEventListener("change", (event) => {
  importDashboardBackupFile(event.target.files?.[0]);
  event.target.value = "";
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
$("crmCreateSupplement").addEventListener("click", () => createSupplementForFile());
$("crmOpenAssignment").addEventListener("click", () => openActiveEstimate("#assignment"));
$("crmOpenInvoice").addEventListener("click", openActiveInvoice);
$("crmOpenExpenses").addEventListener("click", () => {
  refreshCrmFilesFromStorage();
  saveActiveFile();
  switchCrmView("expenses", { expenseScope: "file" });
});
$("crmEstimatorOpenFile")?.addEventListener("click", () => switchCrmView("files"));
$("crmEstimatorOpenEstimate")?.addEventListener("click", () => openActiveEstimate());
$("crmEstimatorCreateSupplement")?.addEventListener("click", () => createSupplementForFile());
$("crmEstimatorOpenInvoice")?.addEventListener("click", () => openActiveInvoice());
$("crmEstimatorOpenAssignment")?.addEventListener("click", () => openActiveEstimate("#assignment"));
window.addEventListener("storage", (event) => {
  if (event.key !== "d2EstimateStudio" || !event.newValue) return;
  try {
    syncSupplementFromEstimator(JSON.parse(event.newValue));
  } catch (error) {
    // An incomplete local draft should never interrupt work in the estimator.
  }
});
window.addEventListener("message", (event) => {
  if (event.origin !== window.location.origin) return;
  if (event.data?.type === "animus-supplement-saved") {
    syncSupplementFromEstimator(event.data.estimate);
    return;
  }
  if (event.data?.type === "animus-supplement-discarded") {
    const file = crmFiles.find((entry) => entry.id === event.data.fileId);
    if (file) activeFileId = file.id;
    switchCrmView("files");
    renderCrm();
  }
});
$("crmEstimateChoiceClose").addEventListener("click", closeEstimateChoiceDialog);
$("crmEstimateChoiceModal").addEventListener("click", (event) => {
  if (event.target.id === "crmEstimateChoiceModal") closeEstimateChoiceDialog();
});
$("crmExpenseNoteClose").addEventListener("click", closeExpenseNoteModal);
$("crmExpenseNoteSave").addEventListener("click", saveExpenseNoteModal);
$("crmExpenseNoteModal").addEventListener("click", (event) => {
  if (event.target.id === "crmExpenseNoteModal") closeExpenseNoteModal();
});
$("crmPartsImportClose").addEventListener("click", closePartsImportModal);
$("crmPartsImportConfirm").addEventListener("click", confirmPartsImportModal);
$("crmPartsImportModal").addEventListener("click", (event) => {
  if (event.target.id === "crmPartsImportModal") closePartsImportModal();
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
  if (event.key === "Escape" && !$("crmExpenseNoteModal").hidden) closeExpenseNoteModal();
  if (event.key === "Escape" && !$("crmPartsImportModal").hidden) closePartsImportModal();
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
$("crmAddPayrollRow").addEventListener("click", addPayrollRow);
$("crmUpdatePayroll").addEventListener("click", updatePayrollRows);
$("crmPayrollYearFilter").addEventListener("change", (event) => {
  crmPayrollYearFilter = event.target.value;
  renderPayroll();
});
$("crmPayrollStatusFilter").addEventListener("change", (event) => {
  crmPayrollStatusFilter = event.target.value;
  renderPayroll();
});
$("crmAddFileExpense")?.addEventListener("click", freshExpenseAddManualDraft);
$("crmReceiptUpload")?.addEventListener("change", (event) => {
  freshExpenseAttachReceipt(event.target.files);
  event.target.value = "";
});
$("crmReadReceiptText")?.addEventListener("click", readPastedReceiptTextForFile);
$("crmImportReceiptToPrices")?.addEventListener("click", importFileReceiptToPriceDatabase);
$("crmSaveScannedReceipt")?.addEventListener("click", freshExpenseSave);
$("crmClearScannedReceipt")?.addEventListener("click", freshExpenseClearDraft);
$("crmAddReceiptExpenseLine")?.addEventListener("click", freshExpenseAddReceiptLine);
$("crmSaveAllReceipts")?.addEventListener("click", freshExpenseSaveBatch);
$("crmClearBulkReceipts")?.addEventListener("click", clearBulkReceiptDrafts);
$("crmSaveManualExpense")?.addEventListener("click", saveManualExpense);
$("crmClearManualExpense")?.addEventListener("click", () => {
  clearManualExpenseForm();
  setManualExpenseStatus("Manual expense cleared.");
});
$("crmAddManualExpense")?.addEventListener("click", () => {
  clearManualExpenseForm();
  setManualExpenseStatus("Ready for a new expense.");
});
$("crmManualAddExpenseItem")?.addEventListener("click", () => addManualExpenseItem());
$("crmManualImportItemsToPrices")?.addEventListener("click", importManualExpenseItemsToPrices);
$("crmScanReceiptExpense")?.addEventListener("click", () => {
  $("crmAiReceiptUpload")?.click();
});
$("crmAiReceiptUpload")?.addEventListener("change", (event) => {
  scanManualExpenseReceipt(event.target.files);
  event.target.value = "";
});
document.addEventListener("click", (event) => {
  const openExpense = event.target.closest("[data-manual-expense-open]");
  if (openExpense && !event.target.closest("[data-manual-expense-delete]")) {
    openManualExpense(openExpense.dataset.manualExpenseOpen);
    return;
  }
  const itemDelete = event.target.closest("[data-manual-expense-item-delete]");
  if (itemDelete) {
    deleteManualExpenseItem(itemDelete.dataset.manualExpenseItemDelete);
    return;
  }
  const noteButton = event.target.closest("[data-file-expense-note]");
  if (noteButton) {
    openExpenseNoteModal(noteButton.dataset.fileExpenseNote);
    return;
  }
  const deleteExpense = event.target.closest("[data-manual-expense-delete]");
  if (deleteExpense) {
    deleteManualExpense(deleteExpense.dataset.manualExpenseDelete);
  }
});
document.addEventListener("change", (event) => {
  if (event.target.closest("[data-manual-expense-item-field]")) captureManualExpenseItems();
});
[
  "crmFileReceiptVendor",
  "crmFileReceiptDate",
  "crmFileReceiptCategory",
  "crmFileReceiptOtherCategory",
  "crmFileReceiptAmount",
  "crmFileReceiptPayment",
  "crmFileReceiptCard",
  "crmFileReceiptImageTitle",
  "crmFileReceiptNotes",
  "crmFileReceiptOcrText",
].forEach((id) => {
  const element = $(id);
  if (!element) return;
  element.addEventListener("input", () => {
    freshExpenseCaptureDraft();
    toggleFileReceiptConditionalFields();
  });
  element.addEventListener("change", () => {
    freshExpenseCaptureDraft();
    toggleFileReceiptConditionalFields();
  });
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
  const intakeModal = $("animusNewFileModal");
  if (intakeModal && !intakeModal.hidden) return;
  if (refreshCrmFilesFromStorage()) renderCrm();
});

$("crmFileStatus").addEventListener("change", () => {
  renderStatusDetailOptions(activeFile());
  handleStatusWorkflow();
});
$("crmLeadSource")?.addEventListener("change", toggleAngiLeadFeeField);
$("crmStatusDetail").addEventListener("change", handleStatusWorkflow);

crmFields.forEach((field) => {
  const element = $(`crm${field[0].toUpperCase()}${field.slice(1)}`);
  if (!element) return;
  element.addEventListener("input", saveActiveFileDraft);
  element.addEventListener("change", saveActiveFileDraft);
});

window.addEventListener("pagehide", () => { saveNewFileDraftNow(); flushActiveFileDraft(); });
window.addEventListener("blur", () => { saveNewFileDraftNow(); flushActiveFileDraft(); });
document.addEventListener("visibilitychange", () => {
  if (document.hidden) flushActiveFileDraft();
});

document.querySelectorAll("input, select, textarea").forEach((element) => {
  if (element.closest("#crmExpensesView")) return;
  if (["crmFileStatus", "crmStatusDetail", "crmEstimateAmountInput", "crmMaterialAmountInput", "crmNewNote"].includes(element.id)) return;
  element.addEventListener("change", (event) => {
    handleCrmControlWorkflow(event);
    saveActiveFile();
    renderCrm();
  });
});

document.addEventListener("click", (event) => {
  const button = event.target.closest?.("button");
  if (!button) return;
  const expenseOpenId = button.dataset.animusExpenseOpen || button.dataset.freshExpenseOpen;
  const expenseDeleteId = button.dataset.animusExpenseDelete || button.dataset.freshExpenseDelete;
  if (expenseOpenId) {
    event.preventDefault();
    event.stopImmediatePropagation();
    freshExpenseOpenReceipt(expenseOpenId);
    return;
  }
  if (expenseDeleteId) {
    event.preventDefault();
    event.stopImmediatePropagation();
    freshExpenseDeleteReceipt(expenseDeleteId);
    return;
  }
  const expenseActions = {
    crmAddFileExpense: freshExpenseAddManualDraft,
    crmSaveScannedReceipt: freshExpenseSave,
    crmClearScannedReceipt: freshExpenseClearDraft,
    crmAddReceiptExpenseLine: freshExpenseAddReceiptLine,
    crmSaveAllReceipts: freshExpenseSaveBatch,
  };
  const action = expenseActions[button.id];
  if (!action) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  action();
}, true);

// Expenses v4 has one source of truth. Earlier receipt systems are deliberately
// ignored once this ledger is created for a file.
let expenseLedgerV4EditingId = "";

function cleanExpenseLedgerV4Entry(entry = {}) {
  const items = Array.isArray(entry.items) ? entry.items.map(cleanManualExpenseItem) : [];
  const itemTotal = items.reduce((sum, item) => item.use === false ? sum : sum + parseMoney(item.price), 0);
  return {
    id: entry.id || makeCrmId("expense-v4"),
    createdAt: entry.createdAt || new Date().toISOString(),
    updatedAt: entry.updatedAt || entry.createdAt || new Date().toISOString(),
    date: entry.date || todayIso(0), vendor: entry.vendor || "", title: entry.title || "",
    category: entry.category || "Supplies", paymentType: entry.paymentType || "",
    amount: parseMoney(entry.amount) || itemTotal, notes: entry.notes || "",
    imageDataUrl: entry.imageDataUrl || "", imageTitle: entry.imageTitle || entry.title || "", items,
  };
}

function expenseLedgerV4ForFile(file) {
  if (!file) return [];
  file.animusExpenseLedgerV4 = Array.isArray(file.animusExpenseLedgerV4)
    ? file.animusExpenseLedgerV4.map(cleanExpenseLedgerV4Entry) : [];
  return file.animusExpenseLedgerV4;
}

// The receipt scanner and the manual form both feed this one ledger. Older
// scanner saves arrive as freshExpenseReceipts, so migrate them before the
// ledger writes its mirrors. This prevents a second scanned receipt from
// replacing the first one.
function absorbFreshReceiptsIntoExpenseLedgerV4(file) {
  if (!file || !Array.isArray(file.freshExpenseReceipts) || !file.freshExpenseReceipts.length) return false;

  const existing = expenseLedgerV4ForFile(file);
  const existingIds = new Set(existing.map((entry) => String(entry.id || "")));
  const additions = file.freshExpenseReceipts
    .filter((receipt) => receipt && !existingIds.has(String(receipt.id || "")))
    .map((receipt) => {
      const items = (Array.isArray(receipt.lines) ? receipt.lines : [])
        .filter((line) => line?.use !== false)
        .map((line) => cleanManualExpenseItem({
          id: line.id || makeCrmId("expense-item"),
          name: line.description || line.note || "Receipt item",
          price: parseMoney(line.price || line.baseAmount || line.amount),
          use: line.use !== false,
        }));
      const itemTotal = items.reduce((sum, item) => sum + parseMoney(item.price), 0);
      const receiptTotal = (Array.isArray(receipt.lines) ? receipt.lines : []).reduce((sum, line) => {
        if (line?.use === false) return sum;
        const price = parseMoney(line.price || line.baseAmount || line.amount);
        const tax = line?.addTax ? price * (Number(line.taxRate) || DEFAULT_EXPENSE_TAX_RATE) : 0;
        return sum + price + tax;
      }, 0);
      return cleanExpenseLedgerV4Entry({
        id: receipt.id || makeCrmId("expense-v4"),
        createdAt: receipt.createdAt || receipt.savedAt || new Date().toISOString(),
        updatedAt: receipt.updatedAt || receipt.createdAt || receipt.savedAt || new Date().toISOString(),
        date: receipt.date || todayIso(0),
        vendor: receipt.vendor || "",
        title: receipt.imageTitle || receipt.fileName || receipt.vendor || "Scanned receipt",
        category: receipt.category || "Supplies",
        paymentType: [receipt.paymentType, receipt.paymentCard].filter(Boolean).join(" - "),
        amount: receiptTotal || parseMoney(receipt.amount) || itemTotal,
        notes: receipt.notes || "",
        imageDataUrl: receipt.imageDataUrl || "",
        imageTitle: receipt.imageTitle || receipt.fileName || receipt.vendor || "",
        items,
      });
    });

  if (!additions.length) return false;
  file.animusExpenseLedgerV4 = mergeManualExpenseArrays(existing, additions);
  return true;
}

function syncExpenseLedgerV4(file) {
  if (!file) return;
  absorbFreshReceiptsIntoExpenseLedgerV4(file);
  const entries = expenseLedgerV4ForFile(file);
  file.expenseLines = entries.map((entry) => ({
    id: entry.id, receiptGroupId: entry.id, date: entry.date, vendor: entry.vendor,
    category: entry.category, note: entry.notes || entry.title || "Expense", baseAmount: entry.amount,
    amount: entry.amount, tax: 0, addTax: false, paymentType: entry.paymentType,
    receiptFileName: entry.imageTitle || entry.title || "", receiptDataUrl: entry.imageDataUrl || "",
    receiptSource: "ANIMUS expense ledger",
  }));
  file.animusManualExpenses = [];
  file.freshExpenseReceipts = [];
  file.expenseReceipts = [];
  file.receiptHistory = [];
}

const legacySyncExpenseFileForStorage = syncExpenseFileForStorage;
syncExpenseFileForStorage = function syncExpenseFileForStorageV4(file) {
  if (file && Array.isArray(file.animusExpenseLedgerV4)) return syncExpenseLedgerV4(file);
  return legacySyncExpenseFileForStorage(file);
};

function expenseLedgerV4Total(file) {
  return expenseLedgerV4ForFile(file).reduce((sum, entry) => sum + parseMoney(entry.amount), 0);
}

fileExpenseTotal = function fileExpenseTotalV4(file) {
  if (file && Array.isArray(file.animusExpenseLedgerV4)) {
    syncExpenseLedgerV4(file);
    return expenseLedgerV4Total(file);
  }
  return (file?.expenseLines || []).reduce((sum, line) => sum + receiptExpenseLineAmount(line), 0);
};

syncFileExpensesToRevenue = function syncFileExpensesToRevenueV4(file) {
  if (!file) return;
  if (Array.isArray(file.animusExpenseLedgerV4)) syncExpenseLedgerV4(file);
  const row = ensureExpenseRevenueRowForFile(file);
  if (!row) return;
  row.dashboardFileId = file.id || row.dashboardFileId || "";
  row.fileNumber = file.fileNumber || row.fileNumber || "";
  if (!row.clientJob || row.clientJob === "Unnamed Client") row.clientJob = revenueLabelForFile(file);
  const recordedExpenses = fileExpenseTotal(file);
  const hasExpenseRecords = (file.expenseLines || []).length > 0
    || (file.animusExpenseLedgerV4 || []).length > 0;
  // Keep the estimate's material cost when the job has not recorded receipts yet.
  // Once receipts/manual expenses exist, they become the reported expense total.
  if (hasExpenseRecords) {
    row.expenses = recordedExpenses;
    row.expenseLines = (file.expenseLines || []).map((line) => ({ ...line }));
  } else if (!(Number(row.expenses) || 0)) {
    row.expenses = revenueMaterialForFile(file);
  }
  syncRevenueExpenseTotal(row);
  saveRevenueRows();
};

function reconcileSavedExpenseLedgersToRevenue() {
  let changed = false;
  crmFiles.forEach((file) => {
    if (!Array.isArray(file?.animusExpenseLedgerV4) || !file.animusExpenseLedgerV4.length) return;
    if (file.revenueExcluded === true) return;
    const row = ensureExpenseRevenueRowForFile(file);
    if (!row) return;
    const total = expenseLedgerV4Total(file);
    const lines = (file.expenseLines || []).map((line) => ({ ...line }));
    if (Number(row.expenses) !== total || JSON.stringify(row.expenseLines || []) !== JSON.stringify(lines)) {
      row.expenses = total;
      row.expenseLines = lines;
      syncRevenueExpenseTotal(row);
      changed = true;
    }
  });
  if (changed) saveRevenueRows();
  return changed;
}

function renderExpenseLedgerV4() {
  const file = normalizeCrmFile(activeFile());
  const title = $("crmExpensesFileTitle"), heading = $("crmManualExpenseHeading"), total = $("crmManualExpenseTotal");
  const rows = $("crmManualExpenseRows"), cards = $("crmManualExpenseCards");
  if (!rows) return;
  if (!file) {
    if (title) title.textContent = "Select a file to track expenses.";
    if (heading) heading.textContent = "No file selected";
    if (total) total.textContent = crmCurrency.format(0);
    if (cards) cards.innerHTML = `<p class="crm-empty-state">Select a file before adding expenses.</p>`;
    rows.innerHTML = `<tr><td colspan="8">Select a file before adding expenses.</td></tr>`;
    return;
  }
  const entries = expenseLedgerV4ForFile(file).slice().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  syncExpenseLedgerV4(file);
  if (title) title.textContent = `${file.fileNumber || "Project"} · ${file.clientName || "Unnamed Client"}`;
  if (heading) heading.textContent = `${file.clientName || "Unnamed Client"} Expenses`;
  if (total) total.textContent = crmCurrency.format(expenseLedgerV4Total(file));
  if (cards) cards.innerHTML = entries.length ? entries.map((entry) => `
    <article class="crm-manual-expense-card crm-receipt-history-item" data-expense-v4-open="${escapeHtml(entry.id)}">
      <span><strong>${escapeHtml(entry.title || entry.vendor || "Untitled expense")}</strong><small>${escapeHtml(manualExpenseDisplayDate(entry.date) || "No date")}</small></span>
      <span class="crm-receipt-history-amount"><b>${crmCurrency.format(entry.amount)}</b><button type="button" class="danger-link" data-expense-v4-delete="${escapeHtml(entry.id)}">Delete</button></span>
    </article>`).join("") : `<p class="crm-empty-state">No expenses saved for this file yet.</p>`;
  rows.innerHTML = entries.length ? entries.map((entry) => `<tr><td>${escapeHtml(manualExpenseDisplayDate(entry.date))}</td><td>${escapeHtml(entry.title || "")}</td><td>${escapeHtml(entry.vendor || "No vendor")}</td><td>${escapeHtml(entry.category || "Supplies")}</td><td>${escapeHtml(entry.paymentType || "")}</td><td><button type="button" class="crm-expense-note-button" data-expense-v4-open="${escapeHtml(entry.id)}"><span>${entry.notes ? "View notes" : "No notes"}</span></button></td><td>${crmCurrency.format(entry.amount)}</td><td><button type="button" class="danger-link" data-expense-v4-delete="${escapeHtml(entry.id)}">Delete</button></td></tr>`).join("") : `<tr><td colspan="8">No expenses saved for this file yet.</td></tr>`;
}

function clearExpenseLedgerV4Form() {
  expenseLedgerV4EditingId = "";
  clearManualExpenseForm();
  setManualExpenseStatus("Ready for a new expense.");
}

function openExpenseLedgerV4Entry(entryId) {
  const file = normalizeCrmFile(activeFile());
  const entry = expenseLedgerV4ForFile(file).find((item) => item.id === entryId);
  if (!entry) return;
  expenseLedgerV4EditingId = entry.id;
  manualExpenseDraftItems = entry.items.map(cleanManualExpenseItem);
  $("crmManualExpenseDate").value = entry.date || todayIso(0);
  $("crmManualExpenseVendor").value = entry.vendor || "";
  $("crmManualExpenseTitle").value = entry.title || "";
  $("crmManualExpenseCategory").value = manualExpenseSelectOptionValue("crmManualExpenseCategory", entry.category) || "Supplies";
  $("crmManualExpensePayment").value = manualExpenseSelectOptionValue("crmManualExpensePayment", entry.paymentType) || "";
  $("crmManualExpenseAmount").value = entry.amount ? String(entry.amount) : "";
  $("crmManualExpenseNotes").value = entry.notes || "";
  $("crmAiReceiptPreview").innerHTML = entry.imageDataUrl ? `<img src="${escapeHtml(entry.imageDataUrl)}" alt="Receipt preview"><p>${escapeHtml(entry.imageTitle || entry.title || "Receipt")}</p>` : `<div class="crm-receipt-preview-empty">No receipt photo saved for this expense.</div>`;
  renderManualExpenseItems();
  setManualExpenseStatus("Expense loaded for editing. Save Expense will update this entry.", "good");
}

function saveExpenseLedgerV4() {
  const file = normalizeCrmFile(activeFile());
  if (!file) return setManualExpenseStatus("Select a file before saving an expense.", "warn");
  captureManualExpenseItems();
  const amount = parseMoney($("crmManualExpenseAmount")?.value || 0) || manualExpenseItemTotal();
  if (!amount) return setManualExpenseStatus("Add a receipt total or one priced item before saving.", "warn");
  const entry = cleanExpenseLedgerV4Entry({
    id: expenseLedgerV4EditingId || undefined,
    date: $("crmManualExpenseDate").value || todayIso(0), vendor: $("crmManualExpenseVendor").value.trim(),
    title: $("crmManualExpenseTitle").value.trim(), category: $("crmManualExpenseCategory").value || "Supplies",
    paymentType: $("crmManualExpensePayment").value || "", amount, notes: $("crmManualExpenseNotes").value.trim(),
    imageDataUrl: $("crmAiReceiptPreview")?.querySelector("img")?.src || "", imageTitle: $("crmManualExpenseTitle").value.trim(), items: manualExpenseDraftItems,
  });
  const previous = expenseLedgerV4ForFile(file).filter((item) => item.id !== entry.id);
  file.animusExpenseLedgerV4 = [{ ...entry, updatedAt: new Date().toISOString() }, ...previous];
  syncExpenseLedgerV4(file);
  addSystemNote(file, `Expense ${expenseLedgerV4EditingId ? "updated" : "saved"}${entry.vendor ? ` from ${entry.vendor}` : ""} for ${crmCurrency.format(entry.amount)}.`);
  expenseLedgerV4EditingId = "";
  clearManualExpenseForm();
  syncFileExpensesToRevenue(file);
  reconcileSavedExpenseLedgersToRevenue();
  saveCrmFiles(); saveRevenueRows(); renderExpenseLedgerV4(); renderRevenue();
  saveExpenseChangeToCloud("Expense saved to Cloudflare.");
  setManualExpenseStatus("Expense saved to this file.", "good");
}

function deleteExpenseLedgerV4(entryId) {
  const file = normalizeCrmFile(activeFile());
  if (!file) return;
  file.animusExpenseLedgerV4 = expenseLedgerV4ForFile(file).filter((entry) => entry.id !== entryId);
  syncExpenseLedgerV4(file);
  addSystemNote(file, "Expense deleted.");
  syncFileExpensesToRevenue(file);
  saveCrmFiles(); saveRevenueRows(); renderExpenseLedgerV4(); renderRevenue();
  saveExpenseChangeToCloud("Expense deleted and saved to Cloudflare.");
}

renderFileExpenses = renderExpenseLedgerV4;
document.addEventListener("click", (event) => {
  const button = event.target.closest?.("button");
  if (!button) return;
  const openId = button.dataset.expenseV4Open, deleteId = button.dataset.expenseV4Delete;
  if (openId) { event.preventDefault(); event.stopImmediatePropagation(); openExpenseLedgerV4Entry(openId); return; }
  if (deleteId) { event.preventDefault(); event.stopImmediatePropagation(); deleteExpenseLedgerV4(deleteId); return; }
  if (button.id === "crmSaveManualExpense") { event.preventDefault(); event.stopImmediatePropagation(); saveExpenseLedgerV4(); }
  if (button.id === "crmClearManualExpense" || button.id === "crmAddManualExpense") { event.preventDefault(); event.stopImmediatePropagation(); clearExpenseLedgerV4Form(); }
}, true);

persistRestoredDashboardIfNeeded();
switchCrmView(initialDashboardView());
applyInitialFileRoute();
renderCrm();
autoRestoreDashboardFromCloud();
