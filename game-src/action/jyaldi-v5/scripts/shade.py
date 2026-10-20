import sys,os
os.environ.setdefault('SRC','x')
sys.argv=[sys.argv[0]]
import importlib
# poses2 의 음영 복원 단계만 실행
src=open('poses2.py').read().split('names=sys.argv[1:]')[0]
exec(src)
names=['fight','walk','run']
jobs2={n:submit_shade(n) for n in names}
for n,j in jobs2.items():
    if j: print('shade done',n,fetch_frames(j,4,f'{OUT}/{n}-sh'),flush=True)
print(mcp.text(mcp.tool('get_balance',{})).split('\n')[1])
