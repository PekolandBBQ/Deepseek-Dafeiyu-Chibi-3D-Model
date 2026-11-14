"""Project the supplied clothing breakdowns onto the resident's garment UVs."""
import base64
import io
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
# Sheet display width, then garment rows (y, centre x, visible half width).
PATTERNS = {
    "蓝鲸女仆": (733, [(265,161,11),(276,161,15),(289,161,12),(303,161,20),(316,161,30),(324,161,27),(328,161,17)]),
    "海雾冬装": (733, [(296,113,9),(305,113,13),(317,113,11),(329,113,20),(339,113,26),(345,113,27),(350,113,18)]),
    "海风日记·夏日水手服": (733, [(180,87,10),(194,87,16),(210,87,14),(232,86,24),(254,84,38),(266,84,42),(274,84,28)]),
    "深海星愿·特别礼服": (740, [(347,54,9),(358,54,13),(371,54,13),(386,54,23),(404,54,32),(414,54,35),(421,54,24)]),
    "深蓝报刊装": (740, [(146,100,14),(167,101,22),(202,100,23),(225,101,38),(251,102,55),(265,103,64),(280,103,45)]),
    "睡衣": (733, [(252,60,12),(266,60,17),(277,60,16),(288,60,22),(301,60,33),(310,60,32),(315,60,25)]),
    "蓝白水手常服": (740, [(152,148,15),(165,148,23),(182,147,30),(195,146,33),(211,147,45),(218,147,45),(222,147,30)]),
    "鲸鱼伞雨衣": (740, [(157,112,15),(175,112,21),(196,111,22),(217,111,34),(245,111,51),(259,111,55),(269,111,41)]),
}

def bake():
    sources = {p.stem:p for p in (ROOT/"assets/衣柜参考图").rglob("*") if p.is_file()}
    output = {}
    w, h = 1024, 768
    a, v = np.meshgrid(((np.arange(w)+.5)/w-.5)*2*np.pi,(np.arange(h)+.5)/h)
    for name, (preview, rows) in PATTERNS.items():
        art = Image.open(sources[name]).convert("RGB")
        scale = art.width / preview
        y, center, radius = [np.interp(v,[0,.14,.35,.55,.80,.92,1],c) for c in zip(*rows)]
        # A back panel of the same cloth keeps the central bib and insignia on the front.
        side = np.sin(a)
        front = np.clip((np.cos(a)+.05)/.60,0,1)
        front = front*front*(3-2*front)
        def sample(x):
            xx=np.clip((x*scale).round().astype(int),0,art.width-1)
            yy=np.clip((y*scale).round().astype(int),0,art.height-1)
            return np.asarray(art)[yy,xx]
        face=sample(center+side*radius)
        back=sample(center+radius*(.79+.12*np.cos(14*a)))
        rgb=face*front[:,:,None]+back*(1-front[:,:,None])
        if name=="蓝鲸女仆":
            # The shoulder straps are stitched meshes. Keep the original bib
            # and waistband, and restore navy dress fabric beneath both straps.
            strip_rows=[0,.04,.08,.12,.16,.22,.28,.35]
            left=np.interp(v,strip_rows,[.40,.405,.406,.419,.419,.409,.405,.40])
            right=np.interp(v,strip_rows,[.626,.607,.579,.560,.548,.544,.544,.544])
            u=a/(2*np.pi)+.5
            mask=np.clip(np.maximum(left-u,u-right)*w,0,1)*np.clip((.351-v)*h,0,1)
            weave=1+.044*np.cos(a*12)+.013*np.cos(a*64)
            navy=np.array([47,45,70])[None,None,:]*weave[:,:,None]
            rgb=rgb*(1-mask[:,:,None])+navy*mask[:,:,None]
            hem=.903+.011*np.cos(24*a)
            width=v-hem
            shade=(.91+.09*np.cos(24*a))[:,:,None]
            lace=np.array([246,232,220])[None,None,:]*shade
            petal=np.cos(40*a+np.clip(width,0,.1)*35)
            stitch=(np.abs(width-.043-.010*petal)<.0022)|(np.abs(width-.070-.013*petal)<.0022)
            lace=np.where(stitch[:,:,None],np.array([201,175,165]),lace)
            rgb=np.where((width>0)[:,:,None],lace,rgb)
            thread=(np.abs(width+.014)<.0027)|(np.abs(width+.026+.004*np.cos(32*a))<.0018)
            rgb=np.where(thread[:,:,None],np.array([217,187,131]),rgb)
        image=Image.fromarray(rgb.astype("uint8"))
        buffer=io.BytesIO()
        image.save(buffer,"WEBP",quality=92,method=5)
        output[name]="data:image/webp;base64,"+base64.b64encode(buffer.getvalue()).decode()
    target=ROOT/"assets/whale-outfits.json"
    target.write_text(json.dumps(output,ensure_ascii=False,separators=(",",":")),"utf-8")

def bake_face():
    # Central facial features are registered to crown/chin and both temples.
    # Keep the locked rear UVs and the original side hair beyond the frontal arc.
    import cv2
    base=json.loads((ROOT/"assets/whale-toon-face.json").read_text("utf-8"))
    maid=np.asarray(Image.open(ROOT/"assets/衣柜参考图/蓝鲸女仆.jpg").convert("RGB"))
    sailor=np.asarray(Image.open(ROOT/"assets/衣柜参考图/蓝白水手常服.png").convert("RGB"))
    output={}
    bare_hair=None
    for label,image,x,top,chin,factor in [
        ("open",sailor,761,130,770,.97),("smile",maid,979,73,170,1.02),
        ("blink",maid,979,73,170,1.02),("smileBlink",maid,979,73,170,1.02),
        ("closed",maid,979,73,170,1.02)]:
        old=Image.open(io.BytesIO(base64.b64decode(base[label].split(",")[1]))).convert("RGB").resize((1536,768),Image.Resampling.LANCZOS)
        a,v=np.meshgrid(((np.arange(old.width)+.5)/old.width-.5)*2*np.pi,(np.arange(old.height)+.5)/old.height)
        sections=np.array(base["sections"])
        radius=np.interp(v,np.linspace(0,1,len(sections)),sections[:,0])
        xx=x+np.sin(a)*radius*(chin-top)/.882*factor
        yy=top+v*(chin-top)
        new=cv2.remap(image,xx.astype("float32"),yy.astype("float32"),cv2.INTER_CUBIC)
        if label in ("blink","closed"):
            # Keep the neutral mouth when using the reference's closed eyelids.
            open_data=np.asarray(Image.open(io.BytesIO(base64.b64decode(output["open"].split(",")[1]))))
            weight=np.clip((.87-v)/.06,0,1)[:,:,None]
            new=weight*new+(1-weight)*open_data
        edge=np.clip((1.20-np.abs(a))/.26,0,1)*np.clip(v/.12,0,1)
        edge=(edge*edge*(3-2*edge))[:,:,None]
        rgb=np.uint8(np.clip(np.asarray(old)*(1-edge)+new*edge,0,255))
        # The reference outfits have ribbons at the temples. Store the underlying
        # hair in the head atlas so removing the separate accessory reveals hair.
        if label=="open":
            bare_hair=rgb.copy()
            bare_hair[:,old.width//2:]=rgb[:,:old.width//2][:,::-1]
        strip=np.clip((np.abs(a)-.77)/.06,0,1)*np.clip((1.63-np.abs(a))/.13,0,1)
        strip*=np.clip(v/.065,0,1)*np.clip((.98-v)/.065,0,1)
        strip=(strip*strip*(3-2*strip))[:,:,None]
        rgb=np.uint8(np.rint(rgb*(1-strip)+bare_hair*strip))
        out=io.BytesIO();Image.fromarray(rgb).save(out,"WEBP",quality=94)
        output[label]="data:image/webp;base64,"+base64.b64encode(out.getvalue()).decode()
    (ROOT/"assets/whale-face-detail.json").write_text(json.dumps(output,separators=(",",":")),"utf-8")

if __name__ == "__main__":
    bake()
    bake_face()
