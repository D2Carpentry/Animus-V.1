// Runs inside the shared editor's closure; only presentation/storage adapters differ.
const phoneHost=window.parent.AnimusMobileEditor;
if(!phoneHost)throw Error('Open this editor from ANIMUS Mobile.');
const phoneRenderLines=renderLines;
renderLines=function(){phoneRenderLines();$('scopeBody').querySelectorAll('tr').forEach(row=>{const first=row.cells[0];const move=first?.querySelector('[data-move]');const actions=row.querySelector('.line-actions');if(move&&actions){actions.prepend(move);first.remove();}});};
const phoneSyncMode=syncModeUI;
syncModeUI=function(){phoneSyncMode();if(state.mode==='workorder')$('documentNumberHeader').textContent='Work Order Number';$('customerReview').querySelector('.eyebrow').textContent=`${modeCopy().name} Draft`;};
function phoneLoad(document){
  loadEstimateData(document);$('mobilePhoneMode')?.remove();
  state.mode=document.documentMode||document.mode||'estimate';state.title=document.title||modeCopy().name;
  fillForm();syncModeUI();renderLines();
  $('dashboardFile').closest('.section')?.classList.add('phone-workfile-selector');
  window.document.querySelector('.phone-workfile-selector')?.setAttribute('hidden','');
  const list=$('photoList');list.replaceChildren();
  for(const photo of document.mobilePhotos||[]){if(!/^data:image\/(jpeg|png|webp);base64,/.test(photo.dataUrl||''))continue;const wrap=window.document.createElement('div');wrap.className='photo-card';const img=window.document.createElement('img');img.className='photo';img.src=photo.dataUrl;img.alt=photo.name||'Project photo';wrap.append(img);list.append(wrap);}
  renderCustomerReview();
  $('customerReview').querySelector('.eyebrow').textContent=`${modeCopy().name} Draft`;
  if(state.mode==='workorder')$('documentNumberHeader').textContent='Work Order Number';
  if(!document.lineItems?.length&&Number(document.priceOverride)>0)$('estimateStatus').textContent='PDF-only attachment: editable line items are unavailable.';
  $('workFileNumber').readOnly=true;
}
const seed=phoneHost.seed();
if(seed){mobileStorage.setItem('d2PriceDatabase',JSON.stringify(seed.prices));mobileStorage.setItem('d2CrmDemoFiles',JSON.stringify(seed.files));phoneLoad(seed.document);}
window.AnimusPhoneEditor={load:phoneLoad};
document.addEventListener('input',()=>phoneHost.changed());
document.addEventListener('change',()=>phoneHost.changed());
document.addEventListener('click',event=>{if(event.target.closest('[data-add-subline],[data-add-note],[data-remove],#addScope,#addSection,#addMaterial,#addScopeBottom,#addSectionBottom,#noteEditorSave,#addWarrantyBtn'))phoneHost.changed();});
const phoneReadBlob=blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('The document could not be prepared.'));reader.readAsDataURL(blob);});
let phoneSaving=false;
async function phoneSave(){
  if(phoneSaving)return;phoneSaving=true;const buttons=[$('saveBtn'),$('saveSide')];buttons.forEach(button=>button.disabled=true);
  phoneHost.saving(true);window.document.body.inert=true;
  try{
    $('saveNote').textContent='Preparing PDF and saving...';
    const document=currentEstimateData();
    const photos=await Promise.all([...window.document.querySelectorAll('#photoList .photo')].map(async img=>({name:img.alt,dataUrl:await phoneReadBlob(await (await fetch(img.src)).blob())})));
    document.mobilePhotos=photos;
    const pdf=await window.AnimusDocumentExport.createPdf(state.mode==='workorder'?$('workOrderPreview'):$('estimateSheet'));
    await phoneHost.save(document,await phoneReadBlob(pdf));$('saveNote').textContent='Document and PDF saved to cloud.';
  }catch(error){$('saveNote').textContent=error.message||'Save failed. Your entries remain here.';}finally{phoneSaving=false;window.document.body.inert=false;phoneHost.saving(false);buttons.forEach(button=>button.disabled=false);}
}
$('saveBtn').textContent='Save to workfile';$('saveSide').textContent='Save to workfile';$('saveBtn').onclick=phoneSave;$('saveSide').onclick=phoneSave;
$('newBtn').onclick=()=>{if(confirm('Discard changes and start a blank estimate for this workfile?')){const old=phoneHost.seed().document;phoneLoad({...blankEstimateState(),clientName:old.clientName,clientPhone:old.clientPhone,clientEmail:old.clientEmail,projectAddress:old.projectAddress,workFileNumber:old.fileNumber,fileNumber:old.fileNumber,dashboardFileId:old.dashboardFileId});phoneHost.changed();}};
$('recoverDraftBtn').hidden=true;$('createWorkFileMenu').hidden=true;
const importButton=window.document.createElement('button');importButton.type='button';importButton.className='btn';importButton.textContent='Import estimate';importButton.onclick=()=>{$('estimateUploadInput').click();closeEstimateMenu();};$('estimateMenu').append(importButton);
const exportButton=window.document.createElement('button');exportButton.type='button';exportButton.className='btn';exportButton.textContent='Export editable copy';exportButton.onclick=()=>{const data=currentEstimateData();phoneHost.share(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),`${safeFileName(data.clientName||'Estimate')}.d2estimate`).catch(error=>{$('saveNote').textContent=error.message;});closeEstimateMenu();};$('estimateMenu').append(exportButton);
$('openFullPriceDatabase').onclick=()=>phoneHost.prices();
$('priceDatabaseAdd').onclick=()=>phoneHost.prices();
// Price changes go through the targeted cloud editor, not the legacy browser database.
const phonePriceRender=renderPriceDatabaseModal;
renderPriceDatabaseModal=function(){phonePriceRender();document.querySelectorAll('[data-price-save],[data-price-delete]').forEach(button=>button.onclick=event=>{event.stopImmediatePropagation();phoneHost.prices();});};
$('priceDatabaseEditor').addEventListener('click',event=>{if(event.target.closest('[data-price-save],[data-price-delete]')){event.stopImmediatePropagation();phoneHost.prices();}},true);
window.AnimusDocumentExport.download=(blob,name)=>{phoneHost.share(blob,name).catch(error=>{$('saveNote').textContent=error.message;});};
const phonePrint=printCustomerReview;
printCustomerReview=async function(action){if(state.mode!=='workorder')return phonePrint(action);try{dataFromForm();syncModeUI();await phoneHost.share(await window.AnimusDocumentExport.createPdf($('workOrderPreview')),`${safeFileName(state.clientName||'Work Order')}-work-order.pdf`);}catch(error){$('saveNote').textContent=error.message;}};
$('shareMenu').querySelectorAll('button').forEach(button=>{if(button.textContent==='Customer Portal')button.remove();});
$('shareEmail').onclick=()=>{ $('shareMenu').hidden=true; printCustomerReview('email'); };
window.document.querySelector('.crumb').onclick=event=>{event.preventDefault();phoneHost.back();};
