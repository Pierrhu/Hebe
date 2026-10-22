import subprocess,sys
from playwright.sync_api import sync_playwright
P='/tmp/claude-0/-home-claude/197c3241-6a05-5a12-bc06-458935c23ce4/scratchpad/promo/'
FPS=60;DUR=36.0;out=sys.argv[1]
ff=subprocess.Popen(['ffmpeg','-y','-loglevel','error','-f','image2pipe','-framerate',str(FPS),'-c:v','mjpeg','-i','-','-vf','tmix=frames=2,fps=30','-c:v','libx264','-preset','slow','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',out],stdin=subprocess.PIPE)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1080,'height':1350})
    pg.goto('file://'+P+'hero3.html'); pg.evaluate('ready'); pg.wait_for_timeout(400)
    for i in range(int(DUR*FPS)):
        pg.evaluate(f'render({i/FPS})'); ff.stdin.write(pg.screenshot(type='jpeg',quality=94))
    b.close()
ff.stdin.close(); ff.wait()
