#!/bin/bash
# 맨몸 피격 7줄 한 번에: G → H1·H2·H3·H6 → H4·H5 (키마다 나란히). 사용: bash _test/shower_hit_all.sh 1.6_큐라스 1.1_쟈알디
cd "$(dirname "$0")/.."
for k in "$@"; do (
  python3 _test/shower_hit.py "$k" G --redo
  for s in H1 H2 H6; do python3 _test/shower_hit.py "$k" $s --redo & done; wait
  python3 _test/shower_hit.py "$k" H3 --redo
  for s in H4 H5; do python3 _test/shower_hit.py "$k" $s --redo & done; wait
) & done; wait
echo 끝
