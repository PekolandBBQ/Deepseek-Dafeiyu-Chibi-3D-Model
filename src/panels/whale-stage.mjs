import {dressingMirror} from "./dressing-mirror.mjs";
import * as T from "three";
import {makeWhale} from "./whale-resident.mjs";
import {playbackBar} from "./room-playback.mjs";
import {spots,yardShot,residentAtFixture} from "./cottage-yard.mjs";
import {groundY,seat} from "./garden-landscape.mjs";

export function cameraPetActor(scene,stock,redraw){
  let rig=null;
  return {async update(s){
    const e=(s.pet_events||[]).filter(p=>p.start<=s.epoch&&s.epoch<=p.start+p.release).at(-1);
    if(!e){if(rig)rig.model.visible=false;stock().visible=true;return;}
    if(!rig){rig=makeWhale(redraw);scene.add(rig.model);}
    await rig.ready;await rig.setOutfit(s.outfit?.name);
    stock().visible=false;const actor=rig.model;actor.visible=true;scene.userData.yardResident=actor;
    actor.position.set(e.actor[0],groundY,e.actor[2]);actor.rotation.y=e.action==="fetch"?-1.1:0;
    const t=s.epoch-e.start-e.contact;
    rig.pose(t<0||e.action==="bench"?"invite":e.action,Math.max(t,0),{snap:true});
  },dispose(){rig?.dispose();delete scene.userData.yardResident;}};
}

export function whaleStage(scene,container,stock,groups,moveCamera,requestDraw,setMoment,mirrorDoor){
  const rig=makeWhale(requestDraw),actor=rig.model;
  const mirror=dressingMirror(mirrorDoor,container,requestDraw);
  scene.userData.yardResident=actor;
  rig.ready.then(()=>{container.dataset.residentArt="toon-3d";}).catch(()=>{
    container.dataset.residentArt="unavailable";
    const message=document.createElement("span");message.textContent="角色材质加载失败，请刷新观察室。";
    message.style.cssText="position:absolute;left:12px;top:12px;background:#fff7e7;padding:5px";
    container.append(message);
  });
  scene.add(actor);actor.visible=false;
  let kind="idle",last="",swing=false,clock=0,active=false;
  let base=null, follow=false,manual=false,liveMode=true,walkEvent=null,playUntil=0,lastCursor=null,petAct=null;
  let orientationBlend=null;
  const targetQuaternion=new T.Quaternion();
  function applyOrientation(dt){
    if(!orientationBlend)return;
    orientationBlend.elapsed+=dt;
    const weight=T.MathUtils.smootherstep(orientationBlend.elapsed,0,.52);
    actor.quaternion.slerp(orientationBlend.from,1-weight);
    if(weight===1)orientationBlend=null;
  }
  function pointAlong(route,dist){
    let distance=Math.max(0,dist);
    for(let i=1;i<route.length;i++){
      const a=new T.Vector3(...route[i-1]),b=new T.Vector3(...route[i]),len=a.distanceTo(b);
      if(distance<=len||i===route.length-1)return a.lerp(b,len?Math.min(1,distance/len):1);
      distance-=len;
    }
    return new T.Vector3(...route[0]);
  }
  function walkPosition(t){
    if(!walkEvent?.route?.length)return;
    const route=walkEvent.route,d=t*walkEvent.speed;
    actor.position.copy(pointAlong(route,d));
    const delta=pointAlong(route,d+.28).sub(pointAlong(route,d-.28));
    if(delta.lengthSq()>1e-8)actor.rotation.y=Math.atan2(delta.x,delta.z);
  }
  const canvas=container.querySelector("canvas");
  const manualCamera=()=>{follow=false;manual=true;};
  canvas?.addEventListener("pointerdown",manualCamera);canvas?.addEventListener("wheel",manualCamera);
  function aim(){
    if(!actor.visible)return;
    const p=actor.position;
    if(kind==="bench"||kind==="bench-read"){
      moveCamera(yardShot("长椅"));
    }else if(["fetch","invite","hug","stroke"].includes(kind)){
      moveCamera(kind==="fetch"?yardShot("长椅前"):{position:[p.x+1.9,p.y+1.8,p.z+2.45],target:[p.x,p.y+.79,p.z+.22],fov:38});
    }else if(kind==="sleep"){
      moveCamera({position:[p.x-2.25,p.y+3.9,p.z+1.7],target:[p.x,p.y+.06,p.z-.78],fov:34});
    }else if(["read","paint","browse","watch","play"].includes(kind)&&!swing){
      moveCamera({position:[p.x+3.2,p.y+2.35,p.z+1.05],target:[p.x,p.y+.98,p.z],fov:38});
    }else moveCamera({position:[p.x+2.4,p.y+2.4,p.z+4.2],target:[p.x,p.y+1.0,p.z],fov:33});
  }
  function locate(id,x,y,z){
    const furniture=groups[id];
    if(!furniture || !furniture.visible)return null;
    return furniture.localToWorld(new T.Vector3(x,y,z));
  }
  function show(event,opts){
    mirror.set(opts.outfit,opts.day);
    if(opts.known)rig.setOutfit(opts.outfit?.name).catch(()=>{container.dataset.residentArt="unavailable";});
    const wasVisible=actor.visible;
    const previousOrientation=actor.quaternion.clone();
    active=opts.known;
    const continuous=lastCursor!==null && liveMode===opts.live && (opts.live||opts.playing)
      && opts.cursor>=lastCursor && opts.cursor-lastCursor<7 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    lastCursor=opts.cursor;liveMode=opts.live;
    scene.userData.livePetEvents=opts.live?opts.petEvents:null;
    petAct=opts.petAct||null;
    stock.visible=false;
    const category=event?.kind||"idle";
    const furnishing=category==="yard"?residentAtFixture(event):null;
    const moves={"荡秋千":"swing","浇花":"water","看鱼":"fish","听鸟":"listen","听水":"listen","听风铃":"listen",
      "陪小狗":"pet","看猫爬架":"pet","散步":"walk","读一页":"bench-read","带一本书":"read","坐长凳":"bench"};
    kind=category==="yard"?(moves[event.title.split(" · ").at(-1)]||"yard"):category;
    const withPet=petAct&&(!event||category==="yard");
    if(withPet)kind=petAct.action==="bench"?"invite":petAct.action;
    setMoment(opts.historical||null,kind==="bench-read");
    swing=kind==="swing";
    let at;
    if(withPet){at=new T.Vector3(petAct.actor[0],groundY,petAct.actor[2]);}
    else if(category==="yard"){
      const [x,z]=spots[event.place]||spots["小径"];
      if(kind==="bench"||kind==="bench-read")at=new T.Vector3(seat.x,groundY+seat.top-.082,seat.z);
      else if(furnishing?.standing)at=new T.Vector3(...furnishing.standing);
      else at=swing?new T.Vector3(x-1.34,.2,z):new T.Vector3(x+.55,-.72,z+.72);
    }else if(kind==="sleep")at=locate("bed",.12,1.23,.22);
    else if(["read","paint","browse","play","watch","write"].includes(kind))at=locate("desk",-.38,.49,1.26);
    else if(category==="mirror"||category==="wardrobe")at=locate("wardrobe",.59,0,1.80);
    else if(kind==="look")at=new T.Vector3(4.5,0,1.35);
    walkEvent=event?.route?event:null;
    if(!event&&opts.live&&opts.lastWalkPosition)at=new T.Vector3(...opts.lastWalkPosition);
    base=at||new T.Vector3(.4,0,2.1);
    actor.position.copy(base);
    actor.visible=active&&(Boolean(event)||!!withPet||opts.live);
    actor.rotation.set(kind==="sleep"?-1.43:0,kind==="sleep"?(groups.bed?.rotation.y||0):
      category==="yard"?.15:["read","paint","play","watch","browse"].includes(kind)?1.05:.15,0,"YXZ");
    if(category==="mirror"||category==="wardrobe"){actor.rotation.y=Math.PI+(groups.wardrobe?.rotation.y||0);kind="look";}
    if(kind==="sleep")actor.rotateY(-.31);
    if(kind==="bench"||kind==="bench-read")actor.rotation.y=seat.yaw;
    if(furnishing?.standing)actor.rotation.y=furnishing.yaw;
    if(withPet)actor.rotation.y=kind==="fetch"?-1.1:0;
    const key=(event?.id||"")+":"+opts.live;
    const changed=key!==last;
    if(changed){clock=0;last=key;}
    if(!opts.live)clock=opts.poseTime||0;
    if(withPet)clock=Math.max(0,opts.cursor-petAct.start);
    if(walkEvent){clock=Math.max(0,opts.cursor-event.departed);walkPosition(clock);}
    playUntil=opts.playing?clock+.5:clock;
    if(changed&&((!opts.live&&event&&!manual)||follow))aim();
    if(swing){actor.position.z=base.z+Math.sin(clock*2.5)*.34;actor.rotation.x=Math.sin(clock*2.5)*.13;}
    if(!continuous)orientationBlend=null;
    else if(changed&&wasVisible&&actor.visible)orientationBlend={from:previousOrientation,elapsed:0};
    targetQuaternion.copy(actor.quaternion);
    applyOrientation(0);
    actor.userData.kind=kind;rig.pose(withPet&&clock<petAct.contact?"invite":kind,withPet?Math.max(0,clock-petAct.contact):clock,
      {blend:continuous,snap:!continuous});requestDraw();
  }
  const cleanup=playbackBar(container,show,()=>{manual=false;follow=true;aim();},()=>mirror.open());
  function tick(dt,reduced,editing){
    if(!active)return false;
    stock.visible=false;
    if(!actor.visible || editing || reduced || (!liveMode&&clock>=playUntil))return false;
    clock=Math.min(liveMode?Infinity:playUntil,clock+Math.min(.1,dt));
    const withPet=petAct&&["hug","stroke","fetch","invite"].includes(kind);
    actor.quaternion.copy(targetQuaternion);
    walkPosition(clock);
    if(swing&&base){actor.position.z=base.z+Math.sin(clock*2.5)*.34;actor.rotation.x=Math.sin(clock*2.5)*.13;}
    applyOrientation(Math.min(.1,dt));
    rig.pose(withPet&&clock<petAct.contact?"invite":kind,withPet?Math.max(0,clock-petAct.contact):clock,{dt:Math.min(.1,dt)});
    return true;
  }
  return {tick,mirrorPane:mirror.pane,openMirror:()=>container.querySelector("[data-mirror]")?.click(),dispose(){mirror.dispose();canvas?.removeEventListener("pointerdown",manualCamera);canvas?.removeEventListener("wheel",manualCamera);
    cleanup();rig.dispose();delete scene.userData.yardResident;delete scene.userData.livePetEvents;stock.visible=true;}};
}
