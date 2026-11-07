// 인물 기록 갱신기 · 보조 모델 지침 (간결판).
// 설계: docs/인물기록_프롬프트_설계.md 1-2절(출력 계약은 그대로, new_people·docs·suspicion·next_note 확장),
// 규칙 출처 대조: docs/인물기록_규칙대조표.md. 리수폿 Writer·호감·관계·지각·의심 규칙을 우리 구조로 재구성.
// 지침은 영어, 기록 본문은 한국어. 문자열에 이중 중괄호를 쓰지 않는다(템플릿·CBS 충돌 방지).
// 절 경계 표식: <<SECTION:이름>> … <<END:이름>>. 같은 이름이 여러 번 나올 수 있다(본문 절 + 출력 계약 줄).
//   코드는 꺼진 기능의 절을 /<<SECTION:x>>\n[\s\S]*?<<END:x>>\n?/g 로 잘라내고, 켠 기능은 표식 줄만 지운다.
//   user_rules 절의 <<USER_RULES>> 줄은 사용자 추가 지침으로 바꾸고, 비어 있으면 절 전체를 잘라낸다.
// 데이터 JSON에 이 지침이 기대하는 추가 필드: people[].express, people[].unknown_to, docs_now, suspicion_now, npc_relations, next_note.
import text from '../../../data/guides/updater-compact.txt';
// 글은 src/data/guides/updater-compact.txt (2026-11-07 사용자: 지침은 전부 설정 → 지침 메뉴에서 보고 고친다). 고친 글은 core/guides.ts 가 덮는다
export const UPDATER_COMPACT: string = text.replace(/\r/g, '').replace(/\n$/, '');
