import { importX509, jwtVerify } from 'jose';

const certificateUrl='https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let certificateCache=null;
let pendingCertificates=null;
async function firebaseKey(header) {
  if(header.alg!=='RS256'||typeof header.kid!=='string'||header.kid.length>200)throw new Error('Invalid token header.');
  if(!certificateCache||certificateCache.expires<=Date.now()){
    if(!pendingCertificates)pendingCertificates=(async()=>{
      const response=await fetch(certificateUrl,{redirect:'error',signal:AbortSignal.timeout(5000)});
      if(!response.ok)throw new Error('Identity verification unavailable.');
      const certificates=await response.json();
      const maxAge=Math.min(3600,Number(response.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1])||300);
      certificateCache={certificates,keys:new Map(),expires:Date.now()+maxAge*1000};
    })().finally(()=>{pendingCertificates=null;});
    await pendingCertificates;
  }
  const pem=Object.hasOwn(certificateCache.certificates,header.kid)&&certificateCache.certificates[header.kid];
  if(typeof pem!=='string')throw new Error('Unknown signing certificate.');
  if(!certificateCache.keys.has(header.kid))certificateCache.keys.set(header.kid,importX509(pem,'RS256'));
  return certificateCache.keys.get(header.kid);
}

export function createAdministratorVerifier(keyResolver=firebaseKey) {
  return async function verify(request,env) {
    const project=env.FIREBASE_PROJECT_ID;
    const email=env.ADMIN_EMAIL?.trim().toLowerCase();
    const uid=env.ADMIN_UID?.trim();
    if(!project||!email||!uid)throw Object.assign(new Error('Administrator verification is not configured.'),{status:503});
    const authorization=request.headers.get('authorization')||'';
    if(authorization.length>8192||!/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(authorization))throw Object.assign(new Error('Sign-in required.'),{status:401});
    let payload;
    try {
      ({payload}=await jwtVerify(authorization.slice(7),keyResolver,{
        algorithms:['RS256'],audience:project,issuer:`https://securetoken.google.com/${project}`,
        requiredClaims:['exp','iat','sub','auth_time'],clockTolerance:0
      }));
      const now=Math.floor(Date.now()/1000);
      if(!Number.isInteger(payload.iat)||payload.iat>now||!Number.isInteger(payload.auth_time)||payload.auth_time>now||payload.auth_time<0||payload.auth_time>payload.iat||payload.iat<0||typeof payload.sub!=='string'||!payload.sub||payload.sub.length>128||Array.isArray(payload.aud)||payload.firebase?.tenant)throw new Error('Invalid identity.');
    } catch {throw Object.assign(new Error('Sign-in expired or invalid.'),{status:401});}
    if(payload.sub!==uid||payload.email_verified!==true||typeof payload.email!=='string'||payload.email.toLowerCase()!==email||payload.firebase?.sign_in_provider!=='google.com')throw Object.assign(new Error('Administrator access required.'),{status:403});
    return {uid:payload.sub,email:payload.email,role:'admin'};
  };
}
