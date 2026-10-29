// Shared, bounded One-Euro follower for hand-attached compositor layers.
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const alpha = (cutoff, dt) => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));
const copy = p => ({ x: p.x, y: p.y, z: p.z });
const distance = (a, b) => Math.hypot(a.x-b.x, a.y-b.y, a.z-b.z);
function quaternion(q) {
  const n = Math.hypot(q.x, q.y, q.z, q.w) || 1;
  return {x:q.x/n, y:q.y/n, z:q.z/n, w:q.w/n};
}
function mixQuaternion(a, b, t) {
  let dot = a.x*b.x+a.y*b.y+a.z*b.z+a.w*b.w;
  if (dot < 0) { b = {x:-b.x,y:-b.y,z:-b.z,w:-b.w}; dot = -dot; }
  if (dot > .9995) return quaternion({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t,w:a.w+(b.w-a.w)*t});
  const angle = Math.acos(clamp(dot,-1,1)), s = Math.sin(angle);
  const u = Math.sin((1-t)*angle)/s, v = Math.sin(t*angle)/s;
  return quaternion({x:a.x*u+b.x*v,y:a.y*u+b.y*v,z:a.z*u+b.z*v,w:a.w*u+b.w*v});
}
function angle(a,b) { return 2*Math.acos(clamp(Math.abs(a.x*b.x+a.y*b.y+a.z*b.z+a.w*b.w),0,1)); }
export class PoseFollower {
  constructor({maxTranslation=.012,maxAngle=.10,minCutoff=2,beta=.6}={}) {
    Object.assign(this,{maxTranslation,maxAngle,minCutoff,beta}); this.reset();
  }
  reset() { this.position=null; this.orientation=null; this.raw=null; this.time=null; this.lastSeen=null; this.speed=0; this.angularSpeed=0; }
  update(position, orientation, time) {
    if (!position || !orientation) {
      if (!this.position) return null;
      const loss = Math.max(0,time-this.lastSeen);
      return {position:copy(this.position),orientation:{...this.orientation},moving:false,tracking:false,lossOpacity:clamp(1-(loss-150)/300,0,1)};
    }
    const q=quaternion(orientation);
    if (!this.position) {
      this.position=copy(position); this.orientation=q; this.raw=copy(position); this.rawQ=q; this.time=time; this.lastSeen=time;
      return {position:copy(position),orientation:{...q},moving:false,tracking:true,lossOpacity:1};
    }
    const dt=clamp((time-this.time)/1000,1/240,.05), derivativeAlpha=alpha(1,dt);
    this.speed += derivativeAlpha*(distance(position,this.raw)/dt-this.speed);
    this.angularSpeed += derivativeAlpha*(angle(q,this.rawQ)/dt-this.angularSpeed);
    const pAlpha=alpha(this.minCutoff+this.beta*this.speed,dt), qAlpha=alpha(this.minCutoff+this.beta*this.angularSpeed,dt);
    const before=this.position, beforeQ=this.orientation;
    const delta=distance(position,before), fraction=Math.min(pAlpha,this.maxTranslation/(delta||1));
    this.position={x:before.x+(position.x-before.x)*fraction,y:before.y+(position.y-before.y)*fraction,z:before.z+(position.z-before.z)*fraction};
    const turn=angle(beforeQ,q);
    this.orientation=mixQuaternion(beforeQ,q,Math.min(qAlpha,this.maxAngle/(turn||1)));
    this.raw=copy(position); this.rawQ=q; this.time=time; this.lastSeen=time;
    return {position:copy(this.position),orientation:{...this.orientation},moving:distance(before,this.position)>.0005 || angle(beforeQ,this.orientation)>.006,tracking:true,lossOpacity:1};
  }
}
