#!/usr/bin/env node
'use strict';
/** Optional packaging only. GitHub Pages serves the split project directly. */
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const mime={'.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp'};
const assets=Object.fromEntries(fs.readdirSync(path.join(root,'assets')).filter(x=>mime[path.extname(x)]).map(name=>[name,'data:'+mime[path.extname(name)]+';base64,'+fs.readFileSync(path.join(root,'assets',name)).toString('base64')]));
let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
html=html.replace(/<link[^>]*href="\.\/css\/main\.css"[^>]*>/,'<style>'+fs.readFileSync(path.join(root,'css/main.css'),'utf8')+'</style>');
html=html.replace('href="./assets/mark.svg"','href="'+assets['mark.svg']+'"');
const scripts=[];
html=html.replace(/<script[^>]*src="\.\/js\/([^"/]+)"[^>]*><\/script>/g,(_,file)=>{scripts.push('<script>\n'+fs.readFileSync(path.join(root,'js',file),'utf8').replace(/<\/script/gi,'<\\/script')+'\n</script>');return '';});
html=html.replace('</body>',scripts.join('\n')+'\n</body>');
html=html.replace('</head>','<script>globalThis.NOUMEN_ASSETS='+JSON.stringify(assets)+'</script>\n</head>');
const out=path.resolve(process.argv[2]||path.join(root,'..','NOUMEN-preview.html'));fs.writeFileSync(out,html);console.log(out+' ('+html.length+' characters)');
