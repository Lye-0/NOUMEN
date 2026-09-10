/* Hybrid 3D renderer: displaced fracture volumes + analytically traced globes, rings and architecture.
   Original high-resolution materials; all lighting is evaluated in linear space. */
(function(root){
  'use strict';
  const N=root.Noumen=root.Noumen||{};
  N.shaders={
    vertex: `attribute vec2 aPosition;
      varying vec2 vUv;
      void main(){vUv=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}`,
    fragment: `
precision highp float;
varying vec2 vUv;
uniform vec2 uResolution;
uniform vec3 uCamera;
uniform vec3 uForward;
uniform vec3 uRight;
uniform vec3 uUp;
uniform float uFov;
uniform float uTime;
uniform vec4 uWorlds[5];
uniform sampler2D uSky;
uniform sampler2D uSurfaces;
uniform sampler2D uGeminaAlbedo;
uniform sampler2D uGeminaRelief;
uniform sampler2D uClouds;
uniform sampler2D uFracture;
uniform vec2 uFractureRange;
uniform sampler2D uArchitecture;
uniform vec2 uArchitectureRange;
uniform float uFocus;
uniform float uIsolation;
uniform float uHover;
uniform float uExposure;
const float PI=3.14159265359;
const float FAR=10000.;
const vec3 SUN=vec3(-.596,.604,.529);
const vec3 RING_SUN=vec3(-.913,-.251,.324);
float sat(float x){return clamp(x,0.,1.);}
float hash(float n){return fract(sin(n)*43758.5453123);}
float hash3(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float noise(vec3 p){
  vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float fbm(vec3 p){return noise(p)*.56+noise(p*2.04+vec3(3.1,8.7,1.))* .28+noise(p*4.13+5.3)*.16;}
mat3 rz(float a){float s=sin(a),c=cos(a);return mat3(c,s,0.,-s,c,0.,0.,0.,1.);}
mat3 ry(float a){float s=sin(a),c=cos(a);return mat3(c,0.,-s,0.,1.,0.,s,0.,c);}
vec2 sphere(vec3 ro,vec3 rd,float r){float b=dot(ro,rd),h=b*b-dot(ro,ro)+r*r;if(h<0.)return vec2(FAR);h=sqrt(h);return vec2(-b-h,-b+h);}
float firstSphere(vec3 ro,vec3 rd,float r){vec2 t=sphere(ro,rd,r);return t.x>.001?t.x:t.y>.001?t.y:FAR;}
vec2 sphereUV(vec3 p){p=normalize(p);return vec2(fract(atan(p.z,p.x)/(2.*PI)+.5),acos(clamp(p.y,-1.,1.))/PI);}
vec3 atlas(vec3 p,float index){
  vec2 uv=sphereUV(p),cell=vec2(mod(index,2.),floor(index/2.));
  // Two-pixel gutters in each 2048 x 1024 tile of a 4096 x 4096 material atlas.
  vec2 span=vec2(2044./4096.,1020./4096.),coord=uv*span+vec2(2./4096.)+cell*vec2(.5,.25);
#ifdef ATLAS_GRAD
  vec2 dx=dFdx(uv),dy=dFdy(uv);
  dx.x-=floor(dx.x+.5);dy.x-=floor(dy.x+.5);
  dx*=span;dy*=span;
  float limit=min(1.,(4./4096.)/max(max(length(dx),length(dy)),.0000001));
  return texture2DGradEXT(uSurfaces,coord,dx*limit,dy*limit).rgb;
#else
  return texture2D(uSurfaces,coord,-1.).rgb;
#endif
}
vec3 surface(vec3 p,float index){return pow(atlas(p,index),vec3(2.2));}
float luminance(vec3 col){return dot(col,vec3(.2126,.7152,.0722));}
vec3 background(vec3 rd){
  vec2 uv=sphereUV(rd);
  vec3 sky=texture2D(uSky,uv).rgb;
  // A small number of resolved stars, independent of the photographic sky texture.
  vec3 grid=rd*650.;vec3 id=floor(grid),f=fract(grid)-.5;
  float seed=hash3(id);float d=length(f);
  float star=(1.-smoothstep(0.,.13,d))*step(.9978,seed)*.55;
  return pow(sky,vec3(2.2))*.48+vec3(.69,.8,.86)*star*.35;
}
vec3 ringNormal(){return normalize(vec3(-.37,.77,.52));}
vec3 structureNormal(float second){return second<.5?normalize(vec3(.35,.14,.925)):normalize(vec3(-.69,.63,.36));}
// Intersect a true finite annular solid (front/back faces and inner/outer cylindrical walls).
float annulus(vec3 ro,vec3 rd,vec3 center,vec3 normal,float ri,float ra,float height,out vec3 hitNormal,out float face){
  vec3 p=ro-center;float a=dot(p,normal),b=dot(rd,normal);float best=FAR;face=0.;hitNormal=normal;
  if(abs(b)>.00001){
    for(int k=0;k<2;k++){
      float signv=k==0?-1.:1.;float t=(height*signv-a)/b;vec3 q=p+rd*t;float radius=length(q-normal*dot(q,normal));
      if(t>.001&&t<best&&radius>ri&&radius<ra){best=t;hitNormal=normal*signv;face=0.;}
    }
  }
  vec3 q=p-normal*a,d=rd-normal*b;float A=dot(d,d),B=dot(q,d);
  if(A>.00001){
    for(int k=0;k<2;k++){
      float rad=k==0?ri:ra;float H=B*B-A*(dot(q,q)-rad*rad);
      if(H>0.){
        for(int j=0;j<2;j++){
          float t=(-B+(j==0?-1.:1.)*sqrt(H))/A;
          if(t>.001&&t<best&&abs(a+b*t)<height){best=t;hitNormal=normalize(q+d*t)*(k==0?-1.:1.);face=1.;}
        }
      }
    }
  }
  return best;
}
vec3 ringData(float rr){
 float u=clamp((rr-1.30)/1.40,0.,1.);
 return texture2D(uSurfaces,vec2((2.+u*2044.)/4096.,.875)).rgb;
}
float ringOpticalDepth(float rr){
 if(rr<1.32||rr>2.67)return 0.;
 float depth=-log(max(1.-ringData(rr).r,.004));
 return depth*smoothstep(1.32,1.35,rr)*(1.-smoothstep(2.62,2.67,rr));
}
float ringAlpha(float rr){return 1.-exp(-ringOpticalDepth(rr));}
float planetShadow(vec3 point,vec3 light,vec3 c,float r){
  vec3 axis=ringNormal(),oc=(point-c)/r;
  oc+=axis*dot(oc,axis)*(1./.931-1.);
  vec3 direction=light+axis*dot(light,axis)*(1./.931-1.);
  float b=dot(oc,direction)/dot(direction,direction);if(b>=0.)return 1.;
  float dist=length(oc-direction*b);
  return smoothstep(.997,1.010,dist);
}
float shadowOnRingPlanet(vec3 p,vec3 light,vec3 center,float radius){
  vec3 n=ringNormal();float dn=dot(light,n);if(abs(dn)<.001)return 1.;
  float t=dot(center-p,n)/dn;
  if(t<.001)return 1.;
  float rad=length(p+light*t-center)/radius;
  return exp(-ringOpticalDepth(rad)/max(abs(dn),.035));
}
vec3 bumpNormal(vec3 n,vec3 local,float index){
  vec3 tangent=normalize(cross(n,abs(n.y)>.9?vec3(1,0,0):vec3(0,1,0)));
  vec3 bitangent=normalize(cross(n,tangent));
  float base=luminance(surface(local,index));
  float x=luminance(surface(normalize(local+tangent*.004),index));
  float y=luminance(surface(normalize(local+bitangent*.004),index));
  float strength=index<.5?.47:index<1.5?.7:index<2.5?.10:.28;
  return normalize(n-tangent*(x-base)*strength*11.-bitangent*(y-base)*strength*11.);
}

const vec3 WARM=vec3(-.65,.56,.514);
const vec3 COOL=vec3(.64,.30,.707);
float cloudDensity(vec3 dir){return texture2D(uClouds,sphereUV(ry(.72+uTime*.015)*normalize(dir))).r;}
float cloudShadow(vec3 point,vec3 light){
  float t=firstSphere(point,light,1.0032);
  if(t>=FAR)return 1.;
  float density=cloudDensity(point+light*t);
  return exp(-density*1.9);
}
float oceanGlint(vec3 n,vec3 view,vec3 light){
  vec3 h=normalize(view+light);float nv=max(dot(n,view),.001),nl=max(dot(n,light),.001);
  float nh=max(dot(n,h),0.),vh=max(dot(view,h),0.);
  float rough=.115,alpha2=pow(rough,4.);
  float denominator=nh*nh*(alpha2-1.)+1.;
  float distribution=alpha2/(PI*denominator*denominator);
  float k=(rough+1.)*(rough+1.)/8.;
  float geometry=nv/(nv*(1.-k)+k)*nl/(nl*(1.-k)+k);
  float fresnel=.020+.980*pow(1.-vh,5.);
  return min(5.,distribution*geometry*fresnel/max(4.*nv,.02));
}
vec3 geminaColor(vec3 world,vec3 normal,vec3 local,vec3 rd,vec3 center,float radius){
  mat3 rotation=ry(.48+uTime*.0105);
  vec3 direction=rotation*local;
  vec2 uv=sphereUV(direction);
  vec3 albedo=pow(texture2D(uGeminaAlbedo,uv).rgb,vec3(2.2));
  vec3 material=texture2D(uGeminaRelief,uv).rgb;
  vec2 slope=material.rg*2.-1.;float land=material.b;
  vec3 tangent=normalize(vec3(-local.z,0.,local.x)),bitangent=cross(normal,tangent);
  vec3 n=normalize(normal+tangent*slope.x+bitangent*slope.y);
  vec3 warm=normalize(WARM),cool=normalize(COOL),view=-rd;
  float a=max(dot(n,warm),0.),b=max(dot(n,cool),0.);
  float sa=cloudShadow(local,warm),sb=cloudShadow(local,cool);
  vec3 warmRadiance=vec3(1.12,1.00,.84)*1.48;
  vec3 coolRadiance=vec3(.60,.76,1.05)*.61;
  vec3 color=albedo*(warmRadiance*a*sa+coolRadiance*b*sb+vec3(.007,.010,.017));
  // Water remains optically smooth, rocks diffuse. The highlight is not painted into the map.
  color+=(1.-land)*(warmRadiance*oceanGlint(normal,view,warm)*sa+coolRadiance*oceanGlint(normal,view,cool)*sb);
  // Clouds occupy their own spherical surface and travel at a different angular velocity.
  float ct=firstSphere((uCamera-center)/radius,rd,1.0032);
  if(ct<FAR){
    vec3 cp=(uCamera-center)/radius+rd*ct,cn=normalize(cp);
    vec3 cloud=texture2D(uClouds,sphereUV(ry(.72+uTime*.015)*cn)).rgb;
    float alpha=1.-exp(-cloud.r*2.5);
    vec3 t=normalize(vec3(-cn.z,0.,cn.x)),bt=cross(cn,t);
    cn=normalize(cn+t*(cloud.g*2.-1.)*.34+bt*(cloud.b*2.-1.)*.34);
    float ca=max(dot(cn,warm),0.),cb=max(dot(cn,cool),0.);
    float thickness=.81+.19*smoothstep(.15,.8,cloud.r);
    vec3 cloudColor=(warmRadiance*ca+coolRadiance*cb)*thickness+vec3(.028,.034,.045);
    color=mix(color,cloudColor,alpha*.96);
  }
  return color;
}
vec3 geminaAtmosphere(vec3 color,vec3 rd,float nearest){
  vec3 center=uWorlds[3].xyz;float radius=uWorlds[3].w;
  vec3 ro=(uCamera-center)/radius;
  vec2 hit=sphere(ro,rd,1.014);
  if(hit.x>=FAR||hit.y<=0.)return color;
  float start=max(hit.x,0.),end=min(hit.y,nearest/radius);
  if(end<=start)return color;
  float stepLength=(end-start)/6.;
  vec3 beta=vec3(.22,.48,1.0),trans=vec3(1.),scatter=vec3(0.);
  for(int j=0;j<6;j++){
    vec3 p=ro+rd*(start+(float(j)+.5)*stepLength);
    float h=max(length(p)-1.,0.);vec3 n=normalize(p);
    float density=exp(-h/.0020)*stepLength*27.;
    float a=smoothstep(-.045,.13,dot(n,normalize(WARM)));
    float b=smoothstep(-.045,.13,dot(n,normalize(COOL)));
    vec3 light=vec3(1.06,.99,.90)*a*.9+vec3(.63,.79,1.08)*b*.45;
    vec3 extinction=exp(-density*beta);
    scatter+=trans*(1.-extinction)*light*.65;
    trans*=extinction;
  }
  return color*trans+scatter;
}
${N.structureShadowGLSL}
vec3 atlasNormal(vec3 n,vec3 tex,float materialIndex,float amount){
 vec3 tangent=normalize(vec3(-n.z,.00001,n.x)),bitangent=cross(n,tangent);
 vec2 slope=atlas(tex,materialIndex).rg*2.-1.;
 return normalize(n+tangent*slope.x*amount+bitangent*slope.y*amount);
}
float dielectricSpecular(vec3 n,vec3 view,vec3 light,float roughness){
 vec3 h=normalize(view+light);
 float nv=max(dot(n,view),.001),nl=max(dot(n,light),.001),nh=max(dot(n,h),0.);
 float alpha=roughness*roughness,a2=alpha*alpha,d=nh*nh*(a2-1.)+1.;
 float k=(roughness+1.)*(roughness+1.)/8.;
 float g=nv/(nv*(1.-k)+k)*nl/(nl*(1.-k)+k);
 float f=.044+.956*pow(1.-max(dot(view,h),0.),5.);
 return min(6.,a2*g*f/(PI*d*d*max(4.*nv,.001)));
}
vec3 ringLocal(vec3 p){
 vec3 n=ringNormal(),x=normalize(cross(n,vec3(0.,0.,1.))),z=cross(x,n);
 return vec3(dot(p,x),dot(p,n),dot(p,z));
}
float oblateHit(vec3 ro,vec3 rd,float r,out vec3 normal,out vec3 local){
 vec3 axis=ringNormal();float flattening=1./.931-1.;
 vec3 o=ro+axis*dot(ro,axis)*flattening,d=rd+axis*dot(rd,axis)*flattening;
 float a=dot(d,d),b=dot(o,d),disc=b*b-a*(dot(o,o)-r*r);
 if(disc<0.)return FAR;
 float near=(-b-sqrt(disc))/a,far=(-b+sqrt(disc))/a,t=near>.001?near:far>.001?far:FAR;
 if(t>=FAR)return FAR;
 local=(ro+rd*t)/r;
 normal=normalize(local+axis*dot(local,axis)*(1./(.931*.931)-1.));
 return t;
}
vec3 planetColor(float index,vec3 world,vec3 normal,vec3 local,vec3 rd,float kind,vec3 center,float radius){
 if(index>2.5&&index<3.5)return geminaColor(world,normal,local,rd,center,radius);
 if(index>.5&&index<1.5)return vec3(0.);
 vec3 view=-rd;
 if(index<.5){
   vec3 tex=ry(.38+uTime*.0048)*local;
   vec3 albedo=surface(tex,0.);
   vec3 material=atlas(tex,1.);
   vec3 n=atlasNormal(normal,tex,1.,.44);
   vec3 light=normalize(vec3(-.87,.41,-.28));
   float nl=max(dot(n,light),0.);
   float geometric=max(dot(normal,light),0.);
   float gate=smoothstep(0.,.10,geometric);
   float rough=clamp(material.b,.20,.72);
   // Charcoal-black substrate with dielectric reflection. The unlit hemisphere stays genuinely dark.
   vec3 col=albedo*(vec3(.00035,.0005,.0007)+vec3(.85,.91,1.0)*nl*.74*gate);
   col+=vec3(.82,.91,1.0)*dielectricSpecular(n,view,light,rough)*.95*gate;
   return col;
 }
 if(index<2.5){
   vec3 tex=ry(.62+uTime*.014)*ringLocal(local);
   vec3 albedo=surface(tex,2.);
   float nl=max(dot(normal,RING_SUN),0.),nv=max(dot(normal,view),0.);
   float shadow=shadowOnRingPlanet(world+normal*radius*.001,RING_SUN,center,radius);
   // A flattened gas envelope: bands share the ring plane; clouds do not receive rocky bump shading.
   vec3 col=albedo*(vec3(.0015,.0018,.0024)+nl*shadow*1.20);
   col*=.79+.21*pow(nv,.35);
   col+=vec3(.42,.40,.34)*pow(1.-nv,5.)*nl*shadow*.032;
   return col;
 }
 vec3 tex=ry(.20+uTime*.0052)*local;
 vec3 albedo=surface(tex,4.);
 vec3 n=atlasNormal(normal,tex,5.,.40);
 float nl=max(dot(n,SUN),0.);
 float shadow=structureVisibility(local,normal);
 float facing=smoothstep(0.,.11,max(dot(normal,SUN),0.));
 vec3 col=albedo*(vec3(.0020,.0025,.0032)+nl*1.19*shadow*facing);
 col+=vec3(.72,.76,.79)*dielectricSpecular(n,view,SUN,.62)*shadow*.23*facing;
 return col;
}
vec3 ringColor(vec3 world,vec3 n,vec3 rd,vec3 c,float r,float rr){
 vec3 profile=ringData(rr);
 vec3 ice=mix(vec3(.25,.232,.20),vec3(.69,.667,.594),profile.g);
 ice*=.91+.11*profile.b;
 float mu0=max(abs(dot(n,RING_SUN)),.035),mu=max(abs(dot(n,-rd)),.035);
 float scattered=mu0/(mu+mu0);
 float phase=.86+.14*pow(max(dot(rd,RING_SUN),0.),5.);
 float shadow=planetShadow(world,RING_SUN,c,r);
 float sameSide=step(0.,dot(n,-rd)*dot(n,RING_SUN));
 float transmitted=exp(-ringOpticalDepth(rr)/mu0);
 vec3 color=ice*(.20+.97*scattered)*phase*mix(.045,1.,shadow);
 color*=mix(.13+transmitted*.85,1.,sameSide);
 // Radial optical-depth variation supplies the fine structure; there is no self-emissive edge.
 return color;
}
vec3 sunGlow(vec3 rd,vec3 pos,float size,vec3 color,float maxT){
  vec3 direction=normalize(pos-uCamera);float distanceToSun=length(pos-uCamera);
  if(distanceToSun>maxT)return vec3(0);
  float separation=length(cross(rd,direction));
  if(dot(rd,direction)<0.)return vec3(0);
  float disc=1.-smoothstep(size*.85,size,separation);
  float corona=exp(-separation/(size*2.6))*.28;
  float farGlow=exp(-separation/(size*12.))*.039;
  return color*(disc*2.4+corona+farGlow);
}
void main(){
  vec2 screen=(vUv*2.-1.);screen.x*=uResolution.x/uResolution.y;
  vec3 rd=normalize(uForward+screen.x*uFov*uRight+screen.y*uFov*uUp);
  vec3 sky=background(rd), color=sky;
  vec4 fractureSample=texture2D(uFracture,vUv);
  float nearest=FAR;float hitId=-1.;float hitKind=0.;vec3 hitNormal=vec3(0,0,1),hitLocal=vec3(0),hitCenter=vec3(0);float hitRadius=1.;
  for(int i=0;i<5;i++){
    float fi=float(i);if(uIsolation>.999&&abs(uFocus-fi)>.1)continue;
    vec3 center=uWorlds[i].xyz;float r=uWorlds[i].w;
    float t=FAR,kind=0.;vec3 norm=vec3(0),loc=vec3(0);
    if(i==1){
      if(fractureSample.a>.001){t=mix(uFractureRange.x,uFractureRange.y,(fractureSample.a-.02)/.96);kind=6.;}
    }else if(i==2){
      t=oblateHit(uCamera-center,rd,r,norm,loc);
    }else{
      t=firstSphere(uCamera-center,rd,r);
      if(t<FAR){loc=(uCamera+rd*t-center)/r;norm=normalize(loc);}
    }
    if(t<nearest){nearest=t;hitId=fi;hitKind=kind;hitNormal=norm;hitLocal=loc;hitCenter=center;hitRadius=r;}
  }
  if(hitId>=0.){
    vec3 shaded=abs(hitId-1.)<.1?pow(fractureSample.rgb,vec3(2.2))*4.:planetColor(hitId,uCamera+rd*nearest,hitNormal,hitLocal,rd,hitKind,hitCenter,hitRadius);
    float visibility=abs(uFocus-hitId)<.1?1.:1.-uIsolation;
    color=mix(sky,shaded,visibility);
  }
  // Particulate rings: the globe occludes the rear half, and shadows fall across both.
  if(uIsolation<.999||abs(uFocus-2.)<.1){
    vec3 c=uWorlds[2].xyz,n=ringNormal();float r=uWorlds[2].w;
    float denom=dot(rd,n);
    if(abs(denom)>.0001){
      float t=dot(c-uCamera,n)/denom;
      if(t>.001&&t<nearest){
        vec3 p=uCamera+rd*t;float rr=length(p-c)/r;
        if(rr>1.32&&rr<2.67){
          float a=(1.-exp(-ringOpticalDepth(rr)/max(abs(denom),.025)))*(abs(uFocus-2.)<.1?1.:1.-uIsolation);
          color=mix(color,ringColor(p,n,rd,c,r,rr),a);
        }
      }
    }
  }
  // Rasterized closed orbital hulls. Their material, geometry depth and shadows are genuinely 3D.
  if(uIsolation<.999||abs(uFocus-4.)<.1){
    vec4 structure=texture2D(uArchitecture,vUv);
    if(structure.a>.001){
      float t=mix(uArchitectureRange.x,uArchitectureRange.y,(structure.a-.02)/.96);
      if(t<nearest){
        float visibility=abs(uFocus-4.)<.1?1.:1.-uIsolation;
        color=mix(color,pow(structure.rgb,vec3(2.2))*4.,visibility);
        nearest=t;
      }
    }
  }
  // The obsidian object's unexplained limb is narrow and localized, not a luminous blue outline.
  if(uIsolation<.999||abs(uFocus)<.1){
    vec3 c=uWorlds[0].xyz;float r=uWorlds[0].w;
    vec3 oc=c-uCamera;float along=dot(oc,rd);
    if(along>0.&&along<nearest+r*.2){
      vec3 limb=normalize(uCamera+rd*along-c);
      float distanceToLimb=length(oc-rd*along)/r;
      float illumination=pow(max(dot(limb,normalize(vec3(-.87,.41,-.28))),0.),2.);
      float thin=exp(-max(distanceToLimb-1.,0.)/.0023)*smoothstep(.9978,1.0008,distanceToLimb);
      float haze=exp(-max(distanceToLimb-1.,0.)/.011)*smoothstep(.998,1.001,distanceToLimb);
      float visibility=abs(uFocus)<.1?1.:1.-uIsolation;
      color+=vec3(.10,.20,.25)*(thin*.16+haze*.008)*illumination*visibility;
    }
  }
  // The exposed core only blooms through open sightlines between the broken shells.
  if((uIsolation<.999||abs(uFocus-1.)<.1)){
    vec3 oc=uWorlds[1].xyz-uCamera;float along=dot(oc,rd),r=uWorlds[1].w;
    float dist=length(oc-rd*along)/r;
    float visibility=abs(uFocus-1.)<.1?1.:1.-uIsolation;
    if(along>0.&&nearest>along-r*.61)color+=vec3(1.05,.25,.045)*exp(-max(dist-.57,0.)*16.)*.045*visibility;
  }
  if(uIsolation<.999||abs(uFocus-3.)<.1){
    float v=abs(uFocus-3.)<.1?1.:1.-uIsolation;
    color=mix(color,geminaAtmosphere(color,rd,nearest),v);
  }
  float twin=smoothstep(.05,.95,uIsolation)*step(2.9,uFocus)*step(uFocus,3.1);
  float aspect=uResolution.x/uResolution.y;
  bool portrait=aspect<.95;
  vec2 screenA=portrait?vec2(-.65,.71):vec2(-.08,.49);
  vec2 screenB=portrait?vec2(.65,.66):vec2(.18,.66);
  vec3 twinA=uCamera+normalize(uForward+uRight*screenA.x*aspect*uFov+uUp*screenA.y*uFov)*35.*uWorlds[3].w;
  vec3 twinB=uCamera+normalize(uForward+uRight*screenB.x*aspect*uFov+uUp*screenB.y*uFov)*37.*uWorlds[3].w;
  vec3 a=mix(vec3(-11.,8.,-37.),twinA,twin);
  vec3 b=mix(vec3(-7.7,6.5,-39.),twinB,twin);
  float starVisibility=mix(1.,.28,uIsolation*(1.-twin));
  color+=sunGlow(rd,a,mix(.0036,.0085,twin),vec3(1.0,.68,.35),nearest)*starVisibility;
  color+=sunGlow(rd,b,mix(.0029,.0058,twin),vec3(.51,.76,1.0),nearest)*starVisibility;
  // Restrained shoulder, deep blacks and an optical vignette.
  color=max(color,vec3(0.))*uExposure;
  color=clamp((color*(2.51*color+.03))/(color*(2.43*color+.59)+.14),0.,1.);
  color=pow(color,vec3(1./2.2));
  float vignette=1.-.15*pow(length(vUv-.5)*1.3,2.);
  color*=vignette;
  float grain=(hash3(vec3(gl_FragCoord.xy,1.))-0.5)/255.;
  gl_FragColor=vec4(max(color+grain,0.),1.);
}`
  };
})(globalThis);

