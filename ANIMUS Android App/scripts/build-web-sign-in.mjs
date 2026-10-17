import {mkdir,copyFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {build} from 'esbuild';

const root=fileURLToPath(new URL('../',import.meta.url));
const out=path.resolve(process.env.ANIMUS_WEB_OUT_DIR||path.join(root,'../auth-preview'));
await mkdir(out,{recursive:true});
for(const [source,target] of [['index.html','index.html'],['sign-in.css','sign-in.css']])await copyFile(path.join(root,'web-sign-in',source),path.join(out,target));
const result=await build({entryPoints:[path.join(root,'web-sign-in/main.js')],bundle:true,format:'iife',platform:'browser',target:'chrome120',minify:true,metafile:true,outfile:path.join(out,'sign-in.js'),legalComments:'eof'});
const inputs=Object.keys(result.metafile.inputs);
if(inputs.some(input=>/firestore|grpc|firebase\/analytics/i.test(input)))throw new Error('Unexpected non-authentication Firebase dependency in browser bundle.');
await writeFile(path.join(out,'build-info.json'),JSON.stringify({mode:'identity-test-only',customerDataConnected:false,firebaseProject:'animus-b5c5d',sdkScope:'app-and-auth-only'},null,2)+'\n');
console.log('Built isolated ANIMUS web sign-in test; no CRM data APIs included.');
