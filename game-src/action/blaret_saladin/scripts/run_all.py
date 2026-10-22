# 사용자 순서(2026-10-22 03:13): 요원 7명 우선, 이 작업은 동시 1개만. 캐릭터 차례로 한 클립씩, 끝나면 기병.
# 이미 넣은 일감은 spend.log에서 이어받음(끝날 때까지 새로 안 넣음).
import sys,os,subprocess; sys.path.insert(0,'.')
import gen
N=int(os.environ.get('MAXPEND','1'))
for cn in sys.argv[1:] or ['blaret','saladin','knight','modernspirit']:
    gen.run(cn,[],False,N)
if not sys.argv[1:]:
    subprocess.run([sys.executable,'horse.py'])
print('ALLDONE',flush=True)
