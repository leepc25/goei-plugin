"""과금 불명확 재제출/원본 훼손 및 교체 장 손 좌표 회귀 검사. 실제 API 호출 없음."""
import base64
import importlib.util
import io
import json
from pathlib import Path
import sys
import subprocess
import tempfile
import unittest
from PIL import Image

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT / 'game-src/action/spangdal/scripts'))
def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod); return mod
builder = load('spangdal_builder', ROOT / 'tools/build_spangdal_full_demo.py')
gen = load('spangdal_gen', ROOT / 'game-src/action/spangdal/scripts/gen.py')

class ResumeTest(unittest.TestCase):
    def test_cli_loads_spangdal_rig_outside_scripts_directory(self):
        result = subprocess.run([sys.executable, str(ROOT / 'game-src/action/spangdal/scripts/gen.py'), '--help'],
                                cwd='/tmp', text=True, capture_output=True, check=True)
        self.assertIn('stab1', result.stdout)
        self.assertIn('pierce3', result.stdout)
    def test_timeout_cannot_submit_twice(self):
        calls=[]
        def timeout(*args):
            calls.append(args); raise TimeoutError('receipt unknown')
        with tempfile.TemporaryDirectory() as td:
            folder=Path(td); payload={'arguments': {'keypoints': []}}
            with self.assertRaises(TimeoutError): gen.submit_once(folder,payload,timeout)
            with self.assertRaises(RuntimeError): gen.submit_once(folder,payload,timeout)
            self.assertEqual(len(calls),1)
            self.assertEqual(json.loads((folder/'state.json').read_text())['state'],'submission_unknown')
    def test_service_error_cannot_submit_twice(self):
        with tempfile.TemporaryDirectory() as td:
            folder=Path(td)
            with self.assertRaises(RuntimeError):
                gen.submit_once(folder,{'arguments':{}},lambda *a:{'result':{'isError':True}})
            with self.assertRaises(RuntimeError):
                gen.submit_once(folder,{'arguments':{}},lambda *a:self.fail('double billing'))
    def test_recovery_resumes_without_regeneration(self):
        buf=io.BytesIO(); Image.new('RGBA',(192,144),(0,0,0,255)).save(buf,'PNG')
        job='00000000-0000-4000-8000-000000000001'; calls=[]
        def client(name,args):
            calls.append((name,args)); self.assertEqual(name,'get_image')
            return {'result':{'content':[{'type':'image','mimeType':'image/png','data':base64.b64encode(buf.getvalue()).decode()}]}}
        with tempfile.TemporaryDirectory() as td:
            folder=Path(td)
            gen.save(folder/'state.json',{'job_id':job,'state':'submitted','actual_cost':None})
            gen.save(folder/'request.json',{'arguments':{'keypoints':[[],[]]}})
            gen.recover(folder,client); first=(folder/'00.png').read_bytes()
            calls.clear(); gen.recover(folder,client)
            self.assertEqual(calls,[('get_image',{'job_id':job})])
            self.assertEqual(first,(folder/'00.png').read_bytes())
            (folder/'00.png').write_bytes(b'damaged')
            with self.assertRaises(RuntimeError): gen.recover(folder,client)
    def test_hand_metadata_follows_replaced_frame(self):
        frames,sources=builder.clean('toss',builder.frames_of('toss'),True)
        hands=builder.hands_of('toss',len(frames),sources)
        self.assertEqual(sources[2]['frame'],3)
        self.assertEqual(sources[4]['frame'],3)
        self.assertEqual(hands[2],hands[3]); self.assertEqual(hands[4],hands[3])
    def test_hand_metadata_follows_vertical_translation(self):
        frames,sources=builder.clean('stance',builder.frames_of('stance'),True)
        hands=builder.hands_of('stance',len(frames),sources)
        before=builder.hands_of('stance',len(frames))
        self.assertTrue(any(s['dy'] for s in sources))
        for i,s in enumerate(sources):
            for hand in range(2):
                self.assertAlmostEqual(hands[i][hand][1],before[i][hand][1]+s['dy'])
                self.assertEqual(hands[i][hand][0],before[i][hand][0])
                self.assertEqual(hands[i][hand][2],before[i][hand][2])
    def test_cross_clip_replacement(self):
        frames,sources=builder.clean('land',builder.frames_of('land'),True)
        self.assertEqual(sources[0]['clip'],'fall')
        hands=builder.hands_of('land',len(frames),sources)
        old=builder.hands_of('fall',len(builder.frames_of('fall')))[-1]
        for i in range(2):
            self.assertEqual(hands[0][i][0],old[i][0])
            self.assertEqual(hands[0][i][1],old[i][1]+sources[0]['dy'])

if __name__=='__main__': unittest.main()
