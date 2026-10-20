const assert=require('node:assert/strict');
const {World,duration}=require('../src/engine.js');
const results=[];
function run(name,fn){try{fn();results.push({name,pass:true});console.log('PASS',name);}catch(e){results.push({name,pass:false,error:e.stack});console.error('FAIL',name,e.message);}}
function make(){const w=new World(123);w.dummyMode=true;return w;}
function tick(w,seconds){for(let i=0;i<Math.ceil(seconds*60);i++)w.update(1/60);}
function press(w,key){w.input.down(key);w.update(1/60);w.input.up(key);}
function enemy(w,dx=60,dy=0,hp=150){const p=w.player;const e={id:w.id++,kind:0,x:p.x+dx,y:p.y+dy,hp,maxHp:hp,speed:50,state:'idle',t:0,face:-1,hurt:0,dead:false,fired:false,attackWait:0,weight:1};w.enemies.push(e);return e;}
run('direct movement and world bounds',()=>{const w=make();w.input.down('right');tick(w,1);assert(w.player.x>420);w.input.clear();w.input.down('left');tick(w,20);assert.equal(w.player.x,65);assert.equal(w.player.face,-1);});
run('diagonal movement normalized',()=>{const a=make(),b=make();a.input.down('right');b.input.down('right');b.input.down('up');tick(a,.4);tick(b,.4);assert(b.player.x<a.player.x);});
run('three-hit combo deals progressive damage',()=>{const w=make(),e=enemy(w,55,0,500);press(w,'attack');tick(w,.13);press(w,'attack');tick(w,.38);press(w,'attack');tick(w,1.0);assert(w.eventLog.filter(e=>e.kind==='hitEnemy').length>=3);assert(e.hp<430);});
run('melee does not hit enemies behind or other depth lane',()=>{const w=make(),a=enemy(w,-60),b=enemy(w,60,80);press(w,'attack');tick(w,.5);assert.equal(a.hp,150);assert.equal(b.hp,150);});
run('dodge invulnerability and cooldown',()=>{const w=make(),e=enemy(w);press(w,'dodge');assert.equal(w.player.action,'dodge');const hp=w.player.hp;assert.equal(w.hitPlayer(40,e),false);assert.equal(w.player.hp,hp);assert.equal(w.dodge(),false);tick(w,1);assert.equal(w.dodge(),true);});
run('jump lands at original ground plane',()=>{const w=make(),y=w.player.y;press(w,'jump');tick(w,.2);assert(w.player.z>30);tick(w,1);assert.equal(w.player.z,0);assert.equal(w.player.y,y);});
run('holding and releasing X charges one ability',()=>{const w=make(),e=enemy(w,90,0,300);w.input.down('palm');tick(w,.8);assert(w.player.charging);assert(w.player.charge>.7);w.input.up('palm');tick(w,.8);assert(e.hp<240);assert.equal(w.eventLog.filter(e=>e.kind==='ability').length,1);assert(w.player.mp<100);});
run('insufficient energy prevents ability',()=>{const w=make();w.player.mp=0;assert.equal(w.ability('ultimate'),false);assert.equal(w.player.action,'idle');});
run('front guard reduces incoming damage',()=>{const w=make(),e=enemy(w);w.input.down('guard');tick(w,.05);const hp=w.player.hp;w.hitPlayer(30,e);assert(hp-w.player.hp<=6);});
run('projectile hits once per enemy',()=>{const w=make(),e=enemy(w,200,0,500);w.ability('wave');tick(w,1.4);assert.equal(w.eventLog.filter(e=>e.kind==='hitEnemy').length,1);assert(e.hp<500);});
run('kills grant experience and level progression',()=>{const w=make();for(let i=0;i<5;i++)w.hitEnemy(enemy(w,60,0,1),100);assert.equal(w.kills,5);assert(w.player.level>1);assert(w.player.atk>18);});
run('healing consumes one potion and restores HP',()=>{const w=make();w.player.hp=50;press(w,'heal');tick(w,1);assert.equal(w.player.potions,2);assert(w.player.hp>=125);});
run('rest interaction and manual exit',()=>{const w=make();w.player.x=510;w.player.y=405;w.player.hp=80;press(w,'interact');tick(w,1);assert.equal(w.player.action,'sit');assert(w.player.hp>80);w.input.down('right');tick(w,.1);assert.equal(w.player.action,'walk');});
run('pause freezes simulation and resume works',()=>{const w=make();press(w,'pause');const time=w.time;tick(w,2);assert.equal(w.time,time);press(w,'pause');tick(w,.1);assert(w.time>time);});
run('automatic combat can defeat an enemy',()=>{const w=make();enemy(w,110,0,60);w.toggleAuto();tick(w,7);assert(w.kills>=1);assert.equal(w.auto,true);});
run('manual movement immediately overrides automatic combat',()=>{const w=make();w.toggleAuto();w.input.down('left');tick(w,.1);assert.equal(w.auto,false);assert(w.player.x<260);});
run('enemy telegraph and attack injure player',()=>{const w=new World(23);w.waveWait=1000;const e=enemy(w,50);tick(w,2);assert(w.player.hp<w.player.maxHp);});
run('long run has bounded effects and live enemies',()=>{const w=new World(44);w.toggleAuto();tick(w,180);assert(w.effects.length<=44);assert(w.enemies.length<=14);assert(w.projectiles.length<10);assert(Number.isFinite(w.player.x));});
run('restart clears inventory container state',()=>{const w=make();w.player.x=1230;w.player.y=375;press(w,'interact');assert(w.cacheUsed);w.reset();assert.equal(w.cacheUsed,false);});
require('node:fs').writeFileSync(require('node:path').join(__dirname,'../output/simulation-validation.json'),JSON.stringify({tests:results.length,passed:results.filter(r=>r.pass).length,results},null,2));
if(results.some(r=>!r.pass))process.exitCode=1;
