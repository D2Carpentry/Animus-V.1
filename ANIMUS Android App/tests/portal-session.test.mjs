import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../../portal-session.js',import.meta.url),'utf8');
const {createPortalTransport}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('portal operations bind file and revision to the current session, never caller overrides',async()=>{
  let submitted;const api=createPortalTransport(()=>({fileId:'one',revision:4,generation:1}),async(url,options)=>{submitted=JSON.parse(options.body);return Response.json({ok:true});});
  await api('reply',{message:'Test',fileId:'two',revision:99,action:'delete'});
  assert.deepEqual(submitted,{message:'Test',fileId:'one',revision:4,action:'reply'});
});
test('a late workfile response cannot replace another workspace',async()=>{
  let state={fileId:'one',generation:1},finish;
  const api=createPortalTransport(()=>state,()=>new Promise(resolve=>finish=resolve));
  const pending=api('workspace');state={fileId:'two',generation:2};finish(Response.json({customerName:'Old customer'}));
  await assert.rejects(pending,/workfile changed/);
});
test('reopening the same file invalidates older generations including delayed JSON bodies',async()=>{
  let state={fileId:'one',generation:1},finish;
  const api=createPortalTransport(()=>state,async()=>({ok:true,json:()=>new Promise(resolve=>finish=resolve)}));
  const pending=api('workspace');await new Promise(resolve=>setImmediate(resolve));state={fileId:'one',generation:2};finish({old:true});
  await assert.rejects(pending,/workfile changed/);
});
test('missing workfiles fail before network access and API conflicts remain visible',async()=>{
  let requests=0;const missing=createPortalTransport(()=>({fileId:''}),async()=>{requests++;});await assert.rejects(missing('reply'),/Open a workfile/);assert.equal(requests,0);
  const conflict=createPortalTransport(()=>({fileId:'one',generation:1}),async()=>Response.json({error:'Refresh the current version'},{status:409}));await assert.rejects(conflict('reply'),error=>error.status===409&&error.message==='Refresh the current version');
});
