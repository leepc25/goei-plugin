from prepare_repairs import *
jobs={
 'pipe':(6,(72,64,192,128),[80,116,128,128,103,85],78,100),
 'idle_pipe':(4,(64,64,192,128),[72]*4,86,119),
 'walk_pipe':(7,(64,64,192,128),[74]*7,87,121),
 'shotgun':(5,(64,48,192,112),[67]*5,58,81),
 'idle_shotgun':(4,(64,64,192,128),[84]*4,82,119),
 'walk_shotgun':(7,(64,64,192,128),[84]*7,82,121),
 'run_shotgun':(8,(64,72,192,136),[94]*8,96,128),
}
for clip,(n,box,xs,y0,y1) in jobs.items():
 prompt=f'{n} sequential animation crop frames arranged in TWO columns, read left to right then top to bottom. Remove the entire held weapon from every masked region. Replace weapon pixels with transparent background. Keep the original HANDS, WRISTS, ARMS and pose exactly, with a clean closed empty grip as if still holding an invisible handle. Repair only hand pixels obscured by weapon so the fingers curl around an empty handle. Preserve the same fingers and wrist position between frames, black suit sleeve, all body and legs, and original pixel palette. NO sword, NO pipe, NO gun, NO muzzle flash, NO object left anywhere in the masked region. This exports character-only empty grips; weapons are a separate layer.'
 grid(clip+'-empty-r1',clip,list(range(n)),box,{i:[(xs[i],y0,192,y1)] for i in range(n)},prompt,columns=2)
