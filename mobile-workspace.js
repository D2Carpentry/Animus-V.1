// Mobile presentation and targeted edits over the same canonical CRM snapshot.
const WORKSPACE_API='https://animus-v-1.pages.dev/api/mobile-workspace';
const mobileStatuses=['New Lead','Contact Established','Contact Attempted','Inspection Completed','In Negotiation','Pending Start','In Progress','Completed-Pending Payment','Closed / Paid','Job Lost / Closed'];
let mobileEditorSession=null;
const expectedFields=(record,keys)=>Object.fromEntries(keys.map(key=>[key,record?.[key]??null]));
async function workspaceSave(payload){
  const response=await fetch(WORKSPACE_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),cache:'no-store',signal:AbortSignal.timeout(90000)});
  const result=await response.json();if(!response.ok||!result.ok)throw Error(result.error||'Save failed. Your entries remain open.');
  applyCloudDashboard(result.dashboard);renderAll();return result.record;
}
function formField(name,label,value='',type='text'){
  return `<label>${escapeHtml(label)}<input name="${name}" type="${type}" value="${escapeHtml(value)}" ${type==='number'?'min="0" step="0.01" inputmode="decimal"':''}></label>`;
}
function workspaceForm(title,fields,submit){
  openSheet(`<form id="workspaceForm"><div class="sheet-heading"><h2>${escapeHtml(title)}</h2><button type="button" data-close-sheet aria-label="Close">×</button></div><div class="workspace-fields">${fields}</div><p id="workspaceError" role="alert"></p><div class="sheet-actions"><button type="button" data-close-sheet>Cancel</button><button class="primary-action" type="submit">Save</button></div></form>`);
  $('workspaceForm').onsubmit=async event=>{
    event.preventDefault();const form=event.currentTarget;const button=form.querySelector('[type=submit]');button.disabled=true;$('workspaceError').textContent='';
    try{await submit(Object.fromEntries(new FormData(form)));closeSheet();notify('Saved to cloud');}catch(error){$('workspaceError').textContent=error.message;}finally{button.disabled=false;}
  };
}
function editMobileFile(file=null,afterSave){
  const id=file?.id||`mobile-file-${crypto.randomUUID()}`;
  const keys=['clientName','clientPhone','clientEmail','projectAddress','projectType','leadSource','fileStatus','statusDetail','inspectionDate','inspectionTime','startDate','followUpDate','anticipatedCompletionDate','nextAction','nextActionDate'];
  const initial=file?structuredClone(file):{fileStatus:'New Lead',projectType:'Other',leadSource:'Manual'};
  const labels={clientName:'Customer name',clientPhone:'Phone',clientEmail:'Email',projectAddress:'Project address',projectType:'Project type',leadSource:'Lead source',statusDetail:'Status detail',inspectionDate:'Inspection date',inspectionTime:'Inspection time',startDate:'Start date',followUpDate:'Follow-up date',anticipatedCompletionDate:'Expected completion',nextAction:'Next action',nextActionDate:'Next action date'};
  const markup=keys.map(key=>key==='fileStatus'?`<label>File status<select name="fileStatus">${mobileStatuses.map(status=>`<option ${status===initial.fileStatus?'selected':''}>${status}</option>`).join('')}</select></label>`:formField(key,labels[key],initial[key]||'',key==='clientPhone'?'tel':key==='clientEmail'?'email':key==='inspectionTime'?'time':key.toLowerCase().includes('date')?'date':'text')).join('');
  workspaceForm(file?'Edit workfile':'New workfile',markup,async values=>{
    const changed=file?Object.fromEntries(Object.entries(values).filter(([key,value])=>value!==String(initial[key]||''))):values;
    if(file&&!Object.keys(changed).length)return;
    const saved=await workspaceSave({action:file?'editFile':'createFile',id,values:changed,expected:expectedFields(initial,Object.keys(changed))});
    activeFileId=saved.id;if(afterSave)afterSave(saved);else openView('detail');
  });
  $('workspaceForm').elements.clientName.required=true;
}
function renderMobilePrices(){
  const term=$('mobilePriceSearch').value.trim().toLowerCase();
  const rows=state.prices.filter(row=>![row.id,row.sourceId].some(id=>state.deletedPriceIds.includes(id))).filter(row=>[row.product,row.name,row.category,row.vendor,row.unit].join(' ').toLowerCase().includes(term)).sort((a,b)=>String(a.product||a.name||'').localeCompare(String(b.product||b.name||'')));
  $('mobilePriceCount').textContent=`${rows.length} items`;
  $('mobilePriceList').innerHTML=rows.map(row=>`<button type="button" class="mobile-price-row" data-edit-price="${escapeHtml(row.id)}"><span><strong>${escapeHtml(row.product||row.name)}</strong><small>${escapeHtml([row.category,row.vendor].filter(Boolean).join(' · '))}</small></span><span><b>${money.format(parseMoney(row.defaultPrice??row.price))}</b><small>${escapeHtml(row.unit||'each')}</small></span></button>`).join('')||'<p class="subcopy">No matching prices.</p>';
  $('mobilePriceList').querySelectorAll('[data-edit-price]').forEach(button=>button.onclick=()=>editMobilePrice(state.prices.find(row=>row.id===button.dataset.editPrice)));
}
function editMobilePrice(row=null){
  const initial=row?structuredClone(row):null;const id=row?.id||`mobile-price-${crypto.randomUUID()}`;
  workspaceForm(row?'Edit price':'Add price',formField('product','Item name',row?.product||row?.name||'')+formField('defaultPrice','Unit price',row?.defaultPrice??row?.price??'','number')+formField('unit','Unit',row?.unit||'each')+formField('category','Category',row?.category||'')+formField('vendor','Source / Vendor',row?.vendor||'')+(row?'<button id="mobileDeletePrice" type="button" class="workspace-danger">Delete price</button>':''),async values=>{await workspaceSave({action:'savePrice',id,values,expected:initial});renderMobilePrices();});
  $('workspaceForm').elements.product.required=true;
  if(row)$('mobileDeletePrice').onclick=async event=>{
    if(!confirm('Delete this price? Existing estimate lines will not change.'))return;
    event.target.disabled=true;try{await workspaceSave({action:'deletePrice',id,expected:initial});closeSheet();renderMobilePrices();}catch(error){$('workspaceError').textContent=error.message;event.target.disabled=false;}
  };
}
const renderRevenueCards=renderRevenue;
renderRevenue=function(){
  renderRevenueCards();
  $('revenueStats').querySelectorAll('.stat').forEach(card=>{
    if(card.querySelector('span')?.textContent==='Expenses')card.classList.add('expense-total-card');
  });
  $('revenueList').innerHTML=state.revenue.map(row=>`<button class="mobile-revenue-row" type="button" data-revenue-id="${escapeHtml(row.id)}"><strong>${escapeHtml(row.clientJob||row.fileNumber||'Revenue')}</strong><small>${escapeHtml(row.date||'No date')}</small><dl><div><dt>Gross</dt><dd>${money.format(parseMoney(row.gross))}</dd></div><div><dt>Expenses</dt><dd class="expense-value">${money.format(parseMoney(row.expenses))}</dd></div><div><dt>Labor</dt><dd class="labor-value">${money.format(parseMoney(row.labor))}</dd></div><div><dt>Net</dt><dd>${money.format(parseMoney(row.gross)-parseMoney(row.expenses)-parseMoney(row.labor))}</dd></div></dl></button>`).join('')||'<p class="subcopy">No revenue records.</p>';
  $('revenueList').querySelectorAll('[data-revenue-id]').forEach(button=>button.onclick=()=>{
    const row=structuredClone(state.revenue.find(r=>r.id===button.dataset.revenueId));
    workspaceForm(row.clientJob||'Revenue',formField('date','Date',row.date||dateToday(),'date')+formField('gross','Gross revenue',row.gross,'number')+formField('labor','Labor',row.labor,'number')+`<p>Receipt expenses: <strong class="expense-value">${money.format(parseMoney(row.expenses))}</strong></p><button type="button" id="revenueExpenses">Expenses</button>`,async values=>{
      const changed=Object.fromEntries(Object.entries(values).filter(([key,value])=>key==='date'?value!==row[key]:Number(value)!==Number(row[key])));
      if(Object.keys(changed).length)await workspaceSave({action:'editRevenue',id:row.id,values:changed,expected:expectedFields(row,Object.keys(changed))});
    });
    $('revenueExpenses').onclick=()=>{const file=state.files.find(f=>f.id===row.dashboardFileId||f.fileNumber===row.fileNumber);if(!file){$('workspaceError').textContent='This revenue entry has no linked workfile.';return;}activeFileId=file.id;closeSheet();openView('expenses');fetchReceipts().then(renderExpenses).catch(error=>notify(error.message,true));};
  });
};
const renderDetailMobileBase=renderDetail;
renderDetail=function(){
  renderDetailMobileBase();const file=activeFile();if(!file)return;
  $('fileDetail').insertAdjacentHTML('beforeend','<div class="workspace-file-actions"><button type="button" id="mobileCustomerPortal">Customer Portal</button><button type="button" id="mobileEditCustomer">Edit customer / status</button><button type="button" id="mobileEditDocuments">Prepare document</button></div>');
  $('mobileCustomerPortal').onclick=()=>window.AnimusPortalManagement.open(file.id).catch(error=>notify(error.message,true));
  $('mobileEditCustomer').onclick=()=>editMobileFile(file);
  $('mobileEditDocuments').onclick=()=>openMobileEstimator(file);
};
window.AnimusMobilePortalWorkflow=(flow,id)=>{
  const file=state.files.find(row=>row.id===id);if(!file)throw Error('Reopen this workfile before continuing.');
  activeFileId=file.id;openView('detail');
  if(flow==='financials')openMobileFinancials();
  else if(['schedule','task'].includes(flow))editMobileFile(file);
  else if(['estimate','invoice','supplement'].includes(flow)){
    openMobileEstimator(file);mobileEditorSession.mode=flow;$('mobileEditorMode').value=flow;
  }
};
function openMobileEstimator(file){
  if(!file){
    openSheet(`<div class="sheet-heading"><h2>Choose a workfile</h2><button type="button" data-close-sheet aria-label="Close">×</button></div><button type="button" id="estimatorNewFile">New workfile</button><div class="sheet-file-list">${state.files.map(f=>`<button type="button" data-estimator-file="${escapeHtml(f.id)}">${escapeHtml(f.clientName)}<small>${escapeHtml(f.fileNumber)}</small></button>`).join('')}</div>`);
    $('estimatorNewFile').onclick=()=>editMobileFile(null,saved=>openMobileEstimator(saved));
    $('sheet').querySelectorAll('[data-estimator-file]').forEach(button=>button.onclick=()=>{closeSheet();openMobileEstimator(state.files.find(f=>f.id===button.dataset.estimatorFile));});return;
  }
  if(mobileEditorSession?.dirty&&!confirm('Discard the unsaved document changes?'))return;
  mobileEditorSession={file:structuredClone(file),mode:'estimate',dirty:false,saveId:crypto.randomUUID()};
  activeFileId=file.id;openView('estimator');$('mobileEditorFile').textContent=`${file.clientName} · ${file.fileNumber}`;
  $('mobileEditorMode').value='estimate';
  $('mobileEditorFrame').src=`mobile-estimator.html?standard=1&open=mobile-${encodeURIComponent(file.id)}`;
}
const originalMobileView=openView;
openView=function(view){
  if(mobileEditorSession?.saving&&view!=='estimator'){notify('Document save is still running.',true);return;}
  if(activeView==='estimator'&&view!=='estimator'&&mobileEditorSession?.dirty&&!confirm('Leave this document without saving your changes?'))return;
  originalMobileView(view);if(view==='prices')renderMobilePrices();
};
function editorDocument(file,mode){
  const source=mode==='invoice'?file.invoice?.editableEstimate:mode==='workorder'?file.workOrder?.data:mode==='supplement'?null:file.editableEstimate;
  const data=structuredClone(source||file.editableEstimate||{});
  if(!source&&!file.editableEstimate&&parseMoney(file.estimateTotal)>0){data.priceOverrideEnabled=true;data.priceOverride=parseMoney(file.estimateTotal);}
  return {...data,mode,documentMode:mode,title:mode==='workorder'?'Work Order':mode[0].toUpperCase()+mode.slice(1),estimateTitle:mode,clientName:data.clientName||file.clientName,clientPhone:data.clientPhone||file.clientPhone,clientEmail:data.clientEmail||file.clientEmail,projectAddress:data.projectAddress||file.projectAddress,workFileNumber:file.fileNumber,fileNumber:file.fileNumber,dashboardFileId:file.id,estimateNumber:mode==='supplement'?`${file.fileNumber}-S${(file.supplements||[]).length+1}`:data.estimateNumber||file.fileNumber,estimateDate:mode==='invoice'&&!source?dateToday():data.estimateDate||dateToday()};
}
window.AnimusMobileEditor={
  get hasDraft(){return Boolean(mobileEditorSession?.dirty);},
  clear(){mobileEditorSession=null;$('mobileEditorFrame').src='about:blank';},
  seed(){const s=mobileEditorSession;if(!s)return null;return {document:editorDocument(s.file,s.mode),prices:state.prices,files:state.files};},
  changed(){if(mobileEditorSession)mobileEditorSession.dirty=true;},
  saving(value){if(mobileEditorSession)mobileEditorSession.saving=value;$('mobileEditorMode').disabled=value;},
  async save(document,pdf){
    const s=mobileEditorSession;if(!s)throw Error('Reopen this workfile.');
    if(document.dashboardFileId!==s.file.id)throw Error('The selected workfile changed. This document was not saved.');
    const mode=document.documentMode||document.mode||s.mode;
    const field={estimate:'editableEstimate',invoice:'invoice',supplement:'supplements',workorder:'workOrder'}[mode];
    if(mode==='estimate'&&!s.file.editableEstimate&&documentUrlFor(s.file,'estimate')&&!confirm('This workfile has a PDF-only estimate. Saving replaces that attachment with this new draft. Have you imported or entered all of its details?'))throw Error('Save cancelled. The original PDF is unchanged.');
    const saved=await workspaceSave({action:'saveDocument',id:s.file.id,mode,document,pdf,saveId:s.saveId,expected:expectedFields(s.file,[field])});
    s.file=structuredClone(saved);s.dirty=false;s.saveId=crypto.randomUUID();notify('Document and PDF saved to cloud');
  },
  prices(){openView('prices');},
  back(){openView('detail');},
  async share(blob,name){const url=URL.createObjectURL(blob);try{if(window.AnimusNative)await window.AnimusNative.shareFile(url,name);else{const a=document.createElement('a');a.href=url;a.download=name;a.click();await new Promise(resolve=>setTimeout(resolve,1000));}}finally{URL.revokeObjectURL(url);}}
};
$('newFileButton').onclick=()=>editMobileFile();
$('mobileAddPrice').onclick=()=>editMobilePrice();
$('mobilePriceSearch').oninput=renderMobilePrices;
$('mobileEstimatorButton').onclick=()=>openMobileEstimator();
$('mobileEditorBack').onclick=()=>openView('detail');
$('mobileEditorMode').onchange=event=>{
  const editor=$('mobileEditorFrame').contentWindow?.AnimusPhoneEditor;if(!editor)return;
  if(mobileEditorSession.dirty&&!confirm('Discard unsaved changes and switch document type?')){event.target.value=mobileEditorSession.mode;return;}
  mobileEditorSession.mode=event.target.value;mobileEditorSession.dirty=false;mobileEditorSession.saveId=crypto.randomUUID();editor.load(editorDocument(mobileEditorSession.file,event.target.value));
};
window.addEventListener('beforeunload',event=>{if(mobileEditorSession?.dirty){event.preventDefault();event.returnValue='';}});
