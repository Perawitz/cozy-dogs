// A tiny stand-in for Google, used only by google.py (tests cannot reach the real Google).
//   GET /certs  -> the public key, the same way Google serves it (the game server downloads it and checks every token with it)
//   GET /mint?sub=..&email=..&aud=..&name=..  -> a freshly SIGNED test ID token (RS256), just like the one Google's button would give the page
// usage: node google_stub.js <port> <client-id>
'use strict';
const http=require('http'),crypto=require('crypto');
const PORT=+process.argv[2],CID=process.argv[3];
const kp=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
const jwk=Object.assign(kp.publicKey.export({format:'jwk'}),{kid:'k1',alg:'RS256',use:'sig'});
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
http.createServer((q,r)=>{
  const u=new URL(q.url,'http://x'),g=k=>u.searchParams.get(k);
  if(u.pathname=='/certs'){r.writeHead(200,{'Content-Type':'application/json','Cache-Control':'public, max-age=3600'});return r.end(JSON.stringify({keys:[jwk]}))}
  if(u.pathname=='/mint'){
    const now=Math.floor(Date.now()/1000);
    const pl={iss:'https://accounts.google.com',aud:g('aud')||CID,sub:g('sub')||'1',email:g('email')||'kid@example.com',email_verified:true,name:g('name')||'Test Kid',iat:now-10,exp:now+3000};
    const data=b64({alg:'RS256',typ:'JWT',kid:'k1'})+'.'+b64(pl);
    r.writeHead(200,{'Content-Type':'text/plain'});return r.end(data+'.'+crypto.sign('RSA-SHA256',Buffer.from(data),kp.privateKey).toString('base64url'))}
  r.writeHead(404);r.end()
}).listen(PORT,'127.0.0.1',()=>console.log('ready'));
