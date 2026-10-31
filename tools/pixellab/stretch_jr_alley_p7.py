"""뒷골목 진성약업사 v6a를 막잔(⑤ v2)과 높이가 맞게 살짝 키운다(사용자 10-31 「살짝 늘려가지고 어떻게든 맞춰봐」).
잰 값(그림 424 기준): 막잔 벽 위끝 약 88·뒷벽 아래 선 약 325(벽 높이 237), 진성약업사 약 88·약 305(217) → 배율 237/217.
벽 위끝(88)을 고정점으로 도트 그대로(NEAREST) 키우고, 오른쪽 끝(철망 옆벽)이 남게 왼쪽을 잘라 632×424로."""
from PIL import Image
D = 'game-src/art/pixellab-test-20261028/'
TOP, B5, B7 = 88, 325, 305
s = (B5 - TOP) / (B7 - TOP)
im = Image.open(D + 'jr_alley_p7_v6a_632x424.png').convert('RGB')
W, H = round(632 * s), round(424 * s)
big = im.resize((W, H), Image.NEAREST)
y0 = round(TOP * s - TOP)
out = big.crop((W - 632, y0, W, y0 + 424))
out.save(D + 'jr_alley_p7_v6a_fit_632x424.png')
print(round(s, 3), (W, H), 'y0', y0)
