# Test du parcours complet dans le navigateur, avec un foyer déjà renseigné (2 personnes).
# Lancer d'abord, à la racine du projet : python3 -m http.server 8765
# puis : python3 outils/tests/parcours.py
# Deux passages : avec autocuiseur, puis sans (cuisson à la casserole).
import os, asyncio, json
os.makedirs('outils/tests/captures', exist_ok=True)
from playwright.async_api import async_playwright
URL = 'http://localhost:8765/index.html'

def household(equipment):
    base = dict(activity=2, phase=0, free=[], breakfast='mix', whey=True, lactose=0, gluten=0, targets=None)
    return {
        'version': 1, 'onboarded': True, 'onboardedOnce': True, 'activeId': 'm1', 'budget': None,
        'appliances': {'airfryer': 5, 'cooker': 6}, 'equipment': equipment,
        'members': [
            dict(base, id='m1', name='Pierre', sex='male', age=24, height=1.85, weight=97, bodyfat=20, protocol='P4', formula='classique'),
            dict(base, id='m2', name='Léa', sex='female', age=24, height=1.65, weight=60, bodyfat=27, protocol='P2', formula='classique'),
        ],
    }

async def run(p, label, equipment):
    b = await p.chromium.launch()
    pg = await b.new_page(viewport={'width': 400, 'height': 860}, device_scale_factor=2)
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append('console:' + m.text) if m.type == 'error' else None)
    await pg.route('**/fonts.googleapis.com/**', lambda r: r.fulfill(body='', content_type='text/css'))
    await pg.goto(URL)
    await pg.evaluate(f"localStorage.clear(); localStorage.setItem('hebe_household', {json.dumps(json.dumps(household(equipment)))})")
    await pg.goto(URL); await pg.wait_for_timeout(600)
    found = {}
    rice_weeks = 0
    # plusieurs tirages : il faut une semaine avec un plat au riz pour vérifier sa cuisson
    for attempt in range(8):
        btn = await pg.query_selector('.hb-generate') or await pg.query_selector('.hb-regen')
        if btn:
            await btn.click(); await pg.wait_for_timeout(400)
            again = await pg.query_selector('.hb-generate')
            if again: await again.click()
            await pg.wait_for_timeout(2000)
        await pg.evaluate("window._nav('cook')"); await pg.wait_for_timeout(600)
        cook = await pg.inner_text('body')
        if 'g de riz' in cook:
            rice_weeks += 1
            # les étapes s'affichent une par une : on avance dans la phase du riz jusqu'au temps de cuisson
            want = '20 minutes sous pression' if equipment['autocuiseur'] else '35 minutes'
            ok = want in cook
            for _ in range(2):
                if ok: break
                nxt = await pg.query_selector('text=Étape suivante')
                if not nxt: break
                await nxt.click(); await pg.wait_for_timeout(300)
                ok = want in await pg.inner_text('body')
            found['cuisson riz (session)'] = ok
            await pg.screenshot(path=f'outils/tests/captures/{label}_cuisiner.png', full_page=True)
            break
        await pg.evaluate("window._nav('week')"); await pg.wait_for_timeout(400)
    await pg.evaluate("window._nav('shopping')"); await pg.wait_for_timeout(600)
    shop = await pg.inner_text('body')
    found['courses : riz complet'] = 'Riz complet' in shop if rice_weeks else 'pas de riz cette semaine'
    found['courses : ancien « Riz » seul'] = any(l.strip() == 'Riz' for l in shop.split('\n'))
    await pg.screenshot(path=f'outils/tests/captures/{label}_courses.png', full_page=True)
    await pg.evaluate("window._nav('recipes')"); await pg.wait_for_timeout(500)
    card = await pg.query_selector('.recipe-card[data-id="W14"]')
    if card:
        await card.click(); await pg.wait_for_timeout(500)
        det = await pg.inner_text('body')
        found['fiche W14 : nom'] = 'riz complet' in det
        found['fiche W14 : cuisson'] = ('20 minutes sous pression' in det) if equipment['autocuiseur'] else ('35 minutes' in det)
        await pg.screenshot(path=f'outils/tests/captures/{label}_fiche_W14.png', full_page=True)
    await pg.evaluate("window._nav('settings')"); await pg.wait_for_timeout(400)
    await pg.evaluate("window._nav('week')"); await pg.wait_for_timeout(400)
    await pg.screenshot(path=f'outils/tests/captures/{label}_semaine.png', full_page=True)
    print(label, json.dumps(found, ensure_ascii=False), '| erreurs :', errs)
    await b.close()

async def reglage(p):
    """Réglage « Riz et pâtes » par de vrais clics : Classiques, puis Plat par plat sur la fiche du butter chicken."""
    eq = {'plaque': True, 'four': False, 'airfryer': True, 'autocuiseur': True, 'microondes': True, 'mixeur': True}
    b = await p.chromium.launch()
    pg = await b.new_page(viewport={'width': 400, 'height': 860}, device_scale_factor=2)
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append('console:' + m.text) if m.type == 'error' else None)
    await pg.goto(URL)
    await pg.evaluate(f"localStorage.clear(); localStorage.setItem('hebe_household', {json.dumps(json.dumps(household(eq)))})")
    await pg.goto(URL); await pg.wait_for_timeout(600)
    await pg.click('.hb-generate'); await pg.wait_for_timeout(2000)
    found = {}
    async def fiche():
        await pg.evaluate("window._nav('recipes')"); await pg.wait_for_timeout(400)
        await pg.click('.recipe-card[data-id="W14"]'); await pg.wait_for_timeout(500)
        return await pg.inner_text('body')
    # 1. Classiques
    await pg.evaluate("window._nav('settings')"); await pg.wait_for_timeout(500)
    found['carte présente'] = await pg.query_selector('.dt-staples') is not None
    await pg.click('[data-staples="classique"]'); await pg.wait_for_timeout(400)
    el = await pg.query_selector('.dt-staples'); await el.scroll_into_view_if_needed()
    await pg.screenshot(path='outils/tests/captures/reglage_classiques.png')
    det = await fiche()
    found['classiques : nom basmati'] = 'riz basmati' in det
    found['classiques : riz blanc 5 min'] = 'Riz blanc' in det and '5 minutes sous pression' in det
    found['classiques : pas de choix sur la fiche'] = await pg.query_selector('.rd-staple') is None
    # 2. Plat par plat
    await pg.evaluate("window._nav('settings')"); await pg.wait_for_timeout(500)
    await pg.click('[data-staples="plat"]'); await pg.wait_for_timeout(400)
    el = await pg.query_selector('.dt-staples'); await el.scroll_into_view_if_needed()
    await pg.screenshot(path='outils/tests/captures/reglage_plat_par_plat.png')
    det = await fiche()
    found['plat par plat : complet par défaut'] = 'riz complet' in det and await pg.query_selector('.rd-staple') is not None
    await pg.click('.rd-staple [data-staple="classique"]'); await pg.wait_for_timeout(400)
    det = await pg.inner_text('body')
    found['plat par plat : passage au blanc'] = 'riz basmati' in det and 'Riz blanc' in det
    el = await pg.query_selector('.rd-staple'); await el.scroll_into_view_if_needed()
    await pg.evaluate("window.scrollBy(0, 120)")
    await pg.screenshot(path='outils/tests/captures/reglage_fiche.png')
    # 3. retour au complet par défaut
    await pg.evaluate("window._nav('settings')"); await pg.wait_for_timeout(500)
    await pg.click('[data-staples="complet"]'); await pg.wait_for_timeout(300)
    det = await fiche()
    found['complets : retour au riz complet'] = 'riz complet' in det and await pg.query_selector('.rd-staple') is None
    print('réglage', json.dumps(found, ensure_ascii=False), '| erreurs :', errs)
    await b.close()

async def main():
    async with async_playwright() as p:
        await run(p, 'autocuiseur', {'plaque': True, 'four': False, 'airfryer': True, 'autocuiseur': True, 'microondes': True, 'mixeur': True})
        await reglage(p)
        await run(p, 'casserole', {'plaque': True, 'four': True, 'airfryer': False, 'autocuiseur': False, 'microondes': True, 'mixeur': False})
asyncio.run(main())
