import { mountAction } from './index';
import {demoArt} from './demo-art';
const art=demoArt();
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
