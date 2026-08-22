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
  function todayEvents() { return (typeof allCrmCalendarEvents === "function" ? allCrmCalendarEvents() : []).filter((event) => String(event.date || "") === dayKey()).slice(0, 5); }
  function futureEvents() { return (typeof allCrmCalendarEvents === "function" ? allCrmCalendarEvents() : []).filter((event) => String(event.date || "") >= dayKey()).slice(0, 5); }
  function openFile(fileId) { const file = crmFiles.find((item) => item.id === fileId); if (!file) return; activeFileId = file.id; activateCrmFilter(filterForCrmFile(file)); switchCrmView("files"); renderCrm(); }
  function openView(view) { switchCrmView(view); }
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
    const active = crmFiles.filter((file) => ["Job Won", "In Progress", "Work Completed"].includes(status(file)));
    const pending = crmFiles.filter((file) => file?.statusDetail === "Estimate Sent" || file?.estimateStatus === "Sent" || status(file) === "In Negotiation");
    const pipelineFiles = crmFiles.filter((file) => !["Closed / Paid", "Job Lost / Closed", "In Progress", "Work Completed"].includes(status(file)));
    const pipelineValue = pipelineFiles.reduce((sum,file) => sum + value(file), 0);
    const financial = currentFinancials(); const alertList = alerts(); const schedule = todayEvents(); const stages = stageDefinitions.map(([name, test, tone]) => { const files = crmFiles.filter(test); return { name, tone, count:files.length, total:files.reduce((sum,file) => sum + value(file), 0), file:files[0] }; });
    const upcoming = active.map((file) => ({ file, date:file.startDate || file.anticipatedCompletionDate || "" })).filter((item) => item.date).sort((a,b) => String(a.date).localeCompare(String(b.date))).slice(0,5);
    const recent = activity(); const notificationCount = alertList.length;
    return `<section class="animus-dashboard-home" id="animusDashboardHome">
      <header class="animus-home-header"><div><h1>${greeting()}, D2 Team <span aria-hidden="true">&#128075;</span></h1><p>Here's what's happening with your business today.</p></div><div class="animus-home-tools"><div class="animus-global-search"><span>⌕</span><input id="animusHomeSearch" placeholder="Search customers, jobs, invoices..."></div><div class="animus-quick-add"><button class="animus-home-primary" id="animusQuickAdd">+ New</button><div class="animus-quick-menu" id="animusQuickMenu" hidden><button data-animus-quick="file">New Customer File</button><button data-animus-quick="estimate">New Estimate</button><button data-animus-quick="expense">New Expense</button><button data-animus-quick="calendar">New Calendar Event</button></div></div><button class="animus-notification" id="animusNotifications" aria-label="Attention required">&#128276;${notificationCount ? `<b>${notificationCount}</b>` : ""}</button></div></header>
      <section class="animus-kpi-grid">
        ${kpi("◉","New Leads",crmFiles.filter((file) => status(file) === "New Lead").length,"blue","Open customer inquiries","new")}
        ${kpi("▤","Estimates Pending",pending.length,"amber","Awaiting customer action","estimate")}
        ${kpi("↗","Pipeline Value",money(pipelineValue),"violet","Open opportunities","negotiation")}
        ${kpi("▣","Active Jobs",active.length,"green","Won, in progress, or completed","active")}
        ${kpi("$","Revenue",money(financial.revenue),"green","This month","revenue")}
        ${kpi("◈","Profit",money(financial.profit),"violet","This month","revenue")}
      </section>
      <section class="animus-home-grid animus-major-grid">
        <article class="animus-home-card animus-attention-card"><div class="animus-card-heading"><h2>Attention Required ${alertList.length ? `<b>${alertList.length}</b>` : ""}</h2></div>${alertList.length ? `<div class="animus-alert-list">${alertList.map((item) => `<button class="animus-alert ${item.tone}" data-animus-file="${safe(item.file.id)}"><span class="animus-alert-icon">!</span><span><strong>${safe(item.title)}</strong><small>${safe(item.detail)}</small></span><em>${safe(item.action)}</em></button>`).join("")}</div>` : empty("You're all caught up.", "No items require attention today.")}<button class="animus-card-link" data-animus-open="files">View all alerts</button></article>
        <article class="animus-home-card"><div class="animus-card-heading"><h2>Today's Schedule</h2><span>${now.toLocaleDateString("en-US", { month:"short", day:"numeric" })}</span></div>${schedule.length ? `<div class="animus-timeline">${schedule.map((event) => `<button data-animus-file="${safe(event.fileId)}"><time>${safe(event.time || "All day")}</time><span><strong>${safe(event.title)}</strong><small>${safe(event.address || event.clientName || "ANIMUS calendar")}</small></span></button>`).join("")}</div>` : empty("No appointments today", "Your schedule is clear.")}<button class="animus-card-link" data-animus-open="calendar">View full calendar</button></article>
        <article class="animus-home-card animus-pipeline-card"><div class="animus-card-heading"><h2>Sales Pipeline</h2><select aria-label="Pipeline period"><option>This Month</option></select></div><div class="animus-pipeline-list">${stages.map((stage) => `<button data-animus-stage="${safe(stage.name)}"><span class="animus-pipeline-dot ${stage.tone}"></span><strong>${stage.name}</strong><em>${stage.count}</em><b>${money(stage.total)}</b></button>`).join("")}</div><div class="animus-pipeline-total"><span>Total Pipeline Value</span><strong>${money(pipelineValue)}</strong></div></article>
      </section>
      <section class="animus-home-grid animus-bottom-grid">
        <article class="animus-home-card animus-financial-card"><div class="animus-card-heading"><h2>Revenue vs Expenses</h2><select aria-label="Financial period"><option>This Month</option></select></div><div class="animus-financial-body"><div>${chart(financial)}<div class="animus-chart-legend"><span><i class="revenue"></i>Revenue</span><span><i class="expenses"></i>Expenses</span></div></div><dl><div><dt>Total Revenue</dt><dd>${money(financial.revenue)}</dd></div><div><dt>Total Expenses</dt><dd>${money(financial.expenses)}</dd></div><div><dt>Net Profit</dt><dd>${money(financial.profit)}</dd></div><div><dt>Profit Margin</dt><dd>${financial.revenue ? `${financial.margin.toFixed(1)}%` : "—"}</dd></div></dl></div><button class="animus-card-link" data-animus-open="revenue">View full report</button></article>
        <article class="animus-home-card"><div class="animus-card-heading"><h2>Upcoming Jobs</h2><button class="animus-card-link" data-animus-open="files">View all jobs</button></div>${upcoming.length ? `<div class="animus-upcoming-list">${upcoming.map(({file,date}) => { const value = new Date(`${date}T12:00:00`); return `<button data-animus-file="${safe(file.id)}"><time><b>${value.toLocaleDateString("en-US", { month:"short" })}</b><strong>${value.getDate()}</strong></time><span><strong>${safe(file.clientName || file.fileNumber)}</strong><small>${safe(file.projectType || "Project")} · ${safe(file.projectAddress || "Location pending")}</small></span><em>${safe(status(file))}</em></button>`; }).join("")}</div>` : empty("No upcoming jobs", "Upcoming scheduled work will appear here.")}<button class="animus-card-link" data-animus-open="calendar">View calendar</button></article>
        <article class="animus-home-card"><div class="animus-card-heading"><h2>Recent Activity</h2><button class="animus-card-link" data-animus-open="files">View all</button></div>${recent.length ? `<div class="animus-activity-list">${recent.map((item) => `<button data-animus-file="${safe(item.file.id)}"><span class="animus-activity-icon ${item.type}">${item.type === "note" ? "✎" : "◉"}</span><span><strong>${safe(item.file.clientName || item.file.fileNumber)}</strong><small>${safe(item.text)}</small></span><time>${relative(item.at)}</time></button>`).join("")}</div>` : empty("No recent activity", "Recent ANIMUS activity will appear here.")}</article>
      </section>
    </section>`;
  }
  function kpi(icon, label, number, tone, note, target) { return `<button class="animus-kpi-card" data-animus-open="${target}"><span class="animus-kpi-icon ${tone}">${icon}</span><span class="animus-kpi-copy"><small>${label}</small><strong>${number}</strong><em>${note}</em></span></button>`; }
  function empty(title, text) { return `<div class="animus-empty"><strong>${title}</strong><span>${text}</span></div>`; }
  function relative(value) { const milliseconds = Date.now() - new Date(value).getTime(); const minutes = Math.max(0, Math.round(milliseconds / 60000)); return minutes < 60 ? `${minutes || 1}m ago` : minutes < 1440 ? `${Math.round(minutes / 60)}h ago` : `${Math.round(minutes / 1440)}d ago`; }
  function showHome(show, showFiles = false) {
    const root = document.querySelector("#animusDashboardHome");
    if (root) root.hidden = !show;
    document.body.dataset.animusView = show ? "dashboard" : "files";
    if (show || showFiles) document.querySelectorAll(".crm-dashboard-view").forEach((section) => { section.hidden = !showFiles; });
  }
  function render() { const shell = document.querySelector(".crm-dashboard"); if (!shell) return; document.querySelector("#animusDashboardHome")?.remove(); shell.insertAdjacentHTML("afterbegin", template()); bind(); }
  function bind() {
    document.querySelector("#animusHomeSearch")?.addEventListener("keydown", (event) => { if (event.key !== "Enter") return; const field = document.querySelector("#crmFileSearch"); if (field) { field.value = event.target.value; document.querySelector("#crmSearchFile")?.click(); } });
    document.querySelector("#animusQuickAdd")?.addEventListener("click", () => { const menu = document.querySelector("#animusQuickMenu"); if (menu) menu.hidden = !menu.hidden; });
    document.querySelectorAll("[data-animus-quick]").forEach((button) => button.addEventListener("click", () => { const action = button.dataset.animusQuick; if (action === "file") { document.querySelector("#crmNewFile")?.click(); switchCrmView("files"); } else if (action === "estimate") openView("estimator"); else if (action === "expense") openView("expenses"); else if (action === "calendar") openView("calendar"); }));
    document.querySelectorAll("[data-animus-open]").forEach((button) => button.addEventListener("click", () => openView(button.dataset.animusOpen)));
    document.querySelectorAll("[data-animus-file]").forEach((button) => button.addEventListener("click", () => openFile(button.dataset.animusFile)));
    document.querySelectorAll("[data-animus-stage]").forEach((button) => button.addEventListener("click", () => { const stage = button.dataset.animusStage; const map = { "New Lead":"new", Contacted:"contact", Inspection:"estimate", "Estimate Sent":"estimate", Negotiation:"negotiation", Won:"active" }; activateCrmFilter(map[stage] || "new"); switchCrmView("files"); renderCrm(); }));
    document.querySelector("#animusNotifications")?.addEventListener("click", () => document.querySelector(".animus-attention-card")?.scrollIntoView({ behavior:"smooth", block:"start" }));
  }
  const baseSwitchView = switchCrmView;
  switchCrmView = function animusSwitchCrmView(view) {
    const wantsHome = view === "dashboard";
    const wantsFiles = view === "files";
    baseSwitchView(wantsFiles ? "dashboard" : view);
    showHome(wantsHome, wantsFiles);
    if (wantsHome) render();
  };
  window.animusDashboardRender = render;
  document.addEventListener("DOMContentLoaded", () => window.setTimeout(() => { render(); showHome(true); }, 0));
  if (document.readyState !== "loading") window.setTimeout(() => { render(); showHome(true); }, 0);
})();
