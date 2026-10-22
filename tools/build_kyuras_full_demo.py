#!/usr/bin/env python3
"""큐라스 전 동작 시연판 빌더 (2026-10-22, 설계 docs/캐릭터제작서/동작설계_kyuras.md).

game-src/action/kyuras/clips/<클립>/NN.png (animate_with_skeleton_v3 원본, 192×144, 기준 그림 base/A.png)를
클립별 가로 스트립으로 묶어 단일 HTML(release/demo/kyuras-full.html)에 내장한다.
코드 보정(tools/kyuras_fixes.py)을 거친 최종 스트립은 게임용으로 kyuras/final/<클립>.png·manifest.json·hands.json에도 쓴다.
쟈알디와 같은 캔버스·바닥선(발바닥 y=136)·기준 x(57)라서 두 요원을 같은 엔진 좌표로 바꿔 끼울 수 있다.
폭발·불길·화염벽·연막·조준 표시는 그림에 없고 엔진(시연판 코드)이 그린다.
"""
import base64, io, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kyuras_fixes
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'game-src', 'action', 'kyuras')
BG = os.path.join(ROOT, 'game-src', 'action', 'bureau-corridor.png')
JY = os.path.join(ROOT, 'game-src', 'action', 'jyaldi-v5', 'full', 'final', 'guard.png')   # 톤 비교용 쟈알디 전투 대기
OUT = os.path.join(ROOT, 'release', 'demo', 'kyuras-full.html')


# key, 이름, fps, 반복, 타격 장들, 그림 안 이동(px, 끝에서 코드가 기준점을 옮김. 음수 = 뒤로), 타격 장 멈춤(초)
def D(key, label, fps, loop=False, hits=(), adv=0, hold=0.0, group='전투·기본'):
    return dict(key=key, label=label, fps=fps, loop=loop, hits=list(hits), adv=adv, hold=hold, group=group, origin=0)


DEFS = [
    D('idle', '기본 대기(주머니, 고개로 훑기)', 5, loop=True),
    D('fingerwarm', '손가락 풀기 + 시험 스냅', 8, hits=[4]),
    D('guard', '전투 대기(펜싱 옆선, 발끝 바운스)', 6, loop=True),
    D('engage', '전투 진입(주머니에서 손 빼기)', 12),
    D('walk', '걷기(가볍고 빠름)', 10, loop=True),
    D('advance', '전투 전진(앞발 먼저)', 14, adv=12),
    D('retreat', '전투 후퇴(뒷발 먼저)', 14, adv=-12),
    D('run', '달리기', 14, loop=True),
    D('jump', '점프(높고 가벼움)', 12),
    D('crouch', '쪼그려 앉기', 14),
    D('crouchwalk', '쪼그려 종종걸음', 12, loop=True),
    D('lowflame', '앉아 A: 바닥 불길', 14, hits=[3], hold=0.04),
    D('firewall', '앉아 D: 화염벽', 12, hits=[4], hold=0.08),
    D('snap1', 'A 1타 앞손 스냅(반걸음 후퇴)', 18, hits=[2], adv=-6, hold=0.03),
    D('snap2', 'A 2타 뒷손 스냅(한 걸음 후퇴)', 15, hits=[3], adv=-12, hold=0.05),
    D('snap3', 'A 3타 교차 스냅(크게 후퇴)', 13, hits=[3], adv=-20, hold=0.1),
    D('skid', '달리며 A: 스키드 줄폭발', 14, hits=[2, 3, 4], adv=20, hold=0.02),
    D('airsnap', '공중 A: 반동 스냅', 14, hits=[2], hold=0.04),
    D('aim', 'S 조준(수납 = 역재생)', 16),
    D('fire', 'S 원거리 스냅', 18, hits=[1]),
    D('cool', '과열: 손가락 식히기', 6),
    D('intercept', 'D 요격(두 번 스냅)', 16, hits=[2, 4], hold=0.03),
    D('charge', 'D 길게: 충전', 12, loop=True),
    D('barrage', 'D 길게: 지속 포격 방출', 14, loop=True),
    D('block', 'Q 요격 자세', 14),
    D('evade', 'Shift 백스텝 연막', 18, adv=-24),
    D('shove', 'E 밀쳐 떼기', 14, hits=[2], hold=0.04),
    D('flick', '밀친 뒤 A: 딱밤 스냅', 14, hits=[2], hold=0.05),
    D('launch', '밀친 뒤 방향+A: 발밑 폭발', 13, hits=[4], adv=-14, hold=0.08),
    D('super', 'W 필살기: 지휘', 6, hits=[1, 2, 3, 4, 6], hold=0.05),
    D('mark3', '숙련 3: 3점 지정', 10, hits=[5], hold=0.1),
    D('drum', '숙련 6: 드럼 솔로', 10, loop=True),
    D('pickup', 'E 줍기', 10),
    D('toss', '던져서 공중 스냅(벽돌)', 12, hits=[4]),
    D('drink', '커피(손가락으로 데움)', 6),
    D('eat', '간식(말하며 먹기)', 6),
    D('bandage', '자기 치료(손끝으로 지짐)', 7),
    D('hit', '약 피격', 14, adv=-6),
    D('down', '강 피격·뒤낙법', 12),
    D('getup', '기상(뒤구르기로 멀어짐)', 10, adv=-34),
    D('talk', '말하기(손짓)', 6, loop=True),
    D('tired', '피로 대기', 4, loop=True),
    D('support', '지원 등장(세 번 스냅 + 경례)', 10, hits=[3, 4, 5]),
    D('pipe', '쇠파이프 던져 터뜨리기', 12, hits=[2]),
    D('idle_pipe', '쇠파이프 어깨에 걸치고 대기', 5, loop=True),
    D('walk_pipe', '쇠파이프 걸치고 걷기', 10, loop=True),
    D('shotgun', '서툰 허리 사격', 12, hits=[1]),
    D('idle_shotgun', '산탄총 늘어뜨리고 대기', 5, loop=True),
    D('walk_shotgun', '산탄총 들고 걷기', 10, loop=True),
    D('run_shotgun', '산탄총 들고 달리기', 14, loop=True),
    D('recruit', '영입 멘트', 6, group='대화·감정'),
    D('salute', '두 손가락 경례', 8, group='대화·감정'),
]
G_BASE, G_MOVE, G_REST, G_HQ, G_EMO = '기본 클립 (몸만, 물건·장면은 엔진)', '지형·탐사', '휴식·상태', '본부 생활', '대화·감정'
LIFE = [
    (G_BASE, [('stepup', '계단 두 칸씩', 10, False), ('stepover', '넘어 들어가기', 8, False), ('liesit', '눕기 → 휙 일어나 앉기', 8, False),
              ('handswork', '서서 손 작업(수다)', 6, True), ('handshead', '머리에 두 손(빗듯 넘김)', 6, True), ('seatmouth', '앉아 먹으며 수다', 6, True),
              ('seathold', '앉아 들고 보기(다리 떪)', 4, True), ('holdlook', '서서 들고 보기(검지 톡톡)', 4, True), ('handear', '통화하며 손짓', 4, True),
              ('sweep', '박자 타며 쓸기', 8, True), ('liehold', '누워 들고 보기', 4, True),
              ('carry2_idle', '두 손 들고 서기', 5, True), ('carry2_walk', '두 손 들고 걷기', 10, True), ('carry2_run', '두 손 들고 달리기', 14, True),
              ('carry1_idle', '한 손 들고 서기', 5, True), ('carry1_walk', '한 손 들고 걷기', 10, True), ('carry1_run', '한 손 들고 달리기', 14, True)]),
    (G_MOVE, [('turn', '발끝으로 휙 돌아서기', 8, False), ('fall', '낙하(팔 휘저음)', 8, True), ('land', '발끝 착지', 10, False),
              ('ladder', '사다리(두 칸씩)', 10, True), ('mantle', '턱 짚고 휙 오르기', 8, False), ('vault', '스피드 볼트', 10, False),
              ('crawl', '덕트 기기', 10, True), ('sneak', '과장된 살금걸음', 8, True),
              ('idle_light', '손전등 들고 대기', 5, True), ('walk_light', '손전등 들고 걷기', 10, True), ('run_light', '손전등 들고 달리기', 14, True),
              ('lookback', '어깨 너머로 홱', 8, False), ('hide', '숨기(입 막고 웃음)', 5, True), ('door', '걸쇠를 튕겨 문 열기', 8, False),
              ('doorclose', '뒤로 문 닫으며 달림', 12, False), ('knock', '박자 노크', 8, False), ('push', '등으로 밀기', 8, True),
              ('inspect', '쪼그려 톡 건드리기', 6, False), ('leadhand', '손잡고 이끌기', 10, True), ('bow', '목례 + 경례', 8, False),
              ('elevwait', '승강기 대기(박자)', 4, True)]),
    (G_REST, [('floorsit', '털썩 양반다리', 8, False), ('floorrest', '바닥 휴식(손가락 풀기)', 4, True), ('hurtidle', '부상 대기(앞손 장전)', 4, True),
              ('limp', '절뚝 걷기', 8, True), ('fear', '공포(억지 미소)', 6, True), ('nausea', '구역질', 8, False),
              ('collapse', '쓰러짐(마지막 스냅)', 8, False), ('bedlie', '대자로 누움', 3, True), ('victory', '승리 경례', 8, False)]),
    (G_HQ, [('chairsit', '의자 거꾸로 앉기', 6, False), ('typing', '타자(APM)', 10, True), ('gearcheck', '손가락 얼음찜질', 5, True),
            ('tie', '넥타이 고쳐 매기', 8, False), ('seatrest', '깍지 끼고 기대기', 4, True), ('seatthink', '눈 감고 무릎 톡톡', 4, True),
            ('doze', '졸다가 스냅에 깸', 4, True), ('yawn', '하품', 5, False), ('stretch', '기지개', 8, False), ('hairflip', '앞머리 넘기기', 8, False),
            ('brushteeth', '양치', 8, True),
            ('undress', '탈의(GPT)', 6, False), ('showerturn', '샤워 돌아서기(GPT)', 8, False), ('shower', '샤워(GPT)', 8, True), ('bath', '목욕(GPT)', 4, True)]),
    (G_EMO, [('gesture', '손짓하며 말하기', 6, True), ('armscross', '팔짱 끼고 듣기', 4, True), ('nod', '세 번 끄덕', 10, False),
             ('headshake', '웃으며 고개 젓기', 8, False), ('wave', '머리 위로 손 흔들기', 10, False), ('handshake', '두 손 악수', 8, False),
             ('pat', '어깨 두드리고 가리킴', 8, False), ('point', '손가락 총', 8, False), ('shrug', '과장된 으쓱', 8, False), ('hug', '안기', 6, False),
             ('laugh', '고개 젖혀 웃기', 8, False), ('glad', '손가락 총 두 개', 8, False), ('cry', '울면서 웃기', 5, True),
             ('wallcry', '벽에 이마 대고 울기', 4, True), ('kneelcry', '무릎 꿇고 가슴 치기', 4, True), ('sad', '발끝으로 바닥 차기', 4, True),
             ('shout', '손 모아 외치기', 8, False), ('deskslam', '웃으며 책상 탁탁', 8, True), ('surprise', '움찔(반사 스냅)', 10, False),
             ('startlefall', '엉덩방아 항복', 8, False), ('plopdown', '대자로 드러눕기', 8, False), ('embarrassed', '뒷머리 긁기', 6, False),
             ('annoyed', '"알아 알아 그 대령"', 8, False), ('think', '관자놀이 톡톡', 4, True), ('bored', '소리 없는 스냅', 6, True)]),
]
for grp, rows in LIFE:
    for k, name, fps, loop in rows:
        DEFS.append(D(k, name, fps, loop=loop, group=grp))
for d in DEFS:
    if d['group'] == '전투·기본': d['group'] = '전투·기본 (쟈알디 계획안 1~41 자리 + 큐라스 고유)'
GPT = {'undress', 'showerturn', 'shower', 'bath'}
FW, FH, FOOT, ANCHOR = 192, 144, 136, 57


def frames_of(src):
    d = os.path.join(SRC, 'clips', src)
    if not os.path.isdir(d):
        return []
    return [Image.open(os.path.join(d, f)).convert('RGBA') for f in sorted(os.listdir(d)) if f.endswith('.png')]


def strip(frames):
    s = Image.new('RGBA', (FW * len(frames), FH), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        s.paste(f, (i * FW, 0))
    b = io.BytesIO(); s.save(b, 'PNG', optimize=True); return b.getvalue()


def foot_x(im):
    """바닥에 닿은 발(y≥130) 픽셀의 평균 x. 공중이면 None"""
    a = im.getchannel('A').load(); xs = [x for y in range(130, FH) for x in range(FW) if a[x, y] > 0]
    return sum(xs) / len(xs) if xs else None


def b64(p):
    return base64.b64encode(open(p, 'rb').read()).decode()


def main():
    manifest = {'agent': 'kyuras', 'frameW': FW, 'frameH': FH, 'foot': FOOT, 'anchor': ANCHOR, 'clips': {}}
    strips, missing, later = {}, [], []
    final = os.path.join(SRC, 'final'); os.makedirs(final, exist_ok=True)
    for d in DEFS:
        if d['key'] in kyuras_fixes.DROP_CLIPS:
            continue
        fr = frames_of(d['key'])
        idx = list(range(len(fr)))
        if fr:
            fr, idx = kyuras_fixes.apply(d['key'], fr, idx)
        if not fr:
            if d['group'].startswith('전투'): missing.append(d['key'])
            else: later.append(d['key'])   # 생활·사교·감정은 다음 차례(사용자 2026-10-22 03:17: 전투·이동 먼저)
            continue
        data = strip(fr)
        strips[d['key']] = base64.b64encode(data).decode()
        open(os.path.join(final, d['key'] + '.png'), 'wb').write(data)
        hits = [idx.index(h) for h in d['hits'] if h in idx]
        # 그림 안에서 실제로 움직인 거리와 설계 이동(adv)의 차이는 엔진이 클립 동안 고르게 밀어 줌(끝에서 한 번에 튀지 않게)
        slide = 0
        if d['adv']:
            f0, f1 = foot_x(fr[0]), foot_x(fr[-1])
            drawn = (f1 - f0) if f0 is not None and f1 is not None else 0
            slide = round(d['adv'] - drawn, 1)
        manifest['clips'][d['key']] = {k: d[k] for k in ('label', 'fps', 'loop', 'adv', 'origin', 'hold', 'group')} | {'hits': hits, 'slide': slide, 'frames': len(fr), 'bytes': len(data), 'prop': False}
        anc = None if d['key'] in GPT else kyuras_fixes.anchors(d['key'], idx)
        if anc: manifest['clips'][d['key']]['anchors'] = anc
    json.dump(manifest, open(os.path.join(final, 'manifest.json'), 'w'), ensure_ascii=False, indent=1)
    hands = {k: [[a['hand'][0], a['hand'][1], (a['angle'] + 90) % 360] for a in v['anchors']] for k, v in manifest['clips'].items() if v.get('anchors')}
    json.dump(hands, open(os.path.join(final, 'hands.json'), 'w'), separators=(',', ':'))
    manifest['missing'] = missing; manifest['later'] = later
    tpl = open(os.path.join(ROOT, 'tools', 'kyuras_full_template.html'), encoding='utf-8').read()
    html = (tpl.replace('__MANIFEST__', json.dumps(manifest, ensure_ascii=False)).replace('__STRIPS__', json.dumps(strips))
            .replace('__BG__', b64(BG)).replace('__JYALDI__', b64(JY)).replace('__BASEA__', b64(os.path.join(SRC, 'base', 'A.png'))))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, 'w', encoding='utf-8').write(html)
    print('wrote', OUT, len(html) // 1024, 'KB', 'clips', len(strips), 'missing', len(missing), missing, 'later', len(later))


if __name__ == '__main__':
    main()
