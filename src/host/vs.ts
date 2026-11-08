// 기다리는 동안 대전 (11-08 사용자): 플러그인 창(iframe)을 채팅 본문 칸 위로 옮겨 투명하게 깔고 대전을 띄운다.
// - 자료: release/vs/ (index.json · goei-vs.N.txt 코드 · vs-common · vs-<번호> 팩). 저장은 goei:vs:* (설치 정리가 goei:game:* 를 지우므로 따로)
// - 데이터(코드·이펙트·얼굴판·명단·인물 126명 전투 동작, 약 100MB)는 설정 「대전」에서 한 번에 미리 받는다 (11-08 사용자)
// - 싸우는 동안 창은 누르기를 통과시켜(pointer-events:none) 본문 스크롤·읽기가 그대로 되고, 키는 창이 초점을 가져 받는다
// - 닫으면(게임패드 단추를 다시 누르거나 Esc) 멈추고 숨긴다. 다시 열면 이어서 (채팅마다)
import { UPDATE_BASE } from '../core/update';
import { GameFileError, getParts, type PackEntry } from './game/fetch';
import { createPackStore } from './game/packs';
import type { VersusModule } from '../game/versus/entry';
import type { VersusHandle } from '../game/versus/index';

const VS_BASE = UPDATE_BASE ? `${UPDATE_BASE}/vs` : '';
const CODE_KEY = 'goei:vs:code';
const VERSION: string = typeof __PLUGIN_VERSION__ === 'string' ? __PLUGIN_VERSION__ : '';
declare const __PLUGIN_VERSION__: string | undefined;
const COMMON = 'vs-common';

export interface VsIndex { version: string; code: { parts: string[]; length: number }; packs: PackEntry[] }
let index: Promise<VsIndex> | null = null;
export function vsIndex(): Promise<VsIndex> {
  index ??= (async () => {
    let v: VsIndex;
    try {
      v = JSON.parse((await getTextFrom('index.json'))) as VsIndex;
    } catch {
      throw new GameFileError('대전 자료 목록을 받지 못했어요.');
    }
    if (!v || !Array.isArray(v.code?.parts) || !Array.isArray(v.packs)) throw new GameFileError('대전 자료 목록이 올바르지 않아요.');
    return v;
  })();
  index.catch(() => (index = null));
  return index;
}
const getTextFrom = async (name: string) => new TextDecoder().decode(await getParts([name], undefined, VS_BASE)).replace(/^﻿/, '');

const store = createPackStore({ key: (id) => `goei:vs:pack:${id}`, index: vsIndex, base: VS_BASE });

/* ───────── 자료 상태·받기 (설정 「대전」) ───────── */

const codeVersion = (code: string) => /^\/\/ goei-vs (\S+)/.exec(code)?.[1] ?? null;
async function savedCode(): Promise<string | null> {
  try {
    const v: unknown = await risuai.pluginStorage.getItem(CODE_KEY);
    return typeof v === 'string' && codeVersion(v) === VERSION ? v : null;
  } catch {
    return null;
  }
}

/** 받은 목록 (작은 값): 팩마다 지문. 상태를 볼 때 큰 팩을 읽지 않으려고 따로 둔다 */
const HAVE_KEY = 'goei:vs:have';
async function have(): Promise<Record<string, string>> {
  try {
    const v: unknown = await risuai.pluginStorage.getItem(HAVE_KEY);
    const o = typeof v === 'string' ? (JSON.parse(v) as unknown) : null;
    return o && typeof o === 'object' ? (o as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export interface VsDataState {
  /** 다 받았나 / 일부(옛 판 포함) / 없음 */
  state: 'ready' | 'partial' | 'none';
  /** 받은 팩 수 / 전체 팩 수 (공용 1 + 인물 126) */
  done: number;
  total: number;
  /** 전부 크기 (바이트) */
  bytes: number;
}

export async function vsDataState(): Promise<VsDataState> {
  const idx = await vsIndex();
  const h = await have();
  const code = await savedCode();
  const done = idx.packs.filter((p) => h[p.id] === p.hash).length;
  const bytes = idx.packs.reduce((n, p) => n + p.bytes, 0) + idx.code.length;
  const all = done === idx.packs.length && !!code;
  return { state: all ? 'ready' : done || code ? 'partial' : 'none', done, total: idx.packs.length, bytes };
}

/** 다 받아 두었나 (게임패드 단추: 목록을 받지 않고 이 기기에 적힌 것만 본다) */
async function vsReady(): Promise<boolean> {
  const h = await have();
  return !!(await savedCode()) && h.__complete === VERSION;
}

/** 전부 받기 (11-08 사용자: 데이터는 미리 받아 둔다): 코드 + 공용 + 인물 126명. 받은 팩은 건너뛴다 */
export async function downloadVsAll(onProgress?: (done: number, total: number) => void): Promise<void> {
  const idx = await vsIndex();
  if (idx.version !== VERSION) throw new GameFileError('아직 이 판의 대전 데이터가 올라오지 않았어요. 잠시 뒤 다시 받아 주세요.');
  const h = await have();
  const todo = idx.packs.filter((p) => h[p.id] !== p.hash);
  const needCode = !(await savedCode());
  const total = todo.length + (needCode ? 1 : 0);
  let done = 0;
  onProgress?.(done, total);
  if (needCode) {
    const code = new TextDecoder().decode(await getParts(idx.code.parts, undefined, VS_BASE));
    if (code.length !== idx.code.length || codeVersion(code) !== VERSION) throw new GameFileError('대전 코드를 끝까지 받지 못했어요.');
    await risuai.pluginStorage.setItem(CODE_KEY, code);
    mod = null;
    onProgress?.(++done, total);
  }
  // 공용 먼저, 그다음 인물
  todo.sort((x, y) => (x.id === COMMON ? -1 : y.id === COMMON ? 1 : 0));
  for (const p of todo) {
    await store.downloadGamePack(p);
    if (p.id !== COMMON) store.forget(p.id);
    h[p.id] = p.hash;
    await risuai.pluginStorage.setItem(HAVE_KEY, JSON.stringify(h));
    onProgress?.(++done, total);
  }
  h.__complete = VERSION;
  await risuai.pluginStorage.setItem(HAVE_KEY, JSON.stringify(h));
}

/* ───────── 코드 실행 ───────── */

let mod: VersusModule | null = null;
async function loadVsCode(): Promise<VersusModule> {
  if (mod) return mod;
  const code = await savedCode();
  if (!code) throw new GameFileError('대전 자료를 먼저 받아 주세요.');
  const g = globalThis as unknown as { __goeiVersus?: VersusModule };
  delete g.__goeiVersus;
  // Risu 플러그인 칸은 eval·blob 스크립트를 막는다: 이 플러그인 스크립트의 nonce 를 붙인 script 로 (host/game/code.ts 와 같은 길)
  const nonce = [...document.querySelectorAll('script')].map((s) => s.nonce).find(Boolean);
  const s = document.createElement('script');
  if (nonce) s.nonce = nonce;
  s.textContent = code;
  document.head.append(s);
  s.remove();
  const api = (g as { __goeiVersus?: VersusModule }).__goeiVersus;
  delete g.__goeiVersus;
  if (!api || typeof api.start !== 'function') throw new GameFileError('대전 코드를 실행하지 못했어요.');
  mod = api;
  return api;
}

/* ───────── 창 띄우기 ───────── */

const CSS = `
html.goei-vs-on, html.goei-vs-on body { background: transparent !important; }
html.goei-vs-on body > :not(#goei-vs) { display: none !important; }
#goei-vs { position: fixed; inset: 0; display: none; }
html.goei-vs-on #goei-vs { display: block; }
#goei-vs .goei-engine, #goei-vs .gs, #goei-vs .gs-stage { background: transparent !important; }
#goei-vs .gs-touch, #goei-vs .tp { display: none !important; }
`;

let box: HTMLElement | null = null;
let handle: VersusHandle | null = null;
let chatKey = '';
let open = false;
let fitTimer: ReturnType<typeof setInterval> | undefined;
let frame: SafeElement | null = null;
let clickId: { target: SafeElement; id: string } | null = null;
/** 창이 원래 가지던 모양 (닫을 때 되돌린다) */
const KEEP = ['top', 'left', 'width', 'height', 'pointerEvents', 'background', 'backgroundColor', 'colorScheme'];
let saved: Record<string, string> = {};

/** PC 인가 (폰에서는 쓰지 않는다, 11-08 사용자) */
export const vsDevice = () => matchMedia('(hover: hover) and (pointer: fine)').matches;
export const vsOpen = () => open;

async function rootDoc(): Promise<SafeDocument | null> {
  return risuai.getRootDocument().catch(() => null);
}

/** 우리 창(iframe): 보이는 것 가운데 z-index 가 우리가 정한 49·Risu 기본 1000 인 것 */
async function ourFrame(doc: SafeDocument): Promise<SafeElement | null> {
  const list = await doc.querySelectorAll('body > iframe');
  const n = await list.length();
  for (let i = 0; i < n; i++) {
    const f = await list.at(i);
    if (!f) continue;
    const z = await f.getStyle('zIndex');
    if ((z === '49' || z === '1000') && (await f.getStyle('display')) !== 'none') return f;
  }
  return null;
}

/** 채팅 본문 칸 = Risu 채팅 화면에서 입력창 위까지 */
async function chatRect(doc: SafeDocument): Promise<{ left: number; top: number; width: number; height: number } | null> {
  const screen = await doc.querySelector('.default-chat-screen');
  if (!screen) return null;
  const r = await screen.getBoundingClientRect();
  let bottom = r.bottom;
  const input = await screen.querySelector('textarea');
  if (input) {
    const ir = await input.getBoundingClientRect();
    if (ir.height > 0 && ir.top > r.top + 100) bottom = Math.min(bottom, ir.top - 8);
  }
  return { left: r.left, top: r.top, width: r.width, height: Math.max(200, bottom - r.top) };
}

async function fit(doc: SafeDocument): Promise<boolean> {
  if (!frame) return false;
  const r = await chatRect(doc);
  if (!r) return false;
  await frame.setStyle('top', `${Math.round(r.top)}px`);
  await frame.setStyle('left', `${Math.round(r.left)}px`);
  await frame.setStyle('width', `${Math.round(r.width)}px`);
  await frame.setStyle('height', `${Math.round(r.height)}px`);
  return true;
}

/** 고르기 창이 떠 있는 동안은 누르기를 받고, 싸우는 동안은 통과시킨다 */
async function setPass(pass: boolean) {
  await frame?.setStyle('pointerEvents', pass ? 'none' : 'auto').catch(() => {});
}

/**
 * 게임패드 단추: 닫혀 있으면 열고, 열려 있으면 멈추고 닫는다.
 * 공용 자료가 없으면 goSettings 로 설정 「대전」을 연다.
 */
export async function toggleVersus(key: string, goSettings: () => void): Promise<void> {
  if (open) return closeVersus();
  if (!(await vsReady())) { goSettings(); return; }
  const doc = await rootDoc();
  if (!doc) { goSettings(); return; }
  let m: VersusModule;
  try { m = await loadVsCode(); } catch (e) { console.log('[goei] 대전 코드', e); goSettings(); return; }
  // 채팅이 바뀌었으면 새 판 (멈춘 판은 그 채팅 것)
  if (handle && chatKey !== key) { handle.destroy(); handle = null; box?.remove(); box = null; }
  chatKey = key;
  if (!document.getElementById('goei-vs-css')) {
    const st = document.createElement('style');
    st.id = 'goei-vs-css';
    st.textContent = CSS;
    document.head.append(st);
  }
  if (!box) {
    box = document.createElement('div');
    box.id = 'goei-vs';
    document.body.append(box);
  }
  document.documentElement.classList.add('goei-vs-on');
  await risuai.showContainer('fullscreen');
  frame = await ourFrame(doc);
  if (frame) {
    saved = {};
    for (const k of KEEP) saved[k] = await frame.getStyle(k).catch(() => '');
    await frame.setStyle('background', 'transparent');
    await frame.setStyle('backgroundColor', 'transparent');
    await frame.setStyle('colorScheme', 'normal');
    await frame.setStyle('zIndex', '49');
    await fit(doc);
  }
  open = true;
  if (!handle) {
    handle = m.start(box, store.assets, { onClose: () => void closeVersus() });
  } else handle.resume();
  // 고르기 창이 있으면 누르기를 받는다 (얼굴 누르기). 경기 중이면 통과
  const syncPass = () => void setPass(!box?.querySelector('.vs-sel'));
  syncPass();
  clearInterval(fitTimer);
  fitTimer = setInterval(() => { if (open) { void fit(doc); syncPass(); } }, 700);
  // 본문을 누르면 초점이 Risu 로 넘어가므로 창으로 되돌린다 (키를 받으려면 초점이 있어야 한다)
  const take = () => { void frame?.focus().catch(() => {}); window.focus(); };
  take();
  if (!clickId) {
    const target = doc as unknown as SafeElement;
    if (typeof target.addEventListener === 'function') {
      clickId = { target, id: await target.addEventListener('pointerup', () => { if (open) setTimeout(take, 0); }, { passive: true }) };
    }
  }
  window.addEventListener('keydown', onEsc, true);
}

function onEsc(e: KeyboardEvent) {
  // 고르기 창의 Esc 는 고르기 창이 받아 onClose 로 닫는다. 경기 중 Esc 는 여기서
  if (e.key !== 'Escape' || !open || box?.querySelector('.vs-sel')) return;
  e.preventDefault();
  void closeVersus();
}

/** 멈추고 숨긴다 (다시 열면 이어서) */
export async function closeVersus(): Promise<void> {
  if (!open) return;
  open = false;
  clearInterval(fitTimer);
  window.removeEventListener('keydown', onEsc, true);
  handle?.pause();
  if (clickId) { await clickId.target.removeEventListener('pointerup', clickId.id).catch(() => {}); clickId = null; }
  document.documentElement.classList.remove('goei-vs-on');
  if (frame) for (const [k, v] of Object.entries(saved)) await frame.setStyle(k, v).catch(() => {});
  frame = null;
  await risuai.hideContainer();
}

/** 본 창(설정 등)을 열기 전에: 대전이 떠 있으면 멈추고 창 모양을 되돌린다 */
export async function yieldVersus(): Promise<void> {
  if (open) await closeVersus();
}
