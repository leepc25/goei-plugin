"""쉘 의자(L02) 맞춤값·그림만 이미 만든 인물 팩에 넣는다(그림 다시 굽지 않음, 11-02).
  cfg.chairShell = game-src/art/objects/chairs_shell/fit_all.json[키]  (build.payload_of 와 같은 값)
  game-pack/action-fx/chair3-<방향>.webp = chairs_shell/fit/<방향>.png 무손실"""
import json, io
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]; P = ROOT / "game-pack"
J = json.loads((ROOT / "game-src/art/objects/chairs_shell/fit_all.json").read_text(encoding="utf-8"))
n = 0
for d in sorted(P.glob("char-*")):
    f = d / "char.json"
    if not f.exists(): continue
    o = json.loads(f.read_text(encoding="utf-8")); k = o["cfg"].get("key")
    if k in J:
        o["cfg"]["chairShell"] = J[k]; f.write_text(json.dumps(o, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"); n += 1
for p in (ROOT / "game-src/art/objects/chairs_shell/fit").glob("*.png"):
    b = io.BytesIO(); Image.open(p).convert("RGBA").save(b, "WEBP", lossless=True, quality=100, method=4)
    (P / "action-fx" / f"chair3-{p.stem}.webp").write_bytes(b.getvalue())
print("인물", n, "명")
