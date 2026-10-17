import {Calendar} from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import {createIcons,ChevronLeft,ChevronRight,Plus,Search,CalendarDays,MapPin,Phone,FileText, Bell, Pencil, Trash2, X} from 'lucide';
import {EVENT_TYPES,localDateKey,addDays,eventDate,normalizeCalendar,filterCalendar,eventsOnDate,validateAppointment,createPreviewAppointments} from './calendar-model.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateLabel=new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
const timeLabel=new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit'});
const icon=name=>`<i data-lucide="${name}" aria-hidden="true"></i>`;
export const calendarIcons={ChevronLeft,ChevronRight,Plus,Search,CalendarDays,MapPin,Phone,FileText,Bell,Pencil,Trash2,X};
const drawIcons=()=>createIcons({icons:calendarIcons});

export function mountCalendar({demo,panel,closePanel,message,reminder,openExternal,confirmAction}) {
  const host=document.getElementById('calendarView');
  const store=createPreviewAppointments();
  let query='';let type='all';let calendar;let formDirty=false;
  const snapshot=()=>window.AnimusMobile?.calendarData||{files:[],events:[]};
  const all=()=>normalizeCalendar(snapshot(),demo?store.list():[]);
  const visible=()=>filterCalendar(all(),query,type);
  host.innerHTML=`<div class="app-calendar-heading"><div><p class="eyebrow">Schedule</p><h1>Calendar</h1></div>${demo?`<button type="button" id="calendarAdd" class="primary-action">${icon('plus')} Appointment</button>`:''}</div>
    <div class="app-calendar-stats" id="calendarStats"></div>
    <div class="app-calendar-tools"><div class="app-calendar-search">${icon('search')}<input type="search" id="calendarSearch" placeholder="Search appointments" aria-label="Search appointments"></div><label class="app-calendar-type"><span class="sr-only">Appointment type</span><select id="calendarType" aria-label="Appointment type"><option value="all">All types</option>${Object.entries(EVENT_TYPES).map(([key,value])=>`<option value="${key}">${value.label}</option>`).join('')}</select></label></div>
    <div class="app-calendar-modes" role="group" aria-label="Calendar view"><button type="button" data-cal-view="agenda" aria-pressed="true">Agenda</button><button type="button" data-cal-view="dayGridMonth" aria-pressed="false">Month</button><button type="button" data-cal-view="timeGridDay" aria-pressed="false">Day</button></div>
    <div class="app-calendar-datebar"><button type="button" id="calendarPrevious" aria-label="Previous period" title="Previous period">${icon('chevron-left')}</button><label class="app-calendar-date"><span id="calendarRange"></span><input type="date" id="calendarDate" aria-label="Go to date"></label><button type="button" id="calendarNext" aria-label="Next period" title="Next period">${icon('chevron-right')}</button><button type="button" id="calendarToday">Today</button></div>
    <div id="appCalendar"></div><p class="app-calendar-zone">${esc(Intl.DateTimeFormat().resolvedOptions().timeZone)}${demo?' · Preview appointments reset on restart':''}</p><button type="button" id="calendarGoogle" class="app-calendar-google">${icon('calendar-days')} Open D2 Google Calendar</button>`;
  const $=id=>document.getElementById(id);
  const updateStats=()=>{
    const events=all();const today=localDateKey();
    const todayCount=eventsOnDate(events,today).length;
    const upcoming=events.filter(e=>eventDate(e.start)>=eventDate(today)&&eventDate(e.start)<eventDate(addDays(today,7))).length;
    $('calendarStats').textContent=`${todayCount} today · ${upcoming} in the next 7 days`;
  };
  function refresh(){
    if(!calendar)return;
    calendar.batchRendering(()=>{
      calendar.getEventSources().forEach(source=>source.remove());
      calendar.addEventSource(visible().map(event=>({id:event.id,title:event.title,start:event.start,end:event.end,allDay:event.allDay,color:event.color,extendedProps:{record:event}})));
    });
    updateStats();
    if(host.classList.contains('active'))calendar.updateSize();
  }
  function eventDetail(event){
    const start=eventDate(event.start);const end=event.end?eventDate(event.end):null;
    const editable=demo&&event.source==='preview';
    panel(EVENT_TYPES[event.type].label,`<div class="app-calendar-detail"><h3>${esc(event.title)}</h3><p class="app-calendar-detail-date">${esc(dateLabel.format(start))}</p><p>${event.allDay?'All day':esc(timeLabel.format(start))}${end&&!event.allDay?` - ${esc(timeLabel.format(end))}`:''}</p>${event.allDay&&event.end&&addDays(String(event.end).slice(0,10),-1)!==String(event.start).slice(0,10)?`<p>Through ${esc(dateLabel.format(eventDate(addDays(String(event.end).slice(0,10),-1))))}</p>`:''}${event.clientName?`<p class="app-calendar-customer">${esc(event.clientName)} <span>${esc(event.fileNumber)}</span></p>`:''}${event.address?`<p>${esc(event.address)}</p>`:''}${event.notes?`<p class="app-calendar-notes">${esc(event.notes)}</p>`:''}<small>${event.source==='workfile'?'From workfile':event.source==='preview'?'Preview appointment':'Cloud calendar'}</small></div><div class="app-calendar-detail-actions">${event.fileId?`<button type="button" id="calendarOpenFile">${icon('file-text')} Open workfile</button>`:''}${event.phone?`<button type="button" id="calendarCall">${icon('phone')} Call customer</button>`:''}${event.address?`<button type="button" id="calendarDirections">${icon('map-pin')} Directions</button>`:''}<button type="button" id="calendarRemind">${icon('bell')} Remind me</button>${editable?`<button type="button" id="calendarEdit">${icon('pencil')} Edit appointment</button><button type="button" id="calendarDelete" class="danger">${icon('trash-2')} Delete appointment</button>`:''}</div>`);
    if($('calendarOpenFile'))$('calendarOpenFile').onclick=()=>{if(window.AnimusMobile.openFile(event.fileId))closePanel();else message('This workfile is no longer available.');};
    if($('calendarCall'))$('calendarCall').onclick=()=>openExternal(`tel:${event.phone.replace(/[^+0-9]/g,'')}`);
    if($('calendarDirections'))$('calendarDirections').onclick=()=>openExternal(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`);
    $('calendarRemind').onclick=()=>reminder(event);
    if(editable){$('calendarEdit').onclick=()=>eventForm(event);$('calendarDelete').onclick=async()=>{
      if(!await confirmAction({title:'Delete appointment?',description:event.title,confirmLabel:'Delete appointment',danger:true}))return;
      store.remove(event.id);closePanel();refresh();message('Preview appointment deleted.');
    };}
    drawIcons();
  }
  function eventForm(event=null){
    if(!demo)return;
    formDirty=false;
    const date=event?localDateKey(eventDate(event.start)):localDateKey(calendar.getDate());
    const end=event?.end?eventDate(event.end):null;
    const selectedFile=event?.fileId||'';
    panel(event?'Edit appointment':'New appointment',`<form id="appointmentForm" class="app-calendar-form"><label>Title<input name="title" maxlength="160" required placeholder="Appointment title" value="${esc(event?.title||'')}"></label><div class="app-calendar-form-row"><label>Type<select name="type">${Object.entries(EVENT_TYPES).filter(([key])=>key!=='google').map(([key,value])=>`<option value="${key}" ${key===(event?.type||'appointment')?'selected':''}>${value.label}</option>`).join('')}</select></label><label>Workfile<select name="fileId"><option value="">No workfile</option>${snapshot().files.map(file=>`<option value="${esc(file.id)}" ${file.id===selectedFile?'selected':''}>${esc(file.clientName)} · ${esc(file.fileNumber)}</option>`).join('')}</select></label></div><label class="app-calendar-check"><input type="checkbox" name="allDay" ${event?.allDay?'checked':''}> All day</label><div class="app-calendar-form-row"><label>Start date<input type="date" name="date" value="${date}" required></label><label>End date<input type="date" name="endDate" value="${event?.allDay&&event?.end?addDays(String(event.end).slice(0,10),-1):end?localDateKey(end):date}" required></label></div><div class="app-calendar-form-row" id="appointmentTimes"><label>Start time<input type="time" name="time" value="${event&&!event.allDay?`${String(eventDate(event.start).getHours()).padStart(2,'0')}:${String(eventDate(event.start).getMinutes()).padStart(2,'0')}`:'09:00'}" required></label><label>End time<input type="time" name="endTime" value="${end&&!event.allDay?`${String(end.getHours()).padStart(2,'0')}:${String(end.getMinutes()).padStart(2,'0')}`:'10:00'}" required></label></div><label>Location<input name="address" maxlength="500" value="${esc(event?.address||'')}" placeholder="Address or meeting location"></label><label>Notes<textarea name="notes" rows="4" maxlength="4000">${esc(event?.notes||'')}</textarea></label><p id="appointmentError" class="app-calendar-error" role="alert" hidden></p><footer><button type="button" id="appointmentCancel">Cancel</button><button type="submit" class="primary-action">Save appointment</button></footer></form>`);
    const form=$('appointmentForm');const startInput=form.elements.date;let previousStart=startInput.value;
    form.addEventListener('input',()=>{formDirty=true;});form.addEventListener('change',()=>{formDirty=true;});
    const updateAllDay=()=>{$('appointmentTimes').hidden=form.elements.allDay.checked;for(const name of ['time','endTime'])form.elements[name].required=!form.elements.allDay.checked;};
    form.elements.allDay.onchange=updateAllDay;updateAllDay();
    startInput.onchange=()=>{if(form.elements.endDate.value===previousStart||form.elements.endDate.value<startInput.value)form.elements.endDate.value=startInput.value;previousStart=startInput.value;};
    form.elements.fileId.onchange=()=>{const file=snapshot().files.find(f=>f.id===form.elements.fileId.value);if(file&&!form.elements.address.value)form.elements.address.value=file.projectAddress||'';};
    $('appointmentCancel').onclick=closePanel;
    form.onsubmit=e=>{e.preventDefault();try{
      const data=Object.fromEntries(new FormData(form));data.allDay=form.elements.allDay.checked;
      const saved=validateAppointment(data,snapshot().files,event?.id||'');store.save(saved);closePanel(true);calendar.gotoDate(saved.start);refresh();message('Appointment saved in preview.');
    }catch(error){$('appointmentError').hidden=false;$('appointmentError').textContent=error.message;}};
    form.elements.title.focus();
  }
  calendar=new Calendar($('appCalendar'),{
    plugins:[dayGridPlugin,listPlugin,timeGridPlugin,interactionPlugin],initialView:'agenda',initialDate:localDateKey(),timeZone:'local',headerToolbar:false,height:'auto',
    views:{agenda:{type:'list',duration:{days:7},dateIncrement:{days:7},listDayFormat:{weekday:'long',month:'short',day:'numeric'},listDaySideFormat:false}},
    nowIndicator:true,dayMaxEvents:2,fixedWeekCount:false,eventMinHeight:40,eventShortHeight:40,allDayText:'All day',noEventsContent:'No appointments in this date range.',eventTimeFormat:{hour:'numeric',minute:'2-digit',meridiem:'short'},
    slotDuration:'00:30:00',scrollTime:'08:00:00',editable:false,eventInteractive:true,
    dateClick:info=>{calendar.setOption('height',600);calendar.changeView('timeGridDay',info.dateStr);},
    eventClick:info=>{info.jsEvent.preventDefault();eventDetail(info.event.extendedProps.record);},
    datesSet:info=>{
      $('calendarRange').textContent=info.view.title;$('calendarDate').value=localDateKey(calendar.getDate());
      host.querySelectorAll('[data-cal-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.calView===info.view.type)));
      $('calendarPrevious').setAttribute('aria-label',`Previous ${info.view.type==='dayGridMonth'?'month':info.view.type==='timeGridDay'?'day':'7 days'}`);
      $('calendarNext').setAttribute('aria-label',`Next ${info.view.type==='dayGridMonth'?'month':info.view.type==='timeGridDay'?'day':'7 days'}`);
    },
    eventContent:info=>{
      const record=info.event.extendedProps.record;const container=document.createElement(info.view.type==='agenda'?'button':'div');container.className='app-calendar-event';
      if(info.view.type==='agenda')container.type='button';
      const title=document.createElement('strong');title.textContent=record.title;container.append(title);
      if(record.clientName&&!record.title.includes(record.clientName)){const client=document.createElement('span');client.textContent=record.clientName;container.append(client);}
      return {domNodes:[container]};
    }
  });
  calendar.render();refresh();drawIcons();
  $('calendarPrevious').onclick=()=>calendar.prev();$('calendarNext').onclick=()=>calendar.next();$('calendarToday').onclick=()=>calendar.today();
  $('calendarDate').onchange=e=>{if(e.target.value)calendar.gotoDate(e.target.value);};
  host.querySelectorAll('[data-cal-view]').forEach(button=>button.onclick=()=>{calendar.setOption('height',button.dataset.calView==='timeGridDay'?600:'auto');calendar.changeView(button.dataset.calView);calendar.updateSize();});
  $('calendarSearch').oninput=e=>{query=e.target.value;refresh();};$('calendarType').onchange=e=>{type=e.target.value;refresh();};
  if($('calendarAdd'))$('calendarAdd').onclick=()=>eventForm();
  $('calendarGoogle').onclick=()=>openExternal('https://calendar.google.com/calendar/u/0/r?authuser=d2carpentryanddesign%40gmail.com');
  return {render:refresh,hasDraft:()=>formDirty&&Boolean(document.querySelector('#nativeDialog[open] #appointmentForm'))};
}
