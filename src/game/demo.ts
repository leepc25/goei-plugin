// 브라우저 시험용: 가짜 host로 게임을 붙인다. 저장은 메모리에만 (?w=390&h=760 으로 창 크기)
import { mountGame, type GameHost } from './index';

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
};
let close = mountGame(box, host);
Object.assign(window, {
  __reopen: () => (close(), (close = mountGame(box, host))),
  __close: () => close(),
  __saved: () => saved,
  __wait: (w: boolean) => ((waiting = w), subs.forEach((f) => f(w))),
});
