import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyLiveAccess} from '../scripts/live-preflight.mjs';
const origin='https://animus-v-1.pages.dev';
async function secure(url,init={}){
  if(url.includes('/health')&&!url.includes('/api/'))return Response.json({ok:true});
  if(init.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':'https://localhost'}});
  if(url===origin+'/crm')return new Response(null,{status:303,headers:{Location:origin+'/signin/?returnTo=%2Fcrm'}});
  return Response.json({ok:false},{status:401});
}
test('internal live packaging verifies deployed API, static, CORS and backup protections',async()=>{const result=await verifyLiveAccess({fetcher:secure});assert.equal(result.checks.length,9);assert.equal(result.backupConnected,true);});
test('live packaging rejects exposed or unavailable APIs and broken backup access',async()=>{for(const status of [200,503])await assert.rejects(verifyLiveAccess({fetcher:async()=>new Response(null,{status})}),/Live build blocked/);await assert.rejects(verifyLiveAccess({fetcher:(url,init)=>url.includes('workers.dev')?Response.json({ok:false}):secure(url,init)}),/backup service/);});
