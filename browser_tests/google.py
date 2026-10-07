import os,sys,subprocess,time,json,re,secrets,tempfile,urllib.request,urllib.parse
from playwright.sync_api import sync_playwright
# v6.3 as the player sees it: sign in with Google, the achievement shown above the head, and the daily limit for petting hearts.
#   - Google itself cannot be reached from a test, so a tiny local stand-in (google_stub.js) signs test ID tokens with its own key and serves the public key;
#     the game SERVER checks every token for real (signature, audience, expiry...). Only Google's button is faked: it hands the page a token the way the real one does.
#   - checks: the button on the login screen (+ register / forgot-password tabs, fits every screen, in-app-browser hint), a NEW Google user is asked for a game name
#     (refused names stay in the window), signs in again later, a password account links Google in Settings, no button at all when the server has no Google client id,
#     the title picker in Achievements (only finished ones), the title drawn above the character at home and in the park, and the petting counter / limit.
SRC=sys.argv[1]; TAG=sys.argv[2]; PORT=int(sys.argv[3]); VIEWS=sys.argv[4].split(',') if len(sys.argv)>4 else ['desk','portrait','land','tiny']
D=os.environ.get('OUT') or os.path.join(tempfile.gettempdir(),'cozydogs_browser_tests');os.makedirs(D,exist_ok=True)   # screenshots + temp data files go here
CID='browser-test-client.apps.googleusercontent.com'
PA,PB,JP=PORT,PORT+40,PORT+50          # game with Google, game without Google, fake Google key server
datas=[f'{D}/data_{TAG}a.json',f'{D}/data_{TAG}b.json']
for f in datas:
    for g in (f,f+'.bak'):
        if os.path.exists(g): os.remove(g)
base=dict(os.environ,CD_TEST='1',ADMIN_KEY='browseradmin1')
for k in ('SUPABASE_URL','SUPABASE_KEY','GOOGLE_CLIENT_ID','CD_GOOGLE_JWKS','CD_PET_DAILY'): base.pop(k,None)
stub=subprocess.Popen(['node',SRC+'/browser_tests/google_stub.js',str(JP),CID],cwd=SRC,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
stub.stdout.readline()
srvA=subprocess.Popen(['node',SRC+'/server.js'],cwd=SRC,env=dict(base,PORT=str(PA),DATA=datas[0],GOOGLE_CLIENT_ID=CID,CD_GOOGLE_JWKS=f'http://127.0.0.1:{JP}/certs',CD_PET_DAILY='5'),stdout=open(f'{D}/srv_{TAG}a.log','w'),stderr=subprocess.STDOUT)
srvB=subprocess.Popen(['node',SRC+'/server.js'],cwd=SRC,env=dict(base,PORT=str(PB),DATA=datas[1]),stdout=open(f'{D}/srv_{TAG}b.log','w'),stderr=subprocess.STDOUT)
time.sleep(1.8)
URL=f'http://localhost:{PA}'; URLB=f'http://localhost:{PB}'
res=[]
def ck(c,n):
    res.append(bool(c));print('PASS' if c else 'FAIL',n,flush=True)
def mint(sub,email,**kw):
    q=urllib.parse.urlencode(dict(sub=sub,email=email,**kw))
    return urllib.request.urlopen(f'http://127.0.0.1:{JP}/mint?{q}',timeout=5).read().decode()
ALL={'desk':(1280,800,False),'portrait':(390,844,True),'land':(844,390,True),'tiny':(320,568,True)}
# a fake "Sign in with Google" button (what Google's script would draw); clicking it calls the page's callback with the token we put in __gsi.cred
GSTUB="""
window.__gsi={inits:0,btns:0,cid:null,cb:null,opts:null,cred:null};
window.google={accounts:{id:{
 initialize:o=>{__gsi.inits++;__gsi.cid=o.client_id;__gsi.cb=o.callback},
 renderButton:(el,o)=>{__gsi.btns++;__gsi.opts=o;el.innerHTML='<div class="fakeg" role="button" tabindex="0" style="box-sizing:border-box;width:'+(o.width||200)+'px;height:40px;border:1px solid #777;border-radius:20px;background:#fff;color:#222;display:flex;align-items:center;justify-content:center;font:14px sans-serif;cursor:pointer">G &nbsp;'+(o.text||'')+'</div>';el.firstChild.onclick=()=>__gsi.cb&&__gsi.cb({credential:__gsi.cred})},
 prompt:()=>{},disableAutoSelect:()=>{}}}};
"""
CLEAN="document.querySelectorAll('.coach,.tut').forEach(o=>o.classList.add('hidden'));document.querySelectorAll('#mods .ov,.reveal').forEach(o=>o.remove())"
FT="""window.__ft=[];(()=>{const o=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(t,...a){try{if(__ft.length>600)__ft.splice(0,300);__ft.push(String(t))}catch(e){}return o.call(this,t,...a)}})()"""
try:
  with sync_playwright() as p:
    b=p.chromium.launch()
    def newctx(w,h,touch,**kw):
        ctx=b.new_context(viewport={'width':w,'height':h},is_mobile=touch,has_touch=touch,device_scale_factor=1,**kw)
        ctx.add_init_script(GSTUB);ctx.gcalls=[]
        ctx.route('**/accounts.google.com/**',lambda r:(ctx.gcalls.append(r.request.url),r.abort()))       # the real Google must never be reached from a test
        return ctx
    for name in VIEWS:
        w,h,touch=ALL[name]
        ctx=newctx(w,h,touch)
        pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append('PAGEERR '+str(e)));pg.on('console',lambda m:errs.append(m.text) if m.type=='error' else None)
        def tap(sel,page=None):
            q=page or pg
            if touch: q.tap(sel)
            else: q.click(sel)
        sfx=secrets.token_hex(2)
        # ================= 1) the login screen
        pg.goto(URL);pg.wait_for_selector('#gBox:not(.hidden) #gBtn .fakeg',timeout=7000);pg.wait_for_timeout(300)
        ck(pg.evaluate("__gsi.inits==1&&__gsi.cid=='%s'"%CID),f'[{name}] the page asked Google for a button with the client id the server gave it')
        ck(re.search(r'^(หรือ|or)$',pg.inner_text('#gBox .gor').strip(),re.I),f'[{name}] a small "or" line separates the password form from the Google button')
        fit=pg.evaluate("(()=>{const c=document.querySelector('.logincard').getBoundingClientRect(),g=document.querySelector('#gBtn .fakeg').getBoundingClientRect();return g.left>=c.left-1&&g.right<=c.right+1&&g.left>=0&&g.right<=innerWidth&&document.documentElement.scrollWidth<=innerWidth+1})()")
        ck(fit,f'[{name}] the Google button fits inside the login card and the screen')
        pg.screenshot(path=f'{D}/{TAG}_{name}_1login.png')
        tap('#tReg');pg.wait_for_timeout(150);ck(pg.is_visible('#gBox'),f'[{name}] the button is also there on the Register tab (sign up with Google)')
        tap('#tLogin');pg.wait_for_timeout(150)
        tap('#aForgot');pg.wait_for_timeout(200);ck(not pg.is_visible('#gBox'),f'[{name}] the button is hidden on the "forgot password" panel')
        tap('#fForgot [data-do=ltab]');pg.wait_for_timeout(200);ck(pg.is_visible('#gBox'),f'[{name}] ...and back on the login tab')
        # ================= 2) a NEW Google user: asked for a game name
        user='gk'+name[:3]+sfx;email=f'{user}@example.com'
        gsub='sub'+secrets.token_hex(4)
        pg.evaluate("t=>{__gsi.cred=t}",mint(gsub,email))
        tap('#gBtn .fakeg');pg.wait_for_selector('#mods .ov[data-mod=gname]',timeout=7000);pg.wait_for_timeout(300)
        mod=pg.inner_text('#mods [data-mod=gname]')
        ck(email in mod,f'[{name}] the name window shows the Google e-mail')
        sug=pg.input_value('#gName');ck(re.fullmatch(r'[A-Za-z0-9_]{3,16}',sug),f'[{name}] a game name is suggested ({sug})')
        ck(pg.evaluate("!S.loaded"),f'[{name}] nobody is logged in yet')
        pg.evaluate("document.querySelector('#mods .ov[data-mod=gname]').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))");pg.wait_for_timeout(200)
        ck(pg.evaluate("!!document.querySelector('#mods .ov[data-mod=gname]')"),f'[{name}] tapping outside does not close the name window')
        fitm=pg.evaluate("(()=>{const m=document.querySelector('#mods .ov[data-mod=gname] .mod').getBoundingClientRect(),i=document.querySelector('#gName').getBoundingClientRect(),b=document.querySelector('#mods [data-do=gnamego]').getBoundingClientRect();return m.left>=0&&m.right<=innerWidth&&i.right<=m.right+1&&b.right<=m.right+1&&b.bottom<=innerHeight+1})()")
        ck(fitm,f'[{name}] the name window fits the screen (input and the start button are inside it)')
        pg.screenshot(path=f'{D}/{TAG}_{name}_2name.png')
        pg.fill('#gName','ab');tap('#mods [data-do=gnamego]');pg.wait_for_function("document.querySelector('#gErr')&&document.querySelector('#gErr').textContent.trim().length>0",timeout=5000)
        ck(pg.evaluate("!!document.querySelector('#mods .ov[data-mod=gname]')&&!S.loaded"),f'[{name}] a too short name is refused and the window stays open ({pg.inner_text("#gErr")[:40]})')
        pg.fill('#gName','Guest'+sfx);tap('#mods [data-do=gnamego]');pg.wait_for_timeout(700)
        ck(pg.evaluate("!S.loaded")and pg.inner_text('#gErr').strip()!='',f'[{name}] a name starting with Guest is refused')
        pg.fill('#gName',user);pg.keyboard.press('Enter')
        pg.wait_for_selector('#game.on',timeout=9000);pg.wait_for_timeout(1200)
        ck(pg.evaluate("S.loaded&&!S.guest&&S.name=='%s'"%user)and not pg.evaluate("!!document.querySelector('#mods .ov[data-mod=gname]')"),f'[{name}] a good name creates the account, logs in and closes the window')
        ck(pg.evaluate("S.me.gl=='%s'"%email),f'[{name}] the game knows the account is linked to Google')
        pg.wait_for_timeout(1500);pg.evaluate(CLEAN)
        # settings: shows "linked" with the e-mail, no recovery-code row for a password-less account, no second button
        pg.evaluate("DO.settings()");pg.wait_for_timeout(350)
        st=pg.inner_text('#mods [data-mod=settings]')
        ck(('Google' in st) and email in st and re.search('ผูกแล้ว|Linked',st),f'[{name}] Settings shows Google as linked with the e-mail')
        ck(pg.evaluate("!document.querySelector('#gLink')")and not pg.evaluate("!!document.querySelector('#mods [data-do=recnew]')"),f'[{name}] ...no link button again and no recovery-code row (Google is the way back in)')
        pg.screenshot(path=f'{D}/{TAG}_{name}_3settings.png');pg.evaluate(CLEAN)
        # ================= 3) petting counter and daily limit (server limit is 5 here)
        pg.evaluate("S.sel=Object.keys(S.dogs)[0];UI.care()");pg.wait_for_timeout(250)
        ck(pg.inner_text('#care [data-petn]').strip()=='0/5',f'[{name}] the Pet button shows how many hearts counted today (0/5)')
        for i in range(5): pg.evaluate("document.querySelector('#care [data-do=act][data-a=pet]').click()");pg.wait_for_timeout(300)
        ck(pg.inner_text('#care [data-petn]').strip()=='5/5',f'[{name}] after 5 pets it says 5/5 ({pg.inner_text("#care [data-petn]").strip()})')
        pg.evaluate("document.querySelector('#toasts').innerHTML=''")
        for i in range(3): pg.evaluate("document.querySelector('#care [data-do=act][data-a=pet]').click()");pg.wait_for_timeout(350)
        toasts=pg.evaluate("[...document.querySelectorAll('#toasts .toast')].map(e=>e.textContent)")
        lim=[x for x in toasts if re.search('5 ครั้ง|5 times',x)]
        ck(len(lim)==1,f'[{name}] over the limit the player is told ONCE (not for every tap): {toasts}')
        ck(pg.inner_text('#care [data-petn]').strip()=='5/5',f'[{name}] ...and the counter stays at 5/5')
        pg.screenshot(path=f'{D}/{TAG}_{name}_4pets.png');pg.evaluate("S.sel=null;UI.care()")
        # ================= 4) the achievement above the head
        pg.evaluate(FT)
        pg.evaluate("send({t:'admin',key:'browseradmin1',coins:500000})");pg.wait_for_timeout(500)
        pg.evaluate("DO.capsule()");pg.wait_for_timeout(500)
        pg.evaluate("(()=>{const e=[...document.querySelectorAll('#mods [data-do=gacha]')].find(b=>b.dataset.n=='10'&&!b.dataset.tk);e.click()})()");pg.wait_for_timeout(3500)
        pg.evaluate(CLEAN);pg.evaluate("DO.quests()");pg.wait_for_timeout(400)
        tap('#mods [data-mod=quests] [data-do=qtab][data-k=a]');pg.wait_for_timeout(350)
        n_done=pg.evaluate("S.ach.filter(a=>a.prog>=a.goal).length");n_btn=pg.evaluate("document.querySelectorAll('#mods [data-do=atitle]').length")
        ck(n_done>=2 and n_btn==n_done,f'[{name}] "Show above head" buttons exist for the finished achievements only ({n_btn} buttons, {n_done} finished)')
        ck(pg.evaluate("!document.querySelector('#mods [data-do=atitle][data-id=pet1k]')"),f'[{name}] an unfinished achievement has no such button')
        ck(re.search('Achievement|เหนือหัว|above',pg.inner_text('#mods [data-mod=quests]')),f'[{name}] a short hint explains that ONE finished achievement can be shown')
        pg.screenshot(path=f'{D}/{TAG}_{name}_5ach.png')
        pg.evaluate("document.querySelector('#mods [data-do=atitle][data-id=d5]').scrollIntoView({block:'center'})")
        tap('#mods [data-do=atitle][data-id=d5]');pg.wait_for_timeout(700)
        ck(pg.evaluate("S.title=='d5'&&S.me.ti&&S.me.ti.id=='d5'&&S.ownerTi&&S.ownerTi.id=='d5'"),f'[{name}] choosing "Dog Lover" is accepted by the server and the page knows it')
        ck(pg.evaluate("document.querySelector('#mods [data-do=atitle][data-id=d5]').classList.contains('mint')&&document.querySelectorAll('#mods [data-do=atitle].mint').length==1"),f'[{name}] exactly ONE button is marked as "showing above head"')
        want=pg.evaluate("'🏆 '+t('Dog Lover')");pg.evaluate("__ft.length=0");pg.wait_for_timeout(700)
        ck(want in pg.evaluate("__ft"),f'[{name}] the gold tag "{want}" is drawn above the character at home')
        tap('#mods [data-do=atitle][data-id=caps10]');pg.wait_for_timeout(700)
        ck(pg.evaluate("S.title=='caps10'&&document.querySelectorAll('#mods [data-do=atitle].mint').length==1"),f'[{name}] choosing another one replaces it (still only one)')
        tap('#mods [data-do=atitle][data-id=caps10]');pg.wait_for_timeout(700)
        ck(pg.evaluate("S.title===null&&S.ownerTi===null&&S.me.ti===null"),f'[{name}] tapping the chosen one again hides it')
        pg.evaluate("__ft.length=0");pg.wait_for_timeout(600)
        ck(not any(s.startswith('🏆 ') for s in pg.evaluate("__ft")),f'[{name}] ...and the tag is no longer drawn')
        pg.evaluate("send({t:'ach_title',id:'d5'})");pg.wait_for_timeout(500);pg.evaluate(CLEAN)
        pg.screenshot(path=f'{D}/{TAG}_{name}_6home.png')
        # the title is still above the head with the "tap to change outfit" first-time hint
        pg.evaluate("LS.set('cd_avhint',false)");pg.evaluate("__ft.length=0");pg.wait_for_timeout(600)
        fts=pg.evaluate("__ft");ck(want in fts and any('👕' in s for s in fts),f'[{name}] the tag and the first-time outfit hint are drawn together (the tag is not hidden by the hint)')
        pg.evaluate("LS.set('cd_avhint',true)")
        # ================= 5) another player sees it in the park
        c2=newctx(w,h,touch);q=c2.new_page();errs2=[];q.on('pageerror',lambda e:errs2.append('PAGEERR '+str(e)))
        wname='wt'+name[:3]+sfx;q.goto(URL);q.wait_for_timeout(600)
        tap('#tReg',q);q.fill('#rUser',wname);q.fill('#rMail','w@t.co');q.fill('#rPass','secret1');tap('#fReg button[type=submit]',q)
        q.wait_for_selector('#game.on',timeout=9000);q.wait_for_timeout(1500);q.evaluate(CLEAN)
        q.evaluate("send({t:'visit',id:'%s'})"%user);q.wait_for_timeout(700)
        ck(q.evaluate("S.owner=='%s'&&S.ownerTi&&S.ownerTi.id=='d5'"%user),f'[{name}] a visitor to the house gets the owner\'s title')
        q.evaluate(FT);q.evaluate("__ft.length=0");q.wait_for_timeout(700)
        ck(want in q.evaluate("__ft"),f'[{name}] ...and the tag is drawn for the visitor too')
        q.evaluate("DO.home()");q.wait_for_timeout(500)
        q.evaluate("DO.park()");q.wait_for_selector('body.inpark',timeout=7000)
        pg.evaluate("DO.park()");pg.wait_for_selector('body.inpark',timeout=7000);q.wait_for_timeout(900)
        ck(q.evaluate("!!Park.m['%s']&&Park.m['%s'].ti&&Park.m['%s'].ti.id=='d5'"%(user,user,user)),f'[{name}] in the park the other player\'s member list carries the title')
        pg.evaluate("send({t:'ach_title',id:'caps10'})");q.wait_for_timeout(900)
        ck(q.evaluate("Park.m['%s'].ti.id=='caps10'"%user),f'[{name}] a change while both are in the park reaches the other player at once')
        q.evaluate(FT);q.evaluate("__ft.length=0");q.wait_for_timeout(1200)
        wantc=q.evaluate("'🏆 '+t('Capsule Fan')");ftq=q.evaluate("__ft")
        ck(wantc in ftq,f'[{name}] the tag "{wantc}" is drawn above the character in the park ({len(ftq)} texts seen)')
        q.screenshot(path=f'{D}/{TAG}_{name}_7park.png')
        ck(not errs2,f'[{name}] no page errors on the visitor\'s side {errs2[:2]}')
        c2.close()
        # ================= 6) log out, come back with the same Google account (no name window), keep the title
        pg.evaluate("DO.home&&DO.home()");pg.wait_for_timeout(300)
        pg.evaluate("DO.logout()");pg.wait_for_selector('#gBox:not(.hidden) #gBtn .fakeg',timeout=8000);pg.wait_for_timeout(400)
        pg.evaluate("t=>{__gsi.cred=t}",mint(gsub,email));tap('#gBtn .fakeg')
        pg.wait_for_selector('#game.on',timeout=9000);pg.wait_for_timeout(900)
        ck(pg.evaluate("S.loaded&&S.name=='%s'"%user)and not pg.evaluate("!!document.querySelector('#mods .ov[data-mod=gname]')"),f'[{name}] the same Google user comes straight back in (no name window)')
        ck(pg.evaluate("S.me.ti&&S.me.ti.id=='caps10'"),f'[{name}] ...and the chosen title is still there')
        # ================= 7) a password account links Google in Settings, then both ways in work
        pg.evaluate("DO.logout()");pg.wait_for_selector('#gBox:not(.hidden) #gBtn .fakeg',timeout=8000);pg.wait_for_timeout(300)
        pw='pw'+name[:3]+sfx;pemail=f'{pw}@gmail.test';psub='psub'+secrets.token_hex(4)
        tap('#tReg');pg.fill('#rUser',pw);pg.fill('#rMail',pemail);pg.fill('#rPass','secret1');tap('#fReg button[type=submit]')
        pg.wait_for_selector('#game.on',timeout=9000);pg.wait_for_timeout(1000);pg.evaluate("DO.recdone&&DO.recdone()");pg.evaluate(CLEAN)
        pg.evaluate("DO.settings()");pg.wait_for_selector('#gLink .fakeg',timeout=6000)
        ck(pg.evaluate("S.me.gl===null")and re.search('Google',pg.inner_text('#mods [data-mod=settings]')),f'[{name}] a password account sees the Google row in Settings with the button')
        ck(pg.evaluate("(()=>{const m=document.querySelector('#mods [data-mod=settings] .mod').getBoundingClientRect(),g=document.querySelector('#gLink .fakeg').getBoundingClientRect();return g.left>=m.left-1&&g.right<=m.right+1})()"),f'[{name}] ...and the button fits inside the Settings window')
        pg.evaluate("t=>{__gsi.cred=t}",mint(psub,pemail));tap('#gLink .fakeg');pg.wait_for_timeout(1200)
        ck(pg.evaluate("S.me.gl=='%s'"%pemail),f'[{name}] linking works: the game now knows the Google e-mail')
        st=pg.inner_text('#mods [data-mod=settings]')
        ck(re.search('ผูกแล้ว|Linked',st) and pemail in st and pg.evaluate("!document.querySelector('#gLink')"),f'[{name}] Settings switched to "linked" at once (no stale button)')
        ck(any(re.search('ผูกบัญชี Google แล้ว|Google account linked',t) for t in pg.evaluate("[...document.querySelectorAll('#toasts .toast')].map(e=>e.textContent)")),f'[{name}] a "Google account linked" message appeared')
        ck(pg.evaluate("!!document.querySelector('#mods [data-do=recnew]')"),f'[{name}] a password account keeps its recovery-code row')
        pg.evaluate(CLEAN)
        pg.evaluate("DO.logout()");pg.wait_for_selector('#gBox:not(.hidden) #gBtn .fakeg',timeout=8000);pg.wait_for_timeout(300)
        pg.evaluate("t=>{__gsi.cred=t}",mint(psub,pemail));tap('#gBtn .fakeg')
        pg.wait_for_selector('#game.on',timeout=9000);pg.wait_for_timeout(700)
        ck(pg.evaluate("S.loaded&&S.name=='%s'"%pw),f'[{name}] Google now signs in to that same password account')
        pg.evaluate("DO.logout()");pg.wait_for_selector('#fLogin',timeout=8000);pg.wait_for_timeout(300)
        pg.fill('#lUser',pw);pg.fill('#lPass','secret1');tap('#fLogin button[type=submit]');pg.wait_for_selector('#game.on',timeout=9000)
        ck(pg.evaluate("S.loaded&&S.name=='%s'"%pw),f'[{name}] ...and the password still works')
        # a guest has no Google row
        pg.evaluate("DO.logout()");pg.wait_for_selector('#fLogin',timeout=8000);pg.wait_for_timeout(300)
        tap('#fLogin [data-do=guest]');pg.wait_for_selector('#game.on',timeout=9000);pg.wait_for_timeout(1200);pg.evaluate(CLEAN)
        pg.evaluate("DO.settings()");pg.wait_for_timeout(350)
        ck(pg.evaluate("S.guest")and not re.search('Google',pg.inner_text('#mods [data-mod=settings]')),f'[{name}] a guest sees no Google row in Settings')
        pg.evaluate(CLEAN)
        # ================= 8) English texts + the hint for in-app browsers
        pg.evaluate("DO.logout()");pg.wait_for_selector('#gBox:not(.hidden) #gBtn .fakeg',timeout=8000)
        pg.evaluate("S.set.lang='en';applyLang()");pg.wait_for_timeout(200)
        ck(pg.inner_text('#gBox .gor').strip()=='or' and pg.evaluate("__gsi.opts.locale")=='en',f'[{name}] English: the divider says "or" and the Google button is drawn again in English')
        pg.evaluate("S.set.lang='th';applyLang()");pg.wait_for_timeout(200)
        ck(pg.inner_text('#gBox .gor').strip()=='หรือ' and pg.evaluate("__gsi.opts.locale")=='th',f'[{name}] Thai: the divider says "หรือ" and the Google button is in Thai')
        ck(not pg.is_visible('#gNote'),f'[{name}] no warning in a normal browser')
        ck(not ctx.gcalls,f'[{name}] the page never tried to reach the real Google in the test ({ctx.gcalls[:2]})')
        ck(not [e for e in errs if 'favicon' not in e and 'ERR_FAILED' not in e],f'[{name}] no page errors / console errors {errs[:3]}')
        ctx.close()
        ctxi=newctx(w,h,touch,user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0.0.0')
        pi=ctxi.new_page();pi.goto(URL);pi.wait_for_selector('#gNote:not(.hidden)',timeout=7000)
        ck(re.search('Safari',pi.inner_text('#gNote')),f'[{name}] inside the Instagram browser a note says to open the page in Safari/Chrome')
        pi.screenshot(path=f'{D}/{TAG}_{name}_8inapp.png');ctxi.close()
    # ================= 9) a server WITHOUT a Google client id: nothing changes for the players
    ctxb=newctx(1280,800,False);pb=ctxb.new_page();errb=[];pb.on('pageerror',lambda e:errb.append(str(e)))
    cfg=json.loads(urllib.request.urlopen(f'{URLB}/config.json',timeout=5).read().decode())
    ck(cfg.get('google',1) is None,f'no Google client id on the server: /config.json says so {cfg}')
    pb.goto(URLB);pb.wait_for_timeout(1500)
    ck(not pb.is_visible('#gBox') and pb.evaluate("__gsi.inits==0&&__gsi.btns==0"),'...so the login screen has no Google button (nothing loaded either)')
    pb.click('#tReg');pb.fill('#rUser','nog'+secrets.token_hex(2));pb.fill('#rMail','n@t.co');pb.fill('#rPass','secret1');pb.click('#fReg button[type=submit]')
    pb.wait_for_selector('#game.on',timeout=9000);pb.wait_for_timeout(1200);pb.evaluate("DO.recdone&&DO.recdone()");pb.evaluate(CLEAN)
    pb.evaluate("DO.settings()");pb.wait_for_timeout(350)
    ck(not re.search('Google',pb.inner_text('#mods [data-mod=settings]')),'...and Settings has no Google row')
    pb.evaluate(CLEAN);pb.evaluate("send({t:'google',credential:'abc.def.ghi'})");pb.wait_for_timeout(500)
    ck(pb.evaluate("S.loaded"),'...and a forged Google message to such a server does nothing')
    ck(not ctxb.gcalls and not errb,f'...and no errors {errb[:2]}')
    ctxb.close()
    b.close()
finally:
  for pr in (srvA,srvB,stub):
    try: pr.terminate()
    except Exception: pass
print('RESULT',sum(res),'/',len(res))
sys.exit(0 if all(res) else 1)
