// Mobile receipt ledger bridge. It uses the same per-file Cloudflare records
// as the desktop Expense Center, while retaining the existing mobile review UI.
(() => {
  const API = "/api/expenses";
  const SOURCE = "ANIMUS Shared Mobile Receipt";
  let records = [];
  let loading = false;

  const keyFor = (file) => String(file?.id || file?.fileNumber || "").trim();
  const recordId = () => `mobile-expense-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const amount = (value) => Number.parseFloat(String(value ?? "").replace(/[^0-9.-]/g, "")) || 0;
  const escape = (value) => String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const fileFor = (key) => mobileFiles.find((file) => keyFor(file) === String(key || ""));
  const recordsFor = (file) => records.filter((entry) => String(entry.fileId || "") === keyFor(file));

  function recordLines(entry) {
    const items = Array.isArray(entry.items) && entry.items.length ? entry.items : [{ name: entry.notes || entry.vendor || "Expense", price: entry.amount, category: entry.category }];
    return items.map((item, index) => {
      const base = amount(item.basePrice ?? item.price ?? item.amount);
      const addTax = Boolean(item.addTax);
      const tax = item.tax !== undefined ? amount(item.tax) : (addTax ? base * MOBILE_DEFAULT_EXPENSE_TAX_RATE : 0);
      return {
        id: `${entry.id}-${index}`,
        receiptGroupId: entry.id,
        date: entry.date || dateKey(new Date()),
        category: normalizeMobileExpenseCategory(item.category || entry.category || "Supplies"),
        vendor: entry.vendor || "",
        note: item.name || entry.notes || entry.title || "Receipt expense",
        baseAmount: base,
        amount: item.finalPrice !== undefined ? amount(item.finalPrice) : base + tax,
        tax,
        addTax,
        taxRate: MOBILE_DEFAULT_EXPENSE_TAX_RATE,
        paymentType: entry.paymentType || "",
        receiptFileName: entry.imageTitle || entry.fileName || "",
        receiptDataUrl: index === 0 ? entry.imageDataUrl || "" : "",
        receiptSource: SOURCE,
      };
    });
  }

  function applyRecords(file) {
    if (!file) return;
    const owned = recordsFor(file);
    const ids = new Set(owned.map((entry) => entry.id));
    const legacy = (file.expenseLines || []).filter((line) => line.receiptSource !== SOURCE && !ids.has(line.receiptGroupId));
    const incoming = owned.flatMap(recordLines);
    file.expenseLines = [...legacy, ...incoming];
    file.receiptHistory = (file.receiptHistory || []).filter((entry) => !ids.has(entry.id));
    owned.forEach((entry) => upsertMobileReceiptHistoryGroup(file, entry.id, recordLines(entry)));
    syncMobileFileExpensesToRevenue(file);
  }

  function applyAll() {
    mobileFiles.forEach(applyRecords);
  }

  async function readFile(file) {
    const id = keyFor(file);
    if (!id) return [];
    const response = await fetch(`${API}?fileId=${encodeURIComponent(id)}&t=${Date.now()}`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || "Could not load receipt history.");
    return (Array.isArray(data.expenses) ? data.expenses : []).map((entry) => ({ ...entry, fileId: id }));
  }

  async function loadLedger() {
    if (loading || !mobileFiles.length) return;
    loading = true;
    try {
      const results = await Promise.allSettled(mobileFiles.map(readFile));
      records = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
      applyAll();
      saveLocalData();
      renderAll();
    } finally {
      loading = false;
    }
  }

  function draftRecord(existingId = "") {
    captureMobileReceiptDraft();
    const file = activeFile();
    const id = existingId || mobileReceiptDraft.editingReceiptGroupId || recordId();
    const visibleLines = mobileReceiptDraft.lines.filter((line) => line.use !== false && (line.description || amount(line.price)));
    const items = visibleLines.length ? visibleLines.map((line) => {
      const base = amount(line.price);
      const tax = line.addTax ? base * MOBILE_DEFAULT_EXPENSE_TAX_RATE : 0;
      return { name: line.description || "Receipt item", price: base, basePrice: base, tax, finalPrice: base + tax, addTax: Boolean(line.addTax), category: line.category || mobileReceiptDraft.category || "Supplies" };
    }) : [{ name: mobileReceiptDraft.notes || mobileReceiptDraft.vendor || "Receipt expense", price: amount(mobileReceiptDraft.amount), basePrice: amount(mobileReceiptDraft.amount), tax: 0, finalPrice: amount(mobileReceiptDraft.amount), addTax: false, category: mobileReceiptDraft.category || "Supplies" }];
    const total = items.reduce((sum, item) => sum + amount(item.finalPrice), 0) || amount(mobileReceiptDraft.amount);
    return { id, fileId: keyFor(file), title: mobileReceiptDraft.imageTitle || mobileReceiptDraft.vendor || "Receipt", vendor: mobileReceiptDraft.vendor || "", date: mobileReceiptDraft.date || dateKey(new Date()), category: mobileReceiptDraft.category || "Supplies", paymentType: mobileReceiptPaymentLabel(), amount: total, notes: mobileReceiptDraft.notes || "", imageDataUrl: mobileReceiptDraft.imageDataUrl || "", imageTitle: mobileReceiptDraft.imageTitle || mobileReceiptDraft.fileName || "", fileName: mobileReceiptDraft.fileName || "", items, source: SOURCE, updatedAt: new Date().toISOString() };
  }

  async function saveRecord(entry) {
    const response = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify({ fileId: entry.fileId, expense: entry }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || "Receipt could not be saved.");
    records = [{ ...data.expense, fileId: entry.fileId }, ...records.filter((item) => item.id !== entry.id)];
  }

  async function saveReceipt() {
    const file = activeFile();
    if (!file) return window.alert("Select a customer file before saving a receipt.");
    const entry = draftRecord();
    if (!entry.amount && !entry.vendor && !entry.notes) return window.alert("Add a receipt total, vendor, or line item before saving.");
    const button = document.querySelector("#mobileSaveReceiptExpense");
    if (button) { button.disabled = true; button.textContent = "Saving..."; }
    try {
      await saveRecord(entry);
      applyRecords(file);
      mobileReceiptDraft = blankMobileReceiptDraft();
      saveLocalData();
      renderAll();
      setTab("expenses");
      await saveCloud().catch(() => {});
    } catch (error) {
      window.alert(error.message || "Receipt could not be saved.");
    } finally {
      const next = document.querySelector("#mobileSaveReceiptExpense");
      if (next) { next.disabled = false; next.textContent = "Save Receipt"; }
    }
  }

  function openRecord(id) {
    const entry = records.find((record) => record.id === id);
    if (!entry) return;
    mobileReceiptDraft = {
      ...blankMobileReceiptDraft(), editingReceiptGroupId: entry.id, isEditingSavedReceipt: true,
      imageDataUrl: entry.imageDataUrl || "", fileName: entry.fileName || "", imageTitle: entry.imageTitle || entry.title || "", vendor: entry.vendor || "", date: entry.date || dateKey(new Date()), category: entry.category || "Supplies", amount: entry.amount || "", paymentType: entry.paymentType === "Cash" ? "Cash" : (entry.paymentType ? "Credit" : ""), cardName: entry.paymentType && entry.paymentType !== "Cash" ? entry.paymentType : "Chase Business", notes: entry.notes || "", lines: (entry.items || []).map((item) => blankMobileReceiptLine({ description: item.name, category: item.category || entry.category, price: item.basePrice ?? item.price, addTax: Boolean(item.addTax) })), status: "Editing a saved receipt. Save Receipt will update it.",
    };
    renderMobileExpenses();
    document.querySelector("#mobileReceiptReviewCard")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function deleteRecord(id) {
    const entry = records.find((record) => record.id === id);
    if (!entry || !window.confirm("Delete this saved expense from the file?")) return;
    try {
      const response = await fetch(`${API}?fileId=${encodeURIComponent(entry.fileId)}&expenseId=${encodeURIComponent(entry.id)}`, { method: "DELETE", cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) throw new Error(data.error || "Expense could not be deleted.");
      records = records.filter((record) => record.id !== id);
      applyRecords(fileFor(entry.fileId));
      saveLocalData();
      renderAll();
      await saveCloud().catch(() => {});
    } catch (error) { window.alert(error.message || "Expense could not be deleted."); }
  }

  function renderHistory(file = activeFile()) {
    const list = document.querySelector("#mobileSavedExpenseList");
    const count = document.querySelector("#mobileSavedExpenseCount");
    if (!list) return;
    const shared = recordsFor(file).sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    const sharedIds = new Set(shared.map((entry) => entry.id));
    const legacy = mobileReceiptHistoryGroups(file).filter((entry) => !sharedIds.has(entry.id));
    if (count) count.textContent = String(shared.length + legacy.length);
    if (!shared.length && !legacy.length) { list.innerHTML = `<p class="mobile-helper">No saved receipts or expenses yet.</p>`; return; }
    const sharedMarkup = shared.map((entry) => `<article class="mobile-expense-item mobile-shared-expense"><button type="button" data-mobile-shared-open="${escape(entry.id)}"><span>${escape(entry.title || entry.vendor || "Saved receipt")}</span><strong>${mobileCurrency.format(amount(entry.amount))}</strong><small>${escape(formatDate(entry.date) || "No date")} · ${entry.items?.length || 0} line${entry.items?.length === 1 ? "" : "s"}</small></button><button type="button" class="mobile-small-button danger" data-mobile-shared-delete="${escape(entry.id)}">Delete</button></article>`).join("");
    const legacyMarkup = legacy.map((entry) => `<article class="mobile-expense-item"><button type="button" data-mobile-expense-open="${escape(entry.id)}"><span>${escape(entry.label || "Saved expense")}</span><strong>${mobileCurrency.format(amount(entry.total))}</strong><small>${escape(formatDate(entry.date) || "No date")} · ${entry.lineCount || 0} line${entry.lineCount === 1 ? "" : "s"}</small></button></article>`).join("");
    list.innerHTML = sharedMarkup + legacyMarkup;
    document.querySelectorAll("[data-mobile-shared-open]").forEach((button) => button.addEventListener("click", () => openRecord(button.dataset.mobileSharedOpen)));
    document.querySelectorAll("[data-mobile-shared-delete]").forEach((button) => button.addEventListener("click", () => deleteRecord(button.dataset.mobileSharedDelete)));
    document.querySelectorAll("[data-mobile-expense-open]").forEach((button) => button.addEventListener("click", () => openMobileSavedExpense(button.dataset.mobileExpenseOpen)));
  }

  function rebind(id, event, handler) {
    const current = document.getElementById(id); if (!current) return;
    const replacement = current.cloneNode(true); current.replaceWith(replacement); replacement.addEventListener(event, handler);
  }

  const originalRenderHistory = renderMobileSavedExpenses;
  renderMobileSavedExpenses = renderHistory;
  const originalLoadCloud = loadCloud;
  loadCloud = async function animusMobileLoadCloud() { await originalLoadCloud(); await loadLedger(); };
  const originalStartupLoad = loadCloudOnStartup;
  loadCloudOnStartup = async function animusMobileStartupLoad() { const loaded = await originalStartupLoad(); await loadLedger(); return loaded; };

  rebind("mobileSaveReceiptExpense", "click", saveReceipt);
  rebind("mobileReceiptCameraInput", "change", (event) => { handleMobileReceiptFile(event.target.files?.[0]).catch(() => window.alert("The receipt photo could not be read.")); event.target.value = ""; });
  rebind("mobileReceiptUploadInput", "change", (event) => { handleMobileReceiptFile(event.target.files?.[0]).catch(() => window.alert("The receipt image could not be read.")); event.target.value = ""; });
  window.addEventListener("animus:mobile-data-loaded", loadLedger);
  window.setTimeout(loadLedger, 900);
  // The dashboard itself loads in the background on startup. A second pass
  // makes sure its file list is ready before the shared receipt records load.
  window.setTimeout(loadLedger, 3000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) loadLedger();
  });
  window.animusMobileExpenseLedger = { load: loadLedger, records: () => records.slice() };
})();
