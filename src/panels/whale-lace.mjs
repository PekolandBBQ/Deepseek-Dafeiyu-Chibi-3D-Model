import * as T from "three";

const fixedStep=1/120;
const modeNames=["laceSlide","laceFlutter","laceLift"];
const clamp=T.MathUtils.clamp;

function vector(value){
  return value?.isVector3?value.clone():new T.Vector3().fromArray(value);
}

function direction(source,i,fallback){
  if(!source)return fallback.clone();
  if(source.isBufferAttribute)return new T.Vector3().fromBufferAttribute(source,i);
  if(typeof source==="function")return vector(source(i));
  if(source.isVector3||typeof source[0]==="number"&&source.length===3)return vector(source);
  if(typeof source[0]==="number")return new T.Vector3().fromArray(source,i*3);
  return vector(source[i]);
}

// Each cross-section is specified from its sewn edge to its free edge in parent space.
function ribbonGeometry(frames,opts){
  const closed=!!opts.closed;
  const points=frames.map(f=>({root:vector(f.root),hem:vector(f.hem),normal:f.normal?vector(f.normal):null}));
  if(closed&&points.length>1&&points[0].root.distanceToSquared(points.at(-1).root)<1e-12)points.pop();
  if(points.length<(closed?3:2))throw new Error("A lace strip needs at least two sections, or three for a loop");
  const lobes=Math.max(1,Math.round(opts.scallops??Math.max(3,points.length/3)));
  const divisions=Math.max(points.length-(closed?0:1),lobes*10);
  const columns=closed?divisions:divisions+1;
  const rows=Math.max(6,Math.round(opts.widthSegments??6));
  const thickness=opts.thickness??.0011;
  const shape=new T.BufferGeometry(),vertices=[],indices=[],weights=[],normals=[],tangents=[];
  const front=(col,row)=>col*(rows+1)+row;
  const back=columns*(rows+1);
  const centers=[];
  for(let i=0;i<columns;i++){
    const u=i/divisions;
    const segment=u*(points.length-(closed?0:1)),j=Math.floor(segment),a=points[j],b=points[(j+1)%points.length];
    const mix=segment-j;
    centers.push({root:a.root.clone().lerp(b.root,mix),hem:a.hem.clone().lerp(b.hem,mix),
      normal:a.normal&&b.normal?a.normal.clone().lerp(b.normal,mix).normalize():null});
  }
  for(let face=0;face<2;face++){
    for(let i=0;i<columns;i++){
      const here=centers[i],before=centers[closed?(i+columns-1)%columns:Math.max(0,i-1)];
      const after=centers[closed?(i+1)%columns:Math.min(i+1,columns-1)];
      const along=after.root.clone().sub(before.root).normalize();
      const strip=here.hem.clone().sub(here.root),width=strip.length();
      const normal=here.normal??along.clone().cross(strip).normalize();
      const phase=2*Math.PI*lobes*i/divisions;
      const period=.5-.5*Math.cos(phase);
      for(let j=0;j<=rows;j++){
        const across=j/rows;
        const gather=(opts.depth??width*.17)*(.25+.75*period)*across**1.5;
        const v=here.root.clone().addScaledVector(strip,across*(1+.22*period*across**2))
          .addScaledVector(normal,gather+face*thickness);
        vertices.push(...v.toArray());
        normals.push(...normal.toArray());tangents.push(...along.toArray());weights.push(across);
      }
    }
  }
  // Two faces and a narrow wall at every exposed edge, including each eyelet.
  const boundary=new Map();
  function edge(a,b){
    const key=Math.min(a,b)+"/"+Math.max(a,b);
    if(boundary.has(key))boundary.delete(key);else boundary.set(key,[a,b]);
  }
  for(let i=0;i<divisions;i++){
    const next=(i+1)%columns;
    for(let j=0;j<rows;j++){
      const within=((i+.5)/divisions*lobes)%1;
      if(opts.eyelets!==false&&j===Math.floor(rows*.55)&&Math.abs(within-.5)<.11)continue;
      const a=front(i,j),b=front(next,j),c=front(next,j+1),d=front(i,j+1);
      indices.push(a+back,b+back,c+back,a+back,c+back,d+back,a,c,b,a,d,c);
      edge(a,b);edge(b,c);edge(c,d);edge(d,a);
    }
  }
  for(const [a,b] of boundary.values())indices.push(a,b,b+back,a,b+back,a+back);
  shape.setIndex(indices);shape.setAttribute("position",new T.Float32BufferAttribute(vertices,3));
  shape.computeVertexNormals();
  return {shape,weights,normal:normals,tangent:tangents};
}

export function createLaceDynamics(model){
  const entries=[];
  const selfMade=new Map();
  const meshList=[];
  const matrix=new T.Matrix4();
  const position=new T.Vector3(),displacement=new T.Vector3(),input=new T.Vector3(),stepTarget=new T.Vector3();
  const targetVelocity=new T.Vector3(),force=new T.Vector3(),worldScale=new T.Vector3();

  function registerLace(mesh,weights,options={}){
    if(meshList.includes(mesh))return mesh;
    const src=mesh.geometry,points=src.getAttribute("position");
    if(!points||weights.length!==points.count)throw new Error("Lace needs one pin weight per vertex");
    const owned=selfMade.has(mesh);
    // External meshes may share the rest geometry, e.g. on both wrists.
    const geom=owned?src:src.clone();
    if(!geom.getAttribute("normal"))geom.computeVertexNormals();
    const originals=geom.morphAttributes.position??[];
    const prior=mesh.morphTargetInfluences??[];
    const priorDictionary=mesh.morphTargetDictionary;
    const relative=originals.length?geom.morphTargetsRelative:true;
    const start=originals.length,travel=options.maxTravel??.009;
    if(!Number.isFinite(travel)||travel<=0)throw new Error("Lace travel must be positive and finite");
    const modes=modeNames.map(()=>new Float32Array(points.count*3));
    const average=new T.Vector3(),tangentSum=new T.Vector3(),normalSum=new T.Vector3();
    const p=new T.Vector3(),fallback=new T.Vector3(),bitangent=new T.Vector3(),axis=new T.Vector3();
    let weightSum=0,largestWeight=-1;
    const probe=new T.Vector3();
    for(let i=0;i<points.count;i++){
      p.fromBufferAttribute(points,i);
      const w=clamp(weights[i],0,1)**1.7;
      fallback.fromBufferAttribute(geom.attributes.normal,i);
      const n=direction(options.normal,i,fallback).normalize();
      axis.set(Math.abs(n.x)<.8?1:0,Math.abs(n.x)<.8?0:1,0);
      const t=direction(options.tangent,i,axis);
      t.addScaledVector(n,-t.dot(n));
      if(t.lengthSq()<1e-10)t.copy(axis).addScaledVector(n,-axis.dot(n));
      t.normalize();bitangent.crossVectors(n,t).normalize();
      // The first two modes slide across the garment, the third can only lift away.
      for(const [k,dir] of [t,bitangent,n].entries()){
        const mag=travel*w*(k===1?.65:1);
        modes[k][3*i]=(relative?0:p.x)+dir.x*mag;
        modes[k][3*i+1]=(relative?0:p.y)+dir.y*mag;
        modes[k][3*i+2]=(relative?0:p.z)+dir.z*mag;
      }
      average.addScaledVector(p,w);tangentSum.addScaledVector(t,w);normalSum.addScaledVector(n,w);weightSum+=w;
      if(w>largestWeight){largestWeight=w;probe.copy(p);}
    }
    if(!weightSum)throw new Error("Lace needs at least one free vertex");
    average.divideScalar(weightSum);
    const attrs=modes.map((v,i)=>{const attr=new T.Float32BufferAttribute(v,3);attr.name=modeNames[i];return attr;});
    geom.morphAttributes.position=[...originals,...attrs];
    // Keep garment normals where provided. Build the other target normals from
    // their deformed surface, so folds and ruffles keep their highlights.
    const oldNormals=geom.morphAttributes.normal??[];
    const restNormal=geom.attributes.normal;
    const morphNormals=oldNormals.slice();
    for(const attr of geom.morphAttributes.position.slice(oldNormals.length)){
      const scratch=new T.BufferGeometry();scratch.setIndex(geom.index);
      const xyz=new Float32Array(points.count*3);
      for(let i=0;i<points.count;i++){
        p.fromBufferAttribute(attr,i);
        if(relative)p.add(fallback.fromBufferAttribute(points,i));
        p.toArray(xyz,i*3);
      }
      scratch.setAttribute("position",new T.BufferAttribute(xyz,3));scratch.computeVertexNormals();
      const a=scratch.attributes.normal;
      if(relative)for(let i=0;i<points.count;i++){
        p.fromBufferAttribute(a,i).sub(fallback.fromBufferAttribute(restNormal,i));p.toArray(a.array,i*3);
      }
      morphNormals.push(a);scratch.dispose();
    }
    geom.morphAttributes.normal=morphNormals;geom.morphTargetsRelative=relative;
    mesh.geometry=geom;mesh.updateMorphTargets();
    for(let i=0;i<start;i++)mesh.morphTargetInfluences[i]=prior[i]??0;
    const driver=options.driver??mesh;
    mesh.updateWorldMatrix(true,false);driver.updateWorldMatrix(true,false);
    const anchor=options.anchor?vector(options.anchor):driver.worldToLocal(mesh.localToWorld(average.lerp(probe,.28)));
    if(tangentSum.lengthSq()<1e-8)tangentSum.set(1,0,0);
    if(normalSum.lengthSq()<1e-8)normalSum.set(0,0,1);
    const tangent=tangentSum.normalize(),normal=normalSum.normalize();
    tangent.addScaledVector(normal,-tangent.dot(normal));
    if(tangent.lengthSq()<1e-8){
      tangent.set(Math.abs(normal.x)<.8?1:0,Math.abs(normal.x)<.8?0:1,0);
      tangent.addScaledVector(normal,-tangent.dot(normal));
    }
    tangent.normalize();
    const across=normal.clone().cross(tangent).normalize();
    // Sample slightly off the pin line as well. A neck roll or a skirt turning
    // in place moves its free fabric even when the attachment's origin is still.
    const localProbe=driver.worldToLocal(mesh.localToWorld(probe));
    anchor.lerp(localProbe,.23);
    const entry={mesh,driver,anchor,start,travel,src,prior,priorDictionary,owned,
      axes:[tangent,across,normal],previous:new T.Vector3(),free:new T.Vector3(),velocity:new T.Vector3(),ready:false,
      lastTickAnchor:new T.Vector3(),remainder:0};
    mesh.userData.laceMorphStart=start;
    entries.push(entry);meshList.push(mesh);
    return mesh;
  }

  function addLace(parent,name,frames,options={}){
    const {shape,weights,normal,tangent}=ribbonGeometry(frames,options);
    const material=options.material??new T.MeshPhysicalMaterial({color:options.color??0xfff3e4,side:T.DoubleSide,
      roughness:.79,sheen:.37,sheenColor:0xffede7});
    const mesh=new T.Mesh(shape,material);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;
    parent.add(mesh);selfMade.set(mesh,options.material?null:material);
    return registerLace(mesh,weights,{...options,normal,tangent});
  }

  function restart(e,p){
    e.previous.copy(p);e.lastTickAnchor.copy(p);e.free.copy(p);e.velocity.set(0,0,0);e.remainder=0;e.ready=true;
    e.mesh.morphTargetInfluences.fill(0,e.start,e.start+3);
  }
  function reset(){
    for(const e of entries){e.ready=false;e.mesh.morphTargetInfluences.fill(0,e.start,e.start+3);}
  }
  function update(dt,{snap=false}={}){
    if(!entries.length)return;
    model.updateWorldMatrix(true,true);
    for(const e of entries){
      position.copy(e.anchor).applyMatrix4(e.driver.matrixWorld);
      worldScale.setFromMatrixScale(e.mesh.matrixWorld);
      const scale=Math.max(1e-4,Math.abs(worldScale.x),Math.abs(worldScale.y),Math.abs(worldScale.z));
      if(!e.ready||snap||!Number.isFinite(dt)||dt<=0||dt>.2||position.distanceTo(e.previous)>.30*scale){
        restart(e,position);continue;
      }
      // Interpolate sampled anchor positions to fixed ticks; partial ticks survive
      // frame boundaries. A freely damped spring responds to translation and turns.
      let spent=fixedStep-e.remainder;
      while(spent<=dt+1e-9){
        stepTarget.lerpVectors(e.previous,position,clamp(spent/dt,0,1));
        targetVelocity.subVectors(stepTarget,e.lastTickAnchor).multiplyScalar(1/fixedStep);
        force.subVectors(stepTarget,e.free).multiplyScalar(235)
          .addScaledVector(targetVelocity,17).addScaledVector(e.velocity,-20);
        e.velocity.addScaledVector(force,fixedStep);e.free.addScaledVector(e.velocity,fixedStep);
        e.lastTickAnchor.copy(stepTarget);spent+=fixedStep;
      }
      e.remainder=clamp(dt-(spent-fixedStep),0,fixedStep);e.previous.copy(position);
      displacement.copy(e.free).addScaledVector(e.velocity,e.remainder).sub(position);
      matrix.copy(e.mesh.matrixWorld).invert();
      // Apply only the inverse linear part to the world-space displacement.
      const m=matrix.elements,x=displacement.x,y=displacement.y,z=displacement.z;
      input.set(m[0]*x+m[4]*y+m[8]*z,m[1]*x+m[5]*y+m[9]*z,m[2]*x+m[6]*y+m[10]*z);
      const a=input.dot(e.axes[0])/e.travel,b=input.dot(e.axes[1])/e.travel,c=input.dot(e.axes[2])/e.travel;
      // Budget the vector as a whole. A diagonal movement must not move the free
      // edge twice as far as the seam's chosen garment allowance.
      const lift=Math.max(0,c+.22*Math.hypot(a,b));
      const budget=Math.max(1,Math.hypot(a,b,lift));
      const values=e.mesh.morphTargetInfluences;
      values[e.start]=a/budget;values[e.start+1]=b/budget;values[e.start+2]=lift/budget;
    }
  }
  function clear(){
    for(const e of entries){
      const m=e.mesh;delete m.userData.laceMorphStart;
      if(e.owned){m.removeFromParent();m.geometry.dispose();selfMade.get(m)?.dispose();}
      else{m.geometry.dispose();m.geometry=e.src;m.morphTargetInfluences=e.prior;m.morphTargetDictionary=e.priorDictionary;}
    }
    entries.length=0;meshList.length=0;selfMade.clear();
  }
  return {addLace,registerLace,update,reset,clear,meshes:meshList};
}
