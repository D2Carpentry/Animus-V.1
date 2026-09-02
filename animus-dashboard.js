// Read-only Command Center home. It summarizes the existing CRM state and routes
// the user back into the original ANIMUS modules for all editing.
(() => {
  const money = (value) => new Intl.NumberFormat("en-US", { style:"currency", currency:"USD", maximumFractionDigits:0 }).format(Number(value) || 0);
  const dayKey = (date = new Date()) => date.toISOString().slice(0, 10);
  const safe = (value) => String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const status = (file) => String(file?.fileStatus || "");
  const value = (file) => Number(file?.estimateTotal || file?.estimateAmount || 0) || 0;
  const category = (file) => typeof crmFileCategory === "function" ? crmFileCategory(file) : fallbackCategory(file);
  const fallbackCategory = (file) => {
    const fileStatus = status(file).trim();
    const detail = String(file?.statusDetail || "").trim();
    const estimateStatus = String(file?.estimateStatus || "").trim();
    if (["Closed / Paid", "Job Lost / Closed"].includes(fileStatus)) return "archive";
    if (fileStatus === "In Progress") return "active";
    if (fileStatus === "In Negotiation") return "negotiation";
    if (fileStatus === "Inspection Completed" || ["Inspection Pending", "Inspection Date Set", "Estimate Attached", "Estimate Pending", "Estimate Sent"].includes(detail) || ["Pending", "Sent"].includes(estimateStatus)) return "estimate";
    if (["Contact Established", "Contact Attempted"].includes(fileStatus)) return "contact";
    return "new";
  };
  const filesInBucket = (bucket) => crmFiles.filter((file) => category(file) === bucket);
  const rowsForMonth = () => (crmRevenueRows || []).filter((row) => { const date = new Date(row.date || ""); return !Number.isNaN(date) && date.getMonth() === thisMonth && date.getFullYear() === thisYear; });
  const stageDefinitions = [
    ["New Lead", (file) => status(file) === "New Lead", "blue"],
    ["Contacted", (file) => ["Contact Established", "Contact Attempted"].includes(status(file)), "sky"],
    ["Inspection", (file) => status(file) === "Inspection Completed", "amber"],
    ["Estimate Sent", (file) => file?.statusDetail === "Estimate Sent" || file?.estimateStatus === "Sent", "violet"],
    ["Negotiation", (file) => status(file) === "In Negotiation", "orange"],
    ["Won", (file) => status(file) === "Job Won", "green"],
  ];

  function greeting() {
    const hour = new Date().getHours();
    return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  }
  function todayEvents() {
    const today = dayKey();
    const events = typeof calendarEventsForDate === "function"
      ? calendarEventsForDate(today)
      : (typeof allCrmCalendarEvents === "function" ? allCrmCalendarEvents() : []).filter((event) => String(event.date || "").slice(0, 10) === today);
    return events
      .slice()
      .sort((a, b) => String(a.startIso || `${a.date}T${a.time || "09:00"}`).localeCompare(String(b.startIso || `${b.date}T${b.time || "09:00"}`)))
      .slice(0, 5);
  }
  function futureEvents() { return (typeof allCrmCalendarEvents === "function" ? allCrmCalendarEvents() : []).filter((event) => String(event.date || "") >= dayKey()).slice(0, 5); }
  function openFile(fileId) { const file = crmFiles.find((item) => item.id === fileId); if (!file) return; activeFileId = file.id; activateCrmFilter(filterForCrmFile(file)); switchCrmView("files"); renderCrm(); }
  function openView(view) {
    const route = String(view || "");
    if (route.startsWith("files:")) {
      activateCrmFilter(route.slice(6));
      switchCrmView("files");
      renderCrm();
      return;
    }
    switchCrmView(route);
  }
  function currentFinancials() {
    const rows = rowsForMonth();
    const revenue = rows.reduce((sum, row) => sum + (Number(row.gross) || 0), 0);
    const expenses = rows.reduce((sum, row) => sum + (Number(row.expenses) || 0), 0);
    const labor = rows.reduce((sum, row) => sum + (Number(row.labor) || 0), 0);
    const profit = rows.reduce((sum, row) => sum + (Number(row.profit) || ((Number(row.gross) || 0) - (Number(row.expenses) || 0) - (Number(row.labor) || 0))), 0);
    return { revenue, expenses, labor, profit, margin: revenue ? (profit / revenue) * 100 : 0, rows };
  }
  function alerts() {
    const today = dayKey(); const list = [];
    crmFiles.forEach((file) => {
      const follow = String(file.followUpDate || file.nextActionDate || "");
      if (follow && follow <= today && !["Closed / Paid", "Job Lost / Closed"].includes(status(file))) list.push({ type:"follow", file, title:"Follow-up due", detail:`${file.clientName || "Customer"} · ${file.fileNumber || "File"}`, tone:"amber", action:"Open file" });
      if (String(file.inspectionDate || "") === today) list.push({ type:"inspection", file, title:"Inspection today", detail:`${file.clientName || "Customer"}${file.inspectionTime ? ` · ${file.inspectionTime}` : ""}`, tone:"blue", action:"View file" });
      const paid = Number(file.initialDeposit || 0) + Number(file.midpointDeposit || 0) + Number(file.finalPaymentAmount || 0);
      const balance = Math.max(0, value(file) - paid);
      if (status(file) === "Work Completed" && balance > 0) list.push({ type:"payment", file, title:"Final payment outstanding", detail:`${file.clientName || "Customer"} · ${money(balance)} remaining`, tone:"red", action:"Financials" });
    });
    return list.slice(0, 4);
  }
  function activity() {
    const entries = [];
    crmFiles.forEach((file) => {
      (Array.isArray(file.timeline) ? file.timeline : []).forEach((item) => entries.push({ file, at:item.at || item.date || "", text:item.text || item.label || "File updated", type:"file" }));
      (Array.isArray(file.notes) ? file.notes : []).forEach((item) => entries.push({ file, at:item.at || "", text:item.text || "Note added", type:"note" }));
    });
    return entries.filter((item) => item.at).sort((a,b) => new Date(b.at) - new Date(a.at)).slice(0, 5);
  }
  function chart(financial) {
    const rows = financial.rows.filter((row) => row.date).sort((a,b) => new Date(a.date) - new Date(b.date));
    if (rows.length < 2) return `<div class="animus-chart-empty">Revenue history will appear as financial records are dated this month.</div>`;
    const grouped = new Map();
    rows.forEach((row) => { const key = String(row.date).slice(0, 10); const cell = grouped.get(key) || { revenue:0, expenses:0 }; cell.revenue += Number(row.gross) || 0; cell.expenses += Number(row.expenses) || 0; grouped.set(key, cell); });
    const points = [...grouped.values()].slice(-8); const max = Math.max(...points.flatMap((point) => [point.revenue, point.expenses]), 1);
    const line = (field) => points.map((point,index) => `${14 + index * (244 / Math.max(1, points.length - 1))},${92 - (point[field] / max) * 72}`).join(" ");
    return `<svg class="animus-financial-chart" viewBox="0 0 280 108" aria-label="Revenue and expense chart"><path d="M14 92H266 M14 56H266 M14 20H266" class="animus-chart-grid"/><polyline points="${line("revenue")}" class="animus-chart-revenue"/><polyline points="${line("expenses")}" class="animus-chart-expenses"/></svg>`;
  }
  function template() {
    const newLeads = filesInBucket("new");
    const pendingContact = filesInBucket("contact");
    const pendingEstimates = filesInBucket("estimate");
    const negotiation = filesInBucket("negotiation");
    const active = filesInBucket("active");
    const closed = filesInBucket("archive");
    const pending = crmFiles.filter((file) => file?.statusDetail === "Estimate Sent" || file?.estimateStatus === "Sent" || status(file) === "In Negotiation");
    const pipelineFiles = crmFiles.filter((file) => !["Closed / Paid", "Job Lost / Closed", "In Progress", "Work Completed"].includes(status(file)));
    const pipelineValue = pipelineFiles.reduce((sum,file) => sum + value(file), 0);
    const financial = currentFinancials(); const alertList = alerts(); const schedule = todayEvents(); const stages = stageDefinitions.map(([name, test, tone]) => { const files = crmFiles.filter(test); return { name, tone, count:files.length, total:files.reduce((sum,file) => sum + value(file), 0), file:files[0] }; });
    const upcoming = active.map((file) => ({ file, date:file.startDate || file.anticipatedCompletionDate || "" })).filter((item) => item.date).sort((a,b) => String(a.date).localeCompare(String(b.date))).slice(0,5);
    const recent = activity(); const notificationCount = alertList.length;
    return `<section class="animus-dashboard-home" id="animusDashboardHome">
      <header class="animus-home-header"><div><h1>${greeting()}, D2 Team <span aria-hidden="true">&#128075;</span></h1><p>Here's what's happening with your business today.</p></div></header>
      <section class="animus-kpi-grid">
        ${kpi("◉","New Leads",newLeads.length,"blue","Open customer inquiries","files:new")}
        ${kpi("☎","Pending Contact",pendingContact.length,"amber","Contact needs attention","files:contact")}
        ${kpi("▤","Pending Estimates",pendingEstimates.length,"violet","Estimate work to complete","files:estimate")}
        ${kpi("↗","In Negotiation",negotiation.length,"amber","Customer decision pending","files:negotiation")}
        ${kpi("▣","Active Jobs",active.length,"green","Files currently in progress","files:active")}
        ${kpi("✓","Closed Files",closed.length,"blue","Archived work files","files:archive")}
      </section>
      <section class="animus-home-grid animus-major-grid">
        <article class="animus-home-card animus-attention-card"><div class="animus-card-heading"><h2>Attention Required ${alertList.length ? `<b>${alertList.length}</b>` : ""}</h2></div>${alertList.length ? `<div class="animus-alert-list">${alertList.map((item) => `<button class="animus-alert ${item.tone}" data-animus-file="${safe(item.file.id)}"><span class="animus-alert-icon">!</span><span><strong>${safe(item.title)}</strong><small>${safe(item.detail)}</small></span><em>${safe(item.action)}</em></button>`).join("")}</div>` : empty("You're all caught up.", "No items require attention today.")}<button class="animus-card-link" data-animus-open="files">View all alerts</button></article>
        <article class="animus-home-card"><div class="animus-card-heading"><h2>Today's Schedule</h2><span>${now.toLocaleDateString("en-US", { month:"short", day:"numeric" })}</span></div>${schedule.length ? `<div class="animus-timeline">${schedule.map((event) => `<button data-animus-file="${safe(event.fileId)}"><time>${safe(event.time || "All day")}</time><span><strong>${safe(event.title)}</strong><small>${safe(event.address || event.clientName || "ANIMUS calendar")}</small></span></button>`).join("")}</div>` : empty("No appointments today", "Your schedule is clear.")}<button class="animus-card-link" data-animus-open="calendar">View full calendar</button></article>
      </section>
      <section class="animus-home-grid animus-bottom-grid">
        <article class="animus-home-card"><div class="animus-card-heading"><h2>Upcoming Jobs</h2><button class="animus-card-link" data-animus-open="files">View all jobs</button></div>${upcoming.length ? `<div class="animus-upcoming-list">${upcoming.map(({file,date}) => { const value = new Date(`${date}T12:00:00`); return `<button data-animus-file="${safe(file.id)}"><time><b>${value.toLocaleDateString("en-US", { month:"short" })}</b><strong>${value.getDate()}</strong></time><span><strong>${safe(file.clientName || file.fileNumber)}</strong><small>${safe(file.projectType || "Project")} · ${safe(file.projectAddress || "Location pending")}</small></span><em>${safe(status(file))}</em></button>`; }).join("")}</div>` : empty("No upcoming jobs", "Upcoming scheduled work will appear here.")}<button class="animus-card-link" data-animus-open="calendar">View calendar</button></article>
        <article class="animus-home-card"><div class="animus-card-heading"><h2>Recent Activity</h2><button class="animus-card-link" data-animus-open="files">View all</button></div>${recent.length ? `<div class="animus-activity-list">${recent.map((item) => `<button data-animus-file="${safe(item.file.id)}"><span class="animus-activity-icon ${item.type}">${item.type === "note" ? "✎" : "◉"}</span><span><strong>${safe(item.file.clientName || item.file.fileNumber)}</strong><small>${safe(item.text)}</small></span><time>${relative(item.at)}</time></button>`).join("")}</div>` : empty("No recent activity", "Recent ANIMUS activity will appear here.")}</article>
      </section>
    </section>`;
  }
  function kpi(icon, label, number, tone, note, target) { return `<button class="animus-kpi-card" data-animus-open="${target}"><span class="animus-kpi-icon ${tone}">${icon}</span><span class="animus-kpi-copy"><small>${label}</small><strong>${number}</strong><em>${note}</em></span></button>`; }
  function empty(title, text) { return `<div class="animus-empty"><strong>${title}</strong><span>${text}</span></div>`; }
  function relative(value) { const milliseconds = Date.now() - new Date(value).getTime(); const minutes = Math.max(0, Math.round(milliseconds / 60000)); return minutes < 60 ? `${minutes || 1}m ago` : minutes < 1440 ? `${Math.round(minutes / 60)}h ago` : `${Math.round(minutes / 1440)}d ago`; }
  function showHome(show, showFiles = false, showEstimator = false) {
    const root = document.querySelector("#animusDashboardHome");
    if (root) root.hidden = !show;
    document.body.dataset.animusView = show ? "dashboard" : showEstimator ? "estimator" : "files";
    if (show || showFiles || showEstimator) {
      const estimatorShell = document.querySelector("#crmEstimatorView")?.closest(".crm-dashboard-view");
      document.querySelectorAll(".crm-dashboard-view").forEach((section) => {
        section.hidden = show ? true : showEstimator ? section !== estimatorShell : false;
      });
    }
  }
  function render() {
    const shell = document.querySelector(".crm-dashboard");
    if (!shell) return;
    const existing = document.querySelector("#animusDashboardHome");
    const wasHidden = existing ? existing.hidden : document.body.dataset.animusView !== "dashboard";
    existing?.remove();
    shell.insertAdjacentHTML("afterbegin", template());
    const next = document.querySelector("#animusDashboardHome");
    if (next) next.hidden = wasHidden;
    bind();
  }
  function bind() {
    document.querySelectorAll("[data-animus-open]").forEach((button) => button.addEventListener("click", () => openView(button.dataset.animusOpen)));
    document.querySelectorAll("[data-animus-file]").forEach((button) => button.addEventListener("click", () => openFile(button.dataset.animusFile)));
    document.querySelectorAll("[data-animus-stage]").forEach((button) => button.addEventListener("click", () => { const stage = button.dataset.animusStage; const map = { "New Lead":"new", Contacted:"contact", Inspection:"estimate", "Estimate Sent":"estimate", Negotiation:"negotiation", Won:"active" }; activateCrmFilter(map[stage] || "new"); switchCrmView("files"); renderCrm(); }));
  }
  const baseSwitchView = switchCrmView;
  switchCrmView = function animusSwitchCrmView(view) {
    const wantsHome = view === "dashboard";
    const wantsFiles = view === "files";
    const wantsEstimator = view === "estimator";
    baseSwitchView(wantsFiles ? "dashboard" : view);
    showHome(wantsHome, wantsFiles, wantsEstimator);
    if (wantsHome) render();
  };
  window.animusDashboardRender = render;
  document.addEventListener("DOMContentLoaded", () => window.setTimeout(() => { render(); showHome(true); }, 0));
  if (document.readyState !== "loading") window.setTimeout(() => { render(); showHome(true); }, 0);
})();
