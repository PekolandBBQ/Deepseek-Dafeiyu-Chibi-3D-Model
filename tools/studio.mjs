import "../src/panels/whale-portrait.mjs";
import {buildGLB} from "../src/panels/export-toon.mjs";
import "../src/panels/home-room-3d.source.js";
import {GLTFExporter} from "three/addons/exporters/GLTFExporter.js";
import {readDemoState} from "../src/demo-state.mjs";
async function encoded(buffer){
  const file=new Blob([buffer]);
  return new Promise((ok,fail)=>{
    const reader=new FileReader();
    reader.onload=()=>ok(reader.result.split(",")[1]);reader.onerror=fail;reader.readAsDataURL(file);
  });
}
window.modelFile=async options=>encoded(await buildGLB(options));
window.sceneFile=async part=>{
  const holder=document.createElement("div");
  holder.style.cssText="width:640px;height:480px";document.body.appendChild(holder);
  const room=window.PrivateCompanionHomeRoom3D.mount(holder,{exportOnly:true});
  try{
    // Freeze the snapshot's animal poses, leaves and fire at a repeatable
    // instant. The interactive room continues to use its running clock.
    const state={...readDemoState("page/yard"),epoch:Date.UTC(2026,10,15,4)/1000,replay:true};
    const nodes=await room.sceneRoots(part,state);
    for(const root of nodes)root.traverse(obj=>{
      if(!obj.name&&obj.userData.station)obj.name=obj.userData.station;
    });
    const exporter=new GLTFExporter();
    exporter.register(writer=>({afterParse(){
      writer.json.asset.copyright="小屋基于 menglimi/astrbot_plugin_private_companion。大肥鱼小屋场景、建模源码与修改见项目仓库。";
      const credits="https://github.com/PekolandBBQ/Deepseek-Dafeiyu-Chibi-3D-Model/blob/v1.0.0/THIRD_PARTY_NOTICES.md";
      writer.json.asset.extras={sceneLicense:"AGPL-3.0",credits};
      if(part==="room"){
        writer.json.asset.extras.credits="https://github.com/PekolandBBQ/Deepseek-Dafeiyu-Chibi-3D-Model/blob/v1.0.1/THIRD_PARTY_NOTICES.md";
        writer.json.asset.extras.apronMark="Mirror portrait includes the DeepSeek brand mark on the apron.";
        writer.json.asset.extras.mirrorPortrait="溟月原型：上善无形；女仆鲸鱼娘设计：ZipZipPipe。镜中角色三维演绎，CC BY-NC-SA 4.0。";
      }
    }}));
    return await encoded(await exporter.parseAsync(nodes,{binary:true,onlyVisible:true}));
  }finally{room.dispose();holder.remove();}
};
