(function(root){
  'use strict';
  const N=root.Noumen=root.Noumen||{};
  const {cameraBasis,project}=N.math;
  function assetUrl(name){return root.NOUMEN_ASSETS?.[name] || './assets/'+name;}
  N.assetUrl=assetUrl;
  class UniverseRenderer {
    constructor(canvas,{onProgress=()=>{},onContextLost=()=>{},onContextRestored=()=>{}}={}) {
      this.canvas=canvas;this.onProgress=onProgress;this.onContextLost=onContextLost;this.onContextRestored=onContextRestored;
      this.gl=canvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'high-performance',preserveDrawingBuffer:true}) || canvas.getContext('experimental-webgl',{alpha:false,antialias:false,preserveDrawingBuffer:true});
      if(!this.gl)throw new Error('このブラウザではWebGLを利用できません。');
      this.lost=false;this.destroyed=false;this.quality='standard';this.mobile=false;this.width=1;this.height=1;
      this.maxTextureSize=this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE);
      this.textures=[];this.cleanup=[];
      const lost=event=>{event.preventDefault();this.lost=true;onContextLost();};
      const restored=()=>{this.lost=false;this.init().then(onContextRestored).catch(onContextLost);};
      canvas.addEventListener('webglcontextlost',lost);canvas.addEventListener('webglcontextrestored',restored);
      this.cleanup.push(()=>canvas.removeEventListener('webglcontextlost',lost),()=>canvas.removeEventListener('webglcontextrestored',restored));
    }
    compile(type,source){
      const gl=this.gl,shader=gl.createShader(type);if(!shader)throw new Error('描画プログラムを作成できませんでした。');
      gl.shaderSource(shader,source);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
        const message=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw new Error('Shader compilation failed: '+message);
      }
      return shader;
    }
    async init(){
      const gl=this.gl;this.onProgress(.08);
      if(this.program)gl.deleteProgram(this.program);
      if(this.buffer)gl.deleteBuffer(this.buffer);
      this.textures.forEach(t=>gl.deleteTexture(t));this.textures=[];
      const vs=this.compile(gl.VERTEX_SHADER,N.shaders.vertex),fs=this.compile(gl.FRAGMENT_SHADER,N.shaders.fragment);
      const program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
      gl.deleteShader(vs);gl.deleteShader(fs);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Program linking failed: '+gl.getProgramInfoLog(program));
      this.program=program;gl.useProgram(program);this.onProgress(.24);
      this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
      const position=gl.getAttribLocation(program,'aPosition');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
      this.uniforms={};
      for(const name of ['uResolution','uCamera','uForward','uRight','uUp','uFov','uTime','uWorlds[0]','uSky','uSurfaces','uFocus','uIsolation','uHover','uExposure'])this.uniforms[name]=gl.getUniformLocation(program,name);
      const resources=[['sky.jpg','uSky'],['surfaces.jpg','uSurfaces']];
      for(let i=0;i<resources.length;i++){
        const [file,uniform]=resources[i];await this.loadTexture(file,i,uniform);this.onProgress(.4+.28*(i+1));
      }
      gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.clearColor(.02,.03,.04,1);
      this.resize(this.width,this.height,this.mobile);this.onProgress(1);
    }
    loadTexture(file,unit,uniform){
      const gl=this.gl;
      return new Promise((resolve,reject)=>{
        const image=new Image();const timer=setTimeout(()=>reject(new Error(file+' の読み込みが完了しませんでした。')),18000);
        image.onload=()=>{
          clearTimeout(timer);
          try{
            if(this.destroyed){resolve();return;}
            let source=image;
            if(Math.max(image.width,image.height)>this.maxTextureSize){
              const scale=this.maxTextureSize/Math.max(image.width,image.height),c=document.createElement('canvas');
              c.width=Math.floor(image.width*scale);c.height=Math.floor(image.height*scale);c.getContext('2d').drawImage(image,0,0,c.width,c.height);source=c;
            }
            const texture=gl.createTexture();this.textures.push(texture);gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
            gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,source);
            gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
            gl.uniform1i(this.uniforms[uniform],unit);resolve();
          }catch(error){reject(error);}
        };
        image.onerror=()=>{clearTimeout(timer);reject(new Error(file+' を読み込めませんでした。'));};
        image.src=assetUrl(file);
      });
    }
    setQuality(quality){if(!['low','standard','high'].includes(quality))return;this.quality=quality;this.resize(this.width,this.height,this.mobile);}
    resize(width,height,mobile=false){
      this.width=Math.max(1,width);this.height=Math.max(1,height);this.mobile=mobile;
      const budgets=mobile?{low:270000,standard:540000,high:1000000}:{low:620000,standard:1400000,high:2600000};
      const device=Math.min(root.devicePixelRatio||1,this.quality==='high'?2:1.5);
      const scale=Math.min(device,Math.sqrt(budgets[this.quality]/(width*height)));
      this.canvas.width=Math.max(1,Math.round(width*scale));this.canvas.height=Math.max(1,Math.round(height*scale));
      this.gl.viewport(0,0,this.canvas.width,this.canvas.height);
    }
    render({camera,time,worlds,focus=-1,isolation=0,hover=-1}){
      if(this.lost||this.destroyed||!this.program)return;
      const gl=this.gl,u=this.uniforms,basis=cameraBasis(camera.position,camera.target);gl.useProgram(this.program);
      gl.uniform2f(u.uResolution,this.canvas.width,this.canvas.height);
      gl.uniform3fv(u.uCamera,camera.position);gl.uniform3fv(u.uForward,basis.forward);gl.uniform3fv(u.uRight,basis.right);gl.uniform3fv(u.uUp,basis.up);
      gl.uniform1f(u.uFov,Math.tan(camera.fov*Math.PI/360));gl.uniform1f(u.uTime,time);
      gl.uniform4fv(u['uWorlds[0]'],worlds);gl.uniform1f(u.uFocus,focus);gl.uniform1f(u.uIsolation,isolation);gl.uniform1f(u.uHover,hover);gl.uniform1f(u.uExposure,1.8);
      gl.drawArrays(gl.TRIANGLES,0,6);
    }
    project(point,camera){return project(point,camera,this.width,this.height);}
    capture(){try{return this.canvas.toDataURL('image/jpeg',.91);}catch{return null;}}
    destroy(){this.destroyed=true;this.cleanup.forEach(fn=>fn());this.textures.forEach(t=>this.gl.deleteTexture(t));this.gl.deleteBuffer(this.buffer);this.gl.deleteProgram(this.program);}
  }
  N.UniverseRenderer=UniverseRenderer;
})(globalThis);
