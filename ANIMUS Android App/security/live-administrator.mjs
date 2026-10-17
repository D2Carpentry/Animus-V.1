import {decodeJwt} from 'jose';
import {createAdministratorVerifier} from '../auth-worker/verify.mjs';

function unavailable() {
  return Object.assign(new Error('Account status verification unavailable.'),{status:503});
}
function expired() {
  return Object.assign(new Error('Sign-in expired or revoked.'),{status:401});
}

// Staged only. Signature verification alone cannot detect a disabled account.
export function createLiveAdministratorVerifier({verifyIdentity=createAdministratorVerifier(),fetcher=fetch}={}) {
  return async function verify(request,env) {
    const identity=await verifyIdentity(request,env);
    const apiKey=env.FIREBASE_WEB_API_KEY;
    if(typeof apiKey!=='string'||!/^AIza[A-Za-z0-9_-]{20,100}$/.test(apiKey))throw unavailable();
    const token=(request.headers.get('Authorization')||'').slice(7);
    // Decode only after the canonical verifier has authenticated these bytes.
    const claims=decodeJwt(token);
    const url=new URL('https://identitytoolkit.googleapis.com/v1/accounts:lookup');
    url.searchParams.set('key',apiKey);
    let response,data;
    try {
      response=await fetcher(url.href,{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({idToken:token}),redirect:'manual',cache:'no-store',
        signal:AbortSignal.timeout(5000)
      });
      data=await response.json();
    } catch {throw unavailable();}
    if(!response.ok) {
      const reason=data?.error?.message;
      if(['TOKEN_EXPIRED','USER_DISABLED','USER_NOT_FOUND','INVALID_ID_TOKEN'].includes(reason))throw expired();
      throw unavailable();
    }
    if(!Array.isArray(data?.users)||data.users.length!==1)throw expired();
    const account=data.users[0];
    if(account.disabled===true||account.localId!==identity.uid||account.emailVerified!==true||typeof account.email!=='string'||account.email.toLowerCase()!==identity.email.toLowerCase())throw expired();
    if(account.disabled!==undefined&&typeof account.disabled!=='boolean')throw unavailable();
    const validSince=String(account.validSince??'');
    if(!/^\d+$/.test(validSince)||!Number.isSafeInteger(Number(validSince))||!Number.isInteger(claims.auth_time))throw unavailable();
    if(claims.auth_time<Number(validSince))throw expired();
    return identity;
  };
}
