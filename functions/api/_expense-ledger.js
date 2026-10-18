const fields=['expenseLines','animusExpenseLedgerV4','animusManualExpenses','freshExpenseReceipts','expenseReceipts','receiptHistory'];
export const ledgerMarker='cloud-receipts-v5';
export function protectExpenseLedger(prior,next){
  if(prior?.expenseLedgerSource!==ledgerMarker)return next;
  return {...next,...Object.fromEntries(fields.map(key=>[key,prior[key]||[]])),expenseLedgerSource:ledgerMarker,expenseLedgerSyncedAt:prior.expenseLedgerSyncedAt};
}
export async function readFileReceipts(bucket,file){
  const aliases=[...new Set([file.id,file.fileNumber,file.legacyFileNumber].map(value=>String(value||'').trim()).filter(Boolean))];
  const entries=new Map();
  for(const alias of aliases){
    const prefix='animus-expenses/v5/'+encodeURIComponent(alias).replace(/%2F/gi,'_')+'/';let cursor;
    do{
      const page=await bucket.list({prefix,limit:250,cursor});
      for(const item of page.objects||[]){
        const stored=await bucket.get(item.key);if(!stored)throw Error('Receipt changed while reading; retry.');
        const entry=await stored.json();
        if(!entry.id||(entry.fileId&&!aliases.includes(String(entry.fileId))))throw Error('Receipt ownership could not be verified.');
        const value=Number(String(entry.amount??'').replace(/[$,]/g,''));
        if(!Number.isFinite(value)||entry.amount===undefined||entry.amount==='')throw Error('Receipt amount could not be verified.');
        const previous=entries.get(String(entry.id));
        if(!previous||String(entry.updatedAt||'')>String(previous.updatedAt||''))entries.set(String(entry.id),{...entry,amount:value});
      }
      cursor=page.truncated?page.cursor:undefined;if(page.truncated&&!cursor)throw Error('Receipt listing incomplete.');
    }while(cursor);
  }
  return [...entries.values()];
}
export function projectFileReceipts(file,entries,at=new Date().toISOString()){
  const lines=entries.map(entry=>({id:entry.id,receiptGroupId:entry.id,date:entry.date,vendor:entry.vendor,category:entry.category,note:entry.notes||entry.title||'Expense',amount:entry.amount,baseAmount:entry.amount,tax:0,addTax:false,paymentType:entry.paymentType||'',receiptFileName:entry.imageTitle||entry.title||'',receiptSource:'ANIMUS Expense Center'}));
  return {...file,expenseLines:lines,animusExpenseLedgerV4:entries,animusManualExpenses:[],freshExpenseReceipts:[],expenseReceipts:[],receiptHistory:[],expenseLedgerSource:ledgerMarker,expenseLedgerSyncedAt:at};
}
