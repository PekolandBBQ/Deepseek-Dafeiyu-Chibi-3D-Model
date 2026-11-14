import * as T from "three";
import fixtures from "../../assets/home-fixtures.json";
import {groundY} from "./garden-landscape.mjs";

// The tabletop food is static. Batch its repeated grains, scallions and crockery by shape and glaze.
function tableware(table){
  const unitSphere=new T.SphereGeometry(1,12,9),cylinder=new T.CylinderGeometry(1,1,1,24);
  const lathe=points=>new T.LatheGeometry(points.map(p=>new T.Vector2(...p)),32);
  const bowl=lathe([[.01,0],[.48,.01],[.59,.12],[.81,.39],[1,.68],[1,.76],[.92,.77],[.80,.53],[.48,.18],[.01,.12]]);
  const plate=lathe([[.01,0],[.66,0],[.82,.04],[1,.15],[.98,.20],[.83,.13],[.72,.075],[.01,.063]]);
  const ring=new T.TorusGeometry(1,.105,6,22),bun=new T.SphereGeometry(1,12,8);
  const batches=new Map(),materials=new Map(),geos=new Set(),dummy=new T.Object3D();
  let origin;
  function put(geometry,color,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0){
    geos.add(geometry);
    if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:.71}));
    const key=geometry.id+":"+color;
    if(!batches.has(key))batches.set(key,{geometry,material:materials.get(color),matrices:[]});
    dummy.position.set(origin[0]+x,y,origin[1]+z);dummy.rotation.set(rx,ry,rz);
    dummy.scale.set(sx,sy,sz);dummy.updateMatrix();batches.get(key).matrices.push(dummy.matrix.clone());
  }
  const oval=(color,x,y,z,w,h,d,angle=0)=>put(unitSphere,color,x,y,z,w,h,d,0,angle);
  const disc=(color,x,y,z,r,h)=>put(cylinder,color,x,y,z,r,h,r);
  const loop=(color,x,y,z,r,angle=0)=>put(ring,color,x,y,z,r,r,r,Math.PI/2,0,angle);
  function dish(geo,r,tint,stretch=1){
    put(geo,tint,0,0,0,r,r,r*stretch);
    put(ring,"#547c7c",0,r*(geo===plate?.177:.735),0,r*.965,r*.965*stretch,.049,Math.PI/2);
  }
  function clusters(n,r,place){
    for(let i=0;i<n;i++){
      const angle=i*2.399963,rad=r*Math.sqrt((i+.4)/n);
      place(rad*Math.cos(angle),rad*Math.sin(angle),angle,i);
    }
  }
  const dishes={
    rice(){
      dish(bowl,.34,"#eef0dc");oval("#f2eedb",0,.237,0,.306,.145,.306);
      clusters(46,.271,(x,z,a,i)=>oval(i%3?"#faf6e4":"#e3deca",x,.242+.142*Math.sqrt(1-(x*x+z*z)/.094),z,.038,.015,.018,a));
    },
    noodles(){
      dish(bowl,.305,"#507c82");disc("#ae672e",0,.199,0,.268,.025);
      for(let i=0;i<9;i++)loop("#efca75",.12*Math.cos(i*2.4),.22+i%3*.006,.13*Math.sin(i*2.4),.093-i%3*.008,i);
      oval("#ffefcc",-.045,.242,.032,.138,.028,.105,.6);oval("#f3a728",-.042,.274,.038,.065,.04,.065);
      clusters(19,.238,(x,z,a)=>{if(Math.hypot(x+.045,z-.032)>.118)loop("#548452",x,.24,z,.018,a);});
    },
    roast(){
      dish(plate,.31,"#d9cbb7",.93);
      for(let i=0;i<3;i++){
        const x=-.12+.113*i,z=.065-.066*i;
        oval("#6d412d",x,.088,z,.095,.050,.193,-.43);
        oval(i===2?"#713d29":"#b06b46",x,.115,z,.087,.044,.18,-.43);
        for(let j=0;j<3;j++)oval(i===2?"#3c2a24":"#75412e",x+.022*j-.023,.152,z-.087+j*.077,.074,.008,.013,-.54);
      }
    },
    buns(){
      disc("#bc8c52",0,.085,0,.282,.15);disc("#f4e1af",0,.164,0,.257,.014);
      for(const y of [.027,.157,.191])loop("#d1a568",0,y,0,.273);
      for(const [x,z] of [[0,-.118],[-.112,.08],[.113,.08]]){
        put(bun,"#f4d9a9",x,.23,z,.103,.080,.103);
        for(let k=0;k<8;k++){
          const a=k*Math.PI/4;
          oval("#ead09d",x+.038*Math.cos(a),.283,z+.038*Math.sin(a),.034,.030,.013,-a);
        }
        oval("#d39954",x,.302,z,.025,.01,.025);
      }
    },
    soup(){
      dish(bowl,.303,"#e0e8d6");disc("#f5e4b9",0,.207,0,.268,.022);
      clusters(13,.213,(x,z,a,i)=>oval(i%3?"#d6a45a":"#fff5db",x,.222,z,i%3?.055:.064,.008,i%3?.009:.029,a));
    },
    shrimp(){
      dish(plate,.265,"#e7ebdb");
      clusters(6,.153,(x,z,a,i)=>{
        oval(i%2?"#d99840":"#d88c35",x,.115,z,.084,.075,.084);
        for(let j=0;j<5;j++)oval("#efbd65",x+.046*Math.cos(a+j*2),.164,z+.045*Math.sin(a+j*2),.018,.013,.017);
      });
    },
    cakes(){
      dish(plate,.272,"#a9c3bc");
      for(const [i,[x,z]] of [[-.10,.075],[.08,.055],[0,-.095]].entries()){
        oval("#b67b40",x,.093+i*.009,z,.125,.045,.079,i-.4);
        oval("#dfa957",x,.124+i*.009,z,.114,.017,.070,i-.4);
        for(let j=0;j<4;j++)oval("#b47a40",x+.054*Math.cos(j*2),.139+i*.009,z+.035*Math.sin(j*2),.018,.004,.01);
      }
    },
    orange(){
      dish(plate,.239,"#e7e4c6");
      for(let i=0;i<8;i++){
        const a=i*Math.PI/4,x=.117*Math.cos(a),z=.117*Math.sin(a);
        oval("#ef9632",x,.092,z,.078,.055,.042,-a);
        oval("#ffc161",x,.136,z,.062,.014,.022,-a);
      }
    },
    greens(){
      dish(plate,.244,"#ece4cf");
      for(let i=0;i<9;i++){
        const a=i*2.4,x=.076*Math.cos(a),z=.075*Math.sin(a);
        oval("#9bb862",x,.068+i*.006,z,.108,.015,.018,-a);
        oval(i%2?"#60884b":"#739954",x+.089*Math.cos(a),.08+i*.006,z+.089*Math.sin(a),.081,.022,.051,-a);
      }
    },
    sweets(){
      dish(plate,.239,"#d5bab5",.81);
      for(const [x,z] of [[-.1,0],[.092,.015]]){
        for(let k=0;k<5;k++){
          const a=k*2*Math.PI/5;
          oval("#d89370",x+.046*Math.cos(a),.085,z+.046*Math.sin(a),.047,.038,.042);
        }
        oval("#efc479",x,.113,z,.034,.027,.034);
      }
    }
  };
  const food=new T.Group();food.name="长桌上的十道菜";food.position.y=1.096;table.add(food);
  for(const item of fixtures.menu){
    origin=item.at;dishes[item.id]();
  }
  for(const {geometry,material,matrices} of batches.values()){
    const mesh=new T.InstancedMesh(geometry,material,matrices.length);
    matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.computeBoundingSphere();
    mesh.castShadow=mesh.receiveShadow=true;food.add(mesh);
  }
  return ()=>{for(const m of food.children)m.dispose();for(const g of geos)g.dispose();for(const m of materials.values())m.dispose();};
}

export function hearthAndTable(root,block){
  const table=new T.Group(),hearth=new T.Group();
  table.name="枫树下的聚餐长桌";hearth.name="屋内的砖壁炉";root.add(table,hearth);
  table.position.set(fixtures.table[0],0,fixtures.table[1]);
  hearth.position.set(fixtures.hearth[0],-groundY,fixtures.hearth[1]);hearth.rotation.y=Math.PI;
  const geos=new Set(),mats=new Set();
  function mesh(parent,geo,mat,x,y,z){
    const m=new T.Mesh(geo,mat);geos.add(geo);mats.add(mat);m.position.set(x,y,z);
    m.castShadow=m.receiveShadow=true;parent.add(m);return m;
  }
  for(const x of [-1.48,1.48])for(const z of [-.61,.61])block(table,x,.49,z,.145,.98,.15,"#876342");
  block(table,0,.88,0,3.6,.18,1.34,"#99734c");block(table,0,1.012,0,3.78,.11,1.65,"#ba9366");
  for(const x of [-1.73,1.72]){
    const z=x<0?-.99:-1.03;
    block(table,x,.43,z,.59,.10,.43,"#be986a");
    for(const dx of [-.21,.21])for(const dz of [-.13,.13])block(table,x+dx,.2,z+dz,.073,.40,.073,"#8b6a4c");
  }
  // Continuous woven linen. Only the hanging corners move, so the crockery always rests on the top.
  const fabricCanvas=document.createElement("canvas");fabricCanvas.width=fabricCanvas.height=256;
  const ctx=fabricCanvas.getContext("2d");ctx.fillStyle="#f1e3c8";ctx.fillRect(0,0,256,256);
  for(let i=0;i<256;i+=4){ctx.fillStyle="rgba(100,75,45,.08)";ctx.fillRect(i,0,1,256);ctx.fillRect(0,i,256,1);}
  for(const i of [12,19,230,237]){ctx.fillStyle="#a86d55";ctx.fillRect(i,0,3,256);}
  ctx.fillStyle="rgba(115,137,119,.45)";ctx.fillRect(0,109,256,3);ctx.fillRect(0,119,256,1);
  const linen=new T.CanvasTexture(fabricCanvas);linen.wrapS=linen.wrapT=T.RepeatWrapping;linen.repeat.set(2,2);linen.colorSpace=T.SRGBColorSpace;
  const fabric=new T.MeshStandardMaterial({map:linen,side:T.DoubleSide,roughness:.98});
  const cloth=new T.PlaneGeometry(5.77,2.61,48,28),verts=cloth.attributes.position,loose=[];
  for(let i=0;i<verts.count;i++){
    const u=verts.getX(i),v=-verts.getY(i),a=Math.max(0,Math.abs(u)-1.90),b=Math.max(0,Math.abs(v)-.83);
    const fall=Math.hypot(a,b),ripple=Math.sin(v*17+u*4);
    const x=T.MathUtils.clamp(u,-1.90,1.90)+Math.sign(u)*a*(.09+.095*ripple);
    const z=T.MathUtils.clamp(v,-.83,.83)+Math.sign(v)*b*(.18+.14*Math.cos(u*10));
    const y=Math.max(.040,1.089-fall+.028*ripple*Math.min(1,fall));
    verts.setXYZ(i,x,y,z);
    if(a>.40&&b>.04)loose.push({i,x,y,z,w:(a-.40)*b*3,phase:v*3.6+u});
  }
  cloth.computeVertexNormals();mesh(table,cloth,fabric,0,0,0);
  const clearFood=tableware(table);

  const stone="#ab9a83",iron="#45433d",brick=["#ad7151","#bb8260","#a96b4e","#c08d6b"];
  block(hearth,0,.083,.09,2.57,.166,1.05,stone);
  block(hearth,0,.90,-.23,2.22,1.51,.18,"#8d604e");block(hearth,0,.82,-.114,1.46,1.18,.075,"#4b4841");
  for(let row=0;row<5;row++)for(const side of [-1,1]){
    const x=side*.935,y=.3+row*.247;
    block(hearth,x,y,.007,.476,.237,.56,brick[(row+(side===1?2:0))%4]);
    if(row%2===0)block(hearth,x+.034,y,.294,.012,.233,.008,"#d2ad8b");
  }
  for(let i=0;i<9;i++){
    const step=Math.PI/9,a=i*step+.012,b=(i+1)*step-.012,arch=new T.Shape();
    arch.moveTo(.69*Math.cos(a),.953+.427*Math.sin(a));
    arch.absellipse(0,.953,.69,.427,a,b,false,0);
    arch.lineTo(.98*Math.cos(b),.953+.704*Math.sin(b));
    arch.absellipse(0,.953,.98,.704,b,a,true,0);arch.closePath();
    mesh(hearth,new T.ExtrudeGeometry(arch,{depth:.56,bevelEnabled:false,curveSegments:4}),
      new T.MeshStandardMaterial({color:brick[i%4],roughness:.93}),0,0,-.25);
  }
  block(hearth,0,1.68,0,2.50,.17,.76,"#967757");block(hearth,0,1.79,-.01,2.59,.085,.78,"#cbb394");
  for(let row=0;row<7;row++){
    const w=Math.max(.61,1.72-row*.19),y=1.944+row*.27;
    block(hearth,0,y,-.123,w,.257,.46,brick[(row+1)%4]);
    block(hearth,(row%2?.18:-.17)*w,y,.112,.014,.255,.012,"#d5b89d");
  }
  const steel=new T.MeshStandardMaterial({color:iron,roughness:.67}),wood=new T.MeshStandardMaterial({color:"#75513a",roughness:.95});
  mesh(hearth,new T.CylinderGeometry(.178,.189,1.0,12),steel,0,4.14,-.14);
  block(hearth,0,4.65,-.14,.54,.084,.51,stone);
  const log=new T.CylinderGeometry(.070,.089,.74,9);
  for(let i=0;i<3;i++){const m=mesh(hearth,log,wood,-.13+i*.13,.338+i*.042,.09);m.rotation.set(.08,i*.84,1.34);}
  for(const x of [-.39,.39])block(hearth,x,.30,.12,.049,.075,.42,iron);
  for(let i=0;i<5;i++)block(hearth,-.39+i*.195,.335,.13,.039,.050,.37,iron);
  for(let i=0;i<4;i++){const m=mesh(hearth,log,wood,1.04+i%2*.117,.17+Math.floor(i/2)*.115,.35);m.rotation.x=1.39;}
  block(hearth,1.09,.38,.36,.22,.065,.14,"#c6a368");block(hearth,1.09,.417,.36,.15,.014,.13,"#994f3b");
  for(const side of [-1,1])block(hearth,-1.17+.029*side,.47,.27,.029,.67,.033,iron).rotation.z=side*.085;
  const flames=new T.Group();flames.name="炉火";hearth.add(flames);
  const fireShape=new T.LatheGeometry([[.01,0],[.12,.09],[.135,.22],[.093,.37],[.053,.48],[.006,.66]].map(p=>new T.Vector2(...p)),12);
  const hot=new T.MeshBasicMaterial({color:"#ffd277"}),amber=new T.MeshBasicMaterial({color:"#eb772e"});
  for(let i=0;i<7;i++){
    const m=mesh(flames,fireShape,i%2?hot:amber,(i-3)*.098,.345,.13+.060*(i%2));
    m.castShadow=false;m.rotation.z=.20*Math.sin(i*2.7);m.userData.height=.57+.38*Math.sin(i*.66);
  }
  const firelight=new T.PointLight("#ff9e47",0,5,2);hearth.add(firelight);firelight.position.set(0,.78,.51);
  flames.visible=false;
  return {update(furnished,lit){table.visible=hearth.visible=furnished;flames.visible=lit;firelight.intensity=furnished&&lit?6:0;},
    pose(t){
      if(!table.visible)return;
      for(const p of loose){
        const wind=.5+.5*Math.sin(t*1.43+p.phase);
        verts.setXYZ(p.i,p.x+Math.sign(p.x)*.080*p.w*wind,p.y+.106*p.w*wind,p.z+.052*p.w*Math.sin(t+p.phase));
      }
      verts.needsUpdate=true;
      if(flames.visible)for(const [i,flame] of flames.children.entries())flame.scale.y=flame.userData.height+.08*Math.sin(t*6.7+i*1.4);
    },
    dispose(){clearFood();linen.dispose();for(const g of geos)g.dispose();for(const m of mats)m.dispose();}};
}
