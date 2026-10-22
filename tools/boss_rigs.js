// 부위·코드 보스 움직임 (시연판과 엔진이 같이 쓸 수 있게 순수 함수로). draw(cx, move, t초*배속, env{G,W,H,parts,im})
// ── #5 불가능한 입체 도형: 그림 생성 없음. 3D 들보 12개를 저해상도 판에 그리고(외곽선 순검정·면 3단 명암) 확대. 한 들보만 그리는 순서를 뒤집어 '불가능한 상자'가 된다.
(function(){
  const LO=document.createElement('canvas');LO.width=200;LO.height=130;const g=LO.getContext('2d');g.imageSmoothingEnabled=false;
  const CORNER=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
  const EDGE=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
  const MARK={0:'#c8463c',2:'#d8b45a',5:'#4f86c6',7:'#5aa36a'};   // 모서리 넷: 번호 순서대로 때리는 약점(1 빨강 2 노랑 3 파랑 4 초록)
  function rot(p,a,b,c){let [x,y,z]=p;let t;t=x*Math.cos(a)-z*Math.sin(a);z=x*Math.sin(a)+z*Math.cos(a);x=t;t=y*Math.cos(b)-z*Math.sin(b);z=y*Math.sin(b)+z*Math.cos(b);y=t;
    t=x*Math.cos(c)-y*Math.sin(c);y=x*Math.sin(c)+y*Math.cos(c);x=t;return [x,y,z]}
  function proj(p,s,cx0,cy0){const f=4/(4+p[2]);return [cx0+p[0]*s*f,cy0+p[1]*s*f,p[2]]}
  function beam(a,b,w,col){const dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy)||1,nx=-dy/L*w,ny=dx/L*w;
    g.beginPath();g.moveTo(a[0]+nx,a[1]+ny);g.lineTo(b[0]+nx,b[1]+ny);g.lineTo(b[0]-nx,b[1]-ny);g.lineTo(a[0]-nx,a[1]-ny);g.closePath();
    g.fillStyle=col;g.fill();g.lineWidth=1;g.strokeStyle='#050607';g.stroke();
    g.beginPath();g.moveTo(a[0]+nx*.6,a[1]+ny*.6);g.lineTo(b[0]+nx*.6,b[1]+ny*.6);g.strokeStyle='rgba(255,255,255,.18)';g.stroke()}
  function cube(t,opt){
    const {spin=1,unfold=0,crack=-1,scale=34,ox=100,oy=62,beamOn=-1,fold=0}=opt||{};
    const a=t*0.9*spin,b=0.55+Math.sin(t*0.7)*0.25,c=t*0.3*spin;
    const pts=CORNER.map((p,i)=>{let q=p.map(v=>v*(1+unfold*0.9*(i%2?1:-1)*0.3));q=q.map(v=>v*(1-fold));return proj(rot(q,a,b,c),scale,ox,oy+fold*40)});
    const es=EDGE.map(([i,j],k)=>({i,j,k,z:(pts[i][2]+pts[j][2])/2})).sort((p,q)=>q.z-p.z);
    if(es.length>4){const x=es[3];es[3]=es[es.length-2];es[es.length-2]=x}       // 그리는 순서 하나 뒤집기 = 불가능
    es.forEach(e=>{const shade=e.k<4?'#c9ccd0':e.k<8?'#8d9196':'#5f646a';beam(pts[e.i],pts[e.j],4.5*(1-fold*.8),shade)});
    Object.entries(MARK).forEach(([i,col],n)=>{const p=pts[i];if(n<=crack){g.fillStyle='#222';g.fillRect(p[0]-3,p[1]-3,6,6);return}
      g.fillStyle=col;g.fillRect(Math.round(p[0])-3,Math.round(p[1])-3,6,6);g.strokeStyle='#050607';g.strokeRect(Math.round(p[0])-3.5,Math.round(p[1])-3.5,7,7)});
    if(beamOn>=0){const p=pts[Object.keys(MARK)[beamOn]];g.strokeStyle='rgba(255,240,180,.9)';g.lineWidth=3;g.beginPath();g.moveTo(p[0],p[1]);g.lineTo(0,LO.height-8);g.stroke();g.lineWidth=1}
    return pts}
  function blit(cx,env,shake){cx.save();cx.imageSmoothingEnabled=false;const s=2,w=LO.width*s,h=LO.height*s;
    cx.drawImage(LO,Math.round(env.W/2-w/2+60+(shake||0)*(Math.random()-.5)),Math.round(env.G-h+4),w,h);cx.restore()}
  function inside(t){ // 3단계: 도형 안. 들보 복도가 90°씩 돌아감
    g.fillStyle='#d9dde0';g.fillRect(0,0,LO.width,LO.height);const k=Math.floor(t/2.2)%4,r=Math.min(1,(t%2.2)/0.5);g.save();g.translate(100,65);g.rotate((k+r)*Math.PI/2);
    for(let i=-4;i<=4;i++){g.fillStyle=i%2?'#8d9196':'#5f646a';g.fillRect(i*26-10,-90,20,180);g.strokeStyle='#050607';g.strokeRect(i*26-10,-90,20,180)}
    g.fillStyle='#c9ccd0';g.fillRect(-120,40,240,14);g.strokeRect(-120,40,240,14);g.restore()}
  RIGS.shape={name:'불가능한 입체 도형',sub:'퍼즐 층 수호자 · 코드 3D → 도트 (생성 0회)',moves:[
    {ph:'1 상자',id:'idle',name:'회전(보면 조작 반전)',loop:1},{ph:'1 상자',id:'beam',name:'모서리 빛',loop:1},{ph:'1 상자',id:'push',name:'회전 밀치기',loop:1},
    {ph:'2 펼침',id:'unfold',name:'펼쳐 내려찍기',loop:1},{ph:'2 펼침',id:'shard',name:'조각 떼어내기',loop:1},
    {ph:'약점',id:'order',name:'모서리 순서대로 깨기',loop:1},{ph:'★ 전환',id:'inside',name:'안으로(중력 회전)',loop:1},{ph:'끝',id:'fold',name:'접혀 떨어짐',loop:1}],
   draw(cx,m,t,env){g.clearRect(0,0,LO.width,LO.height);let sh=0;
    if(m.id=='idle')cube(t);
    else if(m.id=='beam'){const k=Math.floor(t)%4;cube(t*0.3,{beamOn:(t%1)>.5?k:-1})}
    else if(m.id=='push'){const p=(t%1.6)/1.6;cube(t*3,{ox:100-30+60*Math.sin(p*Math.PI)});sh=p>.4&&p<.6?6:0}
    else if(m.id=='unfold'){const p=(t%2)/2;const u=p<.5?p*2:1-(p-.5)*2;cube(t*.4,{unfold:u*1.1,scale:34+u*6,oy:62-u*10+(p>.55&&p<.65?18:0)});sh=p>.55&&p<.65?10:0}
    else if(m.id=='shard'){cube(t*.6);const p=(t%1.2)/1.2;for(let i=0;i<5;i++){const a=i*1.26+t;g.fillStyle='#8d9196';g.fillRect(100+Math.cos(a)*p*90,62+Math.sin(a)*p*60,6,6);g.strokeStyle='#050607';g.strokeRect(100+Math.cos(a)*p*90,62+Math.sin(a)*p*60,6,6)}}
    else if(m.id=='order'){cube(t*.2,{crack:Math.floor(t/0.9)%5-1})}
    else if(m.id=='inside'){inside(t)}
    else if(m.id=='fold'){const p=Math.min(1,(t%3)/2);cube(t*2,{fold:Math.min(.97,p),scale:34});sh=p>.95?8:0}
    blit(cx,env,sh)}};
})();

// ── 부위 보스 공용: 부위 그림을 관절 기준으로 돌려 그림. part(cx, img, x, y, 각도, 기준점 비율 ax ay, 배율, 뒤집기)
function bpart(cx,img,x,y,ang,ax,ay,s,flip){if(!img||!img.complete||!img.width)return;cx.save();cx.translate(Math.round(x),Math.round(y));cx.rotate(ang);if(flip)cx.scale(1,-1);
  cx.drawImage(img,-img.width*ax*s,-img.height*ay*s,img.width*s,img.height*s);cx.restore()}
function pick(parts,name,env){const k=Object.keys(parts).find(n=>n.startsWith(name+'-'));return k?env.im(parts[k]):null}

// 다리 둘 마디 역기구학: 엉덩이(hx,hy)→발(fx,fy), 마디 길이 a,b. 무릎은 위로 꺾임(거미처럼).
function ik2(hx,hy,fx,fy,a,b,up){const dx=fx-hx,dy=fy-hy,d=Math.min(a+b-1,Math.hypot(dx,dy)),base=Math.atan2(dy,dx);
  const c=Math.acos(Math.max(-1,Math.min(1,(a*a+d*d-b*b)/(2*a*d))));const t=base+(up?-c:c);const kx=hx+Math.cos(t)*a,ky=hy+Math.sin(t)*a;
  return {kx,ky,t1:t,t2:Math.atan2(fy-ky,fx-kx)}}
function dimmed(img,amt){if(!img||!img.complete||!img.width)return img;if(img._dim)return img._dim;const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const g=c.getContext('2d');
  g.drawImage(img,0,0);g.globalCompositeOperation='source-atop';g.fillStyle=`rgba(8,10,12,${amt})`;g.fillRect(0,0,c.width,c.height);img._dim=c;c.complete=true;return c}

// ── #2 다리 많은 것: 몸통 1장 + 머리 4표정 + 다리 마디 그림을 여덟 다리로 돌려 씀(먼 쪽 넷은 어둡게). 화면보다 긴 몸이 오른쪽에서 들어옴.
RIGS.legs={name:'다리 많은 것',sub:'환풍 통로 중간보스 · 몸길이 약 420 · 부위 그림 조립',ready:P=>P.legs&&Object.keys(P.legs).length>=6,
 moves:[{ph:'1 천장',id:'idle',name:'대기(다리 두드림)'},{ph:'1 천장',id:'walk',name:'기어오기'},{ph:'1 천장',id:'stab',name:'다리 찌르기 3연'},{ph:'1 천장',id:'bite',name:'머리 물기'},
  {ph:'2 바닥',id:'rear',name:'일어서 덮치기'},{ph:'2 바닥',id:'sweep',name:'다리 쓸기'},{ph:'2 바닥',id:'scream',name:'비명(다리 굳음)'},
  {ph:'약점',id:'hurt',name:'틈 막힘(움찔)'},{ph:'★ 필살',id:'nest',name:'둥지(다리 우리)'},{ph:'3 추격',id:'chase',name:'자동 스크롤 추격'}],
 draw(cx,m,t,env){const P=env.parts,I=n=>pick(P,n,env),G=env.G;const torso=I('torso'),up=I('leg_upper'),lo=I('leg_lower'),claw=I('claw');
  let bx=env.W*0.62,by=G-120,head='head_idle',hx=0,hy=0,rear=0,shake=0;const legs=[];
  const gait=(spd,amp)=>{for(let i=0;i<8;i++){const ph=t*spd+i*Math.PI/2+(i%2)*Math.PI;legs.push({i,far:i%2==1,hip:-110+Math.floor(i/2)*70,fx:-150+Math.floor(i/2)*78+Math.sin(ph)*amp,lift:Math.max(0,Math.cos(ph))*22*(amp>0?1:0)})}};
  if(m.id=='idle'){gait(0,0);by+=Math.sin(t*2)*4;legs.forEach(l=>{if(l.i==6)l.lift=Math.max(0,Math.sin(t*9))*14})}
  else if(m.id=='walk'||m.id=='chase'){gait(m.id=='chase'?9:5,26);by+=Math.sin(t*10)*3;bx+=(m.id=='chase'?-40:0)+Math.sin(t*0.8)*30;if(m.id=='chase')head='head_scream'}
  else if(m.id=='stab'){gait(0,0);const p=(t%2.4)/2.4,k=Math.floor(p*3);legs.forEach(l=>{if(l.i==(k*2)%8&&!l.far){const q=(p*3)%1;l.fx-=q<.5?q*2*140:140*(1-(q-.5)*2);l.lift=q<.5?60-q*120:0}});shake=((p*3)%1)>.45&&((p*3)%1)<.55?5:0}
  else if(m.id=='bite'){gait(0,0);const p=(t%1.8)/1.8;hx=p<.4?p*30:p<.55?-150*(p-.4)/.15+12:-150+(p-.55)*330;hx=Math.min(12,hx);head=p>.38&&p<.7?'head_bite':'head_idle'}
  else if(m.id=='rear'){gait(0,0);const p=(t%3)/3;rear=p<.5?p*2:p<.62?1-(p-.5)*8.3:0;head=rear>.6?'head_scream':'head_idle';shake=p>.6&&p<.66?10:0}
  else if(m.id=='sweep'){gait(0,0);const p=(t%2)/2;legs.forEach(l=>{if(!l.far){l.fx+=Math.sin(p*Math.PI*2)*120*(l.i/8+.5);l.lift=8}})}
  else if(m.id=='scream'){gait(0,0);head='head_scream';shake=3;by-=6}
  else if(m.id=='hurt'){gait(0,0);head='head_hurt';by-=Math.abs(Math.sin(t*14))*8;legs.forEach(l=>l.lift=Math.abs(Math.sin(t*14+l.i))*20)}
  else if(m.id=='nest'){gait(0,0);head='head_scream';const p=Math.min(1,(t%4)/2.5);legs.forEach(l=>{l.fx=-150+(l.i*45-160)*(1-p)+(-260+l.i*65)*p;l.lift=-p*0})}
  const ang=-rear*1.15;
  const hipPos=hip=>{const c=Math.cos(ang),s=Math.sin(ang);return [bx+hip*c,by+28+hip*s]};
  const drawLeg=l=>{const [x0,y0]=hipPos(l.hip);const fx=bx+l.fx-(rear?rear*120:0),fy=G-2-l.lift;const k=ik2(x0,y0,fx,fy,130,130,true);
   const U=l.far?dimmed(up,.45):up,L=l.far?dimmed(lo,.45):lo;bpart(cx,U,x0,y0,k.t1,0.06,0.5,0.85);bpart(cx,L,k.kx,k.ky,k.t2,0.06,0.5,0.85);
   if(claw)bpart(cx,l.far?dimmed(claw,.45):claw,fx,fy,k.t2,0.1,0.5,0.8)};
  cx.save();if(shake)cx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);
  legs.filter(l=>l.far).forEach(drawLeg);
  bpart(cx,torso,bx,by,ang,0.5,0.4,1.7);
  legs.filter(l=>!l.far).forEach(drawLeg);
  const [nx,ny]=hipPos(-200);bpart(cx,I(head),nx-30+hx,ny-30+hy,ang*0.4,0.6,0.5,1.25);
  cx.restore()}};

// ── #3 그림자: 몸 3단(웅덩이→섬→거대) + 손 셋 + 가면 얼굴. 손전등 빛 원 안에서만 실체(밝게), 밖이면 반투명.
RIGS.shadow={name:'그림자',sub:'정전 층 수호자 · 손전등에 비치면 실체 · 부위 그림 조립',ready:P=>P.shadow&&Object.keys(P.shadow).length>=6,
 moves:[{ph:'1 웅덩이',id:'lurk',name:'웅덩이 미끄러짐'},{ph:'1 웅덩이',id:'rise',name:'솟아 할퀴기'},{ph:'2 서 있음',id:'stand',name:'대기(빛 피함)'},{ph:'2 서 있음',id:'grab',name:'손 뻗어 잡기'},
  {ph:'2 서 있음',id:'lit',name:'빛에 잡힘(실체)'},{ph:'3 거대',id:'huge',name:'팔 여럿 덮치기'},{ph:'★ 필살',id:'swallow',name:'삼키기(화면 암전)'}],
 draw(cx,m,t,env){const P=env.parts,I=n=>pick(P,n,env),G=env.G,x=env.W*0.62;let body='body_stand',a=0.55,hands=[],face=null,dy=0,dark=0;
  const pud=I('puddle');
  if(m.id=='lurk'){body=null;bpart(cx,pud,x+Math.sin(t*1.3)*120,G,0,0.5,0.85,1.3)}
  else if(m.id=='rise'){const p=(t%2)/2;body='body_low';bpart(cx,pud,x,G,0,0.5,0.85,1.3);dy=(1-Math.min(1,p*3))*90;a=.7;if(p>.35&&p<.7)hands.push(['hand_grab',x-110+(p-.35)*-160,G-120,-.4])}
  else if(m.id=='stand'){a=.45+Math.sin(t*3)*.1;dy=Math.sin(t*2)*3;hands.push(['hand_open',x-90,G-150+Math.sin(t*2)*6,0])}
  else if(m.id=='grab'){const p=(t%1.6)/1.6;const r=p<.5?p*2:1-(p-.5)*2;hands.push([r>.8?'hand_grab':'hand_open',x-80-r*260,G-140+r*40,-.2]);a=.6}
  else if(m.id=='lit'){a=1;face=Math.floor(t*3)%2?'face_scream':'face';hands.push(['hand_open',x-70,G-170,.5])}
  else if(m.id=='huge'){body='body_huge';a=.75;const p=(t%2.2)/2.2;for(let i=0;i<3;i++)hands.push([i==1?'hand_point':'hand_grab',x-120-i*60-Math.sin(p*Math.PI)*120,G-60-i*50,-.3+i*.2])}
  else if(m.id=='swallow'){body='body_huge';a=.85;dark=Math.min(.92,(t%4)/3);face='face_scream'}
  cx.save();cx.globalAlpha=a;if(body)bpart(cx,I(body),x,G+4+dy,0,0.5,1,body=='body_low'?1.1:1.15);
  hands.forEach(([n,hx,hy,ang])=>bpart(cx,I(n),hx,hy,ang,0.5,0.5,1.1));cx.globalAlpha=1;
  if(face)bpart(cx,I(face),x+10,G-200,0,0.5,0.5,.7);
  if(m.id=='lit'){cx.globalCompositeOperation='destination-over';const gr=cx.createRadialGradient(x,G-120,10,x,G-120,170);gr.addColorStop(0,'rgba(255,236,180,.35)');gr.addColorStop(1,'rgba(255,236,180,0)');cx.fillStyle=gr;cx.fillRect(0,0,env.W,env.H)}
  cx.restore();if(dark){cx.fillStyle=`rgba(0,0,0,${dark})`;cx.fillRect(0,0,env.W,env.H)}}};
