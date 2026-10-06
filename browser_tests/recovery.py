import os,sys,subprocess,time,json,re,hashlib,secrets
from playwright.sync_api import sync_playwright
# Forgot-password with a recovery code, as the player sees it:
#   sign up -> the code is shown once (copy / save / "I saved it") -> Settings shows it is set -> make a new one (password asked) ->
#   log out -> "Forgot password?" -> wrong code is refused, right code sets a new password and logs in -> the old password is dead ->
#   an old account without a code is offered one (once) -> the code box fits on a small phone -> Thai/English texts.
SRC=sys.argv[1]; TAG=sys.argv[2]; PORT=sys.argv[3]; VIEWS=sys.argv[4].split(',') if len(sys.argv)>4 else ['desk','portrait','land','tiny']
import tempfile
D=os.environ.get('OUT') or os.path.join(tempfile.gettempdir(),'cozydogs_browser_tests');os.makedirs(D,exist_ok=True)   # screenshots + temp data files go here
data=f'{D}/data_{TAG}.json'
for f in (data,data+'.bak'):
    if os.path.exists(f): os.remove(f)
# an "old" account (made before recovery codes existed): same scrypt + salt scheme the server uses for passwords
accts={}
for v in VIEWS:
    salt=secrets.token_hex(16);h=hashlib.scrypt(b'oldpass1',salt=salt.encode(),n=16384,r=8,p=1,dklen=64).hex()
    accts['old'+v]={'name':'old'+v,'email':'o@x.co','salt':salt,'hash':h}
json.dump({'players':{},'accounts':accts,'sessions':{}},open(data,'w'))
env=dict(os.environ,PORT=PORT,DATA=data,CD_TEST='1')
env.pop('SUPABASE_URL',None);env.pop('SUPABASE_KEY',None)
srv=subprocess.Popen(['node',SRC+'/server.js'],cwd=SRC,env=env,stdout=open(f'{D}/srv_{TAG}.log','w'),stderr=subprocess.STDOUT)
time.sleep(1.5)
URL=f'http://localhost:{PORT}'
res=[]
def ck(c,n):
    res.append(bool(c));print('PASS' if c else 'FAIL',n,flush=True)
ALL={'desk':(1280,800,False),'portrait':(390,844,True),'land':(844,390,True),'tiny':(320,568,True)}
FMT=re.compile(r'^[A-HJ-NP-Z2-9]{4}(-[A-HJ-NP-Z2-9]{4}){3}$')
try:
  with sync_playwright() as p:
    b=p.chromium.launch()
    for name in VIEWS:
        w,h,touch=ALL[name]
        ctx=b.new_context(viewport={'width':w,'height':h},is_mobile=touch,has_touch=touch,device_scale_factor=1,permissions=['clipboard-read','clipboard-write'] if not touch else [])
        pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append('PAGEERR '+str(e)));pg.on('console',lambda m:errs.append(m.text) if m.type=='error' else None)
        def tap(sel):
            if touch: pg.tap(sel)
            else: pg.click(sel)
        user='rc'+name[:4]+secrets.token_hex(2)
        pg.goto(URL);pg.wait_for_timeout(600)
        # ---- 1) sign up: the code appears once
        tap('#tReg');pg.fill('#rUser',user);pg.fill('#rMail','m@t.co');pg.fill('#rPass','secret1');tap('#fReg button[type=submit]')
        pg.wait_for_selector('#mods .ov[data-mod=rec]',timeout=9000);pg.wait_for_timeout(500)
        code1=pg.inner_text('#recCode').strip()
        ck(FMT.match(code1),f'[{name}] sign-up shows a recovery code in XXXX-XXXX-XXXX-XXXX form ({code1})')
        pg.screenshot(path=f'{D}/{TAG}_{name}_1code.png')
        fits=pg.evaluate("(()=>{const c=document.querySelector('#recCode'),m=document.querySelector('#mods .ov[data-mod=rec] .mod');const r=c.getBoundingClientRect(),q=m.getBoundingClientRect();return c.scrollWidth<=c.clientWidth+1&&r.left>=q.left-1&&r.right<=q.right+1&&q.left>=0&&q.right<=innerWidth})()")
        ck(fits,f'[{name}] the code fits inside the box and the screen')
        pg.evaluate("document.querySelector('#mods .ov[data-mod=rec]').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))");pg.wait_for_timeout(200)
        ck(pg.evaluate("!!document.querySelector('#mods .ov[data-mod=rec]')"),f'[{name}] tapping outside does NOT close the code window (so it cannot be lost by accident)')
        tap('#mods [data-mod=rec] [data-do=reccopy]');pg.wait_for_timeout(400)
        if not touch:
            clip=pg.evaluate("navigator.clipboard.readText()");ck(clip==code1,f'[{name}] "Copy" puts the code on the clipboard')
        if not touch:
            with pg.expect_download(timeout=5000) as dl: tap('#mods [data-mod=rec] [data-do=recsave]')
            txt=open(dl.value.path(),encoding='utf-8').read()
            ck(code1 in txt and user in txt and dl.value.suggested_filename.endswith('.txt'),f'[{name}] "Save as file" downloads a text file with the user name and the code')
        else:
            # phones / in-app browsers cannot download a file: the button opens the share sheet (or copies the code when there is none)
            pg.evaluate("window.__sh=null;navigator.share=async d=>{window.__sh=d}");tap('#mods [data-mod=rec] [data-do=recsave]');pg.wait_for_timeout(400)
            sh=pg.evaluate("window.__sh")
            ck(sh and code1 in sh['text'] and user in sh['text'],f'[{name}] on a phone "Save as file" opens the share sheet with the user name and the code {sh}')
            pg.evaluate("window.__sh=null;navigator.share=undefined;window.__cp=null;navigator.clipboard.writeText=async v=>{window.__cp=v}");tap('#mods [data-mod=rec] [data-do=recsave]');pg.wait_for_timeout(400)
            ck(pg.evaluate("window.__sh")is None and pg.evaluate("window.__cp")==code1,f'[{name}] ...and without a share sheet it copies the code instead ({pg.evaluate("window.__cp")})')
            pg.evaluate("navigator.share=async d=>{const e=new Error('x');e.name='AbortError';throw e};window.__cp=null");tap('#mods [data-mod=rec] [data-do=recsave]');pg.wait_for_timeout(400)
            ck(pg.evaluate("window.__cp")is None,f'[{name}] ...and closing the share sheet does not copy anything')
        tap('#mods [data-mod=rec] [data-do=recdone]');pg.wait_for_timeout(300)
        ck(pg.evaluate("!document.querySelector('#mods .ov[data-mod=rec]') && S.recCode==null"),f'[{name}] "I saved it" closes the window and forgets the code in the page')
        pg.wait_for_timeout(1200);pg.evaluate("document.querySelectorAll('.coach,.tut').forEach(o=>o.classList.add('hidden'));document.querySelectorAll('#mods .ov').forEach(o=>o.remove())")
        # ---- 2) settings: set; make a new code (password asked)
        pg.evaluate("DO.settings()");pg.wait_for_timeout(400)
        st=pg.evaluate("document.querySelector('#mods [data-mod=settings]').textContent")
        ck('ตั้งไว้แล้ว' in st or 'Saved' in st,f'[{name}] Settings says the recovery code is set')
        pg.evaluate("document.querySelector('#mods [data-mod=settings] [data-do=recnew]').scrollIntoView({block:'center'})");pg.screenshot(path=f'{D}/{TAG}_{name}_2settings.png')
        tap('#mods [data-mod=settings] [data-do=recnew]');pg.wait_for_selector('#frecpw',timeout=3000)
        pg.fill('#recPw','wrongwrong');pg.keyboard.press('Enter');pg.wait_for_timeout(500)
        ck('ไม่ถูกต้อง' in pg.inner_text('#recErr'),f'[{name}] a wrong password is refused inside the window ({pg.inner_text("#recErr")!r})')
        pg.fill('#recPw','secret1');pg.keyboard.press('Enter');pg.wait_for_selector('#mods .ov[data-mod=rec]',timeout=4000);pg.wait_for_timeout(300)
        code2=pg.inner_text('#recCode').strip()
        ck(FMT.match(code2) and code2!=code1 and not pg.evaluate("!!document.querySelector('#mods .ov[data-mod=recpw]')"),f'[{name}] the right password gives a different new code ({code2})')
        tap('#mods [data-mod=rec] [data-do=recdone]');pg.wait_for_timeout(300)
        # ---- 3) log out, then "Forgot password?"
        pg.evaluate("document.querySelectorAll('#mods .ov').forEach(o=>o.remove())")
        pg.evaluate("DO.logout()");pg.wait_for_selector('#aForgot',timeout=8000);pg.wait_for_timeout(1000)
        ck(pg.is_visible('#aForgot'),f'[{name}] the login screen has a "Forgot password?" link')
        pg.fill('#lUser',user);tap('#aForgot');pg.wait_for_timeout(300)
        ck(pg.is_visible('#fForgot') and not pg.is_visible('#fLogin') and pg.input_value('#fUser')==user,f'[{name}] the form opens with the user name already filled in')
        pg.screenshot(path=f'{D}/{TAG}_{name}_3forgot.png')
        tap('#fForgot [data-do=ltab]');pg.wait_for_timeout(300)
        ck(pg.is_visible('#fLogin') and not pg.is_visible('#fForgot'),f'[{name}] "Back to login" returns to the login form')
        tap('#aForgot');pg.wait_for_timeout(300)
        tap('#tReg');pg.wait_for_timeout(200);ck(pg.is_visible('#fReg') and not pg.is_visible('#fForgot'),f'[{name}] the Register tab also leaves the forgot form')
        tap('#tLogin');tap('#aForgot');pg.wait_for_timeout(300)
        pg.fill('#fCode',code1);pg.fill('#fPass','brandnew1');tap('#fForgot button[type=submit]');pg.wait_for_timeout(700)
        ck(pg.is_visible('#fForgot') and 'ไม่ถูกต้อง' in pg.inner_text('#fErr'),f'[{name}] the replaced (old) code is refused with a message on that form ({pg.inner_text("#fErr")!r})')
        pg.fill('#fCode',code2.lower().replace('-',' '));tap('#fForgot button[type=submit]')
        pg.wait_for_selector('#game.on',timeout=9000);pg.wait_for_selector('#mods .ov[data-mod=rec]',timeout=5000);pg.wait_for_timeout(300)
        code3=pg.inner_text('#recCode').strip()
        ck(FMT.match(code3) and code3!=code2,f'[{name}] the right code (typed in lower case) sets the password, logs in and shows a NEW code ({code3})')
        ck('NEW' in pg.inner_text('#mods [data-mod=rec]') or 'อันใหม่' in pg.inner_text('#mods [data-mod=rec]'),f'[{name}] the window says it is a new code')
        pg.screenshot(path=f'{D}/{TAG}_{name}_4reset.png')
        tap('#mods [data-mod=rec] [data-do=recdone]')
        ctx.close()
        # ---- 4) old password dead, new password alive (fresh browser)
        c2=b.new_context(viewport={'width':w,'height':h},is_mobile=touch,has_touch=touch);q=c2.new_page();q.goto(URL);q.wait_for_timeout(600)
        q.fill('#lUser',user);q.fill('#lPass','secret1');q.press('#lPass','Enter');q.wait_for_timeout(900)
        ck(not q.evaluate("document.querySelector('#game').classList.contains('on')") and q.inner_text('#lErr').strip()!='',f'[{name}] the old password no longer logs in')
        q.fill('#lPass','brandnew1');q.press('#lPass','Enter');q.wait_for_selector('#game.on',timeout=8000)
        ck(True,f'[{name}] the new password logs in');
        q.wait_for_timeout(900);ck(not q.evaluate("!!document.querySelector('#mods .ov[data-mod=rec]')"),f'[{name}] a normal login does not show a code again')
        c2.close()
        # ---- 5) an old account without a code is offered one, once
        c3=b.new_context(viewport={'width':w,'height':h},is_mobile=touch,has_touch=touch);r=c3.new_page();r.on('pageerror',lambda e:errs.append('PAGEERR '+str(e)))
        r.goto(URL);r.wait_for_timeout(600);r.fill('#lUser','old'+name);r.fill('#lPass','oldpass1');r.press('#lPass','Enter');r.wait_for_selector('#game.on',timeout=8000)
        r.evaluate("document.querySelectorAll('.coach,.tut').forEach(o=>o.classList.add('hidden'))")
        r.wait_for_selector('#mods .ov[data-mod=daily]',timeout=6000);r.wait_for_timeout(2600)
        ck(not r.evaluate("!!document.querySelector('#mods .ov[data-mod=recpw]')"),f'[{name}] the offer waits while the daily-reward window is open')
        r.evaluate("document.querySelectorAll('#mods .ov').forEach(o=>o.remove())")      # the player closes the daily reward
        r.wait_for_selector('#frecpw',timeout=9000)
        ck('ยังไม่มีรหัสกู้คืน' in r.inner_text('#mods [data-mod=recpw]') or 'no recovery code' in r.inner_text('#mods [data-mod=recpw]'),f'[{name}] an old account is offered a recovery code a few seconds after logging in')
        r.screenshot(path=f'{D}/{TAG}_{name}_5old.png')
        (r.tap if touch else r.click)('#mods [data-mod=recpw] [data-do=closemod]');r.wait_for_timeout(300)
        ck(not r.evaluate("!!document.querySelector('#mods .ov[data-mod=recpw]')"),f'[{name}] "Later" closes it')
        r.evaluate("DO.settings()");r.wait_for_timeout(300)
        ck('ยังไม่ได้ตั้ง' in r.inner_text('#mods [data-mod=settings]') or 'Not set up' in r.inner_text('#mods [data-mod=settings]'),f'[{name}] Settings shows "not set up" and offers to create one')
        r.evaluate("document.querySelector('#mods [data-mod=settings] [data-do=recnew]').click()");r.wait_for_selector('#frecpw');r.fill('#recPw','oldpass1');r.keyboard.press('Enter')
        r.wait_for_selector('#mods .ov[data-mod=rec]',timeout=4000);cold=r.inner_text('#recCode').strip();ck(bool(FMT.match(cold)),f'[{name}] the old account makes its first code ({cold})')
        r.evaluate("DO.recdone()");r.evaluate("DO.settings()");r.wait_for_timeout(300)
        ck('ตั้งไว้แล้ว' in r.inner_text('#mods [data-mod=settings]') or 'Saved' in r.inner_text('#mods [data-mod=settings]'),f'[{name}] Settings now says it is set')
        c3.close()
        ck(not [e for e in errs if 'favicon' not in e],f'[{name}] no console errors {errs[:3]}')
    b.close()
finally:
  srv.terminate()
print('RESULT',sum(res),'/',len(res))
sys.exit(0 if all(res) else 1)
