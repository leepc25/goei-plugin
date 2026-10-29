"""필살기 전용 이펙트 13종 PixelLab 생성(10-29 사용자: 필살기가 허접 → 전용 큰 이펙트). vfx2 방식(pro, 캐릭터 그림으로 크기 맞춤 → 캐릭터 지움 → 기준점).
사용: python3 gen_super_fx.py [시작 번호] [끝 번호]   (prompts.json 순서, 0부터)"""
import json, sys, subprocess, time
from pathlib import Path
HERE = Path(__file__).resolve().parent; M3 = HERE.parent
P = json.loads((HERE / (sys.argv[3] if len(sys.argv) > 3 else "prompts.json")).read_text())
a, b = (int(sys.argv[1]) if len(sys.argv) > 1 else 0), (int(sys.argv[2]) if len(sys.argv) > 2 else len(P))
for e in P[a:b]:
    key = e["key"]; name = e["name"]
    d = json.loads((M3.parent / "testroom3" / "chars" / f"{key}.json").read_text(encoding="utf-8")); west = d.get("dir") == "W"
    sprite = (sorted((M3 / key / "1").glob("[0-9][0-9].png")) or sorted((M3 / key / "101").glob("[0-9][0-9].png")) or sorted((M3.parent / "eileen" / "base").glob("*.png")))[0]   # 에일린은 1줄이 없어 101(앉기)·eileen/base 로
    if (M3.parent / "testroom3" / "vfx" / f"{name}.png").exists(): print(name, "있음, 건너뜀"); continue
    print(time.strftime("%H:%M:%S"), "생성", name, flush=True)
    r = subprocess.run([sys.executable, str(M3 / "vfx2.py"), name, e["desc"], str(sprite), "W" if west else "E", e["mode"], key], capture_output=True, text=True)
    print(r.stdout[-600:], r.stderr[-400:], flush=True)
    man = json.loads((M3 / "fx3_manifest.json").read_text())
    if not any(m["name"] == name for m in man):
        man.append({"name": name, "key": key, "row": "전용(10-29)", "kind": "own", "mode": e["mode"], "desc": e["desc"]}); (M3 / "fx3_manifest.json").write_text(json.dumps(man, ensure_ascii=False, indent=1))
print("끝")
