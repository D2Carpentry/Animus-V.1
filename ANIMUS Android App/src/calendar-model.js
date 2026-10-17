export const EVENT_TYPES = {
  inspection:{label:'Inspection',color:'#a78bfa'},
  start:{label:'Job start',color:'#60a5fa'},
  'follow-up':{label:'Follow-up',color:'#fbbf24'},
  completion:{label:'Completion',color:'#2dd4bf'},
  appointment:{label:'Appointment',color:'#fb7185'},
  google:{label:'Calendar',color:'#a3b2c7'}
};
export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function addDays(key, count) {
  const date=localDate(key);date.setDate(date.getDate()+count);return localDateKey(date);
}
export function localDate(value) {
  const text=String(value||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(text))throw new Error('Choose a valid date.');
  const [y,m,d]=text.split('-').map(Number);const date=new Date(y,m-1,d);
  if(localDateKey(date)!==text)throw new Error('Choose a valid date.');
  return date;
}
export function eventDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value)?localDate(value):new Date(value); }
function time(value) { if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(value||''))throw new Error('Choose a valid time.');return value; }
export function validateAppointment(values, files, originalId = '') {
  const title=String(values.title||'').trim();if(!title)throw new Error('Enter an appointment title.');
  if(title.length>160)throw new Error('Keep the title to 160 characters.');
  if(!EVENT_TYPES[values.type])throw new Error('Choose an appointment type.');
  const fileId=String(values.fileId||'');if(fileId&&!files.some(f=>f.id===fileId))throw new Error('That workfile is no longer available.');
  const startDate=localDateKey(localDate(values.date));const endDate=localDateKey(localDate(values.endDate||values.date));
  const allDay=Boolean(values.allDay);
  const start=allDay?startDate:`${startDate}T${time(values.time)}:00`;
  const end=allDay?addDays(endDate,1):`${endDate}T${time(values.endTime)}:00`;
  if(eventDate(end)<=eventDate(start))throw new Error('The end must be after the start.');
  return {id:originalId||`preview-event-${crypto.randomUUID()}`,title,type:values.type,fileId,allDay,start,end,address:String(values.address||'').trim().slice(0,500),notes:String(values.notes||'').trim().slice(0,4000),source:'preview'};
}
export function normalizeCalendar(snapshot = {}, appointments = []) {
  const files=snapshot.files||[];
  const configs=[['inspection','inspectionDate','inspectionTime'],['start','startDate',''],['follow-up','followUpDate',''],['completion','anticipatedCompletionDate','']];
  const fromFiles=files.flatMap(file=>configs.flatMap(([type,dateField,timeField])=>{
    const date=String(file[dateField]||'').slice(0,10);if(!date)return [];
    try{localDate(date);}catch{return [];}
    const at=timeField?file[timeField]:'';
    return [{id:`${file.id}-${type}`,title:`${EVENT_TYPES[type].label} - ${file.clientName||'Customer'}`,type,fileId:file.id,clientName:file.clientName,address:file.projectAddress||'',phone:file.clientPhone||'',allDay:!at,start:at?`${date}T${at}:00`:date,source:'workfile',notes:''}];
  }));
  const external=(snapshot.events||[]).map((event,index)=>{
    const start=event.startIso||event.start||((event.date||'')+(event.time?`T${event.time}:00`:''));
    if(!start||!Number.isFinite(eventDate(start).getTime()))return null;
    return {id:String(event.eventKey||event.id||`calendar-${index}-${start}`),title:event.title||event.summary||'Appointment',type:EVENT_TYPES[event.type]?event.type:'google',fileId:event.fileId||'',start,end:event.endIso||event.end||undefined,allDay:event.allDay??!String(start).includes('T'),address:event.address||'',notes:event.notes||event.description||'',source:'cloud'};
  }).filter(Boolean);
  const seen=new Set();
  return [...fromFiles,...external,...appointments].filter(event=>{
    if(seen.has(event.id))return false;seen.add(event.id);return true;
  }).map(event=>{
    const file=files.find(f=>f.id===event.fileId);
    return {...event,clientName:file?.clientName||event.clientName||'',phone:file?.clientPhone||event.phone||'',address:event.address||file?.projectAddress||'',fileNumber:file?.fileNumber||'',color:EVENT_TYPES[event.type].color};
  }).sort((a,b)=>eventDate(a.start)-eventDate(b.start));
}
export function filterCalendar(events, query = '', type = 'all') {
  const text=query.trim().toLowerCase();
  return events.filter(event=>(type==='all'||event.type===type)&&(!text||[event.title,event.clientName,event.fileNumber,event.address,event.notes].join(' ').toLowerCase().includes(text)));
}
export function eventsOnDate(events,key) {
  const day=localDate(key);const next=localDate(addDays(key,1));
  return events.filter(event=>{
    const start=eventDate(event.start);const end=event.end?eventDate(event.end):(event.allDay?localDate(addDays(localDateKey(start),1)):new Date(start.getTime()+3600000));
    return start<next&&end>day;
  });
}
export function createPreviewAppointments(today = localDateKey()) {
  const values=[
    {id:'preview-visit',title:'Site walkthrough',type:'inspection',fileId:'demo-work-1',start:`${today}T09:00:00`,end:`${today}T10:00:00`,notes:'Confirm measurements and review the finish selection.'},
    {id:'preview-consultation',title:'Accent wall consultation',type:'appointment',fileId:'demo-work-2',start:`${today}T14:00:00`,end:`${today}T15:00:00`,notes:'Review the design and installation timeline.'},
    {id:'preview-followup',title:'Estimate follow-up',type:'follow-up',fileId:'demo-work-2',start:`${addDays(today,1)}T10:30:00`,end:`${addDays(today,1)}T11:00:00`,notes:''}
  ].map(event=>({...event,source:'preview',allDay:false}));
  return {
    list:()=>structuredClone(values),
    save(event){const index=values.findIndex(e=>e.id===event.id);if(index<0)values.push(structuredClone(event));else values[index]=structuredClone(event);},
    remove(id){const index=values.findIndex(e=>e.id===id);if(index<0)throw new Error('Appointment not found.');values.splice(index,1);}
  };
}
