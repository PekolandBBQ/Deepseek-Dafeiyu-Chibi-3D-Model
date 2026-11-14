// Offline portrait studio. The wardrobe mirror and the private visual tool use
// these frames from the same rig, lens and materials as the room.
import * as T from "three";
import {makeWhale} from "./whale-resident.mjs";
import {outfitNames} from "./whale-wardrobe.mjs";

const renderer=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
renderer.setSize(560,752);
renderer.setClearColor(0x000000,0);
renderer.outputColorSpace=T.SRGBColorSpace;
const scene=new T.Scene();
scene.add(new T.HemisphereLight(0xfff6eb,0xb2bad3,1.57));
function light(color,power,x,y,z){
  const l=new T.DirectionalLight(color,power);l.position.set(x,y,z);scene.add(l);
}
light(0xffebd8,1.35,-3,5,4);light(0xabcaff,.93,3,1,2);light(0xdcecff,2.1,2,4,-3);
const camera=new T.OrthographicCamera(-.98,.98,1.316,-1.316,.1,15);
camera.position.set(.19,1.01,5.3);camera.lookAt(.14,.935,0);
const rig=makeWhale();scene.add(rig.model);
window.studio={
 names:outfitNames,rig,scene,camera,
 async frame(name,kind="idle",t=.45,angle=0){
   await rig.ready;await rig.setOutfit(name);rig.pose(kind,t,{snap:true});rig.model.rotation.y=angle;
   renderer.render(scene,camera);
   const c=document.createElement("canvas");c.width=560;c.height=752;
   const ctx=c.getContext("2d"),g=ctx.createLinearGradient(0,0,420,752);
   g.addColorStop(0,"#f1e9df");g.addColorStop(.42,"#e2e9ee");g.addColorStop(1,"#c9cedc");
   ctx.fillStyle=g;ctx.fillRect(0,0,560,752);
   ctx.save();ctx.translate(284,643);ctx.scale(1,.16);
   const shadow=ctx.createRadialGradient(0,0,4,0,0,142);
   shadow.addColorStop(0,"rgba(53,60,85,.26)");shadow.addColorStop(1,"rgba(53,60,85,0)");
   ctx.fillStyle=shadow;ctx.fillRect(-142,-142,284,284);ctx.restore();
   ctx.translate(560,0);ctx.scale(-1,1);ctx.drawImage(renderer.domElement,0,0);
   let visibleTriangles=0;rig.model.traverseVisible(n=>{if(n.isMesh)visibleTriangles+=(n.geometry.index?.count||n.geometry.attributes.position.count)/3;});
   return {picture:c.toDataURL("image/webp",.93),visibleTriangles};
 }
};
