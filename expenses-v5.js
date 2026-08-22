// ANIMUS Expense Ledger v5
// Each receipt is stored as its own R2 object. This intentionally does not
// read, merge, or write any of the older dashboard receipt arrays.
(() => {
  const EXPENSE_API = "/api/expenses";
  const expenseState = { fileId: "", entries: [], draft: null, loading: false, requestId: 0 };

  const money = (value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value) || 0);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
  const today = () => new Date().toISOString().slice(0, 10);
  const amount = (value) => Number(String(value || "").replace(/[$,]/g, "")) || 0;
  const newId = () => `expense-v5-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  function currentFile() {
    let file = typeof activeFile === "function" ? activeFile() : null;
    if (!file && typeof crmFiles !== "undefined" && crmFiles.length) {
      activeFileId = crmFiles[0].id;
      file = activeFile();
    }
    return file || null;
  }

  function fileKey(file) {
    return String(file?.id || file?.fileNumber || "").trim();
  }

  function cleanDraft(source = {}) {
    return {
      id: source.id || "",
      date: source.date || today(),
      vendor: source.vendor || "",
      title: source.title || "",
      category: source.category || "Supplies",
      paymentType: source.paymentType || "",
      amount: source.amount === undefined ? "" : String(source.amount),
      notes: source.notes || "",
      imageDataUrl: source.imageDataUrl || "",
      imageTitle: source.imageTitle || "",
      items: Array.isArray(source.items) && source.items.length ? source.items.map((item) => ({
        name: item.name || "", price: item.price === undefined ? "" : String(item.price), category: item.category || source.category || "Supplies",
      })) : [{ name: "", price: "", category: source.category || "Supplies" }],
    };
  }

  function currentTotal() {
    const draft = expenseState.draft || cleanDraft();
    return amount(draft.amount) || draft.items.reduce((sum, item) => sum + amount(item.price), 0);
  }

  function status(message, type = "") {
    const element = document.querySelector("#animusExpenseV5Status");
    if (!element) return;
    element.textContent = message;
    element.dataset.state = type;
  }

  async function fetchExpenses(file) {
    const key = fileKey(file);
    if (!key) return [];
    const requestId = ++expenseState.requestId;
    expenseState.loading = true;
    renderExpenseV5Markup();
    const response = await fetch(`${EXPENSE_API}?fileId=${encodeURIComponent(key)}&t=${Date.now()}`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) throw new Error(payload.error || "Could not load saved expenses.");
    if (requestId !== expenseState.requestId) return [];
    expenseState.fileId = key;
    expenseState.entries = Array.isArray(payload.expenses) ? payload.expenses : [];
    expenseState.loading = false;
    return expenseState.entries;
  }

  function updateRevenue(file) {
    const total = expenseState.entries.reduce((sum, entry) => sum + amount(entry.amount), 0);
    if (typeof ensureExpenseRevenueRowForFile !== "function") return;
    const row = ensureExpenseRevenueRowForFile(file);
    if (!row) return;
    row.expenses = total;
    row.expenseLines = expenseState.entries.map((entry) => ({
      id: entry.id, date: entry.date, vendor: entry.vendor, note: entry.title || entry.notes,
      category: entry.category, amount: amount(entry.amount), baseAmount: amount(entry.amount), receiptSource: "ANIMUS Expense Ledger v5",
    }));
    if (typeof syncRevenueExpenseTotal === "function") syncRevenueExpenseTotal(row);
    if (typeof saveRevenueRows === "function") saveRevenueRows();
    if (typeof renderRevenue === "function") renderRevenue();
    // The receipt remains independent. This only carries the rolling total to Revenue.
    if (typeof buildDashboardSyncPayload === "function" && typeof queueDashboardCloudSave === "function") {
      queueDashboardCloudSave(buildDashboardSyncPayload()).catch(() => {});
    }
  }

  async function saveExpense() {
    const file = currentFile();
    if (!file) return status("Select a customer file before saving an expense.", "error");
    const draft = expenseState.draft || cleanDraft();
    const total = currentTotal();
    if (!total) return status("Add a receipt total or at least one priced item.", "error");
    const entry = {
      ...draft,
      id: draft.id || newId(),
      amount: total,
      fileId: fileKey(file),
      items: draft.items.filter((item) => item.name.trim() || amount(item.price)).map((item) => ({ ...item, price: amount(item.price) })),
    };
    status("Saving this expense to the cloud...");
    const response = await fetch(EXPENSE_API, {
      method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
      body: JSON.stringify({ fileId: fileKey(file), expense: entry }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) throw new Error(payload.error || "Expense could not be saved.");
    expenseState.entries = [payload.expense, ...expenseState.entries.filter((item) => item.id !== payload.expense.id)];
    expenseState.draft = cleanDraft();
    updateRevenue(file);
    renderExpenseV5Markup();
    status("Expense saved to Cloudflare.", "success");
  }

  async function deleteExpense(id) {
    const file = currentFile();
    if (!file || !id) return;
    if (!window.confirm("Delete this saved expense?")) return;
    status("Deleting expense...");
    const response = await fetch(`${EXPENSE_API}?fileId=${encodeURIComponent(fileKey(file))}&expenseId=${encodeURIComponent(id)}`, { method: "DELETE", cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) throw new Error(payload.error || "Expense could not be deleted.");
    expenseState.entries = expenseState.entries.filter((entry) => entry.id !== id);
    updateRevenue(file);
    renderExpenseV5();
    status("Expense deleted from Cloudflare.", "success");
  }

  async function scanReceipt(file) {
    if (!file) return;
    status("Reading receipt photo with AI...");
    if (typeof showReceiptLoading === "function") showReceiptLoading("Reading receipt photo with AI...");
    try {
      const imageDataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file);
      });
      const response = await fetch("/api/receipt", {
        method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
        body: JSON.stringify({ imageDataUrl, fileName: file.name }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok === false) throw new Error(payload.error || "Receipt AI could not read that image.");
      const receipt = payload.receipt || {};
      expenseState.draft = cleanDraft({
        ...expenseState.draft, date: receipt.date || today(), vendor: receipt.vendor || "", category: receipt.category || "Supplies",
        paymentType: receipt.paymentType || "", amount: receipt.total || "", notes: receipt.notes || "", imageDataUrl, imageTitle: file.name,
        title: receipt.vendor || file.name.replace(/\.[^.]+$/, ""),
        items: (receipt.lineItems || []).map((item) => ({ name: item.name || "", price: item.total || "", category: item.category || receipt.category || "Supplies" })),
      });
      renderExpenseV5();
      status(payload.aiAvailable ? "Receipt read with AI. Review it, then save." : "Receipt attached. Review the fields, then save.", payload.aiAvailable ? "success" : "");
    } finally {
      if (typeof hideReceiptLoading === "function") hideReceiptLoading();
    }
  }

  function openPriceImport() {
    captureDraft();
    const draft = expenseState.draft || cleanDraft();
    const database = typeof priceDatabaseRows === "function" ? priceDatabaseRows() : [];
    const normalizer = typeof normalizeReceiptProduct === "function" ? normalizeReceiptProduct : (value) => String(value || "").trim().toLowerCase();
    const lines = draft.items.filter((item) => item.name.trim() && amount(item.price) > 0).map((item, index) => {
      const product = item.name.trim();
      const price = amount(item.price);
      const existing = database.find((row) => normalizer(row.product || row.name) === normalizer(product));
      const existingPrice = amount(existing?.defaultPrice || existing?.priceLow || existing?.price);
      const changed = Boolean(existing) && Math.abs(existingPrice - price) > 0.004;
      return { id: `v5-price-${index}`, product, price, category: item.category || draft.category, vendor: draft.vendor, existingPrice, status: existing ? (changed ? "Update price" : "Already current") : "New item", checked: !existing || changed };
    });
    if (!lines.length) return status("Add at least one named receipt item with a price before importing.", "error");
    document.querySelector("#animusV5PartsModal")?.remove();
    document.body.insertAdjacentHTML("beforeend", `<div class="crm-modal-backdrop" id="animusV5PartsModal"><section class="crm-choice-modal crm-parts-import-modal" role="dialog" aria-modal="true" aria-labelledby="animusV5PartsTitle"><button type="button" class="crm-modal-close" id="animusV5PartsClose" aria-label="Close">×</button><p class="eyebrow">Price Database</p><h2 id="animusV5PartsTitle">Review Receipt Items</h2><p class="crm-helper-text">Choose the items to add. Existing items are selected only when the receipt price is different.</p><div class="crm-parts-import-list">${lines.map((line) => `<div class="crm-parts-import-row"><input type="checkbox" data-v5-price-check="${line.id}"${line.checked ? " checked" : ""}><span><strong>${line.status}${line.existingPrice ? ` · Current ${money(line.existingPrice)}` : ""}</strong><input data-v5-price-product="${line.id}" value="${esc(line.product)}" placeholder="Item name"><input data-v5-price-amount="${line.id}" value="${esc(line.price)}" inputmode="decimal" placeholder="Price"><input data-v5-price-category="${line.id}" value="${esc(line.category)}" placeholder="Category"><input data-v5-price-vendor="${line.id}" value="${esc(line.vendor)}" placeholder="Vendor"></span></div>`).join("")}</div><div class="crm-choice-actions"><button type="button" class="icon-button primary-action" id="animusV5PartsConfirm">Add Checked Items</button></div></section></div>`);
    const close = () => document.querySelector("#animusV5PartsModal")?.remove();
    document.querySelector("#animusV5PartsClose")?.addEventListener("click", close);
    document.querySelector("#animusV5PartsModal")?.addEventListener("click", (event) => { if (event.target.id === "animusV5PartsModal") close(); });
    document.querySelector("#animusV5PartsConfirm")?.addEventListener("click", () => {
      const selected = lines.filter((line) => document.querySelector(`[data-v5-price-check="${line.id}"]`)?.checked).map((line) => ({
        product: document.querySelector(`[data-v5-price-product="${line.id}"]`)?.value.trim() || line.product,
        price: document.querySelector(`[data-v5-price-amount="${line.id}"]`)?.value.trim() || line.price,
        category: document.querySelector(`[data-v5-price-category="${line.id}"]`)?.value.trim() || line.category,
        vendor: document.querySelector(`[data-v5-price-vendor="${line.id}"]`)?.value.trim() || line.vendor,
        unit: "each",
      }));
      if (!selected.length) return;
      if (typeof importLinesToPriceDatabase !== "function") return status("The Price Database is not available yet.", "error");
      const result = importLinesToPriceDatabase(selected, { vendor: draft.vendor, date: draft.date, category: draft.category });
      close();
      status(`${result.updatedCount} updated, ${result.addedCount} added to the Price Database.`, "success");
    });
  }

  function renderExpenseV5Markup() {
    const root = document.querySelector("#crmExpensesView");
    if (!root) return;
    const file = currentFile();
    const draft = expenseState.draft || (expenseState.draft = cleanDraft());
    const total = expenseState.entries.reduce((sum, entry) => sum + amount(entry.amount), 0);
    const items = draft.items.map((item, index) => `<div class="animus-v5-item-row"><input data-v5-item-name="${index}" value="${esc(item.name)}" placeholder="Item name"><input data-v5-item-price="${index}" value="${esc(item.price)}" inputmode="decimal" placeholder="0.00"><button type="button" data-v5-remove-item="${index}" aria-label="Remove item">×</button></div>`).join("");
    const history = expenseState.loading ? `<p class="crm-empty-state">Loading cloud expense history...</p>` : expenseState.entries.length ? expenseState.entries.map((entry) => `<article class="crm-manual-expense-card crm-receipt-history-item"><button type="button" class="animus-v5-history-open" data-v5-edit="${esc(entry.id)}"><span><strong>${esc(entry.title || entry.vendor || "Untitled expense")}</strong><small>${esc(entry.date || "No date")} · ${esc(entry.vendor || "No vendor")}</small></span><b>${money(entry.amount)}</b></button><button type="button" class="danger-link" data-v5-delete="${esc(entry.id)}">Delete</button></article>`).join("") : `<p class="crm-empty-state">No saved expenses for this file yet.</p>`;
    root.innerHTML = `
      <section class="crm-command-panel crm-revenue-hero"><div class="crm-command-copy"><h2>Expenses</h2><p>${file ? `${esc(file.fileNumber || "Project")} · ${esc(file.clientName || "Unnamed Client")}` : "Select a customer file first."}</p></div><div class="crm-invoice-controls"><button type="button" id="animusV5New">New Expense</button><button type="button" class="primary-action" id="animusV5Scan">Scan Receipt</button><input id="animusV5Upload" type="file" accept="image/*" hidden></div></section>
      <section class="crm-expenses-clean"><section class="panel crm-detail-card crm-file-receipt-panel"><div class="panel-header"><div><p class="eyebrow">New / Edit Expense</p><h2>Receipt Details</h2></div><p class="crm-helper-text" id="animusExpenseV5Status">${expenseState.loading ? "Loading cloud expenses..." : "Every saved receipt is stored separately in Cloudflare."}</p></div>
        <div class="crm-file-receipt-top"><div class="crm-receipt-preview crm-ai-receipt-preview">${draft.imageDataUrl ? `<img src="${esc(draft.imageDataUrl)}" alt="Receipt preview"><p>${esc(draft.imageTitle || "Receipt")}</p>` : `<div class="crm-receipt-preview-empty">No receipt photo selected yet.</div>`}</div>
          <div class="field-grid two crm-file-receipt-fields"><label>Date<input id="animusV5Date" type="date" value="${esc(draft.date)}"></label><label>Vendor<input id="animusV5Vendor" value="${esc(draft.vendor)}" placeholder="Home Depot"></label><label>Title<input id="animusV5Title" value="${esc(draft.title)}" placeholder="Cabinet hardware, paint supplies, fuel"></label><label>Category<select id="animusV5Category">${["Supplies","Materials","Fuel","Equipment","Labor","Other"].map((value) => `<option${draft.category === value ? " selected" : ""}>${value}</option>`).join("")}</select></label><label>Paid By<select id="animusV5Payment">${["","Cash","Credit - Chase Business","Credit - Bank of America","Credit - Chase Personal"].map((value) => `<option value="${esc(value)}"${draft.paymentType === value ? " selected" : ""}>${value || "Select"}</option>`).join("")}</select></label><label>Receipt Total<input id="animusV5Amount" value="${esc(draft.amount)}" inputmode="decimal" placeholder="0.00"></label><label class="crm-file-receipt-wide">Notes<textarea id="animusV5Notes" rows="3" placeholder="What was purchased or why this expense was added">${esc(draft.notes)}</textarea></label></div></div>
        <div class="crm-file-receipt-lines"><div class="crm-file-receipt-lines-heading"><h3>Expense Items</h3><strong>${money(currentTotal())}</strong></div><div class="animus-v5-items">${items}</div><button type="button" id="animusV5AddItem">Add Item Line</button></div><div class="crm-receipt-review-actions"><button type="button" id="animusV5Import">Add Items to Price Database</button><button type="button" class="primary-action" id="animusV5Save">Save Expense</button><button type="button" id="animusV5Clear">Clear</button></div></section>
      <section class="panel crm-detail-card crm-receipt-history-panel"><div class="panel-header"><div><p class="eyebrow">Receipt History</p><h2>${file ? `${esc(file.clientName || "Unnamed Client")} Expenses` : "No file selected"}</h2></div><strong>${money(total)}</strong></div><div class="crm-manual-expense-cards crm-receipt-history-list">${history}</div></section></section>`;
    bindExpenseV5();
  }

  function captureDraft() {
    const draft = expenseState.draft || cleanDraft();
    draft.date = document.querySelector("#animusV5Date")?.value || today();
    draft.vendor = document.querySelector("#animusV5Vendor")?.value.trim() || "";
    draft.title = document.querySelector("#animusV5Title")?.value.trim() || "";
    draft.category = document.querySelector("#animusV5Category")?.value || "Supplies";
    draft.paymentType = document.querySelector("#animusV5Payment")?.value || "";
    draft.amount = document.querySelector("#animusV5Amount")?.value || "";
    draft.notes = document.querySelector("#animusV5Notes")?.value.trim() || "";
    document.querySelectorAll("[data-v5-item-name]").forEach((input) => { draft.items[Number(input.dataset.v5ItemName)].name = input.value; });
    document.querySelectorAll("[data-v5-item-price]").forEach((input) => { draft.items[Number(input.dataset.v5ItemPrice)].price = input.value; });
    expenseState.draft = draft;
  }

  function bindExpenseV5() {
    document.querySelector("#animusV5New")?.addEventListener("click", () => { expenseState.draft = cleanDraft(); renderExpenseV5Markup(); });
    document.querySelector("#animusV5Scan")?.addEventListener("click", () => document.querySelector("#animusV5Upload")?.click());
    document.querySelector("#animusV5Upload")?.addEventListener("change", async (event) => { try { await scanReceipt(event.target.files?.[0]); } catch (error) { status(error.message || "Receipt could not be read.", "error"); } event.target.value = ""; });
    document.querySelector("#animusV5AddItem")?.addEventListener("click", () => { captureDraft(); expenseState.draft.items.push({ name: "", price: "", category: expenseState.draft.category }); renderExpenseV5Markup(); });
    document.querySelector("#animusV5Import")?.addEventListener("click", openPriceImport);
    document.querySelector("#animusV5Clear")?.addEventListener("click", () => { expenseState.draft = cleanDraft(); renderExpenseV5Markup(); });
    document.querySelector("#animusV5Save")?.addEventListener("click", async () => { try { captureDraft(); await saveExpense(); } catch (error) { status(error.message || "Expense could not be saved.", "error"); } });
    document.querySelectorAll("[data-v5-remove-item]").forEach((button) => button.addEventListener("click", () => { captureDraft(); expenseState.draft.items.splice(Number(button.dataset.v5RemoveItem), 1); if (!expenseState.draft.items.length) expenseState.draft.items.push({ name: "", price: "", category: expenseState.draft.category }); renderExpenseV5Markup(); }));
    document.querySelectorAll("[data-v5-edit]").forEach((button) => button.addEventListener("click", () => { const item = expenseState.entries.find((entry) => entry.id === button.dataset.v5Edit); if (item) { expenseState.draft = cleanDraft(item); renderExpenseV5Markup(); } }));
    document.querySelectorAll("[data-v5-delete]").forEach((button) => button.addEventListener("click", () => deleteExpense(button.dataset.v5Delete).catch((error) => status(error.message || "Expense could not be deleted.", "error"))));
  }

  async function renderExpenseV5() {
    const file = currentFile();
    const key = fileKey(file);
    if (key !== expenseState.fileId && !expenseState.loading) {
      try { await fetchExpenses(file); renderExpenseV5Markup(); } catch (error) { expenseState.loading = false; expenseState.entries = []; renderExpenseV5Markup(); status(error.message || "Could not load cloud expenses.", "error"); }
      return;
    }
    renderExpenseV5Markup();
  }

  // The old page can remain in the historic source file, but it is never
  // rendered or written by this v5 page.
  renderFileExpenses = () => renderExpenseV5();
  document.addEventListener("DOMContentLoaded", () => renderExpenseV5());
  if (document.readyState !== "loading") renderExpenseV5();
})();
