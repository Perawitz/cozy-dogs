// Minimal dependency-free WebSocket server (RFC 6455, text frames) - used automatically when the `ws` package is not installed.
const crypto=require('crypto'),{EventEmitter}=require('events');
const GUID='258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
class Sock extends EventEmitter{
  constructor(socket,max,head){super();this.s=socket;this.readyState=1;this.max=max;this.buf=head&&head.length?Buffer.from(head):Buffer.alloc(0);this.frag=null;
    socket.on('data',d=>{this.buf=Buffer.concat([this.buf,d]);try{this._parse()}catch{this._close()}});
    socket.on('close',()=>this._gone());socket.on('error',()=>this._gone());if(this.buf.length)this._parse()}
  _gone(){if(this.readyState==3)return;this.readyState=3;this.emit('close')}
  _frame(op,p){if(this.s.destroyed)return;const n=p.length,h=n<126?Buffer.from([128|op,n]):n<65536?Buffer.from([128|op,126,n>>8,n&255]):(()=>{const b=Buffer.alloc(10);b[0]=128|op;b[1]=127;b.writeBigUInt64BE(BigInt(n),2);return b})();this.s.write(Buffer.concat([h,p]))}
  send(d){if(this.readyState!=1)return;this._frame(1,Buffer.from(String(d)))}
  close(){this._close()}
  _close(){if(this.readyState!=1)return;this.readyState=2;try{this._frame(8,Buffer.alloc(0));this.s.end()}catch{}setTimeout(()=>this.s.destroy(),500).unref()}
  _parse(){
    while(this.readyState==1){const b=this.buf;if(b.length<2)return;
      const fin=b[0]&128,op=b[0]&15,masked=b[1]&128;let len=b[1]&127,off=2;
      if(len==126){if(b.length<4)return;len=b.readUInt16BE(2);off=4}else if(len==127){if(b.length<10)return;len=Number(b.readBigUInt64BE(2));off=10}
      if(len>this.max||(op>=8&&(len>125||!fin)))return this._close();      // oversize frame / illegal control frame
      const need=off+(masked?4:0)+len;if(b.length<need)return;
      let p=b.subarray(off+(masked?4:0),need);if(masked){const k=b.subarray(off,off+4);p=Buffer.from(p);for(let i=0;i<p.length;i++)p[i]^=k[i&3]}
      this.buf=b.subarray(need);
      if(op==8)return this._close();if(op==9){this._frame(10,p);continue}if(op==10)continue;
      if(op==1||op==2){this.frag=[p];this.fop=op;this.fl=p.length}else if(op==0&&this.frag){this.frag.push(p);this.fl+=p.length;if(this.fl>this.max)return this._close()}
      if(fin&&this.frag){const m=Buffer.concat(this.frag);this.frag=null;try{this.emit('message',this.fop==1?m.toString():m)}catch(e){console.error('[ws message]',e&&e.stack||e)}}
    }}
}
class WebSocketServer extends EventEmitter{
  constructor({server,maxPayload=1<<20}){super();
    server.on('upgrade',(req,socket,head)=>{const key=req.headers['sec-websocket-key'];
      if(!key||String(req.headers.upgrade).toLowerCase()!='websocket'){socket.destroy();return}
      socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+crypto.createHash('sha1').update(key+GUID).digest('base64')+'\r\n\r\n');
      socket.setNoDelay(true);this.emit('connection',new Sock(socket,maxPayload,head),req)})}
}
module.exports={WebSocketServer};
