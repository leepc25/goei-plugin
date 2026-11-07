// 갱신기 지침 두 벌 (detailed = 리수폿 원문 재구성, compact = 규칙 보존·설명 압축). 절 표식 <<SECTION:x>>…<<END:x>> 는 updater.assemblePrompt 가 처리한다.
import { UPDATER_DETAILED } from './detailed';
import { UPDATER_COMPACT } from './compact';
import type { PeopleSettings } from '../settings';

import { guideText } from '../../guides';

/** 요청에 쓰는 갱신기 지침: 설정 → 지침의 「인물 기록 갱신기」(고친 글, 없으면 기본 = UPDATER_*) */
export const promptFor = (s: PeopleSettings): string => guideText(s.prompt === 'compact' ? 'UpdaterCompact' : 'Updater').replace(/\n$/, '');
export { UPDATER_DETAILED, UPDATER_COMPACT };
