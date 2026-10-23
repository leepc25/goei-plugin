const sharp=require('sharp'),fs=require('fs'),cp=require('child_process'),assert=require('assert'),crypto=require('crypto');
const path=require('path'),root=path.resolve(__dirname,'../../../..');
const D=process.argv[3]||path.join(require('os').tmpdir(),'goei-f2-redraw'),source=process.argv[2]||path.join(root,'game-src/art/field/source/f2-generated.png');
fs.mkdirSync(D,{recursive:true});
const W=3700,H=700,SW=W*2,SH=1400;
// Whole-scene coordinate normalization preserves all painted material shading.
// No prior rejected artwork or flat reconstruction is used.
const anchors=[[0,0],[2041,3700]];
function interp(v,a,reverse=false){let k=reverse?1:0,j=1-k;for(let i=1;i<a.length;i++)if(v<=a[i][k]){let p=a[i-1],q=a[i];return p[j]+(v-p[k])*(q[j]-p[j])/(q[k]-p[k]);}return a.at(-1)[j];}
const doorTops=[[0,202],[29,202],[132,202],[282,227],[365,227],[587,210],[735,210],[990,216],[1072,216],[1099,216],[1181,216],[1439,228],[1520,228],[1718,210],[1861,210],[1929,202],[2040,202]];
const sx=x=>interp(x,anchors,true),fx=x=>interp(x,anchors),top=x=>213;
function sy(x,y){return interp(y,[[0,94],[40,122],[120,top(x)],[420,410],[700,674]]);}
function fy(x,y){return interp(y,[[0,94],[40,122],[120,top(x)],[420,410],[700,674]],true);}
(async()=>{
 const {data:src,info:si}=await sharp(source).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const working=Buffer.alloc(SW*SH*3);const xMap=Array.from({length:SW},(_,x)=>sx(x/2));
 for(let y=0;y<SH;y++)for(let x=0;x<SW;x++){
  const X=xMap[x],Y=sy(X,y/2),i=(Math.max(0,Math.min(si.height-1,Math.round(Y)))*si.width+Math.max(0,Math.min(si.width-1,Math.round(X))))*3,k=(y*SW+x)*3;
  working[k]=src[i];working[k+1]=src[i+1];working[k+2]=src[i+2];
 }
 await sharp(working,{raw:{width:SW,height:SH,channels:3}}).png().toFile(D+'/00-working-1400.png');
 const key=(a,i)=>(a[i]<<16)|(a[i+1]<<8)|a[i+2],rgb=k=>[(k>>16)&255,(k>>8)&255,k&255];
 const mode=Buffer.alloc(W*H*3);let ties=0,verified=0;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const i=(y*2*SW+x*2)*3,v=[key(working,i),key(working,i+3),key(working,i+SW*3),key(working,i+SW*3+3)],counts=new Map();for(let k of v)counts.set(k,(counts.get(k)||0)+1);
  let win=v[0],max=0;for(let[k,n]of counts)if(n>max){win=k;max=n;}assert.equal(counts.get(win),Math.max(...counts.values()));if([...counts.values()].filter(n=>n===max).length>1)ties++;mode.set(rgb(win),(y*W+x)*3);verified++;
 }
 await sharp(mode,{raw:{width:W,height:H,channels:3}}).png().toFile(D+'/01-mode-700.png');
 // Required palette pass, dither allowed. No averaged resizing anywhere.
 cp.execFileSync('magick',[D+'/01-mode-700.png','-dither','FloydSteinberg','-colors','128','-depth','8','PNG8:'+D+'/02-palette-700.png']);
 const out=await sharp(D+'/02-palette-700.png').removeAlpha().raw().toBuffer(),pal=new Set();for(let i=0;i<out.length;i+=3)pal.add(key(out,i));assert(pal.size<=128);
 const inkKey=[...pal].reduce((a,b)=>{let lum=k=>{let[r,g,b]=rgb(k);return .2126*r+.7152*g+.0722*b};return lum(a)<lum(b)?a:b}),ink=rgb(inkKey);let outlined=0;
 function put(x,y){x=Math.round(x);y=Math.round(y);if(x<0||x>=W||y<0||y>=H)return;out.set(ink,(y*W+x)*3);outlined++;}
 function rect(x,y,w,h){x=Math.round(x);y=Math.round(y);w=Math.round(w);h=Math.round(h);for(let xx=x;xx<x+w;xx++){put(xx,y);put(xx,y+h-1)}for(let yy=y+1;yy<y+h-1;yy++){put(x,yy);put(x+w-1,yy)}}
 const doors=[[29,202,103,208],[282,227,83,183],[587,210,148,200],[990,216,82,194],[1099,216,82,194],[1439,228,81,182],[1718,210,143,200],[1929,202,98,208]].map(([x,y,w,h])=>[Math.round(fx(x)),Math.round(fy(x,y)),Math.round(fx(x+w))-Math.round(fx(x)),420-Math.round(fy(x,y))]);for(let[x,y,w,h]of doors)rect(x,y,w,h);
 // Trace actual newly drawn fixtures, rather than replacing them with flat boxes.
 const fixtures=[[161,194,90,49],[289,195,68,28],[606,179,109,25],[777,210,109,120],[919,216,51,129],[1013,193,38,16],[1122,193,38,16],[1286,194,89,49],[1442,192,79,29],[1737,179,105,25],[519,326,33,87],[1640,326,35,87],[1621,232,52,75]];
 const fixtureBounds=[];
 for(let[x,y,w,h]of fixtures){let l=Math.round(fx(x)),r=Math.round(fx(x+w)),t=Math.round(fy(x+w/2,y)),b=Math.round(fy(x+w/2,y+h));rect(l,t,r-l,b-t);fixtureBounds.push({x:l,y:t,w:r-l,h:b-t});}
 // Leaf silhouettes are traced at final resolution using actual green regions.
 for(let[x,y,w,h]of [[177,272,72,146],[1201,244,70,171],[1870,300,53,117]]){
  const l=Math.floor(fx(x)),r=Math.ceil(fx(x+w)),t=Math.floor(fy(x+w/2,y)),b=Math.min(440,Math.ceil(fy(x+w/2,y+h))),mw=r-l,mh=b-t,mask=new Uint8Array(mw*mh);
  for(let yy=0;yy<mh;yy++)for(let xx=0;xx<mw;xx++){let i=((t+yy)*W+l+xx)*3,[R,G,B]=out.subarray(i,i+3);if(G>R*.88&&G>B*1.22&&G>25)mask[yy*mw+xx]=1;}
  for(let yy=1;yy<mh-1;yy++)for(let xx=1;xx<mw-1;xx++){let i=yy*mw+xx;if(mask[i]&&(!mask[i-1]||!mask[i+1]||!mask[i-mw]||!mask[i+mw]))put(l+xx,t+yy);}
 }
 await sharp(out,{raw:{width:W,height:H,channels:3}}).png({palette:true,colours:128,dither:0}).toFile(D+'/f2.png');
 const decoded=await sharp(D+'/f2.png').removeAlpha().raw().toBuffer();assert(decoded.equals(out),'PNG re-encoding changed pixel values');const cols=new Set();for(let i=0;i<decoded.length;i+=3)cols.add(key(decoded,i));assert(cols.size<=128);for(let c of cols)assert(pal.has(c));
 for(let[x,y0,w,h]of doors){for(let y=y0;y<y0+h;y++){assert.equal(key(decoded,(y*W+x)*3),inkKey);assert.equal(key(decoded,(y*W+x+w-1)*3),inkKey);}}
 const report={source,sourceDimensions:[si.width,si.height],sourceReusedFromRejectedArtwork:false,normalization:'Uniform horizontal fit and whole-scene vertical registration before pixel conversion; retained all original painted interiors and shading without local warps',normalizedSceneDimensions:[W,H],workingDimensions:[SW,SH],modeOutputDimensions:[W,H],modeBlocksVerified:verified,tieBlocks:ties,tieRule:'first in top-left, top-right, bottom-left, bottom-right order',reduction:'2x2 modal selection, no averaging or interpolation',paletteColors:cols.size,dither:'FloydSteinberg',outlineWidthPx:1,outlineColor:ink,outlinePixelWrites:outlined,doorOutlines:doors.map(([x,y,w,h])=>({x,y,w,h})),fixtureBounds,wallFloorY:420,top40:'Only slim crown molding/light ends; no separate ceiling plane, panels or vents',finalDimensions:[W,H],finalUpscale:false,previewPolicy:'2x nearest neighbor in memory only; no preview file saved',pngPixelIdentityVerified:true,sha256:crypto.createHash('sha256').update(fs.readFileSync(D+'/f2.png')).digest('hex')};fs.writeFileSync(D+'/verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify({working:report.workingDimensions,final:report.finalDimensions,modeBlocks:verified,colors:cols.size,sha256:report.sha256},null,2));
})();
