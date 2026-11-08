// 가짜 risuai (플러그인 칸 안에서): 본 문서(parent)를 SafeElement 처럼 감싸 준다. 받기는 fetch 로 dist/vs 에서
(() => {
  const P = window.parent.document;
  const wrap = (el) => el && ({
    _el: el,
    querySelector: async (s) => wrap(el.querySelector(s)),
    querySelectorAll: async (s) => { const l = [...el.querySelectorAll(s)]; return { length: async () => l.length, at: async (i) => wrap(l[i]) }; },
    getStyle: async (k) => el.style[k] || getComputedStyle(el)[k],
    setStyle: async (k, v) => { el.style[k] = v; },
    getBoundingClientRect: async () => el.getBoundingClientRect().toJSON(),
    focus: async () => el.focus(),
    addEventListener: async (t, fn) => { const id = String(Math.random()); el.addEventListener(t, (e) => fn({ clientX: e.clientX, clientY: e.clientY })); return id; },
    removeEventListener: async () => {},
  });
  const store = new Map();
  const frame = window.frameElement;
  window.risuai = {
    getRootDocument: async () => wrap(P),
    showContainer: async () => { Object.assign(frame.style, { display: 'block', zIndex: '1000', top: '0', left: '0', width: '100vw', height: '100vh' }); },
    hideContainer: async () => { frame.style.display = 'none'; },
    pluginStorage: { getItem: async (k) => store.get(k) ?? null, setItem: async (k, v) => void store.set(k, v), removeItem: async (k) => void store.delete(k), keys: async () => [...store.keys()] },
    nativeFetch: async (url) => fetch(url.replace(/\?t=\d+$/, '')),
  };
})();
