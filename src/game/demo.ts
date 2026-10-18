// 브라우저 시험용: 가짜 host로 게임을 붙인다. 저장은 메모리에만 (?w=390&h=760 으로 창 크기)
import { parsePack, type GameArt } from './assets';
import { mountGame, type GameHost } from './index';

// 그림은 빌드가 만든 팩 파일을 받아 푼다 (실제 플러그인은 Risu 에셋 저장소에서 읽는다)
const art: Promise<GameArt> = fetch('../../dist-test/goei-game-patrol.pack')
  .then((r) => r.arrayBuffer())
  .then((b) => {
    const pack = parsePack(new Uint8Array(b))!;
    const urls = new Map([...pack.files].map(([k, v]) => [k, URL.createObjectURL(new Blob([v as BlobPart], { type: 'image/png' }))]));
    return { atlas: pack.atlas, url: (f: string) => urls.get(f) ?? '' };
  });

const q = new URLSearchParams(location.search);
const box = document.getElementById('box')!;
box.style.width = `${q.get('w') ?? 1000}px`;
box.style.height = `${q.get('h') ?? 760}px`;
let saved: string | null = q.get('save');
let waiting = false;
const subs = new Set<(w: boolean) => void>();
const host: GameHost = {
  load: async () => saved,
  save: async (d) => void ((saved = d), ((window as unknown as { __saves: number }).__saves = ((window as unknown as { __saves: number }).__saves ?? 0) + 1)),
  waiting: () => waiting,
  onWaiting: (cb) => (subs.add(cb), () => subs.delete(cb)),
  narrow: () => box.clientWidth <= 760,
  art: () => art,
};
let close = mountGame(box, host);
Object.assign(window, {
  __reopen: () => (close(), (close = mountGame(box, host))),
  __close: () => close(),
  __saved: () => saved,
  __wait: (w: boolean) => ((waiting = w), subs.forEach((f) => f(w))),
});
