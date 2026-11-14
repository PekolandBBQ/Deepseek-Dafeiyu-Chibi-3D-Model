import * as T from "three";

const originals=new WeakMap();
const slices=64; // Cross sections in shoulderSurface.
const cuts={
  summer:{end:24,ease:.016,gather:true},
  star:{end:23,ease:.019,gather:true},
  winter:{ease:.013},sleep:{ease:.019},rain:{ease:.016},sailor:{ease:.007}
};

// Work in the neutral upper arm's frame. Preserve the existing shoulder
// weights and cut physically shorter sleeves above the forearm.
function tailor(source,mesh,cut){
  const arm=mesh.skeleton.bones.find(b=>/^Arm[LR]$/.test(b.name));
  const inverse=mesh.skeleton.boneInverses[mesh.skeleton.bones.indexOf(arm)];
  const toBind=inverse.clone().invert(),g=source.clone(),p=g.attributes.position;
  g.morphAttributes={};
  const ringCount=p.count/slices,last=cut.end??ringCount-1;
  if(cut.end){
    g.setIndex(Array.from(g.index.array).slice(0,last*slices*6));
    for(const [name,attr] of Object.entries(g.attributes)){
      const size=(last+1)*slices*attr.itemSize;
      g.setAttribute(name,new T.BufferAttribute(attr.array.slice(0,size),attr.itemSize,attr.normalized));
    }
  }
  const dst=g.attributes.position,ring=Array.from({length:slices},()=>new T.Vector3());
  const centre=new T.Vector3(),old=new T.Vector3();
  for(let row=0;row<=last;row++){
    centre.setScalar(0);
    for(let j=0;j<slices;j++){
      ring[j].fromBufferAttribute(p,row*slices+j).applyMatrix4(inverse);centre.add(ring[j]);
    }
    centre.divideScalar(slices);
    const depth=-centre.y,t=row/last;
    const start=T.MathUtils.smoothstep(depth,cut.end ? .014 : .025,cut.end ? .065 : .095);
    const finish=cut.gather?1-T.MathUtils.smoothstep(t,.77,1):1-T.MathUtils.smoothstep(depth,.239,.289);
    for(let j=0;j<slices;j++){
      const a=j*2*Math.PI/slices;
      const ease=cut.ease*start*finish*(1+.11*Math.cos(8*a+1.4*t));
      old.copy(ring[j]).sub(centre).normalize().multiplyScalar(ease).add(ring[j]).applyMatrix4(toBind);
      dst.setXYZ(row*slices+j,old.x,old.y,old.z);
    }
  }
  dst.needsUpdate=true;g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
  return g;
}

export function styleOutfitSleeves(type,{sleeves,cuffs,model}){
  for(const mesh of sleeves){
    if(!originals.has(mesh))originals.set(mesh,mesh.geometry);
    const src=originals.get(mesh);
    if(mesh.geometry!==src)mesh.geometry.dispose();
    mesh.geometry=cuts[type]?tailor(src,mesh,cuts[type]):src;
    // Three only refreshes these fields when the new geometry has morphs.
    // A cut sleeve has static gathers and must shed the maid sleeve's targets.
    mesh.morphTargetInfluences=undefined;
    mesh.morphTargetDictionary=undefined;
    mesh.updateMorphTargets();
    const maid=mesh.morphTargetDictionary?.MaidGatheredSleeve;
    if(maid!==undefined)mesh.morphTargetInfluences[maid]=Number(type==="maid");
  }
  // Each outfit supplies its own gathered lace or plain bound opening.
  for(const mesh of cuffs)mesh.scale.setScalar(0);
  if(sleeves.length){
    const mat=sleeves[0].material,rain=type==="rain";
    // A pale translucent outer shell lets the lining show through the raincoat.
    mat.transparent=rain;mat.opacity=rain?.64:1;mat.depthWrite=!rain;
    mat.roughness=rain?.24:.75;mat.clearcoat=rain?.82:0;mat.needsUpdate=true;
  }
  model.traverse(o=>{if(o.name==="SleeveBraid")o.scale.setScalar(0);});
}

export function disposeUpperSleeves(sleeves){
  for(const mesh of sleeves){
    const source=originals.get(mesh);
    if(source&&mesh.geometry!==source){mesh.geometry.dispose();mesh.geometry=source;}
    originals.delete(mesh);
  }
}

const pearl=0xfff3df;
function loop(fn){
  return Array.from({length:96},(_,j)=>fn(j*Math.PI/48));
}
function frill(api,parent,name,{x=0,y,z=0,rx,rz,drop,flare,n,color=pearl,travel=.005}){
  const frames=loop(a=>{
    const co=Math.cos(a),si=Math.sin(a);
    return {root:[x+rx*co,y,z+rz*si],
      hem:[x+(rx+flare)*co,y-drop,z+(rz+flare)*si],normal:[co,.08,si]};
  });
  return api.addLace(parent,name,frames,{closed:true,color,scallops:n,maxTravel:travel});
}
function ribbon(api,parent,name,y,x,rx,rz,height,color){
  const prof=[[-height,.965],[-height,1],[height,1.035],[height,.985],[-height,.965]];
  const shape=new T.LatheGeometry(prof.map(([dy,r])=>new T.Vector2(rx*r,dy)),64);
  api.piece(parent,name,shape,api.material(color),x,y,0,1,1,rz/rx);
}
function bonnet(api,h,type){
  const band=api.model.getObjectByName("褶边发带");
  if(!band)return;
  const pos=band.geometry.attributes.position,count=pos.count/4,frames=[];
  for(let i=0;i<count;i+=2){
    const at=i*4+2,t=i/(count-1),n=new T.Vector3(Math.sin((t-.5)*3.06),Math.cos((t-.5)*3.06),.12);
    const p=new T.Vector3().fromBufferAttribute(pos,at);
    const width=(type==="star"?.014:.018)*(.26+.74*Math.sin(t*Math.PI));
    frames.push({root:p.toArray(),hem:p.clone().addScaledVector(n,width).toArray(),normal:n.toArray()});
  }
  const name={maid:"女仆发箍镂花外缘",star:"星愿珠冠窄花边",winter:"海雾发箍针织花缘"}[type];
  api.addLace(h,name,frames,{closed:false,color:pearl,scallops:type==="star"?22:18,maxTravel:.003});
}
function summerHat(api,h){
  // Match the straw brim's tilt and offset.
  const node=new T.Group();h.add(node);node.position.set(-.05,.38,-.025);node.rotation.z=.17;
  frill(api,node,"草帽檐象牙钩花",{y:-.005,rx:.553,rz:.484,drop:.020,flare:.014,n:42,travel:.006});
}
function nightCap(api,h){
  // The sleeping cap is set back on the head. The lace follows the
  // forehead edge of its tilted ellipsoid and disappears behind the ears.
  const node=new T.Group();h.add(node);node.position.set(0,.364,-.104);node.rotation.z=-.18;
  const frames=[];
  for(let i=0;i<=80;i++){
    const a=-1.55+3.1*i/80,co=Math.cos(a),si=Math.sin(a);
    const x=.426*si,y=-.040+.014*co,z=.390*co;
    frames.push({root:[x,y,z],hem:[x+.008*si,y-.035,z+.014*co],normal:[si,0,co]});
  }
  api.addLace(node,"软睡帽额缘荷叶边",frames,{closed:false,color:pearl,scallops:16,maxTravel:.005});
}
function pressShirt(api,chest){
  for(const side of [-1,1]){
    const frames=[];
    for(let i=0;i<=36;i++){
      const t=i/36,y=.348-.125*t,x=side*(.061-.025*t),z=.127+.020*t;
      frames.push({root:[x,y,z],hem:[x+side*.014,y-.006,z+.006],normal:[0,.06,1]});
    }
    api.addLace(chest,"报刊衬衫领襟褶边",frames,{closed:false,color:pearl,scallops:8,maxTravel:.003});
  }
}
function shortCuff(api,arm,side,type){
  const p=api.group(arm),star=type==="star";
  p.position.set(side*(star?-.010:-.008),star?-.067:-.077,0);
  p.rotation.z=side*(star?.44:.39);
  ribbon(api,p,"短泡袖束边",0,0,.049,.057,.0065,star?0x77759f:0xa7bddd);
  frill(api,p,star?"礼服短袖珍珠花边":"夏日短泡袖花缘",{
    y:-.004,rx:.049,rz:.057,drop:.016,flare:.007,n:10,travel:.003});
}

function rainLining(api,mesh){
  // Anchor a lining on the same skeleton, so it follows the full reach of
  // the moving transparent sleeve without poking through its outer shell.
  const src=originals.get(mesh);
  if(!src)return;
  const shape=src.clone();
  shape.morphAttributes={};
  const liner=new T.SkinnedMesh(shape,api.material(0xc4cbeb));
  liner.name="雨衣内袖"+(mesh.name.endsWith("-1")?"左":"右");
  liner.frustumCulled=false;liner.castShadow=true;liner.receiveShadow=true;
  api.group(api.model).add(liner);liner.bind(mesh.skeleton,mesh.bindMatrix);
  // This mesh reuses the resident's skeleton. Only its own vertex buffers
  // are owned by the temporary look.
  liner.parent.addEventListener("removed",()=>shape.dispose(),{once:true});
}

export function buildUpperOutfit(type,api){
  const h=api.group(api.head),chest=api.group(api.body);
  if(["maid","star","winter"].includes(type))bonnet(api,h,type);
  if(type==="summer")summerHat(api,h);
  if(type==="sleep")nightCap(api,h);
  if(type==="press")pressShirt(api,chest);
  if(type==="winter")frill(api,chest,"冬披肩绒边内侧钩花",{y:.194,rx:.224,rz:.171,drop:.019,flare:.019,n:24});
  if(type==="rain")for(const name of ["袖管-1","袖管1"]){
    const mesh=api.model.getObjectByName(name);if(mesh)rainLining(api,mesh);
  }
  for(const side of [-1,1]){
    const suffix=side<0?"L":"R";
    const elbow=api.model.getObjectByName("Elbow"+suffix),wrist=api.group(elbow),x=side*.008;
    if(type==="summer"||type==="star"){
      shortCuff(api,api.model.getObjectByName("Arm"+suffix),side,type);
      if(type==="star")frill(api,wrist,"星愿独立腕花",{x,y:-.132,rx:.037,rz:.042,drop:.028,flare:.013,n:10});
    }else if(type==="sailor"){
      ribbon(api,wrist,"水手针织袖口",-.140,x,.043,.049,.013,0x8ab4e3);
      ribbon(api,wrist,"水手袖口白条纹",-.143,x,.044,.050,.002,pearl);
    }else if(type==="winter"){
      ribbon(api,wrist,"冬装绒面束袖",-.132,x,.045,.052,.015,0xffeddc);
      frill(api,wrist,"冬装袖内针织花边",{x,y:-.143,rx:.045,rz:.052,drop:.015,flare:.006,n:12});
    }else if(type==="press"||type==="sleep"||type==="rain"){
      const night=type==="sleep",rain=type==="rain";
      ribbon(api,wrist,night?"睡衣柔软束袖":rain?"雨衣透明包边":"报刊夹克收袖",
        -.133,x,.044,.050,.010,night?0xc2bfdb:rain?0xbad4f1:0x293452);
      frill(api,wrist,night?"睡衣宽荷叶袖口":rain?"雨衣袖内白花边":"报刊衬衫袖边",{
        x,y:-.141,rx:.042,rz:.050,drop:night?.030:.021,flare:night?.014:.008,
        n:night?10:14,travel:night?.007:.004});
    }
  }
}
