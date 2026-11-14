import * as T from "three";

// Follow a point on the authored silhouette with a damped mass. Measuring in
// world space includes footsteps, head tilts and movement of the whole actor.
// Each link samples after its parent, so an impulse travels down the tail.
export function finAndTailInertia(fins,tail,bend,flukes){
  const links=[];
  const target=new T.Vector3(),speed=new T.Vector3(),velocity=new T.Vector3(),up=new T.Vector3();
  function link(bone,tip,lever,frequency,damping,limit){
    links.push({bone,tip:new T.Vector3(...tip),lever,frequency,damping,limit,
      previous:new T.Vector3(),speed:new T.Vector3(),offset:new T.Vector3(),velocity:new T.Vector3(),
      angle:0,ready:false});
  }
  fins.forEach((fin,i)=>link(fin,[(i?1:-1)*.27,-.10,0],(i?1:-1)*.27,16,.62,.095));
  link(tail,[.40,-.21,-.25],.40,18,.76,.035);
  link(bend,[.43,.257,-.07],.43,15,.68,.045);
  link(flukes,[.21,.19,0],.22,13,.66,.065);

  function removeOffsets(){
    for(const s of links)s.bone.rotation.z-=s.angle;
  }
  function update(dt,snap){
    for(const s of links){
      const b=s.bone;
      b.localToWorld(target.copy(s.tip));
      // The local Y axis includes parent tilt (in particular a sleeping actor)
      // and scale. Its inverse length converts displacement back to rig units.
      up.setFromMatrixColumn(b.matrixWorld,1);
      const scale=up.length();
      if(!s.ready || snap || !Number.isFinite(dt) || dt>.2 || target.distanceTo(s.previous)>.32*scale){
        s.offset.setScalar(0);s.velocity.setScalar(0);s.speed.setScalar(0);s.angle=0;s.ready=true;
      }else if(dt>0){
        speed.subVectors(target,s.previous).divideScalar(dt);
        velocity.copy(s.velocity).add(s.speed).sub(speed);
        // Exact response for a linearly moving target during this frame.
        const a=s.frequency*s.damping, w=Math.sqrt(s.frequency**2-a*a);
        const decay=Math.exp(-a*dt), c=Math.cos(w*dt), k=Math.sin(w*dt)/w;
        s.velocity.copy(velocity).multiplyScalar(decay*(c-a*k))
          .addScaledVector(s.offset,-decay*s.frequency**2*k);
        s.offset.multiplyScalar(decay*(c+a*k)).addScaledVector(velocity,decay*k);
        s.speed.copy(speed);
        const angle=s.offset.dot(up)/(scale*scale*s.lever);
        s.angle=s.limit*Math.tanh(angle/s.limit);
      }
      s.previous.copy(target);
      b.rotation.z+=s.angle;
    }
  }
  return {removeOffsets,update};
}
