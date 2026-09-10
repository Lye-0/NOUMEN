(function(root){
'use strict';
const N=root.Noumen=root.Noumen||{};
// Identical light-space projection in the depth pass, surface shading and planet shading.
N.structureShadowGLSL=`
uniform sampler2D uStructureShadow;
uniform float uShadowTexel;
vec3 structureLight(){return normalize(vec3(-.596,.604,.529));}
vec3 structureRight(){return normalize(cross(structureLight(),vec3(0.,1.,0.)));}
vec3 structureUp(){return cross(structureRight(),structureLight());}
float readStructureDepth(vec2 uv){return dot(texture2D(uStructureShadow,uv).rgb,vec3(1.,1./255.,1./65025.));}
float structureVisibility(vec3 local,vec3 normal){
 vec2 uv=vec2(dot(local,structureRight()),dot(local,structureUp()))/4.10+.5;
 float depth=.5-dot(local,structureLight())/4.80;
 if(uv.x<=0.||uv.x>=1.||uv.y<=0.||uv.y>=1.)return 1.;
 float bias=.00013+.00075*(1.-abs(dot(normal,structureLight())));
 float sum=0.;
 for(int y=0;y<2;y++)for(int x=0;x<2;x++){
  vec2 offset=(vec2(float(x),float(y))-.5)*uShadowTexel*1.5;
  sum+=step(depth-bias,readStructureDepth(uv+offset));
 }
 return sum*.25;
}
`;
N.architectureShaders={
vertex:`
precision highp float;
attribute vec3 aPosition,aNormal;
attribute float aKind,aSeed;
uniform vec3 uCamera,uCenter,uForward,uRight,uUp;
uniform float uRadius,uFov,uAspect;
varying vec3 vWorld,vNormal,vLocal;
varying float vKind,vSeed;
void main(){
 vLocal=aPosition;vWorld=uCenter+aPosition*uRadius;vNormal=aNormal;vKind=aKind;vSeed=aSeed;
 vec3 q=vWorld-uCamera;vec3 p=vec3(dot(q,uRight),dot(q,uUp),dot(q,uForward));
 gl_Position=vec4(p.x/(uFov*uAspect),p.y/uFov,1.00004*p.z-.0400008,p.z);
}`,
fragment:`
precision highp float;
varying vec3 vWorld,vNormal,vLocal;
varying float vKind,vSeed;
uniform vec3 uCamera,uCenter;
uniform float uRadius;
uniform vec2 uDepthRange;
${N.structureShadowGLSL}
float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float microfacet(vec3 n,vec3 v,vec3 l,float roughness){
 vec3 h=normalize(v+l);float nv=max(dot(n,v),.001),nl=max(dot(n,l),.001),nh=max(dot(n,h),0.);
 float a=roughness*roughness,a2=a*a,d=nh*nh*(a2-1.)+1.;
 float k=(roughness+1.)*(roughness+1.)*.125;
 float g=nv/(nv*(1.-k)+k)*nl/(nl*(1.-k)+k);
 return min(8.,a2*g/(3.14159265*d*d*max(4.*nv*nl,.001)));
}
void main(){
 vec3 origin=(uCamera-uCenter)/uRadius,ray=normalize(vLocal-origin);
 float b=dot(origin,ray),disc=b*b-dot(origin,origin)+1.;
 if(disc>0.){float t=-b-sqrt(disc);if(t>0.&&t<length(vLocal-origin)-.0003)discard;}
 vec3 n=normalize(vNormal);if(!gl_FrontFacing)n=-n;
 vec3 view=normalize(uCamera-vWorld),light=structureLight();
 float nl=max(dot(n,light),0.);
 vec3 metal=vec3(.21,.225,.231);float rough=.45,metallic=.65;
 if(vKind>.5&&vKind<1.5){metal=vec3(.40,.415,.407);rough=.29;metallic=.84;}
 if(vKind>1.5&&vKind<2.5){metal=vec3(.026,.032,.038);rough=.72;metallic=.18;}
 if(vKind>2.5&&vKind<3.5){metal=vec3(.21,.175,.113);rough=.68;metallic=.16;}
 if(vKind>4.5&&vKind<5.5){metal=vec3(.003,.004,.005);rough=.91;metallic=.05;}
 if(vKind>5.5){metal=vec3(.26,.262,.241);rough=.47;metallic=.6;}
 metal*=.68+vSeed*.47;
 // Material microstructure, not a field of painted glowing windows.
 vec3 ap=abs(n);vec2 uv=ap.z>ap.x&&ap.z>ap.y?vLocal.xy:ap.x>ap.y?vLocal.zy:vLocal.xz;
 float grain=hash(vec3(floor(uv*5900.),vSeed));
 float hairline=1.-smoothstep(.010,.035,abs(fract(uv.x*113.+vSeed)-.5));
 metal*=.93+grain*.075;metal*=1.-hairline*.13;
 rough=clamp(rough+(grain-.5)*.065,.20,.95);
 float planetAlong=dot(vLocal,light);float separation=length(vLocal-light*planetAlong);
 float planetShadow=planetAlong<0.?smoothstep(.998,1.011,separation):1.;
 float visibility=structureVisibility(vLocal,n)*planetShadow;
 vec3 halfLight=normalize(view+light);float vh=max(dot(view,halfLight),0.);
 vec3 f0=mix(vec3(.04),metal,metallic),fresnel=f0+(1.-f0)*pow(1.-vh,5.);
 vec3 diffuse=metal*(1.-metallic)/3.14159265;
 vec3 col=(diffuse+fresnel*microfacet(n,view,light,rough))*nl*visibility*2.9;
 float planetshine=max(dot(n,-normalize(vLocal)),0.)/max(dot(vLocal,vLocal),1.);
 col+=metal*(vec3(.011,.013,.016)+vec3(.12,.15,.18)*planetshine*.28);
 if(vKind>3.5&&vKind<4.5)col+=vec3(.74,.36,.10)*(.65+vSeed*.35);
 float depth=.02+.96*clamp((length(vWorld-uCamera)-uDepthRange.x)/(uDepthRange.y-uDepthRange.x),0.,1.);
 gl_FragColor=vec4(pow(clamp(col*.25,0.,1.),vec3(1./2.2)),depth);
}`,
shadowVertex:`
precision highp float;
attribute vec3 aPosition;
void main(){
 vec3 light=normalize(vec3(-.596,.604,.529));
 vec3 right=normalize(cross(light,vec3(0.,1.,0.))),up=cross(right,light);
 gl_Position=vec4(dot(aPosition,right)/2.05,dot(aPosition,up)/2.05,-dot(aPosition,light)/2.40,1.);
}`,
shadowFragment:`
precision highp float;
void main(){
 vec3 encoded=fract(gl_FragCoord.z*vec3(1.,255.,65025.));
 encoded-=encoded.yzz*vec3(1./255.,1./255.,0.);
 gl_FragColor=vec4(encoded,1.);
}`
};
})(globalThis);
