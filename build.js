// Build: concatenates src/* into public/index.html (single self-contained file)
const fs=require('fs'),path=require('path');
const R=f=>fs.readFileSync(path.join(__dirname,f),'utf8');
const C=require('./catalog'),B=require('./breeds').concat(require('./premium'));
const cat={items:C.ITEMS,food:C.FOOD,acc:C.ACC,walls:C.WALLS,floors:C.FLOORS,lights:C.LIGHTS,tricks:C.TRICKS};
const data='const EMBED='+JSON.stringify({breeds:B,cat,def:C.DEFAULT_ITEMS})+';';
const avd='(function(){const module={exports:{}};'+R('avatar_data.js')+';window.AVD=module.exports})();';
const trd='(function(){const module={exports:{}};'+R('traits.js')+';window.TRD=module.exports})();';
const brd='(function(){const module={exports:{}};'+R('brawl_data.js')+';window.BRD=module.exports})();';       // the fighting rules/stats: the same file the server uses
const opt=l=>l.filter(f=>fs.existsSync(path.join(__dirname,f)));
const parts=[data,avd,brd,trd,R('avatarpix.js'),R('dogpix.js'),R('src/dogs.js'),R('src/items.js'),R('src/room.js'),R('src/core.js'),R('src/world.js'),R('src/ui.js'),R('src/modals.js'),R('src/games.js'),R('src/parkart.js'),R('src/park.js'),R('src/social.js'),R('src/th5.js'),R('src/th6.js'),...opt(['src/th7.js']).map(R),R('src/fun.js'),R('src/games2.js'),R('src/brawl.js'),R('src/avatar.js'),R('src/wardrobe.js'),R('src/main.js'),R('src/google.js'),R('src/chat.js'),R('src/voice.js'),...opt(['src/egg.js','src/dogv7.js','src/nursery.js','src/petshop.js','src/show.js','src/announce.js','src/menu.js','src/bark.js']).map(R)];   // v7 feature files (each may be missing while a feature is being developed)
let js=parts.join('\n;\n').replace(/<\/script/gi,'<\\/script');
try{new (require('vm').Script)(js,{filename:'client-bundle.js'})}catch(e){console.error('SYNTAX ERROR in the client bundle:',e.message);process.exit(1)}   // never ship a page whose script does not even parse
const css=opt(['src/ui.css','src/chat.css','src/voice.css','src/egg.css','src/dogv7.css','src/nursery.css','src/petshop.css','src/show.css','src/announce.css','src/menu.css']).map(R).join('\n');   // one stylesheet per feature area, all inlined
let html=R('src/index.tpl.html').replace('/*@CSS*/',()=>css).replace('/*@JS*/',()=>js);
fs.mkdirSync(path.join(__dirname,'public'),{recursive:true});
fs.writeFileSync(path.join(__dirname,'public','index.html'),html);
console.log('built public/index.html',(html.length/1024).toFixed(0)+'KB');
