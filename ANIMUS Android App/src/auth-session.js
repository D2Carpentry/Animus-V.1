export function createAuthSession({provider, fetcher, authUrl = ''}) {
  let user = null;
  let verified = null;
  let busy = false;
  const snapshot = () => ({user:user ? {uid:user.uid,email:user.email || '',emailVerified:user.emailVerified === true} : null, verified, busy});
  async function verify() {
    verified = null;
    if (!user || !authUrl) return snapshot();
    const {token} = await provider.getIdToken({forceRefresh:true});
    if (!token) throw new Error('Google did not return a sign-in token. Sign out and retry.');
    const response = await fetcher(`${authUrl.replace(/\/$/,'')}/session`, {method:'POST',headers:{Authorization:`Bearer ${token}`},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)});
    const result = await response.json().catch(()=>({}));
    if (!response.ok || !result.ok || result.user?.uid !== user.uid || result.role !== 'admin') throw new Error('Administrator access was not confirmed. Your CRM remains disconnected.');
    verified = {uid:result.user.uid,role:'admin'};
    return snapshot();
  }
  return {
    snapshot,
    async restore() { user = (await provider.getCurrentUser()).user; verified=null; return snapshot(); },
    async signIn() {
      if(busy) throw new Error('Sign-in is already in progress.');
      busy=true;verified=null;
      try { user=(await provider.signInWithGoogle()).user; if(!user)throw new Error('Google sign-in was cancelled.');return await verify(); }
      finally {busy=false;}
    },
    verify,
    async signOut() { verified=null;await provider.signOut();user=null;return snapshot(); }
  };
}
