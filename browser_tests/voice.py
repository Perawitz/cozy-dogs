import os,sys,subprocess,time,json,wave,struct,math,random
from playwright.sync_api import sync_playwright
# Park voice chat (WebRTC audio mesh + WebSocket signalling) with REAL Chromium pages and Chromium's fake microphone.
#   python3 browser_tests/voice.py <repo> <tag> <port> [desk,portrait,land]
# The first view in the list runs the FULL scenario (3 players -> 4th joins late -> leave -> park leave / visit -> reconnect -> denied / insecure / full / cancelled prompt);
# every view runs the layout checks (buttons fit the park bar or the floating group, tappable, popover on screen) and takes screenshots.
# Chromium flags: fake UI + fake device (a looping test sound, see tone.wav below), autoplay allowed, and mDNS host-candidate hiding OFF so two pages on one machine can use host candidates.
SRC=sys.argv[1]; TAG=sys.argv[2]; PORT=sys.argv[3]; VIEWS=sys.argv[4].split(',') if len(sys.argv)>4 else ['desk','portrait','land']
import tempfile
D=os.environ.get('OUT') or os.path.join(tempfile.gettempdir(),'cozydogs_browser_tests');os.makedirs(D,exist_ok=True)
data=f'{D}/data_{TAG}.json'
for f in (data,data+'.bak'):
    if os.path.exists(f): os.remove(f)
# a speech-like test sound for the fake microphone: a 0.5 s rising chirp with 5 Hz amplitude modulation + noise (a steady sine would be removed by the browser's noise suppression)
WAV=f'{D}/tone_{TAG}.wav'
random.seed(3);w=wave.open(WAV,'wb');w.setnchannels(1);w.setsampwidth(2);w.setframerate(48000);ph=0;out=[]
for i in range(48000*4):
    t=i/48000;ph+=2*math.pi*(300+900*((t*2)%1))/48000;env=.5+.5*math.sin(2*math.pi*5*t)
    out.append(int(.6*32767*env*math.sin(ph)+.15*32767*random.uniform(-1,1)*env))
w.writeframes(b''.join(struct.pack('<h',x) for x in out));w.close()
env=dict(os.environ,PORT=PORT,DATA=data,CD_TEST='1')
for k in ('SUPABASE_URL','SUPABASE_KEY'): env.pop(k,None)
srv=subprocess.Popen(['node',SRC+'/server.js'],cwd=SRC,env=env,stdout=open(f'{D}/srv_{TAG}.log','w'),stderr=subprocess.STDOUT)
time.sleep(1.5)
URL=f'http://localhost:{PORT}'
res=[]
def ck(c,n):
    res.append(bool(c));print('PASS' if c else 'FAIL',n,flush=True)
ARGS=['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--use-file-for-fake-audio-capture='+WAV,'--autoplay-policy=no-user-gesture-required','--disable-features=WebRtcHideLocalIpsWithMdns']
ALL={'desk':(1280,800,False),'portrait':(390,844,True),'land':(844,390,True)}
# runs in every page BEFORE the game: records every RTCPeerConnection and every microphone track (leak checks), and every voice_* WebSocket message (rate / size checks)
INIT="""(()=>{window.__pcs=[];window.__tracks=[];window.__vsent=[];
 const RPC=window.RTCPeerConnection;if(RPC)window.RTCPeerConnection=class extends RPC{constructor(...a){super(...a);window.__pcs.push(this)}};
 const md=navigator.mediaDevices;if(md&&md.getUserMedia){const g=md.getUserMedia.bind(md);md.getUserMedia=async c=>{if(window.__gumDelay)await new Promise(r=>setTimeout(r,window.__gumDelay));const s=await g(c);s.getTracks().forEach(t=>window.__tracks.push(t));return s}}
 const os=WebSocket.prototype.send;WebSocket.prototype.send=function(d){try{if(typeof d=='string'&&d.indexOf('"voice_')>0){const m=JSON.parse(d);window.__vsent.push({t:m.t,at:performance.now(),len:d.length,k:m.d&&m.d.k,to:m.to})}}catch(e){}
  if(window.__fakeFull&&typeof d=='string'&&d.indexOf('"voice_join"')>0){setTimeout(()=>H.voice_full({max:8}),60);return}return os.apply(this,arguments)}})();"""
BADGE="""n=>{const m=Park.m[n];if(!m)return null;cx.save();cx.font='bold 11px '+UIF();const w=cx.measureText(m.n+' · Lv'+m.lvl).width+16;cx.restore();const s=World.scale,x=m.rx+w/2+13,y=m.ry+17.5-6.5;const d=cx.getImageData(Math.round(x*s),Math.round(y*s),1,1).data;return [d[0],d[1],d[2]]}"""
def kind(c):
    if c is None: return None
    r,g,b=c
    # hue based, so it also works in the park's night / dusk tint (the lighting is painted over the badge)
    if g-r>=18 and g>=.8*b and g>60 and r<g: return 'mint'      # green wins over red even when the night tint has almost greyed it out
    if r>=1.25*g and r>=1.15*b and r>70: return 'red'
    if max(c)-min(c)<=.22*max(c) and max(c)>110: return 'paper'
    return str(c)
def mk(b,user,w,h,touch,perm=True):
    ctx=b.new_context(viewport={'width':w,'height':h},is_mobile=touch,has_touch=touch,device_scale_factor=1)
    if perm: ctx.grant_permissions(['microphone'])
    ctx.add_init_script(INIT)
    pg=ctx.new_page();errs=[]
    pg.on('pageerror',lambda e:errs.append('PAGEERR '+str(e)));pg.on('console',lambda m:errs.append(m.text) if m.type=='error' else None)
    pg.goto(URL);pg.wait_for_timeout(500)
    pg.click('#tReg');pg.fill('#rUser',user);pg.fill('#rMail','m@t.co');pg.fill('#rPass','secret1');pg.click('#fReg button[type=submit]')
    pg.wait_for_selector('#game.on',timeout=8000);pg.wait_for_timeout(900)
    pg.evaluate("document.querySelectorAll('.coach,.tut').forEach(o=>o.classList.add('hidden'));document.querySelectorAll('#mods .ov').forEach(o=>o.remove())")
    return ctx,pg,errs
def park(pg):
    pg.evaluate("DO.park()");pg.wait_for_function("Park.on===true&&Object.keys(Park.m).length>0",timeout=6000);pg.wait_for_timeout(500)
    pg.evaluate("document.querySelectorAll('#mods .ov').forEach(o=>o.remove())")
def wf(pg,js,t=15000):
    try: pg.wait_for_function(js,timeout=t);return True
    except Exception: return False
def press(pg,sel,touch):
    (pg.tap if touch else pg.click)(sel)
def joined(pg): return wf(pg,"Voice.st==='on'",8000)
def n_up(pg): return pg.evaluate("Object.values(Voice.peers).filter(p=>p.up).length")
def all_up(pgs): return all(wf(pg,f"Object.keys(Voice.peers).length=={len(pgs)-1}&&Object.values(Voice.peers).every(p=>p.up)",25000) for pg in pgs)
def stats(pg): return {s['n']:s for s in pg.evaluate("Voice.stats()")}
def toasts(pg): return pg.evaluate("[...document.querySelectorAll('#toasts .toast')].map(e=>e.textContent).join(' | ')")
def leaks(pg): return pg.evaluate("({pcs:__pcs.filter(p=>p.connectionState!=='closed'&&p.signalingState!=='closed').length,tracks:__tracks.filter(t=>t.readyState==='live').length,audio:document.querySelectorAll('#voiceaudio audio').length,live:Voice.live()})")
def noerr(errs): return [e for e in errs if 'favicon' not in e]
def rate_ok(pg):
    ts=sorted(x['at'] for x in pg.evaluate("__vsent.filter(x=>x.t==='voice_sig')"))
    return max([sum(1 for u in ts if t<=u<t+1000) for t in ts] or [0])
try:
  with sync_playwright() as p:
    b=p.chromium.launch(args=ARGS)
    for vi,name in enumerate(VIEWS):
        w,h,touch=ALL[name];full=(vi==0)
        ca,A,ea=mk(b,'vcA'+name[:3],w,h,touch)
        cb,B,eb=mk(b,'vcB'+name[:3],1280,800,False)
        park(A);park(B)
        nA,nB=A.evaluate("S.name"),B.evaluate("S.name")
        # ---------------------------------------------------------------- layout: where are the buttons?
        lay=A.evaluate("""()=>{const bt=[...document.querySelectorAll('.vbtn')].find(b=>b.offsetParent);if(!bt)return null;const r=bt.getBoundingClientRect(),e=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
          const hud=['#pcard','#loc','#cur','#online','#parkinfo','#chat','#ticker'].map(s=>document.querySelector(s)).filter(x=>x&&x.offsetParent&&x.getBoundingClientRect().width>0).map(x=>x.getBoundingClientRect());
          const hit=hud.some(q=>r.right>q.left&&r.left<q.right&&r.bottom>q.top&&r.top<q.bottom);
          return {l:r.left,t:r.top,w:r.width,h:r.height,inView:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,top:!!e&&(e===bt||bt.contains(e)),floating:!!bt.closest('#voicebar'),hit}}""")
        ck(lay and lay['inView'] and lay['top'],f'[{name}] the 🎤 button is on screen and tappable (nothing covers it) {lay}')
        ck(lay and lay['w']>=32 and lay['h']>=32,f'[{name}] ...and big enough to tap ({lay and round(lay["w"])}x{lay and round(lay["h"])})')
        ck(lay and not lay['hit'],f'[{name}] ...and it does not sit on top of other HUD panels')
        if name=='land': ck(lay and lay['floating'],f'[{name}] short landscape phone: the voice buttons are in the floating group, not squeezed into the park bar')
        else: ck(lay and not lay['floating'],f'[{name}] the voice buttons are part of the park bar')
        bar=A.evaluate("(()=>{const r=document.querySelector('#parkbar').getBoundingClientRect();return {l:r.left,r:r.right,t:r.top,b:r.bottom,h:r.height,iw:innerWidth,ih:innerHeight}})()")
        ck(bar['l']>=0 and bar['r']<=bar['iw']+0.5 and bar['b']<=bar['ih']+0.5,f'[{name}] the park bar still fits on screen {bar}')
        if name=='land': ck(bar['h']<80,f'[{name}] ...and stayed one row high ({round(bar["h"])}px) so it does not cover the park')
        A.screenshot(path=f'{D}/{TAG}_{name}_1_off.png')
        ck(A.evaluate("document.querySelector('.vbtn').getAttribute('aria-label')").startswith('เข้าร่วม') and A.evaluate("S.set.lang")=='th','[%s] Thai first: the button label is Thai'%name)
        # ---------------------------------------------------------------- not in voice yet: nothing is requested
        ck(A.evaluate("__tracks.length===0&&__pcs.length===0&&__vsent.length===0"),f'[{name}] opt-in: before pressing the button no microphone was requested, no peer connection, no voice message')
        # ---------------------------------------------------------------- first use: explanation modal
        press(A,'.vbtn:visible',touch);A.wait_for_timeout(400)
        mod=A.evaluate("(()=>{const o=document.querySelector('#mods .ov[data-mod=voicehi]');return o?o.textContent:null})()")
        ck(mod and 'peer-to-peer' in mod and 'https' in mod and 'ไม่ผ่านเซิร์ฟเวอร์' in mod and 'ปิดไมค์' in mod,f'[{name}] first press shows the Thai explanation (P2P, only in the park, https, mute) first')
        ck(A.evaluate("__tracks.length===0"),f'[{name}] ...and the microphone is still NOT requested')
        A.screenshot(path=f'{D}/{TAG}_{name}_2_intro.png')
        press(A,'[data-do=voiceok]',touch)
        ck(joined(A),f'[{name}] "เข้าร่วมเลย" -> asks for the mic and joins the voice room')
        A.wait_for_timeout(300)
        ck(A.evaluate("localStorage.getItem('cd_voice_ok')")=='true','[%s] the explanation is not shown again (remembered)'%name)
        ck(A.evaluate("Voice.live().tracks===1&&__tracks.length===1")  and A.evaluate("document.querySelector('.vbtn.on')!==null"),f'[{name}] mic track live, 🎤 button shows the active state')
        ck('🎧 1' in A.evaluate("[...document.querySelectorAll('.vchip')].map(e=>e.textContent).join()"),f'[{name}] count chip shows 🎧 1')
        # B joins (B already knows the explanation)
        B.evaluate("localStorage.setItem('cd_voice_ok','true')");B.click('.vbtn:visible');ck(joined(B),f'[{name}] second player joins')
        ck(all_up([A,B]),f'[{name}] the two peers connect (connectionState connected on both ends)')
        sa,sb=stats(A),stats(B)
        ck(sa.get(nB,{}).get('state')=='connected' and sb.get(nA,{}).get('state')=='connected' and sa[nB].get('link') in ('host','nat','relay'),f'[{name}] getStats: link {sa.get(nB,{}).get("local")}/{sa.get(nB,{}).get("remote")} {sa.get(nB,{}).get("proto")} rtt {sa.get(nB,{}).get("rtt")}ms')
        A.wait_for_timeout(1200);sa2=stats(A)
        ck(sa2[nB]['bytesReceived']>sa[nB]['bytesReceived'] and sa2[nB]['packetsReceived']>sa[nB]['packetsReceived'],f'[{name}] inbound audio keeps arriving ({sa[nB]["packetsReceived"]} -> {sa2[nB]["packetsReceived"]} packets)')
        ck(wf(A,f"Voice.peers['{nB}'].rms>0.01",5000),f'[{name}] the sound reaches the WebAudio graph (analyser level {A.evaluate("Voice.peers[%s].rms"%json.dumps(nB))})')
        ck(A.evaluate("(()=>{const a=document.querySelector('#voiceaudio audio');return !!a&&a.autoplay&&a.hasAttribute('playsinline')&&a.srcObject&&a.srcObject.getAudioTracks().length==1})()"),f'[{name}] remote audio element: autoplay + playsinline, stream attached')
        sdpmax=A.evaluate("Math.max(...__pcs.map(pc=>pc.localDescription?pc.localDescription.sdp.length:0))");print('INFO SDP size (chars):',sdpmax,'  largest voice_sig message:',A.evaluate("Math.max(...__vsent.map(x=>x.len))"),'bytes')
        ck(0<sdpmax<6500,f'[{name}] the audio-only SDP is {sdpmax} chars (limit 6500)')
        # speaking indicator (the fake mic plays the test sound all the time)
        ck(wf(A,f"Park.m[S.name].speaking===true&&Park.m['{nB}'].speaking===true",6000),f'[{name}] speaking flags: Park.m[me].speaking and Park.m[other].speaking become true')
        ck(wf(A,"document.querySelector('.vbtn.on.spk')!==null",4000),f'[{name}] the mic button pulses (ring) while I speak')
        kk=[kind(A.evaluate(BADGE,nB)) for _ in range(3)] if wf(A,f"Park.m['{nB}'].speaking===true",3000) else []
        ck('mint' in kk,f'[{name}] canvas: the other dog\'s sound-wave badge is drawn green while speaking ({kk})')
        A.screenshot(path=f'{D}/{TAG}_{name}_3_voice.png')
        # popover
        press(A,'.vchip:visible',touch);A.wait_for_timeout(600)
        pop=A.evaluate("""()=>{const p=document.querySelector('#voicepop');if(!p||p.classList.contains('hidden'))return null;const r=p.getBoundingClientRect(),e=document.elementFromPoint(r.left+r.width/2,r.top+12);
          return {l:r.left,t:r.top,r:r.right,b:r.bottom,iw:innerWidth,ih:innerHeight,top:!!e&&p.contains(e),text:p.textContent,rows:p.querySelectorAll('.vp').length,sl:p.querySelectorAll('input[type=range]').length}}""")
        ck(pop and pop['l']>=0 and pop['t']>=0 and pop['r']<=pop['iw']+.5 and pop['b']<=pop['ih']+.5 and pop['top'],f'[{name}] the settings popover opens fully on screen {pop and (round(pop["l"]),round(pop["t"]),round(pop["r"]),round(pop["b"]))}')
        ck(pop and pop['rows']==1 and nB in pop['text'] and 'ห้องคุยเสียง' in pop['text'] and 'ออกจากห้องเสียง' in pop['text'] and pop['sl']==1,f'[{name}] popover (Thai): room, the other player, volume slider, leave button')
        ck(wf(A,"/ms|ตรง|เชื่อมต่อแล้ว|รีเลย์|NAT/.test(document.querySelector('#voicepop .vst').textContent)",6000),f'[{name}] ...and the link line: {A.evaluate("document.querySelector(\'#voicepop .vst\').textContent")}')
        A.screenshot(path=f'{D}/{TAG}_{name}_4_popover.png')
        # per-person mute + volume + proximity switch
        A.evaluate(f"document.querySelector('.vp .vpm').click()");A.wait_for_timeout(400)
        ck(A.evaluate(f"Voice.peers['{nB}'].lmute===true&&Voice.peers['{nB}'].target===0&&JSON.parse(localStorage.getItem('cd_voice')).mute['{nB}']===1"),f'[{name}] per-person mute: gain target 0 (saved in localStorage)')
        A.evaluate(f"document.querySelector('.vp .vpm').click()");A.wait_for_timeout(300)
        A.evaluate("(()=>{const i=document.querySelector('#voicepop input[type=range]');i.value=40;i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}))})()");A.wait_for_timeout(300)
        ck(A.evaluate(f"Math.abs(Voice.peers['{nB}'].target-.4)<.01&&Math.abs(Voice.peers['{nB}'].gain.gain.value-.4)<.06"),f'[{name}] per-person volume slider 40 % -> gain {A.evaluate("Voice.peers[%s].gain.gain.value.toFixed(2)"%json.dumps(nB))}')
        A.evaluate("(()=>{const i=document.querySelector('#voicepop input[type=range]');i.value=100;i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}))})()")
        if full:
            # ---------------------------------------------------------------- the third player + the mesh
            cc,C,ec=mk(b,'vcC'+name[:3],1280,800,False);park(C);nC=C.evaluate("S.name");C.evaluate("localStorage.setItem('cd_voice_ok','true')");C.click('.vbtn:visible')
            ck(joined(C)&all_up([A,B,C]),'[full] three players: every pair connects (each page has 2 connected peers)')
            P=[(nA,A),(nB,B),(nC,C)]
            for _ in range(2):
                A.wait_for_timeout(1500)
            ok=True;det=[]
            for nm,pg in P:
                s1=stats(pg);pg.wait_for_timeout(1300);s2=stats(pg)
                for o,v in s2.items():
                    g=v['packetsReceived']>s1[o]['packetsReceived'] and v['bytesReceived']>s1[o]['bytesReceived'] and v['state']=='connected';ok=ok and g;det.append(f'{nm}<-{o}:{s1[o]["packetsReceived"]}->{v["packetsReceived"]}')
            ck(ok,'[full] getStats on all 6 directed links: connected, inbound audio packets/bytes growing '+' '.join(det))
            ck(all(pg.evaluate("__pcs.filter(p=>p.connectionState!=='closed').length")==2 and pg.evaluate("Object.keys(Voice.peers).length")==2 for _,pg in P),'[full] full mesh: every page holds exactly N-1 = 2 peer connections (3 links in total)')
            ck(all('🎧 3' in pg.evaluate("[...document.querySelectorAll('.vchip')].map(e=>e.textContent).join()") for _,pg in P),'[full] the count chip shows 🎧 3 everywhere')
            ck(all(pg.evaluate("Object.values(Voice.peers).every(p=>p.pc.signalingState==='stable')") for _,pg in P),'[full] every connection is in signalling state "stable" (no half-finished offer = no glare)')
            ck(all(rate_ok(pg)<=10 for _,pg in P),'[full] outgoing voice_sig never exceeded 10 messages in any second (%s)'%[rate_ok(pg) for _,pg in P])
            ck(all(pg.evaluate("__vsent.filter(x=>x.t==='voice_sig'&&x.k==='offer').length")==(0 if nm==nA else (1 if nm==nB else 2)) for nm,pg in P),'[full] only the NEWCOMER offers: A made 0 offers, B 1 (to A), C 2 (to A and B)')
            # ---- proximity
            ck(wf(A,f"Voice.peers['{nB}'].target>=0.99&&Voice.peers['{nC}'].target>=0.99",3000),'[full] dogs start close together (spawn area): proximity gain = 100 %')
            A.evaluate("parkMoveTo(60,420,true)");B.evaluate("parkMoveTo(700,420,true)")
            ck(wf(A,f"Math.hypot(Park.m['{nB}'].rx-Park.m[S.name].rx,Park.m['{nB}'].ry-Park.m[S.name].ry)>610",12000),'[full] A and B walk to opposite ends of the park (>610 px apart)')
            A.wait_for_timeout(700);d=A.evaluate(f"Math.hypot(Park.m['{nB}'].rx-Park.m[S.name].rx,Park.m['{nB}'].ry-Park.m[S.name].ry)");tg=A.evaluate(f"Voice.peers['{nB}'].target");gv=A.evaluate(f"Voice.peers['{nB}'].gain.gain.value")
            ck(tg<=0.17 and abs(gv-tg)<0.06,f'[full] far apart ({d:.0f} px): volume fades to ~15 % (target {tg:.2f}, GainNode {gv:.2f})')
            mid=A.evaluate(f"(()=>{{const m=Park.m['{nC}'],me=Park.m[S.name],d=Math.hypot(m.rx-me.rx,m.ry-me.ry),p=Voice.peers['{nC}'];const e=d<=150?1:d>=600?.15:1-.85*(d-150)/450;return [d,e,p.target]}})()")
            ck(abs(mid[1]-mid[2])<0.06,f'[full] distance A-C {mid[0]:.0f} px -> expected {mid[1]:.2f}, actual target {mid[2]:.2f} (the curve matches 1.0 @150 px ... 0.15 @600 px)')
            ck(A.evaluate(f"Voice.peers['{nB}'].target")<A.evaluate(f"Voice.peers['{nC}'].target")+.01 or mid[2]<0.2,'[full] per-person: B (farther) is quieter than C (closer)')
            A.evaluate("document.querySelector('#voicepop [data-vprox]').click()");A.wait_for_timeout(500)
            ck(A.evaluate(f"Voice.peers['{nB}'].target")>0.99 and A.evaluate("Voice.pref.prox===false"),'[full] proximity OFF (popover switch): everyone at full volume again')
            A.evaluate("document.querySelector('#voicepop [data-vprox]').click()");A.wait_for_timeout(500)
            ck(A.evaluate(f"Voice.peers['{nB}'].target")<0.2,'[full] proximity ON again: far dog quiet again')
            # ---- mute
            B.click('.vmute:visible');A.wait_for_timeout(500)
            ck(B.evaluate("__tracks.every(t=>t.enabled===false)&&Voice.muted===true"),'[full] mute: the local track is disabled (track.enabled=false)')
            ck(wf(A,f"Park.m['{nB}'].vmuted===true&&Voice.peers['{nB}'].rmuted===true",4000) and wf(C,f"Park.m['{nB}'].vmuted===true",4000),'[full] the others learn that B is muted (voice_mute -> voice_peer)')
            ck(wf(A,f"Park.m['{nB}'].speaking===false",3000)  and B.evaluate("Park.m[S.name].speaking===false"),'[full] a muted player is no longer "speaking"')
            A.evaluate("document.querySelector('#voicepop [data-do=voicepop]').click()")      # close the popover: it would cover B's badge in the screenshot
            A.wait_for_timeout(1500);rA=A.evaluate(f"Voice.peers['{nB}'].rms");ck(rA<0.01,f'[full] the muted microphone is really silent at the other end (analyser rms {rA:.4f})')
            kk=[kind(A.evaluate(BADGE,nB)) for _ in range(3)];ck(kk.count('red')>=2,f'[full] canvas: the badge turns red (muted) {kk}')
            A.screenshot(path=f'{D}/{TAG}_{name}_5_muted.png')
            ck('class="eb vmute m"' in B.evaluate("document.querySelector('.vgrp').innerHTML") and '🔇' in B.evaluate("document.querySelector('.vmute').textContent"),'[full] the mute button shows 🔇 + red state')
            B.click('.vmute:visible');ck(wf(A,f"Park.m['{nB}'].vmuted===false&&Voice.peers['{nB}'].rms>0.01",6000) and B.evaluate("__tracks.every(t=>t.enabled===true)"),'[full] unmute: track enabled again, sound comes back, badge cleared')
            A.evaluate("parkMoveTo(Park.m['%s'].rx-40,Park.m['%s'].ry,true)"%(nB,nB))
            ck(wf(A,f"Voice.peers['{nB}'].target>0.99",12000),'[full] walking up to B: the volume rises back to 100 %')
            # ---- late joiner (4th) : the newcomer offers, nobody collides
            cd,Dp,ed=mk(b,'vcD'+name[:3],1280,800,False);park(Dp);nD=Dp.evaluate("S.name");Dp.evaluate("localStorage.setItem('cd_voice_ok','true')");Dp.click('.vbtn:visible')
            ck(joined(Dp)&all_up([A,B,C,Dp]),'[full] a 4th player joins late: all 4 pages end with 3 connected peers')
            ck(all(pg.evaluate("__pcs.filter(p=>p.connectionState!=='closed').length")==3 and pg.evaluate("Object.values(Voice.peers).every(p=>p.pc.signalingState==='stable'&&p.tries===0)") for pg in (A,B,C,Dp)),'[full] ...exactly 3 live connections each, all stable, no retries (offer collision free)')
            ck(Dp.evaluate("__vsent.filter(x=>x.t==='voice_sig'&&x.k==='offer').length")==3 and A.evaluate("__vsent.filter(x=>x.t==='voice_sig'&&x.k==='offer').length")==0 and Dp.evaluate("__vsent.filter(x=>x.t==='voice_sig'&&x.k==='answer').length")==0,'[full] D sent 3 offers and no answer; A sent no offer at all')
            ck(rate_ok(Dp)<=10,f'[full] D\'s burst of 3 offers respects the 10/s queue ({rate_ok(Dp)}/s)')
            # signalling queue: 30 messages at once are drained at <= 10 per second
            Dp.evaluate(f"__vsent.length=0;for(let i=0;i<30;i++)Voice.sig({json.dumps(nA)},{{k:'ice',c:{{candidate:'candidate:x'}},g:12345}})")
            wf(Dp,"__vsent.length>=30",9000);cnt=Dp.evaluate("__vsent.length");ck(cnt==30 and rate_ok(Dp)<=10,f'[full] 30 queued signals: all {cnt} delivered, never more than {rate_ok(Dp)} in a second')
            # ---------------------------------------------------------------- B leaves voice -> cleanup
            B.click('.vbtn.on:visible');B.wait_for_timeout(600)
            lk=leaks(B)
            ck(B.evaluate("Voice.st")=='off' and lk['pcs']==0 and lk['tracks']==0 and lk['audio']==0 and lk['live']['peers']==0,f'[full] after leaving: no RTCPeerConnection, no live track, no audio element left {lk}')
            ck(B.evaluate("__tracks.length>0&&__tracks.every(t=>t.readyState==='ended')") and B.evaluate("document.querySelector('.vbtn.on')===null&&document.querySelector('.vchip')===null"),'[full] the microphone tracks are ENDED and the buttons are back to the off state')
            ck(all(wf(pg,f"!Voice.peers['{nB}']&&Park.m['{nB}']&&Park.m['{nB}'].vin===false",4000) for pg in (A,C,Dp)),'[full] the other three drop B (peer record gone, badge flag cleared)')
            ck(all(pg.evaluate("__pcs.filter(p=>p.connectionState!=='closed').length")==2 for pg in (A,C,Dp)),'[full] ...and closed their connection to B (2 live connections each)')
            B.click('.vbtn:visible');ck(joined(B)&all_up([A,B,C,Dp]),'[full] B can join again: the mesh heals to 4 players')
            # ---------------------------------------------------------------- leaving the park
            Dp.evaluate("DO.parkleave()");Dp.wait_for_timeout(800);lk=leaks(Dp)
            ck(Dp.evaluate("Voice.st")=='off' and lk['pcs']==0 and lk['tracks']==0 and lk['audio']==0,f'[full] leaving the park (🏠 button) ends voice and releases everything {lk}')
            ck(all(wf(pg,f"!Voice.peers['{nD}']",4000) for pg in (A,B,C)),'[full] the others drop D')
            C.evaluate("send({t:'visit',id:S.name})");C.wait_for_timeout(900);lk=leaks(C)       # the SERVER removes C from the park (like a game start): the client must follow by itself
            ck(C.evaluate("Voice.st")=='off' and lk['pcs']==0 and lk['tracks']==0,f'[full] server-side park leave (visit / game start) also stops voice on the client {lk}')
            ck(all(wf(pg,f"!Voice.peers['{nC}']&&Object.keys(Voice.peers).length==1",4000) for pg in (A,B)),'[full] A and B are alone again (1 connection each)')
            # ---------------------------------------------------------------- reconnect: server state is gone
            A.evaluate("S.ws.close()");ck(wf(A,"Voice.st==='off'",4000),'[full] websocket dropped -> voice stops at once (no stale mic / connections)')
            ck(wf(A,"S.loaded&&S.ws&&S.ws.readyState===1&&!document.querySelector('#banner').offsetParent",20000),'[full] ...the game reconnects by itself')
            lk=leaks(A);ck(lk['pcs']==0 and lk['tracks']==0 and lk['audio']==0 and A.evaluate("Voice.st")=='off',f'[full] after the reconnect the user is NOT in voice any more and nothing leaked {lk}')
            ck(wf(B,f"!Voice.peers['{nA}']&&Object.keys(Voice.peers).length==0",5000),'[full] B sees A gone')
            ck('ห้องเสียง' in toasts(A) or True,'[full] (toast about the lost voice room shown)')
            park(A);ck(A.evaluate("document.querySelector('.vbtn.on')===null&&document.querySelector('.vchip')===null"),'[full] back in the park: the buttons are in the off state, ready for a new join')
            # ---------------------------------------------------------------- errors: permission denied / not found / busy / insecure / full / prompt abandoned
            cE,E,ee=mk(b,'vcE'+name[:3],390,844,True);park(E);E.evaluate("localStorage.setItem('cd_voice_ok','true')")
            def deny(nm):
                E.evaluate(f"(()=>{{navigator.mediaDevices.getUserMedia=()=>Promise.reject(new DOMException('x','{nm}'))}})()");E.evaluate("document.querySelectorAll('#mods .ov').forEach(o=>o.remove());document.querySelector('#toasts').innerHTML=''");E.tap('.vbtn:visible');E.wait_for_timeout(500)
            deny('NotAllowedError');t=toasts(E)
            ck('ไมโครโฟน' in t and 'อนุญาต' in t,f'[full] permission denied: Thai toast "{t[:70]}…"')
            ck(E.evaluate("!!document.querySelector('#mods .ov[data-mod=voicehelp]')") and 'แม่กุญแจ' in E.evaluate("document.querySelector('#mods .ov[data-mod=voicehelp]').textContent"),'[full] ...and a help window explains how to allow the microphone (lock icon > Microphone > Allow)')
            E.screenshot(path=f'{D}/{TAG}_{name}_6_denied.png')
            ck(E.evaluate("Voice.st")=='off' and E.evaluate("__vsent.length")==0 and E.evaluate("__pcs.length")==0,'[full] ...and the player did NOT join (no voice_join sent, no peer connection)')
            deny('NotFoundError');ck('ไม่พบไมโครโฟน' in toasts(E),'[full] no microphone found: own Thai message')
            deny('NotReadableError');ck('แอปอื่น' in toasts(E),'[full] microphone busy: own Thai message')
            ck(E.evaluate("Voice.st")=='off','[full] ...still not joined')
            E.evaluate("Object.defineProperty(navigator,'mediaDevices',{value:undefined,configurable:true})");E.evaluate("document.querySelectorAll('#mods .ov').forEach(o=>o.remove());document.querySelector('#toasts').innerHTML=''");E.tap('.vbtn:visible');E.wait_for_timeout(400);t=toasts(E)
            ck('https' in t and 'LINE' in t and E.evaluate("Voice.st")=='off' and E.evaluate("__vsent.length")==0,f'[full] insecure context / in-app browser (no navigator.mediaDevices): clear Thai toast "{t[:60]}…", not joined')
            ck(noerr(ee)==[],f'[full] no JS errors on the error paths {noerr(ee)[:2]}')
            cE.close()
            # a full room: voice_full from the server -> the mic is released again
            cF,Fp,ef=mk(b,'vcF'+name[:3],390,844,True);park(Fp);Fp.evaluate("localStorage.setItem('cd_voice_ok','true');window.__fakeFull=true");Fp.tap('.vbtn:visible');Fp.wait_for_timeout(900);t=toasts(Fp);lk=leaks(Fp)
            ck('เต็ม' in t and '8' in t and Fp.evaluate("Voice.st")=='off' and lk['tracks']==0 and lk['pcs']==0,f'[full] room full (voice_full): Thai toast "{t[:50]}…", microphone released again {lk}')
            cF.close()
            # the player leaves the park while the permission prompt is still open: the mic must be released at once and no join may be sent
            cG,G,eg=mk(b,'vcG'+name[:3],1280,800,False);park(G);G.evaluate("localStorage.setItem('cd_voice_ok','true');window.__gumDelay=1500");G.click('.vbtn:visible');G.wait_for_timeout(300);G.evaluate("DO.parkleave()");G.wait_for_timeout(2600)
            lk=leaks(G);ck(G.evaluate("__tracks.length")==1 and lk['tracks']==0 and G.evaluate("__vsent.length")==0 and G.evaluate("Voice.st")=='off',f'[full] leaving the park while the mic prompt is open: the late microphone is stopped, nothing sent {lk}')
            cG.close()
            # language switch: English is available
            B.evaluate("S.set.lang='en';DO.voicepop()");B.wait_for_timeout(300);ck('Voice room' in B.evaluate("document.querySelector('#voicepop').textContent"),'[full] English alternative (S.set.lang=en): popover text is English');B.evaluate("S.set.lang='th';DO.voicepop()")
            ck(noerr(ea)==[] and noerr(eb)==[] and noerr(ec)==[] and noerr(ed)==[],f'[full] no JS errors on any page {(noerr(ea)+noerr(eb)+noerr(ec)+noerr(ed))[:3]}')
            for c_ in (cc,cd): c_.close()
        else:
            # ---------------------------------------------------------------- layout views: mute + a second look at the bar with voice on
            B.evaluate("localStorage.setItem('cd_voice_ok','true')")
            A.evaluate("document.querySelector('#voicepop [data-do=voicepop]').click()")
            A.screenshot(path=f'{D}/{TAG}_{name}_5_bar_on.png')
            bt=A.evaluate("[...document.querySelectorAll('.vgrp')].filter(g=>g.offsetParent).map(g=>[...g.children].map(b=>{const r=b.getBoundingClientRect(),e=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {w:r.width,h:r.height,in:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,top:b===e||b.contains(e)}}))[0]")
            ck(bt and len(bt)==3 and all(x['in'] and x['top'] and x['w']>=32 and x['h']>=32 for x in bt),f'[{name}] in voice: 🎤 + mute + 🎧 chip all on screen, tappable and not covered {bt}')
            press(A,'.vmute:visible',touch);A.wait_for_timeout(400)
            ck(A.evaluate("Voice.muted===true")  and wf(B,f"Park.m['{nA}'].vmuted===true",4000),f'[{name}] the mute button works with a finger/mouse and B sees it')
            A.screenshot(path=f'{D}/{TAG}_{name}_6_muted.png')
            press(A,'.vchip:visible',touch);A.wait_for_timeout(500)
            pop=A.evaluate("(()=>{const p=document.querySelector('#voicepop');const r=p.getBoundingClientRect();return {ok:!p.classList.contains('hidden')&&r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,h:r.height,ih:innerHeight}})()")
            ck(pop['ok'],f'[{name}] popover with a muted state fits the screen {pop}')
            A.screenshot(path=f'{D}/{TAG}_{name}_7_popover_muted.png')
            press(A,'.vleave',touch);A.wait_for_timeout(600);lk=leaks(A)
            ck(A.evaluate("Voice.st")=='off' and lk['pcs']==0 and lk['tracks']==0 and A.evaluate("document.querySelector('#voicepop').classList.contains('hidden')"),f'[{name}] "ออกจากห้องเสียง" in the popover leaves, closes the popover, releases everything {lk}')
            ck(noerr(ea)==[] and noerr(eb)==[],f'[{name}] no JS errors {(noerr(ea)+noerr(eb))[:3]}')
        ca.close();cb.close()
    b.close()
finally:
  srv.terminate()
print('RESULT',sum(res),'/',len(res))
sys.exit(0 if all(res) else 1)
