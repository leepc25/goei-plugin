// 말투의 다변화 (리수폿 원본 src/speech-variety.mjs 이식, 2026-11-07 전수검사 4 의 K). 설정 register_variety off/one/two, register_change ask/auto, register_sign_limit 1~9.
//   off = 호칭·말높임만 (지금까지대로)
//   one = 상대마다 다른 지점·실제 대사에서 보인 말버릇도 speech 항목에 기록
//   two = one + 말투가 바뀌는 「조짐」: 갱신기가 speech 항목 끝에 `SIGN closer|distant: 이유` 를 달면 코드가 센다. 같은 방향이 설정 횟수(기본 3)만큼 쌓이면
//         호칭·말높임을 바꿀 수 있다 (묻기 = 인물 화면에서 승인, 자동 = 다음 턴 갱신기가 바꿈). 반대 방향이 나오면 처음부터 다시 센다.
//         횟수를 3 미만으로 두면 세지 않고 모델이 알아서 바꾼다 (원본과 같음).
// 이식판 차이: 항목 글이 한 줄(plain 이 줄바꿈을 지움)이라 표지는 글 끝의 「[말투 변화 조짐 가까워짐 1/3] 이유 / 이유」 꼴로 둔다. 표지는 코드만 쓴다.
import type { PeopleSettings } from './settings';

export type SpeechVariety = 'off' | 'one' | 'two';
export type SpeechChange = 'ask' | 'auto';
export const SPEECH_SIGN_LIMIT = 3;
export const SPEECH_SIGN_RANGE = { min: 1, max: 9 } as const;
/** 말투 항목 글자 상한 (원본 450) */
export const SPEECH_ENTRY_CHARS = 450;

export type SpeechState = 'none' | 'count' | 'ready' | 'pending';
export type SpeechDirection = '가까워짐' | '멀어짐';
export interface SpeechMarker { state: SpeechState; direction: SpeechDirection | ''; count: number; reasons: string[] }
export interface SpeechParsed extends SpeechMarker { base: string }

const DIRECTIONS: Record<string, SpeechDirection> = { closer: '가까워짐', distant: '멀어짐' };
const STATES: Record<string, SpeechState> = { '변화 조짐': 'count', '변경 가능': 'ready', '변경 승인 대기': 'pending' };
/** 글 끝의 표지. 뒤에 이유 목록(「 / 」로 이음)이 올 수 있다 */
const MARKER_RE = /\[말투 (변화 조짐|변경 가능|변경 승인 대기) (가까워짐|멀어짐)(?: ([1-9])\/([1-9]))?\]([^[\]]*)$/;
/** 갱신기가 글 끝에 단 조짐 */
const SIGN_RE = /\bSIGN\s+(closer|distant)\s*[:：]\s*([^[\]]*)$/i;
const reason = (t: unknown) => String(t ?? '').replace(/[[\]/\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);

/** 설정 → 단계·방식·횟수. 기능 register 가 꺼져 있으면 off */
export function speechVariety(s: Pick<PeopleSettings, 'features' | 'registerVariety' | 'registerChange' | 'registerSignLimit'>): { level: SpeechVariety; mode: SpeechChange; limit: number; counted: boolean } {
  const level: SpeechVariety = s.features.has('register') ? s.registerVariety : 'off';
  const limit = Math.max(SPEECH_SIGN_RANGE.min, Math.min(SPEECH_SIGN_RANGE.max, s.registerSignLimit || SPEECH_SIGN_LIMIT));
  return { level, mode: s.registerChange, limit, counted: limit >= SPEECH_SIGN_LIMIT };
}

export function parseSpeechMarker(text: string): SpeechParsed {
  const t = String(text ?? '').trim();
  const m = MARKER_RE.exec(t);
  if (!m) return { base: t, state: 'none', direction: '', count: 0, reasons: [] };
  return { base: t.slice(0, m.index).trim(), state: STATES[m[1]], direction: m[2] as SpeechDirection, count: m[1] === '변화 조짐' ? Number(m[3] || 1) : 0, reasons: m[5].split(' / ').map(reason).filter(Boolean) };
}

export function formatSpeechMarker(mk: SpeechMarker, limit = SPEECH_SIGN_LIMIT): string {
  if (!['count', 'ready', 'pending'].includes(mk.state) || !mk.direction) return '';
  const head = mk.state === 'count' ? `[말투 변화 조짐 ${mk.direction} ${Math.max(1, mk.count)}/${limit}]` : mk.state === 'ready' ? `[말투 변경 가능 ${mk.direction}]` : `[말투 변경 승인 대기 ${mk.direction}]`;
  return head + (mk.reasons.length ? ` ${mk.reasons.slice(-SPEECH_SIGN_RANGE.max).join(' / ')}` : '');
}
const join = (base: string, marker: string) => [base.trim(), marker].filter(Boolean).join(' ');

/** SIGN 줄을 떼어 낸다: [남은 글, 조짐] */
export function splitSign(text: string): { base: string; sign: { direction: SpeechDirection; reason: string } | null } {
  const t = String(text ?? '').trim();
  const m = SIGN_RE.exec(t);
  const sign = m ? { direction: DIRECTIONS[m[1].toLowerCase()], reason: reason(m[2]) } : null;
  // 모델이 표지를 베껴 썼으면 (SIGN 앞, 글 끝) 이유까지 지운다 — 표지는 코드가 다시 붙인다
  const base = (m ? t.slice(0, m.index) : t).trim().replace(MARKER_RE, '').trim();
  return { base, sign };
}

/** 갱신기가 보낸 speech 항목 글의 최종 모습 (원본 applySpeechSign). previous 는 같은 대상의 살아 있는 항목 글 ('' = 새 항목) */
export function applySpeechSign(previous: string, next: string, o: { level?: SpeechVariety; mode?: SpeechChange; limit?: number } = {}): string {
  const level = o.level ?? 'off';
  const mode = o.mode ?? 'ask';
  const limit = o.limit ?? SPEECH_SIGN_LIMIT;
  if (level !== 'two') return splitSign(next).base;
  // 3 미만 = 모델이 알아서: 세지 않고 SIGN·표지는 그냥 지운다
  if (limit < SPEECH_SIGN_LIMIT) return splitSign(next).base;
  const prev = parseSpeechMarker(previous);
  const { base: nextBase, sign } = splitSign(next);
  if (prev.state === 'ready') return nextBase; // 허용된 변경을 썼다: 집계는 처음부터
  if (prev.state === 'pending') return join(sign ? prev.base || nextBase : nextBase, formatSpeechMarker(prev, limit)); // 사용자 답 대기
  if (!sign) return join(nextBase, formatSpeechMarker(prev, limit));
  const same = prev.state === 'count' && prev.direction === sign.direction;
  const count = same ? prev.count + 1 : 1;
  const reasons = [...(same ? prev.reasons : []), sign.reason].filter(Boolean).slice(-SPEECH_SIGN_RANGE.max);
  const state: SpeechState = count >= limit ? (mode === 'auto' ? 'ready' : 'pending') : 'count';
  // 조짐은 저장된 글을 바꾸지 않는다. 새 항목만 모델이 보낸 글을 쓴다
  return join(previous.trim() ? prev.base : nextBase, formatSpeechMarker({ state, direction: sign.direction, count, reasons }, limit));
}

/** 승인 대기에 대한 사용자 답: 승인 = 다음 턴 갱신기가 바꿀 수 있음(변경 가능), 거절 = 집계 지움 */
export function decideSpeechPending(text: string, approve: boolean): string {
  const p = parseSpeechMarker(text);
  if (p.state !== 'pending') return String(text ?? '');
  return approve ? join(p.base, formatSpeechMarker({ ...p, state: 'ready' })) : p.base;
}
export const speechState = (text: string): SpeechState => parseSpeechMarker(text).state;

// ── 지침 (원본 글 그대로. 이식판 출력 형식에 맞게 core.speech → `speech`, 줄 → 글 끝) ──
const WRITER_ONE = [
  '## Speech variety (user setting)',
  'The user switched on speech variety. These lines add to the `speech` slot rules above and win where they differ.',
  'In each `speech` entry, after the form of address and the register, also write, in Korean and only from dialogue this character actually spoke in the supplied span:',
  '- what is different in how the character speaks to this target compared with other targets;',
  '- speech habits that were actually observed: sentence endings, sentence length and pace, recurring openers or interjections.',
  `You may quote one short line as an example. Keep the whole entry under ${SPEECH_ENTRY_CHARS} characters.`,
  'If the character has not spoken to this target yet, write only the address and register. Never invent a habit, an ending or an example.',
  'Complete old entries: when a stored `speech` entry for a target holds only address and register (no difference toward this target, no speech habits), and the supplied span contains dialogue this character speaks to that target, upsert that entry in this response to add those details. This is required and overrides the rule above that tells you to leave an unchanged `speech` entry alone.',
  'Completing an entry is not a register change: keep the stored form of address and honorific level exactly as they are, and return no `address` item for it.',
  'An entry that already lists speech habits is complete. Leave it alone unless the span shows a clearly new habit that is not listed yet.',
];
const WRITER_TWO = [
  'Speech change signs are also on.',
  'A sign is evidence in this span that the way the character speaks to one target is starting to shift: closer (more relaxed, familiar, warmer) or more distant (stiffer, colder, more formal). Growing or broken closeness, a change of status or role, and a clear rise or fall of affinity all count when the span shows them.',
  'When this span gives a sign for a target, upsert that `speech` entry with its stored wording kept, and end the text with exactly this form: `SIGN closer: <reason in Korean, under 60 characters>` or `SIGN distant: <reason in Korean, under 60 characters>`. At most one sign per target in one response. A span without a sign needs no upsert.',
  'Do not put a SIGN in the same upsert that completes an old entry with speech habits: when a SIGN is present the program keeps the stored wording and drops the rest. Complete the entry first and report the sign in a later span.',
  'Do not change the form of address or the honorific level because of a sign, and return no `address` item for it. The program counts the signs and rejects an `address` change while it is counting.',
  'Bracket text that begins with 말투 변화 or 말투 변경 belongs to the program. Never write, edit or remove it yourself.',
  'Only when the stored entry contains text beginning with [말투 변경 가능 may you rewrite the address and register of that entry (and return the matching `address` item) to fit the listed reasons and the current span. If the span does not support a change after all, leave the entry alone.',
];
const WRITER_TWO_FREE = [
  'Speech change by your own judgment is also on.',
  'When the span shows that closeness, status or role, or affinity toward a target has really changed, you may update the form of address and the register of that `speech` entry in the same response (and return the matching `address` item), without waiting for a second scene. Write the reason for the change in the entry in Korean.',
  'A passing mood, a joke or one angry line is still not a change.',
];
const DIRECTOR = [
  '`speech` entries may list speech habits and target-specific differences. Pass them to the writer as tendencies of that character toward that target.',
  'Tell the writer not to repeat a quoted example line and not to put the same habit into every line.',
  'Bracket text beginning with 말투 변화 조짐 is a count kept by the program: the address and register have not changed yet, only the warmth of the current scene may follow it. Text beginning with 말투 변경 승인 대기 also means no change yet.',
];

/** 단계별 지침 덩어리. 꺼져 있으면 '' */
export function speechVarietyBlock(s: Pick<PeopleSettings, 'features' | 'registerVariety' | 'registerChange' | 'registerSignLimit'>, stage: 'writer' | 'director'): string {
  const v = speechVariety(s);
  if (v.level === 'off') return '';
  if (stage === 'writer') return [...WRITER_ONE, ...(v.level === 'two' ? (v.counted ? WRITER_TWO : WRITER_TWO_FREE) : [])].join('\n');
  return DIRECTOR.join('\n');
}
