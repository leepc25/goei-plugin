"""docs/퍽/능력치_55명.json → src/game/combat/baseStats.gen.ts (힘민체지정, 10-30 사용자 승인)."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
rows = json.loads((ROOT / "docs/퍽/능력치_55명.json").read_text(encoding="utf-8"))
for r in rows:
    assert r["str"] + r["dex"] + r["con"] + r["int"] + r["wil"] == 25, r["name"]
body = "\n".join(f"  '{r['name']}': {{ str: {r['str']}, dex: {r['dex']}, con: {r['con']}, int: {r['int']}, wil: {r['wil']} }}," for r in rows)
(ROOT / "src/game/combat/baseStats.gen.ts").write_text(
    "// tools/base_stats.py 가 docs/퍽/능력치_55명.json 에서 만든다. 손으로 고치지 않는다.\n"
    "import type { BaseStats } from './stats';\n"
    f"export const BASE_STATS: Record<string, BaseStats> = {{\n{body}\n}};\n", encoding="utf-8")
print(len(rows))
