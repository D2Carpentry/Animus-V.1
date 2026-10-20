// Read-only adapter around the canonical CRM customer-copy renderer and PDF exporter.
window.AnimusPortalRenderer={async create(data){
  if(window.parent===window)throw Error('Open from ANIMUS.');
  loadEstimateData(data);
  state.mode='estimate';fillForm();syncModeUI();renderLines();
  return window.AnimusDocumentExport.createPdf($('estimateSheet'),{onProgress:message=>window.parent.dispatchEvent(new CustomEvent('d2-render-status',{detail:message}))});
}};
