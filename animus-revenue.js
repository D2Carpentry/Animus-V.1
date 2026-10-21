/* ANIMUS Revenue center. It deliberately uses the original CRM rows and save helpers. */
(() => {
  const money = (value) => (typeof crmCurrency !== "undefined" ? crmCurrency : new Intl.NumberFormat("en-US", { style:"currency", currency:"USD" })).format(Number(value) || 0);
  const safe = (value) => typeof escapeHtml === "function" ? escapeHtml(value ?? "") : String(value ?? "").replace(/[&<>"]/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));
  const dateText = (value) => { const date = new Date(`${value || ""}T12:00:00`); return Number.isNaN(date.getTime()) ? "Date pending" : date.toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" }); };
  const numeric = (value) => typeof parseMoney === "function" ? parseMoney(value) : Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;
  const profit = (row) => typeof revenueProfit === "function" ? revenueProfit(row) : numeric(row.gross) - numeric(row.expenses) - numeric(row.labor);
  const state = { query:"", status:"all", project:"all", profitability:"all", from:"", to:"", period:"monthly", sort:"date", direction:-1, selected:new Set(), allTypes:false, columns:{ date:true, customer:true, type:true, margin:true, expenses:true, actions:true }, page:1, perPage:10, action:"", filterOpen:false, columnsOpen:false };
  const COLUMN_STORAGE = "animus-profitability-column-widths-v4-dashboard";
  const DEFAULT_COLUMN_WIDTHS = [40, 110, 160, 125, 105, 106, 100, 90, 100, 98, 50];
  const columnNames = ["select","date","job","customer","type","gross","expenses","labor","profit","margin","actions"];
  let originalRender = null;

  function rows(year = crmRevenueYearFilter) {
    const all = Array.isArray(crmRevenueRows) ? [...crmRevenueRows] : [];
    return all.filter((row) => {
      const file = typeof findFileForRevenue === "function" ? findFileForRevenue(row) : null;
      const text = `${row.clientJob || ""} ${row.fileNumber || ""} ${file?.clientName || ""} ${file?.projectAddress || ""}`.toLowerCase();
      const queryMatch = !state.query || text.includes(state.query.toLowerCase());
      const statusMatch = state.status === "all" || file?.fileStatus === state.status;
      const projectMatch = state.project === "all" || (file?.projectType || "Unclassified") === state.project;
      const yearMatch = !year || year === "all" || (typeof revenueYear === "function" ? revenueYear(row) : dateInputValue(row.date).slice(0,4)) === String(year);
      const date = dateInputValue(row.date);
      const rangeMatch = (!state.from || date >= state.from) && (!state.to || date <= state.to);
      const profitMatch = state.profitability === "all" || (state.profitability === "positive" ? profit(row) > 0 : state.profitability === "negative" ? profit(row) < 0 : profit(row) === 0);
      return queryMatch && statusMatch && projectMatch && yearMatch && rangeMatch && profitMatch;
    }).sort((a,b) => {
      const value = row => { const file = typeof findFileForRevenue === "function" ? findFileForRevenue(row) : null; return state.sort === "date" ? dateInputValue(row.date) : state.sort === "customer" ? file?.clientName || row.clientName || row.clientJob || "" : state.sort === "type" ? file?.projectType || "" : state.sort === "job" ? row.clientJob || "" : state.sort === "profit" ? profit(row) : state.sort === "margin" ? numeric(row.gross) ? profit(row)/numeric(row.gross) : -Infinity : numeric(row[state.sort]); };
      const av=value(a), bv=value(b);
      return state.direction * (typeof av === "string" ? av.localeCompare(bv) : av === bv ? 0 : av > bv ? 1 : -1);
    });
  }
  function totals(list) { return list.reduce((sum,row) => ({ gross:sum.gross + numeric(row.gross), expenses:sum.expenses + numeric(row.expenses), labor:sum.labor + numeric(row.labor), profit:sum.profit + profit(row) }), { gross:0, expenses:0, labor:0, profit:0 }); }
  function toneForValue(value) { const amount = numeric(value); return amount < 0 ? "is-negative" : amount === 0 ? "is-zero" : ""; }
  const KPI_ROUTES = { gross:"business", expenses:"expenses", labor:"payroll", profit:"business", margin:"business" };
  function kpi(icon, tone, title, value, note, field, valueTone = "") {
    const route = KPI_ROUTES[field] || "";
    return `<article class="animus-revenue-kpi ${route ? "is-clickable" : ""}" ${route ? `role="button" tabindex="0" data-revenue-kpi-route="${route}"` : ""}><span class="animus-revenue-kpi-icon ${tone}">${icon}</span><div><small>${title}</small><strong class="${valueTone}">${value}</strong><em>${note}</em></div></article>`;
  }
  function dateOptions() { const values = [...new Set([...((crmRevenueRows || []).map((row) => typeof revenueYear === "function" ? revenueYear(row) : dateInputValue(row.date).slice(0,4)).filter(Boolean)),String(new Date().getFullYear())])].sort().reverse(); return `<option value="all" ${crmRevenueYearFilter === "all" ? "selected" : ""}>All dates</option>${values.map((value) => `<option value="${safe(value)}" ${String(crmRevenueYearFilter) === value ? "selected" : ""}>${safe(value)}</option>`).join("")}`; }
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
      let saved = JSON.parse(localStorage.getItem(COLUMN_STORAGE) || "null");
      if (!saved) {
        const old=JSON.parse(localStorage.getItem("animus-profitability-column-widths-v3-compact")||"[]");
        saved=[40,old[0],old[1],165,135,...old.slice(2)];
      }
      return DEFAULT_COLUMN_WIDTHS.map((width, index) => Math.max(index===0?40:50, Number(saved[index]) || width));
    } catch {
      return [...DEFAULT_COLUMN_WIDTHS];
    }
  }
  function columnGroupMarkup() {
    return `<colgroup data-animus-revenue-cols>${columnWidths().map((width,index) => `<col style="width:${width}px" ${state.columns[columnNames[index]] === false ? 'class="hidden"' : ""}>`).join("")}</colgroup>`;
  }
  function resizeHandle(index, label) {
    if (index >= DEFAULT_COLUMN_WIDTHS.length - 1) return "";
    return `<button class="animus-revenue-column-resizer" data-revenue-resize-column="${index}" aria-label="Resize ${safe(label)} column" type="button"></button>`;
  }
  function headerCell(label, index, className = "") {
    const key = columnNames[index];
    return `<th class="${className}" data-animus-revenue-column="${index}" ${!["select","actions"].includes(key) ? `aria-sort="${state.sort === key ? state.direction === 1 ? "ascending" : "descending" : "none"}"` : ""}>${index === 0 ? '<input type="checkbox" id="revenueSelectPage" aria-label="Select this page">' : index === 10 ? safe(label) : `<button data-revenue-sort="${key}">${safe(label)}${state.sort === key ? state.direction === 1 ? " ↑" : " ↓" : ""}</button>`}${resizeHandle(index, label)}</th>`;
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
    window.animusSaveRevenueChangeToCloud?.("Revenue date saved to Cloudflare.", null, row.id, "date");
  }
  function tableRow(row) {
    const file = typeof findFileForRevenue === "function" ? findFileForRevenue(row) : null;
    const customer = file?.clientName || row.clientName || String(row.clientJob || "").replace(/\s*[-·]\s*(?:26-)?A-?\d+.*$/i, "").trim() || "Unlinked file";
    const margin = numeric(row.gross) ? (profit(row) / numeric(row.gross)) * 100 : 0;
    const visible = (name) => state.columns[name] ? "" : " hidden";
    return `<tr data-revenue-row="${safe(row.id)}">
      <td><input type="checkbox" data-revenue-select="${safe(row.id)}" aria-label="Select ${safe(customer)}" ${state.selected.has(row.id) ? "checked" : ""}></td>
      <td class="revenue-col-date${visible("date")}"><input class="animus-revenue-date-input" type="date" value="${safe(dateInputValue(row.date))}" data-revenue-date-edit="${safe(row.id)}" aria-label="Edit revenue date" title="${safe(dateText(row.date))}"></td>
      <td><button class="animus-revenue-job" data-revenue-open-file="${safe(row.id)}" title="${safe(row.clientJob || customer)}">${safe(row.clientJob || customer)}</button></td>
      <td class="${visible("customer")}"><button class="animus-revenue-job" data-revenue-open-file="${safe(row.id)}">${safe(customer)}</button></td>
      <td class="${visible("type")}"><button class="revenue-type-badge" data-revenue-type="${safe(file?.projectType || "Unclassified")}">${safe(file?.projectType || "Unclassified")}</button></td>
      <td>${moneyCell(row,"gross",money(row.gross),"")}</td>
      <td class="revenue-col-expenses${visible("expenses")}">${moneyCell(row,"expenses",money(row.expenses),"expenses")}</td>
      <td>${moneyCell(row,"labor",money(row.labor),"labor")}</td>
      <td>${moneyCell(row,"profit",money(profit(row)),`net ${toneForValue(profit(row))}`,true)}</td>
      <td class="revenue-col-margin${visible("margin")}">${moneyCell(row,"margin",numeric(row.gross) ? `${margin.toFixed(1)}%` : "—",`net ${toneForValue(margin)}`,true)}</td>
      <td class="revenue-col-actions${visible("actions")}"><div class="animus-revenue-actions"><button data-revenue-actions="${safe(row.id)}" aria-label="More actions">⋯</button>${state.action === row.id ? actionMenu(row) : ""}</div></td>
    </tr>`;
  }
  function moneyCell(row, field, formatted, className, calculated = false) {
    if (state.edit?.id === row.id && state.edit.field === field) return `<div class="animus-revenue-money ${className}"><input data-revenue-inline value="${safe(state.edit.value)}" inputmode="decimal" aria-label="Edit ${field}"><button data-revenue-inline-save="${safe(row.id)}" title="Save">✓</button></div>`;
    return `<div class="animus-revenue-money ${className}"><button class="revenue-value" data-revenue-edit="${safe(row.id)}" data-revenue-field="${field}" aria-label="Edit ${field}: ${safe(formatted)}">${formatted}</button></div>`;
  }
  function actionMenu(row) { return `<div class="animus-revenue-action-menu"><button data-revenue-open-file="${safe(row.id)}">Open work file</button><button data-revenue-expenses="${safe(row.id)}">Open expenses</button><button data-revenue-payroll="${safe(row.id)}">Open payroll</button><button data-revenue-export-row="${safe(row.id)}">Export job profitability</button><button class="animus-revenue-delete" data-revenue-delete="${safe(row.id)}">Delete revenue row</button></div>`; }
  function renderTableBase() {
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
  }
  function periodLabel(key) {
    if (/^\d{4}-\d{2}$/.test(key)) return new Date(`${key}-01T12:00:00`).toLocaleDateString("en-US", {month:"short",year:"numeric"});
    return key;
  }
  function analysis(list) { return AnimusRevenueAnalytics.analyze(list, {fileFor:row => typeof findFileForRevenue === "function" ? findFileForRevenue(row) : null, dateFor:row=>dateInputValue(row.date), getProfit:profit, period:state.period}); }
  function comparison(field, total) {
    const year = Number(crmRevenueYearFilter);
    if (!Number.isFinite(year) || !year || state.from || state.to) return "Selected period";
    const previous = rows(String(year-1));
    if (!previous.length) return "No prior-year comparison";
    const old = analysis(previous).total[field];
    if (old == null || !old || total == null) return "Comparison unavailable";
    const delta = field === "margin" ? total-old : (total-old)/Math.abs(old)*100;
    return `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}${field === "margin" ? " pts" : "%"} vs ${year-1}`;
  }
  function trendMarkup(data) {
    const points = data.periods;
    const upper = Math.max(1,...points.flatMap(p=>[p.gross,p.profit])), lower=Math.min(0,...points.flatMap(p=>[p.gross,p.profit]));
    const width = Math.max(480,points.length*48), scale=133/(upper-lower), bottom=25+upper*scale;
    const step=(width-32)/Math.max(1,points.length), x=i=>16+step*(i+.5);
    const marginY = value => 91.5 - Math.max(-100,Math.min(100,value ?? 0))*.665;
    let connected=false;
    const path=points.map((p,i)=>{if(p.margin==null){connected=false;return "";}const segment=`${connected?"L":"M"}${x(i)},${marginY(p.margin)}`;connected=true;return segment;}).join(" ");
    return `<section class="revenue-panel revenue-trend"><header><h2>Revenue &amp; Profit</h2><select id="revenuePeriod" aria-label="Chart period">${["monthly","quarterly","yearly"].map(p=>`<option value="${p}" ${state.period===p?"selected":""}>${p[0].toUpperCase()+p.slice(1)}</option>`).join("")}</select></header><div class="revenue-legend"><span class="gross">Gross earnings</span><span class="profit">Job profit</span><span class="margin">Margin (−100 to 100%)</span></div>${!points.length ? '<p class="revenue-empty">No revenue in this period.</p>' : `<div class="revenue-trend-scroll"><svg viewBox="0 0 ${width} 200" style="min-width:${width}px" role="img" aria-label="Revenue and profit trend. Exact values follow below."><line x1="0" y1="${bottom}" x2="${width}" y2="${bottom}" stroke="currentColor" opacity=".2"/>${points.map((p,i)=>`<rect x="${x(i)-17}" y="${p.gross>=0?bottom-p.gross*scale:bottom}" width="14" height="${Math.abs(p.gross)*scale}" fill="#4f86ed"/><rect x="${x(i)+2}" y="${p.profit>=0?bottom-p.profit*scale:bottom}" width="14" height="${Math.abs(p.profit)*scale}" fill="#3eb59b"/><text x="${x(i)}" y="194" text-anchor="middle" fill="currentColor" font-size="10">${safe(periodLabel(p.name))}</text>`).join("")}<path d="${path}" fill="none" stroke="#c69c55" stroke-width="2"/>${points.map((p,i)=>`<circle cx="${x(i)}" cy="${marginY(p.margin)}" r="3" fill="#c69c55"/>`).join("")}</svg></div><div class="revenue-period-details">${points.map(p=>`<details><summary>${safe(periodLabel(p.name))}</summary><dl><dt>Gross</dt><dd>${money(p.gross)}</dd><dt>Profit</dt><dd>${money(p.profit)}</dd><dt>Margin</dt><dd>${p.margin==null?"—":p.margin.toFixed(1)+"%"}</dd></dl></details>`).join("")}</div>`}</section>`;
  }
  function costsMarkup(data) {
    const colors=["#9b7be3","#4f86ed","#3eb59b","#c69c55","#dd7f89","#7ea7af"];
    let cursor=0;
    const valid=data.costTotal>0 && data.costs.every(c=>c.value>=0);
    const stops=data.costs.map((c,i)=>{const start=cursor;cursor+=valid?c.value/data.costTotal*100:0;return `${colors[i%colors.length]} ${start}% ${cursor}%`;});
    return `<section class="revenue-panel"><header><h2>Cost Breakdown</h2></header><div class="revenue-donut" style="background:${valid?`conic-gradient(${stops.join(",")})`:"var(--rv-border)"}"><div><small>Expenses + labor</small><strong>${money(data.costTotal)}</strong></div></div><ul class="revenue-cost-list">${data.costs.map((c,i)=>`<li><span><i style="background:${colors[i%colors.length]}"></i>${safe(c.name)}</span><b>${money(c.value)}</b><small>${data.costTotal? (c.value/data.costTotal*100).toFixed(1)+"%":"—"}</small></li>`).join("") || '<li>No recorded costs</li>'}</ul>${valid?"":'<p class="revenue-muted">No positive cost distribution, or signed adjustments present.</p>'}</section>`;
  }
  function typesMarkup(data) {
    return `<section class="revenue-panel"><header><h2>Project Margins</h2><button id="revenueAllTypes">${state.allTypes?"Show less":"View all"}</button></header><div class="revenue-types">${(state.allTypes?data.types:data.types.slice(0,5)).map(type=>`<button data-revenue-type="${safe(type.name)}"><span>${safe(type.name)}</span><b class="${type.margin<0?"is-negative":""}">${type.margin==null?"—":type.margin.toFixed(1)+"%"}</b><span class="revenue-bar-track"><i style="width:${Math.min(100,Math.abs(type.margin||0))}%;background:${type.margin<0?"#df7180":"#3eb59b"}"></i></span></button>`).join("") || '<p class="revenue-empty">No matching projects.</p>'}</div></section>`;
  }
  function insightsMarkup(data) {
    const month=data.months[0], low=[...data.types].filter(t=>t.margin!=null).sort((a,b)=>a.margin-b.margin)[0], customer=data.customers[0];
    const goal=window.animusReadCompanyPreferences?.().marginGoal;
    const item=(label,value,note)=>`<article class="revenue-insight"><small>${label}</small><strong>${safe(value)}</strong><span>${safe(note)}</span></article>`;
    return `<section class="revenue-insights">${item("Most Profitable Month",month?periodLabel(month.name):"No dated records",month?money(month.profit):"—")}${item("Lowest Margin",low?.name||"No project margins",low?`${low.margin.toFixed(1)}% margin`:"—")}${item("Top Customer",customer?.name||"No customers",customer?`${money(customer.profit)} profit`:"—")}<article class="revenue-insight"><small>Margin Goal</small><strong>${goal==null?"Not set":`${Number(goal).toFixed(1)}%`}</strong><button id="revenueEditGoal">Edit Goals</button></article></section>`;
  }
  function render() {
    const focused=document.activeElement, focusId=focused?.id, cursor=focused?.selectionStart;
    const inline=document.querySelector("[data-revenue-inline]");
    if (state.edit && inline) state.edit.value=inline.value;
    renderTableBase();
    const view=document.querySelector("#crmRevenueView"); if(!view)return;
    view.querySelector(".animus-revenue-center").classList.add("revenue-dashboard");
    const list=rows(), data=analysis(list), total=data.total;
    view.querySelector(".animus-revenue-head p").textContent="Track profitability across all workfiles, customers, and project types.";
    const search=view.querySelector(".animus-revenue-search");
    search?.querySelector("input")?.setAttribute("aria-label","Search jobs or customers");
    view.querySelector(".animus-revenue-tools").prepend(search);
    view.querySelector("#animusRevenueFilters").textContent="Filters";
    view.querySelector("#animusRevenueExport").textContent="Export";
    view.querySelector(".animus-revenue-kpis").innerHTML=[["gross","Total Gross Earnings","green"],["expenses","Total Expenses","violet"],["labor","Total Labor","blue"],["profit","Job Profit","green"],["margin","Profit Margin","amber"]].map(([key,label,tone])=>kpi("",tone,label,key==="margin"?total.margin==null?"—":`${total.margin.toFixed(1)}%`:money(total[key]),comparison(key,total[key]),key,toneForValue(total[key]))).join("");
    view.querySelector(".animus-revenue-kpis").insertAdjacentHTML("afterend",`<section class="revenue-analytics">${trendMarkup(data)}${costsMarkup(data)}${typesMarkup(data)}</section>${insightsMarkup(data)}`);
    const bars=view.querySelectorAll(".revenue-trend rect");
    data.periods.forEach((point,index)=>{
      if(point.margin==null)view.querySelectorAll(".revenue-trend circle")[index]?.setAttribute("visibility","hidden");
      const description=`${periodLabel(point.name)}: Gross ${money(point.gross)}, Profit ${money(point.profit)}, Margin ${point.margin==null?"not available":point.margin.toFixed(1)+"%"}`;
      for(const bar of [bars[index*2],bars[index*2+1]])if(bar){const title=document.createElementNS("http://www.w3.org/2000/svg","title");title.textContent=description;bar.append(title);}
    });
    const chart=view.querySelector(".revenue-trend svg");
    if(chart){const axis=document.createElementNS("http://www.w3.org/2000/svg","text");axis.setAttribute("x","16");axis.setAttribute("y","14");axis.setAttribute("fill","currentColor");axis.setAttribute("font-size","10");axis.textContent=`Scale: ${money(Math.max(0,...data.periods.flatMap(p=>[p.gross,p.profit])))} maximum`;chart.append(axis);}
    const filter=view.querySelector(".animus-revenue-filter-menu");
    filter?.insertAdjacentHTML("afterbegin",`<label>Profitability<select id="revenueProfitFilter">${[["all","All margins"],["positive","Profitable"],["negative","Loss-making"],["zero","Break-even"]].map(([key,label])=>`<option value="${key}" ${key===state.profitability?"selected":""}>${label}</option>`).join("")}</select></label><label>From<input type="date" id="revenueFrom" value="${safe(state.from)}"></label><label>Through<input type="date" id="revenueTo" value="${safe(state.to)}"></label>`);
    const table=view.querySelector("table"), labels=["","Date","File Name (Job)","Customer","Type","Gross Earnings","Expenses","Labor","Net Profit","Profit Margin","Actions"];
    table.querySelector("thead tr").innerHTML=labels.map((label,index)=>headerCell(label,index,state.columns[columnNames[index]]===false?"hidden":"")).join("");
    table.querySelector(".animus-revenue-total").innerHTML=columnNames.map((key,index)=>`<td class="${state.columns[key]===false?"hidden":""}">${index===2?"Filtered totals":["gross","expenses","labor","profit"].includes(key)?money(total[key]):key==="margin"?total.margin==null?"—":`${total.margin.toFixed(1)}%`:""}</td>`).join("");
    table.querySelector(".animus-revenue-empty")?.setAttribute("colspan","11");
    view.querySelector(".animus-revenue-card-head p").textContent=state.edit?"Unsaved amount. Save or press Enter to apply.":`${list.length} records${state.project!=="all"?` · ${state.project}`:""}`;
    const columns=view.querySelector(".animus-revenue-columns-menu");
    if(columns)columns.innerHTML=Object.entries({date:"Date",customer:"Customer",type:"Type",expenses:"Expenses",margin:"Profit Margin",actions:"Actions"}).map(([key,label])=>`<label><input type="checkbox" data-revenue-column="${key}" ${state.columns[key]?"checked":""}>${label}</label>`).join("");
    const pageCount=Math.max(1,Math.ceil(list.length/state.perPage));
    view.querySelectorAll('[data-revenue-page]:not([data-revenue-page="prev"]):not([data-revenue-page="next"])').forEach(button=>button.remove());
    view.querySelector('[data-revenue-page="next"]').insertAdjacentHTML("beforebegin",Array.from({length:Math.min(5,pageCount)},(_,i)=>Math.max(1,Math.min(state.page-2,pageCount-4))+i).map(page=>`<button data-revenue-page="${page}" class="${page===state.page?"active":""}">${page}</button>`).join(""));
    const selectedCount=list.filter(row=>state.selected.has(row.id)).length;
    if(selectedCount)view.querySelector(".animus-revenue-table-tools").insertAdjacentHTML("afterbegin",`<button id="revenueExportSelected">Export selected (${selectedCount})</button>`);
    const filterCount=[state.status!=="all",state.project!=="all",state.profitability!=="all",!!state.from,!!state.to].filter(Boolean).length;
    for(const [selector,icon,label] of [["#animusRevenueFilters","sliders-horizontal",`Filters${filterCount?` (${filterCount})`:""}`],["#animusRevenueExport","download","Export"],["#animusAddRevenue","plus","Add Revenue"],["#animusRevenueColumns","columns-3","Columns"]]){
      const button=view.querySelector(selector);if(button)button.innerHTML=`<i data-revenue-icon="${icon}" aria-hidden="true"></i>${label}`;
    }
    search?.childNodes.forEach(node=>{if(node.nodeType===3)node.textContent="";});search?.insertAdjacentHTML("afterbegin",'<i data-revenue-icon="search" aria-hidden="true"></i>');
    view.querySelectorAll("[data-revenue-actions]").forEach(button=>button.innerHTML='<i data-revenue-icon="ellipsis" aria-hidden="true"></i>');
    view.querySelectorAll("[data-revenue-inline-save]").forEach(button=>{button.setAttribute("aria-label","Save amount");button.innerHTML='<i data-revenue-icon="check" aria-hidden="true"></i>';});
    window.renderAnimusRevenueIcons?.();
    bind(); bindDashboard();
    if(focusId && focused?.tagName==="INPUT") {const input=document.getElementById(focusId);input?.focus({preventScroll:true});if(input && typeof cursor==="number" && input.type!=="date")input.setSelectionRange(cursor,cursor);}
  }
  function bindDashboard() {
    document.querySelector("#revenuePeriod")?.addEventListener("change",event=>{state.period=event.target.value;render();});
    document.querySelector("#revenueAllTypes")?.addEventListener("click",()=>{state.allTypes=!state.allTypes;render();});
    document.querySelectorAll("[data-revenue-type]").forEach(button=>button.addEventListener("click",()=>{state.project=state.project===button.dataset.revenueType?"all":button.dataset.revenueType;state.page=1;render();}));
    document.querySelectorAll("[data-revenue-sort]").forEach(button=>button.addEventListener("click",()=>{const key=button.dataset.revenueSort;state.direction=state.sort===key?-state.direction:1;state.sort=key;render();}));
    for(const [id,key] of [["revenueFrom","from"],["revenueTo","to"],["revenueProfitFilter","profitability"]])document.getElementById(id)?.addEventListener("change",event=>{state[key]=event.target.value;state.page=1;render();});
    document.querySelectorAll("[data-revenue-select]").forEach(input=>input.addEventListener("change",()=>{if(input.checked)state.selected.add(input.dataset.revenueSelect);else state.selected.delete(input.dataset.revenueSelect);render();}));
    const checks=[...document.querySelectorAll("[data-revenue-select]")], select=document.querySelector("#revenueSelectPage");
    if(select){select.checked=checks.length>0&&checks.every(c=>c.checked);select.indeterminate=checks.some(c=>c.checked)&&!select.checked;select.addEventListener("change",()=>{for(const check of checks){if(select.checked)state.selected.add(check.dataset.revenueSelect);else state.selected.delete(check.dataset.revenueSelect);}render();});}
    document.querySelector("#revenueExportSelected")?.addEventListener("click",()=>exportCsv("",true));
    document.querySelector("#revenueEditGoal")?.addEventListener("click",openGoal);
    // Accessible tooltip: the same exact figures appear on focus, touch, or hover.
    document.querySelectorAll(".revenue-period-details details").forEach(detail=>{detail.addEventListener("pointerenter",()=>{if(matchMedia("(hover:hover)").matches)detail.open=true;});detail.addEventListener("pointerleave",()=>{if(!detail.contains(document.activeElement))detail.open=false;});});
    document.querySelector("[data-revenue-show-audit]")?.addEventListener("click",()=>{const entries=rows().flatMap(row=>(row.revenueAudit||[]).map(item=>({...item,job:row.clientJob}))).sort((a,b)=>String(b.at).localeCompare(String(a.at)));showDialog("Revenue Activity",`<div class="revenue-audit-list">${entries.slice(0,100).map(item=>`<p><b>${safe(item.job)}</b><br>${safe(item.field)}: ${safe(item.from)} → ${safe(item.to)}<br><small>${safe(item.at)}</small></p>`).join("")||"No adjustments."}</div>`);});
  }
  function showDialog(title,body) {
    const previous=document.activeElement;
    document.getElementById("revenueDialog")?.remove();
    document.body.insertAdjacentHTML("beforeend",`<dialog id="revenueDialog" class="revenue-dialog"><form method="dialog"><header><h2>${safe(title)}</h2><button aria-label="Close">×</button></header></form>${body}</dialog>`);
    const dialog=document.getElementById("revenueDialog");dialog.addEventListener("close",()=>{dialog.remove();previous?.focus({preventScroll:true});});dialog.showModal();return dialog;
  }
  function openGoal() {
    const goal=window.animusReadCompanyPreferences?.().marginGoal;
    const dialog=showDialog("Margin Goal",`<form id="revenueGoalForm"><label>Target margin (%)<input name="goal" type="number" min="0" max="100" step="0.1" required value="${safe(goal??"")}"></label><p class="revenue-muted">Saved in company preferences on this device.</p><p role="alert" id="revenueGoalError"></p><button class="primary">Save goal</button></form>`);
    dialog.querySelector("#revenueGoalForm").addEventListener("submit",event=>{event.preventDefault();try{if(!window.animusSetMarginGoal)throw Error("Company preferences are unavailable.");window.animusSetMarginGoal(new FormData(event.target).get("goal"));dialog.close();render();}catch(error){dialog.querySelector("#revenueGoalError").textContent=error.message;}});
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
    document.querySelector("#animusRevenueClearFilters")?.addEventListener("click", () => { state.status = "all"; state.project = "all"; state.profitability="all"; state.from=""; state.to=""; state.filterOpen = false; state.page=1; render(); });
    document.querySelector("#animusRevenueExport")?.addEventListener("click", () => exportCsv());
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
        handle.addEventListener("keydown",event=>{
          if(!["ArrowLeft","ArrowRight"].includes(event.key))return;
          event.preventDefault();const index=Number(handle.dataset.revenueResizeColumn),widths=columnWidths();widths[index]=Math.max(index===0?40:100,widths[index]+(event.key==="ArrowRight"?16:-16));try{localStorage.setItem(COLUMN_STORAGE,JSON.stringify(widths));}catch{}render();document.querySelector(`[data-revenue-resize-column="${index}"]`)?.focus({preventScroll:true});
        });
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
          const minimums = [40, 118, 140, 130, 100, 108, 100, 100, 108, 100, 54];
          const nextWidth = Math.max(minimums[index] || 74, Math.round(startWidth + moveEvent.clientX - startX));
          widths[index] = nextWidth;
          col.style.width = `${nextWidth}px`;
        };
        const stop = () => {
          try { localStorage.setItem(COLUMN_STORAGE, JSON.stringify(widths)); } catch {}
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
  function beginEdit(rowId, field) { if(state.edit?.id)commitEdit(state.edit.id); const row = (crmRevenueRows || []).find((item) => item.id === rowId); if (!row) return; const raw = field === "profit" ? profit(row) : field === "margin" ? (numeric(row.gross) ? (profit(row) / numeric(row.gross)) * 100 : 0) : numeric(row[field]); state.edit = { id:rowId, field, value:String(Number(raw.toFixed ? raw.toFixed(2) : raw)) }; state.action = ""; render(); window.setTimeout(() => { const input = document.querySelector("[data-revenue-inline]"); input?.focus(); input?.select(); },0); }
  function commitEdit(rowId) {
    const row = (crmRevenueRows || []).find((item) => item.id === rowId);
    const input = document.querySelector("[data-revenue-inline]");
    if (!row || !input || !state.edit) return;
    const field = state.edit.field;
    const next = numeric(input.value);
    const original = field === "profit" ? profit(row) : field === "margin" ? (numeric(row.gross) ? (profit(row) / numeric(row.gross)) * 100 : 0) : numeric(row[field]);
    if (field === "profit") row.gross = next + numeric(row.expenses) + numeric(row.labor);
    else if (field === "margin") row.gross = next >= 100 ? numeric(row.gross) : (numeric(row.expenses) + numeric(row.labor)) / Math.max(.01, 1 - (next / 100));
    else row[field] = next;
    if (["gross", "profit", "margin"].includes(field)) row.grossOverride = true;
    row.profit = profit(row);
    const linkedFile = field === "labor" && typeof window.syncRevenueLaborToFile === "function" ? window.syncRevenueLaborToFile(row) : null;
    row.revenueAudit = Array.isArray(row.revenueAudit) ? row.revenueAudit : [];
    row.revenueAudit.unshift({ rowId:row.id, field, from:money(original), to: field === "margin" ? `${next.toFixed(1)}%` : money(next), at:new Date().toISOString(), by:"Owner" });
    if (typeof saveRevenueRows === "function") saveRevenueRows();
    state.edit = null;
    render();
    window.animusSaveRevenueChangeToCloud?.("Revenue update saved to Cloudflare.", linkedFile, row.id, field);
  }
  function exportCsv(singleId = "", selectedOnly = false) {
    const exportRows = rows().filter(row=>(!singleId || row.id===singleId)&&(!selectedOnly || state.selected.has(row.id)));
    const header = ["Date","Job","Customer","Type","Gross Earnings","Expenses","Labor","Net Profit","Profit Margin"];
    const lines = exportRows.map(row => {
      const file=typeof findFileForRevenue === "function" ? findFileForRevenue(row) : null;
      return [row.date||"",row.clientJob||"",file?.clientName||row.clientName||"",file?.projectType||"Unclassified",...['gross','expenses','labor'].map(key=>numeric(row[key]).toFixed(2)),profit(row).toFixed(2),numeric(row.gross)?(profit(row)/numeric(row.gross)*100).toFixed(1):""];
    });
    const csv=[header,...lines].map(line=>line.map(value=>`"${String(value).replace(/^[=+@\t\r]/,"'$&").replace(/"/g,'""')}"`).join(",")).join("\n");
    const link=document.createElement("a");link.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));link.download="animus-job-profitability.csv";link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);
  }
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
