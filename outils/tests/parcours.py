# Test du parcours complet dans le navigateur.
# Lancer d'abord, à la racine du projet : python3 -m http.server 8765
# puis : python3 outils/tests/parcours.py
import os; os.makedirs('outils/tests/captures', exist_ok=True)
import asyncio, json
from playwright.async_api import async_playwright
URL='http://localhost:8765/index.html'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width':400,'height':860}, device_scale_factor=2)
        errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console:'+m.text) if m.type=='error' else None)
        # route google fonts to nothing (offline)
        await pg.route('**/fonts.googleapis.com/**', lambda r: r.fulfill(body='', content_type='text/css'))
        await pg.goto(URL); await pg.wait_for_timeout(500)
        await pg.screenshot(path='outils/tests/captures/s_empty.png', full_page=True)
        await pg.click('.hb-generate'); await pg.wait_for_timeout(2500)
        await pg.screenshot(path='outils/tests/captures/s_week.png', full_page=True)
        await pg.click('.today .link-btn'); await pg.wait_for_timeout(500)
        await pg.screenshot(path='outils/tests/captures/s_daysheet.png', full_page=False)
        await pg.click('.ds-close'); await pg.wait_for_timeout(300)
        await pg.evaluate("window._nav('cook')"); await pg.wait_for_timeout(600)
        await pg.click('.ck-step >> nth=0'); await pg.wait_for_timeout(200)
        await pg.screenshot(path='outils/tests/captures/s_batch.png', full_page=True)
        await pg.evaluate("window._nav('shopping')"); await pg.wait_for_timeout(600)
        await pg.screenshot(path='outils/tests/captures/s_shop.png', full_page=True)
        await pg.click('.shop-item >> nth=0'); await pg.wait_for_timeout(300)
        await pg.evaluate("window._nav('week')"); await pg.wait_for_timeout(300)
        await pg.click('.hb-regen'); await pg.wait_for_timeout(400)
        await pg.screenshot(path='outils/tests/captures/s_regen.png', full_page=False)
        await pg.click('.hb-generate'); await pg.wait_for_timeout(2500)
        await pg.evaluate("window._nav('recipes')"); await pg.wait_for_timeout(400)
        await pg.screenshot(path='outils/tests/captures/s_recipes.png')
        await pg.click('.recipe-card >> nth=0'); await pg.wait_for_timeout(400)
        await pg.screenshot(path='outils/tests/captures/s_detail.png', full_page=True)
        await pg.evaluate("window._nav('settings')"); await pg.wait_for_timeout(400)
        print('ERRORS:', errs)
        await b.close()
asyncio.run(main())
