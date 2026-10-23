"""Paid-request scheduling guards, tested without network calls."""
import base64,io,tempfile,unittest,zipfile
from pathlib import Path
from unittest.mock import patch
import field_character_production as f

class SchedulingGuards(unittest.TestCase):
 def test_import_preserves_supplied_pixels_and_rejects_other_identity(self):
  with tempfile.TemporaryDirectory() as tmp,patch.object(f,'OUT',Path(tmp)/'production'),patch.object(f,'ROOT',Path(tmp)):
   root=Path(tmp);folder=f.OUT/'a';folder.mkdir(parents=True)
   image=f.Image.new('RGBA',(128,256),(20,40,60,255));image.save(folder/'reference.png')
   backup=root/'backup';backup.mkdir();f.atomic(backup/'rejection.json',{'slug':'a','state_before':{'image':'current-source'}})
   directions=['south','south-east','east','north-east','north','north-west','west','south-west']
   with zipfile.ZipFile(backup/'character.zip','w') as z:
    for index,d in enumerate(directions):
     b=io.BytesIO();f.Image.new('RGBA',(128,256),(index,40,60,255)).save(b,format='PNG');z.writestr('Idle/rotations/'+d+'.png',b.getvalue())
   p=object.__new__(f.Production);p.s={'characters':{'a':{'image':'current-source'}}}
   a={'slug':'a','name':'A','english':'A','appearance':'A','registration_import_zip':'backup/character.zip','registration_import_review':'All supplied directions reviewed','registration_regenerate_directions':['west','south-west']}
   args=p.registration_request(a)
   self.assertEqual(set(args['direction_images']),set(directions)-{'south','west','south-west'})
   with zipfile.ZipFile(backup/'character.zip') as z:
    for d,img in args['direction_images'].items():self.assertEqual(base64.b64decode(img['base64']),z.read('Idle/rotations/'+d+'.png'))
   p.s['characters']['a']['image']='obsolete-source'
   with self.assertRaises(AssertionError):p.registration_request(a)
   p.s['characters']['a']['image']='current-source';f.atomic(backup/'rejection.json',{'slug':'someone-else','state_before':{'image':'current-source'}})
   with self.assertRaises(AssertionError):p.registration_request(a)

 def test_running_override_keeps_skeleton_mode_and_direction(self):
  with tempfile.TemporaryDirectory() as tmp,patch.object(f,'OUT',Path(tmp)):
   f.atomic(f.OUT/'control.json',{'motion_template_overrides':{'a':{'running-8-frames':'running-6-frames'}},'character_direction_overrides':{'a':{'movement_and_combat':'west'}}})
   p=object.__new__(f.Production);p.s={'characters':{'a':{'character_id':'character-a'}}}
   args=p.animation_request({'slug':'a','appearance':'Adult'},'running-8-frames','달리기')
   self.assertEqual(args['template_animation_id'],'running-6-frames');self.assertEqual(args['mode'],'skeleton-v3');self.assertEqual(args['directions'],['west'])

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
