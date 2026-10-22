# 꼬마 인형·마네킹 기준 그림 (Pro Flash 96×96). 사용: python3 puppet_base.py <kid|man> <seed>
import sys,time,base64,re
import mcp
kind,seed=sys.argv[1],int(sys.argv[2])
if kind=='kid':
    sty='../../../art/items/dot/sig_rojemon_doll.png'
    desc=('pixel art side view facing right, full body, a small handmade burlap rag doll about 34 pixels tall standing upright, '
          'stitched cloth body, round head with button eyes, a tuft of thick purple yarn hair on top, short stubby arms and legs, '
          'same design as the reference doll, centered low on the canvas, feet near the bottom')
    use='Same doll design and colors as this small item sprite, drawn larger with more detail; dark outlines, muted shading.'
    pal=True
else:
    sty='../base/style_jyaldi_guard96.png'
    desc=('pixel art side view facing right, full body, a wooden artist mannequin the size of an adult person standing upright, '
          'faceless egg-shaped head, ball joints at neck shoulders elbows wrists hips knees ankles, smooth light wood with darker joints, '
          'no clothes, arms hanging relaxed, feet slightly apart')
    use='Copy this exact pixel art style: same pixel size, same dark outline color and thickness, same shading steps, muted saturation and brightness. Different subject.'
    pal=False
args={'description':desc,'width':96,'height':96,'no_background':True,'seed':seed,
      'style_image':{'base64':base64.b64encode(open(sty,'rb').read()).decode(),'usage_description':use},
      'style_options':{'color_palette':pal,'outline':True,'detail':True,'shading':True}}
def log(s): open('../spend.log','a').write(time.strftime('%Y-%m-%d %H:%M:%S')+' puppet_base '+s+'\n')
t=mcp.text(mcp.tool('create_image_pro_flash',args)); log(f'{kind} seed{seed} -> {t[:120]}')
j=re.search(r'"job_id":\s*"([0-9a-f-]{36})"',t) or re.search(r'([0-9a-f]{8}-[0-9a-f-]{27})',t); j=j.group(1)
for k in range(80):
    time.sleep(6)
    r=mcp.tool('get_image',{'job_id':j}); im=[x for x in r['result']['content'] if x.get('type')=='image']
    if im: open(f'../base/{kind}{seed}.png','wb').write(base64.b64decode(im[0]['data'])); print('saved',kind,seed); log(f'{kind}{seed} done'); break
    if 'fail' in mcp.text(r).lower(): print('FAIL',mcp.text(r)[:200]); break
