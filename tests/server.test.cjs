'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),net=require('node:net'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..');let server,base;
test.before(async()=>{
  const port=await new Promise(resolve=>{const p=net.createServer();p.listen(0,'127.0.0.1',()=>{const n=p.address().port;p.close(()=>resolve(n));});});
  server=spawn(process.execPath,[path.join(root,'tools/serve.cjs'),String(port)],{stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('確認サーバーが起動しませんでした。')),5000);server.stdout.once('data',()=>{clearTimeout(timer);resolve();});server.once('exit',code=>{clearTimeout(timer);reject(new Error('確認サーバー終了: '+code));});});
  base='http://127.0.0.1:'+port;
});
test.after(()=>server?.kill());
test('split project is served directly without a build step',async()=>{const res=await fetch(base+'/');assert.equal(res.status,200);assert.match(res.headers.get('content-type'),/text\/html/);const text=await res.text();assert.ok(text.includes('NOUMEN'));assert.ok(text.includes('./js/architecture.js'));});
test('every entry-point dependency responds with HTTP 200',async()=>{const html=fs.readFileSync(path.join(root,'index.html'),'utf8');for(const m of html.matchAll(/(?:src|href)="\.\/([^"#]+)"/g)){const r=await fetch(base+'/'+m[1]);assert.equal(r.status,200,m[1]);await r.arrayBuffer();}});
test('all five worlds material requests resolve to real local image files',async()=>{const code=fs.readFileSync(path.join(root,'js/renderer.js'),'utf8');for(const m of code.matchAll(/\['([^']+\.(?:jpg|png))','u\w+',\d+\]/g)){const r=await fetch(base+'/assets/'+m[1],{method:'HEAD'});assert.equal(r.status,200,m[1]);assert.equal(Number(r.headers.get('content-length')),fs.statSync(path.join(root,'assets',m[1])).size);assert.match(r.headers.get('content-type'),/^image\//);}});
test('missing files return a proper 404 rather than the HTML shell',async()=>{const r=await fetch(base+'/assets/not-here.jpg');assert.equal(r.status,404);});
test('the optional server rejects modifying requests',async()=>{const r=await fetch(base+'/',{method:'POST'});assert.equal(r.status,405);assert.equal(r.headers.get('allow'),'GET, HEAD');});
test('the optional server rejects hidden paths and encoded traversal',async()=>{for(const p of ['/.git/config','/%2e%2e%2fsecret']){const r=await fetch(base+p);assert.equal(r.status,403,p);}});
test('HEAD returns headers but never file contents',async()=>{const r=await fetch(base+'/index.html',{method:'HEAD'});assert.equal(r.status,200);assert.ok(Number(r.headers.get('content-length'))>100);assert.equal(await r.text(),'');});
