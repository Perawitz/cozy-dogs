import os,sys,subprocess,time,json
from playwright.sync_api import sync_playwright
# v6.2.1 - connection handling on phones, and a few window-handling fixes.
#   1. a guest whose connection drops comes back as the SAME guest (it used to become a new, empty guest)
#   2. a connection that looks open but is dead (phone slept) is noticed and replaced
#   3. one account opened on two devices: the older one shows a "play here again" window and does NOT reload by itself (they used to reload each other forever)
#   4. a failed automatic login keeps the saved token unless the server says it is expired
#   5. tapping the dark background closes a window WITHOUT the tap also pressing the button underneath
#   6. the trade window's X cancels the trade
#   7. English ticker texts from the server are shown in Thai
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
def clean(pg):
    pg.evaluate("document.querySelectorAll('.coach,.tut').forEach(o=>o.classList.add('hidden'));document.querySelectorAll('#mods .ov').forEach(o=>o.remove())")
def newpage(b,w=390,h=844,touch=True):
    ctx=b.new_context(viewport={'width':w,'height':h},is_mobile=touch,has_touch=touch,device_scale_factor=1)
    pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append('PAGEERR '+str(e)));pg.on('console',lambda m:errs.append(m.text) if m.type=='error' else None)
    pg.goto(URL);pg.wait_for_timeout(600);return ctx,pg,errs
def register(pg,user):
    pg.click('#tReg');pg.fill('#rUser',user);pg.fill('#rMail','m@t.co');pg.fill('#rPass','secret1');pg.click('#fReg button[type=submit]')
    pg.wait_for_selector('#game.on',timeout=8000);pg.wait_for_timeout(1000);clean(pg)
    pg.evaluate("document.querySelectorAll('#mods .ov').forEach(o=>o.remove())")
try:
  with sync_playwright() as p:
    b=p.chromium.launch()
    # ---------- 1. guest keeps its identity
    ctx,pg,errs=newpage(b)
    pg.click('[data-do=guest]');pg.wait_for_selector('#game.on',timeout=8000);pg.wait_for_timeout(1200);clean(pg)
    st=pg.evaluate("({name:S.name,guest:S.guest,token:!!S.token,coins:S.me.coins,dogs:S.me.total})")
    ck(st['guest'] and st['token'],f'[guest] the guest gets a login token {st}')
    pg.evaluate("window.__alive=1;S.ws.close()");pg.wait_for_timeout(500)
    ck(pg.evaluate("getComputedStyle(document.querySelector('#banner')).display")!='none','[guest] a "reconnecting" banner is shown while the connection is down')
    pg.wait_for_function("S.ws&&S.ws.readyState==1&&document.querySelector('#banner').style.display=='none'",timeout=12000)
    pg.wait_for_timeout(800)
    st2=pg.evaluate("({name:S.name,guest:S.guest,coins:S.me.coins,dogs:S.me.total,alive:window.__alive})")
    ck(st2['name']==st['name'] and st2['coins']==st['coins'] and st2['dogs']==st['dogs'],f'[guest] after the drop it is the same guest with the same progress {st2}')
    ck(st2['alive']==1,'[guest] the page did not reload')
    # ---------- 2. a dead connection is noticed
    pg.evaluate("window.__oldws=S.ws;S.ws.onmessage=null;S.ws.send=()=>{};document.dispatchEvent(new Event('visibilitychange'))")
    pg.wait_for_function("S.ws!==window.__oldws&&S.ws.readyState==1",timeout=20000)
    pg.wait_for_timeout(1500)
    st3=pg.evaluate("({name:S.name,open:S.ws.readyState==1,coins:S.me.coins,banner:document.querySelector('#banner').style.display})")
    ck(st3['open'] and st3['name']==st['name'],f'[dead link] a connection that no longer answers is replaced, same player {st3}')
    # the heartbeat watchdog: no message for 30 s -> reconnect (simulated by moving the clock of the last message back)
    pg.evaluate("window.__oldws=S.ws;S.ws.onmessage=null;S.ws.send=()=>{};lastRx=Date.now()-60000")
    pg.wait_for_function("S.ws!==window.__oldws&&S.ws.readyState==1",timeout=25000)
    ck(True,'[dead link] the 10-second heartbeat also replaces a link that was silent for 30 s')
    ck(not [e for e in errs if 'favicon' not in e and 'WebSocket' not in e and 'ERR_' not in e],f'[guest] no script errors {errs[:3]}')
    ctx.close()
    # ---------- 3. two devices, one account
    cA,pA,eA=newpage(b);register(pA,'twin1')
    pA.evaluate("window.__m=1")
    cB,pB,eB=newpage(b)
    pB.fill('#lUser','twin1');pB.fill('#lPass','secret1');pB.click('#fLogin button[type=submit]')
    pB.wait_for_selector('#game.on',timeout=8000);pB.wait_for_timeout(800);clean(pB);pB.evaluate("window.__m=1")
    pA.wait_for_selector('#mods .ov[data-mod=kicked]',timeout=6000)
    ck(True,'[2 devices] the older device shows the "opened on another device" window')
    pA.wait_for_timeout(5000)
    ck(pA.evaluate("window.__m===1"),'[2 devices] ...and does NOT reload itself (no endless kicking)')
    ck(pB.evaluate("window.__m===1&&!document.querySelector('#mods .ov[data-mod=kicked]')&&S.ws.readyState==1"),'[2 devices] the newer device is untouched')
    pA.click('#mods .ov[data-mod=kicked] [data-do=relogin]')
    pA.wait_for_selector('#game.on',timeout=10000);pA.wait_for_timeout(500)
    pB.wait_for_selector('#mods .ov[data-mod=kicked]',timeout=6000)
    pB.wait_for_timeout(5000)
    ck(pB.evaluate("window.__m===1")and pA.evaluate("S.loaded&&S.ws.readyState==1"),'[2 devices] taking the account back works once; the other one now waits (no loop)')
    ck(not [e for e in eA+eB if 'favicon' not in e and 'WebSocket' not in e and 'ERR_' not in e],f'[2 devices] no script errors {(eA+eB)[:3]}')
    cA.close();cB.close()
    # ---------- 4. a failed automatic login keeps the token unless it is expired
    c4,p4,e4=newpage(b)
    r=p4.evaluate("""()=>{LS.set('cd_token','tok123');S.token='tok123';const out={};
      S.autoResume=true;H.auth({t:'auth',ok:false,err:'busy',busy:1});out.afterBusy=LS.get('cd_token',null);out.scr1=S.scr;
      S.autoResume=true;H.auth({t:'auth',ok:false,err:'expired',exp:1});out.afterExp=LS.get('cd_token',null);out.tok=S.token;return out}""")
    ck(r['afterBusy']=='tok123','[token] a "too many tries" answer keeps the saved login')
    ck(r['afterExp'] is None and r['tok'] is None,'[token] an "expired" answer forgets it')
    c4.close()
    # ---------- 5. tapping the dark background does not press the button underneath
    c5,p5,e5=newpage(b);register(p5,'bgtap')
    p5.evaluate("window.__cl=[];document.addEventListener('click',e=>{const t=e.target.closest('[data-do]');window.__cl.push(t?t.dataset.do:e.target.tagName)},true)")
    p5.evaluate("DO.daily()");p5.wait_for_timeout(500)
    pos=p5.evaluate("""()=>{const d=[...document.querySelectorAll('#dock .dk')].map(e=>({r:e.getBoundingClientRect(),k:e.dataset.do})).filter(o=>o.r.width>10);const m=document.querySelector('#mods .panel').getBoundingClientRect();
      const o=d.find(o=>o.r.top>m.bottom+4||o.r.bottom<m.top-4);return o?{x:o.r.left+o.r.width/2,y:o.r.top+o.r.height/2,k:o.k}:null}""")
    if pos:
        p5.touchscreen.tap(pos['x'],pos['y']);p5.wait_for_timeout(500)
        ck(p5.evaluate("!document.querySelector('#mods .ov[data-mod=daily]')"),f'[backdrop] tapping the dark background closes the window ({pos["k"]})')
        ck(pos['k'] not in p5.evaluate("window.__cl"),f'[backdrop] ...and the same tap did not also press "{pos["k"]}" underneath {p5.evaluate("window.__cl")}')
    else: ck(False,'[backdrop] could not find a dock button outside the window')
    c5.close()
    # ---------- 6. the trade window's X cancels the trade
    cA,pA,eA=newpage(b);register(pA,'trda');cB,pB,eB=newpage(b);register(pB,'trdb')
    pA.evaluate("send({t:'trade_req',name:'trdb'})");pB.wait_for_selector('#mods .ov[data-mod=tinv]',timeout=5000)
    pB.evaluate("DO.tans({from:'trda',ok:'1'})")
    pA.wait_for_selector('#mods .ov[data-mod=trade]',timeout=5000);pB.wait_for_selector('#mods .ov[data-mod=trade]',timeout=5000)
    pA.click('#mods .ov[data-mod=trade] .x');pA.wait_for_timeout(900)
    ck(pA.evaluate("!S.trade&&!document.querySelector('#mods .ov[data-mod=trade]')"),'[trade] the X closes the trade window')
    ck(pB.evaluate("!S.trade&&!document.querySelector('#mods .ov[data-mod=trade]')"),'[trade] ...and the other player\'s window closes too (the trade is really cancelled)')
    pA.wait_for_timeout(3300)      # the server lets one player send a request every 3 s
    pA.evaluate("send({t:'trade_req',name:'trdb'})");pB.wait_for_selector('#mods .ov[data-mod=tinv]',timeout=5000)
    ck(True,'[trade] a new trade can be started right away')
    cA.close();cB.close()
    # ---------- 7. ticker texts follow the language
    c7,p7,e7=newpage(b)
    r=p7.evaluate("""()=>{const o={};S.set.lang='th';o.a=locEvent('🐶 Mochi found a ball!');o.b=locEvent('⛏️ Mochi dug up a buried coin 💰 (+5💰)');o.c=locEvent('⛏️ Mochi dug up a shiny gem 💎');o.d=locEvent('💤 A และ B นอนด้วยกัน (+5💰)');
      S.set.lang='en';o.e=locEvent('💤 A และ B นอนด้วยกัน (+5💰)');o.f=locEvent('🐶 Mochi หิวแล้ว!');o.g=locEvent('🐶 Mochi found a ball!');S.set.lang='th';return o}""")
    ck(r['a']=='🐶 Mochi เจอลูกบอล!' and 'ขุดเจอเหรียญ' in r['b'] and '(+5💰)' in r['b'] and 'ขุดเจอเพชร' in r['c'],f'[language] English dog events appear in Thai {r["a"]} | {r["b"]} | {r["c"]}')
    ck(r['d']=='💤 A และ B นอนด้วยกัน (+5💰)','[language] Thai texts stay as they are in Thai')
    ck(r['e']=='💤 A and B are napping together (+5💰)' and r['f']=='🐶 Mochi is hungry!' and r['g']=='🐶 Mochi found a ball!',f'[language] ...and the Thai ones appear in English when English is chosen {r["e"]} | {r["f"]}')
    c7.close()
    b.close()
finally:
  srv.terminate()
print('RESULT',sum(res),'/',len(res))
sys.exit(0 if all(res) else 1)
