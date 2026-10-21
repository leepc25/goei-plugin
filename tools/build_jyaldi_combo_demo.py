# 쟈알디 주먹 3연타 플레이 시연판: skeleton v3 15장(game-src/action/jyaldi-v5/skel/combo-*.png) → release/demo/jyaldi-combo.html
import base64,json,os,sys
R=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D=f'{R}/game-src/action/jyaldi-v5/skel'
names=['00guard','01jab-a','02jab','03jab-back','04cross-a','05cross-b','06cross','07cross-back','08guard','09power-a','10power-b','11power','12power-hold','13power-back','14guard']
F={n:'data:image/png;base64,'+base64.b64encode(open(f'{D}/combo-{n}.png','rb').read()).decode() for n in names}
html=open(f'{R}/tools/jyaldi_combo_template.html',encoding='utf-8').read().replace('__FRAMES__',json.dumps(F))
out=f'{R}/release/demo/jyaldi-combo.html'; open(out,'w',encoding='utf-8').write(html); print(out,os.path.getsize(out))
