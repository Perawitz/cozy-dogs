# Runs every browser test in this folder one after another (each starts its own throw-away server) and prints a summary.  
#   python3 browser_tests/run_all.py            (from the project root; takes about 35-40 minutes since v7)
#   python3 browser_tests/run_all.py chat rps   (only the ones you name)
# Needs: pip install playwright && playwright install chromium
import os,subprocess,sys,time
HERE=os.path.dirname(os.path.abspath(__file__));ROOT=os.path.dirname(HERE)
PORT=int(os.environ.get('PORT0','3300'))
TESTS=[  # (name, script, extra args after <repo> <tag> <port>)
 ('smoke','smoke.py',['desk,portrait,land']),
 ('decor','decor.py',[]),
 ('chat','chat.py',['portrait,land,desk']),
 ('capsule','capsule.py',[]),
 ('race','race.py',[]),
 ('rps','rps.py',['desk,portrait,land']),
 ('brawl','brawl.py',['4','desk,portrait,land']),
 ('brawl_syn','brawl_syn.py',['desk,portrait,land']),
 ('brawl_leave','brawl_leave.py',['desk,portrait']),
 ('recovery','recovery.py',['desk,portrait,land,tiny']),
 ('thai_canvas','thai_canvas.py',[]),
 ('reconnect','reconnect.py',[]),
 ('mobile_layout','mobile_layout.py',[]),
 ('google','google.py',['desk,portrait,land,tiny']),
 ('dm','dm.py',['desk,portrait,land']),            # v7: private chat
 ('voice','voice.py',['desk,portrait,land']),     # v7: park voice chat (fake microphone)
 ('nursery','nursery.py',['desk,portrait,land']),   # v7: eggs + breeding
 ('petshop','petshop.py',['desk,portrait,land']),   # v7: pet shop + player market
 ('show','show.py',['desk,portrait,land']),         # v7: hourly dog show
 ('announce','announce.py',['desk,portrait,land']), # v7.1: paid server-wide announcements
 ('menu','menu.py',['desk,portrait,land,tiny']),     # v7.2: slim dock + Menu window + what's new tour + dog barks
]
want=set(sys.argv[1:]);out=[];t00=time.time()
for i,(name,script,extra) in enumerate(TESTS):
    if want and name not in want: continue
    t0=time.time();print(f'\n=== {name} ===',flush=True)
    cmd=[sys.executable,os.path.join(HERE,script),ROOT,'ra'+str(i),str(PORT+i)]+extra
    r=subprocess.run(cmd,cwd=ROOT,capture_output=True,text=True)
    lines=(r.stdout or '').strip().splitlines()
    for l in lines:
        if l.startswith('FAIL') or l.startswith('RESULT'): print(l)
    if r.returncode and not any(l.startswith('RESULT') for l in lines): print((r.stderr or '')[-600:])
    out.append((name,r.returncode==0,time.time()-t0))
print('\n=== summary ===')
for n,ok,t in out: print(('PASS' if ok else 'FAIL'),n,'(%.0fs)'%t)
print('total %.0fs'%(time.time()-t00))
sys.exit(0 if all(ok for _,ok,_ in out) else 1)
