import assert from "node:assert/strict";
import {runBrowser} from "./browser.mjs";

await runBrowser(async(page,url)=>{
  await page.goto(url+"/studio.html");
  await page.waitForFunction(()=>Boolean(window.studio?.rig));
  const results=await page.evaluate(async()=>{
    const {rig}=window.studio;
    await rig.ready;
    await rig.setOutfit("蓝鲸女仆");
    const {model,lace}=rig;
    const trim=lace.meshes.find(m=>m.name==="女仆扇贝花边袖口");
    const start=trim.userData.laceMorphStart;
    const modes=trim.geometry.morphAttributes.position.slice(start,start+3);
    const weights=()=>trim.morphTargetInfluences.slice(start,start+3);
    let fixed=0,free=0;
    for(let i=0;i<trim.geometry.attributes.position.count;i++){
      const excursion=Math.max(...modes.map(a=>Math.hypot(a.getX(i),a.getY(i),a.getZ(i))));
      if(excursion<1e-8)fixed++;
      if(excursion>.001)free++;
    }
    // Replay the same motion of the whole rig, holding the bones in their
    // initial pose. The second second is stationary so only the spring settles.
    const initialX=model.position.x;
    function sample(hz){
      model.position.x=initialX;
      lace.update(0,{snap:true});
      const samples=[];
      for(let i=1;i<=hz*2;i++){
        model.position.x=initialX+.12*Math.min(i/hz,1);
        lace.update(1/hz);
        if(i%(hz/2)===0)samples.push(weights());
      }
      return samples;
    }
    const rates=[30,60,120].map(sample);
    model.position.x=initialX+2;lace.update(1/60);
    const reset=weights();
    model.position.x=initialX;lace.reset();
    const arm=model.getObjectByName("ArmSkinL");
    const previous=[...lace.meshes];
    await rig.setOutfit("睡衣");
    const attached=new Set();model.traverse(n=>attached.add(n));
    return {fixed,free,rates,reset,modes:modes.length,
      retainedArm:!!arm&&attached.has(arm),
      replaced:previous.every(mesh=>!attached.has(mesh)&&!lace.meshes.includes(mesh)),
      current:lace.meshes.length>0&&lace.meshes.every(mesh=>attached.has(mesh))};
  });
  assert.equal(results.modes,3);
  assert(results.fixed>0&&results.free>0,"cuff needs both pinned and deformable vertices");
  const magnitude=a=>Math.max(...a.map(Math.abs));
  for(const samples of results.rates){
    assert(magnitude(samples[1])>.01,"free edge did not respond to motion");
    assert(magnitude(samples[3])<.001,"free edge did not settle after stopping");
    for(let i=0;i<samples.length;i++){
      const difference=samples[i].map((v,j)=>v-results.rates[2][i][j]);
      assert(magnitude(difference)<.002,"lace response changed with frame rate");
    }
  }
  assert.equal(magnitude(results.reset),0,"teleport retained the previous spring state");
  assert(results.replaced&&results.current&&results.retainedArm,"outfit switch left a stale trim or removed the arm");
  console.log("通过：袖口根边固定、活动边回弹、30/60/120 FPS 一致、瞬移复位、换装保留角色并替换饰边");
});
