import {mountAction} from './index';
import {demoArt} from './demo-art';
const art=demoArt();
const host={load:async()=>null,save:async(_data:string)=>{},waiting:()=>false,
  onWaiting:(_cb:(w:boolean)=>void)=>()=>{},narrow:()=>innerWidth<760,art:()=>art};
const close=mountAction(document.getElementById('box')!,host);
window.addEventListener('pagehide',close,{once:true});
