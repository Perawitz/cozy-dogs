// Cozy Dogs v7.2 - cute dog barks (made with the Web Audio API, no sound files): a "woof woof" to say hello, a happy "yip!" when petted, a tiny squeak for a newborn.
// Small dogs sound higher than big ones, puppies higher than adults, and every bark is a little bit different.  Setting: "Dog sounds" (S.set.barks); the general sound switch also mutes it.
// Bark.say(kind, dog, force)  kind = 'woof' | 'yip' | 'happy' | 'pup'     Bark.greet()  = one of the dogs in this room says hello
(function(){
const Bk={last:0,per:{},home:'',homeAt:0};
const rnd=(a,b)=>a+Math.random()*(b-a);
// pitch of a dog: smaller = higher, younger = higher  (size is 0.7 .. 1.3 in the breed table, composite/mixed dogs average it)
function pitchOf(d){let size=1,stage=3;try{const b=d&&(DOGS.b(d)||DOGS.BR&&DOGS.BR[d.breed]);if(b&&b.size)size=b.size}catch(e){}
 try{if(d&&d.born&&typeof TRD!='undefined')stage=TRD.stageOf(d.born,Date.now()+(S.skew||0),S.gk||1)}catch(e){}
 return 300/Math.min(1.4,Math.max(.6,size))*[2,1.55,1.2,1][Math.max(0,Math.min(3,stage|0))]*rnd(.96,1.05)}
// one syllable: a saw wave whose pitch dips, run through two "mouth" filters (formants), plus a puff of breath
function syl(f0,len,vol,when,o){const a=actx();if(!a)return;o=o||{};const t0=a.currentTime+when,rise=o.rise||0;
 const osc=a.createOscillator(),osc2=a.createOscillator(),mix=a.createGain(),env=a.createGain(),fa=a.createBiquadFilter(),fb=a.createBiquadFilter();
 osc.type='sawtooth';osc2.type='square';
 const p=(k,t)=>Math.max(60,f0*k);const up=rise>0;
 // woof: starts high, falls.  yip: starts low, rises quickly then drops a little
 osc.frequency.setValueAtTime(p(up?.8:1.22),t0);osc.frequency.exponentialRampToValueAtTime(p(up?1.25:1),t0+len*.3);osc.frequency.exponentialRampToValueAtTime(p(up?1.05:.72),t0+len);
 osc2.frequency.setValueAtTime(p((up?.8:1.22)*.5),t0);osc2.frequency.exponentialRampToValueAtTime(p((up?1.25:1)*.5),t0+len*.3);osc2.frequency.exponentialRampToValueAtTime(p((up?1.05:.72)*.5),t0+len);
 fa.type='bandpass';fa.frequency.value=(o.f1||720)*(up?1.15:1);fa.Q.value=4.5;fb.type='bandpass';fb.frequency.value=(o.f2||1750)*(up?1.2:1);fb.Q.value=6;
 const g2=a.createGain();g2.gain.value=.35;osc.connect(mix);osc2.connect(g2);g2.connect(mix);mix.connect(fa);mix.connect(fb);
 const out=a.createGain();out.gain.value=1;fa.connect(out);fb.connect(out);out.connect(env);
 env.gain.setValueAtTime(0,t0);env.gain.linearRampToValueAtTime(vol,t0+.012);env.gain.setValueAtTime(vol*.8,t0+len*.4);env.gain.exponentialRampToValueAtTime(.001,t0+len+.04);
 env.connect(AU.sfx);osc.start(t0);osc2.start(t0);osc.stop(t0+len+.08);osc2.stop(t0+len+.08);
 noise(.05,vol*.18,when,2600)}
const KINDS={
 woof:f=>{syl(f,.17,.22,0);syl(f*1.07,.19,.24,.23)},                       // hello: "wuf wuf"
 yip:f=>{syl(f*1.7,.1,.17,0,{rise:1,f1:900,f2:2300})},                      // happy: one bright "yip!"
 happy:f=>{syl(f*1.6,.09,.16,0,{rise:1,f1:900,f2:2300});syl(f*1.8,.09,.16,.14,{rise:1,f1:900,f2:2300});syl(f*1.15,.2,.22,.3)},   // very happy: "yip yip wuf!"
 pup:f=>{syl(f*1.5,.07,.13,0,{rise:1,f1:1000,f2:2600});syl(f*1.7,.08,.13,.1,{rise:1,f1:1000,f2:2600})}};        // newborn squeak
const BUB={woof:['Woof woof!','โฮ่ง โฮ่ง!'],yip:['Yip!','ยิ๊บ!'],happy:['Yip yip woof!','ยิ๊บ ยิ๊บ โฮ่ง!'],pup:['Yip yip~','แงะ ๆ~']};
Bk.say=function(kind,d,force){try{
  if(S.set.barks===false||!S.set.sound||!KINDS[kind])return false;
  const now=performance.now(),id=d&&d.id||'x';
  if(!force&&(now-Bk.last<650||now-(Bk.per[id]||0)<3500))return false;      // never a barking storm: one sound at a time, one dog every 3.5 s
  Bk.last=now;Bk.per[id]=now;KINDS[kind](pitchOf(d));
  // a little speech bubble above the dog (also helps when the phone is on silent)
  try{if(d&&d._pos&&S.set.particles!==false){const[x,y,L]=d._pos,w=BUB[kind];floatText(x,y-L-(d._top||0)-22,TT(w[0],w[1]),'#fff4c2')}}catch(e){}
  return true}catch(e){return false}};
Bk.maybe=(kind,d,chance)=>Math.random()<chance&&Bk.say(kind,d);
Bk.greet=function(){const l=Object.values(S.dogs||{});if(!l.length)return;Bk.say('woof',l[Math.floor(Math.random()*l.length)],true)};
// say hello when the player arrives in a house (own home, a friend's house, or back from the park): one of the dogs there barks
setInterval(()=>{try{if(S.scr!='game'||!S.loaded||Park.on||(typeof MP!='undefined'&&MP.g))return;const key=String(S.owner);
  if(key!==Bk.home){Bk.home=key;Bk.homeAt=performance.now()}
  else if(Bk.homeAt&&performance.now()-Bk.homeAt>900&&Object.keys(S.dogs||{}).length){Bk.homeAt=0;Bk.greet()}}catch(e){}},400);
Object.assign(TH,{'Dog sounds':'เสียงน้องหมา'});
window.Bark=Bk;
// the old generic "bark" sound effect (play with a dog, park pose) is now the cute one
SFX.bark=()=>{Bk.say('woof',null,true)};
})();
