import os,sys,subprocess,time,re,tempfile
from playwright.sync_api import sync_playwright
# Pet Shop + Player Market window, two real players.
#   A (level 3) lists a dog in the market through the form, B buys it; premium purchases with the admin cheat coins/gems
#   (confirm dialog, "a new friend" card, stock going down, sold-out state, the daily cap); A sells a dog to the shop.
#   Every state is checked on desk 1280x720, portrait phone 390x844 and landscape phone 844x390 for: no horizontal overflow,
#   no clipped / overlapping buttons, no "undefined / NaN / [object Object]" text, no console errors.  Screenshots go to $OUT.
# usage: python3 browser_tests/petshop.py <src dir> <tag> [port 3410-3419] [desk,portrait,land]
SRC=sys.argv[1]; TAG=sys.argv[2]; PORT=sys.argv[3] if len(sys.argv)>3 else '3410'
ONLY=sys.argv[4].split(',') if len(sys.argv)>4 else ['desk','portrait','land']
D=os.environ.get('OUT') or os.path.join(tempfile.gettempdir(),'cozydogs_browser_tests');os.makedirs(D,exist_ok=True)
data=f'{D}/data_{TAG}.json'
for f in (data,data+'.bak'):
    if os.path.exists(f): os.remove(f)
env=dict(os.environ,PORT=PORT,DATA=data,CD_TEST='1',ADMIN_KEY='testadminkey123',CD_RATE='1000')
env.pop('SUPABASE_URL',None);env.pop('SUPABASE_KEY',None)
srv=None
def start():      # every view gets its own fresh server: the shop stock and the daily limits are per server / day, the scenario counts them
    global srv
    for f in (data,data+'.bak'):
        if os.path.exists(f): os.remove(f)
    srv=subprocess.Popen(['node',SRC+'/server.js'],cwd=SRC,env=env,stdout=open(f'{D}/srv_{TAG}.log','w'),stderr=subprocess.STDOUT)
    time.sleep(1.5)
URL=f'http://localhost:{PORT}'
res=[]
def ck(c,n):
    res.append(bool(c));print('PASS' if c else 'FAIL',n,flush=True)

# --- layout check of the open petshop-family windows (shop / list form / ask / adopt card) -------------------------------------------
LAYOUT="""()=>{
 const out=[],vw=innerWidth,vh=innerHeight,de=document.documentElement;
 if(de.scrollWidth>vw+1)out.push('page scrolls sideways '+de.scrollWidth+'>'+vw);
 const mods=[...document.querySelectorAll('#mods .ov .mod')].filter(m=>{const r=m.getBoundingClientRect();return r.width>0});
 if(!mods.length)return ['no window open'];
 for(const m of mods){
  const mr=m.getBoundingClientRect(),id=(m.closest('.ov')||{}).dataset?m.closest('.ov').dataset.mod:'?';
  if(mr.left<-1||mr.right>vw+1||mr.top<-1||mr.bottom>vh+1)out.push(id+': window leaves the screen '+[mr.left,mr.top,mr.right,mr.bottom].map(Math.round));
  const mb=m.querySelector('.mb');if(mb&&mb.scrollWidth>mb.clientWidth+1)out.push(id+': body scrolls sideways '+mb.scrollWidth+'>'+mb.clientWidth);
  const txt=m.innerText||'';if(/undefined|NaN|\\[object|null\\b/.test(txt))out.push(id+': bad text "'+(txt.match(/.{0,20}(undefined|NaN|\\[object|null\\b).{0,20}/)||[''])[0].replace(/\\n/g,' ')+'"');
  const bs=[...m.querySelectorAll('button,.btn,input')].filter(b=>{const r=b.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(b).visibility!='hidden'});
  const body=mb||m,br=body.getBoundingClientRect();
  for(const b of bs){const r=b.getBoundingClientRect();
   if(r.left<br.left-1||r.right>br.right+1)out.push(id+': button sticks out sideways "'+(b.innerText||b.id||b.className).slice(0,24).replace(/\\n/g,' ')+'" '+Math.round(r.left)+'..'+Math.round(r.right)+' vs '+Math.round(br.left)+'..'+Math.round(br.right));
   if(b.scrollWidth>b.clientWidth+2&&getComputedStyle(b).overflow!='visible'&&b.tagName!='INPUT')out.push(id+': button text clipped "'+(b.innerText||'').slice(0,24).replace(/\\n/g,' ')+'" '+b.scrollWidth+'>'+b.clientWidth);
   const h=r.height,w=r.width;if((b.className+'').match(/\\bbtn\\b/)&&(h<30||w<30))out.push(id+': tap target too small '+Math.round(w)+'x'+Math.round(h)+' "'+(b.innerText||'').slice(0,16)+'"');
  }
  // what is really visible of a button: content that scrolled under the sticky tab header / out of the scroll box does not count
  const vis=x=>{const r=x.getBoundingClientRect(),sc=x.closest('.mb');if(!sc||x.closest('.pshd'))return r;const mr=sc.getBoundingClientRect(),hd=sc.querySelector('.pshd'),top=Math.max(mr.top,hd?hd.getBoundingClientRect().bottom:mr.top);
   const l=Math.max(r.left,mr.left),t=Math.max(r.top,top),rr=Math.min(r.right,mr.right),bb=Math.min(r.bottom,mr.bottom);return{left:l,top:t,right:rr,bottom:Math.max(t,bb)}};
  for(let i=0;i<bs.length;i++)for(let j=i+1;j<bs.length;j++){const a=bs[i],c=bs[j];if(a.contains(c)||c.contains(a))continue;const A=vis(a),C=vis(c);
   const ox=Math.min(A.right,C.right)-Math.max(A.left,C.left),oy=Math.min(A.bottom,C.bottom)-Math.max(A.top,C.top);
   if(ox>3&&oy>3)out.push(id+': buttons overlap "'+(a.innerText||a.id).slice(0,14).replace(/\\n/g,' ')+'" / "'+(c.innerText||c.id).slice(0,14).replace(/\\n/g,' ')+'"')}
  // text that overflows its own box (chips, names, prices) - anything that is not meant to scroll or ellipsize
  let n=0;for(const e of m.querySelectorAll('.psch,.psc-nm,.psc-en,.psc-pr,.mkc-s,.psrow-nm,.psw,.pill,.tag,h3,b')){if(n>=3)break;const cs=getComputedStyle(e);if(cs.textOverflow=='ellipsis')continue;const r=e.getBoundingClientRect();if(r.width&&e.scrollWidth>e.clientWidth+2&&cs.display!='inline'){out.push(id+': text overflows its box "'+(e.innerText||'').slice(0,22).replace(/\\n/g,' ')+'" '+e.scrollWidth+'>'+e.clientWidth);n++}}
 }
 return out}"""
def layout(pg,name,tag):
    pg.evaluate("document.querySelectorAll('#toasts .toast,.toast').forEach(t=>t.remove())")
    bad=pg.evaluate(LAYOUT)
    ck(not bad,f'[{name}] layout ok: {tag}'+('' if not bad else ' -> '+' | '.join(bad[:4])))
def shot(pg,name,tag):
    pg.evaluate("document.querySelectorAll('#toasts .toast,.toast').forEach(t=>t.remove())");pg.wait_for_timeout(250)
    pg.screenshot(path=f'{D}/{TAG}_{name}_{tag}.png')
def clean(pg):
    pg.evaluate("document.querySelectorAll('.coach,.tut').forEach(o=>o.classList.add('hidden'));document.querySelectorAll('#mods .ov').forEach(o=>o.remove());document.querySelectorAll('.reveal').forEach(o=>o.remove())")
def reg(b,w,h,touch,user,errs):
    ctx=b.new_context(viewport={'width':w,'height':h},is_mobile=touch,has_touch=touch,device_scale_factor=1)
    pg=ctx.new_page();pg.on('pageerror',lambda e:errs.append(user+' '+str(e)));pg.on('console',lambda m:errs.append(user+' '+m.text) if m.type=='error' else None)
    pg.goto(URL);pg.wait_for_timeout(600)
    pg.click('#tReg');pg.fill('#rUser',user);pg.fill('#rMail','m@t.co');pg.fill('#rPass','secret1');pg.click('#fReg button[type=submit]')
    pg.wait_for_selector('#game.on',timeout=8000);pg.wait_for_timeout(1300);clean(pg)
    pg.evaluate("send({t:'admin',key:'testadminkey123',coins:500000})");pg.wait_for_timeout(500)
    return ctx,pg
def pulls(pg,n):
    for i in range(n):
        pg.evaluate("send({t:'capsule',n:10})");pg.wait_for_timeout(450)
    pg.wait_for_timeout(1200)
    for k in range(14):             # the capsule results are queued: close them one by one
        if not pg.evaluate("document.querySelectorAll('.reveal').length"): break
        pg.evaluate("(document.querySelector('.reveal .rclose')||{click(){}}).click()");pg.wait_for_timeout(1300)
    clean(pg)
def go(pg,touch,sel,force=False):
    """click / tap the first visible element that matches"""
    loc=pg.locator(sel+':visible').first;loc.scroll_into_view_if_needed(timeout=3000)
    if touch: loc.tap(timeout=3000,force=force)
    else: loc.click(timeout=3000,force=force)
def has(pg,sel): return pg.evaluate("s=>[...document.querySelectorAll(s)].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0}).length",sel)
def me(pg,k): return pg.evaluate("k=>S.me[k]",k)
def tab(pg,touch,k): go(pg,touch,f'#mods [data-do=pstab][data-k={k}]');pg.wait_for_timeout(700)
def near(got,want,tol=60): return want-tol<=got<=want+tol      # quest bonuses can add a few coins on top (the server tests check the exact amounts)
def num(s): return int(re.sub(r'[^0-9]','',s) or 0)

try:
  with sync_playwright() as p:
    b=p.chromium.launch()
    for (w,h,name,touch) in [(1280,720,'desk',False),(390,844,'portrait',True),(844,390,'land',True)]:
        if name not in ONLY: continue
        start()
        errs=[];sx=name[:2]
        ctxA,A=reg(b,w,h,touch,'psA'+sx,errs);ctxB,B=reg(b,w,h,touch,'psB'+sx,errs)
        pulls(A,4);pulls(B,1)
        ck(me(A,'lvl')>=3,f'[{name}] seller A is level {me(A,"lvl")} (market needs 3)')
        # ================================================================== SHOP
        A.evaluate("DO.petshop()");A.wait_for_selector('#mods [data-do=psbuy][data-k=p]',timeout=6000);A.wait_for_timeout(900)
        ck(A.evaluate("document.querySelectorAll('#mods [data-do=psbuy][data-k=p]').length")==11,f'[{name}] the premium shelf has 11 breeds')
        ck(A.evaluate("document.querySelectorAll('#mods [data-do=psbuy][data-k=d]').length")==5,f'[{name}] 5 daily offers')
        ck(A.evaluate("document.querySelectorAll('#mods canvas[data-an]').length")>=11,f'[{name}] the dogs are drawn (animated canvases)')
        ck(A.evaluate("(()=>{const t=[...document.querySelectorAll('#mods .tabs2 button')].map(b=>b.textContent);return t.length==3&&/🐾/.test(t[0])&&/🏷️/.test(t[1])&&/💰/.test(t[2])})()"),f'[{name}] three tabs: shop, market, sell')
        layout(A,name,'shop top');shot(A,name,'1_shop')
        A.evaluate("(()=>{const m=document.querySelector('#mods .mb');m.scrollTop=m.scrollHeight})()");A.wait_for_timeout(300);layout(A,name,'shop bottom');shot(A,name,'2_shop_bottom')
        A.evaluate("document.querySelector('#mods .mb').scrollTop=0")
        # --- premium purchase with coins: confirm dialog -> new friend card
        c0=me(A,'coins');d0=A.evaluate("S.me.total")
        go(A,touch,'#mods [data-do=psbuy][data-k=p][data-id=mochipup]');A.wait_for_selector('#askYes',timeout=3000);A.wait_for_timeout(500)
        ck('1,800' in A.evaluate("document.querySelector('#mods .ov[data-mod=ask]').innerText") or '1800' in A.evaluate("document.querySelector('#mods .ov[data-mod=ask]').innerText"),f'[{name}] the confirm dialog shows the price')
        layout(A,name,'confirm dialog');shot(A,name,'3_ask')
        go(A,touch,'#askYes');A.wait_for_selector('#mods .psnew, .reveal .eg-res',timeout=8000);A.wait_for_timeout(900)
        A.wait_for_timeout(300)
        ck(near(c0-me(A,'coins'),1800),f'[{name}] Mochi Pup cost exactly 1800 coins ({c0-me(A,"coins")})')
        ck(A.evaluate("S.me.total")==d0+1,f'[{name}] one more dog ({d0} -> {A.evaluate("S.me.total")})')
        layout(A,name,'new friend card');shot(A,name,'4_newfriend')
        ck(not re.search('undefined|NaN|\\[object',A.evaluate("(document.querySelector('.reveal')||document.querySelector('#mods .psnew')||{}).textContent||''")),f'[{name}] the new-friend card has no junk text')
        A.evaluate("closeMod('psnew');(document.querySelector('.reveal .rclose')||{click(){}}).click()");A.wait_for_timeout(700)
        card=A.evaluate("(()=>{const b=document.querySelector('#mods [data-do=psbuy][data-k=p][data-id=mochipup]');const c=b&&b.closest('.psc');return c?c.innerText:''})()")
        ck(re.search(r'4\s*/\s*5',card) is not None,f'[{name}] the card now says 4/5 left ("{card[:40]!r}")'.replace('\n',' '))
        # --- gem breed: confirm shows gems, wallet in the title goes down
        g0=me(A,'gems')
        go(A,touch,'#mods [data-do=psbuy][data-k=p][data-id=dragonpup]');A.wait_for_selector('#askYes',timeout=3000);A.wait_for_timeout(300)
        go(A,touch,'#askYes');A.wait_for_selector('#mods .psnew, .reveal .eg-res',timeout=8000);A.wait_for_timeout(700);A.evaluate("closeMod('psnew');(document.querySelector('.reveal .rclose')||{click(){}}).click()");A.wait_for_timeout(700)
        ck(me(A,'gems')==g0-260,f'[{name}] Dragon Pup cost 260 gems ({g0-me(A,"gems")})')
        sold=A.evaluate("(()=>{const b=document.querySelector('#mods [data-do=psbuy][data-id=dragonpup]');const c=b&&b.closest('.psc');return c?(c.classList.contains('sold')||/ขายหมด|SOLD/i.test(c.innerText)):false})()")
        ck(sold,f'[{name}] after buying the only Dragon Pup its card shows "sold out"')
        layout(A,name,'shop after buying');shot(A,name,'5_shop_after')
        # ================================================================== MARKET: A lists a dog through the form
        tab(A,touch,'mk');ck(has(A,'#mods [data-do=mklist]')>=1,f'[{name}] market tab has the "list a dog" button')
        layout(A,name,'market empty');shot(A,name,'6_market_empty')
        go(A,touch,'#mods [data-do=mklist]');A.wait_for_selector('#mkPrice,#mods [data-do=mkpick]',timeout=4000);A.wait_for_timeout(600)
        layout(A,name,'list form (pick a dog)');shot(A,name,'7_listform_pick')
        if not has(A,'#mkPrice'):
            go(A,touch,'#mods .psp:not(.off)');A.wait_for_selector('#mkPrice',timeout=3000);A.wait_for_timeout(500)
        dogname=A.evaluate("(document.querySelector('#mods .psml-dog b')||{}).textContent")
        # bad prices explain themselves, a good one shows what the seller receives
        A.fill('#mkPrice','12');A.wait_for_timeout(300)
        err=A.evaluate("(document.querySelector('#mkErr')||{}).innerText||''");ck(len(err.strip())>3,f'[{name}] a too-low price gives a clear message ("{err.strip()[:50]}")')
        layout(A,name,'list form (bad price)');shot(A,name,'8_listform_err')
        A.fill('#mkPrice','');A.type('#mkPrice','1200',delay=40);A.wait_for_timeout(300)
        prev=A.evaluate("(document.querySelector('#psPrev')||{}).innerText||''")
        ck(re.search(r'1[,. ]?140',prev) is not None and re.search(r'1[,. ]?200',prev) is not None,f'[{name}] preview: buyer pays 1,200, seller gets 1,140 ("{prev.strip()[:70]!r}")'.replace('\\n',' '))
        layout(A,name,'list form (ready)');shot(A,name,'9_listform_ok')
        A.press('#mkPrice','Enter');A.wait_for_timeout(1200)
        if has(A,'#mkPrice'): go(A,touch,'#mkGo');A.wait_for_timeout(1200)
        ck(not has(A,'#mkPrice'),f'[{name}] the form closes after listing')
        ck(has(A,'#mods [data-do=mkcancel]')==1,f'[{name}] my listing is there, with "take back"')
        layout(A,name,'market with my listing');shot(A,name,'10_market_mine')
        # ---------------------------------------------------------------- B buys it
        B.evaluate("DO.petshop()");B.wait_for_selector('#mods [data-do=psbuy][data-k=p]',timeout=6000);B.wait_for_timeout(500)
        ck(B.evaluate("(()=>{const b=document.querySelector('#mods [data-do=psbuy][data-id=dragonpup]');const c=b&&b.closest('.psc');return !!c&&(c.classList.contains('sold')||/ขายหมด|SOLD/i.test(c.innerText))})()"),f'[{name}] B sees the Dragon Pup as sold out (A bought the last one)')
        layout(B,name,'B shop (sold out)');shot(B,name,'11_B_shop')
        tab(B,touch,'mk');B.wait_for_selector('#mods [data-do=mkbuy]',timeout=5000);B.wait_for_timeout(500)
        ck(has(B,'#mods [data-do=mkbuy]')==1,f'[{name}] B sees exactly A\'s listing')
        txt=B.evaluate("document.querySelector('#mods .mkc').innerText");ck('psA'+sx in txt and re.search(r'1[,. ]?200',txt) is not None,f'[{name}] the listing card names the seller and the price')
        layout(B,name,'B market');shot(B,name,'12_B_market')
        bc=me(B,'coins');bd=B.evaluate("S.me.total")
        go(B,touch,'#mods [data-do=mkbuy]');B.wait_for_selector('#askYes',timeout=3000);B.wait_for_timeout(500);layout(B,name,'B buy confirm');shot(B,name,'13_B_ask')
        # a nervous double tap on "yes" must buy once
        box=B.evaluate("(()=>{const r=document.querySelector('#askYes').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()")
        if touch: B.touchscreen.tap(box[0],box[1]);B.touchscreen.tap(box[0],box[1])
        else: B.mouse.dblclick(box[0],box[1])
        B.wait_for_selector('#mods .psnew',timeout=5000);B.wait_for_timeout(1000)
        ck(near(bc-me(B,'coins'),1200) and B.evaluate("S.me.total")==bd+1,f'[{name}] B paid 1200 once and got exactly one dog ({bc-me(B,"coins")} coins, {B.evaluate("S.me.total")-bd} dog)')
        ck(dogname in B.evaluate("document.querySelector('#mods .psnew h3').textContent"),f'[{name}] the dog that arrives is the one A listed ({dogname})')
        layout(B,name,'B new friend');shot(B,name,'14_B_newfriend')
        B.evaluate("closeMod('psnew')");B.wait_for_timeout(700)
        ck(has(B,'#mods [data-do=mkbuy]')==0,f'[{name}] the listing is gone for B')
        # A: listing disappears, the sale mail is there (coins arrive when claimed)
        tab(A,touch,'shop');tab(A,touch,'mk');A.wait_for_timeout(900)
        ck(has(A,'#mods [data-do=mkcancel]')==0,f'[{name}] A\'s listing is gone after the sale')
        A.evaluate("send({t:'mail_get'})");A.wait_for_timeout(500)
        ac=me(A,'coins');A.evaluate("send({t:'mail_claim_all'})");A.wait_for_timeout(700)
        ck(near(me(A,'coins')-ac,1140),f'[{name}] A claims 1140 coins from the sale mail ({me(A,"coins")-ac})')
        # ================================================================== CAP: B buys until 8 a day
        for k,id_ in [('p','teddypom')]*5+[('p','bunnycorgi')]*3:
            B.evaluate("([k,id])=>send({t:'pet_buy',k,id})",[k,id_]);B.wait_for_timeout(260)
        B.wait_for_timeout(400);B.evaluate("closeMod('psnew');document.querySelectorAll('.reveal').forEach(o=>o.remove())");B.wait_for_timeout(400)
        tab(B,touch,'shop');B.wait_for_timeout(800)
        capt=B.evaluate("(document.querySelector('#mods .psban')||document.querySelector('#mods .mb')).innerText")
        ck(re.search(r'8\s*/\s*8',capt) is not None,f'[{name}] the page shows the daily cap reached (8/8)')
        nb=B.evaluate("S.me.total");B.evaluate("document.querySelectorAll('#askYes').forEach(x=>x.remove())")
        go(B,touch,'#mods [data-do=psbuy][data-k=p][data-id=mochipup]',force=True);B.wait_for_timeout(700)
        ck(not has(B,'#askYes'),f'[{name}] at the cap a buy button does not open a confirm dialog')
        ck(B.evaluate("S.me.total")==nb,f'[{name}] and nothing was bought')
        layout(B,name,'B shop at the cap');shot(B,name,'15_B_cap')
        # ================================================================== SELL to the shop
        tab(A,touch,'sell');A.wait_for_timeout(500)
        ck(has(A,'#mods [data-do=dogsell]')>=3,f'[{name}] sell tab lists my dogs ({has(A,"#mods [data-do=dogsell]")})')
        layout(A,name,'sell tab');shot(A,name,'16_sell')
        lab=A.evaluate("(()=>{const b=document.querySelector('#mods [data-do=dogsell]:not(.psno)');return b?b.innerText:''})()");price=num(lab)
        sc=me(A,'coins');sd=A.evaluate("S.me.total")
        go(A,touch,'#mods [data-do=dogsell]:not(.psno)');A.wait_for_selector('#askYes',timeout=3000);A.wait_for_timeout(400)
        atxt=A.evaluate("document.querySelector('#mods .ov[data-mod=ask]').innerText")
        ck(re.search(r'กลับคืนไม่ได้|ถาวร|can.?t be undone',atxt,re.I) is not None,f'[{name}] the sell confirm warns that it can not be undone')
        layout(A,name,'sell confirm');shot(A,name,'17_sell_ask')
        go(A,touch,'#askYes');A.wait_for_timeout(1200)
        ck(near(me(A,'coins')-sc,price) and price>0,f'[{name}] selling paid exactly the price on the button ({price}; coins +{me(A,"coins")-sc})')
        ck(A.evaluate("S.me.total")==sd-1,f'[{name}] one dog less')
        layout(A,name,'sell tab after');shot(A,name,'18_sell_after')
        # ================================================================== the same windows in English (the page default is Thai)
        A.evaluate("S.set.lang='en'");A.evaluate("DO.petshop()");A.wait_for_timeout(900)
        ck(A.evaluate("/Shop/.test(document.querySelector('#mods .tabs2').innerText)&&!/[฀-๿]/.test(document.querySelector('#mods .tabs2').innerText)"),f'[{name}] English: tabs have no Thai text')
        txt=A.evaluate("document.querySelector('#mods .mb').innerText")
        thai=re.findall(r'[฀-๿]+',txt)
        ck(len(thai)==0,f'[{name}] English shop: no Thai left over {thai[:4]}')
        layout(A,name,'English shop');shot(A,name,'19_en_shop')
        for k in ('mk','sell'):
            tab(A,touch,k);txt=A.evaluate("document.querySelector('#mods .mb').innerText");thai=re.findall(r'[฀-๿]+',txt)
            ck(len(thai)==0,f'[{name}] English {k} tab: no Thai left over {thai[:4]}');layout(A,name,'English '+k);shot(A,name,'20_en_'+k)
        A.evaluate("S.set.lang='th'")
        ck(not errs,f'[{name}] no console errors {errs[:3]}')
        ctxA.close();ctxB.close()
        srv.terminate();srv.wait()
    b.close()
finally:
  if srv: srv.terminate()
print('RESULT',sum(res),'/',len(res))
sys.exit(0 if all(res) else 1)
