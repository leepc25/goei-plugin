// 대전 코드 팩 진입점 (11-08): 빌드가 dist/vs/goei-vs.N.txt 로 나눠 올리고, 플러그인(src/host/vs.ts)이 받아 실행하면
// globalThis.__goeiVersus 를 남긴다. 필드 게임 코드(entry.ts)와 따로라, 대전만 쓰는 사람은 필드 코드를 받지 않는다.
import { startVersus, type VersusHandle } from './index';
import type { GameAssets } from '../bridge';

declare const __PLUGIN_VERSION__: string;

export interface VersusModule {
  version: string;
  start(box: HTMLElement, assets: GameAssets, opts?: { onClose?: () => void; bg?: () => string | undefined; wide?: () => boolean }): VersusHandle;
}

// Risu 플러그인 iframe 은 localStorage 를 읽기만 해도 막힐 수 있다 (entry.ts 와 같은 대신 저장소)
try {
  void globalThis.localStorage?.length;
} catch {
  const m = new Map<string, string>();
  const mem = { get length() { return m.size; }, key: (i: number) => [...m.keys()][i] ?? null, getItem: (k: string) => m.get(String(k)) ?? null, setItem: (k: string, v: string) => void m.set(String(k), String(v)), removeItem: (k: string) => void m.delete(String(k)), clear: () => m.clear() };
  for (const name of ['localStorage', 'sessionStorage']) {
    try { Object.defineProperty(globalThis, name, { value: mem, configurable: true }); } catch { /* 그대로 */ }
  }
}

const mod: VersusModule = { version: __PLUGIN_VERSION__, start: startVersus };
(globalThis as unknown as { __goeiVersus?: VersusModule }).__goeiVersus = mod;
