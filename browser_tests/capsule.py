import os,sys,subprocess,time,json
from playwright.sync_api import sync_playwright
# Rapid-fire capsule test: mash the pull buttons faster than the server answers (simulated 250 ms latency on every outgoing frame),
# then make sure EVERY result screen can be closed with its OK button, one by one, and that nothing is stuck on top.
SRC=sys.argv[1]; TAG=sys.argv[2]; PORT=sys.argv[3] if len(sys.argv)>3 else '3131'
import tempfile
D=os.environ.get('OUT') or os.path.join(tempfile.gettempdir(),'cozydogs_browser_tests');os.makedirs(D,exist_ok=True)   # screenshots + temp data files go here
data=f'{D}/data_{TAG}.json'
for f in (data,data+'.bak'):
    if os.path.exists(f): os.remove(f)
env=dict(os.environ,PORT=PORT,DATA=data,CD_TEST='1',ADMIN_KEY='testadminkey123')
env.pop('SUPABASE_URL',None);env.pop('SUPABASE_KEY',None)
srv=subprocess.Popen(['node',SRC+'/server.js'],cwd=SRC,env=env,stdout=open(f'{D}/srv_{TAG}.log','w'),stderr=subprocess.STDOUT)
time.sleep(1.5)
URL=f'http://localhost:{PORT}'
res=[]
def ck(c,n):
    res.append(bool(c));print('PASS' if c else 'FAIL',n,flush=True)
LAT="""(()=>{const o=WebSocket.prototype.send;WebSocket.prototype.send=function(d){const s=this;setTimeout(()=>o.call(s,d),%d)}})()"""
try:
  with sync_playwright() as p:
    b=p.chromium.launch()
    for (w,h,name,touch) in [(1280,800,'desk',False),(390,844,'portrait',True),(844,390,'land',True)]:
        ctx=b.new_context(viewport={'width':w,'height':h},is_mobile=touch,has_touch=touch,device_scale_factor=1)
        pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('console',lambda m:errs.append(m.text) if m.type=='error' else None)
        pg.goto(URL);pg.wait_for_timeout(600)
        pg.click('#tReg');pg.fill('#rUser','cap'+name[:3]);pg.fill('#rMail','m@t.co');pg.fill('#rPass','secret1');pg.click('#fReg button[type=submit]')
        pg.wait_for_selector('#game.on',timeout=8000);pg.wait_for_timeout(1500)
        pg.evaluate("document.querySelectorAll('.coach,.tut').forEach(o=>o.classList.add('hidden'));document.querySelectorAll('#mods .ov').forEach(o=>o.remove())")
        pg.evaluate("send({t:'admin',key:'testadminkey123',coins:500000})");pg.wait_for_timeout(500)
        coins0=pg.evaluate("S.me.coins");ck(coins0>=100000,f'[{name}] test account has coins ({coins0})')
        pg.evaluate(LAT%250)          # from now on every message to the server takes 250 ms
        pg.evaluate("DO.capsule()");pg.wait_for_timeout(400)
        tap=(lambda sel:pg.tap(sel)) if touch else (lambda sel:pg.click(sel,timeout=3000))
        # --- mash the x10 button 5 times, 60 ms apart (all clicks land before the first answer is back)
        box=pg.evaluate("(()=>{const e=[...document.querySelectorAll('#mods [data-do=gacha]')].find(b=>b.dataset.n=='10'&&!b.dataset.tk);e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()")
        for i in range(5):
            if touch: pg.touchscreen.tap(box[0],box[1])
            else: pg.mouse.click(box[0],box[1])
            pg.wait_for_timeout(60)
        pg.wait_for_timeout(2600)   # answers + 900 ms egg animation
        n_ov=pg.evaluate("document.querySelectorAll('.reveal').length")
        print(f'[{name}] result screens on the page after mashing: {n_ov}')
        pg.screenshot(path=f'{D}/{TAG}_{name}_mash.png')
        coins1=pg.evaluate("S.me.coins")
        print(f'[{name}] coins spent: {coins0-coins1} ({(coins0-coins1)//1000} pulls of 10)')
        # --- close them all, only ever clicking the OK button that is really on top
        closed=0
        for k in range(12):
            cnt=pg.evaluate("document.querySelectorAll('.reveal').length")
            if cnt==0: break
            # the topmost element at the centre of the (last) OK button
            info=pg.evaluate("""()=>{const bs=[...document.querySelectorAll('.reveal #rcl, .reveal .rclose')];if(!bs.length)return null;const b=bs[bs.length-1],r=b.getBoundingClientRect(),e=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {n:bs.length,hit:e===b||b.contains(e),x:r.left+r.width/2,y:r.top+r.height/2}}""")
            if not info: pg.wait_for_timeout(300);continue
            if touch: pg.touchscreen.tap(info['x'],info['y'])
            else: pg.mouse.click(info['x'],info['y'])
            pg.wait_for_timeout(250)
            now=pg.evaluate("document.querySelectorAll('.reveal').length")
            if now<cnt: closed+=1
            else: print(f'  click {k}: OK button did nothing (hit={info["hit"]}, {cnt} screens)')
        left=pg.evaluate("document.querySelectorAll('.reveal').length")
        ck(left==0,f'[{name}] every result screen can be closed with OK ({left} stuck)')
        ck(pg.evaluate("!!document.querySelector('#mods .ov[data-mod=capsule]')"),f'[{name}] back on the capsule screen')
        ck(not errs,f'[{name}] no console errors {errs[:2]}')
        if left:
            pg.screenshot(path=f'{D}/{TAG}_{name}_stuck.png');ctx.close();continue
        # --- and a normal single pull still works end to end
        pg.evaluate(LAT%1)
        c2=pg.evaluate("S.me.coins");pg.evaluate("[...document.querySelectorAll('#mods [data-do=gacha]')].find(b=>b.dataset.n=='1'&&!b.dataset.tk).click()");pg.wait_for_timeout(1700)
        ck(pg.evaluate("document.querySelectorAll('.reveal').length")==1,f'[{name}] a single pull opens one result screen')
        pg.screenshot(path=f'{D}/{TAG}_{name}_single.png')
        pg.evaluate("document.querySelector('.reveal .rclose').click()");pg.wait_for_timeout(300)
        ck(pg.evaluate("document.querySelectorAll('.reveal').length")==0 and pg.evaluate("S.me.coins")==c2-100,f'[{name}] ...closes with OK and cost exactly 100 coins')
        # --- defensive path: three answers arrive together (requests sent behind the UI's back) -> shown one by one, never stacked
        pg.evaluate(LAT%250)
        pg.evaluate("for(let i=0;i<3;i++)send({t:'capsule',n:1})");pg.wait_for_timeout(2300)
        ck(pg.evaluate("document.querySelectorAll('.reveal').length")==1,f'[{name}] three answers at once: only one result screen is on top')
        label=pg.evaluate("(document.querySelector('.reveal .rclose')||{}).textContent")
        ck(label and '2' in label,f'[{name}] ...and its OK button says how many are still waiting ({label})')
        pg.screenshot(path=f'{D}/{TAG}_{name}_queue.png')
        seq=[]
        for k in range(3):
            pg.evaluate("document.querySelector('.reveal .rclose').click()");pg.wait_for_timeout(1300)
            seq.append(pg.evaluate("document.querySelectorAll('.reveal').length"))
        ck(seq==[1,1,0],f'[{name}] OK walks through the 3 results one by one, then everything is closed {seq}')
        ck(pg.evaluate("S.me.coins")>0 and not errs,f'[{name}] still no console errors {errs[:2]}')
        ctx.close()
    b.close()
finally:
  srv.terminate()
print('RESULT',sum(res),'/',len(res))
sys.exit(0 if all(res) else 1)
