// 플러그인 내장 지침 (docs/설계안_세계편집.md 3장, 사용자 2026-10-27): 카드 로어북 GNet·Phone·Wiki·Directive·Visit 과
// 카드 description(RP 지침)을 플러그인이 들고 간다. 카드 로어북은 더 읽지 않는다 (우선 규칙 없음).
// 글은 src/data/guides/*.txt (경량 카드 v0.16.65 에서 그대로 옮김). 사용자가 고친 글(기기 설정)은 setGuideOverride 로 덮는다.
import gnet from '../data/guides/gnet.txt';
import phone from '../data/guides/phone.txt';
import wiki from '../data/guides/wiki.txt';
import directive from '../data/guides/directive.txt';
import visit from '../../card/visit-guide.txt';
import rp from '../data/guides/rp.txt';
import tag from '../data/guides/tag.txt';

export type GuideName = 'GNet' | 'Phone' | 'Wiki' | 'Directive' | 'Visit' | 'RP' | 'Tag';
export const GUIDE_NAMES: GuideName[] = ['GNet', 'Phone', 'Wiki', 'Directive', 'Visit', 'RP', 'Tag'];
export const GUIDE_LABEL: Record<GuideName, string> = { GNet: '괴담넷', Phone: '괴담톡', Wiki: '위키', Directive: '이동·임무 지시문', Visit: '필드(본부 방문)', RP: 'RP 지침(봇 설명)', Tag: '상태창·태그' };

const VISIT_HEAD = '<!-- Visit: 본부 방문 대화 지침. 플러그인이 요청마다 필요한 섹션만 골라 씁니다. 자동 활성화 OFF / 키워드 비움. 섹션 구분 줄은 그대로 두세요. -->';
const DEFAULTS: Record<GuideName, string> = {
  GNet: gnet.replace(/\r/g, ''),
  Phone: phone.replace(/\r/g, ''),
  Wiki: wiki.replace(/\r/g, ''),
  Directive: directive.replace(/\r/g, ''),
  Visit: `${VISIT_HEAD}\n\n${visit.replace(/\r/g, '').trim()}\n`,
  RP: rp.replace(/\r/g, ''),
  Tag: tag.replace(/\r/g, ''),
};

const overrides = new Map<GuideName, string>();

/** 기기 설정에서 고친 글을 올린다 (빈 글이면 기본으로). 편집 창이 부른다 */
export function setGuideOverride(name: GuideName, text: string | undefined | null): void {
  if (text && text.trim()) overrides.set(name, text.replace(/\r/g, ''));
  else overrides.delete(name);
}

export const isGuideName = (name: string): name is GuideName => (GUIDE_NAMES as string[]).includes(name);
export const guideDefault = (name: GuideName): string => DEFAULTS[name];
export const guideText = (name: GuideName): string => overrides.get(name) ?? DEFAULTS[name];
export const guideOverridden = (name: GuideName): boolean => overrides.has(name);

/** 카드 description 이 아직 RP 지침을 들고 있는지 (경량 카드 v0.16.65 까지). 들고 있으면 플러그인이 다시 넣지 않는다 */
export const RP_HEAD = '## RP Guidance';
