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
    return classNameArray.map((classItem) => classItem.trim()).filter(Boolean).filter((value, index, self) => self.indexOf(value) === index).join(" ");
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

  // ANIMUS Android App/node_modules/lucide/dist/esm/icons/eye.js
  var Eye = [
    "svg",
    defaultAttributes,
    [
      [
        "path",
        {
          d: "M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"
        }
      ],
      ["circle", { cx: "12", cy: "12", r: "3" }]
    ]
  ];

  // ANIMUS Android App/node_modules/lucide/dist/esm/icons/maximize-2.js
  var Maximize2 = [
    "svg",
    defaultAttributes,
    [
      ["polyline", { points: "15 3 21 3 21 9" }],
      ["polyline", { points: "9 21 3 21 3 15" }],
      ["line", { x1: "21", x2: "14", y1: "3", y2: "10" }],
      ["line", { x1: "3", x2: "10", y1: "21", y2: "14" }]
    ]
  ];

  // ANIMUS Android App/node_modules/lucide/dist/esm/icons/monitor.js
  var Monitor = [
    "svg",
    defaultAttributes,
    [
      ["rect", { width: "20", height: "14", x: "2", y: "3", rx: "2" }],
      ["line", { x1: "8", x2: "16", y1: "21", y2: "21" }],
      ["line", { x1: "12", x2: "12", y1: "17", y2: "21" }]
    ]
  ];

  // ANIMUS Android App/node_modules/lucide/dist/esm/icons/rotate-ccw.js
  var RotateCcw = [
    "svg",
    defaultAttributes,
    [
      ["path", { d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" }],
      ["path", { d: "M3 3v5h5" }]
    ]
  ];

  // ANIMUS Android App/node_modules/lucide/dist/esm/icons/smartphone.js
  var Smartphone = [
    "svg",
    defaultAttributes,
    [
      ["rect", { width: "14", height: "20", x: "5", y: "2", rx: "2", ry: "2" }],
      ["path", { d: "M12 18h.01" }]
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

  // playground-model.mjs
  var fields = ["companyName", "companyPhone", "companyEmail", "companyAddress", "estimateTitle", "title", "estimateNumber", "estimateDate", "date", "clientName", "clientPhone", "clientEmail", "projectAddress", "projectType", "projectDescription", "description", "showEstimateNumber", "manualEstimateNumber", "priceOverrideEnabled", "priceOverride", "taxEnabled", "taxType", "taxValue", "discountEnabled", "discountType", "discountValue", "depositEnabled", "depositType", "deposit", "warrantyEnabled", "warrantyType", "warrantyTypes", "customWarrantyTitle", "customWarrantyText", "valueFooterEnabled", "notes", "additionalNotes", "lineItems", "totals", "careEnabled"];
  function sample() {
    return { firstName: "Sample", estimate: { clientName: "Sample Customer", estimateNumber: "SAMPLE", date: (/* @__PURE__ */ new Date()).toLocaleDateString("en-CA"), lineItems: [{ type: "item", description: "Sample project scope", price: 100, qty: "", hasPrice: true }], totals: { subtotal: 100, total: 100 } }, total: 100, fileNumber: "SAMPLE", clientName: "Sample Customer" };
  }
  function project(file) {
    const raw = file?.editableEstimate;
    const estimate = raw ? JSON.parse(JSON.stringify(Object.fromEntries(fields.filter((k) => Object.hasOwn(raw, k)).map((k) => [k, raw[k]])))) : null;
    if (estimate) {
      estimate.fileNumber = file.fileNumber;
      estimate.workFileNumber = file.fileNumber;
    }
    const url = file?.estimatePdfUrl || file?.estimateUrl || raw?.pdfUrl || raw?.documentUrl;
    let documentPath = null;
    if (url) {
      try {
        const parsed = new URL(url, "https://animus-v-1.pages.dev");
        if (parsed.origin === "https://animus-v-1.pages.dev" && parsed.pathname === "/api/mobile-workspace" && /^[\w-]{16,80}$/.test(parsed.searchParams.get("document") || "")) documentPath = parsed.pathname + parsed.search;
      } catch {
      }
    }
    return { firstName: String(file?.clientName || "Customer").trim().split(/\s+/)[0], clientName: file?.clientName || "Customer", fileNumber: file?.fileNumber || "\u2014", total: estimate?.totals?.total ?? file?.estimateTotal ?? 0, estimate, documentPath, unavailable: !!url && !documentPath };
  }

  // playground-admin.js
  var $ = (id) => document.getElementById(id);
  var root = $("crmPlaygroundView");
  var selected = "sample";
  var seed = sample();
  var events = [];
  var mode = "phone";
  var signature = "";
  var frames = /* @__PURE__ */ new Map();
  function files() {
    return typeof crmFiles !== "undefined" ? crmFiles : [];
  }
  function money(value) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value) || 0);
  }
  function activity(text, view = false) {
    events.unshift({ text, view, time: /* @__PURE__ */ new Date() });
    events = events.slice(0, 50);
    drawActivity();
  }
  function drawActivity() {
    const list = $("pgEvents");
    list.replaceChildren();
    for (const entry of events) {
      const li = document.createElement("li"), time = document.createElement("time");
      li.textContent = entry.text;
      time.textContent = entry.time.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      li.append(time);
      list.append(li);
    }
    if (!events.length) {
      const li = document.createElement("li");
      li.className = "pg-empty";
      li.textContent = "No test activity yet.";
      list.append(li);
    }
    const count = events.filter((e) => e.view).length;
    $("pgViewCount").textContent = `${count} test ${count === 1 ? "view" : "views"}`;
  }
  function loadFrame(id) {
    const frame = $(id), request = crypto.randomUUID();
    frames.set(frame, { request, seed: structuredClone(seed) });
    frame.src = `portal-admin-preview.html?request=${encodeURIComponent(request)}`;
  }
  function select(value) {
    if ($("pgPreviewDialog").open) $("pgPreviewDialog").close();
    frames.clear();
    selected = value;
    const file = files().find((f) => String(f.id) === value);
    seed = value === "sample" ? sample() : project(file);
    signature = "";
    events = [];
    drawActivity();
    refresh();
  }
  function refresh() {
    if (!root || root.hidden) return;
    const selectBox = $("pgWorkfile");
    selectBox.replaceChildren(new Option("Sample Customer", "sample"));
    for (const file of files()) selectBox.add(new Option(`${file.fileNumber || "Unnumbered"} \xB7 ${file.clientName || "Customer"}`, String(file.id)));
    if (selected !== "sample" && !files().some((f) => String(f.id) === selected)) {
      selected = "sample";
      seed = sample();
    }
    selectBox.value = selected;
    if (selected !== "sample") seed = project(files().find((f) => String(f.id) === selected));
    $("pgCustomer").textContent = seed.clientName;
    $("pgFile").textContent = seed.fileNumber;
    $("pgTotal").textContent = money(seed.total);
    const available = !!(seed.documentPath || seed.estimate) && !seed.unavailable;
    $("pgExpand").disabled = !available;
    $("pgDevice").hidden = !available;
    $("pgPreviewEmpty").hidden = available;
    if (!available) {
      frames.delete($("pgPreviewFrame"));
      $("pgPreviewFrame").removeAttribute("src");
      signature = "";
    }
    $("pgStatus").textContent = seed.unavailable ? "This saved attachment cannot be previewed here." : available ? "" : "No saved estimate on this workfile.";
    const next = JSON.stringify(seed);
    if (available && signature !== next) {
      signature = next;
      loadFrame("pgPreviewFrame");
    }
  }
  window.addEventListener("message", (event) => {
    if (event.origin !== location.origin) return;
    const match = [...frames].find(([frame2, state2]) => frame2.contentWindow === event.source && state2.request === event.data?.request);
    if (!match) return;
    const [frame, state] = match;
    if (event.data.type === "animus-playground-ready") frame.contentWindow.postMessage({ type: "animus-playground-seed", request: state.request, seed: state.seed }, location.origin);
    if (event.data.type === "animus-playground-pdf") activity("Estimate viewed in preview", true);
  });
  if (root) {
    createIcons({ icons: { RotateCcw, Maximize2, Eye, Smartphone, Monitor, X }, root });
    $("pgWorkfile").addEventListener("change", (event) => select(event.target.value));
    $("pgUseOpen").addEventListener("click", () => {
      const file = typeof activeFile === "function" ? activeFile() : null;
      if (file) select(String(file.id));
      else $("pgStatus").textContent = "Open a workfile first, or choose one above.";
    });
    $("pgReset").addEventListener("click", () => select("sample"));
    $("pgSimulate").addEventListener("click", () => activity("Simulated view", true));
    root.querySelectorAll("[data-pg-mode]").forEach((button) => button.addEventListener("click", () => {
      mode = button.dataset.pgMode;
      $("pgDevice").dataset.mode = mode;
      root.querySelectorAll("[data-pg-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
    }));
    $("pgExpand").addEventListener("click", () => {
      $("pgPreviewDialog").showModal();
      loadFrame("pgExpandedFrame");
      activity("Expanded preview opened");
    });
    $("pgClosePreview").addEventListener("click", () => $("pgPreviewDialog").close());
    $("pgPreviewDialog").addEventListener("close", () => {
      frames.delete($("pgExpandedFrame"));
      $("pgExpandedFrame").removeAttribute("src");
      $("pgExpand").focus();
    });
  }
  window.AnimusPlayground = { render: refresh };
  refresh();
})();
/*! Bundled license information:

lucide/dist/esm/createElement.js:
lucide/dist/esm/replaceElement.js:
lucide/dist/esm/defaultAttributes.js:
lucide/dist/esm/icons/eye.js:
lucide/dist/esm/icons/maximize-2.js:
lucide/dist/esm/icons/monitor.js:
lucide/dist/esm/icons/rotate-ccw.js:
lucide/dist/esm/icons/smartphone.js:
lucide/dist/esm/icons/x.js:
lucide/dist/esm/lucide.js:
  (**
   * @license lucide v0.468.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)
*/
