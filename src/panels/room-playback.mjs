import {readDemoState} from "../demo-state.mjs";
const tz="Asia/Shanghai";
const timeLabel=t=>new Date(t*1000).toLocaleTimeString("zh-CN",{timeZone:tz,hour12:false,hour:"2-digit",minute:"2-digit",second:"2-digit"});
const today=()=>new Intl.DateTimeFormat("sv-SE",{timeZone:tz}).format(new Date());

function replaySun(track,time){
  if(!track?.length)return null;
  let i=track.findIndex(p=>p[0]>=time);if(i<0)i=track.length-1;
  const a=track[Math.max(0,i-1)],b=track[i],f=b[0]===a[0]?0:(time-a[0])/(b[0]-a[0]);
  const direction=a.slice(1).map((v,j)=>v+(b[j+1]-v)*f);
  return {direction,elevation:Math.asin(Math.max(-1,Math.min(1,direction[1])))*180/Math.PI};
}

export function playbackBar(container,show,focus,openMirror){
  const panel=document.createElement("section");
  panel.setAttribute("aria-label","大肥鱼的生活轨迹");
  panel.style.cssText="position:absolute;left:10px;bottom:38px;z-index:8;width:min(345px,calc(100% - 24px));padding:7px 10px;border-radius:12px;background:#fff5e9ed;color:#493b40;font:13px system-ui;box-shadow:0 2px 12px #47302530";
  panel.innerHTML='<div style="display:flex;gap:8px;align-items:center"><button data-mode type="button">生活回放</button><button data-focus type="button">看大肥鱼</button><button data-mirror type="button">照镜子</button><b data-time></b></div><div data-tools hidden><input type="date" aria-label="轨迹日期"><input type="range" aria-label="回放时间" style="width:100%" step=".001"><div style="display:flex;gap:7px"><button data-prev type="button">上一段</button><button data-play type="button">播放</button><button data-next type="button">下一段</button></div></div><div data-label style="margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></div>';
  container.append(panel);
  const q=s=>panel.querySelector(s), mode=q("[data-mode]"), tools=q("[data-tools]"), date=q('[type=date]'), slider=q('[type=range]'), label=q("[data-label]"), play=q("[data-play]");
  const marks=document.createElement("canvas"); marks.width=700;marks.height=10;
  marks.style.cssText="display:block;width:100%;height:5px;margin:6px 0 0;border-radius:2px;background:#e1ddd2";
  marks.setAttribute("aria-label","当天有记录的时段");tools.insertBefore(marks,slider);
  function drawMarks(rows,start,end){
    const ctx=marks.getContext("2d");ctx.clearRect(0,0,marks.width,10);
    const unit=marks.width/Math.max(1,end-start);
    for(const e of rows){
      ctx.fillStyle=e.kind==="sleep"?"#6e77a5":e.kind==="read"?"#b48050":"#477f72";
      ctx.fillRect((e.start-start)*unit,0,Math.max(2,(e.end-e.start)*unit),10);
    }
  }
  let data=null,live=true,playing=false,step=0,closed=false,ticket=0,pin=null,cursor=0;
  date.value=today();date.max=today();
  const stop=()=>{playing=false;play.textContent="播放";};
  function at(t){
    if(pin && pin.start===t)return pin;
    return data.events.filter(e=>e.point?Math.abs(t-e.start)<.001:e.start<=t&&(t<e.end||(e.ongoing&&t===e.end))).at(-1);
  }
  function render(){
    if(!data)return;
    cursor=live?data.through:Math.max(data.from,Math.min(cursor,data.through));
    const e=at(cursor);
    slider.value=String(cursor-data.from);
    q("[data-time]").textContent=(live?"实时 ":"回放 ")+timeLabel(cursor);
    label.textContent=e?e.title+(e.point?" · 动作回执":""):"这段时间没有活动记录";
    if(live&&!e&&data.events.length){
      const recent=data.events.reduce((a,b)=>a.end>b.end?a:b);
      label.textContent="暂无进行中的活动 · 最近 "+timeLabel(recent.end)+" "+recent.title;
    }
    label.title=label.textContent;
    const recent=data.yard?.filter(row=>row[0]<=cursor&&row[0]>cursor-600)||[];
    const moves=recent.map(row=>row[2]);
    const fire=data.hearthChanges?.filter(([at])=>at<=cursor&&at>cursor-data.hearthBurnSeconds).at(-1);
    const historical=live?null:{
      epoch:cursor,replay:true,sun:replaySun(data.solar,cursor),pet_routes:data.petRoutes,pet_events:data.petEvents,
      house_furnished:cursor>=data.furnishedAt,hearth_lit:!!fire&&fire[1]!=="熄火",
      season:data.season,phase:data.light?.filter(row=>row[0]<=cursor).at(-1)?.[1]||"day",
      swing_moving:moves.includes("荡秋千"),dog_nearby:moves.includes("陪小狗"),cat_on_frame:moves.includes("看猫爬架"),
      watered:data.yard?.some(row=>row[0]>=data.from&&row[0]<=cursor&&row[2]==="浇花"),
      wall:(data.wall||[]).filter(p=>p.hung<=cursor&&(p.removed===null||cursor<p.removed)),
      bench_book:(data.benchBook||[]).filter(row=>row[0]<=cursor).at(-1)?.[1]||false,
      weather:(data.weather||[]).filter(([at,end])=>at<=cursor&&cursor<end).at(-1)?.[2]||{state:"unavailable"},presence:null};
    const latest=data.events.at(-1);
    const petAct=(data.petEvents||[]).filter(p=>p.start<=cursor&&cursor<p.start+p.release).at(-1);
    const atTime=(data.outfitChanges||[]).filter(([at])=>at<=cursor).at(-1);
    const outfit=live?data.outfit:{name:atTime?.[1]||"蓝鲸女仆",selected:!!atTime};
    show(e||null,{live,playing,cursor,day:data.day,outfit,known:true,historical,petAct,petEvents:data.petEvents,lastWalkPosition:latest?.arrived?latest.route.at(-1):null,
      poseTime:e?Math.max(0,cursor-e.start)+(playing&&e.point?step*.5:0):0});
  }
  async function read(reset=false){
    const seq=++ticket,day=live?today():date.value;
    if(!day)return;
    try{
      const raw=readDemoState("page/trajectory",{day});
      if(closed||seq!==ticket)return;
      const next=raw?.data?.data||raw?.data||raw;
      if(next.day!==day||!Array.isArray(next.events))throw Error();
      data=next;date.max=today();slider.min="0";slider.max=String(next.through-next.from);
      drawMarks(next.events,next.from,next.through);
      if(reset){cursor=next.events[0]?.start??next.from;pin=next.events[0]||null;}
      render();
    }catch{if(!closed&&seq===ticket){stop();data=null;show(null,{live,known:false});label.textContent="暂时读不到活动记录";}}
  }
  function jump(direction){
    if(!data)return;
    const ordered=direction>0?data.events:[...data.events].reverse();
    const target=ordered.find(e=>direction>0?e.start>cursor+.0001:e.start<cursor-.0001);
    if(target){pin=target;cursor=target.start;render();}
    else stop();
  }
  mode.onclick=()=>{
    live=!live;stop();pin=null;tools.hidden=live;mode.textContent=live?"生活回放":"回到实时";
    date.value=today();read(!live);
  };
  q("[data-focus]").onclick=focus;
  q("[data-mirror]").onclick=async()=>{await read();if(!closed)openMirror();};
  date.onchange=()=>{stop();pin=null;read(true);};
  slider.oninput=()=>{if(!data)return;stop();pin=null;cursor=data.from+Number(slider.value);render();};
  q("[data-prev]").onclick=()=>{stop();jump(-1);};
  q("[data-next]").onclick=()=>{stop();jump(1);};
  play.onclick=()=>{if(!data)return;playing=!playing;step=0;play.textContent=playing?"暂停":"播放";render();};
  const tick=setInterval(()=>{
    if(closed||document.hidden)return;
    if(!playing||!data)return;
    const event=at(cursor);
    if(event && (event.point||event.end-event.start<2) && step<4){step++;render();return;}
    if(!event||event.point||(step>=8&&event.kind!=="walk")||cursor+.5>=event.end){jump(1);step=0;}
    else{pin=null;cursor+=.5;step++;render();}
  },500);
  const poll=setInterval(()=>{if(live&&!document.hidden)read();},5000);
  const refresh=()=>{live=true;stop();pin=null;tools.hidden=true;mode.textContent="生活回放";read();};
  window.addEventListener("demo-change",refresh);
  read();
  return ()=>{window.removeEventListener("demo-change",refresh);closed=true;clearInterval(poll);clearInterval(tick);panel.remove();};
}
