// 「살아 있는 인물 기록」 화면 (docs/인물기록_호감_통합설계_3판.md 6-2·6-3): 설정 → 기능별 설정 「인물 기록」 페이지,
// 위키 탭의 「이 채팅의 인물」(목록·인물 상세·문서) 하위 뷰. 저장은 모두 updateChat 으로, 값(호감·호칭)은 기록에서 매번 계산한다.
import type { Chat } from '../core/types';
import { messageText } from '../core/refs';
import { tokens } from '../core/gnet';
import { factionList } from '../core/factions';
import { updateChat, type ChatContext } from '../host/risu';
import { clearDiag, loadDiag, onPeopleStatus, peopleStatus, requestPeopleUpdate, sheetOf, type DiagRun } from '../host/people';
import { anchorOf, changeId, isAlive, liveChanges, liveEntries, liveness, messageKey, peopleStore, plain, putChange, unreadIndexes, withPeople, type Liveness } from '../core/people/store';
import { addressOf, affinityView } from '../core/people/affinity';
import { FEATURES, PP, PP_DEFAULTS, peopleSettings, ppValue, type Feature } from '../core/people/settings';
import { basePerson, temperOf, userAffinityBase } from '../core/people/base';
import { seedPerson } from '../core/people/seed';
import { AFF_MAX, AFF_MIN, DOC_TYPES, SLOTS, STAGES, stageOf, type Change, type Doc, type DocType, type Entry, type EntrySrc, type Person, type PeopleStore, type Register, type SlotId } from '../core/people/types';
import { ICONS } from './icons';
import { keepOpen } from './panels';
import { toast } from './toast';

export interface PeopleEnv {
  render: () => void;
  refresh: () => Promise<void>;
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** 화면 상태 (입력 중인 글은 다시 그려도 지킨다) */
export const peopleUi = {
  notice: '',
  info: '',
  busy: false,
  /** 호감 숫자 보이기 (ⓘ) */
  showNum: false,
  /** 호감 직접 수정 칸 */
  affEdit: false,
  affStage: '',
  affNum: '',
  affReason: '',
  /** 호칭 직접 수정 칸 */
  addrEdit: false,
  addrTo: '',
  addrReg: '존댓말' as Register,
  addrPin: false,
  /** 진단 (플러그인 저장소에서 한 번 읽어 둔다) */
  diag: null as DiagRun[] | null,
  diagOpen: new Set<string>(),
  diagShow: '' as '' | `${string}:${'prompt' | 'raw'}`,
  /** 「매 턴」·「메인」 안내는 세션에 한 번 */
  warned: false,
  /** 인물 상세에서 펼친 변경 기록 */
  logOpen: false,
};

export function resetPeopleUi(): void {
  Object.assign(peopleUi, { notice: '', info: '', affEdit: false, addrEdit: false, showNum: false, diagShow: '', logOpen: false });
}

// ── 상태 알림: 갱신 중·끝남이면 다시 그린다 (입력 중이면 건너뛴다 — 한글 조합 보호) ──

let rerender: (() => void) | null = null;
export function bindPeopleStatus(render: () => void): void {
  rerender = render;
  onPeopleStatus((st) => {
    // 갱신이 끝나면 진단을 다시 읽는다
    if (!st.busy) peopleUi.diag = null;
    safeRender();
  });
}
function typing(): boolean {
  const a = document.activeElement as HTMLElement | null;
  if (!a) return false;
  const tag = a.tagName;
  return tag === 'TEXTAREA' || (tag === 'INPUT' && !['range', 'checkbox', 'button', 'submit'].includes((a as HTMLInputElement).type));
}
function safeRender(): void {
  if (!rerender || typing()) return;
  rerender();
}

/** 호감 막대를 길게 누르면 숫자가 보인다 (ⓘ 와 같은 동작). 창을 만들 때 한 번 붙인다 */
export function bindPeopleHold(root: HTMLElement): void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const clear = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  root.addEventListener('pointerdown', (ev) => {
    const el = (ev.target as HTMLElement).closest?.('[data-pp-hold]');
    if (!el || (ev.target as HTMLElement).closest('button')) return;
    clear();
    timer = setTimeout(() => {
      timer = null;
      if (!peopleUi.showNum) {
        peopleUi.showNum = true;
        rerender?.();
      }
    }, 450);
  });
  for (const t of ['pointerup', 'pointercancel', 'pointerleave'] as const) root.addEventListener(t, clear);
}

// ── 공통 조각 ──

const SLOT_LABEL: Record<SlotId, string> = {
  identity: '정체', personality: '성격', state: '상태', relationship: '관계', speech: '말투', behavior: '행동', knowledge: '아는 것', threads: '미해결', history: '지난 일', scene: '장면', suspicion: '의심',
};
const SRC_LABEL: Record<EntrySrc, string> = { seed: '시트', story: '본편', field: '필드', manual: '수동' };
const SRC_ICON: Record<EntrySrc, string> = { seed: ICONS.book, story: ICONS.pen, field: ICONS.game, manual: ICONS.person };
const DOC_LABEL: Record<DocType, string> = { event: '사건', location: '장소', faction: '세력', item: '물건' };
const KIND_LABEL: Record<Change['kind'], string> = { cue: '호감', address: '호칭', identity: '신분', note: '메모' };

function seg(key: string, cur: string, items: [string, string][], action = 'pp-set'): string {
  return `<div class="gx-segs gx-segs-sm">${items
    .map(([v, label]) => `<button class="gx-seg${cur === v ? ' on' : ''}" data-action="${action}" data-value="${esc(`${key}=${v}`)}" aria-pressed="${cur === v}">${label}</button>`)
    .join('')}</div>`;
}
const row = (label: string, control: string, help = '') =>
  `<div class="ps-row"><div class="ps-label"><b>${label}</b>${help ? `<small>${help}</small>` : ''}</div><div class="ps-ctl">${control}</div></div>`;
const group = (title: string, body: string, note = '') => `<section class="ps-group">${title ? `<h3>${title}</h3>` : ''}${note ? `<p class="ps-note">${note}</p>` : ''}<div class="ps-rows">${body}</div></section>`;
const fold = (key: string, title: string, body: string, open = false) => `<details class="ps-adv-sub" data-keep="${key}"${keepOpen(key, open)}><summary>${title}</summary><div class="ps-rows">${body}</div></details>`;
const srcIcon = (src: EntrySrc) => `<i class="pp-src s-${src}" title="${SRC_LABEL[src]}" aria-label="${SRC_LABEL[src]}">${SRC_ICON[src]}</i>`;

/** 기준 메시지 → 「#n」 (채팅 속 순번). 시드('#0')·사라진 것은 '' */
function msgNo(anchor: string, live: Liveness): string {
  const pos = live.at.get(anchor);
  return pos === undefined || pos < 0 ? '' : `#${pos + 1}`;
}

/** 마지막 봇 응답의 기준 열쇠들 (변화 ● 표시용) */
function lastBotKeys(chat: Chat): Set<string> {
  const list = Array.isArray(chat.message) ? chat.message : [];
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].role === 'char') return new Set([messageKey(list[i], i), `#${i + 1}`]);
  }
  return new Set();
}

function changedPeople(store: PeopleStore, chat: Chat, live: Liveness): Set<string> {
  const keys = lastBotKeys(chat);
  const out = new Set<string>();
  if (!keys.size) return out;
  for (const c of store.log) if (keys.has(c.anchor) && isAlive(c, live) && c.who !== '@user') out.add(c.who);
  for (const p of Object.values(store.people)) for (const s of SLOTS) if ((p.slots[s] ?? []).some((e) => keys.has(e.anchor) && isAlive(e, live))) out.add(p.name);
  return out;
}

function factionName(ctx: ChatContext, code: string): string {
  if (!code) return '';
  return factionList(ctx.char.globalLore).find((f) => f.code === code)?.name ?? code;
}

const affOpts = (ctx: ChatContext, name: string) => ({ temper: temperOf(name), speed: peopleSettings(ctx.chat.scriptstate).speed });

/** 사원증 창의 「기록」 단추: 그 이름의 기록이 있나 */
export function hasPersonRecord(ctx: ChatContext, name: string): boolean {
  return !!peopleStore(ctx.chat).people[name];
}

// ── 설정 페이지 ──

async function setVars(ctx: ChatContext, env: PeopleEnv, vars: Record<string, string>): Promise<void> {
  peopleUi.busy = true;
  peopleUi.notice = '';
  try {
    await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => ({ ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...vars } }));
  } catch (error) {
    peopleUi.notice = error instanceof Error ? error.message : String(error);
  }
  peopleUi.busy = false;
  await env.refresh();
}

const FEATURE_HELP: Record<Feature, [string, string]> = {
  affinity: ['호감', '계기(작은친절·도움·배신…)를 기록하고 8단계로 계산해요'],
  register: ['호칭·말투', '이 인물이 주인공을 부르는 말과 존댓말·반말 변화'],
  perception: ['인식', '이 인물이 아는 것·모르는 것(비밀 누설 방지)'],
  perception_ext: ['인식 확장', '감각 경로·관찰 성향까지 기록해요'],
  suspicion: ['의심', '범용 의심(정체·배신·거짓말·오염·범행)'],
  docs_event: ['사건 문서', '건마다 무슨 일이 있었는지'],
  docs_location: ['장소 문서', '장소마다 바뀐 것'],
  docs_faction: ['세력 문서', '세력마다 바뀐 것'],
  docs_item: ['물건 문서', '물건마다 바뀐 것'],
  npc_emotion: ['인물끼리 감정', '인물 사이의 관계도 기록해요 (2단계)'],
};

const n = (v: number) => v.toLocaleString();
const tok = (s: number, text?: string) => (text ? `${n(s)}자 · 약 ${n(tokens(text))}tok` : `${n(s)}자 · 약 ${n(Math.ceil(s * 0.6))}tok`);
const when = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (x: number) => String(x).padStart(2, '0');
  return `${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

function diagTable(ctx: ChatContext, keepRaw: boolean): string {
  const list = peopleUi.diag;
  if (list === null) {
    void loadDiag().then((d) => {
      peopleUi.diag = d;
      safeRender();
    });
    return '<p class="ps-note">진단을 읽는 중…</p>';
  }
  const mine = list.slice(-40).reverse();
  if (!mine.length) return '<p class="ps-note">아직 갱신 기록이 없어요.</p>';
  const rows = mine.map((r) => {
    const id = `${r.at}|${r.indexes.join(',')}`;
    const open = peopleUi.diagOpen.has(id);
    const rep = r.report;
    const result = r.ok
      ? r.stage === 'skip'
        ? `<span class="gx-badge wait">건너뜀 · ${esc(r.error ?? '')}</span>`
        : rep
          ? `<span class="gx-badge live">반영 ${rep.applied.entries + rep.applied.cues + rep.applied.address + rep.applied.docs + rep.applied.suspicion}</span>${rep.dropped.length ? `<span class="gx-badge hot">버림 ${rep.dropped.length}</span>` : ''}${rep.held.length ? `<span class="gx-badge wait">보류 ${rep.held.length}</span>` : ''}`
          : '<span class="gx-badge live">반영</span>'
      : `<span class="gx-badge bad">실패 · ${esc(r.stage ?? '')}</span><small class="pp-err">${esc(r.error ?? '')}</small>`;
    const sysText = r.system ?? '';
    const dataText = r.data ?? '';
    const sizes = `지침 ${r.sizes.system ? tok(r.sizes.system, sysText || undefined) : '-'} / 자료 ${r.sizes.data ? tok(r.sizes.data, dataText || undefined) : '-'} / 구간 ${r.sizes.span ? tok(r.sizes.span) : '-'}`;
    const detail = open
      ? `<div class="pp-diag-detail">
          ${rep?.applied.newPeople.length ? `<p class="ps-note">새 인물: ${esc(rep.applied.newPeople.join(', '))}</p>` : ''}
          ${rep?.dropped.length ? `<p class="ps-note"><b>버린 항목</b></p><ul class="pp-drops">${rep.dropped.map((d) => `<li><span class="gx-badge">${esc(d.kind)}</span>${d.who ? `<b>${esc(d.who)}</b>` : ''}<span>${esc(d.reason)}</span></li>`).join('')}</ul>` : ''}
          ${rep?.held.length ? `<p class="ps-note"><b>보류(확인 필요)</b></p><ul class="pp-drops">${rep.held.map((d) => `<li><span class="gx-badge wait">${esc(d.kind)}</span>${d.who ? `<b>${esc(d.who)}</b>` : ''}<span>${esc(d.reason)}</span></li>`).join('')}</ul>` : ''}
          <div class="gx-row-btns">
            ${keepRaw && r.system ? `<button class="gx-mini" data-action="pp-diag-show" data-value="${esc(`${id}:prompt`)}">보낸 프롬프트 보기</button>` : ''}
            ${r.raw ? `<button class="gx-mini" data-action="pp-diag-show" data-value="${esc(`${id}:raw`)}">응답 원문 보기</button>` : ''}
            ${!keepRaw ? '<small class="ps-note">원문은 고급 → 「원문 보관」을 켰을 때만 남아요.</small>' : ''}
          </div>
          ${peopleUi.diagShow === `${id}:prompt` ? `<textarea class="gx-search pp-raw" readonly rows="10">${esc(`${r.system ?? ''}\n\n---\n\n${prettyJson(r.data ?? '')}`)}</textarea>` : ''}
          ${peopleUi.diagShow === `${id}:raw` ? `<textarea class="gx-search pp-raw" readonly rows="10">${esc(r.raw ?? '')}</textarea>` : ''}
        </div>`
      : '';
    return `<li class="pp-diag${open ? ' open' : ''}"><button class="pp-diag-row" data-action="pp-diag-toggle" data-value="${esc(id)}" aria-expanded="${open}">
        <span class="pp-diag-top"><b>${esc(when(r.at))}</b><span class="pp-diag-who">${esc(r.people.length ? r.people.join(', ') : '(대상 없음)')}</span><span class="pp-diag-res">${result}</span></span>
        <span class="pp-diag-sub">${esc(sizes)} · 출력 ${n(r.outChars)}자 · ${n(r.ms)}ms · ${r.model === 'main' ? '메인' : '보조'} · ${esc(r.reason)}</span>
      </button>${detail}</li>`;
  });
  return `<ul class="pp-diags">${rows.join('')}</ul>`;
}

function prettyJson(s: string): string {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}

/** 지금 갱신 단추 + 상태 줄 */
function updateBar(ctx: ChatContext): string {
  const st = peopleStatus();
  const store = peopleStore(ctx.chat);
  const unread = st.busy ? st.unread : unreadIndexes(ctx.chat, store).length;
  const label = st.busy ? st.label || '갱신 중…' : unread ? `안 읽은 응답 ${unread}개` : '모두 읽었어요';
  return `<div class="pp-upbar"><span class="pp-upst${st.busy ? ' busy' : ''}">${st.busy ? '<i class="pp-spin"></i>' : ''}${esc(label)}</span><button class="gx-mini ps-save" data-action="pp-update" ${st.busy || peopleUi.busy ? 'disabled' : ''}>${ICONS.refresh}지금 갱신</button></div>`;
}
/** 설정 → 기능별 설정 → 인물 기록 */
export function peopleSettingsPane(ctx: ChatContext): string {
  const state = ctx.chat.scriptstate;
  const v = (k: string) => ppValue(state, k);
  const s = peopleSettings(state);
  const onoff = (k: string) => seg(k, v(k) === '1' ? '1' : '0', [['1', '켬'], ['0', '끔']]);
  const main = [
    row('인물 기록', onoff('on'), '본편 응답을 읽어 인물의 상태·관계·호감을 기록으로 남겨요. 로어북 시트는 시작값이고, 이 기록이 이야기에 따라 바뀌어요.'),
    row('갱신 시점', seg('when', s.when, [['turn', '매 턴'], ['manual', '수동']]), '수동이면 인물 화면의 「지금 갱신」을 눌렀을 때만 읽어요.'),
    row('갱신 모델', seg('model', s.model, [['aux', '보조'], ['main', '메인']])),
    row('지침', seg('prompt', s.prompt, [['detailed', '자세히'], ['compact', '간결']]), '자세히 = 리수폿 원문 규칙+설명. 간결 = 같은 규칙·설명 축약, 토큰 약 1/3.'),
    row('본편에 넣기', seg('inject', s.inject, [['split', '절 단위 혼합'], ['append', '시트 전체+기록'], ['record', '기록만'], ['off', '안 넣음']]), '절 단위 혼합: 시트의 Identity·Character 절은 기록으로 대신하고 나머지 절은 원문 그대로.'),
    row('Director', seg('director', s.director, [['off', '끔'], ['facts', '사실형(뒤)'], ['scene', '연출형(앞)']]), '사실형은 갱신기에 얹어 다음 턴 메모를 남기고, 연출형은 본편 요청 앞에 짧은 지시를 한 번 더 만들어요.'),
    row('호감 변화 속도', seg('speed', String(s.speed), [['0.5', '0.5'], ['1', '1'], ['1.5', '1.5'], ['2', '2']])),
  ].join('');
  const features = FEATURES.map((f) => row(FEATURE_HELP[f][0], onoff(f), FEATURE_HELP[f][1])).join('');
  const newPeople = [
    row('새 인물', seg('newpeople', s.newPeople, [['auto', '자동'], ['confirm', '확인 뒤 등록']]), '확인 뒤 등록이면 인물 화면의 「등록 대기」에서 고를 때까지 기록을 만들지 않아요.'),
    row('2턴 규칙', onoff('twoturn'), '한 번만 나온 이름은 등록하지 않아요.'),
  ].join('');
  const director = s.director !== 'off'
    ? fold('pp-director', 'Director 세부', [
        row('언어', seg('director_lang', s.directorLang, [['en', '영어'], ['ko', '한국어']])),
        row('길이', seg('director_len', s.directorLen, [['short', '짧게'], ['normal', '보통']])),
        s.director === 'scene' ? row('시간 제한', seg('director_timeout', String(s.directorTimeout), [['10', '10초'], ['20', '20초'], ['40', '40초']]), '넘기면 이번 턴은 지시 없이 보내요.') : '',
        row('재사용', onoff('director_reuse'), '장면이 그대로면 지난 지시를 다시 써요.'),
        `<div class="ps-row pp-textrow"><div class="ps-label"><b>Director 추가 지침</b></div><textarea class="gx-search nw-reqbox" name="pp-director-rules" data-input="pp-director-rules" rows="3" maxlength="2000" placeholder="Director 지시에 덧붙일 말">${esc(v('director_rules'))}</textarea><div class="gx-row-btns"><button class="gx-mini ps-save" data-action="pp-drules-save" data-take="pp-director-rules">저장</button></div></div>`,
      ].join(''))
    : '';
  const advanced = fold('pp-adv', '고급', [
    row('직전 쌍 포함', seg('prev_pairs', String(s.prevPairs), [['0', '0'], ['1', '1'], ['2', '2']]), '읽는 구간 앞에 맥락으로 붙이는 유저·봇 쌍 수'),
    row('인물당 기록 상한', seg('per_cap', String(s.perCap), [['400', '400'], ['800', '800'], ['1200', '1200']]), '글자 수. 넘으면 오래된 지난 일·장면부터 빼고 보내요.'),
    row('응답 접기 상한', seg('span_cap', String(s.spanCap), [['8000', '8,000'], ['12000', '12,000'], ['20000', '20,000']]), '한 번에 읽는 구간 글자 수. 넘으면 중간을 접어요.'),
    row('다른 보조 호출과 병렬', onoff('parallel'), '끄면 이미지·괴담톡 같은 다른 보조 호출 앞에 차례로 돌아요.'),
    row('원문 보관', onoff('keep_raw'), '진단에 보낸 프롬프트·응답 원문을 남겨요 (이 기기 플러그인 저장소).'),
    `<div class="ps-row pp-textrow"><div class="ps-label"><b>추가 지침</b><small>갱신기 지침 끝에 덧붙여요. 출력 형식은 바꿀 수 없어요.</small></div><textarea class="gx-search nw-reqbox" name="pp-rules" data-input="pp-rules" rows="4" maxlength="4000" placeholder="예: 관리국 요원은 서로를 직급으로 부른다">${esc(v('rules'))}</textarea><div class="gx-row-btns"><button class="gx-mini ps-save" data-action="pp-rules-save" data-take="pp-rules">저장</button></div></div>`,
  ].join(''));
  const diag = `<section class="ps-group"><h3>진단</h3><p class="ps-note">마지막 갱신들의 입력 크기·결과·실패 이유예요. 토큰은 한글 1자≈1, 그 외 0.3으로 어림했어요.</p>
    ${updateBar(ctx)}
    ${diagTable(ctx, s.keepRaw)}
    <div class="gx-row-btns"><button class="gx-mini danger" data-action="pp-diag-clear" ${peopleUi.diag?.length ? '' : 'disabled'}>진단 지우기</button></div></section>`;
  return `<div class="ph-form pp-set">
    <header class="ph-room-head"><button class="ph-tool ph-back" data-action="set-feat-back" aria-label="설정으로">${ICONS.back}</button><div class="ph-room-title"><b>인물 기록 설정</b><small>이 채팅</small></div></header>
    ${peopleUi.notice ? `<div class="gx-err" role="alert">${esc(peopleUi.notice)}</div>` : ''}
    <div class="ph-form-body ps">
      ${group('', main)}
      ${fold('pp-feat', '기능', features)}
      ${fold('pp-new', '새 인물', newPeople)}
      ${director}
      ${advanced}
      ${diag}
    </div>
    ${toast('pp', peopleUi.info, (t) => {
      if (peopleUi.info === t) peopleUi.info = '';
    })}
  </div>`;
}

// ── 위키 탭: 이 채팅의 인물 ──

/** 위키 홈의 타일 */
export function peopleHomeTile(ctx: ChatContext): string {
  const store = peopleStore(ctx.chat);
  const count = Object.keys(store.people).length;
  const pending = Object.keys(store.pending).length;
  const live = liveness(ctx.chat);
  const changed = changedPeople(store, ctx.chat, live).size;
  const sub = [count ? `${count}명` : '아직 없음', changed ? `바뀐 인물 ${changed}` : '', pending ? `등록 대기 ${pending}` : ''].filter(Boolean).join(' · ');
  return `<button class="nw-tile k-pp" data-action="wiki-people"><span class="nw-tile-pics">${ICONS.group}</span><b>이 채팅의 인물${changed ? ' <i class="pp-dot" aria-label="변화 있음">●</i>' : ''}</b><small>${esc(sub)}</small></button>`;
}

function head(title: string, sub: string, right = ''): string {
  return `<header class="ph-room-head"><button class="ph-tool ph-back" data-action="wiki-back" aria-label="뒤로">${ICONS.back}</button><div class="ph-room-title"><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div>${right ? `<span class="ph-act">${right}</span>` : ''}</header>`;
}

const stageBadge = (value: number) => {
  const st = stageOf(value);
  const idx = STAGES.indexOf(st);
  return `<span class="gx-badge pp-stage s-${idx}">${esc(st.label)}</span>`;
};

/** 인물 목록 (소속별), 등록 대기, 지금 갱신 */
export function peopleListView(ctx: ChatContext): string {
  const store = peopleStore(ctx.chat);
  const live = liveness(ctx.chat);
  const changes = liveChanges(store, live);
  const changed = changedPeople(store, ctx.chat, live);
  const facs = factionList(ctx.char.globalLore);
  const groups = new Map<string, Person[]>();
  for (const p of Object.values(store.people).sort((a, b) => a.name.localeCompare(b.name, 'ko'))) {
    const key = facs.some((f) => f.code === p.faction) ? p.faction : '';
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(p);
  }
  const order = [...facs.map((f) => f.code).filter((c) => groups.has(c)), ...(groups.has('') ? [''] : [])];
  const item = (p: Person) => {
    const aff = affinityView(p, changes, store.folded[p.name] ?? 0, affOpts(ctx, p.name));
    const addr = addressOf(p, changes);
    const facName = facs.some((f) => f.code === p.faction) ? '' : p.faction;
    const sub = [facName, addr.toUser ? `「${addr.toUser}」 · ${addr.register}` : addr.register, p.seeded.from === 'lore' ? '시트' : p.seeded.from === 'dialogue' ? '대사' : '빈 기록'].filter(Boolean).join(' · ');
    return `<li class="ph-row"><button class="ph-main nw-row" data-action="wiki-person" data-value="${esc(p.name)}">
      <span class="ph-avatar nw-ava k-ag">${esc(p.name.slice(0, 1))}</span>
      <span class="ph-who"><span class="ph-who-top"><b>${esc(p.name)}${changed.has(p.name) ? ' <i class="pp-dot" aria-label="마지막 갱신에서 바뀜">●</i>' : ''}</b>${stageBadge(aff.value)}</span><small>${esc(sub)}</small></span></button></li>`;
  };
  const sections = order.map((code) => {
    const list = groups.get(code)!;
    const title = code ? factionName(ctx, code) : '그 밖';
    return `<section class="nw-hsec pp-sec"><h3>${esc(title)}<b>${list.length}</b></h3><ul class="ph-list">${list.map(item).join('')}</ul></section>`;
  }).join('');
  const pending = Object.entries(store.pending);
  const pendingHtml = pending.length
    ? `<section class="nw-hsec pp-sec"><h3>등록 대기<b>${pending.length}</b></h3><p class="ps-note">이름이 나왔지만 아직 기록을 만들지 않은 사람이에요. 등록하면 다음 갱신부터 기록해요.</p><ul class="ph-list">${pending
        .map(([name, v]) => `<li class="ph-row"><div class="ph-main"><span class="ph-avatar nw-ava">${esc(name.slice(0, 1))}</span><span class="ph-who"><b>${esc(name)}</b><small>${esc([v.aliases.length ? `별명: ${v.aliases.join(', ')}` : '', msgNo(v.anchor, live) ? `처음 ${msgNo(v.anchor, live)}` : ''].filter(Boolean).join(' · '))}</small></span></div>
          <button class="gx-mini ps-save" data-action="pp-register" data-value="${esc(name)}" ${peopleUi.busy ? 'disabled' : ''}>등록</button><button class="gx-mini" data-action="pp-ignore" data-value="${esc(name)}" ${peopleUi.busy ? 'disabled' : ''}>무시</button></li>`)
        .join('')}</ul></section>`
    : '';
  const docsN = Object.values(store.docs).reduce((a, d) => a + liveEntries(d.entries, live).length, 0);
  const empty = !Object.keys(store.people).length && !pending.length ? '<div class="ph-blank"><p>아직 기록된 인물이 없어요.<br>본편에서 요원·인물이 등장하면 기록이 생겨요.</p></div>' : '';
  return `<div class="ph-room nw-pane pp-pane">${head('이 채팅의 인물', `${Object.keys(store.people).length}명`, `<button class="ph-tool" data-action="wiki-docs" title="사건·장소·세력·물건" aria-label="기록 문서">${ICONS.book}</button>`)}
    <article class="nw-doc pp-doc">
      ${peopleUi.notice ? `<div class="gx-err" role="alert">${esc(peopleUi.notice)}</div>` : ''}
      ${updateBar(ctx)}
      ${pendingHtml}${sections}${empty}
      ${docsN ? `<button class="gx-mini nw-more-btn" data-action="wiki-docs">${ICONS.book}사건·장소·세력·물건 기록 ${docsN}개</button>` : ''}
    </article>${toast('pp', peopleUi.info, (t) => {
      if (peopleUi.info === t) peopleUi.info = '';
    })}</div>`;
}

/** 호감 막대: 8단계, 현재 단계 이름, ⓘ·길게 누르면 숫자 */
function affinityBar(value: number): string {
  const st = stageOf(value);
  const idx = STAGES.indexOf(st);
  const pct = Math.round(((value - AFF_MIN) / (AFF_MAX - AFF_MIN)) * 100);
  const cells = STAGES.map((s, i) => `<i class="pp-cell s-${i}${i <= idx ? ' on' : ''}${i === idx ? ' cur' : ''}" title="${esc(s.label)}"></i>`).join('');
  return `<div class="pp-aff" data-pp-hold="num"><div class="pp-aff-top"><b>${esc(st.label)}</b>${peopleUi.showNum ? `<span class="pp-aff-num">${value} (${AFF_MIN}~${AFF_MAX})</span>` : ''}<button class="ph-tool sm" data-action="pp-num-toggle" aria-label="숫자 보기" aria-pressed="${peopleUi.showNum}">${ICONS.info}</button></div>
    <div class="pp-cells">${cells}<span class="pp-mark" style="left:${pct}%"></span></div></div>`;
}

function entryRow(who: string, slot: SlotId, e: Entry, live: Liveness, alive: boolean): string {
  const no = msgNo(e.anchor, live);
  const dead = !alive && !e.void;
  const meta = [no ? `<button class="pp-no" data-action="pp-jump" data-value="${esc(e.anchor)}">${no}</button>` : '', e.quote ? `<q>${esc(e.quote)}</q>` : '', e.target && e.target !== '@user' ? `<span>→ ${esc(e.target)}</span>` : '', e.kind ? `<span>${esc(e.kind)}</span>` : ''].filter(Boolean).join('');
  const key = `${who}|${slot}|${e.id}`;
  return `<li class="pp-entry${dead ? ' dead' : ''}${e.void ? ' void' : ''}${e.pin ? ' pinned' : ''}">
    <div class="pp-entry-main">${srcIcon(e.src)}<span class="pp-text">${esc(e.text)}</span></div>
    <div class="pp-entry-meta">${meta}${dead ? '<span class="pp-gone">메시지가 사라져 빠짐</span>' : ''}${e.void ? '<span class="pp-gone">취소됨</span>' : ''}
      <span class="pp-entry-btns"><button class="ph-tool sm${e.pin ? ' on' : ''}" data-action="pp-pin" data-value="${esc(key)}" title="고정" aria-label="고정" aria-pressed="${!!e.pin}">${ICONS.pin}</button><button class="gx-mini pp-mini${e.void ? '' : ' danger'}" data-action="pp-void" data-value="${esc(key)}">${e.void ? '되살리기' : '취소'}</button></span></div>
  </li>`;
}

function changeRow(c: Change, live: Liveness): string {
  const alive = isAlive(c, live);
  const no = msgNo(c.anchor, live);
  const what = c.kind === 'cue' ? (c.pin !== undefined ? `호감 고정 ${c.pin}` : `호감 · ${c.cue ?? ''}`) : c.kind === 'address' ? `호칭 「${c.toUser ?? ''}」${c.register ? ` · ${c.register}` : ''}` : c.kind === 'identity' ? `신분 ${[c.faction, c.rank].filter(Boolean).join(' ')}` : `메모 ${c.now ?? ''}`;
  return `<li class="pp-entry${!alive && !c.void ? ' dead' : ''}${c.void ? ' void' : ''}">
    <div class="pp-entry-main">${srcIcon(c.src)}<span class="pp-text"><b>${esc(KIND_LABEL[c.kind])}</b> ${esc(what)}${c.reason ? ` <small>— ${esc(c.reason)}</small>` : ''}</span></div>
    <div class="pp-entry-meta">${no ? `<button class="pp-no" data-action="pp-jump" data-value="${esc(c.anchor)}">${no}</button>` : ''}${c.quote ? `<q>${esc(c.quote)}</q>` : ''}${!alive && !c.void ? '<span class="pp-gone">메시지가 사라져 빠짐</span>' : ''}${c.void ? '<span class="pp-gone">취소됨</span>' : ''}
      <span class="pp-entry-btns"><button class="gx-mini pp-mini${c.void ? '' : ' danger'}" data-action="pp-change-void" data-value="${esc(c.id)}">${c.void ? '되살리기' : '취소'}</button></span></div>
  </li>`;
}

/** 인물 상세 */
export function personView(ctx: ChatContext, name: string): string {
  const store = peopleStore(ctx.chat);
  const p = store.people[name];
  if (!p) return `<div class="ph-room nw-pane pp-pane">${head(name, '')}<div class="ph-blank"><p>「${esc(name)}」의 기록이 없어요.</p></div></div>`;
  const live = liveness(ctx.chat);
  const changes = liveChanges(store, live);
  const aff = affinityView(p, changes, store.folded[p.name] ?? 0, affOpts(ctx, p.name));
  const addr = addressOf(p, changes);
  const seededFrom = p.seeded.from === 'lore' ? '로어북 시트' : p.seeded.from === 'dialogue' ? '필드 대사' : '빈 기록(이야기에서 등장)';
  const sub = [p.faction ? factionName(ctx, p.faction) : '소속 모름', `시작값: ${seededFrom}`, p.minor ? '미성년' : ''].filter(Boolean).join(' · ');
  const stageOptions = STAGES.map((s, i) => `<option value="${s.max}" ${peopleUi.affStage === String(s.max) ? 'selected' : ''}>${esc(s.label)} (${i ? STAGES[i - 1].max + 1 : AFF_MIN}~${s.max})</option>`).join('');
  const affEdit = peopleUi.affEdit
    ? `<div class="pp-edit"><div class="pp-edit-row"><label>단계 <select class="gx-select" data-change="pp-aff-stage">${'<option value="">(직접 숫자)</option>'}${stageOptions}</select></label>
        <label>숫자 <input class="gx-search ph-pct" type="number" min="${AFF_MIN}" max="${AFF_MAX}" data-input="pp-aff-num" name="pp-aff-num" value="${esc(peopleUi.affNum)}" placeholder="${aff.value}"></label></div>
        <input class="gx-search" data-input="pp-aff-reason" name="pp-aff-reason" maxlength="80" placeholder="이유 (필수)" value="${esc(peopleUi.affReason)}">
        <p class="ps-note">고정하면 그 값으로 덮고, 이후 자동 계기는 무시해요. 변경 기록에서 취소하면 다시 자동 계산으로 돌아가요.</p>
        <div class="gx-row-btns"><button class="gx-mini ps-save" data-action="pp-aff-save" data-value="${esc(name)}" ${peopleUi.busy ? 'disabled' : ''}>저장</button><button class="gx-mini" data-action="pp-aff-cancel">취소</button></div></div>`
    : `<div class="gx-row-btns"><button class="gx-mini" data-action="pp-aff-edit">호감 직접 수정</button>${aff.last ? `<small class="ps-note">마지막 계기: ${esc(aff.last.cue ?? '')}${aff.last.reason ? ` — ${esc(aff.last.reason)}` : ''}</small>` : ''}</div>`;
  const addrEdit = peopleUi.addrEdit
    ? `<div class="pp-edit"><div class="pp-edit-row"><input class="gx-search" data-input="pp-addr-to" name="pp-addr-to" maxlength="40" placeholder="호칭 (예: 선배, 요원님)" value="${esc(peopleUi.addrTo)}">
        ${seg('reg', peopleUi.addrReg, [['존댓말', '존댓말'], ['반말', '반말'], ['혼합', '혼합']], 'pp-addr-reg')}</div>
        <label class="pp-check"><input type="checkbox" data-change="pp-addr-pin" ${peopleUi.addrPin ? 'checked' : ''}> 고정 (갱신기가 바꾸지 못하게)</label>
        <div class="gx-row-btns"><button class="gx-mini ps-save" data-action="pp-addr-save" data-value="${esc(name)}" ${peopleUi.busy ? 'disabled' : ''}>저장</button><button class="gx-mini" data-action="pp-addr-cancel">취소</button></div></div>`
    : `<div class="pp-addr"><b>${addr.toUser ? `「${esc(addr.toUser)}」` : '(호칭 없음)'}</b><span class="gx-badge">${esc(addr.register)}</span>${p.address.pin ? `<span class="gx-badge live">${ICONS.pin}고정</span>` : ''}<button class="gx-mini" data-action="pp-addr-edit" data-value="${esc(name)}">직접 수정</button></div>`;
  const slots = SLOTS.map((s) => {
    const all = p.slots[s] ?? [];
    if (!all.length) return '';
    const aliveIds = new Set(liveEntries(all, live).map((e) => e.id));
    // 살아 있는 것 먼저, 그 뒤 사라진·취소된 것 (회색)
    const sorted = [...all].sort((a, b) => Number(aliveIds.has(b.id)) - Number(aliveIds.has(a.id)));
    return `<section class="pp-slot"><h4>${esc(SLOT_LABEL[s])}<b>${aliveIds.size}</b></h4><ul class="pp-entries">${sorted.map((e) => entryRow(name, s, e, live, aliveIds.has(e.id))).join('')}</ul></section>`;
  }).join('');
  const mine = store.log.filter((c) => c.who === name).map((c) => ({ c, pos: live.at.get(c.anchor) ?? 1e9 })).sort((a, b) => b.pos - a.pos || b.c.seq - a.c.seq).map((x) => x.c);
  const log = `<details class="ps-adv-sub pp-log" data-keep="pp-log"${keepOpen('pp-log')}><summary>변경 기록<b>${mine.length}</b></summary>${mine.length ? `<ul class="pp-entries">${mine.map((c) => changeRow(c, live)).join('')}</ul>` : '<p class="ps-note">아직 변경 기록이 없어요.</p>'}</details>`;
  return `<div class="ph-room nw-pane pp-pane">${head(name, sub, `<button class="ph-tool" data-action="pp-reread" data-value="${esc(name)}" title="이 인물 다시 읽기" aria-label="이 인물 다시 읽기">${ICONS.refresh}</button>`)}
    <article class="nw-doc pp-doc">
      ${peopleUi.notice ? `<div class="gx-err" role="alert">${esc(peopleUi.notice)}</div>` : ''}
      <section class="pp-card"><h4>호감</h4>${affinityBar(aff.value)}${affEdit}</section>
      <section class="pp-card"><h4>호칭</h4>${addrEdit}</section>
      ${slots || '<p class="ps-note">아직 칸에 적힌 항목이 없어요.</p>'}
      ${log}
    </article>${toast('pp', peopleUi.info, (t) => {
      if (peopleUi.info === t) peopleUi.info = '';
    })}</div>`;
}

/** 사건·장소·세력·물건 문서 */
export function peopleDocsView(ctx: ChatContext): string {
  const store = peopleStore(ctx.chat);
  const live = liveness(ctx.chat);
  const byType = new Map<DocType, Doc[]>();
  for (const d of Object.values(store.docs)) (byType.get(d.type) ?? byType.set(d.type, []).get(d.type)!).push(d);
  const docEntry = (e: Entry, alive: boolean) => {
    const no = msgNo(e.anchor, live);
    const meta = [e.date ? `<span>${esc(e.date)}</span>` : '', e.place ? `<span>${esc(e.place)}</span>` : '', e.who?.length ? `<span>${esc(e.who.join(', '))}</span>` : '', no ? `<button class="pp-no" data-action="pp-jump" data-value="${esc(e.anchor)}">${no}</button>` : '', e.quote ? `<q>${esc(e.quote)}</q>` : ''].filter(Boolean).join('');
    return `<li class="pp-entry${!alive && !e.void ? ' dead' : ''}${e.void ? ' void' : ''}"><div class="pp-entry-main">${srcIcon(e.src)}<span class="pp-text">${esc(e.text)}</span></div><div class="pp-entry-meta">${meta}${!alive && !e.void ? '<span class="pp-gone">메시지가 사라져 빠짐</span>' : ''}</div></li>`;
  };
  const sections = DOC_TYPES.filter((t) => byType.has(t)).map((t) => {
    const docs = byType.get(t)!;
    const inner = docs.map((d) => {
      const aliveIds = new Set(liveEntries(d.entries, live).map((e) => e.id));
      const sorted = [...d.entries].sort((a, b) => Number(aliveIds.has(b.id)) - Number(aliveIds.has(a.id)));
      return `<section class="pp-slot"><h4>${esc(d.key)}<b>${aliveIds.size}</b></h4><ul class="pp-entries">${sorted.map((e) => docEntry(e, aliveIds.has(e.id))).join('')}</ul></section>`;
    }).join('');
    return `<section class="nw-hsec pp-sec"><h3>${DOC_LABEL[t]}<b>${docs.length}</b></h3>${inner}</section>`;
  }).join('');
  return `<div class="ph-room nw-pane pp-pane">${head('기록 문서', '사건 · 장소 · 세력 · 물건')}
    <article class="nw-doc pp-doc">${sections || '<div class="ph-blank"><p>아직 기록된 문서가 없어요.<br>본편에서 사건·장소·세력·물건이 바뀌면 여기에 쌓여요.</p></div>'}</article></div>`;
}

// ── 조작 ──

async function mutate(ctx: ChatContext, env: PeopleEnv, fn: (store: PeopleStore, chat: Chat) => boolean): Promise<void> {
  peopleUi.busy = true;
  peopleUi.notice = '';
  env.render();
  try {
    await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
      const store = peopleStore(chat);
      return fn(store, chat) ? withPeople(chat, store) : null;
    });
  } catch (error) {
    peopleUi.notice = error instanceof Error ? error.message : String(error);
  }
  peopleUi.busy = false;
  await env.refresh();
}

function findEntry(store: PeopleStore, key: string): Entry | null {
  const [who, slot, id] = key.split('|');
  const list = store.people[who]?.slots[slot as SlotId];
  return list?.find((e) => e.id === id) ?? null;
}

function nextSeq(store: PeopleStore, anchor: string): number {
  return store.log.filter((c) => c.anchor === anchor).reduce((m, c) => Math.max(m, c.seq), -1) + 1;
}

function userFaction(chat: Chat): string {
  const v = chat.scriptstate?.['$st_faction'] ?? chat.scriptstate?.['st_faction'];
  return typeof v === 'string' ? v : '';
}

/** 입력칸 (다시 그리지 않음). 처리했으면 true */
export function peopleInput(name: string, value: string): boolean {
  switch (name) {
    case 'pp-aff-num':
      peopleUi.affNum = value;
      return true;
    case 'pp-aff-reason':
      peopleUi.affReason = value;
      return true;
    case 'pp-addr-to':
      peopleUi.addrTo = value;
      return true;
    case 'pp-rules':
    case 'pp-director-rules':
      return true;
  }
  return false;
}

/** pp-* 단추. 처리했으면 true */
export async function handlePeople(action: string, value: string | undefined, ctx: ChatContext, env: PeopleEnv): Promise<boolean> {
  const v = value ?? '';
  switch (action) {
    case 'pp-set': {
      const i = v.indexOf('=');
      if (i < 0) return true;
      const k = v.slice(0, i);
      const val = v.slice(i + 1);
      if (!(k in PP_DEFAULTS)) return true;
      // 처음 「매 턴」 또는 「메인」으로 바꾸면 비용 안내 한 줄
      if (!peopleUi.warned && ((k === 'when' && val === 'turn') || (k === 'model' && val === 'main'))) {
        peopleUi.warned = true;
        peopleUi.info = k === 'model' ? '응답마다 메인 모델을 한 번 더 불러요.' : '응답마다 보조 모델을 한 번 더 불러요.';
      }
      await setVars(ctx, env, { [PP(k)]: val });
      return true;
    }
    case 'pp-rules-save':
    case 'pp-drules-save': {
      // data-take 로 입력칸 글이 value 로 온다
      const key = action === 'pp-drules-save' ? 'director_rules' : 'rules';
      await setVars(ctx, env, { [PP(key)]: v.slice(0, key === 'rules' ? 4000 : 2000) });
      peopleUi.info = '지침을 저장했어요.';
      env.render();
      return true;
    }
    case 'pp-update': {
      if (peopleStatus().busy) return true;
      peopleUi.notice = '';
      const s = peopleSettings(ctx.chat.scriptstate);
      if (!s.on) {
        peopleUi.notice = '인물 기록이 꺼져 있어요. 설정에서 켜 주세요.';
        env.render();
        return true;
      }
      env.render();
      try {
        const r = await requestPeopleUpdate('manual', { manual: true });
        peopleUi.info = r.errors.length ? `갱신 실패: ${r.errors[0]}` : r.ran ? `갱신 ${r.ran}회 · 반영 ${r.applied}개` : r.skipped.length ? `건너뜀: ${r.skipped[0]}` : '읽을 응답이 없어요.';
      } catch (error) {
        peopleUi.notice = error instanceof Error ? error.message : String(error);
      }
      peopleUi.diag = null;
      await env.refresh();
      return true;
    }
    case 'pp-diag-toggle':
      if (peopleUi.diagOpen.has(v)) peopleUi.diagOpen.delete(v);
      else peopleUi.diagOpen.add(v);
      if (!peopleUi.diagShow.startsWith(`${v}:`)) peopleUi.diagShow = '';
      env.render();
      return true;
    case 'pp-diag-show':
      peopleUi.diagShow = peopleUi.diagShow === v ? '' : (v as typeof peopleUi.diagShow);
      env.render();
      return true;
    case 'pp-diag-clear':
      await clearDiag();
      peopleUi.diag = [];
      peopleUi.diagOpen.clear();
      peopleUi.diagShow = '';
      env.render();
      return true;
    case 'pp-register': {
      const sheet = sheetOf(ctx);
      await mutate(ctx, env, (store, chat) => {
        const pend = store.pending[v];
        if (!pend || store.people[v]) return false;
        const b = basePerson(v);
        store.people[v] = seedPerson(v, sheet(v), { faction: b?.faction ?? '', express: b?.express, affinityBase: userAffinityBase(b?.faction ?? '', userFaction(chat)), aliases: pend.aliases ?? [] });
        delete store.pending[v];
        return true;
      });
      peopleUi.info = `「${v}」을(를) 등록했어요.`;
      env.render();
      return true;
    }
    case 'pp-ignore':
      await mutate(ctx, env, (store) => {
        if (!store.pending[v]) return false;
        delete store.pending[v];
        if (!store.ignored.includes(v)) store.ignored.push(v);
        return true;
      });
      return true;
    case 'pp-pin':
      await mutate(ctx, env, (store) => {
        const e = findEntry(store, v);
        if (!e) return false;
        if (e.pin) delete e.pin;
        else e.pin = true;
        return true;
      });
      return true;
    case 'pp-void':
      await mutate(ctx, env, (store) => {
        const e = findEntry(store, v);
        if (!e) return false;
        if (e.void) delete e.void;
        else e.void = true;
        return true;
      });
      return true;
    case 'pp-change-void':
      await mutate(ctx, env, (store) => {
        const c = store.log.find((x) => x.id === v);
        if (!c) return false;
        if (c.void) delete c.void;
        else c.void = true;
        return true;
      });
      return true;
    case 'pp-num-toggle':
      peopleUi.showNum = !peopleUi.showNum;
      env.render();
      return true;
    case 'pp-aff-edit':
      Object.assign(peopleUi, { affEdit: true, affStage: '', affNum: '', affReason: '', notice: '' });
      env.render();
      return true;
    case 'pp-aff-cancel':
      peopleUi.affEdit = false;
      env.render();
      return true;
    case 'pp-aff-stage':
      peopleUi.affStage = v;
      return true;
    case 'pp-aff-save': {
      const reason = peopleUi.affReason.trim();
      const raw = peopleUi.affNum.trim() !== '' ? Number(peopleUi.affNum) : peopleUi.affStage !== '' ? stageMid(Number(peopleUi.affStage)) : NaN;
      if (!Number.isFinite(raw)) {
        peopleUi.notice = '단계를 고르거나 숫자를 적어 주세요.';
        env.render();
        return true;
      }
      if (!reason) {
        peopleUi.notice = '이유를 적어 주세요. 변경 기록에 남아요.';
        env.render();
        return true;
      }
      const pin = Math.max(AFF_MIN, Math.min(AFF_MAX, Math.round(raw)));
      await mutate(ctx, env, (store, chat) => {
        if (!store.people[v]) return false;
        const anchor = anchorOf(chat);
        const seq = nextSeq(store, anchor);
        return putChange(store, { id: changeId(v, 'cue', anchor, seq, `pin:${pin}:${reason}`), anchor, seq, src: 'manual', who: v, kind: 'cue', pin, reason: plain(reason, 80) });
      });
      peopleUi.affEdit = false;
      peopleUi.info = `호감을 ${pin}(${stageOf(pin).label})으로 고정했어요.`;
      env.render();
      return true;
    }
    case 'pp-addr-edit': {
      const store = peopleStore(ctx.chat);
      const p = store.people[v];
      const cur = p ? addressOf(p, liveChanges(store, liveness(ctx.chat))) : null;
      Object.assign(peopleUi, { addrEdit: true, addrTo: cur?.toUser ?? '', addrReg: cur?.register ?? '존댓말', addrPin: !!p?.address.pin, notice: '' });
      env.render();
      return true;
    }
    case 'pp-addr-cancel':
      peopleUi.addrEdit = false;
      env.render();
      return true;
    case 'pp-addr-reg': {
      const reg = v.replace(/^reg=/, '');
      if (reg === '존댓말' || reg === '반말' || reg === '혼합') peopleUi.addrReg = reg;
      env.render();
      return true;
    }
    case 'pp-addr-pin':
      // 체크박스의 change: 값은 늘 'on' 이라 뒤집는다 (그릴 때 checked 는 상태에서 온다)
      peopleUi.addrPin = !peopleUi.addrPin;
      return true;
    case 'pp-addr-save': {
      const toUser = plain(peopleUi.addrTo, 40);
      const register = peopleUi.addrReg;
      const pinIt = peopleUi.addrPin;
      await mutate(ctx, env, (store, chat) => {
        const p = store.people[v];
        if (!p) return false;
        // 고정이면 시작값 자리에 두고 pin. 아니면 수동 변경 기록 하나
        if (pinIt) {
          p.address = { toUser, register, pin: true };
          return true;
        }
        if (p.address.pin) delete p.address.pin;
        const anchor = anchorOf(chat);
        const seq = nextSeq(store, anchor);
        return putChange(store, { id: changeId(v, 'address', anchor, seq, `${toUser}|${register}`), anchor, seq, src: 'manual', who: v, kind: 'address', toUser: toUser || p.address.toUser, register, reason: '직접 수정' });
      });
      peopleUi.addrEdit = false;
      peopleUi.info = '호칭을 저장했어요.';
      env.render();
      return true;
    }
    case 'pp-reread':
      peopleUi.info = '「이 인물 다시 읽기」는 다음 판에서 들어와요. 지금은 「지금 갱신」으로 안 읽은 응답을 읽을 수 있어요.';
      env.render();
      return true;
    case 'pp-jump': {
      // 근거 메시지 번호: 채팅 화면의 그 메시지로 (플러그인 iframe 밖이라 안내만)
      const live = liveness(ctx.chat);
      const pos = live.at.get(v);
      const text = pos !== undefined && pos >= 0 ? messageText(String(ctx.chat.message[pos]?.data ?? '')).slice(0, 120) : '';
      peopleUi.info = text ? `#${(pos ?? 0) + 1}: ${text}${text.length >= 120 ? '…' : ''}` : '그 메시지는 채팅에 없어요.';
      env.render();
      return true;
    }
  }
  return false;
}

/** 단계 선택 → 그 단계 가운데 값 */
function stageMid(max: number): number {
  const i = STAGES.findIndex((s) => s.max === max);
  if (i < 0) return NaN;
  const lo = i ? STAGES[i - 1].max + 1 : AFF_MIN;
  return Math.round((lo + max) / 2);
}

