function publicUser(user) {
  return user?{uid:user.uid,email:user.email||'',emailVerified:user.emailVerified===true}:null;
}

export function signInError(error) {
  const messages={
    'auth/popup-closed-by-user':'Google sign-in cancelled.',
    'auth/cancelled-popup-request':'Google sign-in cancelled.',
    'auth/popup-blocked':'The browser blocked the Google sign-in window. Allow pop-ups for this page and retry.',
    'auth/unauthorized-domain':'This website is not authorized for Google sign-in.',
    'auth/network-request-failed':'Google sign-in could not connect. Check your connection and retry.',
    'auth/too-many-requests':'Google has temporarily limited sign-in attempts. Please try later.'
  };
  return new Error(messages[error?.code]||'Google sign-in could not finish. Please retry.');
}

export async function createWebProvider({sdk,config,onIdentityChanged=()=>{}}) {
  if(config?.projectId!=='animus-b5c5d'||config?.authDomain!=='animus-b5c5d.firebaseapp.com'||!/^1:68885962142:web:[a-z0-9]+$/i.test(config?.appId||'')||!config?.apiKey)throw new Error('ANIMUS browser sign-in is not configured.');
  const app=sdk.initializeApp(config,'animus-web-sign-in-test');
  // Never initialize the default IndexedDB/localStorage persistence first.
  const auth=sdk.initializeAuth(app,{persistence:sdk.inMemoryPersistence,popupRedirectResolver:sdk.browserPopupRedirectResolver});
  await auth.authStateReady();
  let identity=auth.currentUser?.uid||null;
  let busy=false;
  const unsubscribe=sdk.onAuthStateChanged(auth,user=>{
    const next=user?.uid||null;
    if(next!==identity){identity=next;onIdentityChanged();}
  });
  return {
    async getCurrentUser(){return {user:publicUser(auth.currentUser)};},
    async getIdToken({forceRefresh=false}={}) {
      const user=auth.currentUser;
      if(!user)throw new Error('Sign in with Google first.');
      try{return {token:await sdk.getIdToken(user,forceRefresh)};}catch(error){throw signInError(error);}
    },
    async signInWithGoogle() {
      if(busy)throw new Error('Google sign-in is already in progress.');
      busy=true;
      try {
        const provider=new sdk.GoogleAuthProvider();
        provider.setCustomParameters({prompt:'select_account'});
        const result=await sdk.signInWithPopup(auth,provider);
        return {user:publicUser(result.user)};
      }catch(error){throw signInError(error);}finally{busy=false;}
    },
    async signOut(){onIdentityChanged();try{await sdk.signOut(auth);}catch{throw new Error('Sign-out could not finish. Please retry.');}},
    dispose(){unsubscribe();onIdentityChanged();}
  };
}
