import * as T from "three";

// Hair and cloth use the posed rig, including in-between frames. All contact
// distances are in the actor's own space so resizing or placing her is harmless.
export function fitMovingLayers(body,garment,arms,elbows,legs,knees,waves,trailing){
  const layers=[...new Set([...trailing,...waves])];
  const loose=layers.flatMap(bone=>bone.children.filter(mesh=>mesh.isMesh&&mesh.geometry.attributes.color));
  const inverse=new T.Matrix4(),rootInverse=new T.Matrix4();
  const p=new T.Vector3(),q=new T.Vector3(),axis=new T.Vector3(),delta=new T.Vector3();
  const world=new T.Vector3(),center=new T.Vector3(),box=new T.Box3();
  const skin=elbows.flatMap((joint,i)=>{
    const s= i===0?-1:1, palm=joint.getObjectByName("Hand");
    return [{start:arms[i],end:joint,a:new T.Vector3(),b:new T.Vector3(),radius:.091},
      {start:joint,end:palm,a:new T.Vector3(),b:new T.Vector3(),radius:.081},
      {start:palm,end:palm,a:new T.Vector3(),b:new T.Vector3(),radius:.071}];
  });
  const strands=loose.map(m=>{
    const geom=m.geometry;geom.computeBoundingBox();
    return {m,original:geom.attributes.position.array.slice(),changed:false};
  });
  const shell=garment.geometry,vertices=shell.attributes.position,base=vertices.array.slice();
  const morph=shell.morphAttributes.position;
  const legContacts=legs.flatMap((leg,i)=>[
    {start:leg,end:knees[i],a:new T.Vector3(),b:new T.Vector3(),radius:.089},
    {start:knees[i],end:knees[i].getObjectByName("MaryJane"),a:new T.Vector3(),b:new T.Vector3(),radius:.080}
  ]);
  const local=new T.Matrix4();
  function fitSkirt(){
    local.copy(garment.matrixWorld).invert();
    for(const c of legContacts){
      c.start.getWorldPosition(c.a).applyMatrix4(local);c.end.getWorldPosition(c.b).applyMatrix4(local);
      // Radius is evaluated in the dress frame; the feet extend outside its open hem.
      c.radius=(c.start.name.startsWith("Leg")?.09:.079)*legs[0].scale.y+.0035;
    }
    const [lap,lift]=garment.morphTargetInfluences;
    for(let i=0;i<vertices.count;i++){
      const off=i*3;if(base[off+1]>.11)continue;
      rest.fromArray(base,off);p.copy(rest);
      if(lap)p.addScaledVector(q.fromBufferAttribute(morph[0],i),lap);
      if(lift)p.addScaledVector(q.fromBufferAttribute(morph[1],i),lift);
      world.copy(p);
      for(const c of legContacts){
        if(!inside(p,c))continue;
        // Advance outwards along one ray. An overlapping second leg cannot
        // push this vertex back into the first leg at the seated knee.
        const direction=outward.set(rest.x*.35,0,rest.z-.01).normalize();
        let low=0,high=3*c.radius+.08;
        for(let step=0;step<10;step++){
          const t=(low+high)/2;
          if(inside(trial.copy(p).addScaledVector(direction,t),c))low=t;else high=t;
        }
        p.addScaledVector(direction,high);
      }
      p.sub(world).add(rest);vertices.setXYZ(i,p.x,p.y,p.z);
    }
    vertices.needsUpdate=true;
  }
  const rest=new T.Vector3(),outward=new T.Vector3(),trial=new T.Vector3();
  function inside(pos,c){
    axis.subVectors(c.b,c.a);
    const t=T.MathUtils.clamp(delta.subVectors(pos,c.a).dot(axis)/(axis.lengthSq()||1),0,1);
    return q.copy(c.a).addScaledVector(axis,t).distanceToSquared(pos)<c.radius*c.radius;
  }
  function push(pos,collider){
    axis.subVectors(collider.b,collider.a);
    const t=T.MathUtils.clamp(delta.subVectors(pos,collider.a).dot(axis)/(axis.lengthSq()||1),0,1);
    q.copy(collider.a).addScaledVector(axis,t);delta.subVectors(pos,q);
    const length=delta.length();
    if(length>=collider.radius)return false;
    if(length<1e-8)delta.set(1,0,0);
    pos.copy(q).addScaledVector(delta,collider.radius/(length||1));
    return true;
  }
  return ()=>{
    const model=body.parent;model.updateWorldMatrix(true,true);rootInverse.copy(model.matrixWorld).invert();
    fitSkirt();
    for(const c of skin){
      c.start.getWorldPosition(c.a).applyMatrix4(rootInverse);c.end.getWorldPosition(c.b).applyMatrix4(rootInverse);
    }
    for(const strand of strands){
      const {m,original}=strand,g=m.geometry,attr=g.attributes.position;
      local.multiplyMatrices(rootInverse,m.matrixWorld);
      inverse.copy(local).invert();box.copy(g.boundingBox).applyMatrix4(local);
      const candidates=skin.filter(c=>{
        center.copy(c.a).lerp(c.b,.5);return box.distanceToPoint(center)<=c.radius+.5*c.a.distanceTo(c.b);
      });
      if(!candidates.length&&!strand.changed)continue;
      let changed=false;attr.array.set(original);
      for(let i=0;i<attr.count&&candidates.length;i++){
        rest.fromArray(original,i*3);p.copy(rest).applyMatrix4(local);
        let moved=false;
        for(const c of candidates)if(push(p,c))moved=true;
        if(moved){p.applyMatrix4(inverse);attr.setXYZ(i,p.x,p.y,p.z);changed=true;}
      }
      attr.needsUpdate=true;strand.changed=changed;
    }
  };
}
