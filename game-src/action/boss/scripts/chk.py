import sys,importlib
for b in sys.argv[1:]:
    R=importlib.import_module(f'{b}_rig')
    for n,(a,ps) in R.CLIPS.items():
        bad=[(i,k,round(x),round(y)) for i,p in enumerate(ps) for k,(x,y) in p.items() if not (2<=x<=R.B.W-2 and 2<=y<=R.B.H-2)]
        if bad: print(b,n,bad[:4])
