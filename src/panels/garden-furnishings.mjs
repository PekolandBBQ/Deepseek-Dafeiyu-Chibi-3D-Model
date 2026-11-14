import * as T from "three";
import {groundY,seat,wallCenter} from "./garden-landscape.mjs";

export function furnishings(root,block){
  const geos=new Set(),mats=new Set();
  const timber="#885b42",wood="#bd8d60",edge="#d6ac79",iron="#605247";
  const base=new T.Group();base.name="树下阅读角";root.add(base);
  base.position.set(seat.x,0,seat.z);base.rotation.y=seat.yaw;
  for(const x of [-.95,.95])for(const z of [-.24,.24]){
    const leg=block(base,x,.27,z,.13,.55,.14,timber);leg.rotation.z=Math.sign(x)*-.07;
    block(base,x,.055,z,.18,.08,.18,iron);
  }
  for(let i=0;i<5;i++)block(base,0,seat.top-.057,-.34+i*.17,2.58,.114,.15,i%2?wood:edge);
  for(const x of [-1.17,1.17]){
    block(base,x,.94,-.32,.09,.84,.09,timber).rotation.x=-.11;
    block(base,x,.76,.22,.08,.31,.08,timber);
    block(base,x,.95,0,.13,.09,.77,wood);
  }
  for(let i=0;i<3;i++)block(base,0,.87+i*.19,-.37-i*.021,2.62,.155,.081,i%2?edge:wood);
  const table=new T.Group();table.name="矮桌与陶灯";base.add(table);table.position.set(.64,0,1.05);
  for(const x of [-.38,.38])for(const z of [-.26,.26])block(table,x,.25,z,.104,.50,.104,timber);
  for(let i=0;i<5;i++)block(table,-.45+.225*i,.53,0,.213,.115,.83,i%2?edge:wood);
  function solid(parent,geo,mat,x,y,z){
    geos.add(geo);mats.add(mat);const mesh=new T.Mesh(geo,mat);
    mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  const pottery=new T.MeshStandardMaterial({color:"#a05e42",roughness:.91});
  const glass=new T.MeshStandardMaterial({color:"#f6d9a2",emissive:"#ffad43",emissiveIntensity:.04});
  const lamp=new T.Group();lamp.name="陶灯";table.add(lamp);lamp.position.set(-.28,.59,-.12);
  const lathe=(profile)=>new T.LatheGeometry(profile.map(([r,y])=>new T.Vector2(r,y)),16);
  solid(lamp,lathe([[.001,0],[.12,0],[.135,.035],[.105,.06],[.135,.11]]),pottery,0,0,0);
  solid(lamp,new T.CylinderGeometry(.124,.129,.199,16),glass,0,.198,0);
  for(let i=0;i<6;i++){const a=i*Math.PI/3;block(lamp,Math.sin(a)*.126,.20,Math.cos(a)*.126,.026,.20,.026,"#985c42");}
  solid(lamp,lathe([[.14,.296],[.153,.314],[.119,.342],[.057,.382],[.029,.377]]),pottery,0,0,0);
  solid(lamp,new T.TorusGeometry(.057,.010,6,16),pottery,0,.408,0);
  const glow=new T.PointLight("#ffbd6e",0,5,2);lamp.add(glow);glow.position.set(0,.28,.08);
  const book=new T.Group();book.name="矮桌上的书";table.add(book);book.position.set(.19,.596,.08);book.rotation.y=-.21;
  block(book,0,.01,0,.41,.035,.30,"#916c55");
  for(const side of [-1,1])block(book,.098*side,.039,0,.192,.026,.278,"#f4e6c9").rotation.z=side*-.09;
  let bookAvailable=false,beingRead=false;book.visible=false;

  // Continue the short indoor left wall above the wainscot. Its face points into the room.
  const wall=new T.Group();wall.name="屋内画墙";root.add(wall);wall.rotation.y=Math.PI/2;
  wall.position.set(wallCenter.x,wallCenter.y-groundY,wallCenter.z);
  block(wall,0,0,0,3.71,2.31,.13,"#eadcc3");block(wall,0,.015,.074,3.53,2.09,.032,"#f1e6d0");
  block(wall,0,1.16,.013,3.82,.080,.17,"#be9a70");block(wall,0,-1.14,.077,3.73,.078,.16,"#b6926e");
  const prints=new T.Group();prints.name="她亲手贴的画";wall.add(prints);prints.position.z=.106;
  const paper=new T.PlaneGeometry(1,1),paperMat=new T.MeshStandardMaterial({color:"#fff9e9",roughness:.96});
  const tapeMat=new T.MeshStandardMaterial({color:"#dcc592",transparent:true,opacity:.82,roughness:.95});
  geos.add(paper);mats.add(paperMat);mats.add(tapeMat);
  const loader=new T.TextureLoader();let key="",generation=0,pending=Promise.resolve(),frames=[],textures=[],disposed=false;
  function clear(){
    prints.clear();for(const m of frames)m.dispose();for(const t of textures)t.dispose();frames=[];textures=[];
  }
  function updateWall(entries){
    const next=entries.map(p=>p.id+":"+p.tilt).join("|");
    if(key===next)return pending;
    key=next;const current=++generation;clear();
    const cols=Math.max(3,Math.ceil(Math.sqrt(entries.length*1.65))),rows=Math.max(2,Math.ceil(entries.length/cols));
    const dw=3.35/cols,dh=1.94/rows;
    pending=Promise.all(entries.map(async(p,i)=>{
      const tex=await loader.loadAsync(p.image);
      if(disposed||current!==generation){tex.dispose();return;}
      tex.colorSpace=T.SRGBColorSpace;textures.push(tex);
      const group=new T.Group();group.name=p.title;prints.add(group);
      group.position.set((i%cols-(cols-1)/2)*dw,((rows-1)/2-Math.floor(i/cols))*dh,0);
      group.rotation.z=T.MathUtils.degToRad(p.tilt);
      const w=Math.min(dw*.84,dh*.79*p.aspect),h=w/p.aspect;
      const border=new T.Mesh(paper,paperMat);border.scale.set(w+.048,h+.051,1);group.add(border);
      const mat=new T.MeshStandardMaterial({map:tex,emissiveMap:tex,emissive:"#ffffff",emissiveIntensity:.17,roughness:1});
      const print=new T.Mesh(paper,mat);frames.push(mat);print.scale.set(w,h,1);print.position.z=.004;group.add(print);
      for(const hand of [-1,1]){
        const tape=new T.Mesh(paper,tapeMat);group.add(tape);tape.scale.set(Math.min(.20,w*.35),.053,1);
        tape.position.set(hand*w*.36,h*.50,.009);tape.rotation.z=hand*-.24;
      }
    })).catch(err=>{if(current===generation&&!disposed)key=null;throw err;});
    return pending;
  }
  return {setReading(value){beingRead=value;book.visible=bookAvailable&&!beingRead;},update(state){
    const lit=state.lamp_lit??["dusk","night"].includes(state.phase);
    glass.emissiveIntensity=lit?1.65:.04;glow.intensity=lit?4.8:0;
    bookAvailable=!!state.bench_book;book.visible=bookAvailable&&!beingRead;
    return updateWall(state.wall||[]);
  },dispose(){disposed=true;generation++;clear();for(const g of geos)g.dispose();for(const m of mats)m.dispose();}};
}
