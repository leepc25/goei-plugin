# 시험 사람 그림

- `man.png`, `woman_idle.png`, `woman_run.png`: 사용자가 PixelLab에서 만든 Test man·Test woman.
- `eileen_<동작>.webp`(무손실) + `eileen.json`: 에일린 테스트룸 완성본(브랜치 `claude/agent-motion-set`, `game-src/action/eileen/motion_v3/에일린_테스트룸.html`)에 든 정리된 시트와 기준점(발·몸 가운데)을 `tools/build_field_eileen.py`로 그대로 뽑음(2026-10-25, 사용자 지시). 동작 번호는 테스트룸과 같다(1 평상 대기, 4 걷기, 5 뛰기, 9~12 약·강, 16 회피 …).
