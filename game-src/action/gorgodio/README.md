# 고르고디오 도트 (2026-10-22)

설계: docs/캐릭터제작서/동작설계_gorgodio.md. 비용 기록: spend.log.

- base/ : 기준 그림 후보. 맨몸 채택 cand-p2-823(pixen, 쟈알디 기준표 A와 같은 생성기·외곽선) → 피부 채도 0.72배. 장갑 채택 armor-851 + 날개 부스터 편집 armor-edit-63.
- base/톤비교_쟈알디_고르고디오.png : 쟈알디 대기 장과 같은 도트 크기로 나란히.
- full/base.png : 맨몸 3/4 기준(224×176, 발바닥 y168). full/ref.png : 옆모습 기준판(pbase 00 + 앞섶 편집 41). 모든 맨몸 클립의 첫 장 참조.
- armor/base.png : 장갑 기준(256×192, 발바닥 y184).
- scripts/rig.py · rig_armor.py : 뼈대(rigbase.py 공통). gen.py : 생성. preview.py : 뼈대 미리보기. strip.py : 장 이어 보기.
