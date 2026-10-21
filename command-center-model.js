/* Pure, read-only projections. Current stages are never historical snapshots. */
(() => {
  const B = globalThis.AnimusBusinessModel;
  const stages = [['new','New Leads','users'],['contact','Pending Contact','phone'],['estimate','Pending Estimates','file-text'],['negotiation','In Negotiation','messages-square'],['active','Active Jobs','hammer'],['archive','Closed Files','circle-check']];
  const date = B.date;
  function clock(now = new Date(), timezone = 'America/New_York') {
    let zone = timezone;
    try { new Intl.DateTimeFormat('en-US',{timeZone:zone}).format(now); } catch { zone = 'America/New_York'; }
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
    const today = `${parts.year}-${parts.month}-${parts.day}`;
    return {today,zone,hour:Number(parts.hour),local:new Date(`${today}T12:00:00`)};
  }
  function eventDay(event, zone) {
    if (event.allDay || event.isAllDay || !event.startIso || !/[Zz]|[+-]\d\d:\d\d$/.test(event.startIso)) return date(event.date || event.startIso);
    const parsed = new Date(event.startIso);
    return Number.isNaN(+parsed) ? date(event.date) : clock(parsed,zone).today;
  }
  function schedule(events, now, zone) {
    const today = clock(now,zone).today,seen=new Set();
    const result = events.filter(event=>{
      const key=event.eventKey || event.id || JSON.stringify([event.title,event.date,event.time,event.fileId]);
      if(seen.has(key)||eventDay(event,zone)!==today)return false;seen.add(key);return true;
    }).map(event=>{
      const allDay=!!(event.allDay||event.isAllDay||event.start?.date||(!event.time&&!event.startIso));
      const iso=String(event.startIso||'');
      const time=/[Zz]|[+-]\d\d:\d\d$/.test(iso)&&!Number.isNaN(+new Date(iso))?new Intl.DateTimeFormat('en-US',{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(iso)):event.time||'00:00';
      return {...event,allDay,sortTime:allDay?'':time};
    }).sort((a,b)=>Number(b.allDay)-Number(a.allDay)||a.sortTime.localeCompare(b.sortTime));
    const currentTime=new Intl.DateTimeFormat('en-US',{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now);
    const current=result.find(e=>!e.allDay&&e.startIso&&e.endIso&&Date.parse(e.startIso)<=+now&&Date.parse(e.endIso)>+now);
    const next=current||result.find(e=>!e.allDay&&e.sortTime>=currentTime);
    return result.map(e=>({...e,highlight:e===next}));
  }
  function alerts(files,today,paid=()=>0) {
    const result=[],seen=new Set();
    const add=(file,kind,label,due,tab)=>{
      due=date(due);if(!due||due>today)return;
      const key=`${file.id}:${kind}:${due}`;if(seen.has(key))return;seen.add(key);
      result.push({file,kind,label,due,tab});
    };
    for(const file of files){
      if(['Closed / Paid','Job Lost / Closed','Canceled','Cancelled'].includes(file.fileStatus))continue;
      if(!file.nextActionCompleted && !file.followUpCompleted)add(file,'follow',file.nextAction||'Follow-up due',file.nextActionDate||file.followUpDate,'overview');
      if(!['Completed','Sent'].includes(file.estimateStatus))add(file,'estimate','Estimate due',file.estimateDueDate,'estimate');
      if(file.fileStatus==='In Negotiation')add(file,'response','Customer response due',file.responseDueDate,'communication');
      const balance=Math.max(0,B.number(file.estimateTotal)-paid(file));
      if(balance>0&&['Completed-Pending Payment','Work Completed'].includes(file.fileStatus))add(file,'payment','Payment follow-up due',file.paymentDueDate||file.invoiceDueDate,'financials');
      for(const task of Array.isArray(file.tasks)?file.tasks:[]){
        if(!task||typeof task!=='object'||task.completed||['completed','done','cancelled','canceled'].includes(String(task.status).toLowerCase()))continue;
        add(file,`task:${task.id||task.title||task.text}` ,task.title||task.text||'Task due',task.dueDate||task.date,'overview');
      }
    }
    return result.sort((a,b)=>a.due.localeCompare(b.due)||String(a.file.id).localeCompare(String(b.file.id)));
  }
  function activity(files){
    const result=[],seen=new Set();
    for(const file of files)for(const [key,kind] of [['timeline','activity'],['notes','note']]){
      for(const item of Array.isArray(file[key])?file[key]:[]){
        if(!item)continue;
        const legacy=typeof item==='string'?item.match(/([A-Z][a-z]{2} \d{1,2}, \d{4},? \d{1,2}:\d{2}\s*[AP]M)$/)?.[1]:'';
        const at=typeof item==='string'?legacy:item.editedAt||item.at||item.createdAt||item.updatedAt||item.date;
        const text=typeof item==='string'?item.slice(0,-(legacy?.length||item.length)).trim():item.text||item.message||item.description||item.label||item.title||item.action;
        if(!text||!at||Number.isNaN(Date.parse(at)))continue;
        const signature=JSON.stringify([String(file.id),item]);if(seen.has(signature))continue;seen.add(signature);
        result.push({file,at,text,kind});
      }
    }
    return result.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
  }
  function upcoming(files,today){
    return files.filter(file=>date(file.startDate)>=today&&date(file.startDate)&&!['Closed / Paid','Job Lost / Closed','Work Completed','Completed-Pending Payment','Canceled','Cancelled'].includes(file.fileStatus)).sort((a,b)=>date(a.startDate).localeCompare(date(b.startDate)));
  }
  function assignments(files,category){
    const people=new Map();
    for(const file of files.filter(f=>category(f)==='active')){
      const raw=file.assignedTo||file.assignedEmployee||file.employee||file.team;
      const entries=Array.isArray(raw)?raw:typeof raw==='object'&&raw?[raw]:String(raw||'').split(/[,;]/);
      for(const entry of entries){
        const label=String(typeof entry==='object'?entry.name||entry.email||entry.id||'':entry).trim();if(!label||/^(unassigned|none)$/i.test(label))continue;
        const id=String(typeof entry==='object'?entry.id||entry.uid||entry.email||label:label).toLowerCase();
        if(!people.has(id))people.set(id,{id,label,ids:new Set()});people.get(id).ids.add(String(file.id));
      }
    }
    return [...people.values()].map(p=>({...p,ids:[...p.ids]})).sort((a,b)=>b.ids.length-a.ids.length||a.label.localeCompare(b.label));
  }
  function monthOutcomes(files,month){
    const count=field=>{const dated=files.filter(f=>date(f[field]));return {count:dated.filter(f=>date(f[field]).slice(0,7)===month).length,available:!!dated.length};};
    return {sent:count('estimateSentAt'),completed:count('completedAt')};
  }
  globalThis.AnimusCommandModel={stages,clock,eventDay,schedule,alerts,activity,upcoming,assignments,monthOutcomes};
})();
