(()=>{var c=(e,o,a=[])=>{let t=document.createElementNS("http://www.w3.org/2000/svg",e);return Object.keys(o).forEach(r=>{t.setAttribute(r,String(o[r]))}),a.length&&a.forEach(r=>{let l=c(...r);t.appendChild(l)}),t},C=([e,o,a])=>c(e,o,a);var k=e=>Array.from(e.attributes).reduce((o,a)=>(o[a.name]=a.value,o),{}),A=e=>typeof e=="string"?e:!e||!e.class?"":e.class&&typeof e.class=="string"?e.class.split(" "):e.class&&Array.isArray(e.class)?e.class:"",B=e=>e.flatMap(A).map(a=>a.trim()).filter(Boolean).filter((a,t,r)=>r.indexOf(a)===t).join(" "),F=e=>e.replace(/(\w)(\w*)(_|-|\s*)/g,(o,a,t)=>a.toUpperCase()+t.toLowerCase()),u=(e,{nameAttr:o,icons:a,attrs:t})=>{let r=e.getAttribute(o);if(r==null)return;let l=F(r),m=a[l];if(!m)return console.warn(`${e.outerHTML} icon name was not found in the provided icons object.`);let x=k(e),[S,g,w]=m,i={...g,"data-lucide":r,...t,...x},n=B(["lucide",`lucide-${r}`,x,t]);n&&Object.assign(i,{class:n});let P=C([S,i,w]);return e.parentNode?.replaceChild(P,e)};var f={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor","stroke-width":2,"stroke-linecap":"round","stroke-linejoin":"round"};var s=["svg",f,[["circle",{cx:"12",cy:"12",r:"1"}],["circle",{cx:"19",cy:"12",r:"1"}],["circle",{cx:"5",cy:"12",r:"1"}]]];var d=["svg",f,[["path",{d:"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"}],["path",{d:"m15 5 4 4"}]]];var p=["svg",f,[["path",{d:"M5 12h14"}],["path",{d:"M12 5v14"}]]];var h=({icons:e={},nameAttr:o="data-lucide",attrs:a={}}={})=>{if(!Object.values(e).length)throw new Error(`Please provide an icons object.
If you want to use all the icons you can import it like:
 \`import { createIcons, icons } from 'lucide';
lucide.createIcons({icons});\``);if(typeof document>"u")throw new Error("`createIcons()` only works in a browser environment.");let t=document.querySelectorAll(`[${o}]`);if(Array.from(t).forEach(r=>u(r,{nameAttr:o,icons:e,attrs:a})),o==="data-lucide"){let r=document.querySelectorAll("[icon-name]");r.length>0&&(console.warn("[Lucide] Some icons were found with the now deprecated icon-name attribute. These will still be replaced for backwards compatibility, but will no longer be supported in v1.0 and you should switch to data-lucide"),Array.from(r).forEach(l=>u(l,{nameAttr:"icon-name",icons:e,attrs:a})))}};window.renderAnimusWorkfileIcons=()=>h({icons:{Pencil:d,Plus:p,Ellipsis:s},nameAttr:"data-wf-icon"});})();
/*! Bundled license information:

lucide/dist/esm/createElement.js:
lucide/dist/esm/replaceElement.js:
lucide/dist/esm/defaultAttributes.js:
lucide/dist/esm/icons/ellipsis.js:
lucide/dist/esm/icons/pencil.js:
lucide/dist/esm/icons/plus.js:
lucide/dist/esm/lucide.js:
  (**
   * @license lucide v0.468.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)
*/
