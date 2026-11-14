import {mkdir,writeFile,rename} from "node:fs/promises";
import {join} from "node:path";
import {root} from "./build.mjs";
import {runBrowser} from "./browser.mjs";

const args=process.argv.slice(2),valid=["models","mirror","scenes","wardrobe"];
if(args.some(a=>!valid.includes(a)))throw Error("可选参数 models、mirror、scenes、wardrobe");
const enabled=key=>args.length===0||args.includes(key);
async function replace(name,data){
  const target=join(root,"assets",name),tmp=target+"."+process.pid+".tmp";
  await writeFile(tmp,data);await rename(tmp,target);
}
await runBrowser(async(page,url)=>{
  await page.goto(url+"/studio.html");await page.waitForFunction(()=>window.modelFile&&window.studio);
  if(enabled("models"))for(const [body,name] of [[false,"大肥鱼.glb"],[true,"大肥鱼-基础身体.glb"]]){
    const blob=Buffer.from(await page.evaluate(body=>window.modelFile({bodyOnly:body}),body),"base64");
    if(blob.toString("ascii",0,4)!=="glTF")throw Error("无效 GLB");
    await replace(name,blob);console.log(name,blob.length);
  }
  if(enabled("mirror")){
    const images={};
    for(const name of await page.evaluate(()=>studio.names)){
      images[name]=await page.evaluate(async n=>(await studio.frame(n)).picture,name);
    }
    await replace("mirror-portraits.json",JSON.stringify(images));console.log("镜像",Object.keys(images).length);
  }
  if(enabled("scenes"))for(const [part,name] of [["room","小屋室内.glb"],["yard","篱下小院.glb"]]){
    const bytes=Buffer.from(await page.evaluate(key=>window.sceneFile(key),part),"base64");
    if(bytes.toString("ascii",0,4)!=="glTF")throw Error("场景导出失败");
    await replace(name,bytes);console.log(name,bytes.length);
  }
  if(args.includes("wardrobe")){
    await mkdir(join(root,"assets","release"),{recursive:true});
    const keys=["maid","press","summer","star","sailor","winter","sleep","rain"];
    const outfits=await page.evaluate(()=>studio.names);
    for(const [index,key] of ["base",...keys].entries()){
      const options=index===0?{bodyOnly:true}:{outfit:outfits[index-1]};
      const bytes=Buffer.from(await page.evaluate(o=>window.modelFile(o),options),"base64");
      await replace(join("release","dafeiyu-"+key+".glb"),bytes);console.log(key,bytes.length);
    }
  }
});
