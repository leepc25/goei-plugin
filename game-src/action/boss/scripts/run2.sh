#!/bin/bash
cd "$(dirname "$0")"
while pgrep -f "gen.py guard" >/dev/null; do sleep 10; done
for b in grandpa giant grandma momx dadx mom dad guard; do python3 gen.py $b --par=1; done
for b in guard legs shadow; do python3 parts.py $b; done
echo RUN-END
for b in house shaft noise; do python3 parts.py $b; done
echo RUN2-END
python3 gen.py giant --par=1
echo RUN3-END
