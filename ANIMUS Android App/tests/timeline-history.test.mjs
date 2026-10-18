import test from 'node:test';
import assert from 'node:assert/strict';
import {loadCloudHandler} from './load-cloud-handler.mjs';
const {mergeTimeline}=await loadCloudHandler('dashboard','export {mergeTimeline};');
test('timeline merge collapses identical deserialized objects, not distinct events or IDs',()=>{
  const event={at:'2026-10-17T10:00:00Z',text:'Synthetic update'};
  const differentTime={...event,at:'2026-10-17T10:00:01Z'};
  const differentId={...event,id:'separate-event'};
  const result=mergeTimeline([event,'Legacy event'],[structuredClone(event),{text:event.text,at:event.at},'Legacy event',differentTime,differentId]);
  assert.deepEqual(result,[event,'Legacy event',differentTime,differentId]);
});
test('repeated cloud round trips do not multiply timeline history',()=>{
  let timeline=[{at:'2026-10-17T10:00:00Z',text:'Synthetic update'},'Legacy event'];
  for(let index=0;index<25;index++)timeline=mergeTimeline(timeline,JSON.parse(JSON.stringify(timeline)));
  assert.equal(timeline.length,2);
});
test('large duplicate histories retain each unique complete event in original order',()=>{
  const repeated=Array.from({length:100000},()=>({at:'2026-10-17T10:00:00Z',text:'Synthetic update'}));
  const next={at:'2026-10-17T10:00:01Z',text:'Synthetic update',detail:{before:'old',after:'new'}};
  assert.deepEqual(mergeTimeline(repeated,[next,{...next,detail:{after:'new',before:'old'}}]),[repeated[0],next]);
});
