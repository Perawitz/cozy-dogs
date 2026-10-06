import os,sys,subprocess,time,json
from playwright.sync_api import sync_playwright
# v6.2.1 - Thai text on the canvas (chat bubbles over the dogs, name tags ...).
# Bug seen on an iPhone (Instagram's in-app browser): textAlign='center' was ignored for Thai, so the text of a speech bubble began in the
# middle of the bubble and ran out of it. We cannot run Safari here, so the test makes Chromium behave the same way (an init script that
# makes fillText ignore the alignment for Thai) and checks that the game still draws the text in the middle of its bubble.
#   1. control: without the emulated bug the bubbles are centred
#   2. sanity : with the bug emulated AND the game's fix switched off, the text really is off-centre (so the test can detect the bug)
#   3. fix    : with the bug emulated and the fix on, every bubble is centred and the text stays inside it
#   4. long texts are cut by characters (never half an emoji), the park draws with no errors
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
BUG="""(()=>{const P=CanvasRenderingContext2D.prototype;for(const fn of ['fillText','strokeText']){const o=P[fn];
 P[fn]=function(s,x,y,m){if(/[\\u0E00-\\u0E7F]/.test(s)&&this.textAlign!='left'){const a=this.textAlign;this.textAlign='left';try{return o.call(this,s,x,y)}finally{this.textAlign=a}}return o.call(this,s,x,y)}}})();"""
NOFIX="CanvasRenderingContext2D.prototype.__thFix=1;"
TEXTS=['ทรั้นาสยน่','สวัสดีครับ','ดีจ้า','ไม่เป็นไรนะ','ขอบคุณมากครับผม','น้องหมาน่ารักจัง','hello','Hi สวัสดี','ผู้ใหญ่ๆ','ก็ได้']
MEASURE="""(texts)=>{const out=[];const W=360,H=90,X=180,BY=60;
 const draw=(text,noText)=>{const cv=document.createElement('canvas');cv.width=W;cv.height=H;const c=cv.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,W,H);if(noText)c.fillText=()=>{};AVA.bubble(c,X,BY,text,1);return{c,d:c.getImageData(0,0,W,H).data}};
 for(const text of texts){
  const A=draw(text,false),B=draw(text,true);   // B = the same bubble without its text, so A-B is exactly the text ink
  const c=A.c;c.save();c.font='bold 12px '+getComputedStyle(document.body).fontFamily;const tx=Array.from(text).length>26?Array.from(text).slice(0,25).join('')+'…':text;const tw=c.measureText(tx).width+18;c.restore();
  const L=X-tw/2,R=X+tw/2;let mn=1e9,mx=-1e9;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4;if(Math.abs(A.d[i]-B.d[i])+Math.abs(A.d[i+1]-B.d[i+1])+Math.abs(A.d[i+2]-B.d[i+2])>150){if(x<mn)mn=x;if(x>mx)mx=x}}
  out.push({text,L,R,mn,mx,off:mn>mx?null:(mn+mx)/2-X,outside:(mn<L+2||mx>R-2)?1:0})}
 return out}"""
def login(b,user,w,h,touch,dsf,init):
    ctx=b.new_context(viewport={'width':w,'height':h},is_mobile=touch,has_touch=touch,device_scale_factor=dsf)
    for s in init: ctx.add_init_script(s)
    pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append('PAGEERR '+str(e)));pg.on('console',lambda m:errs.append(m.text) if m.type=='error' else None)
    pg.goto(URL);pg.wait_for_timeout(600)
    pg.click('#tReg');pg.fill('#rUser',user);pg.fill('#rMail','m@t.co');pg.fill('#rPass','secret1');pg.click('#fReg button[type=submit]')
    pg.wait_for_selector('#game.on',timeout=8000);pg.wait_for_timeout(1000)
    pg.evaluate("document.querySelectorAll('.coach,.tut').forEach(o=>o.classList.add('hidden'));document.querySelectorAll('#mods .ov').forEach(o=>o.remove())")
    return ctx,pg,errs
try:
  with sync_playwright() as p:
    b=p.chromium.launch()
    # 1 control (no bug) - desktop
    c1,p1,e1=login(b,'thC',1280,800,False,1,[])
    r=p1.evaluate(MEASURE,TEXTS)
    ck(all(x['off'] is not None and abs(x['off'])<=4 and x['outside']==0 for x in r),'[control] with a normal browser every bubble text is centred '+str([(x['text'],round(x['off'],1)) for x in r if x['off'] is None or abs(x['off'])>4]))
    c1.close()
    # 2 sanity: the emulated iPhone bug without the fix really breaks the Thai bubbles
    c2,p2,e2=login(b,'thS',390,844,True,3,[BUG,NOFIX])
    r=p2.evaluate(MEASURE,TEXTS)
    thai=[x for x in r if any('฀'<=ch<='๿' for ch in x['text'])]
    lat=[x for x in r if x['text']=='hello']
    ck(all(x['off'] is not None and x['off']>8 and x['outside'] for x in thai if len(x['text'])>8) and all(x['off'] is not None and x['off']>4 for x in thai),'[sanity] emulated iPhone bug WITHOUT the fix: Thai text is shifted to the right of its bubble '+str([(x['text'],round(x['off'],1),x['outside']) for x in thai if x['off'] is not None]))
    ck(all(abs(x['off'])<=4 for x in lat),'[sanity] ...and Latin text is not affected (as on the real phone)')
    c2.close()
    # 3 fix: bug emulated, the game's own fix on - phone sized, 3x pixels like an iPhone
    for name,(w,h,touch,dsf) in {'iphone':(390,844,True,3),'desk':(1280,800,False,1),'tiny':(320,568,True,2)}.items():
        c3,p3,e3=login(b,'thF'+name,w,h,touch,dsf,[BUG])
        fixed=p3.evaluate("!!CanvasRenderingContext2D.prototype.__thFix")
        ck(fixed,f'[{name}] the fix is installed')
        r=p3.evaluate(MEASURE,TEXTS)
        bad=[(x['text'],None if x['off'] is None else round(x['off'],1),x['outside']) for x in r if x['off'] is None or abs(x['off'])>4 or x['outside']]
        ck(not bad,f'[{name}] with the emulated iPhone bug every bubble text is centred inside its bubble {bad}')
        # right / end alignment and strokeText go through the same fix
        t=p3.evaluate("""()=>{const cv=document.createElement('canvas');cv.width=200;cv.height=40;const c=cv.getContext('2d');c.font='bold 14px '+getComputedStyle(document.body).fontFamily;
          const ink=(al,fn)=>{c.clearRect(0,0,200,40);c.fillStyle='#000';c.strokeStyle='#000';c.textAlign=al;c[fn]('สวัสดีครับ',100,28);const d=c.getImageData(0,0,200,40).data;let mn=1e9,mx=-1e9;for(let y=0;y<40;y++)for(let x=0;x<200;x++)if(d[(y*200+x)*4+3]>60){if(x<mn)mn=x;if(x>mx)mx=x}return[mn,mx]};
          return{center:ink('center','fillText'),right:ink('right','fillText'),end:ink('end','fillText'),left:ink('left','fillText'),sc:ink('center','strokeText'),align:c.textAlign}}""")
        ck(abs((t['center'][0]+t['center'][1])/2-100)<=4,f'[{name}] fillText centre -> ink centred on x {t["center"]}')
        ck(abs(t['right'][1]-100)<=4 and abs(t['end'][1]-100)<=4,f'[{name}] fillText right / end -> text ends at x {t["right"]} {t["end"]}')
        ck(abs(t['left'][0]-100)<=4,f'[{name}] fillText left is untouched {t["left"]}')
        ck(abs((t['sc'][0]+t['sc'][1])/2-100)<=5,f'[{name}] strokeText centre -> centred {t["sc"]}')
        ck(t['align']=='center','[%s] the alignment the game set is given back afterwards (last call used center: %s)'%(name,t['align']))
        # 4 long text: cut by characters, never in the middle of an emoji; the real park draws it without errors
        cut=p3.evaluate("""()=>{const seen=[];const o=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(s,...a){seen.push(String(s));return o.call(this,s,...a)};
          const cv=document.createElement('canvas');cv.width=400;cv.height=90;const c=cv.getContext('2d');
          AVA.bubble(c,200,60,'a'.repeat(24)+'😀😀😀 tail',1);AVA.bubble(c,200,60,'ทดสอบ'.repeat(10),1);AVA.bubble(c,200,60,'🐶'.repeat(40),1);CanvasRenderingContext2D.prototype.fillText=o;return seen}""")
        ck(len(cut)==3 and all(not __import__('re').search(r'[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]',s) for s in cut),f'[{name}] long texts are shortened without breaking an emoji {cut}')
        ck(all(len(list(s))<=26 for s in cut),f'[{name}] and never longer than 26 characters')
        p3.evaluate("DO.park()");p3.wait_for_timeout(2200);p3.evaluate("document.querySelectorAll('#mods .ov').forEach(o=>o.remove())");p3.wait_for_timeout(500)
        me=p3.evaluate("S.owner||S.name")
        for m in ['ทรั้นาสยน่','สวัสดีครับ ไปเล่นกัน😀']:
            p3.evaluate("m=>H.chat({t:'chat',from:S.owner||S.name,m})",m);p3.wait_for_timeout(1000)
        p3.screenshot(path=f'{D}/{TAG}_{name}_bubble.png')
        ck(p3.evaluate("Park.on===true"),f'[{name}] park is running with the bubble')
        ck(not [e for e in e3 if 'favicon' not in e],f'[{name}] no console errors {e3[:3]}')
        c3.close()
    b.close()
finally:
  srv.terminate()
print('RESULT',sum(res),'/',len(res))
sys.exit(0 if all(res) else 1)
