import os,sys,subprocess,time,json
from playwright.sync_api import sync_playwright
# Dog Race in two real browsers: A joins first and taps slowly, B joins second and taps as fast as it can.
# The reported bug: the one who crosses the line first was ranked 2nd because ranks followed join order.
SRC=sys.argv[1]; TAG=sys.argv[2]; PORT=sys.argv[3] if len(sys.argv)>3 else '3141'
import tempfile
D=os.environ.get('OUT') or os.path.join(tempfile.gettempdir(),'cozydogs_browser_tests');os.makedirs(D,exist_ok=True)   # screenshots + temp data files go here
data=f'{D}/data_{TAG}.json'
for f in (data,data+'.bak'):
    if os.path.exists(f): os.remove(f)
env=dict(os.environ,PORT=PORT,DATA=data,CD_TEST='1',CD_MPWAIT='5000')
env.pop('SUPABASE_URL',None);env.pop('SUPABASE_KEY',None)
srv=subprocess.Popen(['node',SRC+'/server.js'],cwd=SRC,env=env,stdout=open(f'{D}/srv_{TAG}.log','w'),stderr=subprocess.STDOUT)
time.sleep(1.5)
URL=f'http://localhost:{PORT}'
res=[]
def ck(c,n):
    res.append(bool(c));print('PASS' if c else 'FAIL',n,flush=True)
def login(b,user):
    ctx=b.new_context(viewport={'width':1280,'height':800},device_scale_factor=1)
    pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append('PAGEERR '+str(e)));pg.on('console',lambda m:errs.append(m.text) if m.type=='error' else None)
    pg.goto(URL);pg.wait_for_timeout(600)
    pg.click('#tReg');pg.fill('#rUser',user);pg.fill('#rMail','m@t.co');pg.fill('#rPass','secret1');pg.click('#fReg button[type=submit]')
    pg.wait_for_selector('#game.on',timeout=8000);pg.wait_for_timeout(1200)
    pg.evaluate("document.querySelectorAll('.coach,.tut').forEach(o=>o.classList.add('hidden'));document.querySelectorAll('#mods .ov').forEach(o=>o.remove())")
    return ctx,pg,errs
def join_race(pg):
    pg.evaluate("DO.games()");pg.wait_for_timeout(400)
    pg.evaluate("document.querySelector('#mods [data-mod=games] .gmcard.og[data-g=race]').scrollIntoView({block:'center'})")
    pg.click('#mods [data-mod=games] .gmcard.og[data-g=race]');pg.wait_for_timeout(500)
try:
  with sync_playwright() as p:
    b=p.chromium.launch()
    ca,pa,ea=login(b,'raceFirst')
    cb,pb,eb=login(b,'raceSecond')
    join_race(pa);pa.wait_for_timeout(700)      # A is in the lobby first
    join_race(pb)                                 # B joins second
    ck(pa.evaluate("MP.g=='race'") and pb.evaluate("MP.g=='race'"),'both browsers are in the race lobby')
    pa.wait_for_function("MP.state==='play'",timeout=15000);pb.wait_for_function("MP.state==='play'",timeout=15000)
    names=pb.evaluate("MP.pl.map(x=>x.n)")
    print('players',names)
    ck(names==['raceFirst','raceSecond'],'join order: A first, B second (two humans, no bot)')
    pb.screenshot(path=f'{D}/{TAG}_race_B_play.png')
    # B taps as fast as the server allows (alternating sides, ~75 ms apart); A taps slowly (~210 ms)
    t0=time.time();sa=0;sb=0;na=0;fin_b=None
    while time.time()-t0<40:
        if pb.query_selector('#mods [data-mod=mp] [data-do=mpagain]') and pa.query_selector('#mods [data-mod=mp] [data-do=mpagain]'): break
        now=time.time()-t0
        pb.keyboard.press('a' if sb==0 else 'd');sb^=1
        if int(now/0.21)>na: pa.keyboard.press('a' if sa==0 else 'd');sa^=1;na=int(now/0.21)
        if fin_b is None and pb.evaluate("MP.fin&&MP.fin[1]"): fin_b=now
        pb.wait_for_timeout(60)
    took=time.time()-t0
    print('B crossed the line after %s s, results on screen after %.1f s'%(None if fin_b is None else round(fin_b,1),took))
    pb.wait_for_selector('#mods [data-mod=mp] [data-do=mpagain]',timeout=25000)
    pa.wait_for_selector('#mods [data-mod=mp] [data-do=mpagain]',timeout=25000)
    def rows(pg):
        return pg.evaluate("""()=>{const o=document.querySelector('#mods [data-mod=mp]');return {head:(o.querySelector('h3,.big,.rwhead')||{}).textContent||'',rows:[...o.querySelectorAll('.list .li')].map(e=>({medal:e.querySelector('b').textContent.trim(),name:e.querySelector('.g b').textContent.trim(),sub:e.querySelector('.g small').textContent.trim()}))}}""")
    ra=rows(pa);rb=rows(pb)
    print('A sees',json.dumps(ra,ensure_ascii=False));print('B sees',json.dumps(rb,ensure_ascii=False))
    pb.screenshot(path=f'{D}/{TAG}_race_B_end.png');pa.screenshot(path=f'{D}/{TAG}_race_A_end.png')
    ck(rb['rows'][0]['name']=='raceSecond' and rb['rows'][0]['medal']=='🥇','B (joined 2nd, crossed the line first) is shown as 🥇 on top of the list')
    ck(ra['rows'][0]['name']=='raceSecond' and ra['rows'][0]['medal']=='🥇','A sees the same winner')
    ck([x['name'] for x in ra['rows']]==[x['name'] for x in rb['rows']],'both players see the same order')
    ck(ra['rows'][-1]['name']=='raceFirst','the slower player is last')
    # finish times of the ones who finished are ascending down the list
    fts=[float(x['sub'][:-1]) for x in rb['rows'] if x['sub'].endswith('s') and x['sub'][:-1].replace('.','').isdigit()]
    ck(fts==sorted(fts) and len(fts)>=1,'finish times ascend down the list '+str(fts))
    coinsB=pb.evaluate("MP.res.me.coins");coinsA=pa.evaluate("MP.res.me.coins")
    ck(pb.evaluate("MP.res.me.rank")==1 and pa.evaluate("MP.res.me.rank")==2,'ranks reported to the clients: B=1, A=2 (%s/%s)'%(pb.evaluate("MP.res.me.rank"),pa.evaluate("MP.res.me.rank")))
    ck(coinsB>coinsA,'the winner is paid more than the last place (%s vs %s)'%(coinsB,coinsA))
    ck(not [e for e in ea+eb if 'favicon' not in e],'no console errors %s'%(ea+eb)[:3])
    ca.close();cb.close();b.close()
finally:
  srv.terminate()
print('RESULT',sum(res),'/',len(res))
sys.exit(0 if all(res) else 1)
