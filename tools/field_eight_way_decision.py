"""Record a human/agent visual inspection, never infer it from metadata."""
import argparse,fcntl,json,time
from field_character_production import OUT,atomic
from field_review_sheets import DIRECTIONS

def main():
 p=argparse.ArgumentParser();p.add_argument('slug');p.add_argument('findings');p.add_argument('--west',action='store_true');a=p.parse_args()
 with (OUT/'.runner.lock').open('a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  s=json.loads((OUT/'state.json').read_text());c=s['characters'][a.slug]
  assert c.get('ready') and c.get('exported') and c.get('image_visually_reviewed')
  ctl=json.loads((OUT/'control.json').read_text());movement='west' if a.west else 'east';stationary='south-west' if a.west else 'south-east'
  record={'at':time.time(),'character_id':c['character_id'],'result':'pass','directions_reviewed':DIRECTIONS,'findings':a.findings,'movement_direction':movement,'stationary_direction':stationary,'new_user_approval':False,'rules_rechecked':['AVIF primary','Lore supplementary height','All55 before motion','Gray outer paint reroll']}
  if a.west:ctl['character_direction_overrides'][a.slug]={'movement_and_combat':movement,'stationary_noncombat':stationary,'reason':a.findings}
  c['eight_way_visual_reviewed']=True
  atomic(OUT/a.slug/'eight-way-visual-review.json',record);atomic(OUT/'control.json',ctl);atomic(OUT/'state.json',s)
  print(a.slug,'eight-way pass',movement,stationary)

if __name__=='__main__':main()
