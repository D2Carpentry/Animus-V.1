const API = "https://animus-v-1.pages.dev/api/dashboard";
const RECEIPT_API = "https://animus-v-1.pages.dev/api/receipt";
const EXPENSE_API = "https://animus-v-1.pages.dev/api/expenses";
const $ = (id) => document.getElementById(id);
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

let state = { files: [], revenue: [], prices: [], payroll: [], deletedFileKeys: [], deletedPriceIds: [] };
let activeFileId = "";
let activeView = "files";
let activeFilter = "open";
let receiptDraft = null;
let receipts = [];
let receiptAbortController = null;
let receiptCaptureArmed = false;
let receiptReadToken = 0;
let workPhotoDrafts = [];

function escapeHtml(value = "") { return String(value).replace(/[&<>'"]/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#039;", '"':"&quot;" }[char])); }
function uid(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function parseMoney(value) { const result = Number.parseFloat(String(value ?? "").replace(/[^0-9.-]/g, "")); return Number.isFinite(result) ? result : 0; }
function dateToday() { return new Date().toISOString().slice(0, 10); }
function formatDate(value) { return value ? new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" }) : "No date"; }
function fileKey(file = {}) { return String(file.fileNumber || file.id || "").trim().toLowerCase(); }
function activeFile() { return state.files.find((file) => file.id === activeFileId) || state.files[0] || null; }
function statusClass(status = "") { return `status-${String(status).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`; }
function normalizeFile(file = {}) { return { ...file, id:file.id || uid("file"), fileNumber:file.fileNumber || "New File", clientName:file.clientName || "Unnamed Client", fileStatus:file.fileStatus || "New Lead", projectType:file.projectType || "Other", expenseLines:Array.isArray(file.expenseLines) ? file.expenseLines : [], receiptHistory:Array.isArray(file.receiptHistory) ? file.receiptHistory : [], notes:Array.isArray(file.notes) ? file.notes : [], workPhotos:Array.isArray(file.workPhotos) ? file.workPhotos : [] }; }
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
function fileCategory(file = {}) {
  const status = String(file.fileStatus || "").trim();
  const detail = String(file.statusDetail || "").trim();
  const estimateStatus = String(file.estimateStatus || "").trim();
  if (["Closed / Paid", "Job Lost / Closed"].includes(status)) return "closed";
  if (status === "In Progress") return "active";
  if (status === "In Negotiation") return "negotiation";
  if (status === "Inspection Completed" || ["Inspection Pending", "Inspection Date Set", "Estimate Attached", "Estimate Pending", "Estimate Sent"].includes(detail) || ["Pending", "Sent"].includes(estimateStatus)) return "estimate";
  if (["Contact Established", "Contact Attempted"].includes(status)) return "contact";
  return "lead";
}
function isClosed(file) { return fileCategory(file) === "closed"; }
function isActive(file) { return fileCategory(file) === "active"; }
function isOpenFile(file) { return !isClosed(file); }
function fileExpenseTotal(file) { return (file.expenseLines || []).reduce((sum, line) => sum + parseMoney(line.amount ?? line.lineTotal ?? line.total), 0); }
function financialTotals() { return state.revenue.reduce((sum, row) => { sum.gross += parseMoney(row.gross); sum.expenses += parseMoney(row.expenses); sum.labor += parseMoney(row.labor); return sum; }, { gross:0, expenses:0, labor:0 }); }

function renderHome() {
  const counts = [
    ["Open Files", countStatus(isOpenFile)], ["Active Jobs", countStatus(isActive)], ["In Negotiation", countStatus((file) => fileCategory(file) === "negotiation")], ["Pending", countStatus((file) => ["estimate", "contact", "lead"].includes(fileCategory(file)))],
  ];
  $("summaryGrid").innerHTML = counts.map(([label, value]) => `<article class="stat"><span>${label}</span><strong>${value}</strong><small>Live Cloudflare data</small></article>`).join("");
  const events = state.files.flatMap((file) => [[file.inspectionDate,"Inspection"],[file.startDate,"Start date"],[file.followUpDate,"Follow-up"]].filter(([date]) => date).map(([date,label]) => ({ date,label,file }))).filter((event) => event.date >= dateToday()).sort((a,b) => a.date.localeCompare(b.date)).slice(0,4);
  $("todayList").innerHTML = events.length ? events.map((event) => `<button class="compact-item" type="button" data-file="${escapeHtml(event.file.id)}"><strong>${escapeHtml(event.label)} · ${escapeHtml(event.file.clientName)}</strong><small>${formatDate(event.date)} · ${escapeHtml(event.file.fileNumber)}</small></button>`).join("") : `<p class="subcopy">No upcoming dates are set.</p>`;
  bindFileLinks();
}

function filteredFiles() {
  const query = $("fileSearch").value.trim().toLowerCase();
  return state.files.filter((file) => {
    const category = fileCategory(file);
    const matches = activeFilter === "all" || (activeFilter === "open" && isOpenFile(file)) || activeFilter === category;
    const text = `${file.fileNumber} ${file.clientName} ${file.clientPhone || ""} ${file.clientEmail || ""} ${file.projectAddress || ""} ${file.fileStatus || ""} ${file.statusDetail || ""} ${file.projectType || ""} ${file.nextAction || ""}`.toLowerCase();
    return matches && (!query || text.includes(query));
  }).sort((a, b) => {
    const rank = { active:0, negotiation:1, estimate:2, contact:3, lead:4, closed:5 };
    return (rank[fileCategory(a)] ?? 9) - (rank[fileCategory(b)] ?? 9) || String(a.clientName || "").localeCompare(String(b.clientName || ""));
  });
}
function renderFiles() {
  $("fileList").innerHTML = filteredFiles().map((file) => `<button type="button" class="file-row" data-file="${escapeHtml(file.id)}"><span><h3>${escapeHtml(file.clientName)}</h3><small>${escapeHtml(file.fileNumber)} · ${escapeHtml(file.projectType)}</small><span class="meta"><i class="badge ${statusClass(file.fileStatus)}">${escapeHtml(file.fileStatus)}</i>${file.nextAction ? `<em>${escapeHtml(file.nextAction)}</em>` : ""}</span></span><b class="arrow">›</b></button>`).join("") || `<section class="panel"><p class="subcopy">No work files in this view.</p></section>`;
  bindFileLinks();
}
function bindFileLinks() { document.querySelectorAll("[data-file]").forEach((button) => button.addEventListener("click", () => { activeFileId = button.dataset.file; saveLocal(); openView("detail"); })); }

function renderDetail() {
  const file = activeFile();
  if (!file) { $("fileDetail").innerHTML = `<section class="panel"><p class="subcopy">Choose a work file first.</p></section>`; return; }
  const paid = parseMoney(file.totalPaid) || parseMoney(file.initialDeposit) + parseMoney(file.midpointDeposit) + parseMoney(file.finalPaymentAmount);
  const estimate = parseMoney(file.estimateTotal); const balance = Math.max(estimate - paid, 0);
  const notes = manualNotes(file).slice(-4).reverse();
  const photos = (file.workPhotos || []).slice(-6).reverse();
  $("fileDetail").innerHTML = `<header class="detail-header"><p class="eyebrow">${escapeHtml(file.fileNumber)}</p><h1>${escapeHtml(file.clientName)}</h1><p><i class="badge ${statusClass(file.fileStatus)}">${escapeHtml(file.fileStatus)}</i> <span>${escapeHtml(file.projectType)}</span></p></header><div class="detail-cards"><article class="detail-card"><span>Estimate</span><strong>${money.format(estimate)}</strong></article><article class="detail-card"><span>Paid</span><strong>${money.format(paid)}</strong></article><article class="detail-card"><span>Balance</span><strong>${money.format(balance)}</strong></article><article class="detail-card"><span>Expenses</span><strong>${money.format(fileExpenseTotal(file))}</strong></article></div><section class="panel"><div class="panel-heading"><div><p class="eyebrow">Customer</p><h2>Contact information</h2></div><button type="button" id="addPhoneContact">Add Contact</button></div><div class="contact-list">${contactLink("Phone", file.clientPhone, phoneHref(file.clientPhone))}${contactLink("Text", file.clientPhone, smsHref(file.clientPhone))}${contactLink("Email", file.clientEmail, emailHref(file.clientEmail))}${contactLink("Address", file.projectAddress, mapHref(file.projectAddress))}</div></section><section class="panel"><div class="panel-heading"><div><p class="eyebrow">Quick Actions</p><h2>Capture updates</h2></div></div><div class="detail-actions"><button type="button" id="detailReceipt" class="primary">Upload Receipt</button><button type="button" id="detailWorkPhoto">Take Work Photo</button><button type="button" id="detailPhotoRoll">Upload Photo</button><button type="button" id="detailExpense">Expenses</button></div></section><section class="panel"><div class="panel-heading"><div><p class="eyebrow">Documents</p><h2>Open saved files</h2></div></div><div class="document-actions"><button type="button" data-mobile-doc="estimate">View Estimate</button><button type="button" data-mobile-doc="supplement">Supplement</button><button type="button" data-mobile-doc="invoice">Invoice</button><button type="button" data-mobile-doc="workorder">Work Order</button></div></section><section class="panel"><div class="panel-heading"><div><p class="eyebrow">File Notes</p><h2>Manual notes</h2></div><button type="button" id="addMobileNote">Add Note</button></div><div class="compact-list">${notes.length ? notes.map((note) => `<article class="compact-item"><strong>${escapeHtml(note.text)}</strong><small>${formatDateTime(note.at)}</small></article>`).join("") : `<p class="subcopy">No manual notes yet.</p>`}</div></section><section class="panel"><div class="panel-heading"><div><p class="eyebrow">Photos</p><h2>Work progress</h2></div></div><div class="mobile-photo-grid">${photos.length ? photos.map((photo) => `<button type="button" data-photo="${escapeHtml(photo.id)}"><img src="${escapeHtml(photo.dataUrl)}" alt="${escapeHtml(photo.title || "Work photo")}"><span>${escapeHtml(photo.title || "Work photo")}</span></button>`).join("") : `<p class="subcopy">No work photos saved yet.</p>`}</div></section>`;
  document.querySelectorAll("[data-mobile-doc]").forEach((button) => button.addEventListener("click", () => openFileDocument(button.dataset.mobileDoc)));
  $("detailReceipt").addEventListener("click", receiptUploadSheet);
  $("detailWorkPhoto").addEventListener("click", () => $("workPhotoCameraInput").click());
  $("detailPhotoRoll").addEventListener("click", () => $("workPhotoUploadInput").click());
  $("detailExpense").addEventListener("click", async () => { await fetchReceipts(); openView("expenses"); });
  $("addMobileNote").addEventListener("click", openMobileNoteSheet);
  $("addPhoneContact").addEventListener("click", addToPhoneContacts);
  document.querySelectorAll("[data-photo]").forEach((button) => button.addEventListener("click", () => openMobilePhotoPreview(button.dataset.photo)));
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

function cleanPhone(value = "") { return String(value || "").replace(/[^\d+]/g, ""); }
function phoneHref(value) { const phone = cleanPhone(value); return phone ? `tel:${phone}` : ""; }
function smsHref(value) { const phone = cleanPhone(value); return phone ? `sms:${phone}` : ""; }
function emailHref(value) { const email = String(value || "").trim(); return email && email !== "N/A" ? `mailto:${encodeURIComponent(email)}` : ""; }
function mapHref(value) { const address = String(value || "").trim(); return address ? `https://maps.apple.com/?q=${encodeURIComponent(address)}` : ""; }
function contactLink(label, value, href) {
  const text = String(value || "").trim();
  return href ? `<a class="contact-row" href="${escapeHtml(href)}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(text)}</strong></a>` : `<div class="contact-row disabled"><span>${escapeHtml(label)}</span><strong>${escapeHtml(text || `No ${label.toLowerCase()}`)}</strong></div>`;
}
function formatDateTime(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "No date";
  return date.toLocaleString("en-US", { month:"short", day:"numeric", year:"numeric", hour:"numeric", minute:"2-digit" });
}
function manualNotes(file) {
  return (Array.isArray(file?.notes) ? file.notes : []).filter((note) => note && String(note.text || "").trim() && note.source !== "system");
}
function openMobileNoteSheet() {
  const file = activeFile();
  if (!file) return;
  openSheet(`<div class="sheet-heading"><div><p class="eyebrow">File note</p><h2>Add manual note</h2></div><button class="sheet-close" type="button" data-close-sheet>×</button></div><textarea id="mobileNoteText" class="mobile-sheet-textarea" placeholder="Type the note for ${escapeHtml(file.clientName)}"></textarea><div class="sheet-actions"><button type="button" data-close-sheet>Cancel</button><button type="button" class="primary-action" id="saveMobileNote">Save Note</button></div>`);
  $("saveMobileNote")?.addEventListener("click", async () => {
    const text = $("mobileNoteText")?.value.trim();
    if (!text) return;
    file.notes = Array.isArray(file.notes) ? file.notes : [];
    const timestamp = new Date().toISOString();
    file.notes.push({ id:uid("mobile-note"), at:timestamp, text, source:"manual" });
    file.timeline = [...(Array.isArray(file.timeline) ? file.timeline : []), `Note added ${formatDateTime(timestamp)}`];
    closeSheet();
    renderDetail();
    try { await saveCloud(); notify("Note saved to cloud"); } catch (error) { notify("Note save failed", true); window.alert(error.message || "The note could not be saved."); }
  });
}
function addToPhoneContacts() {
  const file = activeFile();
  if (!file) return;
  const name = String(file.clientName || "ANIMUS Contact").trim();
  const phone = cleanPhone(file.clientPhone);
  const email = String(file.clientEmail || "").trim();
  const address = String(file.projectAddress || "").replace(/\n/g, " ").trim();
  const vcard = ["BEGIN:VCARD", "VERSION:3.0", `FN:${name}`, phone ? `TEL;TYPE=CELL:${phone}` : "", email && email !== "N/A" ? `EMAIL:${email}` : "", address ? `ADR;TYPE=WORK:;;${address};;;;` : "", `NOTE:ANIMUS work file ${file.fileNumber || ""}`, "END:VCARD"].filter(Boolean).join("\n");
  const url = URL.createObjectURL(new Blob([vcard], { type:"text/vcard" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name.replace(/[^a-z0-9]+/gi, "-") || "animus-contact"}.vcf`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify("Contact card ready");
}

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
  const labels = { estimate:"estimate", supplement:"supplement", invoice:"invoice", workorder:"work order" };
  window.alert(`No saved ${labels[type] || "document"} file is attached to this work file yet.`);
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
async function prepareWorkPhoto(file) {
  if (!file || !String(file.type || "").startsWith("image/")) return null;
  const original = await prepareFile(file);
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = original.dataUrl;
  });
  const maxSide = 1400;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  return { dataUrl:canvas.toDataURL("image/jpeg", 0.82), name:file.name || "work-photo.jpg" };
}
async function reviewWorkPhotos(fileList) {
  const file = activeFile();
  const files = [...(fileList || [])];
  if (!file || !files.length) return;
  showBusy("Preparing photo...", "ANIMUS is getting the image ready for this work file.");
  try {
    const prepared = [];
    for (const upload of files) {
      const photo = await prepareWorkPhoto(upload);
      if (photo) prepared.push({ id:uid("work-photo-draft"), createdAt:new Date().toISOString(), title:photo.name.replace(/\.[^.]+$/, ""), fileName:photo.name, dataUrl:photo.dataUrl });
    }
    if (!prepared.length) throw new Error("Choose an image file to upload.");
    workPhotoDrafts = prepared;
    hideBusy();
    openWorkPhotoReviewSheet();
  } catch (error) {
    hideBusy();
    notify("Photo could not be prepared", true);
    window.alert(error.message || "The work photo could not be opened.");
  }
}
function openWorkPhotoReviewSheet() {
  const file = activeFile();
  if (!file || !workPhotoDrafts.length) return;
  const rows = workPhotoDrafts.map((photo, index) => `<article class="work-photo-review-card"><img src="${escapeHtml(photo.dataUrl)}" alt="${escapeHtml(photo.title || "Work photo")}"><label>Photo name<input data-work-photo-title="${index}" value="${escapeHtml(photo.title || "")}" placeholder="Photo name"></label></article>`).join("");
  openSheet(`<div class="sheet-heading"><div><p class="eyebrow">Work photo</p><h2>Review before saving</h2></div><button class="sheet-close" type="button" data-clear-work-photo-drafts data-close-sheet>×</button></div><p class="subcopy">Captured for ${escapeHtml(file.clientName)}. Rename the photo, then save it to this work file.</p><div class="work-photo-review-list">${rows}</div><div class="sheet-actions"><button type="button" data-clear-work-photo-drafts data-close-sheet>Cancel</button><button type="button" id="saveWorkPhotoDrafts" class="primary-action">Save to Work File</button></div>`);
  $("saveWorkPhotoDrafts")?.addEventListener("click", saveReviewedWorkPhotos);
  document.querySelectorAll("[data-clear-work-photo-drafts]").forEach((button) => button.addEventListener("click", () => { workPhotoDrafts = []; }));
}
async function saveReviewedWorkPhotos() {
  const file = activeFile();
  if (!file || !workPhotoDrafts.length) return;
  const saved = workPhotoDrafts.map((photo, index) => {
    const title = document.querySelector(`[data-work-photo-title="${index}"]`)?.value?.trim();
    return { ...photo, id:uid("work-photo"), title:title || photo.title || "Work photo", createdAt:photo.createdAt || new Date().toISOString() };
  });
  showBusy("Saving work photo...", "ANIMUS is attaching the image to this work file.");
  try {
    file.workPhotos = [...(Array.isArray(file.workPhotos) ? file.workPhotos : []), ...saved];
    file.timeline = [...(Array.isArray(file.timeline) ? file.timeline : []), `${saved.length} work photo${saved.length === 1 ? "" : "s"} added ${formatDateTime(new Date().toISOString())}`];
    await saveCloud();
    workPhotoDrafts = [];
    closeSheet();
    notify("Work photo saved to cloud");
    renderDetail();
  } catch (error) {
    notify("Photo save failed", true);
    window.alert(error.message || "The work photo could not be saved.");
  } finally {
    hideBusy();
  }
}
function openMobilePhotoPreview(photoId) {
  const file = activeFile();
  const photo = (file?.workPhotos || []).find((entry) => entry.id === photoId);
  if (!photo) return;
  openSheet(`<div class="sheet-heading"><div><p class="eyebrow">Work photo</p><h2>${escapeHtml(photo.title || "Work photo")}</h2></div><button class="sheet-close" type="button" data-close-sheet>×</button></div><img class="mobile-photo-preview" src="${escapeHtml(photo.dataUrl)}" alt="${escapeHtml(photo.title || "Work photo")}"><p class="subcopy">${escapeHtml(formatDateTime(photo.createdAt))}</p>`);
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
async function loadCloud() { notify("Loading cloud..."); const response = await fetch(`${API}?t=${Date.now()}`, { cache:"no-store" }); const result = await response.json().catch(() => ({})); if (!response.ok || result.ok === false) throw new Error(result.error || "Cloud could not be reached."); const cloud = result.dashboard || {}; state = { files:(cloud.dashboardFiles || []).map(normalizeFile).filter((file) => fileKey(file) !== "26-a1006"), revenue:cloud.revenueRows || [], prices:cloud.priceRows || [], payroll:cloud.payrollRows || [], deletedFileKeys:cloud.deletedFileKeys || [], deletedPriceIds:cloud.deletedPriceIds || [] }; activeFileId = state.files.find((file) => file.id === activeFileId)?.id || state.files.find(isOpenFile)?.id || state.files[0]?.id || ""; saveLocal(); await fetchReceipts(); notify("Live cloud data"); renderAll(); }
async function saveCloud() { saveLocal(); const response = await fetch(API, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ action:"dashboardSync", syncedAt:new Date().toISOString(), source:"ANIMUS Mobile Fresh", dashboardFiles:state.files, revenueRows:state.revenue, payrollRows:state.payroll, priceRows:state.prices, deletedFileKeys:Array.from(new Set([...(state.deletedFileKeys || []),"26-a1006"])), deletedPriceIds:state.deletedPriceIds }), cache:"no-store" }); const result = await response.json().catch(() => ({})); if (!response.ok || result.ok === false) throw new Error(result.error || "Cloud save failed."); saveLocal(); return result; }
function renderAll() { renderHome(); renderFiles(); renderDetail(); renderExpenses(); renderRevenue(); }

document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => openView(button.dataset.view)));
document.querySelectorAll("[data-open-desktop]").forEach((button) => button.addEventListener("click", () => openDesktop(button.dataset.openDesktop)));
$("fileSearch").addEventListener("input", renderFiles); $("fileFilters").addEventListener("click", (event) => { const button=event.target.closest("[data-filter]"); if (!button) return; activeFilter=button.dataset.filter; document.querySelectorAll("[data-filter]").forEach((node) => node.classList.toggle("selected",node===button)); renderFiles(); });
$("expenseChooseFile").addEventListener("click", chooseFileSheet); $("sheetBackdrop").addEventListener("click", closeSheet); $("cameraInput").addEventListener("change", (event) => { receiveReceipt(event.target.files?.[0]); event.target.value=""; }); $("uploadInput").addEventListener("change", (event) => { receiveReceipt(event.target.files?.[0]); event.target.value=""; });
$("workPhotoCameraInput").addEventListener("change", (event) => { reviewWorkPhotos(event.target.files); event.target.value=""; });
$("workPhotoUploadInput").addEventListener("change", (event) => { reviewWorkPhotos(event.target.files); event.target.value=""; });
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
