import { fitMovingLayers } from "./whale-fit.mjs";
import { finAndTailInertia } from "./whale-inertia.mjs";
import { fitWardrobe, DEFAULT_OUTFIT } from "./whale-wardrobe.mjs";
import * as T from "three";
import detail from "../../assets/whale-face-detail.json";
import faceArt from "../../assets/whale-toon-face.json";
import motion from "../../assets/dsh-motion.json";

const family={read:"think",fish:"look",listen:"look",watch:"look",water:"pet",paint:"write",bench:"idle",hug:"pet",stroke:"pet",fetch:"contact",invite:"contact"};
function reference(kind,t){
  const clip=motion[kind]||motion[family[kind]]||motion.idle, frames=clip.samples;
  const phase=(Math.max(0,t)*clip.fps)%frames.length,k=Math.floor(phase),w=phase-k;
  // Periodic cubic interpolation preserves the tangent through every sample.
  return frames[k].map((b,i)=>{
    const a=frames[(k-1+frames.length)%frames.length][i],c=frames[(k+1)%frames.length][i],d=frames[(k+2)%frames.length][i];
    return b+.5*w*((c-a)+w*((2*a-5*b+4*c-d)+w*(3*b-a-3*c+d)));
  });
}

// All coordinates are in the character's local frame, facing +Z.
export function makeWhale(redraw=()=>{}, {fit=true,bodyOnly=false}={}){
  const model=new T.Group(); model.name="Dafeiyu";
  const materials=new Map(), geometry=new Set();
  const skin="#edc9b9", ink="#262842", blue="#354d84", pale="#fff2e2", lace="#eee1d6";
  const ramp=new T.DataTexture(new Uint8Array([108,188,250]),3,1,T.RedFormat);
  ramp.minFilter=ramp.magFilter=T.NearestFilter;ramp.needsUpdate=true;
  const outline=new T.MeshBasicMaterial({color:"#343347",side:T.BackSide});
  const textures=[],joints=[],skeletons=[];
  function joint(parent,name,x,y,z){
    const g=new T.Bone();g.name=name;g.position.set(x,y,z);parent.add(g);joints.push(g);return g;
  }
  function toon(color){
    if(!materials.has(color))materials.set(color,new T.MeshToonMaterial({color,gradientMap:ramp,
      emissive:new T.Color(color),emissiveIntensity:.22}));
    return materials.get(color);
  }
  function mesh(parent,name,shape,color,x,y,z){
    geometry.add(shape);
    const m=new T.Mesh(shape,toon(color));m.name=name;m.position.set(x,y,z);
    m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  function inkEdge(solid,amount){
    const rim=new T.Mesh(solid.geometry,outline);rim.name=solid.name+"Ink";
    rim.scale.setScalar(1+amount);solid.add(rim);return solid;
  }
  const sphere=new T.SphereGeometry(1,36,24);
  function oval(parent,name,color,x,y,z,sx,sy,sz,angle=0){
    const m=mesh(parent,name,sphere,color,x,y,z);m.scale.set(sx,sy,sz);m.rotation.z=angle;return m;
  }
  function bindFabric(shape,upper,lower,hinge,width,color,name){
    const skinIndex=[],skinWeight=[],positions=shape.attributes.position;
    model.updateMatrixWorld(true);
    for(let i=0;i<positions.count;i++){
      const w=T.MathUtils.smoothstep(hinge-positions.getY(i),-width,width);
      skinIndex.push(0,w>0?1:0,0,0);skinWeight.push(1-w,w,0,0);
    }
    bindSkin(shape,upper,[upper,lower],skinIndex,skinWeight,color,name);
  }
  function bindSkin(shape,anchor,bones,skinIndex,skinWeight,color,name){
    shape.applyMatrix4(anchor.matrixWorld);
    shape.setAttribute("skinIndex",new T.Uint16BufferAttribute(skinIndex,4));
    shape.setAttribute("skinWeight",new T.Float32BufferAttribute(skinWeight,4));geometry.add(shape);
    const skinMesh=new T.SkinnedMesh(shape,toon(color));
    skinMesh.name=name;model.add(skinMesh);skinMesh.frustumCulled=false;
    const skeleton=new T.Skeleton(bones);skinMesh.bind(skeleton);skeletons.push(skeleton);skinMesh.castShadow=true;
  }
  // Sew the sleeve around the same curved shoulder line as the body. Cross
  // sections at the armhole are perpendicular to the shoulder, then turn
  // naturally into horizontal rings along the hanging upper arm.
  function shoulderSurface(side,arm,elbow,cloth){
    // y, distance from the pivot, ring tilt, skin width/depth, cloth width/depth
    const profile=[
      [.010,-.138,1.48,.022,.026,.039,.046],[.012,-.111,1.40,.032,.035,.046,.054],
      [.010,-.080,1.25,.037,.041,.049,.060],[.002,-.054,1.04,.035,.040,.047,.060],
      [-.014,-.034,.80,.031,.034,.047,.060],[-.043,-.019,.59,.031,.035,.047,.059],
      [-.077,-.008,.39,.030,.034,.047,.056],[-.111,.002,.25,.029,.033,.045,.052],
      [-.147,.014,.13,.028,.031,.044,.051],[-.181,.016,.03,.030,.034,.048,.054],
      [-.221,.018,0,.029,.031,.046,.053],[-.252,.020,0,.025,.029,.041,.049],
      [-.276,.021,0,.020,.024,.038,.044],[cloth?-.294:-.298,.022,0,.016,.021,.035,.041]
    ];
    const curve=rows=>new T.CatmullRomCurve3(rows,false,"catmullrom",.4);
    const spine=curve(profile.map(([y,x,angle])=>new T.Vector3(x,y,angle)));
    const size=curve(profile.map(p=>new T.Vector3(p[cloth?5:3],p[cloth?6:4],0)));
    const rows=(profile.length-1)*4,sectors=64,points=[],fullSleeve=[],faces=[],indices=[],weights=[];
    function weight(chest,forearm){
      const shoulder=1-chest-forearm;
      weights.push(chest,shoulder,forearm,0);indices.push(0,shoulder>0?1:0,forearm>0?2:0,0);
    }
    for(let row=0;row<=rows;row++){
      const t=row/rows,p=spine.getPoint(t),r=size.getPoint(t);
      const chest=1-T.MathUtils.smoothstep(p.x,-.107,-.017);
      const forearm=T.MathUtils.smoothstep(-p.y,.081,.211);
      // Allow fabric past the fitted shoulder seam. Gather it in just
      // above the wide wristband; both ends retain their original fit.
      const depth=-p.y;
      const ease=cloth?T.MathUtils.smoothstep(depth,.028,.128)*
        (1-T.MathUtils.smoothstep(depth,.203,.240)):0;
      for(let j=0;j<sectors;j++){
        const a=j*2*Math.PI/sectors;
        const fold=cloth?1+.014*Math.cos(10*a+.5*t)*Math.sin(Math.PI*t):1;
        const radial=r.x*Math.cos(a)*fold;
        points.push(side*p.x+radial*Math.cos(p.z),p.y+side*radial*Math.sin(p.z),r.y*Math.sin(a)*fold);
        if(cloth){
          const gather=.0029*Math.cos(8*a+2*t)+.0023*Math.cos(5*a-2*t);
          const fullness=ease*(.026+gather);
          const radius=radial+fullness*Math.cos(a);
          fullSleeve.push(side*p.x+radius*Math.cos(p.z),p.y+side*radius*Math.sin(p.z),
            (r.y*fold+ease*(.031+gather))*Math.sin(a));
        }
        weight(chest,forearm);
        if(row===rows)continue;
        const u=row*sectors+j,v=row*sectors+(j+1)%sectors;
        faces.push(u,v,u+sectors,v,v+sectors,u+sectors);
      }
    }
    const shape=new T.BufferGeometry();
    shape.setAttribute("position",new T.Float32BufferAttribute(points,3));shape.setIndex(faces);
    model.updateMatrixWorld(true);
    if(cloth){
      shape.computeVertexNormals();
      const full=shape.clone();
      full.setAttribute("position",new T.Float32BufferAttribute(fullSleeve,3));
      full.applyMatrix4(arm.matrixWorld);full.computeVertexNormals();
      // bindSkin moves the base into the same bind space. Morph attributes
      // must be supplied in that space for rendering and the portable GLB.
      full.attributes.position.name="MaidGatheredSleeve";
      shape.morphAttributes.position=[full.attributes.position];
      shape.morphAttributes.normal=[full.attributes.normal];
      full.dispose();
    }else{
      capEnds(shape);weight(1,0);weight(0,1);
    }
    bindSkin(shape,arm,[body,arm,elbow],indices,weights,cloth?ink:skin,
      cloth?"袖管"+side:"ArmSkin"+(side<0?"L":"R"));
  }
  // Each cross-section has a height, offset towards the outside, and two radii.
  function armSurface(side,sections,pleats=0,scallop=0){
    const centres=new T.CatmullRomCurve3(sections.map(([y,x])=>new T.Vector3(x,y,0)),false,"catmullrom",.40);
    const radii=new T.CatmullRomCurve3(sections.map(([, ,rx,rz])=>new T.Vector3(rx,rz,0)),false,"catmullrom",.40);
    const position=[],indices=[],rows=(sections.length-1)*4,sectors=64;
    for(let row=0;row<=rows;row++){
      const t=row/rows,center=centres.getPoint(t),r=radii.getPoint(t);
      for(let col=0;col<sectors;col++){
        const a=col/sectors*2*Math.PI,flute=Math.cos(10*a+.5*t);
        const fold=1+pleats*flute*Math.sin(Math.PI*t);
        position.push(side*center.x+Math.cos(a)*r.x*fold,center.y+scallop*flute*t*t,Math.sin(a)*r.y*fold);
        if(row<rows){
          const n=row*sectors+col,b=row*sectors+(col+1)%sectors;
          indices.push(n,b,n+sectors,b,b+sectors,n+sectors);
        }
      }
    }
    const g=new T.BufferGeometry();
    g.setAttribute("position",new T.Float32BufferAttribute(position,3));g.setIndex(indices);g.computeVertexNormals();
    return g;
  }
  // Close the small cut faces on the body meshes. Cuffs stay open at the wrist.
  function capEnds(geometry){
    const position=geometry.attributes.position.array,sectors=64,n=position.length/3;
    const values=Array.from(position),indices=Array.from(geometry.index.array);
    for(const [start,top] of [[0,true],[n-sectors,false]]){
      const center=new T.Vector3();
      for(let i=start;i<start+sectors;i++)center.add(new T.Vector3().fromArray(position,i*3));
      center.divideScalar(sectors);
      const point=values.length/3;values.push(...center.toArray());
      for(let i=0;i<sectors;i++){
        const a=start+i,b=start+(i+1)%sectors;
        if(top)indices.push(point,b,a);else indices.push(point,a,b);
      }
    }
    geometry.setAttribute("position",new T.Float32BufferAttribute(values,3));
    geometry.setIndex(indices);geometry.deleteAttribute("normal");geometry.computeVertexNormals();return geometry;
  }
  function fabric(upper,lower,rings,hinge,width,color,name){
    const segments=40,pts=[],index=[];
    for(let i=0;i<rings.length;i++){
      const [y,radius]=rings[i];
      for(let k=0;k<segments;k++){
        const a=k*Math.PI*2/segments;
        pts.push(radius*Math.cos(a),y,radius*.93*Math.sin(a));
        if(i+1<rings.length){const n=i*segments+k,b=i*segments+(k+1)%segments;
          index.push(n,b,n+segments,b,b+segments,n+segments);}
      }
    }
    const shape=new T.BufferGeometry();
    shape.setAttribute("position",new T.Float32BufferAttribute(pts,3));shape.setIndex(index);shape.computeVertexNormals();
    bindFabric(shape,upper,lower,hinge,width,color,name);
  }
  function ribbon(parent,name,color,points,radius){
    const path=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
    return mesh(parent,name,new T.TubeGeometry(path,32,radius,10,false),color,0,0,0);
  }
  // Tapered, curved locks have a continuous silhouette when viewed from behind.
  function lock(parent,name,color,points,width,depth){
    const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
    const pos=[],indices=[],colors=[],rings=54,sides=26;
    const baseColor=new T.Color(color),tipColor=new T.Color(color).lerp(new T.Color("#739cdf"),.68);
    const axis=new T.Vector3(0,0,1);
    for(let i=0;i<=rings;i++){
      const t=i/rings,p=curve.getPoint(t);
      const r=Math.max(.007,Math.sin((.12+t*.88)*Math.PI)**.71*(1-.40*T.MathUtils.smoothstep(t,.65,1)));
      const tangent=curve.getTangent(t),across=axis.clone().cross(tangent).normalize();
      const depthAxis=tangent.clone().cross(across).normalize();
      for(let j=0;j<sides;j++){
        const a=j/sides*Math.PI*2;
        const lateral=Math.cos(a);
        const pt=p.clone().addScaledVector(across,width*r*lateral)
          .addScaledVector(depthAxis,depth*r*Math.sin(a)*(1-.34*Math.abs(lateral)));
        pos.push(pt.x,pt.y,pt.z);
        const shade=baseColor.clone().lerp(tipColor,.78*T.MathUtils.smoothstep(t,.42,1));
        const crest=.16*Math.exp(-((lateral-.26-.18*Math.sin(t*4))**2)/.045);
        shade.multiplyScalar(1+crest-.27*Math.abs(lateral)**4);colors.push(shade.r,shade.g,shade.b);
        if(i<rings){const n=i*sides+j,b=i*sides+(j+1)%sides;
          indices.push(n,b,n+sides,b,b+sides,n+sides);}
      }
    }
    const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(pos,3));g.setIndex(indices);
    g.setAttribute("color",new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();
    const strand=mesh(parent,name,g,"#ffffff",0,0,0);
    if(!materials.has("strandGradient"))materials.set("strandGradient",new T.MeshToonMaterial({vertexColors:true,gradientMap:ramp}));
    strand.material=materials.get("strandGradient");return strand;
  }
  const body=joint(model,"Body",0,.54,0),head=joint(body,"Head",0,.827,-.032);
  // Head geometry is authored around its centre. Rotate that centre about the
  // top of the neck so a nod keeps the jaw attached to the cervical joint.
  const neckPivot=new T.Vector3(0,.396,.123);
  const headOffset=head.position.clone().sub(neckPivot);
  head.scale.set(.954,1.10,1.02);
  body.scale.set(1.105,.96,1.04);
  // One neutral mannequin surface runs from the shoulder girdle to the hips.
  const torso=armSurface(1,[
    [.391,0,.025,.032],[.367,0,.036,.043],[.342,0,.048,.052],
    [.318,0,.065,.061],[.292,0,.117,.089],[.264,0,.150,.096],
    [.235,0,.151,.097],[.201,0,.139,.096],[.168,0,.130,.097],
    [.110,0,.124,.094],[.058,0,.117,.089],[.018,0,.118,.088],
    [-.033,0,.129,.096],[-.079,0,.139,.099],[-.121,0,.140,.096],
    [-.151,0,.122,.086],[-.175,0,.091,.065],[-.189,0,.048,.039],
    [-.193,0,.015,.014]
  ]);
  // Bake a soft submental shadow into the upper-chest vertices. The large
  // head blocks skylight here even in a shadowless studio.
  capEnds(torso);
  const neckShadow=[],torsoPoints=torso.attributes.position;
  for(let i=0;i<torsoPoints.count;i++){
    const shade=T.MathUtils.smoothstep(torsoPoints.getY(i),.276,.349);
    neckShadow.push(1-.40*shade,1-.53*shade,1-.53*shade);
  }
  torso.setAttribute("color",new T.Float32BufferAttribute(neckShadow,3));
  const chestSkin=mesh(body,"BodyCore",torso,skin,0,0,.003);
  chestSkin.material=chestSkin.material.clone();chestSkin.material.vertexColors=true;
  materials.set("bodySkin",chestSkin.material);
  const neck=armSurface(1,[
    [.474,0,.040,.053],[.438,0,.040,.052],[.397,0,.040,.048],
    [.369,0,.041,.046],[.350,0,.042,.044],[.333,0,.043,.041],[.311,0,.043,.038]
  ]);
  const neckPoints=neck.attributes.position;
  for(let i=0;i<neckPoints.count;i++){
    const offset=.018*T.MathUtils.smoothstep(neckPoints.getY(i),.337,.417);
    neckPoints.setZ(i,neckPoints.getZ(i)+offset);
  }
  // The projecting chin casts a soft contact shadow along the short neck.
  mesh(body,"Neck",capEnds(neck),"#d6b1a7",0,0,.003);
  const tail=joint(body,"WhaleTail",0,.04,-.19);
  const tailBend=joint(tail,"TailBend",.40,-.21,-.25);
  const flukes=joint(tailBend,"Flukes",.43,.257,-.07);
  const tailPath=new T.CatmullRomCurve3([[0,0,.14],[0,0,0],[.20,-.19,-.21],[.62,-.20,-.30],[.83,.047,-.32]]
    .map(point=>new T.Vector3(...point)));
  const tailSkin=new T.TubeGeometry(tailPath,32,.074,10,false);
  const tailIndices=[],tailWeights=[];
  for(let row=0;row<=32;row++){
    const weight=T.MathUtils.smoothstep(tailPath.getPointAt(row/32).x,.22,.61);
    for(let column=0;column<=10;column++){
      tailIndices.push(0,weight>0?1:0,0,0);tailWeights.push(1-weight,weight,0,0);
    }
  }
  model.updateMatrixWorld(true);
  bindSkin(tailSkin,tail,[tail,tailBend],tailIndices,tailWeights,blue,"TailStem");
  for(const s of [-1,1]){
    const fin=new T.Shape();fin.moveTo(0,0);
    fin.bezierCurveTo(.06,.047,.23,.105,.28,.098);
    fin.bezierCurveTo(.23,.015,.16,-.071,.085,-.062);
    fin.quadraticCurveTo(.025,-.048,0,-.017);fin.closePath();
    const lobe=mesh(flukes,"Fluke"+s,new T.ExtrudeGeometry(fin,{depth:.035,bevelThickness:.012,
      bevelSize:.013,bevelSegments:2,curveSegments:12}),blue,0,0,0);
    lobe.scale.x=s;lobe.rotation.x=-.55;lobe.rotation.z=.78;
  }
  // One closed garment, from the throat bow down through the petticoat.
  // The same UV stays attached to the folds as the resident moves.
  const dressTop=.405,dressBottom=-.395;
  const dressRings=[[0,.134],[.12,.170],[.26,.163],[.35,.155],[.51,.213],
    [.68,.272],[.80,.345],[.88,.385],[.94,.402],[1,.357]];
  const dressPoints=[],dressUV=[],dressIndices=[],sections=128;
  for(let row=0;row<=64;row++){
    const v=row/64;
    let next=dressRings.findIndex(k=>k[0]>=v);
    next=Math.max(1,next);
    const [t0,r0]=dressRings[next-1],[t1,r1]=dressRings[next];
    const radius=T.MathUtils.lerp(r0,r1,(v-t0)/(t1-t0));
    for(let j=0;j<=sections;j++){
      const u=j/sections,a=(u-.5)*Math.PI*2;
      const pleat=T.MathUtils.smoothstep(v,.44,1)*Math.cos(16*a);
      // Gather the side panels at hand height. The reference skirt flares
      // below the wrists, leaving the forearms free to hang under the elbows.
      const sideGather=.078*Math.exp(-((v-.615)**2)/.017)*Math.sin(a)**6;
      // Preserve the armhole height and give the front a round neck opening.
      // Ease the alteration into the chest above the fixed apron waistband.
      const facing=Math.cos(a);
      const neckDepth=.082+.002*facing*facing;
      const neckDrop=neckDepth*(1-T.MathUtils.smoothstep(v,0,.34));
      const opening=1-T.MathUtils.smoothstep(v,0,.12);
      const neckEase=.024*opening;
      dressPoints.push(Math.sin(a)*(radius-sideGather-(.019+.014*facing*facing)*opening)*(1+.034*pleat),T.MathUtils.lerp(dressTop,dressBottom,v)-neckDrop+.009*pleat,
        facing*(radius*(v<.35?.82:.77)-neckEase)*(1+.034*pleat)+.01);
      dressUV.push(u,1-v);
      if(j<sections&&row<64){const i=row*(sections+1)+j;
        dressIndices.push(i,i+sections+1,i+1,i+1,i+sections+1,i+sections+2);}
    }
  }
  const dressGeo=new T.BufferGeometry();
  dressGeo.setAttribute("position",new T.Float32BufferAttribute(dressPoints,3));
  dressGeo.setAttribute("uv",new T.Float32BufferAttribute(dressUV,2));
  dressGeo.setIndex(dressIndices);dressGeo.computeVertexNormals();geometry.add(dressGeo);
  const garment=new T.Mesh(dressGeo,new T.MeshToonMaterial({color:0xffffff,gradientMap:ramp}));
  garment.name="鲸纹围裙与百褶裙";body.add(garment);garment.castShadow=true;inkEdge(garment,.007);
  const petticoat=oval(body,"Petticoat",lace,0,dressBottom+.012,.01,.35,.025,.27);
  const lapGeo=dressGeo.clone(),lapPos=lapGeo.attributes.position;
  for(let i=0;i<lapPos.count;i++){
    const x=lapPos.getX(i),y=lapPos.getY(i),z=lapPos.getZ(i);
    const fold=T.MathUtils.smoothstep(.12-y,0,.48);
    const front=T.MathUtils.smoothstep(z,-.11,.20);
    lapPos.setXYZ(i,x*(1+.05*fold),y+fold*(front*.17-.065),z+fold*front*.18);
  }
  lapGeo.computeVertexNormals();geometry.add(lapGeo);
  const lap=new T.Mesh(lapGeo,garment.material);lap.name="坐姿裙摆";body.add(lap);lap.castShadow=true;
  const lining=oval(body,"坐姿衬裙",ink,0,-.279,.035,.345,.095,.322);
  const arms=[],elbows=[],legs=[],knees=[],waves=[];
  for(const s of [-1,1]){
    const arm=joint(body,"Arm"+(s<0?"L":"R"),s*.199,.290,0);arms.push(arm);
    const elbow=joint(arm,"Elbow"+(s<0?"L":"R"),s*.014,-.146,0);elbows.push(elbow);
    shoulderSurface(s,arm,elbow,false);
    shoulderSurface(s,arm,elbow,true);
    mesh(elbow,"LaceCuff",armSurface(s,[
      [-.125,.006,.040,.047],[-.139,.007,.041,.049],[-.151,.008,.047,.052],
      [-.157,.008,.049,.054],[-.157,.008,.043,.047],[-.150,.008,.036,.041]
    ],.062,.0032),pale,0,0,0);
    mesh(elbow,"SleeveBraid",armSurface(s,[
      [-.111,.006,.043,.050],[-.114,.006,.044,.050],[-.117,.006,.043,.050]
    ]),"#b69b75",0,0,0);
    // The palm faces the thigh. Curl the fingertips towards it, with the
    // shorter little finger towards the back and the thumb resting in front.
    const palm=armSurface(s,[
      [.042,0,.014,.021],[.027,0,.023,.030],[.008,.001,.027,.038],
      [-.011,.001,.025,.038],[-.025,-.003,.022,.034],[-.036,-.008,.018,.030],
      [-.044,-.015,.010,.024],[-.047,-.018,.001,.015]
    ]);
    const palmVertices=palm.attributes.position;
    for(let i=0;i<palmVertices.count;i++){
      const y=palmVertices.getY(i),z=palmVertices.getZ(i);
      const fingers=T.MathUtils.smoothstep(-y,.017,.043);
      const pinky=T.MathUtils.smoothstep(-z,0,.035);
      palmVertices.setY(i,y+fingers*(.009*pinky+.003*Math.cos(255*z)));
    }
    palm.computeVertexNormals();
    const hand=mesh(elbow,"Hand",capEnds(palm),skin,s*.009,-.168,.004);
    const thumb=mesh(hand,"Thumb",capEnds(armSurface(s,[
      [.019,0,.009,.012],[.009,-.002,.014,.016],[-.004,-.006,.012,.014],
      [-.013,-.009,.008,.011],[-.017,-.010,.002,.004]
    ])),skin,-s*.008,-.002,.031);
    thumb.rotation.x=-.43;
    const leg=joint(model,"Leg"+(s<0?"L":"R"),s*.136,.356,0);legs.push(leg);
    const knee=joint(leg,"Knee"+(s<0?"L":"R"),0,-.156,0);knees.push(knee);
    // Pin the inner hip to the pelvis; let thigh, knee and ankle share one skin.
    const limb=capEnds(armSurface(s,[
      [.102,-.077,.021,.030],[.079,-.064,.041,.049],[.047,-.040,.053,.056],
      [.016,-.020,.056,.055],[-.028,-.008,.053,.050],[-.077,-.002,.047,.047],
      [-.124,0,.038,.040],[-.156,0,.035,.037],[-.183,0,.035,.037],
      [-.215,0,.038,.040],[-.249,0,.034,.036],[-.284,0,.027,.029],
      [-.307,0,.023,.027],[-.324,0,.020,.024]
    ]));
    const legIndices=[],legWeights=[];
    const legVertices=limb.attributes.position;
    for(let i=0;i<legVertices.count;i++){
      const y=legVertices.getY(i),hip=T.MathUtils.smoothstep(y,.006,.091);
      const shin=T.MathUtils.smoothstep(-y,.112,.202),thigh=1-hip-shin;
      legIndices.push(0,thigh>0?1:0,shin>0?2:0,0);
      legWeights.push(hip,thigh,shin,0);
    }
    model.updateMatrixWorld(true);
    bindSkin(limb,leg,[body,leg,knee],legIndices,legWeights,skin,"LegSkin"+(s<0?"L":"R"));
    oval(knee,"Foot"+(s<0?"L":"R"),skin,0,-.146,.037,.051,.037,.085);
    fabric(leg,knee,[[.027,.073],[-.025,.080],[-.10,.074],[-.15,.068],[-.185,.060],[-.22,.057],[-.254,.055]],-.156,.070,lace,"袜筒"+s);
    oval(knee,"MaryJane",ink,0,-.132,.041,.079,.067,.118);
    oval(knee,"SoleEdge","#504956",0,-.176,.043,.079,.030,.116);
    oval(knee,"CreamRubberSole","#d9c7b2",0,-.197,.043,.072,.014,.105);
    oval(knee,"Instep",lace,0,-.076,.088,.067,.039,.071);
    oval(knee,"ShoeStrap",ink,0,-.068,.106,.074,.014,.023);
    oval(knee,"Buckle","#b5a38d",s*.063,-.065,.098,.013,.012,.012);
    oval(knee,"ToeGlint","#8e90a9",-.021,-.127,.152,.026,.008,.007,-.18);
  }
  // Fixed UVs on a closed head: the same cheek, nose and fringe stay on the
  // same vertices through a full camera orbit. Sculpt the nose into the front.
  const coords=[],uv=[],idx=[],rings=faceArt.sections.length-1,sectors=144;
  function sectionAt(v){
    const p=T.MathUtils.clamp(v,0,1)*rings,i=Math.min(rings-1,Math.floor(p));
    return faceArt.sections[i].map((x,k)=>T.MathUtils.lerp(x,faceArt.sections[i+1][k],p-i));
  }
  function frontSurface(v,x,forward,front,axis){
    const eyeBand=T.MathUtils.smoothstep(v,.40,.58)*(1-T.MathUtils.smoothstep(v,.82,.96));
    const temple=eyeBand*T.MathUtils.smoothstep(Math.abs(x),.16,.44);
    const contour=forward**(1+.78*temple);
    const orbit=Math.exp(-(((Math.abs(x)-.202)/.089)**2)-((v-.688)/.109)**2);
    const nose=Math.exp(-(x*x/.0025+(v-.803)**2/.0009));
    return axis+(front-axis)*contour+forward**2*(.009*nose-.005*orbit);
  }
  for(let i=0;i<=rings;i++){
    const v=i/rings,[radius,front,rear,axis]=faceArt.sections[i];
    for(let j=0;j<=sectors;j++){
      const u=j/sectors,a=(u-.5)*Math.PI*2,forward=Math.cos(a);
      const x=radius*Math.sin(a);
      const z=forward>0?frontSurface(v,x,forward,front,axis):axis+(axis-rear)*forward;
      coords.push(x,.45-.882*v,z);uv.push(u,1-v);
      if(j<sectors&&i<rings){const k=i*(sectors+1)+j;idx.push(k,k+sectors+1,k+1,k+1,k+sectors+1,k+sectors+2);}
    }
  }
  for(const row of [0,rings]){
    const c=coords.length/3;coords.push(0,.45-.882*row/rings,faceArt.sections[row][3]);uv.push(.5,1-row/rings);
    for(let j=0;j<sectors;j++){const k=row*(sectors+1)+j;idx.push(...(row===0?[c,k,k+1]:[c,k+1,k]));}
  }
  const sculpt=new T.BufferGeometry();sculpt.setAttribute("position",new T.Float32BufferAttribute(coords,3));
  sculpt.setAttribute("uv",new T.Float32BufferAttribute(uv,2));sculpt.setIndex(idx);sculpt.computeVertexNormals();geometry.add(sculpt);
  // Preserve the cel's painted cheek shading while letting room light turn
  // across the temples. These normals stay in local space at every camera angle.
  const normals=sculpt.attributes.normal,actual=new T.Vector3(),painted=new T.Vector3();
  for(let i=0;i<=rings;i++)for(let j=0;j<=sectors;j++){
    const a=(j/sectors-.5)*Math.PI*2,cs=Math.cos(a);
    if(cs<=0)continue;
    const n=i*(sectors+1)+j;
    const blend=.68*T.MathUtils.smoothstep(i/rings,.47,.76)*cs;
    painted.set(.70*Math.sin(a),.11,cs).normalize();
    actual.fromBufferAttribute(normals,n).lerp(painted,blend).normalize();
    normals.setXYZ(n,actual.x,actual.y,actual.z);
  }
  const face=new T.Mesh(sculpt,new T.MeshLambertMaterial({color:0x878d98,emissive:0xffffff,emissiveIntensity:.74}));
  face.name="WhaleFace";head.add(face);face.castShadow=true;
  const faceRim=new T.Mesh(sculpt,outline);faceRim.name="FaceInk";faceRim.scale.setScalar(1.008);head.add(faceRim);
  const happyFace=new T.Mesh(sculpt,face.material.clone());happyFace.name="Smile";head.add(happyFace);
  const sleepingFace=new T.Mesh(sculpt,face.material.clone());sleepingFace.name="ClosedEyes";head.add(sleepingFace);
  const blinkFace=new T.Mesh(sculpt,face.material.clone());blinkFace.name="Blink";head.add(blinkFace);
  const happyBlink=new T.Mesh(sculpt,face.material.clone());happyBlink.name="SmileBlink";head.add(happyBlink);
  const back=joint(head,"BackWaves",0,0,0);
  // A continuous convex surface follows the rear skull into the nape. Its
  // lower scallops overlap the separate locks; the center parts above the tail.
  const rearPoints=[],rearUV=[],rearIndices=[];
  const rearSection=new T.CatmullRomCurve3([
    [.038,.445,.060],[.277,.33,.32],[.409,.18,.479],[.477,-.02,.565],
    [.464,-.23,.544],[.411,-.42,.442],[.393,-.57,.408],[.392,-.86,.454]
  ].map(p=>new T.Vector3(...p)));
  for(let row=0;row<=40;row++){
    const v=row/40, ring=rearSection.getPoint(v);
    for(let col=0;col<=64;col++){
      const a=(col/64-.5)*3.04,cs=Math.cos(a),sn=Math.sin(a);
      const lower=T.MathUtils.smoothstep(v,.70,1);
      const split=lower*(.20*Math.exp(-sn*sn/.041)-.060*Math.cos(a*9));
      rearPoints.push(ring.x*sn,ring.y+split,-ring.z*cs-.019);
      rearUV.push(.5-.5*sn,1-v);
      if(row<40&&col<64){const i=row*65+col;rearIndices.push(i,i+1,i+65,i+1,i+66,i+65);}
    }
  }
  const rearGeo=new T.BufferGeometry();
  rearGeo.setAttribute("position",new T.Float32BufferAttribute(rearPoints,3));
  rearGeo.setAttribute("uv",new T.Float32BufferAttribute(rearUV,2));
  rearGeo.setIndex(rearIndices);rearGeo.computeVertexNormals();geometry.add(rearGeo);
  const rearHair=new T.Mesh(rearGeo,new T.MeshToonMaterial({color:0xffffff,gradientMap:ramp}));
  rearHair.name="后发外层";rearHair.castShadow=true;back.add(rearHair);
  const loader=new T.TextureLoader();
  let disposed=false;
  const surfaces=[[face,detail.open],[sleepingFace,detail.closed],
    [happyFace,detail.smile],[blinkFace,detail.blink],[happyBlink,detail.smileBlink],[rearHair,faceArt.rearHair]];
  // The underlayer ends above the separating tips, leaving open space below.
  oval(back,"HairMantle",blue,0,-.18,-.21,.402,.47,.245);
  const trailingLocks=[];
  const rearDesign=[
    [-.32,-.40,-.47,-.88,-.55],[-.23,-.27,-.18,-1.02,-.28],
    [-.10,-.11,-.19,-.91,-.23],[.05,.03,.11,-1.00,.02],
    [.18,.24,.16,-.94,.25],[.30,.40,.49,-.85,.55]
  ];
  for(const [i,[root,middle,bend,length,tip]] of rearDesign.entries()){
    const layer=joint(back,"RearLock"+i,root*.66,.08,-.19);
    trailingLocks.push(layer);
    const rel=x=>x-root*.66;
    lock(layer,"BackLayer"+i,i%2?"#3d588c":"#354e82",
      [[0,.22,-.09],[rel(root),-.04,-.24],[rel(middle),-.30,-.235],
       [rel(bend),-.47,-.118],[rel(middle),-.69,-.226-i%2*.025],
       [rel(tip),length+.06,-.259],[rel(tip)-.043,length,-.17+i%2*.04]],
      i===0||i===5?.102:.126,.076);
  }
  const fins=[];
  for(const s of [-1,1]){
    const strand=joint(head,"SideWaves"+(s<0?"L":"R"),s*.278,.03,-.035);waves.push(strand);strand.scale.y=1.17;
    // Front curl, outward fork, rear wave and the thin loop visible against the sky.
    // Offsetting both their depth and their length keeps the gaps open on the profile.
    const paths=[
      // Bury the upper ends under the crown so the bare head is finished
      // when the wardrobe removes the headband.
      ["SideMantle","#344c80",.113,.073,[[-.095,.265,-.14],[.066,.20,-.19],[.119,.15,-.20],
        [.157,-.075,-.182],[.138,-.30,-.206],[.126,-.49,-.105],[.080,-.65,-.155],
        [.038,-.74,-.228],[.069,-.83,-.160]]],
      ["FaceCurl","#48669c",.068,.035,[[.01,-.09,.18],[.091,-.24,.185],[.10,-.38,.16],
        [.014,-.49,.117],[.006,-.57,.19],[.078,-.595,.237],[.104,-.56,.20]]],
      ["OuterFork","#48689e",.064,.038,[[.04,-.13,.014],[.14,-.34,.035],[.18,-.45,.07],
        [.135,-.58,.06],[.103,-.71,-.014],[.149,-.823,.038],[.230,-.845,.116],[.247,-.797,.137]]],
      ["RearWave","#3c598f",.093,.053,[[.045,.02,-.185],[.092,-.24,-.21],[.195,-.42,-.23],
        [.263,-.52,-.14],[.201,-.69,-.208],[.181,-.79,-.268],[.214,-.92,-.179],[.306,-.925,-.072]]],
      ["OuterLoop","#3d588d",.040,.024,[[.09,-.12,-.125],[.138,-.29,-.13],[.218,-.42,-.134],
        [.308,-.54,-.098],[.329,-.644,-.06],[.270,-.704,-.021],[.245,-.746,.012]]],
      ["LowerCurl","#516fa5",.052,.037,[[.08,-.40,-.008],[.164,-.55,-.016],[.14,-.66,.021],
        [.171,-.774,.038],[.277,-.812,.046],[.349,-.751,.037],[.352,-.716,.019]]]
    ];
    for(const [i,[label,color,width,depth,path]] of paths.entries()){
      const [ox,oy,oz]=path[0],pivot=joint(strand,label+"Pivot"+s,s*ox,oy,oz);
      trailingLocks.push(pivot);
      const points=path.map(([x,y,z],j)=>{
        const sweep=label==="FaceCurl"?T.MathUtils.smoothstep(-y,.24,.52):0;
        return [s*(x-ox+.084*sweep),y-oy+(s<0?.014:0)*Math.sin(j*.7+i),z-oz-.22*sweep];
      });
      lock(pivot,label+s,color,points,width,depth);
    }
    // Each bob curls around the cheek in depth. Both edges and the pointed
    // tips follow the corresponding lock in the original desktop cel.
    const detail=faceArt.bob[s<0?0:1],bp=[],bt=[],bi=[],slices=32;
    for(const [row,[v,inner,outer]] of detail.rows.entries()){
      const [radius,front,,axis]=sectionAt(v);
      for(let i=0;i<=slices;i++){
        const angle=i/slices*Math.PI*2,q=(1-Math.cos(angle))*.5;
        const x=T.MathUtils.lerp(inner,outer,q);
        const cs=Math.sqrt(Math.max(0,1-(x/radius)**2));
        const depth=frontSurface(v,x,cs,front,axis)-.78*Math.max(0,Math.abs(x)-radius);
        const lip=Math.sin(angle)*Math.min(.022,.21*Math.abs(outer-inner));
        bp.push(x,.45-.882*v,depth+.008+lip);
        bt.push(q,1-row/(detail.rows.length-1));
        if(i<slices&&row<detail.rows.length-1){
          const n=row*(slices+1)+i,b=n+slices+1;
          if(s>0)bi.push(n,b,n+1,n+1,b,b+1);
          else bi.push(n,n+1,b,n+1,b+1,b);
        }
      }
    }
    const bobGeo=new T.BufferGeometry();bobGeo.setIndex(bi);
    bobGeo.setAttribute("position",new T.Float32BufferAttribute(bp,3));
    bobGeo.setAttribute("uv",new T.Float32BufferAttribute(bt,2));bobGeo.computeVertexNormals();geometry.add(bobGeo);
    const bob=new T.Mesh(bobGeo,face.material.clone());bob.name="鬓发"+s;head.add(bob);
    materials.set(bob.name,bob.material);surfaces.push([bob,detail.color]);
    oval(head,"Ear"+s,"#f0caba",s*.440,-.184,.076,.031,.061,.044,s*.15);
    // DSH's fin silhouette and two-tone underside, with a small ribbon at the root.
    const finBase=joint(head,"FinBase"+s,s*.456,-.086,.061);fins.push(finBase);
    finBase.rotation.y=s*.53;
    const outer=new T.Shape();
    outer.moveTo(0,.040);outer.bezierCurveTo(.083,.030,.153,-.070,.289,-.102);
    outer.quadraticCurveTo(.179,-.143,.047,-.082);outer.quadraticCurveTo(0,-.063,0,.040);
    const fin=mesh(finBase,"WhaleFin"+s,new T.ExtrudeGeometry(outer,{depth:.045,bevelThickness:.009,
      bevelSize:.006,bevelSegments:2,curveSegments:16}),"#314570",0,0,0);
    fin.scale.x=s;
    const under=new T.Shape();under.moveTo(.012,-.057);
    under.quadraticCurveTo(.062,-.125,.100,-.105);under.quadraticCurveTo(.145,-.147,.180,-.122);
    under.quadraticCurveTo(.220,-.153,.288,-.103);under.quadraticCurveTo(.15,-.107,.012,-.057);
    const trim=mesh(finBase,"FinLace"+s,new T.ExtrudeGeometry(under,{depth:.025,bevelThickness:.004,
      bevelSize:.003,bevelSegments:2,curveSegments:12}),"#c3c6d6",0,0,.001);trim.scale.x=s;
    if(s===1){
      for(const j of [-1,1]){
        const loop=new T.Shape(),unit=.00365;
        loop.moveTo(j*.003,.013);loop.quadraticCurveTo(j*.052,.062,j*.078,.054);
        loop.quadraticCurveTo(j*.097,.047,j*.082,-.044);loop.quadraticCurveTo(j*.071,-.068,j*.006,-.014);
        loop.closePath();
        const bowGeo=new T.ExtrudeGeometry(loop,{depth:.013,bevelSize:.0035,bevelThickness:.004,bevelSegments:3});
        const bp=bowGeo.attributes.position,bt=bowGeo.attributes.uv;
        for(let n=0;n<bp.count;n++){
          const x=bp.getX(n),y=bp.getY(n);
          bt.setXY(n,(324+x/unit-291)/61,1-(179-y/unit-150)/61);
          bp.setZ(n,bp.getZ(n)-x*.56+.014*Math.sin(Math.min(1,Math.abs(x)/.089)*Math.PI));
        }
        bowGeo.computeVertexNormals();geometry.add(bowGeo);
        const bow=new T.Mesh(bowGeo,face.material.clone());bow.name="BlueBow"+j;
        bow.position.set(.526,-.006,.157);head.add(bow);materials.set(bow.name,bow.material);
        surfaces.push([bow,faceArt.bow]);
        lock(head,"RibbonEnd"+j,"#4a6c94",[[.525,-.016,.150],[.525+j*.021,-.053,.145-j*.012],
          [.525+j*.043,-.096,.14-j*.018]],.022,.008);
      }
      oval(head,"RibbonClasp","#b89976",.528,-.006,.175,.017,.023,.012);
    }
  }
  // Pleated cloth wraps across the crown from the base of one fin to the other.
  const band=[];
  const clothPoints=[],clothUV=[],clothIndex=[];
  for(let i=0;i<=128;i++){
    const a=(i/128-.5)*3.06,fold=(1-Math.cos(16*a))*.5;
    const sa=Math.sin(a),ca=Math.cos(a),v=.012+.53*(1-ca);
    const [radius,front,,axis]=sectionAt(v);
    const x=Math.sign(a)*radius*.969*T.MathUtils.smoothstep(Math.abs(a),0,.24);
    const y=.45-.882*v,z=frontSurface(v,x,Math.sqrt(Math.max(0,1-(x/radius)**2)),front,axis)+.005;
    band.push([x,y,z]);
    for(let j=0;j<4;j++){
      const width=faceArt.headband.width[Math.round(i/128*(faceArt.headband.width.length-1))];
      const tuck=.13+.87*T.MathUtils.smoothstep(1-Math.abs(a)/1.53,0,.13);
      const r=[0,.43,1,.88][j]*width*tuck*(.96+.05*fold);
      clothPoints.push(x+r*sa,y+r*ca,z+[0,.008,-.027,-.065][j]-.010*fold*j/3);
      clothUV.push(i/128,[0,.4,1,.87][j]);
      if(i<128&&j<3){const n=i*4+j;clothIndex.push(n,n+4,n+1,n+1,n+4,n+5);}
    }
  }
  const pleats=new T.BufferGeometry();pleats.setIndex(clothIndex);
  pleats.setAttribute("position",new T.Float32BufferAttribute(clothPoints,3));
  pleats.setAttribute("uv",new T.Float32BufferAttribute(clothUV,2));pleats.computeVertexNormals();geometry.add(pleats);
  const bandMaterial=face.material.clone();bandMaterial.side=T.DoubleSide;
  materials.set("bonnetCloth",bandMaterial);const bonnet=new T.Mesh(pleats,bandMaterial);bonnet.name="褶边发带";head.add(bonnet);
  surfaces.push([bonnet,faceArt.headband.color]);
  ribbon(head,"BonnetSeam","#454c68",band,.005);
  lock(head,"Ahoge",blue,[[.012,.45,-.014],[.014,.566,-.028],[-.05,.643,-.033],[-.165,.622,-.028],[-.235,.548,-.018],[-.263,.483,-.006]],.022,.014);
  lock(head,"AhogeGlint","#8295ad",[[.008,.531,-.009],[.003,.583,-.013],[-.060,.639,-.017],[-.143,.627,-.012],[-.207,.573,-.006]],.005,.003);
  const originalCloth=garment.material;
  const wardrobe=fitWardrobe({model,body,head,knees,garment,lap,redraw});
  originalCloth.dispose();
  // Blend the lap into the same topology as the standing dress. Its hem
  // follows the legs through sitting, swinging and transitions between clips.
  const gathered=dressGeo.attributes.position.clone();
  for(let i=0;i<gathered.count;i++){
    const x=gathered.getX(i),y=gathered.getY(i),z=gathered.getZ(i);
    const lift=T.MathUtils.smoothstep(.12-y,0,.51);
    gathered.setXYZ(i,x*(1+.04*lift),y+.20*lift,z*(1+.06*lift));
  }
  dressGeo.morphAttributes.position=[lapPos.clone(),gathered];
  dressGeo.morphAttributes.normal=[lapGeo.attributes.normal.clone(),dressGeo.attributes.normal.clone()];
  for(const key of ["position","normal"]){
    const rest=dressGeo.attributes[key].array;
    for(const target of dressGeo.morphAttributes[key]){
      for(let i=0;i<rest.length;i++)target.array[i]-=rest[i];
    }
  }
  dressGeo.morphTargetsRelative=true;
  const fitLayers=fit&&!bodyOnly?fitMovingLayers(body,garment,arms,elbows,legs,knees,waves,trailingLocks):null;
  garment.updateMorphTargets();
  const hemOutline=garment.children[0];hemOutline.updateMorphTargets();
  const book=joint(body,"OpenBook",0,.115,.324);book.visible=false;book.rotation.x=-.22;
  for(const s of [-1,1]){
    const half=new T.Group();book.add(half);half.rotation.y=s*.23;
    mesh(half,"BookCover"+s,new T.BoxGeometry(.188,.219,.014),"#587577",s*.094,0,-.015);
    mesh(half,"Page"+s,new T.BoxGeometry(.177,.203,.022),"#eadfc5",s*.09,0,.002);
    for(let i=0;i<4;i++)mesh(half,"PageLine"+s+i,new T.BoxGeometry(i===3?.075:.125,.005,.002),
      "#a69d88",s*.09,.051-i*.025,.015);
  }
  mesh(book,"BookRibbon",new T.BoxGeometry(.016,.067,.011),"#bf714e",.018,-.10,.004);
  const pencil=joint(elbows[1],"Pencil",0,-.174,.045);
  mesh(pencil,"PaintStick",new T.CylinderGeometry(.014,.014,.23,8),"#edb557",0,0,0);
  mesh(pencil,"Graphite",new T.ConeGeometry(.014,.05,8),ink,0,-.14,0).rotation.z=Math.PI;
  const can=joint(elbows[1],"WateringCan",.03,-.17,.10);
  oval(can,"CanBody","#75a3a4",0,0,0,.12,.107,.11);
  ribbon(can,"Spout","#75a3a4",[[.06,0,0],[.17,.05,0],[.24,.12,0]],.023);
  const pad=joint(body,"Gamepad",0,.11,.24);
  oval(pad,"Controller",ink,0,0,0,.16,.07,.048);
  oval(pad,"Button","#91acc3",.075,.015,.042,.018,.018,.012);
  const props=[book,pencil,can,pad];
  for(const prop of props)prop.userData.layer="prop";
  if(bodyOnly){
    wardrobe.removeFromModel();
    for(const prop of props)prop.removeFromParent();
    model.userData.layer="body";
  }
  const handsAtWork=new Set(["read","bench-read","sleep","write","browse","play","swing","hug"]);
  const rightHandActions=new Set(["contact","fish","pet","water","invite","stroke","fetch","paint"]);
  function sample(kind,t){
    const onBench=kind==="bench"||kind==="bench-read",rest=kind==="sleep",reading=kind==="read"||kind==="bench-read",moving=["yard","play","paint","browse","contact","watch","walk"].includes(kind);
    const freeArm=i=>!handsAtWork.has(kind)&&!(i===1&&rightHandActions.has(kind));
    const breath=Math.sin(t*1.65)*.012;
    body.position.y=.54+breath;head.rotation.set(reading?.17:rest?.09:0,Math.sin(t*.64)*.045,rest?.09:0);
    const blink=!rest && t%3.88>3.74;
    const smile=kind==="contact"||kind==="play"||kind==="swing";
    fins.forEach((fin,i)=>{fin.rotation.z=(i?-1:1)*((rest?.17:smile?.02:.11)+.012*Math.sin(t*1.4));});
    face.visible=!rest&&!blink&&!smile;happyFace.visible=!rest&&!blink&&smile;sleepingFace.visible=rest;
    blinkFace.visible=blink&&!smile;happyBlink.visible=blink&&smile;
    lap.visible=false;lining.visible=onBench;garment.visible=true;petticoat.visible=!onBench;
    arms.forEach((arm,i)=>{
      const side=i===0?-1:1;
      const sway=Math.sin(t*1.65+i*.65);
      if(freeArm(i)){
        // The sleeve drops from the side of the chest. Keep the elbow under
        // the shoulder and a little room for the palm beside the flared skirt.
        arm.position.set(side*(onBench?.243:.195),(onBench?.242:.254)+.001*sway,onBench?.128:.044);
        // Let the shoulder open enough to clear the dress and keep the lower
        // arm in line. The fitted bone offsets already supply part of this tilt.
        const outward=onBench?.085:.226;
        arm.rotation.set(.04+.004*sway,0,side*(outward-Math.atan2(.014,.146)));
        arm.scale.y=1;
        elbows[i].rotation.set(-.118+.005*sway,0,side*(Math.atan2(.014,.146)-Math.atan2(.009,.167)-(onBench?0:.012)));
      }else{
        arm.position.set(side*.199,onBench?.242:.290,onBench?.15:0);
        arm.rotation.set(reading?-.83:moving?-.48+Math.sin(t*2+i)*.24:-.07,0,side*(rest?.22:reading?.14:.44));
        arm.scale.y=onBench?1.15:1;
        elbows[i].rotation.set(reading?-.70:-.13,0,0);
      }
    });
    book.visible=reading;pencil.visible=kind==="paint"||kind==="write";can.visible=kind==="water";pad.visible=kind==="play";
    legs.forEach((leg,i)=>leg.rotation.x=reading?-.72:moving?Math.sin(t*2+i*Math.PI)*.15:0);
    knees.forEach(k=>k.rotation.x=reading?.90:.03);
    waves.forEach((w,i)=>{
      // Let cheek locks fall outside the relaxed sleeve, revealing the line
      // from shoulder to cuff in front and three-quarter views.
      const relaxed=freeArm(i);
      w.rotation.x=relaxed?.020:0;
      w.rotation.z=Math.sin(t*1.5+i)*.028+(relaxed?(i===0?-.018:.018):0);
    });
    back.rotation.x=Math.sin(t*1.25)*.022;
    trailingLocks.forEach((pivot,i)=>{
      const amplitude=rest?.009:kind==="walk"?.039:.017;
      pivot.rotation.x=amplitude*Math.sin(t*(rest?.8:2.1)-i*.34);
      pivot.rotation.z=amplitude*.64*Math.sin(t*(rest?.7:1.7)-i*.52);
    });
    if(kind==="paint"||kind==="write"){arms[1].rotation.x=-.85+Math.sin(t*3.6)*.18;head.rotation.x=.22;elbows[1].rotation.x=-.55;}
    if(kind==="play"){arms.forEach(a=>a.rotation.x=-.78);head.rotation.x=.15;}
    if(kind==="water"){arms[1].rotation.x=-.65;arms[1].rotation.z=.64+Math.sin(t*1.8)*.12;head.rotation.x=.27;}
    if(kind==="swing"){arms.forEach((a,i)=>{a.rotation.x=-1.3;a.rotation.z=(i?1:-1)*.32;});legs.forEach(a=>a.rotation.x=-.95+Math.sin(t*2.5)*.2);}
    if(["watch","listen","look","think"].includes(kind)){head.rotation.y=Math.sin(t*.74)*.24;head.rotation.z=.10;}
    if(kind==="fish"||kind==="pet"){body.position.y-=.10;head.rotation.x=.32;arms[1].rotation.x=-.65+Math.sin(t*1.8)*.1;}
    if(kind==="contact"){arms[1].rotation.z=1.4+Math.sin(t*3)*.12;elbows[1].rotation.z=.82;head.rotation.z=-.06;}
    if(rest){
      head.rotation.set(-.08,.31,.04);
      arms[0].rotation.set(-.48,0,-.32);elbows[0].rotation.x=-.96;
      arms[1].rotation.set(-.20,0,.18);elbows[1].rotation.x=-.61;
      legs[0].rotation.x=-.18;legs[1].rotation.x=-.32;
      knees[0].rotation.x=.23;knees[1].rotation.x=.44;
    }
    if(kind==="walk"){
      const stride=t*4.2;
      legs.forEach((leg,i)=>{const angle=stride+i*Math.PI;leg.rotation.x=.52*Math.sin(angle);
        knees[i].rotation.x=.04+.64*Math.max(0,-Math.cos(angle));arms[i].rotation.x=-.37*Math.sin(angle);});
      body.position.y+=.035*Math.abs(Math.cos(stride));body.rotation.y=.06*Math.sin(stride);
    }else body.rotation.y=0;
    const [motionLean,lift,feet,step]=reference(kind,t);
    const quiet=freeArm(0)&&freeArm(1)&&kind!=="walk"&&kind!=="yard";
    const lean=quiet?motionLean*.24:motionLean;
    body.position.y+=feet*(rest?.13:.80);
    body.rotation.z=lean*.47;head.rotation.z+=lean*1.35;
    head.rotation.y+=lean*1.9;back.rotation.z=-lean*.40;
    for(let i=0;i<waves.length;i++)waves[i].rotation.z+=-lean*.66+Math.sin(t*2.1+i)*Math.abs(feet)*.6;
    if(kind==="walk"){legs[0].rotation.x+=step*1.3;legs[1].rotation.x-=step*1.3;}
    if(kind==="browse"||kind==="write"||kind==="play"){
      for(let i=0;i<elbows.length;i++){const beat=Math.sin(t*5.25+i*1.7);
        elbows[i].rotation.x-=.41+.17*beat;arms[i].rotation.x-=.20+.10*beat;}
    }
    if(kind==="pet"){elbows[1].rotation.x=-.66+.24*Math.sin(t*2);head.rotation.z+=.085;}
    if(kind==="invite"){head.rotation.x=.12;arms[1].rotation.x=-.65;elbows[1].rotation.x=-.78+.19*Math.sin(t*2.4);}
    if(kind==="stroke"){
      body.position.y-=.20;head.rotation.x=.33;
      arms[1].rotation.set(-.86+.18*Math.sin(t*2.7),.12,.24);
      elbows[1].rotation.x=-.58+.13*Math.cos(t*2.7);
    }
    if(kind==="hug"){
      body.position.y-=.12;head.rotation.set(.22,.03,.08);
      arms.forEach((arm,i)=>{arm.rotation.set(-1.12,0,(i?1:-1)*.43);
        elbows[i].rotation.set(-.83,0,(i?-1:1)*.49);});
    }
    if(kind==="fetch"){
      const wind=T.MathUtils.clamp(t/.52,0,1),launch=T.MathUtils.smoothstep(t,.52,1.13);
      head.rotation.y=-.20;body.rotation.z-=.09*(wind-launch);
      arms[1].rotation.set(-.22-wind*.92+launch*.37,-.15-wind*.4+launch*.7,.37+wind*.45-launch*.48);
      elbows[1].rotation.x=-.35-wind*.86+launch*.99;
    }
    legs.forEach(leg=>{
      leg.position.y=onBench?.225:.356;
      leg.position.z=onBench?.103:0;
      leg.scale.setScalar(onBench?1.31:1);
    });
    if(onBench){
      body.position.y-=.115;
      head.rotation.x=reading?.15:-.035;
      legs.forEach((leg,i)=>{leg.rotation.x=-1.54;leg.rotation.y=(i?1:-1)*.13;});
      knees.forEach(k=>k.rotation.x=.20);
    }else{
      legs.forEach(leg=>leg.rotation.y=0);
      if(kind==="swing")knees.forEach((k,i)=>k.rotation.x=.72+.18*Math.sin(2.5*t+i*.15));
    }
    head.position.copy(headOffset).applyQuaternion(head.quaternion).add(neckPivot);
    // The reference lift contains torso compression. At the neck a downward
    // excursion is smaller, preserving the jaw clearance as the head turns.
    head.position.y+=lift*(rest?.13:lift<0?.075:.44);
    // The chin glides around the neck on a nod or turn. Include its small
    // cervical extension, especially while blending out of a sleeping pose.
    const headAngle=Math.hypot(head.rotation.x,head.rotation.y,head.rotation.z);
    head.position.y+=.013*T.MathUtils.smoothstep(headAngle,.065,.22);
    tail.rotation.y=(rest?-.68:0)+Math.sin(t*(rest?.8:1.7))*(rest?.04:.15)-lean*.72;
    flukes.rotation.x=.12*Math.sin(t*(rest?.85:2.1)-.32);
  }
  let current="",transition=null,elapsed=0;
  const inertia=finAndTailInertia(fins,tail,tailBend,flukes);
  function pose(kind,t,{blend=false,dt=0,snap=false}={}){
    inertia.removeOffsets();
    if(snap)transition=null;
    if(kind!==current){
      transition=blend&&current?joints.map(n=>[n.position.clone(),n.quaternion.clone(),n.scale.clone()]):null;
      elapsed=0;current=kind;
    }
    sample(kind,t);
    if(transition){
      elapsed+=dt;
      const w=T.MathUtils.smootherstep(elapsed,0,.52);
      joints.forEach((n,i)=>{n.position.lerp(transition[i][0],1-w);n.quaternion.slerp(transition[i][1],1-w);n.scale.lerp(transition[i][2],1-w);});
      if(w>=1)transition=null;
    }
    inertia.update(dt,snap);
    const bend=Math.max(0,-legs[0].rotation.x,-legs[1].rotation.x);
    const fold=T.MathUtils.smoothstep(bend,.25,1.49);
    garment.morphTargetInfluences[0]=hemOutline.morphTargetInfluences[0]=fold;
    const gather=T.MathUtils.clamp((.54-body.position.y)/.20,0,1)*(1-fold);
    garment.morphTargetInfluences[1]=hemOutline.morphTargetInfluences[1]=gather;
    petticoat.position.y=dressBottom+.012+.20*gather;
    fitLayers?.();
    wardrobe.followPose(kind);
    if(!bodyOnly)wardrobe.lace.update(dt,{snap});
    petticoat.visible=fold<.38;lining.visible=fold>=.70;
  }
  pose("idle",0);
  // A soft, blue Fresnel edge belongs to the resident's materials. It works
  // with room lights at night and never brightens the furniture behind her.
  const lit=new Set();
  model.traverse(n=>{if(n.isMesh && n.material.isMaterial && !n.material.isMeshBasicMaterial)lit.add(n.material);});
  for(const mat of lit){
    mat.onBeforeCompile=shader=>{
      shader.vertexShader="varying vec3 whaleView;\n"+shader.vertexShader.replace("#include <project_vertex>",
        "#include <project_vertex>\nwhaleView = -mvPosition.xyz;");
      shader.fragmentShader="varying vec3 whaleView;\n"+shader.fragmentShader.replace("#include <opaque_fragment>",
        "float whaleRim = pow(1.0 - clamp(dot(normalize(normal),normalize(whaleView)),0.0,1.0),3.0);"+
        "outgoingLight += vec3(0.055,0.080,0.135)*whaleRim;\n#include <opaque_fragment>");
    };
  }
  const bodyNodes=new Set();
  if(bodyOnly)model.traverse(n=>bodyNodes.add(n));
  const maps=bodyOnly?surfaces.filter(([obj])=>bodyNodes.has(obj)):surfaces;
  const ready=Promise.all(maps.map(async ([obj,uri])=>{
    const map=await loader.loadAsync(uri);
    if(disposed){map.dispose();return;}
    map.colorSpace=T.SRGBColorSpace;obj.material.map=map;
    obj.material.emissive.setHex(0xffffff);obj.material.emissiveMap=map;
    obj.material.emissiveIntensity=obj.material.isMeshLambertMaterial?.74:.16;
    obj.material.needsUpdate=true;textures.push(map);
  }).concat(bodyOnly?[]:wardrobe.setOutfit(DEFAULT_OUTFIT))).then(()=>{if(!disposed)redraw();});
  const expressions=[face,happyFace,sleepingFace,blinkFace,happyBlink];
  return {model,pose,ready,lace:wardrobe.lace,setOutfit:bodyOnly?undefined:wardrobe.setOutfit,
    joints:bodyOnly?joints.filter(n=>bodyNodes.has(n)):joints,
    visibilityNodes:bodyOnly?expressions:[...expressions,garment,petticoat,lap,lining,...props],
    dispose(){disposed=true;wardrobe.dispose();model.removeFromParent();for(const g of geometry)g.dispose();
      for(const m of materials.values())m.dispose();for(const texture of textures)texture.dispose();
      for(const skeleton of skeletons)skeleton.dispose();
      ramp.dispose();outline.dispose();face.material.dispose();sleepingFace.material.dispose();blinkFace.material.dispose();
      happyBlink.material.dispose();happyFace.material.dispose();rearHair.material.dispose();}};
}
