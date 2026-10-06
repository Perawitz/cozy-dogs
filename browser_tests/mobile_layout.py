import os,sys,subprocess,time,json
from playwright.sync_api import sync_playwright
# v6.2.1 - phone layout checks (Chromium with phone sizes; the iPhone-only quirks are covered in thai_canvas.py)
#   login screen on a landscape phone can be scrolled to every button | login fields do not make iOS zoom in | the top bar (player card / coins / gems / tickets) does not overlap on narrow phones
#   the decorate bar leaves room to place furniture on a landscape phone | the item drawer can be swiped sideways | the game still draws when the browser has no ctx.roundRect (older iPhones)
SRC=sys.argv[1]; TAG=sys.argv[2]; PORT=sys.argv[3]
import tempfile
D=os.environ.get('OUT') or os.path.join(tempfile.gettempdir(),'cozydogs_browser_tests');os.makedirs(D,exist_ok=True)
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
def newpage(b,w,h,dsf=2,init=None):
    ctx=b.new_context(viewport={'width':w,'height':h},is_mobile=True,has_touch=True,device_scale_factor=dsf)
    if init: ctx.add_init_script(init)
    pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append('PAGEERR '+str(e)));pg.on('console',lambda m:errs.append(m.text) if m.type=='error' else None)
    pg.goto(URL);pg.wait_for_timeout(700);return ctx,pg,errs
n_user=[0]
def register(pg):
    n_user[0]+=1;u=f'ml{n_user[0]}{int(time.time())%10000}'
    pg.click('#tReg');pg.fill('#rUser',u);pg.fill('#rMail','m@t.co');pg.fill('#rPass','secret1');pg.click('#fReg button[type=submit]')
    pg.wait_for_selector('#game.on',timeout=8000);pg.wait_for_timeout(1200)
    pg.evaluate("document.querySelectorAll('.coach,.tut').forEach(o=>o.classList.add('hidden'));document.querySelectorAll('#mods .ov').forEach(o=>o.remove())")
try:
  with sync_playwright() as p:
    b=p.chromium.launch()
    # ---------- login screen
    for (w,h) in [(844,340),(667,300),(568,320),(390,844),(320,568)]:
        ctx,pg,errs=newpage(b,w,h)
        r=pg.evaluate("""()=>{const l=document.querySelector('.loginwrap');const g=document.querySelector('[data-do=guest]');const reg=document.querySelector('#tReg');
          const noHscroll=document.documentElement.scrollWidth<=innerWidth+1&&l.scrollWidth<=l.clientWidth+1;
          l.scrollTop=l.scrollHeight;const gb=g.getBoundingClientRect(),bottom=gb.bottom<=innerHeight+1&&gb.top>=0;
          l.scrollTop=0;const t0=document.querySelector('.logo').getBoundingClientRect().top;
          return{canScroll:l.scrollHeight>l.clientHeight,guestReachable:bottom,logoTop:Math.round(t0),noHscroll}}""")
        ck(r['guestReachable'] and r['noHscroll'],f'[login {w}x{h}] the guest / register buttons can be reached ({r})')
        ck(r['logoTop']>=-1,f'[login {w}x{h}] the logo is not cut off at the top ({r["logoTop"]})')
        ci=pg.evaluate("""()=>['lUser','lPass'].map(i=>{const e=document.getElementById(i);return {fs:getComputedStyle(e).fontSize,cap:e.getAttribute('autocapitalize')}})""")
        ck(all(x['fs']=='16px' for x in ci),f'[login {w}x{h}] the fields use 16px text (iOS does not zoom in on focus) {ci}')
        ctx.close()
    # ---------- top bar on narrow phones with big numbers
    for w in (320,340,360,375,390,414):
        ctx,pg,errs=newpage(b,w,700);register(pg)
        pg.evaluate("Object.assign(S.me,{coins:99999,gems:9999,tickets:999,lvl:88});UI.cur();UI.pcard()");pg.wait_for_timeout(1100)      # the chips "pop" for a moment when their number changes
        r=pg.evaluate("""()=>{const a=document.querySelector('.pcard').getBoundingClientRect(),c=document.querySelector('.cur').getBoundingClientRect();
          const chips=[...document.querySelectorAll('.cur .chip')].map(e=>e.getBoundingClientRect());
          return{overlap:Math.max(0,Math.min(a.right,c.right)-Math.max(a.left,c.left))>0&&Math.max(0,Math.min(a.bottom,c.bottom)-Math.max(a.top,c.top))>0,pr:a.right,cl:c.left,cr:c.right,inView:c.right<=innerWidth+1&&c.left>=0,chipsOverlap:chips.some((x,i)=>chips.some((y,j)=>j>i&&Math.min(x.right,y.right)-Math.max(x.left,y.left)>1))}}""")
        ck(not r['overlap'] and r['inView'] and not r['chipsOverlap'],f'[top bar {w}px] player card and coin / gem / ticket chips do not overlap ({r})')
        ctx.close()
    # ---------- decorate bar on landscape phones
    for (w,h) in [(844,390),(667,375),(568,320)]:
        ctx,pg,errs=newpage(b,w,h);register(pg)
        pg.evaluate("DO.decor()");pg.wait_for_timeout(700)
        r=pg.evaluate("""()=>{const e=document.querySelector('#editbar').getBoundingClientRect();const inv=document.querySelector('#editbar .inv');return{h:Math.round(e.height),top:Math.round(e.top),vh:innerHeight,ta:inv?getComputedStyle(inv).touchAction:null,canScroll:(()=>{const d=document.querySelector('#editbar .drawer');return d.scrollWidth>=d.clientWidth})()}}""")
        ck(r['h']<=innerH if (innerH:=r['vh']*0.45) else False,f'[decorate {w}x{h}] the bar uses at most 45% of the height ({r["h"]} of {r["vh"]})')
        ck(r['ta']=='pan-x','[decorate %dx%d] the item drawer allows sideways swiping (touch-action: %s)'%(w,h,r['ta']))
        pg.screenshot(path=f'{D}/{TAG}_edit_{w}.png');ctx.close()
    # ---------- no ctx.roundRect (older iPhones)
    ctx,pg,errs=newpage(b,390,844,2,"delete CanvasRenderingContext2D.prototype.roundRect;")
    ck(pg.evaluate("typeof CanvasRenderingContext2D.prototype.roundRect=='function'"),'[old iPhone] the game provides roundRect itself when the browser has none')
    register(pg);pg.evaluate("DO.park()");pg.wait_for_timeout(2200);pg.evaluate("document.querySelectorAll('#mods .ov').forEach(o=>o.remove())")
    pg.evaluate("H.chat({t:'chat',from:S.owner||S.name,m:'สวัสดี hello'})");pg.wait_for_timeout(900)
    ok=pg.evaluate("""()=>{const cv=document.createElement('canvas');cv.width=200;cv.height=60;const c=cv.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,200,60);c.fillStyle='#000';c.beginPath();c.roundRect(20,10,160,40,12);c.fill();
      const d=c.getImageData(0,0,200,60).data;const px=(x,y)=>d[(y*200+x)*4];return px(100,30)<20&&px(21,11)>200&&px(100,5)>200}""")
    ck(ok,'[old iPhone] the replacement draws a rounded rectangle (filled middle, rounded corner)')
    ck(pg.evaluate("Park.on===true")and not [e for e in errs if 'favicon' not in e and 'WebSocket' not in e],f'[old iPhone] the park runs and draws without errors {errs[:3]}')
    pg.screenshot(path=f'{D}/{TAG}_noroundrect.png');ctx.close()
    b.close()
finally:
  srv.terminate()
print('RESULT',sum(res),'/',len(res))
sys.exit(0 if all(res) else 1)
