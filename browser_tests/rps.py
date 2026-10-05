import os,sys,subprocess,time,json,re
from playwright.sync_api import sync_playwright
# Rock-Paper-Scissors as the player sees it: online section of the hub -> searching -> (nobody there) bot joins -> pick -> result -> play again
SRC=sys.argv[1]; TAG=sys.argv[2]; PORT=sys.argv[3]
VIEWS=sys.argv[4].split(',') if len(sys.argv)>4 else ['desk','portrait']
import tempfile
D=os.environ.get('OUT') or os.path.join(tempfile.gettempdir(),'cozydogs_browser_tests');os.makedirs(D,exist_ok=True)   # screenshots + temp data files go here
data=f'{D}/data_{TAG}.json'
for f in (data,data+'.bak'):
    if os.path.exists(f): os.remove(f)
env=dict(os.environ,PORT=PORT,DATA=data,CD_TEST='1',CD_MPWAIT='1500')
env.pop('SUPABASE_URL',None);env.pop('SUPABASE_KEY',None)
srv=subprocess.Popen(['node',SRC+'/server.js'],cwd=SRC,env=env,stdout=open(f'{D}/srv_{TAG}.log','w'),stderr=subprocess.STDOUT)
time.sleep(1.5)
URL=f'http://localhost:{PORT}'
res=[]
def ck(c,n):
    res.append(bool(c));print('PASS' if c else 'FAIL',n,flush=True)
ALL={'desk':(1280,800,False),'portrait':(390,844,True),'land':(844,390,True)}
try:
  with sync_playwright() as p:
    b=p.chromium.launch()
    for name in VIEWS:
        w,h,touch=ALL[name]
        ctx=b.new_context(viewport={'width':w,'height':h},is_mobile=touch,has_touch=touch,device_scale_factor=1)
        pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append('PAGEERR '+str(e)));pg.on('console',lambda m:errs.append(m.text) if m.type=='error' else None)
        pg.goto(URL);pg.wait_for_timeout(600)
        pg.click('#tReg');pg.fill('#rUser','rps'+name[:4]);pg.fill('#rMail','m@t.co');pg.fill('#rPass','secret1');pg.click('#fReg button[type=submit]')
        pg.wait_for_selector('#game.on',timeout=8000);pg.wait_for_timeout(1300)
        pg.evaluate("document.querySelectorAll('.coach,.tut').forEach(o=>o.classList.add('hidden'));document.querySelectorAll('#mods .ov').forEach(o=>o.remove())")
        tap=(lambda sel:pg.tap(sel)) if touch else (lambda sel:pg.click(sel))
        pg.evaluate("DO.games()");pg.wait_for_timeout(500)
        # the card sits in the ONLINE block (before the solo header) and not among the solo games
        lay=pg.evaluate("""()=>{const ov=document.querySelector('#mods [data-mod=games]');const cards=[...ov.querySelectorAll('.gmcard')];const r=ov.querySelector('.gmcard.og[data-g=rps]');const solo=cards.filter(c=>!c.classList.contains('og')).map(c=>c.dataset.g);return {rpsOnline:!!r,solo,order:cards.map(c=>c.dataset.g+(c.classList.contains('og')?'*':''))}}""")
        print(' hub order',lay['order'])
        ck(lay['rpsOnline'] and 'rps' not in lay['solo'],f'[{name}] RPS is in the online block, not among the solo mini games')
        pg.screenshot(path=f'{D}/{TAG}_{name}_1hub.png')
        pg.evaluate("document.querySelector('#mods [data-mod=games] .gmcard.og[data-g=rps]').scrollIntoView({block:'center'})")
        tap('#mods [data-mod=games] .gmcard.og[data-g=rps]');pg.wait_for_timeout(400)
        txt=pg.evaluate("(document.querySelector('#rpsb')||{}).textContent||''")
        ck('บอท' in txt,f'[{name}] searching screen tells that a bot joins when nobody is online: {txt.strip()[:70]!r}')
        pg.screenshot(path=f'{D}/{TAG}_{name}_2search.png')
        pg.wait_for_selector('#rpsb .rps button',timeout=8000);pg.wait_for_timeout(300)
        vs=pg.evaluate("document.querySelector('#rpsb .big').textContent")
        ck('🤖' in vs,f'[{name}] a bot opponent shows up: {vs.strip()!r}')
        pg.screenshot(path=f'{D}/{TAG}_{name}_3pick.png')
        coins0=pg.evaluate("S.me.coins")
        tap('#rpsb .rps button[data-k=R]');pg.wait_for_timeout(300)
        ck(pg.evaluate("document.querySelector('#rpsb .rps button[data-k=R]').classList.contains('on')"),f'[{name}] my pick is highlighted')
        pg.wait_for_selector('#rpsb [data-do=gstart]',timeout=12000);pg.wait_for_timeout(400)
        out=pg.evaluate("document.querySelector('#rpsb').textContent")
        gain=int(re.search(r'\+(\d+)',out).group(1))
        ck(gain in (0,3,15),f'[{name}] result screen shows a bot-sized reward (+{gain}: win 15 / draw 3 / lose 0)')
        pg.wait_for_timeout(400)
        ck(pg.evaluate("S.me.coins")-coins0==gain,f'[{name}] coins really went up by {gain} ({coins0} -> {pg.evaluate("S.me.coins")})')
        pg.screenshot(path=f'{D}/{TAG}_{name}_4result.png')
        # play again
        tap('#rpsb [data-do=gstart]');pg.wait_for_selector('#rpsb .rps button',timeout=9000)
        ck(True,f'[{name}] "Again" searches again and a bot comes back')
        # cancel from the searching screen (leave the match unplayed -> window closes without errors)
        pg.evaluate("document.querySelector('#mods .ov[data-mod=game] .x, #mods .ov[data-mod=game] [data-do=close]')&&0")
        pg.evaluate("closeMod('game')");pg.wait_for_timeout(300)
        # search + cancel
        pg.evaluate("DO.gstart({g:'rps'})");pg.wait_for_timeout(300);tap('#rpsb [data-do=rpscancel]');pg.wait_for_timeout(2200)
        ck(not pg.evaluate("modOpen('game')") and not pg.query_selector('#rpsb'),f'[{name}] Cancel while searching closes the window and no bot match starts later')
        ck(not [e for e in errs if 'favicon' not in e],f'[{name}] no console errors {errs[:3]}')
        ctx.close()
    b.close()
finally:
  srv.terminate()
print('RESULT',sum(res),'/',len(res))
sys.exit(0 if all(res) else 1)
