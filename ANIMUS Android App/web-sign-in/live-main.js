import {initializeApp} from 'firebase/app';
import {initializeAuth,inMemoryPersistence,browserPopupRedirectResolver,GoogleAuthProvider,signInWithPopup,getIdToken,signOut,onAuthStateChanged} from 'firebase/auth';
import {createWebProvider} from './provider.js';
import {firebaseConfig} from './firebase-config.js';
const $=id=>document.getElementById(id);
let provider;
const returnTo=new URLSearchParams(location.search).get('returnTo')||'/crm';
let destination;try{destination=new URL(returnTo,location.origin);}catch{destination=new URL('/crm',location.origin);}
if(destination.origin!==location.origin||!returnTo.startsWith('/')||returnTo.startsWith('//')||destination.pathname.startsWith('/api/')||destination.pathname.startsWith('/signin'))destination.href=new URL('/crm',location.origin).href;
for(const name of [...destination.searchParams.keys()])if(!['view','fileId','tab'].includes(name))destination.searchParams.delete(name);
$('signIn').onclick=async()=>{
  $('signIn').disabled=true;$('error').hidden=true;$('status').textContent='Signing in...';
  try{
    provider??=await createWebProvider({sdk:{initializeApp,initializeAuth,inMemoryPersistence,browserPopupRedirectResolver,GoogleAuthProvider,signInWithPopup,getIdToken,signOut,onAuthStateChanged},config:firebaseConfig});
    await provider.signInWithGoogle();const {token}=await provider.getIdToken({forceRefresh:true});
    const response=await fetch('/api/session',{method:'POST',headers:{Authorization:`Bearer ${token}`},credentials:'same-origin',redirect:'error',cache:'no-store'});
    const result=await response.json();if(!response.ok||result.user?.role!=='admin')throw Error(result.error||'Administrator access could not be confirmed.');
    location.replace(destination.href);
  }catch(error){$('status').textContent='Sign-in not completed.';$('error').textContent=error.message;$('error').hidden=false;}
  finally{$('signIn').disabled=false;}
};
$('openCrm').onclick=()=>location.assign(destination.href);
$('signOut').onclick=async()=>{try{const response=await fetch('/api/session',{method:'DELETE',credentials:'same-origin',redirect:'error'});if(!response.ok)throw Error();await provider?.signOut();location.reload();}catch{$('error').textContent='Sign-out could not finish. Retry.';$('error').hidden=false;}};
void fetch('/api/session',{credentials:'same-origin',cache:'no-store',redirect:'error'}).then(async response=>{
  const result=await response.json();if(response.ok&&result.user?.role==='admin'){$('status').textContent='Administrator signed in.';$('email').textContent=result.user.email;$('email').hidden=false;$('openCrm').hidden=false;$('signOut').hidden=false;$('signIn').hidden=true;}
}).catch(()=>{});
