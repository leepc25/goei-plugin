import json,urllib.request
PAL={"colors":["#0b0d10","#1b2026","#2e353c","#4a525a","#7a8188","#b4b8bc","#e6e4dc"],"max_colors":7}
jobs={
 'hp':("thick horizontal empty health bar frame for a modern action game HUD, dark gunmetal steel, crisp bevel, angled cut ends, hollow dark center channel, minimal, monochrome",256,48),
 'gauge':("thin horizontal empty segmented special energy gauge frame with 5 separated cells, modern action game HUD, dark gunmetal steel, crisp bevel, minimal, monochrome",192,32),
}
out={}
for k,(d,w,h) in jobs.items():
  body=json.dumps({"description":d,"image_size":{"width":w,"height":h},"no_background":True,"target_palette":PAL}).encode()
  r=urllib.request.Request("https://api.pixellab.ai/v2/generate-ui-v2",data=body,headers={"Content-Type":"application/json"})
  res=json.load(urllib.request.urlopen(r)); out[k]=res; print(k,res)
json.dump(out,open('jobs.json','w'))
