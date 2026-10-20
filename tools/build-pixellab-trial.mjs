import {readFileSync,writeFileSync} from 'node:fs';
// Reuse the offline canonical-engine bundler; change only the study entry and assets.
let builder=readFileSync('tools/build-jyaldi-v5-preview.mjs','utf8')
 .replace("module('src/game/action/production-preview.ts')","module('src/game/action/pixellab-walk-trial.ts')")
 .replaceAll('game-src/action/production-v5/atlas-preview','game-src/action/pixellab-trial/atlas')
 .replace('release/demo/jyaldi-v5-playable-preview.html','release/demo/jyaldi-pixellab-trial.html');
const start=builder.indexOf('const html='),end=builder.indexOf("mkdirSync('release/demo'",start);
const page=readFileSync('tools/pixellab-walk-trial.html','utf8');
builder=builder.slice(0,start)+'const html='+JSON.stringify(page)+'.replace("__ART__",JSON.stringify(art)).replace("__IMPORTS__",JSON.stringify({imports})).replace("__ENTRY__",JSON.stringify(entry));\n'+builder.slice(end);
await import('data:text/javascript;base64,'+Buffer.from(builder).toString('base64'));
