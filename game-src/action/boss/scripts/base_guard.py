# 경비원 기준 그림 후보: 늘어난 몸(256×256, 키 약 200). 쟈알디 대기 장을 화풍 기준(외곽선·명암·디테일, 색 제외)으로.
import pl,sys
JY='../../jyaldi-v5/full/clips/idle/00.png'
D=('full body side view in profile facing right, a monstrous towering night security guard, unnaturally elongated: long thin neck, '
   'very long arms hanging past the knees, long legs, hunched shoulders, wearing a faded decades-old navy security uniform with brass buttons, '
   'peaked guard cap whose brim hides the face in shadow, only a thin pale chin visible, holding a black police baton in the near hand '
   'and an old metal flashlight in the far hand, black leather shoes, feet at the bottom of the canvas, horror, plain transparent background')
b0=pl.bal(); print('before',b0)
jobs=[]
for s in (11,12):
    jobs.append((f'pf{s}',pl.job('create_image_pro_flash',{'description':D,'width':256,'height':256,'no_background':True,
        'style_image':{'base64':pl.b64(JY),'usage_description':'match this pixel art style: pixel size, black outline, shading steps and detail level. Not the character or colours.'},
        'style_options':{'color_palette':False,'outline':True,'detail':True,'shading':True},'seed':s},'guard-base')))
for s in (21,22):
    jobs.append((f'px{s}',pl.job('create_image_pixen',{'description':D,'width':256,'height':256,'no_background':True,'view':'side','direction':'east','outline':'single color black outline','seed':s},'guard-base')))
for n,j in jobs: print(n, pl.wait(j,f'../guard/base/{n}.png'))
print('after',pl.bal(),'used',b0-pl.bal())
