import { parsePack, type GameArt } from '../assets';
import { mountAction } from './index';
const embedded = (
  window as unknown as { __GOEI_ACTION_ART__?: { atlas: GameArt['atlas']; files: Record<string, string> } }
).__GOEI_ACTION_ART__;
const art: Promise<GameArt> = embedded
  ? Promise.resolve({ atlas: embedded.atlas, url: (name: string) => embedded.files[name] ?? '' })
  : fetch('../../dist-test/goei-game-patrol.pack').then(async (response) => {
      const pack = parsePack(new Uint8Array(await response.arrayBuffer()));
      if (!pack) throw new Error('그림 팩을 읽지 못했습니다');
      const urls = new Map(
        [...pack.files].map(([k, v]) => [k, URL.createObjectURL(new Blob([v as BlobPart], { type: 'image/png' }))]),
      );
      return { atlas: pack.atlas, url: (name: string) => urls.get(name) ?? '' };
    });
const box = document.getElementById('box')!,
  query = new URLSearchParams(location.search);
box.style.width = `${query.get('w') ?? 1280}px`;
box.style.height = `${query.get('h') ?? 900}px`;
const listeners = new Set<(w: boolean) => void>();
let waiting = false;
const host = {
  load: async () => localStorage.getItem('goei-action-demo:v1'),
  save: async (data: string) => {
    localStorage.setItem('goei-action-demo:v1', data);
  },
  waiting: () => waiting,
  onWaiting: (cb: (w: boolean) => void) => {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
  narrow: () => box.clientWidth < 760,
  art: () => art,
};
let close = mountAction(box, host);
Object.assign(window, {
  __reopen: () => {
    close();
    close = mountAction(box, host);
  },
  __close: () => close(),
  __wait: (w: boolean) => {
    waiting = w;
    listeners.forEach((cb) => cb(w));
  },
});
