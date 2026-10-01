import sys,time,subprocess
from Quartz import *
from PIL import Image
X,Y,W,H=1517,308,348,766
def win():
    o=subprocess.run(["osascript","-e",'tell application "System Events" to tell process "iPhone Mirroring" to get {position, size} of window 1'],capture_output=True,text=True).stdout.strip()
    v=[int(x) for x in o.split(", ")]; return v
def click(x,y):
    gx,gy=X+x,Y+y
    for t in (kCGEventLeftMouseDown,kCGEventLeftMouseUp):
        e=CGEventCreateMouseEvent(None,t,(gx,gy),kCGMouseButtonLeft); CGEventPost(kCGHIDEventTap,e); time.sleep(0.08)
def move(x,y):
    e=CGEventCreateMouseEvent(None,kCGEventMouseMoved,(X+x,Y+y),kCGMouseButtonLeft); CGEventPost(kCGHIDEventTap,e)
def scroll(dy,steps=10):
    for _ in range(steps):
        e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitPixel,1,dy); CGEventPost(kCGHIDEventTap,e); time.sleep(0.03)
def typ(s):
    subprocess.run(["osascript","-e",f'tell application "System Events" to keystroke "{s}"'])
def key(k):
    subprocess.run(["osascript","-e",f'tell application "System Events" to key code {k}'])
def shot(name):
    subprocess.run(["screencapture","-x",f"{sys.argv[1]}/_s.png"]); im=Image.open(f"{sys.argv[1]}/_s.png")
    sc=im.size[0]/1920; im.crop((int(X*sc),int(Y*sc),int((X+W)*sc),int((Y+H)*sc))).save(f"{sys.argv[1]}/{name}.png")
if __name__=="__main__":
    X,Y,W,H=win(); subprocess.run(["osascript","-e",'tell application "iPhone Mirroring" to activate']); time.sleep(1)
    cmd=sys.argv[2:]
    i=0
    while i<len(cmd):
        c=cmd[i]
        if c=="click": click(int(cmd[i+1]),int(cmd[i+2])); i+=3
        elif c=="type": typ(cmd[i+1]); i+=2
        elif c=="key": key(int(cmd[i+1])); i+=2
        elif c=="scroll": move(174,400); scroll(int(cmd[i+1])); i+=2
        elif c=="sleep": time.sleep(float(cmd[i+1])); i+=2
        elif c=="shot": shot(cmd[i+1]); i+=2
        else: i+=1
