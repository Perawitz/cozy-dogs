import os,sys,subprocess,time,json
from playwright.sync_api import sync_playwright
# Leaving Dog Brawl in the middle of a fight: "Leave" button -> Cancel keeps fighting, -> Confirm leaves; the header X works the same way;
# afterwards a brand-new fight can be started right away (no stale state on the client or the server).
SRC=sys.argv[1]; TAG=sys.argv[2]; PORT=sys.argv[3]; VIEWS=sys.argv[4].split(',') if len(sys.argv)>4 else ['desk','portrait']
import tempfile
D=os.environ.get('OUT') or os.path.join(tempfile.gettempdir(),'cozydogs_browser_tests');os.makedirs(D,exist_ok=True)   # screenshots + temp data files go here
data=f'{D}/data_{TAG}.json'
for f in (data,data+'.bak'):
    if os.path.exists(f): os.remove(f)
env=dict(os.environ,PORT=PORT,DATA=data,CD_TEST='1',CD_MPWAIT='1200',CD_BRFAST='1')
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
        pg.click('#tReg');pg.fill('#rUser','bl'+name[:4]);pg.fill('#rMail','m@t.co');pg.fill('#rPass','secret1');pg.click('#fReg button[type=submit]')
        pg.wait_for_selector('#game.on',timeout=8000);pg.wait_for_timeout(1500)
        pg.evaluate("document.querySelectorAll('.coach,.tut').forEach(o=>o.classList.add('hidden'));document.querySelectorAll('#mods .ov').forEach(o=>o.remove())")
        def tap(sel):
            if touch: pg.tap(sel)
            else: pg.click(sel)
        def start_fight():
            pg.evaluate("DO.games()");pg.wait_for_timeout(500)
            pg.evaluate("document.querySelector('#mods [data-mod=games] .gmcard.og[data-g=brawl]').scrollIntoView({block:'center'})")
            tap('#mods [data-mod=games] .gmcard.og[data-g=brawl]');pg.wait_for_timeout(600)
            tap('#mods .ov[data-mod=bpick] [data-do=brgo]')
            pg.wait_for_function("BW.on===true",timeout=9000);pg.wait_for_function("BW.ph==='ask'",timeout=12000);pg.wait_for_timeout(300)
        # ---- 1) Leave button, first "Cancel", then "Leave"
        start_fight();ck(True,f'[{name}] fight 1 started and is asking for a move')
        tap('#mods [data-mod=mp] [data-do=mpleave]');pg.wait_for_timeout(300)
        ck(pg.evaluate("!!document.querySelector('#askYes')"),f'[{name}] Leave asks for confirmation')
        pg.screenshot(path=f'{D}/{TAG}_{name}_ask.png')
        tap('#mods .ov[data-mod=ask] [data-do=closemod]');pg.wait_for_timeout(300)
        ck(pg.evaluate("BW.on===true && !document.querySelector('#askYes') && !!document.querySelector('#mods .ov[data-mod=mp]')"),f'[{name}] "Cancel" keeps fighting')
        tap('#mods [data-mod=mp] [data-do=mpleave]');pg.wait_for_timeout(300);tap('#askYes');pg.wait_for_timeout(600)
        st=pg.evaluate("({bw:BW.on,mp:MP.state,g:MP.g,win:!!document.querySelector('#mods .ov[data-mod=mp]'),ask:!!document.querySelector('#mods .ov[data-mod=ask]'),cls:(document.querySelector('#mods .ov[data-mod=mp] .mod')||{}).className||''})")
        ck(st['bw']==False and not st['win'] and not st['ask'] and st['mp'] in ('idle',None),f'[{name}] confirming leaves the fight and closes the window {st}')
        # ---- 2) the server let go of us: a new fight starts right away
        start_fight();ck(True,f'[{name}] fight 2 starts right after leaving')
        # ---- 3) the header X behaves the same way
        tap('#mods .ov[data-mod=mp] [data-do=closemod][data-id=mp]');pg.wait_for_timeout(300)
        ck(pg.evaluate("!!document.querySelector('#askYes')"),f'[{name}] header X asks for confirmation during a fight')
        tap('#askYes');pg.wait_for_timeout(600)
        ck(pg.evaluate("BW.on===false && !document.querySelector('#mods .ov[data-mod=mp]')"),f'[{name}] ...and leaves')
        # ---- 4) the lobby can also be cancelled (before the fight starts) and a third fight still works
        pg.evaluate("DO.games()");pg.wait_for_timeout(400)
        pg.evaluate("document.querySelector('#mods [data-mod=games] .gmcard.og[data-g=brawl]').scrollIntoView({block:'center'})")
        tap('#mods [data-mod=games] .gmcard.og[data-g=brawl]');pg.wait_for_timeout(500);tap('#mods .ov[data-mod=bpick] [data-do=brgo]');pg.wait_for_timeout(500)
        ck(pg.evaluate("MP.state==='lobby'"),f'[{name}] in the lobby')
        tap('#mods [data-mod=mp] [data-do=mpcancel]');pg.wait_for_timeout(600)
        ck(pg.evaluate("!document.querySelector('#mods .ov[data-mod=mp]') && (MP.state==='idle'||MP.state==null)"),f'[{name}] lobby Cancel closes the window')
        pg.wait_for_timeout(1800)       # (the cancelled lobby must not start a match afterwards)
        ck(pg.evaluate("BW.on===false && !document.querySelector('#mods .ov[data-mod=mp]')"),f'[{name}] a cancelled lobby never turns into a match')
        start_fight();ck(True,f'[{name}] fight 3 starts normally')
        # ---- 5) the connection drops in the middle of a fight (tunnel, wifi -> 4G): the arena must not get stuck, and the player can fight again after reconnecting
        pg.evaluate("S.ws.close()");pg.wait_for_timeout(600)
        ck(pg.evaluate("BW.on===false && !document.querySelector('#mods .ov[data-mod=mp]')"),f'[{name}] a dropped connection closes the arena')
        pg.wait_for_function("S.ws&&S.ws.readyState===1&&S.loaded===true",timeout=20000);pg.wait_for_timeout(2500)
        pg.evaluate("document.querySelectorAll('#mods .ov').forEach(o=>o.remove())")
        start_fight();ck(True,f'[{name}] after reconnecting, fight 4 starts normally')
        ck(not [e for e in errs if 'favicon' not in e],f'[{name}] no console errors {errs[:3]}')
        ctx.close()
    b.close()
finally:
  srv.terminate()
print('RESULT',sum(res),'/',len(res))
sys.exit(0 if all(res) else 1)
