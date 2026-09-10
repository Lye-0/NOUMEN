/* NOUMEN · Fracture volumes. Original seeded geology, generated once on the CPU.
   Clipped spherical Voronoi plates have displaced exteriors, closed broken walls,
   uneven mantle undersides and independently transformed angular debris. */
(function(root){
  'use strict';
  const N=root.Noumen=root.Noumen||{};
  const add=(a,b)=>a.map((x,i)=>x+b[i]);
  const mul=(a,s)=>a.map(x=>x*s);
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const norm=a=>mul(a,1/(Math.hypot(...a)||1));
  const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
  function hash(x,y,z){let n=Math.imul(x,374761393)+Math.imul(y,668265263)+Math.imul(z,2246822519);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;}
  function noise(x,y,z){const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z);let a=x-ix,b=y-iy,c=z-iz;a=a*a*(3-2*a);b=b*b*(3-2*b);c=c*c*(3-2*c);const lerp=(x,y,t)=>x+(y-x)*t;return lerp(lerp(lerp(hash(ix,iy,iz),hash(ix+1,iy,iz),a),lerp(hash(ix,iy+1,iz),hash(ix+1,iy+1,iz),a),b),lerp(lerp(hash(ix,iy,iz+1),hash(ix+1,iy,iz+1),a),lerp(hash(ix,iy+1,iz+1),hash(ix+1,iy+1,iz+1),a),b),c)*2-1;}
  function rot(p,axis,angle){const a=norm(axis),c=Math.cos(angle),s=Math.sin(angle);return add(add(mul(p,c),mul(cross(a,p),s)),mul(a,dot(a,p)*(1-c)));}
  function ico(level){
    const t=(1+Math.sqrt(5))/2;
    let v=[[-1,t,0],[1,t,0],[-1,-t,0],[1,-t,0],[0,-1,t],[0,1,t],[0,-1,-t],[0,1,-t],[t,0,-1],[t,0,1],[-t,0,-1],[-t,0,1]].map(norm);
    let f=[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];
    for(let j=0;j<level;j++){
      const cache=new Map(),nf=[];
      const mid=(a,b)=>{const key=Math.min(a,b)+','+Math.max(a,b);if(cache.has(key))return cache.get(key);const i=v.length;v.push(norm(add(v[a],v[b])));cache.set(key,i);return i;};
      for(const [a,b,c] of f){const ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);nf.push([a,ab,ca],[b,bc,ab],[c,ca,bc],[ab,bc,ca]);}f=nf;
    }return {v,f};
  }
  const seeds=[[-.70,.27,.64],[.38,.80,.46],[.48,-.64,.60],[-.62,-.32,-.72],[.51,.24,-.86]].map(norm);
  const offsets=[[-.12,.005,.025],[.080,.097,-.035],[.106,-.099,.068],[-.045,-.034,-.052],[.047,.02,-.045]];
  const angles=[-.044,.070,-.095,.033,-.04];
  function fields(p){return seeds.map((s,k)=>dot(p,s)+noise(p[0]*5+k*7.1,p[1]*5-k*3.7,p[2]*5+k*2.8)*.112+noise(p[0]*16+k*8,p[1]*16,p[2]*16-k*6)*.035+noise(p[0]*42+k*11,p[1]*42-k*7,p[2]*42+k*2)*.010);}
  function clip(poly,k,j){
    const out=[];if(!poly.length)return out;
    for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length],da=a.f[k]-a.f[j]-.034,db=b.f[k]-b.f[j]-.034;
      if(da>=0)out.push(a);
      if((da>=0)!==(db>=0)){const t=da/(da-db);out.push({p:mix(a.p,b.p,t),f:mix(a.f,b.f,t),mask:(a.mask&b.mask)|(1<<j)});}
    }return out;
  }
  function createGeometry(heightImage){
    let height=null,hw=1,hh=1;
    if(heightImage){const cv=document.createElement('canvas');cv.width=1024;cv.height=512;const cx=cv.getContext('2d',{willReadFrequently:true});cx.drawImage(heightImage,0,0,1024,512);height=cx.getImageData(0,0,1024,512).data;hw=1024;hh=512;}
    const elevation=p=>{if(!height)return .001*noise(...mul(p,9));const u=((Math.atan2(p[2],p[0])/(2*Math.PI)+.5)%1+1)%1,v=Math.acos(Math.max(-1,Math.min(1,p[1])))/Math.PI;const i=(Math.min(hh-1,Math.floor(v*hh))*hw+Math.min(hw-1,Math.floor(u*hw)))*4;return (height[i]/255)*.0062756652-.0030233657;};
    const output=[];
    const transform=(p,k)=>add(rot(p,seeds[k],angles[k]),offsets[k]);
    const tn=(p,k)=>rot(p,seeds[k],angles[k]);
    function vertex(p,n,t,local,kind){output.push(...p,...n,...t,...local,kind);}
    function triangle(positions,locals,k,kind,smoothNormals=false){
      let n=norm(cross(add(positions[1],mul(positions[0],-1)),add(positions[2],mul(positions[0],-1))));
      const outward=dot(n,norm(positions[0]));
      if((kind===0&&outward<0)||(kind===2&&outward>0)){[positions[1],positions[2]]=[positions[2],positions[1]];[locals[1],locals[2]]=[locals[2],locals[1]];n=mul(n,-1);}
      for(let i=0;i<3;i++){
        const local=locals[i],d=norm(local),normal=smoothNormals?mul(d,kind===2?-1:1):n;
        let tangent=norm([-d[2],0,d[0]]);if(Math.hypot(...tangent)<.1)tangent=[1,0,0];
        vertex(k>=0?transform(positions[i],k):positions[i],k>=0?tn(normal,k):normal,k>=0?tn(tangent,k):tangent,local,kind);
      }
    }
    const sphere=ico(5),verts=sphere.v.map(p=>({p,f:fields(p),mask:0}));
    function outer(p){const d=norm(p);return mul(d,1+elevation(d));}
    function inner(p){const d=norm(p);return mul(d,.694+noise(...add(mul(d,11),[14,2,7]))*.013);}
    function wall(p,t){const d=norm(p);if(t===0)return outer(d);if(t===1)return inner(d);const r=(1+elevation(d))*(1-t)+(.694+noise(...add(mul(d,11),[14,2,7]))*.013)*t;const wobble=Math.sin(Math.PI*t)*.009;return add(mul(d,r),[noise(d[0]*33+t*7,d[1]*33,d[2]*33)*wobble,noise(d[0]*33,d[1]*33+t*7,d[2]*33+8)*wobble,noise(d[0]*33+12,d[1]*33,d[2]*33+t*7)*wobble]);}
    for(const face of sphere.f){
      for(let k=0;k<seeds.length;k++){
        let poly=face.map(i=>verts[i]);
        for(let j=0;j<seeds.length&&poly.length;j++)if(j!==k)poly=clip(poly,k,j);
        if(poly.length<3)continue;
        for(let j=1;j<poly.length-1;j++){
          const loc=[poly[0].p,poly[j].p,poly[j+1].p];
          triangle(loc.map(outer),loc.slice(),k,0,true);
          triangle(loc.map(inner),loc.slice(),k,2,true);
        }
        for(let j=0;j<poly.length;j++){
          const a=poly[j],b=poly[(j+1)%poly.length];if(!(a.mask&b.mask))continue;
          for(let s=0;s<10;s++){
            const t=s/10,u=(s+1)/10;
            const p0=wall(a.p,t),p1=wall(b.p,t),p2=wall(b.p,u),p3=wall(a.p,u);
            triangle([p0,p1,p2],[p0,p1,p2],k,1);triangle([p0,p2,p3],[p0,p2,p3],k,1);
          }
        }
      }
    }
    // Coherent molten interior, below rather than level with the broken crust.
    const core=ico(5);
    for(const f of core.f){const loc=f.map(i=>core.v[i]);triangle(loc.map(p=>mul(p,.625+noise(...mul(p,12))*.002)),loc,-1,4,true);}
    // Power-law population of angular rubble; never miniature smooth spheres.
    let seed=37012026;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const debris=ico(0);
    let count=0;
    for(let attempt=0;attempt<6000&&count<520;attempt++){
      const y=random()*2-1,a=random()*Math.PI*2,h=Math.sqrt(1-y*y),dir=[h*Math.cos(a),y,h*Math.sin(a)];
      const fs=fields(dir).sort((a,b)=>b-a);if(fs[0]-fs[1]>.24)continue;
      const radius=.965+Math.pow(random(),1.9)*.46;const center=mul(dir,radius);
      const size=.0027+Math.pow(random(),4)*.031;const stretch=[.52+random(),.50+random(),.55+random()];
      const pv=debris.v.map(p=>add(center,p.map((x,j)=>x*size*stretch[j]*(.72+random()*.5))));
      for(const f of debris.f){const p=f.map(i=>pv[i]);triangle(p,p,-1,3);}
      count++;
    }
    return {data:new Float32Array(output),vertices:output.length/13,debris:count,stride:13};
  }
  N.geology={createGeometry,ico,noise};
})(globalThis);

