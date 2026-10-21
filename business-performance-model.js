/* Read-only reporting: financial dates and workfile-creation cohorts stay distinct. */
(() => {
  const number=value=>{const parsed=Number(String(value??0).replace(/[$,]/g,''));return Number.isFinite(parsed)?parsed:0;};
  const ymd=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  function date(value){
    const text=String(value||''),iso=text.match(/^(\d{4}-\d{2}-\d{2})/);
    if(iso){const parsed=new Date(iso[1]+'T12:00:00');return !Number.isNaN(parsed.getTime())&&ymd(parsed)===iso[1]?iso[1]:'';}
    const parsed=new Date(text);return text&&!Number.isNaN(parsed.getTime())?ymd(parsed):'';
  }
  const move=(value,days)=>{const d=new Date(value+'T12:00:00');d.setDate(d.getDate()+days);return ymd(d);};
  function range(preset='all',now=new Date(),from='',to=''){
    const year=now.getFullYear(),month=now.getMonth(),today=ymd(now),quarter=Math.floor(month/3)*3;
    const make=(from,to,previousFrom,previousTo)=>({from,to,previous:previousFrom?{from:previousFrom,to:previousTo}:null,error:''});
    if(preset==='month')return make(ymd(new Date(year,month,1)),ymd(new Date(year,month+1,0)),ymd(new Date(year,month-1,1)),ymd(new Date(year,month,0)));
    if(preset==='previousMonth')return make(ymd(new Date(year,month-1,1)),ymd(new Date(year,month,0)),ymd(new Date(year,month-2,1)),ymd(new Date(year,month-1,0)));
    if(preset==='quarter')return make(ymd(new Date(year,quarter,1)),ymd(new Date(year,quarter+3,0)),ymd(new Date(year,quarter-3,1)),ymd(new Date(year,quarter,0)));
    if(preset==='ytd'){const lastDay=Math.min(now.getDate(),new Date(year-1,month+1,0).getDate());return make(`${year}-01-01`,today,`${year-1}-01-01`,ymd(new Date(year-1,month,lastDay)));}
    if(preset==='previousYear')return make(`${year-1}-01-01`,`${year-1}-12-31`,`${year-2}-01-01`,`${year-2}-12-31`);
    if(preset==='custom'){
      if(!date(from)||!date(to)||from>to)return {...make('',''),error:'Choose a valid start and end date.'};
      const days=Math.round((Date.parse(to+'T12:00:00Z')-Date.parse(from+'T12:00:00Z'))/86400000)+1;
      return make(from,to,move(from,-days),move(from,-1));
    }
    return make('','');
  }
  const inRange=(value,range)=>!range?.from&&!range?.to || !!value&&(!range.from||value>=range.from)&&(!range.to||value<=range.to);
  const fileType=file=>String(file?.projectType||'Uncategorized').trim()||'Uncategorized';
  const landed=file=>['Pending Start','Job Won','In Progress','Work Completed','Completed-Pending Payment','Closed / Paid'].includes(file.fileStatus);
  function created(file){
    if(date(file.createdAt))return date(file.createdAt);
    return (Array.isArray(file.timeline)?file.timeline:[]).filter(item=>item&&typeof item==='object'&&/^(work file created|lead created)\b/i.test(String(item.text||item.title||''))).map(item=>date(item.at)).filter(Boolean).sort()[0]||'';
  }
  const wonDate=file=>date(file.wonDate||file.wonAt);
  function defaultCategory(file){
    if(['Closed / Paid','Job Lost / Closed'].includes(file.fileStatus))return 'archive';
    if(file.fileStatus==='In Negotiation')return 'negotiation';
    if(landed(file))return 'active';
    if(file.fileStatus==='Inspection Completed'||['Estimate Pending','Estimate Sent'].includes(file.statusDetail))return 'estimate';
    if(['Contact Established','Contact Attempted'].includes(file.fileStatus))return 'contact';return 'new';
  }
  function aggregate({files=[],rows=[],range:reportRange={from:'',to:''},filters={},period='monthly',fileForRow=()=>null,categoryForFile=defaultCategory,profit=row=>number(row.gross)-number(row.expenses)-number(row.labor),dateForRow=row=>date(row.date)}={}){
    const matches=(file,type)=>!filters.type||type===filters.type;
    const matchFile=file=>matches(file,fileType(file))&&(!filters.status||file.fileStatus===filters.status)&&(!filters.source||file.leadSource===filters.source);
    const eligible=files.filter(matchFile),cohort=eligible.filter(file=>inRange(created(file),reportRange));
    const linked=new Map(),selected=rows.filter(row=>{
      const file=fileForRow(row);linked.set(row,file);
      return matches(file,fileType(file||row))&&(!filters.status||file?.fileStatus===filters.status)&&(!filters.source||file?.leadSource===filters.source)&&inRange(dateForRow(row),reportRange);
    });
    const types=new Map(),buckets=new Map(),months=new Map();
    const ensure=type=>{if(!types.has(type))types.set(type,{type,files:0,landed:0,open:0,lost:0,pipeline:0,revenue:0,expenses:0,labor:0,profit:0,fileIds:new Set(),rowIds:[],unlinked:0,outsideCohort:0});return types.get(type);};
    const total={gross:0,expenses:0,labor:0,profit:0,count:selected.length};
    const addFinancial=(group,row)=>{group.revenue+=number(row.gross);group.expenses+=number(row.expenses);group.labor+=number(row.labor);group.profit+=profit(row);group.rowIds.push(row.id);};
    for(const file of cohort){const stat=ensure(fileType(file));stat.files++;stat.fileIds.add(String(file.id));if(landed(file))stat.landed++;if(file.fileStatus==='Job Lost / Closed')stat.lost++;if(!['Closed / Paid','Job Lost / Closed'].includes(file.fileStatus)){stat.open++;stat.pipeline+=number(file.estimateTotal);}}
    const cohortIds=new Set(cohort.map(file=>String(file.id)));
    for(const row of selected){
      const file=linked.get(row),stat=ensure(fileType(file||row));addFinancial(stat,row);
      if(file){stat.fileIds.add(String(file.id));if(!cohortIds.has(String(file.id)))stat.outsideCohort++;}else stat.unlinked++;
      total.gross+=number(row.gross);total.expenses+=number(row.expenses);total.labor+=number(row.labor);total.profit+=profit(row);
      const value=dateForRow(row),month=value?value.slice(0,7):'Undated',key=month==='Undated'?month:period==='yearly'?month.slice(0,4):period==='quarterly'?`${month.slice(0,4)}-Q${Math.ceil(Number(month.slice(5))/3)}`:month;
      for(const [map,name] of [[buckets,key],[months,month]]){if(!map.has(name))map.set(name,{key:name,revenue:0,expenses:0,labor:0,profit:0,rowIds:[]});addFinancial(map.get(name),row);}
    }
    const stats=[...types.values()].map(stat=>({...stat,fileIds:[...stat.fileIds],closeRate:stat.files?stat.landed/stat.files*100:null,margin:stat.revenue?stat.profit/stat.revenue*100:null})).sort((a,b)=>b.revenue-a.revenue||b.files-a.files||a.type.localeCompare(b.type));
    const definitions=[['new','New Leads'],['contact','Pending Contact'],['estimate','Pending Estimates'],['negotiation','In Negotiation'],['active','Active Jobs'],['archive','Closed Files']];
    const stages=definitions.map(([key,name])=>({key,name,files:[],value:0,valued:0}));
    for(const file of cohort){const stage=stages.find(stage=>stage.key===categoryForFile(file))||stages[0];stage.files.push(String(file.id));stage.value+=number(file.estimateTotal);if(number(file.estimateTotal)!==0)stage.valued++;}
    const recordedWins=eligible.filter(file=>wonDate(file)&&inRange(wonDate(file),reportRange));
    return {total:{...total,margin:total.gross?total.profit/total.gross*100:null},rows:selected,files:cohort,types:stats,stages,periods:[...buckets.values()].sort((a,b)=>a.key.localeCompare(b.key)),months:[...months.values()].filter(item=>item.key!=='Undated').sort((a,b)=>b.revenue-a.revenue),wins:recordedWins.map(file=>String(file.id)),undatedFiles:eligible.filter(file=>!created(file)).length,unknownWinDates:eligible.filter(file=>landed(file)&&!wonDate(file)).length,unlinked:selected.filter(row=>!linked.get(row)).length};
  }
  function csv(stats){const quote=value=>{let text=String(value??'');if(/^\s*[=+@]/.test(text))text="'"+text;return `"${text.replace(/"/g,'""')}"`;};return [['Type of Work','Files','Landed','Close %','Pipeline','Income','Expenses','Labor','Net','Margin'],...stats.map(stat=>[stat.type,stat.files,stat.landed,stat.closeRate==null?'':stat.closeRate.toFixed(1),...['pipeline','revenue','expenses','labor','profit'].map(key=>stat[key].toFixed(2)),stat.margin==null?'':stat.margin.toFixed(1)])].map(line=>line.map(quote).join(',')).join('\n');}
  globalThis.AnimusBusinessModel={number,date,ymd,range,inRange,fileType,landed,created,wonDate,aggregate,csv};
})();
