// Build: concatenates src/* into public/index.html (single self-contained file)
const fs=require('fs'),path=require('path');
const R=f=>fs.readFileSync(path.join(__dirname,f),'utf8');
const C=require('./catalog'),B=require('./breeds');
const cat={items:C.ITEMS,food:C.FOOD,acc:C.ACC,walls:C.WALLS,floors:C.FLOORS,lights:C.LIGHTS,tricks:C.TRICKS};
const data='const EMBED='+JSON.stringify({breeds:B,cat,def:C.DEFAULT_ITEMS})+';';
const avd='(function(){const module={exports:{}};'+R('avatar_data.js')+';window.AVD=module.exports})();';
const parts=[data,avd,R('avatarpix.js'),R('dogpix.js'),R('src/dogs.js'),R('src/items.js'),R('src/room.js'),R('src/core.js'),R('src/world.js'),R('src/ui.js'),R('src/modals.js'),R('src/games.js'),R('src/parkart.js'),R('src/park.js'),R('src/social.js'),R('src/th5.js'),R('src/th6.js'),R('src/fun.js'),R('src/games2.js'),R('src/avatar.js'),R('src/wardrobe.js'),R('src/main.js')];
let js=parts.join('\n;\n').replace(/<\/script/gi,'<\\/script');
try{new (require('vm').Script)(js,{filename:'client-bundle.js'})}catch(e){console.error('SYNTAX ERROR in the client bundle:',e.message);process.exit(1)}   // never ship a page whose script does not even parse
let html=R('src/index.tpl.html').replace('/*@CSS*/',()=>R('src/ui.css')).replace('/*@JS*/',()=>js);
fs.mkdirSync(path.join(__dirname,'public'),{recursive:true});
fs.writeFileSync(path.join(__dirname,'public','index.html'),html);
console.log('built public/index.html',(html.length/1024).toFixed(0)+'KB');
