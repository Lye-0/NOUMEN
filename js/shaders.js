/* Analytic 3D ray tracing: spheres, broken shells, particulate rings and annular architecture.
   No meshes, third-party libraries, network shaders or screen-space planet sprites. */
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
uniform float uFocus;
uniform float uIsolation;
uniform float uHover;
uniform float uExposure;
const float PI=3.14159265359;
const float FAR=10000.;
const vec3 SUN=vec3(-.596,.604,.529);
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
vec3 surface(vec3 p,float index){
  vec2 uv=sphereUV(p);
  vec2 cell=vec2(mod(index,2.),floor(index/2.));
  uv=(uv*vec2(.499,.249)+vec2(.0005,.0005))+cell*vec2(.5,.25);
  return texture2D(uSurfaces,uv).rgb;
}
float luminance(vec3 col){return dot(col,vec3(.2126,.7152,.0722));}
vec3 background(vec3 rd){
  vec2 uv=sphereUV(rd);
  vec3 sky=texture2D(uSky,uv).rgb;
  // A small number of resolved stars, independent of the photographic sky texture.
  vec3 grid=rd*650.;vec3 id=floor(grid),f=fract(grid)-.5;
  float seed=hash3(id);float d=length(f);
  float star=(1.-smoothstep(0.,.13,d))*step(.9978,seed)*.55;
  return sky*.92+vec3(.69,.8,.86)*star;
}
float crackProfile(float y){
  float v=(y+1.30)*3.5,i=floor(v);
  return mix(hash(i+15.0)-.5,hash(i+16.0)-.5,fract(v))*.28;
}
bool inPiece(vec3 p,int k,float r){
  float boundary=crackProfile(p.y/r)*r+.14*p.z;
  if(k==0)return p.x<boundary-.055*r;
  if(k==1)return p.x>boundary+.065*r&&p.y>.04*r;
  return p.x>boundary+.065*r&&p.y<-.045*r;
}
void considerShell(float t,vec3 q,vec3 d,int k,float r,float inner,inout float best,inout vec3 normal,inout vec3 local,inout float kind){
  vec3 p=q+d*t;
  if(t>.001&&t<best&&inPiece(p,k,r)){
    best=t;normal=normalize(p)*inner;local=p;kind=inner>0.?1.:2.;
  }
}
float fractured(vec3 ro,vec3 rd,vec3 c,float r,out vec3 n,out vec3 p,out float kind){
  mat3 R=rz(.32)*ry(.10+uTime*.004);
  // R is world -> exhibition-local. Its inverse is explicitly transposed for WebGL 1.
  mat3 Ri=mat3(R[0][0],R[1][0],R[2][0],R[0][1],R[1][1],R[2][1],R[0][2],R[1][2],R[2][2]);
  vec3 origin=R*(ro-c),d=R*rd;
  float best=FAR;vec3 norm=vec3(0,0,1);vec3 local=vec3(0);kind=1.;
  for(int k=0;k<3;k++){
    vec3 off=k==0?vec3(-.13,.015,.02):k==1?vec3(.15,.105,-.045):vec3(.20,-.12,.035);
    vec3 q=origin-off*r;
    vec2 a=sphere(q,d,r),b=sphere(q,d,r*.835);
    considerShell(a.x,q,d,k,r,1.,best,norm,local,kind);
    considerShell(a.y,q,d,k,r,1.,best,norm,local,kind);
    considerShell(b.x,q,d,k,r,-1.,best,norm,local,kind);
    considerShell(b.y,q,d,k,r,-1.,best,norm,local,kind);
    float margin=k==0?-.055:.065;
    // The crack is piecewise planar: the visible shell edges are genuinely jagged geometry.
    for(int j=0;j<10;j++){
      float fj=float(j),lo=-1.30+fj/3.5,hi=lo+1./3.5;
      float a=(hash(fj+15.)-.5)*.28,b=(hash(fj+16.)-.5)*.28;
      float slope=(b-a)*3.5,intercept=a-slope*lo;
      float denom=d.x-slope*d.y-.14*d.z;
      if(abs(denom)>.0001){
        float t=((intercept+margin)*r-q.x+slope*q.y+.14*q.z)/denom;
        vec3 pp=q+d*t;
        bool yvalid=pp.y/r>=lo&&pp.y/r<hi&&(k==0||(k==1?pp.y>.04*r:pp.y<-.045*r));
        if(t>.001&&t<best&&length(pp)<r&&length(pp)>r*.835&&yvalid){
          best=t;norm=normalize(vec3(1.,-slope,-.14))*(k==0?1.:-1.);local=pp;kind=3.;
        }
      }
    }
    if(k>0&&abs(d.y)>.0001){
      float level=k==1?.04:-.045;
      float t=(level*r-q.y)/d.y;vec3 pp=q+d*t;
      float boundary=crackProfile(pp.y/r)*r+.14*pp.z;
      if(t>.001&&t<best&&length(pp)<r&&length(pp)>r*.835&&pp.x>boundary+.065*r){
        best=t;norm=vec3(0,k==1?-1.:1.,0);local=pp;kind=3.;
      }
    }
  }
  float core=firstSphere(ro-c,rd,r*.50);
  if(core<best){best=core;local=ro+rd*core-c;norm=R*normalize(local);kind=4.;}
  // Debris is individually intersected 3D geometry, not a flat particle overlay.
  for(int j=0;j<18;j++){
    float fj=float(j),a=fj*2.39996;
    vec3 dc=vec3(sin(a)*(.32+.25*hash(fj+8.)),(hash(fj+3.)-.5)*2.45,cos(a)*.6)*r;
    dc.x+=.12*r;
    float dr=r*(.019+.030*hash(fj+23.));
    float t=firstSphere(origin-dc,d,dr);
    if(t<best){best=t;local=origin+d*t-dc;norm=normalize(local);kind=5.;}
  }
  n=Ri*norm;p=local/r;return best;
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
float ringAlpha(float rr){
  float footprint=2.*uFov*length(uCamera-uWorlds[2].xyz)/uWorlds[2].w/uResolution.y/max(.20,abs(dot(uForward,normalize(vec3(-.37,.77,.52)))));
  float fine=.5+.5*sin(rr*3900.+sin(rr*271.)*2.1)*exp(-pow(footprint*3900.,2.)*.15);
  float layers=.48+.24*sin(rr*96.)+.16*sin(rr*263.)+.12*sin(rr*41.+2.);
  float density=sat(layers*.83+fine*.25);
  density*=smoothstep(1.32,1.42,rr)*(1.-smoothstep(2.49,2.65,rr));
  density*=1.-(1.-smoothstep(.012,.036,abs(rr-1.94)))*.94;
  density*=1.-(1.-smoothstep(.006,.021,abs(rr-2.32)))*.8;
  return density;
}
float planetShadow(vec3 point,vec3 light,vec3 c,float r){
  vec3 oc=point-c;float b=dot(oc,light);if(b>=0.)return 1.;
  float dist=length(oc-light*b);
  return smoothstep(r*.92,r*1.03,dist);
}
float shadowOnRingPlanet(vec3 p,vec3 light,vec3 center,float radius){
  vec3 n=ringNormal();float dn=dot(light,n);if(abs(dn)<.001)return 1.;
  float t=dot(center-p,n)/dn;
  if(t<.001)return 1.;
  float rad=length(p+light*t-center)/radius;
  return 1.-ringAlpha(rad)*.83*step(1.32,rad)*step(rad,2.65);
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
vec3 planetColor(float index,vec3 world,vec3 normal,vec3 local,vec3 rd,float kind,vec3 center,float radius){
  vec3 tex=local;
  if(abs(index-1.)>.1)tex=ry(uTime*(index==2.?.014:.008))*local;
  vec3 albedo=surface(tex,index);
  vec3 n=normal;
  if(kind<1.5||abs(index-1.)>.1)n=bumpNormal(normal,tex,index);
  float day=max(dot(n,SUN),0.);
  float fres=pow(1.-max(dot(normal,-rd),0.),3.);
  float ambient=.022+.034*max(normal.y,0.);
  vec3 halfLight=normalize(SUN-rd);
  float spec=pow(max(dot(n,halfLight),0.),index<.5?95.:34.);
  vec3 col;
  if(index<.5){
    // Absorptive glass with a resolved, cool specular rim rather than a grey ball.
    col=albedo*(ambient+day*.30)*vec3(.78,.98,1.06);
    float mineral=smoothstep(.30,.57,luminance(albedo));
    col+=vec3(.57,.77,.86)*spec*(.12+mineral*.48)*day;
    col+=vec3(.19,.48,.58)*pow(fres,3.)*(.015+day*.11);
  }else if(index<1.5){
    if(kind>3.5&&kind<4.5){
      float convection=fbm(local*8.+vec3(0,uTime*.018,0));
      float filaments=pow(sat(1.-abs(convection-.5)*7.),4.);
      col=mix(vec3(.75,.058,.006),vec3(2.2,.54,.065),convection)*(.4+filaments*.8);
      col+=vec3(.65,.16,.018)*pow(max(dot(normal,-rd),0.),2.);
    }else{
      col=albedo*(ambient+day*.58);
      if(kind>1.5&&kind<3.5){
        float heat=.4+.6*fbm(local*22.);
        float strata=.5+.5*sin(length(local)*210.+fbm(local*18.)*15.);
        float innerHeat=1.-smoothstep(.83,1.,length(local));
        col=mix(vec3(.035,.039,.043),vec3(.13,.11,.082),strata)*(.2+day*.55);
        col+=vec3(1.1,.17,.014)*(heat*.20+pow(strata,22.)*.22)*innerHeat*(kind>2.5?1.:1.25);
      }
      col+=vec3(.65,.20,.035)*max(dot(normal,normalize(center-world)),0.)*.44;
      col+=spec*.055;
    }
  }else if(index<2.5){
    float shadow=shadowOnRingPlanet(world+normal*.005,SUN,center,radius);
    col=albedo*(ambient+day*.95*shadow);
    col+=vec3(.53,.59,.61)*fres*.065*day;
  }else if(index<3.5){
    vec3 warm=normalize(vec3(-.86,.42,.36)),cool=normalize(vec3(.82,.35,.36));
    float a=max(dot(n,warm),0.),b=max(dot(n,cool),0.);
    col=albedo*(vec3(1.4,.81,.41)*a*.95+vec3(.36,.71,1.15)*b*.78+vec3(.015,.028,.04));
    col+=vec3(.34,.58,.7)*pow(max(dot(n,normalize(cool-rd)),0.),80.)*.16;
    col+=vec3(.55,.72,.8)*pow(fres,2.)*.10;
  }else{
    col=albedo*(ambient+day*.82);
    float stripe=(1.-smoothstep(.003,.014,abs(dot(normal,structureNormal(1.)))));
    col*=1.-stripe*.68;
    col+=vec3(.34,.63,.67)*spec*.18;
  }
  return col;
}
vec3 ringColor(vec3 world,vec3 n,vec3 rd,vec3 c,float r,float rr){
  float bands=.5+.5*sin(rr*58.+sin(rr*31.)*2.);
  vec3 dust=mix(vec3(.29,.28,.255),vec3(.77,.66,.49),bands*.65+.2);
  float light=.35+.50*abs(dot(n,SUN));
  float shadow=planetShadow(world,SUN,c,r);
  float phase=pow(max(dot(rd,SUN),0.),4.);
  float edge=pow(.5+.5*sin(rr*1100.),12.)*.035;
  return dust*(light*mix(.09,1.,shadow)+phase*.11)+edge*shadow*vec3(.8,.77,.66);
}
vec3 architectureColor(vec3 world,vec3 n,vec3 rd,vec3 center,vec3 normal,float r,float face,float second,out float alpha){
  vec3 q=world-center;vec3 axis=normalize(cross(normal,vec3(0,1,0))),up=cross(normal,axis);
  float angle=atan(dot(q,up),dot(q,axis))+uTime*.004*(second<.5?1.:-1.7);
  float radial=length(q-normal*dot(q,normal))/r;
  float sector=fract(angle/(2.*PI)*96.);
  float seam=smoothstep(.015,.042,sector)*(1.-smoothstep(.958,.986,sector));
  float fine=step(.83,fract(radial*190.));
  float panel=hash(floor(angle/(2.*PI)*96.));
  float light=max(dot(n,SUN),0.);
  vec3 metal=mix(vec3(.15,.195,.20),vec3(.31,.36,.35),panel);
  float spec=pow(max(dot(n,normalize(SUN-rd)),0.),45.);
  vec3 color=metal*(.05+light*.84)+vec3(.48,.58,.56)*spec*.45;
  color*=.70+fine*.3;
  float window=step(.84,fract(angle*89.))*step(.45,fract(radial*110.));
  float edgeLine=second<.5?(1.-smoothstep(.0015,.008,abs(radial-1.68))):(1.-smoothstep(.002,.009,abs(radial-1.275)));
  color+=vec3(.55,.83,.76)*(edgeLine*.8+window*.26*face)*seam;
  color+=vec3(.37,.59,.56)*smoothstep(.965,.995,sector)*.20;
  float sh=planetShadow(world,SUN,center,r);
  color*=mix(.21,1.,sh);
  alpha=seam*.98;
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
  float nearest=FAR;float hitId=-1.;float hitKind=0.;vec3 hitNormal=vec3(0,0,1),hitLocal=vec3(0),hitCenter=vec3(0);float hitRadius=1.;
  for(int i=0;i<5;i++){
    float fi=float(i);if(uIsolation>.999&&abs(uFocus-fi)>.1)continue;
    vec3 center=uWorlds[i].xyz;float r=uWorlds[i].w;
    float t=FAR,kind=0.;vec3 norm=vec3(0),loc=vec3(0);
    if(i==1){
      vec2 bounds=sphere(uCamera-center,rd,r*1.52);
      if(bounds.y>.001&&bounds.x<FAR)t=fractured(uCamera,rd,center,r,norm,loc,kind);
    }else{
      t=firstSphere(uCamera-center,rd,r);
      if(t<FAR){loc=(uCamera+rd*t-center)/r;norm=normalize(loc);}
    }
    if(t<nearest){nearest=t;hitId=fi;hitKind=kind;hitNormal=norm;hitLocal=loc;hitCenter=center;hitRadius=r;}
  }
  if(hitId>=0.){
    vec3 shaded=planetColor(hitId,uCamera+rd*nearest,hitNormal,hitLocal,rd,hitKind,hitCenter,hitRadius);
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
        if(rr>1.32&&rr<2.65){
          float a=ringAlpha(rr)*.94*(abs(uFocus-2.)<.1?1.:1.-uIsolation);
          color=mix(color,ringColor(p,n,rd,c,r,rr),a);
        }
      }
    }
  }
  // Two immense manufactured orbital structures, with actual depth, seams and lit openings.
  if(uIsolation<.999||abs(uFocus-4.)<.1){
    vec3 c=uWorlds[4].xyz;float r=uWorlds[4].w;
    for(int k=0;k<2;k++){
      float second=float(k);vec3 normal=structureNormal(second),n;float face;
      float t=annulus(uCamera,rd,c,normal,r*(k==0?1.54:1.245),r*(k==0?1.74:1.30),r*(k==0?.09:.044),n,face);
      if(t<nearest){
        float alpha;vec3 arc=architectureColor(uCamera+rd*t,n,rd,c,normal,r,face,second,alpha);
        alpha*=abs(uFocus-4.)<.1?1.:1.-uIsolation;
        color=mix(color,arc,alpha);if(alpha>.8)nearest=t;
      }
    }
  }
  // Limb scattering computed from distance to the ray in world space, not painted halos.
  for(int i=0;i<5;i++){
    float fi=float(i);if(uIsolation>.999&&abs(uFocus-fi)>.1)continue;
    vec3 c=uWorlds[i].xyz;float r=uWorlds[i].w;
    vec3 oc=c-uCamera;float along=dot(oc,rd);if(along<0.)continue;
    float d=length(oc-rd*along)/r;
    float thickness=i==3?.040:i==0?.018:.016;
    float glow=exp(-max(d-1.,0.)/thickness)*smoothstep(.94,1.005,d);
    float visibility=abs(uFocus-fi)<.1?1.:1.-uIsolation;
    vec3 limb=normalize(uCamera+rd*along-c);
    float illumination=sat(dot(limb,SUN)*.65+.45);
    vec3 tint=i==0?vec3(.15,.55,.73):i==2?vec3(.58,.51,.33):i==3?vec3(.28,.55,.79):vec3(.18,.45,.50);
    if(i==1){glow*=.12;tint=vec3(.8,.21,.05);}
    if(i==3)illumination=.75;
    if(along<nearest+r*.4)color+=tint*glow*illumination*.55*visibility*(uHover==fi?1.35:1.);
  }
  // The exposed core only blooms through open sightlines between the broken shells.
  if((uIsolation<.999||abs(uFocus-1.)<.1)){
    vec3 oc=uWorlds[1].xyz-uCamera;float along=dot(oc,rd),r=uWorlds[1].w;
    float dist=length(oc-rd*along)/r;
    float visibility=abs(uFocus-1.)<.1?1.:1.-uIsolation;
    if(along>0.&&nearest>along-r*.54)color+=vec3(1.05,.25,.045)*exp(-max(dist-.49,0.)*16.)*.28*visibility;
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
  color=vec3(1.)-exp(-max(color,vec3(0.))*uExposure);
  color=pow(color,vec3(.86));
  float vignette=1.-.15*pow(length(vUv-.5)*1.3,2.);
  color*=vignette;
  float grain=(hash3(vec3(gl_FragCoord.xy,1.))-0.5)/255.;
  gl_FragColor=vec4(max(color+grain,0.),1.);
}`
  };
})(globalThis);
