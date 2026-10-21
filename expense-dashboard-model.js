/* Receipt-ledger reporting only. Payroll and unmatched Revenue adjustments are not invented as receipts. */
(() => {
  const number=value=>{const n=Number(String(value??0).replace(/[$,]/g,''));return Number.isFinite(n)?n:0;};
  const date=value=>{const key=String(value||'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(key))return '';const d=new Date(key+'T12:00:00');return !Number.isNaN(+d)&&d.getFullYear()===+key.slice(0,4)&&d.getMonth()+1===+key.slice(5,7)&&d.getDate()===+key.slice(8)?key:'';};
  const group=category=>/^(supplies|materials)$/i.test(String(category).trim())?'materials':/^labor(?:\s*\(expenses\))?$/i.test(String(category).trim())?'labor':/subcontract/i.test(String(category))?'subcontractors':'other';
  function normalize(entries=[],companyEntries=[],files=[]) {
    const ids=new Map(files.map(file=>[String(file.id),file])),aliases=new Map(),seen=new Set();
    for(const file of files)for(const alias of [file.fileNumber,file.legacyFileNumber].filter(Boolean)){const key=String(alias);aliases.set(key,aliases.has(key)&&aliases.get(key)!==file?null:file);}
    return [...entries.map(entry=>({entry,company:entry.fileId==='__animus_company_expenses__'})),...companyEntries.map(entry=>({entry,company:true}))].flatMap(({entry,company},index)=>{
      const file=company?null:ids.get(String(entry.fileId))||aliases.get(String(entry.fileId))||null;
      const fileKey=company?'__company__':String(file?.id||entry.fileId||'unlinked');
      const key=`${company?'company':'job'}:${fileKey}:${entry.id||`missing-id-${index}`}`;
      if(entry.id&&seen.has(key))return [];seen.add(key);
      const attachment=entry.receiptImageKey||entry.imageDataUrl||entry.receiptImageUrl||'';
      const pdf=!!attachment&&(/application\/pdf/i.test(entry.receiptContentType||'')||/\.pdf$/i.test(entry.imageTitle||'')||/^data:application\/pdf/i.test(entry.imageDataUrl||''));
      return [{...entry,key,file,fileKey,company,amount:number(entry.amount),date:date(entry.date),category:String(entry.category||'Uncategorized').trim()||'Uncategorized',vendor:String(entry.vendor||'Unspecified').trim()||'Unspecified',group:group(entry.category),attachment,pdf}];
    });
  }
  function filter(records,state={}) {
    const query=String(state.query||'').trim().toLowerCase();
    return records.filter(r=>(!state.year||r.date.startsWith(state.year))&&(!state.from||r.date&&r.date>=state.from)&&(!state.to||r.date&&r.date<=state.to)&&(!state.scope||state.scope==='all'||(state.scope==='company'?r.company:!r.company))&&(!state.category||r.category===state.category)&&(!state.vendor||r.vendor===state.vendor)&&(!query||[r.title,r.imageTitle,r.notes,r.vendor,r.category,r.file?.clientName,r.file?.fileNumber,r.file?.projectAddress,r.file?.projectType].some(v=>String(v||'').toLowerCase().includes(query))));
  }
  function attachmentCounts(records) {
    const seen=new Map();let receipts=0,images=0,pdfs=0;
    for(const r of records){if(!r.attachment)continue;if(!seen.has(r.fileKey))seen.set(r.fileKey,new Set());const set=seen.get(r.fileKey);if(set.has(r.attachment))continue;set.add(r.attachment);receipts++;if(r.pdf)pdfs++;else images++;}return {receipts,images,pdfs};
  }
  const empty=()=>({total:0,materials:0,labor:0,subcontractors:0,other:0});
  function analyze(records,{period='monthly'}={}) {
    const total=empty(),maps={categories:new Map(),vendors:new Map(),types:new Map(),months:new Map(),periods:new Map(),files:new Map()};
    function add(map,name,r){if(!map.has(name))map.set(name,{name,...empty(),records:[],latest:'',file:r.file});const item=map.get(name);item.total+=r.amount;item[r.group]+=r.amount;item.records.push(r);const stamp=date(r.updatedAt)||date(r.createdAt)||r.date;if(stamp>item.latest)item.latest=stamp;return item;}
    for(const r of records){total.total+=r.amount;total[r.group]+=r.amount;add(maps.categories,r.category,r);add(maps.vendors,r.vendor,r);const month=r.date?r.date.slice(0,7):'Undated';add(maps.months,month,r);add(maps.periods,month==='Undated'?month:period==='yearly'?month.slice(0,4):period==='quarterly'?`${month.slice(0,4)}-Q${Math.ceil(+month.slice(5)/3)}`:month,r);if(!r.company&&r.file){add(maps.files,r.fileKey,r);add(maps.types,r.file.projectType||'Unclassified',r);}}
    const descending=map=>[...map.values()].sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name));
    const months=descending(maps.months).filter(m=>m.name!=='Undated');
    return {total,categories:descending(maps.categories),vendors:descending(maps.vendors),types:descending(maps.types),months,periods:[...maps.periods.values()].sort((a,b)=>a.name.localeCompare(b.name)),files:descending(maps.files).map(f=>({...f,...attachmentCounts(f.records)})),company:records.filter(r=>r.company),unlinked:records.filter(r=>!r.company&&!r.file),...attachmentCounts(records)};
  }
  function tableRows(groups,state={}) {
    const query=String(state.tableQuery||'').trim().toLowerCase();
    return groups.filter(g=>(!state.type||(g.file?.projectType||'Unclassified')===state.type)&&(!query||[g.file?.clientName,g.file?.fileNumber,g.file?.projectType,g.file?.projectAddress,g.file?.projectName].some(v=>String(v||'').toLowerCase().includes(query)))).sort((a,b)=>{
      const read=g=>state.sort==='number'?g.file?.fileNumber||'':state.sort==='customer'?g.file?.clientName||'':state.sort==='type'?g.file?.projectType||'Unclassified':state.sort==='updated'?g.latest:g[state.sort||'total'];
      const av=read(a),bv=read(b);return (state.direction===1?1:-1)*(typeof av==='number'?av-bv:String(av).localeCompare(String(bv),undefined,{numeric:true}));
    });
  }
  function csv(records) {
    const quote=v=>{let text=String(v??'');if(/^\s*[=+@]/.test(text)||typeof v!=='number'&&/^\s*-/.test(text))text="'"+text;return `"${text.replace(/"/g,'""')}"`;};
    return [['Date','Scope','File #','Customer','Project Type','Expense','Vendor','Category','Amount','Paid By','Receipt Name','Notes','Expense ID'],...records.map(r=>[r.date,r.company?'Company':'Job',r.file?.fileNumber||'',r.file?.clientName||'',r.file?.projectType||'',r.title||'',r.vendor,r.category,r.amount,r.paymentType||'',r.imageTitle||'',r.notes||'',r.id||''])].map(line=>line.map(quote).join(',')).join('\n');
  }
  globalThis.AnimusExpenseModel={number,date,group,normalize,filter,attachmentCounts,analyze,tableRows,csv};
})();
