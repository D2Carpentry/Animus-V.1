const API = "https://animus-v-1.pages.dev/api/dashboard";
const RECEIPT_API = "https://animus-v-1.pages.dev/api/receipt";
const EXPENSE_API = "https://animus-v-1.pages.dev/api/expenses";
const $ = (id) => document.getElementById(id);
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

let state = { files: [], revenue: [], prices: [], payroll: [], deletedFileKeys: [], deletedPriceIds: [] };
let activeFileId = "";
let activeView = "home";
let activeFilter = "open";
let receiptDraft = null;
let receipts = [];
let receiptAbortController = null;
let receiptCaptureArmed = false;
let receiptReadToken = 0;

function escapeHtml(value = "") { return String(value).replace(/[&<>'"]/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#039;", '"':"&quot;" }[char])); }
function uid(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function parseMoney(value) { const result = Number.parseFloat(String(value ?? "").replace(/[^0-9.-]/g, "")); return Number.isFinite(result) ? result : 0; }
function dateToday() { return new Date().toISOString().slice(0, 10); }
function formatDate(value) { return value ? new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" }) : "No date"; }
function fileKey(file = {}) { return String(file.fileNumber || file.id || "").trim().toLowerCase(); }
function activeFile() { return state.files.find((file) => file.id === activeFileId) || state.files[0] || null; }
function statusClass(status = "") { return `status-${String(status).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`; }
function normalizeFile(file = {}) { return { ...file, id:file.id || uid("file"), fileNumber:file.fileNumber || "New File", clientName:file.clientName || "Unnamed Client", fileStatus:file.fileStatus || "New Lead", projectType:file.projectType || "Other", expenseLines:Array.isArray(file.expenseLines) ? file.expenseLines : [], receiptHistory:Array.isArray(file.receiptHistory) ? file.receiptHistory : [] }; }
function saveLocal() { /* Cloud-only mobile view intentionally keeps no browser data copy. */ }
function readLocal() { /* Cloud-only mobile view intentionally keeps no browser data copy. */ }
function notify(message, error = false) { $("cloudState").textContent = message; $("cloudState").style.color = error ? "#dc2626" : ""; }

function openView(view) {
  activeView = view;
  document.querySelectorAll(".view").forEach((node) => node.classList.toggle("active", node.id === `${view}View`));
  document.querySelectorAll("[data-view]").forEach((node) => node.classList.toggle("active", node.dataset.view === view));
  if (view === "home") renderHome();
  if (view === "files") renderFiles();
  if (view === "detail") renderDetail();
  if (view === "expenses") renderExpenses();
  if (view === "revenue") renderRevenue();
  window.scrollTo({ top:0, behavior:"instant" });
}

function countStatus(predicate) { return state.files.filter(predicate).length; }
function isClosed(file) { return ["Closed / Paid", "Job Lost / Closed"].includes(file.fileStatus); }
function isActive(file) { return ["In Progress", "Job Won", "Work Completed"].includes(file.fileStatus); }
function fileExpenseTotal(file) { return (file.expenseLines || []).reduce((sum, line) => sum + parseMoney(line.amount ?? line.lineTotal ?? line.total), 0); }
function financialTotals() { return state.revenue.reduce((sum, row) => { sum.gross += parseMoney(row.gross); sum.expenses += parseMoney(row.expenses); sum.labor += parseMoney(row.labor); return sum; }, { gross:0, expenses:0, labor:0 }); }

function renderHome() {
  const counts = [
    ["Open Files", countStatus((file) => !isClosed(file))], ["Active Jobs", countStatus(isActive)], ["In Negotiation", countStatus((file) => file.fileStatus === "In Negotiation")], ["Closed Files", countStatus(isClosed)],
  ];
  $("summaryGrid").innerHTML = counts.map(([label, value]) => `<article class="stat"><span>${label}</span><strong>${value}</strong><small>Live Cloudflare data</small></article>`).join("");
  const events = state.files.flatMap((file) => [[file.inspectionDate,"Inspection"],[file.startDate,"Start date"],[file.followUpDate,"Follow-up"]].filter(([date]) => date).map(([date,label]) => ({ date,label,file }))).filter((event) => event.date >= dateToday()).sort((a,b) => a.date.localeCompare(b.date)).slice(0,4);
  $("todayList").innerHTML = events.length ? events.map((event) => `<button class="compact-item" type="button" data-file="${escapeHtml(event.file.id)}"><strong>${escapeHtml(event.label)} · ${escapeHtml(event.file.clientName)}</strong><small>${formatDate(event.date)} · ${escapeHtml(event.file.fileNumber)}</small></button>`).join("") : `<p class="subcopy">No upcoming dates are set.</p>`;
  bindFileLinks();
}

function filteredFiles() {
  const query = $("fileSearch").value.trim().toLowerCase();
  return state.files.filter((file) => {
    const matches = activeFilter === "all" || (activeFilter === "open" && !isClosed(file) && !isActive(file)) || (activeFilter === "active" && isActive(file)) || (activeFilter === "closed" && isClosed(file));
    const text = `${file.fileNumber} ${file.clientName} ${file.clientPhone || ""} ${file.clientEmail || ""} ${file.projectAddress || ""}`.toLowerCase();
    return matches && (!query || text.includes(query));
  });
}
function renderFiles() {
  $("fileList").innerHTML = filteredFiles().map((file) => `<button type="button" class="file-row" data-file="${escapeHtml(file.id)}"><span><h3>${escapeHtml(file.clientName)}</h3><small>${escapeHtml(file.fileNumber)} · ${escapeHtml(file.projectType)}</small><span class="meta"><i class="badge ${statusClass(file.fileStatus)}">${escapeHtml(file.fileStatus)}</i></span></span><b class="arrow">›</b></button>`).join("") || `<section class="panel"><p class="subcopy">No work files in this view.</p></section>`;
  bindFileLinks();
}
function bindFileLinks() { document.querySelectorAll("[data-file]").forEach((button) => button.addEventListener("click", () => { activeFileId = button.dataset.file; saveLocal(); openView("detail"); })); }

function renderDetail() {
  const file = activeFile();
  if (!file) { $("fileDetail").innerHTML = `<section class="panel"><p class="subcopy">Choose a work file first.</p></section>`; return; }
  const paid = parseMoney(file.totalPaid) || parseMoney(file.initialDeposit) + parseMoney(file.midpointDeposit) + parseMoney(file.finalPaymentAmount);
  const estimate = parseMoney(file.estimateTotal); const balance = Math.max(estimate - paid, 0);
  $("fileDetail").innerHTML = `<header class="detail-header"><p class="eyebrow">${escapeHtml(file.fileNumber)}</p><h1>${escapeHtml(file.clientName)}</h1><p><i class="badge ${statusClass(file.fileStatus)}">${escapeHtml(file.fileStatus)}</i> <span>${escapeHtml(file.projectType)}</span></p></header><div class="detail-cards"><article class="detail-card"><span>Estimate</span><strong>${money.format(estimate)}</strong></article><article class="detail-card"><span>Paid</span><strong>${money.format(paid)}</strong></article><article class="detail-card"><span>Balance</span><strong>${money.format(balance)}</strong></article><article class="detail-card"><span>Expenses</span><strong>${money.format(fileExpenseTotal(file))}</strong></article></div><section class="panel"><div class="panel-heading"><div><p class="eyebrow">Customer</p><h2>Contact information</h2></div></div><div class="compact-list"><div class="compact-item"><strong>${escapeHtml(file.clientPhone || "No phone")}</strong><small>Phone</small></div><div class="compact-item"><strong>${escapeHtml(file.clientEmail || "No email")}</strong><small>Email</small></div><div class="compact-item"><strong>${escapeHtml(file.projectAddress || "No address")}</strong><small>Address</small></div></div></section><section class="panel"><div class="panel-heading"><div><p class="eyebrow">Documents</p><h2>Open file documents</h2></div></div><div class="document-actions"><button type="button" data-mobile-doc="estimate">View Estimate</button><button type="button" data-mobile-doc="supplement">Supplement</button><button type="button" data-mobile-doc="invoice">Invoice</button><button type="button" data-mobile-doc="workorder">Work Order</button></div></section><div class="detail-actions"><button type="button" id="detailReceipt" class="primary">Upload Receipt</button><button type="button" id="detailExpense">Expenses</button><button type="button" id="detailEstimate">Estimator</button><button type="button" id="detailEdit">Edit in desktop</button></div>`;
  document.querySelectorAll("[data-mobile-doc]").forEach((button) => button.addEventListener("click", () => openFileDocument(button.dataset.mobileDoc)));
  $("detailReceipt").addEventListener("click", receiptUploadSheet);
  $("detailExpense").addEventListener("click", async () => { await fetchReceipts(); openView("expenses"); });
  $("detailEstimate").addEventListener("click", () => openDesktop("estimate"));
  $("detailEdit").addEventListener("click", () => openDesktop("crm"));
}

function renderExpenses() {
  const file = activeFile();
  $("expenseHero").innerHTML = file ? `<p class="eyebrow">Current work file</p><h2>${escapeHtml(file.clientName)}</h2><p>${escapeHtml(file.fileNumber)} · ${escapeHtml(file.projectType)}</p><div class="expense-total"><span>File expenses</span><strong>${money.format(fileExpenseTotal(file))}</strong></div><div class="receipt-capture"><button type="button" id="takePhoto">Take photo</button><button type="button" id="uploadReceipt">Upload image or PDF</button></div>` : `<p class="eyebrow">Receipt capture</p><h2>Select a work file</h2><p>Every receipt must be assigned to a customer file before it can be saved.</p><button class="primary-action" type="button" id="chooseFileFirst">Choose work file</button>`;
  if (file) {
    $("takePhoto").addEventListener("click", () => { armReceiptCapture(); $("cameraInput").click(); });
    $("uploadReceipt").addEventListener("click", () => { armReceiptCapture(); $("uploadInput").click(); });
  } else { $("chooseFileFirst").addEventListener("click", chooseFileSheet); }
  renderReceiptReview(); renderReceiptHistory();
}

function renderReceiptReview() {
  const panel = $("receiptReview"); if (!receiptDraft) { panel.hidden = true; return; }
  panel.hidden = false;
  const itemRows = receiptDraft.items.map((item, index) => `<article class="receipt-item" data-item="${index}"><input data-field="name" value="${escapeHtml(item.name || "")}" placeholder="Item"><input data-field="total" value="${escapeHtml(item.total ?? "")}" inputmode="decimal" placeholder="0.00"><label><input data-field="use" type="checkbox" ${item.use !== false ? "checked" : ""}> Add this item</label></article>`).join("");
  const preview = receiptDraft.isPdf ? `<iframe src="${receiptDraft.imageDataUrl}" title="Receipt PDF"></iframe>` : `<img src="${receiptDraft.imageDataUrl}" alt="Receipt preview">`;
  panel.innerHTML = `<div class="review-heading"><div><p class="eyebrow">Review receipt</p><h2>${receiptDraft.ai ? "AI extraction ready" : "Receipt ready for review"}</h2></div><button type="button" id="cancelReceipt">Cancel</button></div><div class="review-preview">${preview}</div><div class="review-grid"><label>Date<input id="receiptDate" type="date" value="${escapeHtml(receiptDraft.date)}"></label><label>Vendor<input id="receiptVendor" value="${escapeHtml(receiptDraft.vendor)}" placeholder="Vendor"></label><label>Expense title<input id="receiptTitle" value="${escapeHtml(receiptDraft.title)}" placeholder="Receipt title"></label><label>Category<select id="receiptCategory">${categoryOptions(receiptDraft.category)}</select></label><label class="full">Notes<textarea id="receiptNotes" placeholder="Notes">${escapeHtml(receiptDraft.notes)}</textarea></label></div><div class="items-head"><h3>Items</h3><button type="button" id="addItem">+ Add item</button></div><div class="receipt-items">${itemRows || `<p class="subcopy">No items extracted. Add one below or save the receipt total.</p>`}</div><div class="review-actions"><button type="button" id="addItemBottom">Add item</button><button type="button" class="save" id="saveReceipt">Save expense</button></div>`;
  $("cancelReceipt").addEventListener("click", () => { receiptDraft = null; renderExpenses(); });
  $("addItem").addEventListener("click", addReceiptItem); $("addItemBottom").addEventListener("click", addReceiptItem); $("saveReceipt").addEventListener("click", saveReceipt);
}
function categoryOptions(selected = "Supplies") { return ["Supplies","Materials","Hardware","Paint / Finish","Equipment","Labor","Fuel","Other"].map((item) => `<option${item === selected ? " selected" : ""}>${item}</option>`).join(""); }
function addReceiptItem() { captureReceiptDraft(); receiptDraft.items.push({ name:"", total:"", use:true }); renderReceiptReview(); }
function captureReceiptDraft() { if (!receiptDraft || !$("receiptDate")) return; receiptDraft.date = $("receiptDate").value || dateToday(); receiptDraft.vendor = $("receiptVendor").value.trim(); receiptDraft.title = $("receiptTitle").value.trim(); receiptDraft.category = $("receiptCategory").value; receiptDraft.notes = $("receiptNotes").value.trim(); receiptDraft.items = [...document.querySelectorAll("[data-item]")].map((node) => ({ name:node.querySelector("[data-field='name']").value.trim(), total:node.querySelector("[data-field='total']").value, use:node.querySelector("[data-field='use']").checked })); }

function firstUrl(...values) { return values.find((value) => /^https?:|^data:application\/pdf|^blob:/i.test(String(value || ""))) || ""; }
function latestSupplement(file) { return (Array.isArray(file?.supplements) ? file.supplements : []).slice().sort((a,b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")))[0] || null; }
function documentUrlFor(file, type) {
  const supplement = latestSupplement(file);
  if (type === "estimate") return firstUrl(file.estimatePdfUrl, file.estimateUrl, file.editableEstimate?.pdfUrl, file.editableEstimate?.documentUrl);
  if (type === "supplement") return firstUrl(supplement?.pdfUrl, supplement?.documentUrl, supplement?.data?.pdfUrl, supplement?.data?.documentUrl);
  if (type === "invoice") return firstUrl(file.invoicePdfUrl, file.invoiceUrl, file.invoice?.pdfUrl, file.invoice?.documentUrl);
  if (type === "workorder") return firstUrl(file.workOrderPdfUrl, file.workOrderUrl, file.assignmentPdfUrl, file.assignmentUrl);
  return "";
}
function openFileDocument(type) {
  const file = activeFile();
  if (!file) return;
  const url = documentUrlFor(file, type);
  if (url) {
    window.open(url, "_blank", "noopener");
    return;
  }
  if (type === "invoice") {
    openDesktop("invoice");
    return;
  }
  if (type === "workorder") {
    openDesktop("workorder");
    return;
  }
  openDesktop("estimate");
}
function receiptUploadSheet() {
  openSheet(`<div class="sheet-heading"><div><p class="eyebrow">Receipt capture</p><h2>Upload receipt</h2></div><button class="sheet-close" type="button" data-close-sheet>×</button></div><div class="sheet-file-list"><button type="button" data-receipt-source="camera">Take photo with camera<small>Best for job-site receipt capture.</small></button><button type="button" data-receipt-source="file">Upload image or PDF<small>Choose an existing receipt file.</small></button></div>`);
  document.querySelectorAll("[data-receipt-source]").forEach((button) => button.addEventListener("click", () => {
    closeSheet();
    openView("expenses");
    armReceiptCapture();
    if (button.dataset.receiptSource === "camera") $("cameraInput").click();
    else $("uploadInput").click();
  }));
}

function renderReceiptHistory() {
  const file = activeFile(); const owned = file ? receipts.filter((receipt) => receipt.fileId === file.id || receipt.fileId === file.fileNumber) : [];
  $("receiptCount").textContent = owned.length; $("receiptHistory").innerHTML = owned.length ? owned.map((receipt) => `<button class="receipt-row" type="button" data-receipt="${escapeHtml(receipt.id)}"><span class="receipt-info"><h3>${escapeHtml(receipt.title || receipt.vendor || "Receipt")}</h3><small>${formatDate(receipt.date)} · ${escapeHtml(receipt.vendor || "No vendor")}</small></span><strong class="money">${money.format(parseMoney(receipt.amount))}</strong></button>`).join("") : `<p class="subcopy">No saved receipts for this work file.</p>`;
  document.querySelectorAll("[data-receipt]").forEach((button) => button.addEventListener("click", () => openReceipt(button.dataset.receipt)));
}
function openReceipt(id) { const receipt = receipts.find((entry) => entry.id === id); if (!receipt) return; receiptDraft = { ...receipt, imageDataUrl:receipt.receiptImageUrl || "", isPdf:String(receipt.receiptContentType || "").includes("pdf"), ai:false, items:(receipt.items || []).map((item) => ({ name:item.name, total:item.lineTotal || item.total || item.price, use:true })) }; renderExpenses(); window.scrollTo({ top:0, behavior:"smooth" }); }

async function prepareFile(file) {
  if (!file) return null;
  const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
  return { dataUrl, name:file.name || "receipt", isPdf:file.type === "application/pdf" };
}
async function receiveReceipt(file) {
  if (!receiptCaptureArmed || activeView !== "expenses") return;
  receiptCaptureArmed = false;
  const thisRead = ++receiptReadToken;
  const received = await prepareFile(file); if (!received || thisRead !== receiptReadToken) return; showBusy("Reading receipt...", "ANIMUS is identifying the vendor, date, total, and line items.");
  receiptAbortController?.abort();
  receiptAbortController = new AbortController();
  try {
    const response = await fetch(RECEIPT_API, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ imageDataUrl:received.dataUrl, fileName:received.name }), cache:"no-store", signal:receiptAbortController.signal });
    if (thisRead !== receiptReadToken) return;
    const result = await response.json().catch(() => ({})); const read = result.receipt || {};
    receiptDraft = { id:"", imageDataUrl:received.dataUrl, fileName:received.name, isPdf:received.isPdf, date:read.date || dateToday(), vendor:read.vendor || "", title:received.name.replace(/\.[^.]+$/, ""), category:read.category || "Supplies", notes:read.notes || "", items:(read.lineItems || []).map((item) => ({ name:item.name || "", total:item.total || item.lineTotal || item.price || "", use:true })), amount:read.total || "", ai:Boolean(result.aiAvailable) };
    if (!receiptDraft.items.length && receiptDraft.amount) receiptDraft.items.push({ name:receiptDraft.vendor || "Receipt expense", total:receiptDraft.amount, use:true });
  } catch (error) { if (error?.name === "AbortError") return; receiptDraft = { id:"", imageDataUrl:received.dataUrl, fileName:received.name, isPdf:received.isPdf, date:dateToday(), vendor:"", title:received.name.replace(/\.[^.]+$/, ""), category:"Supplies", notes:"", items:[], amount:"", ai:false }; }
  finally { receiptAbortController = null; hideBusy(); renderExpenses(); window.scrollTo({ top:0, behavior:"smooth" }); }
}
async function saveReceipt() {
  const file = activeFile(); if (!file) return; captureReceiptDraft(); const button = $("saveReceipt"); button.disabled = true; button.textContent = "Saving...";
  const items = receiptDraft.items.filter((item) => item.use && (item.name || parseMoney(item.total))).map((item) => ({ name:item.name || "Receipt item", price:parseMoney(item.total), lineTotal:parseMoney(item.total), category:receiptDraft.category }));
  const amount = items.reduce((sum,item) => sum + parseMoney(item.lineTotal), 0) || parseMoney(receiptDraft.amount);
  const record = { id:receiptDraft.id || uid("mobile-receipt"), fileId:file.id, date:receiptDraft.date, vendor:receiptDraft.vendor, title:receiptDraft.title || receiptDraft.vendor || "Receipt", category:receiptDraft.category, amount, notes:receiptDraft.notes, imageDataUrl:receiptDraft.imageDataUrl, items };
  try {
    const response = await fetch(EXPENSE_API, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ fileId:file.id, expense:record }), cache:"no-store" }); const result = await response.json().catch(() => ({})); if (!response.ok || result.ok === false) throw new Error(result.error || "Receipt could not be saved.");
    const saved = result.expense; receipts = [saved, ...receipts.filter((entry) => entry.id !== saved.id)]; file.expenseLines = (file.expenseLines || []).filter((line) => line.receiptGroupId !== saved.id); file.expenseLines.push(...items.map((item,index) => ({ id:`${saved.id}-${index}`, receiptGroupId:saved.id, amount:parseMoney(item.lineTotal), note:item.name, vendor:saved.vendor, date:saved.date, category:item.category }))); updateRevenueExpense(file); receiptDraft = null; await saveCloud(); renderExpenses(); notify("Saved to cloud");
  } catch (error) { notify("Receipt save failed", true); window.alert(error.message || "Receipt could not be saved."); } finally { if ($("saveReceipt")) { $("saveReceipt").disabled=false; $("saveReceipt").textContent="Save expense"; } }
}

function updateRevenueExpense(file) { const total = fileExpenseTotal(file); let row = state.revenue.find((entry) => entry.dashboardFileId === file.id || entry.fileNumber === file.fileNumber); if (!row) { row = { id:uid("revenue"), dashboardFileId:file.id, fileNumber:file.fileNumber, clientJob:`${file.clientName} - ${file.fileNumber}`, date:dateToday(), gross:parseMoney(file.estimateTotal), labor:0 }; state.revenue.unshift(row); } row.expenses = total; row.profit = parseMoney(row.gross) - parseMoney(row.expenses) - parseMoney(row.labor); }
function renderRevenue() { const total = financialTotals(); const profit = total.gross - total.expenses - total.labor; $("revenueStats").innerHTML = [["Gross",total.gross],["Expenses",total.expenses],["Labor",total.labor],["Profit",profit]].map(([label,value]) => `<article class="stat"><span>${label}</span><strong>${money.format(value)}</strong><small>Cloud-linked ledger</small></article>`).join(""); $("revenueList").innerHTML = state.revenue.map((row) => `<article class="file-row"><span><h3>${escapeHtml(row.clientJob || row.fileNumber || "Revenue")}</h3><small>${escapeHtml(row.date || "")} · Expenses ${money.format(parseMoney(row.expenses))}</small></span><b>${money.format(parseMoney(row.gross))}</b></article>`).join("") || `<section class="panel"><p class="subcopy">No revenue rows yet.</p></section>`; }

function chooseFileSheet() { const candidates = state.files.filter((file) => !isClosed(file)); openSheet(`<div class="sheet-heading"><div><p class="eyebrow">Expense capture</p><h2>Choose a work file</h2></div><button class="sheet-close" type="button" data-close-sheet>×</button></div><div class="sheet-file-list">${candidates.map((file) => `<button type="button" data-select-file="${escapeHtml(file.id)}">${escapeHtml(file.clientName)}<small>${escapeHtml(file.fileNumber)} · ${escapeHtml(file.fileStatus)}</small></button>`).join("") || `<p class="subcopy">No open work files found.</p>`}</div>`); document.querySelectorAll("[data-select-file]").forEach((button) => button.addEventListener("click", async () => { activeFileId=button.dataset.selectFile; saveLocal(); closeSheet(); notify("Loading receipts..."); await fetchReceipts(); notify("Live cloud data"); renderExpenses(); })); }
function openSheet(markup) { $("sheet").innerHTML=markup; $("sheet").hidden=false; $("sheetBackdrop").hidden=false; document.querySelectorAll("[data-close-sheet]").forEach((button) => button.addEventListener("click", closeSheet)); }
function closeSheet() { $("sheet").hidden=true; $("sheetBackdrop").hidden=true; }
let busySafetyTimer = null;
function armReceiptCapture() {
  receiptCaptureArmed = true;
  if ($("cameraInput")) $("cameraInput").value = "";
  if ($("uploadInput")) $("uploadInput").value = "";
}
function showBusy(title,message) {
  $("busyTitle").textContent=title;
  $("busyMessage").textContent=message;
  $("busyOverlay").hidden=false;
  clearTimeout(busySafetyTimer);
  busySafetyTimer = window.setTimeout(() => {
    receiptReadToken += 1;
    receiptAbortController?.abort();
    receiptAbortController = null;
    receiptCaptureArmed = false;
    hideBusy();
    window.alert("Receipt reading took too long, so it was cancelled. Please try the upload again.");
  }, 45000);
}
function hideBusy() {
  clearTimeout(busySafetyTimer);
  busySafetyTimer = null;
  $("busyOverlay").hidden=true;
}
function resetReceiptReaderState(message = "") {
  receiptReadToken += 1;
  receiptAbortController?.abort();
  receiptAbortController = null;
  receiptCaptureArmed = false;
  hideBusy();
  if ($("cameraInput")) $("cameraInput").value = "";
  if ($("uploadInput")) $("uploadInput").value = "";
  if (message) notify(message);
}
function openDesktop(route) { const url = new URL("crm.html", window.location.href); if (route === "calendar") url.searchParams.set("view","calendar"); if (route === "prices") url.searchParams.set("view","prices"); if (route === "revenue") url.searchParams.set("view","revenue"); if (route === "invoice") url.searchParams.set("view","invoice"); if (route === "workorder") { url.searchParams.set("view","estimator"); url.hash = "assignment"; } if (route === "estimate") url.searchParams.set("view","estimator"); window.location.href=url.toString(); }

async function fetchReceipts() { const file = activeFile(); if (!file) { receipts=[]; return; } const response = await fetch(`${EXPENSE_API}?fileId=${encodeURIComponent(file.id)}&t=${Date.now()}`, { cache:"no-store" }); const result = await response.json().catch(() => ({})); receipts = response.ok && result.ok !== false ? result.expenses || [] : []; }
async function loadCloud() { notify("Loading cloud..."); const response = await fetch(`${API}?t=${Date.now()}`, { cache:"no-store" }); const result = await response.json().catch(() => ({})); if (!response.ok || result.ok === false) throw new Error(result.error || "Cloud could not be reached."); const cloud = result.dashboard || {}; state = { files:(cloud.dashboardFiles || []).map(normalizeFile).filter((file) => fileKey(file) !== "26-a1006"), revenue:cloud.revenueRows || [], prices:cloud.priceRows || [], payroll:cloud.payrollRows || [], deletedFileKeys:cloud.deletedFileKeys || [], deletedPriceIds:cloud.deletedPriceIds || [] }; activeFileId = state.files.find((file) => file.id === activeFileId)?.id || state.files[0]?.id || ""; saveLocal(); await fetchReceipts(); notify("Live cloud data"); renderAll(); }
async function saveCloud() { saveLocal(); const response = await fetch(API, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ action:"dashboardSync", syncedAt:new Date().toISOString(), source:"ANIMUS Mobile Fresh", dashboardFiles:state.files, revenueRows:state.revenue, payrollRows:state.payroll, priceRows:state.prices, deletedFileKeys:Array.from(new Set([...(state.deletedFileKeys || []),"26-a1006"])), deletedPriceIds:state.deletedPriceIds }), cache:"no-store" }); const result = await response.json().catch(() => ({})); if (!response.ok || result.ok === false) throw new Error(result.error || "Cloud save failed."); saveLocal(); return result; }
function renderAll() { renderHome(); renderFiles(); renderDetail(); renderExpenses(); renderRevenue(); }

document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => openView(button.dataset.view)));
document.querySelectorAll("[data-open-desktop]").forEach((button) => button.addEventListener("click", () => openDesktop(button.dataset.openDesktop)));
$("fileSearch").addEventListener("input", renderFiles); $("fileFilters").addEventListener("click", (event) => { const button=event.target.closest("[data-filter]"); if (!button) return; activeFilter=button.dataset.filter; document.querySelectorAll("[data-filter]").forEach((node) => node.classList.toggle("selected",node===button)); renderFiles(); });
$("expenseChooseFile").addEventListener("click", chooseFileSheet); $("sheetBackdrop").addEventListener("click", closeSheet); $("cameraInput").addEventListener("change", (event) => { receiveReceipt(event.target.files?.[0]); event.target.value=""; }); $("uploadInput").addEventListener("change", (event) => { receiveReceipt(event.target.files?.[0]); event.target.value=""; });
$("cancelBusy").addEventListener("click", () => { receiptDraft = null; resetReceiptReaderState("Receipt read cancelled"); renderExpenses(); });
$("saveButton").addEventListener("click", async () => { const button=$("saveButton"); button.disabled=true; button.textContent="Saving"; try { await saveCloud(); notify("Saved to cloud"); } catch (error) { notify("Save failed",true); window.alert(error.message); } finally { button.disabled=false; button.textContent="Save"; } });
$("newFileButton").addEventListener("click", () => { window.alert("Use the desktop Command Center to create a full work file. The mobile app is optimized for reviewing files and capturing expenses on the go."); });
window.addEventListener("pageshow", () => resetReceiptReaderState());
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && $("busyOverlay") && !$("busyOverlay").hidden && !receiptAbortController) resetReceiptReaderState();
});

// Remove only ANIMUS mobile browser traces. CRM records stay in the cloud.
for (let index = localStorage.length - 1; index >= 0; index -= 1) {
  const key = localStorage.key(index) || "";
  if (/animus.*mobile|mobile.*animus/i.test(key)) localStorage.removeItem(key);
}
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => registrations.forEach((registration) => registration.unregister()));
}
if (window.caches) {
  caches.keys().then((keys) => Promise.all(keys.filter((key) => /animus|mobile/i.test(key)).map((key) => caches.delete(key))));
}
resetReceiptReaderState();
renderAll(); loadCloud().catch(() => { notify("Cloud unavailable",true); renderAll(); });
