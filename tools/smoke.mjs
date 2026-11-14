import assert from "node:assert/strict";
import {runBrowser} from "./browser.mjs";
await runBrowser(async(page,url)=>{
  const errors=[];page.on("pageerror",e=>errors.push(String(e)));
  await page.goto(url);
  await page.waitForSelector('[data-resident-art="toon-3d"]');
  const looks=await page.locator("#outfit option").allTextContents();
  assert.equal(looks.length,8);
  await page.selectOption("#outfit","睡衣");
  await page.getByRole("button",{name:"照镜子"}).click();
  await page.waitForFunction(()=>document.querySelector("dialog[open] img")?.naturalWidth>0);
  assert.match(await page.locator("dialog[open]").innerText(),/睡衣/);
  await page.getByRole("button",{name:"收起镜子"}).click();
  await page.getByRole("button",{name:"看小院",exact:true}).click();
  await page.getByLabel("看看院里的哪一处").selectOption("小猫");
  await page.goto(url+"/studio.html");
  for(const name of looks){
    const n=await page.evaluate(async name=>(await studio.frame(name)).visibleTriangles,name);
    assert(n>0);
  }
  assert.deepEqual(errors,[]);
  console.log("小屋、院落、穿衣镜和八套服装通过");
});
