import {createLiveApi} from './live-api.mjs';
import {compactApprovedActivity,compactionForm} from './activity-compaction.mjs';
const guard=createLiveApi();
export const onRequest=context=>{context.data??={};return guard({...context,next:async request=>{
  if(request.method==='GET')return new Response(compactionForm,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  return compactApprovedActivity({...context,request});
}});};
