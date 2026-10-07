// `npm test`: starts throw-away servers (temp data files, ports 3055/3056) and runs every test file against them.
const {spawn}=require('child_process'),os=require('os'),path=require('path'),fs=require('fs');
const PORT=process.env.PORT||'3055',PORT2=String(+PORT+1),PORT3=String(+PORT+2),tmp=n=>path.join(os.tmpdir(),'cozydogs_'+n+'_'+process.pid+'.json');
const mk=(port,extra)=>spawn(process.execPath,[path.join(__dirname,'server.js')],{env:{...process.env,PORT:port,DATA:tmp(port),CD_GOAL:'pet',...extra},stdio:['ignore','pipe','inherit']});
const run=(f,port)=>new Promise(r=>{const p=spawn(process.execPath,[path.join(__dirname,f)],{env:{...process.env,PORT:port,PORT2,PORTP:PORT3},stdio:'inherit'});p.on('exit',c=>r(c))});
const s1=mk(PORT,{CD_TEST:'1',CD_WISH:'1',CD_MPWAIT:'1200',CD_BRFAST:'4'}),s2=mk(PORT2,{CD_RATE:'2000',CD_MPWAIT:'1200',CD_BRFAST:'4'}),s3=mk(PORT3,{TRUST_PROXY_HOPS:'2'});      // s3: behaves as if it sat behind a reverse proxy (per-client rate limits from X-Forwarded-For)
setTimeout(async()=>{let bad=0;
 {// static check: two files in src/ that define the same DO.xxx / H.xxx handler silently replace each other (the later file wins). A new Google button named "gstart" once disabled EVERY mini game that way.
  // The few deliberate overrides are listed here; anything else is reported.
  const ALLOW=new Set(['games','help','closemod','H.mp_gone','H.mp_end']),seen={},dir=path.join(__dirname,'src'),dup=[];
  for(const f of fs.readdirSync(dir).filter(x=>x.endsWith('.js')).sort())fs.readFileSync(path.join(dir,f),'utf8').split('\n').forEach((l,i)=>{for(const m of l.matchAll(/\b(DO|H)\.([A-Za-z_]\w*)\s*=(?!=)/g)){const k=(m[1]=='H'?'H.':'')+m[2];(seen[k]=seen[k]||[]).push(f+':'+(i+1))}});
  for(const [k,v] of Object.entries(seen))if(v.length>1&&!ALLOW.has(k))dup.push(k+' ('+v.join(', ')+')');
  console.log(dup.length?'FAIL duplicate client handlers: '+dup.join('; '):'PASS no accidental duplicate DO./H. handlers in src/ ('+Object.keys(seen).length+' handlers)');if(dup.length)bad++}
 for(const f of ['server_test.js','server_test2.js','server_test3.js','server_test4.js','server_test5.js','server_test6.js','server_test7.js','server_test8.js','server_test9.js','server_test10.js','server_test11.js','server_test12.js','server_test13.js','server_test14.js','server_test15.js','server_test16.js','server_test_chat.js','server_test_voice.js'])if(await run(f,PORT))bad++;
 if(await run('brawl_test.js',PORT))bad++;      // pure rules tests, no server needed
 if(await run('fuzz_test.js',PORT2))bad++;
 s1.kill();s2.kill();s3.kill();for(const p of [PORT,PORT2,PORT3])try{fs.unlinkSync(tmp(p))}catch{}process.exit(bad?1:0)},1000);
