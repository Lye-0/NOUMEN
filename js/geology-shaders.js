(function(root){
'use strict';
const N=root.Noumen;
N.geologyShaders={
vertex:`
precision highp float;
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec3 aTangent;
attribute vec3 aLocal;
attribute float aKind;
uniform vec3 uCamera,uRight,uUp,uForward,uCenter;
uniform float uRadius,uFov,uAspect;
uniform mat3 uRotation;
varying vec3 vWorld,vNormal,vTangent,vLocal;
varying float vKind;
void main(){
 vWorld=uCenter+uRotation*aPosition*uRadius;
 vNormal=uRotation*aNormal;vTangent=uRotation*aTangent;vLocal=aLocal;vKind=aKind;
 vec3 q=vWorld-uCamera;vec3 p=vec3(dot(q,uRight),dot(q,uUp),dot(q,uForward));
 gl_Position=vec4(p.x/(uFov*uAspect),p.y/uFov,1.00004*p.z-.0400008,p.z);
}`,
fragment:`
precision highp float;
varying vec3 vWorld,vNormal,vTangent,vLocal;
varying float vKind;
uniform sampler2D uRock,uRelief;
uniform vec3 uCamera,uCenter;
uniform float uTime,uRadius;
uniform vec2 uDepthRange;
const float PI=3.14159265359;
const vec3 SUN=vec3(-.596,.604,.529);
float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float a=.52,v=0.;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.07+vec3(8.7,4.1,13.8);a*=.49;}return v;}
vec2 sphereUV(vec3 p){p=normalize(p);return vec2(fract(atan(p.z,p.x)/(2.*PI)+.5),acos(clamp(p.y,-1.,1.))/PI);}
float sat(float v){return clamp(v,0.,1.);}
void main(){
 vec3 view=normalize(uCamera-vWorld),n=normalize(vNormal),tangent=normalize(vTangent);
 if(!gl_FrontFacing)n=-n;
 vec3 local=vLocal,col;
 if(vKind>3.5){
   vec3 q=normalize(local)*9.0;
   vec3 drift=vec3(fbm(q*.6+7.),fbm(q*.6+21.),fbm(q*.6-3.))-.5;
   vec3 p=q+drift*2.5+vec3(0.,uTime*.005,0.);
   float flow=fbm(p*1.9);
   float small=fbm(p*9.);
   float pool=smoothstep(.38,.63,flow+small*.07);
   float crust=smoothstep(.31,.48,fbm(p*4.3));
   float veins=pow(sat(1.-abs(fbm(p*4.)-.47)*16.),7.);
   float hot=pow(pool,2.5)*(.6+small*.7);
   col=mix(vec3(.032,.0025,.001),vec3(1.4,.13,.007),pool);
   col*=.72+crust*.28;
   col+=vec3(1.6,.78,.13)*hot+vec3(.65,.13,.012)*veins*pool;
   col*=(.70+.30*pow(max(dot(normalize(vNormal),view),0.),.3))*.33;
 }else{
   vec2 uv=sphereUV(local);
   vec3 albedo=pow(texture2D(uRock,uv).rgb,vec3(2.2));
   if(vKind<.5){
     vec2 slope=texture2D(uRelief,uv).rg*2.-1.;
     tangent=normalize(tangent-n*dot(tangent,n));vec3 bitangent=cross(n,tangent);
     n=normalize(n+tangent*slope.x+bitangent*slope.y);
     float diffuse=max(dot(n,SUN),0.);
     float rough=.68+.32*pow(max(dot(view,SUN),0.),2.);
     col=albedo*(.010+diffuse*rough*1.38);
     float facing=sat(dot(normalize(vNormal),SUN)*7.);col*=.16+.84*facing;
     col+=vec3(.035,.008,.001)*sat(dot(n,normalize(uCenter-vWorld)));
   }else{
     float band=fbm(local*vec3(26.,18.,24.)+vec3(2.,4.,7.));
     float fine=noise(local*240.);
     float depth=sat((1.-length(local))/.30);
     vec3 rock=mix(vec3(.032,.028,.022),vec3(.086,.077,.063),band)*(.65+fine*.35);
     vec3 tangent=normalize(cross(n,abs(n.y)>.95?vec3(1,0,0):vec3(0,1,0)));
     vec3 bitangent=cross(n,tangent);
     float h=fbm(local*90.);
     float dx=fbm((local+tangent*.002)*90.)-h,dy=fbm((local+bitangent*.002)*90.)-h;
     n=normalize(n-tangent*dx*1.8-bitangent*dy*1.8);
     float diffuse=max(dot(n,SUN),0.);
     float cavity=1.-depth*.45;
     float heat=sat(dot(n,normalize(uCenter-vWorld)))*(.40+depth*.5);
     col=rock*(.009+diffuse*1.0)*cavity;
     col+=rock*vec3(2.3,.32,.035)*heat;
     float veins=pow(sat(1.-abs(fbm(local*38.)-.50)*14.),9.);
     // The break stays rock-black; incandescence is confined to hot seams near the mantle.
     col+=vec3(.70,.072,.004)*veins*pow(depth,2.)*.48;
     if(vKind>1.5&&vKind<2.5)col+=vec3(.12,.012,.001)*(fbm(local*45.)*.5+.5);
     if(vKind>2.5){col=albedo*(.012+diffuse*1.08)+albedo*vec3(1.3,.18,.018)*heat;}
   }
 }
 float distanceToEye=length(vWorld-uCamera);
 float depth=.02+.96*clamp((distanceToEye-uDepthRange.x)/(uDepthRange.y-uDepthRange.x),0.,1.);
 // Gamma-companded radiance preserves shadow precision in portable RGBA8; alpha is local depth.
 gl_FragColor=vec4(pow(clamp(col*.25,0.,1.),vec3(1./2.2)),depth);
}`
};
N.postShader=`
precision highp float;
varying vec2 vUv;
uniform sampler2D uScene;
uniform vec2 uResolution;
float luma(vec3 c){return dot(c,vec3(.299,.587,.114));}
void main(){
 vec2 px=1./uResolution;vec3 c=texture2D(uScene,vUv).rgb;
 vec3 nw=texture2D(uScene,vUv+vec2(-1,1)*px).rgb;
 vec3 ne=texture2D(uScene,vUv+vec2(1,1)*px).rgb;
 vec3 sw=texture2D(uScene,vUv+vec2(-1,-1)*px).rgb;
 vec3 se=texture2D(uScene,vUv+vec2(1,-1)*px).rgb;
 float m=luma(c),a=luma(nw),b=luma(ne),d=luma(sw),e=luma(se);
 float lo=min(m,min(min(a,b),min(d,e))),hi=max(m,max(max(a,b),max(d,e)));
 vec2 dir=vec2(-((a+b)-(d+e)),(a+d)-(b+e));
 float reduce=max((a+b+d+e)*.03125,.0078125);
 dir=clamp(dir/(min(abs(dir.x),abs(dir.y))+reduce),vec2(-6.),vec2(6.))*px;
 vec3 rgbA=.5*(texture2D(uScene,vUv+dir*(1./3.-.5)).rgb+texture2D(uScene,vUv+dir*(2./3.-.5)).rgb);
 vec3 rgbB=rgbA*.5+.25*(texture2D(uScene,vUv-dir*.5).rgb+texture2D(uScene,vUv+dir*.5).rgb);
 float lumB=luma(rgbB);vec3 filtered=(lumB<lo||lumB>hi)?rgbA:rgbB;
 // Filter resolved geometric edges only; preserve the fine photographic texture elsewhere.
 float edge=smoothstep(.045,.15,hi-lo);
 vec3 result=mix(c,filtered,edge*.84);
 gl_FragColor=vec4(result,1.);
}`;
})(globalThis);

