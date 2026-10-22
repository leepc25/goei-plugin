# spend.log에서 실제로 접수된 일감(job_id가 찍힌 줄)만 세어 생성 횟수 합계. 상한 460.
import re,os,collections
R=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','spend.log')
def skel(n): return 2 if n<=3 else 3 if n<=14 else 4
tot=0; by=collections.Counter()
for ln in open(R):
    if 'job_id' not in ln: continue
    m=re.search(r' gen (\w+)/\S+ (\d+)f ',ln)
    if m: c=skel(int(m.group(2))); by['clip '+m.group(1)]+=c; tot+=c; continue
    m=re.search(r' anim (\w+) cost(\d+)',ln)
    if m: c=int(m.group(2)); by['anim '+m.group(1)]+=c; tot+=c; continue
    m=re.search(r' base (\w+)',ln)
    if m: by['base '+m.group(1)]+=1; tot+=1
for k,v in sorted(by.items()): print(f'{k:24s}{v}')
print('합계',tot,'/ 상한 460')
