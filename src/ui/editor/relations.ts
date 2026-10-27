// 세력 관계 (2026-10-27 새 레이아웃): 격자 대신 왼쪽에 조직 목록, 오른쪽에 「고른 조직 → 다른 조직」 한 줄씩 단계 고르기.
// 다른 설정 페이지와 같은 줄 모양(이름 · 조작 · 설명). 「대칭」이 켜져 있으면 반대 방향도 같이. 메모는 기본이 비어 있고 쓴 것만 Faction 표 아래 Notes 로.
import { switchHtml } from '../controls';
import { excludedOrgs, filterRelations, PLACEHOLDER_ORGS, RELATION_LABEL, RELATION_STAGES, worldRecord, worldRecords, worldRelations, type RelationCell, type RelationStage, type WorldOverrides } from '../../core/world/records';
import { tokenizerName } from '../../core/tokenizer';
import { assembleFaction } from '../../core/world/faction';
import { emptyRecord, putRecord } from '../../core/world/draft';
import { tokens } from '../../core/gnet';
import { getPrefs } from '../../core/settings';
import { savePrefs } from '../../host/prefs';
import type { ChatContext } from '../../host/risu';
import { directoryDraft } from '../directory';
import { ICONS } from '../icons';
import { edUi, setOverrides } from './index';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const relUi = { org: '', preview: false };

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

const seg = (key: string, cur: RelationStage) =>
  `<div class="gx-segs gx-segs-sm">${RELATION_STAGES.map((s) => `<button class="gx-seg${cur === s ? ' on' : ''}" data-action="ed-rel-set" data-value="${esc(`${key}:${s}`)}" aria-pressed="${cur === s}">${RELATION_LABEL[s]}</button>`).join('')}</div>`;

export function relationsPage(ctx: ChatContext, over: WorldOverrides, rulesOnly: boolean): string {
  void rulesOnly;
  const d = directoryDraft(ctx);
  const recs = worldRecords('org', over);
  const excluded = excludedOrgs(recs);
  const rel = filterRelations(worldRelations(over), excluded);
  const all = d.orgs.map((o) => o).filter((o) => !PLACEHOLDER_ORGS.has(o.name));
  const included = all.filter((o) => !excluded.has(o.name));
  if (!relUi.org || !all.some((o) => o.name === relUi.org)) relUi.org = included[0]?.name ?? all[0]?.name ?? '';
  const sel = relUi.org;
  const selOff = excluded.has(sel);
  const stageOf = (a: string, b: string): RelationStage => rel.pairs[`${a}>${b}`]?.stage ?? 'neutral';
  const fac = assembleFaction(d, recs, rel);

  const list = all
    .map((o) => {
      const off = excluded.has(o.name);
      const n = off ? 0 : included.filter((x) => x.name !== o.name && stageOf(o.name, x.name) !== 'neutral').length;
      return `<div class="gw-rowbox${sel === o.name ? ' on' : ''}"><button class="gw-row" data-action="ed-rel-pick" data-value="${esc(o.name)}"><b>${esc(o.name)}</b><small>${esc(o.spec.english || '')}</small>${off ? '<span class="gw-badge">제외</span>' : n ? `<span class="gw-rel-n">${n}</span>` : ''}</button></div>`;
    })
    .join('');
  const rows = included
    .filter((o) => o.name !== sel)
    .map((o) => {
      const key = `${sel}>${o.name}`;
      const back = stageOf(o.name, sel);
      const memo = rel.pairs[key]?.memo ?? '';
      return `<div class="ps-row"><div class="ps-label"><b>${esc(o.name)}</b><small>${esc(o.name)} → ${esc(sel)}: ${RELATION_LABEL[back]}</small></div>
        <div class="ps-ctl">${seg(key, stageOf(sel, o.name))}<input class="gw-rel-memo" data-input="ed-rel-memo" data-key="${esc(key)}" value="${esc(memo)}" placeholder="메모 (선택)" autocomplete="off"></div></div>`;
    })
    .join('');
  const basic = `<section class="ps-group"><h3>기본</h3><div class="ps-rows">
      <div class="ps-row"><div class="ps-label"><b>세력 관계도에 포함</b><small>${selOff ? '관계 표·Faction 표·평판 시작값에서 빠져요 (민간인처럼 세력이 아닌 조직).' : 'Faction 지침의 관계 표에 들어가요. 조직 기록에서도 켜고 끌 수 있어요.'}</small></div>
        <div class="ps-ctl">${switchHtml({ action: 'ed-rel-org', value: sel, on: !selOff })}</div></div>
    </div></section>`;
  const stages = selOff
    ? ''
    : `<section class="ps-group"><h3>${esc(sel)} → 다른 조직 <small>단계는 세력 평판 5단계와 같고 평판 시작값이 돼요. 설명 줄은 반대 방향.</small></h3><div class="ps-rows gw-rel-rows">${rows || '<p class="ps-note">관계도에 든 다른 조직이 없어요.</p>'}</div></section>`;
  const rules = `<section class="ps-group"><h3>공통 규칙 <small>쌍 관계가 아닌 세력 전체 규칙. Faction 지침 끝에 그대로. {A00} 같은 자리표는 그 코드 조직의 이름으로.</small></h3><div class="ps-rows">
      <div class="ps-row"><textarea class="gw-rules" data-input="ed-rules" rows="8">${esc(rel.common)}</textarea></div>
      <div class="ps-row gw-rel-foot"><span class="gw-tokens">${tokenizerName() ? '' : '약 '}${tokens(rel.common).toLocaleString()}토큰</span><button class="gx-mini" data-action="ed-rules-reset" ${over.relations?.common === undefined ? 'disabled' : ''}>기본으로</button></div>
    </div></section>`;
  return `<div class="gw-page split">
    <div class="gw-list-pane"><div class="gw-list-tools"><span class="gw-list-title">조직 ${included.length}${all.length > included.length ? ` <small>· 제외 ${all.length - included.length}</small>` : ''}</span></div><div class="gw-list gw-rel-list">${list}</div></div>
    <div class="gw-detail">
      <header class="gw-head"><h2>${esc(sel)}</h2>
        <div class="gw-head-act"><span class="gw-tokens">Faction ${tokenizerName() ? '' : '약 '}${tokens(fac).toLocaleString()}토큰</span>
          <button class="gx-chip${sym() ? ' on' : ''}" data-action="ed-rel-sym" aria-pressed="${sym()}">대칭</button>
          <button class="gx-mini${relUi.preview ? ' on' : ''}" data-action="ed-rel-preview">${ICONS.book}Faction 지침 보기</button></div>
        <p class="gx-muted">고른 조직이 다른 조직을 어떻게 보는지 한 줄씩 정해요. 「대칭」이 켜져 있으면 반대 방향도 같이 바뀌어요. 표 하나가 Faction 지침에 들어가고, 메모를 쓴 줄만 표 아래 한 줄로 붙어요.</p></header>
      ${relUi.preview ? `<pre class="gw-preview">${esc(fac)}</pre>` : ''}
      ${basic}
      ${stages}
      ${rules}
    </div>
  </div>`;
}

export function relationsInput(name: string, key: string, value: string, ctx: ChatContext): boolean {
  void ctx;
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
    const stage = rel.pairs[key]?.stage ?? 'neutral';
    const cell: RelationCell | null = stage === 'neutral' && !value.trim() ? null : { stage, ...(value.trim() ? { memo: value } : {}) };
    setOverrides(setCell(over, key, cell));
    return true;
  }
  return false;
}

export async function relationsAction(action: string, value: string | undefined, ctx: ChatContext): Promise<boolean> {
  void ctx;
  const over = edUi.over;
  switch (action) {
    case 'ed-rel-pick':
      relUi.org = value ?? '';
      return true;
    case 'ed-rel-set': {
      const at = (value ?? '').lastIndexOf(':');
      if (at < 0) return true;
      const key = value!.slice(0, at);
      const stage = value!.slice(at + 1) as RelationStage;
      if (!key.includes('>') || !RELATION_STAGES.includes(stage)) return true;
      return setStage(over, key, stage, worldRelations(over));
    }
    case 'ed-rel-sym':
      await savePrefs((p) => ({ ...p, relationsSym: sym() ? false : undefined }));
      return true;
    case 'ed-rel-preview':
      relUi.preview = !relUi.preview;
      return true;
    case 'ed-rel-org': {
      // 조직을 관계도에 넣거나 뺀다 (조직 기록의 relOff). 뺀 조직의 쌍은 그대로 두되 쓰지 않는다
      const name = value || relUi.org;
      if (!name) return false;
      const rec = worldRecord('org', name, over) ?? emptyRecord();
      setOverrides(putRecord(over, 'org', name, { ...rec, relOff: !rec.relOff }));
      return true;
    }
    case 'ed-rules-reset': {
      const relations: NonNullable<WorldOverrides['relations']> = { ...(over.relations ?? {}) };
      delete relations.common;
      const next: WorldOverrides = { ...over, relations };
      if (!Object.keys(relations).length) delete next.relations;
      setOverrides(next);
      return true;
    }
  }
  return false;
}

function setStage(over: WorldOverrides, key: string, stage: RelationStage, rel: ReturnType<typeof worldRelations>): boolean {
  const apply = (o: WorldOverrides, k: string): WorldOverrides => {
    const memo = rel.pairs[k]?.memo ?? '';
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
