import subprocess,sys
from playwright.sync_api import sync_playwright
import os; P=os.path.dirname(os.path.abspath(__file__))+'/'
FPS=30; DUR=30.0; out=sys.argv[1]
ff=subprocess.Popen(['ffmpeg','-y','-loglevel','error','-f','image2pipe','-framerate',str(FPS),'-c:v','mjpeg','-i','-','-c:v','libx264','-preset','slow','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',out],stdin=subprocess.PIPE)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1080,'height':1920})
    pg.goto('file://'+P+'promo.html'); pg.evaluate('ready'); pg.wait_for_timeout(500)
    n=int(DUR*FPS)
    for i in range(n):
        pg.evaluate(f'render({i/FPS})')
        ff.stdin.write(pg.screenshot(type='jpeg',quality=94))
        if i%150==0: print(i,flush=True)
    b.close()
ff.stdin.close(); ff.wait()
