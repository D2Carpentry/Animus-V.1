/* ANIMUS work file redesign. This is a read-first view over the existing CRM record. */
(function () {
  "use strict";

  const state = { tab: "overview", editor: "" };
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
    if (["Closed / Paid", "Job Lost / Closed"].includes(status)) return "closed";
    if (["In Progress", "Job Won", "Work Completed"].includes(status)) return "active";
    if (["In Negotiation", "Contact Attempted"].includes(status)) return "warning";
    return "open";
  }

  function assignment(file) {
    return field(file, "assignedTo") || field(file, "assignedEmployee") || field(file, "employee") || field(file, "team") || "Unassigned";
  }

  function paidTotal(file) {
    const estimate = Number(file?.estimateTotal) || 0;
    if (field(file, "paidInFull") === "Yes") return estimate;
    return (Number(file?.initialDeposit) || Number(file?.depositTotal) || 0) + (Number(file?.midpointDeposit) || 0) + (Number(file?.finalPaymentAmount) || 0);
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
      detail: field(note, "text") || "Note recorded",
      at: note?.editedAt || note?.at || "",
    }));
    const timelineRows = timeline.map((entry, index) => {
      if (typeof entry === "string") return { id: `timeline-${index}`, kind: "system", title: "System activity", detail: entry, at: "" };
      if (entry && typeof entry === "object") {
        const detail = field(entry, "text") || field(entry, "message") || field(entry, "description") || field(entry, "title") || field(entry, "action") || "System activity recorded";
        return { id: `timeline-${index}`, kind: field(entry, "type") || "system", title: field(entry, "title") || "System activity", detail, at: entry.at || entry.createdAt || entry.updatedAt || "" };
      }
      return { id: `timeline-${index}`, kind: "system", title: "System activity", detail: "System activity recorded", at: "" };
    });
    return [...noteRows, ...timelineRows].sort((a, b) => (Date.parse(b.at || "") || 0) - (Date.parse(a.at || "") || 0));
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
    return `<div class="animus-activity">${rows.map((row) => `<article class="animus-activity-row"><span class="animus-activity-icon">${escape(activityIcon(row))}</span><div class="animus-activity-main"><strong>${escape(row.title)}</strong><p>${escape(row.detail === "[object Object]" ? "System activity recorded" : row.detail)}</p></div><time class="animus-activity-time">${escape(row.at ? date(row.at.slice(0, 10)) : "")}</time></article>`).join("")}</div>`;
  }

  function stageIndex(file) {
    const status = field(file, "fileStatus");
    if (status === "New Lead") return 0;
    if (["Contact Established", "Contact Attempted"].includes(status)) return 1;
    if (status === "Inspection Completed") return 2;
    if (status === "In Negotiation") return 3;
    if (status === "Job Won") return 4;
    if (status === "In Progress") return 5;
    if (["Work Completed", "Closed / Paid"].includes(status)) return 6;
    return -1;
  }

  function progressMarkup(file) {
    const stages = ["Lead", "Contacted", "Inspection", "Estimate Sent", "Won", "In Progress", "Complete"];
    const index = stageIndex(file);
    const isClosedLost = field(file, "fileStatus") === "Job Lost / Closed";
    return `<section class="animus-info-card animus-progress-card"><div class="animus-card-head"><h3><span class="card-mark">&#9873;</span> Job Progress</h3><button class="animus-record-button small" data-animus-edit="progress">Edit</button></div><div class="animus-progress-line">${stages.map((stage, step) => `<div class="animus-progress-step ${step < index ? "done" : step === index ? "current" : ""}"><span class="animus-progress-dot">${step < index ? "&#10003;" : ""}</span><span>${stage}</span></div>`).join("")}</div><div class="animus-status-details"><div><span>Current Status</span><strong class="${isClosedLost ? "closed-value" : ""}">${escape(field(file, "fileStatus", "New Lead"))}</strong></div><div><span>Status Detail</span><strong>${escape(field(file, "statusDetail", "Not set"))}</strong></div></div></section>`;
  }

  function customerCard(file) {
    const phone = field(file, "clientPhone");
    const email = field(file, "clientEmail");
    const address = field(file, "projectAddress");
    return `<section class="animus-info-card"><div class="animus-card-head"><h3><span class="card-mark">&#9787;</span> Customer</h3><button class="animus-record-button small" data-animus-edit="customer">Edit</button></div><dl class="animus-info-list"><div class="animus-info-row"><span class="item-icon">&#9742;</span><div><dt>Phone</dt><dd>${escape(phone || "Not added")}</dd></div>${phone ? `<a class="row-action" href="tel:${escape(phone.replace(/[^+\d]/g, ""))}" aria-label="Call customer">&#9742;</a>` : ""}</div><div class="animus-info-row"><span class="item-icon">&#9993;</span><div><dt>Email</dt><dd>${escape(email || "Not added")}</dd></div>${email ? `<a class="row-action" href="mailto:${escape(email)}" aria-label="Email customer">&#9993;</a>` : ""}</div><div class="animus-info-row"><span class="item-icon">&#9679;</span><div><dt>Address</dt><dd>${escape(address || "Not added")}</dd></div>${address ? `<a class="row-action" target="_blank" rel="noreferrer" href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(address)}" aria-label="Open map">&#9679;</a>` : ""}</div></dl></section>`;
  }

  function projectCard(file) {
    return `<section class="animus-info-card"><div class="animus-card-head"><h3><span class="card-mark">&#128193;</span> Project &amp; Source</h3><button class="animus-record-button small" data-animus-edit="project">Edit</button></div><dl class="animus-info-list"><div class="animus-info-row"><span class="item-icon">&#9881;</span><div><dt>Project Type</dt><dd>${escape(field(file, "projectType", "Other"))}</dd></div></div><div class="animus-info-row"><span class="item-icon">&#128172;</span><div><dt>Lead Source</dt><dd>${escape(field(file, "leadSource", "Not added"))}</dd></div></div></dl></section>`;
  }

  function nextActionCard(file) {
    const action = field(file, "nextAction");
    const due = field(file, "nextActionDate") || field(file, "followUpDate");
    if (!action && !due) return `<section class="animus-info-card"><div class="animus-card-head"><h3><span class="card-mark">&#9678;</span> Next Action</h3><button class="animus-record-button small" data-animus-edit="action">Edit</button></div><p class="animus-next-empty">No next action is scheduled for this file.</p></section>`;
    return `<section class="animus-info-card"><div class="animus-card-head"><h3><span class="card-mark">&#9678;</span> Next Action</h3><button class="animus-record-button small" data-animus-edit="action">Edit</button></div><div class="animus-next-inner"><div class="animus-next-highlight"><span class="animus-next-icon">&#128197;</span><div><strong>${escape(action || "Follow Up")}</strong><p>${escape(file.statusDetail || "Review project details and next steps.")}</p></div></div><div class="animus-next-meta"><div><span>Due Date</span><strong>${escape(date(due))}</strong></div><div><span>Assigned To</span><strong>${escape(assignment(file))}</strong></div></div><button class="animus-record-button primary" data-animus-complete-action>Mark Complete</button></div></section>`;
  }

  function importantNotesCard(file) {
    const note = [...(Array.isArray(file?.notes) ? file.notes : [])].reverse().find((entry) => field(entry, "text"));
    return `<section class="animus-info-card"><div class="animus-card-head"><h3><span class="card-mark">&#9744;</span> Important Notes</h3><button class="animus-record-button small" data-animus-add-note>Add Note</button></div>${note ? `<div class="animus-important-note"><p>${escape(note.text)}</p><small>Updated ${escape(date((note.editedAt || note.at || "").slice(0, 10)))} by D2 Carpentry &amp; Design</small></div>` : `<p class="animus-next-empty">No notes yet. Add a note when something needs attention.</p>`}</section>`;
  }

  function summaryMarkup(file) {
    const estimate = Number(file.estimateTotal) || 0;
    const paid = paidTotal(file);
    const balance = Math.max(estimate - paid, 0);
    const next = field(file, "nextAction") || "No action set";
    const nextDate = field(file, "nextActionDate") || field(file, "followUpDate");
    const cells = [
      ["&#36;", "Estimate", money(estimate), "", "", "estimate"], ["&#9638;", "Paid", money(paid), ""], ["&#128179;", "Balance", money(balance), "", "balance"], ["&#128197;", "Next Action", next, nextDate ? date(nextDate) : "", "", "action"], ["&#128197;", "Start Date", field(file, "startDate") ? date(file.startDate) : "Not set", ""], ["&#9787;", "Assigned To", assignment(file), ""],
    ];
    return `<div class="animus-summary-strip">${cells.map(([icon, label, value, sub, extra, action]) => `<button class="animus-summary-cell ${extra || ""} ${action ? "clickable" : ""}"${action ? ` data-animus-summary="${action}"` : ""}><span class="animus-summary-icon">${icon}</span><span class="animus-summary-copy"><span>${escape(label)}</span><strong>${escape(value)}</strong>${sub ? `<small>${escape(sub)}</small>` : ""}</span></button>`).join("")}</div>`;
  }

  function tabsMarkup() {
    const tabs = [["overview", "Overview", "&#8962;"], ["activity", "Activity", "&#9678;"], ["financials", "Financials", "&#36;"], ["expenses", "Expenses", "&#9638;"], ["documents", "Documents", "&#128196;"], ["details", "Job Details", "&#9881;"]];
    return `<nav class="animus-record-tabs" aria-label="Work file sections">${tabs.map(([id, label, icon]) => `<button class="animus-record-tab ${state.tab === id ? "active" : ""}" data-animus-tab="${id}"><span>${icon}</span>${label}</button>`).join("")}</nav>`;
  }

  function overviewPanel(file) {
    return `<div class="animus-work-grid"><div class="animus-work-column">${customerCard(file)}${projectCard(file)}</div><div class="animus-work-column">${progressMarkup(file)}<section class="animus-info-card"><div class="animus-card-head"><h3><span class="card-mark">&#126;</span> Recent Activity</h3><button class="animus-record-button small" data-animus-tab="activity">View all activity</button></div>${activityMarkup(file, 5)}</section></div><div class="animus-work-column right">${nextActionCard(file)}${importantNotesCard(file)}</div></div>`;
  }

  function activityPanel(file) {
    return `<div class="animus-tab-panel"><section class="animus-info-card"><div class="animus-card-head"><h3>Activity</h3><button class="animus-record-button small" data-animus-add-note>Add Note</button></div>${activityMarkup(file, 100)}</section></div>`;
  }

  function financialsPanel(file) {
    const estimate = Number(file.estimateTotal) || 0, paid = paidTotal(file), balance = Math.max(estimate - paid, 0), material = Number(file.materialTotal) || 0;
    const values = [["Estimate Amount", money(estimate), ""], ["Materials", money(material), ""], ["Total Paid", money(paid), ""], ["Balance Owed", money(balance), balance ? "danger" : ""]];
    return `<div class="animus-tab-panel"><div class="animus-financial-grid">${values.map(([label, value, tone]) => `<article class="animus-financial-value ${tone}"><span>${label}</span><strong>${value}</strong></article>`).join("")}</div><div class="animus-action-row"><button class="animus-record-button primary" data-animus-edit="financials">Edit Financials</button><button class="animus-record-button" data-animus-open="invoice">Open Invoice</button></div></div>`;
  }

  function expensesPanel(file) {
    const records = Array.isArray(file.animusExpenseLedgerV4) ? file.animusExpenseLedgerV4 : [];
    return `<div class="animus-tab-panel"><section class="animus-info-card"><div class="animus-card-head"><h3>Expenses</h3><button class="animus-record-button primary small" data-animus-open="expenses">Open Expense Center</button></div>${records.length ? `<div class="animus-activity">${records.map((entry) => `<article class="animus-activity-row"><span class="animus-activity-icon">R</span><div class="animus-activity-main"><strong>${escape(entry.vendor || entry.title || "Expense")}</strong><p>${escape(entry.category || "Other")} · ${escape(date(entry.date))}</p></div><time class="animus-activity-time">${money(entry.amount)}</time></article>`).join("")}</div>` : `<div class="animus-empty-panel">No saved expenses for this file.</div>`}</section></div>`;
  }

  function documentsPanel(file) {
    const supplements = Array.isArray(file.supplements) ? file.supplements : [];
    return `<div class="animus-tab-panel"><section class="animus-info-card"><div class="animus-card-head"><h3>Documents</h3></div><div class="animus-empty-panel">${supplements.length ? `${supplements.length} supplement${supplements.length === 1 ? "" : "s"} saved for this file.` : "Estimates, invoices, supplements, receipts, and other documents for this file are available here."}<div class="animus-action-row"><button class="animus-record-button" data-animus-open="estimate">Estimate</button><button class="animus-record-button" data-animus-open="invoice">Invoice</button><button class="animus-record-button" data-animus-open="assignment">Assignment</button></div></div></section></div>`;
  }

  function detailsPanel(file) {
    const rows = [["Contact Email Sent", field(file, "contactEmailSent", "No")], ["Contact Text Sent", field(file, "contactTextSent", "No")], ["Inspection Date", field(file, "inspectionDate") ? date(file.inspectionDate) : "Not set"], ["Inspection Time", field(file, "inspectionTime", "Not set")], ["Arrival Window", field(file, "arrivalWindow", "Open")], ["Start Date", field(file, "startDate") ? date(file.startDate) : "Not set"], ["Follow-Up Date", field(file, "followUpDate") ? date(file.followUpDate) : "Not set"], ["Anticipated Completion", field(file, "anticipatedCompletionDate") ? date(file.anticipatedCompletionDate) : "Not set"], ["Invoice Sent", field(file, "invoiceSent", "No")], ["Review Requested", field(file, "reviewRequested", "No")], ["Closing Call", field(file, "closingCallCompleted", "No")], ["Warranty", field(file, "warrantyStatus", "Not Sent")]];
    return `<div class="animus-tab-panel"><section class="animus-info-card"><div class="animus-card-head"><h3>Job Details</h3><button class="animus-record-button primary small" data-animus-edit="details">Edit Job Details</button></div><div class="animus-detail-grid">${[rows.slice(0, 4), rows.slice(4, 8), rows.slice(8)].map((group, index) => `<section class="animus-detail-card"><dl class="animus-info-list">${group.map(([label, value]) => `<div class="animus-info-row"><div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div></div>`).join("")}</dl></section>`).join("")}</div></section></div>`;
  }

  function editorMarkup(file) {
    if (!state.editor) return "";
    const select = (name, value, options) => `<label>${name}<select data-animus-field="${name}">${options.map((option) => `<option${option === value ? " selected" : ""}>${escape(option)}</option>`).join("")}</select></label>`;
    const input = (name, label, value, type = "text", wide = "") => `<label class="${wide}">${label}<input data-animus-field="${name}" type="${type}" value="${escape(value)}"></label>`;
    let title = "Edit File", fields = "";
    if (state.editor === "customer") fields = input("clientName", "Name", field(file, "clientName")) + input("clientPhone", "Phone", field(file, "clientPhone")) + input("clientEmail", "Email", field(file, "clientEmail"), "email") + input("projectAddress", "Address", field(file, "projectAddress"), "text", "wide");
    if (state.editor === "project") fields = select("projectType", field(file, "projectType", "Other"), window.CRM_PROJECT_TYPES || ["Closet", "Pantry", "Cabinetry", "Refinishing", "Built-In", "Other"]) + select("leadSource", field(file, "leadSource", "Manual"), ["Manual", "Angi", "Website", "Phone", "Text", "Referral", "Repeat Customer", "Other"]);
    if (state.editor === "progress") {
      const statuses = ["New Lead", "Contact Established", "Contact Attempted", "Inspection Completed", "In Negotiation", "Job Won", "In Progress", "Work Completed", "Closed / Paid", "Job Lost / Closed"];
      const statusDetails = { "New Lead":["Needs Contact", "Contact Scheduled"], "Contact Established":["Inspection Date Set", "Inspection Pending"], "Contact Attempted":["Follow Up Tomorrow"], "Inspection Completed":["Estimate Pending", "Estimate Sent"], "In Negotiation":["Follow-Up Scheduled", "Waiting on Customer"], "Job Won":["Start Date Established", "Start Date Pending"], "In Progress":["On Schedule", "Completion Date Needed"], "Work Completed":["Closing Call Made", "Closing Call Needed"], "Closed / Paid":["Invoice Sent", "Invoice Not Sent"], "Job Lost / Closed":["Future Marketing Follow-Up"] };
      const selectedStatus = field(file, "fileStatus", "New Lead");
      fields = select("fileStatus", selectedStatus, statuses) + select("statusDetail", field(file, "statusDetail"), statusDetails[selectedStatus] || [field(file, "statusDetail")]);
    }
    if (state.editor === "action") fields = input("nextAction", "Next Action", field(file, "nextAction"), "text", "wide") + input("nextActionDate", "Due Date", field(file, "nextActionDate") || field(file, "followUpDate"), "date") + input("assignedTo", "Assigned To", assignment(file));
    if (state.editor === "financials") fields = input("estimateTotal", "Estimate Amount", Number(file.estimateTotal) || "", "number") + input("materialTotal", "Materials", Number(file.materialTotal) || "", "number") + input("initialDeposit", "Initial Deposit", Number(file.initialDeposit) || "", "number") + input("midpointDeposit", "Midpoint Deposit", Number(file.midpointDeposit) || "", "number") + input("finalPaymentAmount", "Final Payment", Number(file.finalPaymentAmount) || "", "number");
    if (state.editor === "details") fields = input("inspectionDate", "Inspection Date", field(file, "inspectionDate"), "date") + input("inspectionTime", "Inspection Time", field(file, "inspectionTime"), "time") + input("startDate", "Start Date", field(file, "startDate"), "date") + input("followUpDate", "Follow-Up Date", field(file, "followUpDate"), "date") + input("anticipatedCompletionDate", "Anticipated Completion", field(file, "anticipatedCompletionDate"), "date") + select("arrivalWindow", field(file, "arrivalWindow", "Open"), ["Open", "7:00 AM", "8:00 AM", "9:00 AM", "10:00 AM", "Afternoon"]);
    title = state.editor === "financials" ? "Edit Financials" : state.editor === "details" ? "Edit Job Details" : "Edit File";
    return `<section class="animus-inline-editor"><h3>${title}</h3><div class="animus-inline-editor-grid">${fields}</div><div class="animus-action-row"><button class="animus-record-button primary" data-animus-save-editor>Save Changes</button><button class="animus-record-button" data-animus-cancel-editor>Cancel</button></div></section>`;
  }

  function panel(file) {
    if (state.tab === "activity") return activityPanel(file);
    if (state.tab === "financials") return financialsPanel(file);
    if (state.tab === "expenses") return expensesPanel(file);
    if (state.tab === "documents") return documentsPanel(file);
    if (state.tab === "details") return detailsPanel(file);
    return overviewPanel(file);
  }

  function renderWorkFile() {
    const workspace = document.querySelector(".crm-file-workspace");
    if (!workspace) return;
    let root = document.querySelector("#animusWorkFile");
    if (!root) { root = document.createElement("section"); root.id = "animusWorkFile"; root.className = "animus-work-file"; workspace.prepend(root); }
    const file = currentFile();
    if (!file) { root.innerHTML = `<div class="animus-empty-panel">Select a work file to see its details.</div>`; return; }
    document.body.classList.add("animus-work-file-active");
    const phone = field(file, "clientPhone").replace(/[^+\d]/g, "");
    const email = field(file, "clientEmail");
    const address = field(file, "projectAddress");
    root.innerHTML = `<button class="animus-record-back" data-animus-back>&larr; Back to CRM / Files</button>${editorMarkup(file)}<header class="animus-record-header"><div class="animus-record-person"><div class="animus-record-avatar">${escape(initials(file.clientName))}</div><div class="animus-record-title"><h2>${escape(file.clientName || "Unnamed Client")}</h2><p class="animus-record-file-number">Project # ${escape(file.fileNumber || "Not assigned")}</p><p class="animus-record-subtitle">${escape(field(file, "projectType", "Other"))} &bull; ${escape(address || "Location not added")}</p><span class="animus-status-badge animus-status-${statusTone(file.fileStatus)}">${escape(field(file, "fileStatus", "New Lead"))}</span></div></div><div class="animus-record-actions"><button class="animus-record-button" data-animus-edit="customer">Edit File</button><details class="animus-more-menu"><summary class="animus-record-button">More &#8964;</summary><div class="animus-more-menu-panel"><button class="animus-record-button" data-animus-open="estimate">Estimate</button><button class="animus-record-button" data-animus-open="supplement">Supplement</button><button class="animus-record-button" data-animus-open="assignment">Assignment</button><button class="animus-record-button" data-animus-open="invoice">Invoice</button><button class="animus-record-button" data-animus-open="archive">Archive</button><button class="animus-record-button danger" data-animus-open="delete">Delete File</button></div></details><button class="animus-record-button primary" data-animus-save>Save</button></div></header><div class="animus-contact-actions">${phone ? `<a class="animus-record-button" href="tel:${escape(phone)}">Call</a><a class="animus-record-button" href="sms:${escape(phone)}">Text</a>` : ""}${email ? `<a class="animus-record-button" href="mailto:${escape(email)}">Email</a>` : ""}${address ? `<a class="animus-record-button" href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(address)}" target="_blank" rel="noreferrer">Location</a>` : ""}</div>${summaryMarkup(file)}${tabsMarkup()}<main class="animus-tab-panel">${panel(file)}</main>`;
    const editor = root.querySelector(".animus-inline-editor");
    const contentPanel = root.querySelector("main.animus-tab-panel");
    if (editor && contentPanel) contentPanel.prepend(editor);
  }

  function saveEditor() {
    const file = currentFile();
    if (!file) return;
    document.querySelectorAll("[data-animus-field]").forEach((input) => { file[input.dataset.animusField] = input.value; });
    if (typeof window.addSystemNote === "function") window.addSystemNote(file, "Work file updated.");
    if (typeof window.saveCrmFiles === "function") window.saveCrmFiles();
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

  function openExisting(action) {
    const id = { estimate: "crmOpenEstimate", supplement: "crmCreateSupplement", assignment: "crmOpenAssignment", invoice: "crmOpenInvoice", archive: "crmArchiveFile", delete: "crmDeleteFile" }[action];
    if (action === "expenses") {
      if (typeof window.openFileExpenses === "function") window.openFileExpenses();
      else if (typeof window.switchCrmView === "function") window.switchCrmView("expenses");
      return;
    }
    byId(id)?.click();
  }

  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-animus-tab], [data-animus-edit], [data-animus-save], [data-animus-save-editor], [data-animus-cancel-editor], [data-animus-complete-action], [data-animus-open], [data-animus-add-note], [data-animus-back], [data-animus-summary]");
    if (!target) return;
    if (target.dataset.animusTab) { state.tab = target.dataset.animusTab; state.editor = ""; renderWorkFile(); return; }
    if (target.dataset.animusEdit) { state.editor = target.dataset.animusEdit; renderWorkFile(); return; }
    if (target.hasAttribute("data-animus-save-editor")) { saveEditor(); return; }
    if (target.hasAttribute("data-animus-cancel-editor")) { state.editor = ""; renderWorkFile(); return; }
    if (target.hasAttribute("data-animus-complete-action")) { completeNextAction(); return; }
    if (target.dataset.animusOpen) { openExisting(target.dataset.animusOpen); return; }
    if (target.dataset.animusSummary) {
      if (target.dataset.animusSummary === "estimate") openExisting("estimate");
      else { state.editor = "action"; renderWorkFile(); }
      return;
    }
    if (target.hasAttribute("data-animus-add-note")) {
      const file = currentFile();
      const text = window.prompt("Add a note to this work file:");
      if (file && text && text.trim()) {
        const stamp = new Date().toISOString();
        file.notes = [...(Array.isArray(file.notes) ? file.notes : []), { at: stamp, text: text.trim() }];
        file.timeline = [...(Array.isArray(file.timeline) ? file.timeline : []), `Note added ${new Date(stamp).toLocaleString("en-US")}`];
        if (typeof window.saveCrmFiles === "function") window.saveCrmFiles();
        if (typeof window.renderCrm === "function") window.renderCrm();
      }
      return;
    }
    if (target.hasAttribute("data-animus-save")) { if (typeof window.saveActiveFile === "function") window.saveActiveFile(); if (typeof window.saveDashboardToGoogle === "function") window.saveDashboardToGoogle(); renderWorkFile(); return; }
    if (target.hasAttribute("data-animus-back")) {
      const filter = byId("crmFileFilter");
      if (filter) filter.value = "all";
      if (typeof window.renderCrm === "function") window.renderCrm();
      document.querySelector(".crm-file-list-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  const originalRenderCrm = window.renderCrm;
  if (typeof originalRenderCrm === "function") {
    window.renderCrm = function animusWorkFileRenderCrm() {
      const result = originalRenderCrm.apply(this, arguments);
      renderWorkFile();
      return result;
    };
  }
  window.addEventListener("DOMContentLoaded", renderWorkFile);
  setTimeout(renderWorkFile, 0);
}());
