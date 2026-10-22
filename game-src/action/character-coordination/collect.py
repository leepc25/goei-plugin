#!/usr/bin/env python3
"""Offline evidence collection only; never submits or recovers a PixelLab job."""
import hashlib
import json
from pathlib import Path
import re
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
REFS = {
    "system": "origin/codex/metroidvania-run-system",
    "preparation": "origin/codex/character-production-resume",
    "blaret_saladin": "origin/claude/project-thread-rulmj5",
}


def git(*args):
    return subprocess.check_output(["git", "-C", str(ROOT), *args])


def write(name, data):
    (HERE / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def main():
    commits = {k: git("rev-parse", v).decode().strip() for k, v in REFS.items()}
    ledger, inventory, costs = {}, [], []
    # Preparation evidence duplicates system originals: merge by ID, preserve every source.
    for source, commit in commits.items():
        paths = git("ls-tree", "-r", "--name-only", commit, "game-src/action").decode().splitlines()
        for path in paths:
            if source == "blaret_saladin" and not path.startswith("game-src/action/blaret_saladin/"):
                continue
            if not (path.endswith("spend.log") or path.endswith("manifest.json")):
                continue
            data = git("show", f"{commit}:{path}")
            inventory.append({"source": source, "commit": commit, "path": path,
                              "sha256": hashlib.sha256(data).hexdigest()})
            if not path.endswith("spend.log"):
                continue
            lines = data.decode().splitlines()
            for i, line in enumerate(lines):
                # image_id/source_image_id are not background job IDs.
                ids = re.findall(r'(?:background_job_id|job_id)["\s]*:\s*["\s]*([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})', line)
                for job_id in set(ids):
                    row = ledger.setdefault(job_id, {"job_id": job_id, "actual_cost": None,
                        "actual_cost_status": "server_usage_unverified", "evidence": []})
                    row["evidence"].append({"source": source, "commit": commit, "path": path,
                        "line": i + 1, "text": line, "preceding_line": lines[i-1] if i else None})
                if re.search(r'\b(?:charged|cost|usage)\b|차감|비용', line, re.I):
                    costs.append({"source": source, "commit": commit, "path": path,
                        "line": i+1, "text": line, "status": "historical_claim_not_verified_actual_cost"})
    write("job-ledger.json", {"commits": commits, "jobs": sorted(ledger.values(), key=lambda x:x["job_id"]),
        "note": "Explicit job_id/background_job_id only. No image UUIDs; no inferred charges. Missing IDs require source reconciliation."})
    write("source-inventory.json", inventory)
    write("historical-cost-claims.json", costs)
    frames = []
    for who, names in [("blaret", ["guns_idle", "stake_finish", "super_ready"]),
                       ("saladin", ["idle", "draw", "armed_idle"])]:
        for clip in names:
            for p in sorted((ROOT / "game-src/action/blaret_saladin/clips" / who / clip).glob("*.png")):
                frames.append({"path": str(p.relative_to(ROOT)), "sha256": hashlib.sha256(p.read_bytes()).hexdigest()})
    write("review-inputs.json", {"commit": commits["system"], "frames": frames})
    print(json.dumps({"unique_explicit_job_ids": len(ledger), "source_records": len(inventory),
                      "historical_cost_claims": len(costs), "review_frames": len(frames)}))


if __name__ == "__main__":
    main()
