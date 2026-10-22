#!/usr/bin/env python3
"""Read-only Kyuras PixelLab recovery. No generation, cancellation, or automatic promotion.

PIXELLAB_API_TOKEN or PIXELLAB_API_KEY is supplied by the environment, never a CLI argument.
Use: python3 tools/recover_kyuras_jobs.py inspect|recover
"""
import argparse
import base64
import datetime as dt
import fcntl
import hashlib
import io
import json
import os
from pathlib import Path
import sys
import urllib.request

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
JOBS = {
    "idle_shotgun": ("11826541-47d1-40de-9664-f05f1838bb23", 4),
    "run_shotgun": ("9fe0e770-b992-4299-a4c1-90d6e591828a", 8),
}
READ_TOOLS = frozenset({"get_image"})


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def sha(data):
    return hashlib.sha256(data).hexdigest()


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")
    tmp.replace(path)


def parse_rpc(raw):
    text = raw.decode()
    if text.lstrip().startswith("{"):
        return json.loads(text)
    # MCP text/event-stream: one JSON-RPC response, possibly multiple data lines.
    for block in text.replace("\r\n", "\n").split("\n\n"):
        lines = [line[5:].lstrip() for line in block.splitlines() if line.startswith("data:")]
        if lines:
            value = json.loads("\n".join(lines))
            if "result" in value or "error" in value:
                return value
    raise ValueError("MCP JSON-RPC response missing")


def credential_from_environment():
    # A configured value may be a proxy placeholder; only an API response verifies authentication.
    # Retain inherited proxy and CA configuration. TOKEN takes precedence when both are set.
    return os.environ.get("PIXELLAB_API_TOKEN") or os.environ.get("PIXELLAB_API_KEY", "")


class Client:
    def __init__(self, token):
        if not token:
            raise ValueError("PIXELLAB_API_TOKEN / PIXELLAB_API_KEY 미설정: 큐라스 작업 조회·회수 불가")
        self.token = token

    def request(self, url, data=None):
        req = urllib.request.Request(url, data=data, headers={
            "Authorization": "Bearer " + self.token,
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        })
        # Inherited proxy and CA configuration are retained; no automatic retry.
        with urllib.request.urlopen(req, timeout=45) as response:
            return response.read()

    def call(self, name, arguments):
        if name not in READ_TOOLS:
            raise ValueError("회수 도구는 생성·취소 호출을 허용하지 않습니다")
        counts = {job_id: count for job_id, count in JOBS.values()}
        if arguments.get("job_id") not in counts:
            raise ValueError("등록된 큐라스 회수 작업 ID가 아닙니다")
        if set(arguments) - {"job_id", "index"}:
            raise ValueError("지원하지 않는 회수 인자")
        index = arguments.get("index")
        if "index" in arguments and (type(index) is not int or not 0 <= index < counts[arguments["job_id"]]):
            raise ValueError("등록된 프레임 범위가 아닙니다")
        body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": "tools/call",
                           "params": {"name": name, "arguments": arguments}}).encode()
        return parse_rpc(self.request("https://api.pixellab.ai/mcp", body))

    def job(self, job_id):
        if job_id not in {j[0] for j in JOBS.values()}:
            raise ValueError("등록된 회수 작업 ID가 아닙니다")
        return json.loads(self.request("https://api.pixellab.ai/v2/background-jobs/" + job_id))


def result_of(response):
    if response.get("error"):
        raise ValueError("PixelLab JSON-RPC 오류; 저장된 응답 확인")
    result = response.get("result", {})
    if result.get("isError"):
        raise ValueError("PixelLab 서비스 오류; 저장된 응답 확인")
    return result


def save_response(path, response):
    # Preserve textual response/usage, record image hashes separately from PNGs.
    value = json.loads(json.dumps(response))
    for block in value.get("result", {}).get("content", []):
        if block.get("type") == "image" and "data" in block:
            raw = base64.b64decode(block.pop("data"), validate=True)
            block["sha256"] = sha(raw)
            block["byte_count"] = len(raw)
    write_json(path, {"observed_at": now(), "response": value})


def validated_png(response):
    result = result_of(response)
    images = [b for b in result.get("content", []) if b.get("type") == "image"]
    if len(images) != 1:
        raise ValueError("지정 프레임 PNG 한 장이 필요합니다; 대기/실패 시 재생성하지 않습니다")
    if images[0].get("mimeType") != "image/png":
        raise ValueError("예상하지 않은 이미지 형식")
    data = base64.b64decode(images[0]["data"], validate=True)
    with Image.open(io.BytesIO(data)) as im:
        if im.format != "PNG" or im.size != (192, 144):
            raise ValueError("큐라스 원본은 192×144 PNG여야 합니다")
        im.load()
        if not im.convert("RGBA").getchannel("A").getbbox():
            raise ValueError("빈 프레임")
    return data


def recover_one(client, clip, output):
    job_id, count = JOBS[clip]
    folder = output / job_id
    folder.mkdir(parents=True, exist_ok=True)
    status = client.call("get_image", {"job_id": job_id})
    save_response(folder / "status.json", status)
    result_of(status)
    metadata = None
    try:
        metadata = client.job(job_id)
        write_json(folder / "job.json", metadata)
    except Exception as exc:
        # Jobs can be cleaned up while gallery images remain recoverable.
        write_json(folder / "job-status-unavailable.json", {"observed_at": now(), "error_type": type(exc).__name__})
    rows = []
    for index in range(count):
        target = folder / f"{index:02}.png"
        proof = folder / f"{index:02}.receipt.json"
        if target.exists():
            if not proof.exists():
                raise ValueError("기존 파일의 작업 ID 증거가 없어 덮어쓰지 않습니다")
            row = json.loads(proof.read_text())
            if row.get("job_id") != job_id or row.get("index") != index or row.get("sha256") != sha(target.read_bytes()):
                raise ValueError("기존 회수 파일/증거 해시 불일치; 덮어쓰기 금지")
        else:
            response = client.call("get_image", {"job_id": job_id, "index": index})
            save_response(folder / f"{index:02}.response.json", response)
            data = validated_png(response)
            row = {"job_id": job_id, "index": index, "file": target.name, "sha256": sha(data), "recovered_at": now()}
            # Receipt first: interrupted PNG writes will fail hash validation.
            write_json(proof, row)
            target.write_bytes(data)
        rows.append(row)
    manifest = {"clip": clip, "job_id": job_id, "frames": rows,
                "status": "recovered_pending_visual_review", "user_visual_approval": False,
                "new_generation_calls": 0, "new_generation_charge": 0,
                "original_job_usage": (metadata or {}).get("usage"),
                "usage_note": "원래 과금은 작업 응답 usage만 기록. 공유 계정 잔액 차이로 추정하지 않음."}
    write_json(folder / "manifest.json", manifest)
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["inspect", "recover"])
    parser.add_argument("--clip", choices=sorted(JOBS))
    parser.add_argument("--output", type=Path, default=ROOT / "game-src/action/kyuras/recovered")
    args = parser.parse_args()
    client = Client(credential_from_environment())
    lock_path = Path("/tmp/goei-pixellab-kyuras-recovery.lock")
    with lock_path.open("w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        audit = args.output / ("inspection-" + dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%S%fZ"))
        for clip in ([args.clip] if args.clip else JOBS):
            if args.command == "recover":
                manifest = recover_one(client, clip, args.output)
                print(f"{clip}: {len(manifest['frames'])}장 회수, 시각 검수 대기")
            else:
                response = client.call("get_image", {"job_id": JOBS[clip][0]})
                save_response(audit / (clip + ".json"), response)
                result_of(response)
                print(f"{clip}: 상태 응답 저장 (생성/취소 없음)")
        print("기존 clips/final 및 엔진 자산은 변경하지 않았습니다.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        # Avoid printing arbitrary HTTP responses that could expose credentials.
        print("회수 중단:", str(exc) if isinstance(exc, ValueError) else type(exc).__name__, file=sys.stderr)
        sys.exit(1)
