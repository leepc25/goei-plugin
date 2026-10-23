"""Paid-request scheduling guards, tested without network calls."""
import tempfile,unittest
from pathlib import Path
from unittest.mock import patch
import field_character_production as f

class SchedulingGuards(unittest.TestCase):
 def test_full_roster_and_one_character_at_a_time(self):
  with tempfile.TemporaryDirectory() as tmp,patch.object(f,'OUT',Path(tmp)):
   f.atomic(f.OUT/'control.json',{'release_skeleton_v3_motions':True,'motion_allowed_slugs':['a','b'],'max_character_pipeline_in_flight':20})
   f.atomic(f.OUT/'manifest.json',[{'slug':'a'},{'slug':'b'}]);f.atomic(f.OUT/'repair-queue.json',[])
   p=object.__new__(f.Production)
   p.s={'jobs':{},'characters':{k:{'ready':True,'eight_way_visual_reviewed':k=='a','image':'done','registration':'done','motions':{}}for k in ['a','b']}}
   p.apply_repairs=lambda:None;p.validate_image=lambda _:None;p.check_ready=lambda _:None;p.animation_request=lambda *args:{}
   calls=[]
   def submit(kind,slug,path,args,template=None):
    calls.append((slug,template));jid=str(len(calls));p.s['characters'][slug]['motions'][template]=jid
    p.s['jobs'][jid]={'kind':'animation','status':'processing'}
   p.submit=submit
   with patch.object(f,'request',side_effect=AssertionError('Unexpected network request')):
    p.schedule();self.assertEqual(calls,[]);self.assertFalse(p.done())
    p.s['characters']['b']['eight_way_visual_reviewed']=True
    p.schedule();self.assertEqual(len(calls),20);self.assertEqual({slug for slug,_ in calls},{'a'})
    for j in p.s['jobs'].values():j['status']='completed'
    p.schedule();self.assertEqual(len(calls),20)
    p.s['characters']['a']['motions_visual_reviewed']=True
    p.schedule();self.assertEqual(len(calls),40)
    self.assertFalse(p.done())
    for j in p.s['jobs'].values():j['status']='completed'
    self.assertFalse(p.done())
    p.s['characters']['b']['motions_visual_reviewed']=True
    self.assertFalse(p.done())
    for c in p.s['characters'].values():c['exported']=True
    self.assertTrue(p.done())

if __name__=='__main__':unittest.main()
