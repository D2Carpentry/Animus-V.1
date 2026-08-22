// ANIMUS Expense Center v6
// UI layer over the existing receipt AI, Cloudflare receipt ledger, Revenue, and Price Database hooks.
(() => {
  const API = "/api/expenses";
  const state = { entries: [], loaded: false, loading: false, selectedId: "", scope: "all", tab: "processed", filters: {}, draft: null, editing: false, processStep: "", requestId: 0 };
  const money = (value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value) || 0);
  const amount = (value) => Number(String(value || "").replace(/[$,]/g, "")) || 0;
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[char]));
  const today = () => new Date().toISOString().slice(0, 10);
  const expenseId = () => `expense-v6-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const fileKey = (file) => String(file?.id || file?.fileNumber || "").trim();
  const files = () => typeof crmFiles !== "undefined" && Array.isArray(crmFiles) ? crmFiles : [];
  const findFile = (id) => files().find((file) => fileKey(file) === id || file.id === id) || null;

  function cleanDraft(source = {}) {
    return {
      id: source.id || "", fileId: source.fileId || fileKey(typeof activeFile === "function" ? activeFile() : null), date: source.date || today(), vendor: source.vendor || "", title: source.title || "",
      category: source.category || "Supplies", paymentType: source.paymentType || "", amount: source.amount === undefined ? "" : String(source.amount), notes: source.notes || "",
      imageDataUrl: source.imageDataUrl || "", imageTitle: source.imageTitle || "",
      items: Array.isArray(source.items) && source.items.length ? source.items.map((item) => ({ name:item.name || "", price:item.price === undefined ? "" : String(item.price), category:item.category || source.category || "Supplies" })) : [{ name:"", price:"", category:source.category || "Supplies" }],
    };
  }

  function setExpenseCenterMode(active) { document.body.classList.toggle("animus-expense-center-active", active); }

  async function apiGet(file) {
    const key = fileKey(file);
    if (!key) return [];
    const response = await fetch(`${API}?fileId=${encodeURIComponent(key)}&t=${Date.now()}`, { cache:"no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) throw new Error(payload.error || "Could not load saved expenses.");
    return (Array.isArray(payload.expenses) ? payload.expenses : []).map((entry) => ({ ...entry, fileId:key, file }));
  }

  async function loadExpenses() {
    const requestId = ++state.requestId;
    state.loading = true;
    render();
    try {
      const rows = await Promise.all(files().map(async (file) => {
        try { return await apiGet(file); } catch (_) { return []; }
      }));
      if (requestId !== state.requestId) return;
      state.entries = rows.flat().sort((a,b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
      state.loaded = true;
    } finally {
      if (requestId === state.requestId) { state.loading = false; render(); }
    }
  }

  function selectedEntry() { return state.entries.find((entry) => entry.id === state.selectedId) || null; }
  function visibleEntries() {
    const query = String(state.filters.query || "").trim().toLowerCase();
    const tab = state.tab;
    return state.entries.filter((entry) => {
      if (state.scope !== "all" && entry.fileId !== state.scope) return false;
      if (tab === "categories" && state.filters.category && entry.category !== state.filters.category) return false;
      if (tab === "vendors" && state.filters.vendor && entry.vendor !== state.filters.vendor) return false;
      if (state.filters.category && entry.category !== state.filters.category) return false;
      if (state.filters.vendor && entry.vendor !== state.filters.vendor) return false;
      if (state.filters.from && String(entry.date || "") < state.filters.from) return false;
      if (state.filters.to && String(entry.date || "") > state.filters.to) return false;
      if (!query) return true;
      return [entry.vendor, entry.title, entry.category, entry.paymentType, entry.file?.clientName, entry.file?.fileNumber, entry.notes].some((value) => String(value || "").toLowerCase().includes(query));
    });
  }

  function thisMonthExpenses() {
    const month = new Date().toISOString().slice(0,7);
    return state.entries.filter((entry) => String(entry.date || "").slice(0,7) === month).reduce((sum,entry) => sum + amount(entry.amount), 0);
  }

  function drawerData() { return state.draft || selectedEntry(); }

  function processingMarkup() {
    const steps = ["Reading receipt", "Identifying vendor", "Extracting date and line items", "Calculating total", "Preparing expense record"];
    const current = steps.indexOf(state.processStep);
    return `<div class="expense-processing">${steps.map((step,index) => `<div class="expense-processing-row ${index < current ? "done" : index === current ? "active" : ""}"><span class="expense-dot"></span>${step}</div>`).join("")}</div>`;
  }

  function fileOptions(selected) { return [`<option value="">Choose customer / job</option>`, `<option value="all"${selected === "all" ? " selected" : ""}>All customer files</option>`, ...files().map((file) => `<option value="${esc(fileKey(file))}"${selected === fileKey(file) ? " selected" : ""}>${esc(file.fileNumber || "Project")} — ${esc(file.clientName || "Unnamed Client")}</option>`)].join(""); }
  function categoryOptions(value) { return ["Supplies","Materials","Fuel","Equipment","Labor","Other"].map((item) => `<option${value === item ? " selected" : ""}>${item}</option>`).join(""); }
  function paymentOptions(value) { return ["","Cash","Credit - Chase Business","Credit - Bank of America","Credit - Chase Personal"].map((item) => `<option value="${esc(item)}"${value === item ? " selected" : ""}>${item || "Select"}</option>`).join(""); }

  function tableMarkup(entries) {
    if (state.loading) return `<div class="expense-empty">Loading saved receipts from Cloudflare...</div>`;
    if (!entries.length) return `<div class="expense-empty">No saved expenses match these filters.</div>`;
    return `<table class="expense-table"><thead><tr><th></th><th>Receipt</th><th>Vendor</th><th>Date</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead><tbody>${entries.map((entry) => {
      const selected = entry.id === state.selectedId;
      const title = entry.title || entry.vendor || "Untitled expense";
      const receipt = entry.imageDataUrl ? `<img src="${esc(entry.imageDataUrl)}" alt="Receipt">` : "▤";
      const type = entry.imageDataUrl ? "Receipt saved" : "Manual expense";
      return `<tr class="${selected ? "selected" : ""}"><td><input class="expense-check" type="checkbox" aria-label="Select ${esc(title)}"></td><td><button type="button" class="expense-receipt-cell" data-expense-open="${esc(entry.id)}"><span class="expense-thumb">${receipt}</span><span><strong>${esc(title)}</strong><small>${esc(entry.file?.fileNumber || "Project")} · ${esc(entry.file?.clientName || "Unassigned")}</small></span></button></td><td>${esc(entry.vendor || "—")}</td><td>${esc(entry.date || "—")}</td><td class="expense-amount">${money(entry.amount)}</td><td><span class="expense-status ${entry.imageDataUrl ? "" : "manual"}">${type}</span><span class="expense-substatus">${entry.items?.length || 0} line item${entry.items?.length === 1 ? "" : "s"}</span></td><td><button class="expense-icon-action" data-expense-open="${esc(entry.id)}" aria-label="View">◉</button><button class="expense-icon-action" data-expense-edit="${esc(entry.id)}" aria-label="Edit">✎</button></td></tr>`;
    }).join("")}</tbody></table>`;
  }

  function drawerMarkup() {
    const data = drawerData();
    if (state.processStep) return `<aside class="expense-drawer"><div class="expense-drawer-head"><h2>Reading receipt...</h2><button class="expense-close" id="expenseDrawerClose">×</button></div>${processingMarkup()}</aside>`;
    if (!data) return `<aside class="expense-drawer"><div class="expense-drawer-head"><h2>Receipt Details</h2></div><div class="expense-empty">Select a receipt to review its image, details, line items, and Price Database options.</div></aside>`;
    const editing = state.editing || Boolean(state.draft);
    const file = findFile(data.fileId) || data.file;
    const items = (data.items || []).filter((item) => item.name || amount(item.price));
    const info = editing ? `<div class="expense-detail-editor"><label>Customer / Job<select id="expenseDraftFile">${fileOptions(data.fileId)}</select></label><label>Vendor<input id="expenseDraftVendor" value="${esc(data.vendor)}"></label><label>Date<input id="expenseDraftDate" type="date" value="${esc(data.date)}"></label><label>Receipt Total<input id="expenseDraftAmount" inputmode="decimal" value="${esc(data.amount)}"></label><label>Category<select id="expenseDraftCategory">${categoryOptions(data.category)}</select></label><label>Paid By<select id="expenseDraftPayment">${paymentOptions(data.paymentType)}</select></label></div>` : `<div class="expense-details"><div class="expense-detail"><span>Vendor</span><b>${esc(data.vendor || "—")}</b></div><div class="expense-detail"><span>Total Amount</span><b>${money(data.amount)}</b></div><div class="expense-detail"><span>Category</span><b>${esc(data.category || "—")}</b></div><div class="expense-detail"><span>Paid By</span><b>${esc(data.paymentType || "—")}</b></div><div class="expense-detail"><span>Customer / Job</span><b>${esc(file ? `${file.fileNumber || "Project"} · ${file.clientName || "Unnamed"}` : "—")}</b></div></div>`;
    const itemMarkup = items.length ? items.map((item,index) => editing ? `<div class="expense-item"><input data-expense-item-name="${index}" value="${esc(item.name)}"><input data-expense-item-price="${index}" inputmode="decimal" value="${esc(item.price)}"></div>` : `<div class="expense-item"><span class="expense-item-name">${esc(item.name)}</span><b>${money(item.price)}</b><button class="expense-item-add" data-expense-item-import="${index}">Price DB</button></div>`).join("") : `<div class="expense-item"><span>No line items were saved with this expense.</span></div>`;
    return `<aside class="expense-drawer"><div class="expense-drawer-head"><h2>Receipt Details</h2><button class="expense-close" id="expenseDrawerClose">×</button></div><div class="expense-drawer-status"><span class="expense-status ${data.imageDataUrl ? "" : "manual"}">${data.imageDataUrl ? "Receipt saved" : "Manual expense"}</span><small>AI confidence is not stored by the current scanner.</small></div><div class="expense-preview">${data.imageDataUrl ? `<img src="${esc(data.imageDataUrl)}" alt="Receipt image">` : "No receipt image"}</div><p class="expense-drawer-vendor">${esc(data.title || data.vendor || "New Expense")}</p><p class="expense-drawer-meta">${esc(data.date || "No date")} · ${esc(data.imageTitle || "No receipt reference")}</p><section class="expense-detail-section"><div class="expense-section-top"><h3>Extracted Information</h3><button class="expense-link-button" id="expenseEditToggle">${editing ? "Done" : "Edit"}</button></div>${info}</section><section class="expense-detail-section"><div class="expense-section-top"><h3>Items (${items.length})</h3><button class="expense-link-button" id="expenseImportAll">Add to Price Database</button></div><div id="expenseDrawerItems">${itemMarkup}</div></section><section class="expense-detail-section"><h3>Notes <span style="color:#94a3b8;font-weight:600">(Optional)</span></h3>${editing ? `<textarea id="expenseDraftNotes">${esc(data.notes)}</textarea>` : `<p style="margin:10px 0 0;color:#64748b;font-size:12px;white-space:pre-wrap">${esc(data.notes || "No notes")}</p>`}</section><div class="expense-drawer-actions"><button class="expense-button danger" id="expenseDelete">Delete</button><button class="expense-button" id="expenseSaveLater">Save for Later</button><button class="expense-button primary" id="expenseSave">${data.id && !state.draft ? "Save Changes" : "Add to Expenses"}</button></div></aside>`;
  }

  function render() {
    const root = document.querySelector("#crmExpensesView");
    if (!root) return;
    setExpenseCenterMode(true);
    const rows = visibleEntries();
    const categories = [...new Set(state.entries.map((entry) => entry.category).filter(Boolean))];
    const vendors = [...new Set(state.entries.map((entry) => entry.vendor).filter(Boolean))].sort();
    const activeTabs = [["inbox","Receipt Inbox"],["processed","Processed Expenses"],["history","Expense History"],["categories","Categories"],["vendors","Vendors"]];
    root.innerHTML = `<section class="expense-center"><aside class="expense-sidebar"><div class="expense-brand"><img src="assets/d2-logo.png" alt="D2 logo"><span>ANIMUS<small>Command Center</small></span></div><p class="expense-side-label">Workspace</p>${[["dashboard","⌂","Dashboard"],["dashboard","▣","CRM / Files"],["calendar","□","Calendar"],["estimator","▤","Estimates"],["dashboard","▱","Jobs"]].map(([view,icon,label]) => `<button class="expense-side-button" data-expense-view="${view}"><span class="expense-side-icon">${icon}</span>${label}</button>`).join("")}<p class="expense-side-label">Business</p>${[["revenue","↗","Revenue"],["expenses","▧","Expenses"],["payroll","♙","Payroll"],["prices","▦","Price Database"]].map(([view,icon,label]) => `<button class="expense-side-button ${view === "expenses" ? "active" : ""}" data-expense-view="${view}"><span class="expense-side-icon">${icon}</span>${label}</button>`).join("")}<div class="expense-side-account"><strong>D2 Carpentry &amp; Design</strong>Owner</div></aside><main class="expense-main"><header class="expense-header"><div><p class="expense-breadcrumb">Home &nbsp;›&nbsp; Expenses &nbsp;›&nbsp; Receipt Reader</p><h1 class="expense-title">Expenses</h1></div><div class="expense-header-actions"><button class="expense-button" id="expenseUpload">↑ Upload Receipt</button><button class="expense-button primary" id="expenseScan">⌑ Scan Receipt</button><button class="expense-button" id="expenseRefresh">↻</button><input id="expenseUploadInput" type="file" accept="image/*" hidden></div></header><section class="expense-kpis"><article class="expense-kpi"><div class="expense-kpi-label">This Month Expenses</div><div class="expense-kpi-value">${money(thisMonthExpenses())}</div><div class="expense-kpi-note">From saved expense records</div><div class="expense-kpi-mark">$</div></article><article class="expense-kpi"><div class="expense-kpi-label">Receipts Processed</div><div class="expense-kpi-value">${state.entries.length}</div><div class="expense-kpi-note">Saved Cloudflare expense records</div><div class="expense-kpi-mark">▧</div></article><article class="expense-kpi"><div class="expense-kpi-label">Receipt Images</div><div class="expense-kpi-value">${state.entries.filter((entry) => entry.imageDataUrl).length}</div><div class="expense-kpi-note">Attached receipt images</div><div class="expense-kpi-mark">▣</div></article><article class="expense-kpi"><div class="expense-kpi-label">Needs Review</div><div class="expense-kpi-value">—</div><div class="expense-kpi-note">Confidence is not stored yet</div><div class="expense-kpi-mark">!</div></article></section><nav class="expense-tabs">${activeTabs.map(([value,label]) => `<button class="expense-tab ${state.tab === value ? "active" : ""}" data-expense-tab="${value}">${label}</button>`).join("")}</nav><section class="expense-workspace"><section class="expense-table-card"><div class="expense-toolbar"><input class="expense-search" id="expenseSearch" value="${esc(state.filters.query || "")}" placeholder="Search receipts..."><select class="expense-select" id="expenseScope">${fileOptions(state.scope)}</select><select class="expense-select" id="expenseCategory"><option value="">Category</option>${categories.map((value) => `<option${state.filters.category === value ? " selected" : ""}>${esc(value)}</option>`).join("")}</select><select class="expense-select" id="expenseVendor"><option value="">Vendor</option>${vendors.map((value) => `<option${state.filters.vendor === value ? " selected" : ""}>${esc(value)}</option>`).join("")}</select><input class="expense-select" id="expenseFrom" type="date" value="${esc(state.filters.from || "")}"><input class="expense-select" id="expenseTo" type="date" value="${esc(state.filters.to || "")}"><span class="expense-count">${rows.length} receipt${rows.length === 1 ? "" : "s"}</span></div>${tableMarkup(rows)}</section>${drawerMarkup()}</section></main></section>`;
    bind();
  }

  function captureDrawer() {
    if (!state.draft) state.draft = cleanDraft(selectedEntry() || {});
    const draft = state.draft;
    draft.fileId = document.querySelector("#expenseDraftFile")?.value || draft.fileId;
    draft.vendor = document.querySelector("#expenseDraftVendor")?.value.trim() || draft.vendor;
    draft.date = document.querySelector("#expenseDraftDate")?.value || draft.date;
    draft.amount = document.querySelector("#expenseDraftAmount")?.value || draft.amount;
    draft.category = document.querySelector("#expenseDraftCategory")?.value || draft.category;
    draft.paymentType = document.querySelector("#expenseDraftPayment")?.value || draft.paymentType;
    draft.notes = document.querySelector("#expenseDraftNotes")?.value.trim() || "";
    document.querySelectorAll("[data-expense-item-name]").forEach((input) => { draft.items[Number(input.dataset.expenseItemName)].name = input.value; });
    document.querySelectorAll("[data-expense-item-price]").forEach((input) => { draft.items[Number(input.dataset.expenseItemPrice)].price = input.value; });
  }

  async function scan(file) {
    if (!file) return;
    state.draft = cleanDraft({ fileId: state.scope !== "all" ? state.scope : fileKey(typeof activeFile === "function" ? activeFile() : null), imageTitle:file.name });
    state.processStep = "Reading receipt"; render();
    if (typeof showReceiptLoading === "function") showReceiptLoading("Reading receipt photo with AI...");
    try {
      const imageDataUrl = await new Promise((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
      state.processStep = "Identifying vendor"; render();
      const response = await fetch("/api/receipt", { method:"POST", headers:{"Content-Type":"application/json"}, cache:"no-store", body:JSON.stringify({imageDataUrl,fileName:file.name}) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok === false) throw new Error(payload.error || "Receipt AI could not read that image.");
      const receipt = payload.receipt || {};
      state.processStep = "Preparing expense record"; render();
      state.draft = cleanDraft({ ...state.draft, date:receipt.date || today(), vendor:receipt.vendor || "", title:receipt.vendor || file.name.replace(/\.[^.]+$/, ""), category:receipt.category || "Supplies", paymentType:receipt.paymentType || "", amount:receipt.total || "", notes:receipt.notes || "", imageDataUrl, imageTitle:file.name, items:(receipt.lineItems || []).map((item) => ({name:item.name || "",price:item.total || "",category:item.category || receipt.category || "Supplies"})) });
      state.editing = true;
    } finally {
      state.processStep = "";
      if (typeof hideReceiptLoading === "function") hideReceiptLoading();
      render();
    }
  }

  function updateRevenue(file) {
    if (!file || typeof ensureExpenseRevenueRowForFile !== "function") return;
    const relevant = state.entries.filter((entry) => entry.fileId === fileKey(file));
    const row = ensureExpenseRevenueRowForFile(file); if (!row) return;
    row.expenses = relevant.reduce((sum,entry) => sum + amount(entry.amount),0);
    row.expenseLines = relevant.map((entry) => ({id:entry.id,date:entry.date,vendor:entry.vendor,note:entry.title || entry.notes,category:entry.category,amount:amount(entry.amount),baseAmount:amount(entry.amount),receiptSource:"ANIMUS Expense Center"}));
    if (typeof syncRevenueExpenseTotal === "function") syncRevenueExpenseTotal(row);
    if (typeof saveRevenueRows === "function") saveRevenueRows();
    if (typeof queueDashboardCloudSave === "function" && typeof buildDashboardSyncPayload === "function") queueDashboardCloudSave(buildDashboardSyncPayload()).catch(() => {});
  }

  async function saveDrawer() {
    captureDrawer(); const draft = state.draft; const file = findFile(draft.fileId);
    if (!file) return window.alert("Choose the customer / job before saving this expense.");
    const total = amount(draft.amount) || draft.items.reduce((sum,item) => sum + amount(item.price),0);
    if (!total) return window.alert("Add a receipt total or a priced line item before saving.");
    const entry = { ...draft, id:draft.id || expenseId(), amount:total, fileId:fileKey(file), items:draft.items.filter((item) => item.name.trim() || amount(item.price)).map((item) => ({...item,price:amount(item.price)})) };
    const response = await fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",body:JSON.stringify({fileId:entry.fileId,expense:entry})});
    const payload = await response.json().catch(() => ({})); if (!response.ok || payload.ok === false) throw new Error(payload.error || "Expense could not be saved.");
    state.entries = [{...payload.expense,fileId:entry.fileId,file},...state.entries.filter((item) => item.id !== payload.expense.id)]; state.selectedId = payload.expense.id; state.draft = null; state.editing = false; updateRevenue(file); render();
  }

  async function deleteSelected() { const entry = drawerData(); if (!entry?.id || !window.confirm("Delete this saved expense?")) return; const response = await fetch(`${API}?fileId=${encodeURIComponent(entry.fileId)}&expenseId=${encodeURIComponent(entry.id)}`,{method:"DELETE",cache:"no-store"}); const payload = await response.json().catch(() => ({})); if (!response.ok || payload.ok === false) throw new Error(payload.error || "Expense could not be deleted."); state.entries = state.entries.filter((item) => item.id !== entry.id); updateRevenue(findFile(entry.fileId)); state.selectedId=""; state.draft=null; state.editing=false; render(); }

  function showPriceImport(items) {
    const draft = drawerData(); const normalizer = typeof normalizeReceiptProduct === "function" ? normalizeReceiptProduct : (value) => String(value || "").trim().toLowerCase(); const database = typeof priceDatabaseRows === "function" ? priceDatabaseRows() : [];
    const rows = items.filter((item) => item.name && amount(item.price)).map((item,index) => { const existing = database.find((row) => normalizer(row.product || row.name) === normalizer(item.name)); const oldPrice = amount(existing?.defaultPrice || existing?.priceLow || existing?.price); return { id:`ec-price-${index}`,product:item.name,price:amount(item.price),category:item.category || draft.category,vendor:draft.vendor,existing,oldPrice,checked:!existing || Math.abs(oldPrice - amount(item.price)) > .004 }; });
    if (!rows.length) return window.alert("There are no named, priced receipt items to add to the Price Database.");
    document.querySelector("#expenseImportModal")?.remove(); document.body.insertAdjacentHTML("beforeend",`<div class="expense-import-backdrop" id="expenseImportModal"><section class="expense-import-modal"><div class="expense-drawer-head"><div><p class="expense-breadcrumb">Price Database</p><h2>Review Receipt Items</h2></div><button class="expense-close" id="expenseImportClose">×</button></div><p class="expense-breadcrumb">New items and changed prices are preselected. Edit anything before importing.</p>${rows.map((row) => `<div class="expense-import-row"><input type="checkbox" data-ec-import-check="${row.id}"${row.checked ? " checked" : ""}><span><strong>${row.existing ? (row.checked ? `Update ${money(row.oldPrice)} → ${money(row.price)}` : `Already current · ${money(row.oldPrice)}`) : "New item"}</strong><input data-ec-import-product="${row.id}" value="${esc(row.product)}"><input data-ec-import-price="${row.id}" value="${esc(row.price)}" inputmode="decimal"><input data-ec-import-category="${row.id}" value="${esc(row.category)}"><input data-ec-import-vendor="${row.id}" value="${esc(row.vendor)}"></span></div>`).join("")}<div class="expense-import-actions"><button class="expense-button" id="expenseImportCancel">Cancel</button><button class="expense-button primary" id="expenseImportConfirm">Add Checked Items</button></div></section></div>`);
    const close = () => document.querySelector("#expenseImportModal")?.remove(); document.querySelector("#expenseImportClose")?.addEventListener("click",close); document.querySelector("#expenseImportCancel")?.addEventListener("click",close); document.querySelector("#expenseImportConfirm")?.addEventListener("click",() => { const selected=rows.filter((row)=>document.querySelector(`[data-ec-import-check="${row.id}"]`)?.checked).map((row)=>({product:document.querySelector(`[data-ec-import-product="${row.id}"]`)?.value.trim()||row.product,price:document.querySelector(`[data-ec-import-price="${row.id}"]`)?.value.trim()||row.price,category:document.querySelector(`[data-ec-import-category="${row.id}"]`)?.value.trim()||row.category,vendor:document.querySelector(`[data-ec-import-vendor="${row.id}"]`)?.value.trim()||row.vendor,unit:"each"})); if (!selected.length) return; const result=typeof importLinesToPriceDatabase === "function" ? importLinesToPriceDatabase(selected,{vendor:draft.vendor,date:draft.date,category:draft.category}) : null; close(); if (result) window.alert(`${result.updatedCount} updated, ${result.addedCount} added to the Price Database.`); });
  }

  function bind() {
    document.querySelectorAll("[data-expense-view]").forEach((button) => button.addEventListener("click", () => { const view=button.dataset.expenseView; if (view !== "expenses") { setExpenseCenterMode(false); switchCrmView(view); } }));
    document.querySelectorAll("[data-expense-tab]").forEach((button) => button.addEventListener("click",()=>{state.tab=button.dataset.expenseTab;render();}));
    document.querySelector("#expenseRefresh")?.addEventListener("click",loadExpenses); document.querySelector("#expenseUpload")?.addEventListener("click",()=>document.querySelector("#expenseUploadInput")?.click()); document.querySelector("#expenseScan")?.addEventListener("click",()=>document.querySelector("#expenseUploadInput")?.click()); document.querySelector("#expenseUploadInput")?.addEventListener("change",(event)=>scan(event.target.files?.[0]).catch((error)=>{state.processStep="";render();window.alert(error.message || "Receipt could not be read.");}));
    document.querySelector("#expenseSearch")?.addEventListener("input",(event)=>{state.filters.query=event.target.value;render();}); document.querySelector("#expenseScope")?.addEventListener("change",(event)=>{state.scope=event.target.value;render();}); document.querySelector("#expenseCategory")?.addEventListener("change",(event)=>{state.filters.category=event.target.value;render();}); document.querySelector("#expenseVendor")?.addEventListener("change",(event)=>{state.filters.vendor=event.target.value;render();}); document.querySelector("#expenseFrom")?.addEventListener("change",(event)=>{state.filters.from=event.target.value;render();}); document.querySelector("#expenseTo")?.addEventListener("change",(event)=>{state.filters.to=event.target.value;render();});
    document.querySelectorAll("[data-expense-open]").forEach((button)=>button.addEventListener("click",()=>{state.selectedId=button.dataset.expenseOpen;state.draft=null;state.editing=false;render();})); document.querySelectorAll("[data-expense-edit]").forEach((button)=>button.addEventListener("click",()=>{state.selectedId=button.dataset.expenseEdit;state.draft=cleanDraft(selectedEntry());state.editing=true;render();})); document.querySelector("#expenseDrawerClose")?.addEventListener("click",()=>{state.selectedId="";state.draft=null;state.editing=false;render();});
    document.querySelector("#expenseEditToggle")?.addEventListener("click",()=>{if (!state.editing) state.draft=cleanDraft(selectedEntry()); else captureDrawer();state.editing=!state.editing;render();}); document.querySelector("#expenseSave")?.addEventListener("click",()=>saveDrawer().catch((error)=>window.alert(error.message || "Expense could not be saved."))); document.querySelector("#expenseSaveLater")?.addEventListener("click",()=>{captureDrawer();state.editing=true;render();}); document.querySelector("#expenseDelete")?.addEventListener("click",()=>deleteSelected().catch((error)=>window.alert(error.message || "Expense could not be deleted."))); document.querySelector("#expenseImportAll")?.addEventListener("click",()=>showPriceImport(drawerData()?.items || [])); document.querySelectorAll("[data-expense-item-import]").forEach((button)=>button.addEventListener("click",()=>showPriceImport([drawerData()?.items?.[Number(button.dataset.expenseItemImport)]])));
  }

  // Replaces only the Expenses view. The existing scanner and storage functions are left intact.
  const legacyOpenFileExpenses = typeof openFileExpenses === "function" ? openFileExpenses : null;
  if (legacyOpenFileExpenses) {
    openFileExpenses = function animusOpenFileExpenses(...args) {
      legacyOpenFileExpenses(...args);
      const file = typeof activeFile === "function" ? activeFile() : null;
      state.scope = fileKey(file) || "all";
      state.selectedId = "";
      render();
      if (!state.loaded && !state.loading) loadExpenses();
    };
  }
  // Revenue rows open expenses for their linked customer file. Keep the new
  // center focused on that file rather than making the user filter it again.
  const legacyOpenRevenueExpenses = typeof openRevenueExpenses === "function" ? openRevenueExpenses : null;
  if (legacyOpenRevenueExpenses) {
    openRevenueExpenses = function animusOpenRevenueExpenses(...args) {
      legacyOpenRevenueExpenses(...args);
      const file = typeof activeFile === "function" ? activeFile() : null;
      state.scope = fileKey(file) || "all";
      state.selectedId = "";
      render();
      if (!state.loaded && !state.loading) loadExpenses();
    };
  }
  renderFileExpenses = () => { render(); if (!state.loaded && !state.loading) loadExpenses(); };
  window.renderFileExpenses = renderFileExpenses;
  document.addEventListener("click", (event) => { const button=event.target.closest?.("[data-crm-view]"); if (button && button.dataset.crmView !== "expenses") setExpenseCenterMode(false); });
  document.addEventListener("DOMContentLoaded", () => { if (!document.querySelector("#crmExpensesView")?.hidden) { render(); loadExpenses(); } });
  if (document.readyState !== "loading" && !document.querySelector("#crmExpensesView")?.hidden) { render(); loadExpenses(); }
  window.animusExpenseCenterLoad = loadExpenses;
})();
