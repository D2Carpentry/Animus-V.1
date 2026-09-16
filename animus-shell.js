// Shared navigation and page framing for the existing ANIMUS CRM views.
(() => {
  const THEME_KEY = "animus-ui-theme";
  const PROFILE_KEY = "animus-company-profile";
  const DEFAULT_PROFILE = {
    companyName: "D2 Carpentry & Design",
    ownerName: "Owner",
    phone: "239-469-8555",
    email: "D2CarpentryandDesign@gmail.com",
    address: "2710 Del Prado Blvd S #2-184 Cape Coral, FL 33904",
    website: "",
    logo: "",
    defaultStartPage: "files",
    dateFormat: "MM/DD/YYYY",
    currency: "USD",
    timezone: "America/New_York",
  };
  const views = [
    ["dashboard", "⌂", "Dashboard"], ["files", "▱", "Work Files"], ["estimator", "▤", "Estimates"], ["calendar", "□", "Calendar"],
    ["revenue", "↗", "Revenue"], ["expenses", "▧", "Expenses"], ["payroll", "♙", "Payroll"], ["prices", "▦", "Price Database"], ["business", "◈", "Business Performance"], ["contacts", "◉", "Contacts"], ["playground", "✦", "Playground Zone"],
  ];
  const titles = { dashboard:"Command Center", files:"Work Files", contacts:"Contacts", calendar:"Calendar", revenue:"Revenue", expenses:"Expenses", payroll:"Payroll", prices:"Price Database", business:"Business Performance", playground:"Playground Zone", estimator:"Estimate Studio", legacyEstimator:"Legacy Estimator", testzone:"Legacy Estimator", invoice:"Invoice" };
  function preferredTheme() {
    try { return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light"; } catch (error) { return "light"; }
  }
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]));
  }
  function readProfile() {
    try {
      return { ...DEFAULT_PROFILE, ...(JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}") || {}) };
    } catch (error) {
      return { ...DEFAULT_PROFILE };
    }
  }
  function writeProfile(profile) {
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify({ ...DEFAULT_PROFILE, ...profile })); } catch (error) {}
  }
  function syncProfileUI() {
    const profile = readProfile();
    const name = profile.companyName || DEFAULT_PROFILE.companyName;
    const owner = profile.ownerName || DEFAULT_PROFILE.ownerName;
    document.querySelectorAll("[data-animus-company-name]").forEach((element) => { element.textContent = name; });
    document.querySelectorAll("[data-animus-company-role]").forEach((element) => { element.textContent = owner; });
    const avatar = document.querySelector("#animusAccountAvatar");
    if (avatar) {
      avatar.innerHTML = profile.logo ? `<img src="${escapeHtml(profile.logo)}" alt="${escapeHtml(name)} logo">` : "D2";
      avatar.classList.toggle("has-image", Boolean(profile.logo));
      avatar.title = "Upload company logo";
    }
  }
  function setTheme(theme) {
    const isDark = theme === "dark";
    document.body.classList.toggle("animus-dark-theme", isDark);
    document.querySelector("#animusThemeToggle")?.setAttribute("aria-pressed", String(isDark));
    const label = document.querySelector("#animusThemeToggle .animus-theme-label");
    if (label) label.textContent = isDark ? "Light Theme" : "Dark Theme";
    try { localStorage.setItem(THEME_KEY, isDark ? "dark" : "light"); } catch (error) {}
  }
  function settingsModalMarkup(profile) {
    return `<div class="animus-settings-backdrop" id="animusSettingsModal" hidden>
      <section class="animus-settings-modal" role="dialog" aria-modal="true" aria-labelledby="animusSettingsTitle">
        <header>
          <div>
            <p>Account Settings</p>
            <h2 id="animusSettingsTitle">ANIMUS Settings</h2>
            <span>Company identity, preferences, permissions, and data safety controls.</span>
          </div>
          <button type="button" class="animus-settings-close" id="animusSettingsClose" aria-label="Close settings">×</button>
        </header>
        <form id="animusSettingsForm">
          <section>
            <div class="animus-settings-section-head">
              <div><h3>Company Profile</h3><p>This branding can feed the sidebar, estimate headers, invoice headers, and future customer portal.</p></div>
              <button type="button" class="animus-settings-logo-button" id="animusSettingsLogoButton">Upload Logo</button>
            </div>
            <div class="animus-settings-grid">
              <label>Company Name<input name="companyName" value="${escapeHtml(profile.companyName)}"></label>
              <label>Owner / Role<input name="ownerName" value="${escapeHtml(profile.ownerName)}"></label>
              <label>Office Phone<input name="phone" value="${escapeHtml(profile.phone)}"></label>
              <label>Email<input name="email" type="email" value="${escapeHtml(profile.email)}"></label>
              <label class="wide">Company Address<input name="address" value="${escapeHtml(profile.address)}"></label>
              <label class="wide">Website<input name="website" value="${escapeHtml(profile.website)}" placeholder="https://..."></label>
            </div>
          </section>
          <section>
            <h3>Preferences</h3>
            <div class="animus-settings-grid">
              <label>Default Start Page<select name="defaultStartPage"><option value="files">Work Files</option><option value="dashboard">Dashboard</option><option value="expenses">Expenses</option><option value="estimator">Estimates</option></select></label>
              <label>Date Format<select name="dateFormat"><option>MM/DD/YYYY</option><option>MM-DD-YY</option><option>YYYY-MM-DD</option></select></label>
              <label>Currency<select name="currency"><option>USD</option></select></label>
              <label>Time Zone<input name="timezone" value="${escapeHtml(profile.timezone)}"></label>
            </div>
          </section>
          <section>
            <h3>Users & Permissions</h3>
            <div class="animus-settings-coming-soon">
              <strong>Ready for admin controls</strong>
              <span>Next step can add employees, roles, delete permissions, revenue editing permissions, and backup access.</span>
            </div>
          </section>
          <footer>
            <button type="button" class="animus-settings-secondary" id="animusSettingsCancel">Cancel</button>
            <button type="submit" class="animus-settings-primary">Save Settings</button>
          </footer>
        </form>
      </section>
    </div>`;
  }
  function fillSettingsForm() {
    const form = document.querySelector("#animusSettingsForm");
    if (!form) return;
    const profile = readProfile();
    Object.entries(profile).forEach(([key, value]) => {
      const field = form.elements.namedItem(key);
      if (field) field.value = value || DEFAULT_PROFILE[key] || "";
    });
  }
  function openSettingsModal() {
    fillSettingsForm();
    const modal = document.querySelector("#animusSettingsModal");
    if (!modal) return;
    modal.hidden = false;
    document.querySelector("#animusAccountMenu")?.setAttribute("hidden", "");
    document.querySelector("#animusAccountToggle")?.setAttribute("aria-expanded", "false");
    window.setTimeout(() => document.querySelector("#animusSettingsForm input[name='companyName']")?.focus(), 0);
  }
  function closeSettingsModal() {
    const modal = document.querySelector("#animusSettingsModal");
    if (modal) modal.hidden = true;
  }
  function bindSettingsModal() {
    const modal = document.querySelector("#animusSettingsModal");
    const form = document.querySelector("#animusSettingsForm");
    document.querySelector("#animusSettingsClose")?.addEventListener("click", closeSettingsModal);
    document.querySelector("#animusSettingsCancel")?.addEventListener("click", closeSettingsModal);
    document.querySelector("#animusSettingsLogoButton")?.addEventListener("click", () => document.querySelector("#animusCompanyLogoUpload")?.click());
    modal?.addEventListener("click", (event) => {
      if (event.target === modal) closeSettingsModal();
    });
    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      const current = readProfile();
      const data = new FormData(form);
      const next = { ...current };
      ["companyName", "ownerName", "phone", "email", "address", "website", "defaultStartPage", "dateFormat", "currency", "timezone"].forEach((key) => {
        next[key] = String(data.get(key) || "").trim();
      });
      writeProfile(next);
      syncProfileUI();
      closeSettingsModal();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeSettingsModal();
    });
    fillSettingsForm();
  }
  function currentView() {
    if (!document.querySelector("#crmExpensesView")?.hidden) return "expenses";
    if (!document.querySelector("#crmRevenueView")?.hidden) return "revenue";
    if (!document.querySelector("#crmPayrollView")?.hidden) return "payroll";
    if (!document.querySelector("#crmCalendarView")?.hidden) return "calendar";
    if (!document.querySelector("#crmContactsView")?.hidden) return "contacts";
    if (!document.querySelector("#crmPriceView")?.hidden) return "prices";
    if (!document.querySelector("#crmBusinessView")?.hidden) return "business";
    if (!document.querySelector("#crmPlaygroundView")?.hidden) return "playground";
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
    setTheme(preferredTheme());
    const workspace = views.filter(([view]) => ["dashboard", "files", "estimator", "calendar"].includes(view));
    const business = views.filter(([view]) => ["revenue", "expenses", "payroll", "prices", "business", "contacts", "playground"].includes(view));
    const estimatorSubnav = `<div class="animus-estimator-subnav"><button type="button" data-animus-estimator-action="new-file">New File</button><button type="button" data-animus-estimator-action="import">Import Estimate</button><button type="button" data-animus-estimator-action="supplement">Create Supplement</button><button type="button" data-animus-estimator-action="invoice">Invoice</button><button type="button" data-animus-estimator-action="work-order">Work Order</button><button type="button" data-animus-estimator-action="legacy">Legacy Estimator</button></div>`;
    const makeButtons = (items) => items.map(([view, icon, label]) => `<div class="animus-nav-item"><button type="button" data-animus-shell-view="${view}"><span class="animus-global-icon">${icon}</span>${label}</button>${view === "estimator" ? estimatorSubnav : ""}</div>`).join("");
    document.body.insertAdjacentHTML("afterbegin", `<aside class="animus-global-sidebar" id="animusGlobalSidebar"><div class="animus-global-brand"><img src="assets/animus-sidebar-logo.png" alt="ANIMUS logo"><span>ANIMUS<small>Command Center</small></span></div><p class="animus-global-label">Workspace</p><nav class="animus-global-nav">${makeButtons(workspace)}</nav><p class="animus-global-label">Business</p><nav class="animus-global-nav">${makeButtons(business)}</nav><div class="animus-sidebar-footer"><div class="animus-account-wrap"><button class="animus-global-account" id="animusAccountToggle" type="button" aria-expanded="false"><span class="animus-account-avatar" id="animusAccountAvatar" data-animus-logo-upload>D2</span><span><strong data-animus-company-name>D2 Carpentry &amp; Design</strong><span data-animus-company-role>Owner</span></span><b aria-hidden="true">⌄</b></button><div class="animus-account-menu" id="animusAccountMenu" hidden><p class="animus-account-menu-title">Company</p><button class="animus-account-action" id="animusOpenSettings" type="button"><span>⚙</span>Settings</button><button class="animus-account-action" id="animusUploadLogo" type="button"><span>▧</span>Upload Company Logo</button><p class="animus-account-menu-title">Preferences</p></div></div></div></aside><input id="animusCompanyLogoUpload" type="file" accept="image/*" hidden>`);
    const accountMenu = document.querySelector("#animusAccountMenu");
    accountMenu?.insertAdjacentHTML("beforeend", `<button class="animus-theme-toggle" id="animusThemeToggle" type="button" aria-pressed="false"><span class="animus-theme-icon" aria-hidden="true">◐</span><span class="animus-theme-label">Dark Theme</span></button><p class="animus-account-menu-title">Data Safety</p>`);
    [document.querySelector("#crmCreateBackup"), document.querySelector("#crmLoadCloud"), document.querySelector("#crmImportBackupFile"), document.querySelector("#crmExportCurrentSnapshot")].filter(Boolean).forEach((element) => accountMenu?.append(element));
    setTheme(preferredTheme());
    syncProfileUI();
    document.body.insertAdjacentHTML("beforeend", settingsModalMarkup(readProfile()));
    bindSettingsModal();
    document.querySelector("#animusThemeToggle")?.addEventListener("click", (event) => {
      event.stopPropagation();
      setTheme(document.body.classList.contains("animus-dark-theme") ? "light" : "dark");
    });
    document.querySelector("#animusAccountToggle")?.addEventListener("click", (event) => {
      event.stopPropagation();
      if (event.target.closest?.("[data-animus-logo-upload]")) {
        document.querySelector("#animusCompanyLogoUpload")?.click();
        return;
      }
      const menu = document.querySelector("#animusAccountMenu");
      const toggle = document.querySelector("#animusAccountToggle");
      if (!menu) return;
      menu.hidden = !menu.hidden;
      toggle?.setAttribute("aria-expanded", String(!menu.hidden));
    });
    document.querySelector("#animusUploadLogo")?.addEventListener("click", (event) => {
      event.stopPropagation();
      document.querySelector("#animusCompanyLogoUpload")?.click();
    });
    document.querySelector("#animusOpenSettings")?.addEventListener("click", (event) => {
      event.stopPropagation();
      openSettingsModal();
    });
    document.querySelector("#animusCompanyLogoUpload")?.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        const profile = readProfile();
        writeProfile({ ...profile, logo: String(reader.result || "") });
        syncProfileUI();
        fillSettingsForm();
      });
      reader.readAsDataURL(file);
      event.target.value = "";
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
    ["crmExpensesView","crmRevenueView","crmPayrollView","crmCalendarView","crmContactsView","crmPriceView","crmBusinessView","crmPlaygroundView","crmEstimatorView","crmTestZoneView"].map((id) => document.getElementById(id)).filter(Boolean).forEach((element) => observer.observe(element, { attributes:true, attributeFilter:["hidden"] }));
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
