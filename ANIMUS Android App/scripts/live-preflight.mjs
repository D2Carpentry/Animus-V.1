import {pathToFileURL} from 'node:url';
const origin='https://animus-v-1.pages.dev';
export async function verifyLiveAccess({fetcher=fetch}={}){
  const checks=[];
  for(const path of ['/api/dashboard','/api/expenses','/api/receipt','/api/v2/workfiles','/api/v2/health','/api/session','/crm.js','/mobile-cloud.js','/mobile-document.html']){
    const response=await fetcher(origin+path,{cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(15000)});
    await response.body?.cancel();
    if(response.status!==401)throw Error('Live build blocked: anonymous denial failed for '+path+' ('+response.status+').');
    checks.push({path,status:response.status});
  }
  const write=await fetcher(origin+'/api/dashboard',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',redirect:'manual'});
  await write.body?.cancel();if(write.status!==401)throw Error('Live build blocked: anonymous writes are not denied.');
  const navigation=await fetcher(origin+'/crm',{headers:{Accept:'text/html'},redirect:'manual'});
  await navigation.body?.cancel();if(navigation.status!==303||!navigation.headers.get('Location')?.startsWith(origin+'/signin/'))throw Error('Live build blocked: CRM navigation does not require sign-in.');
  const preflight=await fetcher(origin+'/api/dashboard',{method:'OPTIONS',headers:{Origin:'https://localhost','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type'},redirect:'manual'});
  await preflight.body?.cancel();if(preflight.status!==204||preflight.headers.get('Access-Control-Allow-Origin')!=='https://localhost')throw Error('Live build blocked: native API origin is not supported.');
  const health=await fetcher('https://animus-weekly-backup.d2carpentryanddesign.workers.dev/health',{redirect:'manual'});
  const state=await health.json();if(!health.ok||state.ok!==true)throw Error('Live build blocked: backup service is not connected.');
  return {verifiedAt:new Date().toISOString(),checks,anonymousWritesDenied:true,signInNavigation:true,nativeCors:true,backupConnected:true};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(await verifyLiveAccess(),null,2));
