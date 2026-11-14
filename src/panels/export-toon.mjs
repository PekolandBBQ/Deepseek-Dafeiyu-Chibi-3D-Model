// Browser-side GLB export from the exact same articulated scene used in the cottage.
import * as T from "three";
import {GLTFExporter} from "three/addons/exporters/GLTFExporter.js";
import {makeWhale} from "./whale-resident.mjs";

export async function buildGLB({bodyOnly=false,outfit}={}){
  const rig=makeWhale(()=>{}, {fit:false,bodyOnly});await rig.ready;
  if(outfit&&!bodyOnly)await rig.setOutfit(outfit);
  const clips=[];
  const cloth=rig.model.getObjectByName("鲸纹围裙与百褶裙");
  const deforming=[...new Set([cloth,cloth?.children[0],...rig.lace.meshes].filter(Boolean))];
  rig.model.traverse(n=>{
    if(n.name==="鲸纹外围裙"||n.userData.followsSkirt)
      if(!deforming.includes(n))deforming.push(n);
  });
  const poses=["idle","walk","read","sleep","paint","write","water","swing","fish","pet","play","look","listen","contact","bench","bench-read"];
  const channels=[...new Set([rig.model,...rig.joints,...rig.visibilityNodes])];
  const hidden=new Set(rig.visibilityNodes);
  for(const pose of poses){
    const tracks=[],times=Array.from({length:241},(_,i)=>i/24);
    const shapes=deforming.map(()=>[]);
    const series=channels.map(()=>({p:[],q:[],s:[]}));
    for(const t of times){
      rig.model.rotation.set(pose==="sleep"?-1.43:0,0,0,"YXZ");
      if(pose==="sleep")rig.model.rotateY(-.31);
      rig.pose(pose,t,{dt:t===0?0:1/24,snap:t===0});
      deforming.forEach((node,j)=>shapes[j].push(...node.morphTargetInfluences));
      channels.forEach((node,i)=>{
        series[i].p.push(...node.position.toArray());series[i].q.push(...node.quaternion.toArray());
        series[i].s.push(...(!node.visible&&hidden.has(node)?[0,0,0]:node.scale.toArray()));
      });
    }
    channels.forEach((node,i)=>{
      const {p,q,s}=series[i];
      // Match both endpoints so repeating a portable clip never snaps back to frame zero.
      const start=new T.Quaternion().fromArray(q,0),end=new T.Quaternion();
      for(let frame=times.length-16;frame<times.length;frame++){
        const w=T.MathUtils.smootherstep(frame,times.length-16,times.length-1);
        end.fromArray(q,frame*4).slerp(start,w).toArray(q,frame*4);
        for(let j=0;j<3;j++){p[frame*3+j]=T.MathUtils.lerp(p[frame*3+j],p[j],w);
          if(!hidden.has(node)||frame===times.length-1)s[frame*3+j]=T.MathUtils.lerp(s[frame*3+j],s[j],w);}
      }
      // Including constant tracks restores neutral joints when clips are switched.
      tracks.push(new T.VectorKeyframeTrack(node.uuid+".position",times,p).optimize(),
        new T.QuaternionKeyframeTrack(node.uuid+".quaternion",times,q).optimize(),
        new T.VectorKeyframeTrack(node.uuid+".scale",times,s,hidden.has(node)?T.InterpolateDiscrete:T.InterpolateLinear).optimize());
    });
    deforming.forEach((node,j)=>{
      // glTF animates all weights on a mesh in a single channel, including
      // skirts with both sitting shapes and independently named lace shapes.
      const values=shapes[j],stride=node.morphTargetInfluences.length;
      for(let frame=times.length-16;frame<times.length;frame++){
        const blend=T.MathUtils.smootherstep(frame,times.length-16,times.length-1);
        for(let i=0;i<stride;i++){
          const k=frame*stride+i;
          values[k]=T.MathUtils.lerp(values[k],values[i],blend);
        }
      }
      tracks.push(new T.NumberKeyframeTrack(node.uuid+".morphTargetInfluences",times,values).optimize());
    });
    clips.push(new T.AnimationClip(pose,10,tracks));
  }
  rig.model.rotation.set(0,0,0);
  rig.pose("idle",0,{snap:true});
  for(const n of rig.visibilityNodes){if(!n.visible)n.scale.setScalar(0);n.visible=true;}
  const mats=new Map();
  rig.model.traverse(node=>{
    if(!node.isMesh)return;
    const m=node.material;
    if(m.side===T.BackSide){
      const g=node.geometry.clone(),idx=g.index.array;
      for(let i=0;i<idx.length;i+=3)[idx[i+1],idx[i+2]]=[idx[i+2],idx[i+1]];
      g.computeVertexNormals();node.geometry=g;
    }
    if(m.isMeshPhysicalMaterial||m.isMeshStandardMaterial)return;
    if(!mats.has(m)){
      const out=new T.MeshStandardMaterial({color:m.color,map:m.map,vertexColors:m.vertexColors,
        emissive:m.emissive??0x000000,emissiveMap:m.emissiveMap??null,emissiveIntensity:m.emissiveIntensity??1,
        side:m.side===T.DoubleSide?T.DoubleSide:T.FrontSide,roughness:1,metalness:0});
      if(m.isMeshToonMaterial)out.userData.gltfExtensions={VRMC_materials_mtoon:{
        specVersion:"1.0",shadeColorFactor:m.color.clone().multiplyScalar(.68).toArray(),shadingToonyFactor:.93}};
      mats.set(m,out);
    }
    node.material=mats.get(m);
  });
  const exporter=new GLTFExporter();
  exporter.register(writer=>({afterParse(){
    writer.json.asset.copyright="溟月原型：上善无形；女仆鲸鱼娘设计：ZipZipPipe。大肥鱼三维演绎与穿搭，CC BY-NC-SA 4.0。";
    writer.json.asset.extras={
      license:"https://creativecommons.org/licenses/by-nc-sa/4.0/",
      credits:"https://github.com/PekolandBBQ/Deepseek-Dafeiyu-Chibi-3D-Model/blob/v1.0.0/THIRD_PARTY_NOTICES.md"
    };
    // Three chooses the first weighted bone as the skeleton root. A hip skin
    // also uses the torso, a sibling of the thigh. Export their common root.
    for(const mesh of writer.skins){
      const bones=mesh.skeleton.bones;
      let root=bones[0];
      for(const bone of bones){
        while(root&&!root.getObjectById(bone.id))root=root.parent;
      }
      const skin=writer.json.skins[writer.json.nodes[writer.nodeMap.get(mesh)].skin];
      if(writer.nodeMap.has(root))skin.skeleton=writer.nodeMap.get(root);
      else delete skin.skeleton;
    }
  }}));
  const buf=await exporter.parseAsync(rig.model,{binary:true,onlyVisible:false,animations:clips,includeCustomExtensions:true});
  return buf;
}
