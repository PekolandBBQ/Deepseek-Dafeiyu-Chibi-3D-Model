import * as T from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {EffectComposer} from "three/addons/postprocessing/EffectComposer.js";
import {RenderPass} from "three/addons/postprocessing/RenderPass.js";
import {GTAOPass} from "three/addons/postprocessing/GTAOPass.js";
import {OutputPass} from "three/addons/postprocessing/OutputPass.js";
import "../src/panels/home-room-3d.source.js";
import {readDemoState} from "../src/demo-state.mjs";

function renderer(exposure) {
  const r = new T.WebGLRenderer({antialias:true, preserveDrawingBuffer:true});
  r.outputColorSpace = T.SRGBColorSpace;
  r.toneMapping = T.ACESFilmicToneMapping;
  r.toneMappingExposure = exposure;
  r.shadowMap.enabled = true;
  r.shadowMap.type = T.PCFSoftShadowMap;
  return r;
}

async function indoorStudio() {
  const r = renderer(1.03);
  r.setSize(1800,1200);
  const scene = new T.Scene();
  scene.background = new T.Color("#ded9cc");
  const interior = (await new GLTFLoader().loadAsync("/room.glb")).scene;
  interior.traverse(n => {
    if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; }
    if (n.isLight) n.visible = false;
  });
  const sun = new T.DirectionalLight("#fff0da",2.8);
  sun.position.set(-5.8,12.5,9);
  sun.target.position.set(0,0,.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(3072,3072);
  Object.assign(sun.shadow.camera,{left:-10,right:10,top:10,bottom:-10,near:.1,far:36});
  Object.assign(sun.shadow,{bias:-.00023,normalBias:.016,radius:3});
  const fill = new T.DirectionalLight("#dbeaff",.8);
  fill.position.set(8.6,7,2);
  const floor = new T.Mesh(new T.PlaneGeometry(230,230),
    new T.MeshStandardMaterial({color:"#d8d3c9",roughness:1}));
  floor.rotation.x = -Math.PI/2;
  floor.position.y = -.72;
  floor.receiveShadow = true;
  scene.add(interior, floor, sun, sun.target, fill, new T.HemisphereLight("#fff9f0","#b5a68b",1.7));
  const camera = new T.PerspectiveCamera(36,1.5,.025,170);
  const target = new T.WebGLRenderTarget(1800,1200,{type:T.HalfFloatType,samples:4});
  const composer = new EffectComposer(r,target);
  composer.addPass(new RenderPass(scene,camera));
  const ao = new GTAOPass(scene,camera,1800,1200);
  ao.updateGtaoMaterial({radius:.31,thickness:.57,scale:1,distanceFallOff:.6});
  ao.blendIntensity = .52;
  composer.addPass(ao);
  composer.addPass(new OutputPass());
  return ({eye,aim,fov}) => {
    camera.position.fromArray(eye);
    camera.lookAt(...aim);
    camera.fov = fov;
    camera.updateProjectionMatrix();
    composer.render();
    return r.domElement.toDataURL("image/webp",.93).split(",")[1];
  };
}

function panoramaStudio() {
  const holder = document.body.appendChild(document.createElement("div"));
  holder.style.cssText = "width:700px;height:480px;position:absolute;visibility:hidden";
  const room = window.PrivateCompanionHomeRoom3D.mount(holder,{exportOnly:true});
  const r = renderer(1.14);
  const state = {...readDemoState("page/yard"),epoch:Date.UTC(2026,10,15,4)/1000,
    replay:true,weather:{condition:"clear"}};
  return async ({eye,aim,up=[0,1,0],fov,w,h,phase="day",fog=1}) => {
    const s = {...state,phase,lamp_lit:phase==="dusk"};
    await room.showSharedYard(s,"");
    const [first] = await room.sceneRoots("room",s);
    const scene = first.parent;
    const stock = scene.children.find(n=>n.name==="resident");
    if (stock) stock.visible=false;
    const camera = new T.PerspectiveCamera(fov,w/h,.14,160);
    camera.position.fromArray(eye);
    camera.up.fromArray(up);
    camera.lookAt(...aim);
    r.setSize(w,h);
    if (scene.fog) { scene.fog.near *= fog; scene.fog.far *= fog; }
    r.render(scene,camera);
    return r.domElement.toDataURL("image/png").split(",")[1];
  };
}

const indoors = location.search === "?interior";
window.photograph = indoors ? await indoorStudio() : panoramaStudio();
