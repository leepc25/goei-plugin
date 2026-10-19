import { parsePack, type GameArt } from '../assets';
/** 독립 HTML은 같은 아틀라스를 인라인 제공한다. 개발 페이지는 별도 팩을 읽는다. */
export async function demoArt():Promise<GameArt>{
  const embedded=(window as unknown as {__GOEI_ACTION_ART__?:{atlas:GameArt['atlas'];files:Record<string,string>}}).__GOEI_ACTION_ART__;
  if(embedded)return {atlas:embedded.atlas,url:(name)=>embedded.files[name]??''};
  const response=await fetch('../../dist-test/goei-game-action.pack');
  if(!response.ok)throw new Error('액션 그림 팩을 찾지 못했습니다. 먼저 빌드해 주세요.');
  const pack=parsePack(new Uint8Array(await response.arrayBuffer()),['a-jyaldi-action','bg-bureau-action','e-corner','e-watchman']);
  if(!pack)throw new Error('그림 팩을 읽지 못했습니다');
  const urls=new Map([...pack.files].map(([name,data])=>[name,URL.createObjectURL(new Blob([data as BlobPart],{type:'image/png'}))]));
  window.addEventListener('pagehide',()=>urls.forEach(url=>URL.revokeObjectURL(url)),{once:true});
  return {atlas:pack.atlas,url:(name)=>urls.get(name)??''};
}
