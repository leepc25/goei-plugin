"""Offline safety and boundary tests; never sends a paid request."""
import importlib
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import production
import mcp_client
import rig


class ResumeTests(unittest.TestCase):
    def test_owner_lock_is_exclusive_and_released(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'owner.lock'
            with production.owner_lock(path):
                self.assertTrue(path.exists())
                with self.assertRaises(FileExistsError):
                    with production.owner_lock(path): pass
            self.assertFalse(path.exists())

    def test_prepare_cannot_overwrite_submitted_requests(self):
        with tempfile.TemporaryDirectory() as tmp:
            out=Path(tmp); state=out/'attempts/paid/state.json'
            state.parent.mkdir(parents=True);state.write_text('{}')
            with patch.object(production,'OUT',out),patch.object(production,'save') as save:
                with self.assertRaises(ValueError): production.prepare()
                save.assert_not_called()

    def test_missing_auth_does_not_open_network(self):
        with patch.dict(os.environ, {}, clear=True), patch('urllib.request.urlopen') as network:
            with self.assertRaises(RuntimeError):
                mcp_client.tool('get_balance', {})
            network.assert_not_called()

    def test_submission_missing_auth_does_not_reserve_or_charge(self):
        with patch.dict(os.environ, {}, clear=True), patch.object(production, 'save') as save:
            with self.assertRaises(ValueError):
                production.submit('pipe_body', True, True)
            save.assert_not_called()

    def test_paid_transport_failure_is_never_retried(self):
        pl = importlib.import_module('pl')
        with patch.object(pl.mcp, 'tool', side_effect=TimeoutError) as call:
            with self.assertRaises(TimeoutError):
                pl.submit('animate_with_skeleton_v3', {}, tries=60)
            self.assertEqual(call.call_count, 1)

    def test_public_cost_steps(self):
        self.assertEqual([rig.cost(n) for n in [3,4,8,9,14,15]], [2,3,3,3,3,4])
        for n in [2,16]:
            with self.assertRaises(ValueError): rig.cost(n)

    def test_counter_is_continuous_with_catch(self):
        d = production.designs()
        self.assertEqual(d['catch_body'][1][-1], d['counter_body'][1][0])

    def test_requests_only_use_deadpole_reference(self):
        contracts = json.loads((production.OUT/'tool-contracts.json').read_text())
        schema = next(t['inputSchema'] for t in contracts['result']['tools']
                      if t['name']=='animate_with_skeleton_v3')
        import jsonschema
        for name in production.designs():
            r = json.loads((production.OUT/'requests'/f'{name}.json').read_text())
            jsonschema.validate(r['arguments'], schema)
            self.assertEqual(r['input_sha256'], production.sha(production.BASE.read_bytes()))
            self.assertEqual(r['arguments']['view'], 'side')
            self.assertEqual(r['arguments']['first_frame_url'],
                             'data:image/png;base64,'+production.base64.b64encode(production.BASE.read_bytes()).decode())
            for frame in r['arguments']['keypoints']:
                self.assertEqual(len({p['label'] for p in frame}), 18)
                self.assertTrue(all(0<=p['x']<=1 and 0<=p['y']<=1 for p in frame))

    def test_existing_originals_are_not_replaced(self):
        gen = importlib.import_module('gen')
        with tempfile.TemporaryDirectory() as tmp:
            old_out = gen.OUT
            try:
                gen.OUT = tmp+'/full/clips'
                original = Path(gen.OUT)/'pipe/00.png'
                original.parent.mkdir(parents=True)
                original.write_bytes(b'original-evidence')
                with patch.object(gen.pl, 'poll', return_value='ok') as poll:
                    gen.fetch('pipe', 'test-job-id')
                    self.assertIn('/resume/candidates/pipe/test-job-id/', poll.call_args.args[1])
                self.assertEqual(original.read_bytes(), b'original-evidence')
            finally:
                gen.OUT = old_out


if __name__ == '__main__':
    unittest.main()
