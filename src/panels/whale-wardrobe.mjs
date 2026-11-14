import * as T from "three";
import prints from "../../assets/whale-outfits.json";
import {createLaceDynamics} from "./whale-lace.mjs";
import {buildUpperOutfit,styleOutfitSleeves,disposeUpperSleeves} from "./whale-upper-lace.mjs";
import {fitLowerLace} from "./whale-lower-lace.mjs";

export const DEFAULT_OUTFIT="蓝鲸女仆";
const looks={
  "蓝鲸女仆":           {type:"maid", cloth:0x242849, trim:0xfff2e2, shoe:0x232946},
  "深蓝报刊装":         {type:"press",cloth:0x28314c, trim:0xf4ede4, shoe:0x242842},
  "海风日记·夏日水手服": {type:"summer",cloth:0xf7f3ec,trim:0x778bc3,shoe:0x334269},
  "深海星愿·特别礼服":   {type:"star", cloth:0x33325d, trim:0xd5c7da, shoe:0x343152},
  "蓝白水手常服":       {type:"sailor",cloth:0xf8f1e5,trim:0x688bca,shoe:0x303758},
  "海雾冬装":           {type:"winter",cloth:0x65759e,trim:0xfff2e3,shoe:0x414868},
  "睡衣":               {type:"sleep",cloth:0xf3edfa,trim:0xc6cfed,shoe:0x809ac9},
  "鲸鱼伞雨衣":         {type:"rain", cloth:0xbacbea,trim:0xe0e9fa,shoe:0x3a4575},
};
export const outfitNames=Object.keys(looks);

// Every garment is attached to the existing rig. A change replaces apparel only.
export function fitWardrobe({model,body,head,knees,garment,lap,redraw}){
  const lace=createLaceDynamics(model);
  const {addLace,registerLace}=lace;
  const anchors=new Map(), foot=[],sleeves=[],cuffs=[],maidBand=[];
  function anchor(bone){
    if(!anchors.has(bone)){
      const group=new T.Group();group.name="Wearables_"+bone.name;group.userData.layer="outfit";
      bone.add(group);anchors.set(bone,group);
    }
    return anchors.get(bone);
  }
  const owned=[];
  model.traverse(n=>{
    if(n===garment||n===lap||/^(Petticoat|坐姿衬裙|袖管|SleeveBraid|LaceCuff|袜筒|MaryJane|SoleEdge|CreamRubberSole|Instep|ShoeStrap|Buckle|ToeGlint|褶边发带|BonnetSeam|BlueBow|RibbonEnd|RibbonClasp)/.test(n.name))owned.push(n);
  });
  for(const n of owned){
    anchor(n.parent).add(n);
    if(/^MaryJane|^ShoeStrap/.test(n.name))foot.push(n);
    if(/^袖管/.test(n.name))sleeves.push(n);
    if(n.name==="LaceCuff")cuffs.push(n);
    if(/^(褶边发带|BonnetSeam)/.test(n.name))maidBand.push(n);
  }
  const sphere=new T.SphereGeometry(1,40,28);
  const cloth=new T.MeshPhysicalMaterial({roughness:.75,metalness:0,sheen:.45,sheenColor:0xc9cde6,side:T.DoubleSide});
  const sleeve=cloth.clone(),cuff=cloth.clone(),shoe=new T.MeshPhysicalMaterial({roughness:.29,clearcoat:.45});
  garment.material=lap.material=cloth;
  sleeves.forEach(n=>n.material=sleeve);cuffs.forEach(n=>n.material=cuff);foot.forEach(n=>n.material=shoe);
  const accent=new Map(), ornaments=[], accessoryGeo=new Set(), textureCache=new Map();
  const loader=new T.TextureLoader();
  let handheld=null,overlay=null,lowerLace=null,selected="",disposed=false,ready=Promise.resolve();
  const dressRest=garment.geometry.attributes.position.clone();
  function material(color,metal=0){
    const key=color+"/"+metal;
    if(!accent.has(key))accent.set(key,new T.MeshPhysicalMaterial({color,metalness:metal,roughness:metal?.30:.60,clearcoat:metal?.2:.05}));
    return accent.get(key);
  }
  function piece(parent,name,g,mat,x,y,z,sx=1,sy=1,sz=1){
    const n=new T.Mesh(g,mat);n.name=name;n.position.set(x,y,z);n.scale.set(sx,sy,sz);
    n.layers.enable(2);n.castShadow=n.receiveShadow=true;parent.add(n);if(g!==sphere)accessoryGeo.add(g);return n;
  }
  function oval(p,name,color,x,y,z,rx,ry,rz,metal=0){
    return piece(p,name,sphere,material(color,metal),x,y,z,rx,ry,rz);
  }
  function line(p,name,pts,r,color,metal=0){
    const curve=new T.CatmullRomCurve3(pts.map(v=>new T.Vector3(...v)));
    return piece(p,name,new T.TubeGeometry(curve,40,r,10,false),material(color,metal),0,0,0);
  }
  function star(p,x,y,z,size){
    const shape=new T.Shape();
    for(let i=0;i<10;i++){
      const a=Math.PI/2+i*Math.PI/5,r=size*(i%2?.43:1);
      i?shape.lineTo(r*Math.cos(a),r*Math.sin(a)):shape.moveTo(0,r);
    }
    shape.closePath();
    piece(p,"金星坠",new T.ExtrudeGeometry(shape,{depth:.004,bevelSize:.0015,bevelThickness:.002,bevelSegments:2}),material(0xdbb873,.70),x,y,z);
  }
  function flowers(p,x,y,z,scale){
    for(let i=0;i<5;i++){const a=i*2*Math.PI/5;
      oval(p,"绢花瓣",0xfff3df,x+Math.sin(a)*scale*.50,y+Math.cos(a)*scale*.50,z,scale*.35,scale*.43,scale*.24).rotation.z=-a;
    }
    oval(p,"花心",0xd5ae66,x,y,z+.008,scale*.24,scale*.24,scale*.18,.6);
  }
  function group(bone){
    const g=new T.Group();g.name="换装配件";anchor(bone).add(g);ornaments.push(g);return g;
  }
  // Tailored second layers share the exact posed vertex and morph buffers.
  // Cut by panel and hem; radial ease keeps both cloth surfaces apart.
  function tailoredPanel(type){
    const base=garment.geometry,pos=base.attributes.position,uv=base.attributes.uv,idx=[];
    const metallic=type==="star",rain=type==="rain",apron=type==="maid";
    if(!metallic&&!rain&&!apron&&type!=="sleep")return;
    const source=base.index.array;
    for(let i=0;i<source.length;i+=3){
      const k=source[i],u=uv.getX(k),v=1-uv.getY(k),side=Math.abs(u-.5)*2;
      const edge=apron ? v>.36&&side<.243&&v<.79-.16*(side/.243)**2 :
        metallic ? v>.36&&side>.14+.18*(1-v)&&v<.97-.055*Math.cos(u*12*Math.PI) :
        rain ? v>.10&&side>.008&&v<.83 : v>.70&&v<.88+.015*Math.cos(u*24*Math.PI);
      if(edge)idx.push(source[i],source[i+1],source[i+2]);
    }
    const g=new T.BufferGeometry();
    for(const [key,attr] of Object.entries(base.attributes))g.setAttribute(key,attr);
    g.morphAttributes=base.morphAttributes;g.morphTargetsRelative=true;g.setIndex(idx);
    const mat=new T.MeshPhysicalMaterial({color:rain?0xc4d9ff:metallic?0x6970a0:0xffffff,
      roughness:rain?.16:metallic?.46:.74,clearcoat:rain?.9:apron?0:.12,sheen:rain?0:.55,
      sheenColor:0xa3b6dd,metalness:metallic?.17:0,
      transparent:rain||metallic,opacity:rain?.27:metallic?.39:1,depthWrite:!rain&&!metallic,side:T.FrontSide});
    accent.set("panel",mat);
    overlay=new T.Mesh(g,mat);overlay.name=apron?"鲸纹外围裙":rain?"透明雨衣外层":metallic?"开襟星纱礼裙":"荷叶裙边";
    overlay.scale.set(metallic||rain?1.018:1.043,1,1.053);overlay.position.z=.001;overlay.castShadow=!rain;
    overlay.receiveShadow=true;anchor(body).add(overlay);accessoryGeo.add(g);
    overlay.morphTargetInfluences=garment.morphTargetInfluences;
    overlay.userData.followsSkirt=true;
  }
  // Upper fittings share the bodice UVs, including its shaped neck opening.
  // These rows do not move in either hem morph.
  const dressUV=garment.geometry.attributes.uv;
  let columns=1;
  while(columns<dressUV.count && dressUV.getY(columns)===dressUV.getY(0))columns++;
  const lastRow=dressRest.count/columns-1;
  function onDress(u,v){
    const x=u*(columns-1),y=v*lastRow,i=Math.min(Math.floor(x),columns-2),j=Math.min(Math.floor(y),lastRow-1);
    const corner=(row,col)=>new T.Vector3().fromBufferAttribute(dressRest,row*columns+col);
    return corner(j,i).lerp(corner(j,i+1),x-i)
      .lerp(corner(j+1,i).lerp(corner(j+1,i+1),x-i),y-j);
  }
  function maidStandingCollar(chest){
    // Two cut fabric pieces wrap the throat. Their pointed fronts fold
    // towards the knot, then taper to the shoulder seams and meet at the nape.
    for(const side of [-1,1]){
      const points=[],indices=[],panels=64,rows=6;
      for(let r=0;r<=rows;r++)for(let j=0;j<=panels;j++){
        const along=j/panels,t=r/rows;
        const part=.5*along;
        const u=.5+side*part,a=(u-.5)*Math.PI*2;
        const lapel=Math.exp(-(((part-.029)/.041)**2));
        const facing=Math.max(0,Math.cos(a));
        const shoulder=Math.sin(a)**2;
        const rim=onDress(u,0),hem=onDress(u,.004+.002*lapel);
        // Tangential ease keeps the underside clear of the printed chest panel.
        const ease=.0035+.0025*Math.sin(t*Math.PI);
        const x=T.MathUtils.lerp(hem.x,rim.x*.78,1-t)+Math.sin(a)*ease;
        const z=T.MathUtils.lerp(hem.z,rim.z*.86+.007,1-t)+Math.cos(a)*ease;
        const rise=.011+.006*facing-.022*shoulder-.003*lapel;
        const y=T.MathUtils.lerp(rim.y+rise,hem.y,t);
        points.push(x,y,z);
        if(r<rows&&j<panels){
          const i=r*(panels+1)+j;
          if(side>0)indices.push(i,i+panels+1,i+1,i+1,i+panels+1,i+panels+2);
          else indices.push(i,i+1,i+panels+1,i+1,i+panels+2,i+panels+1);
        }
      }
      const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(points,3));
      g.setIndex(indices);g.computeVertexNormals();
      const fabric=material(0x292e4b);fabric.side=T.DoubleSide;
      piece(chest,"女仆翻领"+(side<0?"左":"右"),g,fabric,0,0,0);
    }
  }
  function maidRibbon(chest){
    // The satin is folded back to form a soft loop on each side of the clasp.
    // Cross sections are closed ellipses. The pin catches the narrow roots.
    const knot=onDress(.5,.023);
    for(const side of [-1,1]){
      const points=[],indices=[],rows=32,sections=24;
      for(let row=0;row<=rows;row++){
        const t=row/rows,open=Math.sin(t*Math.PI*.91);
        const height=(.0035+.017*T.MathUtils.smoothstep(t,.04,.68))*
          (1-.92*T.MathUtils.smoothstep(t,.90,1));
        const depth=.0025+.0085*open;
        for(let j=0;j<=sections;j++){
          const a=(j/sections)*Math.PI*2;
          const y=knot.y+.004+t*.011+height*Math.cos(a);
          const z=knot.z+.013+depth*Math.sin(a)-.006*t*t+
            .0017*open*Math.cos(3*a);
          points.push(side*(.004+.054*t),y,z);
          if(row<rows&&j<sections){
            const i=row*(sections+1)+j;
            if(side>0)indices.push(i,i+1,i+sections+1,i+1,i+sections+2,i+sections+1);
            else indices.push(i,i+sections+1,i+1,i+1,i+sections+1,i+sections+2);
          }
        }
      }
      for(const row of [0,rows])for(let i=1;i<sections-1;i++){
        const base=row*(sections+1);
        if((row===0)===(side>0))indices.push(base,base+i+1,base+i);
        else indices.push(base,base+i,base+i+1);
      }
      const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(points,3));
      g.setIndex(indices);g.computeVertexNormals();
      const satin=material(0x282c50);satin.roughness=.59;
      piece(chest,"女仆缎带结翼"+(side<0?"左":"右"),g,satin,0,0,0);
    }
  }
  function apronStrap(parent,side){
    const points=[];
    const front=[[.353,.076],[.27,.077],[.205,.082],[.15,.09],[.095,.11],[.05,.128],[0,.149]];
    for(const [v,offset] of front)points.push(onDress(.5+side*offset,v));
    points.push(onDress(.5+side*.25,0));
    for(const [v,offset] of [[0,.351],[.06,.362],[.15,.381],[.24,.393],[.351,.396]]){
      points.push(onDress(.5+side*offset,v));
    }
    const curve=new T.CatmullRomCurve3(points,false,"centripetal");
    const pos=[],color=[],indices=[],weights=[],normals=[],tangents=[],rows=144;
    // A broad flat tape, a narrow gathered seam, a fluted edge and its hem.
    const cross=[0,.30,.48,.56,.68,.80,.91,1];
    const count=cross.length*2;
    const ivory=new T.Color(0xfff2dd),seam=new T.Color(0xc7b4a9);
    for(let row=0;row<=rows;row++){
      const t=row/rows,p=curve.getPointAt(t),along=curve.getTangentAt(t);
      const across=new T.Vector3(side,0,0);
      across.addScaledVector(along,-across.dot(along)).normalize();
      const normal=across.clone().cross(along).multiplyScalar(side).normalize();
      const upper=T.MathUtils.smoothstep(p.y,.128,.21),frontWeight=T.MathUtils.smoothstep(p.z,-.085,.05);
      const lace=upper*(.5+.5*frontWeight),wave=Math.cos(t*25*Math.PI);
      // Keep the lace's free edge fluted down the chest and ease its gather
      // over the shoulder seam, where the tape lies on the sleeve cap.
      const gather=1-.65*(1-T.MathUtils.smoothstep(Math.abs(p.z),.035,.11));
      const lobe=.5-.5*wave;
      const shoulder=T.MathUtils.smoothstep(p.y,.245,.315);
      const width=.024+.008*upper+lace*(.007+.024*lobe)*(1-.62*shoulder)*gather;
      for(let col=0;col<count;col++){
        const top=col<cross.length,f=cross[top?col:count-col-1];
        const flare=T.MathUtils.smoothstep(f,.48,1);
        const height=.0035+.0018*Math.sin(f*Math.PI)+flare*lace*(.002+.016*lobe)*(1-.65*shoulder)*gather
          -(top?0:.0026);
        const vertex=p.clone().addScaledVector(across,width*f-.012)
          .addScaledVector(normal,height);
        vertex.y-=.007*(1-gather)*T.MathUtils.smoothstep(p.y,.22,.30);
        pos.push(...vertex.toArray());
        weights.push(flare*lace);
        normals.push(...normal.toArray());tangents.push(...along.toArray());
        const stitch=Math.exp(-((f-.50)**2)/.002)*.34+.12*flare*lace*(1-lobe);
        color.push(...ivory.clone().lerp(seam,stitch+(top?0:.18)).toArray());
        if(row<rows){
          const a=row*count+col,b=row*count+(col+1)%count;
          if(side===1)indices.push(a,b,a+count,b,b+count,a+count);
          else indices.push(a,a+count,b,b,a+count,b+count);
        }
      }
    }
    for(const [row,reverse] of [[0,side<0],[rows,side>0]]){
      const start=row*count;
      for(let j=1;j<count-1;j++){
        if(reverse)indices.push(start,start+j+1,start+j);
        else indices.push(start,start+j,start+j+1);
      }
    }
    const g=new T.BufferGeometry();
    g.setAttribute("position",new T.Float32BufferAttribute(pos,3));
    g.setAttribute("color",new T.Float32BufferAttribute(color,3));g.setIndex(indices);g.computeVertexNormals();
    let mat=accent.get("apronLace");
    if(!mat){
      mat=new T.MeshPhysicalMaterial({vertexColors:true,roughness:.86,sheen:.4});
      accent.set("apronLace",mat);
    }
    const mesh=piece(parent,"围裙褶边肩带"+(side<0?"左":"右"),g,mat,0,0,0);
    registerLace(mesh,weights,{driver:body,maxTravel:.004,anchor:[side*.13,.30,.07],
      normal:normals,tangent:tangents});
  }
  function maidCuffLace(wrist,pearl){
    // Cut eyelets through the front and reverse faces and stitch their edges
    // together. The gathered header sits under the band, the hem rolls out.
    const sectors=96,rows=12,xyz=[],indices=[],layers=[];
    for(let face=0;face<2;face++){
      const offset=xyz.length/3;layers.push(offset);
      for(let i=0;i<=rows;i++){
        const t=i/rows;
        for(let j=0;j<sectors;j++){
          const a=2*Math.PI*j/sectors,crest=.5+.5*Math.cos(12*a);
          const flute=Math.cos(12*a-.7*t);
          const radius=.044+.010*t+.005*t*t+.004*flute*t;
          const r=radius-.0018*face;
          const y=-.018-.030*t-.008*crest*t*t+.0025*flute*t+.0013*face;
          xyz.push(r*Math.cos(a),y,1.14*r*Math.sin(a));
        }
      }
    }
    function hole(row,col){
      const phase=col%8;
      return ((row===7||row===8)&&(phase===3||phase===4))||
        ((row===9||row===6)&&phase===4);
    }
    function connect(a,b){
      indices.push(a,b,a+layers[1],b,b+layers[1],a+layers[1]);
    }
    for(let i=0;i<rows;i++)for(let j=0;j<sectors;j++){
      if(hole(i,j))continue;
      const a=i*sectors+j,b=i*sectors+(j+1)%sectors,c=a+sectors,d=b+sectors;
      indices.push(a,b,c,b,d,c);
      const k=layers[1];indices.push(c+k,b+k,a+k,c+k,d+k,b+k);
      if(i===0||hole(i-1,j))connect(b,a);
      if(i===rows-1||hole(i+1,j))connect(c,d);
      if(hole(i,(j+sectors-1)%sectors))connect(a,c);
      if(hole(i,(j+1)%sectors))connect(d,b);
    }
    const g=new T.BufferGeometry();
    g.setAttribute("position",new T.Float32BufferAttribute(xyz,3));g.setIndex(indices);g.computeVertexNormals();
    const trim=piece(wrist,"女仆扇贝花边袖口",g,material(pearl),0,0,0);
    const weights=Float32Array.from({length:g.attributes.position.count},(_,i)=>
      (Math.floor(i/sectors)%(rows+1))/rows);
    const vertices=g.attributes.position;
    registerLace(trim,weights,{
      normal:i=>[vertices.getX(i),0,vertices.getZ(i)],
      tangent:i=>[-vertices.getZ(i),0,vertices.getX(i)],maxTravel:.008
    });
  }
  function outfitDetails(type){
    tailoredPanel(type);
    buildUpperOutfit(type,{head,body,model,knees,group,piece,material,oval,addLace,registerLace,onDress});
    const h=group(head),chest=group(body);
    lowerLace=fitLowerLace({type,garment,restPosition:dressRest,parent:chest,knees,group,lace});
    if(type==="maid"){
      maidStandingCollar(chest);
      maidRibbon(chest);
      for(const side of [-1,1])apronStrap(chest,side);
    }
    const hand=model.getObjectByName("ElbowL");
    function held(){
      handheld=group(hand);handheld.position.set(-.02,-.17,.060);return handheld;
    }
    function mantle(name,top,bottom,topRadius,bottomRadius,color,ruffle,scoop=0){
      const pts=[],idx=[];
      for(let i=0;i<=20;i++)for(let j=0;j<=96;j++){
        const t=i/20,a=(j/96-.5)*2*Math.PI;
        const r=T.MathUtils.lerp(topRadius,bottomRadius,t)*(1+ruffle*t*Math.cos(14*a));
        const neckHeight=top-scoop*(.5+.5*Math.cos(a));
        pts.push(r*Math.sin(a),T.MathUtils.lerp(neckHeight,bottom,t)+.010*t*Math.cos(14*a),r*.86*Math.cos(a)+.012);
        if(i<20&&j<96){const k=i*97+j;idx.push(k,k+97,k+1,k+1,k+97,k+98);}
      }
      const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(pts,3));g.setIndex(idx);g.computeVertexNormals();
      piece(chest,name,g,material(color),0,0,0);
    }
    const gold=0xd4ae73, pearl=0xffefdf;
    if(type==="maid"){
      for(const side of [-1,1]){
        const elbow=model.getObjectByName(side<0?"ElbowL":"ElbowR"),wrist=group(elbow);
        wrist.position.set(side*.006,-.108,0);
        // A fitted band catches the gathered sleeve; the lace flares out below.
        const ring=[[.006,.045],[.008,.047],[.025,.050],[.026,.052],[.022,.054],
          [-.017,.048],[-.021,.047],[-.021,.044],[-.016,.043],[.006,.045]];
        const band=new T.LatheGeometry(ring.map(([y,r])=>new T.Vector2(r,y)),64);
        piece(wrist,"女仆深蓝腕带",band,material(0x242847),0,0,0,1,1,1.15);
        for(const [y,r] of [[.021,.054],[-.017,.048]]){
          const edge=piece(wrist,"腕带金滚边",new T.TorusGeometry(r,.0018,8,64),
            material(gold,.52),0,y,0);
          edge.rotation.x=Math.PI/2;edge.scale.y=1.15;
        }
        maidCuffLace(wrist,pearl);
        oval(wrist,"腕扣",gold,side*.033,.001,.045,.007,.007,.004,.48);
      }
    }
    // Register small jewels to the sewn knots in the individual fabric prints.
    // The sailor tie, nightgown and winter cape have their own cloth closures.
    const knotUV={maid:[.5,.023],press:[.540,.068],summer:[.539,.144],star:[.504,.081],rain:[.506,.128]}[type];
    if(knotUV){
      const p=onDress(...knotUV), angle=(knotUV[0]-.5)*2*Math.PI;
      const pin=new T.Group();chest.add(pin);pin.position.copy(p);pin.rotation.y=angle;
      if(type==="maid")pin.position.z+=.012;
      oval(pin,"领口镶座",gold,0,0,.003,.012,.015,.005,.58);
      oval(pin,"蓝宝石领扣",0x527caa,0,0,.007,.008,.010,.004,.32);
    }
    if(type==="maid"||type==="press"||type==="star"){
      line(h,"发饰垂链",[[.432,.015,.183],[.473,-.057,.185],[.488,-.114,.161]],.0038,gold,.65);
      star(h,.487,-.129,.16,.020);
    }
    if(type==="star"){
      for(let i=-5;i<=5;i++){
        const x=i*.072,y=.40-.23*(x/.4)**2;
        oval(h,"发冠珍珠",pearl,x,y,.076+.16*(x/.4)**2,.021,.021,.021,.25);
        if(i%2===0)star(h,x,y-.023,.095+.16*(x/.4)**2,.022);
      }
    }
    if(type==="summer"){
      const brim=oval(h,"草编帽檐",0xcdb28a,-.05,.38,-.025,.57,.044,.50);
      brim.rotation.z=.17;
      oval(h,"草帽冠",0xe2c99f,-.06,.415,-.030,.359,.140,.342).rotation.z=.17;
      for(let i=0;i<4;i++)flowers(h,.21+i*.041,.421-i*.028,.262,.040);
    }
    if(type==="sleep"){
      const cap=oval(h,"软睡帽",0xc1cce6,0,.364,-.104,.45,.152,.411);cap.rotation.z=-.18;
      line(h,"睡帽尖",[[.18,.443,-.09],[.38,.431,-.12],[.51,.308,-.093],[.54,.208,-.043]],.059,0xb7c4e3);
      oval(h,"睡帽绒球",pearl,.54,.173,-.043,.068,.069,.065);
      for(const knee of knees){const p=group(knee);
        oval(p,"鲸鱼拖鞋头",0x7a98ca,0,-.118,.119,.083,.062,.094);
        for(const s of [-1,1])oval(p,"拖鞋眼睛",0x303b53,s*.042,-.104,.196,.009,.010,.007);
      }
    }
    if(type==="winter"){
      const p=chest;
      for(let i=0;i<20;i++){const a=2*Math.PI*i/20;
        const height=.291-.033*(.5+.5*Math.cos(a));
        oval(p,"披肩绒领",pearl,.155*Math.sin(a),height,.125*Math.cos(a)+.012,.046,.031,.037);}
      for(const knee of knees){const p=group(knee);
        oval(p,"冬靴绒口",pearl,0,-.059,.018,.082,.038,.076);}
    }
    if(type==="rain"){
      // The hood follows the head, the boots follow the knees independently.
      const g=new T.SphereGeometry(1,64,40,0,Math.PI*2,0,Math.PI*.39);
      const hood=new T.MeshPhysicalMaterial({color:0xb7c9ed,transparent:true,opacity:.48,roughness:.18,
        clearcoat:.92,side:T.DoubleSide,depthWrite:false});
      accent.set("hood",hood);
      piece(h,"透明雨兜帽",g,hood,0,-.002,-.06,.55,.54,.53);
      for(const k of knees){const p=group(k);oval(p,"亮面雨靴筒",0x343f6e,0,-.061,.012,.079,.088,.077,.18);}
    }
    if(type==="winter"){
      mantle("海雾双层小披肩",.296,.18,.145,.251,0x65799c,.03,.033);
      mantle("披肩白绒镶边",.209,.178,.235,.256,pearl,.04);
    }
    if(type==="press"){
      const paper=held();paper.rotation.set(.23,.30,-.27);
      piece(paper,"折叠报纸",new T.BoxGeometry(.157,.214,.012),material(0xe6d8c1),0,.030,.005);
      for(let i=0;i<9;i++)piece(paper,"报纸栏",new T.BoxGeometry(i%3?.112:.127,i===0?.013:.003,.002),material(0x6a6071),0,.111-i*.016,.012);
    }
    if(type==="summer"){
      const shoulder=onDress(.355,.018);
      line(chest,"斜挎肩带",[shoulder.toArray(),[-.06,.21,.158],[.065,.08,.16],[.15,-.04,.14]],.008,0xb7a084);
      const bag=oval(chest,"鲸鱼挎包",0x708eb8,.16,-.042,.157,.084,.064,.042);
      oval(chest,"挎包鲸腹",pearl,.159,-.065,.185,.072,.033,.021);
      oval(chest,"挎包眼睛",0x2f354f,.121,-.034,.194,.006,.007,.005);
    }
    if(type==="rain"){
      const umbrella=held();umbrella.rotation.z=-.34;
      line(umbrella,"伞柄",[[0,.085,0],[0,-.135,0],[.015,-.16,0],[.039,-.143,0]],.008,0xaba2a4,.6);
      const fold=new T.ConeGeometry(.074,.34,16);piece(umbrella,"收拢的鲸鱼伞",fold,material(0x435a93),0,-.154,0).rotation.z=Math.PI;
      oval(umbrella,"鲸鱼伞扣",pearl,0,-.073,.054,.025,.014,.010);
    }
    if(type==="sailor"||type==="summer"||type==="maid")flowers(h,.446,.009,.169,.029);
  }
  function clearDetails(){
    lace.clear();
    lowerLace?.dispose();lowerLace=null;
    for(const g of ornaments)g.removeFromParent();
    ornaments.length=0;handheld=null;overlay?.removeFromParent();overlay=null;
    if(accent.has("panel")){accent.get("panel").dispose();accent.delete("panel");}
    for(const g of accessoryGeo)g.dispose();accessoryGeo.clear();
    if(accent.has("hood")){accent.get("hood").dispose();accent.delete("hood");}
  }
  function setOutfit(name){
    if(!Object.hasOwn(looks,name))name=DEFAULT_OUTFIT;
    if(selected===name)return ready;
    selected=name;model.userData.outfit=name;
    const d=looks[name];clearDetails();
    styleOutfitSleeves(d.type,{sleeves,cuffs,model});
    outfitDetails(d.type);
    maidBand.forEach(n=>n.visible=["maid","winter","star"].includes(d.type));
    sleeve.color.setHex(d.cloth);cuff.color.setHex(d.trim);shoe.color.setHex(d.shoe);
    cloth.map=null;cloth.color.setHex(d.cloth);cloth.needsUpdate=true;
    cloth.roughness=d.type==="rain"?.32:d.type==="star"?.48:.78;
    // Woven cotton keeps its broad sheen; a clear coat would draw sharp white
    // reflections across the embroidered insignia as the skirt turns.
    cloth.clearcoat=d.type==="rain"?.75:d.type==="maid"?0:.05;
    if(!textureCache.has(name)){
      const promise=loader.loadAsync(prints[name]).then(map=>{
        map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;if(disposed)map.dispose();return map;
      }).catch(err=>{textureCache.delete(name);if(selected===name)selected="";throw err;});
      textureCache.set(name,promise);
    }
    ready=textureCache.get(name).then(map=>{
      if(disposed||selected!==name)return;
      if(overlay && (d.type==="maid"||d.type==="sleep")){
        overlay.material.map=map;overlay.material.needsUpdate=true;
      }
      cloth.color.setHex(0xffffff);cloth.map=map;cloth.needsUpdate=true;redraw();
    });
    return ready;
  }
  function dispose(){
    disposeUpperSleeves(sleeves);
    disposed=true;clearDetails();sphere.dispose();
    for(const m of [cloth,sleeve,cuff,shoe,...accent.values()])m.dispose();
    for(const pending of textureCache.values())pending.then(t=>t.dispose(),()=>{});
  }
  return {setOutfit,dispose,lace,removeFromModel(){
    for(const layer of anchors.values())layer.removeFromParent();
  },followPose(kind){
    lowerLace?.followPose();
    if(handheld)handheld.visible=["idle","walk","look","listen","watch","think","contact"].includes(kind);
  }};
}
