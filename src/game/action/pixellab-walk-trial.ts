import {ActionRenderer} from './render';
import {newRun,step} from './sim';
import {demoArt} from './demo-art';

const canvas=document.querySelector<HTMLCanvasElement>('canvas')!;
const renderer=new ActionRenderer(canvas);
const run=newRun();
run.practice=true;run.enemies=[];run.player.x=460;run.player.y=600;
const keys=new Set<string>();
let auto=false, frozen=false, speed=1, velocity=0, last=0, elapsed=0, acc=0;
let stopTime=0, wasMoving=false, selected:number|null=null;
let startTime=0, gaitPhase=0, lastX=1, lastY=0, stopPose=2;
const art=await demoArt();
// Each review pose has its own clip; these are real whole-body drawings.
for(let i=0;i<9;i++)art.atlas.action!.clips[`pose${i}`]=[i];
await renderer.load(art);
const state={frame:0,phase:'idle',x:run.player.x,y:run.player.y,velocity:0,scale:2};
Object.assign(window,{walkStudy:{state,art:art.atlas.action}});
const status=document.querySelector<HTMLElement>('#status')!;
const clear=()=>keys.clear();
window.addEventListener('blur',clear);
document.addEventListener('visibilitychange',()=>{last=0;clear()});
canvas.addEventListener('keydown',e=>{
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code)){e.preventDefault();keys.add(e.code);selected=null;auto=false;frozen=false;}
});
canvas.addEventListener('keyup',e=>keys.delete(e.code));
document.querySelector('#auto')!.addEventListener('click',()=>{auto=!auto;selected=null;frozen=false;elapsed=0;canvas.focus()});
document.querySelector('#pause')!.addEventListener('click',()=>{frozen=!frozen;if(!frozen)selected=null});
document.querySelector('#next')!.addEventListener('click',()=>{frozen=true;selected=(state.frame+1)%9});
document.querySelector('#speed')!.addEventListener('change',e=>{speed=Number((e.target as HTMLSelectElement).value)});
document.querySelector('#frames')!.addEventListener('click',e=>{
  const b=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-frame]');
  if(b){selected=Number(b.dataset.frame);frozen=true;}
});
document.querySelectorAll<HTMLButtonElement>('[data-dir]').forEach(b=>{
  b.addEventListener('pointerdown',e=>{b.setPointerCapture(e.pointerId);keys.add(b.dataset.dir!);selected=null;auto=false;frozen=false});
  for(const type of ['pointerup','pointercancel'])b.addEventListener(type,clear);
});
function update(dt:number){
  elapsed+=dt;
  const cycle=elapsed%8;
  const x=auto ? (cycle<1 ? 0:cycle<3.5 ? 1:cycle<4.5 ? 0:cycle<7 ? -1:0) :
    Number(keys.has('ArrowRight'))-Number(keys.has('ArrowLeft'));
  const y=Number(keys.has('ArrowDown'))-Number(keys.has('ArrowUp'));
  const moving=!!(x||y);
  const turning=moving&&wasMoving&&x!==0&&lastX!==0&&Math.sign(x)!==Math.sign(lastX);
  if(moving&&(!wasMoving||turning)){
    startTime=0;gaitPhase=0;
    if(turning)velocity=0;
  }
  if(moving){lastX=x;lastY=y;}
  // Acceleration/deceleration only changes movement, never the character's dimensions.
  velocity=Math.max(0,Math.min(1,velocity+(moving?dt*7:-dt*8)));
  if(moving)run.player.dir=x ? Math.sign(x):run.player.dir;
  const beforeX=run.player.x,beforeY=run.player.y;
  const effectiveX=moving?x:lastX,effectiveY=moving?y:lastY;
  // 140px/s with a 160px full cycle gives ordinary walking cadence (~1.75 steps/s).
  step(run,{x:effectiveX*velocity*.7,y:effectiveY*velocity*.7},dt);
  const distance=Math.hypot(run.player.x-beforeX,run.player.y-beforeY);
  if(wasMoving&&!moving){stopTime=0;stopPose=0;}
  if(moving)stopTime=0;
  else stopTime=Math.max(0,stopTime-dt);
  if(moving&&startTime>0){
    startTime=Math.max(0,startTime-dt);
    state.frame=startTime>.11?2:6;
  }else if(moving&&distance>.001){
    gaitPhase=(gaitPhase+distance/200)%1;
    state.frame=1+Math.min(7,Math.floor(gaitPhase*8));
  }else if(!moving){
    state.frame=velocity>0||stopTime>0?stopPose:0;
  }
  state.phase=moving?(velocity<1?'start':'walk'):velocity>0||stopTime>0?'stop':'idle';
  wasMoving=moving;
}
function draw(now:number){
  const dt=Math.min(.05,last?(now-last)/1000:0);last=now;
  if(!document.hidden&&!frozen){acc+=dt*speed;while(acc>=1/60){update(1/60);acc-=1/60;}}
  if(selected!==null)state.frame=selected;
  state.x=run.player.x;state.y=run.player.y;state.velocity=velocity;
  renderer.drawPose(run,`pose${state.frame}`,0);
  const c=renderer.ctx;
  c.strokeStyle='#8bd5ff';c.setLineDash([6,6]);
  c.beginPath();c.moveTo(0,run.player.y);c.lineTo(1280,run.player.y);c.stroke();
  c.strokeStyle='#ffe0a2';c.beginPath();c.moveTo(run.player.x-90,run.player.y-256);c.lineTo(run.player.x+90,run.player.y-256);c.stroke();c.setLineDash([]);
  if((document.querySelector('#compare') as HTMLInputElement).checked){
    c.globalAlpha=.28;
    const f=art.atlas.action!.frames[0]!;
    // Comparison ghost is the same neutral whole-body frame at the same scale.
    const img=ghost;
    c.save();c.translate(Math.round(run.player.x),Math.round(run.player.y));c.scale(run.player.dir,1);
    c.drawImage(img,f[0],f[1],f[2],f[3],-f[4]*2,-f[5]*2,f[2]*2,f[3]*2);c.restore();c.globalAlpha=1;
  }
  status.textContent=`${{idle:'정지',start:'출발',walk:'걷기',stop:'멈추기'}[state.phase]} · 그림 ${state.frame+1}/9 · 원본 기준 128px / 표시 2배`;
  requestAnimationFrame(draw);
}
const ghost=new Image();ghost.src=art.url('a-jyaldi-action');await ghost.decode();
canvas.focus();requestAnimationFrame(draw);
