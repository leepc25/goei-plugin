import json,sys,urllib.request,time
PAL={"colors":["#0b0d10","#1b2026","#2e353c","#4a525a","#7a8188","#b4b8bc","#e6e4dc"],"max_colors":7}
jobs={
 'slot':("square skill hotbar slot frame for a modern action game HUD, dark gunmetal steel, crisp 1px bevel, small corner rivets, empty dark transparent center, minimal, monochrome",64,64),
 'portrait':("square character portrait frame for a modern action game HUD, dark gunmetal steel, crisp bevel, angled cut corners, empty center, minimal, monochrome",96,96),
 'hpbar':("long horizontal empty health bar frame for a modern action game HUD, dark gunmetal steel, crisp bevel, angled ends, empty center, minimal, monochrome",256,32),
 'hotbar':("horizontal skill hotbar panel with 8 empty square slots in a row, modern action game HUD, dark gunmetal steel, crisp bevel, minimal, monochrome",384,64),
}
out={}
for k,(d,w,h) in jobs.items():
  body=json.dumps({"description":d,"image_size":{"width":w,"height":h},"no_background":True,"target_palette":PAL}).encode()
  r=urllib.request.Request("https://api.pixellab.ai/v2/generate-ui-v2",data=body,headers={"Content-Type":"application/json"})
  try: res=json.load(urllib.request.urlopen(r)); out[k]=res; print(k,json.dumps(res)[:300])
  except urllib.error.HTTPError as e: print(k,e.code,e.read()[:500])
json.dump(out,open('jobs.json','w'))
