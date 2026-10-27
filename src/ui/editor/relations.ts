// 세력 관계 격자 (docs/설계안_세계편집.md 2장): 행 = 보는 쪽, 열 = 대상. 칸 34px, 색 칸 + 두 글자, 첫 행·열 고정.
// 칸을 누르면 단계 순환(적대→경계→중립→호의→우호), 아래에 메모. 「대칭」이 켜져 있으면 반대 칸도 같이. 공통 규칙은 글칸 하나.
import { RELATION_LABEL, RELATION_STAGES, worldRelations, type RelationCell, type RelationStage, type WorldOverrides } from '../../core/world/records';
import { assembleFaction } from '../../core/world/faction';
import { worldRecords } from '../../core/world/records';
import { tokens } from '../../core/gnet';
import { getPrefs } from '../../core/settings';
import { savePrefs } from '../../host/prefs';
import type { ChatContext } from '../../host/risu';
import { directoryDraft } from '../directory';
import { edUi, setOverrides } from './index';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const relUi = { cell: '' as string, preview: false };
const SHORT: Record<RelationStage, string> = { hostile: '적대', wary: '경계', neutral: '', favorable: '호의', friendly: '우호' };

const sym = () => getPrefs().relationsSym !== false;

function setCell(over: WorldOverrides, key: string, cell: RelationCell | null): WorldOverrides {
  const pairs = { ...(over.relations?.pairs ?? {}) };
  const base = worldRelations().pairs[key];
  // 기본값과 같으면 덧쓰기를 지운다 (기본에 없는 쌍의 중립은 null 로 적지 않음)
  if (cell === null) {
    if (base) pairs[key] = null;
    else delete pairs[key];
  } else if (base && base.stage === cell.stage && (base.memo ?? '') === (cell.memo ?? '')) delete pairs[key];
  else pairs[key] = cell;
  const relations: NonNullable<WorldOverrides['relations']> = { ...(over.relations ?? {}), pairs };
  if (!Object.keys(pairs).length) delete relations.pairs;
  const next: WorldOverrides = { ...over, relations };
  if (!Object.keys(relations).length) delete next.relations;
  return next;
}

export function relationsPage(ctx: ChatContext, over: WorldOverrides, rulesOnly: boolean): string {
  const d = directoryDraft(ctx);
  const rel = worldRelations(over);
  const orgs = d.orgs.map((o) => o.name);
  const player = String(ctx.chat.scriptstate?.['$st_faction'] ?? '');
  const playerOrg = player ? d.orgs.find((o) => o.faction === player)?.name ?? '' : '';
  void rulesOnly; // 2026-10-27: 세력 관계와 공통 규칙은 한 화면 (아래)
  const rulesBox = `<section class="gw-sec gw-rules-sec"><h3>공통 규칙 <small>쌍 관계가 아닌 세력 전체 규칙. Faction 지침 끝에 그대로 들어가요. {A00} 같은 자리표는 그 코드 조직의 이름으로 바뀌어요.</small></h3>
      <textarea class="gw-rules" data-input="ed-rules" rows="14">${esc(rel.common)}</textarea>
      <div class="gx-row-btns"><span class="gw-tokens">약 ${tokens(rel.common).toLocaleString()}토큰</span><button class="gx-mini" data-action="ed-rules-reset" ${over.relations?.common === undefined ? 'disabled' : ''}>기본으로</button></div></section>`;
  const stageOf = (a: string, b: string) => rel.pairs[`${a}>${b}`]?.stage ?? 'neutral';
  const head = `<tr><th class="corner"><span>보는 쪽 ↓ 대상 →</span></th>${orgs.map((o) => `<th class="col${o === playerOrg ? ' me' : ''}"><span>${esc(o)}</span></th>`).join('')}</tr>`;
  const rows = orgs
    .map((a) => `<tr><th class="row${a === playerOrg ? ' me' : ''}">${esc(a)}</th>${orgs
      .map((b) => {
        if (a === b) return '<td class="self"></td>';
        const key = `${a}>${b}`;
        const st = stageOf(a, b);
        const memo = rel.pairs[key]?.memo?.trim();
        return `<td class="st-${st}${relUi.cell === key ? ' sel' : ''}${a === playerOrg || b === playerOrg ? ' me' : ''}" data-action="ed-rel-cell" data-value="${esc(key)}" title="${esc(a)} → ${esc(b)}: ${RELATION_LABEL[st]}">${SHORT[st] ? `<span>${SHORT[st]}</span>` : ''}${memo ? '<em></em>' : ''}</td>`;
      })
      .join('')}</tr>`)
    .join('');
  const sel = relUi.cell;
  const [sa, sb] = sel.split('>');
  const cell = sel ? rel.pairs[sel] : undefined;
  const memoBox = sel
    ? `<div class="gw-rel-memo"><div class="gw-rel-memo-head"><b>${esc(sa)} → ${esc(sb)}</b>
        <div class="gx-segs gx-segs-sm">${RELATION_STAGES.map((s) => `<button class="gx-seg${(cell?.stage ?? 'neutral') === s ? ' on' : ''}" data-action="ed-rel-stage" data-value="${s}">${RELATION_LABEL[s]}</button>`).join('')}</div>
        <button class="gx-mini" data-action="ed-rel-clear">중립으로</button></div>
        <textarea data-input="ed-rel-memo" data-key="${esc(sel)}" rows="4" placeholder="메모 (선택). 단계만으로 안 되는 것만: 「협상 불가, 개인 유대도 배신」처럼">${esc(cell?.memo ?? '')}</textarea></div>`
    : '<p class="gx-muted">칸을 누르면 단계가 한 단계 바뀌고, 아래에 메모 칸이 열려요.</p>';
  const fac = assembleFaction(d, worldRecords('org', over), rel);
  return `<div class="gw-page"><header class="gw-head"><h2>세력 관계</h2>
      <div class="gw-head-act"><label class="gw-toggle"><input type="checkbox" data-action="ed-rel-sym" ${sym() ? 'checked' : ''}> 대칭 (반대 칸도 같이)</label>
        <button class="gx-mini${relUi.preview ? ' on' : ''}" data-action="ed-rel-preview">Faction 지침 보기</button><span class="gw-tokens">Faction 약 ${tokens(fac).toLocaleString()}토큰</span></div>
      <p class="gx-muted">행이 보는 쪽, 열이 대상이에요. 단계는 세력 평판 5단계와 같고 평판 시작값이 돼요. 중립은 빈 칸. ${playerOrg ? `지금 플레이 세력(${esc(playerOrg)}) 행·열은 옅게 칠했어요.` : ''}</p></header>
    <div class="gw-legend">${RELATION_STAGES.filter((s) => s !== 'neutral').map((s) => `<span class="st-${s}"><i></i>${RELATION_LABEL[s]}</span>`).join('')}<span><i class="none"></i>중립 (빈 칸)</span></div>
    <div class="gw-grid-wrap"><table class="gw-grid"><thead>${head}</thead><tbody>${rows}</tbody></table></div>
    ${memoBox}
    ${relUi.preview ? `<pre class="gw-preview">${esc(fac)}</pre>` : ''}
    ${rulesBox}
  </div>`;
}

export function relationsInput(name: string, key: string, value: string, ctx: ChatContext): boolean {
  const over = edUi.over;
  if (name === 'ed-rules') {
    const base = worldRelations().common;
    const relations: NonNullable<WorldOverrides['relations']> = { ...(over.relations ?? {}) };
    if (value === base) delete relations.common;
    else relations.common = value;
    const next: WorldOverrides = { ...over, relations };
    if (!Object.keys(relations).length) delete next.relations;
    setOverrides(next);
    return true;
  }
  if (name === 'ed-rel-memo') {
    const rel = worldRelations(over);
    const cur = rel.pairs[key];
    const stage = cur?.stage ?? 'neutral';
    const cell: RelationCell | null = stage === 'neutral' && !value.trim() ? null : { stage, ...(value.trim() ? { memo: value } : {}) };
    setOverrides(setCell(over, key, cell));
    void ctx;
    return true;
  }
  return false;
}

export async function relationsAction(action: string, value: string | undefined, ctx: ChatContext): Promise<boolean> {
  const over = edUi.over;
  const rel = worldRelations(over);
  switch (action) {
    case 'ed-rel-cell': {
      const key = value ?? '';
      if (relUi.cell !== key) {
        relUi.cell = key;
        return true;
      }
      // 같은 칸을 다시 누르면 단계 순환
      const cur = rel.pairs[key]?.stage ?? 'neutral';
      const next = RELATION_STAGES[(RELATION_STAGES.indexOf(cur) + 1) % RELATION_STAGES.length];
      return setStage(over, key, next, rel);
    }
    case 'ed-rel-stage':
      if (!relUi.cell || !RELATION_STAGES.includes(value as RelationStage)) return true;
      return setStage(over, relUi.cell, value as RelationStage, rel);
    case 'ed-rel-clear':
      if (relUi.cell) return setStage(over, relUi.cell, 'neutral', rel, true);
      return true;
    case 'ed-rel-sym':
      await savePrefs((p) => ({ ...p, relationsSym: sym() ? false : undefined }));
      return true;
    case 'ed-rel-preview':
      relUi.preview = !relUi.preview;
      return true;
    case 'ed-rules-reset': {
      const relations: NonNullable<WorldOverrides['relations']> = { ...(over.relations ?? {}) };
      delete relations.common;
      const next: WorldOverrides = { ...over, relations };
      if (!Object.keys(relations).length) delete next.relations;
      setOverrides(next);
      return true;
    }
  }
  void ctx;
  return false;
}

function setStage(over: WorldOverrides, key: string, stage: RelationStage, rel: ReturnType<typeof worldRelations>, clearMemo = false): boolean {
  const apply = (o: WorldOverrides, k: string): WorldOverrides => {
    const memo = clearMemo ? '' : rel.pairs[k]?.memo ?? '';
    const cell: RelationCell | null = stage === 'neutral' && !memo ? null : { stage, ...(memo ? { memo } : {}) };
    return setCell(o, k, cell);
  };
  let next = apply(over, key);
  if (sym()) {
    const [a, b] = key.split('>');
    next = apply(next, `${b}>${a}`);
  }
  setOverrides(next);
  return true;
}
