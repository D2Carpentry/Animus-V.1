import {applyMobileWorkspace} from '../../functions/api/_mobile-workspace.js';
export function createDemoTransport() {
  const today = new Date().toLocaleDateString('en-CA');
  const documentUrl = type => new URL(`assets/demo-${type}.pdf`,typeof location==='undefined'?'https://localhost/':location.href).href;
  let dashboard = {
    dashboardFiles: [
      { id:'demo-work-1', fileNumber:'DEMO-0001', clientName:'Preview Customer', clientPhone:'(239) 555-0100', clientEmail:'preview@example.com', projectAddress:'Sample project address', fileStatus:'In Progress', projectType:'Refacing', estimateTotal:8450, totalPaidOverride:2000, startDate:today, notes:[], timeline:[], expenseLines:[], workPhotos:[] },
      { id:'demo-work-2', fileNumber:'DEMO-0002', clientName:'Sample Interior Project', fileStatus:'In Negotiation', projectType:'Other', estimateTotal:4590, totalPaidOverride:0, notes:[], timeline:[], expenseLines:[], workPhotos:[] }
    ],
    revenueRows:[{id:'demo-revenue-1', dashboardFileId:'demo-work-1', fileNumber:'DEMO-0001', clientJob:'Preview Customer', gross:8450, expenses:0, labor:1400}], priceRows:[], payrollRows:[]
  };
  const receipts = new Map();
  Object.assign(dashboard.dashboardFiles[0],{
    estimatePdfUrl:documentUrl('estimate'), invoicePdfUrl:documentUrl('invoice'), workOrderPdfUrl:documentUrl('workorder'),
    supplements:[{id:'demo-supplement',pdfUrl:documentUrl('supplement'),createdAt:new Date().toISOString()}]
  });
  const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers:{'Content-Type':'application/json'}});
  return async function demoFetch(input, init = {}) {
    const url = new URL(typeof input === 'string' ? input : input.url, 'https://localhost');
    const method = (init.method || input?.method || 'GET').toUpperCase();
    if (url.origin !== 'https://animus-v-1.pages.dev') throw new Error('Preview cannot contact external services.');
    if(url.pathname==='/api/mobile-workspace'){
      if(method!=='POST')return json({ok:false},405);
      try{const payload=JSON.parse(init.body||'{}');if(payload.action==='saveDocument'){payload.pdfUrl=documentUrl(payload.mode);const file=dashboard.dashboardFiles.find(file=>file.id===payload.id);payload.verifiedReceiptTotal=[...receipts.values()].filter(r=>[file?.id,file?.fileNumber].includes(r.fileId)).reduce((sum,r)=>sum+Number(r.amount||0),0);}const result=applyMobileWorkspace(dashboard,payload);dashboard=result.dashboard;return json({ok:true,...result});}catch(error){return json({ok:false,error:error.message},error.status||400);}
    }
    if (url.pathname === '/api/dashboard') {
      if (method === 'GET') return json({ok:true, dashboard});
      const payload = JSON.parse(init.body || '{}');
      if (payload.action !== 'mobileFilePatch') return json({ok:false, error:'Only isolated file edits are supported in preview.'}, 400);
      const file = dashboard.dashboardFiles.find(f => f.id === payload.fileId);
      if (!file) return json({ok:false,error:'Preview file not found'},404);
      const allowed = ['notes','timeline','workPhotos','expenseLines','estimateTotal','totalPaidOverride'];
      for (const key of Object.keys(payload.changes || {})) {
        if (!allowed.includes(key)) return json({ok:false,error:'Unsupported preview edit'},400);
      }
      Object.assign(file, payload.changes);
      if (payload.revenueRow) Object.assign(dashboard.revenueRows.find(r=>r.id===payload.revenueRow.id) || {},payload.revenueRow);
      return json({ok:true,dashboard});
    }
    if (url.pathname === '/api/receipt') return json({ok:true, aiAvailable:false, receipt:{date:today, notes:'Preview receipt. Enter the actual amounts manually.'}});
    if (url.pathname === '/api/expenses') {
      if (method === 'GET') return json({ok:true, expenses:[...receipts.values()].filter(r=>r.fileId===url.searchParams.get('fileId'))});
      if (method !== 'POST') return json({ok:false},405);
      const payload = JSON.parse(init.body || '{}');
      if (!dashboard.dashboardFiles.some(f => [f.id,f.fileNumber].includes(payload.fileId))) return json({ok:false,error:'Preview file not found'},404);
      const expense = {...payload.expense, fileId:payload.fileId, receiptImageUrl:payload.expense.imageDataUrl, updatedAt:new Date().toISOString()};
      receipts.set(expense.id, expense);
      return json({ok:true,expense});
    }
    return json({ok:false,error:'Service unavailable in isolated preview'},404);
  };
}
