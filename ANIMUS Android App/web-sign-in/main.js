import {initializeApp} from 'firebase/app';
import {initializeAuth,inMemoryPersistence,browserPopupRedirectResolver,GoogleAuthProvider,signInWithPopup,getIdToken,signOut,onAuthStateChanged} from 'firebase/auth';
import {createIcons,LogIn,LogOut,ShieldCheck} from 'lucide';
import {createWebProvider} from './provider.js';
import {firebaseConfig} from './firebase-config.js';
import {createAuthSession} from '../src/auth-session.js';

const $=id=>document.getElementById(id);
createIcons({icons:{LogIn,LogOut,ShieldCheck}});
let session;
let busy=false;
function render() {
  const state=session?.snapshot();
  $('status').textContent=!state?'Connecting to Google sign-in...':state.verified?'Administrator verified. Live CRM remains disconnected.':state.user?'Google account signed in. Administrator verification is required.':'Signed out.';
  $('email').textContent=state?.user?.email||'';
  $('email').hidden=!state?.user;
  $('signIn').hidden=Boolean(state?.user);
  $('verify').hidden=!state?.user||Boolean(state?.verified);
  $('signOut').hidden=!state?.user;
  for(const id of ['signIn','verify','signOut'])$(id).disabled=busy||!session;
}
async function action(task) {
  if(busy)return;
  busy=true;$('error').hidden=true;render();
  try{await task();}catch(error){$('error').textContent=error.message;$('error').hidden=false;}
  finally{busy=false;render();}
}
async function start() {
  try {
    const provider=await createWebProvider({
      sdk:{initializeApp,initializeAuth,inMemoryPersistence,browserPopupRedirectResolver,GoogleAuthProvider,signInWithPopup,getIdToken,signOut,onAuthStateChanged},
      config:firebaseConfig,
      onIdentityChanged(){
        if(session){session.invalidate();render();void session.restore().then(render).catch(()=>{$('status').textContent='Account changed. Reload this sign-in test.';});}
      }
    });
    session=createAuthSession({provider,fetcher:window.fetch.bind(window),authUrl:'https://animus-app-auth.d2carpentryanddesign.workers.dev'});
    await session.restore();
    $('signIn').onclick=()=>action(()=>session.signIn());
    $('verify').onclick=()=>action(()=>session.verify());
    $('signOut').onclick=()=>action(()=>session.signOut());
    window.addEventListener('pagehide',()=>provider.dispose(),{once:true});
    render();
  }catch{$('status').textContent='Sign-in could not start.';$('error').textContent='Reload this page and check your connection. Live CRM remains disconnected.';$('error').hidden=false;}
}
void start();
