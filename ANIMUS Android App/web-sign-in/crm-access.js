import {initializeApp} from 'firebase/app';
import {initializeAuth,inMemoryPersistence,browserPopupRedirectResolver,GoogleAuthProvider,signInWithPopup,getIdToken,signOut,onAuthStateChanged} from 'firebase/auth';
import {createWebProvider} from './provider.js';
import {firebaseConfig} from './firebase-config.js';
import {createCookieTransport} from './cookie-transport.js';

if(location.origin==='https://animus-v-1.pages.dev'&&!window.AnimusAccess) {
  const fetcher=window.fetch.bind(window);
  let allowed=false,provider,dialog,promptPromise,finishPrompt;
  let initial=check();
  async function check(){try{const response=await fetcher('/api/session',{cache:'no-store',credentials:'same-origin',redirect:'error'});const data=await response.json();allowed=response.ok&&data.ok===true&&data.user?.role==='admin';return allowed;}catch{return false;}}
  async function google(){
    provider??=await createWebProvider({sdk:{initializeApp,initializeAuth,inMemoryPersistence,browserPopupRedirectResolver,GoogleAuthProvider,signInWithPopup,getIdToken,signOut,onAuthStateChanged},config:firebaseConfig});
    await provider.signInWithGoogle();
    const {token}=await provider.getIdToken({forceRefresh:true});
    const response=await fetcher('/api/session',{method:'POST',credentials:'same-origin',headers:{Authorization:`Bearer ${token}`},cache:'no-store',redirect:'error'});
    const result=await response.json();
    if(!response.ok||result.user?.role!=='admin')throw Error(result.error||'Administrator access could not be confirmed.');
    allowed=true;initial=Promise.resolve(true);finishPrompt(true);dialog.close();
    window.dispatchEvent(new Event('animus-signed-in'));
  }
  async function promptSignIn(){
    if(allowed)return true;
    try{if(window.parent!==window&&window.parent.AnimusAccess){const result=await window.parent.AnimusAccess.signIn();allowed=result;initial=Promise.resolve(result);return result;}}catch{}
    if(promptPromise)return promptPromise;
    promptPromise=new Promise(resolve=>{finishPrompt=value=>{promptPromise=null;resolve(value);};});
    const current=promptPromise;
    if(!document.body)await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));
    if(!dialog){
      const style=document.createElement('style');style.textContent='.animus-access{width:min(420px,calc(100% - 24px));box-sizing:border-box;padding:24px;border:1px solid #41454c;border-radius:8px;background:#1c2026;color:#f4f5f7;font:16px Arial,sans-serif}.animus-access::backdrop{background:#000b}.animus-access h2{font-size:22px;margin:0 0 12px;letter-spacing:0}.animus-access p{line-height:1.5;color:#b9c0ca}.animus-access button{min-height:48px;width:100%;padding:10px;margin-top:12px;border:1px solid #464d58;border-radius:6px;background:#252c36;color:#f4f5f7;font:600 16px Arial,sans-serif}.animus-access button[data-google]{background:#2464bd;border-color:#3477d1}.animus-access [role=alert]{color:#ffb2b2;overflow-wrap:anywhere}.animus-access button:focus-visible{outline:3px solid #bb9b5c;outline-offset:3px}';document.head.append(style);
      dialog=document.createElement('dialog');dialog.className='animus-access';dialog.setAttribute('aria-labelledby','animusAccessTitle');dialog.innerHTML='<h2 id="animusAccessTitle">ANIMUS Sign-In</h2><p>Sign in with your company Google account to access the live CRM.</p><button type="button" data-google>Continue with Google</button><button type="button" data-cancel>Cancel</button><p role="alert" hidden></p>';document.body.append(dialog);
      const cancel=()=>{dialog.close();finishPrompt(false);};
      dialog.querySelector('[data-cancel]').onclick=cancel;dialog.oncancel=event=>{event.preventDefault();cancel();};
      dialog.querySelector('[data-google]').onclick=async()=>{const button=dialog.querySelector('[data-google]');const error=dialog.querySelector('[role=alert]');button.disabled=true;error.hidden=true;try{await google();}catch(problem){error.textContent=problem.message;error.hidden=false;}finally{button.disabled=false;}};
    }
    dialog.showModal();dialog.querySelector('[data-google]').focus();return current;
  }
  window.AnimusAccess={signIn:promptSignIn,async signOut(){
    allowed=false;initial=Promise.resolve(false);
    const response=await fetcher('/api/session',{method:'DELETE',credentials:'same-origin',redirect:'error'});
    if(!response.ok)throw Error('Sign-out could not finish. Retry.');
    await provider?.signOut();window.dispatchEvent(new Event('animus-signed-out'));
  }};
  window.fetch=createCookieTransport({fetcher,ensureSession:()=>initial,promptSignIn,invalidate(){allowed=false;initial=Promise.resolve(false);}});
  const addSignOut=()=>{
    const menu=document.getElementById('animusAccountMenu')||document.querySelector('#moreView .tool-list');
    if(!menu||document.getElementById('animusCloudSignOut'))return;
    const button=document.createElement('button');button.id='animusCloudSignOut';button.type='button';button.className='animus-account-action';button.textContent='Sign out';
    button.onclick=async()=>{button.disabled=true;try{await window.AnimusAccess.signOut();location.reload();}catch{button.textContent='Sign-out failed. Retry';}finally{button.disabled=false;}};menu.append(button);
    menuObserver.disconnect();
  };
  const menuObserver=new MutationObserver(addSignOut);menuObserver.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',addSignOut,{once:true});
  // Renew only from the in-memory Google session; never store credentials in JS storage.
  setInterval(async()=>{
    if(!provider||!allowed)return;
    try{const {token}=await provider.getIdToken({forceRefresh:true});const response=await fetcher('/api/session',{method:'POST',credentials:'same-origin',headers:{Authorization:`Bearer ${token}`},redirect:'error'});if(!response.ok){allowed=false;initial=Promise.resolve(false);}}catch{allowed=false;initial=Promise.resolve(false);}
  },40*60*1000);
}
