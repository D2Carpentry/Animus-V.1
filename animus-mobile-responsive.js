// Mobile shell behavior for ANIMUS. Presentation only; it reuses existing view and save handlers.
(() => {
  const MOBILE_QUERY = "(max-width: 768px)";
  const STORAGE_STUCK_OVERLAY_KEY = "animusReceiptOverlayDismissedAt";
  const bootedAt = Date.now();
  let appbar;
  let backdrop;
  let overlayCleanupDone = false;

  function isMobile() {
    return window.matchMedia(MOBILE_QUERY).matches;
  }

  function getTitle() {
    const topbarTitle = document.querySelector(".crm-topbar")?.getAttribute("data-animus-title");
    if (topbarTitle) return topbarTitle;
    const visibleHeading = document.querySelector("section:not([hidden]) h1, section:not([hidden]) h2");
    return visibleHeading?.textContent?.trim() || "ANIMUS";
  }

  function syncTitle() {
    const title = document.querySelector("#animusMobileTitle");
    if (title) title.textContent = getTitle();
  }

  function closeMenu() {
    document.body.classList.remove("animus-mobile-menu-open");
    document.querySelector("#animusMobileMenuToggle")?.setAttribute("aria-expanded", "false");
  }

  function openMenu() {
    document.body.classList.add("animus-mobile-menu-open");
    document.querySelector("#animusMobileMenuToggle")?.setAttribute("aria-expanded", "true");
  }

  function toggleMenu() {
    if (document.body.classList.contains("animus-mobile-menu-open")) closeMenu();
    else openMenu();
  }

  function runSaveAll() {
    const saveButton = document.querySelector("#crmSaveDemo");
    if (saveButton && saveButton !== document.activeElement) saveButton.click();
  }

  function createAppbar() {
    if (appbar) return;
    appbar = document.createElement("header");
    appbar.className = "animus-mobile-appbar";
    appbar.innerHTML = `
      <button class="animus-mobile-menu-toggle" id="animusMobileMenuToggle" type="button" aria-label="Open navigation" aria-expanded="false">☰</button>
      <div class="animus-mobile-title" id="animusMobileTitle">ANIMUS</div>
      <button class="animus-mobile-save" id="animusMobileSaveAll" type="button">Save</button>
    `;
    backdrop = document.createElement("div");
    backdrop.className = "animus-mobile-backdrop";
    backdrop.id = "animusMobileBackdrop";
    backdrop.hidden = true;
    document.body.insertBefore(appbar, document.body.firstChild);
    document.body.insertBefore(backdrop, appbar.nextSibling);
    appbar.querySelector("#animusMobileMenuToggle")?.addEventListener("click", toggleMenu);
    appbar.querySelector("#animusMobileSaveAll")?.addEventListener("click", runSaveAll);
    backdrop.addEventListener("click", closeMenu);
    syncTitle();
  }

  function syncBackdrop() {
    if (!backdrop) return;
    backdrop.hidden = !document.body.classList.contains("animus-mobile-menu-open");
  }

  function wireMobileNavigation() {
    document.querySelectorAll("[data-animus-shell-view]").forEach((button) => {
      if (button.dataset.animusMobileWired === "true") return;
      button.dataset.animusMobileWired = "true";
      button.addEventListener("click", () => {
        if (!isMobile()) return;
        closeMenu();
        setTimeout(syncTitle, 60);
      });
    });
  }

  function closeOpenMenus(event) {
    const target = event.target;
    if (!target.closest) return;
    if (target.closest(".animus-account-wrap, .animus-work-file-filter-menu, .animus-revenue-columns, .animus-revenue-filter-wrap, [aria-haspopup='true']")) return;
    document.querySelectorAll(".animus-account-menu:not([hidden]), .animus-work-file-filter-options:not([hidden]), .animus-revenue-columns-menu:not([hidden]), .animus-revenue-filter-menu:not([hidden])").forEach((menu) => {
      menu.hidden = true;
    });
    document.querySelectorAll("[aria-expanded='true']").forEach((trigger) => {
      if (trigger.closest(".animus-mobile-appbar")) return;
      trigger.setAttribute("aria-expanded", "false");
    });
  }

  function removeAbandonedReceiptProcessingOverlay() {
    if (!isMobile()) return;
    if (overlayCleanupDone || Date.now() - bootedAt > 3000) return;
    const now = Date.now();
    const lastDismissed = Number(localStorage.getItem(STORAGE_STUCK_OVERLAY_KEY) || 0);
    const overlays = Array.from(document.querySelectorAll(".receipt-reading-overlay, .expense-processing-backdrop, .crm-receipt-processing, [data-receipt-processing='true']"));
    const textOverlays = Array.from(document.querySelectorAll("body *")).filter((node) => {
      if (!(node instanceof HTMLElement)) return false;
      if (node.children.length > 6) return false;
      return /Reading receipt photo|Reading receipt/i.test(node.textContent || "") && getComputedStyle(node).position === "fixed";
    });
    [...overlays, ...textOverlays].forEach((overlay) => {
      overlay.remove();
      overlayCleanupDone = true;
      localStorage.setItem(STORAGE_STUCK_OVERLAY_KEY, String(now));
    });
    if (lastDismissed && now - lastDismissed < 1000 * 60 * 60) {
      document.body.classList.remove("receipt-reading", "expense-processing", "is-reading-receipt");
    }
  }

  function auditOverflow() {
    if (!isMobile()) return;
    const overflow = document.documentElement.scrollWidth - window.innerWidth;
    document.body.classList.toggle("animus-mobile-overflow", overflow > 2);
  }

  function init() {
    createAppbar();
    wireMobileNavigation();
    syncBackdrop();
    syncTitle();
    removeAbandonedReceiptProcessingOverlay();
    auditOverflow();
  }

  const observer = new MutationObserver(() => {
    wireMobileNavigation();
    syncBackdrop();
    syncTitle();
    removeAbandonedReceiptProcessingOverlay();
    auditOverflow();
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "class", "data-animus-title"] });
  window.addEventListener("resize", () => {
    closeMenu();
    syncTitle();
    auditOverflow();
  });
  document.addEventListener("click", closeOpenMenus, true);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });
})();
