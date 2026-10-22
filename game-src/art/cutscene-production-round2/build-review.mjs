import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('./',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',root),'utf8'));
if(!manifest.frames.length) throw new Error('No produced frames');
const images=await Promise.all(manifest.frames.map(async f=>'data:image/png;base64,'+(await readFile(new URL(f.sourceFile,root))).toString('base64')));
const template=await readFile(new URL('review-template.html',root),'utf8');
await writeFile(new URL('round2-review.html',root),template.replace('__PAYLOAD__',JSON.stringify({manifest,images}).replace(/</g,'\\u003c')));
console.log('Built standalone new-art review with '+images.length+' frames');
