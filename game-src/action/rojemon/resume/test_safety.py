"""No network: verify ambiguous paid submissions cannot be silently repeated."""
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
SCRIPTS = HERE.parent / 'scripts'
sys.path.insert(0, str(SCRIPTS))
old = Path.cwd()
os.chdir(SCRIPTS)
import gen
os.chdir(old)


class SubmissionSafety(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.old = Path.cwd()
        self.work = Path(self.temp.name) / 'scripts'
        self.work.mkdir()
        os.chdir(self.work)

    def tearDown(self):
        os.chdir(self.old)
        self.temp.cleanup()

    def test_timeout_preserves_intent_without_retry(self):
        with patch.object(gen.mcp, 'tool', side_effect=TimeoutError) as call:
            with self.assertRaises(TimeoutError):
                gen.submit('down')
            self.assertEqual(call.call_count, 1)
            with self.assertRaises(FileExistsError):
                gen.submit('down')
            self.assertEqual(call.call_count, 1)
        folder = next(Path('../resume/submissions').iterdir())
        self.assertTrue((folder / 'request.json').exists())
        state = json.loads((folder / 'state.json').read_text())
        self.assertEqual(state['status'], 'unknown')
        self.assertIsNone(state['actual_cost'])

    def test_job_receipt_preserved(self):
        job = '00000000-1111-2222-3333-444444444444'
        response = {'result': {'content': [{'type':'text','text':'job_id: '+job}]}}
        with patch.object(gen.mcp, 'tool', return_value=response) as call:
            result, _ = gen.submit('down')
            self.assertEqual(result, job)
            self.assertEqual(call.call_count, 1)
        folder = next(Path('../resume/submissions').iterdir())
        self.assertEqual(json.loads((folder/'response.json').read_text()), response)
        self.assertEqual(json.loads((folder/'state.json').read_text())['job_id'], job)


if __name__ == '__main__':
    unittest.main()
