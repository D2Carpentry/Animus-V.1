/* ANIMUS Revenue center. It deliberately uses the original CRM rows and save helpers. */
(() => {
  const money = (value) => (typeof crmCurrency !== "undefined" ? crmCurrency : new Intl.NumberFormat("en-US", { style:"currency", currency:"USD" })).format(Number(value) || 0);
  const safe = (value) => typeof escapeHtml === "function" ? escapeHtml(value || "") : String(value || "").replace(/[&<>"]/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));
  const dateText = (value) => { const date = new Date(`${value || ""}T12:00:00`); return Number.isNaN(date.getTime()) ? "Date pending" : date.toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" }); };
  const numeric = (value) => typeof parseMoney === "function" ? parseMoney(value) : Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;
  const profit = (row) => typeof revenueProfit === "function" ? revenueProfit(row) : numeric(row.gross) - numeric(row.expenses) - numeric(row.labor);
  const state = { query:"", status:"all", project:"all", columns:{ date:true, margin:true, expenses:true, actions:true }, page:1, perPage:10, action:"", filterOpen:false, columnsOpen:false };
  const COLUMN_STORAGE = "animus-profitability-column-widths-v3-compact";
  const DEFAULT_COLUMN_WIDTHS = [102, 250, 122, 112, 112, 122, 108, 64];
  let originalRender = null;

  function rows() {
    const all = Array.isArray(crmRevenueRows) ? [...crmRevenueRows] : [];
    return all.filter((row) => {
      const file = typeof findFileForRevenue === "function" ? findFileForRevenue(row) : null;
      const text = `${row.clientJob || ""} ${row.fileNumber || ""} ${file?.clientName || ""} ${file?.projectAddress || ""}`.toLowerCase();
      const queryMatch = !state.query || text.includes(state.query.toLowerCase());
      const statusMatch = state.status === "all" || file?.fileStatus === state.status;
      const projectMatch = state.project === "all" || file?.projectType === state.project;
      const yearMatch = !crmRevenueYearFilter || crmRevenueYearFilter === "all" || String(row.date || "").startsWith(crmRevenueYearFilter);
      return queryMatch && statusMatch && projectMatch && yearMatch;
    }).sort((a,b) => (Date.parse(b.date || "") || 0) - (Date.parse(a.date || "") || 0));
  }
  function totals(list) { return list.reduce((sum,row) => ({ gross:sum.gross + numeric(row.gross), expenses:sum.expenses + numeric(row.expenses), labor:sum.labor + numeric(row.labor), profit:sum.profit + profit(row) }), { gross:0, expenses:0, labor:0, profit:0 }); }
  function toneForValue(value) { const amount = numeric(value); return amount < 0 ? "is-negative" : amount === 0 ? "is-zero" : ""; }
  const KPI_ROUTES = { gross:"business", expenses:"expenses", labor:"payroll", profit:"business", margin:"business" };
  function kpi(icon, tone, title, value, note, field, valueTone = "") {
    const route = KPI_ROUTES[field] || "";
    return `<article class="animus-revenue-kpi ${route ? "is-clickable" : ""}" ${route ? `role="button" tabindex="0" data-revenue-kpi-route="${route}"` : ""}><span class="animus-revenue-kpi-icon ${tone}">${icon}</span><div><small>${title}</small><strong class="${valueTone}">${value}</strong><em>${note}</em></div></article>`;
  }
  function dateOptions() { const values = [...new Set((crmRevenueRows || []).map((row) => String(row.date || "").slice(0,4)).filter(Boolean))].sort().reverse(); return `<option value="all" ${crmRevenueYearFilter === "all" ? "selected" : ""}>All dates</option>${values.map((value) => `<option value="${safe(value)}" ${crmRevenueYearFilter === value ? "selected" : ""}>${safe(value)}</option>`).join("")}`; }
  function projectOptions() { const values = [...new Set((crmFiles || []).map((file) => file.projectType).filter(Boolean))].sort(); return `<option value="all">All project types</option>${values.map((value) => `<option value="${safe(value)}" ${state.project === value ? "selected" : ""}>${safe(value)}</option>`).join("")}`; }
  function statusOptions() { const values = [...new Set((crmFiles || []).map((file) => file.fileStatus).filter(Boolean))].sort(); return `<option value="all">All job statuses</option>${values.map((value) => `<option value="${safe(value)}" ${state.status === value ? "selected" : ""}>${safe(value)}</option>`).join("")}`; }
  function dateInputValue(value) {
    const text = String(value || "").trim();
    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return iso[0];
    const parsed = Date.parse(text);
    return Number.isNaN(parsed) ? "" : new Date(parsed).toISOString().slice(0, 10);
  }
  function columnWidths() {
    try {
      const saved = JSON.parse(localStorage.getItem(COLUMN_STORAGE) || "[]");
      return DEFAULT_COLUMN_WIDTHS.map((width, index) => Math.max(74, Number(saved[index]) || width));
    } catch {
      return [...DEFAULT_COLUMN_WIDTHS];
    }
  }
  function columnGroupMarkup() {
    return `<colgroup data-animus-revenue-cols>${columnWidths().map((width) => `<col style="width:${width}px">`).join("")}</colgroup>`;
  }
  function resizeHandle(index, label) {
    if (index >= DEFAULT_COLUMN_WIDTHS.length - 1) return "";
    return `<button class="animus-revenue-column-resizer" data-revenue-resize-column="${index}" aria-label="Resize ${safe(label)} column" type="button"></button>`;
  }
  function headerCell(label, index, className = "") {
    return `<th class="${className}" data-animus-revenue-column="${index}"><span>${safe(label)}</span>${resizeHandle(index, label)}</th>`;
  }
  function saveDate(rowId, value) {
    const row = (crmRevenueRows || []).find((item) => item.id === rowId);
    if (!row) return;
    const previous = row.date || "";
    row.date = value || previous;
    row.revenueAudit = Array.isArray(row.revenueAudit) ? row.revenueAudit : [];
    row.revenueAudit.unshift({ rowId:row.id, field:"date", from:previous || "Date pending", to:row.date || "Date pending", at:new Date().toISOString(), by:"Owner" });
    if (typeof saveRevenueRows === "function") saveRevenueRows();
    render();
    window.animusSaveRevenueChangeToCloud?.("Revenue date saved to Cloudflare.");
  }
  function tableRow(row) {
    const file = typeof findFileForRevenue === "function" ? findFileForRevenue(row) : null;
    const customer = file?.clientName || row.clientName || String(row.clientJob || "").replace(/\s*[-·]\s*(?:26-)?A-?\d+.*$/i, "").trim() || "Unlinked file";
    const margin = numeric(row.gross) ? (profit(row) / numeric(row.gross)) * 100 : 0;
    const visible = (name) => state.columns[name] ? "" : " hidden";
    return `<tr data-revenue-row="${safe(row.id)}">
      <td class="revenue-col-date${visible("date")}"><input class="animus-revenue-date-input" type="date" value="${safe(dateInputValue(row.date))}" data-revenue-date-edit="${safe(row.id)}" aria-label="Edit revenue date" title="${safe(dateText(row.date))}"></td>
      <td><button class="animus-revenue-job" data-revenue-open-file="${safe(row.id)}" title="${safe(customer)}">${safe(customer)}</button></td>
      <td>${moneyCell(row,"gross",money(row.gross),"")}</td>
      <td class="revenue-col-expenses${visible("expenses")}">${moneyCell(row,"expenses",money(row.expenses),"expenses")}</td>
      <td>${moneyCell(row,"labor",money(row.labor),"labor")}</td>
      <td>${moneyCell(row,"profit",money(profit(row)),`net ${toneForValue(profit(row))}`,true)}</td>
      <td class="revenue-col-margin${visible("margin")}">${moneyCell(row,"margin",`${margin.toFixed(1)}%`,`net ${toneForValue(margin)}`,true)}</td>
      <td class="revenue-col-actions${visible("actions")}"><div class="animus-revenue-actions"><button data-revenue-actions="${safe(row.id)}" aria-label="More actions">⋯</button>${state.action === row.id ? actionMenu(row) : ""}</div></td>
    </tr>`;
  }
  function moneyCell(row, field, formatted, className, calculated = false) {
    if (state.edit?.id === row.id && state.edit.field === field) return `<div class="animus-revenue-money ${className}"><input data-revenue-inline value="${safe(state.edit.value)}" inputmode="decimal" aria-label="Edit ${field}"><button data-revenue-inline-save="${safe(row.id)}" title="Save">✓</button></div>`;
    const main = field === "labor" ? `<button class="animus-revenue-labor-link" data-revenue-payroll="${safe(row.id)}">${formatted}</button>` : formatted;
    return `<div class="animus-revenue-money ${className}">${main}<button data-revenue-edit="${safe(row.id)}" data-revenue-field="${field}" title="Edit ${field}" ${calculated && field === "margin" ? "" : ""}>✎</button></div>`;
  }
  function actionMenu(row) { return `<div class="animus-revenue-action-menu"><button data-revenue-open-file="${safe(row.id)}">Open work file</button><button data-revenue-expenses="${safe(row.id)}">Open expenses</button><button data-revenue-payroll="${safe(row.id)}">Open payroll</button><button data-revenue-export-row="${safe(row.id)}">Export job profitability</button><button class="animus-revenue-delete" data-revenue-delete="${safe(row.id)}">Delete revenue row</button></div>`; }
  function render() {
    const view = document.querySelector("#crmRevenueView"); if (!view) return;
    const visibleRows = rows(); const total = totals(visibleRows); const margin = total.gross ? (total.profit / total.gross) * 100 : 0;
    const pageCount = Math.max(1, Math.ceil(visibleRows.length / state.perPage)); state.page = Math.min(state.page, pageCount);
    const start = (state.page - 1) * state.perPage; const pageRows = visibleRows.slice(start, start + state.perPage);
    view.innerHTML = `<section class="animus-revenue-center">
      <header class="animus-revenue-head"><div><h1>Revenue</h1><p>Detailed profit &amp; loss by job</p></div><div class="animus-revenue-tools"><button class="animus-revenue-add" id="animusAddRevenue">+ Add Revenue</button><select id="animusRevenueDateRange" aria-label="Date range">${dateOptions()}</select><div class="animus-revenue-filter-wrap"><button id="animusRevenueFilters">⌘ Filters</button>${state.filterOpen ? `<div class="animus-revenue-filter-menu"><label>Job status<select id="animusRevenueStatus">${statusOptions()}</select></label><label>Project type<select id="animusRevenueProject">${projectOptions()}</select></label><button id="animusRevenueClearFilters">Clear filters</button></div>` : ""}</div><button class="revenue-export" id="animusRevenueExport">⇩ Export</button></div></header>
      <section class="animus-revenue-kpis">${kpi("$","green","Total Gross Earnings",money(total.gross),"Current filtered period","gross")}${kpi("▧","amber","Total Expenses",money(total.expenses),"Receipts and saved expenses","expenses")}${kpi("♙","blue","Total Labor",money(total.labor),"Payroll linked to work files","labor")}${kpi("↗","green","Net Profit",money(total.profit),"Gross minus expenses and labor","profit",toneForValue(total.profit))}${kpi("%","violet","Profit Margin",margin.toFixed(1) + "%","Net profit rate","margin",toneForValue(margin))}</section>
      <section class="animus-revenue-card"><header class="animus-revenue-card-head"><div><h2>Job Profitability</h2><p>Every value is tied to an existing ANIMUS work file.</p></div><div class="animus-revenue-table-tools"><label class="animus-revenue-search">⌕<input id="animusRevenueSearch" value="${safe(state.query)}" placeholder="Search jobs or customers..."></label><div class="animus-revenue-columns"><button id="animusRevenueColumns">Columns ▾</button>${state.columnsOpen ? `<div class="animus-revenue-columns-menu">${Object.entries({date:"Date",margin:"Profit Margin",expenses:"Expenses",actions:"Actions"}).map(([key,label]) => `<label><input type="checkbox" data-revenue-column="${key}" ${state.columns[key] ? "checked" : ""}> ${label}</label>`).join("")}</div>` : ""}</div></div></header>
        <div class="animus-revenue-table-wrap"><table class="animus-revenue-table">${columnGroupMarkup()}<thead><tr>${headerCell("Date", 0, `revenue-col-date${state.columns.date ? "" : " hidden"}`)}${headerCell("File Name (Job)", 1)}${headerCell("Gross Earnings", 2)}${headerCell("Expenses", 3, `revenue-col-expenses${state.columns.expenses ? "" : " hidden"}`)}${headerCell("Labor", 4)}${headerCell("Net Profit", 5)}${headerCell("Profit Margin", 6, `revenue-col-margin${state.columns.margin ? "" : " hidden"}`)}${headerCell("Actions", 7, `revenue-col-actions${state.columns.actions ? "" : " hidden"}`)}</tr></thead><tbody>${pageRows.length ? pageRows.map(tableRow).join("") : `<tr><td colspan="8" class="animus-revenue-empty">No matching job profitability rows.</td></tr>`}<tr class="animus-revenue-total"><td class="revenue-col-date${state.columns.date ? "" : " hidden"}"></td><td>Totals</td><td>${money(total.gross)}</td><td class="revenue-col-expenses${state.columns.expenses ? "" : " hidden"}"><span class="animus-revenue-money expenses">${money(total.expenses)}</span></td><td><span class="animus-revenue-money labor">${money(total.labor)}</span></td><td class="animus-revenue-money net ${toneForValue(total.profit)}">${money(total.profit)}</td><td class="revenue-col-margin${state.columns.margin ? "" : " hidden"} ${toneForValue(margin)}">${margin.toFixed(1)}%</td><td class="revenue-col-actions${state.columns.actions ? "" : " hidden"}"></td></tr></tbody></table></div>
        ${auditMarkup()}
        <footer class="animus-revenue-pagination"><span>Rows per page</span><select id="animusRevenuePerPage"><option ${state.perPage === 10 ? "selected" : ""}>10</option><option ${state.perPage === 25 ? "selected" : ""}>25</option><option ${state.perPage === 50 ? "selected" : ""}>50</option></select><span>${visibleRows.length ? `${start + 1}–${Math.min(start + state.perPage, visibleRows.length)} of ${visibleRows.length}` : "0 records"}</span><button data-revenue-page="prev" ${state.page === 1 ? "disabled" : ""}>‹</button>${Array.from({length:pageCount},(_,index) => index + 1).slice(0,5).map((number) => `<button data-revenue-page="${number}" class="${number === state.page ? "active" : ""}">${number}</button>`).join("")}<button data-revenue-page="next" ${state.page === pageCount ? "disabled" : ""}>›</button></footer>
      </section></section>`;
    bind();
  }
  function auditMarkup() { const recent = (crmRevenueRows || []).flatMap((row) => (row.revenueAudit || []).map((item) => ({...item, job:row.clientJob || "Work file"}))).sort((a,b) => String(b.at).localeCompare(String(a.at))).slice(0,1)[0]; return recent ? `<p class="animus-revenue-audit"><strong>Latest adjustment:</strong> ${safe(recent.job)} · ${safe(recent.field)} changed from ${safe(recent.from)} to ${safe(recent.to)} · ${new Date(recent.at).toLocaleString()} <button data-revenue-show-audit="${safe(recent.rowId || "")}">View audit</button></p>` : ""; }
  function bind() {
    document.querySelector("#animusRevenueSearch")?.addEventListener("input", (event) => { state.query = event.target.value; state.page = 1; render(); });
    document.querySelector("#animusRevenueDateRange")?.addEventListener("change", (event) => { crmRevenueYearFilter = event.target.value; state.page = 1; render(); });
    document.querySelector("#animusRevenueFilters")?.addEventListener("click", () => { state.filterOpen = !state.filterOpen; state.columnsOpen = false; render(); });
    document.querySelector("#animusRevenueColumns")?.addEventListener("click", () => { state.columnsOpen = !state.columnsOpen; state.filterOpen = false; render(); });
    document.querySelectorAll("[data-revenue-column]").forEach((input) => input.addEventListener("change", () => { state.columns[input.dataset.revenueColumn] = input.checked; render(); }));
    document.querySelector("#animusRevenueStatus")?.addEventListener("change", (event) => { state.status = event.target.value; state.page = 1; render(); });
    document.querySelector("#animusRevenueProject")?.addEventListener("change", (event) => { state.project = event.target.value; state.page = 1; render(); });
    document.querySelector("#animusRevenueClearFilters")?.addEventListener("click", () => { state.status = "all"; state.project = "all"; state.filterOpen = false; render(); });
    document.querySelector("#animusRevenueExport")?.addEventListener("click", exportCsv);
    document.querySelector("#animusAddRevenue")?.addEventListener("click", () => {
      if (typeof addRevenueRow === "function") addRevenueRow();
    });
    document.querySelectorAll("[data-revenue-edit]").forEach((button) => button.addEventListener("click", () => beginEdit(button.dataset.revenueEdit, button.dataset.revenueField)));
    document.querySelectorAll("[data-revenue-date-edit]").forEach((input) => input.addEventListener("change", () => saveDate(input.dataset.revenueDateEdit, input.value)));
    document.querySelectorAll("[data-revenue-inline-save]").forEach((button) => button.addEventListener("click", () => commitEdit(button.dataset.revenueInlineSave)));
    document.querySelector("[data-revenue-inline]")?.addEventListener("keydown", (event) => { if (event.key === "Enter") commitEdit(state.edit.id); if (event.key === "Escape") { state.edit = null; render(); } });
    document.querySelectorAll("[data-revenue-open-file]").forEach((button) => button.addEventListener("click", () => openFile(button.dataset.revenueOpenFile)));
    document.querySelectorAll("[data-revenue-expenses]").forEach((button) => button.addEventListener("click", () => typeof openRevenueExpenses === "function" && openRevenueExpenses(button.dataset.revenueExpenses)));
    document.querySelectorAll("[data-revenue-payroll]").forEach((button) => button.addEventListener("click", () => typeof openRevenuePayroll === "function" && openRevenuePayroll(button.dataset.revenuePayroll)));
    document.querySelectorAll("[data-revenue-actions]").forEach((button) => button.addEventListener("click", () => { state.action = state.action === button.dataset.revenueActions ? "" : button.dataset.revenueActions; render(); }));
    document.querySelectorAll("[data-revenue-export-row]").forEach((button) => button.addEventListener("click", () => exportCsv(button.dataset.revenueExportRow)));
    document.querySelectorAll("[data-revenue-delete]").forEach((button) => button.addEventListener("click", () => {
      state.action = "";
      if (typeof deleteRevenueRow === "function") deleteRevenueRow(button.dataset.revenueDelete);
    }));
    document.querySelectorAll("[data-revenue-page]").forEach((button) => button.addEventListener("click", () => { const target = button.dataset.revenuePage; state.page = target === "prev" ? Math.max(1,state.page - 1) : target === "next" ? state.page + 1 : Number(target); render(); }));
    document.querySelector("#animusRevenuePerPage")?.addEventListener("change", (event) => { state.perPage = Number(event.target.value); state.page = 1; render(); });
    document.querySelectorAll("[data-revenue-kpi-route]").forEach((card) => {
      const open = () => { if (typeof switchCrmView === "function") switchCrmView(card.dataset.revenueKpiRoute); };
      card.addEventListener("click", open);
      card.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); } });
    });
    bindColumnResizers();
  }
  function bindColumnResizers() {
    const table = document.querySelector(".animus-revenue-table");
    if (!table) return;
    document.querySelectorAll("[data-revenue-resize-column]").forEach((handle) => {
        handle.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const index = Number(handle.dataset.revenueResizeColumn);
        const col = table.querySelectorAll("col")[index];
        if (!col) return;
        const widths = columnWidths();
        const startX = event.clientX;
        const startWidth = Number.parseFloat(col.style.width) || widths[index] || DEFAULT_COLUMN_WIDTHS[index];
        document.body.classList.add("animus-revenue-resizing");
        const move = (moveEvent) => {
          const minimums = [88, 180, 102, 94, 94, 102, 94, 54];
          const nextWidth = Math.max(minimums[index] || 74, Math.round(startWidth + moveEvent.clientX - startX));
          widths[index] = nextWidth;
          col.style.width = `${nextWidth}px`;
        };
        const stop = () => {
          localStorage.setItem(COLUMN_STORAGE, JSON.stringify(widths));
          document.body.classList.remove("animus-revenue-resizing");
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", stop);
          window.removeEventListener("pointercancel", stop);
        };
        handle.setPointerCapture?.(event.pointerId);
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", stop);
        window.addEventListener("pointercancel", stop);
      });
    });
  }
  function openFile(rowId) { const row = (crmRevenueRows || []).find((item) => item.id === rowId); const file = row && typeof findFileForRevenue === "function" ? findFileForRevenue(row) : null; if (!file) return; activeFileId = file.id; if (typeof switchCrmView === "function") switchCrmView("files"); if (typeof renderCrm === "function") renderCrm(); }
  function beginEdit(rowId, field) { const row = (crmRevenueRows || []).find((item) => item.id === rowId); if (!row) return; const raw = field === "profit" ? profit(row) : field === "margin" ? (numeric(row.gross) ? (profit(row) / numeric(row.gross)) * 100 : 0) : numeric(row[field]); state.edit = { id:rowId, field, value:String(Number(raw.toFixed ? raw.toFixed(2) : raw)) }; state.action = ""; render(); window.setTimeout(() => { const input = document.querySelector("[data-revenue-inline]"); input?.focus(); input?.select(); },0); }
  function commitEdit(rowId) { const row = (crmRevenueRows || []).find((item) => item.id === rowId); const input = document.querySelector("[data-revenue-inline]"); if (!row || !input || !state.edit) return; const field = state.edit.field; const next = numeric(input.value); const original = field === "profit" ? profit(row) : field === "margin" ? (numeric(row.gross) ? (profit(row) / numeric(row.gross)) * 100 : 0) : numeric(row[field]); if (field === "profit") row.gross = next + numeric(row.expenses) + numeric(row.labor); else if (field === "margin") row.gross = next >= 100 ? numeric(row.gross) : (numeric(row.expenses) + numeric(row.labor)) / Math.max(.01, 1 - (next / 100)); else row[field] = next; row.profit = profit(row); if (field === "labor" && typeof window.syncRevenueLaborToFile === "function") window.syncRevenueLaborToFile(row); row.revenueAudit = Array.isArray(row.revenueAudit) ? row.revenueAudit : []; row.revenueAudit.unshift({ rowId:row.id, field, from:money(original), to: field === "margin" ? `${next.toFixed(1)}%` : money(next), at:new Date().toISOString(), by:"Owner" }); if (typeof saveRevenueRows === "function") saveRevenueRows(); state.edit = null; render(); window.animusSaveRevenueChangeToCloud?.("Revenue update saved to Cloudflare."); }
  function exportCsv(singleId = "") { const exportRows = singleId ? rows().filter((row) => row.id === singleId) : rows(); const header = ["Date","Job","Customer","Gross Earnings","Expenses","Labor","Net Profit","Profit Margin"]; const lines = exportRows.map((row) => { const file = typeof findFileForRevenue === "function" ? findFileForRevenue(row) : null; const margin = numeric(row.gross) ? (profit(row) / numeric(row.gross)) * 100 : 0; return [row.date || "",row.clientJob || "",file?.clientName || "",numeric(row.gross).toFixed(2),numeric(row.expenses).toFixed(2),numeric(row.labor).toFixed(2),profit(row).toFixed(2),margin.toFixed(1)]; }); const csv = [header,...lines].map((line) => line.map((value) => `"${String(value).replace(/"/g,'""')}"`).join(",")).join("\n"); const blob = new Blob([csv], { type:"text/csv" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "animus-job-profitability.csv"; link.click(); URL.revokeObjectURL(link.href); }
  function init() {
    if (typeof renderRevenue !== "function") return;
    originalRender = renderRevenue;
    renderRevenue = render;
    // The main Save button calls this before building its cloud snapshot, so
    // an active inline amount is included even without pressing Enter first.
    window.animusCommitPendingRevenueEdit = () => {
      if (state.edit?.id) commitEdit(state.edit.id);
    };
    render();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => window.setTimeout(init, 0)); else window.setTimeout(init, 0);
})();
