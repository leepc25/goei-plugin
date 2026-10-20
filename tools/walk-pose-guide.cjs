// Anatomical planning diagram only; never rendered as game character art.
const fs=require('fs');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const poses=[
 {n:[[72,65],[87,96],[100,128]],f:[[70,65],[60,98],[46,128]],na:[[74,30],[63,47],[57,65]],fa:[[68,30],[82,46],[93,61]]},
 {n:[[72,66],[75,99],[80,128]],f:[[70,66],[78,93],[65,117]],na:[[74,31],[72,48],[67,67]],fa:[[68,31],[76,48],[82,65]]},
 {n:[[72,64],[65,98],[61,128]],f:[[70,64],[88,92],[94,116]],na:[[74,29],[82,47],[91,62]],fa:[[68,29],[63,46],[58,65]]},
 {n:[[72,65],[61,98],[46,128]],f:[[70,65],[86,96],[100,128]],na:[[74,30],[88,47],[99,61]],fa:[[68,30],[59,47],[53,65]]},
 {n:[[72,66],[79,93],[65,117]],f:[[70,66],[75,99],[80,128]],na:[[74,31],[80,48],[85,65]],fa:[[68,31],[66,48],[61,67]]},
 {n:[[72,64],[88,92],[94,116]],f:[[70,64],[64,98],[61,128]],na:[[74,29],[64,46],[57,65]],fa:[[68,29],[79,47],[87,62]]}
];
const limb=(pts,color,w)=>`<polyline points="${pts.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linejoin="bevel"/>`;
let svg='<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="360" viewBox="0 0 768 180"><rect width="768" height="180" fill="white"/>';
poses.forEach((p,i)=>{svg+=`<g transform="translate(${i*128-4},20)"><path d="M26 128H115" stroke="#aaa" stroke-width=".5"/>`+limb(p.f,'#2472a9',9)+limb(p.fa,'#2472a9',7)+`<path d="M60 29L79 27 83 47 80 65 61 65 58 47Z" fill="#666"/><ellipse cx="71" cy="14" rx="10" ry="12" fill="#555"/><path d="M78 12L86 17 79 19" fill="#555"/>`+limb(p.n,'#ce3e36',10)+limb(p.na,'#ce3e36',7)+`<text x="50" y="153" font-size="9">${i+1}</text></g>`;});
svg+='</svg>';
(async()=>{const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{const p=await b.newPage({viewport:{width:1536,height:360}});await p.setContent('<style>body{margin:0}</style>'+svg);await p.screenshot({path:'game-src/action/production-v5/walk-planning-guide.png'});}finally{await b.close()}})();
