"""PixelLab 생성 승인 문 (2026-10-31 사용자: Claude가 시키지 않은 생성을 계속 보냄 → 지침이 아니라 장치로 막는다).
생성 요청(POST)은 저장소 맨 위 `.pixellab_ok` 파일에 남은 회수가 있어야만 나간다. 한 번 보낼 때마다 1씩 줄고, 0이면 막는다.
파일 형식: 첫 줄 = 남은 회수(정수), 둘째 줄부터 = 사용자가 승인한 말과 시각.
Claude 규칙(CLAUDE.md): 사용자가 「뽑아」라고 승인한 그 회수만 적는다. 스스로 늘리거나 미리 적어 두지 않는다."""
import fcntl
from pathlib import Path

GATE = Path(__file__).resolve().parents[1] / ".pixellab_ok"


class NotApproved(RuntimeError):
    pass


def spend(what=""):
    """생성 한 번을 쓴다. 승인 회수가 없으면 NotApproved"""
    if not GATE.exists():
        raise NotApproved(f"PixelLab 생성 승인 없음(.pixellab_ok 없음): {what} — 사용자에게 「무엇을 몇 회 뽑을지」 먼저 묻는다")
    with open(GATE, "r+", encoding="utf-8") as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        lines = f.read().split("\n")
        try: left = int(lines[0].strip())
        except ValueError: left = 0
        if left <= 0:
            raise NotApproved(f"PixelLab 승인 회수를 다 씀: {what} — 사용자에게 다시 묻는다")
        lines[0] = str(left - 1)
        lines.append(f"- 사용: {what}")
        f.seek(0); f.truncate(); f.write("\n".join(lines))
    return left - 1


GEN_PATHS = ("/characters/animations", "/animate-character", "/create-", "/generate", "/edit-", "/characters/")


def guard(method, path, what=""):
    """POST 생성 경로면 승인을 쓴다 (GET 조회는 그냥 통과)"""
    if method.upper() == "POST" and any(path.startswith(p) for p in GEN_PATHS):
        spend(what or path)
