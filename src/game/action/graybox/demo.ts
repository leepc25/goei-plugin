import { mountGraybox } from './index';
const box = document.getElementById('box')!;
const q = new URLSearchParams(location.search);
box.style.width = `${q.get('w') ?? 1280}px`;
box.style.height = `${q.get('h') ?? 900}px`;
const KEY = 'goei-graybox:v1';
let close = mountGraybox(box, {
  load: async () => localStorage.getItem(KEY),
  save: async (d) => {
    localStorage.setItem(KEY, d);
  },
  narrow: () => box.clientWidth < 760,
});
Object.assign(window, { __reopen: () => (close(), (close = mountGraybox(box, { load: async () => localStorage.getItem(KEY), save: async (d) => { localStorage.setItem(KEY, d); }, narrow: () => box.clientWidth < 760 }))), __close: () => close() });
