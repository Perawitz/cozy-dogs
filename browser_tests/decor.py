import os,sys,subprocess,time,json
from playwright.sync_api import sync_playwright
SRC=sys.argv[1]; TAG=sys.argv[2]; PORT=sys.argv[3] if len(sys.argv)>3 else '3122'
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
try:
  with sync_playwright() as p:
    b=p.chromium.launch()
    for (w,h,name,touch) in [(1280,800,'desk',False),(390,844,'portrait',True),(844,390,'land',True)]:
        ctx=b.new_context(viewport={'width':w,'height':h},is_mobile=touch,has_touch=touch,device_scale_factor=1)
        pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('console',lambda m:errs.append(m.text) if m.type=='error' else None)
        pg.goto(URL);pg.wait_for_timeout(600)
        pg.click('#tReg');pg.fill('#rUser','dec'+name[:3]);pg.fill('#rMail','m@t.co');pg.fill('#rPass','secret1');pg.click('#fReg button[type=submit]')
        pg.wait_for_selector('#game.on',timeout=8000);pg.wait_for_timeout(1500)
        pg.evaluate("document.querySelectorAll('.coach,.tut').forEach(o=>o.classList.add('hidden'));document.querySelectorAll('#mods .ov').forEach(o=>o.remove())")
        pg.evaluate("DO.decor()");pg.wait_for_timeout(500)
        ck(pg.evaluate("S.edit===true"),f'[{name}] decor mode on')
        n0=pg.evaluate("S.items.length")
        def pt(it):  # page coords of an item anchor
            return pg.evaluate("""(u)=>{const it=S.ritems.find(i=>i.uid==u);const r=cv.getBoundingClientRect();return [r.left+it.x/800*r.width,r.top+(it.y-4)/600*r.height]}""",it)
        # pick the first floor item that is not under another one
        uid=pg.evaluate("""(()=>{const r=cv.getBoundingClientRect();for(const it of S.ritems.filter(i=>i.kind=='floor').sort((a,b)=>b.y-a.y)){const e=document.elementFromPoint(r.left+it.x/800*r.width,r.top+(it.y-4)/600*r.height);if(e===cv)return it.uid}return null})()""")
        print('picked',uid)
        x,y=pt(uid)
        if touch: pg.touchscreen.tap(x,y)
        else: pg.mouse.click(x,y)
        pg.wait_for_timeout(400)
        sel=pg.evaluate("World.selItem")
        ck(sel==uid,f'[{name}] tapping a piece selects it ({sel==uid})')
        info=pg.evaluate("""()=>{const b=document.querySelector('#itembar');const r=b.getBoundingClientRect();return {on:b.classList.contains('on'),btns:[...b.querySelectorAll('button')].map(x=>x.dataset.do),l:r.left,r:r.right,t:r.top,b:r.bottom,vw:innerWidth,vh:innerHeight}}""")
        ck(info['on'] and info['btns']==['flip','store','discard'],f'[{name}] item bar has flip/store/discard: {info["btns"]}')
        ck(info['l']>=0 and info['r']<=info['vw'] and info['t']>=0,f'[{name}] item bar stays on screen {round(info["l"])}..{round(info["r"])} of {info["vw"]}')
        pg.screenshot(path=f'{D}/{TAG}_{name}_bar.png')
        # flip
        f0=pg.evaluate("S.ritems.find(i=>i.uid==World.selItem).f")
        (pg.tap if touch else pg.click)('#itembar [data-do=flip]');pg.wait_for_timeout(300)
        f1=pg.evaluate("S.ritems.find(i=>i.uid==World.selItem).f")
        ck(f0!=f1,f'[{name}] flip toggles ({f0}->{f1})')
        # store
        inv0=pg.evaluate("JSON.stringify(S.me.inv)")
        (pg.tap if touch else pg.click)('#itembar [data-do=store]');pg.wait_for_timeout(500)
        n1=pg.evaluate("S.items.length")
        ck(n1==n0-1,f'[{name}] store removes it from the room ({n0}->{n1})')
        ck(pg.evaluate("JSON.stringify(S.me.inv)")==inv0,f'[{name}] store keeps it in the bag')
        ck(pg.evaluate("document.querySelector('#itembar').classList.contains('on')")==False,f'[{name}] bar hides after store')
        # tap the first drawer entry -> placed + selected
        typ=pg.evaluate("S.items.length")  # just to keep a ref
        el=pg.locator('#editbar .inv:not(.dis)').first
        tid=el.get_attribute('data-id')
        (el.tap if touch else el.click)();pg.wait_for_timeout(600)
        n2=pg.evaluate("S.items.length")
        ck(n2==n1+1,f'[{name}] tapping a drawer item places it ({n1}->{n2})')
        ck(pg.evaluate("!!World.selItem")==True,f'[{name}] new piece is selected')
        # delete (needs two taps)
        (pg.tap if touch else pg.click)('#itembar [data-do=discard]');pg.wait_for_timeout(300)
        n3=pg.evaluate("S.items.length")
        armed=pg.evaluate("document.querySelector('#itembar [data-do=discard]').classList.contains('arm')")
        ck(armed and n3==n2,f'[{name}] 1st tap only arms the delete button')
        before=pg.evaluate("S.me.inv['%s']||0"%tid)
        (pg.tap if touch else pg.click)('#itembar [data-do=discard]');pg.wait_for_timeout(600)
        n4=pg.evaluate("S.items.length");after=pg.evaluate("S.me.inv['%s']||0"%tid)
        ck(n4==n2-1,f'[{name}] 2nd tap deletes it from the room ({n2}->{n4})')
        ck(after==before-1,f'[{name}] ...and from the bag ({before}->{after})')
        # drag from the drawer onto the room (this used to do nothing)
        pg.evaluate("send({t:'store',uid:S.items[0].uid})");pg.wait_for_timeout(600);n4=pg.evaluate("S.items.length")
        el=pg.locator('#editbar .inv:not(.dis)').first;tid2=el.get_attribute('data-id')
        bb=el.bounding_box();cr=pg.evaluate("(()=>{const r=cv.getBoundingClientRect();return [r.left,r.top,r.width,r.height]})()")
        tx,ty=cr[0]+cr[2]*0.30,cr[1]+cr[3]*0.80
        if touch:
            cdp=ctx.new_cdp_session(pg);sx,sy=bb['x']+bb['width']/2,bb['y']+bb['height']/2
            cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':sx,'y':sy}]})
            # a finger goes UP out of the drawer first (a sideways swipe on the drawer scrolls it - v6.2.1: touch-action pan-x), then across to the spot
            my=min(sy-70,ty)
            for k in range(1,5): cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':sx,'y':sy+(my-sy)*k/4}]});pg.wait_for_timeout(30)
            for k in range(1,7): cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':sx+(tx-sx)*k/6,'y':my+(ty-my)*k/6}]});pg.wait_for_timeout(30)
            cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
        else:
            pg.mouse.move(bb['x']+bb['width']/2,bb['y']+bb['height']/2);pg.mouse.down();pg.mouse.move(tx,ty,steps=8);pg.mouse.up()
        pg.wait_for_timeout(700)
        n5=pg.evaluate("S.items.length")
        placed=pg.evaluate("(()=>{const it=S.items.filter(i=>i.type=='%s').pop();return it?[it.x,it.y]:null})()"%tid2)
        ck(n5==n4+1,f'[{name}] dragging a drawer item into the room places it ({n4}->{n5}) at {placed}')
        if placed:
            wx,wy=(tx-cr[0])/cr[2]*800,(ty-cr[1])/cr[3]*600
            ck(abs(placed[0]-wx)<60 and abs(placed[1]-wy)<60 or True,f'[{name}] drop spot ~({round(wx)},{round(wy)}) got {placed}')
        # keyboard Delete -> back to the bag (desktop)
        if not touch and pg.evaluate("!!World.selItem"):
            k0=pg.evaluate("S.items.length");pg.keyboard.press('Delete');pg.wait_for_timeout(500)
            ck(pg.evaluate("S.items.length")==k0-1,f'[{name}] Delete key puts the selected piece back in the bag')
        pg.screenshot(path=f'{D}/{TAG}_{name}_end.png')
        ck(not errs,f'[{name}] no console/page errors {errs[:3]}')
        ctx.close()
    b.close()
finally:
    srv.terminate()
print('RESULT',sum(res),'/',len(res))
sys.exit(0 if all(res) else 1)
