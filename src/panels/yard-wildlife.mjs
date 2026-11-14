import * as T from "three";
import {groundY,seat} from "./garden-landscape.mjs";

const tau=Math.PI*2,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const meet=[15.72,0,8.86],landing=[12.28,0,9.78];

function kit(){
  const geos=new Set(),mats=new Map(),orb=new T.SphereGeometry(1,16,12),cone=new T.ConeGeometry(1,1,12);
  function mat(color){if(!mats.has(color))mats.set(color,new T.MeshStandardMaterial({color,roughness:.78}));return mats.get(color);}
  function mesh(parent,g,m,p=[0,0,0],size=[1,1,1]){
    geos.add(g);const v=new T.Mesh(g,typeof m==="string"?mat(m):m);
    v.position.set(...p);v.scale.set(...size);v.castShadow=v.receiveShadow=true;parent.add(v);return v;
  }
  function oval(parent,color,x,y,z,w,h,d){return mesh(parent,orb,color,[x,y,z],[w,h,d]);}
  function limb(parent,color,a,b,r){
    const aa=new T.Vector3(...a),bb=new T.Vector3(...b),delta=bb.clone().sub(aa);
    const rod=oval(parent,color,...aa.add(bb).multiplyScalar(.5).toArray(),r,delta.length()*.51,r);
    rod.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return rod;
  }
  function joint(parent,x,y,z){const g=new T.Group();g.position.set(x,y,z);parent.add(g);return g;}
  return {mesh,mat,oval,limb,joint,cone,dispose(){for(const g of geos)g.dispose();for(const m of mats.values())m.dispose();}};
}

function pondLife(root,k){
  const {mesh,oval,joint,limb}=k;
  const pond=joint(root,12,0,3);pond.name="水池与穿洞金鱼";
  function poolShape(w,h,r){
    const s=new T.Shape();s.moveTo(-w+r,-h);s.lineTo(w-r,-h);s.quadraticCurveTo(w,-h,w,-h+r);
    s.lineTo(w,h-r);s.quadraticCurveTo(w,h,w-r,h);s.lineTo(-w+r,h);s.quadraticCurveTo(-w,h,-w,h-r);
    s.lineTo(-w,-h+r);s.quadraticCurveTo(-w,-h,-w+r,-h);return s;
  }
  const bed=mesh(pond,new T.ExtrudeGeometry(poolShape(2,1.42,.45),{depth:.12,bevelEnabled:false}),"#a99c7c",[0,.13,0]);
  bed.rotation.x=-Math.PI/2;
  const waterMat=new T.MeshStandardMaterial({color:"#7ac0bd",transparent:true,opacity:.40,roughness:.27,depthWrite:false});
  const water=mesh(pond,new T.ShapeGeometry(poolShape(1.91,1.33,.40)),waterMat,[0,.40,0]);water.rotation.x=-Math.PI/2;water.castShadow=false;water.renderOrder=2;
  const sand=mesh(pond,new T.ShapeGeometry(poolShape(1.90,1.32,.4)),"#609991",[0,.253,0]);sand.rotation.x=-Math.PI/2;
  for(let i=0;i<42;i++){
    const a=i*tau/42,ca=Math.cos(a),sa=Math.sin(a);
    const x=1.93*Math.sign(ca)*Math.abs(ca)**.48,z=1.36*Math.sign(sa)*Math.abs(sa)**.48;
    const stone=oval(pond,["#c8bb94","#a69f88","#cdb99b","#b6aa8d"][i%4],x,.26+.024*Math.cos(i*3),z,.17,.14,.13);
    stone.rotation.y=-a;stone.scale.x*=1+.22*Math.sin(i*2.3);
  }
  // A continuous opening from front to back. The additional rocks touch only the flanks and crown.
  const cave=joint(pond,-.56,.17,-.23);cave.name="假山宽石拱";
  const s=new T.Shape();s.moveTo(-.96,0);s.lineTo(-1,.27);s.lineTo(-.79,.63);s.lineTo(-.63,.83);
  s.lineTo(-.51,1.19);s.lineTo(-.20,1.36);s.lineTo(.07,1.10);s.lineTo(.35,1.22);
  s.lineTo(.55,.89);s.lineTo(.83,.67);s.lineTo(.94,.28);s.lineTo(.86,0);s.lineTo(.55,0);
  s.lineTo(.55,.28);s.bezierCurveTo(.51,.70,.28,.79,-.03,.79);s.bezierCurveTo(-.36,.80,-.54,.67,-.55,.30);
  s.lineTo(-.55,0);s.closePath();
  const canvas=document.createElement("canvas");canvas.width=canvas.height=256;
  const ink=canvas.getContext("2d");ink.fillStyle="#a5a494";ink.fillRect(0,0,256,256);
  let seed=12517;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<1200;i++){ink.fillStyle=i%2?"#72776a38":"#d3c9aa55";ink.fillRect(rnd()*256,rnd()*256,1+rnd()*3,1+rnd()*2);}
  for(let i=0;i<30;i++){
    let y=rnd()*272-8;ink.strokeStyle=i%3?"#767a6b70":"#d1c9ac8a";ink.lineWidth=.4+rnd()*2;
    ink.beginPath();ink.moveTo(0,y);for(let x=0;x<=270;x+=18){y+=(rnd()-.53)*10;ink.lineTo(x,y);}ink.stroke();
  }
  const rockMap=new T.CanvasTexture(canvas);rockMap.wrapS=rockMap.wrapT=T.RepeatWrapping;rockMap.colorSpace=T.SRGBColorSpace;
  const rockMat=new T.MeshStandardMaterial({map:rockMap,bumpMap:rockMap,bumpScale:.035,roughness:1,flatShading:true});
  const crag=mesh(cave,new T.ExtrudeGeometry(s,{depth:.52,bevelEnabled:true,bevelSize:.065,bevelThickness:.08,bevelSegments:3,curveSegments:20}),rockMat,[0,0,-.27]);
  crag.name="可穿过的石洞";crag.material.flatShading=true;
  const shard=new T.IcosahedronGeometry(1,1);
  for(let i=0;i<16;i++){
    const side=i%2?-1:1,t=(i>>1)/8,x=side*(.78+.11*Math.sin(i*3)),y=.13+t*.66;
    const b=mesh(cave,shard,["#898e7b","#a7a18b","#7c8173","#afa58c"][i%4],[x,y,.18+.12*Math.cos(i)],
      [.11+rnd()*.12,.09+rnd()*.12,.10+rnd()*.10]);b.rotation.set(rnd()*.8,rnd()*2,side*(.09+.3*t));
  }
  for(const [x,y,z,w,h] of [[-.56,.98,0,.28,.41],[-.22,1.22,-.08,.23,.38],[.31,1.04,-.06,.25,.31],[.72,.47,-.25,.24,.44]]){
    const peak=mesh(cave,shard,rockMat,[x,y,z],[w,h,.29]);peak.rotation.set(.18,x*.71,-x*.18);
    for(let i=0;i<7;i++){const a=i*.9;oval(cave,i%2?"#829050":"#71814d",x+.10*Math.cos(a),y+h*.80,z+.10*Math.sin(a),.074,.025,.061);}
  }
  const fishPath=new T.CatmullRomCurve3([[-.56,-1.05],[-.56,-.42],[-.56,.34],[-.17,.80],[.62,.90],[1.35,.40],[1.20,-.53],[.55,-.95],[.02,-1.11]].map(([x,z])=>new T.Vector3(x,.337,z)),true);
  const fish=[["#e8873f","#fff2cd"],["#fff1ce","#ca6240"],["#d45f38","#ecad5b"]].map(([color,mark],i)=>{
    const g=joint(pond,0,0,0);g.name="金鱼"+(i+1);
    oval(g,color,0,0,0,.105,.093,.202);oval(g,mark,0,-.039,.027,.089,.054,.148);
    const head=oval(g,color,0,.01,.143,.09,.078,.083);
    for(const side of [-1,1]){
      oval(head,"#2e302d",side*.84,.21,.48,.15,.17,.15);
      const fin=oval(g,mark,side*.092,-.035,.008,.035,.019,.088);fin.rotation.y=side*.62;
      for(let n=0;n<4;n++)oval(g,mark,side*.099,.015+(n%2)*.024,.075-n*.044,.009,.016,.025);
    }
    const dorsal=oval(g,mark,0,.083,-.025,.015,.050,.087);dorsal.rotation.x=-.26;
    const tail=joint(g,0,0,-.16);
    for(const side of [-1,1]){
      const shape=new T.Shape();shape.moveTo(0,0);shape.quadraticCurveTo(.029,-.041,.018,-.157);
      shape.bezierCurveTo(.081,-.146,.128,-.203,.144,-.178);shape.quadraticCurveTo(.117,-.043,0,0);
      const fan=mesh(tail,new T.ShapeGeometry(shape),mark,[0,.016,0]);fan.material.side=T.DoubleSide;
      fan.rotation.x=Math.PI/2;fan.scale.x=side;fan.rotation.z=-side*.06;
      for(let j=0;j<3;j++)limb(tail,color,[0,.017,-.012],[side*(.03+j*.043),.018,-.14-j*.014],.004);
    }
    return {g,tail};
  });
  const ripples=[];
  for(let i=0;i<3;i++){
    const m=new T.MeshBasicMaterial({color:"#d7efda",transparent:true,opacity:.27,depthWrite:false,side:T.DoubleSide});
    const ring=mesh(pond,new T.RingGeometry(.22,.230,42),m,[[.93,-.12,.28][i],.410,[-.68,.68,-.91][i]]);
    ring.rotation.x=-Math.PI/2;ring.castShadow=false;ring.renderOrder=3;ripples.push(ring);
  }
  return {pose(t,night){fish.forEach(({g,tail},i)=>{
    const u=((t*(night?.028:.049)+i/3)%1+1)%1,p=fishPath.getPointAt(u),v=fishPath.getTangentAt(u);
    g.position.copy(p);g.position.y+=.013*Math.sin(t*1.7+i);g.rotation.y=Math.atan2(v.x,v.z);
    tail.rotation.y=Math.sin(t*(night?3.9:6.1)+2*i)*.48;
  });ripples.forEach((r,i)=>{const f=((t*.26+i*.33)%1+1)%1;r.scale.setScalar(.53+f*1.5);r.material.opacity=.26*(1-f);});},
    dispose(){waterMat.dispose();rockMat.dispose();rockMap.dispose();for(const r of ripples)r.material.dispose();}};
}

function petModel(parent,cat,k){
  const {oval,limb,joint,mesh,cone}=k;
  const coat=cat?"#968d86":"#c99056",dark=cat?"#5e5a5b":"#805337",cream=cat?"#eee4d6":"#f4d7ab";
  const g=joint(parent,0,0,0),torso=joint(g,0,.32,0),neck=joint(torso,0,.085,.182);
  g.name=cat?"小猫":"小狗";
  oval(torso,coat,0,0,-.02,cat?.175:.22,cat?.17:.205,.319);
  oval(torso,cream,0,-.067,.112,cat?.124:.173,.125,.210);
  oval(torso,coat,0,.005,-.195,cat?.175:.205,.174,.192);
  oval(neck,coat,0,.055,.035,cat?.180:.197,cat?.162:.183,.160);
  for(const side of [-1,1]){
    if(cat){
      const ear=mesh(neck,cone,coat,[side*.118,.206,.012],[.089,.170,.077]);ear.rotation.z=side*-.20;
      const pink=mesh(neck,cone,"#d5a19b",[side*.119,.213,.052],[.054,.111,.031]);pink.rotation.z=side*-.20;
    }else{
      const ear=oval(neck,dark,side*.177,.069,-.008,.063,.153,.089);ear.rotation.z=side*.20;
      oval(neck,"#ad7653",side*.193,.012,.052,.039,.069,.025);
    }
    oval(neck,cream,side*.05,.013,.165,.066,.055,cat?.046:.081);
    oval(neck,"#302d2b",side*.078,.090,.170,.029,.034,.018);
    oval(neck,"#fff2d8",side*.074,.104,.186,.009,.010,.006);
    if(cat){
      for(let i=0;i<3;i++)limb(neck,"#d7cbb9",[side*.082,.025-i*.011,.198],[side*(.229-i*.008),.044-i*.031,.204],.004);
      for(let i=0;i<3;i++)oval(torso,dark,side*.155,.053,.109-i*.084,.019,.055,.016).rotation.z=-side*.3;
    }else oval(neck,cream,side*.079,.145,.145,.038,.016,.016);
  }
  oval(neck,cat?"#b68280":"#39302b",0,.043,cat?.209:.248,.031,.022,.023);
  if(cat){
    for(const side of [-1,1]){
      limb(neck,dark,[side*.057,.207,.078],[side*.023,.149,.15],.012);
      limb(neck,dark,[side*.15,.067,.125],[side*.178,.046,.061],.009);
      oval(neck,"#c6af81",side*.080,.081,.186,.014,.012,.006);
    }
  }else{
    const collar=mesh(neck,new T.TorusGeometry(.135,.016,8,28),"#627e75",[0,-.046,0]);collar.rotation.x=Math.PI/2;
    oval(neck,"#d9ad59",0,-.080,.133,.025,.033,.009);
  }
  const hips=[],feet=[];
  for(let i=0;i<4;i++){
    const side=i%2?1:-1,front=i<2;
    const j=joint(torso,side*(cat?.107:.14),-.052,front?.164:-.194);hips.push(j);
    oval(j,coat,0,-.078,0,.061,front?.116:.14,front?.060:.084);
    const f=joint(j,0,-.168,0);feet.push(f);oval(f,cream,0,-.052,.018,.056,.060,.074);
    for(let t=-1;t<=1;t++)oval(f,cream,t*.026,-.080,.068,.017,.024,.026);
  }
  const tails=[];let root=joint(torso,0,.045,-.28);
  for(let i=0;i<(cat?6:4);i++){
    const j=joint(root,0,i?.084:0,0);tails.push(j);
    const r=(cat?.046:.063)*(1-i/(cat?9:6));
    oval(j,cat&&i%2===1?dark:i===3&&!cat?cream:coat,0,.048,0,r,.075,r);root=j;
  }
  return {g,pose(mode,t){
    const low=["lie","sleep"].includes(mode),sit=["sit","groom","hug","stroke"].includes(mode),
      moving=["walk","run","circle","fetch","jump"].includes(mode),step=t*(mode==="run"||mode==="fetch"?10:6);
    torso.position.y=low?.17:sit?.26:.32;torso.position.y+=.009*Math.sin(t*1.6);
    torso.rotation.x=low?.04:sit?-.27:mode==="stretch"?.22:0;
    neck.rotation.x=mode==="sniff"?.54:mode==="stroke"?-.18:mode==="groom"?.48:low?.20:Math.sin(t*2)*.04;
    neck.rotation.y=mode==="groom"?.87+.1*Math.sin(t*3):sit?.12*Math.sin(t*.8):0;
    neck.rotation.z=mode==="stroke"?.16*Math.sin(t*2.3):0;
    hips.forEach((j,i)=>{j.rotation.x=low?(i<2?-.94:1.04):sit&&i>=2?1.08:moving?.52*Math.sin(step+([0,Math.PI,Math.PI,0][i])):0;
      feet[i].rotation.x=low?.32:sit&&i>=2?-.85:0;});
    tails.forEach((j,i)=>{j.rotation.x=(i===0?(cat?-.67:-1.02):cat?.22:.16)+(low?.13:0);
      j.rotation.z=Math.sin(t*(cat?1.7:4.3)-i*.48)*(i===0?.33:.12);});
  }};
}

function sampleTrack(keys,t){
  let b=keys.findIndex(k=>k[0]>t);if(b<0)b=keys.length-1;
  const i=Math.max(0,b-1),a=keys[i],next=keys[b],f=clamp((t-a[0])/(next[0]-a[0]||1),0,1);
  const p=[1,2,3].map(n=>a[n]+(next[n]-a[n])*f);if(a[4]==="jump")p[1]+=.20*Math.sin(Math.PI*f);
  let dx=next[1]-a[1],dz=next[3]-a[3];
  for(let j=i;Math.hypot(dx,dz)<.001&&j>0;j--){dx=a[1]-keys[j-1][1];dz=a[3]-keys[j-1][3];}
  const yaw=Math.hypot(dx,dz)<.001?.2:Math.atan2(dx,dz);
  return {p,mode:a[4],place:a[5],yaw};
}
function location(s,pet,epoch){
  for(const e of [...(s.pet_events||[])].reverse()){
    const keys=e.tracks[pet],t=epoch-e.start;
    if(keys&&t>=0&&t<keys.at(-1)[0])return {...sampleTrack(keys,t),event:e,t};
  }
  const def=s.pet_routes?.[pet];if(!def)return null;
  const slot=Math.floor(epoch/def.period),v=(Math.imul(slot,1664525)+1013904223+(pet==="cat"?1783:71))>>>0;
  return sampleTrack(def.routes[((v^(v>>>16))>>>0)%def.routes.length],epoch-slot*def.period);
}
function clearBody(p,x,z,r,side){
  let dx=p[0]-x,dz=p[2]-z;const d=Math.hypot(dx,dz);
  if(d>=r)return;
  if(d<.001){dx=side;dz=0;}else{dx/=d;dz/=d;}
  p[0]=x+dx*r;p[2]=z+dz*r;
}

function avoidCompanions(p,actor,other,side){
  const near=actor&&Math.abs(p[1]+groundY-actor[1])<1.45;
  const radius=.92,petRadius=.55;
  if(near)clearBody(p,actor[0],actor[2],radius,side);
  if(!other||Math.abs(p[1]-other[1])>=.6)return;
  clearBody(p,other[0],other[2],petRadius,side);
  if(!near||Math.hypot(p[0]-actor[0],p[2]-actor[2])>=radius)return;
  // Pick the nearer intersection of the two clearance circles instead of pushing a pet into the resident.
  const dx=other[0]-actor[0],dz=other[2]-actor[2],d=Math.hypot(dx,dz);
  if(d<.001){clearBody(p,actor[0],actor[2],radius,side);return;}
  const along=(radius*radius-petRadius*petRadius+d*d)/(2*d);
  const cross=Math.sqrt(Math.max(0,radius*radius-along*along));
  const sign=(p[2]-actor[2])*dx-(p[0]-actor[0])*dz>=0?1:-1;
  p[0]=actor[0]+(along*dx-sign*cross*dz)/d;p[2]=actor[2]+(along*dz+sign*cross*dx)/d;
}

export function wildlife(root,scene){
  const k=kit(),pond=pondLife(root,k),pets={dog:petModel(root,false,k),cat:petModel(root,true,k)};
  const toy=k.joint(root,0,0,0);toy.name="飞盘";
  const rim=k.mesh(toy,new T.TorusGeometry(.142,.023,8,32),"#da7744");rim.rotation.x=Math.PI/2;
  k.oval(toy,"#f9be61",0,0,0,.139,.018,.139);toy.visible=false;
  let state=null;
  return {update(value){state=value;},pet(name){
    const rig=pets[name];return rig?.g.visible?{position:rig.g.position.toArray(),mode:rig.g.userData.activity}:null;
  },pose(epoch){
    if(!state)return;
    const phase=epoch%86400;
    pond.pose(phase,state.phase==="night");toy.visible=false;
    let other=null;
    for(const [name,rig] of Object.entries(pets)){
      const view=!state.replay&&scene.userData.livePetEvents?{...state,pet_events:scene.userData.livePetEvents}:state;
      const loc=location(view,name,epoch);rig.g.visible=!!loc;if(!loc)continue;
      const {p,event:e}=loc;
      const actor=scene.userData.yardResident;
      const contact=e&&loc.t>=e.contact-.6&&loc.t<=e.release+.35&&e.action!=="bench";
      if(!contact){
        const fallback=state.bench_seated?[seat.x,groundY+seat.top,seat.z]:null;
        const pos=actor?.visible?actor.position.toArray():fallback;
        avoidCompanions(p,pos,other,name==="dog"?-1:1);
      }
      other=p;rig.g.position.set(...p);rig.g.rotation.y=contact&&loc.mode==="hug"?1.58:contact&&loc.mode==="stroke"?Math.PI:loc.yaw;
      rig.pose(loc.mode,phase+(name==="cat"?.63:0));
      rig.g.userData.activity=loc.mode;rig.g.userData.place=loc.place;
      if(name==="dog"&&e?.action==="fetch"&&loc.t>=e.contact&&loc.t<e.release){
        toy.visible=true;
        const flight=clamp((loc.t-e.contact-.50)/1.46,0,1);
        if(loc.mode==="fetch"){toy.position.set(p[0]+.31*Math.sin(loc.yaw),p[1]+.31,p[2]+.31*Math.cos(loc.yaw));}
        else{toy.position.set(meet[0]+(landing[0]-meet[0])*flight,
          .12+.74*(1-flight)+Math.sin(flight*Math.PI)*1.15,meet[2]+.22+(landing[2]-meet[2]-.22)*flight);}
        toy.rotation.set(.19,phase*5,.20);
      }
    }
  },dispose(){pond.dispose();k.dispose();}};
}
