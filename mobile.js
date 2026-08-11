const MOBILE_STORAGE_KEY = "d2CrmDemoFiles";
const MOBILE_REVENUE_KEY = "d2CrmRevenueRows";
const MOBILE_PRICE_KEY = "d2PriceDatabase";
const MOBILE_DELETED_PRICE_KEY = "d2PriceDeletedIds";
const MOBILE_EXTERNAL_CALENDAR_KEY = "d2ExternalCalendarEvents";
const MOBILE_GOOGLE_SCRIPT_KEY = "d2GoogleScriptUrl";
const MOBILE_RESTORE_VERSION_KEY = "d2MobileDashboardRestoreVersion";
const MOBILE_CLOUD_SYNC_KEY = "d2MobileCloudSyncedAt";
const MOBILE_DEFAULT_GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzZkie1W4LplkKwFoMq19suIHWsamKYNUwCt9xjnihTdy_dN271ou3lscTgq09bAGIG2w/exec";

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
let mobileCloudAutosaveTimer = null;
let mobileCloudHydrated = false;
let mobileCloudSaveInFlight = false;

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
  return {
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
    notes: Array.isArray(file.notes) ? file.notes : [],
    timeline: Array.isArray(file.timeline) ? file.timeline : [],
    ...file,
  };
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

function mergeMobileRows(primary = [], secondary = []) {
  const merged = [];
  const seen = new Set();
  [...primary, ...secondary].forEach((row) => {
    const key = String(row.fileNumber || row.id || row.clientName || row.clientJob || row.name || "").trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push({ ...row });
  });
  return merged;
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
  if (!mobileActiveFileId && mobileFiles[0]) mobileActiveFileId = mobileFiles[0].id;
}

function saveLocalData() {
  localStorage.setItem(MOBILE_STORAGE_KEY, JSON.stringify(mobileFiles));
  localStorage.setItem(MOBILE_REVENUE_KEY, JSON.stringify(mobileRevenueRows));
  localStorage.setItem(MOBILE_PRICE_KEY, JSON.stringify(mobilePriceRows));
  localStorage.setItem(MOBILE_DELETED_PRICE_KEY, JSON.stringify(mobileDeletedPriceIds));
  localStorage.setItem(MOBILE_EXTERNAL_CALENDAR_KEY, JSON.stringify(mobileExternalCalendarEvents));
  scheduleMobileCloudSave();
}

function googleScriptUrl() {
  return localStorage.getItem(MOBILE_GOOGLE_SCRIPT_KEY) || MOBILE_DEFAULT_GOOGLE_SCRIPT_URL;
}

function syncPayload() {
  captureDetailFields();
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

function fetchCloudDashboard() {
  return new Promise((resolve, reject) => {
    const callbackName = `animusMobileCloud${Date.now()}${Math.random().toString(16).slice(2)}`;
    const script = document.createElement("script");
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("Cloud load timed out."));
    }, 20000);
    function cleanup() {
      window.clearTimeout(timer);
      delete window[callbackName];
      script.remove();
    }
    window[callbackName] = (response) => {
      cleanup();
      if (!response || response.ok === false) {
        reject(new Error(response?.error || "Cloud load failed."));
        return;
      }
      resolve(response.dashboard || null);
    };
    const url = new URL(googleScriptUrl());
    url.searchParams.set("action", "dashboardData");
    url.searchParams.set("callback", callbackName);
    script.onerror = () => {
      cleanup();
      reject(new Error("Cloud load could not connect."));
    };
    script.src = url.toString();
    document.body.appendChild(script);
  });
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
  const payload = syncPayload();
  await postToGoogle(payload);
  markMobileCloudSyncedAt(payload.syncedAt);
  $("mobileSaveCloud").classList.remove("saving");
  $("mobileSaveCloud").classList.add("saved");
  window.setTimeout(() => $("mobileSaveCloud").classList.remove("saved"), 900);
}

async function loadCloud() {
  const dashboard = await fetchCloudDashboard();
  if (!dashboard) {
    window.alert("No cloud dashboard was found yet.");
    return;
  }
  applyMobileDashboardSnapshot(dashboard);
  renderAll();
  window.alert("ANIMUS Mobile loaded the latest cloud data.");
}

function markMobileCloudSyncedAt(value) {
  try {
    localStorage.setItem(MOBILE_CLOUD_SYNC_KEY, value || new Date().toISOString());
  } catch (error) {
    // Some mobile browsers block localStorage writes.
  }
}

function mobileCloudSyncedAt() {
  try {
    return localStorage.getItem(MOBILE_CLOUD_SYNC_KEY) || "";
  } catch (error) {
    return "";
  }
}

function isMobileCloudDashboardNewer(dashboard) {
  if (!dashboard) return false;
  const cloudTime = Date.parse(dashboard.syncedAt || "");
  const localTime = Date.parse(mobileCloudSyncedAt() || "");
  if (!Number.isFinite(cloudTime)) return true;
  if (!Number.isFinite(localTime)) return true;
  return cloudTime > localTime;
}

function applyMobileDashboardSnapshot(dashboard) {
  mobileFiles = Array.isArray(dashboard.dashboardFiles) ? dashboard.dashboardFiles.map(normalizeFile) : [];
  mobileRevenueRows = Array.isArray(dashboard.revenueRows) ? dashboard.revenueRows : [];
  mobilePriceRows = Array.isArray(dashboard.priceRows) ? dashboard.priceRows : [];
  mobileDeletedPriceIds = Array.isArray(dashboard.deletedPriceIds) ? dashboard.deletedPriceIds : [];
  mobileActiveFileId = mobileFiles[0]?.id || "";
  markMobileCloudSyncedAt(dashboard.syncedAt);
  localStorage.setItem(MOBILE_STORAGE_KEY, JSON.stringify(mobileFiles));
  localStorage.setItem(MOBILE_REVENUE_KEY, JSON.stringify(mobileRevenueRows));
  localStorage.setItem(MOBILE_PRICE_KEY, JSON.stringify(mobilePriceRows));
  localStorage.setItem(MOBILE_DELETED_PRICE_KEY, JSON.stringify(mobileDeletedPriceIds));
}

async function hydrateMobileFromCloud() {
  try {
    const dashboard = await fetchCloudDashboard();
    if (dashboard && isMobileCloudDashboardNewer(dashboard)) {
      applyMobileDashboardSnapshot(dashboard);
      renderAll();
    }
  } catch (error) {
    // Keep the local mobile copy visible when the cloud cannot be reached.
  } finally {
    mobileCloudHydrated = true;
  }
}

function scheduleMobileCloudSave() {
  if (!mobileCloudHydrated || mobileCloudSaveInFlight) return;
  window.clearTimeout(mobileCloudAutosaveTimer);
  mobileCloudAutosaveTimer = window.setTimeout(async () => {
    mobileCloudSaveInFlight = true;
    try {
      const payload = syncPayload();
      await postToGoogle(payload);
      markMobileCloudSyncedAt(payload.syncedAt);
    } finally {
      mobileCloudSaveInFlight = false;
    }
  }, 2500);
}

function setTab(tab) {
  captureDetailFields();
  mobileCurrentTab = tab;
  document.querySelectorAll(".mobile-view").forEach((view) => view.classList.remove("active"));
  document.querySelectorAll("[data-mobile-tab]").forEach((button) => button.classList.toggle("active", button.dataset.mobileTab === tab));
  const titleMap = { files: "Command Center", detail: "File Details", calendar: "Calendar", estimate: "Estimator", revenue: "Revenue", more: "More" };
  $("mobileViewTitle").textContent = titleMap[tab] || "ANIMUS";
  const view = $(`mobile${tab[0].toUpperCase()}${tab.slice(1)}View`);
  if (view) view.classList.add("active");
  if (tab === "calendar") renderCalendar();
  if (tab === "revenue") renderRevenue();
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
$("mobileOpenExpenses").addEventListener("click", () => setTab("revenue"));
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
hydrateMobileFromCloud();
