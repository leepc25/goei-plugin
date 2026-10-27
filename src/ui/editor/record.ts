// 공통 기록 편집기: 목록 → 상세. 기본 칸(종류별 schema) + 추가 칸 + 순서 + 글로 가져오기 + 칸별 토큰·합계 + 조립 글 보기 + 읽기 전용.
import type { Directory } from '../../core/world/directory';
import { emptyRecord, moveField, moveFieldTo, parseImport, putRecord, recordText, removeRecord, resetRecord, type ImportResult } from '../../core/world/draft';
import { defaultRecord, fieldOrder, fieldValue, isDefaultRecord, worldAnomalyNote, worldRecord, worldRecords, type ExtraField, type WorldOverrides, type WorldRecord } from '../../core/world/records';
import { ANOMALY_NOTE } from '../../core/world/schema';
import { orgOf } from '../../core/world/directory';
import { FIELDS, WORLD_KIND_LABEL, type FieldDef, type WorldKind } from '../../core/world/schema';
import { tokens } from '../../core/gnet';
import type { ChatContext } from '../../host/risu';
import { agentPanel, appendixPanel, directoryDraft, orgPanel, placePanel } from '../directory';
import { ICONS } from '../icons';
import { edUi, overridesOf, setOverrides } from './index';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const recUi = {
  /** 괴이 공통 머리말 칸 펼침 */
  noteOpen: false,
  preview: false,
  importOpen: false,
  importText: '',
  importResult: null as ImportResult | null,
  adding: false,
  newExtra: { name: '', kind: 'block' as 'line' | 'block' },
  variant: '' as string,
  tokensHtml: (ctx: ChatContext, kind: WorldKind, over: WorldOverrides): string => {
    const name = edUi.sel[kind] ?? '';
    const rec = name ? worldRecord(kind, name, over) : null;
    if (!rec) return '<span class="gw-tokens"></span>';
    return `<span class="gw-tokens">조립 약 ${tokens(recordText(kind, name, rec, directoryDraft(ctx))).toLocaleString()}토큰</span>`;
  },
};

/** 종류별 기록 이름·부제 (목록용) */
function rowsOf(ctx: ChatContext, kind: WorldKind, over: WorldOverrides): { name: string; sub: string; state: 'default' | 'edited' | 'new' | 'deleted' }[] {
  const d = directoryDraft(ctx);
  const recs = worldRecords(kind, over);
  const bucket = (over[kind] ?? {}) as Record<string, Partial<WorldRecord> & { deleted?: boolean }>;
  const names: string[] = [];
  if (kind === 'agent') names.push(...d.agents.map((a) => a.lore));
  else if (kind === 'anomaly') names.push(...d.anomalies.map((p) => p.lore));
  else if (kind === 'site') names.push(...d.sites.map((p) => p.lore));
  else if (kind === 'org') names.push(...d.orgs.map((o) => o.name));
  else names.push(...d.appendices.map((r) => r.lore));
  for (const n of recs.keys()) if (!names.includes(n)) names.push(n);
  for (const n of Object.keys(bucket)) if (!names.includes(n)) names.push(n);
  return names.map((name) => {
    const rec = recs.get(name);
    const sub =
      kind === 'agent' ? d.agents.find((a) => a.lore === name)?.english ?? '' : kind === 'org' ? d.orgs.find((o) => o.name === name)?.spec.english ?? '' : (d.anomalies.find((p) => p.lore === name) ?? d.sites.find((p) => p.lore === name))?.english ?? '';
    const state = bucket[name]?.deleted ? 'deleted' : !isDefaultRecord(kind, name) ? 'new' : bucket[name] ? 'edited' : 'default';
    return { name, sub: sub || (rec ? '' : '로어 칸 없음'), state };
  });
}

export function recordList(ctx: ChatContext, kind: WorldKind, over: WorldOverrides, q: string): string {
  const rows = rowsOf(ctx, kind, over).filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase()) || r.sub.toLowerCase().includes(q.toLowerCase()));
  const sel = edUi.sel[kind] ?? '';
  const badge: Record<string, string> = { default: '', edited: '<i class="gw-badge">고침</i>', new: '<i class="gw-badge new">추가</i>', deleted: '<i class="gw-badge del">지움</i>' };
  return rows.length
    ? rows.map((r) => `<button class="gw-row${r.name === sel ? ' on' : ''}${r.state === 'deleted' ? ' deleted' : ''}" data-action="ed-sel" data-value="${esc(r.name)}"><b>${esc(r.name)}</b>${r.sub ? `<small>${esc(r.sub)}</small>` : ''}${badge[r.state]}</button>`).join('')
    : '<p class="gx-muted">맞는 기록이 없어요.</p>';
}

const basicPanel = (ctx: ChatContext, kind: WorldKind, name: string, d: Directory): string => {
  if (kind === 'agent') {
    const a = d.agents.find((x) => x.lore === name);
    return a ? agentPanel(a, ctx, d) : '';
  }
  if (kind === 'org') {
    const o = d.orgs.find((x) => x.name === name);
    return o ? orgPanel(o, ctx, d) : '';
  }
  if (kind === 'appendix') {
    const r = d.appendices.find((x) => x.lore === name);
    return r ? appendixPanel(r, ctx, d) : '';
  }
  const p = (kind === 'anomaly' ? d.anomalies : d.sites).find((x) => x.lore === name);
  return p ? placePanel(p, ctx) : '';
};

function fieldRow(kind: WorldKind, rec: WorldRecord, def: FieldDef, name: string, auto = ''): string {
  const v = recUi.variant ? rec.variants?.[recUi.variant]?.[def.id] ?? '' : rec.fields[def.id] ?? '';
  const key = `${kind}|${name}|${def.id}`;
  const tok = tokens(v);
  // 비어 있으면 자동으로 채워지는 칸(요원 소속 표기)은 그 값을 흐리게 보여 준다 (2026-10-27: 「소속이 텅 비어 있다」)
  const ph = recUi.variant ? '비우면 기본 글' : auto ? `자동: ${auto}` : '';
  const ctl = def.type === 'line'
    ? `<input data-input="ed-field" data-key="${esc(key)}" value="${esc(v)}" autocomplete="off" placeholder="${esc(ph)}">`
    : `<textarea data-input="ed-field" data-key="${esc(key)}" rows="${Math.min(14, Math.max(3, v.split('\n').length + 1))}" placeholder="${esc(ph)}">${esc(v)}</textarea>`;
  return `<div class="gw-field" data-field-row="${esc(def.id)}" draggable="true">
    <div class="gw-field-head"><span class="gw-grip" title="끌어서 순서 바꾸기">${ICONS.grip}</span><b>${esc(def.label)}</b><small class="gw-ftitle">${esc(def.title)}</small>${def.hint ? `<span class="gw-fhint" title="${esc(def.hint)}">?</span>` : ''}<span class="gw-ftok">${tok ? `${tok}토큰` : ''}</span>
      <span class="gw-fmove"><button class="gx-mini icon" data-action="ed-field-up" data-value="${esc(def.id)}" aria-label="위로">${ICONS.up}</button><button class="gx-mini icon" data-action="ed-field-down" data-value="${esc(def.id)}" aria-label="아래로">${ICONS.down}</button></span></div>
    ${ctl}</div>`;
}

function extraRow(kind: WorldKind, rec: WorldRecord, e: ExtraField, i: number, name: string): string {
  const key = `${kind}|${name}|${i}`;
  const id = e.kind === 'block' ? `x:${e.name}` : `xl:${i}`;
  const place = e.kind === 'line' ? `<small class="gw-ftitle">${e.sec === 'appearance' ? 'Appearance' : 'Identity'} 절 · 한 줄${e.at ? ` · ${esc(e.at)} 뒤` : ' · 맨 앞'}</small>` : '<small class="gw-ftitle">절</small>';
  const ctl = e.kind === 'line'
    ? `<input data-input="ed-extra" data-key="${esc(key)}" value="${esc(e.value)}" autocomplete="off">`
    : `<textarea data-input="ed-extra" data-key="${esc(key)}" rows="${Math.min(14, Math.max(3, e.value.split('\n').length + 1))}">${esc(e.value)}</textarea>`;
  return `<div class="gw-field extra" data-field-row="${esc(id)}" draggable="${e.kind === 'block'}">
    <div class="gw-field-head"><span class="gw-grip">${e.kind === 'block' ? ICONS.grip : ''}</span><input class="gw-xname" data-input="ed-extra-name" data-key="${esc(key)}" value="${esc(e.name)}" aria-label="칸 이름">${place}<span class="gw-ftok">${tokens(e.value) ? `${tokens(e.value)}토큰` : ''}</span>
      <span class="gw-fmove">${e.kind === 'block' ? `<button class="gx-mini icon" data-action="ed-field-up" data-value="${esc(id)}" aria-label="위로">${ICONS.up}</button><button class="gx-mini icon" data-action="ed-field-down" data-value="${esc(id)}" aria-label="아래로">${ICONS.down}</button>` : ''}<button class="gx-mini icon danger" data-action="ed-extra-del" data-value="${i}" aria-label="칸 지우기">${ICONS.trash}</button></span></div>
    ${ctl}</div>`;
}

export function recordPage(ctx: ChatContext, kind: WorldKind, over: WorldOverrides, q: string, sel: string): string {
  const d = directoryDraft(ctx);
  const list = `<aside class="gw-list-pane">
    <div class="gw-list-tools"><input class="dir-search" type="search" data-input="ed-q" value="${esc(q)}" placeholder="${WORLD_KIND_LABEL[kind]} 검색" aria-label="검색">
      <button class="gx-mini" data-action="ed-add-toggle" aria-expanded="${recUi.adding}">${ICONS.plus}추가</button></div>
    ${recUi.adding ? `<div class="gw-add"><input name="ed-new-name" placeholder="새 ${WORLD_KIND_LABEL[kind]} 이름 (한글)" data-enter="ed-add" autocomplete="off"><button class="gx-mini" data-action="ed-add" data-take="ed-new-name">만들기</button>
      <p class="gx-muted">${kind === 'agent' ? '요원은 만든 뒤 「기본 정보」에서 영문명·소속·부서를 채워요. 영문명은 그림 에셋 이름과 같아야 해요.' : kind === 'org' ? '조직은 만든 뒤 「기본 정보」에서 영문명·코드를 정해요.' : '만든 뒤 기본 정보에서 영문명·별칭을 채워요.'}</p></div>` : ''}
    ${kind === 'anomaly' ? anomalyNoteBox(over) : ''}
    <div class="gw-list">${recordList(ctx, kind, over, q)}</div></aside>`;
  const rec = sel ? worldRecord(kind, sel, over) : null;
  const bucket = (over[kind] ?? {}) as Record<string, Partial<WorldRecord> & { deleted?: boolean }>;
  let detail: string;
  if (!sel) detail = `<div class="gw-detail empty"><p class="gx-muted">왼쪽에서 ${WORLD_KIND_LABEL[kind]}을(를) 고르세요.</p></div>`;
  else if (bucket[sel]?.deleted) detail = `<div class="gw-detail"><header class="gw-head"><h2>${esc(sel)}</h2><p class="gx-muted">기본 세계의 이 기록을 지웠어요. 모델에게 가지 않아요.</p></header><button class="gx-mini" data-action="ed-restore">되살리기</button></div>`;
  else if (!rec) detail = `<div class="gw-detail"><header class="gw-head"><h2>${esc(sel)}</h2><p class="gx-muted">이 기록에는 로어 칸이 없어요 (명부 줄만 있음).</p></header><button class="gx-mini" data-action="ed-make-rec">로어 칸 만들기</button>${basicPanel(ctx, kind, sel, d)}</div>`;
  else {
    const order = fieldOrder(kind, rec);
    const defs = FIELDS[kind];
    const rows = order.map((id) => {
      if (id.startsWith('x:')) {
        const i = rec.extra.findIndex((e) => e.kind === 'block' && `x:${e.name}` === id);
        return i >= 0 ? extraRow(kind, rec, rec.extra[i], i, sel) : '';
      }
      const def = defs.find((f) => f.id === id);
      if (!def) return '';
      let auto = '';
      if (kind === 'agent' && def.id === 'organization') {
        const a = d.agents.find((x) => x.lore === sel);
        const o = a ? orgOf(d.orgs, a.affiliation) : undefined;
        auto = o ? `${o.spec.english || o.name} (명부 소속 「${o.name}」 · 시점별 호칭 표)` : a?.affiliation ? `${a.affiliation} (명부 소속)` : '명부에 소속이 없어요';
      }
      return fieldRow(kind, rec, def, sel, auto);
    });
    const lines = rec.extra.map((e, i) => (e.kind === 'line' ? extraRow(kind, rec, e, i, sel) : '')).join('');
    const text = recordText(kind, sel, rec, d);
    const isDefault = isDefaultRecord(kind, sel);
    const edited = !!bucket[sel];
    const variants = Object.keys(rec.variants ?? {});
    const variantBar = kind === 'org' || variants.length
      ? `<div class="gw-variants"><span>세력별 다른 글</span><button class="gx-chip${recUi.variant ? '' : ' on'}" data-action="ed-variant" data-value="">기본</button>${variants.map((c) => `<button class="gx-chip${recUi.variant === c ? ' on' : ''}" data-action="ed-variant" data-value="${esc(c)}">${esc(c)} 시점</button>`).join('')}${kind === 'org' ? `<input name="ed-variant-new" placeholder="코드 (B00)" size="6" data-enter="ed-variant-add"><button class="gx-mini" data-action="ed-variant-add" data-take="ed-variant-new">추가</button>` : ''}</div>`
      : '';
    const readonly = kind === 'agent' ? (() => {
      const a = d.agents.find((x) => x.lore === sel);
      return a ? `<p class="gw-ro">id ${esc(a.id)}${a.legacyEnglish.length ? ` · 옛 영문명 ${esc(a.legacyEnglish.join(', '))}` : ''} · 검색 키 ${esc(rec.keys || '(이름·영문명·별칭)')}</p>` : '';
    })() : `<p class="gw-ro">검색 키 ${esc(rec.keys || '(이름·영문명·별칭)')}${rec.title ? ` · 제목 ${esc(rec.title)}` : ''}</p>`;
    detail = `<div class="gw-detail">
      <header class="gw-head"><h2>${esc(sel)}<small>${isDefault ? (edited ? '기본 세계 · 고침' : '기본 세계') : '카드에만 있음'}</small></h2>
        <div class="gw-head-act">${recUi.tokensHtml(ctx, kind, over)}
          <button class="gx-mini${recUi.preview ? ' on' : ''}" data-action="ed-preview">${ICONS.book}조립 글 보기</button>
          <button class="gx-mini${recUi.importOpen ? ' on' : ''}" data-action="ed-import-toggle">${ICONS.plus}글로 가져오기</button>
          ${isDefault && edited ? '<button class="gx-mini" data-action="ed-restore">기본으로</button>' : ''}
          <button class="gx-mini danger" data-action="ed-delete">${ICONS.trash}${isDefault ? '지우기' : '삭제'}</button></div></header>
      ${kind === 'agent' ? `<p class="gw-roster"><button class="gx-chip${rec.rosterOff ? '' : ' on'}" data-action="ed-roster-toggle" aria-pressed="${!rec.rosterOff}">🙂Roster 지침에 포함</button><small>${rec.rosterOff ? '이 요원은 명부 지침(🙂Roster)에 들어가지 않아요. 로어 칸은 그대로 모델에게 가요.' : '명부 지침에 소개 한 줄로 들어가요. 기본은 전원 포함.'}</small></p>` : ''}
      ${recUi.preview ? `<pre class="gw-preview">${esc(text)}</pre>` : ''}
      ${recUi.importOpen ? importPane(kind) : ''}
      <details class="gw-sec" open><summary>기본 정보 <small>명부</small></summary>${basicPanel(ctx, kind, sel, d) || '<p class="gx-muted">명부 줄이 없어요. 저장하면 생겨요.</p>'}</details>
      <section class="gw-sec"><h3>로어 칸 ${variantBar}</h3>
        <div class="gw-fields">${rows.join('')}</div>
        ${lines ? `<h4 class="gw-sub">한 줄 추가 항목</h4><div class="gw-fields">${lines}</div>` : ''}
        <div class="gw-add-field"><input name="ed-extra-name" placeholder="새 칸 이름" data-enter="ed-extra-add" autocomplete="off">
          ${kind === 'agent' ? `<select name="ed-extra-kind"><option value="block">절 (글)</option><option value="identity">Identity 한 줄</option><option value="appearance">Appearance 한 줄</option></select>` : '<input type="hidden" name="ed-extra-kind" value="block">'}
          <button class="gx-mini" data-action="ed-extra-add" data-take="ed-extra-name">${ICONS.plus}칸 추가</button><button class="gx-mini" data-action="ed-order-reset">기본 순서로</button></div>
      </section>
      ${readonly}
    </div>`;
  }
  return `<div class="gw-page split">${list}${detail}</div>`;
}

function importPane(kind: WorldKind): string {
  const r = recUi.importResult;
  return `<div class="gw-import"><p class="gx-muted">다른 봇의 캐릭터 로어북 글을 붙여 넣으면 제목(#·**굵게**)으로 절을 나눠 칸에 배정해요. 안 맞는 절은 그 제목 그대로 추가 칸이 돼요. 기존 칸 글은 뒤에 이어 붙여요.</p>
    <textarea data-input="ed-import" rows="8" placeholder="여기에 붙여 넣기">${esc(recUi.importText)}</textarea>
    <div class="gx-row-btns"><button class="gx-mini" data-action="ed-import-parse">배정 보기</button>${r ? '<button class="gx-mini" data-action="ed-import-apply">이대로 넣기</button>' : ''}</div>
    ${r ? `<table class="gw-map"><thead><tr><th>절</th><th>→ 칸</th></tr></thead><tbody>${r.map.map(([t, id]) => `<tr><td>${esc(t)}</td><td>${esc(id.startsWith('x:') ? `추가 칸 「${id.slice(2)}」` : FIELDS[kind].find((f) => f.id === id)?.label ?? id)}</td></tr>`).join('')}</tbody></table>` : ''}
  </div>`;
}

function current(ctx: ChatContext, kind: WorldKind): { name: string; rec: WorldRecord; over: WorldOverrides } | null {
  const name = edUi.sel[kind] ?? '';
  const over = overridesOf(ctx);
  const rec = name ? worldRecord(kind, name, over) : null;
  return rec ? { name, rec: structuredClone(rec), over } : null;
}

/** 입력칸: 칸 글·추가 칸 글·이름·가져오기 글 */
/** 괴이 공통 머리말 (목록 위): 모든 괴이 앞에 한 번 들어가는 글. 카드에 저장, 기본으로 되돌리기 */
function anomalyNoteBox(over: WorldOverrides): string {
  const note = worldAnomalyNote(over);
  const edited = over.anomalyNote !== undefined;
  return `<details class="gw-anote"${recUi.noteOpen ? ' open' : ''}><summary data-action="ed-anote-toggle"><b>괴이 공통 머리말</b><small>${edited ? '고침 · ' : ''}약 ${tokens(note).toLocaleString()}토큰</small></summary>
    <p class="gx-muted">모든 괴이 로어 앞에 한 번만 들어가는 공통 지침이에요 (괴이마다 붙지 않아요).</p>
    <textarea data-input="ed-anote" rows="5">${esc(note)}</textarea>
    <div class="gx-row-btns"><button class="gx-mini" data-action="ed-anote-reset" ${edited ? '' : 'disabled'}>기본으로</button></div></details>`;
}

export function recordInput(name: string, key: string, value: string, ctx: ChatContext): boolean {
  if (name === 'ed-import') {
    recUi.importText = value;
    return true;
  }
  if (name === 'ed-anote') {
    const over = overridesOf(ctx);
    const next: WorldOverrides = { ...over };
    if (value === ANOMALY_NOTE) delete next.anomalyNote;
    else next.anomalyNote = value;
    setOverrides(next);
    return true;
  }
  const [kind, recName, id] = key.split('|') as [WorldKind, string, string];
  if (!kind || !recName) return false;
  const over = overridesOf(ctx);
  const rec = structuredClone(worldRecord(kind, recName, over) ?? emptyRecord());
  if (name === 'ed-field') {
    if (recUi.variant) {
      rec.variants = { ...(rec.variants ?? {}) };
      const v = { ...(rec.variants[recUi.variant] ?? {}) };
      if (value.trim()) v[id] = value;
      else delete v[id];
      if (Object.keys(v).length) rec.variants[recUi.variant] = v;
      else delete rec.variants[recUi.variant];
    } else rec.fields[id] = value;
  } else if (name === 'ed-extra') {
    const i = Number(id);
    if (!rec.extra[i]) return false;
    rec.extra[i] = { ...rec.extra[i], value };
  } else if (name === 'ed-extra-name') {
    const i = Number(id);
    if (!rec.extra[i]) return false;
    const old = rec.extra[i].name;
    rec.extra[i] = { ...rec.extra[i], name: value };
    if (rec.order) rec.order = rec.order.map((o) => (o === `x:${old}` ? `x:${value}` : o));
  } else return false;
  setOverrides(putRecord(over, kind, recName, rec));
  return true;
}

export async function recordAction(action: string, value: string | undefined, ctx: ChatContext, kind: WorldKind): Promise<boolean> {
  const over = overridesOf(ctx);
  switch (action) {
    case 'ed-sel':
      edUi.sel[kind] = value ?? '';
      recUi.preview = false;
      recUi.importOpen = false;
      recUi.importResult = null;
      recUi.variant = '';
      return true;
    case 'ed-roster-toggle': {
      const cur = current(ctx, kind);
      if (!cur || kind !== 'agent') return false;
      setOverrides(putRecord(cur.over, kind, cur.name, { ...cur.rec, rosterOff: !cur.rec.rosterOff }));
      return true;
    }
    case 'ed-anote-toggle':
      recUi.noteOpen = !recUi.noteOpen;
      return false;
    case 'ed-anote-reset': {
      const next: WorldOverrides = { ...overridesOf(ctx) };
      delete next.anomalyNote;
      setOverrides(next);
      return true;
    }
    case 'ed-preview':
      recUi.preview = !recUi.preview;
      return true;
    case 'ed-import-toggle':
      recUi.importOpen = !recUi.importOpen;
      return true;
    case 'ed-import-parse':
      recUi.importResult = parseImport(kind, recUi.importText);
      return true;
    case 'ed-import-apply': {
      const cur = current(ctx, kind);
      const r = recUi.importResult;
      if (!cur || !r) return true;
      for (const [id, v] of Object.entries(r.fields)) cur.rec.fields[id] = cur.rec.fields[id] ? `${cur.rec.fields[id]}\n\n${v}` : v;
      cur.rec.extra = [...cur.rec.extra, ...r.extra];
      setOverrides(putRecord(over, kind, cur.name, cur.rec));
      recUi.importOpen = false;
      recUi.importResult = null;
      recUi.importText = '';
      edUi.info = '가져온 글을 칸에 넣었어요. 저장을 눌러야 카드에 남아요.';
      return true;
    }
    case 'ed-add-toggle':
      recUi.adding = !recUi.adding;
      return true;
    case 'ed-add': {
      const name = (value ?? '').trim();
      if (!name) return true;
      if (worldRecord(kind, name, over) || (over[kind] as Record<string, unknown> | undefined)?.[name]) {
        edUi.notice = '같은 이름의 기록이 있어요.';
        return true;
      }
      setOverrides(putRecord(over, kind, name, emptyRecord()));
      edUi.sel[kind] = name;
      recUi.adding = false;
      edUi.info = `「${name}」 기록을 만들었어요. 기본 정보는 저장 뒤 명부 줄이 생기면 채울 수 있어요.`;
      return true;
    }
    case 'ed-make-rec': {
      const name = edUi.sel[kind] ?? '';
      if (name) setOverrides(putRecord(over, kind, name, emptyRecord()));
      return true;
    }
    case 'ed-delete': {
      const name = edUi.sel[kind] ?? '';
      if (!name) return true;
      setOverrides(removeRecord(over, kind, name));
      if (!isDefaultRecord(kind, name)) edUi.sel[kind] = '';
      return true;
    }
    case 'ed-restore': {
      const name = edUi.sel[kind] ?? '';
      if (name) setOverrides(resetRecord(over, kind, name));
      recUi.variant = '';
      return true;
    }
    case 'ed-variant':
      recUi.variant = value ?? '';
      return true;
    case 'ed-variant-add': {
      const code = (value ?? '').trim().toUpperCase();
      const cur = current(ctx, kind);
      if (!cur || !/^[A-Z]\d\d$/.test(code)) {
        edUi.notice = '세력 코드는 A00 꼴이에요.';
        return true;
      }
      cur.rec.variants = { ...(cur.rec.variants ?? {}), [code]: cur.rec.variants?.[code] ?? { intro: cur.rec.fields.intro ?? '' } };
      setOverrides(putRecord(over, kind, cur.name, cur.rec));
      recUi.variant = code;
      return true;
    }
    case 'ed-extra-add': {
      const cur = current(ctx, kind);
      const name = (value ?? '').trim();
      if (!cur || !name) return true;
      const kindSel = (document.querySelector<HTMLSelectElement | HTMLInputElement>('.gw [name="ed-extra-kind"]')?.value ?? 'block') as 'block' | 'identity' | 'appearance';
      if (cur.rec.extra.some((e) => e.name === name)) {
        edUi.notice = '같은 이름의 칸이 있어요.';
        return true;
      }
      cur.rec.extra.push(kindSel === 'block' ? { name, value: '', kind: 'block' } : { name, value: '', kind: 'line', sec: kindSel, at: kindSel === 'identity' ? 'role' : 'outfit' });
      setOverrides(putRecord(over, kind, cur.name, cur.rec));
      return true;
    }
    case 'ed-extra-del': {
      const cur = current(ctx, kind);
      const i = Number(value);
      if (!cur || !cur.rec.extra[i]) return true;
      const removed = cur.rec.extra.splice(i, 1)[0];
      if (cur.rec.order) cur.rec.order = cur.rec.order.filter((o) => o !== `x:${removed.name}`);
      setOverrides(putRecord(over, kind, cur.name, cur.rec));
      return true;
    }
    case 'ed-field-up':
    case 'ed-field-down': {
      const cur = current(ctx, kind);
      if (!cur || !value) return true;
      cur.rec.order = moveField(kind, cur.rec, value, action === 'ed-field-up' ? -1 : 1);
      setOverrides(putRecord(over, kind, cur.name, cur.rec));
      return true;
    }
    case 'ed-field-drop': {
      const cur = current(ctx, kind);
      const [from, to] = (value ?? '').split('|');
      if (!cur || !from || !to) return true;
      cur.rec.order = moveFieldTo(kind, cur.rec, from, to);
      setOverrides(putRecord(over, kind, cur.name, cur.rec));
      return true;
    }
    case 'ed-order-reset': {
      const cur = current(ctx, kind);
      if (!cur) return true;
      delete cur.rec.order;
      const base = defaultRecord(kind, cur.name);
      if (base?.order) cur.rec.order = [...base.order];
      setOverrides(putRecord(over, kind, cur.name, cur.rec));
      return true;
    }
  }
  return false;
}

export { fieldValue };
