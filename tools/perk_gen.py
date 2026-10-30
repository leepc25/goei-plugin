"""퍽 3판 목록(docs/퍽/퍽_목록_3판.json)을 게임 자료(src/game/perks/defs.gen.ts)로 옮긴다.
글(이름·효과·분류·종류·랭크·조건 글)만 옮기고, 실제 효과·출현 조건은 src/game/perks/rules.ts·runtime.ts 가 이름으로 잡는다.
사용: python3 tools/perk_gen.py"""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
d = json.loads((root / "docs/퍽/퍽_목록_3판.json").read_text(encoding="utf-8"))
perks = [{"name": p["name"], "cat": p["cat"], "kind": p["kind"], "rank": 99 if p["rank"] in ("—", "-", "") else int(p["rank"]), "cond": p.get("cond") or "", "eff": p["eff"]} for p in d["perks"]]
traits = [{"name": t["name"], "good": t["good"], "cost": t["cost"], "cond": t.get("cond") or ""} for t in d["traits"]]
out = ["// 자동 생성: tools/perk_gen.py (docs/퍽/퍽_목록_3판.json). 손으로 고치지 않는다", "/* eslint-disable */",
       "export interface PerkText { name: string; cat: string; kind: '숫자' | '변화' | '조합' | '쌓임' | '쌍'; rank: number; cond: string; eff: string }",
       "export interface TraitText { name: string; good: string; cost: string; cond: string }",
       "export const PERK_TEXT: PerkText[] = " + json.dumps(perks, ensure_ascii=False, indent=0).replace("\n", "") + ";",
       "export const TRAIT_TEXT: TraitText[] = " + json.dumps(traits, ensure_ascii=False, indent=0).replace("\n", "") + ";", ""]
(root / "src/game/perks/defs.gen.ts").write_text("\n".join(out), encoding="utf-8")
print(len(perks), len(traits))
