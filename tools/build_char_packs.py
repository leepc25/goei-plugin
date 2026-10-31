"""인물 팩 변환기(10-29 본 게임 탑재 1단계): 테스트룸 빌더(game-src/action/testroom3/build.py)가 재는 그림 수치·설정을 그대로 쓰되,
그림은 줄마다 시트 하나를 **WebP 무손실**로(사용자 10-29 「무손실로 가」; 인물 하나 7MB → 약 1.6MB), 설정은 char.json 으로 game-pack/char-<번호>/ 에 둔다.
공용 이펙트·의자 그림은 game-pack/action-fx/ (vfx.json + <이름>.webp, 의자 chair-<방향>.webp), 인물 목록은 action-fx/roster.json.
플러그인은 game-pack/<폴더>/pack.json 이 있는 폴더마다 팩 하나를 만들고(scripts/game-pack.mjs), required:false 팩은 그 인물을 고를 때 받는다(src/host/game/packs.ts).
사용: python3 tools/build_char_packs.py [--only 키,키] [--all]   (--all = 그림 캐시 무시)"""
import sys, json, base64, io, shutil
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
TR = ROOT / "game-src" / "action" / "testroom3"
sys.path.insert(0, str(TR))
import build  # noqa: E402
sys.path.insert(0, str(ROOT / "tools"))
import damage_std  # noqa: E402
import skill_tags  # noqa: E402
import life_phases  # noqa: E402
from PIL import Image  # noqa: E402

PACKS = ROOT / "game-pack"
args = sys.argv[1:]
only = set(args[args.index("--only") + 1].split(",")) if "--only" in args else None
force = "--all" in args


def webp(im):
    # method 6(최고 압축)은 시트 하나 2.6초(인물당 4분) — method 4는 0.04초에 용량 5% 차이. 무손실은 같다(10-29 사용자: 왜 이렇게 오래 걸리냐)
    o = io.BytesIO(); im.save(o, "WEBP", lossless=True, quality=100, method=4); return o.getvalue()


def from_data_uri(uri):
    return Image.open(io.BytesIO(base64.b64decode(uri.split(",", 1)[1]))).convert("RGBA")


def pack_id(key): return "char-" + key.split("_")[0]


def write_char(cfg):
    key = cfg["key"]; d = PACKS / pack_id(key)
    A, _ = build.analyze(cfg, force)
    # 원본 그림 폴더가 없는 컨테이너(예: 에일린 game-src/action/eileen)에서 다시 만들면 줄이 빠진다(10-31 에일린 50줄 빠짐) → 있던 줄이 줄어들면 멈춘다
    old = d / "char.json"
    if old.exists():
        had = set(json.loads(old.read_text(encoding="utf-8"))["A"])
        lost = had - set(A)
        if lost: raise SystemExit(f"{key}: 원본이 없어 줄 {len(lost)}개가 빠짐({sorted(lost)[:6]}…) — 팩을 덮어쓰지 않음")
    payload = build.payload_of(cfg, A)
    d.mkdir(parents=True, exist_ok=True)
    keep = {"pack.json", "char.json"}
    lines = {}
    for lid, a in A.items():
        fn = f"{lid}.webp"; keep.add(fn)
        (d / fn).write_bytes(webp(from_data_uri(a["src"])))
        lines[lid] = {k: v for k, v in a.items() if k != "src"}; lines[lid]["file"] = fn
    for old in d.iterdir():   # 설정에서 빠진 줄의 그림 정리(그림 원본은 motion3 에 그대로)
        if old.name not in keep: old.unlink()
    (d / "pack.json").write_text(json.dumps({"id": pack_id(key), "required": False}, ensure_ascii=False) + "\n", encoding="utf-8")
    damage_std.normalize(payload, lines)   # 기본 피해 표준값(docs/설계_기본피해_표준.md, 10-30)
    skill_tags.tag(payload)   # 판정 형태·속성·부가효과 꼬리표(10-30)
    (d / "char.json").write_text(json.dumps({"cfg": payload, "A": lines}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    life_phases.run({pack_id(key)[5:]})   # 생활 줄 시작·반복·끝 구간(10-31)
    size = sum(f.stat().st_size for f in d.iterdir())
    return size, len(lines)


def write_fx():
    d = PACKS / "action-fx"; d.mkdir(parents=True, exist_ok=True)
    V = build.load_vfx(); meta = {}
    for name, v in V.items():
        (d / f"{name}.webp").write_bytes(webp(from_data_uri(v["src"])))
        meta[name] = {k: vv for k, vv in v.items() if k != "src"}; meta[name]["file"] = f"{name}.webp"
    (d / "vfx.json").write_text(json.dumps(meta, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    for prefix, folder in (("chair", "C01_사무의자_1배"), ("chair2", "C02_기댄사무의자_1배_2차")):
        for p in (ROOT / "game-src/action/objects" / folder).glob("*.png"):
            if p.stem in ("south", "south-east", "south-west", "east", "west", "north", "north-east", "north-west"):
                (d / f"{prefix}-{p.stem}.webp").write_bytes(webp(Image.open(p).convert("RGBA")))
    (d / "pack.json").write_text(json.dumps({"id": "action-fx", "required": False}) + "\n", encoding="utf-8")
    return len(meta)


def one(item):
    ch, cfg = item
    d = PACKS / pack_id(cfg["key"])
    if (d / "char.json").exists() and not force:   # 이미 끝난 인물은 건너뜀(--all 이면 다시)
        size, n = sum(f.stat().st_size for f in d.iterdir()), len(json.loads((d / "char.json").read_text(encoding="utf-8"))["A"])
    else:
        size, n = write_char(cfg)
    print(f"{cfg['key']:<14} 줄 {n:>3} · {size / 1024 / 1024:.2f} MB", flush=True)
    return dict(key=cfg["key"], name=cfg["name"], num=ch["num"], pack=pack_id(cfg["key"]), color=cfg.get("color"), dir=cfg["dir"], armed=cfg.get("armed"), npc=cfg["key"].startswith("6."), kb=size // 1024)


def main():
    from multiprocessing import Pool
    items = []
    for ch in build.roster():
        if not (build.wanted(ch, False) or build.wanted(ch, True)): continue
        if only is not None and ch["key"] not in only: continue
        cfg = build.load_cfg(ch)
        if cfg is None: continue
        items.append((ch, cfg))
    with Pool(4) as pool:   # 10-29: 한 줄로 돌리면 한 명 4분(126명 8시간) → 4코어 병렬
        roster = pool.map(one, items, chunksize=1)
    total = sum(r["kb"] * 1024 for r in roster)
    if only is None:
        nfx = write_fx()
        (PACKS / "action-fx" / "roster.json").write_text(json.dumps(roster, ensure_ascii=False, indent=0), encoding="utf-8")
        print("이펙트", nfx, "종 · 인물", len(roster), "명 · 합계", f"{total / 1024 / 1024:.0f} MB")


if __name__ == "__main__":
    main()
