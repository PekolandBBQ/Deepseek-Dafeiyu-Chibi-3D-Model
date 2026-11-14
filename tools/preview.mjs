import {buildSite} from "./build.mjs";
import {serve} from "./serve.mjs";
await buildSite();
const site=await serve(Number(process.env.PORT||4173));
console.log("小屋预览",site.url);
for(const signal of ["SIGINT","SIGTERM"])process.once(signal,async()=>{await site.close();});
