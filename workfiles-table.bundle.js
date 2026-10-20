(() => {
  // ANIMUS Android App/node_modules/lucide/dist/esm/createElement.js
  var createElement = (tag, attrs, children = []) => {
    const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.keys(attrs).forEach((name) => {
      element.setAttribute(name, String(attrs[name]));
    });
    if (children.length) {
      children.forEach((child) => {
        const childElement = createElement(...child);
        element.appendChild(childElement);
      });
    }
    return element;
  };
  var createElement$1 = ([tag, attrs, children]) => createElement(tag, attrs, children);

  // ANIMUS Android App/node_modules/lucide/dist/esm/replaceElement.js
  var getAttrs = (element) => Array.from(element.attributes).reduce((attrs, attr) => {
    attrs[attr.name] = attr.value;
    return attrs;
  }, {});
  var getClassNames = (attrs) => {
    if (typeof attrs === "string")
      return attrs;
    if (!attrs || !attrs.class)
      return "";
    if (attrs.class && typeof attrs.class === "string") {
      return attrs.class.split(" ");
    }
    if (attrs.class && Array.isArray(attrs.class)) {
      return attrs.class;
    }
    return "";
  };
  var combineClassNames = (arrayOfClassnames) => {
    const classNameArray = arrayOfClassnames.flatMap(getClassNames);
    return classNameArray.map((classItem) => classItem.trim()).filter(Boolean).filter((value2, index, self) => self.indexOf(value2) === index).join(" ");
  };
  var toPascalCase = (string) => string.replace(/(\w)(\w*)(_|-|\s*)/g, (g0, g1, g2) => g1.toUpperCase() + g2.toLowerCase());
  var replaceElement = (element, { nameAttr, icons, attrs }) => {
    const iconName = element.getAttribute(nameAttr);
    if (iconName == null)
      return;
    const ComponentName = toPascalCase(iconName);
    const iconNode = icons[ComponentName];
    if (!iconNode) {
      return console.warn(
        `${element.outerHTML} icon name was not found in the provided icons object.`
      );
    }
    const elementAttrs = getAttrs(element);
    const [tag, iconAttributes, children] = iconNode;
    const iconAttrs = {
      ...iconAttributes,
      "data-lucide": iconName,
      ...attrs,
      ...elementAttrs
    };
    const classNames = combineClassNames(["lucide", `lucide-${iconName}`, elementAttrs, attrs]);
    if (classNames) {
      Object.assign(iconAttrs, {
        class: classNames
      });
    }
    const svgElement = createElement$1([tag, iconAttrs, children]);
    return element.parentNode?.replaceChild(svgElement, element);
  };

  // ANIMUS Android App/node_modules/lucide/dist/esm/defaultAttributes.js
  var defaultAttributes = {
    xmlns: "http://www.w3.org/2000/svg",
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": 2,
    "stroke-linecap": "round",
    "stroke-linejoin": "round"
  };

  // ANIMUS Android App/node_modules/lucide/dist/esm/icons/arrow-up-down.js
  var ArrowUpDown = [
    "svg",
    defaultAttributes,
    [
      ["path", { d: "m21 16-4 4-4-4" }],
      ["path", { d: "M17 20V4" }],
      ["path", { d: "m3 8 4-4 4 4" }],
      ["path", { d: "M7 4v16" }]
    ]
  ];

  // ANIMUS Android App/node_modules/lucide/dist/esm/icons/chevron-left.js
  var ChevronLeft = ["svg", defaultAttributes, [["path", { d: "m15 18-6-6 6-6" }]]];

  // ANIMUS Android App/node_modules/lucide/dist/esm/icons/chevron-right.js
  var ChevronRight = ["svg", defaultAttributes, [["path", { d: "m9 18 6-6-6-6" }]]];

  // ANIMUS Android App/node_modules/lucide/dist/esm/icons/ellipsis.js
  var Ellipsis = [
    "svg",
    defaultAttributes,
    [
      ["circle", { cx: "12", cy: "12", r: "1" }],
      ["circle", { cx: "19", cy: "12", r: "1" }],
      ["circle", { cx: "5", cy: "12", r: "1" }]
    ]
  ];

  // ANIMUS Android App/node_modules/lucide/dist/esm/icons/plus.js
  var Plus = [
    "svg",
    defaultAttributes,
    [
      ["path", { d: "M5 12h14" }],
      ["path", { d: "M12 5v14" }]
    ]
  ];

  // ANIMUS Android App/node_modules/lucide/dist/esm/icons/search.js
  var Search = [
    "svg",
    defaultAttributes,
    [
      ["circle", { cx: "11", cy: "11", r: "8" }],
      ["path", { d: "m21 21-4.3-4.3" }]
    ]
  ];

  // ANIMUS Android App/node_modules/lucide/dist/esm/icons/x.js
  var X = [
    "svg",
    defaultAttributes,
    [
      ["path", { d: "M18 6 6 18" }],
      ["path", { d: "m6 6 12 12" }]
    ]
  ];

  // ANIMUS Android App/node_modules/lucide/dist/esm/lucide.js
  var createIcons = ({ icons = {}, nameAttr = "data-lucide", attrs = {} } = {}) => {
    if (!Object.values(icons).length) {
      throw new Error(
        "Please provide an icons object.\nIf you want to use all the icons you can import it like:\n `import { createIcons, icons } from 'lucide';\nlucide.createIcons({icons});`"
      );
    }
    if (typeof document === "undefined") {
      throw new Error("`createIcons()` only works in a browser environment.");
    }
    const elementsToReplace = document.querySelectorAll(`[${nameAttr}]`);
    Array.from(elementsToReplace).forEach(
      (element) => replaceElement(element, { nameAttr, icons, attrs })
    );
    if (nameAttr === "data-lucide") {
      const deprecatedElements = document.querySelectorAll("[icon-name]");
      if (deprecatedElements.length > 0) {
        console.warn(
          "[Lucide] Some icons were found with the now deprecated icon-name attribute. These will still be replaced for backwards compatibility, but will no longer be supported in v1.0 and you should switch to data-lucide"
        );
        Array.from(deprecatedElements).forEach(
          (element) => replaceElement(element, { nameAttr: "icon-name", icons, attrs })
        );
      }
    }
  };

  // workfiles-model.mjs
  var tabs = [["all", "All Workfiles"], ["mine", "My Work"], ["open", "Open"], ["progress", "In Progress"], ["awaiting", "Awaiting Client"], ["review", "Review"], ["completed", "Completed"], ["closed", "Closed"]];
  var tones = { "New Lead": "new-lead", "Contact Established": "contact-established", "Contact Attempted": "contact-attempted", "Inspection Completed": "inspection-completed", "In Negotiation": "negotiation", "Pending Start": "pending-start", "In Progress": "in-progress", "Completed-Pending Payment": "completed-pending-payment", "Closed / Paid": "closed-paid", "Job Lost / Closed": "lost-closed" };
  function assigned(file) {
    const value2 = file.assignedTo || file.assignedEmployee || file.employee || file.team || "";
    return (Array.isArray(value2) ? value2 : String(value2).split(/\s*[/,]\s*/)).map(String).filter((v) => v.trim() && !/^unassigned$/i.test(v));
  }
  function due(file) {
    return file.nextActionDate || file.followUpDate || "";
  }
  function value(file) {
    const raw = file.estimateTotal ?? file.editableEstimate?.totals?.total;
    if (raw === null || raw === void 0 || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) && (n !== 0 || file.estimateExists) ? n : null;
  }
  function inTab(file, tab, me = "") {
    const status = file.fileStatus || "New Lead";
    const closed = ["Closed / Paid", "Job Lost / Closed"].includes(status);
    if (tab === "mine") return !!me && assigned(file).includes(me);
    if (tab === "open") return !closed;
    if (tab === "progress") return status === "In Progress";
    if (tab === "awaiting") return status === "In Negotiation";
    if (tab === "review") return status === "Inspection Completed";
    if (tab === "completed") return ["Completed-Pending Payment", "Closed / Paid"].includes(status);
    if (tab === "closed") return closed;
    return true;
  }
  function query(files, state2) {
    const q = String(state2.search || "").trim().toLowerCase();
    const rows = files.filter((f) => inTab(f, state2.tab, state2.assignee) && (!state2.category || f.category === state2.category) && (!state2.status || f.fileStatus === state2.status) && (!state2.type || f.projectType === state2.type) && (!state2.assignee || assigned(f).includes(state2.assignee)) && (!state2.from || due(f) && due(f) >= state2.from) && (!state2.to || due(f) && due(f) <= state2.to) && (!q || [f.clientName, f.fileNumber, f.projectAddress, f.clientEmail, f.clientPhone, f.projectType, f.leadSource].some((v) => String(v || "").toLowerCase().includes(q))));
    const key = state2.sort || "name";
    const get = (f) => key === "name" ? f.clientName : key === "status" ? f.fileStatus : key === "type" ? f.projectType : key === "value" ? value(f) : due(f);
    return rows.sort((a, b) => {
      const x = get(a), y = get(b);
      if (x === null || x === "") return y === null || y === "" ? 0 : 1;
      if (y === null || y === "") return -1;
      return (typeof x === "number" ? x - y : String(x || "").localeCompare(String(y || ""))) * (state2.direction === -1 ? -1 : 1);
    });
  }

  // workfiles-table.js
  var bridge = window.AnimusWorkfilesBridge;
  if (!bridge) throw Error("Workfiles CRM adapter unavailable.");
  var root = document.createElement("section");
  root.id = "workfilesTable";
  root.hidden = true;
  var layout = document.querySelector(".animus-work-files-layout");
  layout.before(root);
  var mode = "list";
  var page = 1;
  var size = 25;
  var busy = false;
  var selected = /* @__PURE__ */ new Set();
  var statusMessage = "";
  var recordNavigation = false;
  var pendingScope = "";
  var state = { tab: "all", search: "", status: "", type: "", assignee: "", from: "", to: "", sort: "name", direction: 1 };
  var esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  var currency = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
  var icon = (name) => `<i data-lucide="${name}" aria-hidden="true"></i>`;
  var opt = (values, current, empty) => `<option value="">${empty}</option>` + values.map((v) => `<option value="${esc(v)}"${v === current ? " selected" : ""}>${esc(v)}</option>`).join("");
  var today = () => {
    const d = /* @__PURE__ */ new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  var dateLabel = (v) => {
    const d = /* @__PURE__ */ new Date(v + "T12:00:00");
    return Number.isNaN(+d) ? v : d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
  };
  function options() {
    return bridge.options();
  }
  function open(id, section = "overview") {
    recordNavigation = true;
    try {
      bridge.select(id);
    } finally {
      recordNavigation = false;
    }
    mode = "detail";
    render();
    window.openAnimusWorkfileSection?.(section);
  }
  function render() {
    const focus = document.activeElement;
    const focusKey = focus && root.contains(focus) ? ["id", "data-filter", "data-type", "data-select", "data-sort", "data-tab"].map((key) => [key, focus.getAttribute(key)]).find(([, v]) => v) : null;
    const showing = document.body.dataset.animusView === "files" && !layout.hidden;
    root.hidden = !showing || mode !== "list";
    document.body.classList.toggle("workfiles-table-active", showing && mode === "list");
    if (root.hidden) return;
    const files = bridge.files(), ids = new Set(files.map((f) => String(f.id)));
    selected = new Set([...selected].filter((id) => ids.has(id)));
    const choices = options(), rows = query(files, state);
    const pages = Math.max(1, Math.ceil(rows.length / size));
    page = Math.min(page, pages);
    const shown = rows.slice((page - 1) * size, page * size);
    const th = (key, label) => `<th scope="col" aria-sort="${state.sort === key ? state.direction === 1 ? "ascending" : "descending" : "none"}"><button type="button" data-sort="${key}">${label}${icon("arrow-up-down")}</button></th>`;
    root.innerHTML = `<header class="wf-heading"><div><h1>Workfiles</h1><p>All client projects, estimates, and related work in one place.</p></div><button type="button" data-new class="wf-primary">${icon("plus")}New Workfile</button></header>
  <nav class="wf-tabs" aria-label="Workfile views">${tabs.map(([key, label]) => `<button type="button" data-tab="${key}" aria-pressed="${state.tab === key}">${label}<span>${files.filter((f) => inTab(f, key, state.assignee)).length}</span></button>`).join("")}</nav>
  <div class="wf-filters"><label class="wf-search">${icon("search")}<input type="search" id="wfSearch" aria-label="Search all workfiles" placeholder="Search workfiles..." value="${esc(state.search)}"></label><label>Status<select data-filter="status">${opt(choices.statuses, state.status, "All statuses")}</select></label><label>Type<select data-filter="type">${opt(choices.types, state.type, "All types")}</select></label><label>Assignee<select data-filter="assignee">${opt(choices.people, state.assignee, state.tab === "mine" ? "Choose your name" : "All assignees")}</select></label><label>Due from<input type="date" data-filter="from" value="${esc(state.from)}"></label><label>Due to<input type="date" data-filter="to" value="${esc(state.to)}"></label><button type="button" data-clear>${icon("x")}Clear</button></div>
  ${state.category ? `<button type="button" data-scope-clear>${esc(document.querySelector(`#crmFileFilter option[value="${CSS.escape(state.category)}"]`)?.textContent || state.category)} ${icon("x")}</button>` : ""}<p class="wf-status" role="status">${esc(statusMessage)}</p>
  ${selected.size ? `<div class="wf-bulk"><strong>${selected.size} selected</strong><label>Reassign<select id="wfBulkAssignee">${opt(choices.people, "", "Choose assignee")}</select></label><button type="button" data-bulk="assign"${busy ? " disabled" : ""}>Apply</button><button type="button" data-bulk="archive"${busy ? " disabled" : ""}>Archive</button><button type="button" data-deselect>Clear selection</button></div>` : ""}
  <div class="wf-table-wrap"><table><colgroup><col class="wf-select"><col class="wf-name"><col class="wf-status-col"><col><col><col><col><col class="wf-more-col"></colgroup><thead><tr><th><input type="checkbox" id="wfSelectAll" aria-label="Select visible workfiles"${shown.length && shown.every((f) => selected.has(String(f.id))) ? " checked" : ""}></th>${th("name", "Workfile")}${th("status", "Status")}${th("type", "Type")}${th("value", "Value")}${th("due", "Due Date")}<th scope="col">Assigned</th><th scope="col"><span class="wf-sr">More</span></th></tr></thead><tbody>${shown.map((f) => {
      const amount = value(f), deadline = due(f), people = assigned(f);
      return `<tr data-row="${esc(f.id)}"${selected.has(String(f.id)) ? ' class="wf-selected"' : ""}><td data-label="Select"><input type="checkbox" data-select="${esc(f.id)}" aria-label="Select ${esc(f.clientName)}"${selected.has(String(f.id)) ? " checked" : ""}></td><td data-label="Workfile"><button type="button" class="wf-file" data-open="${esc(f.id)}"><strong>${esc(f.clientName || "Unnamed Client")}</strong><small>${esc(f.fileNumber)}</small></button></td><td data-label="Status"><button type="button" data-open="${esc(f.id)}" class="animus-file-status-inline ${tones[f.fileStatus] || "new-lead"}">${esc(f.fileStatus)}</button></td><td data-label="Type"><select data-type="${esc(f.id)}" aria-label="Type for ${esc(f.clientName)}"${busy ? " disabled" : ""}>${choices.types.includes(f.projectType) ? "" : `<option selected disabled>${esc(f.projectType || "Choose type")}</option>`}${choices.types.map((type) => `<option${type === f.projectType ? " selected" : ""}>${esc(type)}</option>`).join("")}</select></td><td data-label="Value">${amount === null ? '<span class="wf-muted">No estimate</span>' : `<button type="button" data-financials="${esc(f.id)}" class="wf-value">${currency(amount)}</button>`}</td><td data-label="Due Date">${deadline ? `<button type="button" data-open="${esc(f.id)}" class="${deadline < today() && !["Closed / Paid", "Job Lost / Closed"].includes(f.fileStatus) ? "wf-overdue" : ""}">${esc(dateLabel(deadline))}</button>` : ""}</td><td data-label="Assigned">${people.length ? `<button type="button" data-open="${esc(f.id)}" class="wf-avatars" aria-label="Assigned: ${esc(people.join(", "))}">${people.map((person) => `<span title="${esc(person)}">${esc(person.split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase())}</span>`).join("")}</button>` : ""}</td><td data-label="More"><button type="button" data-more="${esc(f.id)}" aria-label="More actions for ${esc(f.clientName)}">${icon("more-horizontal")}</button></td></tr>`;
    }).join("") || `<tr><td colspan="8" class="wf-empty">${state.tab === "mine" && !state.assignee ? "Choose your name in Assignee to see My Work." : "No workfiles match these filters."}</td></tr>`}</tbody></table></div>
  <footer class="wf-pagination"><span>${rows.length ? `${(page - 1) * size + 1}\u2013${Math.min(page * size, rows.length)}` : "0"} of ${rows.length} workfiles</span><label>Rows per page<select id="wfPageSize">${[10, 25, 50, 100].map((n) => `<option${size === n ? " selected" : ""}>${n}</option>`).join("")}</select></label><button type="button" data-page="-1" aria-label="Previous page"${page === 1 ? " disabled" : ""}>${icon("chevron-left")}</button><span>Page ${page} of ${pages}</span><button type="button" data-page="1" aria-label="Next page"${page === pages ? " disabled" : ""}>${icon("chevron-right")}</button></footer>`;
    const all = root.querySelector("#wfSelectAll");
    all.indeterminate = shown.some((f) => selected.has(String(f.id))) && !shown.every((f) => selected.has(String(f.id)));
    createIcons({ icons: { Plus, Search, MoreHorizontal: Ellipsis, ArrowUpDown, ChevronLeft, ChevronRight, X }, root });
    if (focusKey) root.querySelector(`[${focusKey[0]}="${CSS.escape(focusKey[1])}"]`)?.focus({ preventScroll: true });
  }
  var menu = document.createElement("dialog");
  menu.id = "workfilesActionMenu";
  document.body.append(menu);
  function more(id) {
    const f = bridge.files().find((f2) => String(f2.id) === id);
    if (!f) return;
    menu.innerHTML = `<header><h2>${esc(f.clientName)}</h2><button type="button" data-close aria-label="Close actions">\xD7</button></header>${[["open", "Open Workfile"], ["edit", "Edit Details"], ["duplicate", "Duplicate Workfile"], ["archive", "Archive Workfile"], ["delete", "Delete Workfile"]].map(([key, label]) => `<button type="button" data-action="${key}" data-id="${esc(id)}"${key === "delete" ? ' class="wf-danger"' : ""}>${label}</button>`).join("")}`;
    menu.showModal();
  }
  menu.addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.hasAttribute("data-close")) {
      menu.close();
      return;
    }
    const { action, id } = b.dataset;
    menu.close();
    if (action === "open") open(id);
    if (action === "edit") {
      open(id);
      bridge.edit();
    }
    if (action === "duplicate") bridge.duplicate(id);
    if (action === "delete") {
      open(id);
      bridge.remove();
    }
    if (action === "archive" && confirm("Archive this file as Job Lost / Closed?")) await mutate([id], "archive");
  });
  async function mutate(ids, field, next) {
    if (busy) return;
    busy = true;
    statusMessage = "Saving to Cloudflare...";
    render();
    try {
      await bridge.update(ids, field, next);
      statusMessage = "Saved to Cloudflare.";
      if (field === "archive") selected.clear();
    } catch (error) {
      statusMessage = `Not saved: ${error.message}`;
    } finally {
      busy = false;
      render();
    }
  }
  root.addEventListener("input", (e) => {
    if (e.target.id !== "wfSearch") return;
    const pos = e.target.selectionStart;
    state.search = e.target.value;
    page = 1;
    render();
    const input = root.querySelector("#wfSearch");
    input.focus();
    try {
      input.setSelectionRange(pos, pos);
    } catch {
    }
  });
  root.addEventListener("change", async (e) => {
    const t = e.target;
    if (t.dataset.filter) {
      state[t.dataset.filter] = t.value;
      page = 1;
      render();
    } else if (t.dataset.type) await mutate([t.dataset.type], "projectType", t.value);
    else if (t.dataset.select) {
      t.checked ? selected.add(t.dataset.select) : selected.delete(t.dataset.select);
      render();
    } else if (t.id === "wfSelectAll") {
      const shown = query(bridge.files(), state).slice((page - 1) * size, page * size);
      for (const f of shown) t.checked ? selected.add(String(f.id)) : selected.delete(String(f.id));
      render();
    } else if (t.id === "wfPageSize") {
      size = Number(t.value);
      page = 1;
      render();
    }
  });
  root.addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (b) {
      if (b.hasAttribute("data-new")) bridge.create();
      else if (b.dataset.tab) {
        state.tab = b.dataset.tab;
        page = 1;
        render();
      } else if (b.hasAttribute("data-clear")) {
        state = { ...state, tab: "all", search: "", status: "", type: "", assignee: "", from: "", to: "" };
        page = 1;
        render();
      } else if (b.dataset.sort) {
        state.direction = state.sort === b.dataset.sort ? -state.direction : 1;
        state.sort = b.dataset.sort;
        render();
      } else if (b.dataset.open) open(b.dataset.open);
      else if (b.dataset.financials) open(b.dataset.financials, "financials");
      else if (b.dataset.more) more(b.dataset.more);
      else if (b.dataset.page) {
        page += Number(b.dataset.page);
        render();
      } else if (b.hasAttribute("data-deselect")) {
        selected.clear();
        render();
      } else if (b.dataset.bulk) {
        const ids = [...selected];
        if (b.dataset.bulk === "archive") {
          if (confirm(`Archive ${ids.length} selected workfiles as Job Lost / Closed?`)) await mutate(ids, "archive");
        } else {
          const name = root.querySelector("#wfBulkAssignee").value;
          if (name) await mutate(ids, "assignedTo", name);
        }
      }
      return;
    }
    if (e.target.closest("input,select,label,a")) return;
    const row = e.target.closest("[data-row]");
    if (row) open(row.dataset.row);
  });
  root.addEventListener("click", (e) => {
    if (e.target.closest("[data-scope-clear]")) {
      state.category = "";
      render();
    }
  });
  root.addEventListener("click", (e) => {
    if (e.target.closest("[data-tab]")) state.category = "";
  }, true);
  root.addEventListener("change", (e) => {
    if (e.target.id === "wfBulkAssignee") root.querySelector('[data-bulk="assign"]').disabled = busy || !e.target.value;
  });
  var baseSwitch = window.switchCrmView;
  window.switchCrmView = function(view, ...args) {
    const result = baseSwitch.call(this, view, ...args);
    if (view === "files" && !recordNavigation) {
      mode = "list";
      state = { tab: "all", search: "", status: "", type: "", assignee: "", from: "", to: "", sort: "name", direction: 1, category: pendingScope };
      pendingScope = "";
      page = 1;
    }
    render();
    return result;
  };
  var baseRender = window.renderCrm;
  window.renderCrm = function(...args) {
    const result = baseRender.apply(this, args);
    render();
    return result;
  };
  document.addEventListener("click", (e) => {
    const route = e.target.closest("[data-animus-open]")?.dataset.animusOpen;
    if (route?.startsWith("files:")) pendingScope = route.slice(6);
    if (e.target.closest("[data-animus-back]")) {
      e.preventDefault();
      e.stopImmediatePropagation();
      mode = "list";
      render();
    }
  }, true);
  new MutationObserver(render).observe(document.body, { attributes: true, attributeFilter: ["data-animus-view"] });
  window.AnimusWorkfiles = { open, render };
  render();
})();
/*! Bundled license information:

lucide/dist/esm/createElement.js:
lucide/dist/esm/replaceElement.js:
lucide/dist/esm/defaultAttributes.js:
lucide/dist/esm/icons/arrow-up-down.js:
lucide/dist/esm/icons/chevron-left.js:
lucide/dist/esm/icons/chevron-right.js:
lucide/dist/esm/icons/ellipsis.js:
lucide/dist/esm/icons/plus.js:
lucide/dist/esm/icons/search.js:
lucide/dist/esm/icons/x.js:
lucide/dist/esm/lucide.js:
  (**
   * @license lucide v0.468.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)
*/
