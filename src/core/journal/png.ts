// 보고서 → 공유용 이미지 카드 한 장 (docs/설계안_기록_보고서.md 5-9절, 시안 Card.dc.html). 세로 900×1200.
// 여기는 순수 그리기: 캔버스 2D 의 아주 작은 부분집합(PaintCtx)만 쓰므로 node 시험에서 가짜 ctx 로 호출 순서·배치를 검사할 수 있다.
// DOM(캔버스 만들기·글꼴 기다리기·그림 읽기·내려받기)은 ui/reportpng.ts.
// 세로 예산 (전체 보고서, 요원 2명·경과 6줄·결과 3줄·소감 2줄): 머리 52 · 그림 188 · 제목 90 · 타일 84 · 경과 ≤192 · 요원 ≤84 · 결과 ≤106 · 소감 ≤84 · 인물|가계부 두 열 ≤140 → 1068 ≤ 1088 (바닥글 자리 전)
import { locName } from '../world/geo';
import { journalClock } from './ctx';
import { JOURNAL_KIND_LABEL, type Report } from './types';

export const PNG_W = 900;
export const PNG_H = 1200;

/** CanvasRenderingContext2D 의 부분집합 (시험에서 가짜로 만든다) */
export interface PaintCtx {
  fillStyle: unknown;
  strokeStyle: unknown;
  lineWidth: number;
  font: string;
  textAlign: 'left' | 'right' | 'center' | 'start' | 'end';
  textBaseline: 'top' | 'middle' | 'alphabetic' | 'bottom' | 'hanging' | 'ideographic';
  globalAlpha: number;
  fillRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  measureText(text: string): { width: number };
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void;
  closePath(): void;
  fill(): void;
  stroke(): void;
  save(): void;
  restore(): void;
  clip(): void;
  drawImage(img: unknown, x: number, y: number, w: number, h: number): void;
}

export interface PaintColors {
  void: string;
  panel: string;
  line: string;
  text: string;
  sub: string;
  dim: string;
  signal: string;
  amber: string;
  danger: string;
  accentBg: string;
}

export interface PaintArt {
  img: unknown;
  w: number;
  h: number;
}

export interface PaintOpts {
  colors: PaintColors;
  /** 글꼴 패밀리 목록 (본문·고정폭). 플러그인 글꼴이 아직 없으면 시스템 글꼴 */
  sans: string;
  mono: string;
  /** 사건 그림 (blob:/data: 로 읽은 것만). 없으면 빈 틀 */
  art?: PaintArt | null;
  /** 머리 오른쪽 둘째 줄 (소속·팀) */
  org?: string;
  brand?: string;
  foot?: string;
}

/** 그린 구역 이름 (시험·진단용) */
export interface PaintResult { sections: string[]; bottom: number }

const PAD = 48;
const W = PNG_W - PAD * 2;
export const TRAIL_LINES = 6;
const two = (n: number) => String(n).padStart(2, '0');
const hhmm = (m: number | null) => (m === null ? '--:--' : journalClock(m).slice(6));
const ymd = (m: number | null) => (m === null ? '' : journalClock(m).slice(0, 5));
const WEEK = '일월화수목금토';
function dayText(m: number | null, savedAt: string): string {
  const d = m === null ? new Date(savedAt) : new Date(m * 60000);
  if (!Number.isFinite(d.getTime())) return '';
  return `${d.getUTCFullYear()}.${two(d.getUTCMonth() + 1)}.${two(d.getUTCDate())} (${WEEK[d.getUTCDay()]})`;
}
export function durShort(min: number | null): string {
  if (min === null || !Number.isFinite(min)) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h ${two(m)}m` : `${m}m`;
}
const won = (n: number) => `₩ ${Math.abs(n).toLocaleString('en-US')}`;
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('en-US')}`;

/** 글자 단위 줄바꿈 (한국어는 어절 경계가 없다). 최대 줄 수를 넘으면 마지막 줄 끝에 … */
export function wrapText(g: Pick<PaintCtx, 'measureText'>, text: string, maxWidth: number, maxLines: number): string[] {
  const src = text.replace(/\s+/g, ' ').trim();
  if (!src) return [];
  const lines: string[] = [];
  let cur = '';
  for (const ch of src) {
    const next = cur + ch;
    if (g.measureText(next).width <= maxWidth || !cur) cur = next;
    else {
      lines.push(cur);
      cur = ch;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines) {
    if (cur) lines.push(cur);
    return lines;
  }
  // 넘침: 마지막 줄을 … 로
  let last = lines[maxLines - 1];
  while (last.length && g.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
  lines[maxLines - 1] = `${last}…`;
  return lines.slice(0, maxLines);
}

function roundRect(g: PaintCtx, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.lineTo(x + w - rr, y);
  g.quadraticCurveTo(x + w, y, x + w, y + rr);
  g.lineTo(x + w, y + h - rr);
  g.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  g.lineTo(x + rr, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - rr);
  g.lineTo(x, y + rr);
  g.quadraticCurveTo(x, y, x + rr, y);
  g.closePath();
}

function box(g: PaintCtx, c: PaintColors, x: number, y: number, w: number, h: number, r = 14, fill = c.panel): void {
  roundRect(g, x, y, w, h, r);
  g.fillStyle = fill;
  g.fill();
  g.strokeStyle = c.line;
  g.lineWidth = 1;
  g.stroke();
}

function text(g: PaintCtx, s: string, x: number, y: number, o: { size: number; weight?: number; color: string; family: string; align?: PaintCtx['textAlign'] }): void {
  g.font = `${o.weight ?? 400} ${o.size}px ${o.family}`;
  g.fillStyle = o.color;
  g.textAlign = o.align ?? 'left';
  g.textBaseline = 'top';
  g.fillText(s, x, y);
}

/** 900×1200 보고서 카드를 그린다. 구역은 위에서부터 들어가는 만큼만 (바닥글 자리는 늘 남긴다) */
export function paintReport(g: PaintCtx, r: Report, o: PaintOpts): PaintResult {
  const c = o.colors;
  const sans = o.sans;
  const mono = o.mono;
  const sections: string[] = [];
  const h = r.head;
  const kindLabel = JOURNAL_KIND_LABEL[r.kind] ?? r.kind;
  const FOOT_H = 64;
  const limit = PNG_H - PAD - FOOT_H;
  const LH = 22;

  // 바탕
  g.globalAlpha = 1;
  g.fillStyle = c.void;
  g.fillRect(0, 0, PNG_W, PNG_H);
  sections.push('bg');

  // 머리: 왼쪽 브랜드, 오른쪽 보고서 번호·날짜·소속
  let y = PAD;
  text(g, o.brand ?? '괴이 ː ANOMALY', PAD, y, { size: 22, weight: 700, color: c.signal, family: sans });
  text(g, `INCIDENT REPORT · ${r.no}`, PNG_W - PAD, y + 2, { size: 14, weight: 500, color: c.dim, family: mono, align: 'right' });
  const day = dayText(h.at, r.savedAt);
  text(g, [day, o.org].filter(Boolean).join('   '), PNG_W - PAD, y + 24, { size: 13, weight: 400, color: c.sub, family: sans, align: 'right' });
  text(g, kindLabel === '필드 출동' ? 'FIELD OPERATION' : 'AFTER-ACTION', PAD, y + 28, { size: 12, weight: 500, color: c.dim, family: mono });
  y += 52;
  sections.push('head');

  // 사건 그림 (있으면 꽉 채워 자른다, 없으면 빈 틀)
  const ART_H = 170;
  roundRect(g, PAD, y, W, ART_H, 18);
  g.fillStyle = c.panel;
  g.fill();
  if (o.art?.img && o.art.w > 0 && o.art.h > 0) {
    g.save();
    roundRect(g, PAD, y, W, ART_H, 18);
    g.clip();
    const s = Math.max(W / o.art.w, ART_H / o.art.h);
    const dw = o.art.w * s;
    const dh = o.art.h * s;
    g.drawImage(o.art.img, PAD + (W - dw) / 2, y + (ART_H - dh) / 2, dw, dh);
    g.restore();
    sections.push('art');
  } else {
    text(g, kindLabel, PNG_W / 2, y + ART_H / 2 - 10, { size: 16, weight: 500, color: c.dim, family: sans, align: 'center' });
    sections.push('art-empty');
  }
  g.strokeStyle = c.line;
  g.lineWidth = 1;
  roundRect(g, PAD, y, W, ART_H, 18);
  g.stroke();
  y += ART_H + 18;

  // 등급 표식 + 종류·배지 + 이름 + 장소
  const gradeColor = r.kind === 'an' ? c.danger : r.kind === 'in' ? c.amber : c.signal;
  roundRect(g, PAD, y, 56, 56, 14);
  g.fillStyle = c.panel;
  g.fill();
  g.strokeStyle = gradeColor;
  g.lineWidth = 2;
  g.stroke();
  const mark = r.kind === 'an' && h.grade && /^[A-Za-z]+$/.test(h.grade) ? h.grade.toUpperCase() : r.kind === 'an' ? '?' : r.kind === 'in' ? '!' : r.kind === 'ms' ? '◇' : '▶';
  text(g, mark, PAD + 28, y + 14, { size: 26, weight: 700, color: gradeColor, family: mono, align: 'center' });
  const tx = PAD + 72;
  const status = `${kindLabel} · 종료${h.cleared ? ' · 클리어' : ''}`;
  text(g, status, tx, y, { size: 13, weight: 500, color: c.dim, family: mono });
  const badge = r.kind === 'fd' ? '필드 출동' : r.mine ? '내가 출동' : '요원 처리';
  g.font = `500 13px ${mono}`;
  const sw = g.measureText(status).width;
  const bw = g.measureText(badge).width + 20;
  roundRect(g, tx + sw + 12, y - 4, bw, 24, 12);
  g.fillStyle = r.mine ? c.accentBg : c.panel;
  g.fill();
  g.strokeStyle = r.mine ? c.signal : c.line;
  g.lineWidth = 1;
  g.stroke();
  text(g, badge, tx + sw + 12 + bw / 2, y, { size: 13, weight: 500, color: r.mine ? c.signal : c.sub, family: mono, align: 'center' });
  g.font = `700 32px ${sans}`;
  const nameLines = wrapText(g, h.name, W - 72, 1);
  text(g, nameLines[0] ?? '', tx, y + 22, { size: 32, weight: 700, color: c.text, family: sans });
  const place = [h.place, locName(h.loc) || h.loc].filter((x, i, a) => x && a.indexOf(x) === i).join(' · ');
  g.font = `400 15px ${sans}`;
  text(g, wrapText(g, place, W - 72, 1)[0] ?? '', tx, y + 64, { size: 15, weight: 400, color: c.sub, family: sans });
  y += 90;
  sections.push('title');

  // 시각 타일 넷
  const tiles: [string, string][] = [['발생', h.born !== null ? `${ymd(h.born)} ${hhmm(h.born)}` : '—'], ['투입', h.since !== null ? hhmm(h.since) : '—'], ['종료', h.at !== null ? hhmm(h.at) : '—'], ['소요', durShort(h.duration)]];
  const gap = 12;
  const tw = (W - gap * 3) / 4;
  tiles.forEach(([label, val], i) => {
    const x = PAD + i * (tw + gap);
    box(g, c, x, y, tw, 66, 14);
    text(g, label, x + 14, y + 12, { size: 12, weight: 500, color: c.dim, family: mono });
    g.font = `700 18px ${mono}`;
    text(g, wrapText(g, val, tw - 28, 1)[0] ?? val, x + 14, y + 32, { size: 18, weight: 700, color: i === 3 ? c.signal : c.text, family: mono });
  });
  y += 66 + 18;
  sections.push('tiles');

  const heading = (title: string, sub = '', x = PAD, w = W) => {
    text(g, title, x, y, { size: 15, weight: 700, color: c.text, family: sans });
    if (sub) text(g, sub, x + g.measureText(title).width + 10, y + 2, { size: 12, weight: 500, color: c.dim, family: mono });
    g.strokeStyle = c.line;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y + 24);
    g.lineTo(x + w, y + 24);
    g.stroke();
  };
  const HEAD_H = 32;
  const room = (need: number) => y + need <= limit;

  // 경과 (최대 6줄, 넘치면 「… 외 N건」)
  if (room(HEAD_H + LH)) {
    heading('경과', '상황판 기록');
    y += HEAD_H;
    const show = r.trail.slice(0, TRAIL_LINES);
    const rest = r.trail.length - show.length;
    if (!show.length) {
      text(g, '상황판 기록이 없어요.', PAD, y, { size: 14, color: c.dim, family: sans });
      y += LH;
    }
    for (const t of show) {
      if (!room(LH)) break;
      text(g, hhmm(t.m), PAD, y + 1, { size: 13, weight: 500, color: c.dim, family: mono });
      g.font = `400 14px ${sans}`;
      text(g, wrapText(g, t.text, W - 70, 1)[0] ?? '', PAD + 62, y, { size: 14, color: c.text, family: sans });
      y += LH;
    }
    if (rest > 0 && room(20)) {
      text(g, `… 외 ${rest}건`, PAD + 62, y, { size: 13, color: c.dim, family: sans });
      y += 20;
    }
    y += 8;
    sections.push('trail');
  }

  // 투입 요원 (칩, 두 열)
  if (room(HEAD_H + 36)) {
    heading('투입 요원');
    y += HEAD_H;
    if (!r.agents.length) {
      text(g, '투입 기록이 없어요.', PAD, y, { size: 14, color: c.dim, family: sans });
      y += LH;
    } else {
      const cols = 2;
      const cw = (W - gap) / cols;
      let rows = 0;
      r.agents.slice(0, 8).forEach((a, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const yy = y + row * 44;
        if (yy + 36 > limit) return;
        rows = row + 1;
        const x = PAD + col * (cw + gap);
        box(g, c, x, yy, cw, 36, 10);
        roundRect(g, x + 8, yy + 8, 20, 20, 10);
        g.fillStyle = c.accentBg;
        g.fill();
        text(g, Array.from(a.name)[0] ?? '?', x + 18, yy + 11, { size: 12, weight: 700, color: c.signal, family: sans, align: 'center' });
        text(g, a.name, x + 36, yy + 9, { size: 14, weight: 600, color: c.text, family: sans });
        const st = [a.st === '작전투입' ? '작전' : a.st, a.situation].filter(Boolean).join(' · ');
        g.font = `400 12px ${sans}`;
        const nw = g.measureText(a.name).width;
        text(g, wrapText(g, st, cw - 36 - nw - 24, 1)[0] ?? '', x + 36 + nw + 10, yy + 11, { size: 12, color: c.sub, family: sans });
      });
      y += rows * 44;
    }
    y += 8;
    sections.push('agents');
  }

  // 결과 (3줄)
  if (room(HEAD_H + LH)) {
    heading('결과');
    y += HEAD_H;
    g.font = `400 14px ${sans}`;
    for (const line of wrapText(g, r.result || '처리 완료', W, 3)) {
      if (!room(LH)) break;
      text(g, line, PAD, y, { size: 14, color: c.text, family: sans });
      y += LH;
    }
    y += 8;
    sections.push('result');
  }

  // 소감 (있을 때만, 2줄)
  if (r.debrief && room(HEAD_H + LH)) {
    heading(`${r.debrief.who} 소감`);
    y += HEAD_H;
    g.font = `400 14px ${sans}`;
    for (const line of wrapText(g, r.debrief.text, W, 2)) {
      if (!room(LH)) break;
      text(g, line, PAD, y, { size: 14, color: c.sub, family: sans });
      y += LH;
    }
    y += 8;
    sections.push('debrief');
  }

  // 인물 기록 변화 | 가계부 (전체 보고서만, 두 열)
  if (r.full && room(HEAD_H + LH)) {
    const cw = (W - 24) / 2;
    const rx = PAD + cw + 24;
    const top = y;
    heading('인물 기록 변화', '종료 시점', PAD, cw);
    heading('가계부', '이 사건 동안', rx, cw);
    y += HEAD_H;
    const people = r.people ?? [];
    let ly = y;
    if (!people.length) {
      text(g, '호감이 움직인 인물이 없어요.', PAD, ly, { size: 13, color: c.dim, family: sans });
      ly += LH;
    }
    for (const p of people.slice(0, 4)) {
      if (ly + LH > limit) break;
      text(g, p.who, PAD, ly, { size: 14, weight: 600, color: c.text, family: sans });
      const d = `${signed(p.delta)}${p.stage ? ` → ${p.stage}` : ''}`;
      text(g, d, PAD + cw, ly + 1, { size: 13, weight: 700, color: p.delta < 0 ? c.danger : c.signal, family: mono, align: 'right' });
      if (p.quote) {
        g.font = `400 12px ${sans}`;
        const nw = g.measureText(p.who).width;
        g.font = `700 13px ${mono}`;
        const dw = g.measureText(d).width;
        g.font = `400 12px ${sans}`;
        const q = wrapText(g, p.quote, cw - nw - dw - 30, 1)[0];
        if (q) text(g, `“${q}”`, PAD + nw + 10, ly + 2, { size: 12, color: c.sub, family: sans });
      }
      ly += LH;
    }
    const trades = (r.wallet ?? []).slice(-4);
    let ry = y;
    if (!trades.length) {
      text(g, '이 사건 동안 거래가 없어요.', rx, ry, { size: 13, color: c.dim, family: sans });
      ry += LH;
    }
    for (const t of trades) {
      if (ry + LH > limit) break;
      g.font = `400 14px ${sans}`;
      text(g, wrapText(g, t.memo || '(메모 없음)', cw - 110, 1)[0] ?? '', rx, ry, { size: 14, color: c.text, family: sans });
      text(g, signed(t.amount), rx + cw, ry + 1, { size: 13, weight: 700, color: t.amount < 0 ? c.danger : c.signal, family: mono, align: 'right' });
      ry += LH;
    }
    if (r.balance !== undefined && ry + LH <= limit) {
      text(g, '종료 시점 잔고', rx, ry, { size: 13, weight: 500, color: c.dim, family: sans });
      text(g, won(r.balance), rx + cw, ry + 1, { size: 13, weight: 700, color: c.text, family: mono, align: 'right' });
      ry += LH;
    }
    y = Math.max(ly, ry, top + HEAD_H) + 8;
    sections.push('people', 'wallet');
  }

  // 바닥글 (늘 같은 자리)
  const fy = PNG_H - PAD - 28;
  g.strokeStyle = c.line;
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(PAD, fy - 14);
  g.lineTo(PNG_W - PAD, fy - 14);
  g.stroke();
  text(g, 'ANOMALY SIMULATION 2.4', PAD, fy, { size: 12, weight: 500, color: c.dim, family: mono });
  text(g, o.foot ?? '이 보고서는 상황판·인물 기록·가계부에서 자동으로 만들어졌어요', PNG_W - PAD, fy, { size: 12, color: c.dim, family: sans, align: 'right' });
  sections.push('foot');
  return { sections, bottom: y };
}
