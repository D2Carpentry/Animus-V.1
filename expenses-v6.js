// ANIMUS Expense Center v6
// UI layer over the existing receipt AI, Cloudflare receipt ledger, Revenue, and Price Database hooks.
(() => {
  const API = "/api/expenses";
  // "home" is the business-wide landing page. "file" is used only when a
  // Work File or Revenue row deliberately opens its own expense ledger.
  const state = { entries: [], loaded: false, loading: false, selectedId: "", selectedIds: new Set(), scope: "all", mode: "home", tab: "processed", filters: {}, draft: null, editing: false, processStep: "", requestId: 0 };
  const money = (value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value) || 0);
  const amount = (value) => Number(String(value || "").replace(/[$,]/g, "")) || 0;
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[char]));
  const today = () => new Date().toISOString().slice(0, 10);
  const shortDate = (value) => {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[2]}-${match[3]}-${match[1].slice(-2)}` : (value || "—");
  };
  const expenseId = () => `expense-v6-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const receiptImageSrc = (entry = {}) => String(entry.imageDataUrl || entry.receiptImageUrl || "");
  const hasReceiptImage = (entry = {}) => Boolean(receiptImageSrc(entry));
  const fileKey = (file) => String(file?.id || file?.fileNumber || "").trim();
  const files = () => typeof crmFiles !== "undefined" && Array.isArray(crmFiles) ? crmFiles : [];
  const findFile = (id) => files().find((file) => fileKey(file) === id || file.id === id) || null;

  function cleanDraft(source = {}) {
    return {
      id: source.id || "", fileId: source.fileId || fileKey(typeof activeFile === "function" ? activeFile() : null), date: source.date || today(), vendor: source.vendor || "", title: source.title || "",
      category: source.category || "Supplies", paymentType: source.paymentType || "", amount: source.amount === undefined ? "" : String(source.amount), notes: source.notes || "",
      imageDataUrl: source.imageDataUrl || "", receiptImageKey: source.receiptImageKey || "", receiptImageUrl: source.receiptImageUrl || "", imageTitle: source.imageTitle || "",
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
      if (state.filters.imagesOnly && !hasReceiptImage(entry)) return false;
      if (!query) return true;
      return [entry.vendor, entry.title, entry.category, entry.paymentType, entry.file?.clientName, entry.file?.fileNumber, entry.notes].some((value) => String(value || "").toLowerCase().includes(query));
    });
  }

  function thisMonthExpenses() {
    const month = new Date().toISOString().slice(0,7);
    return state.entries.filter((entry) => String(entry.date || "").slice(0,7) === month).reduce((sum,entry) => sum + amount(entry.amount), 0);
  }

  function fileExpenseGroups() {
    const groups = new Map();
    state.entries.forEach((entry) => {
      const key = String(entry.fileId || "");
      if (!key) return;
      const current = groups.get(key) || { file: findFile(key) || entry.file, entries: [], total: 0, latest: "" };
      current.entries.push(entry);
      current.total += amount(entry.amount);
      const stamp = String(entry.updatedAt || entry.createdAt || entry.date || "");
      if (stamp > current.latest) current.latest = stamp;
      groups.set(key, current);
    });
    return [...groups.values()].sort((a, b) => String(b.latest).localeCompare(String(a.latest)));
  }

  function expenseHomeMarkup() {
    if (state.loading) return `<section class="expense-home-card expense-empty">Loading saved expense ledgers from Cloudflare...</section>`;
    const groups = fileExpenseGroups();
    if (!groups.length) return `<section class="expense-home-card expense-empty"><strong>No work files have saved expenses yet.</strong><span>Open a work file, choose Expenses, then add the first receipt or manual expense.</span></section>`;
    return `<section class="expense-home-card"><div class="expense-home-card-head"><div><h2>Work Files with Expenses</h2><p>Open a file to review, add, or edit only its own saved expenses.</p></div><span>${groups.length} file${groups.length === 1 ? "" : "s"}</span></div><div class="expense-file-ledger-list">${groups.map((group) => {
      const file = group.file || {};
      const title = `${file.fileNumber || "Project"} · ${file.clientName || "Unnamed Client"}`;
      const latest = String(group.latest || group.entries[0]?.date || "").slice(0, 10) || "No date";
      return `<button type="button" class="expense-file-ledger" data-expense-file-open="${esc(fileKey(file) || group.entries[0]?.fileId)}"><span class="expense-file-ledger-avatar">${esc(String(file.clientName || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?")}</span><span class="expense-file-ledger-copy"><strong>${esc(title)}</strong><small>${group.entries.length} saved expense${group.entries.length === 1 ? "" : "s"} · Updated ${esc(latest)}</small></span><span class="expense-file-ledger-total">${money(group.total)}<small>Open ledger ›</small></span></button>`;
    }).join("")}</div></section>`;
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
    return `<table class="expense-table expense-file-table"><thead><tr><th></th><th>Receipt</th><th>Date</th><th>Expense Name</th><th>Total</th><th>Actions</th></tr></thead><tbody>${entries.map((entry) => {
      const selected = entry.id === state.selectedId;
      const title = entry.title || entry.vendor || "Untitled expense";
      const imageSrc = receiptImageSrc(entry);
      const receipt = imageSrc ? `<img src="${esc(imageSrc)}" alt="Receipt">` : "▤";
      return `<tr class="${selected ? "selected" : ""}"><td><input class="expense-check" type="checkbox" data-expense-check="${esc(entry.id)}"${state.selectedIds.has(entry.id) ? " checked" : ""} aria-label="Select ${esc(title)}"></td><td><button type="button" class="expense-thumb expense-thumb-button" data-expense-open="${esc(entry.id)}" aria-label="View ${esc(title)}">${receipt}</button></td><td>${esc(shortDate(entry.date))}</td><td><button type="button" class="expense-name-button" data-expense-open="${esc(entry.id)}"><strong>${esc(title)}</strong><small>${esc(entry.vendor || "No vendor")}</small></button></td><td class="expense-amount">${money(entry.amount)}</td><td><button class="expense-icon-action" data-expense-open="${esc(entry.id)}" aria-label="View receipt">◉</button><button class="expense-icon-action" data-expense-edit="${esc(entry.id)}" aria-label="Edit receipt">✎</button></td></tr>`;
    }).join("")}</tbody></table>`;
  }

  function drawerMarkup() {
    const data = drawerData();
    if (state.processStep) return `<aside class="expense-drawer"><div class="expense-drawer-head"><h2>Reading receipt...</h2><button class="expense-close" id="expenseDrawerClose">×</button></div>${processingMarkup()}</aside>`;
    if (!data) return `<aside class="expense-drawer"><div class="expense-drawer-head"><h2>Receipt Details</h2></div><div class="expense-empty">Select a receipt to review its image, details, line items, and Price Database options.</div></aside>`;
    const editing = state.editing || Boolean(state.draft);
    const file = findFile(data.fileId) || data.file;
    const items = (data.items || []).filter((item) => item.name || amount(item.price));
    const info = editing ? `<div class="expense-detail-editor"><label>Customer / Job<select id="expenseDraftFile">${fileOptions(data.fileId)}</select></label><label>Expense Title<input id="expenseDraftTitle" value="${esc(data.title)}"></label><label>Receipt Image Name<input id="expenseDraftImageTitle" value="${esc(data.imageTitle)}" placeholder="Receipt image name"></label><label>Vendor<input id="expenseDraftVendor" value="${esc(data.vendor)}"></label><label>Date<input id="expenseDraftDate" type="date" value="${esc(data.date)}"></label><label>Receipt Total<input id="expenseDraftAmount" inputmode="decimal" value="${esc(data.amount)}"></label><label>Category<select id="expenseDraftCategory">${categoryOptions(data.category)}</select></label><label>Paid By<select id="expenseDraftPayment">${paymentOptions(data.paymentType)}</select></label></div>` : `<div class="expense-details"><div class="expense-detail"><span>Expense Title</span><b>${esc(data.title || data.vendor || "—")}</b></div><div class="expense-detail"><span>Receipt Image Name</span><b>${esc(data.imageTitle || "—")}</b></div><div class="expense-detail"><span>Vendor</span><b>${esc(data.vendor || "—")}</b></div><div class="expense-detail"><span>Total Amount</span><b>${money(data.amount)}</b></div><div class="expense-detail"><span>Category</span><b>${esc(data.category || "—")}</b></div><div class="expense-detail"><span>Paid By</span><b>${esc(data.paymentType || "—")}</b></div><div class="expense-detail"><span>Customer / Job</span><b>${esc(file ? `${file.fileNumber || "Project"} · ${file.clientName || "Unnamed"}` : "—")}</b></div></div>`;
    const itemMarkup = items.length ? items.map((item,index) => editing ? `<div class="expense-item"><input data-expense-item-name="${index}" value="${esc(item.name)}"><input data-expense-item-price="${index}" inputmode="decimal" value="${esc(item.price)}"></div>` : `<div class="expense-item"><span class="expense-item-name">${esc(item.name)}</span><b>${money(item.price)}</b><button class="expense-item-add" data-expense-item-import="${index}">Add to Price Database</button></div>`).join("") : `<div class="expense-item"><span>No line items were saved with this expense.</span></div>`;
    const imageSrc = receiptImageSrc(data);
    return `<aside class="expense-drawer"><div class="expense-drawer-head"><h2>Receipt Details</h2><button class="expense-close" id="expenseDrawerClose">×</button></div><div class="expense-drawer-status"><span class="expense-status ${imageSrc ? "" : "manual"}">${imageSrc ? "Receipt saved" : "Manual expense"}</span><small>${data.receiptImageKey ? "Photo backed up in ANIMUS cloud storage." : "AI confidence is not stored by the current scanner."}</small></div>${imageSrc ? `<button type="button" class="expense-preview expense-preview-button" id="expenseImagePreviewButton" aria-label="Open larger receipt image"><img src="${esc(imageSrc)}" alt="Receipt image"><span>Click to enlarge</span></button>` : `<div class="expense-preview">No receipt image</div>`}<p class="expense-drawer-vendor">${esc(data.title || data.vendor || "New Expense")}</p><p class="expense-drawer-meta">${esc(data.date || "No date")} · ${esc(data.imageTitle || "No receipt reference")}</p><section class="expense-detail-section"><div class="expense-section-top"><h3>Extracted Information</h3><button class="expense-link-button" id="expenseEditToggle">${editing ? "Done" : "Edit"}</button></div>${info}</section><section class="expense-detail-section"><div class="expense-section-top"><h3>Items (${items.length})</h3><button class="expense-link-button" id="expenseImportAll">Add to Price Database</button></div><div id="expenseDrawerItems">${itemMarkup}</div></section><section class="expense-detail-section"><h3>Notes <span style="color:#94a3b8;font-weight:600">(Optional)</span></h3>${editing ? `<textarea id="expenseDraftNotes">${esc(data.notes)}</textarea>` : `<p style="margin:10px 0 0;color:#64748b;font-size:12px;white-space:pre-wrap">${esc(data.notes || "No notes")}</p>`}</section><div class="expense-drawer-actions"><button class="expense-button danger" id="expenseDelete">Delete</button><button class="expense-button primary" id="expenseSave">Save Changes</button></div></aside>`;
  }

  function openReceiptImagePreview(src, alt = "Receipt image") {
    if (!src) return;
    document.querySelector("#expenseImagePreviewModal")?.remove();
    document.body.insertAdjacentHTML("beforeend", `<div class="expense-image-preview-backdrop" id="expenseImagePreviewModal" role="dialog" aria-modal="true" aria-label="Receipt image preview"><section class="expense-image-preview-modal"><button type="button" class="expense-image-preview-close" aria-label="Close receipt preview">×</button><img src="${esc(src)}" alt="${esc(alt)}"></section></div>`);
    const modal = document.querySelector("#expenseImagePreviewModal");
    const close = () => modal?.remove();
    modal?.querySelector(".expense-image-preview-close")?.addEventListener("click", close);
    modal?.addEventListener("click", (event) => { if (event.target === modal) close(); });
    const onKeyDown = (event) => { if (event.key === "Escape") { close(); document.removeEventListener("keydown", onKeyDown); } };
    document.addEventListener("keydown", onKeyDown);
  }

  function detailModalMarkup() {
    if (!state.processStep && !drawerData()) return "";
    return `<div class="expense-detail-backdrop" id="expenseDetailModal" role="dialog" aria-modal="true" aria-label="Expense details"><div class="expense-detail-modal">${drawerMarkup()}</div></div>`;
  }

  function render() {
    const root = document.querySelector("#crmExpensesView");
    if (!root) return;
    setExpenseCenterMode(true);
    const rows = visibleEntries();
    const groups = fileExpenseGroups();
    const categories = [...new Set(state.entries.map((entry) => entry.category).filter(Boolean))];
    const vendors = [...new Set(state.entries.map((entry) => entry.vendor).filter(Boolean))].sort();
    const activeTabs = [["inbox","Receipt Inbox"],["processed","Processed Expenses"],["history","Expense History"],["categories","Categories"],["vendors","Vendors"]];
    const isHome = state.mode === "home";
    const targetFile = state.scope !== "all" ? findFile(state.scope) : null;
    const headerEntries = isHome ? state.entries : rows;
    const currentMonth = new Date().toISOString().slice(0, 7);
    const headerThisMonth = headerEntries.filter((entry) => String(entry.date || "").slice(0, 7) === currentMonth).reduce((sum, entry) => sum + amount(entry.amount), 0);
    const headerTotal = headerEntries.reduce((sum, entry) => sum + amount(entry.amount), 0);
    const headerYtd = headerEntries.filter((entry) => String(entry.date || "").slice(0, 4) === String(new Date().getFullYear())).reduce((sum, entry) => sum + amount(entry.amount), 0);
    const pageTitle = isHome ? "Expenses" : (state.filters.imagesOnly && !targetFile ? "Receipt Images" : `${targetFile?.clientName || "Work File"} Expenses`);
    const breadcrumb = isHome ? "Home &nbsp;›&nbsp; Expenses" : `Expenses &nbsp;›&nbsp; ${esc(targetFile?.fileNumber || "Work File")}`;
    const body = isHome
      ? `<section class="expense-home-workspace">${expenseHomeMarkup()}</section>`
      : `<section class="expense-workspace expense-workspace-single"><section class="expense-table-card"><div class="expense-toolbar"><button class="expense-button small" id="expenseBackHome">← All expense files</button><input class="expense-search" id="expenseSearch" value="${esc(state.filters.query || "")}" placeholder="Search this file's expenses..."><select class="expense-select" id="expenseCategory"><option value="">Category</option>${categories.map((value) => `<option${state.filters.category === value ? " selected" : ""}>${esc(value)}</option>`).join("")}</select><select class="expense-select" id="expenseVendor"><option value="">Vendor</option>${vendors.map((value) => `<option${state.filters.vendor === value ? " selected" : ""}>${esc(value)}</option>`).join("")}</select><button class="expense-button danger small" id="expenseDeleteChecked"${state.selectedIds.size ? "" : " disabled"}>Delete Selected${state.selectedIds.size ? ` (${state.selectedIds.size})` : ""}</button><span class="expense-count">${rows.length} expense${rows.length === 1 ? "" : "s"}</span></div>${tableMarkup(rows)}</section></section>`;
    root.innerHTML = `<section class="expense-center"><aside class="expense-sidebar"><div class="expense-brand"><img src="assets/d2-logo.png" alt="D2 logo"><span>ANIMUS<small>Command Center</small></span></div><p class="expense-side-label">Workspace</p>${[["dashboard","⌂","Dashboard"],["calendar","□","Calendar"],["estimator","▤","Estimates"],["files","▱","Work Files"],["contacts","◉","Contacts"]].map(([view,icon,label]) => `<button class="expense-side-button" data-expense-view="${view}"><span class="expense-side-icon">${icon}</span>${label}</button>`).join("")}<p class="expense-side-label">Business</p>${[["revenue","↗","Revenue"],["expenses","▧","Expenses"],["payroll","♙","Payroll"],["prices","▦","Price Database"],["business","◈","Business Performance"]].map(([view,icon,label]) => `<button class="expense-side-button ${view === "expenses" ? "active" : ""}" data-expense-view="${view}"><span class="expense-side-icon">${icon}</span>${label}</button>`).join("")}<div class="expense-side-account"><strong>D2 Carpentry &amp; Design</strong>Owner</div></aside><main class="expense-main"><header class="expense-header"><div><p class="expense-breadcrumb">${breadcrumb}</p><h1 class="expense-title">${esc(pageTitle)}</h1></div><div class="expense-header-actions"><button class="expense-button primary" id="expenseUpload">↑ Upload Receipt</button><button class="expense-button" id="expenseRefresh">↻</button><input id="expenseUploadInput" type="file" accept="image/*" hidden></div></header><section class="expense-kpis expense-kpis-three"><article class="expense-kpi"><div class="expense-kpi-label">This Month Expenses</div><div class="expense-kpi-value">${money(headerThisMonth)}</div><div class="expense-kpi-note">${isHome ? "Across all saved work files" : "For this work file"}</div><div class="expense-kpi-mark">$</div></article><button type="button" class="expense-kpi expense-kpi-button" id="expenseReceiptImages"><div class="expense-kpi-label">Receipt Images</div><div class="expense-kpi-value">${headerEntries.filter(hasReceiptImage).length}</div><div class="expense-kpi-note">View uploaded receipt photos</div><div class="expense-kpi-mark">▣</div></button><article class="expense-kpi"><div class="expense-kpi-label">${isHome ? "YTD Expenses" : "File Expense Total"}</div><div class="expense-kpi-value">${money(isHome ? headerYtd : headerTotal)}</div><div class="expense-kpi-note">${isHome ? "All saved expenses this year" : "All saved costs on this file"}</div><div class="expense-kpi-mark">$</div></article></section>${body}</main></section>${detailModalMarkup()}`;
    bind();
  }

  function captureDrawer() {
    if (!state.draft) state.draft = cleanDraft(selectedEntry() || {});
    const draft = state.draft;
    draft.fileId = document.querySelector("#expenseDraftFile")?.value || draft.fileId;
    draft.title = document.querySelector("#expenseDraftTitle")?.value.trim() || draft.title;
    draft.imageTitle = document.querySelector("#expenseDraftImageTitle")?.value.trim() || draft.imageTitle;
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
    const targetFileId = state.scope !== "all" ? state.scope : fileKey(typeof activeFile === "function" ? activeFile() : null);
    if (!targetFileId || !findFile(targetFileId)) {
      window.alert("Select the customer / job first. Every receipt must be saved to a work file.");
      return;
    }
    state.scope = targetFileId;
    state.draft = cleanDraft({ fileId: targetFileId, imageTitle:file.name });
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
    // The cloud receipt list is mirrored to the original work-file ledger so
    // Work Files, Revenue, and the Expense Center all read the same records.
    file.animusExpenseLedgerV4 = relevant.map((entry) => ({
      ...entry,
      amount: amount(entry.amount),
      items: Array.isArray(entry.items) ? entry.items.map((item) => ({ ...item, price: amount(item.price) })) : [],
    }));
    if (typeof syncExpenseLedgerV4 === "function") syncExpenseLedgerV4(file);
    if (typeof saveCrmFiles === "function") saveCrmFiles();
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

  async function deleteCheckedExpenses() {
    const ids = [...state.selectedIds];
    if (!ids.length) return;
    if (window.prompt(`Delete ${ids.length} selected expense${ids.length === 1 ? "" : "s"}? Enter D2 to continue.`) !== "D2") return;
    const selected = state.entries.filter((entry) => ids.includes(entry.id));
    for (const entry of selected) {
      const response = await fetch(`${API}?fileId=${encodeURIComponent(entry.fileId)}&expenseId=${encodeURIComponent(entry.id)}`, { method:"DELETE", cache:"no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok === false) throw new Error(payload.error || `Could not delete ${entry.title || entry.vendor || "an expense"}.`);
    }
    const changedFileIds = [...new Set(selected.map((entry) => entry.fileId))];
    state.entries = state.entries.filter((entry) => !state.selectedIds.has(entry.id));
    state.selectedIds.clear();
    changedFileIds.forEach((fileId) => updateRevenue(findFile(fileId)));
    render();
  }

  function priceMatch(normalizer, database, product) {
    return database.find((row) => normalizer(row.product || row.name) === normalizer(product));
  }

  function showPriceImport(items) {
    const draft = drawerData();
    const normalizer = typeof normalizeReceiptProduct === "function" ? normalizeReceiptProduct : (value) => String(value || "").trim().toLowerCase();
    const database = typeof priceDatabaseRows === "function" ? priceDatabaseRows() : [];
    const rows = items.filter((item) => item?.name && amount(item.price)).map((item, index) => ({
      id: `ec-price-${index}`,
      product: item.name,
      price: amount(item.price),
      category: item.category || draft.category,
      vendor: draft.vendor,
    }));
    if (!rows.length) return window.alert("There are no named, priced receipt items to add to the Price Database.");
    document.querySelector("#expenseImportModal")?.remove();
    document.body.insertAdjacentHTML("beforeend", `<div class="expense-import-backdrop" id="expenseImportModal"><section class="expense-import-modal" role="dialog" aria-modal="true" aria-label="Review receipt items"><div class="expense-drawer-head"><div><p class="expense-breadcrumb">Price Database</p><h2>Review Receipt Items</h2></div><button class="expense-close" id="expenseImportClose">×</button></div><p class="expense-breadcrumb">Each item is checked against your current Price Database as you type. Review the result, then submit the selected changes.</p>${rows.map((row) => `<div class="expense-import-row"><input type="checkbox" data-ec-import-check="${row.id}"><span><strong data-ec-import-status="${row.id}">Checking Price Database...</strong><input data-ec-import-product="${row.id}" value="${esc(row.product)}" aria-label="Item name"><input data-ec-import-price="${row.id}" value="${esc(row.price)}" inputmode="decimal" aria-label="Item price"><input data-ec-import-category="${row.id}" value="${esc(row.category)}" aria-label="Category"><input data-ec-import-vendor="${row.id}" value="${esc(row.vendor)}" aria-label="Vendor"></span></div>`).join("")}<div class="expense-import-actions"><button class="expense-button" id="expenseImportCancel">Cancel</button><button class="expense-button primary" id="expenseImportConfirm">Submit Changes</button></div></section></div>`);
    const modal = document.querySelector("#expenseImportModal");
    const close = () => modal?.remove();
    const refreshMatches = (keepSelections = true) => rows.forEach((row) => {
      const product = modal.querySelector(`[data-ec-import-product="${row.id}"]`)?.value.trim() || "";
      const price = amount(modal.querySelector(`[data-ec-import-price="${row.id}"]`)?.value);
      const existing = priceMatch(normalizer, database, product);
      const oldPrice = amount(existing?.defaultPrice || existing?.priceLow || existing?.price);
      const needsUpdate = Boolean(existing && Math.abs(oldPrice - price) > .004);
      const isNew = Boolean(product && !existing);
      const status = modal.querySelector(`[data-ec-import-status="${row.id}"]`);
      const check = modal.querySelector(`[data-ec-import-check="${row.id}"]`);
      if (status) status.textContent = isNew ? "New price line" : needsUpdate ? `Price update: ${existing.product || existing.name} · ${money(oldPrice)} → ${money(price)}` : existing ? `Already current: ${existing.product || existing.name} · ${money(oldPrice)}` : "Enter an item name and price";
      if (!keepSelections && check) check.checked = isNew || needsUpdate;
    });
    refreshMatches(false);
    modal.querySelectorAll("[data-ec-import-product], [data-ec-import-price]").forEach((input) => input.addEventListener("input", () => refreshMatches(false)));
    modal.querySelector("#expenseImportClose")?.addEventListener("click", close);
    modal.querySelector("#expenseImportCancel")?.addEventListener("click", close);
    modal.addEventListener("click", (event) => { if (event.target === modal) close(); });
    modal.querySelector("#expenseImportConfirm")?.addEventListener("click", () => {
      refreshMatches(true);
      const selected = rows.filter((row) => modal.querySelector(`[data-ec-import-check="${row.id}"]`)?.checked).map((row) => ({
        product: modal.querySelector(`[data-ec-import-product="${row.id}"]`)?.value.trim() || row.product,
        price: modal.querySelector(`[data-ec-import-price="${row.id}"]`)?.value.trim() || row.price,
        category: modal.querySelector(`[data-ec-import-category="${row.id}"]`)?.value.trim() || row.category,
        vendor: modal.querySelector(`[data-ec-import-vendor="${row.id}"]`)?.value.trim() || row.vendor,
        unit: "each",
      }));
      if (!selected.length) return window.alert("Select at least one new item or price update to submit.");
      const result = typeof importLinesToPriceDatabase === "function" ? importLinesToPriceDatabase(selected, { vendor:draft.vendor, date:draft.date, category:draft.category }) : null;
      close();
      if (result) window.alert(`${result.updatedCount} price update${result.updatedCount === 1 ? "" : "s"} and ${result.addedCount} new part${result.addedCount === 1 ? "" : "s"} submitted to the Price Database.`);
    });
  }

  function showPriceDatabaseManager() {
    const rows = typeof priceDatabaseRows === "function" ? priceDatabaseRows() : [];
    document.querySelector("#expenseDatabaseModal")?.remove();
    document.body.insertAdjacentHTML("beforeend", `<div class="expense-import-backdrop" id="expenseDatabaseModal"><section class="expense-import-modal expense-database-modal" role="dialog" aria-modal="true" aria-label="Price Database"><div class="expense-drawer-head"><div><p class="expense-breadcrumb">Price Database</p><h2>Review Price Database</h2></div><button class="expense-close" id="expenseDatabaseClose">×</button></div><p class="expense-breadcrumb">Review every saved line here. Update names or prices, check a line to delete it, then save your changes.</p><input class="expense-database-search" id="expenseDatabaseSearch" placeholder="Search parts, vendors, or categories"><div id="expenseDatabaseRows">${rows.map((row) => `<div class="expense-import-row expense-database-row" data-ec-db-row="${esc(row.id)}"><input type="checkbox" data-ec-db-delete="${esc(row.id)}" aria-label="Mark ${esc(row.product || row.name)} for deletion"><span><strong>${esc(row.readonly ? "Estimator line" : "Saved price line")}</strong><input data-ec-db-product="${esc(row.id)}" value="${esc(row.product || row.name)}" aria-label="Item name"><input data-ec-db-price="${esc(row.id)}" value="${esc(row.defaultPrice || row.priceLow || "")}" inputmode="decimal" aria-label="Price"><input data-ec-db-category="${esc(row.id)}" value="${esc(row.category || "")}" aria-label="Category"><input data-ec-db-vendor="${esc(row.id)}" value="${esc(row.vendor || row.source || "")}" aria-label="Vendor"></span></div>`).join("") || `<div class="expense-empty">No Price Database lines have been saved yet.</div>`}</div><div class="expense-import-actions"><button class="expense-button" id="expenseDatabaseCancel">Cancel</button><button class="expense-button primary" id="expenseDatabaseSave">Save Changes</button></div></section></div>`);
    const modal = document.querySelector("#expenseDatabaseModal");
    const close = () => modal?.remove();
    modal.querySelector("#expenseDatabaseClose")?.addEventListener("click", close);
    modal.querySelector("#expenseDatabaseCancel")?.addEventListener("click", close);
    modal.addEventListener("click", (event) => { if (event.target === modal) close(); });
    modal.querySelector("#expenseDatabaseSearch")?.addEventListener("input", (event) => {
      const query = event.target.value.trim().toLowerCase();
      modal.querySelectorAll("[data-ec-db-row]").forEach((element) => { element.hidden = query && !element.textContent.toLowerCase().includes(query); });
    });
    modal.querySelector("#expenseDatabaseSave")?.addEventListener("click", () => {
      let changed = 0;
      rows.forEach((row) => {
        const id = row.id;
        const deleted = modal.querySelector(`[data-ec-db-delete="${id}"]`)?.checked;
        if (deleted) {
          crmPriceRows = crmPriceRows.filter((entry) => entry.id !== id);
          if (row.readonly || row.sourceId) crmDeletedPriceIds = Array.from(new Set([...crmDeletedPriceIds, row.sourceId || id]));
          changed += 1;
          return;
        }
        const product = modal.querySelector(`[data-ec-db-product="${id}"]`)?.value.trim() || "";
        const price = amount(modal.querySelector(`[data-ec-db-price="${id}"]`)?.value);
        const category = modal.querySelector(`[data-ec-db-category="${id}"]`)?.value.trim() || "Custom";
        const vendor = modal.querySelector(`[data-ec-db-vendor="${id}"]`)?.value.trim() || "";
        const oldPrice = amount(row.defaultPrice || row.priceLow || row.price);
        if (!product || !price || (product === (row.product || row.name) && price === oldPrice && category === (row.category || "") && vendor === (row.vendor || row.source || ""))) return;
        const updated = { ...(row.readonly ? {} : row), id:row.readonly ? `custom-${makeCrmId("price")}` : id, sourceId:row.readonly ? id : row.sourceId, product, name:product, category, vendor, source:vendor, unit:row.unit || "each", priceLow:price, priceHigh:price, defaultPrice:price, lastChecked:new Date().toISOString().slice(0,10) };
        const index = crmPriceRows.findIndex((entry) => entry.id === id);
        if (index >= 0) crmPriceRows[index] = updated; else crmPriceRows.unshift(updated);
        changed += 1;
      });
      if (changed) { savePriceRows(); saveDeletedPriceIds(); renderPriceDatabase?.(); }
      close();
      window.alert(changed ? `${changed} Price Database change${changed === 1 ? "" : "s"} saved.` : "No Price Database changes were needed.");
    });
  }

  function bind() {
    document.querySelectorAll("[data-expense-view]").forEach((button) => button.addEventListener("click", () => { const view=button.dataset.expenseView; if (view !== "expenses") { setExpenseCenterMode(false); switchCrmView(view); } }));
    document.querySelectorAll("[data-expense-tab]").forEach((button) => button.addEventListener("click",()=>{state.tab=button.dataset.expenseTab;render();}));
    document.querySelector("#expenseRefresh")?.addEventListener("click",loadExpenses); document.querySelector("#expenseUpload")?.addEventListener("click",()=>document.querySelector("#expenseUploadInput")?.click()); document.querySelector("#expenseUploadInput")?.addEventListener("change",(event)=>scan(event.target.files?.[0]).catch((error)=>{state.processStep="";render();window.alert(error.message || "Receipt could not be read.");}));
    document.querySelector("#expenseBackHome")?.addEventListener("click", () => { state.mode = "home"; state.scope = "all"; state.selectedId = ""; state.selectedIds.clear(); state.draft = null; state.editing = false; state.filters.imagesOnly = false; render(); });
    document.querySelectorAll("[data-expense-file-open]").forEach((button) => button.addEventListener("click", () => { const file = findFile(button.dataset.expenseFileOpen); if (!file) return; if (typeof activeFileId !== "undefined") activeFileId = file.id; state.mode = "file"; state.scope = fileKey(file); state.selectedId = ""; state.draft = null; state.editing = false; render(); }));
    document.querySelector("#expenseSearch")?.addEventListener("input",(event)=>{state.filters.query=event.target.value;render();}); document.querySelector("#expenseScope")?.addEventListener("change",(event)=>{state.scope=event.target.value;render();}); document.querySelector("#expenseCategory")?.addEventListener("change",(event)=>{state.filters.category=event.target.value;render();}); document.querySelector("#expenseVendor")?.addEventListener("change",(event)=>{state.filters.vendor=event.target.value;render();}); document.querySelector("#expenseFrom")?.addEventListener("change",(event)=>{state.filters.from=event.target.value;render();}); document.querySelector("#expenseTo")?.addEventListener("change",(event)=>{state.filters.to=event.target.value;render();});
    document.querySelector("#expenseReceiptImages")?.addEventListener("click",()=>{state.mode="file"; state.filters.imagesOnly=true; state.selectedId=""; state.draft=null; state.editing=false; render();});
    document.querySelectorAll("[data-expense-check]").forEach((checkbox)=>checkbox.addEventListener("change",()=>{if(checkbox.checked) state.selectedIds.add(checkbox.dataset.expenseCheck); else state.selectedIds.delete(checkbox.dataset.expenseCheck); render();}));
    document.querySelector("#expenseDeleteChecked")?.addEventListener("click",()=>deleteCheckedExpenses().catch((error)=>window.alert(error.message || "Selected expenses could not be deleted.")));
    document.querySelectorAll("[data-expense-open]").forEach((button)=>button.addEventListener("click",()=>{state.selectedId=button.dataset.expenseOpen;state.draft=null;state.editing=false;render();})); document.querySelectorAll("[data-expense-edit]").forEach((button)=>button.addEventListener("click",()=>{state.selectedId=button.dataset.expenseEdit;state.draft=cleanDraft(selectedEntry());state.editing=true;render();})); document.querySelector("#expenseDrawerClose")?.addEventListener("click",()=>{state.selectedId="";state.draft=null;state.editing=false;render();}); document.querySelector("#expenseDetailModal")?.addEventListener("click",(event)=>{if(event.target.id === "expenseDetailModal"){state.selectedId="";state.draft=null;state.editing=false;render();}}); document.querySelector("#expenseImagePreviewButton")?.addEventListener("click",()=>{const image=drawerData();openReceiptImagePreview(receiptImageSrc(image), image?.imageTitle || image?.title || "Receipt image");});
    document.querySelector("#expenseEditToggle")?.addEventListener("click",()=>{if (!state.editing) state.draft=cleanDraft(selectedEntry()); else captureDrawer();state.editing=!state.editing;render();}); document.querySelector("#expenseSave")?.addEventListener("click",()=>saveDrawer().catch((error)=>window.alert(error.message || "Expense could not be saved."))); document.querySelector("#expenseDelete")?.addEventListener("click",()=>deleteSelected().catch((error)=>window.alert(error.message || "Expense could not be deleted."))); document.querySelector("#expenseImportAll")?.addEventListener("click",()=>showPriceImport(drawerData()?.items || [])); document.querySelectorAll("[data-expense-item-import]").forEach((button)=>button.addEventListener("click",()=>showPriceImport([drawerData()?.items?.[Number(button.dataset.expenseItemImport)]])));
  }

  // Replaces only the Expenses view. The existing scanner and storage functions are left intact.
  // The sidebar always opens the Expense Home. Calls from a specific Work File
  // explicitly use the file scope, so records never appear mixed together.
  const legacySwitchCrmView = typeof switchCrmView === "function" ? switchCrmView : null;
  if (legacySwitchCrmView) {
    switchCrmView = function animusExpenseCenterSwitch(view, options = {}) {
      if (view === "expenses") {
        const fileScoped = options?.expenseScope === "file" || options?.expenseFileId;
        const file = typeof activeFile === "function" ? activeFile() : null;
        state.mode = fileScoped && file ? "file" : "home";
        state.scope = fileScoped && file ? fileKey(file) : "all";
        state.selectedId = "";
        state.draft = null;
        state.editing = false;
      }
      return legacySwitchCrmView(view);
    };
    window.switchCrmView = switchCrmView;
  }
  const legacyOpenFileExpenses = typeof openFileExpenses === "function" ? openFileExpenses : null;
  openFileExpenses = function animusOpenFileExpenses(...args) {
      if (legacyOpenFileExpenses) legacyOpenFileExpenses(...args);
      const file = typeof activeFile === "function" ? activeFile() : null;
      state.scope = fileKey(file) || "all";
      state.mode = file ? "file" : "home";
      state.selectedId = "";
      if (typeof switchCrmView === "function") switchCrmView("expenses", { expenseScope: "file" }); else render();
      if (!state.loaded && !state.loading) loadExpenses();
  };
  window.openFileExpenses = openFileExpenses;
  // Revenue rows open expenses for their linked customer file. Keep the new
  // center focused on that file rather than making the user filter it again.
  const legacyOpenRevenueExpenses = typeof openRevenueExpenses === "function" ? openRevenueExpenses : null;
  if (legacyOpenRevenueExpenses) {
    openRevenueExpenses = function animusOpenRevenueExpenses(...args) {
      legacyOpenRevenueExpenses(...args);
      const file = typeof activeFile === "function" ? activeFile() : null;
      state.scope = fileKey(file) || "all";
      state.mode = file ? "file" : "home";
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
  window.getAnimusExpensesForFile = (id) => state.entries.filter((entry) => entry.fileId === String(id || ""));
})();
