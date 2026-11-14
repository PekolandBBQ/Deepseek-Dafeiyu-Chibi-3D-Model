"""Bake front and sleeping DSH artwork onto persistent cylindrical garment and head UVs."""
import argparse
import base64
import io
import json
import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image


# Normalized distance from crown to chin, half-width, front, rear, section axis.
# Front widths follow the seated grass frame; the turntable profiles place the
# cheek behind the forehead and bring the jaw back over the collar.
HEAD_CROSS_SECTIONS = [
    [0,    .014, .034, -.036,  .000],
    [.05,  .192, .170, -.184,  .000],
    [.15,  .327, .267, -.338, -.005],
    [.29,  .423, .335, -.462, -.006],
    [.43,  .485, .363, -.534, -.006],
    [.54,  .510, .368, -.533, -.004],
    [.65,  .528, .338, -.478,  .004],
    [.72,  .526, .322, -.402,  .017],
    [.79,  .507, .334, -.312,  .037],
    [.85,  .472, .311, -.206,  .065],
    [.91,  .391, .267, -.108,  .089],
    [.96,  .278, .215,  .026,  .115],
    [.99,  .130, .173,  .096,  .133],
    [1,    .042, .152,  .121,  .137],
]


def head_sections():
    controls = np.asarray(HEAD_CROSS_SECTIONS)
    height = np.linspace(0, 1, 81)
    values = np.stack([np.interp(height, controls[:, 0], column)
                       for column in controls[:, 1:].T], axis=1)
    smoothed = cv2.GaussianBlur(values, (1, 5), .80)
    smoothed[[0, -1]] = values[[0, -1]]
    return height, smoothed


def front_registration(sections, top, bottom, center_x, width_scale=1):
    height, values = sections
    # One orthographic registration per source. Each eye, mouth and bang retains
    # the same pixel spacing from its neighbours over the entire frontal area.
    pixels_per_unit = (bottom-top) / .882 * width_scale
    return list(zip(height, top+height*(bottom-top),
                    np.full_like(height, center_x), values[:, 0]*pixels_per_unit))


def still(directory, ffmpeg, name, time):
    path = next(directory.rglob(name + ".webm"))
    data = subprocess.check_output([str(ffmpeg), "-v", "error", "-ss", str(time),
                                    "-c:v", "libvpx-vp9", "-i", str(path), "-frames:v", "1",
                                    "-c:v", "png", "-f", "image2pipe", "-"])
    source = Image.open(io.BytesIO(data)).convert("RGBA")
    bbox = source.getchannel("A").point(lambda a: 255 if a > 110 else 0).getbbox()
    w = round(500 * (bbox[2] - bbox[0]) / (bbox[3] - bbox[1]))
    return np.asarray(source.crop(bbox).resize((w, 500), Image.Resampling.LANCZOS))


def png_data(rgb):
    out = io.BytesIO()
    Image.fromarray(rgb).save(out, "PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(out.getvalue()).decode()


def blink_on(base, closed, landmarks):
    # Register the closed lids on the same neutral or speaking face. Keep its
    # mouth, chin, hairline and bow fixed throughout the short blink.
    transform=cv2.getAffineTransform(np.float32([[103,218],[150,217],[125,250]]),
                                     np.float32(landmarks))
    lids=cv2.warpAffine(closed,transform,(base.shape[1],base.shape[0]),flags=cv2.INTER_CUBIC)
    yy,xx=np.indices(base.shape[:2])
    mask=np.zeros_like(xx,dtype=float)
    for cx,cy in landmarks[:2]:
        distance=np.sqrt(((xx-cx)/16.5)**2+((yy-cy)/15)**2)
        blend=np.clip((1.19-distance)/.25,0,1)
        mask=np.maximum(mask,blend*blend*(3-2*blend))
    return np.uint8(base*(1-mask[:,:,None])+lids*mask[:,:,None])


def desktop_bob(front, seated):
    # Rows on the original idle cel, running from the roots to each pointed cheek lock.
    # Columns are y, left outer/inner and right inner/outer.
    bounds = np.asarray([
        [102, 93, 98, 259, 265], [126, 72, 109, 248, 294],
        [155, 57, 126, 228, 305], [179, 52, 122, 228, 305],
        [200, 49, 111, 244, 304], [221, 48, 98, 264, 306],
        [239, 52, 100, 261, 307], [251, 58, 105, 254, 303],
        [259, 65, 111, 245, 299], [265, 72, 105, 255, 295],
        [273, 88, 109, 252, 281], [280, 115, 117, 253, 256],
    ])
    height = np.linspace(bounds[0,0], bounds[-1,0], 60)
    edges = np.column_stack([np.interp(height, bounds[:,0], col) for col in bounds[:,1:].T])
    edges = cv2.GaussianBlur(edges, (1,5), .85)
    # Locate the same locks on the seated reference. Their inner boundary at the
    # eyes matters: a narrower desktop lock cannot be allowed to cover her iris.
    grass_bounds = np.asarray([
        [172, 92, 99, 172, 179], [183,83,108,166,185], [197,73,108,165,192],
        [208,71,100,171,195], [217,71,95,177,196], [226,71,95,178,197],
        [235,73,97,177,196], [240,77,99,175,195], [244,81,101,174,193],
        [247,83,99,176,191], [250,90,105,172,186], [253,105,109,168,173],
    ])
    grass_y = 151.5 + (height-55)*104.5/231
    target = np.column_stack([np.interp(grass_y,grass_bounds[:,0],col) for col in grass_bounds[:,1:].T])
    target = cv2.GaussianBlur(target, (1,5), .85)
    q, yy = np.meshgrid(np.linspace(0, 1, 224), np.linspace(height[0], height[-1], 384))
    locks = []
    for inner_col, outer_col in ((1,0),(2,3)):
        inner, outer = edges[:,inner_col], edges[:,outer_col]
        hi = np.interp(yy,height,inner)
        px = hi + q*(np.interp(yy,height,outer)-hi)
        rgb = cv2.remap(front[:,:,:3],px.astype("f"),yy.astype("f"),cv2.INTER_CUBIC)
        rr,gg,bb = rgb.astype(float).transpose(2,0,1)
        # Remove any skin, fin lace or bow that overlaps the bob in the painted view.
        foreign = ((rr > bb*.98+4) | (gg > bb*.89+9) | (gg > rr*1.38+6)).astype("uint8")
        rgb = cv2.inpaint(rgb,foreign,4,cv2.INPAINT_TELEA)
        native = rgb.astype(float)*[.88,.94,.89]
        gi = np.interp(yy,height,target[:,inner_col])
        gx = gi + q*(np.interp(yy,height,target[:,outer_col])-gi)
        gy = 151.5 + (yy-55)*104.5/231
        registered = cv2.remap(seated[:,:,:3],gx.astype("f"),gy.astype("f"),cv2.INTER_CUBIC)
        rr,gg,bb = registered.astype(float).transpose(2,0,1)
        valid = (bb>rr*1.08)&(bb>gg*1.08)&(rr<145)
        mix = np.where(valid,.17+.38*q,1)[:,:,None]
        rgb = np.uint8(np.clip(native*mix + registered*(1-mix),0,255))
        unit = .882/104.5
        locks.append({"rows":np.round(np.column_stack(((height-55)/231,(target[:,inner_col]-135.5)*unit,
                                                       (target[:,outer_col]-135.5)*unit)),5).tolist(),
                      "color":png_data(rgb)})
    return locks


def desktop_headband(front):
    # Trace the lace itself on rays from the hairline. Some rays at the ends
    # are hidden behind the bow; extend the nearest visible folds over them.
    angles = np.linspace(-1.48,1.48,384)
    radii = np.arange(70,185)
    xx = 182+np.sin(angles)[:,None]*radii
    yy = 177-np.cos(angles)[:,None]*radii
    samples = cv2.remap(front,xx.astype("f"),yy.astype("f"),cv2.INTER_LINEAR)
    rgba = samples.astype(float)
    lace=(rgba[:,:,:3].min(axis=2)>134)&(rgba[:,:,0]>=rgba[:,:,2]*.95)&(rgba[:,:,3]>190)
    lace=cv2.morphologyEx(lace.astype("uint8"),cv2.MORPH_CLOSE,np.ones((1,3),"uint8"))
    intervals = []
    for i, mask in enumerate(lace):
        changes=np.flatnonzero(np.diff(np.pad(mask.astype(int),(1,1))))
        runs=changes.reshape(-1,2)
        if len(runs):
            start,end=max(runs,key=lambda run:run[1]-run[0])
            if end-start>=8:intervals.append((i,radii[start],radii[end-1]))
    idx,inside,outside=np.asarray(intervals).T
    lo=np.interp(np.arange(len(angles)),idx,inside)
    hi=np.interp(np.arange(len(angles)),idx,outside)
    # Reuse the nearest visible pleat where the native bow hides the lace.
    columns=np.arange(len(angles))
    nearest=idx[np.abs(columns[:,None]-idx).argmin(axis=1)]
    r=lo[nearest][None,:]+(hi-lo)[nearest][None,:]*np.linspace(.05,.93,64)[:,None]
    a=angles[nearest]
    rgb=cv2.remap(front[:,:,:3],(182+np.sin(a)*r).astype("f"),
                  (177-np.cos(a)*r).astype("f"),cv2.INTER_CUBIC)
    spread = np.clip((hi-lo)*.882/231, .054, .115)
    spread = cv2.GaussianBlur(spread[None,:], (5,1), .95).ravel()
    return {"color":png_data(np.flipud(rgb)),"width":np.round(spread,5).tolist()}


def texture(frame, rows, background, back=None, profile=None):
    u, v = np.meshgrid((np.arange(768) + .5) / 768, (np.arange(384) + .5) / 384)
    theta = (u - .5) * 2 * np.pi
    t, cy, cx, half = np.asarray(rows).T
    y = np.interp(v, t, cy)
    x = np.interp(v, t, cx) + np.sin(theta)*np.interp(v, t, half)
    if profile is not None:
        # Smooth small GIF palette steps on the cheeks while preserving lashes and catchlights.
        rgb = cv2.bilateralFilter(frame[:, :, :3], 5, 16, 1.6)
        frame = np.dstack((rgb, frame[:, :, 3]))
    rgba = cv2.remap(frame, x.astype("f"), y.astype("f"), cv2.INTER_CUBIC)
    edge, fade = (1.50+.39*np.clip((v-.77)/.22,0,1), .34) if profile is not None else (1.78, .38)
    side = np.clip((edge - np.abs(theta)) / fade, 0, 1)
    mix = (side * side * (3 - 2 * side) * rgba[:, :, 3] / 255)[:, :, None]
    base = np.stack([np.interp(v, t, channel) for channel in np.asarray(background).T], axis=-1)
    if profile is not None:
        # Sample only the side hair. The ear fin, bow and headband have their own meshes.
        fx = np.interp(v, [0,.13,.29,.51,.73,1], [105,90,76,66,67,78]) + 6*np.cos(theta)
        fy = 167 + 84*v
        side_hair = cv2.remap(profile[:, :, :3], fx.astype("f"), fy.astype("f"), cv2.INTER_CUBIC)
        # Preserve the hair's blue range when a sample grazes the stitched band.
        base = np.clip(side_hair, [36,45,70], [75,94,145])*.55 + base*.45
    if back is not None:
        # Use only pixels inside the back of her head in the supplied spinning reference.
        half_width = np.interp(v, [0, .12, .35, .65, 1], [3, 24, 43, 54, 50])
        bx = 129 - np.sin(theta) * half_width
        by = 175 + v * 95
        rear = cv2.remap(back[:, :, :3], bx.astype("f"), by.astype("f"), cv2.INTER_CUBIC)
        rear_mix = np.clip((np.abs(theta) - 1.4) / .65, 0, 1)[:, :, None]
        base = rear * rear_mix + base * (1 - rear_mix)
    rgb = np.uint8(np.clip(rgba[:, :, :3] * mix + base * (1 - mix), 0, 255))
    return png_data(rgb)


def main():
    parser = argparse.ArgumentParser()
    for option in ("videos", "ffmpeg", "turnaround", "out"):
        parser.add_argument(option, type=Path)
    args = parser.parse_args()
    front = still(args.videos, args.ffmpeg, "待机呼吸休闲", 0)
    sleep = still(args.videos, args.ffmpeg, "原地小憩沉眠", 3.6)
    reference = Image.open(args.turnaround)
    smile = np.asarray(reference.convert("RGBA"))
    reference.seek(19)
    seated = np.asarray(reference.convert("RGBA"))
    reference.seek(89)
    blink = np.asarray(reference.convert("RGBA"))
    reference.seek(72)
    back = np.asarray(reference.convert("RGBA"))
    reference.seek(27)
    profile = np.asarray(reference.convert("RGBA"))
    reference.seek(38)
    rear_frame = np.asarray(reference.convert("RGB"))
    u,v = np.meshgrid(np.linspace(-1,1,512),np.linspace(0,1,384))
    rear_width = np.interp(v,[0,.12,.28,.45,.63,.80,1],[5,32,48,53,52,49,43])
    rear_x = (131 + u*rear_width).astype("f")
    rear_y = (164 + v*128).astype("f")
    rear_img = cv2.remap(rear_frame,rear_x,rear_y,cv2.INTER_CUBIC)
    rear_buffer = io.BytesIO()
    Image.fromarray(rear_img).save(rear_buffer,"PNG",optimize=True)
    sections = head_sections()
    seated_rows = front_registration(sections,151.5,256.0,135.5)
    smile_rows = front_registration(sections,141.5,253,116.5)
    closed = front_registration(sections,101,330,176)
    hair = [(47, 65, 103)] * len(sections[0])
    # Each sampled ring follows the actual outline of the maid dress, inside the arms.
    dress_rows = [(0, 288, 185, 36), (.12, 304, 185, 39), (.26, 327, 185, 39),
                  (.35, 344, 185, 40), (.51, 371, 185, 51), (.68, 400, 185, 68),
                  (.80, 422, 186, 92), (.88, 436, 187, 101), (.94, 450, 187, 107),
                  (1, 466, 187, 88)]
    navy, trim = (37, 40, 68), (218, 204, 192)
    result = {"sections": np.round(sections[1],5).tolist(),
              "bob": desktop_bob(front,seated), "headband": desktop_headband(front),
              "bow":png_data(front[150:211,291:352,:3]),
              "open": texture(seated, seated_rows, hair, back, profile), "closed": texture(sleep, closed, hair, back, profile),
              "smile": texture(smile, smile_rows, hair, back, profile),
              "blink":texture(blink_on(seated,blink,[(113,223),(159,224),(136,255)]),seated_rows,hair,back,profile),
              "smileBlink":texture(blink_on(smile,blink,[(94,221),(141,219),(117,253)]),smile_rows,hair,back,profile),
              "dress": texture(front, dress_rows, [navy] * 8 + [trim, trim]),
              "rearHair": "data:image/png;base64,"+base64.b64encode(rear_buffer.getvalue()).decode()}
    args.out.write_text(json.dumps(result, separators=(",", ":")), "ascii")


if __name__ == "__main__":
    main()
