#!/usr/bin/env python3
"""납품 사고 방지: 구형 파일·불완전 원본·잘못된 좌표·변조 패키지를 거부한다."""
import importlib.util
import json
import shutil
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('delivery', ROOT / 'tools/build_character_delivery.py')
delivery = importlib.util.module_from_spec(spec)
spec.loader.exec_module(delivery)


class CharacterDeliveryTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.folder = Path(delivery.SOURCES['kyuras'][0])
        source = ROOT / self.folder
        target = self.root / self.folder
        (target / 'final').mkdir(parents=True)
        for name in ('manifest.json', 'hands.json', 'snap1.png', 'idle_shotgun.png'):
            shutil.copyfile(source / 'final' / name, target / 'final' / name)
        shutil.copytree(source / 'clips/snap1', target / 'clips/snap1')

    def mutate(self, name, change):
        path = self.root / self.folder / 'final' / name
        value = json.loads(path.read_text())
        change(value)
        path.write_text(json.dumps(value))

    def test_valid_existing_clip_passes_without_claiming_approval(self):
        result = delivery.validate_clip(self.root, 'kyuras', 'snap1')
        self.assertEqual(len(result['raw']), 5)
        self.assertEqual(result['metadata']['hits'], [2])

    def test_old_final_is_not_a_delivered_clip(self):
        self.assertTrue((self.root / self.folder / 'final/idle_shotgun.png').exists())
        with self.assertRaisesRegex(delivery.DeliveryError, '구형 잔존물'):
            delivery.validate_clip(self.root, 'kyuras', 'idle_shotgun')

    def test_missing_last_raw_frame_is_rejected(self):
        (self.root / self.folder / 'clips/snap1/04.png').unlink()
        with self.assertRaisesRegex(delivery.DeliveryError, '원본 장수/순서'):
            delivery.validate_clip(self.root, 'kyuras', 'snap1')

    def test_renumbered_frame_is_rejected_even_with_same_count(self):
        folder = self.root / self.folder / 'clips/snap1'
        (folder / '04.png').rename(folder / '05.png')
        with self.assertRaisesRegex(delivery.DeliveryError, '원본 장수/순서'):
            delivery.validate_clip(self.root, 'kyuras', 'snap1')

    def test_manifest_missing_clip_is_rejected(self):
        self.mutate('manifest.json', lambda m: m['clips'].pop('snap1'))
        with self.assertRaisesRegex(delivery.DeliveryError, 'manifest 누락'):
            delivery.validate_clip(self.root, 'kyuras', 'snap1')

    def test_wrong_strip_frame_count_is_rejected(self):
        from PIL import Image
        path = self.root / self.folder / 'final/snap1.png'
        with Image.open(path) as image:
            truncated = image.crop((0, 0, 192 * 4, 144))
        truncated.save(path)
        with self.assertRaisesRegex(delivery.DeliveryError, '스트립 장수'):
            delivery.validate_clip(self.root, 'kyuras', 'snap1')

    def test_hand_metadata_mismatch_is_rejected(self):
        self.mutate('hands.json', lambda h: h['snap1'][2].__setitem__(0, 0))
        with self.assertRaisesRegex(delivery.DeliveryError, 'manifest/손 좌표'):
            delivery.validate_clip(self.root, 'kyuras', 'snap1')

    def test_hit_outside_clip_is_rejected(self):
        self.mutate('manifest.json', lambda m: m['clips']['snap1']['hits'].append(5))
        with self.assertRaisesRegex(delivery.DeliveryError, '타격 장 범위'):
            delivery.validate_clip(self.root, 'kyuras', 'snap1')

    def test_built_package_preserves_files_and_blocks_extra_legacy_asset(self):
        output = self.root / 'package'
        package = delivery.build(ROOT, output)
        self.assertEqual(len(package['clips']), 6)
        self.assertFalse(package['new_art_generated'])
        self.assertFalse(package['user_visual_approval'])
        self.assertFalse(package['engine_auto_apply'])
        self.assertEqual(len(package['excluded_legacy_files']), 5)
        for entry in package['clips'].values():
            self.assertEqual((output / entry['strip']).read_bytes(),
                             (ROOT / entry['provenance']['strip']['path']).read_bytes())
        delivery.build(ROOT, output, check=True)
        shutil.copyfile(ROOT / self.folder / 'final/idle_shotgun.png', output / 'strips/kyuras/idle_shotgun.png')
        with self.assertRaisesRegex(delivery.DeliveryError, '허용 목록 불일치'):
            delivery.build(ROOT, output, check=True)

    def test_corrupted_delivery_is_rejected(self):
        output = self.root / 'package'
        package = delivery.build(ROOT, output)
        target = output / package['clips']['kyuras/snap1']['strip']
        target.write_bytes(target.read_bytes() + b'changed')
        with self.assertRaisesRegex(delivery.DeliveryError, '패키지 픽셀/파일 변경'):
            delivery.build(ROOT, output, check=True)


if __name__ == '__main__':
    unittest.main()
