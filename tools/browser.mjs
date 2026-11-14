import {chromium} from "playwright";
import {buildSite} from "./build.mjs";
import {serve} from "./serve.mjs";

export async function runBrowser(work){
  await buildSite();
  const site=await serve();
  let browser;
  try{
    browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||undefined,args:["--enable-unsafe-swiftshader"]});
    const page=await browser.newPage({viewport:{width:1100,height:780}});
    await work(page,site.url);
  }finally{
    await browser?.close();
    await site.close();
  }
}
