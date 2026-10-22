#!/bin/bash
# 보스 생성 줄 세우기: 동시 작업 1개. 순서대로 하나씩.
cd "$(dirname "$0")"
python3 recover.py
for b in guard grandpa giant grandma momx dadx mom dad; do python3 gen.py $b --par=1; done
for b in guard legs shadow; do python3 parts.py $b; done
echo RUN-END
