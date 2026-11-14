import * as T from "three";
import fixtures from "../../assets/home-fixtures.json";

// Coordinates shared by the tree furniture, avatar and camera.
export const groundY=-.72;
export const seat={x:16.05,z:7.30,top:.62,yaw:-2.27};
export const gate={x:11.79,z:11.25,width:1.85};
export const wallCenter={x:-5.72,y:2.50,z:3.56};

function randomSource(){
  let n=39817;
  return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
}

function cutLeaf(points,ridge){
  const shape=new T.Shape(points.map(([x,y])=>new T.Vector2(x,y)));
  const geo=new T.ShapeGeometry(shape),pos=geo.attributes.position;
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),y=pos.getY(i);
    pos.setZ(i,ridge*(1-Math.min(1,Math.abs(x)))*Math.sin((y+.5)*1.8));
    geo.attributes.uv.setXY(i,(x+1)/2,(y+.95)/2.15);
  }
  geo.computeVertexNormals();return geo;
}
const mapleOutline=[[0,-.94],[-.05,-.43],[-.49,-.55],[-.44,-.38],[-.91,-.32],
  [-.72,-.13],[-1,.22],[-.68,.19],[-.73,.43],[-.34,.19],[-.50,.81],[-.29,.66],
  [-.20,.90],[-.10,.66],[0,1.2],[.13,.68],[.23,.91],[.28,.64],[.51,.83],
  [.34,.20],[.75,.44],[.69,.18],[1,.23],[.74,-.10],[.91,-.31],[.43,-.39],
  [.49,-.56],[.05,-.43],[.02,-.95]];

function leafMaterial(maple){
  const canvas=document.createElement("canvas");canvas.width=canvas.height=128;
  const c=canvas.getContext("2d"),wash=c.createLinearGradient(0,128,100,0);
  wash.addColorStop(0,"#c2bba4");wash.addColorStop(.54,"#fff8eb");wash.addColorStop(1,"#e8d9c2");
  c.fillStyle=wash;c.fillRect(0,0,128,128);
  function vein(ax,ay,bx,by,width){
    c.beginPath();c.moveTo((ax+1)*64,(1.2-ay)*128/2.15);c.lineTo((bx+1)*64,(1.2-by)*128/2.15);
    c.strokeStyle="rgba(111,91,65,.55)";c.lineWidth=width;c.stroke();
  }
  vein(.0,-.92,0,maple?1.14:.48,2.4);
  for(const s of [-1,1])for(const [x,y] of (maple?[[.45,.75],[.90,.20],[.78,-.29]]:[[.54,.40],[.76,.08],[.44,-.33]])){
    vein(0,-.30,s*x,y,1.5);vein(s*x*.55,-.30+(y+.30)*.55,s*(x*.77+.045),y+.11,.85);
  }
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
  return new T.MeshStandardMaterial({map:texture,roughness:.88,side:T.DoubleSide});
}

function trumpet(tint){
  const pos=[],color=[],idx=[],sides=24;
  const flower=new T.Color(tint),throat=new T.Color("#ffe6a8"),pale=new T.Color("#ead3f2");
  const rings=[[.002,-.081],[.028,-.052],[.049,-.013],[.092,.026],[.135,.047],[.15,.042]];
  for(let j=0;j<rings.length;j++)for(let i=0;i<=sides;i++){
    const a=i/sides*Math.PI*2,star=(1+Math.cos(5*a))*.5,w=j/(rings.length-1);
    const r=rings[j][0]*(1+.12*w*w*star);
    pos.push(Math.cos(a)*r,Math.sin(a)*r,rings[j][1]-.020*w*w*star);
    const c=throat.clone().lerp(flower,Math.min(1,w*1.66)).lerp(pale,.48*star**7*w);
    color.push(c.r,c.g,c.b);
    if(i<sides&&j<rings.length-1){const n=j*(sides+1)+i;idx.push(n,n+sides+1,n+1,n+1,n+sides+1,n+sides+2);}
  }
  const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(pos,3));
  g.setAttribute("color",new T.Float32BufferAttribute(color,3));g.setIndex(idx);g.computeVertexNormals();return g;
}

export function landscape(root){
  const rand=randomSource(),groups=new Map(),geometries=new Set(),materials=new Set();
  const box=new T.BoxGeometry(),rod=new T.CylinderGeometry(1,1,1,6);
  const maple=cutLeaf(mapleOutline,.14);
  const heart=cutLeaf([[0,-1],[-.62,-.34],[-.86,.17],[-.70,.57],[-.37,.66],[0,.34],
    [.35,.66],[.71,.57],[.85,.16],[.59,-.39]],.19);
  const green=["#567343","#739451","#859d59","#4b7045"];
  const flowers=["#7665bd","#986bb9","#b97595"].map(trumpet);
  const dummy=new T.Object3D(),up=new T.Vector3(0,1,0);
  const painted=new T.MeshStandardMaterial({color:"#fff",roughness:.88,side:T.DoubleSide});
  const petal=new T.MeshStandardMaterial({color:"#fff",roughness:.85,side:T.DoubleSide,vertexColors:true});
  const mapleMat=leafMaterial(true),vineMat=leafMaterial(false);
  for(const mat of [painted,petal,mapleMat,vineMat])materials.add(mat);
  const glass=new T.MeshStandardMaterial({color:"#f3dfb7",emissive:"#ffbf68",emissiveIntensity:0,roughness:.40});
  const globe=new T.CylinderGeometry(.15,.12,.32,8),roof=new T.ConeGeometry(.245,.15,4);
  materials.add(glass);
  const additionNames=new Set(),lightPools=[];
  function lantern(point,d){
    const top=fixtures.fenceHeight-.82,body=top-.43;
    beam("篱灯铁托",point(d,top),point(d,top,.40),.055,.055,"#4c4e43");
    beam("篱灯斜托",point(d,top-.24),point(d,top,.33),.034,.034,"#606052");
    beam("篱灯挂链",point(d,top,.37),point(d,body+.19,.37),.028,.028,"#504c44",true);
    stamp("篱灯灯罩",globe,glass,point(d,body,.37),[1,1,1],null,"#fff2cc");
    stamp("篱灯灯顶",roof,painted,point(d,body+.225,.37),[1,1,1],[0,Math.PI/4,0],"#43635e");
    stamp("篱灯托盘",box,painted,point(d,body-.17,.37),[.32,.065,.32],null,"#665945");
    for(const side of [-1,1])for(const near of [-1,1]){
      const a=d+.102*side,off=.37+.102*near;
      beam("篱灯铜棱",point(a,body-.15,off),point(a,body+.16,off),.02,.02,"#836e50");
    }
    lightPools.push(point(d,.048,.59));
  }
  function stamp(name,geo,mat,at,size,rot,tint){
    if(!groups.has(name))groups.set(name,{geo,mat,items:[]});
    dummy.position.set(...at);dummy.scale.set(...size);
    if(rot?.isQuaternion)dummy.quaternion.copy(rot);else dummy.rotation.set(...(rot||[0,0,0]));
    dummy.updateMatrix();groups.get(name).items.push([dummy.matrix.clone(),new T.Color(tint)]);
    geometries.add(geo);
  }
  function beam(name,a,b,width,depth,tint,round=false){
    const delta=new T.Vector3(...b).sub(new T.Vector3(...a)),len=delta.length();
    const q=new T.Quaternion().setFromUnitVectors(up,delta.normalize());
    stamp(name,round?rod:box,painted,a.map((x,i)=>(x+b[i])/2),[width,len,depth],q,tint);
  }
  function fenceLine(x0,z0,x1,z1){
    const len=Math.hypot(x1-x0,z1-z0),dx=(x1-x0)/len,dz=(z1-z0)/len,count=Math.ceil(len/1.42);
    const point=(d,h,off=0)=>[x0+dx*d-dz*off,h,z0+dz*d+dx*off];
    for(let i=0;i<=count;i++){
      const d=i*len/count;
      stamp("篱柱",box,painted,point(d,.72),[.14,1.44,.14],null,"#926442");
      stamp("柱帽",box,painted,point(d,1.46),[.19,.09,.19],[0,.03,0],"#ba865b");
      if(i===count)break;
      let coil=point(d,.09);
      for(let k=1;k<=10;k++){
        const h=.10+.126*k,angle=k*1.09+i,next=point(d+.083*Math.sin(angle),h,.087*Math.cos(angle));
        beam("缠枝",coil,next,.016,.016,"#728347",true);coil=next;
        if(k%2)stamp("心形藤叶",heart,vineMat,point(d+.13*Math.sin(angle),h,.13*Math.cos(angle)),
          [.141,.152,.14],[.13,angle,.44*Math.cos(angle)],green[i%4]);
      }
      const gap=len/count;
      for(const h of [.31,.78,1.19])beam("篱横木",point(d,h),point(d+gap,h),.085,.072,"#b7895d");
      beam("木格",point(d,.33),point(d+gap,1.17),.045,.045,"#ad8059");
      beam("木格",point(d,1.17),point(d+gap,.33),.045,.045,"#ad8059");
      for(let vine=0;vine<2;vine++){
        const seed=rand()*6.28;let prev;
        for(let j=0;j<=9;j++){
          const t=j/9,u=d+gap*t,h=.30+vine*.59+.32*t+.19*Math.sin(t*5+seed);
          const p=point(u,h,.072*Math.cos(t*7+seed));
          if(prev)beam("缠枝",prev,p,.022,.022,"#637744",true);prev=p;
          const lean=(j%2?1:-1),off=.095*lean;
          const leaf=point(u,h-.06,off),sz=.12+rand()*.09;
          stamp("心形藤叶",heart,vineMat,leaf,[sz,sz*1.17,sz],
            [rand()*.60,(Math.atan2(-dz,dx)+(j%2?0:Math.PI))+.5*(rand()-.5),lean*.6],green[Math.floor(rand()*green.length)]);
          if((j+vine)%3===1&&t>.05&&t<.96){
            const k=Math.floor(rand()*flowers.length),f=point(u,h+.075,off*2.75),scale=.76+rand()*.41;
            beam("缠枝",p,f,.013,.013,"#718048",true);
            stamp("喇叭花"+k,flowers[k],petal,f,[scale,scale,scale],[-.38+rand()*.3,
              Math.atan2(-dz,dx)+(j%2?0:Math.PI)+.7*(rand()-.5),rand()*3],"#ffffff");
          }
        }
      }
    }
    const height=fixtures.fenceHeight,panels=Math.max(1,Math.round(len/fixtures.lanternSpacing));
    for(let i=0;i<=panels;i++){
      const d=len*i/panels;
      if(i<panels)lantern(point,(i+.5)*len/panels);
      stamp("高篱立柱",box,painted,point(d,height/2),[.19,height,.19],null,"#91694e");
      stamp("高篱柱帽",box,painted,point(d,height),[.26,.11,.26],null,"#bd9267");
      if(i===panels)break;
      const end=len*(i+1)/panels,span=end-d;
      for(const h of [1.53,3.18,height-.10])
        beam("高篱横梁",point(d,h),point(end,h),.11,.13,"#ac835e");
      for(let j=0;j<3;j++){
        const a=d+span*j/3,b=d+span*(j+1)/3;
        beam("高篱细格",point(a,1.57),point(b,3.18),.048,.050,"#b9956d");
        beam("高篱细格",point(b,1.57),point(a,3.18),.048,.050,"#b9956d");
        beam("高篱细格",point(a,3.18),point(b,height-.13),.05,.05,"#bd9b75");
        beam("高篱细格",point(b,3.18),point(a,height-.13),.05,.05,"#bd9b75");
      }
      let prev=point(d,.9,.09);
      for(let j=1;j<=17;j++){
        const t=j/17,u=d+span*t,h=1.04+3.62*t+.32*Math.sin(t*7+i),p=point(u,h,.12);
        beam("攀高的牵牛藤",prev,p,.023,.023,"#768053",true);prev=p;
        stamp("高篱藤叶",heart,vineMat,p,[.15,.18,.15],[.24,Math.atan2(dx,dz)+j%2*2,.62*Math.sin(j*2)],green[j%4]);
        if(j%4===2)stamp("高篱花"+j%3,flowers[j%3],petal,point(u,h+.05,.23),[.86,.86,.86],
          [-.46,Math.atan2(-dz,dx),j],"#ffffff");
      }
    }
  }
  const west=-10.55,east=18.8,north=-7.30,south=gate.z,left=gate.x-gate.width/2,right=gate.x+gate.width/2;
  fenceLine(west,north,east,north);fenceLine(east,north,east,south);
  fenceLine(east,south,right,south);fenceLine(left,south,west,south);fenceLine(west,south,west,north);
  // One hinged leaf, swung inward a little at the exact intersection of the stone path.
  const yaw=.49,door=(d,h,z=0)=>[left+d*Math.cos(yaw)+z*Math.sin(yaw),h,south-d*Math.sin(yaw)+z*Math.cos(yaw)];
  for(let i=0;i<7;i++){
    const x=.12+i*.251,h=1.02+.20*Math.sin(Math.PI*(i+.5)/7);
    stamp("小木门门板",box,painted,door(x,h/2+.06),[.230,h,.085],[0,yaw,0],i%2?"#b98558":"#c18f60");
  }
  for(const h of [.32,.88])beam("院门背档",door(.025,h,.075),door(1.71,h,.075),.09,.08,"#785640");
  beam("单扇门斜撑",door(.04,.27,.11),door(1.73,.98,.11),.105,.068,"#936444");
  stamp("门闩",box,painted,door(1.57,.77,.16),[.23,.045,.047],[0,yaw,0],"#564a43");

  const tx=15,tz=6;
  const branch=(a,b,r,tip)=>{
    const g=new T.CylinderGeometry(tip,r,1,8);
    const delta=new T.Vector3(...b).sub(new T.Vector3(...a)),len=delta.length();
    stamp("枫枝"+g.id,g,painted,[tx+(a[0]+b[0])*.5,(a[1]+b[1])*.5,tz+(a[2]+b[2])*.5],
      [1,len,1],new T.Quaternion().setFromUnitVectors(up,delta.normalize()),"#815740");
  };
  branch([0,0,0],[.12,2.7,-.03],.38,.28);branch([.12,2.62,-.03],[-.29,4.10,.15],.29,.19);
  branch([-.11,3.24,.08],[-1.65,3.30,0],.19,.105);
  const centers=[[0,5.67,0],[-1.63,4.90,-.73],[1.43,5.16,-1.26],[-1.78,4.75,1.28],[.79,5.56,.67],[.22,5.05,-1.92]];
  const palettes={autumn:["#ae4238","#c35b32","#d67536","#e99c47","#f3b85c"],
    spring:["#779250","#9aa75e","#a7bc6a","#bec67c","#c4c684"],
    summer:["#466548","#557d50","#62804e","#759554","#86a660"],
    winter:["#997c65","#a28b75","#9e8c73","#ad9479","#baa890"]};
  for(const [i,c] of centers.entries()){
    const join=[c[0]*.68,3.8+(i%2)*.25,c[2]*.69];
    branch([.0,2.6,.0],join,.16,.10);branch(join,[c[0],c[1]-.12,c[2]],.108,.048);
    for(let j=0;j<(i===4?8:15);j++){
      const a=rand()*Math.PI*2,r=Math.sqrt(rand())*1.25,px=tx+c[0]+r*Math.cos(a),pz=tz+c[2]+r*Math.sin(a);
      const py=c[1]+.63*(1-r/1.25)+.33*(rand()-.5),scale=.66+rand()*.47;
      // Leave a slit through the southern boughs, where the bench receives its midday light.
      if(px>tx-.35&&px<tx+1.70&&pz>tz+.23&&pz<tz+2.7&&j%3!==0)continue;
      beam("枫树分枝",[tx+c[0],c[1]-.25,tz+c[2]],[px,py-.12,pz],.056,.052,"#83533b",true);
      const hue=Math.min(4,Math.max(0,Math.floor((py-4.56)*1.7+rand()*1.80)));
      for(let twig=0;twig<6;twig++){
        const dir=twig*Math.PI/3+rand()*.7,reach=scale*(.65+rand()*.52);
        const dx=Math.cos(dir)*reach,dz=Math.sin(dir)*reach,dy=rand()*.47-.15;
        beam("枫树细枝",[px,py-.13,pz],[px+dx,py+dy,pz+dz],.017,.015,"#8c5b42",true);
        for(let k=0;k<9;k++){
          const u=(k+1)/10,side=(k%2?1:-1)*(.10+.11*Math.sin(u*Math.PI));
          const leaf=.14+rand()*.11;
          const index=Math.max(0,Math.min(4,hue+Math.floor(rand()*3)-1));
          stamp("枝上枫叶",maple,mapleMat,[px+dx*u-side*Math.sin(dir),py-.1+dy*u+Math.sin(u*3)*.095+rand()*.06,
            pz+dz*u+side*Math.cos(dir)],[leaf,leaf*1.04,leaf],
            [-1.04+rand()*.71,dir+.17*(rand()-.5),dir+side*3+rand()*.7],palettes.autumn[index]);
        }
      }
    }
  }
  function rimDistance(x,z){return Math.max(Math.abs(x-12)-2.02,Math.abs(z-3)-1.43);}
  for(let i=0;i<445;i++){
    let x=west+.2+rand()*(east-west-.4),z=north+.2+rand()*(south-north-.4);
    if(i<154){const a=rand()*6.28,r=Math.sqrt(rand())*5.4;x=tx+Math.cos(a)*r;z=tz+Math.sin(a)*r;}
    if(x<west+.1||x>east-.1||z<north+.1||z>south-.1||(x>-6.46&&x<6.5&&z>-5.0&&z<6.25)||
       rimDistance(x,z)<.19||(rimDistance(x,z)<.98&&rand()<.89))continue;
    const sz=.074+rand()*.095;
    stamp("地上枫叶",maple,mapleMat,[x,.055+rand()*.016,z],[sz,sz,sz],[-Math.PI/2,0,rand()*6.28],palettes.autumn[i%5]);
  }
  const meshGroups=new Map();
  for(const [name,{geo,mat,items}] of groups){
    const mesh=new T.InstancedMesh(geo,mat,items.length);mesh.name=name;
    items.forEach(([matrix,color],i)=>{mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,color);});
    mesh.computeBoundingSphere();mesh.castShadow=!["地上枫叶","缠枝"].includes(name);mesh.receiveShadow=true;
    root.add(mesh);meshGroups.set(name,mesh);
    if(/^(?:高篱|篱灯|攀高)/.test(name))additionNames.add(name);
  }
  // Share one feathered pool per lantern without adding two dozen point lights to each shader.
  const lightCanvas=document.createElement("canvas");lightCanvas.width=lightCanvas.height=64;
  const lc=lightCanvas.getContext("2d"),halo=lc.createRadialGradient(32,32,1,32,32,32);
  halo.addColorStop(0,"rgba(255,202,125,.63)");halo.addColorStop(.38,"rgba(255,164,75,.36)");
  halo.addColorStop(1,"rgba(255,145,59,0)");lc.fillStyle=halo;lc.fillRect(0,0,64,64);
  const haloMap=new T.CanvasTexture(lightCanvas);haloMap.colorSpace=T.SRGBColorSpace;
  const haloMaterial=new T.MeshBasicMaterial({map:haloMap,transparent:true,depthWrite:false,toneMapped:false,blending:T.AdditiveBlending});
  const haloGeo=new T.PlaneGeometry(1,1),pools=new T.InstancedMesh(haloGeo,haloMaterial,lightPools.length);
  pools.name="篱灯洒在草上的光";lightPools.forEach((p,i)=>{
    dummy.position.set(...p);dummy.rotation.set(-Math.PI/2,0,0);dummy.scale.set(3.9,3.9,1);dummy.updateMatrix();pools.setMatrixAt(i,dummy.matrix);
  });root.add(pools);materials.add(haloMaterial);geometries.add(haloGeo);
  const flights=Array.from({length:32},(_,i)=>{
    const x=tx+(rand()-.5)*3.9,z=tz+(rand()-.5)*3.6,h=4.4+rand()*1.6;
    const water=i===0,drift=1.3+rand()*3.1;
    let ex=water?13.50:x-drift,ez=water?3.76:z+.34+rand()*2;
    if(!water&&rimDistance(ex,ez)<.65)ez=4.98+rand()*.8;
    return {x,z,h,ex,ez,water,phase:rand(),seconds:11+rand()*7,spin:rand()*6.28,size:.075+rand()*.072};
  });
  const falling=new T.InstancedMesh(maple,mapleMat,flights.length);
  falling.name="随风飘落的枫叶";falling.frustumCulled=false;falling.instanceMatrix.setUsage(T.DynamicDrawUsage);
  flights.forEach((_,i)=>falling.setColorAt(i,new T.Color(palettes.autumn[i%5])));root.add(falling);
  let season;
  const leafTones=groups.get("枝上枫叶").items.map(([,c])=>palettes.autumn.indexOf("#"+c.getHexString()));
  function update(next,furnished=true,lit=false){
    for(const name of additionNames)meshGroups.get(name).visible=furnished;
    pools.visible=furnished&&lit;glass.emissiveIntensity=lit?2.4:0;
    if(season===next)return;season=next;
    const palette=palettes[season]||palettes.autumn;
    const mesh=meshGroups.get("枝上枫叶");
    for(let i=0;i<mesh.count;i++)mesh.setColorAt(i,new T.Color(palette[leafTones[i]]));
    mesh.instanceColor.needsUpdate=true;mesh.visible=season!=="winter";
    falling.visible=meshGroups.get("地上枫叶").visible=season==="autumn";
  }
  function pose(t){
    if(!falling.visible)return;
    flights.forEach((leaf,i)=>{
      const cycle=(leaf.phase+t/leaf.seconds)%1,u=Math.min(1,cycle/.68),settled=Math.max(0,(cycle-.68)/.32);
      const wind=t*.82+leaf.spin,wobble=Math.sin(Math.PI*u),surface=leaf.water?.416:.072;
      let x=T.MathUtils.lerp(leaf.x,leaf.ex,u)+wobble*.39*Math.sin(wind+u*9);
      let z=T.MathUtils.lerp(leaf.z,leaf.ez,u)+wobble*.22*Math.cos(wind*.86+u*6);
      if(leaf.water){x+=settled*.12;z+=settled*.19;}
      const y=surface+(1-u)*leaf.h+.12*wobble*Math.sin(wind*1.9);
      dummy.position.set(x,y,z);
      dummy.rotation.set(-Math.PI/2+wobble*1.3*Math.sin(wind),wobble*Math.cos(wind*1.3),leaf.spin+u*3+.12*settled);
      const fade=Math.min(1,cycle/.045,(1-cycle)/.11);
      dummy.scale.setScalar(leaf.size*Math.max(.001,fade));dummy.updateMatrix();falling.setMatrixAt(i,dummy.matrix);
    });
    falling.instanceMatrix.needsUpdate=true;
  }
  update("autumn");pose(0);
  return {update,pose,dispose(){falling.dispose();pools.dispose();for(const mesh of meshGroups.values())mesh.dispose();
    for(const geo of geometries)geo.dispose();for(const mat of materials){mat.map?.dispose();mat.dispose();}}};
}
