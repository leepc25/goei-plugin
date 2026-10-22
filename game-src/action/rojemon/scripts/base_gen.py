# 로제몬 기준 그림 후보 (Pro Flash 96×96, 쟈알디 전투 대기 장을 그림체 참조). 사용: python3 base_gen.py <태그> <seed> <palette 0|1> [설명 덧붙임]
import sys,time,base64,re,json
import mcp
tag,seed,pal=sys.argv[1],int(sys.argv[2]),sys.argv[3]=='1'
extra=' '.join(sys.argv[4:])
STY=base64.b64encode(open('../base/style_jyaldi_guard96.png','rb').read()).decode()
DESC=('pixel art side view facing right, full body, petite slim young woman standing calmly, small frame and narrow waist, '
      'long wavy pale lavender-purple hair reaching below the waist with straight blunt bangs, purple eyes, pouting cute face, '
      'black tailored suit jacket fitted at the waist, white shirt collar, black necktie, black pencil skirt above the knee, bare legs, black low-heel pumps, '
      'arms hanging relaxed slightly away from the body, feet slightly apart. '+extra)
args={'description':DESC,'width':96,'height':96,'no_background':True,'seed':seed,
      'style_image':{'base64':STY,'usage_description':'Copy this exact pixel art style: same pixel size, same dark outline color and thickness, same 4-step blue-grey shading on black clothes, same muted saturation and brightness, same head-to-body proportion. Different character.'},
      'style_options':{'color_palette':pal,'outline':True,'detail':True,'shading':True}}
def log(s): open('../spend.log','a').write(time.strftime('%Y-%m-%d %H:%M:%S')+' base_gen '+s+'\n')
r=mcp.tool('create_image_pro_flash',args); t=mcp.text(r); log(f'{tag} seed{seed} pal{int(pal)} -> {t[:200]}'); print(t[:400])
m=re.search(r'([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})',t); j=m.group(1)
for k in range(60):
    time.sleep(6)
    r=mcp.tool('get_image',{'job_id':j}); im=[x for x in r['result']['content'] if x.get('type')=='image']
    if im: open(f'../base/{tag}.png','wb').write(base64.b64decode(im[0]['data'])); print('saved',tag); log(f'{tag} done'); break
    tx=mcp.text(r)
    if 'fail' in tx.lower(): print('FAIL',tx[:300]); log(f'{tag} FAIL'); break
