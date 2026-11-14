import assert from "node:assert/strict";
import {build} from "esbuild";
import {runBrowser} from "./browser.mjs";
import {root} from "./build.mjs";

// Load two copies of the production rig in the same browser. The snapped
// reference below removes authored locomotion and isolates secondary motion.
async function measure(){
  const {makeWhale}=await import("/fin-tail-test.js");
  const reference=makeWhale(()=>{},{bodyOnly:true});
  const dressed=window.studio.rig;
  const body=makeWhale(()=>{},{bodyOnly:true});
  await Promise.all([body.ready,reference.ready,dressed.ready]);
  const names=["FinBase-1","FinBase1","WhaleTail","TailBend","Flukes"];
  function nodes(rig){return names.map(name=>rig.model.getObjectByName(name));}
  const baseline=nodes(reference),bareBones=nodes(body),dressedBones=nodes(dressed);
  function read(source){
    return source.map((bone,i)=>bone.rotation.z-baseline[i].rotation.z);
  }
  function reset(rig,kind,t=0){
    rig.model.position.set(0,0,0);
    rig.pose(kind,t,{snap:true});
  }
  function clip(rig,bones,kind,hz){
    reset(rig,kind);reset(reference,kind);
    const samples=[];
    for(let frame=1;frame<=hz*3;frame++){
      const t=frame/hz;
      rig.pose(kind,t,{dt:1/hz});
      if(frame%(hz/30)===0){
        reference.pose(kind,t,{snap:true});
        samples.push(read(bones));
      }
    }
    return samples;
  }
  const walk=clip(body,bareBones,"walk",60);
  const dressedWalk=clip(dressed,dressedBones,"walk",60);

  // Hold the authored pose at the exact stopping frame. Its legs and face
  // therefore have identical transforms throughout the settling interval.
  const stop=[];
  for(let i=1;i<=90;i++){
    body.pose("walk",3,{dt:1/60});reference.pose("walk",3,{snap:true});
    stop.push(read(bareBones));
  }
  const idle=clip(body,bareBones,"idle",60);
  // Translate the actor vertically with a smooth 200 ms half-cosine rise.
  // A single, repeatable impact isolates ear symmetry and tail phase delay.
  function impulse(hz){
    reset(body,"idle");reset(reference,"idle");
    const samples=[];
    for(let frame=1;frame<=hz;frame++){
      const t=frame/hz;
      body.model.position.y=.06*(1-Math.cos(Math.PI*Math.min(t/.2,1)))/2;
      body.pose("idle",0,{dt:1/hz});
      if(frame%(hz/30)===0)samples.push(read(bareBones));
    }
    return samples;
  }
  const rates=[30,60,120].map(impulse);
  // Start each reset from an excited walking frame, then compare every joint
  // with a snapped instance at the destination (including a timeline scrub).
  function discontinuity(type){
    reset(body,"walk");
    for(let i=1;i<=36;i++)body.pose("walk",i/60,{dt:1/60});
    reference.pose("walk",.6,{snap:true});
    const before=read(bareBones);
    let t=.6,options={dt:1/60};
    if(type==="teleport")body.model.position.y+=1.3;
    if(type==="frame gap")options.dt=.8;
    if(type==="scrub"){t=5.2;options={snap:true};}
    body.pose("walk",t,options);reference.pose("walk",t,{snap:true});
    return {before,after:read(bareBones)};
  }
  const resets=["teleport","frame gap","scrub"].map(discontinuity);
  reference.dispose();body.dispose();
  return {walk,idle,dressedWalk,stop,rates,resets};
}

await runBrowser(async(page,url)=>{
  // Serve the model factory only for this test, keeping it out of the
  // production viewer's public API. It renders the same resident as the room.
  const {outputFiles}=await build({absWorkingDir:root,bundle:true,format:"esm",
    entryPoints:["src/panels/whale-resident.mjs"],write:false});
  await page.route("**/fin-tail-test.js",route=>route.fulfill({
    contentType:"text/javascript",body:Buffer.from(outputFiles[0].contents)
  }));
  await page.goto(url+"/studio.html");
  await page.waitForFunction(()=>Boolean(window.studio?.rig));
  const {walk,idle,dressedWalk,stop,rates,resets}=await page.evaluate(measure);
  const max=values=>Math.max(...values.map(Math.abs));
  const peak=(samples,j)=>max(samples.map(row=>row[j]));
  const difference=(a,b)=>Math.max(...a.map((row,i)=>max(row.map((x,j)=>x-b[i][j]))));
  const degree=180/Math.PI;
  const names=["左耳鳍","右耳鳍","尾根","尾中","尾尖"];
  const peaks=names.map((joint,j)=>({
    joint,idleDegrees:peak(idle,j)*degree,walkDegrees:peak(walk,j)*degree,
    stopDegrees:peak(stop.slice(0,15),j)*degree
  }));
  console.table(peaks);
  for(const [i,link] of peaks.entries()){
    assert(link.walkDegrees>link.idleDegrees+.25,link.joint+" lacks a stronger walking response");
    assert(link.stopDegrees>.15,link.joint+" stopped rigidly on the first frame");
    assert(peak(stop.slice(-10),i)<.0002,link.joint+" still oscillates after the actor stops");
  }
  assert(difference(walk,dressedWalk)<.00001,"wearing clothing changed fin or tail response");
  const frameErrors=rates.slice(0,2).map(samples=>difference(samples,rates[2]));
  console.log("30/60 FPS vs 120 FPS, max angular error (deg)",frameErrors.map(e=>e*degree));
  for(const error of frameErrors)assert(error<.015,"spring response changed with frame rate");
  const response=rates[2];
  // Mirrored ear bones rotate with opposite local signs for the same lift.
  assert(peak(response,0)>.02&&peak(response,1)>.02,"vertical motion did not reach both ear fins");
  assert(max(response.map(row=>row[0]+row[1]))<.002,"ear tips disagreed on up/down direction");
  // Track the rebound of each link after its downward deflection. An early
  // counter-rotation in a child compensates for its parent's initial bend.
  const rebound=[2,3,4].map(j=>{
    const trough=response.reduce((m,row,i)=>row[j]<response[m][j]?i:m,0);
    const first=response.findIndex((row,i)=>i>trough&&row[j]>.001);
    assert(first>=0,"tail joint never rebounded");
    return (first+1)/30;
  });
  console.log("Tail root / middle / tip rebound onset (s)",rebound);
  assert(rebound[1]>rebound[0]&&rebound[2]>rebound[1],"tail rebound did not propagate to the tip");
  for(const {before,after} of resets){
    assert(max(before)>.009,"reset case did not begin with a moving rig");
    assert(max(after)<1e-8,"discontinuous placement or seek retained the old impulse");
  }
});
