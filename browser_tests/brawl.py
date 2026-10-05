import os,sys,subprocess,time,json,random
from playwright.sync_api import sync_playwright
# Dog Brawl in a real browser: hub -> fighter chooser -> lobby -> a whole fight against bots (real clicks/taps) -> results.
SRC=sys.argv[1]; TAG=sys.argv[2]; PORT=sys.argv[3]; BRFAST=sys.argv[4] if len(sys.argv)>4 else '4'
VIEWS=sys.argv[5].split(',') if len(sys.argv)>5 else ['desk','portrait','land']
import tempfile
D=os.environ.get('OUT') or os.path.join(tempfile.gettempdir(),'cozydogs_browser_tests');os.makedirs(D,exist_ok=True)   # screenshots + temp data files go here
data=f'{D}/data_{TAG}.json'
for f in (data,data+'.bak'):
    if os.path.exists(f): os.remove(f)
env=dict(os.environ,PORT=PORT,DATA=data,CD_TEST='1',CD_MPWAIT='1200',CD_BRFAST=BRFAST)
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
        pg.click('#tReg');pg.fill('#rUser','bw'+name[:4]);pg.fill('#rMail','m@t.co');pg.fill('#rPass','secret1');pg.click('#fReg button[type=submit]')
        pg.wait_for_selector('#game.on',timeout=8000);pg.wait_for_timeout(1500)
        pg.evaluate("document.querySelectorAll('.coach,.tut').forEach(o=>o.classList.add('hidden'));document.querySelectorAll('#mods .ov').forEach(o=>o.remove())")
        def tapel(sel):
            if touch: pg.tap(sel)
            else: pg.click(sel)
        # ---------------- hub
        pg.evaluate("DO.games()");pg.wait_for_timeout(500)
        hub=pg.evaluate("""()=>{const og=[...document.querySelectorAll('#mods [data-mod=games] .gmcard.og')].map(e=>e.dataset.g);const solo=[...document.querySelectorAll('#mods [data-mod=games] .gmcard:not(.og)')].map(e=>e.dataset.g).filter(Boolean);return {og,solo}}""")
        ck(hub['og'][0]=='brawl' and 'rps' in hub['og'],f'[{name}] hub: Dog Brawl and Rock-Paper-Scissors are in the ONLINE list {hub["og"]}')
        ck('rps' not in hub['solo'],f'[{name}] hub: RPS is gone from the solo list {hub["solo"]}')
        pg.screenshot(path=f'{D}/{TAG}_{name}_1hub.png')
        # ---------------- chooser
        pg.evaluate("document.querySelector('#mods [data-mod=games] .gmcard.og[data-g=brawl]').scrollIntoView({block:'center'})")
        tapel('#mods [data-mod=games] .gmcard.og[data-g=brawl]');pg.wait_for_timeout(700)
        ck(pg.evaluate("!!document.querySelector('#mods .ov[data-mod=bpick]')"),f'[{name}] tapping the card opens the fighter chooser')
        ch=pg.evaluate("""()=>{const o=document.querySelector('#mods .ov[data-mod=bpick]');return {cards:o.querySelectorAll('.bpc').length,sel:o.querySelectorAll('.bpc.sel').length,stats:o.querySelectorAll('.bstat').length,skills:o.querySelectorAll('.bsk2').length,go:!!o.querySelector('[data-do=brgo]:not([disabled])')}}""")
        ck(ch['cards']>=1 and ch['sel']==1 and ch['stats']==4 and ch['skills']==2 and ch['go'],f'[{name}] chooser shows the dog, 4 stats, 2 skills, a Fight button {ch}')
        pg.screenshot(path=f'{D}/{TAG}_{name}_2pick.png')
        tapel('#mods .ov[data-mod=bpick] [data-do=brhelp]');pg.wait_for_timeout(400)
        ck(pg.evaluate("document.querySelectorAll('#mods .ov[data-mod=brhelp] .bsk2').length")==13,f'[{name}] rules window lists all 13 skills')
        pg.screenshot(path=f'{D}/{TAG}_{name}_2help.png')
        pg.evaluate("document.querySelector('#mods .ov[data-mod=brhelp]').remove()")
        tapel('#mods .ov[data-mod=bpick] [data-do=brgo]');pg.wait_for_timeout(500)
        ck(pg.evaluate("MP.g=='brawl' && !!document.querySelector('#mods .ov[data-mod=mp]')"),f'[{name}] Find a fight -> lobby window')
        # ---------------- arena
        pg.wait_for_function("BW.on===true",timeout=8000)
        pg.wait_for_timeout(600)
        info=pg.evaluate("""()=>({n:BW.N,cards:document.querySelectorAll('.bwc').length,acts:document.querySelectorAll('.bact').length,cv:!!document.querySelector('#bwc'),bots:BW.pl.filter(p=>p.bot).length})""")
        ck(info['n']==3 and info['cards']==3 and info['acts']==4 and info['cv'] and info['bots']==2,f'[{name}] arena: 3 fighter cards, 4 move buttons, canvas {info}')
        pg.screenshot(path=f'{D}/{TAG}_{name}_3count.png')
        pg.wait_for_function("BW.ph==='ask'",timeout=9000);pg.wait_for_timeout(300)
        pg.screenshot(path=f'{D}/{TAG}_{name}_4ask.png')
        # ---------------- play the whole fight with real clicks
        rounds=0;shots=0;t_end=time.time()+110;last_round=-1;used=set();sawdmg=False
        while time.time()<t_end:
            if pg.query_selector('#mods [data-mod=mp] [data-do=mpagain]'): break
            st=pg.evaluate("({ph:BW.ph,r:BW.round,sent:BW.sent,al:BW.al[BW.me],en:BW.en[BW.me],on:BW.on})")
            if st['on'] and st['ph']=='ask' and not st['sent'] and st['al'] and st['r']!=last_round:
                last_round=st['r'];rounds+=1
                # sometimes pick another target first (tap an enemy card)
                if random.random()<.5:
                    foes=pg.evaluate("[...document.querySelectorAll('.bwc.foe:not(.out)')].map(e=>e.id)")
                    if foes: tapel('#'+random.choice(foes))
                    pg.wait_for_timeout(120)
                opts=pg.evaluate("[...document.querySelectorAll('#bacts .bact:not(.off)')].map(e=>e.dataset.k)")
                k=random.choice(opts) if opts else 'atk'
                used.add(k)
                try: tapel(f'#bact-{k}')
                except Exception as e: print('  tap failed',k,str(e)[:100])
                pg.wait_for_timeout(250)
                ck(pg.evaluate("BW.sent===true && document.querySelector('#bact-%s').classList.contains('pick')"%k),f'[{name}] round {st["r"]}: move "{k}" locked in and highlighted')
                if shots<2 and k in('atk','s0','s1'):
                    pg.wait_for_timeout(900 if BRFAST=='1' else 400);pg.screenshot(path=f'{D}/{TAG}_{name}_5play{shots}.png');shots+=1
            pg.wait_for_timeout(120)
        done=pg.query_selector('#mods [data-mod=mp] [data-do=mpagain]')
        ck(done is not None,f'[{name}] the fight ends with the result window after {rounds} rounds (moves used: {sorted(used)})')
        if not done:
            pg.screenshot(path=f'{D}/{TAG}_{name}_stuck.png');print(errs[:5]);ctx.close();continue
        pg.wait_for_timeout(400)
        rs=pg.evaluate("""()=>{const o=document.querySelector('#mods [data-mod=mp]');return {rows:o.querySelectorAll('.list .li').length,dmg:[...o.querySelectorAll('.list .li small')].map(e=>e.textContent),coins:(o.querySelector('.rwbox')||{}).textContent}}""")
        ck(rs['rows']==3 and all('⚔' in x for x in rs['dmg']),f'[{name}] result list: 3 rows with damage {rs["dmg"]}')
        pg.screenshot(path=f'{D}/{TAG}_{name}_6end.png')
        # play again -> chooser again, cancel back out
        tapel('#mods [data-mod=mp] [data-do=mpagain]');pg.wait_for_timeout(600)
        ck(pg.evaluate("!!document.querySelector('#mods .ov[data-mod=bpick]') && !document.querySelector('#mods .ov[data-mod=mp]')"),f'[{name}] "Play again" reopens the fighter chooser')
        pg.evaluate("document.querySelector('#mods .ov[data-mod=bpick]').remove()")
        ck(pg.evaluate("MP.state")in('idle','done') and not [e for e in errs if 'favicon' not in e],f'[{name}] no console errors {errs[:3]}')
        ctx.close()
    b.close()
finally:
  srv.terminate()
print('RESULT',sum(res),'/',len(res))
sys.exit(0 if all(res) else 1)
