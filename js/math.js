(function (root) {
  'use strict';
  const N = root.Noumen = root.Noumen || {};
  const add = (a,b) => a.map((v,i)=>v+b[i]);
  const sub = (a,b) => a.map((v,i)=>v-b[i]);
  const scale = (a,s) => a.map(v=>v*s);
  const dot = (a,b) => a.reduce((sum,v,i)=>sum+v*b[i],0);
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const normalize = a => scale(a,1/(Math.hypot(...a)||1));
  const mix = (a,b,t) => a.map((v,i)=>v+(b[i]-v)*t);
  const clamp = (v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const ease = t => t*t*t*(t*(6*t-15)+10);
  const cameraBasis = (position,target) => {
    const forward=normalize(sub(target,position));
    const right=normalize(cross(forward,[0,1,0]));
    return {forward,right,up:cross(right,forward)};
  };
  const project = (point,camera,width,height) => {
    const basis=cameraBasis(camera.position,camera.target);
    const relative=sub(point,camera.position), z=dot(relative,basis.forward);
    const t=Math.tan(camera.fov*Math.PI/360);
    return {x:(.5+.5*dot(relative,basis.right)/(z*t*width/height))*width,
      y:(.5-.5*dot(relative,basis.up)/(z*t))*height,z};
  };
  const raySphere = (origin,direction,center,radius) => {
    const oc=sub(origin,center), b=dot(oc,direction), c=dot(oc,oc)-radius*radius;
    const h=b*b-c;
    if(h<0)return Infinity;
    const near=-b-Math.sqrt(h),far=-b+Math.sqrt(h);
    return near>0?near:far>0?far:Infinity;
  };
  N.math=Object.freeze({add,sub,scale,dot,cross,normalize,mix,clamp,ease,cameraBasis,project,raySphere});
})(globalThis);
