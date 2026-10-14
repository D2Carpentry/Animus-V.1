// Contacts is a directory over the existing CRM work files.
// Manual contacts become normal New Lead work files, so there is one source of truth.
(() => {
  let editingContactId = "";
  let unsavedNewContactId = "";
  let showRemoved = false;
  let modalTrigger = null;
  const root = () => document.querySelector("#animusContactsRoot");
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[character]));
  const display = (value, fallback = "Not provided") => String(value || "").trim() || fallback;
  const phoneHref = (value) => `tel:${String(value || "").replace(/[^\d+]/g, "")}`;
  const textHref = (value) => `sms:${String(value || "").replace(/[^\d+]/g, "")}`;
  const mapHref = (value) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value || "")}`;

  async function persistContact(file, isNew = false) {
    crmLocalChangeVersion += 1;
    saveCrmFiles({ syncExpenses:false });
    const fields = ["id", "fileNumber", "clientName", "clientPhone", "clientEmail", "projectAddress", "leadSource", "contactHidden", "timeline"];
    const record = isNew ? file : Object.fromEntries(fields.filter((key) => key in file).map((key) => [key, file[key]]));
    const result = await queueDashboardCloudSave({ action:"dashboardSync", dashboardFiles:[record] });
    const saved = (result?.dashboard || result?.verification)?.dashboardFiles?.find((entry) => entry.id === file.id);
    if (!saved || fields.filter((key) => key in record && key in saved && key !== "timeline").some((key) => saved[key] !== record[key])) throw new Error("Cloudflare did not confirm the contact changes. Your edits remain available. Retry or use Save All.");
  }

  function contactFiles() {
    return (typeof crmFiles === "undefined" ? [] : crmFiles)
      .filter((file) => file && (!file.contactHidden || showRemoved) && (file.clientName || file.clientPhone || file.clientEmail || file.projectAddress))
      .slice()
      .sort((first, second) => String(first.clientName || "").localeCompare(String(second.clientName || "")));
  }

  function contactRow(file) {
    const hasPhone = Boolean(String(file.clientPhone || "").trim());
    const hasEmail = Boolean(String(file.clientEmail || "").trim());
    const hasAddress = Boolean(String(file.projectAddress || "").trim());
    return `<article class="animus-contact-row">
      <button class="animus-contact-name" type="button" data-animus-contact-file="${escapeHtml(file.id)}" title="Open ${escapeHtml(file.clientName || "customer")} work file">
        <span class="animus-contact-avatar">${escapeHtml(String(file.clientName || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?")}</span>
        <span><strong>${escapeHtml(display(file.clientName, "Unnamed customer"))}</strong><small>${escapeHtml(display(file.fileNumber, "No file number"))} · ${escapeHtml(display(file.fileStatus, "New Lead"))}</small></span>
      </button>
      <div class="animus-contact-detail"><span class="animus-contact-label">Phone</span>${hasPhone ? `<a href="${escapeHtml(phoneHref(file.clientPhone))}">${escapeHtml(file.clientPhone)}</a>` : `<span class="animus-contact-missing">Not provided</span>`}</div>
      <div class="animus-contact-actions">${hasPhone ? `<a href="${escapeHtml(phoneHref(file.clientPhone))}" title="Call ${escapeHtml(file.clientName)}">Call</a><a href="${escapeHtml(textHref(file.clientPhone))}" title="Text ${escapeHtml(file.clientName)}">Text</a>` : "—"}</div>
      <div class="animus-contact-detail"><span class="animus-contact-label">Email</span>${hasEmail ? `<a href="mailto:${escapeHtml(file.clientEmail)}">${escapeHtml(file.clientEmail)}</a>` : `<span class="animus-contact-missing">Not provided</span>`}</div>
      <div class="animus-contact-detail animus-contact-address"><span class="animus-contact-label">Address</span>${hasAddress ? `<a href="${escapeHtml(mapHref(file.projectAddress))}" target="_blank" rel="noopener">${escapeHtml(file.projectAddress)}</a>` : `<span class="animus-contact-missing">Not provided</span>`}</div>
      <div class="animus-contact-manage"><button type="button" data-contact-edit="${escapeHtml(file.id)}" title="Edit contact">Edit</button><button type="button" data-contact-remove="${escapeHtml(file.id)}" class="contact-remove">${file.contactHidden ? "Restore" : "Remove"}</button></div>
    </article>`;
  }

  function render() {
    const target = root();
    if (!target) return;
    const files = contactFiles();
    target.innerHTML = `<section class="animus-contacts-shell">
      <header class="animus-contacts-header">
        <div><p class="animus-contacts-eyebrow">CRM Directory</p><h1>Contacts</h1><p>Every customer contact from your ANIMUS work files.</p></div>
        <div class="animus-contacts-header-actions"><div class="animus-contacts-count"><strong>${files.length}</strong><span>Contact${files.length === 1 ? "" : "s"}</span></div><button class="animus-contact-add" type="button" id="animusAddContact">+ Add Contact</button></div>
      </header>
      <section class="animus-contacts-card">
        <div class="animus-contacts-toolbar"><label><span class="sr-only">Search contacts</span><input id="animusContactsSearch" type="search" placeholder="Search name, phone, email, address, or file #"></label><label class="animus-contacts-removed"><input id="animusContactsShowRemoved" type="checkbox"${showRemoved ? " checked" : ""}> Show removed</label><span id="animusContactsResultCount">${files.length} shown</span></div>
        <div class="animus-contact-list" id="animusContactList">${files.length ? files.map(contactRow).join("") : `<div class="animus-contacts-empty"><strong>No contacts yet.</strong><span>New customer files will appear here automatically.</span></div>`}</div>
      </section>
    </section>
    <div class="animus-contact-modal-backdrop" id="animusContactModal" hidden>
      <section class="animus-contact-modal" role="dialog" aria-modal="true" aria-labelledby="animusContactModalTitle">
        <header><div><p>NEW CONTACT</p><h2 id="animusContactModalTitle">Add Contact</h2><span>This creates a New Lead work file with an automatic file number.</span></div><button type="button" class="animus-contact-close" id="animusContactClose" aria-label="Close">×</button></header>
        <form id="animusContactForm">
          <label>Customer Name<input id="animusContactName" name="name" autocomplete="name" required placeholder="Customer name"></label>
          <div class="animus-contact-form-grid"><label>Phone<input id="animusContactPhone" name="phone" autocomplete="tel" type="tel" placeholder="(239) 555-0100"></label><label>Email<input id="animusContactEmail" name="email" autocomplete="email" type="email" placeholder="name@email.com"></label></div>
          <label>Address<input id="animusContactAddress" name="address" autocomplete="street-address" placeholder="Project address"></label>
          <label>Lead Source<select id="animusContactLeadSource" name="leadSource"><option value="Manual">Manual</option><option value="Phone">Phone</option><option value="Website">Website</option><option value="Angi">Angi</option><option value="Referral">Referral</option><option value="Social Media">Social Media</option></select></label>
          <p class="animus-contact-form-error" id="animusContactFormError" hidden></p>
          <footer><button type="button" class="animus-contact-cancel" id="animusContactCancel">Cancel</button><button type="submit" class="animus-contact-create">Create Contact</button></footer>
        </form>
      </section>
    </div>`;
    bind();
  }

  function bind() {
    const modal = document.querySelector("#animusContactModal");
    const setModalOpen = (open) => {
      if (!modal) return;
      modal.hidden = !open;
      if (open) window.setTimeout(() => document.querySelector("#animusContactName")?.focus(), 0);
      else modalTrigger?.focus();
    };
    const openContactEditor = (file) => {
      modalTrigger = document.activeElement;
      editingContactId = file?.id || "";
      document.querySelector("#animusContactModalTitle").textContent = file ? "Edit Contact" : "Add Contact";
      modal.querySelector("header p").textContent = file ? "CONTACT DETAILS" : "NEW CONTACT";
      modal.querySelector("header span").textContent = file ? "Updates this customer's associated work file." : "This creates a New Lead work file with an automatic file number.";
      modal.querySelector("button[type=submit]").textContent = file ? "Save Contact" : "Create Contact";
      document.querySelector("#animusContactForm").reset();
      document.querySelector("#animusContactFormError").hidden = true;
      [["Name","clientName"],["Phone","clientPhone"],["Email","clientEmail"],["Address","projectAddress"],["LeadSource","leadSource"]].forEach(([suffix,key]) => {
        const field = document.querySelector(`#animusContact${suffix}`);
        if (file && key === "leadSource" && ![...field.options].some((option) => option.value === file[key])) field.add(new Option(file[key],file[key]));
        field.value = file?.[key] || (key === "leadSource" ? "Manual" : "");
      });
      setModalOpen(true);
    };
    document.querySelector("#animusAddContact")?.addEventListener("click", () => openContactEditor(null));
    document.querySelector("#animusContactsShowRemoved")?.addEventListener("change", (event) => { showRemoved = event.target.checked; render(); });
    document.querySelectorAll("[data-contact-edit]").forEach((button) => button.addEventListener("click", () => {
      const file = crmFiles.find((entry) => entry.id === button.dataset.contactEdit);
      if (file) openContactEditor(file);
    }));
    document.querySelectorAll("[data-contact-remove]").forEach((button) => button.addEventListener("click", async () => {
      const file = crmFiles.find((entry) => entry.id === button.dataset.contactRemove);
      if (!file || (!file.contactHidden && !window.confirm(`Remove ${file.clientName || "this customer"} from Contacts? The work file, expenses, and documents will remain unchanged.`))) return;
      file.contactHidden = !file.contactHidden;
      try { await persistContact(file); showDashboardSaveStatus("Contact directory updated in Cloudflare. Work file preserved."); }
      catch (error) { showDashboardSaveStatus(error.message, true); }
      render();
    }));
    document.querySelector("#animusContactClose")?.addEventListener("click", () => setModalOpen(false));
    document.querySelector("#animusContactCancel")?.addEventListener("click", () => setModalOpen(false));
    modal?.addEventListener("click", (event) => { if (event.target === modal) setModalOpen(false); });
    modal?.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { event.preventDefault(); setModalOpen(false); }
      if (event.key !== "Tab") return;
      const controls = [...modal.querySelectorAll("button, input, select")];
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    document.querySelector("#animusContactForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const name = String(document.querySelector("#animusContactName")?.value || "").trim();
      const error = document.querySelector("#animusContactFormError");
      if (!name || typeof newCrmFile !== "function" || typeof activeFile !== "function") {
        if (error) { error.hidden = false; error.textContent = name ? "ANIMUS could not create this work file. Please try again." : "Enter the customer name before creating this contact."; }
        return;
      }
      const file = editingContactId ? crmFiles.find((entry) => entry.id === editingContactId) : newCrmFile({ direct:true, skipRoute:true });
      if (!file) {
        error.hidden = false;
        error.textContent = "This work file is no longer available. Your contact details have not been discarded.";
        return;
      }
      file.clientName = name;
      file.clientPhone = String(document.querySelector("#animusContactPhone")?.value || "").trim();
      file.clientEmail = String(document.querySelector("#animusContactEmail")?.value || "").trim();
      file.projectAddress = String(document.querySelector("#animusContactAddress")?.value || "").trim();
      file.leadSource = String(document.querySelector("#animusContactLeadSource")?.value || "Manual");
      file.timeline = [...(Array.isArray(file.timeline) ? file.timeline : []), `${editingContactId ? "Contact updated" : "Contact added manually"} ${new Date().toISOString()}`];
      const isNew = !editingContactId;
      if (isNew) unsavedNewContactId = file.id;
      editingContactId = file.id;
      const submit = modal.querySelector("button[type=submit]");
      submit.disabled = true;
      try {
        await persistContact(file, isNew || unsavedNewContactId === file.id);
      } catch (failure) {
        error.hidden = false;
        error.textContent = failure.message || "Cloud save failed. Your changes are still in this form. Retry Save.";
        submit.disabled = false;
        submit.textContent = "Retry Save";
        return;
      }
      submit.disabled = false;
      if (unsavedNewContactId === file.id) unsavedNewContactId = "";
      showDashboardSaveStatus("Contact saved to Cloudflare.");
      if (typeof renderCrm === "function") renderCrm();
      setModalOpen(false);
      render();
    });
    document.querySelector("#animusContactsSearch")?.addEventListener("input", (event) => {
      const query = String(event.target.value || "").trim().toLowerCase();
      let count = 0;
      document.querySelectorAll(".animus-contact-row").forEach((row) => {
        const match = !query || row.textContent.toLowerCase().includes(query);
        row.hidden = !match;
        if (match) count += 1;
      });
      const label = document.querySelector("#animusContactsResultCount");
      if (label) label.textContent = `${count} shown`;
    });
    document.querySelectorAll("[data-animus-contact-file]").forEach((button) => button.addEventListener("click", () => {
      const id = button.dataset.animusContactFile;
      if (typeof crmFiles === "undefined" || !crmFiles.some((file) => file.id === id)) return;
      activeFileId = id;
      if (typeof switchCrmView === "function") switchCrmView("files");
      if (typeof renderCrm === "function") renderCrm();
    }));
  }

  window.renderAnimusContacts = render;
})();
