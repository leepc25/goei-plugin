// 기다리는 동안 대전 시험판 (11-08 사용자): Risu 본문 칸 위에 투명하게 띄우는 대전.
// 배경·바닥을 그리지 않고(view.clear) 인물·이펙트만 그린다. 플러그인 연결 전 확인용 단독 페이지.
// 열기: GOEI_GAME=1 node scripts/build.mjs → 저장소 맨 위에서 정적 서버 → dist/goei-waitfight.html
// 자료: dist/vs-src/ (tools/build_vs_packs.py 가 만든 대전 공용 팩·인물 전투 팩, 낱개 파일)
import { startVersus } from '../../versus';
import type { GameAssets } from '../../bridge';

const q = new URLSearchParams(location.search);
const base = new URL(q.get('packs') ?? './vs-src/', location.href).href.replace(/\/?$/, '/');
const at = (pack: string, f: string) => `${base}${pack}/${f}`;
// ?bundle=<확장자> (시연판 공유용, 1이면 bin): 팩마다 낱개 파일 대신 한 파일(<팩>.<확장자> = 4바이트 머리 길이 + JSON 목록 + 자료)로 받는다.
// 아티팩트는 bin 을 못 올려서 wasm 확장자로 올린다(내용은 같음)
const bundleExt = q.get('bundle') === '1' ? 'bin' : q.get('bundle');
const MIME: Record<string, string> = { webp: 'image/webp', png: 'image/png', json: 'application/json', mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav' };
const bundles = new Map<string, Promise<Map<string, Uint8Array> | null>>();
const bundle = (pack: string) => {
  let b = bundles.get(pack);
  if (!b) {
    b = fetch(`${base}${pack}.${bundleExt}`).then(async (r) => {
      if (!r.ok) return null;
      const buf = new Uint8Array(await r.arrayBuffer()), n = new DataView(buf.buffer).getUint32(0, true);
      const list = JSON.parse(new TextDecoder().decode(buf.subarray(4, 4 + n))) as [string, number, number][];
      return new Map(list.map(([f, o, l]) => [f, buf.subarray(4 + n + o, 4 + n + o + l)]));
    }).catch(() => null);
    bundles.set(pack, b);
  }
  return b;
};
const blobUrls = new Map<string, string>();
const assets: GameAssets = bundleExt ? {
  ready: async (pack) => !!(await bundle(pack))?.has('pack.json'),
  url: async (pack, f) => {
    const k = `${pack}/${f}`, hit = blobUrls.get(k);
    if (hit) return hit;
    const d = (await bundle(pack))?.get(f);
    if (!d) return null as never;
    const u = URL.createObjectURL(new Blob([d as Uint8Array<ArrayBuffer>], { type: MIME[f.split('.').pop() ?? ''] ?? 'application/octet-stream' }));
    blobUrls.set(k, u);
    return u;
  },
  bytes: async (pack, f) => (await bundle(pack))?.get(f) ?? null,
  atlas: async () => null,
  list: async () => [],
} : {
  ready: async (pack) => (await fetch(at(pack, 'pack.json')).catch(() => null))?.ok ?? false,
  url: async (pack, f) => at(pack, f),
  bytes: async (pack, f) => { const r = await fetch(at(pack, f)).catch(() => null); return r?.ok ? new Uint8Array(await r.arrayBuffer()) : null; },
  atlas: async () => null,
  list: async () => [],
};

document.head.insertAdjacentHTML('beforeend', `<style>
html,body{margin:0;height:100%;background:transparent!important;overflow:hidden}
#box{position:fixed;inset:0}
.goei-engine,.gs,.gs-stage{background:transparent!important}
.gs-touch,.tp{display:none!important}
</style>`);
document.body.innerHTML = '<div id="box"></div>';
// 시험: 주소 ?bg=장면 id 로 배경 (설정 「배경」 대신)
const bgParam = new URLSearchParams(location.search).get('bg') ?? (() => { try { return new URLSearchParams(parent.location.search).get('bg'); } catch { return null; } })();
// 시험: ?pick=1P,2P(쉼표, 태그는 1P|1P|1P,2P|2P|2P)&mode=duel|team|survival&auto=1 (1P 도 AI) 로 고르기 창 건너뛰기
const pickQ = q.get('pick');
const test = pickQ ? { pick: { mode: (q.get('mode') ?? 'duel') as never, me: pickQ.split(',')[0].split('|'), foe: (pickQ.split(',')[1] ?? '').split('|').filter(Boolean) }, auto: q.get('auto') === '1' } : undefined;
const h = startVersus(document.getElementById('box')!, assets, { onClose: () => console.log('[vs] 닫기'), bg: () => bgParam ?? undefined, wide: () => q.get('wide') === '1', test });
(globalThis as { __vs?: unknown }).__vs = h;
