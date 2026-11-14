"""Sample motion envelopes from the locally installed Shenshen reference clips."""
import argparse
import json
import pathlib
import subprocess

import cv2
import numpy as np

CLIPS={"idle":"待机呼吸休闲","walk":"漂浮踏步","sleep":"原地小憩沉眠","contact":"点击回应-元气挥手",
       "browse":"工作状态-忙碌点按","think":"工作状态-思考冒泡","pet":"撸猫","swing":"荡秋千",
       "write":"轻快记录","play":"原地专心玩魔方","look":"东张西望"}
FPS=12

def measure(frame):
    rgba=frame.astype(float)
    _,labels,stats,_=cv2.connectedComponentsWithStats(np.uint8(frame[:,:,3]>110))
    mask=labels==(1+stats[1:,cv2.CC_STAT_AREA].argmax())
    yy,xx=np.where(mask);top,bottom=yy.min(),yy.max()
    mid=np.median(xx);h=max(1,bottom-top)
    # Face-tone pixels above the collar exclude hands, shoes and most props.
    face=mask & (rgba[:,:,0]>rgba[:,:,2]*1.16) & (rgba[:,:,0]>145)
    fy,fx=np.where(face);sel=(fy>top+.19*h)&(fy<top+.60*h)
    hx=np.median(fx[sel]) if sel.sum()>8 else mid
    hy=np.median(fy[sel]) if sel.sum()>8 else top+.4*h
    feet=yy>top+.76*h
    left=yy[feet&(xx<mid)];right=yy[feet&(xx>=mid)]
    dy=np.percentile(left,94)-np.percentile(right,94) if len(left) and len(right) else 0
    return np.array([hx,hy,bottom,dy,mid,h])

def extract(clip,ffmpeg):
    raw=subprocess.run([str(ffmpeg),"-v","error","-c:v","libvpx-vp9","-i",str(clip),
        "-vf",f"fps={FPS},scale=320:180","-f","rawvideo","-pix_fmt","rgba","-"],check=True,capture_output=True).stdout
    rows=np.array([measure(f) for f in np.frombuffer(raw,np.uint8).reshape(-1,180,320,4)])
    h=np.median(rows[:,5]);center=rows[:3].mean(axis=0)
    signals=np.column_stack(((rows[:,0]-rows[:,4]-(center[0]-center[4]))/h,
        (center[1]-rows[:,1])/h,(center[2]-rows[:,2])/h,rows[:,3]/h))
    signals=np.clip(signals,[-.12,-.18,-.12,-.15],[.12,.18,.12,.15])
    smooth=cv2.GaussianBlur(signals,(1,5),.85)
    fade=np.linspace(0,1,8)[:,None];smooth[-8:]=smooth[-8:]*(1-fade)+smooth[0]*fade
    return {"source":clip.stem,"fps":FPS,"samples":np.round(smooth,4).tolist()}

if __name__=="__main__":
    p=argparse.ArgumentParser()
    for name in ["videos","ffmpeg","output"]:p.add_argument(name,type=pathlib.Path)
    a=p.parse_args()
    output={key:extract(next(a.videos.rglob(name+".webm")),a.ffmpeg) for key,name in CLIPS.items()}
    a.output.write_text(json.dumps(output,ensure_ascii=False,separators=(",",":")),"utf-8")
