import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require = createRequire(new URL('../ANIMUS Android App/package.json',import.meta.url));
const {build} = require('esbuild');
await build({entryPoints:[fileURLToPath(new URL('../workfile-detail-icons.mjs',import.meta.url))],outfile:fileURLToPath(new URL('../workfile-detail-icons.bundle.js',import.meta.url)),bundle:true,minify:true,format:'iife',platform:'browser',nodePaths:[fileURLToPath(new URL('../ANIMUS Android App/node_modules',import.meta.url))],target:'es2020'});
