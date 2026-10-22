# 경비원 순찰 모습(사람 크기, 192×144, 발 y=136): 쟈알디 대기 장을 edit_image_pixen으로 고침 → 크기·외곽선·광원이 쟈알디와 같음.
import pl
JY='../../jyaldi-v5/full/clips/idle/00.png'
D=('Change this woman into a thin hunched old male night security guard, same size, same pixel style and dark outline. '
   'Faded grey-navy decades-old guard uniform jacket with brass buttons and matching trousers, peaked guard cap with the brim pulled low so the face is in shadow, '
   'only a pale thin chin visible, short hair hidden under the cap, black police baton hanging in the far hand, old metal flashlight in the near hand, black shoes.')
jobs=[(s,pl.job('edit_image_pixen',{'description':D,'image_url':pl.url(JY),'seed':s},'guard-small')) for s in (41,42,43)]
for s,j in jobs: print(s,pl.wait(j,f'../guard/base/small{s}.png'))
