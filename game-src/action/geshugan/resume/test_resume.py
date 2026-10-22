import importlib.util,json,sys,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
from PIL import Image
ROOT=Path(__file__).resolve().parents[4]
sys.path.insert(0,str(ROOT/'tools'))
import build_geshugan_demo as build
# gen must load its own mcp before grig inserts the shared skeleton directory.
spec=importlib.util.spec_from_file_location('geshugan_gen',ROOT/'game-src/action/geshugan/scripts/gen.py')
gen=importlib.util.module_from_spec(spec)
with patch.object(sys,'argv',['gen.py']):spec.loader.exec_module(gen)
class Packing(unittest.TestCase):
 def test_shifted_hands_follow_down_and_getup(self):
  manifest=json.loads((ROOT/'game-src/action/geshugan/final/manifest.json').read_text())
  for name,indices in [('down',range(3,8)),('getup',range(2))]:
   c=manifest['clips'][name]
   for raw in indices:
    i=c['idx'].index(raw);image=build.frames_of(name)[raw];dy=136-image.getbbox()[3]+1
    original=build.hand(name,raw)
    self.assertEqual(c['hand'][i],[original[0],original[1]+dy])
 def test_composed_jump_sources(self):
  m=json.loads((ROOT/'game-src/action/geshugan/final/manifest.json').read_text())['clips']['jump']
  self.assertEqual([(s['clip'],s['frame']) for s in m['frameSources']], [('jump',0),('fall',0),('fall',1),('fall',1),('fall',0),('jump',6),('jump',7)])
 def test_composed_drops_keep_hand_source(self):
  sources=build.frame_sources('jump',[0,2],{'compose':[['jump',0],['fall',0],['fall',1]]},[])
  self.assertEqual(build.source_hands(sources),[build.hand('jump',0),build.hand('fall',1)])
 def test_bath_no_duplicate(self):
  data=json.loads((ROOT/'game-src/action/geshugan/resume/bathing-comparison.json').read_text())
  self.assertEqual(len(data['files']),20); self.assertTrue(all(x['identical'] for x in data['files']))
class PaidSafety(unittest.TestCase):
 def test_unknown_submission_is_not_retried_and_keeps_hash(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d);(p/'base').mkdir();(p/'base/G0.png').write_bytes((Path(gen.ROOT)/'base/G0.png').read_bytes())
   with patch.object(gen,'ROOT',d),patch.object(gen.mcp,'tool',side_effect=TimeoutError) as call:
    with self.assertRaises(RuntimeError):gen.submit('getup')
   self.assertEqual(call.call_count,1)
   meta=json.loads(next(p.glob('resume/requests/*/status.json')).read_text())
   self.assertEqual(meta['state'],'submission_unknown_do_not_retry');self.assertEqual(len(meta['input_sha256']),64)
 def test_balance_error_stops(self):
  with patch.object(gen.mcp,'tool',return_value={'result':{'isError':True}}):
   with self.assertRaises(RuntimeError):gen.bal()
if __name__=='__main__':unittest.main()
