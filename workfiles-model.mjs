export const tabs=[['all','All Workfiles'],['mine','My Work'],['open','Open'],['progress','In Progress'],['awaiting','Awaiting Client'],['review','Review'],['completed','Completed'],['closed','Closed']];
export const tones={'New Lead':'new-lead','Contact Established':'contact-established','Contact Attempted':'contact-attempted','Inspection Completed':'inspection-completed','In Negotiation':'negotiation','Pending Start':'pending-start','In Progress':'in-progress','Completed-Pending Payment':'completed-pending-payment','Closed / Paid':'closed-paid','Job Lost / Closed':'lost-closed'};
export function assigned(file){const value=file.assignedTo||file.assignedEmployee||file.employee||file.team||'';return (Array.isArray(value)?value:String(value).split(/\s*[/,]\s*/)).map(String).filter(v=>v.trim()&&!/^unassigned$/i.test(v));}
export function due(file){return file.nextActionDate||file.followUpDate||'';}
export function value(file){const raw=file.estimateTotal??file.editableEstimate?.totals?.total;if(raw===null||raw===undefined||raw==='')return null;const n=Number(raw);return Number.isFinite(n)&&(n!==0||file.estimateExists)?n:null;}
export function inTab(file,tab,me=''){
  const status=file.fileStatus||'New Lead';const closed=['Closed / Paid','Job Lost / Closed'].includes(status);
  if(tab==='mine')return !!me&&assigned(file).includes(me);
  if(tab==='open')return !closed;
  if(tab==='progress')return status==='In Progress';
  if(tab==='awaiting')return status==='In Negotiation';
  if(tab==='review')return status==='Inspection Completed';
  if(tab==='completed')return ['Completed-Pending Payment','Closed / Paid'].includes(status);
  if(tab==='closed')return closed;
  return true;
}
export function query(files,state){
  const q=String(state.search||'').trim().toLowerCase();
  const rows=files.filter(f=>inTab(f,state.tab,state.assignee)&&(!state.category||f.category===state.category)&&(!state.status||f.fileStatus===state.status)&&(!state.type||f.projectType===state.type)&&(!state.assignee||assigned(f).includes(state.assignee))&&(!state.from||due(f)&&due(f)>=state.from)&&(!state.to||due(f)&&due(f)<=state.to)&&(!q||[f.clientName,f.fileNumber,f.projectAddress,f.clientEmail,f.clientPhone,f.projectType,f.leadSource].some(v=>String(v||'').toLowerCase().includes(q))));
  const key=state.sort||'name';const get=f=>key==='name'?f.clientName:key==='status'?f.fileStatus:key==='type'?f.projectType:key==='value'?value(f):due(f);
  return rows.sort((a,b)=>{const x=get(a),y=get(b);if(x===null||x==='')return y===null||y===''?0:1;if(y===null||y==='')return -1;return (typeof x==='number'?x-y:String(x||'').localeCompare(String(y||'')))*(state.direction===-1?-1:1);});
}
