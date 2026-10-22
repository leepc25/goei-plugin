"""실계정 호출 없이 중복 과금 방지 경계를 검사한다."""
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import Mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from submission_guard import submit_once, recovered

JOB = '11826541-47d1-40de-9664-f05f1838bb23'
SUCCESS = {'result': {'content': [{'type': 'text', 'text': 'job_id: ' + JOB}]}}


class GuardTest(unittest.TestCase):
    def test_timeout_is_never_retried_even_after_restart(self):
        with tempfile.TemporaryDirectory() as d:
            call = Mock(side_effect=TimeoutError)
            with self.assertRaises(TimeoutError): submit_once(call, {'seed': 1}, d, 'walk')
            with self.assertRaises(RuntimeError): submit_once(call, {'seed': 1}, d, 'walk')
            with self.assertRaises(RuntimeError): submit_once(call, {'seed': 2}, d, 'a_walk')
            self.assertEqual(call.call_count, 1)
            row = json.loads(next(Path(d).glob('*.json')).read_text())
            self.assertEqual(row['status'], 'submission_unknown')
            self.assertIsNone(row['actual_cost'])

    def test_server_error_keeps_receipt_and_does_not_retry(self):
        with tempfile.TemporaryDirectory() as d:
            call = Mock(return_value={'result': {'isError': True, 'content': []}})
            with self.assertRaises(RuntimeError): submit_once(call, {'seed': 1}, d, 'walk')
            with self.assertRaises(RuntimeError): submit_once(call, {'seed': 2}, d, 'walk')
            self.assertEqual(call.call_count, 1)
            row = json.loads(next(Path(d).glob('*.json')).read_text())
            self.assertTrue(row['response']['result']['isError'])

    def test_body_and_armor_share_one_pending_slot(self):
        with tempfile.TemporaryDirectory() as d:
            call = Mock(return_value=SUCCESS)
            self.assertEqual(submit_once(call, {'seed': 1}, d, 'walk')[0], JOB)
            with self.assertRaises(RuntimeError): submit_once(call, {'seed': 2}, d, 'a_walk')
            self.assertEqual(call.call_count, 1)
            recovered(d, JOB)
            submit_once(call, {'seed': 2}, d, 'a_walk')
            self.assertEqual(call.call_count, 2)

    def test_completed_fingerprint_cannot_be_submitted_again(self):
        with tempfile.TemporaryDirectory() as d:
            call = Mock(return_value=SUCCESS)
            submit_once(call, {'seed': 1}, d, 'walk'); recovered(d, JOB)
            with self.assertRaises(FileExistsError): submit_once(call, {'seed': 1}, d, 'walk')
            self.assertEqual(call.call_count, 1)


if __name__ == '__main__': unittest.main()
