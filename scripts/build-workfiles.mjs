import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(new URL('../ANIMUS Android App/package.json',import.meta.url));const {build}=require('esbuild');const root=new URL('../',import.meta.url);
await build({entryPoints:[fileURLToPath(new URL('workfiles-table.js',root))],outfile:fileURLToPath(new URL('workfiles-table.bundle.js',root)),bundle:true,format:'iife',platform:'browser',target:'es2022'});
const file=new URL('crm.html',root),html=await readFile(file,'utf8'),css=await readFile(new URL('workfiles-table.css',root),'utf8');const marker=/<!-- workfiles-table-style:start -->[\s\S]*?<!-- workfiles-table-style:end -->/;if(!marker.test(html))throw Error('Workfiles style anchor missing.');await writeFile(file,html.replace(marker,`<!-- workfiles-table-style:start -->\n<style id="workfilesTableStyles">${css}</style>\n<!-- workfiles-table-style:end -->`));
