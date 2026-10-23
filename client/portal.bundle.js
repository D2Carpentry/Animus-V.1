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
var replaceElement = (element, { nameAttr, icons: icons2, attrs }) => {
  const iconName = element.getAttribute(nameAttr);
  if (iconName == null)
    return;
  const ComponentName = toPascalCase(iconName);
  const iconNode = icons2[ComponentName];
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

// ANIMUS Android App/node_modules/lucide/dist/esm/icons/arrow-left.js
var ArrowLeft = [
  "svg",
  defaultAttributes,
  [
    ["path", { d: "m12 19-7-7 7-7" }],
    ["path", { d: "M19 12H5" }]
  ]
];

// ANIMUS Android App/node_modules/lucide/dist/esm/icons/arrow-right.js
var ArrowRight = [
  "svg",
  defaultAttributes,
  [
    ["path", { d: "M5 12h14" }],
    ["path", { d: "m12 5 7 7-7 7" }]
  ]
];

// ANIMUS Android App/node_modules/lucide/dist/esm/icons/book-open.js
var BookOpen = [
  "svg",
  defaultAttributes,
  [
    ["path", { d: "M12 7v14" }],
    [
      "path",
      {
        d: "M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"
      }
    ]
  ]
];

// ANIMUS Android App/node_modules/lucide/dist/esm/icons/boxes.js
var Boxes = [
  "svg",
  defaultAttributes,
  [
    [
      "path",
      {
        d: "M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z"
      }
    ],
    ["path", { d: "m7 16.5-4.74-2.85" }],
    ["path", { d: "m7 16.5 5-3" }],
    ["path", { d: "M7 16.5v5.17" }],
    [
      "path",
      {
        d: "M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z"
      }
    ],
    ["path", { d: "m17 16.5-5-3" }],
    ["path", { d: "m17 16.5 4.74-2.85" }],
    ["path", { d: "M17 16.5v5.17" }],
    [
      "path",
      {
        d: "M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z"
      }
    ],
    ["path", { d: "M12 8 7.26 5.15" }],
    ["path", { d: "m12 8 4.74-2.85" }],
    ["path", { d: "M12 13.5V8" }]
  ]
];

// ANIMUS Android App/node_modules/lucide/dist/esm/icons/calendar-days.js
var CalendarDays = [
  "svg",
  defaultAttributes,
  [
    ["path", { d: "M8 2v4" }],
    ["path", { d: "M16 2v4" }],
    ["rect", { width: "18", height: "18", x: "3", y: "4", rx: "2" }],
    ["path", { d: "M3 10h18" }],
    ["path", { d: "M8 14h.01" }],
    ["path", { d: "M12 14h.01" }],
    ["path", { d: "M16 14h.01" }],
    ["path", { d: "M8 18h.01" }],
    ["path", { d: "M12 18h.01" }],
    ["path", { d: "M16 18h.01" }]
  ]
];

// ANIMUS Android App/node_modules/lucide/dist/esm/icons/check.js
var Check = ["svg", defaultAttributes, [["path", { d: "M20 6 9 17l-5-5" }]]];

// ANIMUS Android App/node_modules/lucide/dist/esm/icons/chevron-right.js
var ChevronRight = ["svg", defaultAttributes, [["path", { d: "m9 18 6-6-6-6" }]]];

// ANIMUS Android App/node_modules/lucide/dist/esm/icons/clock.js
var Clock = [
  "svg",
  defaultAttributes,
  [
    ["circle", { cx: "12", cy: "12", r: "10" }],
    ["polyline", { points: "12 6 12 12 16 14" }]
  ]
];

// ANIMUS Android App/node_modules/lucide/dist/esm/icons/credit-card.js
var CreditCard = [
  "svg",
  defaultAttributes,
  [
    ["rect", { width: "20", height: "14", x: "2", y: "5", rx: "2" }],
    ["line", { x1: "2", x2: "22", y1: "10", y2: "10" }]
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

// ANIMUS Android App/node_modules/lucide/dist/esm/icons/folder-open.js
var FolderOpen = [
  "svg",
  defaultAttributes,
  [
    [
      "path",
      {
        d: "m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"
      }
    ]
  ]
];

// ANIMUS Android App/node_modules/lucide/dist/esm/icons/house.js
var House = [
  "svg",
  defaultAttributes,
  [
    ["path", { d: "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" }],
    [
      "path",
      {
        d: "M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
      }
    ]
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

// ANIMUS Android App/node_modules/lucide/dist/esm/icons/mail.js
var Mail = [
  "svg",
  defaultAttributes,
  [
    ["rect", { width: "20", height: "16", x: "2", y: "4", rx: "2" }],
    ["path", { d: "m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" }]
  ]
];

// ANIMUS Android App/node_modules/lucide/dist/esm/icons/map-pin.js
var MapPin = [
  "svg",
  defaultAttributes,
  [
    [
      "path",
      {
        d: "M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"
      }
    ],
    ["circle", { cx: "12", cy: "10", r: "3" }]
  ]
];

// ANIMUS Android App/node_modules/lucide/dist/esm/icons/menu.js
var Menu = [
  "svg",
  defaultAttributes,
  [
    ["line", { x1: "4", x2: "20", y1: "12", y2: "12" }],
    ["line", { x1: "4", x2: "20", y1: "6", y2: "6" }],
    ["line", { x1: "4", x2: "20", y1: "18", y2: "18" }]
  ]
];

// ANIMUS Android App/node_modules/lucide/dist/esm/icons/message-square-plus.js
var MessageSquarePlus = [
  "svg",
  defaultAttributes,
  [
    ["path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" }],
    ["path", { d: "M12 7v6" }],
    ["path", { d: "M9 10h6" }]
  ]
];

// ANIMUS Android App/node_modules/lucide/dist/esm/icons/messages-square.js
var MessagesSquare = [
  "svg",
  defaultAttributes,
  [
    ["path", { d: "M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z" }],
    ["path", { d: "M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1" }]
  ]
];

// ANIMUS Android App/node_modules/lucide/dist/esm/icons/minus.js
var Minus = ["svg", defaultAttributes, [["path", { d: "M5 12h14" }]]];

// ANIMUS Android App/node_modules/lucide/dist/esm/icons/paperclip.js
var Paperclip = [
  "svg",
  defaultAttributes,
  [
    ["path", { d: "M13.234 20.252 21 12.3" }],
    [
      "path",
      {
        d: "m16 6-8.414 8.586a2 2 0 0 0 0 2.828 2 2 0 0 0 2.828 0l8.414-8.586a4 4 0 0 0 0-5.656 4 4 0 0 0-5.656 0l-8.415 8.585a6 6 0 1 0 8.486 8.486"
      }
    ]
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

// ANIMUS Android App/node_modules/lucide/dist/esm/icons/refresh-cw.js
var RefreshCw = [
  "svg",
  defaultAttributes,
  [
    ["path", { d: "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" }],
    ["path", { d: "M21 3v5h-5" }],
    ["path", { d: "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" }],
    ["path", { d: "M8 16H3v5" }]
  ]
];

// ANIMUS Android App/node_modules/lucide/dist/esm/icons/send.js
var Send = [
  "svg",
  defaultAttributes,
  [
    [
      "path",
      {
        d: "M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"
      }
    ],
    ["path", { d: "m21.854 2.147-10.94 10.939" }]
  ]
];

// ANIMUS Android App/node_modules/lucide/dist/esm/icons/shield-check.js
var ShieldCheck = [
  "svg",
  defaultAttributes,
  [
    [
      "path",
      {
        d: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"
      }
    ],
    ["path", { d: "m9 12 2 2 4-4" }]
  ]
];

// ANIMUS Android App/node_modules/lucide/dist/esm/icons/star.js
var Star = [
  "svg",
  defaultAttributes,
  [
    [
      "path",
      {
        d: "M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"
      }
    ]
  ]
];

// ANIMUS Android App/node_modules/lucide/dist/esm/icons/trending-up.js
var TrendingUp = [
  "svg",
  defaultAttributes,
  [
    ["polyline", { points: "22 7 13.5 15.5 8.5 10.5 2 17" }],
    ["polyline", { points: "16 7 22 7 22 13" }]
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
var createIcons = ({ icons: icons2 = {}, nameAttr = "data-lucide", attrs = {} } = {}) => {
  if (!Object.values(icons2).length) {
    throw new Error(
      "Please provide an icons object.\nIf you want to use all the icons you can import it like:\n `import { createIcons, icons } from 'lucide';\nlucide.createIcons({icons});`"
    );
  }
  if (typeof document === "undefined") {
    throw new Error("`createIcons()` only works in a browser environment.");
  }
  const elementsToReplace = document.querySelectorAll(`[${nameAttr}]`);
  Array.from(elementsToReplace).forEach(
    (element) => replaceElement(element, { nameAttr, icons: icons2, attrs })
  );
  if (nameAttr === "data-lucide") {
    const deprecatedElements = document.querySelectorAll("[icon-name]");
    if (deprecatedElements.length > 0) {
      console.warn(
        "[Lucide] Some icons were found with the now deprecated icon-name attribute. These will still be replaced for backwards compatibility, but will no longer be supported in v1.0 and you should switch to data-lucide"
      );
      Array.from(deprecatedElements).forEach(
        (element) => replaceElement(element, { nameAttr: "icon-name", icons: icons2, attrs })
      );
    }
  }
};

// client/portal-source.js
var token = location.hash.slice(1);
var accessId = "";
var documentId = "";
if (location.hash) history.replaceState(null, "", location.pathname);
async function request(action, payload = {}) {
  const body = { ...payload, action };
  if (action === "session" && token) body.token = token;
  if (action !== "session") body.accessId = accessId;
  const endpoint = action === "session" && token.length === 22 ? "/short-access" : "/client-access";
  const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin", cache: "no-store", redirect: "error", referrerPolicy: "no-referrer", signal: AbortSignal.timeout(45e3) });
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
function selectDocument(id = "") {
  documentId = id;
}
async function loadPdf() {
  return (await request(documentId ? "document" : "pdf", documentId ? { versionId: documentId } : {})).arrayBuffer();
}
async function portalRequest(action, payload = {}, raw = false) {
  const response = await request(action, { requestId: crypto.randomUUID(), ...payload });
  return raw ? response : response.json();
}

// client/project-layout.js
var icons = { House, FileText, Boxes, TrendingUp, MessagesSquare, MessageSquarePlus, CalendarDays, CreditCard, FolderOpen, BookOpen, Star, ShieldCheck, Menu, X, ArrowRight, ArrowLeft, RefreshCw, MapPin, Check, Clock, ChevronRight, Mail, Paperclip, Send };
var icon = (name) => `<i data-lucide="${name}" aria-hidden="true"></i>`;
var navigation = [["project", "Home", "house"], ["estimate", "Estimate", "file-text"], ["design", "Design Studio", "boxes"], ["progress", "Project Progress", "trending-up"], ["messages", "Messages", "messages-square"], ["requests", "Special Requests", "message-square-plus"], ["schedule", "Schedule", "calendar-days"], ["payments", "Invoices & Payments", "credit-card"], ["documents", "Documents", "folder-open"], ["learning", "Learning Center", "book-open"], ["feedback", "Reviews & Feedback", "star"], ["aftercare", "Aftercare", "shield-check"]];
function decorate() {
  createIcons({ icons });
}
function shell(project2, tab2, content, esc2) {
  const links = navigation.map(([id, label, glyph]) => `<button data-project-tab="${id}" ${tab2 === id ? 'aria-current="page"' : ""}>${icon(glyph)}<span>${label}</span></button>`).join("");
  const brand = '<img src="/client/d2-logo.png" alt="D2"><strong>Carpentry &amp; Design</strong>';
  return `<div class="portal-scrim" data-project-menu-close></div>
  <aside class="portal-sidebar" aria-label="Project navigation"><div class="portal-brand">${brand}<button class="portal-mobile-close" data-project-menu-close aria-label="Close navigation">${icon("x")}</button></div><nav>${links}</nav><div class="portal-profile"><span class="portal-avatar">${esc2((project2.customerName || "C").slice(0, 1))}</span><div><strong>${esc2(project2.customerName)}</strong><small>Private client portal</small></div></div><button data-project-welcome>${icon("house")}Welcome page</button></aside>
  <div class="portal-workspace" data-current-screen="${esc2(tab2)}"><header class="portal-company-header"><div class="portal-brand">${brand}</div><button data-project-menu aria-label="Open project navigation" aria-expanded="false">${icon("menu")}</button></header>
  <header class="portal-page-header"><button data-project-back aria-label="Go back" title="Go back">${icon("arrow-left")}</button><div><p>YOUR PROJECT PORTAL</p><h1>${esc2(navigation.find((n) => n[0] === tab2)?.[1] || "Your project")}</h1></div><button data-project-refresh aria-label="Refresh project" title="Refresh project">${icon("refresh-cw")}</button></header><p id="projectStatus" class="project-status" role="status"></p><div class="project-body">${content}</div></div>
  <nav class="portal-bottom-nav" aria-label="Quick navigation">${[["project", "Home", "house"], ["design", "Design", "boxes"], ["progress", "Progress", "trending-up"], ["messages", "Messages", "messages-square"]].map(([id, label, glyph]) => `<button data-project-tab="${id}" ${tab2 === id ? 'aria-current="page"' : ""}>${icon(glyph)}<span>${label}</span></button>`).join("")}<button data-project-menu aria-label="More project sections" aria-expanded="false">${icon("menu")}<span>More</span></button></nav>`;
}
function home(project2, { esc: esc2, money: money2, date: date2 }) {
  const estimate = project2.versions.filter((v) => v.kind === "estimate").at(-1);
  const approved = project2.approvals.some((a) => a.versionId === estimate?.id && a.decision === "Approved");
  const milestones = project2.milestones;
  const next = milestones.find((m) => !m.completedAt);
  const photos = project2.updates.flatMap((u) => u.attachments || []).map((id) => project2.assets.find((a) => a.id === id)).filter((a) => a?.type?.startsWith("image/"));
  const steps = milestones.length ? milestones : [{ title: "Estimate", completedAt: approved }, { title: "Design" }, { title: "Preparation" }, { title: "Installation" }, { title: "Completion" }];
  const current = steps.findIndex((s) => !s.completedAt);
  const action = (target, label, glyph) => `<button data-project-tab="${target}">${icon(glyph)}<span>${label}</span>${icon("chevron-right")}</button>`;
  return `<section class="portal-hero ${photos.length ? "has-photo" : ""}">${photos[0] ? `<img data-project-image="${esc2(photos[0].id)}" alt="${esc2(photos[0].name)}">` : ""}<div><p>Welcome to your Project Portal</p><h1>Hi, ${esc2(project2.customerName || "there")}!</h1><p>Here's the latest on your ${esc2(project2.projectName)} project.</p></div><div class="portal-project-label"><small>Project ${esc2(project2.fileNumber)}</small><strong>${esc2(project2.projectName)}</strong><span>${esc2(project2.status || "Your project")}</span></div></section>
  <section class="portal-overview" aria-label="Project overview"><ol class="portal-steps">${steps.map((s, i) => `<li class="${s.completedAt ? "done" : i === current ? "current" : ""}"><span>${icon(s.completedAt ? "check" : i === current ? "clock" : "chevron-right")}</span><strong>${esc2(s.title)}</strong><small>${s.completedAt ? "Completed" : i === current ? "Up next" : s.confirmedDate ? date2(s.confirmedDate) : s.estimatedDate ? date2(s.estimatedDate) : "To be confirmed"}</small></li>`).join("")}</ol><div class="portal-kpis"><article><div class="portal-kpi-title">${icon("calendar-days")}Next Up</div><h3>${esc2(next?.title || (!approved && estimate ? "Review your estimate" : "You\u2019re all caught up"))}</h3><p>${esc2(next?.description || "Your team will post your next project update here.")}</p><button data-project-tab="${!approved && estimate ? "estimate" : "progress"}">View details ${icon("arrow-right")}</button></article><article><div class="portal-kpi-title">${icon("calendar-days")}Project Start Date</div><h3>${date2(project2.startDate)}</h3><p>${project2.startDate ? "Current project start date" : "Your team will confirm a start date."}</p><button data-project-tab="schedule">View schedule</button></article><article><div class="portal-kpi-title">${icon("credit-card")}Amount Paid</div><h3>${money2(project2.paid)}</h3><p>${project2.balance == null ? "No invoice published" : money2(project2.balance) + " remaining"}</p>${project2.invoiceAmount > 0 ? `<progress aria-label="Invoice amount paid" max="${project2.invoiceAmount}" value="${Math.min(project2.paid, project2.invoiceAmount)}"></progress>` : ""}<button data-project-tab="payments">View invoices</button></article><article><div class="portal-kpi-title">${icon("messages-square")}Project Messages</div><h3>${project2.messages.length}</h3><p>Conversations with your project team</p><button data-project-tab="messages">View messages</button></article></div></section>
  <div class="portal-home-grid"><section class="portal-updates"><header><h2>Recent Updates</h2><button data-project-tab="progress">View all</button></header><div class="portal-update-grid">${project2.updates.length ? project2.updates.slice(-3).reverse().map((u) => {
    const image = (u.attachments || []).map((id) => project2.assets.find((a) => a.id === id)).find((a) => a?.type?.startsWith("image/"));
    return `<article>${image ? `<button class="portal-photo" data-project-asset="${esc2(image.id)}" aria-label="View ${esc2(image.name)}"><img data-project-image="${esc2(image.id)}" alt="${esc2(image.name)}" loading="lazy"></button>` : `<div class="portal-update-symbol">${icon("folder-open")}</div>`}<h3>${esc2(u.title)}</h3><small>${date2(u.publishedAt)}</small><p>${esc2(u.description)}</p><button data-project-question="${esc2(u.title)}">Ask a question ${icon("arrow-right")}</button></article>`;
  }).join("") : '<p class="portal-empty">Your project updates and photos will appear here once your team publishes them.</p>'}</div></section><section class="portal-quick"><h2>Quick Actions</h2>${estimate ? `<button data-project-pdf="${esc2(estimate.id)}">${icon("file-text")}<span>View Latest Estimate</span>${icon("chevron-right")}</button>` : ""}${action("design", "Explore Your Design", "boxes")}${action("payments", "Invoices & Payments", "credit-card")}<button data-project-message>${icon("messages-square")}<span>Send a Message</span>${icon("chevron-right")}</button><button data-project-request="special" data-title="Special request or instructions">${icon("message-square-plus")}<span>Submit a Special Request</span>${icon("chevron-right")}</button></section></div><section class="portal-mobile-actions" aria-label="Project sections">${navigation.filter((n) => n[0] !== "project").map(([id, label, glyph]) => `<button data-project-tab="${id}">${icon(glyph)}<span>${label}</span></button>`).join("")}</section>`;
}

// client/project-history.js
var portalScreens = ["welcome", "project", "estimate", "design", "progress", "messages", "requests", "schedule", "payments", "documents", "learning", "feedback", "aftercare"];
function createPortalNavigation({ history: history2, location: location2, events }) {
  const listeners = /* @__PURE__ */ new Set();
  const readScreen = () => {
    const value = new URLSearchParams(location2.search).get("view");
    return portalScreens.includes(value) ? value : "welcome";
  };
  let route = { d2Portal: true, screen: readScreen(), overlay: null, depth: 0 };
  const url = (screen) => location2.pathname + (screen === "welcome" ? "" : "?view=" + encodeURIComponent(screen));
  const emit = () => {
    for (const listener of listeners) listener(route);
  };
  history2.replaceState(route, "", url(route.screen));
  events.addEventListener("popstate", (event) => {
    route = event.state?.d2Portal ? event.state : { d2Portal: true, screen: readScreen(), overlay: null, depth: 0 };
    emit();
  });
  function navigate(screen) {
    if (!portalScreens.includes(screen)) return;
    if (route.screen === screen && !route.overlay) return;
    route = { d2Portal: true, screen, overlay: null, depth: route.depth + 1 };
    history2.pushState(route, "", url(screen));
    emit();
  }
  return {
    current: () => route,
    subscribe(listener) {
      listeners.add(listener);
      listener(route);
      return () => listeners.delete(listener);
    },
    navigate,
    openOverlay(type, data = {}) {
      const replacing = route.overlay?.type === type;
      route = { ...route, overlay: { ...data, type }, depth: route.depth + (replacing ? 0 : 1) };
      history2[replacing ? "replaceState" : "pushState"](route, "", url(route.screen));
      emit();
    },
    closeOverlay() {
      if (route.overlay) history2.back();
    },
    back() {
      if (route.depth > 0) history2.back();
      else if (route.screen !== "welcome") navigate("welcome");
    }
  };
}
var navigation2;
function getPortalNavigation() {
  return navigation2 ||= createPortalNavigation({ history: window.history, location: window.location, events: window });
}

// client/project-ui.js
var esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var money = (value) => value == null ? "Not yet recorded" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value) || 0);
var date = (value) => value && !Number.isNaN(Date.parse(value)) ? new Date(String(value).length === 10 ? value + "T12:00:00" : value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Not scheduled";
var categories = ["Property Access", "Gate Codes", "Parking", "Pets", "Scheduling Preferences", "Installation Instructions", "Design Preferences", "Property Protection", "Other"];
var input = (name, label, type = "text", extra = "") => `<label>${label}<input name="${name}" type="${type}" ${extra}></label>`;
var notes = (name, label) => `<label>${label}<textarea name="${name}" rows="5" maxlength="8000" required></textarea></label>`;
var openButton = (version, label = "View PDF") => `<button type="button" data-project-pdf="${esc(version.id)}">${label}</button>`;
var root;
var api;
var openPdf;
var project = null;
var tab = "project";
var dialog;
var activeModel = null;
var refreshing = false;
var imageCache = /* @__PURE__ */ new Map();
var navigation3 = getPortalNavigation();
var smsNumber = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length === 10 ? "+1" + digits : "+" + digits;
};
var messageDraft = "";
var latest = (kind) => project?.versions.filter((v) => v.kind === kind).at(-1);
var attachmentLinks = (ids) => (ids || []).map((id) => {
  const asset = project.assets.find((a) => a.id === id);
  return asset ? `<button type="button" data-project-asset="${esc(asset.id)}">${esc(asset.name)}</button>` : "";
}).join("");
function status(message, error = false) {
  const output = document.getElementById("projectStatus");
  if (output) {
    output.textContent = message;
    output.classList.toggle("error", error);
  }
}
async function refresh() {
  if (refreshing) return;
  refreshing = true;
  try {
    project = await api("project");
    render();
  } catch (error) {
    status(error.message, true);
  } finally {
    refreshing = false;
  }
}
function panel(title, body, actions = "") {
  return `<section class="project-section"><header><h2>${title}</h2>${actions}</header>${body}</section>`;
}
function projectContent() {
  const estimate = latest("estimate"), invoice = latest("invoice"), approved = project.approvals.some((a) => a.versionId === estimate?.id && a.decision === "Approved");
  const next = project.appointments.filter((a) => a.date >= (/* @__PURE__ */ new Date()).toLocaleDateString("en-CA")).sort((a, b) => a.date.localeCompare(b.date))[0];
  const actionItems = [estimate && !approved ? `<button data-project-pdf="${esc(estimate.id)}">Review your estimate</button><button class="primary" data-project-approve="${esc(estimate.id)}" data-kind="estimate">Approve work</button>` : "", project.designs.some((d) => !project.approvals.some((a) => a.versionId === d.id)) ? '<button data-project-tab="design">Review your design</button>' : "", project.messages.some((m) => m.from === "staff") ? '<button data-project-tab="messages">Read project messages</button>' : "", invoice && project.balance > 0 ? '<button data-project-tab="documents">Review your invoice</button>' : ""].filter(Boolean).join("");
  return `<section class="project-intro"><p class="eyebrow">${esc(project.fileNumber)} \xB7 ${esc(project.status)}</p><h1>${esc(project.projectName)}</h1><p>${esc(project.customerName)}</p></section>${panel("Your next steps", actionItems ? `<div class="project-actions">${actionItems}</div>` : "<p>There are no approval actions waiting right now.</p>")}
  <dl class="project-financials"><div><dt>Approved work</dt><dd>${money(project.approvedAmount)}</dd></div><div><dt>Paid</dt><dd>${money(project.paid)}</dd></div><div><dt>Invoice balance</dt><dd>${project.balance == null ? "No published invoice" : money(project.balance)}</dd></div><div><dt>Start date</dt><dd>${date(project.startDate)}</dd></div></dl>
  ${panel("Project journey", project.milestones.length ? `<ol class="project-milestones">${project.milestones.map((m) => `<li class="${m.completedAt ? "complete" : ""}"><strong>${esc(m.title)}</strong><p>${esc(m.description)}</p><small>${m.completedAt ? "Completed " + date(m.completedAt) : m.confirmedDate ? "Confirmed " + date(m.confirmedDate) : m.estimatedDate ? "Estimated " + date(m.estimatedDate) : "Date to be confirmed"}</small></li>`).join("")}</ol>` : "<p>Published milestones will appear here.</p>")}
  ${panel("Schedule", project.appointments.length ? project.appointments.map((a) => `<article class="project-row"><div><h3>${esc(a.title)}</h3><p>${date(a.date)}${a.time ? " \xB7 " + esc(a.time) : ""}${a.estimated ? " \xB7 Estimated" : ""}</p><p>${esc(a.instructions)}</p></div><div class="project-actions"><button data-project-confirm="${a.id}">Confirm</button><button data-project-calendar="${a.id}">Add to calendar</button><button data-project-request="schedule" data-title="Request a schedule change">Request change</button></div></article>`).join("") : "<p>No appointments have been published.</p>")}
  ${panel("Prepare for your visit", project.checklist.length ? project.checklist.map((i) => `<label class="project-check"><input type="checkbox" data-project-check="${esc(i.id)}" ${i.completed ? "checked" : ""}>${esc(i.title)}</label>`).join("") : "<p>Your project preparation checklist will appear here.</p>")}
  ${panel("Project updates", project.updates.length ? project.updates.slice().reverse().map((u) => `<article class="project-update"><small>${date(u.publishedAt)} \xB7 ${esc(u.category)}</small><h3>${esc(u.title)}</h3><p>${esc(u.description)}</p><div class="project-actions">${attachmentLinks(u.attachments)}<button data-project-question="${esc(u.title)}">Ask a question</button></div></article>`).join("") : "<p>Your team will publish project updates here.</p>")}
  ${panel("Completion & future projects", '<div class="project-actions"><button data-project-request="punch" data-title="Report an outstanding issue">Report an issue</button><button data-project-request="completion" data-title="Final walkthrough confirmation">Confirm walkthrough</button><button data-project-request="new-project" data-title="Request another estimate">Another project</button><button data-project-request="referral" data-title="Refer a friend">Refer a friend</button></div>')}`;
}
function estimatesContent() {
  const versions = project.versions.filter((v) => ["estimate", "change-order", "agreement"].includes(v.kind));
  return panel("Estimates & agreements", versions.length ? versions.slice().reverse().map((v) => {
    const response = project.approvals.find((a) => a.versionId === v.id), current = latest(v.kind)?.id === v.id;
    return `<article class="project-version"><header><div><small>${esc(v.kind)} \xB7 V${v.sequence} \xB7 ${date(v.publishedAt)}</small><h3>${esc(v.title)}</h3></div><strong>${money(v.amount)}</strong></header>${v.kind === "change-order" ? `<p>${esc(v.scheduleImpact || "Schedule impact to be confirmed with your team.")}</p>` : ""}<div class="project-actions">${openButton(v)}<button data-project-message data-version="${esc(v.id)}">Ask a question</button>${current && !response ? `<button data-project-approve="${esc(v.id)}" data-kind="${v.kind}">Review & ${v.kind === "agreement" ? "sign" : "approve"}</button>${v.kind === "change-order" ? `<button data-project-decline="${esc(v.id)}" data-kind="${v.kind}">Decline</button>` : ""}` : ""}</div>${response ? `<p class="project-response">${esc(response.decision)} by ${esc(response.customerName)} \xB7 ${date(response.at)}</p>` : !current ? "<p>Previous version</p>" : ""}${v.items?.length ? `<details><summary>Scope & line items</summary>${v.items.map((item) => `<details class="project-line"><summary>${esc(item.description.split("\n")[0] || "Project detail")}${item.total !== "" ? `<span>${money(item.total)}</span>` : ""}</summary><p>${esc(item.description)}</p>${item.qty !== "" ? `<p>Quantity: ${esc(item.qty)}</p>` : ""}<button data-project-revision="${esc(v.id)}" data-item="${esc(item.id)}">Request a change to this item</button></details>`).join("")}</details>` : ""}</article>`;
  }).join("") : "<p>No documents have been published.</p>");
}
function designContent() {
  return `${panel("Design Studio", project.designs.length ? project.designs.slice().reverse().map((d) => `<article class="project-version"><small>Design V${esc(d.version)} \xB7 ${esc(d.status)}</small><h3>${esc(d.title)}</h3><p>${esc(d.description)}</p><div class="project-actions"><button data-project-model="${esc(d.id)}">Explore 3D model</button><button data-project-design-comment="${esc(d.id)}">Discuss design</button>${!project.approvals.some((a) => a.versionId === d.id) ? `<button data-project-approve="${esc(d.id)}" data-kind="design">Approve design</button>` : ""}</div></article>`).join("") : "<p>Your team will publish designs for your review here.</p>")}
  ${panel("Video walkthroughs", project.videos.length ? project.videos.map((v) => `<article class="project-version"><h3>${esc(v.title)}</h3><p>${esc(v.description)}</p><small>${v.archived ? "Archived \xB7 Available on request" : "Design version " + esc(v.designVersion || "Not specified")}</small><div class="project-actions">${v.archived ? `<button data-project-video-restore="${esc(v.id)}">Request archived video</button>` : `<button data-project-video="${esc(v.id)}">Play walkthrough</button><button data-project-video-comment="${esc(v.id)}">Ask about a timestamp</button>`}</div></article>`).join("") : "<p>No walkthrough has been published yet.</p>")}
  ${panel("Materials & finishes", project.selections.length ? project.selections.map((s) => `<article class="project-version"><h3>${esc(s.title)}</h3><p>${esc(s.description)}</p><div class="project-options">${s.options.map((o) => `<button data-project-selection="${esc(s.id)}" data-option="${esc(o.id)}" aria-pressed="${s.response?.optionId === o.id}"><strong>${esc(o.label)}</strong><small>${esc(o.description)}</small><span>${o.priceDifference ? "Proposed difference " + money(o.priceDifference) : "No proposed price difference"}</span></button>`).join("")}</div><p class="project-muted">Selections do not change your approved price. Scope or price changes require a separate revision or change order.</p></article>`).join("") : "<p>Your available selections will appear here.</p>")}`;
}
function documentsContent() {
  const invoices = project.versions.filter((v) => v.kind === "invoice");
  return `${estimatesContent()}${panel("Invoices & payments", invoices.length ? invoices.map((v) => `<article class="project-row"><div><h3>${esc(v.title)}</h3><p>${money(v.amount)}${v.dueDate ? " \xB7 Due " + date(v.dueDate) : ""}</p></div>${openButton(v)}</article>`).join("") + `<p>Verified payments recorded: <strong>${money(project.paid)}</strong></p><p>Current invoice balance: <strong>${money(project.balance)}</strong></p>` : "<p>No invoice has been published.</p>")}
  ${project.settings.paymentInstructions || project.settings.paymentUrl ? panel("Payment options", `<p>${esc(project.settings.paymentInstructions)}</p>${project.settings.paymentUrl ? `<a class="primary" href="${esc(project.settings.paymentUrl)}" target="_blank" rel="noopener noreferrer">Open secure payment provider</a>` : ""}<p class="project-muted">Cash, bank, and other offline payments are only marked paid after staff verification.</p><button data-project-request="payment-evidence" data-title="Payment confirmation for staff review">Send payment confirmation</button>`) : ""}
  ${project.paymentHistory.length ? panel("Payment history", project.paymentHistory.map((p) => `<div class="project-row"><span>${date(p.date)} \xB7 ${esc(p.method)}</span><strong>${money(p.amount)}</strong></div>`).join("")) : ""}
  ${panel("Document library", `<label class="project-search">Search documents<input id="projectDocumentSearch" type="search" placeholder="Name or category"></label><div id="projectDocuments">${project.assets.filter((a) => a.type !== "model/gltf-binary").map((a) => `<article class="project-row" data-project-document-text="${esc((a.name + " " + a.category).toLowerCase())}"><div><h3>${esc(a.name)}</h3><small>${esc(a.category)}${a.uploadedBy === "customer" ? " \xB7 Customer upload" : ""}</small><p>${esc(a.description)}</p></div><button data-project-asset="${esc(a.id)}">View / download</button></article>`).join("") || "<p>No additional documents published.</p>"}</div>`)}
  ${panel("Aftercare", `<p>Your project\u2019s published warranty and care documents are in the document library. Coverage and effective dates come from those documents.</p><div class="project-actions"><button data-project-request="warranty" data-title="Warranty or service request">Request service</button>${project.settings.supportEmail ? `<a href="mailto:${esc(project.settings.supportEmail)}">Email your team</a>` : ""}${project.settings.supportPhone ? `<a href="tel:${esc(project.settings.supportPhone.replace(/[^+0-9]/g, ""))}">Call your team</a>` : ""}</div>`)}
  ${panel("D2 Learning Center", `<p>Find the published care instructions, preparation guides, and process documents in your library.</p>${(project.resources || []).map((r) => `<article class="project-row"><div><h3>${esc(r.title)}</h3><p>${esc(r.description)}</p>${r.projectType === project.projectType ? "<small>Recommended for your project</small>" : ""}</div><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">Open resource</a></article>`).join("")}${project.settings.website ? `<a href="${esc(project.settings.website)}" target="_blank" rel="noopener noreferrer">Explore D2\u2019s process & portfolio</a>` : ""}`)}
  ${panel("Your feedback", `<div class="project-actions"><button data-project-request="feedback" data-title="Private project feedback">Share private feedback</button>${project.settings.reviewUrl ? `<a class="primary" href="${esc(project.settings.reviewUrl)}" target="_blank" rel="noopener noreferrer">Leave Us a Google Review</a>` : "<p>Your team has not connected its verified Google review link yet.</p>"}</div>`)} `;
}
function messagesContent() {
  return `${panel("Messages", `<div class="conversation-channels"><span class="conversation-channel">Project conversation</span>${project.settings.supportPhone ? `<a href="sms:${esc(smsNumber(project.settings.supportPhone))}" aria-label="Text D2 in your phone's messaging app"><i data-lucide="messages-square" aria-hidden="true"></i>Text D2</a>` : ""}${project.settings.supportEmail ? `<a href="mailto:${esc(project.settings.supportEmail)}?subject=${encodeURIComponent("Project " + project.fileNumber)}"><i data-lucide="mail" aria-hidden="true"></i>Email D2</a>` : ""}<span class="conversation-offline">SMS sync not connected</span></div><div class="conversation-thread" aria-label="Project conversation">${project.messages.map((m) => `<article class="project-message ${m.from === "staff" ? "staff" : "customer"}"><small>${m.from === "staff" ? "D2 team" : "You"} \xB7 ${esc(new Date(m.at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }))}</small><p>${esc(m.text)}</p>${m.versionId ? `<small>${esc(project.versions.find((v) => v.id === m.versionId)?.title || "Document conversation")}</small>` : ""}${m.videoId ? `<small>Video ${Math.floor((m.seconds || 0) / 60)}:${String(Math.floor((m.seconds || 0) % 60)).padStart(2, "0")}</small>` : ""}<div class="project-actions">${attachmentLinks(m.attachments)}</div></article>`).join("") || '<div class="conversation-empty"><i data-lucide="messages-square" aria-hidden="true"></i><h3>Your conversation starts here</h3><p>Send your project team a question, photo, or update.</p></div>'}</div><form id="projectMessageComposer" class="conversation-composer"><label for="projectMessageText">Message D2</label><textarea id="projectMessageText" name="message" rows="4" maxlength="8000" required placeholder="Write your message\u2026"></textarea><div class="conversation-composer-actions"><label class="conversation-attachment"><i data-lucide="paperclip" aria-hidden="true"></i><span>Attachments</span><input name="attachments" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple></label><button class="primary" type="submit"><i data-lucide="send" aria-hidden="true"></i>Send message</button></div><p class="project-form-error" role="alert"></p></form>`)}
  ${panel("Your requests", project.requests.slice().reverse().map((r) => `<article class="project-version"><small>${esc(r.kind)} \xB7 ${esc(r.status)} \xB7 ${date(r.createdAt)}</small><h3>${esc(r.title)}</h3><p>${esc(r.description)}</p>${attachmentLinks(r.attachments)}${(r.replies || []).map((reply) => `<blockquote><small>D2 team \xB7 ${date(reply.at)}</small><p>${esc(reply.text)}</p></blockquote>`).join("")}</article>`).join("") || "<p>No requests submitted.</p>")}
  ${panel("Communication preferences", `<form id="projectPreferences"><label class="project-check"><input name="email" type="checkbox" ${project.preferences.email ? "checked" : ""}>Email me project notifications when available</label><label class="project-check"><input name="sms" type="checkbox" ${project.preferences.sms ? "checked" : ""}>Text me project notifications when available</label><button type="submit">Save preferences</button><p class="project-muted">Preferences do not activate an unconfigured delivery service.</p></form>`)}`;
}
function render() {
  if (!root || !project) return;
  const composerText = root.querySelector("#projectMessageText");
  if (composerText) messageDraft = composerText.value;
  const sectionSets = { progress: ["Project journey", "Prepare for your visit", "Project updates", "Completion & future projects"], schedule: ["Schedule"], payments: ["Invoices & payments", "Payment options", "Payment history"], documents: ["Document library"], learning: ["D2 Learning Center"], feedback: ["Your feedback"], aftercare: ["Aftercare"], requests: ["Your requests"] };
  let content = tab === "project" ? home(project, { esc, money, date }) : tab === "estimate" ? estimatesContent() : tab === "design" ? designContent() : tab === "messages" ? messagesContent() : "";
  if (sectionSets[tab]) {
    const template = document.createElement("template");
    template.innerHTML = projectContent() + documentsContent() + messagesContent();
    content = [...template.content.querySelectorAll(".project-section")].filter((section) => sectionSets[tab].includes(section.querySelector("h2")?.textContent)).map((section) => section.outerHTML).join("");
    if (tab === "requests") content = '<div class="project-actions"><button class="primary" data-project-request="special" data-title="Special request or instructions">New request</button></div>' + content;
  }
  root.innerHTML = shell(project, tab, content, esc);
  if (root.querySelector("#projectMessageText")) root.querySelector("#projectMessageText").value = messageDraft;
  root.querySelector(".portal-sidebar").inert = matchMedia("(max-width:768px)").matches;
  bind(root);
  decorate();
  hydrateImages();
}
async function imageUrl(id) {
  if (!imageCache.has(id)) imageCache.set(id, api("asset", { assetId: id }, true).then((response) => response.blob()).then((blob) => URL.createObjectURL(blob)).catch((error) => {
    imageCache.delete(id);
    throw error;
  }));
  return imageCache.get(id);
}
function hydrateImages() {
  root.querySelectorAll("[data-project-image]").forEach(async (image) => {
    try {
      const url = await imageUrl(image.dataset.projectImage);
      if (image.isConnected) image.src = url;
    } catch {
      image.alt = "Project photo unavailable";
    }
  });
}
function showTab(value) {
  navigation3.navigate(value);
}
function showDialog(title, body, onSubmit) {
  activeModel?.dispose();
  activeModel = null;
  dialog?.remove();
  dialog = document.createElement("dialog");
  dialog.className = "project-dialog";
  dialog.setAttribute("aria-label", title);
  dialog.innerHTML = `<header><h2>${esc(title)}</h2><button type="button" data-project-close aria-label="Close">\xD7</button></header><form class="project-form">${body}<p role="alert" class="project-form-error"></p>${onSubmit ? '<button class="primary" type="submit">Submit</button>' : ""}</form>`;
  const modal = dialog;
  modal.dataset.historyId = crypto.randomUUID();
  document.body.append(modal);
  modal.querySelector("[data-project-close]").onclick = () => modal.close();
  modal.addEventListener("close", () => {
    activeModel?.dispose();
    activeModel = null;
    modal.remove();
    if (navigation3.current().overlay?.id === modal.dataset.historyId) navigation3.closeOverlay();
  });
  if (onSubmit) modal.querySelector("form").onsubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget, button = form.querySelector("[type=submit]");
    button.disabled = true;
    form.querySelector("[role=alert]").textContent = "";
    try {
      await onSubmit(new FormData(form), form);
      modal.close();
      await refresh();
      status("Submitted to your D2 team.");
    } catch (error) {
      form.querySelector("[role=alert]").textContent = error.message;
    } finally {
      button.disabled = false;
    }
  };
  dialog.showModal();
  navigation3.openOverlay("dialog", { id: modal.dataset.historyId });
  return dialog;
}
async function uploaded(form) {
  const files = [...form.querySelector("[name=attachments]")?.files || []], ids = [];
  for (const file of files) {
    if (file.size > 6 * 1024 * 1024) throw Error("Each attachment must be under 6 MB.");
    const bytes2 = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes2.length; i += 8192) binary += String.fromCharCode(...bytes2.subarray(i, i + 8192));
    const result = await api("upload", { name: file.name, type: file.type, content: btoa(binary), category: "Customer upload" });
    ids.push(result.id);
  }
  return ids;
}
var uploadInput = '<label>Attachments<input name="attachments" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple></label>';
function messageForm(refs = {}, initial = "") {
  showDialog("Ask your D2 team", notes("message", "Your message") + uploadInput, async (data, form) => api("message", { ...refs, message: data.get("message"), attachments: await uploaded(form) }));
  if (initial) dialog.querySelector("textarea").value = initial;
}
function requestForm(kind, title, refs = {}) {
  showDialog(title, `${input("title", "Title", "text", `value="${esc(title)}" maxlength="180" required`)}${kind === "special" ? `<label>Category<select name="category">${categories.map((c) => `<option>${c}</option>`).join("")}</select></label>` : ""}${kind === "feedback" ? '<label>Rating<select name="rating" required><option value="">Choose</option>' + [1, 2, 3, 4, 5].map((n) => `<option>${n}</option>`).join("") + "</select></label>" : ""}${notes("description", "Details")}${uploadInput}<label class="project-check"><input type="checkbox" name="urgent">Needs attention before the next visit</label>`, async (data, form) => api("request", { kind, title: data.get("title"), description: data.get("description"), category: data.get("category") || "Other", rating: data.get("rating"), urgent: data.has("urgent"), attachments: await uploaded(form), ...refs }));
}
function approvalForm(versionId, kind, decision = "approve") {
  const version = kind === "design" ? project.designs.find((d) => d.id === versionId) : project.versions.find((v) => v.id === versionId);
  showDialog(`${decision === "decline" ? "Decline" : "Approve"} ${kind}`, `<p>${esc(version.title)}${kind !== "design" ? " \xB7 " + money(version.amount) : " \xB7 V" + version.version}</p><p>Review this exact version before confirming. Your typed name, response, version, and timestamp will be recorded.</p>${input("customerName", "Your full name", "text", 'autocomplete="name" required minlength="3" maxlength="180"')}<label class="project-check"><input name="consent" type="checkbox" required>I have reviewed this version and confirm my ${decision === "decline" ? "decline" : "approval"}.</label>`, async (data) => api(decision, { kind, versionId, customerName: data.get("customerName"), consent: data.has("consent") }));
}
async function openAsset(assetId) {
  const asset = project.assets.find((a) => a.id === assetId);
  if (asset?.type?.startsWith("image/")) {
    const modal = showDialog(asset.name, '<img class="portal-image-preview" alt="">');
    try {
      const url = await imageUrl(assetId);
      if (modal.isConnected) {
        const image = modal.querySelector("img");
        image.src = url;
        image.alt = asset.name;
      }
    } catch (error) {
      if (modal.isConnected) modal.querySelector("form").textContent = error.message;
    }
    return;
  }
  status("Opening attachment\u2026");
  try {
    const response = await api("asset", { assetId }, true), blob = await response.blob(), asset2 = project.assets.find((a) => a.id === assetId), url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = asset2?.name || "D2-document";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 3e4);
    status("Attachment downloaded.");
  } catch (error) {
    status(error.message, true);
  }
}
async function openModel(designId) {
  const design = project.designs.find((d) => d.id === designId), modal = showDialog(design.title, '<div id="projectModel" class="project-model"><p role="status">Loading model\u2026</p></div>');
  try {
    const bytes2 = await (await api("asset", { assetId: design.assetId }, true)).arrayBuffer();
    const model = await import("./model-viewer.bundle.js");
    if (modal.open) activeModel = await model.mountModel(modal.querySelector("#projectModel"), bytes2);
  } catch (error) {
    modal.querySelector("#projectModel")?.replaceChildren(Object.assign(document.createElement("p"), { textContent: error.message || "This model could not be displayed." }));
  }
}
async function openVideo(videoId) {
  const video = project.videos.find((v) => v.id === videoId), modal = showDialog(video.title, '<div id="projectVideo"><p>Preparing private playback\u2026</p></div>');
  try {
    const result = await api("video", { videoId });
    if (!modal.open) return;
    const host = modal.querySelector("#projectVideo");
    host.innerHTML = (result.provider === "r2" ? `<video controls playsinline preload="metadata" src="${esc(result.url)}" aria-label="${esc(video.title)}"></video>` : `<iframe title="${esc(video.title)}" src="${esc(result.url)}" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="no-referrer"></iframe>`) + `<button type="button" id="projectVideoQuestion">Ask a question about this moment</button>`;
    let player = host.querySelector("video");
    if (!player && typeof window.Stream === "function") player = window.Stream(host.querySelector("iframe"));
    host.querySelector("button").onclick = () => {
      const seconds = Number(player?.currentTime) || 0;
      player?.pause();
      modal.close();
      videoQuestion(videoId, seconds);
    };
    modal.addEventListener("close", () => player?.pause());
    await api("seen", { videoId });
  } catch (error) {
    modal.querySelector("#projectVideo")?.replaceChildren(Object.assign(document.createElement("p"), { textContent: error.message }));
  }
}
function videoQuestion(videoId, seconds = 0) {
  showDialog("Walkthrough question", input("timestamp", "Video time (mm:ss)", "text", `value="${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}" pattern="[0-9]{1,3}:[0-5][0-9]" required`) + notes("message", "Your question"), async (data) => {
    const [minutes, seconds2] = String(data.get("timestamp")).split(":").map(Number);
    return api("message", { videoId, seconds: minutes * 60 + seconds2, message: data.get("message"), attachments: [] });
  });
}
function downloadCalendar(appointment) {
  const escape = (value) => String(value).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, "\\$&");
  const day = appointment.date.replaceAll("-", ""), start = appointment.time ? `DTSTART;TZID=America/New_York:${day}T${appointment.time.replace(":", "")}00` : `DTSTART;VALUE=DATE:${day}`;
  const contents = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//D2//Client Portal//EN", "BEGIN:VEVENT", `UID:${escape(project.fileNumber)}-${appointment.id}@d2-portal`, `DTSTAMP:${(/* @__PURE__ */ new Date()).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`, start, `SUMMARY:${escape(appointment.title)}`, "END:VEVENT", "END:VCALENDAR", ""].join("\r\n");
  const url = URL.createObjectURL(new Blob([contents], { type: "text/calendar" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "D2-appointment.ics";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1e3);
}
function bind(host) {
  const on = (selector, fn) => host.querySelectorAll(selector).forEach((button) => button.addEventListener("click", () => fn(button)));
  on("[data-project-tab]", (button) => showTab(button.dataset.projectTab));
  on("[data-project-refresh]", refresh);
  on("[data-project-back]", () => navigation3.back());
  on("[data-project-menu]", () => {
    document.body.classList.add("portal-menu-open");
    host.querySelector(".portal-sidebar").inert = false;
    host.querySelectorAll("[data-project-menu]").forEach((button) => button.setAttribute("aria-expanded", "true"));
    host.querySelector(".portal-sidebar nav button")?.focus();
  });
  on("[data-project-menu-close]", () => {
    document.body.classList.remove("portal-menu-open");
    host.querySelector(".portal-sidebar").inert = matchMedia("(max-width:768px)").matches;
    host.querySelectorAll("[data-project-menu]").forEach((button) => button.setAttribute("aria-expanded", "false"));
    host.querySelector(".portal-company-header [data-project-menu]")?.focus();
  });
  on("[data-project-welcome]", () => navigation3.navigate("welcome"));
  on("[data-project-pdf]", (button) => {
    const v = project.versions.find((v2) => v2.id === button.dataset.projectPdf);
    openPdf(v);
  });
  on("[data-project-message]", (button) => messageForm(button.dataset.version ? { versionId: button.dataset.version } : {}));
  on("[data-project-question]", (button) => messageForm({}, `Regarding \u201C${button.dataset.projectQuestion}\u201D: `));
  on("[data-project-request]", (button) => requestForm(button.dataset.projectRequest, button.dataset.title));
  on("[data-project-revision]", (button) => requestForm("revision", "Estimate change request", { versionId: button.dataset.projectRevision, itemId: button.dataset.item }));
  on("[data-project-design-comment]", (button) => messageForm({ designId: button.dataset.projectDesignComment }));
  on("[data-project-approve]", (button) => approvalForm(button.dataset.projectApprove, button.dataset.kind));
  on("[data-project-decline]", (button) => approvalForm(button.dataset.projectDecline, button.dataset.kind, "decline"));
  on("[data-project-asset]", (button) => openAsset(button.dataset.projectAsset));
  on("[data-project-model]", (button) => openModel(button.dataset.projectModel));
  on("[data-project-video]", (button) => openVideo(button.dataset.projectVideo));
  on("[data-project-video-comment]", (button) => videoQuestion(button.dataset.projectVideoComment));
  on("[data-project-video-restore]", (button) => {
    const video = project.videos.find((v) => v.id === button.dataset.projectVideoRestore);
    messageForm({ videoId: video.id }, `Please restore the archived walkthrough: ${video.title}.`);
  });
  on("[data-project-selection]", async (button) => {
    try {
      await api("selection", { selectionId: button.dataset.projectSelection, optionId: button.dataset.option });
      await refresh();
      status("Selection sent to your team for review.");
    } catch (error) {
      status(error.message, true);
    }
  });
  on("[data-project-calendar]", (button) => downloadCalendar(project.appointments.find((a) => a.id === button.dataset.projectCalendar)));
  on("[data-project-confirm]", async (button) => {
    const appointment = project.appointments.find((a) => a.id === button.dataset.projectConfirm);
    try {
      await api("appointment", { appointmentId: appointment.id, date: appointment.date });
      await refresh();
      status("Confirmation sent to your team.");
    } catch (error) {
      status(error.message, true);
    }
  });
  host.querySelectorAll("[data-project-check]").forEach((input2) => input2.onchange = async () => {
    input2.disabled = true;
    try {
      await api("checklist", { itemId: input2.dataset.projectCheck, completed: input2.checked });
      await refresh();
    } catch (error) {
      input2.checked = !input2.checked;
      status(error.message, true);
    } finally {
      input2.disabled = false;
    }
  });
  host.querySelector("#projectDocumentSearch")?.addEventListener("input", (event) => {
    const query = event.target.value.toLowerCase();
    host.querySelectorAll("[data-project-document-text]").forEach((row) => row.hidden = !row.dataset.projectDocumentText.includes(query));
  });
  const preferences = host.querySelector("#projectPreferences");
  if (preferences) preferences.onsubmit = async (event) => {
    event.preventDefault();
    try {
      await api("preferences", { email: preferences.email.checked, sms: preferences.sms.checked });
      await refresh();
      status("Preferences saved.");
    } catch (error) {
      status(error.message, true);
    }
  };
  const composer = host.querySelector("#projectMessageComposer");
  if (composer) {
    composer.querySelector("textarea").oninput = (event) => messageDraft = event.target.value;
    composer.onsubmit = async (event) => {
      event.preventDefault();
      const submit = composer.querySelector("[type=submit]"), error = composer.querySelector("[role=alert]");
      submit.disabled = true;
      error.textContent = "";
      try {
        await api("message", { message: new FormData(composer).get("message"), attachments: await uploaded(composer) });
        messageDraft = "";
        composer.reset();
        await refresh();
        status("Message saved to your project conversation.");
      } catch (cause) {
        error.textContent = cause.message;
      } finally {
        submit.disabled = false;
      }
    };
  }
}
async function mountProject({ customer, request: request2, openDocument: openDocument2 }) {
  if (!customer.projectAccess) return;
  api = request2;
  openPdf = openDocument2;
  document.querySelector(".customer-project")?.remove();
  root = document.createElement("section");
  root.className = "customer-project";
  root.hidden = true;
  document.querySelector("main").append(root);
  const welcome = document.querySelector(".welcome");
  const actions = document.createElement("div");
  actions.className = "welcome-project-actions";
  actions.innerHTML = '<button id="enterProject" class="portal-entry" disabled>View Customer Portal</button>';
  welcome.querySelector(".welcome-project-actions")?.remove();
  welcome.append(actions);
  document.getElementById("enterProject").onclick = () => {
    if (!project) return;
    navigation3.navigate("project");
  };
  await refresh();
  if (!project) throw Error("The customer portal could not be loaded. Please retry.");
  document.getElementById("enterProject").disabled = false;
  const latestEstimate = latest("estimate");
  if (latestEstimate) document.getElementById("viewEstimate").onclick = () => openPdf(latestEstimate);
  let applied = "";
  navigation3.subscribe((route) => {
    if (dialog?.open && route.overlay?.id !== dialog.dataset.historyId) dialog.close();
    if (route.screen === applied) return;
    applied = route.screen;
    activeModel?.dispose();
    activeModel = null;
    welcome.hidden = route.screen !== "welcome";
    root.hidden = route.screen === "welcome";
    document.body.classList.toggle("project-open", route.screen !== "welcome");
    document.body.classList.remove("portal-menu-open");
    if (!root.hidden) {
      tab = route.screen;
      render();
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  matchMedia("(max-width:768px)").addEventListener("change", (event) => {
    document.body.classList.remove("portal-menu-open");
    root.querySelector(".portal-sidebar").inert = event.matches;
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Backspace" && !event.defaultPrevented && !event.altKey && !event.ctrlKey && !event.metaKey && !event.target.closest('input,textarea,select,[contenteditable="true"]')) {
      event.preventDefault();
      navigation3.back();
      return;
    }
    if (!document.body.classList.contains("portal-menu-open")) return;
    if (event.key === "Escape") {
      document.body.classList.remove("portal-menu-open");
      root.querySelector(".portal-sidebar").inert = true;
      root.querySelectorAll("[data-project-menu]").forEach((button) => button.setAttribute("aria-expanded", "false"));
      root.querySelector(".portal-company-header [data-project-menu]")?.focus();
    }
    if (event.key === "Tab") {
      const buttons = [...root.querySelectorAll(".portal-sidebar button")].filter((button) => button.getClientRects().length), first = buttons[0], last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && root && !root.hidden && !dialog?.open) refresh();
  });
}

// client/portal.js
var $ = (id) => document.getElementById(id);
createIcons({ icons: { FileText, ArrowRight, Download, X, Minus, Plus, LockKeyhole } });
var pdf = null;
var loadingTask = null;
var bytes = null;
var zoom = 1;
var renderVersion = 0;
var prepareVersion = 0;
var renderTask = null;
var observer = null;
var opening = false;
var downloadUrl = "";
var returnFocus = null;
var viewer = $("pdfViewer");
var navigation4 = getPortalNavigation();
navigation4.subscribe((route) => {
  if (route.overlay?.type === "pdf") {
    selectDocument(route.overlay.id || "");
    $("viewerTitle").textContent = route.overlay.title || "Your Estimate";
    if (!viewer.open) {
      viewer.showModal();
      zoom = 1;
      preparePdf();
    }
  } else if (viewer.open) viewer.close();
});
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
    await mountProject({ customer, request: portalRequest, openDocument });
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
  const version = ++prepareVersion;
  const current = () => version === prepareVersion && viewer.open;
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
    if (!current()) return;
    if (loaded.byteLength > 25 * 1024 * 1024) throw Error("This document is too large to display here. Please contact D2.");
    if (new TextDecoder().decode(loaded.slice(0, 5)) !== "%PDF-") throw Error("The estimate is not available as a PDF. Please contact D2.");
    $("pdfStatus").querySelector("p").textContent = "Opening document...";
    const documentBytes = new Uint8Array(loaded);
    const lib = await import("./pdf.mjs");
    if (!current()) return;
    lib.GlobalWorkerOptions.workerSrc = new URL("./pdf.worker.mjs", import.meta.url).href;
    const previous = loadingTask;
    pdf = null;
    loadingTask = null;
    await previous?.destroy();
    if (!current()) return;
    bytes = documentBytes;
    const task = lib.getDocument({ data: documentBytes.slice(), isEvalSupported: false, enableXfa: false, enableScripting: false, useSystemFonts: true });
    loadingTask = task;
    let timer, documentPdf;
    try {
      documentPdf = await Promise.race([task.promise, new Promise((_, reject) => {
        timer = setTimeout(() => {
          task.destroy();
          reject(Error("Document loading timed out."));
        }, 3e4);
      })]);
    } finally {
      clearTimeout(timer);
    }
    if (!current()) {
      await task.destroy();
      return;
    }
    pdf = documentPdf;
    if (pdf.numPages > 100) throw Error("This document is too long to display here. Please contact D2.");
    $("pageCount").textContent = `${pdf.numPages} ${pdf.numPages === 1 ? "page" : "pages"}`;
    $("downloadPdf").disabled = false;
    $("zoomBar").hidden = false;
    $("pdfStatus").hidden = true;
    await renderPages();
    if (!current()) return;
    const viewed = navigation4.current().overlay;
    if (viewed?.type === "pdf" && viewed.id) portalRequest("seen", { versionId: viewed.id }).catch(() => {
    });
  } catch (error) {
    if (!current()) return;
    if (location.hostname === "127.0.0.1") console.error("Local portal PDF check:", error.message);
    bytes = null;
    errorPdf(error.status === 401 ? "Your private link is no longer available. Please request a new link from D2." : error.message?.includes("Please contact D2") ? error.message : "Please check your connection and try again. Your original estimate has not been changed.");
  } finally {
    if (current()) {
      opening = false;
      if (!viewer.contains(document.activeElement)) $("closeViewer").focus();
    }
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
$("viewEstimate").onclick = () => openDocument(null);
async function openDocument(version) {
  selectDocument(version?.id || "");
  $("viewerTitle").textContent = version?.title || "Your Estimate";
  returnFocus = document.activeElement;
  navigation4.openOverlay("pdf", { id: version?.id || "", title: version?.title || "Your Estimate" });
}
$("closeViewer").onclick = () => viewer.close();
viewer.addEventListener("click", (event) => {
  if (event.target === viewer) {
    const r = viewer.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) viewer.close();
  }
});
viewer.addEventListener("close", () => {
  prepareVersion++;
  opening = false;
  renderVersion++;
  observer?.disconnect();
  renderTask?.cancel();
  const previous = loadingTask;
  loadingTask = null;
  pdf = null;
  bytes = null;
  previous?.destroy().catch(() => {
  });
  if (navigation4.current().overlay?.type === "pdf") navigation4.closeOverlay();
  if (returnFocus?.isConnected) returnFocus.focus();
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
lucide/dist/esm/icons/arrow-left.js:
lucide/dist/esm/icons/arrow-right.js:
lucide/dist/esm/icons/book-open.js:
lucide/dist/esm/icons/boxes.js:
lucide/dist/esm/icons/calendar-days.js:
lucide/dist/esm/icons/check.js:
lucide/dist/esm/icons/chevron-right.js:
lucide/dist/esm/icons/clock.js:
lucide/dist/esm/icons/credit-card.js:
lucide/dist/esm/icons/download.js:
lucide/dist/esm/icons/file-text.js:
lucide/dist/esm/icons/folder-open.js:
lucide/dist/esm/icons/house.js:
lucide/dist/esm/icons/lock-keyhole.js:
lucide/dist/esm/icons/mail.js:
lucide/dist/esm/icons/map-pin.js:
lucide/dist/esm/icons/menu.js:
lucide/dist/esm/icons/message-square-plus.js:
lucide/dist/esm/icons/messages-square.js:
lucide/dist/esm/icons/minus.js:
lucide/dist/esm/icons/paperclip.js:
lucide/dist/esm/icons/plus.js:
lucide/dist/esm/icons/refresh-cw.js:
lucide/dist/esm/icons/send.js:
lucide/dist/esm/icons/shield-check.js:
lucide/dist/esm/icons/star.js:
lucide/dist/esm/icons/trending-up.js:
lucide/dist/esm/icons/x.js:
lucide/dist/esm/lucide.js:
  (**
   * @license lucide v0.468.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)
*/
