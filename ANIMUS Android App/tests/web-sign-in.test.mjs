import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWebProvider,signInError} from '../web-sign-in/provider.js';
import {createAuthSession} from '../src/auth-session.js';

const config={projectId:'animus-b5c5d',authDomain:'animus-b5c5d.firebaseapp.com',appId:'1:68885962142:web:test',apiKey:'public-test-identifier'};
function fixture(){
  const calls=[];let changed;
  const user={uid:'synthetic-owner',email:'owner@example.test',emailVerified:true,accessToken:'never-display-this'};
  const auth={currentUser:null,authStateReady:async()=>calls.push('ready')};
  const sdk={
    inMemoryPersistence:{type:'NONE'},browserPopupRedirectResolver:{},
    initializeApp(value,name){calls.push(['app',value,name]);return {};},
    initializeAuth(app,options){calls.push(['auth',options]);return auth;},
    onAuthStateChanged(value,callback){changed=callback;return ()=>calls.push('unsubscribed');},
    GoogleAuthProvider:class{setCustomParameters(value){calls.push(['parameters',value]);}},
    async signInWithPopup(value,provider){calls.push('popup');auth.currentUser=user;changed(user);return {user};},
    async getIdToken(value,forceRefresh){calls.push(['token',forceRefresh]);return 'header-token-only';},
    async signOut(){auth.currentUser=null;changed(null);}
  };
  return {sdk,calls,auth,user,change(user){auth.currentUser=user;changed(user);}};
}
test('web adapter initializes only in-memory auth and projects user fields without credentials',async()=>{
  const f=fixture();let changes=0;
  const provider=await createWebProvider({sdk:f.sdk,config,onIdentityChanged:()=>changes++});
  assert.deepEqual(f.calls[1],['auth',{persistence:f.sdk.inMemoryPersistence,popupRedirectResolver:f.sdk.browserPopupRedirectResolver}]);
  assert.deepEqual(await provider.getCurrentUser(),{user:null});
  const result=await provider.signInWithGoogle();assert.equal(result.user.uid,'synthetic-owner');assert.ok(!JSON.stringify(result).includes('never-display-this'));
  assert.equal(changes,1);assert.deepEqual(f.calls.find(value=>value[0]==='parameters'),['parameters',{prompt:'select_account'}]);
  assert.equal((await provider.getIdToken({forceRefresh:true})).token,'header-token-only');assert.deepEqual(f.calls.at(-1),['token',true]);
  await provider.signOut();assert.deepEqual(await provider.getCurrentUser(),{user:null});await assert.rejects(provider.getIdToken(),/Sign in/);
  provider.dispose();assert.ok(f.calls.includes('unsubscribed'));
});
test('web adapter rejects unexpected Firebase projects before initializing anything',async()=>{
  for(const extra of [{projectId:'other'},{authDomain:'evil.test'},{appId:'1:123:web:test'},{apiKey:''}]){
    const f=fixture();await assert.rejects(createWebProvider({sdk:f.sdk,config:{...config,...extra}}),/not configured/);assert.equal(f.calls.length,0);
  }
});
test('raw OAuth error details are never returned to the page',async()=>{
  assert.equal(signInError({code:'auth/popup-closed-by-user'}).message,'Google sign-in cancelled.');
  const f=fixture();f.sdk.signInWithPopup=async()=>{throw {code:'unknown',message:'private-token',credential:'private-token'};};
  const provider=await createWebProvider({sdk:f.sdk,config});
  await assert.rejects(provider.signInWithGoogle(),error=>!error.message.includes('private-token')&&error.message==='Google sign-in could not finish. Please retry.');
});
test('a late verification response cannot restore an administrator grant after sign-out',async()=>{
  let resolveResponse,started;
  const ready=new Promise(resolve=>started=resolve);
  const provider={getCurrentUser:async()=>({user:{uid:'owner'}}),signInWithGoogle:async()=>({user:{uid:'owner'}}),getIdToken:async()=>({token:'synthetic'}),signOut:async()=>{}};
  const session=createAuthSession({provider,authUrl:'https://auth.test',fetcher:()=>{started();return new Promise(resolve=>resolveResponse=resolve);}});
  const signingIn=session.signIn();await ready;await session.signOut();resolveResponse(Response.json({ok:true,user:{uid:'owner'},role:'admin'}));
  await assert.rejects(signingIn,/Account changed/);assert.equal(session.snapshot().verified,null);assert.equal(session.snapshot().user,null);
});
test('web test entry has no customer-data calls or analytics and uses the pinned verifier',async()=>{
  const source=await readFile(new URL('../web-sign-in/main.js',import.meta.url),'utf8');
  assert.ok(source.includes('https://animus-app-auth.d2carpentryanddesign.workers.dev'));
  assert.ok(!/\/api\/(dashboard|expenses|receipt)|firebase\/(firestore|analytics)|localStorage|sessionStorage/.test(source));
  const builder=await readFile(new URL('../scripts/build-web-sign-in.mjs',import.meta.url),'utf8');
  assert.ok(builder.includes('Unexpected non-authentication Firebase dependency'));
});
