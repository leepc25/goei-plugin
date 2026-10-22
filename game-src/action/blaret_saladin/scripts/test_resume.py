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

if __name__=='__main__':unittest.main()
