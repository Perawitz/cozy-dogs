// `npm test`: starts throw-away servers (temp data files, ports 3055/3056) and runs every test file against them.
const {spawn}=require('child_process'),os=require('os'),path=require('path'),fs=require('fs');
const PORT=process.env.PORT||'3055',PORT2=String(+PORT+1),PORT3=String(+PORT+2),tmp=n=>path.join(os.tmpdir(),'cozydogs_'+n+'_'+process.pid+'.json');
const mk=(port,extra)=>spawn(process.execPath,[path.join(__dirname,'server.js')],{env:{...process.env,PORT:port,DATA:tmp(port),CD_GOAL:'pet',...extra},stdio:['ignore','pipe','inherit']});
const run=(f,port)=>new Promise(r=>{const p=spawn(process.execPath,[path.join(__dirname,f)],{env:{...process.env,PORT:port,PORT2,PORTP:PORT3},stdio:'inherit'});p.on('exit',c=>r(c))});
const s1=mk(PORT,{CD_TEST:'1',CD_WISH:'1',CD_MPWAIT:'1200',CD_BRFAST:'4'}),s2=mk(PORT2,{CD_RATE:'2000',CD_MPWAIT:'1200',CD_BRFAST:'4'}),s3=mk(PORT3,{TRUST_PROXY_HOPS:'2'});      // s3: behaves as if it sat behind a reverse proxy (per-client rate limits from X-Forwarded-For)
setTimeout(async()=>{let bad=0;
 for(const f of ['server_test.js','server_test2.js','server_test3.js','server_test4.js','server_test5.js','server_test6.js','server_test7.js','server_test8.js','server_test9.js'])if(await run(f,PORT))bad++;
 if(await run('brawl_test.js',PORT))bad++;      // pure rules tests, no server needed
 if(await run('fuzz_test.js',PORT2))bad++;
 s1.kill();s2.kill();s3.kill();for(const p of [PORT,PORT2,PORT3])try{fs.unlinkSync(tmp(p))}catch{}process.exit(bad?1:0)},1000);
