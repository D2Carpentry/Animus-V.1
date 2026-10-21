(()=>{var b=(a,o,r=[])=>{let f=document.createElementNS("http://www.w3.org/2000/svg",a);return Object.keys(o).forEach(t=>{f.setAttribute(t,String(o[t]))}),r.length&&r.forEach(t=>{let s=b(...t);f.appendChild(s)}),f},T=([a,o,r])=>b(a,o,r);var H=a=>Array.from(a.attributes).reduce((o,r)=>(o[r.name]=r.value,o),{}),E=a=>typeof a=="string"?a:!a||!a.class?"":a.class&&typeof a.class=="string"?a.class.split(" "):a.class&&Array.isArray(a.class)?a.class:"",G=a=>a.flatMap(E).map(r=>r.trim()).filter(Boolean).filter((r,f,t)=>t.indexOf(r)===f).join(" "),I=a=>a.replace(/(\w)(\w*)(_|-|\s*)/g,(o,r,f)=>r.toUpperCase()+f.toLowerCase()),g=(a,{nameAttr:o,icons:r,attrs:f})=>{let t=a.getAttribute(o);if(t==null)return;let s=I(t),D=r[s];if(!D)return console.warn(`${a.outerHTML} icon name was not found in the provided icons object.`);let L=H(a),[q,v,U]=D,y={...v,"data-lucide":t,...f,...L},R=G(["lucide",`lucide-${t}`,L,f]);R&&Object.assign(y,{class:R});let O=T([q,y,U]);return a.parentNode?.replaceChild(O,a)};var e={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor","stroke-width":2,"stroke-linecap":"round","stroke-linejoin":"round"};var S=["svg",e,[["path",{d:"M12 16v5"}],["path",{d:"M16 14v7"}],["path",{d:"M20 10v11"}],["path",{d:"m22 3-8.646 8.646a.5.5 0 0 1-.708 0L9.354 8.354a.5.5 0 0 0-.707 0L2 15"}],["path",{d:"M4 18v3"}],["path",{d:"M8 14v7"}]]];var w=["svg",e,[["path",{d:"M20 6 9 17l-5-5"}]]];var p=["svg",e,[["path",{d:"m15 18-6-6 6-6"}]]];var m=["svg",e,[["path",{d:"m9 18 6-6-6-6"}]]];var u=["svg",e,[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2"}],["path",{d:"M9 3v18"}],["path",{d:"M15 3v18"}]]];var A=["svg",e,[["line",{x1:"12",x2:"12",y1:"2",y2:"22"}],["path",{d:"M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"}]]];var x=["svg",e,[["path",{d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"}],["polyline",{points:"7 10 12 15 17 10"}],["line",{x1:"12",x2:"12",y1:"15",y2:"3"}]]];var l=["svg",e,[["circle",{cx:"12",cy:"12",r:"1"}],["circle",{cx:"19",cy:"12",r:"1"}],["circle",{cx:"5",cy:"12",r:"1"}]]];var i=["svg",e,[["path",{d:"M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"}],["path",{d:"M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"}],["path",{d:"M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"}]]];var P=["svg",e,[["path",{d:"M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"}],["path",{d:"M12 22V12"}],["path",{d:"m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7"}],["path",{d:"m7.5 4.27 9 5.15"}]]];var n=["svg",e,[["path",{d:"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"}],["path",{d:"m15 5 4 4"}]]];var d=["svg",e,[["path",{d:"M5 12h14"}],["path",{d:"M12 5v14"}]]];var k=["svg",e,[["path",{d:"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"}],["path",{d:"M21 3v5h-5"}],["path",{d:"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"}],["path",{d:"M8 16H3v5"}]]];var c=["svg",e,[["circle",{cx:"11",cy:"11",r:"8"}],["path",{d:"m21 21-4.3-4.3"}]]];var C=["svg",e,[["line",{x1:"21",x2:"14",y1:"4",y2:"4"}],["line",{x1:"10",x2:"3",y1:"4",y2:"4"}],["line",{x1:"21",x2:"12",y1:"12",y2:"12"}],["line",{x1:"8",x2:"3",y1:"12",y2:"12"}],["line",{x1:"21",x2:"16",y1:"20",y2:"20"}],["line",{x1:"12",x2:"3",y1:"20",y2:"20"}],["line",{x1:"14",x2:"14",y1:"2",y2:"6"}],["line",{x1:"8",x2:"8",y1:"10",y2:"14"}],["line",{x1:"16",x2:"16",y1:"18",y2:"22"}]]];var M=["svg",e,[["path",{d:"M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"}]]];var B=["svg",e,[["path",{d:"M3 6h18"}],["path",{d:"M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"}],["path",{d:"M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"}],["line",{x1:"10",x2:"10",y1:"11",y2:"17"}],["line",{x1:"14",x2:"14",y1:"11",y2:"17"}]]];var F=["svg",e,[["path",{d:"M18 6 6 18"}],["path",{d:"m6 6 12 12"}]]];var h=({icons:a={},nameAttr:o="data-lucide",attrs:r={}}={})=>{if(!Object.values(a).length)throw new Error(`Please provide an icons object.
If you want to use all the icons you can import it like:
 \`import { createIcons, icons } from 'lucide';
lucide.createIcons({icons});\``);if(typeof document>"u")throw new Error("`createIcons()` only works in a browser environment.");let f=document.querySelectorAll(`[${o}]`);if(Array.from(f).forEach(t=>g(t,{nameAttr:o,icons:a,attrs:r})),o==="data-lucide"){let t=document.querySelectorAll("[icon-name]");t.length>0&&(console.warn("[Lucide] Some icons were found with the now deprecated icon-name attribute. These will still be replaced for backwards compatibility, but will no longer be supported in v1.0 and you should switch to data-lucide"),Array.from(t).forEach(s=>g(s,{nameAttr:"icon-name",icons:a,attrs:r})))}};window.renderAnimusWorkfileIcons=()=>h({icons:{Pencil:n,Plus:d,Ellipsis:l},nameAttr:"data-wf-icon"});window.renderAnimusRevenueIcons=()=>h({icons:{Search:c,SlidersHorizontal:C,Download:x,Columns3:u,Plus:d,Ellipsis:l,Check:w,ChevronLeft:p,ChevronRight:m},nameAttr:"data-revenue-icon"});window.renderAnimusPriceIcons=()=>h({icons:{Search:c,SlidersHorizontal:C,Download:x,Columns3:u,Plus:d,Ellipsis:l,ChevronLeft:p,ChevronRight:m,Pencil:n,Package:P,DollarSign:A,Layers:i,RefreshCw:k,Star:M,ChartNoAxesCombined:S,Trash2:B,X:F},nameAttr:"data-price-icon"});})();
/*! Bundled license information:

lucide/dist/esm/createElement.js:
lucide/dist/esm/replaceElement.js:
lucide/dist/esm/defaultAttributes.js:
lucide/dist/esm/icons/chart-no-axes-combined.js:
lucide/dist/esm/icons/check.js:
lucide/dist/esm/icons/chevron-left.js:
lucide/dist/esm/icons/chevron-right.js:
lucide/dist/esm/icons/columns-3.js:
lucide/dist/esm/icons/dollar-sign.js:
lucide/dist/esm/icons/download.js:
lucide/dist/esm/icons/ellipsis.js:
lucide/dist/esm/icons/layers.js:
lucide/dist/esm/icons/package.js:
lucide/dist/esm/icons/pencil.js:
lucide/dist/esm/icons/plus.js:
lucide/dist/esm/icons/refresh-cw.js:
lucide/dist/esm/icons/search.js:
lucide/dist/esm/icons/sliders-horizontal.js:
lucide/dist/esm/icons/star.js:
lucide/dist/esm/icons/trash-2.js:
lucide/dist/esm/icons/x.js:
lucide/dist/esm/lucide.js:
  (**
   * @license lucide v0.468.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)
*/
