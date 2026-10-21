# 쟈알디 주먹 3연타 플레이 시연판: skeleton v3 3연타 15장 + 걷기 8장(skel/combo2-*, walk-*) → release/demo/jyaldi-combo.html
import base64,json,os,sys
R=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D=f'{R}/game-src/action/jyaldi-v5/skel'
sys.path.insert(0,f'{R}/game-src/action/jyaldi-v5/scripts'); os.chdir(f'{R}/game-src/action/jyaldi-v5/scripts')
import skel3
b=lambda f:'data:image/png;base64,'+base64.b64encode(open(f,'rb').read()).decode()
F={n:b(f'{D}/combo2-{n}.png') for n,_ in skel3.COMBO}|{n:b(f'{D}/walk-{n}.png') for n,_ in skel3.WALK}
html=open(f'{R}/tools/jyaldi_combo_template.html',encoding='utf-8').read().replace('__FRAMES__',json.dumps(F))
out=f'{R}/release/demo/jyaldi-combo.html'; open(out,'w',encoding='utf-8').write(html); print(out,os.path.getsize(out))
