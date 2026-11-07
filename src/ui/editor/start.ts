// 설정 창 세계 › 시작 화면 (2026-11-05 사용자 결정): 시작 화면 칸(기본 세력·플레이 조직·묶음)의 순서와 켜고 끄기, 묶음(조직 아님, 예: 중립)의
// 이름·설명·사진·구성원, 칸마다 첫 장면 글(공용 장면 덧쓰기·새 장면, 묶음 구성원별 장면). 값은 명부 초안(ui/directory.ts dirUi.draft)에 들어가고
// 세계 탭의 저장 줄로 저장된다. 동작은 directory.ts handleDirectory 의 dir-start-* · dir-group-* · dir-scene-*, 입력은 directoryInput 의 group: · scene: · ascene: 열쇠.
import { BUILTIN } from '../../core/factions';
import { SCENARIOS } from '../../core/scenarios';
import { agentScene, agentSceneSaved, factionScenes } from '../../core/scenes';
import type { Directory } from '../../core/world/directory';
import type { ChatContext } from '../../host/risu';
import { directoryDraft, photoBlock, startSlots, type StartSlot } from '../directory';
import { ICONS } from '../icons';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const stUi = {
  /** 펼친 칸 코드 */
  sel: '',
  /** 묶음 지우기 확인 중인 코드 */
  confirm: '',
};

const input = (key: string, value: string, label: string, help = '') =>
  `<label class="dir-in"><span>${label}</span><input data-input="dir" data-key="${esc(key)}" value="${esc(value)}" autocomplete="off">${help ? `<small>${help}</small>` : ''}</label>`;
const area = (key: string, value: string, label: string, rows = 6, help = '') =>
  `<label class="dir-in"><span>${label}</span><textarea data-input="dir" data-key="${esc(key)}" rows="${rows}">${esc(value)}</textarea>${help ? `<small>${help}</small>` : ''}</label>`;
const seg = (action: string, value: string, on: boolean, a: string, b: string) =>
  `<div class="gx-segs gx-segs-sm"><button class="gx-seg${on ? ' on' : ''}" data-action="${action}" data-value="${esc(`1|${value}`)}">${a}</button><button class="gx-seg${!on ? ' on' : ''}" data-action="${action}" data-value="${esc(`0|${value}`)}">${b}</button></div>`;

/** 칸 한 줄 (순서 목록) */
function slotRow(s: StartSlot, i: number, n: number): string {
  const open = stUi.sel === s.code;
  const kind = s.kind === 'builtin' ? '기본 세력' : s.kind === 'group' ? '묶음' : '플레이 조직';
  return `<div class="dir-row${open ? ' open' : ''}">
    <div class="dir-head st-slot">
      <span class="dir-name"><b>${esc(s.name)}</b><small>${kind} · ${esc(s.code)}${s.count ? ` · ${s.count}명` : ''}</small></span>
      ${seg('dir-start-show', s.code, !s.hidden, '보임', '숨김')}
      <span class="gx-row-btns">
        <button class="gx-mini" data-action="dir-start-move" data-value="${esc(`up|${s.code}`)}" ${i === 0 ? 'disabled' : ''} aria-label="위로">${ICONS.up}</button>
        <button class="gx-mini" data-action="dir-start-move" data-value="${esc(`down|${s.code}`)}" ${i === n - 1 ? 'disabled' : ''} aria-label="아래로">${ICONS.down}</button>
        <button class="gx-mini" data-action="dir-start-open" data-value="${esc(s.code)}" aria-expanded="${open}">${open ? '접기' : '열기'}</button>
      </span>
    </div>
  </div>`;
}

/** 칸마다 첫 장면: 공용 장면(기본 글 덧쓰기·숨김) + 새 장면 */
function scenesBlock(code: string, d: Directory): string {
  const rows = factionScenes(code, d.scenes);
  const list = rows
    .map((r) => {
      const k = (f: string) => `scene:${code}|${r.fm}|${f}`;
      // 11-07 사용자: 공용 장면 일곱 편이 한 번에 다 펼쳐져 보여 과함 → 구성원별 첫 장면처럼 접어 두고 제목만 보인다
      return `<details class="st-scene${r.hidden ? ' off' : ''}"><summary><b>${esc(r.label || `장면 ${r.fm}`)}</b><small>${r.custom ? '새 장면' : '기본 장면'} ${r.fm}${r.hidden ? ' · 숨김' : ''}</small></summary>
        <div class="dir-line"><span>${r.custom ? '새 장면' : '기본 장면'} ${r.fm}</span>
          <span class="gx-row-btns">${seg('dir-scene-show', `${code}|${r.fm}`, !r.hidden, '보임', '숨김')}${r.custom ? `<button class="gx-mini danger" data-action="dir-scene-del" data-value="${esc(`${code}|${r.fm}`)}">지우기</button>` : ''}</span></div>
        ${input(k('label'), r.label, '이름')}
        ${area(k('ko'), r.ko, '한국어', 6, r.hasDefault ? '비우면 기본 글로 돌아가요' : '')}
        ${area(k('en'), r.en, 'English', 6, r.hasDefault ? '비우면 기본 글로 돌아가요' : '')}
      </details>`;
    })
    .join('');
  const tail = (BUILTIN.includes(code) ? SCENARIOS.factions.find((f) => f.code === code)?.scenarios ?? [] : []).filter((s) => s.kind !== 'opening').map((s) => s.label);
  return `<div class="dir-line"><span>첫 장면</span><button class="gx-mini" data-action="dir-scene-add" data-value="${esc(code)}">${ICONS.plus} 장면 추가</button></div>
    <p class="gx-muted">내 페르소나로 시작할 때 고르는 공용 장면이에요. 인물로 시작하면 그 인물의 첫 장면(요원 기록 · 묶음 구성원 칸)과 직접 입력·커스텀 임무만 보여요.${tail.length ? ` 직접 입력·커스텀 임무는 늘 있어요.` : ''}</p>
    ${list || '<p class="gx-muted">공용 장면이 없어요. 직접 입력·커스텀 임무로 시작해요.</p>'}`;
}

/** 묶음 구성원: 명부의 모든 요원 중 고르기 + 구성원별 첫 장면 */
function membersBlock(code: string, d: Directory): string {
  const all = d.agents.filter((a) => /^P\d{3,}$/.test(a.id) && a.name);
  const members = all.filter((a) => a.rosterFor.includes(code));
  const chips = all
    .map((a) => `<button class="gx-chip${a.rosterFor.includes(code) ? ' on' : ''}" data-action="dir-group-member" data-value="${esc(`${code}|${a.id}`)}" aria-pressed="${a.rosterFor.includes(code)}">${esc(a.name)}</button>`)
    .join('');
  const scenes = members
    .map((a) => {
      const saved = agentSceneSaved(a.id, d.scenes);
      // 기본 글(세계 자료 팩)이 없는 인물은 「없음」으로 — 11-05 캡처에서 글이 없는데도 「기본 글」이라 적혀 있었다
      const def = agentScene(a.id, undefined);
      const hasDefault = !!def;
      // 11-07 사용자: 「기본 글」이라면서 칸이 비어 있음 → 기본 글을 칸에 그대로 보인다. 고치면 저장값, 기본 글과 같거나 비우면 저장값을 지운다(directoryInput ascene:)
      const k = (f: string) => `ascene:${a.id}|${f}`;
      return `<details class="st-member"><summary><b>${esc(a.name)}</b><small>${esc(a.id)} · ${saved?.ko || saved?.en || saved?.label ? '직접 고친 글' : hasDefault ? '기본 글' : '첫 장면 없음'}</small></summary>
        ${input(k('label'), saved?.label ?? def?.label ?? '', '제목', '시작 화면 첫 장면 칸에 보여요. 비우면 「○○의 첫 장면」')}
        ${area(k('ko'), saved?.ko ?? def?.ko ?? '', '한국어', 10, hasDefault ? '기본 글(세계 자료)이에요. 고치면 고친 글로, 비우면 기본 글로 돌아가요' : '비우면 이 인물로 시작할 때 「○○의 첫 장면」 칸이 안 나와요')}
        ${area(k('en'), saved?.en ?? def?.en ?? '', 'English', 10, hasDefault ? '기본 글이에요. 고치면 고친 글로, 비우면 기본 글로 돌아가요' : '')}
      </details>`;
    })
    .join('');
  return `<div class="dir-line"><span>구성원 ${members.length}명</span></div><div class="dir-chips">${chips}</div>
    <p class="gx-muted">묶음으로 시작하면 내 페르소나 없이 구성원 한 명을 골라 그 인물로 시작해요. 사원증·괴담톡 탭·소속은 그 인물의 원래 조직을 따르고, 묶음 이름은 모델에게 알리지 않아요.</p>
    <div class="dir-line"><span>구성원별 첫 장면</span></div>${scenes || '<p class="gx-muted">구성원을 고르면 인물별 첫 장면을 고칠 수 있어요.</p>'}`;
}

function slotDetail(s: StartSlot, ctx: ChatContext, d: Directory): string {
  if (s.kind === 'group') {
    const g = d.startGroups.find((x) => x.code === s.code);
    if (!g) return '';
    const k = (f: string) => `group:${f}|${g.code}`;
    const del = stUi.confirm === g.code
      ? `<div class="gx-hint">「${esc(g.name)}」 묶음을 지울까요? 구성원 요원과 첫 장면 글은 남아요. <button class="gx-mini danger" data-action="dir-group-del" data-value="${esc(`yes|${g.code}`)}">지우기</button><button class="gx-mini" data-action="dir-group-del" data-value="${esc(`no|${g.code}`)}">취소</button></div>`
      : `<button class="gx-mini danger" data-action="dir-group-del" data-value="${esc(`ask|${g.code}`)}">${ICONS.trash} 묶음 지우기</button>`;
    return `<div class="dir-panel">
      ${input(k('name'), g.name, '이름')}
      ${area(k('blurb'), g.blurb, '시작 화면 설명', 3)}
      ${input(k('english'), g.english, '영문명', '사진 이름(「영문명」 이미지)과 영어 응답에서 써요')}
      ${photoBlock(`group:${g.code}`, ctx)}
      ${membersBlock(g.code, d)}
      ${scenesBlock(g.code, d)}
      <div class="dir-line">${del}</div>
    </div>`;
  }
  const o = s.org;
  if (!o) return '';
  const k = (f: string) => `org:${f}|${o.name}`;
  const off = s.kind === 'extra' ? `<div class="dir-line"><span>플레이 조직 <b class="dir-code">${esc(s.code)}</b></span><button class="gx-mini" data-action="dir-fac-play" data-value="${esc(`0|${o.name}`)}">시작 칸에서 빼기</button></div>` : '';
  return `<div class="dir-panel">
    ${off}
    ${input(k('title'), o.spec.title ?? '', '시작 화면 이름', s.kind === 'builtin' ? '비우면 원래 이름' : '비우면 조직 이름')}
    ${area(k('blurb'), o.spec.blurb ?? '', '시작 화면 설명', 3)}
    ${photoBlock(`org:${o.name}`, ctx)}
    ${scenesBlock(s.code, d)}
    <p class="gx-muted">부르는 이름·괴담톡 탭·함께 넣을 로어북·모델용 설명은 조직 기록의 「기본 정보」에서 고쳐요.</p>
  </div>`;
}

export function startPage(ctx: ChatContext): string {
  const d = directoryDraft(ctx);
  const slots = startSlots(d);
  const sel = slots.find((s) => s.code === stUi.sel);
  const idle = d.orgs.filter((o) => !o.faction && !(o.spec.playable && o.spec.code));
  const addOrg = idle.length
    ? `<div class="dir-line"><span>조직을 시작 칸으로</span></div><div class="dir-chips">${idle.map((o) => `<button class="gx-chip" data-action="dir-fac-play" data-value="${esc(`1|${o.name}`)}">${ICONS.plus} ${esc(o.name)}</button>`).join('')}</div>`
    : '';
  return `<div class="gw-page gw-startpage">
    <header class="gw-head"><h2>시작 화면</h2><p class="gx-muted">새 채팅의 「어느 쪽에 설까요?」에 보이는 칸이에요. 순서와 보임을 정하고, 칸을 열어 이름·설명·사진·첫 장면을 고쳐요. 묶음은 조직이 아니라 여러 조직의 인물을 한 칸에 모은 거예요.</p></header>
    <div class="dir-list st-slots">${slots.map((s, i) => slotRow(s, i, slots.length)).join('')}</div>
    <div class="dir-line"><button class="gx-mini" data-action="dir-group-add">${ICONS.plus} 묶음 추가</button></div>
    ${addOrg}
    ${sel ? `<h3 class="st-sel"><span>${esc(sel.name)}</span><small>${esc(sel.code)}</small></h3>${slotDetail(sel, ctx, d)}` : ''}
  </div>`;
}
