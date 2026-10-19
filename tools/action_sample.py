"""일반 체형 샘플의 게임용 축소·팔레트 패킹. 인체 부위는 편집하지 않는다.

python3 tools/action_sample.py
Pillow 필요. 이미지 수정은 원본 제작에서 수행하고, 여기서는 동일 배율만 적용한다.
"""
from pathlib import Path
import base64
import hashlib
import io
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def build():
    plan = json.loads((ROOT / 'game-src/action/jyaldi-production-v3.json').read_text())
    sample = plan['sample']
    source = ROOT / sample['source']
    if hashlib.sha256(source.read_bytes()).hexdigest() != sample['sourceSha256']:
        raise ValueError('샘플 원본 지문이 다릅니다.')
    image = Image.open(source).convert('RGBA')
    image.putalpha(image.getchannel('A').point(lambda value: 255 if value > 128 else 0))
    bounds = image.getchannel('A').getbbox()
    if not bounds:
        raise ValueError('빈 샘플')
    image = image.crop(bounds)
    scale = plan['nativeHeight'] / image.height
    size = (round(image.width * scale), plan['nativeHeight'])
    native = image.resize(size, Image.Resampling.NEAREST)
    native = native.quantize(colors=plan['paletteTarget'], method=Image.Quantize.FASTOCTREE,
                             dither=Image.Dither.NONE)
    out = ROOT / 'release/demo/samples'
    out.mkdir(parents=True, exist_ok=True)
    native.save(out / 'jyaldi-normal-native.png', optimize=True)
    display = native.resize((size[0] * plan['displayScale'], size[1] * plan['displayScale']),
                            Image.Resampling.NEAREST)
    display.save(out / 'jyaldi-normal-2x.png', optimize=True)
    meta = dict(source=sample['source'], sourceSha256=sample['sourceSha256'], trim=list(bounds),
                nativeSize=list(size), displaySize=list(display.size), uniformScale=scale,
                displayScale=plan['displayScale'], colors=len(native.getcolors() or []),
                bodyGeometryEditedByCompiler=False, status='single-pose-candidate-not-game-animation')
    (out / 'sample.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2) + '\n')
    encoded = []
    for name in ['jyaldi-normal-native.png', 'jyaldi-normal-2x.png']:
        encoded.append('data:image/png;base64,' + base64.b64encode((out / name).read_bytes()).decode())
    html = '''<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>쟈알디 일반 체형 샘플</title>
<style>body{margin:0;padding:24px;background:#182631;color:#eee0ca;font:15px monospace}main{display:flex;gap:32px;align-items:flex-end;flex-wrap:wrap}figure{margin:0;padding:20px;background:#233744;border:1px solid #81909b}img{image-rendering:pixelated;display:block;margin:auto}figcaption{margin-top:16px}p{line-height:1.8;max-width:800px}</style>
<h1>일반 체형 · 단일 포즈 샘플</h1><p>머리는 소폭 과장하고 상체·팔을 보강했습니다. 하체 폭을 줄이고 손을 조금 키우는 방향입니다. 아래 도트는 전체 애니메이션이나 기존 플레이 시연판에 적용된 결과가 아닙니다.</p>
<main><figure><img src="NATIVE"><figcaption>원본 높이 128px</figcaption></figure><figure><img src="DISPLAY"><figcaption>게임 표시 높이 256px · 정수 2배</figcaption></figure></main></html>'''.replace('NATIVE', encoded[0]).replace('DISPLAY', encoded[1])
    (out / 'jyaldi-normal-preview.html').write_text(html)
    print(json.dumps(meta, ensure_ascii=False))


if __name__ == '__main__':
    build()
