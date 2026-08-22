// Shared navigation and page framing for the existing ANIMUS CRM views.
(() => {
  const views = [
    ["dashboard", "⌂", "Dashboard"], ["dashboard", "▣", "CRM / Files"], ["calendar", "□", "Calendar"], ["estimator", "▤", "Estimates"], ["dashboard", "▱", "Jobs"],
    ["revenue", "↗", "Revenue"], ["expenses", "▧", "Expenses"], ["payroll", "♙", "Payroll"], ["prices", "▦", "Price Database"],
  ];
  const titles = { dashboard:"Command Center", calendar:"Calendar", revenue:"Revenue", expenses:"Expenses", payroll:"Payroll", prices:"Price Database", estimator:"Estimate Studio", invoice:"Invoice" };
  function currentView() {
    if (!document.querySelector("#crmExpensesView")?.hidden) return "expenses";
    if (!document.querySelector("#crmRevenueView")?.hidden) return "revenue";
    if (!document.querySelector("#crmPayrollView")?.hidden) return "payroll";
    if (!document.querySelector("#crmCalendarView")?.hidden) return "calendar";
    if (!document.querySelector("#crmPriceView")?.hidden) return "prices";
    if (!document.querySelector("#crmEstimatorView")?.hidden) return "estimator";
    return "dashboard";
  }
  function syncShell() {
    const view = currentView();
    document.querySelector(".crm-topbar")?.setAttribute("data-animus-title", titles[view] || "Command Center");
    document.querySelectorAll("[data-animus-shell-view]").forEach((button) => button.classList.toggle("active", button.dataset.animusShellView === view));
  }
  function createShell() {
    if (document.querySelector("#animusGlobalSidebar")) return;
    document.body.classList.add("animus-unified-ui");
    const workspace = views.slice(0,5);
    const business = views.slice(5);
    const makeButtons = (items) => items.map(([view, icon, label]) => `<button type="button" data-animus-shell-view="${view}"><span class="animus-global-icon">${icon}</span>${label}</button>`).join("");
    document.body.insertAdjacentHTML("afterbegin", `<aside class="animus-global-sidebar" id="animusGlobalSidebar"><div class="animus-global-brand"><img src="assets/d2-logo.png" alt="D2 logo"><span>ANIMUS<small>Command Center</small></span></div><p class="animus-global-label">Workspace</p><nav class="animus-global-nav">${makeButtons(workspace)}</nav><p class="animus-global-label">Business</p><nav class="animus-global-nav">${makeButtons(business)}</nav><div class="animus-global-account"><strong>D2 Carpentry &amp; Design</strong>Owner</div></aside>`);
    document.querySelectorAll("[data-animus-shell-view]").forEach((button) => button.addEventListener("click", () => { const view = button.dataset.animusShellView; if (typeof switchCrmView === "function") switchCrmView(view); syncShell(); }));
    document.addEventListener("click", (event) => { if (event.target.closest?.("[data-crm-view]")) setTimeout(syncShell, 0); });
    const observer = new MutationObserver(syncShell);
    ["crmExpensesView","crmRevenueView","crmPayrollView","crmCalendarView","crmPriceView","crmEstimatorView"].map((id) => document.getElementById(id)).filter(Boolean).forEach((element) => observer.observe(element, { attributes:true, attributeFilter:["hidden"] }));
    syncShell();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", createShell); else createShell();
})();
