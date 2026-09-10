#!/usr/bin/env node
'use strict';
/** Zero-dependency local static server. Not required by GitHub Pages. */
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const port=Number(process.argv[2]||8000);
if(!Number.isInteger(port)||port<1||port>65535){console.error('ポート番号は1〜65535の整数で指定してください。');process.exit(1);}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.cjs':'text/plain; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.md':'text/plain; charset=utf-8'};
const server=http.createServer((req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'});res.end();return;}
  let pathname;
  try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end('Bad request');return;}
  if(pathname.includes('\0')||pathname.split(/[\\/]/).some(s=>s.startsWith('.')&&s!=='.nojekyll')){res.writeHead(403);res.end('Forbidden');return;}
  let file=path.resolve(root,'.'+pathname);
  if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);res.end('Forbidden');return;}
  fs.stat(file,(error,stat)=>{
    if(error){res.writeHead(404);res.end('Not found');return;}
    if(stat.isDirectory())file=path.join(file,'index.html');
    fs.stat(file,(error,stat)=>{
      if(error||!stat.isFile()){res.writeHead(404);res.end('Not found');return;}
      res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
      if(req.method==='HEAD'){res.end();return;}
      const stream=fs.createReadStream(file);stream.on('error',()=>res.destroy());stream.pipe(res);
    });
  });
});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`ポート ${port} は使用中です。別の番号を指定してください。`:error.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`NOUMEN → http://127.0.0.1:${port}\n終了: Ctrl+C`));
