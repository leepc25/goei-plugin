#!/usr/bin/env python3
"""Build a standalone offline review. Missing PixelLab art stays explicitly pending."""
import base64
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
(ROOT/'layers').mkdir(exist_ok=True)
# Independent, original geometric floor indicator: no text and no paid generation.
im = Image.new('RGBA', (48, 16))
d = ImageDraw.Draw(im)
d.rectangle((2, 3, 45, 14), fill='#142d31')
d.line([(8, 3), (2, 3), (2, 14), (8, 14)], fill='#88dfd3', width=2)
d.line([(39, 3), (45, 3), (45, 14), (39, 14)], fill='#88dfd3', width=2)
d.polygon([(17, 8), (24, 1), (31, 8), (28, 8), (24, 4), (20, 8)], fill='#c1ffea')
d.polygon([(17, 13), (24, 6), (31, 13), (28, 13), (24, 9), (20, 13)], fill='#70d7c0')
im.save(ROOT/'layers/entry-marker.png')

def uri(path):
    return 'data:image/png;base64,'+base64.b64encode(path.read_bytes()).decode()

scene = json.loads((ROOT/'review/scene.json').read_text())
marker = ROOT/'layers/entry-marker.png'
marker_manifest = {
    'schema': 'goei-hq-door-layer/1', 'id': 'entry-marker', 'file': 'entry-marker.png',
    'provenance': 'Original geometric indicator drawn by build-review.py; not a PixelLab image',
    'size': [48, 16], 'anchor': [24, 8], 'scale': 2,
    'world_anchor': {'x': 'door.x', 'y': 464}, 'world_bounds_y': [448, 480],
    'draw_order': 'floor after door, before actors', 'generated_text': False,
    'alpha_bbox': list(im.getbbox()), 'sha256': hashlib.sha256(marker.read_bytes()).hexdigest(),
    'paid_generation_calls': 0, 'user_visual_approval': False,
}
(ROOT/'layers/entry-marker.manifest.json').write_text(json.dumps(marker_manifest, ensure_ascii=False, indent=2)+'\n')
manifest_path = ROOT/'manifest.json'
if manifest_path.exists():
    manifest = json.loads(manifest_path.read_text())
else:
    manifest = {
        'schema': 'goei-hq-door-delivery/1', 'id': 'glass-n-round2',
        'status': 'awaiting_pixellab_auth_no_door_asset', 'user_visual_approval': False,
        'source_commit': scene['sourceCommit'],
        'canvas_target': [96, 144], 'anchor_target': [48, 136], 'scale': 2,
        'opening_target': [8, 11, 80, 125], 'world_anchor': {'x': 'door.x', 'y': 440},
        'world_canvas_origin': {'x': 'door.x - 96', 'y': 168},
        'measurement_status': 'Targets only; replace with measured values after generation',
        'states': {}, 'raw': None, 'job_id': None,
        'marker': 'layers/entry-marker.manifest.json',
        'missing': ['PixelLab original', 'closed/open transparent PNGs', 'fixed frame and leaf layers',
                    'measured state manifests', 'billed usage', 'asset integration patch'],
    }
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')
states = {}
for name, state in manifest['states'].items():
    states[name] = uri(ROOT/state['file'])
payload = {'scene': scene, 'manifest': manifest, 'states': states,
           'original': uri(ROOT/'review/current-original.png'),
           'background': uri(ROOT/'review/current-background.png'), 'marker': uri(marker)}
template = (ROOT/'review-template.html').read_text()
(ROOT/'review/index.html').write_text(template.replace('/*PAYLOAD*/', json.dumps(payload,ensure_ascii=False)))
print('Built review/index.html; door states:', list(states), '; marker: 48x16 RGBA')
