"""중림 방마다 사람 크기를 책상·출입문으로 잡고, 의자(C01) 크기를 그 사람 크기에 맞춘다 (사용자 2026-11-02 11:30).

기준: 키 가장 큰 남자(큐라스, 1.6_큐라스/1/00.png 키 247도트)를 1.85m로 본다.
- 문: 사람 = 문틀 높이 × 0.82 (프로젝트 규칙)
- 책상 0.75m · 감정대 0.9m · 접수대 1.0m · 포커 테이블 0.75m · 수술대 0.9m → 사람 = 높이 × 1.85 / 실제 높이
높이는 4배·3배 확대 그림에서 앞 모서리 윗선 ~ 앞 다리 바닥을 눈으로 읽은 1배 px.
기준점이 둘이면 sizes(두 점 사이에서만 크기 변함), 하나면 기본 원근(뒤 0.85~앞 1)에 dotK만 맞춘다.
"""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SPR = 247          # 큐라스 서기 키(도트)
MAN = 1.85

# 장면: [(발 y 1x, 사람 키 1x, 근거)]
REFS = {
    'jr_youngchang': [(257, 0.82 * 172, '철문 틀 85~257'), (377, 79 * MAN / 0.75, '책상 앞 298~377, 0.75m')],
    'jr_heolgap':    [(255, 0.82 * 187, '구슬발 문틀 68~255'), (352, 89 * MAN / 0.9, '감정대 앞 263~352, 0.9m')],
    'jr_songil':     [(292, 0.82 * 172, '진료실 문 틀 120~292'), (358, 90 * MAN / 1.0, '접수대 앞 268~358, 1.0m')],
    'jr_daebak':     [(381, 80 * MAN / 0.75, '포커 테이블 앞 301~381, 0.75m')],
    # 진료실: 책상이 크게 그려져 책상 기준이면 사람이 너무 큼(사용자 11:42) → 약장만
    'jr_jinryo':     [(282, 170 * MAN / 1.9, '유리 약장 112~282, 1.9m')],
    # 수술실: 수술대 윗면(250)~받침(335) 0.9m + 드럼통 앞 테(305)~바닥(412) 0.88m (사용자 11:42 「사람 사이즈가 이게 맞냐」)
    'jr_op':         [(335, 85 * MAN / 0.9, '수술대 윗면 250~335, 0.9m'), (412, 107 * MAN / 0.88, '드럼통 305~412, 0.88m')],
}


def main():
    for sid, refs in REFS.items():
        p = ROOT / f'game-src/mapedit/{sid}/map.json'
        m = json.loads(p.read_text())
        m.pop('far', None); m.pop('growTo', None); m.pop('sizes', None)
        lane = m['lane']
        if len(refs) >= 2:
            (y0, h0, _), (y1, h1, _) = refs[0], refs[-1]
            dotK = round(2 * h1 / SPR, 4)
            m['dotK'] = dotK
            m['sizes'] = [[y0 * 2, round(h0 / h1, 3)], [y1 * 2, 1.0]]
            def k_at(y2):
                if y2 <= y0 * 2: return h0 / h1
                if y2 >= y1 * 2: return 1.0
                return h0 / h1 + (1 - h0 / h1) * (y2 - y0 * 2) / (y1 * 2 - y0 * 2)
        else:
            (y1, h1, _), = refs
            t = min(1, max(0, (y1 * 2 - lane[0]) / (lane[1] - lane[0])))
            k1 = 0.85 + 0.15 * t
            dotK = round(2 * h1 / SPR / k1, 4)
            m['dotK'] = dotK
            def k_at(y2):
                t = min(1, max(0, (y2 - lane[0]) / (lane[1] - lane[0])))
                return 0.85 + 0.15 * t
        # 의자(그림 파일 소품) = 그 자리 사람과 같은 도트 배율, 바닥 가운데 고정
        for o in m['objects']:
            if not o.get('file') or not o['file'].startswith('c0'):
                continue
            im = Image.open(ROOT / f'game-src/mapedit/{sid}/{o["file"]}.png')
            foot = o['y'] + o['h']; cx = o['x'] + o['w'] / 2
            s = dotK * k_at(foot)
            w, h = round(im.width * s), round(im.height * s)
            o.update(x=round(cx - w / 2), y=foot - h, w=w, h=h)
            # 앉는 자리 = 의자 원점(원본 200×200의 (100,171) → 잘린 그림의 (50,135))
            for sp in m.get('spots', []):
                if sp.get('chair') == o['id']:
                    sx, sy = round(o['x'] + 50 * s), round(o['y'] + 135 * s)
                    sp['seat'] = {'x': sx, 'y': sy}; sp['x'] = sx; sp['y'] = sy + 14
            print(' ', sid, o['id'], '의자', w, h)
        p.write_text(json.dumps(m, ensure_ascii=False, indent=1))
        print(sid, 'dotK', m['dotK'], 'sizes', m.get('sizes'), [(y, round(h), why) for y, h, why in refs])


if __name__ == '__main__':
    main()
