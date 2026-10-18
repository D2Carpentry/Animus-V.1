const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const copy=value=>JSON.parse(JSON.stringify(value));
const same=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);
const amount=value=>{const n=Number(value);if(!Number.isFinite(n)||n<0||n>1e9)fail('Enter a valid non-negative amount.');return n;};
export const mobileStatuses=['New Lead','Contact Established','Contact Attempted','Inspection Completed','In Negotiation','Pending Start','In Progress','Completed-Pending Payment','Closed / Paid','Job Lost / Closed'];
const customerFields=['clientName','clientPhone','clientEmail','projectAddress','leadSource','leadFee','projectType','otherProjectType','fileStatus','statusDetail','nextAction','nextActionDate','inspectionDate','inspectionTime','startDate','followUpDate','anticipatedCompletionDate'];
function check(current,expected,fields){
  if(!expected||typeof expected!=='object')fail('Reopen this record before editing.',409);
  for(const field of fields)if(!Object.hasOwn(expected,field)||!same(current[field],expected[field]))fail('This record changed on another device. Your entries are unchanged. Reopen it to review the latest copy.',409);
}
function cleanCustomer(input){
  const result={};
  for(const [key,value] of Object.entries(input||{})){
    if(!customerFields.includes(key))fail('Unsupported workfile field.');
    if(typeof value!=='string'||value.length>2000)fail('Invalid workfile value.');
    result[key]=value.trim();
  }
  if(result.fileStatus&&!mobileStatuses.includes(result.fileStatus))fail('Choose a valid file status.');
  if(Object.hasOwn(result,'clientName')&&!result.clientName)fail('Customer name is required.');
  return result;
}
export function applyMobileWorkspace(dashboard,payload,now=new Date().toISOString()){
  const next=copy(dashboard);next.dashboardFiles??=[];next.priceRows??=[];next.revenueRows??=[];
  const {action}=payload;
  let record;
  if(action==='createFile'){
    if(!/^mobile-file-[a-f0-9-]{36}$/.test(payload.id||''))fail('Invalid creation identifier.');
    record=next.dashboardFiles.find(f=>f.id===payload.id);
    if(record){const values=cleanCustomer(payload.values);if(Object.entries(values).some(([key,value])=>!same(record[key],value)))fail('This creation already saved with different details. Refresh and review the saved workfile.',409);return {dashboard:next,record,replayed:true};}
    if((next.deletedFileKeys||[]).some(key=>String(key).toLowerCase()===payload.id.toLowerCase()))fail('This workfile was deleted. Start a new workfile instead.',409);
    const values=cleanCustomer(payload.values);if(!values.clientName)fail('Customer name is required.');
    // Deleted identifiers are reserved too; never fill a gap from a removed file.
    const reserved=[...next.dashboardFiles.flatMap(f=>[f.fileNumber,f.legacyFileNumber]),...(next.deletedFileKeys||[])];
    const highest=Math.max(0,...reserved.map(value=>Number(String(value||'').match(/^A-(\d+)$/i)?.[1])||0),Number(next.nextFileNumber||0)-1);
    if(highest>=9999)fail('File numbering needs administrator review.');
    const fileNumber=`A-${String(highest+1).padStart(4,'0')}`;next.nextFileNumber=highest+2;
    record={id:payload.id,fileNumber,clientName:values.clientName,fileStatus:'New Lead',statusDetail:'Needs Contact',projectType:'Other',leadSource:'Manual',estimateTotal:0,notes:[],timeline:[],workPhotos:[],expenseLines:[],...values,createdAt:now,updatedAt:now};
    next.dashboardFiles.unshift(record);
  }else if(action==='editFile'){
    record=next.dashboardFiles.find(f=>f.id===payload.id);if(!record)fail('Workfile not found. Refresh the file list.',404);
    const values=cleanCustomer(payload.values);check(record,payload.expected,Object.keys(values));Object.assign(record,values,{updatedAt:now});
  }else if(action==='savePrice'||action==='deletePrice'){
    const index=next.priceRows.findIndex(row=>row.id===payload.id);const previous=index<0?null:next.priceRows[index];
    if(!same(previous,payload.expected))fail('This price changed. Reopen it before saving.',409);
    if(action==='deletePrice'){
      if(!previous)fail('Price not found.',404);
      next.priceRows.splice(index,1);next.deletedPriceIds=[...new Set([...(next.deletedPriceIds||[]),payload.id])];record={id:payload.id};
    }else{
      if(typeof payload.id!=='string'||payload.id.length>180||!payload.id)fail('Invalid price identifier.');
      if((next.deletedPriceIds||[]).includes(payload.id))fail('This price was deleted. Add a new price instead.',409);
      const v=payload.values||{};if(!String(v.product||'').trim())fail('Item name is required.');
      record={...(previous||{}),id:payload.id,product:String(v.product).trim().slice(0,500),name:String(v.product).trim().slice(0,500),defaultPrice:amount(v.defaultPrice),price:amount(v.defaultPrice),unit:String(v.unit||'each').slice(0,80),category:String(v.category||'').slice(0,180),vendor:String(v.vendor||'').slice(0,180),updatedAt:now};
      if(index<0)next.priceRows.push(record);else next.priceRows[index]=record;
    }
  }else if(action==='editRevenue'){
    record=next.revenueRows.find(row=>row.id===payload.id);if(!record)fail('Revenue row not found.',404);
    const fields=Object.keys(payload.values||{});if(!fields.length||fields.some(key=>!['date','gross','labor'].includes(key)))fail('Unsupported revenue edit. Receipt totals are managed in Expenses.');
    check(record,payload.expected,fields);
    for(const key of fields){if(key==='date'){if(!/^\d{4}-\d{2}-\d{2}$/.test(payload.values.date))fail('Choose a valid date.');record.date=payload.values.date;}else record[key]=amount(payload.values[key]);}
    record.profit=(Number(record.gross)||0)-(Number(record.expenses)||0)-(Number(record.labor)||0);record.updatedAt=now;
  }else if(action==='saveDocument'){
    record=next.dashboardFiles.find(f=>f.id===payload.id);if(!record)fail('Select an existing workfile before saving.',404);
    const mode=payload.mode;if(!['estimate','invoice','supplement','workorder'].includes(mode))fail('Invalid document type.');
    const field={estimate:'editableEstimate',invoice:'invoice',supplement:'supplements',workorder:'workOrder'}[mode];
    if(record.mobileDocumentSaveId===payload.saveId){if(!same(record.mobileDocumentSaveHash,payload.saveHash))fail('A prior save completed with different content. Refresh the saved document before retrying.',409);return {dashboard:next,record,replayed:true};}
    check(record,payload.expected,[field]);
    const document=copy(payload.document||{});if(!Array.isArray(document.lineItems)||!document.totals)fail('The document is incomplete.');
    amount(document.totals.total);document.dashboardFileId=record.id;document.fileNumber=record.fileNumber;document.workFileNumber=record.fileNumber;
    if(mode==='estimate'){
      record.editableEstimate=document;record.estimateTotal=amount(document.totals.total);record.estimateStatus='Estimate Completed';record.estimatePdfUrl=payload.pdfUrl;
      const linked=next.revenueRows.filter(row=>row.dashboardFileId===record.id||(!row.dashboardFileId&&row.fileNumber===record.fileNumber));
      if(!linked.length){const expenses=amount(payload.verifiedReceiptTotal);const row={id:`revenue-${record.id}`,dashboardFileId:record.id,fileNumber:record.fileNumber,clientJob:record.clientName,date:document.estimateDate||document.date||now.slice(0,10),gross:record.estimateTotal,expenses,labor:0,profit:record.estimateTotal-expenses};next.revenueRows.push(row);}
      for(const row of linked){row.gross=record.estimateTotal;row.profit=row.gross-(Number(row.expenses)||0)-(Number(row.labor)||0);}
    }else if(mode==='invoice'){
      record.invoice={...(record.invoice||{}),date:document.estimateDate||document.date,title:'Invoice',billTo:document.clientName,phone:document.clientPhone,email:document.clientEmail,address:document.projectAddress,projectNumber:record.fileNumber,notes:document.notes,rows:document.lineItems.map(row=>({description:row.description,qty:row.qty,total:row.total})),total:document.totals.total,editableEstimate:document,pdfUrl:payload.pdfUrl};record.invoicePdfUrl=payload.pdfUrl;record.invoiceStatus='Draft';
    }else if(mode==='supplement'){
      record.supplements=[...(record.supplements||[]),{id:payload.saveId,title:`Supplement ${(record.supplements||[]).length+1}`,estimateNumber:document.estimateNumber,data:document,pdfUrl:payload.pdfUrl,createdAt:now,updatedAt:now}];
    }else{record.workOrder={...(record.workOrder||{}),data:document,pdfUrl:payload.pdfUrl};record.workOrderPdfUrl=payload.pdfUrl;}
    record.mobileDocumentSaveId=payload.saveId;record.mobileDocumentSaveHash=payload.saveHash||null;record.updatedAt=now;record.timeline=[...(record.timeline||[]),`${mode==='workorder'?'Work order':mode[0].toUpperCase()+mode.slice(1)} saved. ${now}`];
  }else fail('Unsupported mobile operation.');
  next.syncedAt=now;return {dashboard:next,record};
}
