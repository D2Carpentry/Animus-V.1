(() => {
  const API='/api/customer-portal';
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  let context=null,busy=false,openVersion=0;
  const dialog=document.createElement('dialog');dialog.id='customerPortalAdmin';dialog.className='portal-admin';document.body.append(dialog);
  const date=value=>new Date(value).toLocaleDateString('en-US');
  async function call(payload){const response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),cache:'no-store',signal:AbortSignal.timeout(90000)});const result=await response.json();if(!response.ok||!result.ok)throw Error(result.error||'Sharing could not finish.');return result;}
  async function refresh(id){const response=await fetch(`${API}?fileId=${encodeURIComponent(id)}`,{cache:'no-store'});const result=await response.json();if(!response.ok||!result.ok)throw Error(result.error||'The saved estimate could not be loaded.');context=result;return result;}
  async function open(fileId){
    if(busy)return;const version=++openVersion;
    dialog.innerHTML='<header><h2>Customer Portal</h2><button type="button" data-portal-close aria-label="Close">×</button></header><p role="status">Loading the current saved estimate...</p>';dialog.showModal();
    try{const result=await refresh(fileId);if(dialog.open&&version===openVersion)render(result);}catch(error){if(dialog.open&&version===openVersion)dialog.innerHTML=`<header><h2>Customer Portal</h2><button type="button" data-portal-close aria-label="Close">×</button></header><p role="alert">${esc(error.message)}</p>`;}
  }
  function render(result){
    const {file,links}=result;
    dialog.innerHTML=`<header><div><h2>Customer Portal</h2><p>${esc(file.clientName)} · ${esc(file.fileNumber)}</p></div><button type="button" data-portal-close aria-label="Close">×</button></header><p>Shares the current cloud-saved estimate, not unsaved editor changes. Customer links are private and revocable.</p><label>Link expires<select id="portalExpiry"><option value="7">7 days</option><option value="14">14 days</option><option value="30" selected>30 days</option><option value="60">60 days</option><option value="90">90 days</option></select></label><button type="button" id="createPortalLink" class="portal-primary">Create private link</button><p id="portalAdminError" role="alert"></p><div id="portalCreated" hidden><label>Private customer link<input id="portalLink" readonly></label><div class="portal-admin-actions"><button type="button" id="copyPortalLink">Copy link</button><button type="button" id="openPortalLink">Preview</button><button type="button" id="emailPortalLink">Email link</button></div></div><h3>Issued links</h3><div id="portalIssued">${links.map(link=>`<div class="portal-issued"><span>Created ${esc(date(link.createdAt))}<small>${link.revokedAt?'Revoked':Date.parse(link.expiresAt)<=Date.now()?'Expired':`Expires ${esc(date(link.expiresAt))}`}</small></span>${!link.revokedAt&&Date.parse(link.expiresAt)>Date.now()?`<button type="button" data-revoke-portal="${esc(link.id)}">Revoke</button>`:''}</div>`).join('')||'<p>No portal links issued for this workfile.</p>'}</div>`;
    document.getElementById('createPortalLink').onclick=async event=>{
      const button=event.currentTarget;busy=true;button.disabled=true;dialog.querySelector('[data-portal-close]').disabled=true;button.textContent='Preparing saved estimate...';document.getElementById('portalAdminError').textContent='';
      try{
        let pdf;
        if(!file.hasAttachedPdf){if(!file.editableEstimate)throw Error('Attach an estimate PDF first.');const blob=await window.AnimusPortalPdf.create(file.editableEstimate);pdf=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('The PDF could not be prepared.'));reader.readAsDataURL(blob);});}
        const created=await call({action:'create',fileId:file.id,estimateHash:result.estimateHash,expiresDays:Number(document.getElementById('portalExpiry').value),pdf});
        const link=document.getElementById('portalLink');link.value=created.url;document.getElementById('portalCreated').hidden=false;
        document.getElementById('copyPortalLink').onclick=async()=>{try{await navigator.clipboard.writeText(created.url);document.getElementById('portalAdminError').textContent='Link copied.';}catch{link.focus();link.select();document.getElementById('portalAdminError').textContent='Select and copy the private link.';}};
        document.getElementById('openPortalLink').onclick=()=>window.open(created.url,'_blank','noopener');
        document.getElementById('emailPortalLink').onclick=()=>{const first=file.clientName.trim().split(/\s+/)[0];const email=file.editableEstimate?.clientEmail||file.editableEstimate?.email||'';location.href=`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent('Your D2 estimate')}&body=${encodeURIComponent(`Hi ${first},\n\nYour estimate is ready to review in your private client portal:\n${created.url}\n\nThank you,\nD2 Carpentry & Design`)}`;};
        const row=document.createElement('div');row.className='portal-issued';row.innerHTML=`<span>Created ${esc(date(new Date()))}<small>Expires ${esc(date(created.expiresAt))}</small></span><button type="button" data-revoke-portal="${created.id}">Revoke</button>`;document.querySelector('#portalIssued > p')?.remove();document.getElementById('portalIssued').prepend(row);
      }catch(error){document.getElementById('portalAdminError').textContent=error.message;}finally{busy=false;button.disabled=false;dialog.querySelector('[data-portal-close]').disabled=false;button.textContent='Create private link';}
    };
  }
  dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  dialog.addEventListener('close',()=>{openVersion++;context=null;});
  dialog.addEventListener('click',async event=>{
    if(event.target.closest('[data-portal-close]')){if(!busy)dialog.close();return;}
    const button=event.target.closest('[data-revoke-portal]');if(!button)return;
    if(!confirm('Revoke this customer link? It will stop opening the estimate.'))return;
    button.disabled=true;try{await call({action:'revoke',id:button.dataset.revokePortal});button.closest('.portal-issued').querySelector('small').textContent='Revoked';button.remove();}catch(error){document.getElementById('portalAdminError').textContent=error.message;button.disabled=false;}
  });
  document.addEventListener('click',event=>{const button=event.target.closest('[data-customer-portal]');if(button){const file=typeof activeFile==='function'?activeFile():null;if(file)open(file.id);}});
  window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==document.getElementById('crmEstimatorFrame')?.contentWindow||event.data?.type!=='animus-open-customer-portal')return;const file=typeof activeFile==='function'?activeFile():null;if(!file||file.id!==event.data.fileId)return;open(file.id);});
  window.AnimusCustomerPortal={open};
  // Keep the new action within the workfile's existing Estimate & Documents toolbar.
  const attachButton=()=>{for(const row of document.querySelectorAll('.animus-estimate-actions .animus-action-row')){if(row.querySelector('[data-customer-portal]'))continue;const button=document.createElement('button');button.type='button';button.className='animus-record-button';button.dataset.customerPortal='';button.textContent='Customer Portal';row.append(button);}};
  new MutationObserver(attachButton).observe(document.getElementById('crmFileDetail')||document.querySelector('main')||document.body,{childList:true,subtree:true});attachButton();
})();
