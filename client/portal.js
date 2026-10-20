import {createIcons,FileText,ArrowRight,Download,X,Minus,Plus,LockKeyhole} from '../ANIMUS Android App/node_modules/lucide/dist/esm/lucide.js';
import {loadCustomer,loadPdf} from './portal-source.js';
const $=id=>document.getElementById(id);
createIcons({icons:{FileText,ArrowRight,Download,X,Minus,Plus,LockKeyhole}});
let pdf=null,loadingTask=null,bytes=null,zoom=1,renderVersion=0,renderTask=null,observer=null,opening=false,downloadUrl='',returnFocus=null;
const viewer=$('pdfViewer');
window.addEventListener('d2-render-status',event=>{$('pdfStatus').querySelector('p').textContent=event.detail;});
async function loadAccess(){
  $('accessError').hidden=true;$('retryAccess').hidden=true;$('welcomeBusy').hidden=false;$('viewEstimate').disabled=true;
  try{const customer=await loadCustomer();$('welcomeTitle').textContent=`Welcome, ${customer.firstName}.`;$('welcomeCopy').textContent="We've prepared your personalized estimate for review. From here, you can explore the project details, ask questions, and approve your estimate whenever you're ready.";$('viewEstimate').disabled=false;}
  catch(error){$('welcomeTitle').textContent=error.status===401?'Your private estimate.':'Welcome.';$('welcomeCopy').textContent=error.status===401?'This link is unavailable. Please reopen your private link or contact D2 for a new one.':'We could not prepare your portal just now.';$('accessError').textContent=error.status===401?'Your link may have expired or been replaced.':'Please check your connection and try again.';$('accessError').hidden=false;$('retryAccess').hidden=error.status===401;}
  finally{$('welcomeBusy').hidden=true;}
}
function errorPdf(message){renderVersion++;observer?.disconnect();renderTask?.cancel();$('pdfPages').replaceChildren();$('pdfStatus').hidden=true;$('pdfError').hidden=false;$('pdfErrorText').textContent=message;$('zoomBar').hidden=true;}
async function preparePdf(){
  if(opening)return;opening=true;$('pdfStatus').hidden=false;$('pdfError').hidden=true;$('downloadPdf').disabled=true;$('downloadError').hidden=true;
  renderVersion++;observer?.disconnect();renderTask?.cancel();pdf=null;$('pdfPages').replaceChildren();$('zoomBar').hidden=true;
  try{
    $('pdfStatus').querySelector('p').textContent='Loading your estimate...';
    const loaded=await loadPdf();if(loaded.byteLength>25*1024*1024)throw Error('This document is too large to display here. Please contact D2.');
    if(new TextDecoder().decode(loaded.slice(0,5))!=='%PDF-')throw Error('The estimate is not available as a PDF. Please contact D2.');
    $('pdfStatus').querySelector('p').textContent='Opening document...';
    bytes=new Uint8Array(loaded);const lib=await import('./pdf.mjs');lib.GlobalWorkerOptions.workerSrc=new URL('./pdf.worker.mjs',import.meta.url).href;
    const previous=loadingTask;pdf=null;loadingTask=null;await previous?.destroy();const task=lib.getDocument({data:bytes.slice(),isEvalSupported:false,enableXfa:false,enableScripting:false,useSystemFonts:true});loadingTask=task;let timer;
    try{pdf=await Promise.race([task.promise,new Promise((_,reject)=>{timer=setTimeout(()=>{task.destroy();reject(Error('Document loading timed out.'));},30000);})]);}finally{clearTimeout(timer);}
    if(pdf.numPages>100)throw Error('This document is too long to display here. Please contact D2.');
    $('pageCount').textContent=`${pdf.numPages} ${pdf.numPages===1?'page':'pages'}`;$('downloadPdf').disabled=false;$('zoomBar').hidden=false;$('pdfStatus').hidden=true;
    await renderPages();
  }catch(error){if(location.hostname==='127.0.0.1')console.error('Local portal PDF check:',error.message);bytes=null;errorPdf(error.status===401?'Your private link is no longer available. Please request a new link from D2.':error.message?.includes('Please contact D2')?error.message:'Please check your connection and try again. Your original estimate has not been changed.');}
  finally{opening=false;if(viewer.open&&!viewer.contains(document.activeElement))$('closeViewer').focus();}
}
async function renderPages(){
  if(!pdf||!viewer.open)return;const documentPdf=pdf;const version=++renderVersion;observer?.disconnect();renderTask?.cancel();$('pdfPages').replaceChildren();
  $('zoomLevel').textContent=zoom===1?'Fit width':`${Math.round(zoom*100)}%`;
  const width=Math.max(240,$('pdfScroll').clientWidth-(innerWidth<=600?16:40));const pages=new Map();
  for(let number=1;number<=documentPdf.numPages;number++){
    if(version!==renderVersion)return;let page;try{page=await documentPdf.getPage(number);}catch(error){if(version!==renderVersion)return;throw error;}if(version!==renderVersion)return;const base=page.getViewport({scale:1});const displayWidth=width*zoom;
    const figure=document.createElement('figure');figure.className='pdf-page';figure.style.width=displayWidth+'px';figure.style.height=displayWidth*base.height/base.width+'px';figure.setAttribute('aria-label',`Estimate page ${number}`);figure.dataset.page=number;
    const caption=document.createElement('figcaption');caption.textContent=`${number} / ${pdf.numPages}`;figure.append(caption);$('pdfPages').append(figure);pages.set(figure,{page,width:displayWidth});
  }
  let queue=Promise.resolve();
  observer=new IntersectionObserver(entries=>{for(const entry of entries){const info=pages.get(entry.target);info.visible=entry.isIntersecting;if(!entry.isIntersecting){const old=entry.target.querySelector('canvas');if(old&&info.done){old.width=old.height=0;old.remove();info.done=false;info.page.cleanup();}continue;}queue=queue.then(async()=>{
    if(version!==renderVersion||!viewer.open||!info.visible||info.done)return;const base=info.page.getViewport({scale:1});const ratio=Math.min(devicePixelRatio||1,2);const maxScale=Math.sqrt(3e6/(base.width*base.height));const viewport=info.page.getViewport({scale:Math.min(info.width/base.width*ratio,maxScale)});
    const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`Estimate page ${entry.target.dataset.page}`);entry.target.prepend(canvas);
    try{renderTask=info.page.render({canvasContext:canvas.getContext('2d'),viewport});await renderTask.promise;renderTask=null;info.done=true;
      if(!entry.target.querySelector('.pdf-text')){const text=await info.page.getTextContent();const accessible=document.createElement('div');accessible.className='pdf-text';accessible.textContent=text.items.map(item=>item.str||'').join(' ');entry.target.append(accessible);}
      if(!info.visible){canvas.width=canvas.height=0;canvas.remove();info.done=false;info.page.cleanup();}
    }catch(error){canvas.remove();if(error.name!=='RenderingCancelledException'&&version===renderVersion)errorPdf('This PDF page could not be displayed. Try loading the estimate again.');}
  });}},{root:$('pdfScroll'),rootMargin:'500px'});
  for(const figure of pages.keys())observer.observe(figure);
}
$('viewEstimate').onclick=()=>{returnFocus=document.activeElement;viewer.showModal();zoom=1;preparePdf();};
$('closeViewer').onclick=()=>viewer.close();
viewer.addEventListener('click',event=>{if(event.target===viewer){const r=viewer.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)viewer.close();}});
viewer.addEventListener('close',()=>{renderVersion++;observer?.disconnect();renderTask?.cancel();returnFocus?.focus();});
$('retryAccess').onclick=loadAccess;$('retryPdf').onclick=preparePdf;
const redraw=()=>renderPages().catch(()=>errorPdf('This document could not be displayed. Try loading it again.'));
$('zoomIn').onclick=()=>{zoom=Math.min(2.5,zoom+.25);redraw();};$('zoomOut').onclick=()=>{zoom=Math.max(.75,zoom-.25);redraw();};$('fitWidth').onclick=()=>{zoom=1;redraw();};
$('downloadPdf').onclick=async()=>{
  $('downloadError').hidden=true;$('downloadPdf').disabled=true;
  try{
    // Revalidate expiry/revocation rather than downloading a stale private cache.
    const current=await loadPdf();if(new TextDecoder().decode(current.slice(0,5))!=='%PDF-')throw Error();
    if(downloadUrl)URL.revokeObjectURL(downloadUrl);downloadUrl=URL.createObjectURL(new Blob([current],{type:'application/pdf'}));
    const link=document.createElement('a');link.href=downloadUrl;link.download='D2-Estimate.pdf';document.body.append(link);link.click();link.remove();
  }catch{$('downloadError').textContent='The download could not finish. Please retry, or request a new link from D2.';$('downloadError').hidden=false;}
  finally{$('downloadPdf').disabled=false;}
};
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(viewer.open&&!opening)renderPages().catch(()=>errorPdf('The document could not resize. Try loading it again.'));},180);});
window.addEventListener('pagehide',()=>{if(downloadUrl)URL.revokeObjectURL(downloadUrl);loadingTask?.destroy();bytes=null;});
loadAccess();
