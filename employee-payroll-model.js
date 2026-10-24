/* Shared employee directory and read-only payroll projections. */
(() => {
  const roster=Object.freeze(['David','Lara','Manny']);
  const key=value=>String(value||'').trim().toLowerCase();
  const cents=value=>Math.round((Number(value)||0)*100);
  const pay=row=>Number(row.total)||((Number(row.hours)||0)*(Number(row.rate)||0));
  function assignedNames(file={}){
    const value=Object.hasOwn(file,'assignedTo')?file.assignedTo:file.assignedEmployee||file.employee||file.team;
    return [...new Set((Array.isArray(value)?value:[value]).flatMap(entry=>String(entry&&typeof entry==='object'?entry.name||entry.displayName||entry.email||'':entry||'').split(/[,;]/)).map(name=>name.trim()).filter(name=>name&&key(name)!=='unassigned'))];
  }
  function summaries(files=[],rows=[]){
    const employees=new Map(roster.map(name=>[key(name),{name,jobs:new Map(),payments:[],paidCents:0,pendingCents:0}]));
    const employee=name=>{const id=key(name);if(!id)return null;if(!employees.has(id))employees.set(id,{name:String(name).trim(),jobs:new Map(),payments:[],paidCents:0,pendingCents:0});return employees.get(id);};
    const addJob=(person,id,file,label)=>{if(!person.jobs.has(id))person.jobs.set(id,{id,fileId:file?.id||'',fileNumber:file?.fileNumber||'',name:file?.clientName||label||'Unlinked payroll',status:file?.fileStatus||'',assigned:false,paidCents:0,pendingCents:0,rows:[]});return person.jobs.get(id);};
    for(const file of files)for(const name of assignedNames(file))addJob(employee(name),file.id,file).assigned=true;
    for(const row of rows){
      const person=employee(row.employee);if(!person)continue;
      const id=row.fileId||row.dashboardFileId;
      const matches=!id&&row.fileNumber?files.filter(file=>file.fileNumber===row.fileNumber):[];
      const file=id?files.find(file=>file.id===id):matches.length===1?matches[0]:null;
      const job=addJob(person,file?.id||id||`unlinked:${row.id}`,file,row.clientJob||row.fileNumber);
      const value=cents(pay(row));job.rows.push(row);
      if(row.status==='Paid'){job.paidCents+=value;person.paidCents+=value;person.payments.push({...row,amount:value/100,jobName:job.name});}
      else{job.pendingCents+=value;person.pendingCents+=value;}
    }
    return [...employees.values()].map(person=>{
      let running=0;person.payments.sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||String(a.id).localeCompare(String(b.id)));
      return {name:person.name,paid:person.paidCents/100,pending:person.pendingCents/100,jobs:[...person.jobs.values()].map(job=>({...job,paid:job.paidCents/100,pending:job.pendingCents/100})),payments:person.payments.map(row=>({...row,runningPaid:(running+=cents(row.amount))/100}))};
    });
  }
  globalThis.AnimusEmployees=Object.freeze({roster,assignedNames,summaries});
})();
