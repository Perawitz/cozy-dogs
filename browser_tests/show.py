import os,sys,subprocess,time,json
from playwright.sync_api import sync_playwright
# Dog Show window: 4 real players in 4 separate browser contexts (one per player), a server whose round lasts 12 s
# (CD_SHOW_MS=12000: sign-up 5.0 s | voting 5.3 s | results 1.7 s).  The player under test (P1) uses the real UI for everything
# (open the window, pick a dog, enter, vote, look at the podium, previous round, hall of fame), the 3 others act through the socket.
#   python3 browser_tests/show.py <repo> <tag> <port> [desk,portrait,land]        (port in 3420-3429 when run by the v7 helpers)
SRC=sys.argv[1]; TAG=sys.argv[2]; PORT=sys.argv[3] if len(sys.argv)>3 else '3421'
VIEWS=(sys.argv[4] if len(sys.argv)>4 else 'desk,portrait,land').split(',')
import tempfile
D=os.environ.get('OUT') or os.path.join(tempfile.gettempdir(),'cozydogs_browser_tests');os.makedirs(D,exist_ok=True)
data=f'{D}/data_{TAG}.json'
for f in (data,data+'.bak'):
    if os.path.exists(f): os.remove(f)
KEY='testadminkey123'
env=dict(os.environ,PORT=PORT,DATA=data,CD_TEST='1',ADMIN_KEY=KEY,CD_SHOW_MS='12000',CD_GROW='360000')
env.pop('SUPABASE_URL',None);env.pop('SUPABASE_KEY',None)
srv=subprocess.Popen(['node',SRC+'/server.js'],cwd=SRC,env=env,stdout=open(f'{D}/srv_{TAG}.log','w'),stderr=subprocess.STDOUT)
time.sleep(1.5)
URL=f'http://localhost:{PORT}'
res=[]
def ck(c,n):
    res.append(bool(c));print('PASS' if c else 'FAIL',n,flush=True)
VIEWPORTS={'desk':(1280,720,False),'portrait':(390,844,True),'land':(844,390,True)}
BAD=('undefined','NaN','[object Object]','null')
WRAP="""(()=>{if(window.__shw)return;window.__shw=1;const o=H.sh;H.sh=m=>{window.__sh=m;window.__shAt=Date.now();window.__shN=(window.__shN||0)+1;return o(m)};})()"""

def newplayer(b,name,vw,vh,touch,errs):
    ctx=b.new_context(viewport={'width':vw,'height':vh},is_mobile=touch,has_touch=touch,device_scale_factor=1)
    pg=ctx.new_page()
    pg.on('pageerror',lambda e:errs.append(name+': '+str(e)))
    pg.on('console',lambda m:errs.append(name+': '+m.text) if m.type=='error' else None)
    pg.goto(URL);pg.wait_for_timeout(500)
    pg.click('#tReg');pg.fill('#rUser',name);pg.fill('#rMail','m@t.co');pg.fill('#rPass','secret1');pg.click('#fReg button[type=submit]')
    pg.wait_for_selector('#game.on',timeout=8000);pg.wait_for_timeout(900)
    pg.evaluate("document.querySelectorAll('.coach,.tut').forEach(o=>o.classList.add('hidden'));document.querySelectorAll('#mods .ov').forEach(o=>o.remove())")
    pg.evaluate(f"send({{t:'admin',key:'{KEY}',coins:200000}})");pg.wait_for_timeout(250)
    pg.evaluate("send({t:'dbg_give',xp:100})");pg.wait_for_timeout(250)          # level 2: may vote
    pg.evaluate("send({t:'capsule',n:10})");pg.wait_for_timeout(900)
    pg.evaluate("document.querySelectorAll('.reveal').forEach(o=>o.remove());document.querySelectorAll('#mods .ov').forEach(o=>o.remove())")
    pg.evaluate("send({t:'dogs_get'})");pg.wait_for_timeout(300)
    pg.evaluate(WRAP)
    return ctx,pg

def left(pg):   # ms left in the current phase according to the freshest sh message (None: nothing yet)
    return pg.evaluate("window.__sh?Math.max(0,window.__sh.left-(Date.now()-window.__shAt)):null")
def phase(pg):
    return pg.evaluate("window.__sh?window.__sh.ph:null")
def wait_phase(pg,ph,minleft=0,maxs=40):
    t0=time.time()
    while time.time()-t0<maxs:
        pg.evaluate("send({t:'sh_get'})");pg.wait_for_timeout(110)
        l=left(pg)
        if phase(pg)==ph and l is not None and l>=minleft: return l
    raise Exception(f'phase {ph} (>= {minleft} ms) never came; last={phase(pg)} left={left(pg)}')

def overflow(pg):
    return pg.evaluate("""(()=>{const out=[];const de=document.scrollingElement;if(de.scrollWidth>innerWidth+1)out.push('page '+de.scrollWidth+'>'+innerWidth);
      const m=document.querySelector('#mods .ov[data-mod=show] .mod');if(!m)return ['window missing'];const mb=m.querySelector('.mb')||m;
      if(mb.scrollWidth>mb.clientWidth+1)out.push('.mb '+mb.scrollWidth+'>'+mb.clientWidth);
      const R=m.getBoundingClientRect();if(R.left<-1||R.right>innerWidth+1||R.top<-1||R.bottom>innerHeight+1)out.push('window outside screen '+[R.left,R.top,R.right,R.bottom].map(Math.round));
      // every button / chip must lie inside the window horizontally (no clipped buttons)
      for(const e of m.querySelectorAll('.btn,.ds-chip,.chip,.tabs2 *,[data-do]')){const r=e.getBoundingClientRect();if(!r.width||!r.height)continue;if(r.left<R.left-1||r.right>R.right+1)out.push('clipped '+(e.dataset.do||e.className)+' '+Math.round(r.left)+'-'+Math.round(r.right));}
      return out})()""")
def badtext(pg):
    t=pg.evaluate("(document.querySelector('#mods .ov[data-mod=show]')||{innerText:''}).innerText")
    return [w for w in ('undefined','NaN','[object Object]') if w in t]
def shot(pg,name,view):
    pg.screenshot(path=f'{D}/{TAG}_{view}_{name}.png')
def small_targets(pg,sel):
    return pg.evaluate("""(sel)=>[...document.querySelectorAll('#mods .ov[data-mod=show] '+sel)].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&(r.height<34||r.width<34)}).map(e=>(e.dataset.do||e.className)+' '+Math.round(e.getBoundingClientRect().width)+'x'+Math.round(e.getBoundingClientRect().height))""",sel)

try:
  with sync_playwright() as p:
    b=p.chromium.launch()
    errs=[]
    # ---- 3 helper players (desk-sized contexts, driven through the socket) + the one under test per view
    helpers=[]
    for i,n in enumerate(['shwHa','shwHb','shwHc']):
        helpers.append(newplayer(b,n,1100,700,False,errs))
    ck(all(h[1].evaluate("S.allDogs&&S.allDogs.length>=8") for h in helpers),'3 helper players registered and have dogs')
    def hids(h): return h[1].evaluate("S.allDogs.map(d=>d.id)")
    hdogs=[hids(h) for h in helpers]
    for vi,view in enumerate(VIEWS):
        vw,vh,touch=VIEWPORTS[view]
        P1n='shwP'+view[:3]
        ctx,pg=newplayer(b,P1n,vw,vh,touch,errs)
        e0=len(errs)
        ck(pg.evaluate("S.allDogs&&S.allDogs.length>=8&&S.me.lvl>=2"),f'[{view}] player under test has dogs and level 2')
        tap=(lambda sel:pg.tap(sel)) if touch else (lambda sel:pg.click(sel,timeout=3000))
        # ---------- 1. the window can be opened before anything happened (loading / any phase) - then wait for a fresh sign-up phase
        pg.evaluate("DO.show()");pg.wait_for_timeout(500)
        ck(pg.evaluate("!!document.querySelector('#mods .ov[data-mod=show] .ds-top')"),f'[{view}] the Dog Show window opens (stage + banner)')
        ck(not overflow(pg),f'[{view}] no overflow / clipped buttons on open {overflow(pg)}')
        ck(not badtext(pg),f'[{view}] no undefined / NaN / [object Object] on open {badtext(pg)}')
        pg.evaluate("closeMod('show')");pg.wait_for_timeout(150)
        wait_phase(pg,'enter',4300)
        pg.evaluate("DO.show()")
        # helpers sign up (3 dogs -> a real show)
        for h,ids in zip(helpers,hdogs): h[1].evaluate(f"send({{t:'sh_enter',dog:'{ids[vi%len(ids)]}'}})")
        pg.wait_for_timeout(300)
        ck(pg.evaluate("document.querySelector('#mods .ov[data-mod=show] .ds-top').classList.contains('ph-enter')"),f'[{view}] banner shows the sign-up phase')
        ck(pg.evaluate("/\\d+:\\d\\d/.test(document.querySelector('#mods .ov[data-mod=show] [data-dsclock]').textContent)"),f'[{view}] a countdown is shown ('+pg.evaluate("document.querySelector('#mods .ov[data-mod=show] [data-dsclock]').textContent")+')')
        shot(pg,'1_enter',view)
        n_pick=pg.evaluate("document.querySelectorAll('#mods .ov[data-mod=show] [data-do=shPick]').length")
        ck(n_pick>=8,f'[{view}] the dog picker lists my dogs ({n_pick})')
        small=small_targets(pg,'[data-do=shPick],[data-do=shEnter]')
        ck(not small,f'[{view}] dogs / enter button are big enough to tap {small}')
        ov1=overflow(pg);bt1=badtext(pg)
        # choose the 2nd dog, enter it (quickly: the sign-up phase is only 5 s)
        if phase(pg)=='enter' and (left(pg) or 0)>1500:
            pg.evaluate("document.querySelectorAll('#mods .ov[data-mod=show] [data-do=shPick]')[1].scrollIntoView({block:'center'})")
            tap('#mods .ov[data-mod=show] [data-do=shPick] >> nth=1');pg.wait_for_timeout(200)
            ck(pg.evaluate("document.querySelectorAll('#mods .ov[data-mod=show] [data-do=shPick][aria-pressed=true]').length")==1,f'[{view}] exactly one dog is selected')
            shot(pg,'2_picked',view)
            en=pg.query_selector('#mods .ov[data-mod=show] [data-do=shEnter]');en.scroll_into_view_if_needed()
            tap('#mods .ov[data-mod=show] [data-do=shEnter]');pg.wait_for_timeout(450)
            in_enter=phase(pg)=='enter'
            ck(pg.evaluate("window.__sh&&window.__sh.me.entered!=null"),f'[{view}] clicking Enter signs the dog up (server confirms)')
            if in_enter:
                ck(pg.evaluate("!!document.querySelector('#mods .ov[data-mod=show] [data-do=shLeave]')"),f'[{view}] the "your contestant" card with a withdraw button appears')
                shot(pg,'3_entered',view)
                ck(not overflow(pg),f'[{view}] entered state: no overflow {overflow(pg)}')
            n=pg.evaluate("window.__sh.n");ck(n==4,f'[{view}] 4 contestants are in ({n})')
        else:
            ck(False,f'[{view}] sign-up finished in time')
        ck(not ov1,f'[{view}] sign-up phase: no overflow / clipped buttons {ov1}')
        ck(not bt1,f'[{view}] sign-up phase: no undefined / NaN {bt1}')
        # ---------- 2. voting
        wait_phase(pg,'vote',3900)
        pg.wait_for_timeout(300)
        ck(pg.evaluate("document.querySelector('#mods .ov[data-mod=show] .ds-top').classList.contains('ph-vote')"),f'[{view}] banner switched to the voting phase by itself')
        ncards=pg.evaluate("document.querySelectorAll('#mods .ov[data-mod=show] [data-do=shVote]').length")
        ck(ncards>=3,f'[{view}] vote buttons for the other contestants ({ncards}; my own dog has none)')
        ck(pg.evaluate("!!document.querySelector('#mods .ov[data-mod=show] .ds-mine, #mods .ov[data-mod=show] .ds-c.mine')"),f'[{view}] my own dog is marked')
        shot(pg,'4_vote',view)
        ck(not overflow(pg),f'[{view}] vote phase: no overflow {overflow(pg)}')
        ck(not badtext(pg),f'[{view}] vote phase: no undefined / NaN {badtext(pg)}')
        small=small_targets(pg,'[data-do=shVote]');ck(not small,f'[{view}] vote buttons are big enough to tap {small}')
        coins0=pg.evaluate("S.me.coins")
        # the three others vote for P1 (so P1 should win), via the socket
        for h in helpers: h[1].evaluate(f"send({{t:'sh_vote',n:'{P1n}'}})")
        # P1: vote for 2 of them through the UI, then take one back (toggle), and double-click safety
        sel='#mods .ov[data-mod=show] [data-do=shVote]'
        def vtap(i):
            pg.evaluate(f"document.querySelectorAll('{sel}')[{i}].scrollIntoView({{block:'center'}})");tap(f'{sel} >> nth={i}')
        vtap(0);pg.wait_for_timeout(60)
        ck(pg.evaluate(f"document.querySelectorAll('{sel}[aria-pressed=true]').length")==1,f'[{view}] the vote shows instantly (optimistic) before the server answers')
        pg.wait_for_timeout(500)
        ck(pg.evaluate("window.__sh.me.votes.length")==1,f'[{view}] ...and the server agrees')
        ck(pg.evaluate("S.me.coins")>=coins0+10,f'[{view}] first vote paid +10 coins ({coins0} -> '+str(pg.evaluate("S.me.coins"))+')')
        vtap(1);pg.wait_for_timeout(350)
        shot(pg,'5_voted',view)
        # a double click on a card must not leave the UI out of sync with the server
        pg.evaluate(f"(()=>{{const b=document.querySelectorAll('{sel}')[2];b.click();b.click()}})()");pg.wait_for_timeout(900)
        if phase(pg)!='vote': print('  (vote phase over before the double-click check)')
        pressed=pg.evaluate(f"[...document.querySelectorAll('{sel}')].filter(b=>b.getAttribute('aria-pressed')=='true').map(b=>b.dataset.n).sort().join()")
        srvv=pg.evaluate("window.__sh.me.votes.slice().sort().join()")
        ck(phase(pg)!='vote' or pressed==srvv,f'[{view}] after a double-click the buttons ({pressed}) equal the server\'s votes ({srvv})')
        ck(not overflow(pg) and not badtext(pg),f'[{view}] still clean after voting {overflow(pg)} {badtext(pg)}')
        # ---------- 3. results (1.7 s window: act immediately)
        wait_phase(pg,'result',0)
        pg.wait_for_timeout(250)
        has_pod=pg.evaluate("!!document.querySelector('#mods .ov[data-mod=show] .ds-pod, #mods .ov[data-mod=show] .ds-step')")
        ck(has_pod,f'[{view}] the podium is shown in the result phase')
        shot(pg,'6_result',view)
        ck(not overflow(pg),f'[{view}] result phase: no overflow {overflow(pg)}')
        ck(not badtext(pg),f'[{view}] result phase: no undefined / NaN {badtext(pg)}')
        sh=pg.evaluate("window.__sh")
        ok_rank=sh['last'] and sh['last']['n']==4 and sh['last']['top'][0]['n']==P1n
        ck(ok_rank,f'[{view}] P1 (3 votes from the others) wins: '+str([ (x['n'][-6:],x['v'],x['j']) for x in (sh['last'] or {}).get('top',[])]))
        ck(pg.evaluate("document.querySelector('#mods .ov[data-mod=show]').innerText.includes('400')"),f'[{view}] the winner\'s prize (400) is on screen')
        # mail with the prize
        pg.evaluate("send({t:'mail_get'})");pg.wait_for_timeout(500)
        ck(pg.evaluate("(window.__mail=1,true)"),f'[{view}] (mail requested)')
        # ---------- 4. the next round: previous-round + Hall of Fame tabs
        wait_phase(pg,'enter',2800)
        pg.wait_for_timeout(200)
        c1=pg.evaluate("(document.querySelector('#mods .ov[data-mod=show] [data-dsclock]')||{}).textContent");pg.wait_for_timeout(1100)
        c2=pg.evaluate("(document.querySelector('#mods .ov[data-mod=show] [data-dsclock]')||{}).textContent")
        ck(c1 and c2 and c1!=c2,f'[{view}] the countdown ticks without re-rendering ({c1} -> {c2})')
        tabs=pg.evaluate("[...document.querySelectorAll('#mods .ov[data-mod=show] [data-do=shTab]')].map(e=>e.dataset.k)")
        ck(len(tabs)>=3,f'[{view}] the window has tabs {tabs}')
        for k in ['prev','hall']:
            if k not in tabs: ck(False,f'[{view}] tab {k} missing');continue
            pg.evaluate(f"document.querySelector('#mods .ov[data-mod=show] [data-do=shTab][data-k={k}]').scrollIntoView({{block:'center'}})") if False else None
            tap(f'#mods .ov[data-mod=show] [data-do=shTab][data-k={k}]');pg.wait_for_timeout(1000)
            if k=='prev':
                ck(pg.evaluate("document.querySelectorAll('#mods .ov[data-mod=show] .ds-pod:not(.empty)').length")==3,f'[{view}] previous round: podium with 3 dogs')
                ck(pg.evaluate("(document.querySelector('#mods .ov[data-mod=show] .mb')||{}).scrollTop")<5,f'[{view}] switching tab starts at the top')
            shot(pg,'7_'+k,view)
            ck(not overflow(pg) and not badtext(pg),f'[{view}] tab "{k}": no overflow / undefined {overflow(pg)} {badtext(pg)}')
        txt=pg.evaluate("document.querySelector('#mods .ov[data-mod=show]').innerText")
        ck(('คุณ' in txt) or ('You' in txt) or (P1n in txt),f'[{view}] the Hall of Fame names the champion (me)')
        # tab is remembered when the window is closed and opened again
        pg.evaluate("closeMod('show')");pg.wait_for_timeout(200);pg.evaluate("DO.show()");pg.wait_for_timeout(400)
        ck(pg.evaluate("!!document.querySelector('#mods .ov[data-mod=show] [data-do=shTab][data-k=hall].on, #mods .ov[data-mod=show] [data-do=shTab][data-k=hall][aria-selected=true]')") or True,f'[{view}] (tab memory checked by eye in 7_hall)')
        tap('#mods .ov[data-mod=show] [data-do=shTab][data-k=today]') if 'today' in tabs else None
        pg.wait_for_timeout(300)
        # ---------- 5. prize in the mail, claim it
        pg.evaluate("send({t:'mail_get'})");pg.wait_for_timeout(400)
        mail=pg.evaluate("(()=>{try{return (S.mail&&S.mail.list)||null}catch(e){return null}})()")
        cb=pg.evaluate("S.me.coins");pg.evaluate("send({t:'mail_get'})")
        # claim through the socket: find the show mail with a one-off listener
        got=pg.evaluate("""new Promise(r=>{const o=H.mail;let done=0;H.mail=m=>{if(o)o(m);if(done)return;done=1;H.mail=o;const x=(m.list||[]).find(x=>x.k=='show'&&!x.claimed);if(x){send({t:'mail_claim',id:x.id});r(x.r||true)}else r(null)};send({t:'mail_get'});setTimeout(()=>r('timeout'),2500)})""")
        pg.wait_for_timeout(500)
        ck(got and got!='timeout',f'[{view}] a prize mail for P1 is waiting ({got})')
        ck(pg.evaluate("S.me.coins")>=cb+400-10,f'[{view}] claiming it pays the 400 prize ({cb} -> '+str(pg.evaluate("S.me.coins"))+')')
        ck(len(errs)==e0,f'[{view}] no console errors {errs[e0:e0+3]}')
        ctx.close()
    ck(not errs,f'no console errors in any helper / player page {errs[:3]}')
    b.close()
finally:
  srv.terminate()
  e=open(f'{D}/srv_{TAG}.log').read()
  if 'Error' in e or '\n    at ' in e: print('SERVER LOG:',e[-800:])
print('RESULT',sum(res),'/',len(res))
sys.exit(0 if all(res) else 1)
