// Shared navigation and page framing for the existing ANIMUS CRM views.
(() => {
  const views = [
    ["dashboard", "⌂", "Dashboard"], ["calendar", "□", "Calendar"], ["estimator", "▤", "Estimates"], ["files", "▱", "Work Files"], ["contacts", "◉", "Contacts"],
    ["revenue", "↗", "Revenue"], ["expenses", "▧", "Expenses"], ["payroll", "♙", "Payroll"], ["prices", "▦", "Price Database"], ["business", "◈", "Business Performance"],
  ];
  const titles = { dashboard:"Command Center", files:"Work Files", contacts:"Contacts", calendar:"Calendar", revenue:"Revenue", expenses:"Expenses", payroll:"Payroll", prices:"Price Database", business:"Business Performance", estimator:"Estimate Studio", legacyEstimator:"Legacy Estimator", testzone:"Legacy Estimator", invoice:"Invoice" };
  function currentView() {
    if (!document.querySelector("#crmExpensesView")?.hidden) return "expenses";
    if (!document.querySelector("#crmRevenueView")?.hidden) return "revenue";
    if (!document.querySelector("#crmPayrollView")?.hidden) return "payroll";
    if (!document.querySelector("#crmCalendarView")?.hidden) return "calendar";
    if (!document.querySelector("#crmContactsView")?.hidden) return "contacts";
    if (!document.querySelector("#crmPriceView")?.hidden) return "prices";
    if (!document.querySelector("#crmBusinessView")?.hidden) return "business";
    if (!document.querySelector("#crmEstimatorView")?.hidden) return "estimator";
    if (!document.querySelector("#crmTestZoneView")?.hidden) return "legacyEstimator";
    return document.body.dataset.animusView === "files" ? "files" : "dashboard";
  }
  function syncShell() {
    const view = currentView();
    const activeView = view === "legacyEstimator" ? "estimator" : view;
    document.querySelector(".crm-topbar")?.setAttribute("data-animus-title", titles[view] || "Command Center");
    document.querySelectorAll("[data-animus-shell-view]").forEach((button) => button.classList.toggle("active", button.dataset.animusShellView === activeView));
    document.querySelectorAll(".animus-nav-item").forEach((item) => {
      const isEstimator = item.querySelector("[data-animus-shell-view='estimator']");
      item.classList.toggle("estimator-open", Boolean(isEstimator && activeView === "estimator"));
    });
  }
  function createShell() {
    if (document.querySelector("#animusGlobalSidebar")) return;
    document.body.classList.add("animus-unified-ui");
    const workspace = views.filter(([view]) => ["dashboard", "calendar", "estimator", "files", "contacts"].includes(view));
    const business = views.filter(([view]) => ["revenue", "expenses", "payroll", "prices", "business"].includes(view));
    const estimatorSubnav = `<div class="animus-estimator-subnav"><button type="button" data-animus-estimator-action="new-file">New File</button><button type="button" data-animus-estimator-action="import">Import Estimate</button><button type="button" data-animus-estimator-action="supplement">Create Supplement</button><button type="button" data-animus-estimator-action="invoice">Invoice</button><button type="button" data-animus-estimator-action="work-order">Work Order</button><button type="button" data-animus-estimator-action="legacy">Legacy Estimator</button></div>`;
    const makeButtons = (items) => items.map(([view, icon, label]) => `<div class="animus-nav-item"><button type="button" data-animus-shell-view="${view}"><span class="animus-global-icon">${icon}</span>${label}</button>${view === "estimator" ? estimatorSubnav : ""}</div>`).join("");
    document.body.insertAdjacentHTML("afterbegin", `<aside class="animus-global-sidebar" id="animusGlobalSidebar"><div class="animus-global-brand"><img src="assets/animus-logo.svg" alt="ANIMUS logo"><span>ANIMUS<small>Command Center</small></span></div><p class="animus-global-label">Workspace</p><nav class="animus-global-nav">${makeButtons(workspace)}</nav><p class="animus-global-label">Business</p><nav class="animus-global-nav">${makeButtons(business)}</nav><div class="animus-sidebar-footer"><div class="animus-account-wrap"><button class="animus-global-account" id="animusAccountToggle" type="button" aria-expanded="false"><span class="animus-account-avatar">D2</span><span><strong>D2 Carpentry &amp; Design</strong>Owner</span><b aria-hidden="true">⌄</b></button><div class="animus-account-menu" id="animusAccountMenu" hidden><p class="animus-account-menu-title">Backup &amp; restore</p></div></div></div></aside>`);
    const accountMenu = document.querySelector("#animusAccountMenu");
    [document.querySelector("#crmCreateBackup"), document.querySelector("#crmLoadCloud"), document.querySelector("#crmImportBackupFile"), document.querySelector("#crmExportCurrentSnapshot")].filter(Boolean).forEach((element) => accountMenu?.append(element));
    document.querySelector("#animusAccountToggle")?.addEventListener("click", (event) => {
      event.stopPropagation();
      const menu = document.querySelector("#animusAccountMenu");
      const toggle = document.querySelector("#animusAccountToggle");
      if (!menu) return;
      menu.hidden = !menu.hidden;
      toggle?.setAttribute("aria-expanded", String(!menu.hidden));
    });
    document.addEventListener("click", (event) => {
      if (!event.target.closest?.(".animus-account-wrap")) {
        const menu = document.querySelector("#animusAccountMenu");
        if (menu) menu.hidden = true;
        document.querySelector("#animusAccountToggle")?.setAttribute("aria-expanded", "false");
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      const menu = document.querySelector("#animusAccountMenu");
      if (menu) menu.hidden = true;
      document.querySelector("#animusAccountToggle")?.setAttribute("aria-expanded", "false");
    });
    document.querySelectorAll("[data-animus-shell-view]").forEach((button) => button.addEventListener("click", () => { const view = button.dataset.animusShellView; if (view === "files" && typeof activateCrmFilter === "function") activateCrmFilter("open"); if (typeof switchCrmView === "function") switchCrmView(view); if (view === "files" && typeof renderCrm === "function") renderCrm(); syncShell(); }));
    document.querySelectorAll("[data-animus-estimator-action]").forEach((button) => button.addEventListener("click", () => {
      const action = button.dataset.animusEstimatorAction;
      if (action === "new-file" && typeof openLegacyNewCrmFileModal === "function") openLegacyNewCrmFileModal();
      if (action === "import" && typeof activeFile === "function" && typeof startEstimateUploadForFile === "function") {
        const file = activeFile();
        if (file) startEstimateUploadForFile(file);
        else if (typeof switchCrmView === "function") switchCrmView("estimator");
      }
      if (action === "supplement" && typeof createSupplementForFile === "function") createSupplementForFile();
      if (action === "invoice" && typeof openActiveInvoice === "function") openActiveInvoice();
      if (action === "work-order" && typeof openActiveEstimate === "function") openActiveEstimate("#assignment");
      if (action === "legacy" && typeof switchCrmView === "function") switchCrmView("legacyEstimator");
      syncShell();
    }));
    document.addEventListener("click", (event) => { if (event.target.closest?.("[data-crm-view]")) setTimeout(syncShell, 0); });
    const observer = new MutationObserver(syncShell);
    ["crmExpensesView","crmRevenueView","crmPayrollView","crmCalendarView","crmContactsView","crmPriceView","crmBusinessView","crmEstimatorView","crmTestZoneView"].map((id) => document.getElementById(id)).filter(Boolean).forEach((element) => observer.observe(element, { attributes:true, attributeFilter:["hidden"] }));
    syncShell();
    // Hold the ANIMUS splash briefly so the shell and cloud-backed UI can settle
    // before the Command Center is revealed.
    window.setTimeout(() => {
      document.body.classList.remove("crm-booting");
      document.body.classList.add("animus-ready");
    }, 2600);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", createShell); else createShell();
})();
