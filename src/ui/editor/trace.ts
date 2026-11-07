// 점검 탭 「호출 흐름」 (11-07 사용자: 가장 최근 요청과 응답을 프로세스 형태로 — 어떤 모델을 불렀고, 요청은 뭐고, 받은 값은 뭐고, 다음 순서는 뭔지).
// 자료는 host/trace.ts (턴마다 본편 요청 조립 → 본편 전 보조 호출 → 본편 응답 → 본편 뒤 보조 호출). 모양은 다른 점검 페이지(ps-group·ps-row)와 같고, 흐름만 세로 줄로 잇는다.
import { ICONS } from '../icons';
import type { TraceCall, TraceTurn } from '../../host/trace';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const traceUi = {
  turns: null as TraceTurn[] | null,
  /** 펼친 칸 (`턴id:칸번호`) */
  open: new Set<string>(),
  confirm: false,
};

const p = (x: number) => String(x).padStart(2, '0');
/** 기기(한국) 시간 HH:mm:ss */
const hms = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};
const ymd = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${hms(iso)}`;
};
const sec = (ms: number) => `${Math.round(ms / 100) / 10}초`;
const chars = (n: number) => `${n.toLocaleString('ko-KR')}자`;
const modelName = (m: string) => (m === 'main' ? '메인' : m === 'aux' ? '보조' : m);

type Node = { key: string; kind: 'main' | 'call' | 'reply'; title: string; meta: string; ok: boolean | null; error?: string; body: string };

function nodes(t: TraceTurn): Node[] {
  const out: Node[] = [];
  const call = (c: TraceCall, i: number): Node => ({
    key: `${t.id}:c${i}`,
    kind: 'call',
    title: c.label,
    meta: `${modelName(c.model)} · ${sec(c.ms)} · ${hms(c.at)} · 요청 ${chars(c.requestChars)} → 응답 ${chars(c.responseChars)}`,
    ok: c.ok,
    ...(c.error ? { error: c.error } : {}),
    body: `<div class="gw-flow-io"><b>요청</b><textarea readonly rows="8">${esc(c.request)}</textarea></div><div class="gw-flow-io"><b>받은 값</b><textarea readonly rows="8">${esc(c.response || (c.ok ? '' : '(없음)'))}</textarea></div>`,
  });
  const before = t.calls.map((c, i) => [c, i] as const).filter(([c]) => c.phase === 'before');
  const after = t.calls.map((c, i) => [c, i] as const).filter(([c]) => c.phase === 'after');
  const manual = t.calls.map((c, i) => [c, i] as const).filter(([c]) => c.phase === 'manual');
  if (t.main) {
    const m = t.main;
    const roles = m.shape.reduce<Record<string, number>>((a, r) => ((a[r.role] = (a[r.role] ?? 0) + 1), a), {});
    out.push({
      key: `${t.id}:main`,
      kind: 'main',
      title: '본편 요청 조립',
      meta: `Risu 본편 모델 · ${hms(m.at)} · 메시지 ${m.shape.length}개(${Object.entries(roles).map(([r, n]) => `${r} ${n}`).join(', ')}) · 총 ${chars(m.totalChars)}${m.failed.length ? ` · 건너뛴 단계 ${m.failed.join(', ')}` : ''}`,
      ok: m.failed.length ? false : true,
      body: `<div class="gw-flow-io"><b>마지막 메시지 셋 (플러그인이 끼운 블록은 보통 여기)</b>${m.tail.map((r) => `<small>[${esc(r.role)}]</small><textarea readonly rows="8">${esc(r.content)}</textarea>`).join('')}</div>`,
    });
  }
  for (const [c, i] of before) out.push(call(c, i));
  if (t.reply) out.push({ key: `${t.id}:reply`, kind: 'reply', title: '본편 응답', meta: `${hms(t.reply.at)} · ${chars(t.reply.chars)}`, ok: true, body: `<div class="gw-flow-io"><b>받은 글</b><textarea readonly rows="10">${esc(t.reply.text)}</textarea></div>` });
  else if (t.main) out.push({ key: `${t.id}:reply`, kind: 'reply', title: '본편 응답', meta: '아직 없음 (응답 전이거나 Risu 가 응답을 붙이지 않음)', ok: null, body: '' });
  for (const [c, i] of after) out.push(call(c, i));
  for (const [c, i] of manual) out.push({ ...call(c, i), title: `${c.label} (수동)` });
  return out;
}

function nodeHtml(n: Node): string {
  const open = traceUi.open.has(n.key);
  const state = n.ok === null ? 'off' : n.ok ? '' : 'bad';
  return `<li class="gw-flow-node k-${n.kind}${open ? ' open' : ''}">
    <span class="gw-flow-dot ${state}"></span>
    <div class="gw-flow-card">
      <div class="gw-flow-top"><b>${esc(n.title)}</b><span class="gw-state ${state}">${n.ok === null ? '대기' : n.ok ? '성공' : '실패'}</span>${n.body ? `<button class="gx-mini" data-action="man-trace-toggle" data-value="${esc(n.key)}" aria-expanded="${open}">${open ? ICONS.up : ICONS.down}${open ? '접기' : '펼치기'}</button>` : ''}</div>
      <small class="gw-flow-meta">${esc(n.meta)}</small>
      ${n.error ? `<small class="gw-flow-err">${esc(n.error)}</small>` : ''}
      ${open ? `<div class="gw-flow-body">${n.body}</div>` : ''}
    </div></li>`;
}

function turnHtml(t: TraceTurn, idx: number, total: number): string {
  const ns = nodes(t);
  const fails = t.calls.filter((c) => !c.ok).length;
  const title = t.main ? `턴 ${total - idx}` : '턴 밖 호출';
  return `<section class="ps-group gw-flow-turn"><h3>${title} <small>${esc(ymd(t.at))} · 보조 호출 ${t.calls.length}회${fails ? ` · 실패 ${fails}` : ''}</small></h3>
    <ol class="gw-flow">${ns.map(nodeHtml).join('')}</ol></section>`;
}

export function tracePage(head: (crumb: string, title: string, desc: string) => string, confirmRow: string): string {
  const list = traceUi.turns;
  const body = list
    ? list.length
      ? [...list].reverse().map((t, i) => turnHtml(t, i, list.length)).join('')
      : '<section class="ps-group"><div class="ps-rows"><p class="ps-note">아직 기록이 없어요. 본편을 한 번 보내면 그 턴의 흐름이 여기 쌓여요.</p></div></section>'
    : '<section class="ps-group"><div class="ps-rows"><p class="ps-note">읽는 중…</p></div></section>';
  return `<div class="gw-page gw-set">${head('', '호출 흐름', '최근 턴마다 플러그인이 모델을 어떤 순서로 불렀는지. 본편 요청 조립 → 본편 전 보조 호출(라우터·디렉터) → 본편 응답 → 본편 뒤 보조 호출(갱신기·괴담넷·괴담톡·위키…). 칸을 펼치면 요청과 받은 값 원문이에요(긴 글은 가운데를 줄여요). 시각은 이 기기 시간.')}
    <div class="gx-settings gw-setbody">
    <div class="ps-row gw-rel-foot gw-flow-tools"><button class="gx-mini" data-action="man-trace-refresh">${ICONS.refresh}다시 읽기</button>${list?.length ? confirmRow : ''}</div>
    ${body}
    </div></div>`;
}
