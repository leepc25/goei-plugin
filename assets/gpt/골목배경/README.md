# 골목 배경 이음 (2026-10-26)

GPT가 따로 그린 배경을 `tools/stitch/`로 이어 붙였다. 원본은 `원본/`.

| 결과 | 순서(왼→오) | 처리 |
| --- | --- | --- |
| 뒷골목_이음.webp | 뒷골목1·2·3 | 색 맞춤 + 60px 섞기 |
| 앞골목_1-2_이음.webp | 앞골목1·2 | 색 맞춤 + 40px 섞기 (3장째 파일 미수령) |
| 지하상가_이음.webp | 지하상가1(헐값매입·현장장비)·2(대성무기·막잔)·3(이물상회·진성약재) | 1은 가로세로 0.89배로 줄이고 벽선 530→483, 3은 벽선 497→483으로 맞춘 뒤 색 맞춤 + 60px 섞기 |

```
python3 tools/stitch/remap_rows.py 원본/지하상가1.webp p1.png 0.8915 97:97 530:483
python3 tools/stitch/remap_rows.py 원본/지하상가3.webp p3.png 1 97:97 497:483
python3 tools/stitch/stitch_bg.py 지하상가_이음.png 60 p1.png 원본/지하상가2.webp p3.png
```
