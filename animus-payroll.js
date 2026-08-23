/* Modern Payroll workspace built on the existing ANIMUS payroll ledger. */
(() => {
  const state = { tab: "weekly", query: "", status: "all", group: "none", filterOpen: false };
  const money = (value) => (typeof crmCurrency !== "undefined" ? crmCurrency : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })).format(Number(value) || 0);
  const safe = (value) => typeof escapeHtml === "function" ? escapeHtml(value ?? "") : String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[character]));
  const numeric = (value) => typeof parseMoney === "function" ? parseMoney(value) : Number(value) || 0;
  const rowTotal = (row) => typeof payrollRowTotal === "function" ? payrollRowTotal(row) : numeric(row.total) || numeric(row.hours) * numeric(row.rate);
  const initials = (name) => String(name || "?").trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const dateLabel = (value) => { const date = new Date(value || ""); return Number.isNaN(date) ? "Current period" : date.toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" }); };
  const workingRows = () => (Array.isArray(crmPayrollRows) ? crmPayrollRows : []).filter((row) => {
    const text = `${row.employee || ""} ${row.role || ""} ${row.clientJob || ""} ${row.fileNumber || ""}`.toLowerCase();
    return (!state.query || text.includes(state.query.toLowerCase())) && (state.status === "all" || row.status === state.status);
  });
  const totals = (rows) => rows.reduce((total, row) => {
    const hours = numeric(row.hours);
    const pay = rowTotal(row);
    total.hours += hours;
    total.pay += pay;
    total.paid += row.status === "Paid" ? pay : 0;
    return total;
  }, { hours:0, pay:0, paid:0 });
  const averageRate = (rows) => { const hours = rows.reduce((sum, row) => sum + numeric(row.hours), 0); return hours ? rows.reduce((sum, row) => sum + rowTotal(row), 0) / hours : 0; };
  const roleColor = (role) => { const label = String(role || "").toLowerCase(); if (label.includes("paint")) return "violet"; if (label.includes("manage") || label.includes("estim")) return "amber"; if (label.includes("labor") || label.includes("helper")) return "green"; return "blue"; };
  const iconCard = (icon, tone, label, value, note) => `<article class="animus-payroll-kpi"><span class="animus-payroll-kpi-icon ${tone}">${icon}</span><div><small>${label}</small><strong>${value}</strong><em>${note}</em></div></article>`;
  const employeeInput = (selected = "") => {
    const names = [...new Set((crmPayrollRows || []).map((row) => row.employee).filter(Boolean))];
    return `<input id="animusPayEmployee" list="animusPayrollEmployees" value="${safe(selected)}" placeholder="Employee name"><datalist id="animusPayrollEmployees">${names.map((name) => `<option value="${safe(name)}">`).join("")}</datalist>`;
  };
  const fileOptions = (selected = "") => {
    const files = Array.isArray(crmFiles) ? crmFiles : [];
    return `<option value="">No work file linked</option>${files.map((file) => `<option value="${safe(file.id)}" ${file.id === selected ? "selected" : ""}>${safe(file.clientName || "Unnamed")} · ${safe(file.fileNumber || "No #")}</option>`).join("")}`;
  };
  function render() {
    const view = document.querySelector("#crmPayrollView");
    if (!view) return;
    const rows = workingRows().sort((a,b) => String(b.date || "").localeCompare(String(a.date || "")));
    const summary = totals(rows);
    const allRows = Array.isArray(crmPayrollRows) ? crmPayrollRows : [];
    const allocatedJobs = new Set(rows.map((row) => row.fileId || row.fileNumber || row.clientJob).filter(Boolean)).size;
    const ytd = allRows.filter((row) => String(row.date || "").startsWith(String(new Date().getFullYear()))).reduce((sum,row) => sum + rowTotal(row), 0);
    const roleTotals = rows.reduce((map,row) => { const name=row.role || "Unassigned"; map[name]=(map[name]||0)+rowTotal(row); return map; }, {});
    const greatest = Math.max(...Object.values(roleTotals), 1);
    view.innerHTML = `<section class="animus-payroll-center">
      <header class="animus-payroll-head"><div><h1>Payroll</h1><p>Manage employee pay, hours, and work-file allocations.</p></div><div class="animus-payroll-head-actions"><select id="animusPayrollPeriod"><option>Current payroll</option><option>All saved payroll</option></select><button id="animusPayrollFilters">⌕ Filters</button><button class="primary" id="animusPayrollAdd">＋ Add Employee Pay</button></div></header>
      <section class="animus-payroll-kpis">${iconCard("♙","blue","Total Payroll",money(summary.pay),"Current view")}${iconCard("◷","green","Total Hours",summary.hours.toFixed(2),"Current view")}${iconCard("$","amber","Avg. Hourly Rate",money(averageRate(rows)),"Based on entered hours")}${iconCard("▱","violet","Jobs Allocated",String(allocatedJobs),"Linked work files")}${iconCard("↗","blue","YTD Payroll",money(ytd),"Year to date")}</section>
      <nav class="animus-payroll-tabs">${[["weekly","Weekly Payroll"],["monthly","Monthly Payroll"],["costing","Job Costing"],["ytd","Year to Date"],["employees","Employees"],["teams","Teams"],["reports","Reports"]].map(([key,label]) => `<button data-payroll-tab="${key}" class="${state.tab===key?"active":""}">${label}</button>`).join("")}</nav>
      <section class="animus-payroll-layout"><article class="animus-payroll-card animus-payroll-table-card"><div class="animus-payroll-tools"><div><label>Group by <select id="animusPayrollGroup"><option value="none">None</option><option value="role">Role / Team</option><option value="status">Payment Status</option></select></label><button id="animusPayrollBulk">Bulk Actions ▾</button></div><div><span>${rows.length} record${rows.length===1?"":"s"}</span><button id="animusPayrollCompact" title="Compact list">☷</button></div></div>${state.filterOpen ? `<div class="animus-payroll-filter"><label>Search <input id="animusPayrollSearch" value="${safe(state.query)}" placeholder="Employee, job, or file #"></label><label>Status <select id="animusPayrollStatus"><option value="all">All statuses</option><option value="Pending" ${state.status==="Pending"?"selected":""}>Pending</option><option value="Paid" ${state.status==="Paid"?"selected":""}>Paid</option></select></label></div>` : ""}<div class="animus-payroll-table-wrap"><table class="animus-payroll-table"><thead><tr><th><input type="checkbox" aria-label="Select all"></th><th>Employee</th><th>Role / Team</th><th>Work File</th><th>Reg Hours</th><th>Rate</th><th>Total Pay</th><th>Status</th><th></th></tr></thead><tbody>${rows.length ? rows.map((row) => `<tr><td><input type="checkbox" data-payroll-select="${safe(row.id)}"></td><td><button class="animus-payroll-person" data-payroll-edit="${safe(row.id)}"><span class="${roleColor(row.role)}">${safe(initials(row.employee))}</span><b>${safe(row.employee || "Unassigned")}</b><small>${safe(dateLabel(row.date))}</small></button></td><td><span class="animus-payroll-role ${roleColor(row.role)}">${safe(row.role || "Unassigned")}</span></td><td><button class="animus-payroll-job" data-payroll-open-file="${safe(row.fileId || "")}">${safe(typeof payrollJobLabel === "function" ? payrollJobLabel(row) : (row.clientJob || "No work file"))}</button></td><td>${numeric(row.hours).toFixed(2)}</td><td>${money(row.rate)}</td><td><strong>${money(rowTotal(row))}</strong></td><td><span class="animus-payroll-status ${row.status === "Paid" ? "paid" : "pending"}">${safe(row.status || "Pending")}</span></td><td><button class="animus-payroll-more" data-payroll-more="${safe(row.id)}" title="More options">⋮</button></td></tr>`).join("") : `<tr><td class="animus-payroll-empty" colspan="9">No payroll entries match this view. Add employee pay to begin tracking labor.</td></tr>`}</tbody><tfoot><tr><td></td><td colspan="3">Total</td><td>${summary.hours.toFixed(2)}</td><td></td><td>${money(summary.pay)}</td><td></td><td></td></tr></tfoot></table></div></article>
      <aside class="animus-payroll-side"><section class="animus-payroll-card"><h2>Payroll Summary</h2><div class="animus-payroll-donut" style="--payroll-fill:${Math.min(100, Math.round((summary.paid / Math.max(summary.pay,1))*100))}%"><b>${money(summary.pay)}</b><small>Total payroll</small></div><div class="animus-payroll-breakdown">${Object.entries(roleTotals).length ? Object.entries(roleTotals).sort((a,b)=>b[1]-a[1]).map(([role,amount],index)=>`<div><i class="dot-${index%5}"></i><span>${safe(role)}</span><b>${money(amount)}</b><em>${((amount / Math.max(summary.pay,1))*100).toFixed(1)}%</em></div>`).join("") : `<p>No payroll roles have been entered.</p>`}</div></section><section class="animus-payroll-card animus-payroll-period"><h2>Pay Period Details</h2><dl><div><dt>Regular Hours</dt><dd>${summary.hours.toFixed(2)}</dd></div><div><dt>Paid</dt><dd>${money(summary.paid)}</dd></div><div><dt>Pending</dt><dd>${money(Math.max(0,summary.pay-summary.paid))}</dd></div><div class="total"><dt>Total Payroll</dt><dd>${money(summary.pay)}</dd></div></dl></section><section class="animus-payroll-card animus-payroll-quick"><h2>Quick Actions</h2><button id="animusPayrollReport">▤ <span>Run Payroll Report<small>Export the current payroll summary</small></span>›</button><button id="animusPayrollTimesheets">◷ <span>Export Timesheets<small>Download employee hours</small></span>›</button><button id="animusPayrollPayment">$ <span>Add One-Time Payment<small>Bonus, commission, or reimbursement</small></span>›</button></section></aside></section></section>`;
    bind(view);
  }
  function save() { if (typeof savePayrollRows === "function") savePayrollRows(); if (typeof renderRevenue === "function") renderRevenue(); }
  function addRow() {
    const row = typeof normalizePayrollRow === "function" ? normalizePayrollRow({ id: typeof makeCrmId === "function" ? makeCrmId("payroll") : `payroll-${Date.now()}`, date: typeof todayIso === "function" ? todayIso(0) : new Date().toISOString().slice(0,10), status:"Pending" }) : { id:`payroll-${Date.now()}`, date:new Date().toISOString().slice(0,10), employee:"", role:"", hours:0, rate:0, status:"Pending" };
    crmPayrollRows.unshift(row); activePayrollId=row.id; save(); editRow(row.id);
  }
  function editRow(id) {
    const row=(crmPayrollRows||[]).find((entry)=>entry.id===id); if(!row) return;
    const view=document.querySelector("#crmPayrollView");
    view.insertAdjacentHTML("beforeend", `<div class="animus-payroll-editor-backdrop" id="animusPayrollEditor"><section class="animus-payroll-editor"><button class="close" id="animusPayrollEditorClose">×</button><p>Payroll Entry</p><h2>${safe(row.employee || "Add employee pay")}</h2><label>Employee${employeeInput(row.employee)}</label><label>Role / Team<input id="animusPayRole" value="${safe(row.role)}" placeholder="Carpentry, painting, labor..."></label><label>Work File<select id="animusPayFile">${fileOptions(row.fileId)}</select></label><div class="animus-payroll-editor-grid"><label>Date<input id="animusPayDate" type="date" value="${safe(row.date)}"></label><label>Hours<input id="animusPayHours" inputmode="decimal" value="${safe(row.hours)}"></label><label>Hourly Rate<input id="animusPayRate" inputmode="decimal" value="${safe(row.rate)}"></label><label>Status<select id="animusPayStatus"><option ${row.status!=="Paid"?"selected":""}>Pending</option><option ${row.status==="Paid"?"selected":""}>Paid</option></select></label></div><label>Notes<textarea id="animusPayNotes" rows="3" placeholder="Optional note">${safe(row.notes)}</textarea></label><div class="animus-payroll-editor-actions"><button class="danger" id="animusPayDelete">Delete</button><span></span><button id="animusPayrollEditorCancel">Cancel</button><button class="primary" id="animusPaySave">Save Payroll Entry</button></div></section></div>`);
    const close=()=>document.querySelector("#animusPayrollEditor")?.remove();
    document.querySelector("#animusPayrollEditorClose")?.addEventListener("click",close); document.querySelector("#animusPayrollEditorCancel")?.addEventListener("click",close);
    document.querySelector("#animusPaySave")?.addEventListener("click",()=>{ row.employee=document.querySelector("#animusPayEmployee").value; row.role=document.querySelector("#animusPayRole").value; row.fileId=document.querySelector("#animusPayFile").value; const file=(crmFiles||[]).find((item)=>item.id===row.fileId); row.fileNumber=file?.fileNumber||""; row.clientJob=file?.clientName||row.clientJob||""; row.date=document.querySelector("#animusPayDate").value; row.hours=numeric(document.querySelector("#animusPayHours").value); row.rate=numeric(document.querySelector("#animusPayRate").value); row.status=document.querySelector("#animusPayStatus").value; row.notes=document.querySelector("#animusPayNotes").value; row.total=row.hours*row.rate; activePayrollId=row.id; save(); close(); render(); });
    document.querySelector("#animusPayDelete")?.addEventListener("click",()=>{ if(window.confirm("Delete this payroll entry?")){ crmPayrollRows=crmPayrollRows.filter((entry)=>entry.id!==row.id); save(); close(); render(); } });
  }
  function exportRows() { const rows=workingRows(); const csv=[["Date","Employee","Role","Work File","Hours","Rate","Total","Status"],...rows.map((row)=>[row.date,row.employee,row.role,typeof payrollJobLabel === "function" ? payrollJobLabel(row) : row.clientJob,row.hours,row.rate,rowTotal(row),row.status])].map(line=>line.map(value=>`"${String(value??"").replace(/"/g,'""')}"`).join(",")).join("\n"); const link=document.createElement("a"); link.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"})); link.download="animus-payroll.csv"; link.click(); URL.revokeObjectURL(link.href); }
  function bind(view) {
    view.querySelectorAll("[data-payroll-tab]").forEach(button=>button.addEventListener("click",()=>{state.tab=button.dataset.payrollTab; render();}));
    view.querySelector("#animusPayrollFilters")?.addEventListener("click",()=>{state.filterOpen=!state.filterOpen;render();});
    view.querySelector("#animusPayrollSearch")?.addEventListener("input",(event)=>{state.query=event.target.value;render();});
    view.querySelector("#animusPayrollStatus")?.addEventListener("change",(event)=>{state.status=event.target.value;render();});
    view.querySelector("#animusPayrollAdd")?.addEventListener("click",addRow);
    view.querySelectorAll("[data-payroll-edit]").forEach(button=>button.addEventListener("click",()=>editRow(button.dataset.payrollEdit)));
    view.querySelectorAll("[data-payroll-more]").forEach(button=>button.addEventListener("click",()=>editRow(button.dataset.payrollMore)));
    view.querySelectorAll("[data-payroll-open-file]").forEach(button=>button.addEventListener("click",()=>{const id=button.dataset.payrollOpenFile; if(!id)return; window.activeFileId=id; if(typeof switchCrmView==="function")switchCrmView("files"); if(typeof renderCrm==="function")renderCrm();}));
    view.querySelector("#animusPayrollReport")?.addEventListener("click",exportRows); view.querySelector("#animusPayrollTimesheets")?.addEventListener("click",exportRows); view.querySelector("#animusPayrollPayment")?.addEventListener("click",addRow);
  }
  // Replace only the legacy renderer; payroll rows and save helpers stay untouched.
  renderPayroll = render;
  window.renderPayroll = render;
  document.addEventListener("DOMContentLoaded",()=>{ if(!document.querySelector("#crmPayrollView")?.hidden)render(); });
})();
