// Contacts is a directory over the existing CRM work files.
// Manual contacts become normal New Lead work files, so there is one source of truth.
(() => {
  const root = () => document.querySelector("#animusContactsRoot");
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[character]));
  const display = (value, fallback = "Not provided") => String(value || "").trim() || fallback;
  const phoneHref = (value) => `tel:${String(value || "").replace(/[^\d+]/g, "")}`;
  const textHref = (value) => `sms:${String(value || "").replace(/[^\d+]/g, "")}`;
  const mapHref = (value) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value || "")}`;

  function contactFiles() {
    return (typeof crmFiles === "undefined" ? [] : crmFiles)
      .filter((file) => file && (file.clientName || file.clientPhone || file.clientEmail || file.projectAddress))
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
        <div class="animus-contacts-toolbar"><label><span class="sr-only">Search contacts</span><input id="animusContactsSearch" type="search" placeholder="Search name, phone, email, address, or file #"></label><span id="animusContactsResultCount">${files.length} shown</span></div>
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
    };
    document.querySelector("#animusAddContact")?.addEventListener("click", () => setModalOpen(true));
    document.querySelector("#animusContactClose")?.addEventListener("click", () => setModalOpen(false));
    document.querySelector("#animusContactCancel")?.addEventListener("click", () => setModalOpen(false));
    modal?.addEventListener("click", (event) => { if (event.target === modal) setModalOpen(false); });
    document.querySelector("#animusContactForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = String(document.querySelector("#animusContactName")?.value || "").trim();
      const error = document.querySelector("#animusContactFormError");
      if (!name || typeof newCrmFile !== "function" || typeof activeFile !== "function") {
        if (error) { error.hidden = false; error.textContent = name ? "ANIMUS could not create this work file. Please try again." : "Enter the customer name before creating this contact."; }
        return;
      }
      newCrmFile({ direct:true });
      const file = activeFile();
      if (!file) return;
      file.clientName = name;
      file.clientPhone = String(document.querySelector("#animusContactPhone")?.value || "").trim();
      file.clientEmail = String(document.querySelector("#animusContactEmail")?.value || "").trim();
      file.projectAddress = String(document.querySelector("#animusContactAddress")?.value || "").trim();
      file.leadSource = String(document.querySelector("#animusContactLeadSource")?.value || "Manual");
      file.timeline = [...(Array.isArray(file.timeline) ? file.timeline : []), { at:new Date().toISOString(), text:"Contact added manually" }];
      if (typeof saveCrmFiles === "function") saveCrmFiles();
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
