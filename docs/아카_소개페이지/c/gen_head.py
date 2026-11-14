# page.html 을 만든다. 인용문은 q() 를 거치며 원문(위키·첫 장면·세력표)에 그대로 있는지 대조한다.
import json, re, sys
from urllib.parse import quote

ROOT = '/home/user/goei-plugin/'
F = 'file://' + ROOT


def u(p):
    return F + quote(p)


# ---------- 원문 말뭉치 ----------
def norm(s):
    s = re.sub(r'<img=[^>]*>', '', s)
    s = re.sub(r'<[^>]+>', '', s)
    for m in ['✂️', '❗', '📌', '➡️', '**', '*']:
        s = s.replace(m, '')
    s = s.replace('&nbsp;', ' ').replace('“', '"').replace('”', '"')
    return re.sub(r'\s+', '', s)


wiki = json.load(open(ROOT + 'card/wiki-base.json'))
gr = json.load(open(ROOT + 'src/data/world/greetings.json'))
sc = json.load(open(ROOT + 'src/data/world/scenes.json'))
scn = json.load(open(ROOT + 'src/data/scenarios.json'))
CORPUS = norm(' '.join(wiki.values()) + ' '.join(gr['texts']) + json.dumps(sc, ensure_ascii=False).replace('\\n', ' ').replace('\\"', '"') + json.dumps(scn, ensure_ascii=False))
USED = []


def q(s):
    """원문에 그대로 있는 글만 통과."""
    if norm(s) not in CORPUS:
        sys.exit('원문에 없음: ' + s)
    USED.append(s)
    return s


def wk(s, em='em'):
    s = re.sub(r'✂️(.+?)✂️', r'<s>\1</s>', s)
    s = re.sub(r'❗(.+?)❗', r'<b class="%s">\1</b>' % em, s)
    return s


# ---------- 층 ----------
INK = '#1B130A'
CREAM = '#FFF0D2'
SAND = '#FFE6B8'
FL = {
    '1': ('#F2A413', INK), 'B-1': ('#F2A413', INK), 'B-2': ('#EE8312', INK), 'B-3': ('#E55A1C', INK),
    'B-4': ('#D2381E', CREAM), 'B-5': ('#A8221F', CREAM), 'B-6': ('#74192B', CREAM),
    'B-7': ('#3B1838', SAND), 'B-8': ('#16294A', SAND), 'B-9': ('#0F2140', SAND),
    'B-10': ('#0B1A33', SAND), 'B-11': ('#081426', SAND), 'B-12': ('#050D1A', SAND),
}
NAMES = [('1', '표지'), ('B-1', '세계'), ('B-2', '시작하는 자리'), ('B-3', '이면의 주민들'), ('B-4', '관리국'),
         ('B-5', '가짜 관리국'), ('B-6', '백일몽'), ('B-7', '괴이'), ('B-8', '세광 순환선'), ('B-9', '괴이'),
         ('B-10', '특수 장소'), ('B-11', '화면'), ('B-12', '받기')]
NAME = dict(NAMES)

out = []


def plate(name, fl, h, body, extra=''):
    bg, fg = FL[fl]
    out.append(f'<section class="plate" data-name="{name}" style="--bg:{bg};--fg:{fg};height:{h}px;{extra}">{body}</section>')


def mark(fl, nm=None, style=''):
    arrow = '' if fl == '1' else '▼'
    return f'<div class="mark" style="{style}"><span class="ind">{arrow}{fl}</span><span class="nm">{nm or NAME[fl]}</span></div>'


def kv(k, v, size=84, mb=44, em='em'):
    return f'<div class="kv" style="margin-bottom:{mb}px"><div class="k">{k}</div><div class="v" style="font-size:{size}px">{wk(q(v), em)}</div></div>'


G = 'background-color:rgba(0,0,0,0.004);'  # 다크모드 가드
SANS = "font-family:'Pretendard','Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif;"


def arca(fl, inner, pad='30px 4.65% 34px'):
    bg, fg = FL[fl]
    out.append(f'<div class="arca"><div style="background:linear-gradient({bg},{bg});{G}padding:{pad};{SANS}line-height:1.7;">{inner}</div></div>')


def awk(s, emc):
    s = re.sub(r'✂️(.+?)✂️', r'<s>\1</s>', s)
    s = re.sub(r'❗(.+?)❗', rf'<strong style="color:{emc};{G}">\1</strong>', s)
    return s


def aq(fl, text, src, size=19, emc=None, mb=22):
    """아카 조각의 인용: 큰 글 + 출처."""
    bg, fg = FL[fl]
    sub = 'rgba(27,19,10,0.72)' if fg == INK else 'rgba(255,240,210,0.66)'
    return (f'<div style="margin:0 0 {mb}px 0;"><div style="color:{fg};{G}font-size:{size}px;font-weight:800;line-height:1.5;letter-spacing:-0.01em;word-break:keep-all;">{awk(q(text), emc or fg)}</div>'
            f'<div style="color:{sub};{G}font-size:14px;margin-top:4px;word-break:keep-all;">{src}</div></div>')


def arow(fl, k, v, emc=None):
    """아카 조각의 정보상자 한 줄."""
    bg, fg = FL[fl]
    sub = 'rgba(27,19,10,0.72)' if fg == INK else 'rgba(255,240,210,0.66)'
    line = 'rgba(27,19,10,0.28)' if fg == INK else 'rgba(255,240,210,0.22)'
    return (f'<div style="border-top:1px solid {line};padding:10px 0 11px 0;"><div style="color:{sub};{G}font-size:14px;">{k}</div>'
            f'<div style="color:{fg};{G}font-size:18px;font-weight:800;line-height:1.45;word-break:keep-all;">{awk(q(v), emc or fg)}</div></div>')


def alabel(fl, t):
    bg, fg = FL[fl]
    return f'<div style="color:{fg};{G}font-size:15px;font-weight:800;margin:0 0 10px 0;word-break:keep-all;">{t}</div>'


def face(nm, w, h, size=None, y=0):
    size = size or int(w * 2.4)
    return f'<i class="face" style="width:{w}px;height:{h}px;background-image:url(\'{u("assets/agents/" + nm + "_default.avif")}\');background-size:{size}px auto;background-position:50% {y}px"></i>'


AN = 'assets/wiki/Anomalies/'
SI = 'assets/wiki/Situations/'
FA = 'assets/wiki/Factions/'
AG = 'assets/agents/'

