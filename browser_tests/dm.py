import os,sys,subprocess,time,json,tempfile
from playwright.sync_api import sync_playwright
# Private chat (friend DMs + friends-only rooms) in a real browser: A (phone portrait / phone landscape / desktop) talks to B, C, D (desktop pages).
# Checks: dock 💌 + badge, DM with B, the text field keeps focus / text / DOM node while B's messages arrive, send by button + Enter, emoji bar + 200 counter, scrolling up is not interrupted,
# unread badge (dock + list) and toast, a 4-person room (create, rename, kick, add, mute, leave, disband), read-only after unfriending, English, phone keyboard fit, HTML in messages, guests, no JS errors.
# usage: python3 browser_tests/dm.py <repo> <tag> <port 3150-3159> [desk,portrait,land]      screenshots -> $OUT
SRC=sys.argv[1]; TAG=sys.argv[2]; PORT=sys.argv[3]; VIEWS=sys.argv[4].split(',') if len(sys.argv)>4 else ['portrait','land','desk']
D=os.environ.get('OUT') or os.path.join(tempfile.gettempdir(),'cozydogs_browser_tests');os.makedirs(D,exist_ok=True)
data=f'{D}/data_{TAG}.json'
for f in (data,data+'.bak'):
    if os.path.exists(f): os.remove(f)
env=dict(os.environ,PORT=PORT,DATA=data,CD_TEST='1',CD_DMGAP='40')
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
    pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append('PAGEERR '+str(e)+' | '+str(getattr(e,'stack','') or '')[:600].replace(chr(10),' ; ')));pg.on('console',lambda m:errs.append(m.text) if m.type=='error' else None)
    pg.goto(URL);pg.wait_for_timeout(600)
    pg.click('#tReg');pg.fill('#rUser',user);pg.fill('#rMail','m@t.co');pg.fill('#rPass','secret1');pg.click('#fReg button[type=submit]')
    pg.wait_for_selector('#game.on',timeout=8000);pg.wait_for_timeout(1200)
    pg.evaluate("document.querySelectorAll('.coach,.tut').forEach(o=>o.classList.add('hidden'));document.querySelectorAll('#mods .ov').forEach(o=>o.remove())")
    return ctx,pg,errs
def wf(pg,js,t=6000):
    try: pg.wait_for_function(js,timeout=t);return True
    except Exception: return False
def did(a,b): return 'dm:'+'|'.join(sorted([a.lower(),b.lower()]))
J=json.dumps
LAYOUT="""()=>{const o=document.querySelector('#mods .ov[data-mod=dm]'),p=o.querySelector('.panel'),r=p.getBoundingClientRect(),de=document.documentElement,mb=o.querySelector('.mb'),i=o.querySelector('.dmi'),ir=i.getBoundingClientRect(),vis=i.offsetParent!==null,
 hit=vis?document.elementFromPoint(ir.left+ir.width/2,ir.top+ir.height/2):null,bt=o.querySelector('.dmsend'),br=bt.getBoundingClientRect(),bh=vis?document.elementFromPoint(br.left+br.width/2,br.top+br.height/2):null,em=o.querySelector('.dmem').getBoundingClientRect(),lg=o.querySelector('.dmlog'),
 dml=getComputedStyle(o.querySelector('.dml')).display,dmc=getComputedStyle(o.querySelector('.dmc')).display;
 return{inView:r.left>=-.5&&r.top>=-.5&&r.right<=innerWidth+.5&&r.bottom<=innerHeight+.5,noHs:de.scrollWidth<=innerWidth&&document.body.scrollWidth<=innerWidth&&mb.scrollWidth<=mb.clientWidth+1&&p.scrollWidth<=p.clientWidth+1&&lg.scrollWidth<=lg.clientWidth+1,fs:getComputedStyle(i).fontSize,
  inputOk:vis&&hit===i&&ir.top>=0&&ir.bottom<=innerHeight,btnOk:!!bh&&bt.contains(bh),emOk:em.height>10&&em.left>=0&&em.right<=innerWidth+.5,logH:lg.clientHeight,two:dml!='none'&&dmc!='none',w:Math.round(r.width),h:Math.round(r.height)}}"""
try:
  with sync_playwright() as p:
    b=p.chromium.launch()
    for name in VIEWS:
      w,h,touch=ALL[name];n=name[:4];A,B,C,D_='dmA'+n,'dmB'+n,'dmC'+n,'dmD'+n;errl=[]
      try:
        ca,pa,ea=login(b,A,w,h,touch);cb,pb,eb=login(b,B,1280,800,False);cc,pc,ec=login(b,C,1280,800,False);cd,pd,ed=login(b,D_,1280,800,False);errl=[ea,eb,ec,ed]
        def T(pg,sel):
            if pg is pa and touch: pg.tap(sel)
            else: pg.click(sel)
        def yes(pg):      # confirm button of an "are you sure?" window; one retry, because a busy machine (4 browsers at once) can swallow a touch tap (Chrome reads a slow tap as a long press)
            T(pg,'#askYes')
            if not wf(pg,"!document.querySelector('#askYes')",1500): print('  (tap on the confirm button was lost - tapping again)',flush=True);T(pg,'#askYes')
        def OM(pg):      # v7.2: the 💌 button lives in the ☰ Menu window: open the menu, then tap the tile
            T(pg,'#dock .dk[data-do=menu]');wf(pg,"!!document.querySelector('#mods .ov[data-mod=menu]')",3000);T(pg,'#mods [data-mod=menu] .mn-t[data-k=dm]')
        def toasts(pg): return pg.evaluate("[...document.querySelectorAll('#toasts .toast')].map(t=>t.textContent).join(' | ')")
        def clr(*pgs):
            for pg in pgs: pg.evaluate("document.querySelectorAll('#toasts .toast').forEach(t=>t.remove())")
        def shot(pg,nm): pg.screenshot(path=f'{D}/{TAG}_{name}_{nm}.png')
        def lay(tag):
            l=pa.evaluate(LAYOUT)
            ck(l['inView'] and l['noHs'],f'[{name}] {tag}: window inside the screen, no horizontal scroll {l["w"]}x{l["h"]}')
            ck(l['inputOk'] and l['btnOk'] and l['emOk'],f'[{name}] {tag}: text field, send button and emoji bar are visible and tappable')
            ck(l['fs']=='16px',f'[{name}] {tag}: input font is 16px (no zoom-in on iOS): {l["fs"]}')
            ck(l['logH']>=(75 if h<500 else 200),f'[{name}] {tag}: the message area is big enough ({l["logH"]}px)')
            ck(l['two']==(w>=720 and h>=561),f'[{name}] {tag}: {"two panes" if w>=720 and h>=561 else "one pane at a time"} ({l["two"]})')
        # ---- friends: A with B, C, D
        for o,pg in ((B,pb),(C,pc),(D_,pd)):
            pa.evaluate("send({t:'friend_add',name:%s})"%J(o));ck(wf(pg,"S.fr&&S.fr.inReq.some(x=>x.name==%s)"%J(A)),f'[{name}] {o} got the friend request')
            pg.evaluate("send({t:'friend_ok',name:%s})"%J(A))
        ck(wf(pa,"S.fr&&S.fr.friends.length==3"),f'[{name}] A has 3 friends')
        pa.wait_for_timeout(600);clr(pa,pb,pc,pd)
        # ---- dock button
        T(pa,'#dock .dk[data-do=menu]');wf(pa,"!!document.querySelector('#mods .ov[data-mod=menu]')",3000)
        dk=pa.evaluate("(()=>{const d=document.querySelector('#mods [data-mod=menu] .mn-t[data-k=dm]');return d?{e:d.querySelector('.mn-e').textContent,l:d.querySelector('.mn-x b').textContent,fits:(()=>{const l=d.querySelector('.mn-x b').getBoundingClientRect(),b=d.getBoundingClientRect();return l.height<20&&l.left>=b.left+3&&l.right<=b.right-3})()}:null})()")
        ck(dk and dk['e']=='💌' and dk['l']=='แชทส่วนตัว' and dk['fits'],f'[{name}] the Menu has 💌 แชทส่วนตัว and its label fits {dk}')
        T(pa,'#mods [data-mod=menu] .mn-t[data-k=dm]');ck(wf(pa,"!!document.querySelector('#mods .ov[data-mod=dm] .dmw')&&!document.querySelector('#mods .ov[data-mod=menu]')",3000),f'[{name}] the Menu tile opens the private-chat window (and closes the menu)')
        ck(wf(pa,"document.querySelectorAll('.dmfx').length==3"),f'[{name}] the list offers the 3 friends (nobody was talked to yet)')
        pa.wait_for_timeout(400);shot(pa,'1_list')
        ck(pa.evaluate("getComputedStyle(document.querySelector('.dmw[data-p]')).display!='none'&&!!document.querySelector('.dml').offsetParent"),f'[{name}] the list is on screen first')
        # ---- open the DM with B
        DB=did(A,B);T(pa,'.dmfx[data-n="%s"]'%B);ck(wf(pa,"Dm.cur==%s&&Dm.log"%J(DB)),f'[{name}] tapping a friend opens the conversation')
        pa.wait_for_timeout(300)
        st=pa.evaluate("({p:document.querySelector('.dmw').dataset.p,v:document.querySelector('.dmc').dataset.v,title:document.querySelector('.dmh b').textContent,sub:document.querySelector('.dmh small').textContent,empty:!!document.querySelector('.dmlog .empty'),bk:getComputedStyle(document.querySelector('.dmbk')).display,listVis:!!document.querySelector('.dml').offsetParent})")
        ck(st['p']=='chat' and st['v']=='chat' and st['title']==B and '🟢' in st['sub'] and st['empty'],f'[{name}] chat header shows {B} online + the "say hi" empty state {st}')
        ck((st['bk']!='none')==(not (w>=720 and h>=561)) and st['listVis']==(w>=720 and h>=561),f'[{name}] ← back button only on phones, list hidden only on phones {st["bk"]},{st["listVis"]}')
        lay('chat view');shot(pa,'2_chat_empty')
        # ---- first message A -> B: B's dock badge + toast, B's list
        T(pa,'.dmi');pa.keyboard.type('สวัสดีจ้า');pa.keyboard.press('Enter')
        ck(wf(pa,"!document.querySelector('.dmi').value&&[...document.querySelectorAll('.dmm.me .dmb')].some(x=>x.textContent.includes('สวัสดีจ้า'))"),f'[{name}] Enter sends: field cleared, my bubble shows')
        ck(wf(pb,"S.me.dm==1"),f'[{name}] B: the menu badge counts 1 unread')
        bt=pb.evaluate("({badge:(document.querySelector('#dock .dk[data-do=menu] .bd')||{}).textContent,toast:[...document.querySelectorAll('#toasts .toast')].map(t=>t.textContent).join('|')})")
        ck(str(bt['badge']).isdigit() and int(bt['badge'])>=1 and '💬' in bt['toast'] and A in bt['toast'] and 'สวัสดีจ้า' in bt['toast'],f'[{name}] B: a menu badge (dm 1, plus the show nudge when a round is open) and a toast "💬 {A}: สวัสดีจ้า" {bt}')
        if name=='desk': shot(pb,'B_toast')
        OM(pb);ck(wf(pb,"!!document.querySelector('.dmr[data-id=%s] .dmbd')"%J(DB)),f'[{name}] B: the list row for {A} has an unread badge')
        ck(pb.evaluate("(document.querySelector('.dmr[data-id=%s] small')||{}).textContent"%J(DB))=='สวัสดีจ้า',f'[{name}] B: the row previews the last message')
        pb.click('.dmr[data-id=%s]'%J(DB));ck(wf(pb,"S.me.dm==0&&!document.querySelector('.dmr[data-id=%s] .dmbd')"%J(DB)),f'[{name}] B: opening the chat clears the badge (list + dock)')
        # ---- B writes while A is typing: focus / text / DOM node survive
        T(pa,'.dmi');pa.keyboard.type('พิมพ์อยู่');pa.evaluate("(()=>{const i=document.querySelector('.dmi');i.__mark='keep';document.querySelector('.dmf').__mark='keep'})()")
        for k in range(3):
            pb.fill('.dmi','hello from B #%d'%k);pb.press('.dmi','Enter');pa.wait_for_timeout(950)
            s=pa.evaluate("""()=>{const i=document.querySelector('.dmi');return{focus:document.activeElement===i,val:i.value,same:i.__mark==='keep'&&document.querySelector('.dmf').__mark==='keep',log:document.querySelector('.dmlog').textContent}}""")
            ck(s['focus'] and s['val']=='พิมพ์อยู่' and s['same'] and ('hello from B #%d'%k) in s['log'],f'[{name}] message #{k} from B arrived; the field kept focus, text and its DOM node ({s["focus"]},{s["val"]!r},{s["same"]})')
        ck(not any('hello from B' in x for x in [toasts(pa)]),f'[{name}] no toast for a chat that is open')
        pa.keyboard.type(' 🐶');ck(pa.evaluate("document.querySelector('.dmi').value")=='พิมพ์อยู่ 🐶',f'[{name}] can keep typing after messages arrived')
        cnt=pa.evaluate("document.querySelector('.dmct').textContent");ck(cnt=='%d/200'%len('พิมพ์อยู่ 🐶'),f'[{name}] the counter counts characters ({cnt})')
        shot(pa,'3_typing')
        T(pa,'.dmsend');ck(wf(pa,"!document.querySelector('.dmi').value"),f'[{name}] send button sends and clears the field')
        ck(wf(pb,"document.querySelector('.dmlog').textContent.includes('พิมพ์อยู่ 🐶')"),f'[{name}] B receives it live (open chat)')
        fo=pa.evaluate("document.activeElement===document.querySelector('.dmi')")
        ck(fo,f'[{name}] the field is still focused after tapping send (the phone keyboard stays open)')
        pa.wait_for_timeout(900);pa.keyboard.type('second one');pa.keyboard.press('Enter');ck(wf(pb,"document.querySelector('.dmlog').textContent.includes('second one')"),f'[{name}] Enter sends too')
        # ---- two sends within a split second: the second one is held back (text kept), not lost
        pa.wait_for_timeout(900);clr(pa);pa.keyboard.type('quick1');pa.keyboard.press('Enter');pa.keyboard.type('quick2');pa.keyboard.press('Enter');pa.wait_for_timeout(200)
        ck(pa.evaluate("document.querySelector('.dmi').value")=='quick2' and 'ส่งเร็ว' in toasts(pa),f'[{name}] two sends within a second: the 2nd is held back, its text stays, a friendly toast shows ({toasts(pa)[:40]})')
        pa.wait_for_timeout(800);pa.keyboard.press('Enter');ck(wf(pb,"document.querySelector('.dmlog').textContent.includes('quick2')")and wf(pa,"!document.querySelector('.dmi').value"),f'[{name}] ...and goes through a moment later')
        # ---- emoji bar + 200 limit
        pa.wait_for_timeout(300);T(pa,'.dmem button[data-e="🎉"]');ck(pa.evaluate("document.querySelector('.dmi').value")=='🎉' and pa.evaluate("document.activeElement===document.querySelector('.dmi')"),f'[{name}] emoji bar inserts at the caret and keeps focus')
        pa.evaluate("(()=>{const i=document.querySelector('.dmi');i.value='x'.repeat(260);i.dispatchEvent(new Event('input',{bubbles:true}))})()")
        c2=pa.evaluate("({n:Array.from(document.querySelector('.dmi').value).length,t:document.querySelector('.dmct').textContent,w:document.querySelector('.dmct').classList.contains('warn')})")
        ck(c2['n']==200 and c2['t']=='200/200' and c2['w'],f'[{name}] the field stops at 200 characters and the counter warns {c2}')
        pa.fill('.dmi','');ck(pa.evaluate("!document.querySelector('.dmsend').classList.contains('rdy')"),f'[{name}] empty field: send looks idle')
        # ---- HTML in a message is shown as text
        pb.evaluate("send({t:'dm_send',id:%s,m:'<img src=x onerror=\"window.__xss=1\"> <b>bold</b>'})"%J(DB));ck(wf(pa,"document.querySelector('.dmlog').textContent.includes('<img src=x')"),f'[{name}] a message with HTML arrived')
        ck(pa.evaluate("!window.__xss&&!document.querySelector('.dmlog img')&&!document.querySelector('.dmlog b')"),f'[{name}] ...and is only text (nothing was injected)')
        pb.evaluate("send({t:'dm_send',id:%s,m:'Z'.repeat(190)})"%J(DB));ck(wf(pa,"document.querySelector('.dmlog').textContent.includes('ZZZZZZZZZZZZZZZZZZZZ')"),f'[{name}] a very long word arrived')
        ck(pa.evaluate("(()=>{const l=document.querySelector('.dmlog'),b=[...l.querySelectorAll('.dmb')].pop().getBoundingClientRect(),r=l.getBoundingClientRect();return l.scrollWidth<=l.clientWidth+1&&b.right<=r.right+1&&b.left>=r.left-1})()"),f'[{name}] ...and wraps inside its bubble (no sideways scroll)')
        # ---- scrolling up is not interrupted
        for k in range(24):
            pb.evaluate("send({t:'dm_send',id:%s,m:'filler %d'})"%(J(DB),k));pa.wait_for_timeout(75)
        pa.wait_for_timeout(500)
        ck(pa.evaluate("(()=>{const l=document.querySelector('.dmlog');return l.scrollHeight>l.clientHeight+100&&l.scrollHeight-l.scrollTop-l.clientHeight<5})()"),f'[{name}] the log follows new messages while you are at the bottom')
        pa.evaluate("document.querySelector('.dmlog').scrollTop=0");pa.wait_for_timeout(300)
        pb.evaluate("send({t:'dm_send',id:%s,m:'while you read old messages'})"%J(DB));pa.wait_for_timeout(500)
        sc=pa.evaluate("({top:document.querySelector('.dmlog').scrollTop,pill:!document.querySelector('.dmpill').classList.contains('hidden'),t:document.querySelector('.dmpill').textContent})")
        ck(sc['top']<30 and sc['pill'],f'[{name}] scrolled up: not pulled down, a "new messages" button appears {sc}')
        shot(pa,'4_scrolled_up');T(pa,'.dmpill');pa.wait_for_timeout(300)
        ck(pa.evaluate("(()=>{const l=document.querySelector('.dmlog');return l.scrollHeight-l.scrollTop-l.clientHeight<5&&document.querySelector('.dmpill').classList.contains('hidden')})()"),f'[{name}] the button jumps to the newest message and hides')
        # ---- the phone keyboard (visualViewport) must not hide the field
        if touch:
            k=pa.evaluate("""(()=>{const o=document.querySelector('#mods .ov[data-mod=dm]'),vh=Math.round(innerHeight*.55);const od=Object.getOwnPropertyDescriptor(window,'visualViewport');Object.defineProperty(window,'visualViewport',{configurable:true,value:{height:vh,offsetTop:0,addEventListener(){}}});dmFit();
              const r=o.querySelector('.panel').getBoundingClientRect(),ib=o.querySelector('.dmi').getBoundingClientRect(),res={vh,h:o.style.height,pb:r.bottom,ib:ib.bottom,top:ib.top};Object.defineProperty(window,'visualViewport',od);dmFit();res.after=o.style.height;return res})()""")
            ck(k['h']==str(k['vh'])+'px' and k['pb']<=k['vh']+1 and k['ib']<=k['vh'] and k['top']>=0 and k['after']=='',f'[{name}] keyboard open (visible area {k["vh"]}px): the window shrinks, the field stays visible, then restores {k}')
        # ---- unread while the window is closed: dock badge + toast, then the list
        T(pa,'#mods .ov[data-mod=dm] .mh .x');pa.wait_for_timeout(300);ck(pa.evaluate("!document.querySelector('#mods .ov[data-mod=dm]')"),f'[{name}] the window closes')
        pa.wait_for_timeout(1300);clr(pa);pb.evaluate("send({t:'dm_send',id:%s,m:'ping while closed'})"%J(DB))
        ck(wf(pa,"S.me.dm==1&&parseInt((document.querySelector('#dock .dk[data-do=menu] .bd')||{}).textContent)>=1"),f'[{name}] A: the ☰ Menu button shows the unread badge')
        ck('💬' in toasts(pa) and B in toasts(pa) and 'ping while closed' in toasts(pa),f'[{name}] A: toast "💬 {B}: ping while closed" ({toasts(pa)[:60]})')
        shot(pa,'5_dock_badge')
        OM(pa);ck(wf(pa,"!!document.querySelector('.dmr[data-id=%s] .dmbd')"%J(DB)),f'[{name}] A: the list row shows the unread badge')
        pa.wait_for_timeout(300);shot(pa,'6_list_unread')
        T(pa,'.dmr[data-id=%s]'%J(DB));ck(wf(pa,"S.me.dm==0&&!document.querySelector('.dmr[data-id=%s] .dmbd')"%J(DB)),f'[{name}] A: opening the chat clears the badge (list + dock)')
        ck(pa.evaluate("[...document.querySelectorAll('.dmm .dmb')].some(x=>x.textContent.includes('ping while closed'))"),f'[{name}] the earlier history is shown when a chat is opened')
        # ---- unread in ANOTHER chat while one is open
        if not (w>=720 and h>=561): T(pa,'.dmbk');pa.wait_for_timeout(200)
        T(pa,'.dmfx[data-n="%s"]'%C);ck(wf(pa,"Dm.cur==%s"%J(did(A,C))),f'[{name}] A opens a second chat (with {C})')
        pa.wait_for_timeout(1400);clr(pa);pb.evaluate("send({t:'dm_send',id:%s,m:'ping other chat'})"%J(DB))
        ck(wf(pa,"S.me.dm==1&&!!document.querySelector('.dmr[data-id=%s] .dmbd')"%J(DB)),f'[{name}] a message for the chat that is NOT on screen: row badge + dock count')
        ck('ping other chat' in toasts(pa),f'[{name}] ...and a toast ({toasts(pa)[:50]})')
        # ---- rooms: create with 3 friends
        if not (w>=720 and h>=561): T(pa,'.dmbk');pa.wait_for_timeout(200)
        T(pa,'.dmlh .btn');pa.wait_for_timeout(300)
        nv=pa.evaluate("({v:document.querySelector('.dmc').dataset.v,dis:document.querySelector('#dmMk').disabled,n:document.querySelectorAll('.dmpk input').length,hs:document.documentElement.scrollWidth<=innerWidth})")
        ck(nv['v']=='new' and nv['dis'] and nv['n']==3 and nv['hs'],f'[{name}] new-room form: 3 friends to pick, "create" disabled until named + picked {nv}')
        T(pa,'.dmxh .dmbk2');pa.wait_for_timeout(250);ck(pa.evaluate("Dm.sub===null&&document.querySelector('.dmc').dataset.v!='new'"),f'[{name}] ← cancels the new-room form')
        T(pa,'.dmlh .btn');pa.wait_for_timeout(300)
        T(pa,'#dmTtl');pa.keyboard.type('ก๊วนหมา')
        for o in (B,C,D_): T(pa,'label.dmpk:has(input[data-n="%s"])'%o)
        pa.wait_for_timeout(200)
        nv=pa.evaluate("({c:document.querySelector('#dmSelN').textContent,dis:document.querySelector('#dmMk').disabled,t:document.querySelector('#dmTtl').value})")
        ck(nv['c']=='3/7' and not nv['dis'] and nv['t']=='ก๊วนหมา',f'[{name}] 3 friends picked, create enabled {nv}');shot(pa,'7_new_room')
        for pg in (pb,pc,pd): clr(pg)
        T(pa,'#dmMk');ck(wf(pa,"Dm.chat&&Dm.chat.kind=='room'&&Dm.cur==Dm.chat.id&&Dm.chat.members.length==4"),f'[{name}] the room is created and opens')
        RID=pa.evaluate("Dm.cur");pa.wait_for_timeout(300)
        hd=pa.evaluate("({t:document.querySelector('.dmh b').textContent,s:document.querySelector('.dmh small').textContent,i:!!document.querySelector('.dmib[data-do=dminfo]')})")
        ck(hd['t']=='ก๊วนหมา' and '4' in hd['s'] and hd['i'],f'[{name}] room header: name, 4 members, ⚙️ {hd}')
        ck(wf(pb,"/ชวนคุณเข้าห้อง/.test([...document.querySelectorAll('#toasts .toast')].map(t=>t.textContent).join(' '))",4000) and wf(pc,"/ชวนคุณเข้าห้อง/.test([...document.querySelectorAll('#toasts .toast')].map(t=>t.textContent).join(' '))",4000),f'[{name}] B and C get an invitation toast')
        ck(wf(pb,"!!document.querySelector('.dmr[data-id=%s]')"%J(RID)),f'[{name}] B: the room appears in the open list at once')
        pa.wait_for_timeout(900);T(pa,'.dmi');pa.keyboard.type('ห้องนี้สนุกจัง');pa.keyboard.press('Enter');pa.wait_for_timeout(500)
        ck(wf(pc,"S.me.dm==1"),f'[{name}] C (window closed): the room message counts as 1 unread')
        ck(wf(pb,"(document.querySelector('.dmr[data-id=%s] small')||{}).textContent=='%s: ห้องนี้สนุกจัง'&&!!document.querySelector('.dmr[data-id=%s] .dmbd')"%(J(RID),A,J(RID))),f'[{name}] B: room row shows "{A}: ..." and a badge')
        if name=='desk': shot(pb,'B_room_unread')
        # B writes in the room: A sees the sender name + colour
        pb.click('.dmr[data-id=%s]'%J(RID));pb.fill('.dmi','เราก็มาแล้ว');pb.press('.dmi','Enter')
        ck(wf(pa,"[...document.querySelectorAll('.dmm.ot .dmb')].some(x=>x.querySelector('.dmn')&&x.querySelector('.dmn').textContent==%s&&x.textContent.includes('เราก็มาแล้ว'))"%J(B)),f'[{name}] in a room others show their name above the bubble')
        shot(pa,'8_room_chat')
        # ---- room menu
        T(pa,'.dmib[data-do=dminfo]');pa.wait_for_timeout(300)
        inf=pa.evaluate("({v:document.querySelector('.dmc').dataset.v,m:document.querySelectorAll('.dmx .list .li').length,k:document.querySelectorAll('.dmx [data-do=dmkick]').length,crown:document.querySelector('.dmx .list').textContent.includes('👑'),dots:document.querySelectorAll('.dmx .dmo.on').length,rn:!!document.querySelector('#dmRn'),add:!!document.querySelector('[data-do=dmpick]'),hs:document.documentElement.scrollWidth<=innerWidth,mb:document.querySelector('.mb').scrollWidth<=document.querySelector('.mb').clientWidth+1})")
        ck(inf['v']=='info' and inf['m']==4 and inf['k']==3 and inf['crown'] and inf['dots']==4 and inf['rn'] and inf['add'] and inf['hs'] and inf['mb'],f'[{name}] owner menu: 4 members (all online), kick x3, 👑, rename, add friend {inf}')
        shot(pa,'9_room_menu')
        pa.fill('#dmRn','ก๊วนหมาน้อย');pa.press('#dmRn','Enter');ck(wf(pa,"document.querySelector('.dmx') && Dm.chat.title=='ก๊วนหมาน้อย'"),f'[{name}] rename works')
        ck(wf(pb,"(document.querySelector('.dmr[data-id=%s] b')||{}).textContent.trim().startsWith('ก๊วนหมาน้อย')"%J(RID)),f'[{name}] B sees the new room name in the list')
        pa.evaluate("document.querySelector('#dmRn').focus()");pa.keyboard.type('ๆ')
        pb.evaluate("send({t:'dm_send',id:%s,m:'refresh test'})"%J(RID));pa.wait_for_timeout(600)
        ck(pa.evaluate("document.querySelector('#dmRn').value")=='ก๊วนหมาน้อยๆ' and pa.evaluate("document.activeElement===document.querySelector('#dmRn')"),f'[{name}] settings keep what you are typing when the room changes behind them')
        pa.fill('#dmRn','ก๊วนหมาน้อย')
        clr(pd);T(pa,'[data-do=dmkick][data-n="%s"]'%D_);ck(wf(pa,"!!document.querySelector('#askYes')",2000),f'[{name}] kicking asks first')
        yes(pa);ck(wf(pa,"Dm.chat.members.length==3&&!Dm.chat.members.some(m=>m.name==%s)"%J(D_)),f'[{name}] kick: {D_} is out of the member list')
        ck(wf(pd,"/ถูกเชิญออกจากห้อง/.test([...document.querySelectorAll('#toasts .toast')].map(t=>t.textContent).join(' '))",4000),f'[{name}] {D_} is told they were removed')
        T(pa,'[data-do=dmpick]');pa.wait_for_timeout(250);ck(pa.evaluate("document.querySelector('.dmc').dataset.v")=='pick' and pa.evaluate("document.querySelectorAll('.dmx [data-do=dmadd]').length")==1,f'[{name}] "add a friend" lists only {D_}')
        shot(pa,'10_add_friend');T(pa,'[data-do=dmadd]');ck(wf(pa,"Dm.chat.members.length==4&&document.querySelector('.dmc').dataset.v=='info'"),f'[{name}] adding brings {D_} back and returns to the settings')
        ck(wf(pd,"/ชวนคุณเข้าห้อง/.test([...document.querySelectorAll('#toasts .toast')].map(t=>t.textContent).join(' '))",4000),f'[{name}] {D_} gets a new invitation')
        T(pa,'.dmx .sw[data-do=dmmute]');ck(wf(pa,"Dm.chat.muted===true&&!!document.querySelector('.dmx .sw.on')"),f'[{name}] mute switch turns on')
        T(pa,'.dmxh .dmbk2');pa.wait_for_timeout(250)
        ck(pa.evaluate("document.querySelector('.dmc').dataset.v")=='chat' and pa.evaluate("document.querySelector('.dmh .dmmu')!==null"),f'[{name}] ← from the settings returns to the chat; the header shows 🔇')
        # muted: no toast, grey badge
        if not (w>=720 and h>=561): T(pa,'.dmbk');pa.wait_for_timeout(200)
        T(pa,'.dmr[data-id=%s]'%J(DB));pa.wait_for_timeout(1400);clr(pa)
        pb.evaluate("send({t:'dm_send',id:%s,m:'shh muted room'})"%J(RID))
        ck(wf(pa,"!!document.querySelector('.dmr[data-id=%s] .dmbd.q')"%J(RID)),f'[{name}] muted room: the badge is grey')
        ck('shh muted' not in toasts(pa),f'[{name}] ...and no toast, no ping ({toasts(pa)[:40]})')
        if not (w>=720 and h>=561): T(pa,'.dmbk');pa.wait_for_timeout(200)
        shot(pa,'11_list_with_room')
        # ---- leave (B, non-owner) and disband (A, owner)
        pb.click('.dmr[data-id=%s]'%J(RID));pb.click('.dmib[data-do=dminfo]');ck(pb.evaluate("!document.querySelector('.dmx [data-do=dmkick]')&&!document.querySelector('#dmRn')&&!!document.querySelector('[data-do=dmleave]')&&!document.querySelector('[data-do=dmdel]')"),f'[{name}] B (not the owner): no kick / rename / disband, only leave')
        pb.click('[data-do=dmleave]');yes(pb);ck(wf(pb,"!document.querySelector('.dmr[data-id=%s]')&&Dm.cur===null"%J(RID)),f'[{name}] B leaves: the room is gone from B')
        ck(wf(pa,"(Dm.rows.find(r=>r.id==%s)||{members:[]}).members.length==3"%J(RID)),f'[{name}] A: the room has 3 members now')
        T(pa,'.dmr[data-id=%s]'%J(RID));pa.wait_for_timeout(300);T(pa,'.dmib[data-do=dminfo]');pa.wait_for_timeout(300)
        clr(pc);T(pa,'[data-do=dmdel]');pa.wait_for_timeout(300);shot(pa,'12_disband_ask');yes(pa)
        ck(wf(pa,"!document.querySelector('.dmr[data-id=%s]')&&Dm.cur===null"%J(RID)),f'[{name}] disband: the room is gone from the owner')
        ck(wf(pc,"S.me.dm==0")and wf(pc,"/ถูกยุบ/.test([...document.querySelectorAll('#toasts .toast')].map(t=>t.textContent).join(' '))",3000),f'[{name}] C: told it was disbanded, unread count back to 0')
        # ---- the connection drops while a chat is open: after reconnecting the chat catches up with what was missed
        T(pa,'.dmr[data-id=%s]'%J(DB));ck(wf(pa,"Dm.cur==%s&&Dm.log"%J(DB)),f'[{name}] A opens the chat with {B} again')
        pa.evaluate("window.__oldws=S.ws;S.ws.close()");pa.wait_for_timeout(500);pb.evaluate("send({t:'dm_send',id:%s,m:'sent while you were away'})"%J(DB))
        ck(wf(pa,"S.ws!==window.__oldws&&S.ws.readyState==1&&S.loaded&&!S.pendingResume",15000),f'[{name}] A reconnects by itself')
        ck(wf(pa,"[...document.querySelectorAll('.dmlog .dmb')].some(x=>x.textContent.includes('sent while you were away'))",9000),f'[{name}] after reconnecting the open chat catches up with the message it missed')
        ck(wf(pa,"S.me.dm==0",5000),f'[{name}] ...and the unread count is right again')
        # ---- unfriend: the chat turns read-only; friends again: it works again
        if not (w>=720 and h>=561): pa.wait_for_timeout(100)
        pa.evaluate("send({t:'friend_del',name:%s})"%J(B));ck(wf(pa,"Dm.chat&&Dm.chat.ro===true&&document.querySelector('.dmcv').dataset.ro=='1'",9000),f'[{name}] unfriended: the open chat turns read-only')
        ro=pa.evaluate("({f:getComputedStyle(document.querySelector('.dmf')).display,r:getComputedStyle(document.querySelector('.dmrof')).display,old:document.querySelectorAll('.dmm').length})");ck(ro['f']=='none' and ro['r']!='none' and ro['old']>20,f'[{name}] no text field, a note instead, old messages still readable {ro}');shot(pa,'13_read_only')
        pa.evaluate("send({t:'friend_add',name:%s})"%J(B));pb.evaluate("send({t:'friend_ok',name:%s})"%J(A))
        ck(wf(pa,"Dm.chat&&Dm.chat.ro===false&&document.querySelector('.dmcv').dataset.ro=='0'",9000),f'[{name}] friends again: the text field is back')
        # ---- English
        pa.evaluate("S.set.lang='en';closeMod('dm');DO.dm()");pa.wait_for_timeout(500)
        en=pa.evaluate("({t:document.querySelector('#mods .ov[data-mod=dm] .mt').textContent,b:document.querySelector('.dmlh .btn').textContent,thai:/[฀-๿]/.test(document.querySelector('#mods .ov[data-mod=dm] .mb').textContent)})")
        ck('Private chat' in en['t'] and 'New room' in en['b'] and not en['thai'],f'[{name}] English: everything switches (no Thai left) {en}');shot(pa,'14_english');pa.evaluate("S.set.lang='th';closeMod('dm')")
        # ---- guests
        if name=='desk':
            cg=b.new_context(viewport={'width':w,'height':h});pg=cg.new_page();eg=[];pg.on('pageerror',lambda e:eg.append(str(e)));pg.on('console',lambda m:eg.append(m.text) if m.type=='error' else None)
            pg.goto(URL);pg.wait_for_timeout(600);pg.click('[data-do=guest]');pg.wait_for_selector('#game.on',timeout=8000);pg.wait_for_timeout(1200);pg.evaluate("document.querySelectorAll('#mods .ov').forEach(o=>o.remove())")
            pg.evaluate("DO.dm()");pg.wait_for_timeout(500)
            gs=pg.evaluate("({m:!!document.querySelector('#mods .ov[data-mod=dm]'),e:!!document.querySelector('#mods .ov[data-mod=dm] .empty'),w:!!document.querySelector('.dmw')})")
            ck(gs['m'] and gs['e'] and not gs['w'],f'[{name}] guest: a friendly "create an account" message, no chat window {gs}');shot(pg,'15_guest')
            ck(not [e for e in eg if 'favicon' not in e],f'[{name}] guest: no console errors {eg[:2]}');cg.close()
        ck(not [e for l in errl for e in l if 'favicon' not in e],f'[{name}] no console errors {[e for l in errl for e in l][:3]}')
      except Exception as e:
        ck(False,f'[{name}] test crashed: {type(e).__name__}: {str(e)[:300]}')
        try: pa.screenshot(path=f'{D}/{TAG}_{name}_crash.png')
        except Exception: pass
      finally:
        for c_ in ('ca','cb','cc','cd'):
            try: locals()[c_].close()
            except Exception: pass
    b.close()
finally:
  srv.terminate()
print('RESULT',sum(res),'/',len(res))
sys.exit(0 if all(res) else 1)
