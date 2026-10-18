import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
export async function loadCloudHandler(name,extra=''){
  const file=new URL('../../functions/api/'+name+'.js',import.meta.url);
  const result=await build({stdin:{contents:await readFile(file,'utf8')+'\n'+extra,resolveDir:fileURLToPath(new URL('./',file)),sourcefile:name+'.js'},bundle:true,write:false,format:'esm',platform:'neutral'});
  return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].contents).toString('base64'));
}
