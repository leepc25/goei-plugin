// 기다리는 동안 대전 시험판 (11-08 사용자): Risu 본문 칸 위에 투명하게 띄우는 1:1 대전.
// 배경·바닥을 그리지 않고(view.clear) 인물·이펙트만 그린다. 플러그인 연결 전 확인용 단독 페이지.
// 열기: GOEI_GAME=1 node scripts/build.mjs → 저장소 맨 위에서 정적 서버 → dist/goei-waitfight.html?char=에일린&foe=쟈알디
import { mountGame } from '../main';
import { loadChar } from '../art/charPacks';
import { view } from '../engine/view';
import type { GameAssets } from '../../bridge';

const q = new URLSearchParams(location.search);
if (!q.get('start')) {
  q.set('start', 'stage=versus');
  history.replaceState(null, '', `${location.pathname}?${q}`);
}
const base = new URL(q.get('packs') ?? '../game-pack/', location.href).href.replace(/\/?$/, '/');
const at = (pack: string, f: string) => `${base}${pack}/${f}`;
const assets: GameAssets = {
  ready: async (pack) => (await fetch(at(pack, 'pack.json')).catch(() => null))?.ok ?? false,
  url: async (pack, f) => at(pack, f),
  bytes: async (pack, f) => { const r = await fetch(at(pack, f)).catch(() => null); return r?.ok ? new Uint8Array(await r.arrayBuffer()) : null; },
  atlas: async () => null,
  list: async () => [],
};

view.clear = true;
document.head.insertAdjacentHTML('beforeend', `<style>
html,body{margin:0;height:100%;background:transparent!important;overflow:hidden}
#box{position:fixed;inset:0}
.goei-engine,.gs,.gs-stage{background:transparent!important}
.gs-touch,.tp{display:none!important}
</style>`);
document.body.innerHTML = '<div id="box"></div>';
const box = document.getElementById('box')!;
const foe = q.get('foe');
// 상대 팩을 먼저 받아 둬야 첫 판에 바로 나온다 (팩이 없으면 임시 적이 나온다)
void (async () => {
  if (foe) await loadChar(foe).catch(() => null);
  mountGame(box, { assets } as never);
})();
