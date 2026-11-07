// 성적 욕망·이상성욕 (리수폿 원본 sexualDesire·paraphilia·explicitSexualStyle 이식, 2026-11-07 사용자 지시 「성적 축은 왜 안넣어」).
// 원본 구조 그대로: 인물마다 글 기록 두 개(≤700자), 전체 설정 3개(성적 욕망 기록·이상성욕 기록·발정모드) + 인물별 켬/끔·발정 버전 덮어쓰기.
//   - 처음 글은 갱신기가 `sexual_init` 으로 한 번 쓴다 (성격 6축 시작값과 같은 자리). 비어 있는 인물만.
//   - 그 뒤엔 직접 고쳐 쓰지 못한다: `observations` 의 축 `sexual_desire|paraphilia`, 방향 `replace`, pattern = 바꿀 전체 글.
//     코드가 모아 관찰 6개·장면 4개·확신 75 이상이면 검토로 띄우고, 사용자가 승인하면 글이 바뀐다 (원본 applyPeopleOperations 의 sexualAxis).
//   - 본편·Director 에는 `sexual_context_only` 정책과 함께 넘긴다: 일상 대화·일·데이트·추파·손잡기·포옹·가벼운 입맞춤에선 쓰지 않는다.
//   - 어휘: 발정 버전이면 원본 0.10.9 (노골적 한국어 비속어 필수), 아니면 0.10.7 (직설적이되 강한 어휘를 강요하지 않음).
import type { PeopleSettings } from './settings';
import type { Person, SexualAxis, SexualField, SexualProfile, SexualRecord } from './types';
import { SEXUAL_CHARS } from './types';
import { plain } from './store';

export const SEXUAL_FIELDS: SexualField[] = ['desire', 'paraphilia'];
export const SEXUAL_AXIS_OF: Record<SexualField, SexualAxis> = { desire: 'sexual_desire', paraphilia: 'paraphilia' };
export const SEXUAL_FIELD_OF: Record<SexualAxis, SexualField> = { sexual_desire: 'desire', paraphilia: 'paraphilia' };
export const SEXUAL_LABEL: Record<SexualField, string> = { desire: '성적 욕망', paraphilia: '이상성욕' };
export const isSexualAxis = (v: unknown): v is SexualAxis => v === 'sexual_desire' || v === 'paraphilia';

export const emptySexualRecord = (): SexualRecord => ({ text: '', at: '' });
export const emptySexual = (): SexualProfile => ({ desire: emptySexualRecord(), paraphilia: emptySexualRecord(), desireOn: true, paraphiliaOn: true, explicit: null });
export function ensureSexual(p: Person): SexualProfile {
  if (!p.sexual) p.sexual = emptySexual();
  return p.sexual;
}

type Flags = Pick<PeopleSettings, 'features' | 'sexualDesire' | 'paraphilia' | 'explicitStyle'>;
/** 전체 설정에서 켠 칸 (성격 6축 기능이 꺼지면 둘 다 꺼짐 — 원본도 People profile 안의 칸) */
export const sexualGlobal = (s: Flags): Record<SexualField, boolean> => ({ desire: s.features.has('axes') && s.sexualDesire, paraphilia: s.features.has('axes') && s.paraphilia });
export const sexualAnyOn = (s: Flags): boolean => { const g = sexualGlobal(s); return g.desire || g.paraphilia; };
/** 이 인물에서 이 칸을 쓰는가 (전체 켬 + 인물 켬). 원본 peopleSexualFieldEnabled */
export const sexualFieldOn = (p: Person, field: SexualField, s: Flags): boolean => sexualGlobal(s)[field] && (p.sexual?.[field === 'desire' ? 'desireOn' : 'paraphiliaOn'] ?? true);
/** 발정 버전: 인물 덮어쓰기(true/false) 가 있으면 그것, 없으면 전체 설정. 원본 peopleExplicitStyleEnabled */
export const explicitOn = (p: Person, s: Flags): boolean => (p.sexual?.explicit === true ? true : p.sexual?.explicit === false ? false : s.explicitStyle);
/** 본편·Director 에 넘길 글 (켜져 있고 글이 있을 때만) */
export function sexualTexts(p: Person, s: Flags): Partial<Record<SexualField, string>> {
  const out: Partial<Record<SexualField, string>> = {};
  for (const f of SEXUAL_FIELDS) { const t = p.sexual?.[f]?.text?.trim(); if (t && sexualFieldOn(p, f, s)) out[f] = t; }
  return out;
}
/** 사용자·갱신기가 글을 둔다 (≤700자). 비면 지움 */
export function setSexualText(p: Person, field: SexualField, text: string, at: string, manual: boolean): void {
  const sx = ensureSexual(p);
  const t = plain(text, SEXUAL_CHARS);
  sx[field] = t ? { text: t, at, ...(manual ? { manual: true } : {}) } : emptySexualRecord();
}

// ── 지침 (원본 글: base.writer.txt 6A 의 성적 항목 4줄 + peopleSexualPromptRules + people_profile_policy) ──
export const SEXUAL_POLICY = 'sexual_context_only';
export const SEXUAL_CONTEXT_RULE = 'Sexual desire and paraphilia fields are `sexual_context_only`. They are inactive during ordinary conversation, work, dating, flirting, handholding, hugs, and light kisses. Apply them only after a clear adult sexual proposition enters an imminent sexual situation, sexual touching begins, sexually intended exposure occurs, foreplay begins, or sexual activity is ongoing. Current consent, boundaries, and explicit conditions remain authoritative.';
/** Director·본편 정책 한 줄 (원본 people_profile_policy 의 성적 부분) */
export const SEXUAL_DIRECTOR_POLICY = 'sexual_context_only fields are inactive during ordinary conversation, work, dating, flirting, handholding, hugs, and light kisses. Use them only after a clear adult sexual proposition, sexual touching, sexually intended exposure, foreplay, mutually acknowledged imminent sexual activity, or ongoing sexual activity. Current consent and explicit boundaries always override them.';

const EXPLICIT_STYLE = 'Vocabulary rule, mandatory: write like adults talking dirty in private. Name body parts and acts with the crude Korean words actually used (`자지`, `보지`, `젖`, `엉덩이`, `박다`, `빨다`, `싸다` and similar), and name positions and play plainly. Euphemism, medical or academic terms, poetic wording, and softened phrasing are errors; if a sentence could appear in a romance novel, rewrite it cruder.';
const PLAIN_STYLE = 'Use the 0.10.7 style: blunt everyday sex words and slang, crude terms included, with no euphemism, clinical vocabulary, literary wording, or psychological analysis. Keep it direct but do not force the stronger explicit vocabulary examples.';
/** 원본 peopleSexualPromptRules(explicit) */
export function sexualPromptRules(explicit: boolean): string {
  return `Sexual desire is a concrete list of what this adult character likes in bed: favorite positions and poses, favorite kinds of play, preferred pace and roughness, whether they lead or follow, spots and touches that work, and what kills the mood. Write 3 to 5 short direct Korean sentences, each naming something specific. ${explicit ? EXPLICIT_STYLE : PLAIN_STYLE} Paraphilia is chosen from this closed list of adult-consensual types: fetishism focused on a body part, object, or material; sadism; masochism; exhibitionism; voyeurism; cross-dressing fixation; frotteuristic roleplay; fixation on a specific fluid or smell; fixation on body modification or scars; humiliation or submission dependency; and comparable named types. Judge in order: explicit statements, sexual history or reactions, the supplied openness lewdness value and stage, then personality traits such as control, submission, shame, exposure, possessiveness, or fixation. Use exact prefix "<추정>" for a plausible inference supported by weak or indirect evidence instead of returning "미확인". Return exact text "미확인" only for a minor or ambiguous age, an inference requiring non-consent, or when the data truly offers no basis at all. Never fabricate a concrete history; every inferred inclination must use that inference prefix and name its basis.`;
}

/** 갱신기 지침 절 (설정에 따라 조립; 원본 6A 의 4줄 + 어휘 규칙). 둘 다 꺼져 있으면 '' */
export function sexualWriterSection(s: Flags): string {
  const g = sexualGlobal(s);
  if (!g.desire && !g.paraphilia) return '';
  const fields = [g.desire ? '`sexual_desire`' : '', g.paraphilia ? '`paraphilia`' : ''].filter(Boolean).join(' and ');
  return [
    '## 7b. Sexual desire and paraphilia (Risupot sexual profile; user setting)',
    `Each person's data carries \`sexual\`: which of ${fields} this person uses, the current text of each (or null), \`init_needed\` (fields still empty) and \`explicit_style\` (true = 0.10.9 explicit vocabulary, false = 0.10.7 blunt style). A field this person does not use is omitted completely: never write it.`,
    `- **First text once (\`sexual_init\`)**: only for a person whose \`sexual.init_needed\` lists the field. ${g.desire ? '`sexual_desire`: 3 to 5 short direct Korean sentences listing concretely what the adult character likes in bed. ' : ''}${g.paraphilia ? '`paraphilia`: chosen from named adult-consensual types. ' : ''}Consider explicit facts, sexual history or reactions, the supplied openness lewdness value and stage (\`openness_now\` when present), then personality. A weak but plausible inference is prefixed with exact text "<추정>" and names its basis. Use exact text "미확인" only for a minor or ambiguous age, an inference requiring non-consent, or no usable basis at all. Cite \`m\` and \`quote\` from the span that gives the basis; when the only basis is the record, cite the span line where the person appears.`,
    `- **Wording style is selected per person** (\`sexual.explicit_style\`). ${PLAIN_STYLE.replace('Use the 0.10.7 style', 'When false, use the 0.10.7 style')} When true, ${EXPLICIT_STYLE.replace('Vocabulary rule, mandatory: write', 'write')} In both modes avoid clinical, academic, poetic, or psychological-analysis wording.`,
    `- **Existing text is never overwritten directly.** An \`observations\` item may use \`axis\` ${g.desire ? '`sexual_desire`' : ''}${g.desire && g.paraphilia ? ' or ' : ''}${g.paraphilia ? '`paraphilia`' : ''}, \`direction\` \`replace\`, and \`pattern\` (Korean ≤700) as the proposed complete replacement only when the confirmed span depicts an actual adult sexual scene. Handholding, a hug, a light kiss, ordinary dating, flirting, a sexual joke, fantasy roleplay, a proposition that did not enter a sexual situation, and temporary arousal are insufficient. Propose only a repeated desire, a directly acknowledged lasting change during actual sexual activity, sustained changed sexual choices or reactions, or a sexual milestone confirmed again in later sexual scenes. The program requires six independent observations across four scenes and confidence at least 75 before user review.`,
    `- ${SEXUAL_CONTEXT_RULE}`,
    sexualPromptRules(s.explicitStyle),
  ].join('\n');
}
