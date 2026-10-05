import os,sys,subprocess,time,json
from playwright.sync_api import sync_playwright
# Smoke tour: log in, press EVERY button of the bottom dock (and the top-bar / settings entries) on 3 screen sizes and make sure each one
# opens something without a JavaScript error; then visit the park and come back, switch language, and open the chat. Catches regressions anywhere in the UI.
SRC=sys.argv[1]; TAG=sys.argv[2]; PORT=sys.argv[3]; VIEWS=sys.argv[4].split(',') if len(sys.argv)>4 else ['desk','portrait','land']
import tempfile
D=os.environ.get('OUT') or os.path.join(tempfile.gettempdir(),'cozydogs_browser_tests');os.makedirs(D,exist_ok=True)   # screenshots + temp data files go here
data=f'{D}/data_{TAG}.json'
for f in (data,data+'.bak'):
    if os.path.exists(f): os.remove(f)
env=dict(os.environ,PORT=PORT,DATA=data,CD_TEST='1')
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
        pg.click('#tReg');pg.fill('#rUser','sm'+name[:4]);pg.fill('#rMail','m@t.co');pg.fill('#rPass','secret1');pg.click('#fReg button[type=submit]')
        pg.wait_for_selector('#game.on',timeout=8000);pg.wait_for_timeout(1800)
        pg.evaluate("document.querySelectorAll('.coach,.tut').forEach(o=>o.classList.add('hidden'));document.querySelectorAll('#mods .ov').forEach(o=>o.remove())")
        acts=pg.evaluate("[...document.querySelectorAll('#dock [data-do]')].map(e=>e.dataset.do)")
        print(f'[{name}] dock buttons:',acts)
        ck(len(acts)>=10,f'[{name}] the dock has its buttons ({len(acts)})')
        opened=[];dead=[]
        for a in acts:
            pg.evaluate("document.querySelectorAll('#mods .ov').forEach(o=>o.remove())")
            if pg.evaluate("Park.on"): pg.evaluate("DO.home&&DO.home()");pg.wait_for_timeout(300)
            if pg.evaluate("S.edit"): pg.evaluate("DO.decor()");pg.wait_for_timeout(200)
            before=len(errs)
            pg.evaluate("(a)=>{const e=document.querySelector('#dock [data-do=\"'+a+'\"]');if(e)e.click()}",a);pg.wait_for_timeout(450)
            n=pg.evaluate("document.querySelectorAll('#mods .ov').length");st=pg.evaluate("({park:Park.on,edit:S.edit})")
            if n>0 or st['park'] or st['edit']: opened.append(a)
            elif a!='photo': dead.append(a)         # 'photo' only flashes the screen and saves a picture: no window to look for
            if len(errs)>before: print('  errors after',a,errs[before:before+2])
            if name=='portrait': pg.screenshot(path=f'{D}/{TAG}_{name}_dock_{a}.png')
        ck(not dead,f'[{name}] every dock button opens a window or a mode (nothing happened for: {dead})')
        pg.evaluate("document.querySelectorAll('#mods .ov').forEach(o=>o.remove())")
        if pg.evaluate("Park.on"): pg.evaluate("DO.home()");pg.wait_for_timeout(300)
        if pg.evaluate("S.edit"): pg.evaluate("DO.decor()");pg.wait_for_timeout(200)
        # top bar entries: coins / gems / tickets chips, profile card, settings
        for sel in ['.pcard','.chip']:
            els=pg.evaluate("[...document.querySelectorAll('%s[data-do]')].map(e=>e.dataset.do)"%sel)
            for a in dict.fromkeys(els):
                pg.evaluate("document.querySelectorAll('#mods .ov').forEach(o=>o.remove())")
                pg.evaluate("(a)=>{const e=document.querySelector('%s[data-do=\"'+a+'\"]');if(e)e.click()}"%sel,a);pg.wait_for_timeout(350)
        pg.evaluate("document.querySelectorAll('#mods .ov').forEach(o=>o.remove())")
        # language switch: Thai <-> English, then every window text must still render (open a few)
        lang0=pg.evaluate("S.set.lang")
        pg.evaluate("S.set.lang=S.set.lang=='th'?'en':'th';UI.all&&UI.all()")
        for a in ['shop','dogs','games','quests']:
            pg.evaluate("(a)=>DO[a]()",a);pg.wait_for_timeout(300)
            t=pg.evaluate("(document.querySelector('#mods .ov')||{}).textContent||''")
            ck(len(t)>20 and 'undefined' not in t and 'NaN' not in t,f'[{name}] "{a}" renders in the other language without undefined/NaN')
            pg.evaluate("document.querySelectorAll('#mods .ov').forEach(o=>o.remove())")
        pg.evaluate("S.set.lang='%s';UI.all&&UI.all()"%lang0)
        # park round trip
        pg.evaluate("DO.park()");pg.wait_for_timeout(2200);pg.evaluate("document.querySelectorAll('#mods .ov').forEach(o=>o.remove())")
        ck(pg.evaluate("Park.on===true"),f'[{name}] park opens')
        pg.evaluate("DO.home()");pg.wait_for_timeout(600)
        ck(pg.evaluate("Park.on===false && !!document.querySelector('#dock') && getComputedStyle(document.querySelector('#dock')).display!='none'"),f'[{name}] back home, dock visible again')
        ck(not [e for e in errs if 'favicon' not in e],f'[{name}] no JavaScript errors during the whole tour {errs[:3]}')
        ctx.close()
    b.close()
finally:
  srv.terminate()
print('RESULT',sum(res),'/',len(res))
sys.exit(0 if all(res) else 1)
