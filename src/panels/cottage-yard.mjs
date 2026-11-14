import {readDemoState} from "../demo-state.mjs";
// The upstairs room and the role's isolated camera load this same scene.
import * as THREE from "three";
import {landscape,groundY,seat,gate,wallCenter} from "./garden-landscape.mjs";
import {furnishings} from "./garden-furnishings.mjs";
import {wildlife} from "./yard-wildlife.mjs";
import fixtures from "../../assets/home-fixtures.json";
import {hearthAndTable} from "./hearth-and-table.mjs";

export function applyCourtyardSun(sun,hemi,scene,solar,weather){
  if(!solar?.direction)return;
  const [x,y,z]=solar.direction,overcast=["cloudy","rain","storm","snow","mist"].includes(weather);
  if(!sun.target.parent)scene.add(sun.target);
  sun.target.position.set(5,0,2);sun.target.updateMatrixWorld();
  sun.position.set(5+x*27,y*27,2+z*27);
  const altitude=Math.max(0,y);
  sun.intensity=(overcast?1.26:3.8)*Math.pow(altitude,.43);
  const warm=new THREE.Color("#ffad70"),day=new THREE.Color(overcast?"#e4edf1":"#fff1cf");
  sun.color.copy(warm.lerp(day,THREE.MathUtils.smoothstep(altitude,.02,.48)));
  hemi.intensity=.58+(overcast?2.22:1.91)*THREE.MathUtils.smoothstep(y,-.10,.37);
  Object.assign(sun.shadow.camera,{left:-23,right:23,top:19,bottom:-19,far:66});
  sun.shadow.camera.updateProjectionMatrix();sun.castShadow=y>0;
}

export const spots = {"池边":[12,3],"花架":[14,-1],"小窝":[10,-2],"鸟笼":[15.5,-1],"树下":[15,6],"小径":[8.6,2],
  "长椅":[seat.x,seat.z],"长椅前":[15.72,8.86],"枫树":[15,6],"篱门":[gate.x,gate.z],"画墙":[wallCenter.x,wallCenter.z],
  "餐桌":fixtures.tableApproach,"壁炉":fixtures.hearthApproach,"篱灯":fixtures.fenceLightApproach};
export const hearthFootprint={id:"hearth",x:fixtures.hearth[0],z:fixtures.hearth[1]-.08,halfX:1.28,halfZ:.54,angle:0};
export function residentAtFixture(presence){
  const point=spots[presence?.place];
  if(!point)return null;
  if(!["壁炉","餐桌","篱灯"].includes(presence.place))return {...presence,point};
  return {...presence,point,standing:[point[0],presence.place==="壁炉"?0:groundY,point[1]],yaw:presence.place==="餐桌"?Math.PI:0};
}
export function yardShot(place,state){
  const pet=state?.pets?.[place==="小猫"?"cat":place==="小狗"?"dog":""];
  if(pet?.mode==="hug")return {position:[17.40,1.06,10.90],target:[15.70,groundY+.78,9.04],fov:36};
  if(pet){const [x,y,z]=pet.position;return {position:[x+1.35,y+groundY+1.05,z+2.1],target:[x,y+groundY+.30,z],fov:35};}
  if(!place)return {position:[2.2,21.5,32.2],target:[3.8,.6,2.1],fov:43};
  if(place==="画墙")return {position:[-.55,2.83,3.99],target:[-5.68,2.48,3.56],fov:34};
  if(place==="壁炉"){
    const [x,z]=fixtures.hearth;
    return {position:[x+.65,2.16,z-2.04],target:[x,1.03,z-.06],fov:56};
  }
  if(place==="餐桌")return {position:[16.54,3.42,7.08],target:[16.47,.35,3.65],fov:42};
  if(place==="篱灯")return {position:[4.54,1.84,7.57],target:[8.70,2.36,11.05],fov:48};
  if(place==="池边")return {position:[10.34,1.38,6.57],target:[11.74,-.12,2.88],fov:43};
  if(place==="互动草坪"||place==="长椅前")return {position:[16.66,2.3,13.5],target:[14.25,.08,9.10],fov:41};
  if(place==="长椅"||place==="树下")return {position:[10.95,2.05,8.13],target:[15.76,.39,7.12],fov:38};
  if(place==="枫树")return {position:[8.2,5.25,14.2],target:[15,2.85,6],fov:42};
  if(place==="篱门")return {position:[12.85,2.20,16.4],target:[11.75,.24,11.1],fov:39};
  const [x,z]=spots[place]||spots["小径"];
  return {position:[x+6.3,5.6,z+1.5],target:[x,.55,z],fov:40};
}
export function yardControls(container,apply,focus,back) {
  const bar=document.createElement("div"), button=document.createElement("button"), wall=document.createElement("button"), places=document.createElement("select"), weather=document.createElement("span");
  bar.style.cssText="position:absolute;right:12px;top:12px;z-index:4;display:flex;align-items:center;gap:6px;flex-wrap:wrap;max-width:90%;background:#fff4dfed;color:#513c2e;border-radius:10px;padding:5px 8px;font:13px system-ui";
  places.setAttribute("aria-label","看看院里的哪一处");
  for(const [value,label] of [["","全院"],...[...Object.keys(spots),"小猫","小狗"].map(k=>[k,k])])places.add(new Option(label,value));
  places.hidden=true;button.type="button";button.textContent="看小院";wall.type="button";wall.textContent="看画墙";bar.append(button,wall,places,weather);
  container.append(bar);
  let latest=null,open=false,busy=false,closed=false;
  async function refresh(){
    if(closed||busy||document.hidden)return;
    busy=true;
    try{
      const raw=readDemoState("page/yard",{}), s=raw?.data?.data||raw?.data||raw;
      if(closed||!s?.places)return;
      latest=s;await apply(s);
      const w=s.weather;
      weather.textContent=w?.condition?`${w.location} · ${w.condition} ${w.temperature_c}°${w.state==="stale"?"（上次）":""}`:"天气暂无读数";
      weather.title=w?.observed_at?new Date(w.observed_at).toLocaleString("zh-CN",{timeZone:"Asia/Shanghai"})+" · "+w.provider:"";
    }catch{if(!closed)weather.textContent="院况暂未更新";}
    finally{busy=false;}
  }
  button.onclick=()=>{open=!open;button.textContent=open?"回小屋":"看小院";places.hidden=!open;
    if(open){focus(places.value);refresh();}else back();};
  places.onchange=()=>focus(places.value);
  wall.onclick=()=>{open=true;places.hidden=false;places.value="画墙";button.textContent="回小屋";focus("画墙");refresh();};
  refresh();const timer=setInterval(refresh,30000);
  return ()=>{closed=true;clearInterval(timer);bar.remove();};
}
export function buildYard(scene) {
  const yard=new THREE.Group(), cube=new THREE.BoxGeometry(), colors=new Map();
  yard.name="篱下小院"; yard.position.y=groundY; scene.add(yard);
  function block(parent,x,y,z,w,h,d,color) {
    if(!colors.has(color)) colors.set(color,new THREE.MeshStandardMaterial({color,roughness:.86}));
    const mesh=new THREE.Mesh(cube,colors.get(color)); mesh.position.set(x,y,z); mesh.scale.set(w,h,d);
    mesh.castShadow=true; mesh.receiveShadow=true; parent.add(mesh); return mesh;
  }
  function part(x,z) {const g=new THREE.Group(); g.position.set(x,0,z); yard.add(g); return g;}
  const timber="#ac754b", honey="#d79f62", clay="#c56e50";
  const animals=wildlife(yard,scene);
  const frame=part(14,-1);
  for(const x of [-1.3,1.3]) for(const z of [-.55,.55]) block(frame,x,1.05,z,.12,2.1,.12,timber);
  for(let i=0;i<8;i++) block(frame,-1.4+i*.4,2.12,0,.17,.12,1.6,honey);
  const soils=[];
  for(const x of [-1,0,1]) {
    block(frame,x,.25,0,.54,.49,.52,clay); soils.push(block(frame,x,.51,0,.48,.04,.46,"#9b7751"));
    block(frame,x,.73,0,.08,.4,.08,"#688252"); block(frame,x,.94,0,.28,.16,.23,"#f6bd88");
  }
  const cage=part(15.5,-1);block(cage,0,.95,0,.75,.12,.65,honey);
  block(cage,0,1.82,0,.8,.12,.7,honey);
  for(const z of [-.3,.3])for(let i=0;i<5;i++)block(cage,-.32+i*.16,1.4,z,.027,.8,.027,timber);
  block(cage,0,1.15,0,.68,.06,.06,timber);const bird=block(cage,0,1.32,0,.23,.2,.15,"#efce65");
  const huts=part(10,-2);
  for(const x of [-.8,.8]){
    block(huts,x,.48,0,1.1,.94,1.1,honey);block(huts,x,.37,.56,.48,.68,.05,"#634b3e");
    for(const side of [-1,1])block(huts,x+side*.32,1,0,.8,.12,1.4,clay).rotation.z=-side*.45;
  }
  for(let i=0;i<3;i++)block(huts,1.8,.36+i*.45,0,.68,.12,.66,honey);
  block(huts,1.8,.65,0,.14,1.3,.14,timber);
  const tree=part(15,6),grounds=landscape(yard),rooms=furnishings(yard,block),house=hearthAndTable(yard,block);
  const swing=new THREE.Group();tree.add(swing);swing.position.set(-1.34,3.06,0);
  for(const x of [-.36,.36])block(swing,x,-1.05,0,.045,2.1,.045,honey);
  block(swing,0,-2.12,0,.94,.13,.43,timber);
  let live=null,received=0;
  function pose(){
    if(!live)return;
    const epoch=live.epoch??Date.parse(live.time)/1000;
    const now=Number.isFinite(epoch)?epoch+(live.replay?0:(performance.now()-received)/1000):0;
    const t=now%86400;
    grounds.pose(t);house.pose(t);animals.pose(now);
    swing.rotation.x=live?.swing_moving?Math.sin(t*2.5)*.27:0;
  }
  function update(s){
    live=s;received=performance.now();animals.update(s);
    const furnished=s.house_furnished===true,lit=s.lamp_lit??["dusk","night"].includes(s.phase);
    grounds.update(s.season,furnished,lit);house.update(furnished,s.hearth_lit===true);
    soils[0].material.color.set(s.watered?"#654a39":"#9b7751");
    bird.position.y=s.phase==="night"?1.27:1.39;
    pose();return rooms.update(s);
  }
  pose(0);
  return {update,pose,shot(place){const pet=place==="小猫"?"cat":place==="小狗"?"dog":null;
    return yardShot(place,pet?{pets:{[pet]:animals.pet(pet)}}:live);},setReading:rooms.setReading,
    dispose(){animals.dispose();grounds.dispose();rooms.dispose();house.dispose();yard.removeFromParent();cube.dispose();for(const m of colors.values())m.dispose();}};
}
