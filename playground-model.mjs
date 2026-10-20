const fields=['companyName','companyPhone','companyEmail','companyAddress','estimateTitle','title','estimateNumber','estimateDate','date','clientName','clientPhone','clientEmail','projectAddress','projectType','projectDescription','description','showEstimateNumber','manualEstimateNumber','priceOverrideEnabled','priceOverride','taxEnabled','taxType','taxValue','discountEnabled','discountType','discountValue','depositEnabled','depositType','deposit','warrantyEnabled','warrantyType','warrantyTypes','customWarrantyTitle','customWarrantyText','valueFooterEnabled','notes','additionalNotes','lineItems','totals','careEnabled'];
export function sample(){return {firstName:'Sample',estimate:{clientName:'Sample Customer',estimateNumber:'SAMPLE',date:new Date().toLocaleDateString('en-CA'),lineItems:[{type:'item',description:'Sample project scope',price:100,qty:'',hasPrice:true}],totals:{subtotal:100,total:100}},total:100,fileNumber:'SAMPLE',clientName:'Sample Customer'};}
export function project(file){
  const raw=file?.editableEstimate;
  const estimate=raw?JSON.parse(JSON.stringify(Object.fromEntries(fields.filter(k=>Object.hasOwn(raw,k)).map(k=>[k,raw[k]])))):null;
  if(estimate){estimate.fileNumber=file.fileNumber;estimate.workFileNumber=file.fileNumber;}
  const url=file?.estimatePdfUrl||file?.estimateUrl||raw?.pdfUrl||raw?.documentUrl;
  let documentPath=null;
  if(url){try{const parsed=new URL(url,'https://animus-v-1.pages.dev');if(parsed.origin==='https://animus-v-1.pages.dev'&&parsed.pathname==='/api/mobile-workspace'&&/^[\w-]{16,80}$/.test(parsed.searchParams.get('document')||''))documentPath=parsed.pathname+parsed.search;}catch{}}
  return {firstName:String(file?.clientName||'Customer').trim().split(/\s+/)[0],clientName:file?.clientName||'Customer',fileNumber:file?.fileNumber||'—',total:estimate?.totals?.total??file?.estimateTotal??0,estimate,documentPath,unavailable:!!url&&!documentPath};
}
