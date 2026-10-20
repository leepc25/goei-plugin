// Offline preview using the canonical engine; Node 24 strips TS without a release rebuild.
import {stripTypeScriptTypes} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
const root=process.cwd(), imports={};
const key=file=>'jyaldi/'+path.relative(root,file).replaceAll('\\','/');
function module(file){
  file=path.resolve(file);
  const id=key(file);
  if(imports[id])return id;
  imports[id]='pending';
  let code=file.endsWith('.css') ? 'export default '+JSON.stringify(readFileSync(file,'utf8')) :
    stripTypeScriptTypes(readFileSync(file,'utf8'),{mode:'transform'});
  code=code.replace(/from\s*(['"])(\.\.?\/[^'"]+)\1/g,(_,q,relative)=>{
    const target=path.resolve(path.dirname(file),relative+(path.extname(relative)?'':'.ts'));
    return 'from '+JSON.stringify(module(target));
  });
  imports[id]='data:text/javascript;base64,'+Buffer.from(code).toString('base64');
  return id;
}
const entry=module('src/game/action/production-preview.ts');
const action=JSON.parse(readFileSync('game-src/action/production-v5/atlas-preview.json','utf8'));
const png=file=>'data:image/png;base64,'+readFileSync(file).toString('base64');
// Abstract training targets are code-drawn props, not reused rejected character sprites.
const dummy='data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="110"><path fill="#485b69" d="M18 65h12v39H18zM3 104h42v6H3z"/><rect x="2" y="2" width="44" height="78" rx="8" fill="#a16649" stroke="#e5b689" stroke-width="3"/><circle cx="24" cy="35" r="15" fill="#372d32"/><circle cx="24" cy="35" r="7" fill="#e5b689"/></svg>').toString('base64');
const atlas={action,corner:Array(24).fill([0,0,48,110,24,110,110]),watchman:Array(24).fill([0,0,48,110,24,110,110])};
const art={atlas,files:{'a-jyaldi-action':png('game-src/action/production-v5/atlas-preview.png'),
 'bg-bureau-action':png('game-pack/action/bg-bureau-action.png'),'e-corner':dummy,'e-watchman':dummy}};
const html=`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>쟈알디 신규 작화 적용 시연판</title><style>body{margin:0;background:#02070c;color:#e6e2cd;font:14px sans-serif}header{max-width:1248px;margin:auto;padding:10px 16px}header p{margin:6px 0;color:#c4ccd5}#box{position:relative;width:1280px;max-width:100%;height:900px;max-height:calc(100dvh - 110px);margin:auto}</style><header><b>쟈알디 · 새 작화 게임 적용 시연판</b><p>방향키 이동 · Shift 달리기 · A+↓ 앉기 · A+방향키 앉아 이동 · Z 근접 · D 사격 · X 점프</p><p>대표 자세 6종 적용 단계. 걷기·달리기는 아직 한 자세이며, 전체 연속 동작과 1·2타 작화는 미완성입니다.</p></header><div id="box"></div><script>window.__GOEI_ACTION_ART__=${JSON.stringify(art)}</script><script type="importmap">${JSON.stringify({imports})}</script><script type="module">import ${JSON.stringify(entry)};</script></html>`;
mkdirSync('release/demo',{recursive:true});
writeFileSync('release/demo/jyaldi-v5-playable-preview.html',html);
console.log(JSON.stringify({bytes:Buffer.byteLength(html),modules:Object.keys(imports).length,profile:action.profile}));
