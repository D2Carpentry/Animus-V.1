import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const workspace=new URL('../../',import.meta.url);
const files=new Map([
  ['/auth-preview/', ['auth-preview/index.html','text/html; charset=utf-8']],
  ['/auth-preview/index.html', ['auth-preview/index.html','text/html; charset=utf-8']],
  ['/auth-preview/sign-in.js', ['auth-preview/sign-in.js','text/javascript; charset=utf-8']],
  ['/auth-preview/sign-in.css', ['auth-preview/sign-in.css','text/css; charset=utf-8']],
  ['/assets/animus-sidebar-logo.png', ['assets/animus-sidebar-logo.png','image/png']],
  ['/icon.svg', ['icon.svg','image/svg+xml']]
]);
const server=http.createServer(async(request,response)=>{
  const pathname=new URL(request.url,'http://localhost').pathname;
  const file=files.get(pathname);
  if(!file||!['GET','HEAD'].includes(request.method)){response.writeHead(404);response.end('Not found');return;}
  try {
    const body=await readFile(fileURLToPath(new URL(file[0],workspace)));
    response.writeHead(200,{'Content-Type':file[1],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    response.end(request.method==='HEAD'?undefined:body);
  }catch{response.writeHead(404);response.end('Not found');}
});
server.listen(Number(process.env.PORT||8793),'127.0.0.1',()=>console.log(`Isolated sign-in layout preview: http://localhost:${server.address().port}/auth-preview/`));
