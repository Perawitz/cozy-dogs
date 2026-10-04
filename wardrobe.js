// Cozy Dogs - wardrobe (human avatar). Server-authoritative:
//   p.av     the owner's current look (validated against avatar_data.js, unknown / out-of-range values can never be stored)
//   p.avOwn  premium pieces already bought with coins, e.g. "h:braid", "ht:crown"  (free pieces need no record)
// A look may only use free pieces or pieces in p.avOwn; saving a look that contains new premium pieces buys them atomically (all or nothing).
'use strict';
const AVD=require('./avatar_data');
module.exports=function(X){
 const {conns,send,player,sendMe,toView,dirty,bump,S}=X;
 const lastSave=new WeakMap();
 const premiumKeys=()=>{const l=[];for(const k in AVD.KINDS)for(const it of AVD.KINDS[k])if(it.p)l.push(k+':'+it.id);return l};
 const VALID=new Set(premiumKeys());
 // clean an owned list: only real premium keys, no duplicates
 const cleanOwn=a=>[...new Set((Array.isArray(a)?a:[]).filter(k=>typeof k=='string'&&VALID.has(k)))];
 const checked=new WeakSet();
 // called from player(): makes sure every account has a valid look + owned list (cheap, once per player object)
 function ensure(p,name){
  if(checked.has(p))return;checked.add(p);
  const had=!!p.av;p.av=AVD.clean(p.av,null,name).av;p.avOwn=cleanOwn(p.avOwn);
  // a look may never use a premium piece that is not owned (e.g. hand-edited data) -> fall back to the free default for that slot
  const base=AVD.defaults(name),ow=new Set(p.avOwn);
  for(const key of AVD.used(p.av)){if(!ow.has(key)){const k=key.split(':')[0];p.av[k]=base[k]}}
  if(!had)dirty();
 }
 const pubAv=p=>p.av;
 function save(ws,c,m){
  const now=Date.now();if(now-(lastSave.get(ws)||0)<350)return true;lastSave.set(ws,now);
  const p=player(c.name);ensure(p,c.name);
  if(!m.av||typeof m.av!=='object'||Array.isArray(m.av)){send(ws,{t:'av_err',code:'bad'});return true}
  const res=AVD.clean(m.av,p.av,c.name),next=res.av,pr=AVD.price(next,p.avOwn);
  if(pr.cost>p.coins){send(ws,{t:'av_err',code:'coins',cost:pr.cost,coins:p.coins});return true}
  const same=JSON.stringify(next)===JSON.stringify(p.av);
  if(pr.cost>0){p.coins-=pr.cost;p.avOwn=cleanOwn([...p.avOwn,...pr.need])}
  p.av=next;dirty();
  if(!same||pr.cost>0)bump(c.name,'avsave',1,ws);
  send(ws,{t:'av_ok',av:p.av,own:p.avOwn,cost:pr.cost,bought:pr.need,same});
  sendMe(ws);
  // everyone who is looking at this house, and everyone in the park, sees the new look right away
  toView(c.name,{t:'av_upd',n:c.name,av:p.av});
  if(S&&S.avChanged)S.avChanged(ws,c.name,p.av);
  return true;
 }
 function handle(ws,c,m){
  if(m.t==='av_save')return save(ws,c,m);
  if(m.t==='av_get'){const p=player(c.name);ensure(p,c.name);send(ws,{t:'av_ok',av:p.av,own:p.avOwn,cost:0,bought:[],same:true,get:1});return true}
  return false;
 }
 return{handle,ensure,pubAv,cleanOwn};
};
