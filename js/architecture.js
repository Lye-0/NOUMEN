/* NOUMEN · VIGIL. Volumetric orbital architecture, in planet-radius units.
 * Closed chamfered hulls, continuous understructure, raised rails, service modules,
 * recessed radiators and individual apertures. No billboard or pre-rendered facade.
 */
(function(root){
  'use strict';
  const N=root.Noumen=root.Noumen||{};
  const normalize=v=>{const l=Math.hypot(...v)||1;return v.map(x=>x/l);};
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const add=(a,b)=>a.map((x,i)=>x+b[i]);
  const scale=(a,s)=>a.map(x=>x*s);
  function createGeometry(){
    const data=[];let modules=0;let random=7919;
    const rand=()=>{random=(Math.imul(random,1664525)+1013904223)>>>0;return random/4294967296;};
    function triangle(a,b,c,kind,seed){
      const normal=normalize(cross(b.map((x,i)=>x-a[i]),c.map((x,i)=>x-a[i])));
      for(const v of [a,b,c])data.push(...v,...normal,kind,seed);
    }
    function quad(a,b,c,d,kind,seed){triangle(a,b,c,kind,seed);triangle(a,c,d,kind,seed);}
    const frames=[normalize([.35,.14,.925]),normalize([-.69,.63,.36])].map(n=>{const x=normalize(cross(n,[0,1,0]));return {n,x,y:cross(n,x)};});
    function coordinates(frame,theta,r,z){return [0,1,2].map(k=>frame.x[k]*Math.cos(theta)*r+frame.y[k]*Math.sin(theta)*r+frame.n[k]*z);}
    function arc(frame,ri,ro,h,z,start,end,kind,seed,steps=12,bevel=.004){
      const b=Math.min(bevel,(ro-ri)*.25,h*.60);
      const profile=[[ri+b,-h],[ro-b,-h],[ro,-h+b],[ro,h-b],[ro-b,h],[ri+b,h],[ri,h-b],[ri,-h+b]];
      for(let i=0;i<steps;i++){
        const a=start+(end-start)*i/steps,an=start+(end-start)*(i+1)/steps;
        for(let j=0;j<profile.length;j++){
          const p=profile[j],q=profile[(j+1)%profile.length];
          quad(coordinates(frame,a,p[0],p[1]+z),coordinates(frame,an,p[0],p[1]+z),coordinates(frame,an,q[0],q[1]+z),coordinates(frame,a,q[0],q[1]+z),kind,seed);
        }
      }
      // The sector ends are closed; any visible break exposes a real thickness.
      for(const a of [start,end]){
        const center=coordinates(frame,a,(ri+ro)*.5,z);
        for(let j=0;j<profile.length;j++)triangle(center,coordinates(frame,a,profile[j][0],profile[j][1]+z),coordinates(frame,a,profile[(j+1)%profile.length][0],profile[(j+1)%profile.length][1]+z),kind,seed);
      }
    }
    function box(frame,theta,r,z,radial,tangential,axial,kind,seed){
      const radialAxis=add(scale(frame.x,Math.cos(theta)),scale(frame.y,Math.sin(theta)));
      const tangent=add(scale(frame.x,-Math.sin(theta)),scale(frame.y,Math.cos(theta)));
      const center=coordinates(frame,theta,r,z),axes=[radialAxis,tangent,frame.n],sizes=[radial,tangential,axial];
      const vertex=(i,j,k)=>[0,1,2].map(a=>center[a]+axes[0][a]*i*sizes[0]*.5+axes[1][a]*j*sizes[1]*.5+axes[2][a]*k*sizes[2]*.5);
      const v=[vertex(-1,-1,-1),vertex(1,-1,-1),vertex(1,1,-1),vertex(-1,1,-1),vertex(-1,-1,1),vertex(1,-1,1),vertex(1,1,1),vertex(-1,1,1)];
      for(const f of [[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]])quad(...f.map(i=>v[i]),kind,seed);
      modules++;
    }
    for(let ring=0;ring<2;ring++){
      const frame=frames[ring],inner=ring?1.235:1.505,outer=ring?1.302:1.742,h=ring?.027:.051;
      const count=ring?80:120,da=Math.PI*2/count;
      // Continuous dark backing means panel divisions do not become transparent wire gaps.
      arc(frame,inner+.003,outer-.003,h*.75,0,0,Math.PI*2,2,.3,640,.002);
      for(let i=0;i<count;i++){
        const a=i*da,b=(i+1)*da,mid=(a+b)/2,seed=rand();
        arc(frame,inner,outer,h,0,a+.00065,b-.00065,0,seed,8,ring?.003:.007);
        if(!ring){
          for(const sign of [-1,1]){
            arc(frame,inner+.005,inner+.018,.009,sign*(h+.005),a+.0005,b-.0005,1,seed,8,.002);
            arc(frame,outer-.020,outer-.007,.011,sign*(h+.004),a+.0005,b-.0005,1,seed,8,.002);
            // Raised armor ribs shelter black radiator beds. Small repeating geometry supplies scale.
            box(frame,mid,1.64,sign*(h+.010),.142,.052,.018,2,seed);
            for(let j=0;j<3;j++)box(frame,mid+(j-1)*.014,1.64,sign*(h+.020),.141,.005,.011,6,seed);
            box(frame,a+.006,1.635,sign*(h+.025),.18,.014,.047,6,seed);
            if(i%8===0){
              box(frame,mid,1.775,sign*.025,.090,.036,.043,6,seed);
              box(frame,mid,1.821,sign*.025,.014,.027,.027,2,seed);
            }
            if(i%10===0){
              box(frame,mid,1.485,sign*.060,.090,.055,.085,6,seed);
              box(frame,mid,1.438,sign*.060,.006,.030,.048,5,seed);
              box(frame,mid-.012,1.494,sign*.099,.007,.007,.005,4,seed);
            }
          }
        }else{
          if(i%2===0)for(const sign of [-1,1])box(frame,mid,1.274,sign*(h+.006),.052,.025,.015,2,seed);
          if(i%10===0){box(frame,mid,1.327,0,.062,.029,.041,6,seed);box(frame,mid,1.359,0,.004,.010,.016,4,seed);}
        }
      }
    }
    return {data:new Float32Array(data),vertices:data.length/8,stride:8,modules,rings:2};
  }
  N.architecture=Object.freeze({createGeometry});
})(globalThis);
