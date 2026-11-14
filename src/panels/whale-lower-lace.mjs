import * as T from "three";

// The plain sailor skirt has woven stripes. The winter cape and boot collars
// are fur. Only the separate undergarment and hosiery trims use lace here.
const styles={
  maid:   {hems:[["女仆衬裙褶边",.958,.042,30,0xffeadb]],sock:[.026,.013,12],apron:true},
  press:  {hems:[["报刊装裙底窄衬边",.982,.023,27,0xece0e6]],sock:[.018,.008,10]},
  summer: {hems:[["夏日水手裙底绣花边",.963,.036,32,0xffeee6]],sock:[.030,.017,13]},
  star:   {hems:[["星愿内裙上层花边",.906,.029,32,0xe5d6e6],["星愿内裙下层花边",.976,.047,26,0xffeee8]],sock:[.024,.012,12]},
  winter: {hems:[["冬裙内衬褶边",.968,.043,26,0xf8e9e5]],sock:[.018,.009,12]},
  sleep:  {hems:[["睡裙荷叶层下缘",.864,.034,27,0xd8d2eb],["睡裙内裙软花边",.978,.037,24,0xffeee8]],sock:[.025,.012,9]},
  rain:   {hems:[["雨衣内裙双层衬边",.962,.036,29,0xeee5f4]],sock:[.033,.019,13]}
};

// Map each seam station to a triangle on the same UV grid used to cut the
// apron. Keep barycentric weights for both skirt morphs and runtime leg fit.
function dressMap(g){
  const uv=g.attributes.uv;
  let columns=1;
  while(columns<uv.count&&uv.getY(columns)===uv.getY(0))columns++;
  const rows=uv.count/columns;
  return (u,v)=>{
    const x=T.MathUtils.clamp(u,0,1)*(columns-1),y=T.MathUtils.clamp(v,0,1)*(rows-1);
    const col=Math.min(Math.floor(x),columns-2),row=Math.min(Math.floor(y),rows-2);
    const i=row*columns+col,dx=x-col,dy=y-row;
    return dx+dy<=1?[[i,i+1,i+columns],[1-dx-dy,dx,dy]]:
      [[i+columns+1,i+columns,i+1],[dx+dy-1,1-dx,1-dy]];
  };
}
function sample(attribute,indices,weights,out){
  const a=attribute.array;
  for(let k=0;k<3;k++){
    out[k]=a[indices[0]*3+k]*weights[0]+a[indices[1]*3+k]*weights[1]+a[indices[2]*3+k]*weights[2];
  }
}

export function fitLowerLace({type,garment,restPosition,parent,knees,group,lace}){
  const d=styles[type];
  if(!d)return null;
  const base=garment.geometry;
  const place=dressMap(base),seams=[],materials=new Map();
  function cloth(color){
    if(!materials.has(color))materials.set(color,new T.MeshPhysicalMaterial({
      color,side:T.DoubleSide,roughness:.88,sheen:.4,sheenColor:0xe5d7e6}));
    return materials.get(color);
  }
  function sew(name,stations,width,scallops,color,apron=false){
    const count=stations.length,levels=8,position=[],index=[],weights=[],normals=[];
    const indices=[],bary=[],p=[0,0,0],rest=[],morph=[[],[]];
    for(let i=0;i<count;i++){
      const {u,v,dx,dy}=stations[i],map=place(u,v),a=(u-.5)*2*Math.PI;
      const normal=[Math.sin(a),0,Math.cos(a)];
      sample(restPosition,...map,p);indices.push(map[0]);bary.push(map[1]);rest.push(...p);
      const displacement=base.morphAttributes.position.map(attr=>{
        const d=[0,0,0];sample(attr,...map,d);return d;
      });
      const phase=i/count*scallops*Math.PI*2;
      const lobe=.5+.5*Math.cos(phase),fold=.5+.5*Math.cos(phase+.80);
      for(let j=0;j<=levels;j++){
        const t=j/levels,extent=width*t*(.68+.32*lobe);
        const stand=(apron?.0016:.003)+width*(.12+.33*fold)*t;
        const panel=apron?1:0;
        position.push(p[0]*(1+.043*panel)+normal[0]*stand+dx*extent,
          p[1]+dy*extent,p[2]*(1+.053*panel)+.001*panel+normal[2]*stand);
        normals.push(...normal);
        for(let m=0;m<2;m++)morph[m].push(...displacement[m]);
        weights.push(t*t);
        if(j===levels)continue;
        // A loop of openwork follows each scallop; its inner and outer hems
        // are continuous cloth. Holes are actual openings in the triangulation.
        if(j>=4&&j<=5&&Math.cos(phase)>.46)continue;
        const h=i*(levels+1)+j,n=((i+1)%count)*(levels+1)+j;
        index.push(h,h+1,n,h+1,n+1,n);
      }
    }
    // Give both sides and the eyelets a stitched thickness. Each back vertex
    // has the same pose and pinned weight as its matching front vertex.
    const vertices=position.length/3,faces=index.slice(),edges=new Map();
    for(let i=0;i<vertices;i++){
      for(let k=0;k<3;k++)position.push(position[i*3+k]-.0012*normals[i*3+k]);
      weights.push(weights[i]);
      for(const attr of morph)attr.push(attr[i*3],attr[i*3+1],attr[i*3+2]);
    }
    for(let i=0;i<faces.length;i+=3){
      const [a,b,c]=[faces[i],faces[i+1],faces[i+2]];
      index.push(a+vertices,c+vertices,b+vertices);
      for(const [j,k] of [[a,b],[b,c],[c,a]]){
        const key=Math.min(j,k)*vertices+Math.max(j,k);
        if(edges.has(key))edges.delete(key);else edges.set(key,[j,k]);
      }
    }
    for(const [a,b] of edges.values())index.push(b,a,a+vertices,b,a+vertices,b+vertices);
    const g=new T.BufferGeometry();
    g.setAttribute("position",new T.Float32BufferAttribute(position,3));
    g.setIndex(index);g.computeVertexNormals();
    g.morphTargetsRelative=true;
    g.morphAttributes.position=morph.map(m=>new T.Float32BufferAttribute(m,3));
    const mesh=new T.Mesh(g,cloth(color));mesh.name=name;
    mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.followsSkirt=true;parent.add(mesh);
    // The two fabric faces should move together; outward lift on the reverse
    // face follows the same radial vector instead of collapsing the thickness.
    lace.registerLace(mesh,weights,{driver:parent,anchor:[0,rest[1],0],
      normal:i=>normals.slice((i%vertices)*3,(i%vertices)*3+3),maxTravel:width*.22});
    seams.push({mesh,indices,bary,rest,local:Float32Array.from(position),stride:levels+1});
  }
  const pos=base.attributes.position;
  for(const [name,v,width,lobes,color] of d.hems){
    const stations=Array.from({length:lobes*10},(_,i)=>({u:i/(lobes*10),v,dx:0,dy:-1}));
    sew(name,stations,width,lobes,color);
  }
  if(d.apron){
    // Register to the garment breakdown's actual asymmetric UV footprint.
    // The hem follows the embroidered panel, including its tapered lower half.
    const edge=[],outline=[
      [.38,.372,.594],[.42,.352,.612],[.48,.350,.609],[.54,.372,.594],
      [.58,.375,.584],[.62,.390,.568],[.66,.411,.563],[.69,.419,.550],
      [.72,.435,.535],[.75,.454,.519],[.773,.479,.497],[.782,.489,.489]
    ];
    const loop=[...outline.map(([v,l])=>[l,v]),
      ...outline.slice(0,-1).reverse().map(([v,,r])=>[r,v])];
    const curve=new T.CurvePath();
    for(let i=0;i<loop.length;i++){
      const [u,v]=loop[i],[nextU,nextV]=loop[(i+1)%loop.length];
      curve.add(new T.LineCurve3(new T.Vector3(u,v,0),new T.Vector3(nextU,nextV,0)));
    }
    for(let i=0;i<280;i++){
      const t=i/280,p=curve.getPointAt(t),tangent=curve.getTangentAt(t);
      const across=new T.Vector2(-tangent.y,-tangent.x).normalize();
      edge.push({u:p.x,v:p.y,dx:across.x,dy:across.y});
    }
    sew("鲸纹围裙花瓣镶边",edge,.0145,32,0xffecdb,true);
  }
  if(d.sock){
    const [width,lip,lobes]=d.sock;
    for(const knee of knees){
      const leg=knee.parent;
      // The short sock has its own turned rim above the shoe, attached to the shin.
      const frames=Array.from({length:lobes*8},(_,i)=>{
        const a=2*Math.PI*i/(lobes*8),x=Math.cos(a),z=Math.sin(a);
        return {root:[.057*x,-.082,.001+.053*z],
          hem:[(.057+lip)*x,-.082+width,.001+(.053+lip)*z],normal:[x,0,z]};
      });
      const sock=lace.addLace(group(knee),leg.name.endsWith("L")?"左袜口花边":"右袜口花边",frames,
        {closed:true,color:0xfff1e8,scallops:lobes,driver:knee,maxTravel:lip*.24,
          eyelets:type!=="sleep"&&type!=="winter"});
      sock.castShadow=true;
    }
  }
  let fittedVersion=-1;
  return {
    followPose(){
      const update=base.attributes.position.version!==fittedVersion;
      const p=[0,0,0];
      for(const {mesh,indices,bary,local,rest,stride} of seams){
        mesh.morphTargetInfluences[0]=garment.morphTargetInfluences[0];
        mesh.morphTargetInfluences[1]=garment.morphTargetInfluences[1];
        if(!update)continue;
        const out=mesh.geometry.attributes.position;
        for(let i=0;i<indices.length;i++){
          sample(pos,indices[i],bary[i],p);
          const j=i*3,dx=p[0]-rest[j],dy=p[1]-rest[j+1],dz=p[2]-rest[j+2];
          for(const offset of [0,indices.length*stride])
            for(let k=offset+i*stride;k<offset+(i+1)*stride;k++){
              const off=k*3;out.setXYZ(k,local[off]+dx,local[off+1]+dy,local[off+2]+dz);
            }
        }
        out.needsUpdate=true;
      }
      fittedVersion=base.attributes.position.version;
    },
    dispose(){for(const {mesh} of seams){mesh.removeFromParent();mesh.geometry.dispose();}
      for(const mat of materials.values())mat.dispose();}
  };
}
