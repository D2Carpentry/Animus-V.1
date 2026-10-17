import test from 'node:test';
import assert from 'node:assert/strict';
import {localDateKey,localDate,addDays,eventDate,validateAppointment,normalizeCalendar,eventsOnDate,filterCalendar,createPreviewAppointments} from '../src/calendar-model.js';
const files=[{id:'f-1',fileNumber:'A-001',clientName:'Test Customer',projectAddress:'123 Test Avenue',clientPhone:'2395550100',startDate:'2026-11-01',inspectionDate:'2026-11-02',inspectionTime:'14:00'}];
const form={title:'Measurements',type:'inspection',fileId:'f-1',date:'2026-11-02',endDate:'2026-11-02',time:'09:00',endTime:'10:00',allDay:false};
test('calendar dates remain local across DST and month/year boundaries',()=>{
  assert.equal(localDateKey(new Date(2026,9,16,23,30)),'2026-10-16');
  assert.equal(addDays('2026-11-01',1),'2026-11-02');
  assert.equal(addDays('2026-12-31',1),'2027-01-01');
  assert.throws(()=>localDate('2026-02-30'));
  assert.equal(eventDate('2026-11-01').getHours(),0);
});
test('workfile dates retain their source and do not acquire invented appointment times',()=>{
  const events=normalizeCalendar({files});
  assert.equal(events[0].start,'2026-11-01');assert.equal(events[0].allDay,true);assert.equal(events[0].source,'workfile');
  assert.equal(events[1].start,'2026-11-02T14:00:00');assert.equal(events[1].allDay,false);
  assert.equal(events[1].fileId,'f-1');assert.equal(events[1].phone,'2395550100');
});
test('cloud events deduplicate by stable event key, preserve durations and skip invalid dates',()=>{
  const events=normalizeCalendar({files,events:[{eventKey:'f-1-start',date:'2026-11-01',title:'Duplicate'},{id:'c-1',startIso:'2026-11-03T10:00:00-05:00',endIso:'2026-11-03T12:00:00-05:00',title:'Imported'},{id:'bad',start:'not-a-date'}]});
  assert.equal(events.length,3);assert.equal(events.find(e=>e.id==='c-1').end,'2026-11-03T12:00:00-05:00');
});
test('all-day end is exclusive and timed/multi-day events appear on each touched day',()=>{
  const event=validateAppointment({...form,allDay:true,date:'2026-11-01',endDate:'2026-11-03'},files);
  assert.equal(event.end,'2026-11-04');
  assert.equal(eventsOnDate([event],'2026-11-03').length,1);assert.equal(eventsOnDate([event],'2026-11-04').length,0);
  const overnight={start:'2026-11-01T23:00:00',end:'2026-11-02T01:00:00'};
  assert.equal(eventsOnDate([overnight],'2026-11-01').length,1);assert.equal(eventsOnDate([overnight],'2026-11-02').length,1);
});
test('appointment validation rejects blank titles, invalid ranges, types, and deleted workfiles',()=>{
  for(const values of [{...form,title:' '},{...form,endTime:'08:00'},{...form,time:'25:00'},{...form,fileId:'deleted'},{...form,type:'bad'},{...form,date:'2026-02-30'}])assert.throws(()=>validateAppointment(values,files));
  assert.equal(validateAppointment(form,files,'same-id').id,'same-id');
});
test('search covers customer, file number, notes and location without changing data',()=>{
  const events=normalizeCalendar({files},[{...validateAppointment({...form,notes:'Bring sample swatches'},files)}]);
  assert.equal(filterCalendar(events,'swatches').length,1);
  assert.equal(filterCalendar(events,'123 Test').length,3);
  assert.equal(filterCalendar(events,'A-001','start').length,1);
  assert.equal(filterCalendar(events,'missing').length,0);
});
test('preview appointment CRUD stays separate from workfile dates and survives in-session rerenders',()=>{
  const store=createPreviewAppointments('2026-10-16');const before=JSON.stringify(files);
  const created=validateAppointment(form,files);store.save(created);assert.equal(store.list().length,4);
  store.save({...created,title:'Updated visit'});assert.equal(store.list().filter(e=>e.id===created.id).length,1);
  assert.equal(store.list().find(e=>e.id===created.id).title,'Updated visit');
  const clone=store.list();clone[0].title='Cannot mutate store';assert.notEqual(store.list()[0].title,clone[0].title);
  store.remove(created.id);assert.equal(store.list().length,3);assert.equal(JSON.stringify(files),before);
});
