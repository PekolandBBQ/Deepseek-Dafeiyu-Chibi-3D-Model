"""Rephotograph the maid preview plates and walking loop with the public studio."""

import argparse
import base64
import functools
import io
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from PIL import Image, ImageDraw, ImageFont, ImageOps
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
PREVIEWS = ROOT / "previews"
BACKGROUND = "#faf8f2"
INK = "#21374b"

# The three angle studies share a time sample. Pose the live rig only once per
# sample so the spring state and the step-to-rest transition stay in sync.
PHOTOGRAPH = """
async () => {
  const T = await import('/three/three.module.js');
  const {rig, scene} = studio;
  await rig.ready;
  await rig.setOutfit('蓝鲸女仆');
  const renderer = new T.WebGLRenderer({antialias:true, preserveDrawingBuffer:true});
  renderer.setPixelRatio(1.5);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.setClearColor(0xe3e8ed);
  renderer.setScissorTest(true);
  const cam = new T.OrthographicCamera(-1, 1, 1, -1, .1, 20);
  function view(x, w, h, cy, height, yaw, cx=0) {
    renderer.setViewport(x, 0, w, h);
    renderer.setScissor(x, 0, w, h);
    cam.top = height/2; cam.bottom = -cam.top;
    cam.right = cam.top*w/h; cam.left = -cam.right;
    cam.position.set(cx+4*Math.sin(yaw), cy+.06, 4*Math.cos(yaw));
    cam.lookAt(cx, cy, 0);
    cam.updateProjectionMatrix();
    renderer.render(scene, cam);
  }
  window.photograph = (kind, i=0) => {
    renderer.setSize(1080, kind === 'fabric' ? 475 : kind === 'sleeves' ? 420 : 526);
    renderer.setScissorTest(false);
    renderer.clear();
    renderer.setScissorTest(true);
    if (kind === 'walk') {
      rig.pose(i<=35 ? 'walk' : 'idle', i<=35 ? i/15 : (i-35)/15,
               {dt:i===0 ? 0 : 1/15, snap:i===0, blend:true});
    } else rig.pose('idle', .45, {snap:true});
    if (kind === 'fabric') {
      view(0, 540, 475, .55, .78, 0);
      view(540, 540, 475, .54, .78, .48, .015);
    } else if (kind === 'sleeves') {
      const head = rig.model.getObjectByName('Head'), previous = head.visible;
      head.visible = false;
      try {
        for (const [index, yaw] of [0, .55, 1.57].entries())
          view(index*360, 360, 420, .69, .61, yaw, .165);
      } finally { head.visible = previous; }
    } else {
      view(0, 372, 526, .99, 2.24, 0);
      view(376, 353, 526, .684, .64, 0, .19);
      view(733, 347, 526, .684, .635, .68, .15);
    }
    return renderer.domElement.toDataURL('image/png').split(',')[1];
  };
}
"""


def font_file(supplied):
    candidates = [supplied] if supplied else [
        Path(os.environ.get("WINDIR", "")) / "Fonts/msyh.ttc",
        Path("/System/Library/Fonts/PingFang.ttc"),
        Path("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"),
    ]
    for candidate in candidates:
        if candidate.is_file():
            return str(candidate)
    raise SystemExit("请用 --font 指定支持中文的 TTF 或 TTC 字体。")


def put_text(image, xy, text, size, font):
    ImageDraw.Draw(image).text(xy, text, font=ImageFont.truetype(font, size), fill=INK)


def fit(image, size):
    return ImageOps.contain(image.convert("RGB"), size, Image.Resampling.LANCZOS)


def capture_outfits(directory, font):
    portraits = json.loads((ROOT / "assets/mirror-portraits.json").read_text("utf-8"))
    page = Image.new("RGB", (1500, 133+468*math.ceil(len(portraits)/4)), "#f7f6f0")
    put_text(page, (38, 14), "Deepseek（大肥鱼）Q版3D模型", 44, font)
    put_text(page, (40, 83), "穿衣镜里的八套装束", 20, font)
    for i, (name, data) in enumerate(portraits.items()):
        image = Image.open(io.BytesIO(base64.b64decode(data.split(",", 1)[1])))
        card = ImageOps.fit(image.convert("RGB"), (343, 398), Image.Resampling.LANCZOS)
        x, y = 39 + i % 4 * 359, 126 + i // 4 * 468
        page.paste(card, (x, y))
        put_text(page, (x, y + 407), name, 22, font)
    (directory / "wardrobe").mkdir(exist_ok=True)
    page.save(directory / "wardrobe/outfits.webp", quality=94, method=6)


def capture(page, directory, font):
    page.wait_for_function("Boolean(window.studio?.rig)")
    page.evaluate(PHOTOGRAPH)

    def shot(kind, i=0):
        data = page.evaluate("args => photograph(...args)", [kind, i])
        return Image.open(io.BytesIO(base64.b64decode(data))).convert("RGB")

    static = shot("still")
    geometry = shot("sleeves")
    fabric = shot("fabric")
    plate = Image.new("RGB", (1620, 1290), BACKGROUND)
    put_text(plate, (32, 15), "蓝鲸女仆 · 泡袖与蕾丝", 42, font)
    put_text(plate, (32, 88), "设定图局部", 29, font)
    put_text(plate, (566, 88), "实模正面", 29, font)
    put_text(plate, (1098, 88), "实模斜前方", 29, font)
    ref = Image.open(ROOT / "assets/衣柜参考图/蓝鲸女仆.jpg")
    panels = [ref.crop((610,267,691,387)), static.crop((564,15,1092,770)),
              static.crop((1104,15,1618,770))]
    for i, panel in enumerate(panels):
        image = fit(panel, (485, 440))
        plate.paste(image, (27 + 533*i + (485-image.width)//2, 148))
    put_text(plate, (32, 621), "移开头发查看肩带与袖口", 29, font)
    for i, name in enumerate(["正面", "斜前方", "侧面"]):
        panel = fit(geometry.crop((i*540,0,(i+1)*540,630)), (518, 520))
        plate.paste(panel, (20 + i*539 + (518-panel.width)//2, 675))
        put_text(plate, (36+i*539, 1214), name, 23, font)
    plate.save(directory / "maid-sleeves.webp", quality=95, method=6)
    detail = Image.new("RGB", (1620, 813), BACKGROUND)
    put_text(detail, (34, 15), "蓝鲸女仆 · 胸襟、围裙与裙摆", 40, font)
    put_text(detail, (34, 71), "正面", 23, font)
    put_text(detail, (841, 71), "斜前方", 23, font)
    detail.paste(fabric, (0, 101))
    detail.save(directory / "maid-embroidery.webp", quality=96, method=6)

    frames = []
    for i in range(65):
        image = Image.new("RGB", (1620, 910), BACKGROUND)
        image.paste(shot("walk", i), (0, 110))
        state = "走路" if i <= 35 else "收步" if i < 44 else "站定"
        put_text(image, (27, 5), "蓝鲸女仆 · " + state, 36, font)
        for x, name in [(27, "完整着装"), (588, "正面近景"), (1124, "斜面近景")]:
            put_text(image, (x, 65), name, 27, font)
        frames.append(image)
    durations = [(i+1)*1000//15-i*1000//15 for i in range(len(frames))]
    frames[0].save(directory / "maid-walk.webp", save_all=True, append_images=frames[1:],
                   duration=durations, loop=0, quality=92, method=4)


class StudioFiles(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        if path in ("/three/three.module.js", "/three/three.core.js"):
            return str(ROOT / "node_modules/three/build" / Path(path).name)
        return super().translate_path(path)

    def log_message(self, *args):
        pass


def main():
    args = argparse.ArgumentParser(description=__doc__)
    args.add_argument("--font", type=Path)
    args.add_argument("--output", type=Path, default=PREVIEWS)
    args = args.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    font = font_file(args.font)
    subprocess.run([shutil.which("node") or "node", "tools/build.mjs"], cwd=ROOT, check=True)
    handler = functools.partial(StudioFiles, directory=str(ROOT / "dist"))
    with ThreadingHTTPServer(("127.0.0.1", 0), handler) as server:
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            with sync_playwright() as pw:
                browser = pw.chromium.launch(channel=os.getenv("PLAYWRIGHT_CHANNEL"),
                                             args=["--enable-unsafe-swiftshader"])
                page = browser.new_page()
                page.goto(f"http://127.0.0.1:{server.server_port}/studio.html")
                capture(page, args.output, font)
                browser.close()
        finally:
            server.shutdown()
    capture_outfits(args.output, font)


if __name__ == "__main__":
    main()
