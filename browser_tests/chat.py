import os,sys,subprocess,time,json
from playwright.sync_api import sync_playwright
# Park chat on phones: A (phone / desktop, in the park) opens the chat, types, while B (desktop, also in the park) sends messages.
# Checks: the chat is reachable, the input keeps focus + typed text + the SAME DOM node while messages arrive, sending works (button and Enter), bubble shows over the dog owner.
SRC=sys.argv[1]; TAG=sys.argv[2]; PORT=sys.argv[3]; VIEWS=sys.argv[4].split(',') if len(sys.argv)>4 else ['portrait','land','desk']
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
def login(b,user,w,h,touch):
    ctx=b.new_context(viewport={'width':w,'height':h},is_mobile=touch,has_touch=touch,device_scale_factor=1)
    pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append('PAGEERR '+str(e)));pg.on('console',lambda m:errs.append(m.text) if m.type=='error' else None)
    pg.goto(URL);pg.wait_for_timeout(600)
    pg.click('#tReg');pg.fill('#rUser',user);pg.fill('#rMail','m@t.co');pg.fill('#rPass','secret1');pg.click('#fReg button[type=submit]')
    pg.wait_for_selector('#game.on',timeout=8000);pg.wait_for_timeout(1200)
    pg.evaluate("document.querySelectorAll('.coach,.tut').forEach(o=>o.classList.add('hidden'));document.querySelectorAll('#mods .ov').forEach(o=>o.remove())")
    return ctx,pg,errs
try:
  with sync_playwright() as p:
    b=p.chromium.launch()
    for name in VIEWS:
        w,h,touch=ALL[name]
        ca,pa,ea=login(b,'chA'+name[:4],w,h,touch)
        cb,pb,eb=login(b,'chB'+name[:4],1280,800,False)
        for pg in (pa,pb):
            pg.evaluate("DO.park()");pg.wait_for_timeout(2200);pg.evaluate("document.querySelectorAll('#mods .ov').forEach(o=>o.remove())");pg.wait_for_timeout(600)
        ck(pa.evaluate("Park.on===true") and pb.evaluate("Park.on===true"),f'[{name}] both players are in the park')
        def tap(sel):
            if touch: pa.tap(sel)
            else: pa.click(sel)
        vis=pa.evaluate("""()=>{const c=document.querySelector('#chat');const cs=getComputedStyle(c),r=c.getBoundingClientRect();const e=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {display:cs.display,w:r.width,h:r.height,inView:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,top:!!e&&c.contains(e),min:c.classList.contains('min')}}""")
        ck(vis['display']!='none' and vis['w']>40 and vis['inView'] and vis['top'],f'[{name}] chat panel is on screen and not covered {vis}')
        if vis['display']=='none':
            pa.screenshot(path=f'{D}/{TAG}_{name}_nochat.png');ca.close();cb.close();continue
        pa.screenshot(path=f'{D}/{TAG}_{name}_1closed.png')
        if vis['min']:
            tap('#chat .hd');pa.wait_for_timeout(300)
        st=pa.evaluate("""()=>{const c=document.querySelector('#chat'),i=c.querySelector('input'),r=c.getBoundingClientRect(),d=document.querySelector('#parkbar')||document.querySelector('#dock');const dr=d?d.getBoundingClientRect():null;
          const e=document.elementFromPoint(i.getBoundingClientRect().left+10,i.getBoundingClientRect().top+8);return {min:c.classList.contains('min'),inputVisible:i.offsetParent!==null&&i.getBoundingClientRect().height>10,focus:document.activeElement===i,inView:r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth,hit:e===i,fs:getComputedStyle(i).fontSize,overlapBar:!!dr&&dr.height>0&&r.bottom>dr.top+1&&r.top<dr.bottom&&r.right>dr.left&&r.left<dr.right}}""")
        ck(not st['min'] and st['inputVisible'] and st['inView'] and st['hit'],f'[{name}] tapping the header opens the chat; the input is visible and tappable {st}')
        if touch: ck(st['focus'],f'[{name}] ...and the input is focused right away (so the phone keyboard opens)')
        ck(not st['overlapBar'],f'[{name}] the open panel does not sit on top of the park buttons')
        if touch: ck(st['fs']=='16px',f'[{name}] input font is 16px (no zoom-in on iOS): {st["fs"]}')
        # focus the input the way a user does and type Thai text
        tap('#chat input');pa.wait_for_timeout(150)
        pa.evaluate("(()=>{const i=document.querySelector('#chat input');i.__mark='keep';document.querySelector('#chatf').__mark='keep'})()")
        pa.keyboard.type('สวัสดีครับ');pa.wait_for_timeout(100)
        ck(pa.evaluate("document.querySelector('#chat input').value")=='สวัสดีครับ',f'[{name}] typing works')
        pa.screenshot(path=f'{D}/{TAG}_{name}_2typing.png')
        # three messages arrive from B while A is typing
        for k in range(3):
            pb.evaluate("send({t:'chat',m:'hello from B #%d'})"%k);pa.wait_for_timeout(1050)
            s=pa.evaluate("""()=>{const i=document.querySelector('#chat input');return {focus:document.activeElement===i,val:i.value,same:i.__mark==='keep'&&document.querySelector('#chatf').__mark==='keep',log:document.querySelector('#chat .log').textContent}}""")
            ck(s['focus'] and s['val']=='สวัสดีครับ' and s['same'] and ('hello from B #%d'%k) in s['log'],f'[{name}] message #{k} from B arrived; input kept focus, text and its DOM node ({s["focus"]},{s["val"]!r},{s["same"]})')
        pa.keyboard.type(' 🐶');pa.wait_for_timeout(100)
        ck(pa.evaluate("document.querySelector('#chat input').value")=='สวัสดีครับ 🐶',f'[{name}] can keep typing after messages arrived')
        pa.screenshot(path=f'{D}/{TAG}_{name}_3after.png')
        # send with the button (tap) ...
        (pa.tap if touch else pa.click)('#chatf button');pa.wait_for_timeout(700)
        ck(pa.evaluate("document.querySelector('#chat input').value")=='' ,f'[{name}] send button clears the input')
        ck('สวัสดีครับ 🐶' in pb.evaluate("document.querySelector('#chat .log').textContent"),f'[{name}] B receives the message')
        ck(pa.evaluate("!!(Park.bubbles&&Park.bubbles[S.name])"),f'[{name}] a speech bubble shows over the sender in the park')
        # ... and with the Enter key (what a phone keyboard\'s "send" key does)
        pa.wait_for_timeout(1000);tap('#chat input');pa.keyboard.type('second one');pa.keyboard.press('Enter');pa.wait_for_timeout(700)
        ck('second one' in pb.evaluate("document.querySelector('#chat .log').textContent") and pa.evaluate("document.querySelector('#chat input').value")=='',f'[{name}] Enter sends too')
        ck(pa.evaluate("document.activeElement===document.querySelector('#chat input')"),f'[{name}] input still focused after sending (can write the next line)')
        # collapse again
        tap('#chat .hd');pa.wait_for_timeout(300)
        ck(pa.evaluate("document.querySelector('#chat').classList.contains('min') && document.querySelector('#chat input').offsetParent===null"),f'[{name}] header collapses the chat again')
        # a message arriving while collapsed puts a dot on the header
        pb.evaluate("send({t:'chat',m:'ping while closed'})");pa.wait_for_timeout(1100)
        ck('•' in pa.evaluate("document.querySelector('#chat .hd span').textContent"),f'[{name}] unread dot shows on the collapsed header')
        pa.screenshot(path=f'{D}/{TAG}_{name}_4closed_unread.png')
        ck(not [e for e in ea+eb if 'favicon' not in e],f'[{name}] no console errors {(ea+eb)[:3]}')
        ca.close();cb.close()
    b.close()
finally:
  srv.terminate()
print('RESULT',sum(res),'/',len(res))
sys.exit(0 if all(res) else 1)
