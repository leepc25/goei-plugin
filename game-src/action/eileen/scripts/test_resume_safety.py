"""과금 재시도·불완전 회수 방지. 모든 API는 가짜 응답이며 비용 없음."""
import base64
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from PIL import Image
import gen


class Safety(unittest.TestCase):
    def test_timeout_is_not_retried_and_same_request_is_blocked(self):
        with tempfile.TemporaryDirectory() as tmp:
            scripts=Path(tmp)/'scripts'; scripts.mkdir()
            with patch.object(gen,'HERE',str(scripts)), patch.object(gen.mcp,'tool',side_effect=TimeoutError) as call:
                with self.assertRaises(TimeoutError): gen.submit('walk')
                with self.assertRaises(FileExistsError): gen.submit('walk')
                self.assertEqual(call.call_count,1)
            records=list((Path(tmp)/'resume/submissions').glob('*/record.json'))
            self.assertEqual(len(records),1)
            self.assertEqual(json.loads(records[0].read_text())['state'],'submission_requires_review')

    def test_partial_recovery_preserves_existing(self):
        with tempfile.TemporaryDirectory() as tmp:
            dest=Path(tmp)/'walk';dest.mkdir();(dest/'original.txt').write_text('keep')
            with patch.object(gen,'OUT',tmp),patch.object(gen.mcp,'tool',return_value={'result':{'content':[]}}):
                with self.assertRaisesRegex(RuntimeError,'장 수'): gen.fetch('walk','fake')
            self.assertEqual((dest/'original.txt').read_text(),'keep')

    def test_valid_recovery_is_complete(self):
        b=io.BytesIO();Image.new('RGBA',(192,144)).save(b,format='PNG')
        response={'result':{'content':[{'type':'image','data':base64.b64encode(b.getvalue()).decode()}]}}
        with tempfile.TemporaryDirectory() as tmp:
            with patch.object(gen,'OUT',tmp),patch.object(gen.mcp,'tool',return_value=response):
                gen.fetch('walk','fake')
            self.assertEqual(len(list((Path(tmp)/'walk').glob('*.png'))),8)

    def test_boot_rejected_before_api(self):
        with patch.object(gen.mcp,'tool') as call:
            with self.assertRaises(ValueError): gen.submit('walk',True)
            call.assert_not_called()

    def test_service_error_is_not_success(self):
        with self.assertRaises(RuntimeError):
            gen.mcp.checked({'result':{'isError':True,'content':[{'text':'401'}]}})


if __name__=='__main__': unittest.main()
