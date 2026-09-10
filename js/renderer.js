(function(root){
  'use strict';
  const N=root.Noumen=root.Noumen||{};
  const {cameraBasis,project}=N.math;
  function assetUrl(name){return root.NOUMEN_ASSETS?.[name]||'./assets/'+name;}
  N.assetUrl=assetUrl;
  const RESOURCES=[
    ['sky.jpg','uSky',2048],['worlds-atlas.jpg','uSurfaces',4096],
    ['lacuna-albedo.jpg','uRock',4096],['lacuna-relief.png','uRelief',2048],
    ['gemina-albedo.jpg','uGeminaAlbedo',4096],['gemina-relief.png','uGeminaRelief',2048],
    ['gemina-clouds.jpg','uClouds',4096]
  ];
  class UniverseRenderer{
    constructor(canvas,{onProgress=()=>{},onContextLost=()=>{},onContextRestored=()=>{}}={}){
      this.canvas=canvas;this.onProgress=onProgress;this.onContextLost=onContextLost;this.onContextRestored=onContextRestored;
      this.gl=canvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'high-performance',preserveDrawingBuffer:true})||canvas.getContext('experimental-webgl',{alpha:false,antialias:false,preserveDrawingBuffer:true});
      if(!this.gl)throw new Error('このブラウザではWebGLを利用できません。');
      this.lost=false;this.destroyed=false;this.quality='standard';this.mobile=false;this.width=1;this.height=1;
      this.maxTextureSize=this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE);this.maxRenderbuffer=this.gl.getParameter(this.gl.MAX_RENDERBUFFER_SIZE);
      this.maxAttributes=this.gl.getParameter(this.gl.MAX_VERTEX_ATTRIBS);
      this.textures=[];this.programs=[];this.cleanup=[];this.targets=[];
      this.configureExtensions();
      const lost=e=>{e.preventDefault();this.lost=true;this.forgetGPU();onContextLost();};
      const restored=()=>{this.lost=false;this.init().then(onContextRestored).catch(onContextLost);};
      canvas.addEventListener('webglcontextlost',lost);canvas.addEventListener('webglcontextrestored',restored);
      this.cleanup.push(()=>canvas.removeEventListener('webglcontextlost',lost),()=>canvas.removeEventListener('webglcontextrestored',restored));
    }
    configureExtensions(){
      this.hasDerivatives=!!this.gl.getExtension('OES_standard_derivatives');
      this.hasTextureGrad=!!this.gl.getExtension('EXT_shader_texture_lod');
      this.shaderPrefix=this.hasDerivatives&&this.hasTextureGrad?'#extension GL_OES_standard_derivatives : enable\n#extension GL_EXT_shader_texture_lod : enable\n#define ATLAS_GRAD\n':'';
      this.anisotropy=this.gl.getExtension('EXT_texture_filter_anisotropic')||this.gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
    }
    compile(type,source){
      const gl=this.gl,s=gl.createShader(type);if(!s)throw new Error('描画プログラムを作成できませんでした。');
      gl.shaderSource(s,source);gl.compileShader(s);
      if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const e=gl.getShaderInfoLog(s);gl.deleteShader(s);throw new Error('Shader compilation failed: '+e);}return s;
    }
    createProgram(vertex,fragment,names){
      const gl=this.gl,vs=this.compile(gl.VERTEX_SHADER,vertex),fs=this.compile(gl.FRAGMENT_SHADER,fragment),program=gl.createProgram();
      gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS)){const e=gl.getProgramInfoLog(program);gl.deleteProgram(program);throw new Error('Program linking failed: '+e);}
      const uniforms=Object.fromEntries(names.map(name=>[name,gl.getUniformLocation(program,name)]));
      const obj={program,uniforms};this.programs.push(obj);return obj;
    }
    async image(file){
      return new Promise((resolve,reject)=>{const image=new Image();const timer=setTimeout(()=>reject(new Error(file+' の読み込みが完了しませんでした。')),60000);
        image.onload=()=>{clearTimeout(timer);resolve(image);};image.onerror=()=>{clearTimeout(timer);reject(new Error(file+' を読み込めませんでした。'));};image.src=assetUrl(file);
      });
    }
    uploadTexture(image,unit,cap){
      const gl=this.gl;let source=image;
      const limit=Math.min(this.maxTextureSize,this.mobile?2048:cap);
      if(Math.max(image.width,image.height)>limit){const ratio=limit/Math.max(image.width,image.height),cv=document.createElement('canvas');cv.width=Math.max(1,Math.round(image.width*ratio));cv.height=Math.max(1,Math.round(image.height*ratio));cv.getContext('2d').drawImage(image,0,0,cv.width,cv.height);source=cv;}
      const texture=gl.createTexture();this.textures[unit]=texture;gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,gl.NONE);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,source);
      const pot=n=>(n&(n-1))===0,canMip=pot(source.width)&&pot(source.height);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,canMip?gl.REPEAT:gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,canMip?gl.LINEAR_MIPMAP_LINEAR:gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      if(canMip)gl.generateMipmap(gl.TEXTURE_2D);
      if(this.anisotropy)gl.texParameterf(gl.TEXTURE_2D,this.anisotropy.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(4,gl.getParameter(this.anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    }
    async init(){
      const gl=this.gl;this.releaseGPU();this.configureExtensions();this.onProgress(.05);
      this.main=this.createProgram(N.shaders.vertex,this.shaderPrefix+N.shaders.fragment,['uResolution','uCamera','uForward','uRight','uUp','uFov','uTime','uWorlds[0]','uSky','uSurfaces','uGeminaAlbedo','uGeminaRelief','uClouds','uFracture','uFractureRange','uArchitecture','uArchitectureRange','uStructureShadow','uShadowTexel','uFocus','uIsolation','uHover','uExposure']);
      this.rock=this.createProgram(N.geologyShaders.vertex,N.geologyShaders.fragment,['uCamera','uForward','uRight','uUp','uFov','uAspect','uTime','uCenter','uRadius','uRotation','uRock','uRelief','uDepthRange']);
      this.structure=this.createProgram(N.architectureShaders.vertex,N.architectureShaders.fragment,['uCamera','uForward','uRight','uUp','uFov','uAspect','uCenter','uRadius','uDepthRange','uStructureShadow','uShadowTexel']);
      this.shadow=this.createProgram(N.architectureShaders.shadowVertex,N.architectureShaders.shadowFragment,[]);
      this.post=this.createProgram(N.shaders.vertex,N.postShader,['uScene','uResolution']);
      this.quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
      this.onProgress(.24);
      let loaded=0;
      await Promise.all(RESOURCES.map(async([file,name,cap],unit)=>{const img=await this.image(file);if(this.destroyed)return;this.uploadTexture(img,unit,cap);this.onProgress(.25+(++loaded/RESOURCES.length)*.55);}));
      if(this.destroyed)return;
      if(!this.geometry){const height=await this.image('lacuna-height.png');this.geometry=N.geology.createGeometry(height);}
      this.geometryBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.geometryBuffer);gl.bufferData(gl.ARRAY_BUFFER,this.geometry.data,gl.STATIC_DRAW);
      this.geometryAttributes=[['aPosition',3,0],['aNormal',3,3],['aTangent',3,6],['aLocal',3,9],['aKind',1,12]].map(([name,size,offset])=>({location:gl.getAttribLocation(this.rock.program,name),size,offset}));
      if(!this.structureGeometry)this.structureGeometry=N.architecture.createGeometry();
      this.structureBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.structureBuffer);gl.bufferData(gl.ARRAY_BUFFER,this.structureGeometry.data,gl.STATIC_DRAW);
      this.structureAttributes=[['aPosition',3,0],['aNormal',3,3],['aKind',1,6],['aSeed',1,7]].map(([name,size,offset])=>({location:gl.getAttribLocation(this.structure.program,name),size,offset}));
      gl.useProgram(this.structure.program);gl.uniform1i(this.structure.uniforms.uStructureShadow,2);
      gl.useProgram(this.main.program);
      for(const [name,unit] of [['uSky',0],['uSurfaces',1],['uGeminaAlbedo',4],['uGeminaRelief',5],['uClouds',6],['uFracture',7],['uArchitecture',3],['uStructureShadow',2]])gl.uniform1i(this.main.uniforms[name],unit);
      gl.useProgram(this.rock.program);gl.uniform1i(this.rock.uniforms.uRock,2);gl.uniform1i(this.rock.uniforms.uRelief,3);
      gl.useProgram(this.post.program);gl.uniform1i(this.post.uniforms.uScene,0);
      this.resize(this.width,this.height,this.mobile);this.onProgress(1);
    }
    destroyTarget(t){if(!t)return;const gl=this.gl;gl.deleteTexture(t.texture);gl.deleteFramebuffer(t.framebuffer);if(t.depth)gl.deleteRenderbuffer(t.depth);}
    createTarget(width,height,depth){
      const gl=this.gl,texture=gl.createTexture(),framebuffer=gl.createFramebuffer();
      gl.activeTexture(gl.TEXTURE7);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
      let rb=null;if(depth){rb=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,rb);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,width,height);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,rb);}
      if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE){this.destroyTarget({texture,framebuffer,depth:rb});throw new Error('描画用バッファーを確保できませんでした。');}
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);return {texture,framebuffer,depth:rb,width,height};
    }
    setQuality(quality){if(!['low','standard','high'].includes(quality))return;this.quality=quality;this.resize(this.width,this.height,this.mobile);}
    resize(width,height,mobile=false){
      this.width=Math.max(1,width);this.height=Math.max(1,height);this.mobile=mobile;
      const budgets=mobile?{low:390000,standard:920000,high:1550000}:{low:850000,standard:2400000,high:4800000};
      const device=Math.min(root.devicePixelRatio||1,this.quality==='high'?2:1.5);
      const scale=Math.min(device,Math.sqrt(budgets[this.quality]/(this.width*this.height)),Math.min(this.maxRenderbuffer,this.maxTextureSize)/Math.max(this.width,this.height));
      const w=Math.max(1,Math.round(this.width*scale)),h=Math.max(1,Math.round(this.height*scale));
      if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
      if(this.main&&(!this.fractureTarget||this.fractureTarget.width!==w||this.fractureTarget.height!==h)){
        this.destroyTarget(this.fractureTarget);this.destroyTarget(this.sceneTarget);this.destroyTarget(this.architectureTarget);
        this.architectureTarget=this.createTarget(w,h,true);
        this.fractureTarget=this.createTarget(w,h,true);this.sceneTarget=this.createTarget(w,h,false);
      }
      if(this.main){
        const shadowSize=Math.min(this.maxRenderbuffer,this.maxTextureSize,this.quality==='low'?512:mobile?(this.quality==='high'?2048:1024):(this.quality==='high'?4096:2048));
        if(!this.structureShadowTarget||this.structureShadowTarget.width!==shadowSize){
          this.destroyTarget(this.structureShadowTarget);
          this.structureShadowTarget=this.createTarget(shadowSize,shadowSize,true);
          const gl=this.gl;gl.activeTexture(gl.TEXTURE7);gl.bindTexture(gl.TEXTURE_2D,this.structureShadowTarget.texture);
          // Packed depth must never be linearly interpolated; filtering is performed on shadow comparisons.
          gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
          this.shadowDirty=true;
        }
      }
      this.gl.viewport(0,0,w,h);
    }
    quadFor(obj){const gl=this.gl;for(let i=0;i<this.maxAttributes;i++)gl.disableVertexAttribArray(i);gl.useProgram(obj.program);gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);const p=gl.getAttribLocation(obj.program,'aPosition');gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,2,gl.FLOAT,false,0,0);}
    cameraUniforms(u,camera,basis){const gl=this.gl;gl.uniform3fv(u.uCamera,camera.position);gl.uniform3fv(u.uForward,basis.forward);gl.uniform3fv(u.uRight,basis.right);gl.uniform3fv(u.uUp,basis.up);gl.uniform1f(u.uFov,Math.tan(camera.fov*Math.PI/360));}
    renderStructureShadow(){
      if(!this.shadowDirty||!this.structureShadowTarget)return;
      const gl=this.gl,t=this.structureShadowTarget;
      gl.bindFramebuffer(gl.FRAMEBUFFER,t.framebuffer);gl.viewport(0,0,t.width,t.height);
      gl.clearColor(1,1,1,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.disable(gl.BLEND);
      gl.useProgram(this.shadow.program);
      for(let i=0;i<this.maxAttributes;i++)gl.disableVertexAttribArray(i);
      gl.bindBuffer(gl.ARRAY_BUFFER,this.structureBuffer);
      const p=gl.getAttribLocation(this.shadow.program,'aPosition');gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,3,gl.FLOAT,false,32,0);
      gl.drawArrays(gl.TRIANGLES,0,this.structureGeometry.vertices);
      this.shadowDirty=false;
    }
    render({camera,time,worlds,focus=-1,isolation=0,hover=-1}){
      if(this.lost||this.destroyed||!this.main||!this.fractureTarget)return;
      const gl=this.gl,basis=cameraBasis(camera.position,camera.target),w=this.canvas.width,h=this.canvas.height;
      if(isolation<.999||focus===4)this.renderStructureShadow();
      for(let i=0;i<this.textures.length;i++){gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,this.textures[i]);}
      const center=worlds.slice(4,7),radius=worlds[7],distance=Math.hypot(...camera.position.map((x,i)=>x-center[i]));
      const range=[Math.max(.02,distance-radius*1.75),distance+radius*1.75];
      gl.viewport(0,0,w,h);gl.bindFramebuffer(gl.FRAMEBUFFER,this.fractureTarget.framebuffer);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      if(isolation<.999||focus===1){
        gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);gl.useProgram(this.rock.program);
        const u=this.rock.uniforms;this.cameraUniforms(u,camera,basis);
        gl.uniform1f(u.uAspect,w/h);gl.uniform1f(u.uTime,time);gl.uniform3fv(u.uCenter,center);gl.uniform1f(u.uRadius,radius);gl.uniform2fv(u.uDepthRange,range);
        const az=-.27,ay=.18+time*.0024,ca=Math.cos(az),sa=Math.sin(az),cy=Math.cos(ay),sy=Math.sin(ay);
        gl.uniformMatrix3fv(u.uRotation,false,new Float32Array([ca*cy,sa*cy,-sy,-sa,ca,0,ca*sy,sa*sy,cy]));
        for(let i=0;i<this.maxAttributes;i++)gl.disableVertexAttribArray(i);
        gl.bindBuffer(gl.ARRAY_BUFFER,this.geometryBuffer);
        for(const a of this.geometryAttributes)if(a.location>=0){gl.enableVertexAttribArray(a.location);gl.vertexAttribPointer(a.location,a.size,gl.FLOAT,false,52,a.offset*4);}
        gl.drawArrays(gl.TRIANGLES,0,this.geometry.vertices);
      }
      const architectureCenter=worlds.slice(16,19),architectureRadius=worlds[19];
      const architectureDistance=Math.hypot(...camera.position.map((x,i)=>x-architectureCenter[i]));
      const architectureRange=[Math.max(.02,architectureDistance-architectureRadius*2.1),architectureDistance+architectureRadius*2.1];
      gl.bindFramebuffer(gl.FRAMEBUFFER,this.architectureTarget.framebuffer);
      gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      if(isolation<.999||focus===4){
        gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);
        gl.useProgram(this.structure.program);const a=this.structure.uniforms;this.cameraUniforms(a,camera,basis);
        gl.uniform1f(a.uAspect,w/h);gl.uniform3fv(a.uCenter,architectureCenter);gl.uniform1f(a.uRadius,architectureRadius);gl.uniform2fv(a.uDepthRange,architectureRange);
        gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,this.structureShadowTarget.texture);gl.uniform1f(a.uShadowTexel,1/this.structureShadowTarget.width);
        for(let i=0;i<this.maxAttributes;i++)gl.disableVertexAttribArray(i);
        gl.bindBuffer(gl.ARRAY_BUFFER,this.structureBuffer);
        for(const attr of this.structureAttributes)if(attr.location>=0){gl.enableVertexAttribArray(attr.location);gl.vertexAttribPointer(attr.location,attr.size,gl.FLOAT,false,32,attr.offset*4);}
        gl.drawArrays(gl.TRIANGLES,0,this.structureGeometry.vertices);
      }
      gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);
      gl.bindFramebuffer(gl.FRAMEBUFFER,this.sceneTarget.framebuffer);this.quadFor(this.main);
      gl.activeTexture(gl.TEXTURE7);gl.bindTexture(gl.TEXTURE_2D,this.fractureTarget.texture);
      gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,this.architectureTarget.texture);
      gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,this.structureShadowTarget.texture);
      const u=this.main.uniforms;this.cameraUniforms(u,camera,basis);
      gl.uniform2f(u.uResolution,w,h);gl.uniform1f(u.uTime,time);gl.uniform4fv(u['uWorlds[0]'],worlds);gl.uniform2fv(u.uFractureRange,range);gl.uniform2fv(u.uArchitectureRange,architectureRange);gl.uniform1f(u.uShadowTexel,1/this.structureShadowTarget.width);
      gl.uniform1f(u.uFocus,focus);gl.uniform1f(u.uIsolation,isolation);gl.uniform1f(u.uHover,hover);gl.uniform1f(u.uExposure,1.0);
      gl.drawArrays(gl.TRIANGLES,0,6);
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);this.quadFor(this.post);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.sceneTarget.texture);gl.uniform2f(this.post.uniforms.uResolution,w,h);gl.drawArrays(gl.TRIANGLES,0,6);
    }
    project(point,camera){return project(point,camera,this.width,this.height);}
    capture(){try{return this.canvas.toDataURL('image/jpeg',.94);}catch{return null;}}
    forgetGPU(){
      // Context loss already invalidates every GPU handle. Do not delete handles
      // from the previous context after restoration; only retain CPU geometry.
      this.textures=[];this.programs=[];
      for(const key of ['quad','geometryBuffer','structureBuffer','architectureTarget','structureShadowTarget','fractureTarget','sceneTarget','main','rock','structure','shadow','post'])this[key]=null;
      this.shadowDirty=true;
    }
    releaseGPU(){const gl=this.gl;this.textures.forEach(t=>gl.deleteTexture(t));this.textures=[];this.programs.forEach(p=>gl.deleteProgram(p.program));this.programs=[];if(this.quad)gl.deleteBuffer(this.quad);if(this.geometryBuffer)gl.deleteBuffer(this.geometryBuffer);if(this.structureBuffer)gl.deleteBuffer(this.structureBuffer);this.destroyTarget(this.architectureTarget);this.destroyTarget(this.structureShadowTarget);this.architectureTarget=null;this.structureShadowTarget=null;this.destroyTarget(this.fractureTarget);this.destroyTarget(this.sceneTarget);this.fractureTarget=null;this.sceneTarget=null;this.main=null;}
    destroy(){this.destroyed=true;this.cleanup.forEach(fn=>fn());this.releaseGPU();this.geometry=null;this.structureGeometry=null;}
  }
  N.UniverseRenderer=UniverseRenderer;
})(globalThis);

