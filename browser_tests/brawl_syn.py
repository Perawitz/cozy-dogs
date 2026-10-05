import os,sys,subprocess,time,json
from playwright.sync_api import sync_playwright
# Dog Brawl client with hand-made server messages: 4 / 2 fighters, every event type, KO of my dog, a leaver, refused moves, English texts.
SRC=sys.argv[1]; TAG=sys.argv[2]; PORT=sys.argv[3]; VIEWS=sys.argv[4].split(',') if len(sys.argv)>4 else ['desk','portrait']
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
MK="""(n,me)=>{const names=['greatdane','chihuahua','corgi','husky'],pl=[];for(let i=0;i<n;i++){const id=names[i],b=DOGS.BR[id],s=BRD.statsFor(id,b.r,b.size);pl.push({n:i==me?S.name:'Rival'+i,bot:false,breed:id,variant:'Normal',acc:null,dn:'x',lvl:3,hp:s.hp,atk:s.atk,def:s.def,spd:s.spd,en:s.en0,sk:s.sk,arch:s.arch})}
 H.mp_start({t:'mp_start',g:'brawl',id:77,pl,me,go:3600,cfg:{len:100,win:3,rounds:6,qms:7000}});return pl.map(p=>p.hp)}"""
SNAP="""(o)=>{const B=BW;return Object.assign({t:'mp_ba',r:1,n:6,ms:7000,hp:B.hp.slice(),en:B.en.slice(),al:B.al.map(a=>a?1:0),st:B.hp.map(()=>({sh:0,u:0,w:0,s:0,r:0})),dm:B.hp.map(()=>0)},o||{})}"""
try:
  with sync_playwright() as p:
    b=p.chromium.launch()
    for name in VIEWS:
        w,h,touch=ALL[name]
        ctx=b.new_context(viewport={'width':w,'height':h},is_mobile=touch,has_touch=touch,device_scale_factor=1)
        pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append('PAGEERR '+str(e)));pg.on('console',lambda m:errs.append(m.text) if m.type=='error' else None)
        pg.goto(URL);pg.wait_for_timeout(600)
        pg.click('#tReg');pg.fill('#rUser','syn'+name[:4]);pg.fill('#rMail','m@t.co');pg.fill('#rPass','secret1');pg.click('#fReg button[type=submit]')
        pg.wait_for_selector('#game.on',timeout=8000);pg.wait_for_timeout(1500)
        pg.evaluate("document.querySelectorAll('.coach,.tut').forEach(o=>o.classList.add('hidden'));document.querySelectorAll('#mods .ov').forEach(o=>o.remove())")
        for N,me in [(4,2),(2,0)]:
            pg.evaluate("MP.reset();BW.on=false")
            pg.evaluate("(%s)(%d,%d)"%(MK,N,me));pg.wait_for_timeout(300)
            ck(pg.evaluate("BW.on&&BW.N==%d&&document.querySelectorAll('.bwc').length==%d"%(N,N)),f'[{name}] {N} fighters: {N} cards')
            order=pg.evaluate("BW.order");ck(order[0]==me,f'[{name}] {N} fighters: my dog is in the first slot {order}')
            # round 1
            pg.evaluate("H.mp_ba((%s)())"%SNAP);pg.wait_for_timeout(300)
            ck(pg.evaluate("BW.ph=='ask'&&BW.round==1&&BW.tgt!=BW.me&&BW.tgt>=0"),f'[{name}] {N} fighters: round 1 opens with a default target ({pg.evaluate("BW.tgt")})')
            pg.screenshot(path=f'{D}/{TAG}_{name}_n{N}_ask.png')
            # tap-select a different enemy via the canvas
            if N==4:
                other=[i for i in order[1:] if i!=pg.evaluate("BW.tgt")][0]
                slot=order.index(other)
                box=pg.evaluate("(()=>{const r=document.querySelector('#bwc').getBoundingClientRect();return [r.left,r.top,r.width,r.height]})()")
                x=box[0]+box[2]*(slot+.5)/N;y=box[1]+box[3]*.6
                (pg.touchscreen.tap if touch else pg.mouse.click)(x,y);pg.wait_for_timeout(200)
                ck(pg.evaluate("BW.tgt")==other,f'[{name}] tapping an enemy on the arena selects it ({pg.evaluate("BW.tgt")} vs {other})')
            # illegal: energy short skill -> toast (button refuses)
            pg.evaluate("document.querySelector('#bact-s0').click()");pg.wait_for_timeout(150)
            ck(pg.evaluate("BW.sent")==False,f'[{name}] a skill that costs too much is refused on the client')
            # real move
            pg.evaluate("document.querySelector('#bact-atk').click()");pg.wait_for_timeout(150)
            ck(pg.evaluate("BW.sent")==True and pg.evaluate("document.querySelectorAll('#bacts .bact:not(.off)').length")==1,f'[{name}] after choosing, only the chosen button stays lit')
            # server refuses -> unlock
            pg.evaluate("H.mp_bno({t:'mp_bno',r:1,why:'target'})");pg.wait_for_timeout(150)
            ck(pg.evaluate("BW.sent")==False,f'[{name}] mp_bno unlocks the buttons again')
            # a stale refusal for another round is ignored
            pg.evaluate("document.querySelector('#bact-grd').click()");pg.wait_for_timeout(100)
            pg.evaluate("H.mp_bno({t:'mp_bno',r:5,why:'target'})");pg.wait_for_timeout(100)
            ck(pg.evaluate("BW.sent")==True,f'[{name}] a refusal for another round is ignored')
            # results of round 1: every event type once
            T=1 if N==2 else (0 if me!=0 else 1)
            evs=[{'k':'act','i':me,'a':'sk','s':'bite'},{'k':'hit','i':me,'t':T,'d':11,'c':0,'ab':0},{'k':'hit','i':me,'t':T,'d':14,'c':1,'ab':6},{'k':'miss','i':me,'t':T},
                 {'k':'act','i':T,'a':'grd'},{'k':'act','i':T,'a':'atk','t':me},{'k':'cancel','i':T,'t':me},{'k':'act','i':me,'a':'sk','s':'fluff'},{'k':'shield','i':me,'v':24},
                 {'k':'act','i':me,'a':'sk','s':'nap'},{'k':'heal','i':me,'d':9},{'k':'buff','i':me,'s':'zoom'},{'k':'buff','i':me,'s':'eyes'},{'k':'buff','i':me,'s':'up'},{'k':'buff','i':me,'s':'rage'},
                 {'k':'debuff','t':T,'s':'scared'},{'k':'debuff','t':T,'s':'weak'},{'k':'steal','i':me,'t':T,'n':2},{'k':'fizzle','i':T},{'k':'ko','t':T}]
            js="""(evs)=>{const B=BW,hp=B.hp.slice(),al=B.al.map(a=>a?1:0);hp[%d]=0;al[%d]=0;H.mp_bx({t:'mp_bx',r:1,ev:evs,hp,en:B.en.map(e=>e+1),al,st:B.hp.map((_,i)=>i==%d?{sh:24,u:1,w:0,s:0,r:1}:{sh:0,u:0,w:1,s:1,r:0}),dm:B.hp.map((_,i)=>i==%d?44:0)})}"""%(T,T,me,me)
            pg.evaluate(js,evs);pg.wait_for_timeout(1500)
            pg.screenshot(path=f'{D}/{TAG}_{name}_n{N}_play.png')
            ck(pg.evaluate("BW.ph=='play'&&BW.evs!==null"),f'[{name}] {N} fighters: events are being played back')
            pg.wait_for_timeout(7500)         # 20 events ~ 8 s in total
            ck(pg.evaluate("BW.evs===null&&BW.al[%d]==0&&BW.al[%d]==1"%(T,me)),f'[{name}] {N} fighters: playback finished, the knocked-out dog is out')
            ck(pg.evaluate("document.querySelector('#bwcd%d').classList.contains('out')"%T),f'[{name}] its card is greyed out')
            st=pg.evaluate("document.querySelector('#bwcd%d .bws').textContent"%me)
            ck('🛡' in st and '⬆' in st and '🔥' in st,f'[{name}] my status icons show shield / attack up / rage ({st})')
            pg.screenshot(path=f'{D}/{TAG}_{name}_n{N}_after.png')
            if N==4:
                # an enemy leaves
                other=[i for i in order[1:] if i!=T][0]
                pg.evaluate("H.mp_gone({t:'mp_gone',n:BW.pl[%d].n})"%other);pg.wait_for_timeout(200)
                ck(pg.evaluate("BW.gone[%d]===true&&document.querySelector('#bwcd%d').classList.contains('out')"%(other,other)),f'[{name}] a leaver is marked on its card')
                # next round: target must be a living enemy
                pg.evaluate("H.mp_ba((%s)({r:2}))"%SNAP);pg.wait_for_timeout(200)
                tg=pg.evaluate("BW.tgt");ck(tg not in (me,T,other) and tg>=0,f'[{name}] new round: the target is still a living enemy ({tg})')
                # my dog gets knocked out -> spectator
                js2="""()=>{const B=BW,hp=B.hp.slice(),al=B.al.map(a=>a?1:0);hp[%d]=0;al[%d]=0;H.mp_bx({t:'mp_bx',r:2,ev:[{k:'act',i:%d,a:'atk',t:%d},{k:'hit',i:%d,t:%d,d:50,c:0,ab:0},{k:'ko',t:%d}],hp,en:B.en.slice(),al,st:B.hp.map(()=>({})),dm:B.hp.map(()=>0)})}"""%(me,me,tg,me,tg,me,me)
                pg.evaluate(js2);pg.wait_for_timeout(2200)
                pg.evaluate("H.mp_ba((%s)({r:3}))"%SNAP);pg.wait_for_timeout(250)
                msg=pg.evaluate("document.querySelector('#bwmsg').textContent")
                ck('💫' in msg and pg.evaluate("document.querySelectorAll('#bacts .bact:not(.off)').length")==0,f'[{name}] my dog knocked out: spectator message, all buttons off ({msg})')
                pg.screenshot(path=f'{D}/{TAG}_{name}_n4_spectate.png')
                pg.evaluate("document.querySelector('#bact-atk').click()");ck(pg.evaluate("BW.sent")==False,f'[{name}] a knocked-out dog cannot send moves')
            # finish: results window, wide window goes back to narrow
            pg.evaluate("""H.mp_end({t:'mp_end',g:'brawl',res:BW.pl.map((p,i)=>({n:p.n,bot:p.bot,score:30+i,rank:i+1,left:false,breed:p.breed,variant:'Normal'})),me:{rank:1,coins:30,xp:12,win:true,capLeft:100,vsHuman:false}})""");pg.wait_for_timeout(500)
            ck(pg.evaluate("BW.on")==False and pg.evaluate("!!document.querySelector('#mods [data-mod=mp] [data-do=mpagain]')"),f'[{name}] {N} fighters: results window, arena stopped')
            ck(pg.evaluate("document.querySelector('#mods [data-mod=mp] .panel').classList.contains('sm')&&!document.querySelector('#mods [data-mod=mp] .panel').classList.contains('br')"),f'[{name}] result window is narrow again')
            pg.screenshot(path=f'{D}/{TAG}_{name}_n{N}_end.png')
        # English texts
        pg.evaluate("MP.reset();S.set.lang='en'");pg.evaluate("(%s)(3,0)"%MK);pg.wait_for_timeout(300);pg.evaluate("H.mp_ba((%s)())"%SNAP);pg.wait_for_timeout(300)
        txt=pg.evaluate("document.querySelector('#mods [data-mod=mp]').innerText")
        ck('Round 1/6' in txt and 'Choose your move!' in txt and 'Guard' in txt and 'Bite' in txt and 'Leave' in txt,f'[{name}] English texts in the arena')
        pg.screenshot(path=f'{D}/{TAG}_{name}_en.png')
        ck(not [e for e in errs if 'favicon' not in e],f'[{name}] no console errors {errs[:3]}')
        ctx.close()
    b.close()
finally:
  srv.terminate()
print('RESULT',sum(res),'/',len(res))
sys.exit(0 if all(res) else 1)
