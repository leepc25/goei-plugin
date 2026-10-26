# 골목 배경 이음 (2026-10-26)

GPT가 따로 그린 배경을 `tools/stitch/`로 이어 붙였다. 원본은 `원본/`.

| 결과 | 순서(왼→오) | 처리 |
| --- | --- | --- |
| 뒷골목_이음.webp | 뒷골목1·2·3 | 색 맞춤 + 60px 섞기 |
| 앞골목_이음.webp | 앞골목1·2·3 | 2는 1968까지, 3은 82부터 잘라 기둥이 겹치지 않게 한 뒤 색 맞춤(±8% 한도) + 40px·6px 섞기 |
| 지하상가_이음.webp | 지하상가1(헐값매입·현장장비)·2(대성무기·막잔)·3(이물상회·진성약재) | 1은 가로세로 0.89배로 줄이고 벽선 530→483, 3은 벽선 497→483으로 맞춘 뒤 색 맞춤 + 60px 섞기 |

```
python3 tools/stitch/remap_rows.py 원본/지하상가1.webp p1.png 0.8915 97:97 530:483
python3 tools/stitch/remap_rows.py 원본/지하상가3.webp p3.png 1 97:97 497:483
python3 tools/stitch/stitch_bg.py 지하상가_이음.png 60 p1.png 원본/지하상가2.webp p3.png
```

## 지하상가B_이음.webp

순서: B1(창고 B-7·동진회수, 왼쪽 끝 옆벽) → B2(서광의체·백야약품) → B3(봉인해체·태성용역, 오른쪽 끝 계단).
이음매마다 배관·전기함이 두 번 겹치지 않게 앞 그림 오른쪽 끝을 잘랐고(B1 1935, B2 1925까지), B2의 벽선을 490→512로 맞췄다.

```
# B1을 0~1935, B2를 0~1925로 자른 뒤
python3 tools/stitch/remap_rows.py B2잘림.png p2.png 1 90:90 490:512
python3 tools/stitch/stitch_bg.py 지하상가B_이음.png 30 B1잘림.png p2.png 원본/지하상가B3.webp
```

## 앞골목_이음.webp

```
# 앞골목2를 0~1968, 앞골목3을 82~2000으로 자른 뒤
python3 tools/stitch/stitch_bg.py 앞골목_이음.png 40,6 원본/앞골목1.webp p2.png p3.png
```
