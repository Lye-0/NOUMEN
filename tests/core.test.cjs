'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
require('../js/catalog.js');require('../js/math.js');require('../js/architecture-shaders.js');require('../js/shaders.js');
const {catalog,math:M,shaders}=globalThis.Noumen;
const root=path.resolve(__dirname,'..');
test('five unique worlds, with complete Japanese museum records',()=>{
  assert.equal(catalog.length,5);assert.equal(new Set(catalog.map(x=>x.id)).size,5);
  for(const w of catalog){for(const key of ['id','name','japanese','category','classification','title','description','observation','note'])assert.ok(w[key]?.length,key);assert.equal(w.facts.length,3);assert.match(w.description,/[ぁ-んァ-ン一-龯]/);assert.ok(w.radius>0&&w.mobileRadius>0);assert.equal(w.position.length,3);assert.equal(w.mobilePosition.length,3);}
});
test('each world has an individually directed camera',()=>{assert.equal(new Set(catalog.map(x=>JSON.stringify(x.camera))).size,5);assert.deepEqual(new Set(catalog.map(x=>x.side)),new Set(['left','right']));});
test('vector operations and normalization are stable',()=>{assert.deepEqual(M.add([1,2,3],[3,2,1]),[4,4,4]);assert.deepEqual(M.cross([1,0,0],[0,1,0]),[0,0,1]);assert.deepEqual(M.normalize([0,0,0]),[0,0,0]);assert.ok(Math.abs(M.dot(M.normalize([2,3,4]),M.normalize([2,3,4]))-1)<1e-12);});
test('camera basis is orthonormal and points at its target',()=>{const b=M.cameraBasis([0,3,12],[1,0,0]);for(const v of Object.values(b))assert.ok(Math.abs(Math.hypot(...v)-1)<1e-10);assert.ok(Math.abs(M.dot(b.right,b.forward))<1e-10);assert.ok(Math.abs(M.dot(b.up,b.forward))<1e-10);});
test('projection matches centered and offset world coordinates',()=>{const camera={position:[0,0,10],target:[0,0,0],fov:60};let p=M.project([0,0,0],camera,1200,800);assert.equal(p.x,600);assert.equal(p.y,400);assert.ok(M.project([1,0,0],camera,1200,800).x>600);assert.ok(M.project([0,1,0],camera,1200,800).y<400);});
test('ray picking rejects misses and handles inside-sphere origins',()=>{assert.equal(M.raySphere([0,0,5],[0,0,-1],[0,0,0],1),4);assert.equal(M.raySphere([0,0,0],[1,0,0],[0,0,0],2),2);assert.equal(M.raySphere([0,0,5],[0,1,0],[0,0,0],1),Infinity);});
test('cinematic interpolation is monotonic, bounded and smooth at endpoints',()=>{assert.equal(M.ease(0),0);assert.equal(M.ease(1),1);let previous=0;for(let i=0;i<=100;i++){const x=M.ease(i/100);assert.ok(x>=previous-1e-12&&x<=1+1e-12);previous=x;}assert.deepEqual(M.mix([1,2],[3,4],.5),[2,3]);});
test('HTML, styles, scripts and images are separate local assets',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');assert.doesNotMatch(html,/<style\b|<script(?![^>]*\bsrc=)[^>]*>/i);
  for(const m of html.matchAll(/(?:src|href)="\.\/([^"#]+)"/g))assert.ok(fs.existsSync(path.join(root,m[1])),m[1]);
  assert.doesNotMatch(html,/(?:src|href)="https?:/);assert.ok(fs.existsSync(path.join(root,'.nojekyll')));assert.ok(!fs.existsSync(path.join(root,'.github')));
});
test('all document controls referenced literally by the app exist',()=>{const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');for(const m of app.matchAll(/\$\('([^']+)'\)/g))assert.ok(html.includes(`id="${m[1]}"`),m[1]);});
test('shaders implement real ray/solid intersections, not 2D planet images',()=>{for(const name of ['sphere','oblateHit','annulus','planetColor','sunGlow'])assert.ok(shaders.fragment.includes(name+'('));assert.ok(shaders.fragment.includes('uniform vec4 uWorlds[5]'));assert.doesNotMatch(shaders.fragment,/https?:/);});
test('static fallback artwork exists for all six exhibitions',()=>{for(const id of ['overview',...catalog.map(x=>x.id)])for(const suffix of ['','-mobile'])assert.ok(fs.statSync(path.join(root,'assets','fallback-'+id+suffix+'.jpg')).size>5000,id+suffix);});

test('GLSL smoothstep uses defined increasing numeric edges',()=>{for(const m of shaders.fragment.matchAll(/smoothstep\(\s*([.\d]+)\s*,\s*([.\d]+)\s*,/g))assert.ok(Number(m[1])<Number(m[2]),m[0]);});
