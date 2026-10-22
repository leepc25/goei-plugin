"""Verify delivered PixelLab edits, preservation, provenance and source immutability."""
from pathlib import Path
import json,hashlib,subprocess,unittest,io
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[4];SRC=ROOT/'game-src/action/geshugan';OUT=SRC/'resume'
class Repairs(unittest.TestCase):
 def test_raw_sources_and_pixels_outside_patch_unchanged(self):
  edits=json.loads((OUT/'accepted-edits.json').read_text())['frames']
  self.assertEqual(len(edits),20)
  for key,e in edits.items():
   with self.subTest(frame=key):
    p=SRC/e['original'];self.assertEqual(hashlib.sha256(p.read_bytes()).hexdigest(),e['original_sha256'])
    old=subprocess.check_output(['git','show','5e197e13:game-src/action/geshugan/'+e['original']],cwd=ROOT)
    self.assertEqual(old,p.read_bytes())
    a=np.array(Image.open(p).convert('RGBA'));b=np.array(Image.open(SRC/e['replacement']).convert('RGBA'));self.assertEqual(a.shape,b.shape)
    if e['tool']=='pixelart_workbench':
     rgb=a.astype(int);skin=(rgb[:,:,3]>0)&(rgb[:,:,0]>rgb[:,:,1]+15)&(rgb[:,:,1]>rgb[:,:,2]+10)
     self.assertTrue(np.array_equal(a[skin],b[skin]), 'Original face and hand skin must be preserved')
    box=e['patch_box'];d=np.any(a!=b,axis=2);self.assertTrue(d.any());d[box[1]:box[3],box[0]:box[2]]=False;self.assertFalse(d.any())
 def test_pack_contains_exact_repaired_pixels_and_job_provenance(self):
  m=json.loads((SRC/'final/manifest.json').read_text());edits=json.loads((OUT/'accepted-edits.json').read_text())['frames'];seen=set()
  for name,c in m['clips'].items():
   strip=Image.open(SRC/'final'/f'{name}.png').convert('RGBA')
   for i,s in enumerate(c['frameSources']):
    key=f'{s["clip"]}/{s["frame"]:02d}'
    if key not in edits:continue
    self.assertEqual(s['pixelEdit']['job_id'],edits[key]['job_id']);self.assertEqual(s['pixelEdit'].get('image_id'),edits[key].get('image_id'));self.assertEqual(s['offset'],[0,0])
    delivered=strip.crop((i*192,0,(i+1)*192,144));expected=Image.open(SRC/edits[key]['replacement']).convert('RGBA')
    self.assertEqual(delivered.tobytes(),expected.tobytes());seen.add(key)
  self.assertEqual(seen,set(edits))
 def test_bathing_delivery_still_identical(self):
  rows=json.loads((OUT/'bathing-comparison.json').read_text())
  for r in rows['files']:
   current=subprocess.check_output(['git','hash-object',r['path']],cwd=ROOT,text=True).strip();self.assertEqual(current,r['delivery_blob'])
if __name__=='__main__':unittest.main()
