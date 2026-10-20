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

// ANIMUS Android App/node_modules/lucide/dist/esm/icons/arrow-right.js
var ArrowRight = [
  "svg",
  defaultAttributes,
  [
    ["path", { d: "M5 12h14" }],
    ["path", { d: "m12 5 7 7-7 7" }]
  ]
];

// ANIMUS Android App/node_modules/lucide/dist/esm/icons/download.js
var Download = [
  "svg",
  defaultAttributes,
  [
    ["path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }],
    ["polyline", { points: "7 10 12 15 17 10" }],
    ["line", { x1: "12", x2: "12", y1: "15", y2: "3" }]
  ]
];

// ANIMUS Android App/node_modules/lucide/dist/esm/icons/file-text.js
var FileText = [
  "svg",
  defaultAttributes,
  [
    ["path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" }],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4" }],
    ["path", { d: "M10 9H8" }],
    ["path", { d: "M16 13H8" }],
    ["path", { d: "M16 17H8" }]
  ]
];

// ANIMUS Android App/node_modules/lucide/dist/esm/icons/lock-keyhole.js
var LockKeyhole = [
  "svg",
  defaultAttributes,
  [
    ["circle", { cx: "12", cy: "16", r: "1" }],
    ["rect", { x: "3", y: "10", width: "18", height: "12", rx: "2" }],
    ["path", { d: "M7 10V7a5 5 0 0 1 10 0v3" }]
  ]
];

// ANIMUS Android App/node_modules/lucide/dist/esm/icons/minus.js
var Minus = ["svg", defaultAttributes, [["path", { d: "M5 12h14" }]]];

// ANIMUS Android App/node_modules/lucide/dist/esm/icons/plus.js
var Plus = [
  "svg",
  defaultAttributes,
  [
    ["path", { d: "M5 12h14" }],
    ["path", { d: "M12 5v14" }]
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

// client/portal-source.js
var token = location.hash.slice(1);
var accessId = "";
if (location.hash) history.replaceState(null, "", location.pathname);
async function request(action) {
  const body = { action };
  if (action === "session" && token) body.token = token;
  if (action === "pdf") body.accessId = accessId;
  const response = await fetch("/client-access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin", cache: "no-store", redirect: "error", referrerPolicy: "no-referrer", signal: AbortSignal.timeout(45e3) });
  if (!response.ok) {
    let result;
    try {
      result = await response.json();
    } catch {
    }
    throw Object.assign(new Error(result?.error || "Please try again in a moment."), { status: response.status });
  }
  return response;
}
async function loadCustomer() {
  const response = await request("session");
  const result = await response.json();
  token = "";
  accessId = result.accessId;
  return result;
}
async function loadPdf() {
  return (await request("pdf")).arrayBuffer();
}

// client/portal.js
var $ = (id) => document.getElementById(id);
createIcons({ icons: { FileText, ArrowRight, Download, X, Minus, Plus, LockKeyhole } });
var pdf = null;
var loadingTask = null;
var bytes = null;
var zoom = 1;
var renderVersion = 0;
var renderTask = null;
var observer = null;
var opening = false;
var downloadUrl = "";
var returnFocus = null;
var viewer = $("pdfViewer");
window.addEventListener("d2-render-status", (event) => {
  $("pdfStatus").querySelector("p").textContent = event.detail;
});
async function loadAccess() {
  $("accessError").hidden = true;
  $("retryAccess").hidden = true;
  $("welcomeBusy").hidden = false;
  $("viewEstimate").disabled = true;
  try {
    const customer = await loadCustomer();
    $("welcomeTitle").textContent = `Welcome, ${customer.firstName}.`;
    $("welcomeCopy").textContent = "We've prepared your personalized estimate for review. From here, you can explore the project details, ask questions, and approve your estimate whenever you're ready.";
    $("viewEstimate").disabled = false;
  } catch (error) {
    $("welcomeTitle").textContent = error.status === 401 ? "Your private estimate." : "Welcome.";
    $("welcomeCopy").textContent = error.status === 401 ? "This link is unavailable. Please reopen your private link or contact D2 for a new one." : "We could not prepare your portal just now.";
    $("accessError").textContent = error.status === 401 ? "Your link may have expired or been replaced." : "Please check your connection and try again.";
    $("accessError").hidden = false;
    $("retryAccess").hidden = error.status === 401;
  } finally {
    $("welcomeBusy").hidden = true;
  }
}
function errorPdf(message) {
  renderVersion++;
  observer?.disconnect();
  renderTask?.cancel();
  $("pdfPages").replaceChildren();
  $("pdfStatus").hidden = true;
  $("pdfError").hidden = false;
  $("pdfErrorText").textContent = message;
  $("zoomBar").hidden = true;
}
async function preparePdf() {
  if (opening) return;
  opening = true;
  $("pdfStatus").hidden = false;
  $("pdfError").hidden = true;
  $("downloadPdf").disabled = true;
  $("downloadError").hidden = true;
  renderVersion++;
  observer?.disconnect();
  renderTask?.cancel();
  pdf = null;
  $("pdfPages").replaceChildren();
  $("zoomBar").hidden = true;
  try {
    $("pdfStatus").querySelector("p").textContent = "Loading your estimate...";
    const loaded = await loadPdf();
    if (loaded.byteLength > 25 * 1024 * 1024) throw Error("This document is too large to display here. Please contact D2.");
    if (new TextDecoder().decode(loaded.slice(0, 5)) !== "%PDF-") throw Error("The estimate is not available as a PDF. Please contact D2.");
    $("pdfStatus").querySelector("p").textContent = "Opening document...";
    bytes = new Uint8Array(loaded);
    const lib = await import("./pdf.mjs");
    lib.GlobalWorkerOptions.workerSrc = new URL("./pdf.worker.mjs", import.meta.url).href;
    const previous = loadingTask;
    pdf = null;
    loadingTask = null;
    await previous?.destroy();
    const task = lib.getDocument({ data: bytes.slice(), isEvalSupported: false, enableXfa: false, enableScripting: false, useSystemFonts: true });
    loadingTask = task;
    let timer;
    try {
      pdf = await Promise.race([task.promise, new Promise((_, reject) => {
        timer = setTimeout(() => {
          task.destroy();
          reject(Error("Document loading timed out."));
        }, 3e4);
      })]);
    } finally {
      clearTimeout(timer);
    }
    if (pdf.numPages > 100) throw Error("This document is too long to display here. Please contact D2.");
    $("pageCount").textContent = `${pdf.numPages} ${pdf.numPages === 1 ? "page" : "pages"}`;
    $("downloadPdf").disabled = false;
    $("zoomBar").hidden = false;
    $("pdfStatus").hidden = true;
    await renderPages();
  } catch (error) {
    if (location.hostname === "127.0.0.1") console.error("Local portal PDF check:", error.message);
    bytes = null;
    errorPdf(error.status === 401 ? "Your private link is no longer available. Please request a new link from D2." : error.message?.includes("Please contact D2") ? error.message : "Please check your connection and try again. Your original estimate has not been changed.");
  } finally {
    opening = false;
    if (viewer.open && !viewer.contains(document.activeElement)) $("closeViewer").focus();
  }
}
async function renderPages() {
  if (!pdf || !viewer.open) return;
  const documentPdf = pdf;
  const version = ++renderVersion;
  observer?.disconnect();
  renderTask?.cancel();
  $("pdfPages").replaceChildren();
  $("zoomLevel").textContent = zoom === 1 ? "Fit width" : `${Math.round(zoom * 100)}%`;
  const width = Math.max(240, $("pdfScroll").clientWidth - (innerWidth <= 600 ? 16 : 40));
  const pages = /* @__PURE__ */ new Map();
  for (let number = 1; number <= documentPdf.numPages; number++) {
    if (version !== renderVersion) return;
    let page;
    try {
      page = await documentPdf.getPage(number);
    } catch (error) {
      if (version !== renderVersion) return;
      throw error;
    }
    if (version !== renderVersion) return;
    const base = page.getViewport({ scale: 1 });
    const displayWidth = width * zoom;
    const figure = document.createElement("figure");
    figure.className = "pdf-page";
    figure.style.width = displayWidth + "px";
    figure.style.height = displayWidth * base.height / base.width + "px";
    figure.setAttribute("aria-label", `Estimate page ${number}`);
    figure.dataset.page = number;
    const caption = document.createElement("figcaption");
    caption.textContent = `${number} / ${pdf.numPages}`;
    figure.append(caption);
    $("pdfPages").append(figure);
    pages.set(figure, { page, width: displayWidth });
  }
  let queue = Promise.resolve();
  observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const info = pages.get(entry.target);
      info.visible = entry.isIntersecting;
      if (!entry.isIntersecting) {
        const old = entry.target.querySelector("canvas");
        if (old && info.done) {
          old.width = old.height = 0;
          old.remove();
          info.done = false;
          info.page.cleanup();
        }
        continue;
      }
      queue = queue.then(async () => {
        if (version !== renderVersion || !viewer.open || !info.visible || info.done) return;
        const base = info.page.getViewport({ scale: 1 });
        const ratio = Math.min(devicePixelRatio || 1, 2);
        const maxScale = Math.sqrt(3e6 / (base.width * base.height));
        const viewport = info.page.getViewport({ scale: Math.min(info.width / base.width * ratio, maxScale) });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        canvas.setAttribute("role", "img");
        canvas.setAttribute("aria-label", `Estimate page ${entry.target.dataset.page}`);
        entry.target.prepend(canvas);
        try {
          renderTask = info.page.render({ canvasContext: canvas.getContext("2d"), viewport });
          await renderTask.promise;
          renderTask = null;
          info.done = true;
          if (!entry.target.querySelector(".pdf-text")) {
            const text = await info.page.getTextContent();
            const accessible = document.createElement("div");
            accessible.className = "pdf-text";
            accessible.textContent = text.items.map((item) => item.str || "").join(" ");
            entry.target.append(accessible);
          }
          if (!info.visible) {
            canvas.width = canvas.height = 0;
            canvas.remove();
            info.done = false;
            info.page.cleanup();
          }
        } catch (error) {
          canvas.remove();
          if (error.name !== "RenderingCancelledException" && version === renderVersion) errorPdf("This PDF page could not be displayed. Try loading the estimate again.");
        }
      });
    }
  }, { root: $("pdfScroll"), rootMargin: "500px" });
  for (const figure of pages.keys()) observer.observe(figure);
}
$("viewEstimate").onclick = () => {
  returnFocus = document.activeElement;
  viewer.showModal();
  zoom = 1;
  preparePdf();
};
$("closeViewer").onclick = () => viewer.close();
viewer.addEventListener("click", (event) => {
  if (event.target === viewer) {
    const r = viewer.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) viewer.close();
  }
});
viewer.addEventListener("close", () => {
  renderVersion++;
  observer?.disconnect();
  renderTask?.cancel();
  returnFocus?.focus();
});
$("retryAccess").onclick = loadAccess;
$("retryPdf").onclick = preparePdf;
var redraw = () => renderPages().catch(() => errorPdf("This document could not be displayed. Try loading it again."));
$("zoomIn").onclick = () => {
  zoom = Math.min(2.5, zoom + 0.25);
  redraw();
};
$("zoomOut").onclick = () => {
  zoom = Math.max(0.75, zoom - 0.25);
  redraw();
};
$("fitWidth").onclick = () => {
  zoom = 1;
  redraw();
};
$("downloadPdf").onclick = async () => {
  $("downloadError").hidden = true;
  $("downloadPdf").disabled = true;
  try {
    const current = await loadPdf();
    if (new TextDecoder().decode(current.slice(0, 5)) !== "%PDF-") throw Error();
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = URL.createObjectURL(new Blob([current], { type: "application/pdf" }));
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = "D2-Estimate.pdf";
    document.body.append(link);
    link.click();
    link.remove();
  } catch {
    $("downloadError").textContent = "The download could not finish. Please retry, or request a new link from D2.";
    $("downloadError").hidden = false;
  } finally {
    $("downloadPdf").disabled = false;
  }
};
var resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (viewer.open && !opening) renderPages().catch(() => errorPdf("The document could not resize. Try loading it again."));
  }, 180);
});
window.addEventListener("pagehide", () => {
  if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  loadingTask?.destroy();
  bytes = null;
});
loadAccess();
/*! Bundled license information:

lucide/dist/esm/createElement.js:
lucide/dist/esm/replaceElement.js:
lucide/dist/esm/defaultAttributes.js:
lucide/dist/esm/icons/arrow-right.js:
lucide/dist/esm/icons/download.js:
lucide/dist/esm/icons/file-text.js:
lucide/dist/esm/icons/lock-keyhole.js:
lucide/dist/esm/icons/minus.js:
lucide/dist/esm/icons/plus.js:
lucide/dist/esm/icons/x.js:
lucide/dist/esm/lucide.js:
  (**
   * @license lucide v0.468.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)
*/
