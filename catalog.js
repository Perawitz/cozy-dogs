// Shared game data: items, food, accessories, wallpapers, tricks... (server is authoritative; sent to client in 'welcome')
const I={};
const add=(id,n,cat,p,draw,o={})=>{I[id]=Object.assign({id,n,cat,p,draw,kind:'floor'},o)};
// ---- toys (dogs walk to them and play)
add('ball','Tennis Ball','toy',30,'ball',{role:'play',fav:'ball'});
add('frisbee','Frisbee','toy',40,'frisbee',{role:'play',fav:'frisbee'});
add('rope','Rope Toy','toy',35,'rope',{role:'play',fav:'rope'});
add('duck','Rubber Duck','toy',45,'duck',{role:'play',fav:'duck'});
add('teddy','Teddy Bear','toy',60,'teddy',{role:'play',fav:'teddy'});
add('squeaky','Squeaky Bone','toy',40,'squeaky',{role:'play',fav:'squeaky'});
// ---- furniture
add('bowl','Food Bowl','furn',40,'bowl',{role:'eat'});
add('water','Water Bowl','furn',40,'water',{role:'drink',anim:2});
add('bed_pink','Dog Bed (Pink)','furn',120,'bed',{pal:'pink',role:'sleep',lift:4});
add('bed_blue','Dog Bed (Blue)','furn',120,'bed',{pal:'blue',role:'sleep',lift:4});
add('doghouse','Dog House','furn',300,'doghouse',{role:'sleep'});
add('sofa_pink','Sofa (Pink)','furn',260,'sofa',{pal:'pink',role:'sleep',lift:15,wallside:1});
add('sofa_blue','Sofa (Blue)','furn',260,'sofa',{pal:'blue',role:'sleep',lift:15,wallside:1});
add('sofa_mint','Sofa (Mint)','furn',260,'sofa',{pal:'mint',role:'sleep',lift:15,wallside:1});
add('armchair_yellow','Armchair (Yellow)','furn',180,'armchair',{pal:'yellow',role:'sleep',lift:12});
add('armchair_teal','Armchair (Teal)','furn',180,'armchair',{pal:'teal',role:'sleep',lift:12});
add('bookshelf','Bookshelf','furn',220,'bookshelf',{wallside:1});
add('plant_big','Monstera','furn',80,'plantBig',{wallside:1});
add('plant_small','Potted Plant','furn',40,'plantSmall');
add('cactus','Cactus','furn',35,'cactus');
add('lamp','Floor Lamp','furn',90,'lamp',{wallside:1,light:1});
add('table','Side Table','furn',110,'sideTable',{wallside:1});
add('tv','TV Set','furn',380,'tv',{role:'tv',wallside:1,anim:4});
add('aquarium','Aquarium','furn',350,'aquarium',{wallside:1,anim:4});
add('fireplace','Fireplace','furn',520,'fireplace',{wallside:1,role:'sleep',anim:4,light:1});
// ---- rugs
add('rug_round_blue','Round Rug (Blue)','rug',100,'rugRound',{kind:'rug',pal:'blue'});
add('rug_round_pink','Round Rug (Pink)','rug',100,'rugRound',{kind:'rug',pal:'pink'});
add('rug_rect_green','Striped Rug (Green)','rug',100,'rugRect',{kind:'rug',pal:'green'});
add('rug_rect_red','Striped Rug (Red)','rug',100,'rugRect',{kind:'rug',pal:'red'});
// ---- wall decor
add('frame_dog','Dog Portrait','wall',60,'frameDog',{kind:'wall'});
add('frame_sun','Sunflower Print','wall',60,'frameSun',{kind:'wall'});
add('frame_paw','Paw Print Art','wall',60,'framePaw',{kind:'wall'});
add('clock','Wall Clock','wall',80,'clock',{kind:'wall',anim:2});
add('shelf','Wall Shelf','wall',90,'shelf',{kind:'wall'});
add('bunting','Party Bunting','wall',50,'bunting',{kind:'wall',wide:1});
add('neon','Neon Bone Sign','wall',150,'neon',{kind:'wall',anim:2,light:1});
// ---- seasonal (buyable only while the season is on)
add('pumpkin','Jack-o-lantern','season',60,'pumpkin',{season:'halloween',anim:2,light:1});
add('cobweb','Cobweb','season',40,'cobweb',{kind:'wall',season:'halloween'});
add('xtree','Christmas Tree','season',200,'xtree',{season:'christmas',anim:2,light:1,wallside:1});
add('stocking','Stocking','season',40,'stocking',{kind:'wall',season:'christmas'});

const FOOD={
  kibble:{n:'Kibble',p:10,h:18,hp:2,e:'🥣'},
  treat:{n:'Treat',p:6,h:8,hp:6,e:'🧁'},
  fruit:{n:'Fruit',p:10,h:15,hp:3,c:6,e:'🍎'},
  cookie:{n:'Cookie',p:12,h:20,hp:4,e:'🍪'},
  bone:{n:'Bone',p:18,h:25,hp:6,b:1,e:'🦴'},
  meat:{n:'Steak',p:30,h:45,hp:5,e:'🍖'},
  cake:{n:'Cake',p:45,h:30,hp:18,e:'🎂'},
  candy:{n:'Growth Candy',p:90,h:3,hp:6,e:'🍬',gr:6},      // v7: +6 hours of growth (a baby needs 72h to grow up) - max 6 a day per dog, not for grown-ups
};
const ACC={
  bow:{n:'Pink Bow',p:50,e:'🎀'},bandana:{n:'Bandana',p:60,e:'🧣'},scarf:{n:'Warm Scarf',p:80,e:'🧶'},
  glasses:{n:'Sunglasses',p:90,e:'🕶️'},partyhat:{n:'Party Hat',p:120,e:'🎉'},headphones:{n:'Headphones',p:200,e:'🎧'},
  crown:{n:'Royal Crown',p:300,e:'👑'},witch:{n:'Witch Hat',p:150,e:'🎃',season:'halloween'},santa:{n:'Santa Hat',p:150,e:'🎅',season:'christmas'},
};
const WALLS={cream:0,pink:0,mint:0,sky:0,stripe:150,panel:300,galaxy:500};
const FLOORS={wood:0,light:0,dark:0,tile:200,carpet:200,marble:400};
const LIGHTS={warm:0,cool:0,dream:0,sunset:100};
const TRICKS=[['sit',0],['shake',5],['spin',12],['jump',22],['roll',35],['dead',50]];   // [name, bond needed]
const RELEASE={C:20,R:60,E:150,L:400,M:1000};
const DEFAULT_ITEMS=[['sofa_pink',112,338],['lamp',205,338],['table',600,338],['plant_big',736,338],['rug_round_blue',400,470],['bed_pink',650,462],
  ['bowl',130,510],['water',215,515],['ball',420,440],['frame_dog',585,96],['frame_sun',695,100]];
const season=()=>{const m=new Date().getMonth()+1;return m==10?'halloween':m==12?'christmas':''};
// ---- house levels: more room for furniture and dogs (cost / required player level)
const HOUSE=[{items:40,dogs:8},{items:55,dogs:9,c:600,g:0,lvl:3},{items:70,dogs:10,c:1800,g:5,lvl:6},{items:90,dogs:12,c:4500,g:15,lvl:10}];
// ---- furniture sets: place every piece to get cozy points and a permanent perk for the house
const SETS=[
 {id:'pink',n:'Pink Parlor',e:'🌸',need:['sofa_pink','bed_pink','rug_round_pink'],perk:'happy',pts:30},
 {id:'blue',n:'Blue Lounge',e:'💙',need:['sofa_blue','bed_blue','rug_round_blue'],perk:'energy',pts:30},
 {id:'garden',n:'Indoor Garden',e:'🌿',need:['plant_big','plant_small','cactus','rug_rect_green'],perk:'hunger',pts:35},
 {id:'movie',n:'Movie Night',e:'🍿',need:['tv','sofa_mint','lamp'],perk:'xp',pts:35},
 {id:'library',n:'Reading Corner',e:'📚',need:['bookshelf','armchair_yellow','table','frame_sun'],perk:'coin',pts:40},
 {id:'toys',n:'Play Room',e:'🎾',need:['ball','frisbee','rope','duck','teddy','squeaky'],perk:'bond',pts:45},
 {id:'kitchen',n:'Dog Cafe',e:'🥣',need:['bowl','water','table','aquarium'],perk:'wish',pts:40}];
const PERKS={happy:'Dogs stay happier',energy:'Dogs tire more slowly',hunger:'Dogs get hungry more slowly',xp:'+15% XP from care',coin:'+10% coins from wishes',bond:'Petting gives +1 bond',wish:'Wishes pay +25%'};
const EVENTS={halloween:{n:'Halloween Party',e:'🎃',d:'Spooky season: +25% coins from wishes, park treats and spins'},christmas:{n:'Winter Festival',e:'🎄',d:'Festive season: +25% coins from wishes, park treats and spins'}};
module.exports={ITEMS:I,FOOD,ACC,WALLS,FLOORS,LIGHTS,TRICKS,RELEASE,DEFAULT_ITEMS,season,HOUSE,SETS,PERKS,EVENTS};
