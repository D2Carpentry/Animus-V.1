/* ANIMUS work file redesign. This is a read-first view over the existing CRM record. */
(function () {
  "use strict";

  const state = { tab: "overview", editor: "", fileId: "", tabs: new Map(), activityLimit:50 };
  const tabIds = ["overview", "estimate", "financials", "expenses", "documents", "communication", "tasks", "details", "history"];
  const byId = (id) => document.getElementById(id);
  const money = (value) => {
    const amount = Number(value) || 0;
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
  };
  const escape = (value) => (typeof window.escapeHtml === "function" ? window.escapeHtml(value) : String(value || ""));
  const field = (file, key, fallback = "") => String(file?.[key] ?? fallback ?? "").trim();
  const date = (value) => {
    if (!value) return "Not set";
    const parsed = new Date(`${value}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };
  const initials = (name) => String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  function statusTone(status) {
    return {
      "New Lead": "new-lead",
      "Contact Established": "contact-established",
      "Contact Attempted": "contact-attempted",
      "Inspection Completed": "inspection-completed",
      "In Negotiation": "negotiation",
      "Pending Start": "pending-start",
      "Completed-Pending Payment": "completed-pending-payment",
      "In Progress": "in-progress",
      "Closed / Paid": "closed-paid",
      "Job Lost / Closed": "lost-closed",
    }[status] || "new-lead";
  }

  function assignment(file) {
    if(window.AnimusEmployees)return window.AnimusEmployees.assignedNames(file).join(', ')||'Unassigned';
    const value = file?.assignedTo || file?.assignedEmployee || file?.employee || file?.team;
    const names = (Array.isArray(value) ? value : [value]).map(entry => typeof entry === "object" && entry ? entry.name || entry.displayName || entry.email : entry).filter(Boolean);
    return names.join(", ") || "Unassigned";
  }

  function paidTotal(file) {
    if (typeof window.totalPaidForFile === "function") return window.totalPaidForFile(file);
    const manualTotal = Number(file?.totalPaidOverride);
    if (file?.totalPaidOverride !== "" && file?.totalPaidOverride !== undefined && Number.isFinite(manualTotal)) return Math.max(manualTotal,0);
    return 0;
  }

  function expenseTotal(file) {
    if (typeof window.fileExpenseTotal === "function") return window.fileExpenseTotal(file);
    if (Array.isArray(file?.animusExpenseLedgerV4)) {
      return file.animusExpenseLedgerV4.reduce((sum, entry) => sum + (Number(entry?.amount) || 0), 0);
    }
    if (Array.isArray(file?.expenseLines)) {
      return file.expenseLines.reduce((sum, line) => sum + (Number(line?.amount || line?.baseAmount) || 0), 0);
    }
    return 0;
  }

  function currentFile() {
    return typeof window.activeFile === "function" ? window.activeFile() : null;
  }

  function activityRows(file) {
    const notes = Array.isArray(file?.notes) ? file.notes : [];
    const timeline = Array.isArray(file?.timeline) ? file.timeline : [];
    const noteRows = notes.map((note, index) => ({
      id: `note-${index}`,
      kind: "note",
      title: "Note added",
      detail: typeof note === "string" ? note : field(note, "text") || "Note recorded",
      at: note?.editedAt || note?.at || "",
      actor: field(note, "updatedBy") || field(note, "createdBy") || field(note, "author"),
    }));
    const timelineRows = timeline.map((entry, index) => {
      if (typeof entry === "string") {
        // Older canonical activity stores its timestamp at the end of the text.
        const stamp = entry.match(/([A-Z][a-z]{2} \d{1,2}, \d{4},? \d{1,2}:\d{2}\s*[AP]M)$/)?.[1];
        const at = stamp && Number.isFinite(Date.parse(stamp)) ? new Date(stamp).toISOString() : "";
        return { id: `timeline-${index}`, kind: "system", title: "System activity", detail: at ? entry.slice(0,-stamp.length).trim() : entry, at };
      }
      if (entry && typeof entry === "object") {
        const detail = field(entry, "text") || field(entry, "message") || field(entry, "description") || field(entry, "title") || field(entry, "action") || "System activity recorded";
        return { id: `timeline-${index}`, kind: field(entry, "type") || "system", title: field(entry, "title") || "System activity", detail, at: entry.at || entry.createdAt || entry.updatedAt || "", actor: field(entry, "updatedBy") || field(entry, "createdBy") || field(entry, "actor") || field(entry, "author") };
      }
      return { id: `timeline-${index}`, kind: "system", title: "System activity", detail: "System activity recorded", at: "" };
    });
    return [...noteRows.reverse(), ...timelineRows.reverse()].sort((a, b) => (Date.parse(b.at || "") || 0) - (Date.parse(a.at || "") || 0));
  }

  function activityIcon(row) {
    const text = `${row.title} ${row.detail}`.toLowerCase();
    if (text.includes("call")) return "C";
    if (text.includes("estimate")) return "E";
    if (text.includes("payment") || text.includes("deposit")) return "$";
    if (text.includes("expense") || text.includes("receipt")) return "R";
    return "N";
  }

  function activityMarkup(file, limit) {
    const rows = activityRows(file).slice(0, limit);
    if (!rows.length) return `<div class="animus-empty-panel">No activity has been recorded for this file yet.</div>`;
    return `<div class="animus-activity">${rows.map((row) => `<article class="animus-activity-row"><span class="animus-activity-icon">${escape(activityIcon(row))}</span><div class="animus-activity-main"><strong>${escape(row.title)}</strong><p>${escape(row.detail === "[object Object]" ? "System activity recorded" : row.detail)}</p>${row.actor ? `<small>${escape(row.actor)}</small>` : ""}</div><time class="animus-activity-time">${escape(row.at ? new Date(row.at).toLocaleString("en-US", { dateStyle:"short", timeStyle:"short" }) : "")}</time></article>`).join("")}</div>`;
  }

  function stageIndex(file) {
    const status = field(file, "fileStatus");
    if (status === "New Lead") return 0;
    if (["Contact Established", "Contact Attempted"].includes(status)) return 1;
    if (status === "Inspection Completed") return 2;
    if (status === "In Negotiation") return 3;
    if (status === "Pending Start") return 4;
    if (status === "In Progress") return 5;
    if (status === "Completed-Pending Payment") return 6;
    if (status === "Closed / Paid") return 6;
    return -1;
  }

  function progressMarkup(file) {
    const stages = ["Lead", "Contacted", "Inspection", "Estimate Sent", "Won", "In Progress", "Complete"];
    const index = stageIndex(file);
    const isClosedLost = field(file, "fileStatus") === "Job Lost / Closed";
    const closedPaid = file.fileStatus === "Closed / Paid";
    const recordedStages = new Set(file.createdAt ? [0] : []);
    if (closedPaid) for (const entry of Array.isArray(file.timeline) ? file.timeline : []) {
      if (!entry || typeof entry !== 'object') continue;
      for (const status of [entry.fileStatus,entry.fromStatus,entry.toStatus]) {
        const stage = stageIndex({fileStatus:status}); if (stage >= 0) recordedStages.add(stage);
      }
    }
    const done = step => step < index && (!closedPaid || recordedStages.has(step));
    return `<section class="animus-info-card animus-progress-card"><div class="animus-card-head"><h3>Project Progress</h3><button class="animus-record-button small" data-animus-edit="progress">Update Status</button></div><div class="animus-progress-line" aria-label="Project milestones">${stages.map((stage, step) => `<div class="animus-progress-step ${done(step) ? "done" : step === index ? "current" : ""}"${step === index ? ' aria-current="step"' : ""}><span class="animus-progress-dot">${done(step) ? "&#10003;" : ""}</span><span>${stage}</span></div>`).join("")}</div><div class="animus-status-details"><div><span>Current Status</span><strong class="${isClosedLost ? "closed-value" : ""}">${escape(field(file, "fileStatus", "New Lead"))}</strong></div><div><span>Status Detail</span><strong>${escape(field(file, "statusDetail", "Not set"))}</strong></div>${file.closedAt || file.closedDate ? `<div><span>Closed Date</span><strong>${escape(date(String(file.closedAt || file.closedDate).slice(0,10)))}</strong></div>` : ""}</div></section>`;
  }

  function customerCard(file) {
    const phone = field(file, "clientPhone");
    const email = field(file, "clientEmail");
    const address = field(file, "projectAddress");
    return `<section class="animus-info-card wf-customer-card"><div class="animus-card-head"><h3>Customer Information</h3><button class="animus-record-button small" data-animus-edit="customer">Edit</button></div><strong class="wf-customer-name">${escape(file.clientName || "Unnamed Client")}</strong><dl class="wf-key-values"><div><dt>Phone</dt><dd>${phone ? `<a href="tel:${escape(phone.replace(/[^+\d]/g, ""))}">${escape(phone)}</a>` : "Not added"}</dd></div><div><dt>Email</dt><dd>${email ? `<a href="mailto:${escape(email)}">${escape(email)}</a>` : "Not added"}</dd></div><div><dt>Project Address</dt><dd>${escape(address || "Not added")}</dd></div></dl><button type="button" class="animus-record-button primary wf-full-button" data-customer-portal>Customer Portal</button></section>`;
  }

  function projectCard(file) {
    const rows = [["Project Type", file.projectType], ["Lead Source", file.leadSource], ["Property Type", file.propertyType], ["Estimated Start", file.startDate ? date(file.startDate) : "Not set"], ["Estimated Completion", file.anticipatedCompletionDate ? date(file.anticipatedCompletionDate) : "Not set"], ["Lead Value", file.estimateTotal !== undefined && file.estimateTotal !== "" ? money(file.estimateTotal) : "Not set"]];
    if (file.probability !== undefined && file.probability !== "") rows.push(["Probability", `${file.probability}%`]);
    if (file.tags?.length) rows.push(["Tags", Array.isArray(file.tags) ? file.tags.join(", ") : file.tags]);
    return `<section class="animus-info-card"><div class="animus-card-head"><h3>Key Details</h3><button class="animus-record-button small" data-animus-open="editFile">Edit</button></div><dl class="wf-key-values">${rows.filter(([label,value]) => label !== "Property Type" || value).map(([label,value]) => `<div><dt>${escape(label)}</dt><dd>${escape(value || "Not set")}</dd></div>`).join("")}</dl></section>`;
  }

  function nextActionCard(file) {
    const action = field(file, "nextAction");
    const due = field(file, "nextActionDate") || field(file, "followUpDate");
    if (!action && !due) return `<section class="animus-info-card"><div class="animus-card-head"><h3>Next Action</h3><button class="animus-record-button small" data-animus-edit="action">Add Task</button></div><p class="animus-next-empty">No upcoming action scheduled.</p></section>`;
    const today = new Date(); today.setHours(0,0,0,0);
    const overdue = due && new Date(`${due}T12:00:00`) < today;
    return `<section class="animus-info-card ${overdue ? "wf-overdue" : ""}"><div class="animus-card-head"><h3>Next Action</h3><button class="animus-record-button small" data-animus-edit="action">Edit</button></div><div class="animus-next-inner"><strong>${escape(action || "Follow Up")}</strong><div class="animus-next-meta"><div><span>${overdue ? "Overdue" : "Due Date"}</span><strong>${escape(date(due))}</strong></div><div><span>Assigned To</span><strong>${escape(assignment(file))}</strong></div></div><button class="animus-record-button small" data-animus-complete-action>Mark Complete</button></div></section>`;
  }

  function importantNotesCard(file) {
    const notes = (Array.isArray(file?.notes) ? file.notes : [])
      .map((note, index) => ({ note, index }))
      .filter(({ note }) => {
        if (typeof window.isManualFileNote === "function") return window.isManualFileNote(note);
        return field(note, "text") && note?.source === "manual";
      })
      .reverse();
    const noteHistory = notes.map(({ note, index }) => {
      const updatedAt = note.editedAt || note.at || "";
      const editable = typeof window.canManageManualFileNote === "function" && window.canManageManualFileNote(note);
      return `<article class="animus-file-note-entry"><div class="animus-file-note-entry-head"><small>${escape(updatedAt ? `Added ${date(updatedAt.slice(0, 10))}` : "Date not recorded")} by D2 Carpentry &amp; Design</small>${editable ? `<span class="animus-file-note-actions"><button class="animus-record-button small" data-animus-note-edit="${index}">Edit</button><button class="animus-record-button small danger" data-animus-note-delete="${index}">Delete</button></span>` : ""}</div><p>${escape(note.text)}</p>${note.editedAt ? `<small class="animus-file-note-edited">Edited ${escape(date(note.editedAt.slice(0, 10)))}.</small>` : ""}</article>`;
    }).join("");
    return `<section class="animus-info-card animus-file-notes-card"><div class="animus-card-head"><h3><span class="card-mark">&#9744;</span> File Notes</h3><button class="animus-record-button small" data-animus-add-note>Add Note</button></div>${notes.length ? `<div class="animus-file-note-list">${noteHistory}</div>` : `<p class="animus-next-empty">No notes yet. Add the first note for this work file.</p>`}</section>`;
  }

  function assignedToCard(file) {
    const employee = assignment(file);
    const employees = employee === "Unassigned" ? [] : employee.split(/[,;]/).map(name=>name.trim()).filter(Boolean);
    return `<section class="animus-info-card animus-assigned-card"><div class="animus-card-head"><h3>Assigned To</h3><button class="animus-record-button small" data-animus-edit="assigned">Edit</button></div>${employees.length ? employees.map(name=>`<div class="animus-assigned-person"><span class="animus-assigned-icon" aria-hidden="true">${escape(initials(name))}</span><strong>${escape(name)}</strong></div>`).join("") : `<p class="animus-next-empty">No employees assigned.</p>`}</section>`;
  }

  function summaryMarkup(file) {
    const estimate = Number(file.estimateTotal) || 0;
    const paid = paidTotal(file);
    const balance = Math.max(estimate - paid, 0);
    const cells = [
      ["&#36;", "Estimate", money(estimate), "", "", "estimate"], ["&#9638;", "Paid", money(paid), "", "", "financials"], ["&#128179;", "Balance", money(balance), "", "balance", "financials"], ["&#9638;", "Expenses", money(expenseTotal(file)), "", "expenses", "expenses"], ["&#128197;", "Start Date", field(file, "startDate") ? date(file.startDate) : "Not set", field(file, "startDateReason"), "start-date", "startDate"],
    ];
    if (!hasIssuedInvoice(file)) cells[2][3] = "Estimate only";
    return `<div class="animus-summary-strip">${cells.map(([icon, label, value, sub, extra, action]) => `<button type="button" class="animus-summary-cell ${extra || ""} clickable" data-animus-summary="${action}"><span class="animus-summary-copy"><span>${escape(label)}</span><strong>${escape(value)}</strong>${sub ? `<small>${escape(sub)}</small>` : ""}</span></button>`).join("")}</div>`;
  }

  function hasIssuedInvoice(file) {
    return file.invoiceSent === "Yes" || Boolean(file.invoiceSentAt) || ["Sent","Deposit Paid","Balance Due","Paid"].includes(file.invoiceStatus) || field(file,"statusDetail").toLowerCase() === "invoice sent";
  }

  function tabsMarkup() {
    const tabs = [["overview", "Overview"], ["estimate", "Estimate"], ["financials", "Financials"], ["expenses", "Expenses"], ["documents", "Documents"], ["communication", "Client Communication"], ["tasks", "Tasks"], ["details", "Job Details"], ["history", "History"]];
    return `<nav class="animus-record-tabs" aria-label="Work file sections">${tabs.map(([id, label]) => `<button type="button" class="animus-record-tab ${state.tab === id ? "active" : ""}" data-animus-tab="${id}"${state.tab === id ? ' aria-current="page"' : ""}>${label}</button>`).join("")}</nav>`;
  }

  function overviewPanel(file) {
    return `<div class="wf-overview"><div class="wf-overview-main">${progressMarkup(file)}<div class="wf-overview-pair">${nextActionCard(file)}${assignedToCard(file)}</div>${importantNotesCard(file)}<section class="animus-info-card animus-recent-activity-card"><div class="animus-card-head"><h3>Recent Activity</h3><button class="animus-record-button small" data-animus-tab="history">View All</button></div>${activityMarkup(file, 5)}</section><div class="wf-overview-pair">${documentsPreview(file)}${photosPreview(file)}</div></div><aside class="wf-overview-side">${customerCard(file)}${quickActions(file)}${projectCard(file)}${expensesSummary(file)}</aside></div>`;
  }

  function quickActions(file) {
    return `<section class="animus-info-card"><div class="animus-card-head"><h3>Quick Actions</h3></div><div class="wf-quick-actions"><button data-animus-open="estimate">Create Estimate</button><button data-animus-open="invoice">Create Invoice</button><button data-animus-edit="action">Add Task</button><button data-animus-upload-document>Upload Document</button><button data-animus-tab="communication">Send Message</button><button data-animus-open="expenses">Log Expense</button><details><summary>More Actions</summary><div><button data-animus-open="assignment">Work Order</button><button data-animus-open="payroll">Payroll</button><button data-animus-tab="details">Job Details</button><button data-animus-open="archive">Archive File</button><button class="danger" data-animus-open="delete">Delete File</button></div></details></div></section>`;
  }

  function documentsPreview(file) {
    const docs = documentRows(file);
    return `<section class="animus-info-card"><div class="animus-card-head"><h3>Documents <span class="wf-count">${docs.length}</span></h3><button class="animus-record-button small" data-animus-tab="documents">View All</button></div>${docs.length ? `<div class="wf-document-preview">${docs.slice(0,3).map(doc => `<button type="button" data-animus-open-document="${escape(doc.id || "")}"><strong>${escape(doc.name || "Document")}</strong><small>${escape(doc.type || "File")}${doc.createdAt ? ` · ${escape(date(doc.createdAt.slice(0,10)))}` : ""}</small></button>`).join("")}</div>` : `<p class="animus-next-empty">No documents uploaded.</p>`}<button class="animus-record-button small wf-card-footer" data-animus-upload-document>Upload Document</button></section>`;
  }

  function photosPreview(file) {
    const photos = workPhotoDocuments(file);
    return `<section class="animus-info-card"><div class="animus-card-head"><h3>Photos <span class="wf-count">${photos.length}</span></h3><button class="animus-record-button small" data-animus-tab="documents">View All</button></div>${photos.length ? `<div class="wf-photo-preview">${photos.slice(0,3).map(photo => `<button type="button" data-animus-open-work-photo="${escape(photo.id || "")}" aria-label="View ${escape(photo.title || "work photo")}"><img loading="lazy" src="${escape(photo.dataUrl || photo.url || "")}" alt="${escape(photo.title || "Work photo")}"></button>`).join("")}${photos.length > 3 ? `<button data-animus-tab="documents" aria-label="View all photos">+${photos.length - 3}</button>` : ""}</div>` : `<p class="animus-next-empty">No work photos yet.</p>`}<button class="animus-record-button small wf-card-footer" data-animus-upload-document>Upload Photo</button></section>`;
  }

  function expenseBreakdown(file, total) {
    const result = { Materials:0, Labor:0, Other:0 };
    for (const line of Array.isArray(file.expenseLines) ? file.expenseLines : []) {
      const amount = typeof window.receiptExpenseLineAmount === "function" ? window.receiptExpenseLineAmount(line) : Number(line.amount ?? line.lineTotal ?? line.total ?? line.baseAmount) || 0;
      const category = String(line.category || "").toLowerCase();
      const group = /^(materials?|supplies)$/.test(category) ? "Materials" : /^(labor|labour)$/.test(category) ? "Labor" : "Other";
      result[group] += amount;
    }
    return Math.abs(Object.values(result).reduce((sum,value) => sum + value,0) - total) < .01 ? result : null;
  }

  function expensesSummary(file) {
    const total = expenseTotal(file), groups = expenseBreakdown(file,total);
    return `<section class="animus-info-card wf-expenses-card"><div class="animus-card-head"><h3>Expenses</h3><button class="animus-record-button small" data-animus-tab="expenses">View All</button></div><button type="button" class="wf-expense-breakdown" data-animus-tab="expenses" aria-label="Open this workfile's expenses"><dl class="wf-key-values">${Object.entries(groups || {Materials:null,Labor:null,Other:null}).map(([key,value]) => `<div><dt>${key}</dt><dd>${value === null ? "Not categorized" : money(value)}</dd></div>`).join("")}<div class="wf-expense-total"><dt>Total Expenses</dt><dd>${money(total)}</dd></div></dl></button></section>`;
  }

  function communicationPanel(file) {
    const phone = field(file,"clientPhone").replace(/[^+\d]/g,""), email = field(file,"clientEmail");
    const entries = activityRows(file).filter(row => /\b(email|text|sms|message|call|communication)\b/i.test(`${row.kind} ${row.title} ${row.detail}`));
    return `<section class="animus-info-card"><div class="animus-card-head"><h3>Client Communication</h3><button class="animus-record-button small" data-animus-add-note>Log Communication</button></div><div class="wf-communication-actions">${email ? `<a class="animus-record-button" href="mailto:${escape(email)}">Email Customer</a>` : ""}${phone ? `<a class="animus-record-button" href="sms:${escape(phone)}">Text Customer</a><a class="animus-record-button" href="tel:${escape(phone)}">Call Customer</a>` : ""}<button class="animus-record-button" data-customer-portal>Customer Portal</button></div>${!phone && !email ? `<p class="animus-next-empty">Add a phone number or email to contact this customer.</p>` : ""}${entries.length ? `<div class="wf-communication-history">${entries.slice(0,50).map(row => `<article><strong>${escape(row.title)}</strong><p>${escape(row.detail)}</p>${row.at ? `<time>${escape(new Date(row.at).toLocaleString("en-US"))}</time>` : ""}</article>`).join("")}</div>` : `<p class="animus-next-empty">No communication activity recorded.</p>`}</section>`;
  }

  function activityPanel(file) {
    const count = activityRows(file).length;
    return `<div class="animus-tab-panel"><section class="animus-info-card"><div class="animus-card-head"><h3>History</h3><button class="animus-record-button small" data-animus-add-note>Add Note</button></div>${activityMarkup(file, state.activityLimit)}${count > state.activityLimit ? `<button class="animus-record-button small wf-card-footer" data-animus-more-activity>Load More (${Math.min(50,count-state.activityLimit)} of ${count-state.activityLimit})</button>` : ""}</section></div>`;
  }

  function estimatePanel(file) {
    const supplements = Array.isArray(file.supplements) ? file.supplements : [];
    const document = latestEstimateDocument(file);
    return `<div class="animus-tab-panel"><section class="animus-info-card animus-estimate-actions"><div class="animus-card-head"><h3>Estimate &amp; Documents</h3></div><div class="animus-estimate-actions-inner"><p>Use these actions when you need to edit the estimate, create a supplement, invoice the file, or build the work order.</p><div class="animus-action-row"><button class="animus-record-button primary" data-animus-open="estimate">Open / Edit Estimate</button><button class="animus-record-button" data-animus-open="supplement">Create Supplement</button><button class="animus-record-button" data-animus-open="invoice">Invoice</button><button class="animus-record-button" data-animus-open="assignment">Work Order</button></div>${supplements.length ? `<small>${supplements.length} supplement${supplements.length === 1 ? "" : "s"} saved to this work file. The newest saved document is shown below.</small>` : ""}</div>${document ? estimatePreviewMarkup(file, document) : `<div class="animus-estimate-empty"><strong>No estimate is attached to this work file yet.</strong><span>Open or upload an estimate to have it appear here inside the work file.</span></div>`}</section></div>`;
  }

  function latestEstimateDocument(file) {
    if(file?.currentEstimateSavedAt&&file.editableEstimate){
      return {kind:(file.editableEstimate.documentMode||file.editableEstimate.mode)==='supplement'?'Supplement':'Estimate',source:file,data:file.editableEstimate};
    }
    const supplements = Array.isArray(file?.supplements) ? file.supplements : [];
    const latestSupplement = supplements
      .map((entry) => ({ entry, time: Date.parse(entry?.updatedAt || entry?.createdAt || "") || 0 }))
      .sort((a, b) => b.time - a.time)[0]?.entry;
    if (latestSupplement?.data) {
      return { kind: "Supplement", source: latestSupplement, data: latestSupplement.data };
    }
    if (file?.editableEstimate && typeof file.editableEstimate === "object") {
      return { kind: "Estimate", source: file, data: file.editableEstimate };
    }
    return null;
  }

  function estimateValue(data, key, fallback = "") {
    return String(data?.[key] ?? fallback ?? "").trim();
  }

  function estimateTotal(data, key, fallback = 0) {
    const totals = data?.totals && typeof data.totals === "object" ? data.totals : {};
    const value = totals[key] ?? data?.[key] ?? fallback;
    return Number(value) || 0;
  }

  function estimateLineTotal(item) {
    const total = Number(item?.total);
    if (Number.isFinite(total) && total) return total;
    const qty = Number(item?.qty ?? item?.quantity) || 0;
    const price = Number(item?.price ?? item?.unitCost ?? item?.unitPrice) || 0;
    return qty && price ? qty * price : price;
  }

  function estimateLineItems(data) {
    const rows = Array.isArray(data?.lineItems) ? data.lineItems : Array.isArray(data?.items) ? data.items : [];
    return rows.filter((item) => item && typeof item === "object");
  }

  function estimateMaterialItems(data) {
    const rows = Array.isArray(data?.materialItems) ? data.materialItems : Array.isArray(data?.materials) ? data.materials : [];
    return rows.filter((item) => item && typeof item === "object");
  }

  function estimatePreviewMarkup(file, document) {
    const data = document.data || {};
    const title = estimateValue(data, "estimateTitle", document.source?.title || document.kind);
    const estimateNo = estimateValue(data, "estimateNumber", document.source?.estimateNumber || file.fileNumber || "Not assigned");
    const company = estimateValue(data, "companyName", "D2 Carpentry & Design");
    const estimateDate = estimateValue(data, "estimateDate", document.source?.updatedAt?.slice?.(0, 10) || document.source?.createdAt?.slice?.(0, 10) || "");
    const clientName = estimateValue(data, "clientName", file.clientName || "Unnamed Client");
    const clientPhone = estimateValue(data, "clientPhone", file.clientPhone || "");
    const clientEmail = estimateValue(data, "clientEmail", file.clientEmail || "");
    const address = estimateValue(data, "projectAddress", file.projectAddress || "");
    const projectType = estimateValue(data, "projectType", file.projectType || "");
    const notes = estimateValue(data, "notes");
    const additionalNotes = estimateValue(data, "additionalNotes");
    const lines = estimateLineItems(data);
    const materials = estimateMaterialItems(data);
    const subtotal = estimateTotal(data, "subtotal", lines.reduce((sum, item) => sum + estimateLineTotal(item), 0));
    const discount = estimateTotal(data, "discount");
    const tax = estimateTotal(data, "tax");
    const deposit = estimateTotal(data, "deposit");
    const total = estimateTotal(data, "total", Number(file.estimateTotal) || subtotal + tax - discount);
    return `<article class="animus-embedded-estimate"><header class="animus-estimate-preview-head"><div><span class="animus-estimate-kicker">${escape(document.kind)}</span><h3>${escape(title || document.kind)}</h3><p>${escape(company)}</p></div><div class="animus-estimate-document-meta"><span>Date <strong>${escape(estimateDate ? date(estimateDate) : "Not set")}</strong></span><span>Estimate # <strong>${escape(estimateNo)}</strong></span></div></header><div class="animus-estimate-preview-grid"><section><h4>Customer</h4><dl><div><dt>Name</dt><dd>${escape(clientName)}</dd></div><div><dt>Phone</dt><dd>${escape(clientPhone || "Not added")}</dd></div><div><dt>Email</dt><dd>${escape(clientEmail || "Not added")}</dd></div><div><dt>Address</dt><dd>${escape(address || "Not added")}</dd></div></dl></section><section><h4>Project</h4><dl><div><dt>File</dt><dd>${escape(file.fileNumber || "Not assigned")}</dd></div><div><dt>Type</dt><dd>${escape(projectType || "Not added")}</dd></div><div><dt>Status</dt><dd>${escape(field(file, "fileStatus", "New Lead"))}</dd></div><div><dt>Lead Source</dt><dd>${escape(field(file, "leadSource", "Manual"))}</dd></div></dl></section></div><section class="animus-estimate-lines"><div class="animus-estimate-section-title"><h4>Line Items</h4><span>${lines.length} line${lines.length === 1 ? "" : "s"}</span></div>${lines.length ? `<div class="animus-estimate-line-table">${lines.map((item) => estimateLineMarkup(item)).join("")}</div>` : `<div class="animus-estimate-mini-empty">No line items are saved on this estimate.</div>`}</section>${materials.length ? `<section class="animus-estimate-lines"><div class="animus-estimate-section-title"><h4>Materials &amp; Supplies</h4><span>${materials.length} item${materials.length === 1 ? "" : "s"}</span></div><div class="animus-estimate-line-table">${materials.map((item) => estimateLineMarkup(item, true)).join("")}</div></section>` : ""}${notes || additionalNotes ? `<section class="animus-estimate-notes">${notes ? `<div><h4>Notes</h4><p>${escape(notes)}</p></div>` : ""}${additionalNotes ? `<div><h4>Additional Notes</h4><p>${escape(additionalNotes)}</p></div>` : ""}</section>` : ""}<footer class="animus-estimate-totals"><div><span>Subtotal</span><strong>${money(subtotal)}</strong></div>${discount ? `<div><span>Discount</span><strong>-${money(discount)}</strong></div>` : ""}${tax ? `<div><span>Tax</span><strong>${money(tax)}</strong></div>` : ""}${deposit ? `<div><span>Deposit</span><strong>${money(deposit)}</strong></div>` : ""}<div class="grand"><span>Total</span><strong>${money(total)}</strong></div></footer></article>`;
  }

  function estimateLineMarkup(item, material = false) {
    const type = String(item?.type || "").toLowerCase();
    const isSection = type === "section" || type === "heading";
    const isSubline = type === "subline" || type === "sub";
    const name = field(item, "name") || field(item, "description") || field(item, "title") || (isSection ? "Section" : material ? "Material" : "Line item");
    if (isSection) return `<div class="animus-estimate-line-row section"><strong>${escape(name)}</strong></div>`;
    const qty = item?.qty ?? item?.quantity ?? "";
    const unit = Number(item?.price ?? item?.unitCost ?? item?.unitPrice) || 0;
    const total = estimateLineTotal(item);
    return `<div class="animus-estimate-line-row ${isSubline ? "subline" : ""}"><div><strong>${escape(name)}</strong>${field(item, "note") || field(item, "details") ? `<small>${escape(field(item, "note") || field(item, "details"))}</small>` : ""}</div><span>${escape(qty ? `Qty ${qty}` : "")}</span><span>${unit ? money(unit) : ""}</span><strong>${money(total)}</strong></div>`;
  }

  function financialsPanel(file) {
    const estimate = Number(file.estimateTotal) || 0, paid = paidTotal(file), balance = Math.max(estimate - paid, 0), material = Number(file.materialTotal) || 0, labor = Number(file.laborTotal) || 0, expenses = expenseTotal(file);
    const values = [["Estimate Amount", money(estimate), "", ""], ["Materials", money(material), "", ""], ["Expenses", money(expenses), "", "expenses"], ["Labor", money(labor), "", ""], ["Total Paid", money(paid), "", ""], [hasIssuedInvoice(file) ? "Balance" : "Estimate Balance", money(balance), balance ? "danger" : "", ""]];
    return `<div class="animus-tab-panel"><div class="animus-financial-grid">${values.map(([label, value, tone, action]) => `<${action ? "button" : "article"} class="animus-financial-value ${tone} ${action ? "clickable" : ""}"${action ? ` type="button" data-animus-open="${action}"` : ""}><span>${label}</span><strong>${value}</strong></${action ? "button" : "article"}>`).join("")}</div><div class="animus-action-row"><button class="animus-record-button primary" data-animus-edit="financials">Edit Financials</button><button class="animus-record-button" data-animus-open="invoice">Open Invoice</button></div></div>`;
  }

  function expensesPanel(file) {
    const stored = Array.isArray(file.animusExpenseLedgerV4) ? file.animusExpenseLedgerV4 : [];
    const cloud = typeof window.getAnimusExpensesForFile === "function" ? window.getAnimusExpensesForFile(file.id || file.fileNumber) : [];
    const records = [...cloud, ...stored].reduce((unique, entry) => {
      const key = String(entry?.id || `${entry?.date || ""}-${entry?.vendor || ""}-${entry?.amount || ""}`);
      if (!unique.some((item) => item.key === key)) unique.push({ key, entry });
      return unique;
    }, []).map((item) => item.entry).sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
    return `<div class="animus-tab-panel"><section class="animus-info-card"><div class="animus-card-head"><h3>Expenses</h3><button class="animus-record-button primary small" data-animus-open="expenses">Open Expense Center</button></div>${records.length ? `<div class="animus-activity">${records.map((entry) => `<article class="animus-activity-row"><span class="animus-activity-icon">R</span><div class="animus-activity-main"><strong>${escape(entry.vendor || entry.title || "Expense")}</strong><p>${escape(entry.category || "Other")} · ${escape(date(entry.date))}</p></div><time class="animus-activity-time">${money(entry.amount)}</time></article>`).join("")}</div>` : `<div class="animus-empty-panel">No saved expenses for this file.</div>`}</section></div>`;
  }

  function fileExpenseRecords(file) {
    const stored = Array.isArray(file?.animusExpenseLedgerV4) ? file.animusExpenseLedgerV4 : [];
    const cloud = typeof window.getAnimusExpensesForFile === "function" ? window.getAnimusExpensesForFile(file.id || file.fileNumber) : [];
    return [...cloud, ...stored].reduce((unique, entry) => {
      const key = String(entry?.id || `${entry?.date || ""}-${entry?.vendor || ""}-${entry?.amount || ""}-${entry?.imageTitle || ""}`);
      if (!unique.some((item) => item.key === key)) unique.push({ key, entry });
      return unique;
    }, []).map((item) => item.entry).sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
  }

  function receiptSource(entry = {}) {
    return entry.imageDataUrl || entry.receiptImageUrl || entry.receiptDataUrl || "";
  }

  function receiptDetail(entry = {}) {
    const items = Array.isArray(entry.items) ? entry.items : Array.isArray(entry.lines) ? entry.lines : [];
    const firstItem = items.map((item) => item?.name || item?.description || item?.note || "").find(Boolean);
    return firstItem || entry.notes || entry.category || "Receipt details saved";
  }

  function documentRows(file) {
    return Array.isArray(file?.workFileDocuments) ? file.workFileDocuments : Array.isArray(file?.documents) ? file.documents : [];
  }

  function workPhotoDocuments(file) {
    const photos = Array.isArray(file?.workPhotos) ? file.workPhotos : [];
    const uploads = documentRows(file).filter(doc => String(doc.type || "").startsWith("image/")).map(doc => ({ ...doc, title:doc.name }));
    return [...photos, ...uploads];
  }

  function workPhotoPanel(file) {
    const photos = workPhotoDocuments(file);
    return `<section class="animus-document-box"><div class="animus-document-box-head"><h4>Work Photos</h4><span>${photos.length}</span></div>${photos.length ? `<div class="animus-document-list">${photos.map((photo) => `<button type="button" class="animus-document-row" data-animus-open-work-photo="${escape(photo.id || "")}"><span class="animus-document-thumb">${photo.dataUrl ? `<img src="${escape(photo.dataUrl)}" alt="${escape(photo.title || "Work photo")}">` : "IMG"}</span><span><strong>${escape(photo.title || photo.fileName || "Work photo")}</strong><small>${escape(date((photo.createdAt || "").slice(0, 10)))} · Saved from mobile</small></span><b>Photo</b></button>`).join("")}</div>` : `<div class="animus-document-empty">Work progress photos captured from mobile will appear here.</div>`}</section>`;
  }

  function documentsPanel(file) {
    const supplements = Array.isArray(file.supplements) ? file.supplements : [];
    const receipts = fileExpenseRecords(file).filter((entry) => receiptSource(entry) || entry.imageTitle || entry.vendor || entry.title);
    const docs = documentRows(file);
    return `<div class="animus-tab-panel animus-documents-panel"><section class="animus-info-card"><div class="animus-card-head"><h3>Documents</h3><button class="animus-record-button primary small" data-animus-upload-document>Upload Document</button></div><div class="animus-document-grid">${workPhotoPanel(file)}<section class="animus-document-box"><div class="animus-document-box-head"><h4>Receipts</h4><span>${receipts.length}</span></div>${receipts.length ? `<div class="animus-document-list">${receipts.map((entry) => `<button type="button" class="animus-document-row" data-animus-open-receipt="${escape(entry.id || "")}"><span class="animus-document-icon">${receiptSource(entry) ? "IMG" : "REC"}</span><span><strong>${escape(entry.title || entry.vendor || entry.imageTitle || "Receipt")}</strong><small>${escape(date(entry.date))} · ${escape(receiptDetail(entry))}</small></span><b>${money(entry.amount)}</b></button>`).join("")}</div>` : `<div class="animus-document-empty">No receipts saved for this workfile.</div>`}</section><section class="animus-document-box"><div class="animus-document-box-head"><h4>Uploaded Documents</h4><span>${docs.length}</span></div>${docs.length ? `<div class="animus-document-list">${docs.map((doc) => `<button type="button" class="animus-document-row" data-animus-open-document="${escape(doc.id || "")}"><span class="animus-document-icon">${escape((doc.type || doc.name || "DOC").split("/").pop().slice(0, 3).toUpperCase())}</span><span><strong>${escape(doc.name || "Uploaded document")}</strong><small>${escape(date((doc.createdAt || "").slice(0, 10)))} · ${escape(doc.notes || doc.type || "Saved to this work file")}</small></span><b>${escape(doc.size ? `${Math.round(Number(doc.size) / 1024)} KB` : "")}</b></button>`).join("")}</div>` : `<div class="animus-document-empty">No uploaded documents.</div>`}</section><section class="animus-document-box animus-document-actions"><div class="animus-document-box-head"><h4>Work File Documents</h4><span>${supplements.length ? `${supplements.length} supplement${supplements.length === 1 ? "" : "s"}` : "Actions"}</span></div><div class="animus-action-row"><button class="animus-record-button" data-animus-open="estimate">Estimate</button><button class="animus-record-button" data-animus-open="invoice">Invoice</button><button class="animus-record-button" data-animus-open="assignment">Work Order</button></div></section></div></section></div>`;
  }

  function detailsPanel(file) {
    const isAngi = field(file, "leadSource").toLowerCase() === "angi";
    const groups = [
      ...(isAngi ? [["Lead Tracking", [["Lead Source", "Angi"], ["Lead Fee", money(file.leadFee)]]]] : []),
      ["Contact & Inspection", [["Contact Email Sent", field(file, "contactEmailSent", "No")], ["Contact Text Sent", field(file, "contactTextSent", "No")], ["Inspection Date", field(file, "inspectionDate") ? date(file.inspectionDate) : "Not set"], ["Inspection Time", field(file, "inspectionTime", "Not set")]]],
      ["Schedule", [["Arrival Window", field(file, "arrivalWindow", "Open")], ["Start Date", field(file, "startDate") ? date(file.startDate) : "Not set"], ["Follow-Up Date", field(file, "followUpDate") ? date(file.followUpDate) : "Not set"], ["Anticipated Completion", field(file, "anticipatedCompletionDate") ? date(file.anticipatedCompletionDate) : "Not set"]]],
      ["Operations", [["Invoice Sent", field(file, "invoiceSent", "No")], ["Review Requested", field(file, "reviewRequested", "No")], ["Closing Call", field(file, "closingCallCompleted", "No")], ["Warranty", field(file, "warrantyStatus", "Not Sent")]]],
    ];
    return `<div class="animus-tab-panel"><section class="animus-info-card"><div class="animus-card-head"><h3>Job Details</h3><button class="animus-record-button primary small" data-animus-edit="details">Edit Job Details</button></div><div class="animus-detail-grid">${groups.map(([title, rows]) => `<section class="animus-detail-card"><h4>${escape(title)}</h4><dl class="animus-info-list">${rows.map(([label, value]) => `<div class="animus-detail-pair"><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join("")}</dl></section>`).join("")}</div></section></div>`;
  }

  function employeeSelect(file){
    const selected=assignment(file)==='Unassigned'?'':assignment(file);
    const names=[...new Set([...(window.AnimusEmployees?.roster||['David','Lara','Manny']),...(selected?[selected]:[])])];
    return `<label class="wide">Assigned To<select data-animus-field="assignedTo"><option value="">Unassigned</option>${names.map(name=>`<option value="${escape(name)}"${name===selected?' selected':''}>${escape(name)}</option>`).join('')}</select></label>`;
  }
  function editorMarkup(file) {
    if (!state.editor) return "";
    const select = (name, value, options) => `<label>${name.replace(/([A-Z])/g," $1").replace(/^./,letter=>letter.toUpperCase())}<select data-animus-field="${name}">${options.map((option) => `<option${option === value ? " selected" : ""}>${escape(option)}</option>`).join("")}</select></label>`;
    const input = (name, label, value, type = "text", wide = "") => `<label class="${wide}">${label}<input data-animus-field="${name}" data-animus-original="${escape(value)}" type="${type}" value="${escape(value)}"></label>`;
    let title = "Edit File", fields = "";
    if (state.editor === "customer") fields = input("clientName", "Name", field(file, "clientName")) + input("clientPhone", "Phone", field(file, "clientPhone")) + input("clientEmail", "Email", field(file, "clientEmail"), "email") + input("projectAddress", "Address", field(file, "projectAddress"), "text", "wide");
    if (state.editor === "project") fields = select("projectType", field(file, "projectType", "Other"), window.CRM_PROJECT_TYPES || ["Closet", "Pantry", "Cabinetry", "Refinishing", "Built-In", "Other"]) + select("leadSource", field(file, "leadSource", "Manual"), ["Manual", "Angi", "Website", "Phone", "Text", "Referral", "Repeat Customer", "Other"]) + (field(file, "leadSource").toLowerCase() === "angi" ? input("leadFee", "Lead Fee", Number(file.leadFee) || "", "number") : "");
    if (state.editor === "progress") {
      const statusDetails = CRM_STATUS_DETAILS;
      const statuses = Object.keys(statusDetails);
      const selectedStatus = field(file, "fileStatus", "New Lead");
      fields = select("fileStatus", selectedStatus, statuses) + select("statusDetail", field(file, "statusDetail"), statusDetails[selectedStatus] || [field(file, "statusDetail")]);
    }
    if (state.editor === "action") fields = input("nextAction", "Next Action", field(file, "nextAction"), "text", "wide") + input("nextActionDate", "Due Date", field(file, "nextActionDate") || field(file, "followUpDate"), "date") + employeeSelect(file);
    if (state.editor === "assigned") fields = employeeSelect(file);
    if (state.editor === "financials") fields = input("estimateTotal", "Estimate Amount", Number(file.estimateTotal) || "", "number") + input("materialTotal", "Materials", Number(file.materialTotal) || "", "number") + input("laborTotal", "Labor", Number(file.laborTotal) || "", "number") + input("totalPaidOverride", "Total Paid (Manual)", file.totalPaidOverride !== undefined && file.totalPaidOverride !== "" ? Number(file.totalPaidOverride) : paidTotal(file), "number") + input("initialDeposit", "Initial Deposit", Number(file.initialDeposit) || "", "number") + input("midpointDeposit", "Midpoint Deposit", Number(file.midpointDeposit) || "", "number") + input("finalPaymentAmount", "Final Payment", Number(file.finalPaymentAmount) || "", "number");
    if (state.editor === "details") fields = input("inspectionDate", "Inspection Date", field(file, "inspectionDate"), "date") + input("inspectionTime", "Inspection Time", field(file, "inspectionTime"), "time") + input("startDate", "Start Date", field(file, "startDate"), "date") + input("followUpDate", "Follow-Up Date", field(file, "followUpDate"), "date") + input("anticipatedCompletionDate", "Anticipated Completion", field(file, "anticipatedCompletionDate"), "date") + select("arrivalWindow", field(file, "arrivalWindow", "Open"), ["Open", "7:00 AM", "8:00 AM", "9:00 AM", "10:00 AM", "Afternoon"]) + (field(file, "leadSource").toLowerCase() === "angi" ? input("leadFee", "Lead Fee", Number(file.leadFee) || "", "number") : "");
    title = state.editor === "financials" ? "Edit Financials" : state.editor === "details" ? "Edit Job Details" : state.editor === "assigned" ? "Assign Employee" : "Edit File";
    return `<section class="animus-inline-editor animus-inline-editor-${state.editor}"><h3>${title}</h3><div class="animus-inline-editor-grid">${fields}</div><div class="animus-action-row"><button class="animus-record-button primary" data-animus-save-editor>Save Changes</button><button class="animus-record-button" data-animus-cancel-editor>Cancel</button></div></section>`;
  }

  function panel(file) {
    if (state.tab === "estimate") return estimatePanel(file);
    if (state.tab === "financials") return financialsPanel(file);
    if (state.tab === "expenses") return expensesPanel(file);
    if (state.tab === "documents") return documentsPanel(file);
    if (state.tab === "details") return detailsPanel(file);
    if (state.tab === "history") return activityPanel(file);
    if (state.tab === "communication") return communicationPanel(file);
    if (state.tab === "tasks") return nextActionCard(file);
    return overviewPanel(file);
  }

  function headerMarkup(file) {
    const metadata = [["Created", file.createdAt], ["Updated", file.updatedAt]].filter(([,value]) => value).map(([label,value]) => `${label} ${date(String(value).slice(0,10))}`);
    const actor = file.updatedBy?.name || file.updatedBy?.email || (typeof file.updatedBy === "string" ? file.updatedBy : "");
    if (actor) metadata.push(`by ${actor}`);
    return `<header class="animus-record-header"><div class="animus-record-person"><div class="animus-record-avatar" aria-hidden="true">${escape(initials(file.clientName))}</div><div class="animus-record-title"><h2>${escape(file.clientName || "Unnamed Client")}</h2><p class="animus-record-subtitle">${[file.fileNumber,file.projectType,file.leadSource].filter(Boolean).map(escape).join(" &middot; ")}</p>${file.projectAddress ? `<p class="wf-header-location">${escape(file.projectAddress)}</p>` : ""}<div class="wf-header-status"><button type="button" class="animus-status-badge animus-status-${statusTone(file.fileStatus)}" data-animus-edit="progress" title="Update file status">${escape(field(file,"fileStatus","New Lead"))}</button>${file.statusDetail ? `<span>${escape(file.statusDetail)}</span>` : ""}</div>${metadata.length ? `<p class="wf-header-metadata">${metadata.map(escape).join(" &middot; ")}</p>` : ""}</div></div><div class="animus-record-actions"><button type="button" class="animus-record-button" data-animus-open="editFile">Edit File</button><button type="button" class="animus-record-button primary" data-animus-edit="action">Add Task</button><details class="animus-more-menu"><summary class="animus-record-button wf-more-trigger" aria-label="More workfile actions" title="More actions">&#8943;</summary><div class="animus-more-menu-panel"><button class="animus-record-button small" data-animus-open="assignment">Work Order</button><button class="animus-record-button small" data-animus-open="payroll">Payroll</button><button class="animus-record-button small" data-animus-open="archive">Archive File</button><button class="animus-record-button small danger" data-animus-open="delete">Delete File</button></div></details></div></header>`;
  }

  function setPanelCollapsed(collapsed) {
    const layout = document.querySelector('.animus-work-files-layout');
    const button = byId('animusWorkFilesCollapse');
    layout?.classList.toggle('animus-work-files-collapsed',collapsed);
    if (button) {
      button.setAttribute('aria-expanded',String(!collapsed));
      button.setAttribute('aria-label',collapsed ? 'Expand Workfiles' : 'Collapse Workfiles');
      button.title = collapsed ? 'Expand Workfiles' : 'Collapse Workfiles';
      button.textContent = collapsed ? '\u203a' : '\u2039';
    }
    const list = document.querySelector('.crm-file-list-panel');
    if (list) for (const child of list.children) if (child !== button) { child.inert = collapsed; child.setAttribute('aria-hidden',String(collapsed)); }
    const workspace = document.querySelector('.crm-file-workspace');
    if (workspace) workspace.inert = !collapsed && window.innerWidth <= 900;
  }

  function writeRoute(fileId, tab, push = true) {
    const url = new URL(location.href);
    if (fileId) { url.searchParams.set('workfile',fileId); url.searchParams.set('fileTab',tab); }
    else { url.searchParams.delete('workfile'); url.searchParams.delete('fileTab'); }
    if (url.href !== location.href) history[push ? 'pushState' : 'replaceState'](history.state,'',url);
  }

  function workspaceVisible() {
    const layout = document.querySelector('.animus-work-files-layout');
    return layout && !layout.hidden && document.body.dataset.animusView === 'files' && !document.body.classList.contains('crm-estimator-active');
  }

  let routeRequested = new URL(location.href).searchParams.get('workfile');
  let identity = null;
  function isAssignedToCurrentUser(file) {
    if (!identity) return false;
    const ids = [identity.uid,identity.email,identity.name,identity.displayName].filter(Boolean).map(value=>String(value).trim().toLowerCase());
    const value = file.assignedTo || file.assignedEmployee || file.employee || file.team;
    return (Array.isArray(value) ? value : [value]).some(entry => {
      const names = typeof entry === 'object' && entry ? [entry.id,entry.uid,entry.name,entry.email] : String(entry || '').split(/[,;]/);
      return names.some(name=>ids.includes(String(name || '').trim().toLowerCase()));
    });
  }

  function selectTab(tab, push = true) {
    if (!tabIds.includes(tab)) return;
    if (state.editor && !confirm('Discard unsaved workfile edits and change sections?')) return;
    state.tab = tab; state.editor = '';
    if (state.fileId) state.tabs.set(state.fileId,tab);
    writeRoute(currentFile()?.id,tab,push);
    renderWorkFile();
    const workspace = document.querySelector('.crm-file-workspace');
    if (workspace) workspace.scrollTop = 0;
  }

  window.AnimusWorkfileDetail = {
    isAssignedToCurrentUser,
    selected(id) {
      routeRequested = null;
      if (String(currentFile()?.id) !== String(id)) return;
      renderWorkFile(); setPanelCollapsed(true); writeRoute(id,state.tab);
      const title = document.querySelector('#animusWorkFile .animus-record-title h2');
      title?.setAttribute('tabindex','-1'); title?.focus({preventScroll:true});
    },
  };

  window.addEventListener('popstate',()=>{
    if (state.editor && !confirm('Discard unsaved workfile edits and navigate?')) { writeRoute(state.fileId,state.tab); return; }
    const url = new URL(location.href); routeRequested = url.searchParams.get('workfile');
    state.editor = '';
    if (!routeRequested) { window.selectAnimusWorkfile?.(null); setPanelCollapsed(false); }
    else {
      const tab = url.searchParams.get('fileTab');
      state.tabs.set(routeRequested,tabIds.includes(tab) ? tab : 'overview');
    }
    window.switchCrmView?.('files'); window.renderCrm?.();
  });

  function renderWorkFile() {
    const workspace = document.querySelector(".crm-file-workspace");
    if (!workspace) return;
    let root = document.querySelector("#animusWorkFile");
    if (!root) { root = document.createElement("section"); root.id = "animusWorkFile"; root.className = "animus-work-file"; workspace.prepend(root); }
    if (routeRequested) {
      if (!window.selectAnimusWorkfile?.(routeRequested)) {
        window.selectAnimusWorkfile?.(null); state.fileId = ""; state.editor = "";
        root.innerHTML = `<div class="animus-empty-panel" role="status">${typeof crmCloudAuthoritativeLoaded !== 'undefined' && !crmCloudAuthoritativeLoaded ? 'Loading workfile from cloud...' : 'This workfile is not available.'}</div>`;
        return;
      }
      const requestedTab = new URL(location.href).searchParams.get('fileTab');
      state.tabs.set(routeRequested,tabIds.includes(requestedTab) ? requestedTab : 'overview');
      if (state.fileId === routeRequested) state.tab = state.tabs.get(routeRequested);
      routeRequested = null; setPanelCollapsed(true);
      window.switchCrmView?.('files');
    }
    const file = currentFile();
    if (!file) { state.fileId = ""; state.editor = ""; document.body.classList.remove("animus-work-file-active"); root.innerHTML = `<div class="animus-empty-panel"><h2>Select a workfile</h2><p>Choose a customer project from the list.</p></div>`; setPanelCollapsed(false); return; }
    if (state.fileId !== file.id) {
      if (state.fileId) state.tabs.set(state.fileId,state.tab);
      state.fileId = file.id;
      state.tab = state.tabs.get(file.id) || "overview";
      state.editor = "";
      state.activityLimit = 50;
      setPanelCollapsed(true);
      if (workspaceVisible()) writeRoute(file.id,state.tab);
      workspace.scrollTop = 0;
    }
    if (workspaceVisible() && !new URL(location.href).searchParams.has('workfile')) writeRoute(file.id,state.tab,false);
    document.body.classList.add("animus-work-file-active");
    const previousDraft = state.editor ? [...root.querySelectorAll('[data-animus-field]')].map(input=>[input.dataset.animusField,input.value]) : [];
    root.innerHTML = `<button type="button" class="animus-record-back" data-animus-back>&larr; All Workfiles</button>${editorMarkup(file)}${headerMarkup(file)}${summaryMarkup(file)}${tabsMarkup()}<main class="animus-tab-panel">${panel(file)}</main><input id="animusWorkFileDocumentUpload" type="file" hidden>`;
    const editor = root.querySelector(".animus-inline-editor");
    root.querySelector('[data-animus-open="editFile"]')?.insertAdjacentHTML('afterbegin','<i data-wf-icon="pencil" aria-hidden="true"></i>');
    root.querySelector('.animus-record-actions [data-animus-edit="action"]')?.insertAdjacentHTML('afterbegin','<i data-wf-icon="plus" aria-hidden="true"></i>');
    const more = root.querySelector('.wf-more-trigger');
    if (more) more.innerHTML = '<i data-wf-icon="ellipsis" aria-hidden="true"></i>';
    window.renderAnimusWorkfileIcons?.();
    const contentPanel = root.querySelector("main.animus-tab-panel");
    if (editor && state.editor === "assigned" && root.querySelector(".animus-assigned-card")) {
      root.querySelector(".animus-assigned-card").append(editor);
    } else if (editor && contentPanel) contentPanel.prepend(editor);
    for (const [name,value] of previousDraft) {
      const input = editor?.querySelector(`[data-animus-field="${name}"]`);
      if (input) input.value = value;
    }
    if (state.editor === "progress" && previousDraft.length) {
      const status = editor.querySelector('[data-animus-field="fileStatus"]').value;
      const detail = editor.querySelector('[data-animus-field="statusDetail"]');
      const value = previousDraft.find(([name])=>name === "statusDetail")?.[1];
      const choices = CRM_STATUS_DETAILS[status] || [""];
      detail.replaceChildren(...choices.map(choice=>new Option(choice,choice)));
      if (choices.includes(value)) detail.value = value;
    }
    editor?.querySelector('[data-animus-field="fileStatus"]')?.addEventListener("change", (event) => {
      const choices = CRM_STATUS_DETAILS;
      const detail = editor.querySelector('[data-animus-field="statusDetail"]');
      detail.replaceChildren(...(choices[event.target.value] || [""]).map((value) => new Option(value, value)));
    });
  }

  async function saveEditor() {
    const file = currentFile();
    if (!file) return;
    const fields = [...document.querySelectorAll("[data-animus-field]")];
    const assignmentEdit=['assigned','action'].includes(state.editor);
    const previousValues=Object.fromEntries(fields.map(input=>[input.dataset.animusField,file[input.dataset.animusField]??null]));
    const totalPaidField = fields.find((input) => input.dataset.animusField === "totalPaidOverride");
    fields.forEach((input) => {
      const key = input.dataset.animusField;
      const numericField = ["estimateTotal", "materialTotal", "laborTotal", "totalPaidOverride", "initialDeposit", "midpointDeposit", "finalPaymentAmount", "leadFee"].includes(key);
      file[key] = numericField ? (input.value === "" ? "" : Number(input.value) || 0) : input.value;
    });
    if (state.editor === "financials") {
      file.laborTotal = Number(file.laborTotal) || 0;
      // The Total Paid field is intentionally authoritative when the owner
      // corrects it. Keeping it numeric prevents an older deposit total from
      // reappearing after the work file re-renders.
      if (file.totalPaidOverride !== "") file.totalPaidOverride = Number(file.totalPaidOverride) || 0;
      if (typeof window.syncFileLaborToRevenue === "function") window.syncFileLaborToRevenue(file);
    }
    if (!assignmentEdit && typeof window.addSystemNote === "function") window.addSystemNote(file, "Work file updated.");
    if (assignmentEdit) {
      crmLocalChangeVersion += 1;
      const button = document.querySelector("[data-animus-save-editor]");
      button.disabled = true;
      button.textContent = "Saving...";
      try {
        const values=Object.fromEntries(fields.map(input=>[input.dataset.animusField,file[input.dataset.animusField]]));
        const response=await fetch('/api/mobile-workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'editFile',id:file.id,values,expected:previousValues}),cache:'no-store'});
        const result=await response.json();if(!response.ok||!result.ok)throw Error(result.error||'Assignment save did not finish.');
        const saved = result.record;
        if (!saved || ("assignedTo" in saved && saved.assignedTo !== file.assignedTo)) throw new Error("Cloudflare did not confirm the assignment.");
        file.updatedAt=saved.updatedAt;
        window.showDashboardSaveStatus?.("Assignment saved to Cloudflare.");
      } catch (error) {
        for(const [key,value] of Object.entries(previousValues)){if(value===null)delete file[key];else file[key]=value;}
        button.disabled = false;
        button.textContent = "Retry Save";
        window.showDashboardSaveStatus?.(`${error.message} Your assignment remains in the editor. Retry Save.`, true);
        return;
      }
    }
    if (!assignmentEdit && typeof window.saveCrmFiles === "function") window.saveCrmFiles();
    state.editor = "";
    if (typeof window.renderCrm === "function") window.renderCrm(); else renderWorkFile();
  }

  function completeNextAction() {
    const file = currentFile();
    if (!file) return;
    const action = field(file, "nextAction") || "Next action";
    file.nextAction = "";
    file.nextActionDate = "";
    file.followUpDate = "";
    if (typeof window.addSystemNote === "function") window.addSystemNote(file, `${action} marked complete.`);
    if (typeof window.saveCrmFiles === "function") window.saveCrmFiles();
    if (typeof window.renderCrm === "function") window.renderCrm();
  }

  function openFileNoteModal() {
    if (typeof window.openFileNoteModal === "function") {
      window.openFileNoteModal();
      return;
    }
    const modal = byId("animusFileNoteModal");
    const input = byId("animusFileNoteText");
    const file = currentFile();
    if (!modal || !input || !file?.id) return;
    // The CRM cloud writer uses this ID to attach the note to this exact
    // work file. Without it, the modal could only save a temporary copy.
    modal.dataset.fileId = file.id;
    input.value = "";
    modal.dataset.noteIndex = "";
    const title = byId("animusFileNoteTitle");
    const saveButton = byId("animusFileNoteSave");
    if (title) title.textContent = "Add File Note";
    if (saveButton) saveButton.textContent = "Save Note";
    modal.hidden = false;
    window.setTimeout(() => input.focus(), 0);
  }

  function closeFileNoteModal() {
    const modal = byId("animusFileNoteModal");
    const input = byId("animusFileNoteText");
    if (modal) modal.hidden = true;
    if (input) input.value = "";
  }

  function saveFileNote() {
    if (typeof window.saveFileNoteModal === "function") {
      window.saveFileNoteModal();
      return;
    }
    const file = currentFile();
    const input = byId("animusFileNoteText");
    const text = input?.value.trim();
    if (!file || !text) {
      input?.focus();
      return;
    }
    const stamp = new Date().toISOString();
    file.notes = [...(Array.isArray(file.notes) ? file.notes : []), { id: `note-${Date.now()}`, at: stamp, text, source: "manual" }];
    file.timeline = [...(Array.isArray(file.timeline) ? file.timeline : []), `Note added ${new Date(stamp).toLocaleString("en-US")}`];
    if (typeof window.saveCrmFiles === "function") window.saveCrmFiles();
    closeFileNoteModal();
    if (typeof window.renderCrm === "function") window.renderCrm(); else renderWorkFile();
  }

  function readDocumentAsDataUrl(uploadFile) {
    if (typeof window.readUploadFileAsDataUrl === "function") return window.readUploadFileAsDataUrl(uploadFile);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(reader.result));
      reader.addEventListener("error", () => reject(new Error("Document could not be opened.")));
      reader.readAsDataURL(uploadFile);
    });
  }

  async function uploadWorkFileDocument(input) {
    const file = currentFile();
    const uploadFile = input?.files?.[0];
    if (!file || !uploadFile) return;
    try {
      const dataUrl = await readDocumentAsDataUrl(uploadFile);
      const stamp = new Date().toISOString();
      file.workFileDocuments = Array.isArray(file.workFileDocuments) ? file.workFileDocuments : [];
      file.workFileDocuments = [{
        id: `doc-${Date.now()}`,
        name: uploadFile.name || "Uploaded document",
        type: uploadFile.type || "application/octet-stream",
        size: uploadFile.size || 0,
        dataUrl,
        createdAt: stamp,
        updatedAt: stamp,
      }, ...file.workFileDocuments];
      if (typeof window.addSystemNote === "function") window.addSystemNote(file, `Document uploaded: ${uploadFile.name || "Uploaded document"}.`);
      if (typeof window.saveCrmFiles === "function") window.saveCrmFiles({ syncExpenses: false });
      if (typeof window.saveDashboardToGoogle === "function") window.saveDashboardToGoogle();
      input.value = "";
      if (typeof window.renderCrm === "function") window.renderCrm(); else renderWorkFile();
    } catch (error) {
      input.value = "";
      window.alert?.("Document could not be uploaded. Please try again.");
    }
  }

  function openDataDocument(src, title = "Document") {
    if (!src) return;
    const opened = window.open("", "_blank");
    if (!opened) return;
    const safeTitle = escape(title);
    if (/^data:image\//i.test(src) || /\.(png|jpe?g|gif|webp|heic)$/i.test(title)) {
      opened.document.write(`<!doctype html><title>${safeTitle}</title><style>body{margin:0;background:#0f172a;display:grid;min-height:100vh;place-items:center}img{max-width:96vw;max-height:96vh;object-fit:contain;background:#fff}</style><img src="${src}" alt="${safeTitle}">`);
      return;
    }
    opened.location.href = src;
  }

  function openWorkFileReceipt(id) {
    const file = currentFile();
    const receipts = fileExpenseRecords(file);
    const receipt = receipts.find((entry) => String(entry?.id || "") === String(id || "")) || receipts[0];
    openDataDocument(receiptSource(receipt), receipt?.imageTitle || receipt?.title || receipt?.vendor || "Receipt");
  }

  function openWorkFileDocument(id) {
    const file = currentFile();
    const document = documentRows(file).find((entry) => String(entry?.id || "") === String(id || ""));
    openDataDocument(document?.dataUrl || document?.url || "", document?.name || "Document");
  }

  function openWorkFilePhoto(id) {
    const file = currentFile();
    const photo = workPhotoDocuments(file).find((entry) => String(entry?.id || "") === String(id || ""));
    openDataDocument(photo?.dataUrl || photo?.url || "", photo?.title || photo?.fileName || "Work photo");
  }

  function openExisting(action) {
    if (action === "editFile") {
      if (typeof window.openCrmFileIntakeEditor === "function") window.openCrmFileIntakeEditor();
      return;
    }
    const id = { estimate: "crmOpenEstimate", supplement: "crmCreateSupplement", assignment: "crmOpenAssignment", invoice: "crmOpenInvoice", archive: "crmArchiveFile", delete: "crmDeleteFile" }[action];
    if (action === "payroll") {
      if (typeof window.switchCrmView === "function") window.switchCrmView("payroll");
      return;
    }
    if (action === "expenses") {
      if (typeof window.openFileExpenses === "function") window.openFileExpenses();
      else if (typeof window.switchCrmView === "function") window.switchCrmView("expenses", { expenseScope: "file" });
      return;
    }
    byId(id)?.click();
  }

  document.addEventListener("click", (event) => {
    if (!event.target.closest("details")) {
      document.querySelectorAll(".animus-work-file details[open]").forEach((menu) => { menu.open = false; });
    }
    if (event.target.id === "animusFileNoteModal" || event.target.closest("#animusFileNoteClose, #animusFileNoteCancel")) {
      closeFileNoteModal();
      return;
    }
    if (event.target.closest("#animusFileNoteSave")) {
      saveFileNote();
      return;
    }
    const noteEdit = event.target.closest("[data-animus-note-edit]");
    if (noteEdit) {
      window.openFileNoteModalForEdit?.(Number(noteEdit.dataset.animusNoteEdit));
      return;
    }
    const noteDelete = event.target.closest("[data-animus-note-delete]");
    if (noteDelete) {
      window.deleteFileNote?.(Number(noteDelete.dataset.animusNoteDelete));
      return;
    }
    const target = event.target.closest("[data-animus-tab], [data-animus-edit], [data-animus-save], [data-animus-save-editor], [data-animus-cancel-editor], [data-animus-complete-action], [data-animus-open], [data-animus-add-note], [data-animus-back], [data-animus-summary]");
    const receiptButton = event.target.closest("[data-animus-open-receipt]");
    if (receiptButton) {
      openWorkFileReceipt(receiptButton.dataset.animusOpenReceipt);
      return;
    }
    const documentButton = event.target.closest("[data-animus-open-document]");
    if (documentButton) {
      openWorkFileDocument(documentButton.dataset.animusOpenDocument);
      return;
    }
    const workPhotoButton = event.target.closest("[data-animus-open-work-photo]");
    if (workPhotoButton) {
      openWorkFilePhoto(workPhotoButton.dataset.animusOpenWorkPhoto);
      return;
    }
    const uploadButton = event.target.closest("[data-animus-upload-document]");
    if (uploadButton) {
      const input = byId("animusWorkFileDocumentUpload");
      if (input) { input.accept = uploadButton.textContent.includes('Photo') ? 'image/*' : ''; input.click(); }
      return;
    }
    if (event.target.closest('[data-animus-more-activity]')) { state.activityLimit += 50; renderWorkFile(); return; }
    if (!target) return;
    if (target.dataset.animusTab) { selectTab(target.dataset.animusTab); return; }
    if (target.dataset.animusEdit) {
      state.editor = target.dataset.animusEdit;
      renderWorkFile();
      const editor = document.querySelector("#animusWorkFile .animus-inline-editor");
      editor?.scrollIntoView({ block: "nearest" });
      editor?.querySelector("input, select")?.focus({ preventScroll: true });
      return;
    }
    if (target.hasAttribute("data-animus-save-editor")) { saveEditor(); return; }
    if (target.hasAttribute("data-animus-cancel-editor")) { state.editor = ""; renderWorkFile(); return; }
    if (target.hasAttribute("data-animus-complete-action")) { completeNextAction(); return; }
    if (target.dataset.animusOpen) { openExisting(target.dataset.animusOpen); return; }
    if (target.dataset.animusSummary) {
      if (target.dataset.animusSummary === "estimate") selectTab("estimate");
      else if (target.dataset.animusSummary === "startDate") window.openCrmStartDateModal?.();
      else if (["financials", "details"].includes(target.dataset.animusSummary)) selectTab(target.dataset.animusSummary);
      else if (target.dataset.animusSummary === "payroll") openExisting("payroll");
      else if (target.dataset.animusSummary === "expenses") selectTab("expenses");
      else { state.editor = "action"; renderWorkFile(); }
      return;
    }
    if (target.hasAttribute("data-animus-add-note")) {
      openFileNoteModal();
      return;
    }
    if (target.hasAttribute("data-animus-save")) {
      if (typeof window.saveCrmFiles === "function") window.saveCrmFiles();
      if (typeof window.saveDashboardToGoogle === "function") window.saveDashboardToGoogle();
      renderWorkFile();
      return;
    }
    if (target.hasAttribute("data-animus-back")) {
      routeRequested = null; writeRoute(null,"overview"); setPanelCollapsed(false);
      document.querySelectorAll('[data-workfile-list-tab]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.workfileListTab==='all')));
      if (typeof window.clearActiveCrmFileSelection === "function") window.clearActiveCrmFileSelection();
      document.querySelector(".crm-file-list-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  document.addEventListener("change", (event) => {
    if (event.target?.id === "animusWorkFileDocumentUpload") uploadWorkFileDocument(event.target);
  });

  document.addEventListener('click',async event=>{
    const toggle = event.target.closest?.('#animusWorkFilesCollapse');
    if (toggle) setPanelCollapsed(document.querySelector('.animus-work-files-layout')?.classList.contains('animus-work-files-collapsed'));
    const tab = event.target.closest?.('[data-workfile-list-tab]');
    if (!tab) return;
    document.querySelectorAll('[data-workfile-list-tab]').forEach(button=>button.setAttribute('aria-pressed',String(button===tab)));
    if (typeof window.activateCrmFilter === 'function') window.activateCrmFilter('all');
    if (tab.dataset.workfileListTab === 'my' && !identity) {
      tab.disabled = true;
      try {
        const response = await fetch('/api/session',{cache:'no-store'}), result = await response.json();
        if (!response.ok || !result.user) throw Error('Your account could not be verified. Retry My Work.');
        identity = result.user;
      } catch(error) { window.alert(error.message); }
      finally { tab.disabled = false; }
    }
    window.renderCrm?.();
  });

  document.addEventListener('click',event=>{
    if (event.target.closest?.('#crmFileList [data-file-id]')) {
      if (state.editor && !confirm('Discard unsaved workfile edits and open another file?')) { event.preventDefault(); event.stopImmediatePropagation(); }
      return;
    }
    const section = event.target.closest?.('[data-animus-shell-view], [data-crm-view]');
    if (section && (section.dataset.animusShellView || section.dataset.crmView) !== 'files') { writeRoute(null,state.tab,false); return; }
    if (!section) return;
    if (state.editor && !confirm('Discard unsaved workfile edits and return to the list?')) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    state.editor = ''; routeRequested = null; writeRoute(null,'overview');
    document.querySelectorAll('[data-workfile-list-tab]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.workfileListTab==='open')));
    window.selectAnimusWorkfile?.(null); setPanelCollapsed(false);
  },true);

  document.addEventListener('keydown',event=>{
    if(event.key==='Escape' && !state.editor && currentFile())setPanelCollapsed(true);
  });
  window.addEventListener('resize',()=>setPanelCollapsed(Boolean(document.querySelector('.animus-work-files-layout')?.classList.contains('animus-work-files-collapsed'))));

  const originalRenderCrm = window.renderCrm;
  if (typeof originalRenderCrm === "function") {
    window.renderCrm = function animusWorkFileRenderCrm() {
      const result = originalRenderCrm.apply(this, arguments);
      renderWorkFile();
      return result;
    };
  }
  window.addEventListener("DOMContentLoaded", renderWorkFile);
  window.addEventListener('load',()=>setTimeout(()=>{
    const id = new URL(location.href).searchParams.get('workfile');
    if (id && currentFile()?.id === id) window.switchCrmView?.('files');
  },0));
  setTimeout(renderWorkFile, 0);
}());
