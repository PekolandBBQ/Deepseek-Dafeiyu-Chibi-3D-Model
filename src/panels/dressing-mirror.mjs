import * as T from "three";
import portraits from "../../assets/mirror-portraits.json";

export function dressingMirror(parent,container,refresh){
  const group=new T.Group();
  group.name="衣柜穿衣镜";group.position.set(-.647,1.86,.105);parent.add(group);
  const materials=[],shapes=[];
  function panel(width,height,r,z,mat){
    const shape=new T.Shape(),x=-width/2,y=-height/2;
    shape.moveTo(x+r,y);shape.lineTo(-x-r,y);shape.quadraticCurveTo(-x,y,-x,y+r);
    shape.lineTo(-x,-y-r);shape.quadraticCurveTo(-x,-y,-x-r,-y);shape.lineTo(x+r,-y);
    shape.quadraticCurveTo(x,-y,x,-y-r);shape.lineTo(x,y+r);shape.quadraticCurveTo(x,y,x+r,y);
    const g=new T.ShapeGeometry(shape,18),p=g.attributes.position,uv=g.attributes.uv;
    for(let i=0;i<p.count;i++)uv.setXY(i,p.getX(i)/width+.5,p.getY(i)/height+.5);
    const mesh=new T.Mesh(g,mat);mesh.position.z=z;group.add(mesh);materials.push(mat);shapes.push(g);
    return mesh;
  }
  panel(1.07,2.46,.34,0,new T.MeshStandardMaterial({color:0x554958,roughness:.40}));
  panel(1.026,2.408,.328,.006,new T.MeshStandardMaterial({color:0xcead7b,metalness:.43,roughness:.37}));
  const glass=new T.MeshBasicMaterial({color:0xdbe4ea});
  const pane=panel(.95,2.31,.303,.012,glass);
  const loader=new T.TextureLoader(),cache=new Map();
  let outfit="",day="",disposed=false,source="";
  const dialog=document.createElement("dialog");
  dialog.setAttribute("aria-label","穿衣镜");
  dialog.style.cssText="border:1px solid #b8a483;border-radius:24px;background:#f6f2ec;color:#383749;padding:12px;max-width:90vw;";
  const img=new Image();img.style.cssText="display:block;height:min(62vh,580px);max-width:80vw;object-fit:contain;margin:auto;border-radius:16px";
  const caption=document.createElement("p"),close=document.createElement("button");
  caption.style.cssText="margin:8px 0;text-align:center";close.textContent="收起镜子";close.type="button";
  close.onclick=()=>dialog.close();dialog.append(img,caption,close);container.append(dialog);
  function set(state,localDay){
    const name=state?.name||"",valid=Object.hasOwn(portraits,name);
    day=localDay||"";source=state?.selected?"当天选择":"默认形象";
    const description=valid?day+" · "+name+" · "+source:name?"这套衣服还没有三维镜像":"暂时读不到当天穿着";
    caption.textContent=description;img.alt=valid?name+"的镜中全身像":"";
    img.hidden=!valid;img.style.display=valid?"block":"none";
    if(name===outfit)return;
    outfit=name;glass.map=null;glass.needsUpdate=true;
    if(!valid){img.removeAttribute("src");return;}
    img.src=portraits[name];
    if(!cache.has(name))cache.set(name,loader.loadAsync(portraits[name]).then(map=>{
      map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;
      // Use the portrait's full width and extend the glass at top and bottom.
      const scale=(2.31/.95)/(752/560);map.repeat.y=scale;map.offset.y=(1-scale)/2;
      return map;
    }));
    return cache.get(name).then(map=>{if(!disposed&&outfit===name){glass.map=map;glass.color.setHex(0xffffff);glass.needsUpdate=true;refresh();}})
      .catch(()=>{cache.delete(name);if(!disposed&&outfit===name){outfit="";caption.textContent="镜面载入失败，请再照一次";}});
  }
  return {pane,set,open(){if(!dialog.open)dialog.showModal();},
    dispose(){disposed=true;dialog.remove();group.removeFromParent();for(const g of shapes)g.dispose();
      for(const m of materials)m.dispose();for(const pending of cache.values())pending.then(t=>t.dispose(),()=>{});}};
}
