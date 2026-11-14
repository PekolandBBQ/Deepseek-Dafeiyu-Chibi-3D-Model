"""Photograph the furnished room, courtyard and their equirectangular panoramas."""
import argparse
import base64
import functools
import io
import os
import shutil
import subprocess
import tempfile
import threading
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

import cv2
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ROOM_VIEWS = [
    ("room-overview", [7.4, 11.2, 19.8], [.48, 1.25, .58], 34),
    ("wardrobe-mirror", [1.45, 2.5, 3.1], [-.23, 1.95, -3.34], 37),
    ("bedside", [1.15, 3.3, 2.75], [3.46, .86, -2.32], 43),
]
FACES = [
    ([0, 0, -1], [0, 1, 0]), ([1, 0, 0], [0, 1, 0]),
    ([0, 0, 1], [0, 1, 0]), ([-1, 0, 0], [0, 1, 0]),
    ([0, 1, 0], [0, 0, 1]), ([0, -1, 0], [0, 0, -1]),
]


def panorama(page, eye):
    faces = []
    for forward, up in FACES:
        aim = (np.array(eye) + forward).tolist()
        data = page.evaluate("options => photograph(options)",
                             dict(eye=eye, aim=aim, up=up, fov=90, fog=1.12, w=1280, h=1280))
        with Image.open(io.BytesIO(base64.b64decode(data))) as frame:
            faces.append(np.asarray(frame.convert("RGB")))

    # Project the six camera views onto longitude/latitude, in strips to
    # bound memory. Camera-space right and up match the Three cameras above.
    width, height = 4096, 2048
    lon = (np.arange(width) + .5) * (2*np.pi/width) - np.pi
    out = np.empty((height, width, 3), dtype=np.uint8)
    for start in range(0, height, 96):
        stop = min(height, start + 96)
        lat = (np.pi/2 - (np.arange(start,stop)+.5)*(np.pi/height))[:,None]
        rays = np.stack(np.broadcast_arrays(np.cos(lat)*np.sin(lon), np.sin(lat),
                                            -np.cos(lat)*np.cos(lon)), axis=-1)
        major = np.abs(rays).max(axis=-1)
        for frame, (forward, up) in zip(faces,FACES):
            depth = rays @ forward
            mask = depth >= major-1e-10
            if not mask.any():
                continue
            safe = np.maximum(.01,depth)
            size = frame.shape[0]
            x = (.5 + .5*(rays @ np.cross(forward,up))/safe)*size - .5
            y = (.5 - .5*(rays @ up)/safe)*size - .5
            pixels = cv2.remap(frame,x.astype("float32"),y.astype("float32"),
                               cv2.INTER_LINEAR,borderMode=cv2.BORDER_REPLICATE)
            out[start:stop][mask] = pixels[mask]
    return Image.fromarray(out)


class SceneFiles(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        if urlsplit(path).path == "/room.glb":
            return str(ROOT / "assets/小屋室内.glb")
        return super().translate_path(path)

    def log_message(self, *args):
        pass


def capture(browser, url, directory):
    indoors = directory / "interior"
    panoramas = directory / "panoramas"
    indoors.mkdir(parents=True, exist_ok=True)
    panoramas.mkdir(parents=True, exist_ok=True)
    page = browser.new_page()

    def open_view(view):
        page.goto(url + "/?" + view)
        page.wait_for_function("typeof window.photograph === 'function'")

    open_view("interior")
    for name, eye, aim, fov in ROOM_VIEWS:
        data = page.evaluate("o => photograph(o)", dict(eye=eye,aim=aim,fov=fov))
        (indoors / (name+".webp")).write_bytes(base64.b64decode(data))
    open_view("dusk")
    hero = page.evaluate("o => photograph(o)", dict(eye=[.6,21.5,36], aim=[4.1,.9,2.15],
                         fov=37.2, fog=1.25, w=1920, h=1120, phase="dusk"))
    with Image.open(io.BytesIO(base64.b64decode(hero))) as image:
        image.convert("RGB").save(panoramas / "cottage-at-dusk.webp",quality=93,method=6)
    open_view("cube")
    for name, eye in [("room", [.35,1.62,1.65]), ("garden", [8.4,1.4,5.9])]:
        panorama(page, eye).save(panoramas / (name+"-360.webp"),quality=92,method=6)
    page.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output",type=Path,default=ROOT / "previews")
    args = parser.parse_args()
    with tempfile.TemporaryDirectory() as tmp:
        folder = Path(tmp)
        subprocess.run([shutil.which("node") or "node","node_modules/esbuild/bin/esbuild",
                        "tools/scene-photography.mjs","--bundle","--format=esm","--minify",
                        "--target=es2022","--outfile="+str(folder/"photograph.mjs")],
                       cwd=ROOT,check=True)
        (folder/"index.html").write_text(
            '<meta charset="utf-8"><script type="module" src="./photograph.mjs"></script>',
            encoding="utf-8")
        files = functools.partial(SceneFiles, directory=str(folder))
        with ThreadingHTTPServer(("127.0.0.1",0), files) as server:
            threading.Thread(target=server.serve_forever,daemon=True).start()
            try:
                with sync_playwright() as pw:
                    browser = pw.chromium.launch(channel=os.getenv("PLAYWRIGHT_CHANNEL"),
                                                 args=["--enable-unsafe-swiftshader"])
                    capture(browser,"http://127.0.0.1:"+str(server.server_port),args.output)
                    browser.close()
            finally:
                server.shutdown()


if __name__ == "__main__":
    main()
