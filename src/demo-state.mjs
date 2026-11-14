export const looks=["蓝鲸女仆","深蓝报刊装","海风日记·夏日水手服","深海星愿·特别礼服","蓝白水手常服","海雾冬装","睡衣","鲸鱼伞雨衣"];
export const actions={idle:"休息",read:"读书",paint:"画画",write:"写字",sleep:"小憩",contact:"挥手",yard:"小院散步"};
let outfit=looks[0],action="idle",since=Date.now()/1000;
export function selectDemo(nextOutfit,nextAction){
  if(!looks.includes(nextOutfit)||!Object.hasOwn(actions,nextAction))return;
  outfit=nextOutfit;action=nextAction;since=Date.now()/1000;
  window.dispatchEvent(new Event("demo-change"));
}
function petRoute(x,z){
  return {period:24,routes:[[[0,x,0,z,"idle","草坪"],[5,x,0,z,"walk","草坪"],
    [12,x+1.2,0,z+.7,"idle","草坪"],[17,x+1.2,0,z+.7,"walk","草坪"],[24,x,0,z,"idle","草坪"]]]};
}
const petRoutes={cat:petRoute(15,8.5),dog:petRoute(13,7.7)};
export function readDemoState(key,{day}={}){
  const now=Date.now()/1000;
  if(key==="page/yard")return {epoch:now,phase:"day",season:"秋",house_furnished:true,hearth_lit:true,
    places:["树下","长椅","小径","壁炉","餐桌"],wall:[],pet_events:[],pet_routes:petRoutes,
    presence:action==="yard"?{place:"小径"}:null,weather:{state:"unavailable"}};
  if(key!=="page/trajectory")throw Error("Unknown demo data");
  const start=Date.parse(day+"T00:00:00+08:00")/1000;
  const cursor=Math.max(start,Math.min(now,start+86399)),begin=Math.min(cursor-.05,Math.max(start,since));
  const event={kind:action,title:actions[action],place:action==="yard"?"小径":"小屋",start:begin,end:cursor,ongoing:true};
  return {day,from:start,through:cursor,events:[event],outfit:{name:outfit,selected:outfit!==looks[0]},
    outfitChanges:[[start,outfit]],yard:[],wall:[],petEvents:[],petRoutes,light:[[start,"day"]],season:"秋"};
}
