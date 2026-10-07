import os,sys,subprocess,time,json,tempfile
from playwright.sync_api import sync_playwright
# v7.2: the slim bottom dock + the ☰ Menu window (every feature, grouped, NEW tags, badges), the one-time "what's new" tour,
# the explorer missions window, the cute dog barks (made by the browser: counted through the Web Audio API) and their setting.
# usage: python3 browser_tests/menu.py <src dir> <tag> [port] [desk,portrait,land]
SRC=sys.argv[1]; TAG=sys.argv[2]; PORT=sys.argv[3] if len(sys.argv)>3 else '3440'
VIEWS=sys.argv[4].split(',') if len(sys.argv)>4 else ['desk','portrait','land']
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
ALL={'desk':(1280,720,False),'portrait':(390,844,True),'land':(844,390,True),'tiny':(360,640,True)}
def wf(pg,js,t=6000):
    try: pg.wait_for_function(js,timeout=t);return True
    except Exception: return False
def go(pg,touch,sel):
    loc=pg.locator(sel+':visible').first;loc.scroll_into_view_if_needed(timeout=3000)
    loc.tap(timeout=3000) if touch else loc.click(timeout=3000)
def shot(pg,name): pg.screenshot(path=f'{D}/{TAG}_{name}.png')
def clean(pg): pg.evaluate("document.querySelectorAll('#mods .ov').forEach(o=>o.remove())")
try:
  with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    for name in VIEWS:
        w,h,touch=ALL[name]
        ctx=b.new_context(viewport={'width':w,'height':h},is_mobile=touch,has_touch=touch,device_scale_factor=1)
        pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append('PAGEERR '+str(e)));pg.on('console',lambda m:errs.append(m.text) if m.type=='error' else None)
        pg.goto(URL);pg.wait_for_timeout(500)
        user='mu'+name[:4]
        pg.click('#tReg');pg.fill('#rUser',user);pg.fill('#rMail','m@t.co');pg.fill('#rPass','secret1');pg.click('#fReg button[type=submit]')
        pg.wait_for_selector('#game.on',timeout=8000);pg.wait_for_timeout(2600)
        # ---- greeting bark when the player arrives in the room
        ck(pg.evaluate("Bark.last>0"),f'[{name}] one of the dogs said hello when the room opened')
        pg.evaluate("DO.tutskip&&DO.tutskip()");pg.wait_for_timeout(300);clean(pg)
        # ---- dock
        d=pg.evaluate("""(()=>{const dk=document.querySelector('#dock'),r=dk.getBoundingClientRect(),b=[...dk.querySelectorAll('.dk')].map(e=>{const q=e.getBoundingClientRect(),l=e.querySelector('.l').getBoundingClientRect();return{k:e.dataset.do,l:q.left,r:q.right,t:q.top,b:q.bottom,lh:l.height,ll:l.left,lr:l.right,w:q.width}});
          return{n:b.length,keys:b.map(x=>x.k).join(','),inside:b.every(x=>x.l>=0&&x.r<=innerWidth&&x.t>=0&&x.b<=innerHeight),noscroll:dk.scrollWidth<=dk.clientWidth+2,label:b.every(x=>x.lh<16&&x.ll>=x.l-1&&x.lr<=x.r+1),minw:Math.min(...b.map(x=>x.w)),W:innerWidth}})()""")
        ck(d['n']==7 and d['keys']=='dogs,shop,quests,friends,park,games,menu',f'[{name}] the dock has 7 buttons: {d["keys"]}')
        ck(d['inside'] and d['noscroll'],f'[{name}] all 7 buttons are on screen without scrolling (min button {d["minw"]:.0f}px of {d["W"]})')
        ck(d['label'],f'[{name}] every label is on one line and inside its button')
        # ---- NEW badge on the Menu button for a player who has opened none of the v7 features
        bd=pg.evaluate("(()=>{const e=document.querySelector('#dock .dk.mnb .bd');return e?{t:e.textContent,nw:e.classList.contains('nw')}:null})()")
        ck(bd and bd['nw'] and bd['t']=='ใหม่',f'[{name}] the Menu button wears a "ใหม่" badge ({bd})')
        # ---- no tour for a player who just started (the tutorial told them already)
        pg.wait_for_timeout(4000)
        ck(pg.evaluate("!document.querySelector('#mods .ov[data-mod=wn]')"),f'[{name}] a new player does not get the what\'s-new tour')
        # ---- the window
        go(pg,touch,'#dock .dk.mnb');ck(wf(pg,"!!document.querySelector('#mods .ov[data-mod=menu] .mn-g')",3000),f'[{name}] the ☰ button opens the Menu window')
        m=pg.evaluate("""(()=>{const o=document.querySelector('#mods .ov[data-mod=menu]'),mb=o.querySelector('.mb'),t=[...o.querySelectorAll('.mn-t')];
          return{groups:o.querySelectorAll('.mn-g').length,tiles:t.map(e=>e.dataset.k),nw:t.filter(e=>e.querySelector('.mn-nw')).map(e=>e.dataset.k).sort().join(','),noh:mb.scrollWidth<=mb.clientWidth+1,
           inside:t.every(e=>{const r=e.getBoundingClientRect(),q=o.querySelector('.panel').getBoundingClientRect();return r.left>=q.left-1&&r.right<=q.right+1}),heads:[...o.querySelectorAll('.mn-g h4')].map(e=>e.textContent.trim()).join('|')}})()""")
        ck(m['groups']==4,f'[{name}] 4 groups: {m["heads"]}')
        want={'dogs','nursery','wardrobe','coll','show','announce','friends','dm','park','ranks','community','shop','capsule','petshop','house','decor','games','quests','mail','photo','settings'}
        ck(set(m['tiles'])==want and len(m['tiles'])==21,f'[{name}] 21 tiles, every feature of the game is in the Menu')
        ck(m['nw']=='announce,capsule,dm,nursery,petshop,show',f'[{name}] the 6 v7 features carry a NEW tag: {m["nw"]}')
        ck(m['noh'] and m['inside'],f'[{name}] nothing sticks out sideways')
        shot(pg,f'{name}_menu')
        # ---- a tile opens its window, closes the menu and loses its NEW tag
        go(pg,touch,'#mods [data-mod=menu] .mn-t[data-k=announce]')
        ck(wf(pg,"!!document.querySelector('#mods .ov[data-mod=announce]')&&!document.querySelector('#mods .ov[data-mod=menu]')",3000),f'[{name}] the 📣 tile opens Announce and closes the Menu')
        ck(pg.evaluate("JSON.parse(localStorage.getItem('cd_seen_'+S.name)||'[]').includes('announce')"),f'[{name}] opening it is remembered in this browser')
        clean(pg);pg.evaluate("DO.menu()");pg.wait_for_timeout(300)
        ck(pg.evaluate("document.querySelectorAll('#mods [data-mod=menu] .mn-nw').length")==5 and pg.evaluate("!document.querySelector('#mods [data-mod=menu] .mn-t[data-k=announce] .mn-nw')"),f'[{name}] the NEW tag of 📣 is gone, 5 are left')
        # ---- badge numbers: dm + mail + eggs are summed on the Menu button, each shows on its tile; quests/friends/games keep their own dock badge
        pg.evaluate("S.me.dm=2;S.me.mail=1;S.me.eggs=1;S.me.ready=1;S.fr={inReq:[{name:'x'}],friends:[]};UI.dock()");pg.wait_for_timeout(200)
        t=pg.evaluate("""(()=>{const g=k=>{const e=document.querySelector('#mods [data-mod=menu] .mn-t[data-k='+k+'] .bd');return e?e.textContent:null};
          return{menu:(document.querySelector('#dock .dk.mnb .bd')||{}).textContent,dm:g('dm'),mail:g('mail'),nur:g('nursery'),quests:g('quests'),qd:(document.querySelector('#dock .dk[data-do=quests] .bd')||{}).textContent,fr:(document.querySelector('#dock .dk[data-do=friends] .bd')||{}).textContent}})()""")
        ck(t['menu']=='4' and t['dm']=='2' and t['mail']=='1' and t['nur']=='1',f'[{name}] Menu badge 4 = dm 2 + mail 1 + eggs 1, tiles show their own: {t}')
        ck(t['qd']=='1' and t['fr']=='1' and t['quests']=='1',f'[{name}] quests and friends keep their number on the dock ({t["qd"]},{t["fr"]}) and in the Menu')
        pg.evaluate("S.me.dm=0;S.me.mail=0;S.me.eggs=0;S.me.ready=0;S.fr=null;UI.dock()")
        # opening all the NEW ones removes the badge of the ☰ button
        pg.evaluate("MN.NEWK.forEach(k=>MN.mark(k));UI.dock()");pg.wait_for_timeout(200)
        ck(pg.evaluate("!document.querySelector('#dock .dk.mnb .bd')"),f'[{name}] after trying every new feature the ☰ button has no badge')
        # ---- footer: what's new + starter missions
        pg.evaluate("DO.menu()");pg.wait_for_timeout(250)
        go(pg,touch,'#mods [data-mod=menu] [data-do=wn]');ck(wf(pg,"document.querySelectorAll('#mods .ov[data-mod=wn] .wn-r').length==9",3000),f'[{name}] "✨ มีอะไรใหม่" opens the tour with 9 entries')
        shot(pg,f'{name}_tour')
        go(pg,touch,'#mods [data-mod=wn] button[data-k=show]');ck(wf(pg,"!!document.querySelector('#mods .ov[data-mod=show]')&&!document.querySelector('#mods .ov[data-mod=wn]')",3000),f'[{name}] "ไปดู" next to 👑 closes the tour and opens the Dog Show')
        clean(pg);pg.evaluate("DO.menu()");pg.wait_for_timeout(250)
        go(pg,touch,'#mods [data-mod=menu] [data-do=starter]');ck(wf(pg,"document.querySelectorAll('#mods .ov[data-mod=starter] .li').length>=17",3000),f'[{name}] "🌱 ภารกิจมือใหม่" lists the 16 missions + the bonus')
        txt=pg.evaluate("document.querySelector('#mods .ov[data-mod=starter]').textContent")
        ck('ฟักไข่หมาใบแรก' in txt and 'ผสมพันธุ์หมา 2 ตัว' in txt and 'ส่งหมาเข้าประกวด' in txt and 'ส่งข้อความส่วนตัวหาเพื่อน' in txt,f'[{name}] the explorer missions are in Thai')
        shot(pg,f'{name}_starter');clean(pg)
        # ---- the tour opens by itself for a player from before v7.2, once
        pg.evaluate("send({t:'dbg_wn'})")
        ck(wf(pg,"!!document.querySelector('#mods .ov[data-mod=wn]')",9000),f'[{name}] a player from before v7.2 gets the tour by itself')
        pg.wait_for_timeout(400);ck(pg.evaluate("S.me.wn")==72,f'[{name}] and it is marked as seen right away')
        clean(pg)
        pg.reload();ok=wf(pg,"S.scr=='game'&&S.loaded",9000);pg.wait_for_timeout(5500)
        ck(ok and pg.evaluate("!document.querySelector('#mods .ov[data-mod=wn]')&&S.me.wn")==72,f'[{name}] after a reload the tour does not come back (logged in: {ok})')
        # ---- settings switch
        pg.evaluate("DO.settings()");pg.wait_for_timeout(300)
        ck(pg.evaluate("!!document.querySelector('#mods [data-mod=settings] [data-do=tog][data-k=barks]')"),f'[{name}] the settings window has "เสียงน้องหมา"')
        clean(pg)
        # ---- the barks themselves (counted as Web Audio oscillators, 2 per syllable)
        pg.evaluate("""window.__osc=[];(()=>{const A=window.AudioContext||window.webkitAudioContext,o=A.prototype.createOscillator;A.prototype.createOscillator=function(){const x=o.call(this),f=x.frequency,s=f.setValueAtTime.bind(f);f.setValueAtTime=function(v,t){window.__osc.push([x.type,v]);return s(v,t)};return x}})()""")
        def run(kind,dog='null'):      # count inside ONE evaluate: nothing else (a background bark) can slip in between
            r=pg.evaluate(f"(()=>{{window.__osc=[];const r=Bark.say('{kind}',{dog},true);return[r,window.__osc.length]}})()");return r[0],r[1]
        for kind,n in (('woof',4),('yip',2),('happy',6),('pup',4)):
            r,c=run(kind);ck(r and c==n,f'[{name}] "{kind}" makes {n} oscillators ({c})')
        pg.evaluate("window.__osc=[];Bark.last=0;Bark.per={}")
        a1=pg.evaluate("Bark.say('woof',{id:'z'})");a2=pg.evaluate("Bark.say('woof',{id:'z'})")
        ck(a1 and not a2,f'[{name}] no barking storm: a second bark right away is refused ({a1},{a2})')
        sizes=pg.evaluate("(()=>{const r=Object.values(DOGS.raw).filter(b=>b.size);r.sort((a,b)=>a.size-b.size);return[r[0].id,r[r.length-1].id,r[0].size,r[r.length-1].size]})()")
        def f0(breed,born):
            return pg.evaluate(f"(()=>{{window.__osc=[];Bark.say('woof',{{id:'q',breed:'{breed}',born:{born}}},true);return window.__osc.filter(x=>x[0]=='sawtooth')[0][1]}})()")
        old='Date.now()-1e11'
        small,big=f0(sizes[0],old),f0(sizes[1],old)
        ck(small>big*1.1,f'[{name}] a small dog barks higher than a big one ({small:.0f} Hz vs {big:.0f} Hz; sizes {sizes[2]} / {sizes[3]})')
        baby=f0(sizes[1],'Date.now()');adult=f0(sizes[1],old)
        ck(baby>adult*1.5,f'[{name}] a baby barks higher than an adult ({baby:.0f} Hz vs {adult:.0f} Hz)')
        sp=pg.evaluate("(()=>{const d=Object.values(S.dogs).find(x=>x._pos);if(!d)return null;Bark.last=0;Bark.per={};const n=World.fxs.filter(f=>f.type=='text').length;Bark.say('woof',d,true);const t=World.fxs.filter(f=>f.type=='text');return{n,m:t.length,txt:t.length?t[t.length-1].txt:''}})()")
        ck(sp and sp['m']==sp['n']+1 and sp['txt'] in ('โฮ่ง โฮ่ง!','Woof woof!'),f'[{name}] the dog shows a speech bubble "{sp and sp["txt"]}"')
        pg.evaluate("S.set.barks=false");r,c=run('woof',"{id:'n1'}");ck(not r and c==0,f'[{name}] "Dog sounds" off = silence')
        pg.evaluate("S.set.barks=true;S.set.sound=false");pg.evaluate("window.__osc=[];Bark.last=0;Bark.per={}");r=pg.evaluate("Bark.say('woof',{id:'n2'},true)");ck(not r,f'[{name}] the main "Sound" switch mutes the barks too')
        pg.evaluate("S.set.sound=true")
        # tap on the settings toggle flips the value
        pg.evaluate("DO.settings()");pg.wait_for_timeout(300)
        before=pg.evaluate("S.set.barks");go(pg,touch,'#mods [data-mod=settings] [data-do=tog][data-k=barks]');pg.wait_for_timeout(200)
        ck(pg.evaluate("S.set.barks")==(not before),f'[{name}] the switch toggles it ({before} -> {not before})')
        clean(pg)
        bad=[e for e in errs if 'favicon' not in e]
        ck(not bad,f'[{name}] no console errors {bad[:2]}')
        ctx.close()
    b.close()
finally:
    srv.terminate()
n=sum(res);print(f'\nRESULT {n} / {len(res)}');sys.exit(0 if n==len(res) else 1)
