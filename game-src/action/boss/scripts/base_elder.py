# 405호 노부부 기준 그림: 할머니(키 약 130)·할아버지(키 약 150)·거대 할머니(키 약 230), 256×256, 쟈알디 화풍(색 제외).
import pl,sys
JY='../../jyaldi-v5/full/clips/idle/00.png'
STY={'base64':pl.b64(JY),'usage_description':'match this pixel art style: pixel size, black outline, shading steps and detail level. Not the character or colours.'}
INV='her face is upside down: the eyes sit where the mouth should be and a smiling mouth sits where the eyes should be, warm kindly wrinkles'
C={
 'grandma':('full body side view in profile facing right, a small hunched elderly Korean grandmother about half the canvas tall, grey permed curly hair, '
    'faded flower-pattern baggy momppe trousers, cardigan and a stained apron, rubber house slippers, '+INV+', creepy horror, feet at the bottom of the canvas, transparent background'),
 'grandpa':('full body side view in profile facing right, a tall thin elderly Korean grandfather about two thirds of the canvas tall, thin white hair, '
    'brown knitted vest over a pale shirt, grey slacks, both long arms held slightly open as if to hug, '+INV.replace('her','his')+', creepy horror, feet at the bottom of the canvas, transparent background'),
 'giant':('full body side view in profile facing right, a grotesque giant swollen elderly Korean grandmother filling the whole canvas height, bent so her back would touch a ceiling, '
    'bloated stomach stretched huge as if she swallowed a person, very long thick arms reaching the floor, torn flower-pattern momppe trousers and a ripped stained apron, grey permed hair, '
    + INV +' with the mouth gaping wide, horror, feet at the bottom of the canvas, transparent background'),
}
which=sys.argv[1:] or list(C)
jobs=[(n,pl.job('create_image_pro_flash',{'description':C[n],'width':256,'height':256,'no_background':True,'style_image':STY,
       'style_options':{'color_palette':False,'outline':True,'detail':True,'shading':True},'seed':51},'elder-base')) for n in which]
for n,j in jobs: print(n,pl.wait(j,f'../elder/base/{n}-pf51.png'))
