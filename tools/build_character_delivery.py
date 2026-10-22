#!/usr/bin/env python3
"""검수 전 기존 캐릭터 6클립을 manifest 허용 목록으로만 패키징한다.

그림 생성·픽셀 수정·엔진 연결은 하지 않는다. Pillow가 필요하다.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = Path('game-src/action/character-resume/delivery')
SOURCES = {
    'jyaldi': ('game-src/action/jyaldi-v5/full', ('walk', 'run')),
    'kyuras': ('game-src/action/kyuras', ('snap1', 'snap2', 'snap3', 'walk_shotgun')),
}
GHOSTS = ('idle_pipe', 'walk_pipe', 'shotgun', 'idle_shotgun', 'run_shotgun')
BASELINE = 'origin/codex/metroidvania-run-system'


class DeliveryError(ValueError):
    pass


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_json(path: Path):
    return json.loads(path.read_text(encoding='utf-8'))


def require(condition, message):
    if not condition:
        raise DeliveryError(message)


def git(root: Path, *args: str) -> str:
    return subprocess.check_output(['git', '-C', str(root), *args], text=True).strip()


def validate_clip(root: Path, agent: str, clip: str) -> dict:
    require(agent in SOURCES, f'알 수 없는 요원: {agent}')
    require(not (agent == 'kyuras' and clip in GHOSTS), f'구형 잔존물 금지: {agent}/{clip}')
    folder, whitelist = SOURCES[agent]
    require(clip in whitelist, f'허용 목록 밖: {agent}/{clip}')
    source = root / folder
    manifest = read_json(source / 'final/manifest.json')
    hands = read_json(source / 'final/hands.json')
    require(clip in manifest['clips'], f'manifest 누락: {agent}/{clip}')
    meta = manifest['clips'][clip]
    count = meta.get('frames')
    require(type(count) is int and count > 0, f'장수 오류: {agent}/{clip}')
    raw_dir = source / 'clips' / clip
    raw = sorted(raw_dir.glob('*.png'))
    expected = [f'{i:02d}.png' for i in range(count)]
    require([p.name for p in raw] == expected, f'원본 장수/순서 불일치: {agent}/{clip}')
    width, height = manifest['frameW'], manifest['frameH']
    require((width, height) == (192, 144), f'캔버스 규격 불일치: {agent}/{clip}')
    for path in raw:
        with Image.open(path) as image:
            require(image.size == (width, height), f'원본 치수 불일치: {path.name}')
            require(image.convert('RGBA').getbbox() is not None, f'빈 원본: {path.name}')
    strip = source / 'final' / f'{clip}.png'
    require(strip.is_file(), f'최종 스트립 없음: {agent}/{clip}')
    with Image.open(strip) as image:
        require(image.size == (width * count, height), f'스트립 장수 불일치: {agent}/{clip}')
    require(len(hands.get(clip, [])) == count, f'손 좌표 장수 불일치: {agent}/{clip}')
    require(len(meta.get('anchors', [])) == count, f'관절 좌표 장수 불일치: {agent}/{clip}')
    for i, (hand, anchor) in enumerate(zip(hands[clip], meta['anchors'])):
        require(len(hand) == 3 and all(isinstance(x, (int, float)) for x in hand), f'손 좌표 형식 오류: {agent}/{clip}/{i}')
        require(hand[:2] == anchor['hand'] and hand[2] == (anchor['angle'] + 90) % 360,
                f'manifest/손 좌표 불일치: {agent}/{clip}/{i}')
    require(all(type(hit) is int and 0 <= hit < count for hit in meta['hits']), f'타격 장 범위 오류: {agent}/{clip}')
    return {'source': source, 'strip': strip, 'raw': raw, 'metadata': meta,
            'hands': hands[clip], 'geometry': {k: manifest[k] for k in ('frameW', 'frameH', 'foot', 'anchor')}}


def source_record(root: Path, path: Path) -> dict:
    relative = path.relative_to(root).as_posix()
    return {'path': relative, 'sha256': sha256(path),
            'last_commit': git(root, 'log', '-1', '--format=%H', '--', relative)}


def plan(root: Path, baseline: str = BASELINE) -> tuple[dict, dict[str, Path]]:
    baseline_sha = git(root, 'rev-parse', f'{baseline}^{{commit}}')
    package = {
        'schema': 'goei.character-review-delivery/1',
        'purpose': 'existing_asset_review_only',
        'baseline_commit': baseline_sha,
        'new_art_generated': False,
        'user_visual_approval': False,
        'engine_auto_apply': False,
        'new_generation_cost': 0,
        'blockers': ['PixelLab 신규 수정 원본 없음', '쟈알디 이동·큐라스 기본 공격 시각 결함 미해결',
                     '사용자 시각 승인 없음', '손 좌표는 생성 뼈대 값으로 실제 손 부착 검수 필요'],
        'clips': {}, 'excluded_legacy_files': [],
    }
    copies = {}
    for agent, (folder, clips) in SOURCES.items():
        for clip in clips:
            data = validate_clip(root, agent, clip)
            target = f'strips/{agent}/{clip}.png'
            copies[target] = data['strip']
            source = data['source']
            package['clips'][f'{agent}/{clip}'] = {
                'strip': target, 'sha256': sha256(data['strip']),
                'status': 'existing_generated_visual_unapproved',
                'geometry': data['geometry'], 'metadata': data['metadata'], 'hands': data['hands'],
                'provenance': {'strip': source_record(root, data['strip']),
                               'manifest': source_record(root, source / 'final/manifest.json'),
                               'hands': source_record(root, source / 'final/hands.json'),
                               'raw_frames': [source_record(root, p) for p in data['raw']]},
            }
    for clip in GHOSTS:
        path = root / SOURCES['kyuras'][0] / 'final' / f'{clip}.png'
        package['excluded_legacy_files'].append({
            'clip': f'kyuras/{clip}', 'reason': 'legacy_final_not_in_current_manifest_or_raw_delivery',
            'source': source_record(root, path) if path.exists() else None,
        })
    return package, copies


def check_output(output: Path, package: dict, copies: dict[str, Path]):
    expected = set(copies) | {'manifest.json'}
    actual = {p.relative_to(output).as_posix() for p in output.rglob('*') if p.is_file()}
    require(actual == expected, f'패키지 파일 허용 목록 불일치: 추가={sorted(actual - expected)}, 누락={sorted(expected - actual)}')
    require(read_json(output / 'manifest.json') == package, '패키지 manifest가 현재 원본/기준과 다름')
    for relative, source in copies.items():
        require(sha256(output / relative) == sha256(source), f'패키지 픽셀/파일 변경: {relative}')


def build(root: Path, output: Path, baseline: str = BASELINE, check: bool = False):
    package, copies = plan(root, baseline)
    if check:
        check_output(output, package, copies)
        return package
    expected = set(copies) | {'manifest.json'}
    existing = {p.relative_to(output).as_posix() for p in output.rglob('*') if p.is_file()}
    require(not existing - expected, f'출력에 예기치 않은 파일이 있음. 덮어쓰지 않음: {sorted(existing - expected)}')
    for relative, source in copies.items():
        target = output / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
    (output / 'manifest.json').write_text(json.dumps(package, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    check_output(output, package, copies)
    return package


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='재생성 없이 납품과 원본의 일치 검사')
    parser.add_argument('--baseline', default=BASELINE, help='비교 기준 커밋 또는 ref')
    args = parser.parse_args()
    try:
        package = build(ROOT, ROOT / OUTPUT, args.baseline, args.check)
    except (DeliveryError, OSError, ValueError, subprocess.CalledProcessError) as error:
        parser.exit(1, f'납품 중단: {error}\n')
    print(f"검수 전 기존 클립 {len(package['clips'])}개 검사 완료 · 구형 무기 5개 배제 · 신규 그림 0 · 엔진 자동 적용 금지")


if __name__ == '__main__':
    main()
