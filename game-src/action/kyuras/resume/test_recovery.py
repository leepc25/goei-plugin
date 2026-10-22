"""Offline tests: recovery cannot regenerate and never overwrites unproven files."""
import base64
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from PIL import Image

spec = importlib.util.spec_from_file_location("recovery", Path(__file__).resolve().parents[4] / "tools/recover_kyuras_jobs.py")
M = importlib.util.module_from_spec(spec)
spec.loader.exec_module(M)


def frame(size=(192, 144)):
    b = io.BytesIO()
    Image.new("RGBA", size, (30, 40, 50, 255)).save(b, format="PNG")
    return {"result": {"content": [{"type": "image", "mimeType": "image/png", "data": base64.b64encode(b.getvalue()).decode()}]}}


class FakeClient:
    def __init__(self, failed_index=None):
        self.calls = []
        self.failed_index = failed_index

    def call(self, name, args):
        self.calls.append((name, args))
        if args.get("index") == self.failed_index and "index" in args:
            return {"result": {"isError": True, "content": []}}
        return frame()

    def job(self, job_id):
        return {"id": job_id, "status": "completed", "usage": {"type": "generations", "generations": 3}}


class RecoveryTests(unittest.TestCase):
    def test_forbids_submission_and_cancellation_before_network(self):
        c = M.Client("fake-token")
        for name in ["animate_with_skeleton_v3", "cancel_job", "edit_image", "get_balance", "list_jobs"]:
            with self.assertRaises(ValueError):
                c.call(name, {})

    def test_resume_fetches_only_missing_indices_and_preserves_usage(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            c = FakeClient(failed_index=2)
            with self.assertRaises(ValueError):
                M.recover_one(c, "idle_shotgun", root)
            c = FakeClient()
            result = M.recover_one(c, "idle_shotgun", root)
            self.assertEqual([a['index'] for _, a in c.calls if 'index' in a], [2, 3])
            self.assertEqual(len(result['frames']), 4)
            self.assertEqual(result['original_job_usage']['generations'], 3)
            self.assertFalse(result['user_visual_approval'])
            self.assertEqual(result['new_generation_charge'], 0)
            self.assertTrue(all(n == 'get_image' for n, _ in c.calls))

    def test_unproven_or_changed_existing_image_is_not_overwritten(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            folder = root / M.JOBS['idle_shotgun'][0]
            folder.mkdir()
            target = folder / '00.png'
            target.write_bytes(b'preserve-me')
            with self.assertRaises(ValueError):
                M.recover_one(FakeClient(), 'idle_shotgun', root)
            self.assertEqual(target.read_bytes(), b'preserve-me')

    def test_rejects_wrong_dimensions_or_pending_response(self):
        for response in [frame((96, 96)), {'result': {'content': [{'type': 'text', 'text': 'processing'}]}}]:
            with self.assertRaises(ValueError):
                M.validated_png(response)

    def test_sse_parsing(self):
        response = {'jsonrpc': '2.0', 'id': 1, 'result': {'content': []}}
        self.assertEqual(M.parse_rpc(('event: message\r\ndata: ' + json.dumps(response) + '\r\n\r\n').encode()), response)


if __name__ == '__main__':
    unittest.main()
