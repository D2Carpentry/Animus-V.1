(()=>{var A=(e,o,r=[])=>{let f=document.createElementNS("http://www.w3.org/2000/svg",e);return Object.keys(o).forEach(t=>{f.setAttribute(t,String(o[t]))}),r.length&&r.forEach(t=>{let l=A(...t);f.appendChild(l)}),f},B=([e,o,r])=>A(e,o,r);var y=e=>Array.from(e.attributes).reduce((o,r)=>(o[r.name]=r.value,o),{}),R=e=>typeof e=="string"?e:!e||!e.class?"":e.class&&typeof e.class=="string"?e.class.split(" "):e.class&&Array.isArray(e.class)?e.class:"",b=e=>e.flatMap(R).map(r=>r.trim()).filter(Boolean).filter((r,f,t)=>t.indexOf(r)===f).join(" "),T=e=>e.replace(/(\w)(\w*)(_|-|\s*)/g,(o,r,f)=>r.toUpperCase()+f.toLowerCase()),p=(e,{nameAttr:o,icons:r,attrs:f})=>{let t=e.getAttribute(o);if(t==null)return;let l=T(t),S=r[l];if(!S)return console.warn(`${e.outerHTML} icon name was not found in the provided icons object.`);let w=y(e),[F,M,D]=S,P={...M,"data-lucide":t,...f,...w},k=b(["lucide",`lucide-${t}`,w,f]);k&&Object.assign(P,{class:k});let L=B([F,P,D]);return e.parentNode?.replaceChild(L,e)};var a={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor","stroke-width":2,"stroke-linecap":"round","stroke-linejoin":"round"};var m=["svg",a,[["path",{d:"M20 6 9 17l-5-5"}]]];var x=["svg",a,[["path",{d:"m15 18-6-6 6-6"}]]];var i=["svg",a,[["path",{d:"m9 18 6-6-6-6"}]]];var u=["svg",a,[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2"}],["path",{d:"M9 3v18"}],["path",{d:"M15 3v18"}]]];var n=["svg",a,[["path",{d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"}],["polyline",{points:"7 10 12 15 17 10"}],["line",{x1:"12",x2:"12",y1:"15",y2:"3"}]]];var s=["svg",a,[["circle",{cx:"12",cy:"12",r:"1"}],["circle",{cx:"19",cy:"12",r:"1"}],["circle",{cx:"5",cy:"12",r:"1"}]]];var c=["svg",a,[["path",{d:"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"}],["path",{d:"m15 5 4 4"}]]];var d=["svg",a,[["path",{d:"M5 12h14"}],["path",{d:"M12 5v14"}]]];var C=["svg",a,[["circle",{cx:"11",cy:"11",r:"8"}],["path",{d:"m21 21-4.3-4.3"}]]];var h=["svg",a,[["line",{x1:"21",x2:"14",y1:"4",y2:"4"}],["line",{x1:"10",x2:"3",y1:"4",y2:"4"}],["line",{x1:"21",x2:"12",y1:"12",y2:"12"}],["line",{x1:"8",x2:"3",y1:"12",y2:"12"}],["line",{x1:"21",x2:"16",y1:"20",y2:"20"}],["line",{x1:"12",x2:"3",y1:"20",y2:"20"}],["line",{x1:"14",x2:"14",y1:"2",y2:"6"}],["line",{x1:"8",x2:"8",y1:"10",y2:"14"}],["line",{x1:"16",x2:"16",y1:"18",y2:"22"}]]];var g=({icons:e={},nameAttr:o="data-lucide",attrs:r={}}={})=>{if(!Object.values(e).length)throw new Error(`Please provide an icons object.
If you want to use all the icons you can import it like:
 \`import { createIcons, icons } from 'lucide';
lucide.createIcons({icons});\``);if(typeof document>"u")throw new Error("`createIcons()` only works in a browser environment.");let f=document.querySelectorAll(`[${o}]`);if(Array.from(f).forEach(t=>p(t,{nameAttr:o,icons:e,attrs:r})),o==="data-lucide"){let t=document.querySelectorAll("[icon-name]");t.length>0&&(console.warn("[Lucide] Some icons were found with the now deprecated icon-name attribute. These will still be replaced for backwards compatibility, but will no longer be supported in v1.0 and you should switch to data-lucide"),Array.from(t).forEach(l=>p(l,{nameAttr:"icon-name",icons:e,attrs:r})))}};window.renderAnimusWorkfileIcons=()=>g({icons:{Pencil:c,Plus:d,Ellipsis:s},nameAttr:"data-wf-icon"});window.renderAnimusRevenueIcons=()=>g({icons:{Search:C,SlidersHorizontal:h,Download:n,Columns3:u,Plus:d,Ellipsis:s,Check:m,ChevronLeft:x,ChevronRight:i},nameAttr:"data-revenue-icon"});})();
/*! Bundled license information:

lucide/dist/esm/createElement.js:
lucide/dist/esm/replaceElement.js:
lucide/dist/esm/defaultAttributes.js:
lucide/dist/esm/icons/check.js:
lucide/dist/esm/icons/chevron-left.js:
lucide/dist/esm/icons/chevron-right.js:
lucide/dist/esm/icons/columns-3.js:
lucide/dist/esm/icons/download.js:
lucide/dist/esm/icons/ellipsis.js:
lucide/dist/esm/icons/pencil.js:
lucide/dist/esm/icons/plus.js:
lucide/dist/esm/icons/search.js:
lucide/dist/esm/icons/sliders-horizontal.js:
lucide/dist/esm/lucide.js:
  (**
   * @license lucide v0.468.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)
*/
