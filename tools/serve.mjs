import {createServer} from "node:http";
import {readFile} from "node:fs/promises";
import {resolve,extname,sep} from "node:path";
import {dist} from "./build.mjs";

export async function serve(port=0){
  const server=createServer(async(req,res)=>{
    try{
      const route=decodeURIComponent(new URL(req.url,"http://localhost").pathname);
      const file=resolve(dist,"."+(route==="/"?"/index.html":route));
      if(!file.startsWith(resolve(dist)+sep))throw Error();
      const buffer=await readFile(file);
      const mime={".js":"text/javascript",".html":"text/html; charset=utf-8",".json":"application/json"};
      res.writeHead(200,{"Content-Type":mime[extname(file)]??"application/octet-stream"});res.end(buffer);
    }catch{res.writeHead(404);res.end();}
  });
  await new Promise((ok,fail)=>{server.once("error",fail);server.listen(port,"127.0.0.1",ok);});
  return {url:"http://127.0.0.1:"+server.address().port,close:()=>new Promise(ok=>server.close(ok))};
}
