# 208호 가족 기준 그림: 엄마·아빠 각각 사람 모습(대화) + 늘어난 모습(턱이 가슴까지 찢어짐, 키 약 190). 256×256 pro flash, 쟈알디 화풍.
import pl,sys
JY='../../jyaldi-v5/full/clips/idle/00.png'
STY={'base64':pl.b64(JY),'usage_description':'match this pixel art style: pixel size, black outline, shading steps and detail level. Not the character or colours.'}
M='a gentle kind-faced middle-aged Korean mother with purple permed hair, beige home cardigan over a long skirt, house slippers'
F='a stern stocky middle-aged Korean father with a hard square face, short black hair, sleeveless white undershirt under an open checked short-sleeve shirt, grey slacks, slippers'
C={
 'mom':f'full body side view in profile facing right, {M}, about half the canvas tall, hands clasped worriedly, feet at the bottom of the canvas, transparent background',
 'dad':f'full body side view in profile facing right, {F}, about two thirds of the canvas tall, arms crossed, feet at the bottom of the canvas, transparent background',
 'mom_x':f'full body side view in profile facing right, horror monster version of {M}: body stretched unnaturally tall and thin filling the canvas height, jaw torn open and hanging down to the chest showing rows of teeth, long clawed fingers, hunched, feet at the bottom of the canvas, transparent background',
 'dad_x':f'full body side view in profile facing right, horror monster version of {F}: body stretched huge and tall filling the canvas height, broad shoulders, jaw torn open and hanging down to the chest showing rows of teeth, huge hands, hunched, feet at the bottom of the canvas, transparent background',
}
which=sys.argv[1:] or list(C)
jobs=[(n,pl.job('create_image_pro_flash',{'description':C[n],'width':256,'height':256,'no_background':True,'style_image':STY,
       'style_options':{'color_palette':False,'outline':True,'detail':True,'shading':True},'seed':71},'family-base')) for n in which]
for n,j in jobs: print(n,pl.wait(j,f'../family/base/{n}-pf71.png'),flush=True)
