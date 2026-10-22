# spend.log에 있는 기준 그림 일감 중 아직 안 받은 것을 받음(무료)
import sys,re,os
sys.path.insert(0,'../../jyaldi-v5/scripts'); import mcp
from sheet import poll
for ln in open('../spend.log'):
    m=re.search(r' base (\S+) s(\d+) -> id: ([0-9a-f-]{36})',ln)
    if not m: continue
    i,s,j=m.groups(); p=f'../base/{i}/cand-{s}.png'
    if os.path.exists(p): continue
    print(i,s,poll(j,p)[:50].replace('\n',' '),flush=True)
