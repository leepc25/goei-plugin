// 설정 → 「업데이트」: 저장소의 최신 카드·플러그인 버전을 확인하고, 카드는 이 창에서 바로 갱신한다.
import { cardVersion, compareVersions, isPayload, planUpdate, PLUGIN_VERSION, UPDATE_BASE, type CardPayload, type UpdatePlan } from '../core/update';
import { readManifest } from '../core/start';
import type { ChatContext } from '../host/risu';
import type { SettingsEnv } from './settings';

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

interface Latest { card: string; plugin: string; minPlugin: string }

export const updateUi: {
  busy: boolean;
  notice: string;
  latest: Latest | null;
  payload: CardPayload | null;
  plan: UpdatePlan | null;
  done: string;
} = { busy: false, notice: '', latest: null, payload: null, plan: null, done: '' };

let checked = false;
/** 「건너뛰기」한 버전 ("카드|플러그인"). 같은 조합이면 안내를 다시 띄우지 않는다 */
let skipped = '';
const SKIP_KEY = 'goei:update-skip';

/**
 * 웹 Risu의 nativeFetch는 모든 GET을 같은 프록시 주소로 보내서, 브라우저가 앞서 받은 응답(5분 캐시)을
 * 다른 파일 요청에도 그대로 돌려준다(카드 파일을 달라 했는데 version.json이 옴).
 * 그래서 Risu 본 화면에서 직접 받는 risuFetch(plainFetchForce)를 먼저 쓰고, 안 되면 nativeFetch로 받는다.
 */
async function getText(name: string): Promise<string> {
  const url = `${UPDATE_BASE}/${name}?t=${Date.now()}`;
  const legacy = (risuai as unknown as { risuFetch?: RisuFetch }).risuFetch;
  lastDirect = legacy ? '' : 'risuFetch 없음';
  if (legacy) {
    try {
      // Content-Type을 text/plain으로 둬야 CORS 사전 요청 없이 GitHub에서 바로 받는다
      const r = await legacy(url, { method: 'GET', plainFetchForce: true, rawResponse: true, headers: { 'Content-Type': 'text/plain' } });
      if (r?.ok && r.data instanceof Uint8Array) return new TextDecoder().decode(r.data);
      lastDirect = `직접 받기 ${r?.status}: ${String(typeof r?.data === 'string' ? r.data : Object.prototype.toString.call(r?.data)).slice(0, 80)}`;
    } catch (error) {
      lastDirect = `직접 받기 오류: ${String(error).slice(0, 80)}`;
    }
  }
  const res = await risuai.nativeFetch(url, { method: 'GET' }).catch((e: unknown) => {
    throw new Error(`업데이트 정보를 받지 못했어요. (${String(e)}; ${lastDirect})`);
  });
  if (!res.ok) throw new Error(`업데이트 정보를 받지 못했어요 (${res.status}; ${lastDirect}).`);
  return String((await res.text()) ?? '');
}
let lastDirect = '';
type RisuFetch = (url: string, arg: Record<string, unknown>) => Promise<{ ok: boolean; data: unknown; status: number }>;

async function getJson(name: string): Promise<unknown> {
  // Risu 판에 따라 json()이 문자열이나 바이트를 줄 수 있어 글자로 받아 직접 읽는다
  const text = await getText(name);
  let body: unknown = text;
  try {
    for (let i = 0; i < 2 && typeof body === 'string'; i++) body = JSON.parse(body.replace(/^\uFEFF/, ''));
  } catch {
    throw new Error(`업데이트 파일을 읽지 못했어요. (받은 글자 ${String(text ?? '').length}자)`);
  }
  return body;
}

/**
 * 카드 데이터는 1MB가 넘어서 Risu 웹 프록시가 한 번에 못 넘긴다. card-update.json은 조각 목록이고,
 * 조각(card-update.N.txt)을 차례로 받아 이어 붙인다.
 */
async function loadPayload(): Promise<unknown> {
  const index = (await getJson('card-update.json')) as { parts?: unknown; length?: unknown; card?: unknown };
  if (index && 'card' in index) throw new Error('Risu가 다른 파일(버전 정보)을 돌려줬어요. 5분쯤 뒤에 다시 눌러 주세요.');
  if (!Array.isArray(index?.parts)) return index;
  let text = '';
  for (const name of index.parts) {
    if (typeof name !== 'string' || !/^card-update\.\d+\.txt$/.test(name)) throw new Error('카드 업데이트 목록 형식이 달라요.');
    text += await getText(name);
  }
  if (typeof index.length === 'number' && text.length !== index.length) {
    throw new Error(`카드 업데이트 파일을 끝까지 받지 못했어요. (${text.length}/${index.length}자)`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`카드 업데이트 파일을 읽지 못했어요. (받은 글자 ${text.length}자)`);
  }
}

/** 형식이 다를 때 무엇을 받았는지 짧게 (원인 찾기용) */
function describe(x: unknown): string {
  if (x === null || typeof x !== 'object') return `${typeof x}`;
  const o = x as Record<string, unknown>;
  const d = o.data as Record<string, unknown> | undefined;
  return `keys=${Object.keys(o).slice(0, 6).join('/') || '없음'}, schema=${String(o.schema)}, version=${typeof o.version}, data=${d ? Object.keys(d).length : '없음'}, `
    + `globalLore=${Array.isArray(d?.globalLore) ? 'list' : typeof d?.globalLore}, customscript=${Array.isArray(d?.customscript) ? 'list' : typeof d?.customscript}`;
}

/** 작은 version.json만 받아 최신 버전을 안다 (창을 처음 열 때 한 번, 확인 버튼마다) */
export async function checkLatest(env: SettingsEnv, force = false): Promise<void> {
  if (!UPDATE_BASE || updateUi.busy || (checked && !force)) return;
  checked = true;
  updateUi.busy = force;
  if (force) (updateUi.notice = ''), env.render();
  try {
    if (!force) skipped = String((await risuai.pluginStorage.getItem(SKIP_KEY).catch(() => '')) ?? '');
    const v = (await getJson('version.json')) as Partial<Latest>;
    if (typeof v.card !== 'string' || typeof v.plugin !== 'string') throw new Error('업데이트 정보 형식이 달라요.');
    updateUi.latest = { card: v.card, plugin: v.plugin, minPlugin: v.minPlugin ?? v.plugin };
  } catch (error) {
    if (force) updateUi.notice = error instanceof Error ? error.message : String(error);
  }
  updateUi.busy = false;
  env.render();
}

/** 새로 나온 카드·플러그인 버전 (없으면 빈 칸) */
export function newVersions(ctx: ChatContext): { card?: string; plugin?: string } {
  const L = updateUi.latest;
  if (!L) return {};
  const lite = !!readManifest(ctx.char.globalLore);
  return {
    card: lite && compareVersions(L.card, cardVersion(ctx.char.globalLore)) > 0 ? L.card : undefined,
    plugin: compareVersions(L.plugin, PLUGIN_VERSION) > 0 ? L.plugin : undefined,
  };
}

const skipKey = (n: { card?: string; plugin?: string }) => `${n.card ?? ''}|${n.plugin ?? ''}`;

/** 설정 아이콘에 찍을 점: 새 버전이 있으면 (건너뛰어도 점은 남김) */
export function hasUpdate(ctx: ChatContext): boolean {
  const n = newVersions(ctx);
  return !!(n.card || n.plugin);
}

/** 창 위쪽 한 줄 안내. 건너뛴 버전이면 띄우지 않는다 */
export function updateBanner(ctx: ChatContext): string {
  const n = newVersions(ctx);
  if (!(n.card || n.plugin) || skipKey(n) === skipped) return '';
  const what = [n.plugin ? `플러그인 v${esc(n.plugin)}` : '', n.card ? `카드 v${esc(n.card)}` : ''].filter(Boolean).join(' · ');
  return `<div class="upd-banner" role="status"><span class="upd-banner-t"><b>새 버전이 있어요</b> ${what}</span>
    <span class="upd-banner-b"><button class="gx-mini primary" data-action="upd-go">업데이트</button><button class="gx-mini" data-action="upd-skip">건너뛰기</button></span></div>`;
}

export function updateGroup(ctx: ChatContext): string {
  const busy = updateUi.busy;
  const rows: string[] = [];
  const cur = cardVersion(ctx.char.globalLore);
  const lite = !!readManifest(ctx.char.globalLore);
  const L = updateUi.latest;
  const row = (label: string, value: string, help = '') =>
    `<div class="ps-row"><div class="ps-label"><b>${label}</b>${help ? `<small>${help}</small>` : ''}</div><div class="ps-ctl">${value}</div></div>`;
  if (!UPDATE_BASE) {
    return section(row('업데이트', '<span class="gx-muted">준비 중</span>', '업데이트 주소가 아직 연결되지 않은 빌드예요. 지금은 zip으로 갈아끼워 주세요.'));
  }
  const pluginNew = L && compareVersions(L.plugin, PLUGIN_VERSION) > 0;
  rows.push(row('플러그인', `<span class="upd-ver">v${esc(PLUGIN_VERSION)}${pluginNew ? ` → <b>v${esc(L!.plugin)}</b>` : ''}</span>`,
    pluginNew ? 'Risu 설정 → 플러그인 탭에서 이 플러그인의 업데이트를 눌러 주세요.' : L ? '최신이에요.' : ''));
  const cardNew = lite && L && compareVersions(L.card, cur) > 0;
  const needPlugin = !!L && compareVersions(L.minPlugin, PLUGIN_VERSION) > 0;
  rows.push(row('카드', `<span class="upd-ver">${cur === '0' ? '이전 판' : `v${esc(cur)}`}${cardNew ? ` → <b>v${esc(L!.card)}</b>` : ''}</span>`,
    !lite ? '이 채팅의 카드는 Lite 카드가 아니에요.' : cardNew ? (needPlugin ? '플러그인을 먼저 업데이트한 뒤 창을 다시 열어 주세요.' : '채팅·사진·에셋과 카드 명부는 그대로 두고 카드 내용만 바꿔요.') : L ? '최신이에요.' : ''));
  let actions = `<button class="gx-mini" data-action="upd-check" ${busy ? 'disabled' : ''}>${busy && !updateUi.payload ? '확인 중…' : '새 버전 확인'}</button>`;
  if (cardNew && !needPlugin) {
    actions += updateUi.plan
      ? `<button class="gx-mini primary" data-action="upd-apply" ${busy ? 'disabled' : ''}>${busy ? '적용 중…' : '카드에 적용'}</button>`
      : `<button class="gx-mini primary" data-action="upd-prepare" ${busy ? 'disabled' : ''}>카드 업데이트 준비</button>`;
  }
  const plan = updateUi.plan;
  const summary = plan
    ? `<ul class="upd-plan">
        <li>바뀌는 카드 칸 ${plan.fields.length}개${plan.fields.length ? ` <small>(${esc(plan.fields.map(fieldName).join(', '))})</small>` : ''}</li>
        <li>로어북: 바뀜 ${plan.lore.replaced} · 새로 ${plan.lore.added} · 직접 넣은 항목 유지 ${plan.lore.kept}${plan.lore.protected ? ` · 카드 명부 보존` : ''}</li>
        <li>정규식: 바뀜 ${plan.scripts.replaced} · 새로 ${plan.scripts.added} · 직접 넣은 항목 유지 ${plan.scripts.kept}</li>
      </ul><p class="ps-note">적용한 뒤에는 채팅을 다시 열어야 새 첫 장면·안내가 보여요. 사진·에셋이 새로 생긴 버전이면 zip의 카드를 가져와야 해요.</p>`
    : '';
  return section(rows.join('') + `<div class="upd-act">${actions}</div>${summary}`
    + (updateUi.notice ? `<div class="gx-err" role="alert">${esc(updateUi.notice)}</div>` : '')
    + (updateUi.done ? `<p class="gx-hint">${esc(updateUi.done)}</p>` : ''));
}

function section(body: string): string {
  return `<section class="ps-group"><h3>업데이트</h3><div class="ps-rows">${body}</div></section>`;
}

const FIELD_NAMES: Record<string, string> = {
  firstMessage: '첫 안내', alternateGreetings: '첫 장면', creatorNotes: '제작 노트', desc: '설명', personality: '성격', scenario: '시나리오',
  exampleMessage: '예시 대화', systemPrompt: '시스템 프롬프트', postHistoryInstructions: '탈옥 프롬프트', backgroundHTML: '배경 HTML',
  lowLevelAccess: '저수준 접근', virtualscript: '가상 스크립트', triggerscript: '트리거',
};
const fieldName = (f: string) => FIELD_NAMES[f] ?? f;

export async function handleUpdate(action: string, ctx: ChatContext, env: SettingsEnv): Promise<boolean> {
  if (!action.startsWith('upd-')) return false;
  if (updateUi.busy) return true;
  if (action === 'upd-skip') {
    skipped = skipKey(newVersions(ctx));
    await risuai.pluginStorage.setItem(SKIP_KEY, skipped).catch(() => {});
    env.render();
    return true;
  }
  if (action === 'upd-check') {
    updateUi.payload = null;
    updateUi.plan = null;
    updateUi.done = '';
    await checkLatest(env, true);
    return true;
  }
  updateUi.busy = true;
  updateUi.notice = '';
  env.render();
  try {
    const char = (await risuai.getCharacterFromIndex(ctx.charIndex)) as Record<string, unknown> | null;
    if (!char) throw new Error('캐릭터를 찾을 수 없어요.');
    if (action === 'upd-prepare') {
      const p = await loadPayload();
      if (!isPayload(p)) throw new Error(`카드 업데이트 파일 형식이 달라요. (${describe(p)})`);
      if (compareVersions(p.minPlugin, PLUGIN_VERSION) > 0) throw new Error(`이 카드는 플러그인 v${p.minPlugin} 이상이 필요해요. 플러그인부터 업데이트해 주세요.`);
      updateUi.payload = p;
      updateUi.plan = planUpdate(char, p);
    } else if (action === 'upd-apply' && updateUi.payload) {
      // 준비한 뒤 카드가 바뀌었을 수 있으니 저장 직전에 다시 합친다
      const plan = planUpdate(char, updateUi.payload);
      await risuai.setCharacterToIndex(ctx.charIndex, plan.next);
      updateUi.done = `카드를 v${updateUi.payload.version}으로 바꿨어요. 채팅을 다시 열면 새 내용이 보여요.`;
      updateUi.payload = null;
      updateUi.plan = null;
      updateUi.busy = false;
      await env.refresh();
      return true;
    }
  } catch (error) {
    updateUi.notice = error instanceof Error ? error.message : String(error);
  }
  updateUi.busy = false;
  env.render();
  return true;
}
