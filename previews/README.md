# Deepseek（大肥鱼）Q版3D模型 · 资产图集

图集展示 v1.0.2 的公开三维模型。点图可查看原尺寸。[模型下载](https://github.com/PekolandBBQ/Deepseek-Dafeiyu-Chibi-3D-Model/releases/tag/v1.0.2) · [来源与许可](../THIRD_PARTY_NOTICES.md)

## 小屋与院子

[![黄昏时的全景，篱灯沿院墙亮起，石径从篱门通往小屋](panoramas/cottage-at-dusk.webp)](panoramas/cottage-at-dusk.webp)

从篱门往里看，左侧是小屋，右侧是鱼池和枫树下的餐桌。

## 360° 全景

两张图分别从屋内地毯旁和院中石径取景。原图均为 4096 × 2048 的等距柱状投影，可在支持这种格式的全景查看器中环视。

**站在小屋里**

[![屋内的球面展开图，从阅读椅、窗边书桌一直转到衣柜、床和壁炉](panoramas/room-360.webp)](panoramas/room-360.webp)

**站在院中石径上**

[![院内的球面展开图，可见小屋侧面、石池、枫树、篱门和花墙](panoramas/garden-360.webp)](panoramas/garden-360.webp)

## 小屋室内

[![小屋剖面全景，书架和窗边书桌位于左后方，衣柜毗邻床铺，前方摆有棋桌和相机](interior/room-overview.webp)](interior/room-overview.webp)

| 窗边书桌 | 阅读角 |
| --- | --- |
| [![窗台旁摊开的书、笔筒和木抽屉](interior/window-desk.webp)](interior/window-desk.webp) | [![木扶手椅、书架、落地灯和茶杯](interior/reading-corner.webp)](interior/reading-corner.webp) |

| 衣柜穿衣镜 | 床头 |
| --- | --- |
| [![柜门上的穿衣镜里显示蓝鲸女仆默认穿搭](interior/wardrobe-mirror.webp)](interior/wardrobe-mirror.webp) | [![薄荷绿格纹床被、木床头和床头灯](interior/bedside.webp)](interior/bedside.webp) |

## 篱下小院

[![庭院俯视，池塘周围是宠物小窝、枫树、花篱和石板小路](yard/overview.webp)](yard/overview.webp)

| 枫树下的餐桌 | 金鱼池 |
| --- | --- |
| [![树下铺着条纹桌布，桌上放着蒸笼、热汤面和饭菜](yard/maple-table.webp)](yard/maple-table.webp) | [![假山石洞旁的两尾金鱼与鹅卵石池沿](yard/pond.webp)](yard/pond.webp) |

| 长椅旁的猫和狗 | 牵牛花篱门 |
| --- | --- |
| [![灰猫和棕犬站在木长椅前的草坪上](yard/cat-and-dog.webp)](yard/cat-and-dog.webp) | [![木篱门两侧的牵牛花和穿门而过的石板路](yard/gate.webp)](yard/gate.webp) |

## 大肥鱼的衣柜

[![八套穿搭的全身像：蓝鲸女仆、深蓝报刊装、夏日水手服、特别礼服、蓝白水手常服、海雾冬装、睡衣和鲸鱼伞雨衣](wardrobe/outfits.webp)](wardrobe/outfits.webp)

[![八套穿搭的下颌、领口与胸前饰品。每组左侧为调整前、右侧为调整后的同机位实模](wardrobe/necklines.webp)](wardrobe/necklines.webp)

[![按脸宽等比排列的蓝鲸女仆正面设定、上一稿、最终模型。上排看站姿，下排看下颌与领结](wardrobe/maid-neck-comparison.webp)](wardrobe/maid-neck-comparison.webp)

**海风日记 · 夏日水手服**

[![夏日装的斜前全身像、镂孔草帽边、鲸鱼挎包和双层裙摆](wardrobe/summer-details.webp)](wardrobe/summer-details.webp)

**蓝鲸女仆**

[![设定图与三维近景对照，可见腕带上方的蓬袖和袖口蕾丝的侧面轮廓](maid-sleeves.webp)](maid-sleeves.webp)

[![蓝鲸女仆装的胸襟、围裙 DeepSeek 鲸鱼标志与裙摆刺绣实模近景](maid-embroidery.webp)](maid-embroidery.webp)

[查看走动与收步时袖口的摆动](maid-walk.webp)

[![同一段迈步和收步，从左到右可见全身、鳍耳、尾鳍](fin-tail-motion.webp)](fin-tail-motion.webp)

## 重拍图集

在当前仓库执行 `npm ci`、`python -m pip install pillow playwright` 和 `python -m playwright install chromium`。第一条命令重拍女仆近景、两段走动动画、夏装细节，并使用现有八张镜像重排全身图录。第二条命令用旧版和当前模型，在同一机位拍摄八套领口的前后对照。

```sh
python tools/capture-maid.py
python tools/capture-maid.py --necklines ../dafeiyu-v1.0.1
```

将 `../dafeiyu-v1.0.1` 替换为也已执行 `npm ci` 的旧版仓库路径。加上 `--font 字体文件` 可以选择中文字体。

安装 `python -m pip install numpy opencv-python-headless` 后，`python tools/capture-scenes.py` 可从 `assets/小屋室内.glb` 重拍含穿衣镜的室内视图，并从三维场景重拍黄昏全景、室内及庭院的 360° 图。
