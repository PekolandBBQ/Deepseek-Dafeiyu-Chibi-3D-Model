import assert from "node:assert/strict";
import {runBrowser} from "./browser.mjs";

// Intersect vertical lines with the actual indexed mesh triangles. The grid
// accelerates lookups without rounding the sampled surface heights.
async function measure(){
  function surfaceGrid(mesh){
    const {position}=mesh.geometry.attributes,indices=mesh.geometry.index.array;
    const cells=new Map(),pitch=.025;
    const key=(x,z)=>x*65536+z;
    for(let i=0;i<indices.length;i+=3){
      const [a,b,c]=[indices[i],indices[i+1],indices[i+2]];
      const ax=position.getX(a),ay=position.getY(a),az=position.getZ(a);
      const bx=position.getX(b)-ax,by=position.getY(b)-ay,bz=position.getZ(b)-az;
      const cx=position.getX(c)-ax,cy=position.getY(c)-ay,cz=position.getZ(c)-az;
      const det=bx*cz-bz*cx;
      if(Math.abs(det)<1e-12)continue;
      const triangle={ax,ay,az,bx,by,bz,cx,cy,cz,det};
      for(let x=Math.floor((ax+Math.min(0,bx,cx))/pitch);x<=Math.floor((ax+Math.max(0,bx,cx))/pitch);x++){
        for(let z=Math.floor((az+Math.min(0,bz,cz))/pitch);z<=Math.floor((az+Math.max(0,bz,cz))/pitch);z++){
          const cell=key(x,z);
          if(!cells.has(cell))cells.set(cell,[]);
          cells.get(cell).push(triangle);
        }
      }
    }
    return point=>{
      let low=Infinity,high=-Infinity;
      const nearby=cells.get(key(Math.floor(point.x/pitch),Math.floor(point.z/pitch)))||[];
      for(const t of nearby){
        const dx=point.x-t.ax,dz=point.z-t.az;
        const u=(dx*t.cz-dz*t.cx)/t.det,v=(t.bx*dz-t.bz*dx)/t.det;
        if(u< -1e-6||v< -1e-6||u+v>1.000001)continue;
        const y=t.ay+u*t.by+v*t.cy;
        low=Math.min(low,y);high=Math.max(high,y);
      }
      return [low,high];
    };
  }

  const {rig,names,camera}=window.studio;
  await rig.ready;
  const {model}=rig;
  const face=model.getObjectByName("FaceInk"),body=model.getObjectByName("Body");
  const neck=model.getObjectByName("Neck"),core=model.getObjectByName("BodyCore");
  const skin=model.getObjectByName("WhaleFace");
  const faceRange=surfaceGrid(face),skinRange=surfaceGrid(skin),coreRange=surfaceGrid(core);
  const point=body.position.clone(),probe=point.clone();
  const matrix=body.matrix.clone(),relative=body.matrix.clone();
  // Sample the full ten-second motion clips and the left/right gaze extremes.
  const sampleTimes=[.45,...Array.from({length:21},(_,i)=>i/2),Math.PI/(2*.74),3*Math.PI/(2*.74)];
  const poses=["idle","walk","read","bench-read","write","water","pet","stroke","look",
    "hug","sleep","fetch","bench","swing","contact","think","fish","paint","play","listen",
    "watch","browse","invite","yard"];
  const frames=poses.flatMap(pose=>sampleTimes.map(time=>({pose,time,check:true,snap:true})));
  // Move continuously through the left glance and a series of outfit-stressing
  // actions. Advance every physics frame; measure every third frame of each blend.
  for(const pose of ["think","read","sleep","pet","walk","look"]){
    for(let tick=0;tick<21;tick++){
      frames.push({pose,time:6+tick/30,snap:false,check:tick%3===0});
    }
  }
  const fits=[];
  for(const name of names){
    await rig.setOutfit(name);rig.pose("idle",.45,{snap:true});model.updateMatrixWorld(true);
    const worn=model.getObjectByName("Wearables_Body");
    const probes=[];
    // Include the skirt neckline, outfit-specific ornaments, their outlines,
    // capes and shoulder trims. Follow only vertices referenced by the draw
    // index; an overlay can share the full skirt's otherwise unused vertices.
    worn.traverseVisible(mesh=>{
      if(!mesh.isMesh)return;
      const attr=mesh.geometry.attributes.position;
      const ids=mesh.geometry.index?new Set(mesh.geometry.index.array):Array.from({length:attr.count},(_,i)=>i);
      const indices=[];
      relative.copy(body.matrixWorld).invert().multiply(mesh.matrixWorld);
      for(const id of ids){
        mesh.getVertexPosition(id,point).applyMatrix4(relative);
        if(point.y>.18&&Math.abs(point.x)<.30)indices.push(id);
      }
      if(indices.length)probes.push({mesh,indices});
    });
    const result={outfit:name,clearance:Infinity,frontGap:Infinity,idleGap:null,
      headJoin:Infinity,bodyJoin:Infinity,closest:"",tightestView:"",samples:0};
    const bounds=neck.geometry.attributes.position;
    for(const {pose,time,check,snap} of frames){
      rig.pose(pose,time,{snap,blend:!snap,dt:snap?0:1/30});
      if(!check)continue;
      model.updateMatrixWorld(true);
      const headInv=face.matrixWorld.clone().invert(),skinInv=skin.matrixWorld.clone().invert();
      camera.updateMatrixWorld();
      const view=camera.matrixWorldInverse,verticalScale=face.getWorldScale(probe).y,coreInv=core.matrixWorld.clone().invert();
      let chin=Infinity,trim=-Infinity,headJoin=0,bodyJoin=0;
      // Vertical screen-space projection in the orthographic wardrobe mirror.
      const center=body.getWorldPosition(probe).applyMatrix4(view).x;
      matrix.copy(view).multiply(face.matrixWorld);
      const facePoints=face.geometry.attributes.position;
      for(let i=0;i<facePoints.count;i++){
        if(facePoints.getY(i)>-.25)continue;
        point.fromBufferAttribute(facePoints,i).applyMatrix4(matrix);
        if(Math.abs(point.x-center)<.034)chin=Math.min(chin,point.y);
      }
      relative.copy(body.matrixWorld).invert();
      for(const {mesh,indices} of probes){
        matrix.copy(headInv).multiply(mesh.matrixWorld);
        for(const id of indices){
          mesh.getVertexPosition(id,point);
          probe.copy(point).applyMatrix4(matrix);
          const [bottom]=faceRange(probe);
          const clearance=(bottom-probe.y)*verticalScale;
          if(clearance<result.clearance){
            result.clearance=clearance;result.closest=pose+" / "+mesh.name;
          }
          probe.copy(point).applyMatrix4(mesh.matrixWorld);
          point.copy(probe).applyMatrix4(relative);
          probe.applyMatrix4(view);
          if(point.z>.055&&Math.abs(probe.x-center)<.032)trim=Math.max(trim,probe.y);
        }
      }
      for(let i=0;i<bounds.count;i++){
        neck.getVertexPosition(i,point).applyMatrix4(neck.matrixWorld);
        probe.copy(point).applyMatrix4(skinInv);
        const [low,high]=skinRange(probe);
        headJoin=Math.max(headJoin,Math.min(probe.y-low,high-probe.y));
        probe.copy(point).applyMatrix4(coreInv);
        const [base,top]=coreRange(probe);
        bodyJoin=Math.max(bodyJoin,Math.min(probe.y-base,top-probe.y));
      }
      const gap=chin-trim;
      if(gap<result.frontGap){result.frontGap=gap;result.tightestView=pose;}
      if(pose==="idle"&&time===sampleTimes[0])result.idleGap=gap;
      result.headJoin=Math.min(headJoin,result.headJoin);result.bodyJoin=Math.min(bodyJoin,result.bodyJoin);
      result.samples++;
    }
    fits.push(result);
  }
  return fits;
}
await runBrowser(async(page,url)=>{
  await page.goto(url+"/studio.html");await page.waitForFunction(()=>Boolean(window.studio?.rig));
  const result=await page.evaluate(measure);
  console.table(result.map(r=>({...r,...Object.fromEntries(["clearance","frontGap","idleGap","headJoin","bodyJoin"]
    .map(key=>[key,Number(r[key].toFixed(4))]))})));
  assert.equal(result.length,8,"expected the complete wardrobe");
  for(const r of result){
    assert([r.clearance,r.frontGap,r.idleGap].every(Number.isFinite),r.outfit+" is missing a neckline or chin");
    assert(r.clearance>.001,r.outfit+" touches the chin in "+r.closest);
    assert(r.frontGap>.002,r.outfit+" is hidden by the chin in "+r.tightestView);
    assert(r.idleGap<.10,r.outfit+" leaves an excessively long visible neck in the mirror");
    assert(r.headJoin>.002&&r.bodyJoin>.002,r.outfit+" has a floating head or neck");
  }
});
