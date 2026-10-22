import sys
from playwright.sync_api import sync_playwright
from PIL import Image
import os; P=os.path.dirname(os.path.abspath(__file__))+'/'
ts=[float(x) for x in sys.argv[1:]]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1080,'height':1920}); e=[]; pg.on('pageerror',lambda x:e.append(str(x)))
    pg.goto('file://'+P+'promo.html'); pg.evaluate('ready'); pg.wait_for_timeout(300)
    ims=[]
    for t in ts:
        pg.evaluate(f'render({t})'); pg.screenshot(path=P+'s.png'); ims.append(Image.open(P+'s.png').resize((270,480)))
    print(e); b.close()
cols=8; c=Image.new('RGB',(cols*276,((len(ims)+cols-1)//cols)*486),'#666')
for i,im in enumerate(ims): c.paste(im,((i%cols)*276,(i//cols)*486))
c.save(P+'stills.png')
