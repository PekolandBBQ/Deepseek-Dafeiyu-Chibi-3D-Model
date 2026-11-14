# 大肥鱼的小屋

可以在浏览器中走近大肥鱼的书桌、衣柜、床边和院子，切换八套衣服，查看穿衣镜，或单独导出带骨架的角色。独立预览使用本地生成的示范动作和猫狗路径。屏幕上的动作记录只在本次预览中存在。

## 资产图集

[360° 全景](#360-全景) · [小屋室内](#小屋室内) · [篱下小院](#篱下小院) · [大肥鱼的衣柜](#大肥鱼的衣柜) · [模型下载](https://github.com/PekolandBBQ/dafeiyu-cottage-3d/releases/tag/v1.0.0)

[![黄昏时的全景，篱灯沿院墙亮起，石径从篱门通往小屋](previews/panoramas/cottage-at-dusk.webp)](previews/panoramas/cottage-at-dusk.webp)

从篱门往里看，左侧是小屋，右侧是鱼池和枫树下的餐桌。

### 360° 全景

两张图分别从屋内地毯旁和院中石径取景。原图均为 4096 × 2048 的等距柱状投影，可在支持这种格式的全景查看器中环视。

**站在小屋里**

[![屋内的球面展开图，从阅读椅、窗边书桌一直转到衣柜、床和壁炉](previews/panoramas/room-360.webp)](previews/panoramas/room-360.webp)

**站在院中石径上**

[![院内的球面展开图，可见小屋侧面、石池、枫树、篱门和花墙](previews/panoramas/garden-360.webp)](previews/panoramas/garden-360.webp)

### 小屋室内

[![小屋剖面全景，书架和窗边书桌位于左后方，衣柜毗邻床铺，前方摆有棋桌和相机](previews/interior/room-overview.webp)](previews/interior/room-overview.webp)

| 窗边书桌 | 阅读角 |
| --- | --- |
| [![窗台旁摊开的书、笔筒和木抽屉](previews/interior/window-desk.webp)](previews/interior/window-desk.webp) | [![木扶手椅、书架、落地灯和茶杯](previews/interior/reading-corner.webp)](previews/interior/reading-corner.webp) |

| 衣柜穿衣镜 | 床头 |
| --- | --- |
| [![柜门上的穿衣镜里显示蓝鲸女仆默认穿搭](previews/interior/wardrobe-mirror.webp)](previews/interior/wardrobe-mirror.webp) | [![薄荷绿格纹床被、木床头和床头灯](previews/interior/bedside.webp)](previews/interior/bedside.webp) |

### 篱下小院

[![庭院俯视，池塘周围是宠物小窝、枫树、花篱和石板小路](previews/yard/overview.webp)](previews/yard/overview.webp)

| 枫树下的餐桌 | 金鱼池 |
| --- | --- |
| [![树下铺着条纹桌布，桌上放着蒸笼、热汤面和饭菜](previews/yard/maple-table.webp)](previews/yard/maple-table.webp) | [![假山石洞旁的两尾金鱼与鹅卵石池沿](previews/yard/pond.webp)](previews/yard/pond.webp) |

| 长椅旁的猫和狗 | 牵牛花篱门 |
| --- | --- |
| [![灰猫和棕犬站在木长椅前的草坪上](previews/yard/cat-and-dog.webp)](previews/yard/cat-and-dog.webp) | [![木篱门两侧的牵牛花和穿门而过的石板路](previews/yard/gate.webp)](previews/yard/gate.webp) |

### 大肥鱼的衣柜

[![八套穿搭的全身像：蓝鲸女仆、深蓝报刊装、夏日水手服、特别礼服、蓝白水手常服、海雾冬装、睡衣和鲸鱼伞雨衣](previews/wardrobe/outfits.webp)](previews/wardrobe/outfits.webp)

**海风日记 · 夏日水手服**

[![夏日装的斜前全身像、镂孔草帽边、鲸鱼挎包和双层裙摆](previews/wardrobe/summer-details.webp)](previews/wardrobe/summer-details.webp)

**蓝鲸女仆**

[![设定图与三维近景对照，可见腕带上方的蓬袖和袖口蕾丝的侧面轮廓](previews/maid-sleeves.webp)](previews/maid-sleeves.webp)

**走动与收步**

[![蓝鲸女仆走动、停步时，肩带和袖口蕾丝随动作摆动并回稳](previews/maid-walk.webp)](previews/maid-walk.webp)

## 本地预览

使用 Node.js 22 或更新版本，在仓库根目录运行下列命令。

```sh
npm ci
npm run preview
```

打开终端打印的地址。页面顶部可换装和选择动作，场景中的「照镜子」展示对应的穿着，「看小院」可以选择动物和庭院中的位置。「跟随」可以把镜头移到角色附近。拖动或滚轮可以调整镜头。

## 模型

- [大肥鱼与默认女仆装](assets/大肥鱼.glb) 和 [无服饰基础身体](assets/大肥鱼-基础身体.glb) 各含 16 段动画。身体、手臂、头发、眼睛和尾巴属于角色。衣料、穿搭配饰和蕾丝单独绑定。
- [小屋室内](assets/小屋室内.glb) 包含家具、默认装束的穿衣镜和灯光，从书桌、衣柜到床铺可按节点选择。室内体素使用 glTF 的 `EXT_mesh_gpu_instancing`，导入器需要支持该扩展。
- [篱下小院](assets/篱下小院.glb) 包含池塘和三条金鱼、猫狗、花架、枫树、秋千、餐桌与壁炉。室内和庭院 GLB 保存的是场景快照。动物路线、日照和家具交互由网页源码驱动。
- 两个场景和九个独立角色文件可在 [v1.0.0 发布页](https://github.com/PekolandBBQ/dafeiyu-cottage-3d/releases/tag/v1.0.0) 获取，也可用下方命令生成。

## 重新构建

```sh
npm run build
npx playwright install chromium
npm test
npm run export -- models
npm run export -- wardrobe
npm run export -- scenes
npm run export -- mirror
```

`build` 将静态网页写入 `dist/`。`test` 启动本地服务器和 Chromium，打开实际房间、换装、穿衣镜和庭院，并渲染全部八套穿搭。`export` 使用同一套 Three.js 源码和已安装的 Chromium。已有 Google Chrome 时，也可设置环境变量 `PLAYWRIGHT_CHANNEL=chrome`。浏览器需支持 WebGL 2。

安装上述依赖和 Chromium 后，运行 `node tools/check-rig.mjs` 可用实际角色检查蕾丝在不同帧率下的回弹、瞬移复位，以及换装时身体与饰边的分离。

| 参数 | 生成内容 |
| --- | --- |
| `models` | 默认女仆装、无服饰基础身体，写入 `assets/` |
| `wardrobe` | `assets/release/dafeiyu-{base,maid,press,summer,star,sailor,winter,sleep,rain}.glb` |
| `scenes` | 室内和院落两个独立 GLB，写入 `assets/` |
| `mirror` | 以固定镜头为八套服装重新拍摄全身像，写入 `assets/mirror-portraits.json` |

不带参数时，导出默认角色、素体、室内、庭院及八张镜像。镜像更新后再次运行 `npm run build` 即可打包新图。

`src/panels/` 包含房间、角色、服装、蕾丝动力学、院落、动物和家具的建模代码。`assets/衣柜参考图/` 保存服装设定图。`tools/bake-outfit-surfaces.py` 可用 Python、Pillow、NumPy 和 OpenCV 从这些图片重做服装表面与脸部细节。沿用桌宠动作或外观投影时，`bake-dsh-motion.py` 和 `bake-dsh-surfaces.py` 额外需要各自的原始动作视频、相应转身素材及 FFmpeg。常规网页与 GLB 构建直接读取仓库中的烘焙结果。原转身动图的尺寸、帧数及校验值见[来源说明](THIRD_PARTY_NOTICES.md)。

从原始输入重做贴图与动作时，可以按下列顺序执行。将视频目录、FFmpeg 和动图的示例路径替换为本机路径。

```sh
python -m pip install pillow numpy opencv-python
python tools/bake-dsh-surfaces.py /path/to/videos /path/to/ffmpeg /path/to/turnaround.gif assets/whale-toon-face.json
python tools/bake-dsh-motion.py /path/to/videos /path/to/ffmpeg assets/dsh-motion.json
python tools/bake-outfit-surfaces.py
npm run export -- models wardrobe scenes mirror
```

## 署名与使用

大肥鱼的形象衍生自「溟月」及女仆鲸鱼娘／DeepSeek 版本。原型作者为**上善无形**，女仆鲸鱼娘版本的设计者为 **ZipZipPipe**。该项目重新制作了三维造型、骨架、服装和动作表现，采样参考了 **merzlin** 发布的 shenshen 桌宠 4.2.1。角色形象、穿搭、贴图和角色 GLB 按 **CC BY-NC-SA 4.0** 使用，需要署名、仅限非商业用途，演绎作品采用相同许可。[上善无形](https://space.bilibili.com/4456176) · [ZipZipPipe](https://space.bilibili.com/4168597) · [作者声明](https://www.bilibili.com/opus/1247156596114456581) · [桌宠上游](https://github.com/PC2005-cloud/dsh-pet)

场景及相关项目代码按 **AGPL-3.0** 分发。原小屋项目由 **menglimi** 及贡献者开发。桌宠上游的程序代码采用 MIT，Three.js、esbuild 和 Playwright 各自保留原许可。逐项来源和获取许可条款见 [第三方说明](THIRD_PARTY_NOTICES.md)。
