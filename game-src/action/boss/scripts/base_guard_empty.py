# 경비원 기준 그림에서 경봉·손전등을 지움(소품은 따로 그려 손 관절에 붙임). 동시 1개 규칙: ../PAUSE 로 줄을 멈추고 앞 작업이 끝난 뒤 실행.
import pl,os,time,subprocess
open('../PAUSE','w').close()
while subprocess.run(['pgrep','-f','gen.py grandpa'],capture_output=True).stdout: time.sleep(10)
D=('Remove the police baton and the flashlight completely; both hands are empty, relaxed open bony hands with long fingers. '
   'Keep the same character, same pose, same size, same pixel style, same dark outline and colors.')
for src in ('G1','S1'):
    for s in (51,52):
        j=pl.job('edit_image_pixen',{'description':D,'image_url':pl.url(f'../guard/base/{src}.png'),'seed':s},f'guard-empty {src}')
        print(src,s,pl.wait(j,f'../guard/base/{src}e{s}.png'),flush=True)
os.remove('../PAUSE'); print('EMPTY-END',flush=True)
