import copy,json,unittest
from pathlib import Path
import resume_collect as c
ROOT=Path(__file__).resolve().parents[1]/'resume'

class SafetyTests(unittest.TestCase):
    def sample(self):
        p=ROOT/'blaret-guns_idle'
        return [json.loads((p/f).read_text(encoding='utf-8')) for f in ['request.json','receipt.json','result.json']]
    def test_completed_identity_and_cost(self):
        self.assertEqual(c.validate(*self.sample()),('f06a14de-204f-47b2-badd-dfd49796f148',4,3))
    def test_reject_other_job(self):
        req,rc,r=self.sample();r['content'][0]['text']=r['content'][0]['text'].replace('f06a14de','00000000')
        with self.assertRaises(ValueError):c.validate(req,rc,r)
    def test_reject_incomplete(self):
        req,rc,r=self.sample();r['content'][0]['text']=r['content'][0]['text'].replace('status: completed','status: processing 50%')
        with self.assertRaises(ValueError):c.validate(req,rc,r)
    def test_reject_cost_conflict(self):
        req,rc,r=self.sample();r['content'][0]['text']=r['content'][0]['text'].replace('charged: 3','charged: 9')
        with self.assertRaises(ValueError):c.validate(req,rc,r)
    def test_reject_request_conflict(self):
        req,rc,r=self.sample();rc['request_sha256']='wrong'
        with self.assertRaises(ValueError):c.validate(req,rc,r)
    def test_grounded_walk_and_wrap(self):
        r=json.loads((ROOT/'saladin-walk/request.json').read_text());frames=[{p['label']:(p['x']*256,p['y']*176) for p in f} for f in r['arguments']['keypoints']]
        for side,indices in [('RIGHT LEG',range(5)),('LEFT LEG',range(4,8))]:
            xy=[frames[i][side] for i in indices]
            self.assertLess(max(x[0] for x in xy)-min(x[0] for x in xy),.04)
            self.assertLess(max(x[1] for x in xy)-min(x[1] for x in xy),.04)
        self.assertAlmostEqual(frames[7]['LEFT LEG'][0],frames[0]['LEFT LEG'][0]+r['root_motion']['cycle_dx'],delta=.04)
    def test_masked_repair_keeps_every_unmasked_pixel(self):
        from PIL import Image
        import numpy as np
        p=ROOT/'blaret-guns_idle-inpaint'
        source=np.array(Image.open(p/'input.png').convert('RGBA'));new=np.array(Image.open(p/'sheet-exact.png').convert('RGBA'));mask=np.array(Image.open(p/'mask.png').convert('L'))>0
        self.assertTrue(np.array_equal(source[~mask],new[~mask]))
    def test_raw_frames_kept_after_alignment_and_repair(self):
        import hashlib
        for key in ['blaret-guns_idle','saladin-walk','saladin-run','saladin-run-r2','saladin-run-r3']:
            p=ROOT/key;files=json.loads((p/'files.json').read_text())
            for name,meta in files.items():self.assertEqual(hashlib.sha256((p/name).read_bytes()).hexdigest(),meta['sha256'])

    def test_rifle_server_export_matches_guarded_edit(self):
        import collect_run_repair
        collect_run_repair.main()

    def test_completed_ledger_and_approval_states(self):
        m=json.loads((ROOT/'manifest.json').read_text(encoding='utf-8'))
        self.assertEqual(len(m['ledger']),9)
        self.assertEqual(len({x['job_id'] for x in m['ledger']}),9)
        self.assertEqual(m['actual_generations'],34)
        self.assertEqual(m['completion_confirmed_generations'],34)
        self.assertEqual(len(m['entries']),6)
        self.assertTrue(all(not e['qa']['user_approved'] for e in m['entries']))

if __name__=='__main__':unittest.main()
