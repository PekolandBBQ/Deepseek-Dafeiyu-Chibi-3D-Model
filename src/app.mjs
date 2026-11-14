import "./panels/home-room-3d.source.js";
import {looks,actions,selectDemo} from "./demo-state.mjs";

const room=document.querySelector("#room");
const outfit=document.querySelector("#outfit"),action=document.querySelector("#action");
for(const name of looks)outfit.add(new Option(name,name));
for(const [key,label] of Object.entries(actions))action.add(new Option(label,key));
const view=window.PrivateCompanionHomeRoom3D.mount(room,{observer:true});
view.setActive(true);
const update=()=>selectDemo(outfit.value,action.value);
outfit.onchange=action.onchange=update;
document.addEventListener("visibilitychange",()=>view.setActive(!document.hidden));
window.addEventListener("pagehide",()=>view.dispose(),{once:true});
