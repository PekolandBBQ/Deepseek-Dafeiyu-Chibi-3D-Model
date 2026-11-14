import {build} from "esbuild";
import {mkdir,copyFile,writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {join} from "node:path";

export const root=fileURLToPath(new URL("../",import.meta.url));
export const dist=join(root,"dist");
export async function buildSite(){
  await mkdir(dist,{recursive:true});
  await build({absWorkingDir:root,entryPoints:{app:"src/app.mjs",studio:"tools/studio.mjs"},
    outdir:dist,bundle:true,format:"esm",splitting:true,minify:true,chunkNames:"chunks/[name]-[hash]",target:"es2022"});
  await copyFile(join(root,"index.html"),join(dist,"index.html"));
  await writeFile(join(dist,"studio.html"),'<meta charset="utf-8"><script type="module" src="./studio.js"></script>');
}
if(process.argv[1]===fileURLToPath(import.meta.url))await buildSite();
