(function(root){
  'use strict';
  const N=root.Noumen,{catalog,math:M}=N;
  const $=id=>document.getElementById(id);
  const body=document.body,canvas=$('universe'),exhibit=$('exhibit'),scroller=exhibit.querySelector('.exhibit-scroll');
  const reduceQuery=root.matchMedia('(prefers-reduced-motion: reduce)');
  const state={index:-1,focus:-1,isolation:0,hover:-1,time:0,paused:false,reduced:reduceQuery.matches,ready:false,fallback:false,contextLost:false,quality:'standard',camera:null,transition:null,width:innerWidth,height:innerHeight,mobile:innerWidth<=760&&innerHeight>innerWidth};
  let renderer=null,raf=0,lastFrame=0,lastDraw=0,showTimer=0,toastTimer=0,transitionGeneration=0;
  let worlds=[],flatWorlds=new Float32Array(20),hotspots=[];
  let needsDraw=true;
  const qualities=['low','standard','high'],qualityLabels={low:'低',standard:'標準',high:'高'};

  function makeCollection(){
    const nav=$('collection'),points=$('hotspots');
    catalog.forEach((item,index)=>{
      const a=document.createElement('a');a.className='collection-item';a.href='#'+item.id;a.dataset.index=index;
      a.setAttribute('aria-label',item.name+'、'+item.japanese+'。'+item.category+'の展示へ');
      a.innerHTML='<span class="nav-id">'+item.number+'</span><span class="planet-thumb thumb-'+item.id+'" aria-hidden="true"></span><span><span class="nav-name">'+item.name+'</span><span class="nav-type">'+item.category+'</span></span><span class="nav-arrow" aria-hidden="true">↗</span>';
      a.addEventListener('mouseenter',()=>setHover(index));a.addEventListener('mouseleave',()=>setHover(-1));nav.append(a);
      const point=document.createElement('a');point.href='#'+item.id;point.className='hotspot';point.setAttribute('aria-label',item.name+'を観測する');
      point.innerHTML='<small>'+item.number+'</small><span>'+item.name+'</span>';
      point.addEventListener('mouseenter',()=>setHover(index));point.addEventListener('mouseleave',()=>setHover(-1));
      points.append(point);hotspots.push(point);
    });
  }
  function setHover(index){state.hover=index;needsDraw=true;}
  function buildWorlds(){
    worlds=catalog.map(item=>({position:[...(state.mobile?item.mobilePosition:item.position)],radius:state.mobile?item.mobileRadius:item.radius}));
    worlds.forEach((w,i)=>flatWorlds.set([...w.position,w.radius],i*4));
  }
  function cameraFor(index){
    if(index<0)return state.mobile?{position:[0,2.2,21.5],target:[0,1.1,0],fov:49}:{position:[.3,4.7,30.5],target:[.2,1.15,0],fov:46};
    const item=catalog[index],w=worlds[index],c=item.camera,r=w.radius;
    if(state.mobile){
      // The planet is above the reading panel; the stage and the text never share a single fixed layout.
      const distance=index===0?5.3:index===2?6.8:index===4?5.5:index===3?6.6:4.3;
      const vertical=index===0?-1.20:index===2?-1.8:index===4?-1.60:index===3?-1.22:-1.30;
      const cam=M.add(w.position,[r*.06,r*.03,r*distance]);
      return {position:cam,target:M.add(w.position,[index===2?-.35*r:0,vertical*r,0]),fov:47};
    }
    const position=M.add(w.position,[Math.sin(c.yaw)*c.distance*r,c.pitch*r,Math.cos(c.yaw)*c.distance*r]);
    return {position,target:M.add(w.position,M.scale(c.offset,r)),fov:c.fov};
  }
  function updateHotspots(){
    if(state.index>=0||!state.camera)return;
    const safeBottom=state.height-(state.mobile?180:190);
    hotspots.forEach((el,i)=>{
      const w=worlds[i],item=catalog[i];
      let point=M.add(w.position,[item.label[0]*w.radius,item.label[1]*w.radius,0]);
      // Keep the ring label separate from its forward arc.
      if(state.mobile){
        if(i===0)point=M.add(w.position,[-.10*w.radius,-1.2*w.radius,0]);
        if(i===1)point=M.add(w.position,[.15*w.radius,-1.25*w.radius,0]);
        if(i===2)point=M.add(w.position,[-1.30*w.radius,.20*w.radius,0]);
        if(i===3)point=M.add(w.position,[.35*w.radius,-1.35*w.radius,0]);
        if(i===4)point=M.add(w.position,[-.25*w.radius,-1.4*w.radius,0]);
      }
      const p=M.project(point,state.camera,state.width,state.height);
      el.style.left=M.clamp(p.x,55,state.width-60)+'px';
      el.style.top=M.clamp(p.y,state.mobile?305:180,safeBottom)+'px';
      el.style.visibility=p.z>0?'visible':'hidden';
    });
  }
  function updateReadHint(){const hint=$('read-hint');hint.hidden=state.index<0||scroller.scrollHeight<=scroller.clientHeight+12||scroller.scrollTop+scroller.clientHeight>=scroller.scrollHeight-18;}
  function populate(index){
    const item=catalog[index];
    $('exhibit-number').textContent=item.number;$('exhibit-category').textContent=item.classification;
    $('exhibit-name').textContent=item.name;$('exhibit-japanese').textContent=item.japanese+' / '+item.category;
    $('exhibit-title').textContent=state.mobile?item.title.replace('\n',''):item.title;
    $('exhibit-description').textContent=item.description;$('exhibit-observation').textContent=item.observation;$('exhibit-note').textContent=item.note;
    $('exhibit-facts').replaceChildren(...item.facts.map(([key,value])=>{const wrap=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=key;dd.textContent=value;wrap.append(dt,dd);return wrap;}));
    $('scene-index-number').textContent=item.number;$('scene-caption').textContent=item.classification+' / '+item.name;
    exhibit.classList.toggle('is-right',item.side==='right');
    body.classList.toggle('detail-right',item.side==='right');body.classList.toggle('detail-left',item.side==='left');
    document.documentElement.style.setProperty('--accent',item.accent);scroller.scrollTop=0;
    document.title=item.name+' — NOUMEN 深宙観測博物館';requestAnimationFrame(updateReadHint);
    $('previous').setAttribute('aria-label','前の天体 '+catalog[(index+4)%5].name+'へ');
    $('next').setAttribute('aria-label','次の天体 '+catalog[(index+1)%5].name+'へ');
  }
  function toast(message,duration=3800){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,duration);}
  function navigate(index,instant=false){
    if(index===state.index&&state.ready&&!instant)return;
    const generation=++transitionGeneration;
    clearTimeout(showTimer);exhibit.classList.remove('visible');
    const oldIndex=state.index;state.index=index;state.hover=-1;
    const detail=index>=0;
    body.classList.toggle('is-detail',detail);body.classList.toggle('is-overview',!detail);
    $('overview-copy').inert=detail;$('hotspots').inert=detail;
    $('overview-copy').setAttribute('aria-hidden',String(detail));$('hotspots').setAttribute('aria-hidden',String(detail));
    for(const id of ['back-button','scene-index','scene-caption','exhibit-arrows'])$(id).hidden=!detail;
    const target=cameraFor(index),from=state.camera||target;
    const duration=instant||state.reduced?0:oldIndex<0||index<0?2300:1900;
    state.focus=detail?index:oldIndex;
    state.transition={from:{position:[...from.position],target:[...from.target],fov:from.fov},to:target,start:performance.now(),duration,fromIsolation:state.isolation,toIsolation:detail?1:0};
    document.querySelectorAll('.collection-item').forEach((el,i)=>{if(i===index)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
    if(detail){
      const swap=()=>{
        if(generation!==transitionGeneration)return;
        populate(index);exhibit.hidden=false;
        if(state.reduced||instant)exhibit.classList.add('visible');else requestAnimationFrame(()=>{if(generation===transitionGeneration)exhibit.classList.add('visible');});
        $('announcer').textContent=catalog[index].name+'、'+catalog[index].japanese+'。'+catalog[index].category+'の展示。';
      };
      if(instant||state.reduced||oldIndex<0)swap();else showTimer=setTimeout(swap,360);
      $('current-context').textContent='OBSERVATION '+catalog[index].number+' / 05';
      if(state.mobile){
        const active=document.querySelector('.collection-item[data-index="'+index+'"]');
        $('collection').scrollTo({left:active.offsetLeft-10,behavior:state.reduced?'instant':'smooth'});
      }
    }else{
      body.classList.remove('detail-left','detail-right');exhibit.hidden=true;
      document.title='NOUMEN — 深宙観測博物館';$('current-context').innerHTML='THE COLLECTION <span class="meta-divider">/</span> 5 WORLDS';
      $('announcer').textContent='五つの天体がある惑星系の全体展示。';
      document.documentElement.style.setProperty('--accent','#bcc9c6');
    }
    if(state.fallback)updateFallback();
    needsDraw=true;startLoop();
  }
  function fromHash(instant=false){
    const id=location.hash.slice(1).toLowerCase();const index=catalog.findIndex(item=>item.id===id);
    navigate(index,instant);
  }
  function setHash(index){const hash=index<0?'overview':catalog[index].id;if(location.hash==='#'+hash)navigate(index);else location.hash=hash;}
  function updateFallback(){
    const img=$('fallback-image'),name=state.index<0?'overview':catalog[state.index].id;
    img.src=N.assetUrl('fallback-'+name+(state.mobile?'-mobile':'')+'.jpg');img.hidden=false;
    img.alt=state.index<0?'惑星系全体の静止画':catalog[state.index].name+'の展示静止画';
  }
  function fallback(error){
    console.warn('[NOUMEN] Static exhibition fallback:',error?.message||error);
    state.fallback=true;state.ready=true;state.transition=null;canvas.hidden=true;
    state.camera=cameraFor(state.index);updateFallback();updateHotspots();
    body.classList.remove('is-loading');$('render-status').innerHTML='<i></i> STILL VIEW';
    $('quality').disabled=true;$('pause').disabled=true;
    toast(location.protocol==='file:'?'この環境では静止画展示を表示しています。3D版はHTTPサーバー経由で開いてください。':'この端末では静止画展示を表示しています。天体の選択と解説は引き続きご覧いただけます。',8000);
  }
  function updatePause(){
    body.classList.toggle('is-paused',state.paused);$('pause').setAttribute('aria-pressed',String(state.paused));
    $('pause').setAttribute('aria-label',state.paused?'天体の動きを再開':'天体の動きを一時停止');
    $('pause-label').textContent=state.paused?'再開':'一時停止';$('pause').querySelector('.pause-icon').textContent=state.paused?'▷':'Ⅱ';
    if(!state.fallback)$('render-status').innerHTML='<i></i> '+(state.paused?'STILLNESS':'OBSERVING');
    needsDraw=true;startLoop();
  }
  function resize(){
    state.width=$('museum').clientWidth;state.height=$('museum').clientHeight;const portrait=state.width<=760&&state.height>state.width;const changed=state.mobile!==portrait;state.mobile=portrait;
    buildWorlds();if(renderer)renderer.resize(state.width,state.height,state.mobile);
    state.camera=cameraFor(state.index);state.transition=null;state.isolation=state.index<0?0:1;state.focus=state.index;
    if(state.index>=0&&changed)populate(state.index);
    updateHotspots();updateReadHint();if(state.fallback)updateFallback();needsDraw=true;startLoop();
  }
  function frame(now){
    raf=0;if(!state.ready||document.hidden||state.contextLost)return;
    const delta=lastFrame?Math.min((now-lastFrame)/1000,.06):0;lastFrame=now;
    const animating=!!state.transition;
    if(!state.paused&&!state.fallback){const motionRate=state.reduced?.45:2.1;state.time+=delta*motionRate;}
    if(state.transition){
      const t=state.transition,p=t.duration?M.clamp((now-t.start)/t.duration):1,e=M.ease(p);
      state.camera={position:M.mix(t.from.position,t.to.position,e),target:M.mix(t.from.target,t.to.target,e),fov:t.from.fov+(t.to.fov-t.from.fov)*e};
      state.isolation=t.fromIsolation+(t.toIsolation-t.fromIsolation)*M.ease(M.clamp(p*1.32));
      needsDraw=true;
      if(p>=1){state.transition=null;state.focus=state.index;state.isolation=state.index<0?0:1;}
    }
    // Conservative rendering budget on phones. Rendering still advances at a measured cadence.
    const interval=state.mobile?1000/30:1000/45;
    if(now-lastDraw>=interval||needsDraw){
      if(renderer&&!state.fallback){
        let camera=state.camera;
        // Sub-pixel optical drift, disabled by pause or reduced-motion preferences.
        if(!state.reduced&&!state.paused&&!animating){
          const r=state.index<0?.048:worlds[state.index].radius*.013;
          camera={...camera,position:M.add(camera.position,[Math.sin(state.time*.095)*r,Math.sin(state.time*.07)*r*.6,0])};
        }
        renderer.render({camera,time:state.time,worlds:flatWorlds,focus:state.focus,isolation:state.isolation,hover:state.hover});
      }
      updateHotspots();lastDraw=now;needsDraw=false;
    }
    if(state.transition||(!state.paused&&!state.fallback))startLoop();
  }
  function startLoop(){if(!raf&&!document.hidden&&state.ready&&!state.contextLost)raf=requestAnimationFrame(frame);}
  function pick(event){
    if(state.index>=0||!state.ready)return;
    const rect=canvas.getBoundingClientRect(),x=(event.clientX-rect.left)/rect.width*2-1,y=1-(event.clientY-rect.top)/rect.height*2;
    const basis=M.cameraBasis(state.camera.position,state.camera.target),f=Math.tan(state.camera.fov*Math.PI/360);
    const dir=M.normalize(M.add(basis.forward,M.add(M.scale(basis.right,x*f*rect.width/rect.height),M.scale(basis.up,y*f))));
    let best=Infinity,index=-1;
    worlds.forEach((w,i)=>{const t=M.raySphere(state.camera.position,dir,w.position,w.radius*(i===4?1.68:1.12));if(t<best){index=i;best=t;}});
    if(index>=0)setHash(index);
  }
  function listen(){
    addEventListener('hashchange',()=>fromHash());
    addEventListener('resize',resize);root.visualViewport?.addEventListener('resize',resize);
    canvas.addEventListener('click',pick);scroller.addEventListener('scroll',updateReadHint,{passive:true});
    $('previous').addEventListener('click',()=>setHash((state.index+4)%5));$('next').addEventListener('click',()=>setHash((state.index+1)%5));
    $('pause').addEventListener('click',()=>{state.paused=!state.paused;updatePause();});
    $('quality').addEventListener('click',()=>{
      state.quality=qualities[(qualities.indexOf(state.quality)+1)%qualities.length];renderer?.setQuality(state.quality);
      $('quality').querySelector('span').textContent=qualityLabels[state.quality];$('quality').setAttribute('aria-label','描画品質：'+qualityLabels[state.quality]+'。クリックで変更');
      needsDraw=true;startLoop();toast('描画品質：'+qualityLabels[state.quality],1600);
    });
    const dialog=$('about-dialog');
    $('about-open').addEventListener('click',()=>dialog.showModal());$('about-close').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
    addEventListener('keydown',event=>{
      if(dialog.open||event.altKey||event.ctrlKey||event.metaKey)return;
      if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
      if(event.key==='Escape'&&state.index>=0){event.preventDefault();setHash(-1);$('back-button').blur();}
      if(event.key==='ArrowRight'){event.preventDefault();setHash(state.index<0?0:(state.index+1)%5);}
      if(event.key==='ArrowLeft'){event.preventDefault();setHash(state.index<0?4:(state.index+4)%5);}
    });
    reduceQuery.addEventListener('change',e=>{state.reduced=e.matches;if(e.matches&&state.transition)state.transition.duration=0;updatePause();});
    document.addEventListener('visibilitychange',()=>{lastFrame=0;if(document.hidden){cancelAnimationFrame(raf);raf=0;}else{needsDraw=true;startLoop();}});
  }
  async function init(){
    makeCollection();buildWorlds();state.camera=cameraFor(-1);listen();updatePause();fromHash(true);
    try{
      renderer=new N.UniverseRenderer(canvas,{
        onProgress:value=>$('loading-progress').style.width=Math.round(value*100)+'%',
        onContextLost:()=>{state.contextLost=true;cancelAnimationFrame(raf);raf=0;updateFallback();toast('描画の接続が一時的に失われました。復元を試みています。',6000);},
        onContextRestored:()=>{state.contextLost=false;$('fallback-image').hidden=true;resize();toast('3D展示を復元しました。');}
      });
      renderer.resize(state.width,state.height,state.mobile);await renderer.init();state.ready=true;
      state.camera=cameraFor(state.index);state.transition=null;state.isolation=state.index<0?0:1;state.focus=state.index;
      renderer.render({camera:state.camera,time:0,worlds:flatWorlds,focus:state.focus,isolation:state.isolation});
      updateHotspots();body.classList.remove('is-loading');needsDraw=true;startLoop();
    }catch(error){fallback(error);}
  }
  // Non-invasive diagnostics for verification. No user data, storage or telemetry.
  root.NOUMEN_DIAGNOSTICS=Object.freeze({
    get state(){return {index:state.index,ready:state.ready,fallback:state.fallback,contextLost:state.contextLost,paused:state.paused,quality:state.quality,mobile:state.mobile,isolation:state.isolation,transitioning:!!state.transition,canvas:[canvas.width,canvas.height],time:state.time};},
    capture:()=>renderer?.capture(),
    get renderInfo(){return renderer?{version:'1.2.0',programs:renderer.programs.length,fractureTriangles:(renderer.geometry?.vertices||0)/3,architectureTriangles:(renderer.structureGeometry?.vertices||0)/3,architectureModules:renderer.structureGeometry?.modules||0,shadowSize:renderer.structureShadowTarget?.width||0,atlasGradientFiltering:renderer.hasDerivatives&&renderer.hasTextureGrad}:null;},
    get camera(){return state.camera?JSON.parse(JSON.stringify(state.camera)):null;}
  });
  init();
})(globalThis);

