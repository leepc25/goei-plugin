// 갱신기 지침 두 벌 (detailed = 리수폿 원문 재구성, compact = 규칙 보존·설명 압축). 절 표식 <<SECTION:x>>…<<END:x>> 는 updater.assemblePrompt 가 처리한다.
import { UPDATER_DETAILED } from './detailed';
import { UPDATER_COMPACT } from './compact';
import type { PeopleSettings } from '../settings';

export const promptFor = (s: PeopleSettings): string => (s.prompt === 'compact' ? UPDATER_COMPACT : UPDATER_DETAILED);
export { UPDATER_DETAILED, UPDATER_COMPACT };
