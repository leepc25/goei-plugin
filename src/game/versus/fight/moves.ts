// 캐릭터 동작표: 인물 팩 그림·설정에서 대전 동작(평타·원거리·고유기·충전·필살기)의 장 순서를 만든다.
// 피해 값은 설정에서 읽지 않는다 (rules.ts DMG). 설정에서 쓰는 것은 동작 줄 번호·장 번호·이펙트 부품 목록뿐이다
import type { CharArt } from './art';
import { ATK } from './rules';
import { has, nOf, loopOf, range, type Step } from './anim';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

/** 때리는 장: 설정 hit(1부터) 있으면 그 장, 없으면 손발이 가장 앞으로 뻗은 장 */
export function impactOf(art: CharArt, id: string): number {
  const m = art.A[id];
  const set = (art.cfg.hit as Record<string, number> | undefined)?.[id];
  if (set) return Math.max(0, Math.min(m.n - 1, set - 1));
  let imp = 1;
  for (let f = 1; f < m.n; f++) if (m.reach[f] > m.reach[imp]) imp = f;
  return Math.min(imp, m.n - 1);
}

/** 평타 장 순서: 준비 → 때리는 장(공격 칸) → 마무리(맞혔으면 캔슬 가능) */
export function normalSeq(art: CharArt, id: string, heavy: boolean): Step[] {
  const m = art.A[id], imp = impactOf(art, id), T = heavy ? ATK.heavy : ATK.light;
  const s: Step[] = [];
  for (let f = 0; f < m.n; f++) {
    if (f < imp) s.push({ f, d: f === 0 ? T.first : T.pre });
    else if (f === imp) s.push({ f, d: T.hit, act: true });
    else s.push({ f, d: T.post, cancel: true, act: f === imp + 1 && m.reach[f] >= m.reach[imp] - 6 });
  }
  return s;
}

/** 원거리 장 순서: 그림에 총구 불꽃이 있는 장마다 한 발 (되풀이 구간이 있으면 그 안에서), 없으면 때리는 장에 한 발 */
export function rangedSeq(art: CharArt): Step[] {
  const id = '15', m = art.A[id], lp = loopOf(art, id), s: Step[] = [];
  const flashes = m.flash.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
  if (lp) {
    const a0 = lp[0], a1 = lp[lp.length - 1];
    const fl = range(a0, a1).filter((f) => m.flash[f]);
    const fire = fl.length ? fl : [a0];
    for (let f = 0; f < a0; f++) s.push({ f, d: 0.04 });
    for (let f = a0; f <= a1; f++) s.push({ f, d: 0.065, shot: fire.includes(f) });
    for (let f = a1 + 1; f < m.n; f++) s.push({ f, d: 0.06 });
  } else {
    const fire = flashes.length ? flashes : [impactOf(art, id)];
    for (let f = 0; f < m.n; f++) s.push({ f, d: fire.includes(f) ? 0.08 : 0.05, shot: fire.includes(f) });
  }
  return s;
}

/** 기술 한 단계 = { anim, fps, events:[{f, to, rep, d, alt, loop, hold, fx}] } (장 번호는 1부터) → 장 순서 */
export function skillSteps(art: CharArt, sp: Json, fallback: string): { id: string; s: Step[] } {
  const id = has(art, sp.anim) ? String(sp.anim) : fallback, n = nOf(art, id), d0 = 1 / (sp.fps || 10), s: Step[] = [];
  const cf = (f: number) => Math.max(0, Math.min(n - 1, f));
  const evs = (sp.events || []).map((e: Json) => ({ ...e, f0: cf(e.f - 1), to0: e.to ? cf(e.to - 1) : null }));
  for (let f = 0; f < n; f++) {
    const e = evs.find((e: Json) => f === e.f0 || (e.to0 != null && f >= e.f0 && f <= e.to0));
    if (e && e.loop && e.to0 != null) {
      if (f === e.f0) for (let k = 0; k < e.loop; k++) for (let g = e.f0; g <= e.to0; g++) s.push({ f: g, d: e.d || d0, run: g === e.f0 ? e.fx : undefined });
      else if (f <= e.to0) continue;
    } else if (e && e.alt && e.to0 != null) {
      if (f === e.f0) for (let k = 0; k < (e.rep || 4) * 2; k++) s.push({ f: k % 2 ? e.to0 : e.f0, d: e.d || 0.055, run: e.fx });
      else if (f <= e.to0) continue;
    } else if (e) {
      for (let k = 0; k < (e.rep || 1); k++) s.push({ f, d: e.d || (e.hold ? e.hold : d0), run: e.fx });
    } else s.push({ f, d: d0 });
  }
  if (sp.rev) s.reverse();
  if (sp.upto) s.splice(sp.upto);
  return { id, s };
}

/** 부품 목록에 든 「맞음」 횟수 어림 (기술 전체 피해를 맞는 횟수로 나누려고) */
export function countHits(list: Json[] | undefined): number {
  let n = 0;
  for (const s of list || []) {
    if (!s || typeof s !== 'object') continue;
    const hn = s.hit ? (s.hit.n || 1) : 0;
    switch (s.t) {
      case 'repeat': n += (s.n || 3) * countHits(s.fx); break;
      case 'later': n += countHits(s.fx); break;
      case 'chance': n += Math.max(countHits(s.yes), countHits(s.no)); break;
      case 'barrage': n += (s.n || 10) * countHits(s.each); break;
      case 'screen': n += countHits(s.each); break;
      case 'chain': n += (s.n || 3) * (s.hit ? 1 : 0); break;
      case 'lob': n += (s.n || 1) * (s.end ? countHits(s.end) : hn ? 1 : 0); break;
      case 'toss': n += countHits(s.then); break;
      case 'summon': n += s.tick ? Math.floor((s.time || 4) / (s.tick.every || 1)) * countHits(s.tick.fx) : 0; break;
      case 'self': n += (s.hits || [{}]).filter((h: Json) => h.hit || s.hit).length; break;
      case 'flame': n += s.hit ? (s.hit.n || 6) : 0; break;
      case 'sweep': n += s.hit ? (s.hit.n || 5) : 0; break;
      case 'artillery': n += 1; break;
      case 'suppress': n += 1; break;
      case 'waves': n += s.hit ? 1 : 0; break;
      case 'v': {
        let k = hn;
        if (hn && (s.loop || s.tick)) k += Math.max(0, Math.floor(((s.loop || 0) + (s.hold || 0) - (s.delay || 0) - 0.05) / (s.tick || 0.6)));
        n += k + (s.after ? countHits(s.after) : 0);
        break;
      }
      default: n += hn;
    }
  }
  return n;
}

/** 한 단계 장 순서에 든 맞음 수 */
export function countSteps(s: Step[]): number {
  let n = 0;
  for (const e of s) if (e.run) n += countHits(e.run as Json[]);
  return n;
}

/** 기술 단계 목록 (steps 가 없으면 하나) */
export const stepsOf = (sp: Json): Json[] => (sp ? (sp.steps || [sp]) : []);

/** 필살·기술 전체 맞음 수 */
export function countSkill(art: CharArt, sp: Json, fallback: string): number {
  let n = 0;
  for (const st of stepsOf(sp)) n += countSteps(skillSteps(art, st, fallback).s);
  return Math.max(1, n);
}
