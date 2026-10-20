// The capability stays in memory during exchange, then only an HttpOnly cookie remains.
let token=location.hash.slice(1),accessId='';
if(location.hash)history.replaceState(null,'',location.pathname);
async function request(action){
  const body={action};if(action==='session'&&token)body.token=token;if(action==='pdf')body.accessId=accessId;
  const response=await fetch('/client-access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),credentials:'same-origin',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(45000)});
  if(!response.ok){let result;try{result=await response.json();}catch{}throw Object.assign(new Error(result?.error||'Please try again in a moment.'),{status:response.status});}
  return response;
}
export async function loadCustomer(){const response=await request('session');const result=await response.json();token='';accessId=result.accessId;return result;}
export async function loadPdf(){return (await request('pdf')).arrayBuffer();}
