"""Apply the individually inspected originals and supplementary lore for the final 13."""
import json,hashlib
from field_character_production import ROOT,OUT,atomic
from field_visual_decision import native_prompt

def main():
 m=json.loads((OUT/'manifest.json').read_text());s=json.loads((OUT/'state.json').read_text());control=json.loads((OUT/'control.json').read_text())
 notes=json.loads((ROOT/'tools/field_other_notes.json').read_text())
 for a in m:
  slug=a['slug']
  if slug not in notes:continue
  assert not s['characters'][slug].get('image'),'Already submitted: '+slug
  a['appearance']=notes[slug]
  if slug=='mun-hye-ran':a['stature_rendering'].update(target_body_pixels=[205,208],basis='Lore tall; upper end of previously specified female range; provisional.')
  if slug=='yun-ji-a':a['stature_rendering'].update(target_body_pixels=[198,201],basis='Lore small stature; lower end, provisional.')
  if slug=='brownie':a['stature_rendering'].update(target_body_pixels=[240,246],basis='Lore huge humanoid, including television head; provisional display stature, not canonical maximum.')
  a['source_images_visually_reviewed']=True
  a['source_review_details']={'reviewed_individually':True,'original_sha256':hashlib.sha256((ROOT/a['original_art']).read_bytes()).hexdigest(),'visual_findings':notes[slug],'lore_appearance_read':True,'source_priority':'AVIF identity first, lore supplementary height only','height':a['stature_rendering'],'reviewed_at':'2026-10-24'}
  native_prompt(a)
  if slug not in control['image_approved_slugs']:control['image_approved_slugs'].append(slug)
 atomic(OUT/'manifest.json',m);atomic(OUT/'control.json',control)
 print('13 individually reviewed originals prepared; no paid calls.')

if __name__=='__main__':main()
