"""손으로 짠 도트 이펙트(dot-*)만 game-pack/action-fx 에 넣는다(공용 이펙트 289종 전체를 다시 굽지 않게).
build_char_packs.write_fx 와 같은 꼴(vfx.json 항목 + 무손실 WebP). 사용: python3 tools/dotfx/add_to_pack.py"""
import json, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
import build_char_packs as B  # noqa: E402
d = ROOT / "game-pack" / "action-fx"
V = {k: v for k, v in B.build.load_vfx().items() if k.startswith("dot-")}
meta = json.loads((d / "vfx.json").read_text(encoding="utf-8"))
for name, v in V.items():
    (d / f"{name}.webp").write_bytes(B.webp(B.from_data_uri(v["src"])))
    meta[name] = {k: vv for k, vv in v.items() if k != "src"}; meta[name]["file"] = f"{name}.webp"
(d / "vfx.json").write_text(json.dumps(meta, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print("넣음:", sorted(V))
