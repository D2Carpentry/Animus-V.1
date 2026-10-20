const request=new URL(location.href).searchParams.get('request');
let resolveSeed;
const seed=new Promise((resolve,reject)=>{resolveSeed=resolve;setTimeout(()=>reject(Error('Preview timed out. Please select the workfile again.')),15000);});
window.addEventListener('message',event=>{if(event.origin===location.origin&&event.source===parent&&event.data?.type==='animus-playground-seed'&&event.data.request===request)resolveSeed(event.data.seed);});
parent.postMessage({type:'animus-playground-ready',request},location.origin);
export async function loadCustomer(){const data=await seed;return {firstName:data.firstName};}
export async function loadPdf(){
  const data=await seed;let bytes;
  if(data.documentPath){const response=await fetch(data.documentPath,{credentials:'same-origin',cache:'no-store'});if(!response.ok)throw Error('Saved PDF could not be loaded.');bytes=await response.arrayBuffer();}
  else if(data.estimate&&!data.unavailable)bytes=await (await window.AnimusPortalPdf.create(data.estimate)).arrayBuffer();
  else throw Error('No supported saved estimate is available.');
  parent.postMessage({type:'animus-playground-pdf',request},location.origin);return bytes;
}
