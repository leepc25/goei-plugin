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
    'B-4': ('#A5DACB', INK), 'B-5': ('#A8221F', SAND), 'B-6': ('#74192B', CREAM),
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


def flr(fl, style):
    bg, fg = FL[fl]
    c = 'rgba(27,19,10,0.13)' if fg == INK else 'rgba(255,176,0,0.16)'
    return f'<div class="flr" data-deco style="color:{c};{style}">{fl}</div>'


def lab(s):
    return s


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



def aflow(fl, items, emc=None):
    bg, fg = FL[fl]
    sub = 'rgba(27,19,10,0.72)' if fg == INK else 'rgba(255,240,210,0.62)'
    o = ''
    for k, v in items:
        o += (f'<div style="margin:0 0 14px 0;"><span style="color:{fg};{G}font-size:19px;font-weight:800;line-height:1.5;word-break:keep-all;">{awk(q(v), emc or fg)}</span>'
              f'<span style="color:{sub};{G}font-size:14px;word-break:keep-all;">&nbsp;&nbsp;{k}</span></div>')
    return o


# =====================================================================
# 1층 — 표지
# =====================================================================
plate('cover', '1', 1250, f'''
<div class="band" style="height:236px"><div class="title led">괴이<i class="jang"><b></b><b></b></i>ANOMALY</div><div class="led" style="position:absolute;right:44px;top:64px;font-size:112px;line-height:1">1</div></div>
<div class="leafline" style="left:508px;top:236px;height:1014px"></div>
<div class="gap px" style="left:530px;top:236px;width:296px;height:1014px;background-image:url('{u(AN + "Samangdan.avif")}');background-size:auto 1014px;background-position:56% 0"></div>
<div class="leafline" style="left:846px;top:236px;height:1014px"></div>
<div class="d" style="position:absolute;left:34px;top:290px;font-size:330px;line-height:1">{q("띵.")}</div>
<div class="d" style="position:absolute;left:40px;top:690px;font-size:104px;line-height:1.12">{q("1층입니다.")}</div>
<div class="d" style="position:absolute;left:40px;top:818px;font-size:74px;line-height:1.12">{q("문이 열립니다.")}</div>
<div class="src" style="position:absolute;left:42px;top:930px;width:440px">{q("차원 승강기의 첫 안내 방송")}</div>
<div style="position:absolute;left:42px;bottom:58px;font-size:38px;font-weight:700;line-height:1.3">RisuAI용<br>괴담 시뮬레이션 봇</div>
''')

arca('1', f'''
<div style="color:{INK};{G}font-size:18px;font-weight:600;line-height:1.75;word-break:keep-all;">{awk(q("야근을 마치고 낡은 사무실 건물 엘리베이터를 탔다. 버튼을 눌렀다. 문이 닫히고, 내려가는 느낌이 들고, \"띵\" 소리와 함께 문이 열렸다. 1층이다. 그런데 ❗로비가 아니다.❗ 비슷하게 생겼는데 어딘가 틀렸다. 뒤돌아 엘리베이터 패널을 보면 아까는 없던 숫자들이 빼곡하게 생겨나 있다."), "#8E1A0B")}</div>
<div style="color:rgba(27,19,10,0.72);{G}font-size:14px;margin-top:6px;">괴이위키 「차원 승강기」 개요</div>
''', pad='34px 4.65% 30px')

plate('shaft', '1', 1150, f'''
<div class="px" style="position:absolute;left:0;top:0;width:860px;height:600px;background-image:url('{u(AN + "Dimensional Elevator.avif")}');background-size:860px auto;background-position:0 38%"></div>
<div class="d" style="position:absolute;left:40px;top:650px;width:780px;font-size:78px;line-height:1.16;word-break:keep-all">{q("층마다 다른 세상이고,")}<br>{q("층마다 다른 규칙이 있다.")}</div>
<div class="src" style="position:absolute;left:42px;top:848px;width:780px">괴이위키 「차원 승강기」</div>
<div style="position:absolute;left:40px;top:950px;width:470px">{kv('층수', '세다가 포기함', 66, 0)}</div>
<div style="position:absolute;left:560px;top:950px;width:280px">{kv('최저 기록', 'B-12', 66, 0)}</div>
''')

# =====================================================================
# B-1 — 세계
# =====================================================================
plate('world', 'B-1', 1250, f'''
{flr('B-1', 'right:-30px;bottom:24px;font-size:210px')}
<div style="position:absolute;left:40px;top:70px;width:560px">
{kv('관리국 · 사내 분위기', '군대보다 회사', 90, 40)}
{kv('관리국 · 회식', '근처 파스타집', 90, 0)}
</div>
<div class="k" style="position:absolute;left:42px;top:480px">소라 랜드 · 재방문 후기</div>
<div class="d" style="position:absolute;left:20px;top:500px;font-size:470px;line-height:1.08;white-space:nowrap">{q("없음")}</div>
<div style="position:absolute;left:40px;top:1000px;width:780px">
<div class="kv"><div class="k">명일 아파트 · 엘리베이터</div><div class="v" style="font-size:66px">{q("있음, 버튼이 가끔")}<br>{q("하나 많음")}</div></div>
</div>
''')

plate('world2', 'B-1', 1190, f'''
<div class="px" style="position:absolute;left:0;top:0;width:860px;height:540px;background-image:url('{u(AN + "Bureau with the Lights Out.avif")}');background-size:860px auto;background-position:0 62%"></div>
<div class="k" style="position:absolute;left:42px;top:590px">불이 꺼진 관리국 · 공식 입장</div>
<div class="d" style="position:absolute;left:40px;top:640px;font-size:92px;line-height:1.12">{q("관리국의 불은")}<br>{q("꺼지지 않는다")}</div>
<div class="k" style="position:absolute;left:42px;top:890px">비공식 입장</div>
<div class="d" style="position:absolute;left:30px;top:920px;font-size:240px;line-height:1.08"><s style="opacity:1">{q("꺼진다")}</s></div>
''')

arca('B-1', alabel('B-1', '관리국 근무 수칙 · 첫 장면 「근무 수칙」에서')
     + ''.join(f'<div style="color:{INK};{G}font-size:17px;font-weight:700;line-height:1.6;margin:0 0 10px 0;word-break:keep-all;">{q(t)}</div>' for t in [
         '2. 이상현상에 대한 자료를 전자기기에 입력하지 마십시오. 이는 안전을 위한 것입니다.',
         '3. 식사 시간을 준수해 주십시오. 이는 안전을 위한 것입니다.',
         '7. 관리국의 불이 꺼지는 일은 없습니다. 불이 꺼졌다고 생각될 경우 그 무엇도 믿지 말고 당장 건물 바깥으로 탈출하십시오. 이는 안전을 위한 것입니다.'])
     + '<div style="height:14px;">&nbsp;</div>'
     + aq('B-1', '회사가 좋아서 다니는 사람 없어. 여기 아니면 못 구하는 게 있어서 다니는 거지. 그리고 그걸 회사도 알아.', '괴이위키 「백일몽」 · ' + q('어느 현장탐사팀 대리'), 21, mb=6), pad='30px 4.65% 40px')

# =====================================================================
# B-2 — 시작하는 자리
# =====================================================================
fs = {f['name']: f for f in scn['factions']}


def ftext(name, nsize, w, bsize=32, br=None):
    f = fs[name]
    titles = ' · '.join(q(s['label']) for s in f['scenarios'] if s['kind'] == 'opening')
    nm = q(name) if not br else br
    return (f'<div class="d" style="font-size:{nsize}px;line-height:1.08;margin-bottom:16px">{nm}</div>'
            f'<div style="font-size:{bsize}px;line-height:1.42;font-weight:500;word-break:keep-all;margin-bottom:18px">{q(f["blurb"])}</div>'
            f'<div style="font-size:{bsize}px;line-height:1.4;font-weight:800;word-break:keep-all"><span class="tag">첫 장면</span>{titles}</div>')


plate('start1', 'B-2', 1560, f'''
<div class="px" style="position:absolute;left:0;top:0;width:860px;height:500px;background-image:url('{u(FA + "Management Bureau.avif")}');background-size:860px auto;background-position:0 40%"></div>
{flr('B-2', 'right:-30px;top:470px;font-size:230px')}
<div style="position:absolute;left:40px;top:530px;width:780px">{ftext('관리국', 170, 780, 34)}</div>
<div class="gap px" style="left:560px;top:1040px;width:300px;height:520px;background-image:url('{u(FA + "Fake Management Bureau.avif")}');background-size:auto 520px;background-position:50% 0"></div>
<div style="position:absolute;left:40px;top:1050px;width:490px">{ftext('가짜 관리국', 84, 490)}</div>
''')
plate('start2', 'B-2', 1500, f'''
<div class="px" style="position:absolute;left:0;top:40px;width:400px;height:560px;background-image:url('{u(FA + "Baekilmong.avif")}');background-size:auto 560px;background-position:42% 0"></div>
<div style="position:absolute;left:440px;top:36px;width:390px">{ftext('백일몽 주식회사', 76, 390, br=q("백일몽") + "<br>" + q("주식회사"))}</div>
<div class="px" style="position:absolute;left:40px;top:690px;width:370px;height:300px;background-image:url('{u(FA + "Civilian.avif")}');background-size:370px auto;background-position:0 40%"></div>
<div style="position:absolute;left:40px;top:1014px;width:370px">{ftext('민간인', 84, 370)}</div>
<div class="px" style="position:absolute;left:450px;top:690px;width:410px;height:300px;background-image:url('{u(FA + "Freelancer.avif")}');background-size:410px auto;background-position:0 30%"></div>
<div style="position:absolute;left:450px;top:1014px;width:380px">{ftext('프리랜서', 84, 380)}</div>
''')

# =====================================================================
# B-3 — 이면의 주민들
# =====================================================================
def pcell(fn, x, y, w, h, sz=None, oy=-8):
    sz = sz or int(w * 1.88)
    return f'''<div class="gap" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;background-color:#1B130A;background-image:url('{u(AG + fn + "_default.avif")}');background-size:{sz}px auto;background-position:50% {oy}px"></div>'''


def who(nm, org, title, x, y, w):
    return (f'<div style="position:absolute;left:{x}px;top:{y}px;width:{w}px"><div class="d" style="font-size:46px;line-height:1.15">{nm}</div>'
            f'<div style="font-size:32px;line-height:1.3;font-weight:500;opacity:.8;word-break:keep-all">{org}</div>'
            f'<div style="font-size:32px;line-height:1.3;font-weight:800;word-break:keep-all;margin-top:6px"><span class="tag">첫 장면</span>{q(title)}</div></div>')


plate('residents', 'B-3', 1130, f'''
{flr('B-3', 'right:-30px;bottom:20px;font-size:210px')}
<div class="d" style="position:absolute;left:40px;top:60px;font-size:100px;line-height:1.05">{lab("이면의 주민들")}</div>
<div class="src" style="position:absolute;left:42px;top:186px">13명 · 그 인물로 시작하는 첫 장면</div>
{pcell('Aestheticism', 40, 290, 410, 600, 1150, -70)}
<div class="d" style="position:absolute;left:490px;top:300px;width:340px;font-size:112px;line-height:1.1">{q("멀리<br>못 갔네,<br>응?")}</div>
<div class="src" style="position:absolute;left:492px;top:700px;width:340px">{q("쫓기던 생환자에게")}</div>
{who('탐미주의', q('없음. 혼자서 하나의 세력'), '넌 내 최고의 작품이야', 40, 910, 780)}
''')

plate('residents_b', 'B-3', 1010, f'''
{pcell('Blaret', 40, 30, 270, 400)}
<div class="d" style="position:absolute;left:350px;top:24px;width:480px;font-size:52px;line-height:1.22;word-break:keep-all">{q("어때요? 그 이슬람 같은 거 그만두고 우리 쪽으로 개종하는 거.")}</div>
<div class="src" style="position:absolute;left:352px;top:232px;width:470px">{q("대화 몇 번에 한 번꼴로")}</div>
{who('블라렛', q('교황청'), '이교도와 수녀', 350, 290, 470)}
{pcell('Saladin', 550, 530, 270, 400)}
<div class="d" style="position:absolute;left:40px;top:524px;width:480px;font-size:52px;line-height:1.22;word-break:keep-all">{q("형제여! 이교도의 말에 귀를 기울이지 마시오!")}</div>
<div class="src" style="position:absolute;left:42px;top:670px;width:470px">{q("블라렛의 개종 권유에 끼어들며")}</div>
{who('살라딘', q('이슬람 성전 십자군'), '여기서 불타리라', 40, 770, 480)}
''')

plate('residents_c', 'B-3', 800, f'''
{pcell('Avensha', 40, 30, 236, 350)}{who('아벤샤', q('발푸르기스 협회, 십마녀'), '마녀의 산책', 40, 392, 240)}
{pcell('Secriem', 312, 100, 236, 350)}{who('세크리엠', q('흡혈귀, 진조 혈통'), '갇힌 여자', 312, 462, 240)}
{pcell('Brownie', 584, 170, 236, 350)}{who('브라우니', q('없음, 독립 괴이'), '화요일의 즐거움, 화요일의 열기', 584, 532, 250)}
''')

plate('residents2', 'B-3', 1400, f'''
<div class="d" style="position:absolute;left:40px;top:40px;font-size:60px">{q("특수재난대응협회")}</div>
<div style="position:absolute;left:0;top:130px;width:478px;height:582px;overflow:hidden"><img src="{u(AG + "Cha Yeo-jin_default.avif")}" style="position:absolute;left:-75px;top:10px;height:640px">
<img src="{u(AG + "Seo Yun-ji_default.avif")}" style="position:absolute;left:105px;top:10px;height:640px"></div>
<div class="d" style="position:absolute;left:490px;top:150px;width:340px;font-size:58px;line-height:1.2;word-break:keep-all">{q("재량은 오류가 기록에 들어오는 경로입니다.")}</div>
<div class="src" style="position:absolute;left:492px;top:444px;width:330px">서윤지 · {q("재량을 쓰라는")}<br>{q("지시에")}</div>
<div style="position:absolute;left:492px;top:556px;width:340px;font-size:32px;line-height:1.34;font-weight:800"><span class="tag">첫 장면</span><br>{q("특별한 의뢰")} · {q("녹음기")}</div>
<div class="rule" style="top:712px"></div>
<div class="d" style="position:absolute;left:40px;top:744px;font-size:60px">{q("중림 지하상가")}</div>
<div class="d" style="position:absolute;left:40px;top:836px;width:780px;font-size:60px;line-height:1.2;word-break:keep-all">{q("울려면 밖에서 울어.")}<br>{q("눈물 때문에 책상 녹슬어.")}</div>
<div class="src" style="position:absolute;left:42px;top:992px;width:780px">신유리 · {q("우는 손님에게")}</div>
''' + ''.join(f'<img src="{u(AG + n + "_default.avif")}" style="position:absolute;left:{-40 + i * 152}px;top:1050px;height:500px">' for i, n in enumerate(['Go Yeon-ji', 'Yun Ji-a', 'Ma Deok-hee', 'Mun Hye-ran', 'Shin Yuri']))
      + '<div style="position:absolute;left:0;bottom:0;width:860px;height:62px;background:#1B130A"></div>'
      + ''.join(f'<div style="position:absolute;left:{55 + i * 152}px;bottom:10px;width:152px;text-align:center;font-size:32px;font-weight:700;color:#FFF0D2">{n}</div>' for i, n in enumerate(['고연지', '윤지아', '마덕희', '문혜란', '신유리'])))

t = alabel('B-3', '중림 지하상가 · 그 인물로 시작하는 첫 장면')
for nm, lb in [('고연지', '선불입니다'), ('윤지아', '야간 접수'), ('마덕희', '도금이에요, 자기야'), ('문혜란', '사인 먼저, 밥은 나중에'), ('신유리', '십. 퍼센트. 매주.')]:
    t += (f'<span style="display:inline-block;margin:0 18px 6px 0;"><span style="color:rgba(27,19,10,0.75);{G}font-size:15px;">{nm}&nbsp;</span>'
          f'<span style="color:{INK};{G}font-size:17px;font-weight:800;">{q(lb)}</span></span>')
arca('B-3', t, pad='24px 4.65% 40px')

# =====================================================================
# B-4 — 관리국 (불이 켜진 층)
# =====================================================================
def fc(fn, ko, x, y, w, h, sub='', dark='#1B130A', px='50%'):
    sz = int(w * 2.32)
    s = f'<div style="font-size:30px;line-height:1.15;font-weight:500;opacity:.8">{sub}</div>' if sub else ''
    return (f'<i class="face" style="position:absolute;left:{x}px;top:{y}px;width:{w}px;height:{h}px;background-color:{dark};background-image:url(\'{u(AG + fn + "_default.avif")}\');background-size:{sz}px auto;background-position:{px} 0"></i>'
            f'<div style="position:absolute;left:{x}px;top:{y + h + 6}px;width:{w + 8}px;font-size:32px;line-height:1.2;font-weight:800;white-space:nowrap">{ko}{s}</div>')


plate('bureau', 'B-4', 1200, f'''
{flr('B-4', 'left:24px;bottom:-40px;font-size:250px')}
<div class="d" style="position:absolute;left:40px;top:50px;font-size:60px">{q("관리국")}</div>
<img src="{u(AG + "Geshugan_default.avif")}" style="position:absolute;right:-230px;top:150px;height:1240px">
<div class="d" style="position:absolute;left:34px;top:170px;font-size:270px;line-height:1.04">{q("그래.<br>미안.")}</div>
<div class="src" style="position:absolute;left:42px;top:752px;width:330px">게슈간 · {q("팀원을 죽인 일에 대한 완전한 사과")}</div>
<div class="d" style="position:absolute;left:40px;top:904px;font-size:76px;line-height:1.1">{q("알았어. 미안.")}</div>
<div class="src" style="position:absolute;left:42px;top:1004px;width:330px">{q("위 사과의 긴 버전")}</div>
''')

t1 = [('Jyaldi', '쟈알디'), ('Spangdal', '스팡달'), ('Jaemtri', '잼트리'), ('Aileen', '에일린'), ('Deadpole', '데드폴'), ('Geshugan', '게슈간'), ('Rojemon', '로제몬'), ('Konjyuce', '콘쥬스')]
exps = ['annoyed', 'smug', 'pouting', 'scared', 'laughing', 'bored']
b2 = f'<div class="k" style="position:absolute;left:42px;top:34px;font-weight:800">{q("종합대응팀")}</div>'
for i, (fn, ko) in enumerate(t1):
    b2 += fc(fn, ko, 40 + (i % 4) * 198, 90 + (i // 4) * 270, 186, 206)
b2 += f'<div class="k" style="position:absolute;left:42px;top:650px;font-weight:800">{q("진압팀")}</div><div class="k" style="position:absolute;left:438px;top:650px;font-weight:800">{q("격리팀")}</div>'
for i, (fn, ko) in enumerate([('Kyuras', '큐라스'), ('Gorgodio', '고르고디오'), ('Gognija', '고그니쟈'), ('Dejure', '데쥬레')]):
    b2 += fc(fn, ko, 40 + i * 198, 706, 186, 206)
plate('bureau2', 'B-4', 990, b2)
plate('bureau3', 'B-4', 690, f'''
<div class="d" style="position:absolute;left:40px;top:20px;width:780px;font-size:118px;line-height:1.1;word-break:keep-all">{q("현장 출동이면<br>난 안 가.")}</div>
<div class="src" style="position:absolute;left:42px;top:292px;width:780px">로제몬 · {q("공식 기록, 이후 출동함")}</div>
<div class="faces" style="top:370px">{''.join(f'<i class="face" style="width:143.33px;height:210px;background-image:url(&quot;{u("assets/portraits/Rojemon/Rojemon_" + e + ".avif")}&quot;);background-size:360px auto;background-position:50% -6px"></i>' for e in exps)}</div>
<div class="src" style="position:absolute;left:42px;top:604px">인물마다 표정 41종</div>
''')

arca('B-4', aq('B-4', '하아. 잼트리. 이것 좀 어떻게 해 봐.', '쟈알디 · ' + q('사무실에서 하루 평균 n회'))
     + aq('B-4', '가다가 죽지 마. 시신 회수 귀찮아.', '에일린 · ' + q('떠나는 사람에게'))
     + aq('B-4', '아, 그건 비상 탈출 장치라네!', '고그니쟈 · ' + q('지하 연구실의 창문에 대해'))
     + aq('B-4', '여기서 제가 한 번 죽으면 시간이 벌리니까요.', '데드폴 · ' + q('작전 회의, 아무렇지 않게'), mb=4), pad='26px 4.65% 40px')

# =====================================================================
# B-5 — 가짜 관리국
# =====================================================================
plate('fake', 'B-5', 1200, f'''
<div class="d" style="position:absolute;left:40px;top:50px;font-size:60px">{q("가짜 관리국")}</div>
{flr('B-5', 'right:30px;top:40px;font-size:100px')}
<div style="position:absolute;right:0;top:140px;width:440px;height:1060px;overflow:hidden"><img src="{u(AG + "Go Young-hoon_default.avif")}" style="position:absolute;left:-150px;top:0;height:1240px"></div>
<div class="d" style="position:absolute;left:30px;top:150px;font-size:236px;line-height:1.02">{q("정지.")}<br>{q("정지.")}<br>{q("정지.")}</div>
<div class="src" style="position:absolute;left:42px;top:890px;width:460px">{q("고영훈 어록의 약 40%")}</div>
<div style="position:absolute;left:40px;top:1000px;width:420px"><div class="kv"><div class="k">평균 발화 길이</div><div class="v" style="font-size:62px">{q("세 단어")}<br><s>{q("네 단어면 긴 연설")}</s></div></div></div>
''')
rows = [('사장 · 국장실 · 신입 교육 · 심문', [('Sa-jang', '사장'), ('Do Pil-heon', '도필헌'), ('Lee Gil-hwan', '이길환'), ('Lee Gi-seok', '이기석'), ('Kim Jo-hak', '김조학')]),
        (q('검사부대'), [('Lee Do-hyeong', '이도형'), ('Go Young-hoon', '고영훈'), ('No Gi-gyun', '노기균'), ('Song Ju-ik', '송주익')]),
        (q('진압부대'), [('Kwak Seong-ju', '곽성주'), ('Cho Seong-choon', '조성춘'), ('Yun Byeong-su', '윤병수'), ('Kim Seong-jin', '김성진'), ('Song Jin-seob', '송진섭')])]
f2 = ''
for r, (lab, ps) in enumerate(rows):
    y = 30 + r * 300
    f2 += f'<div class="k" style="position:absolute;left:42px;top:{y}px;font-weight:800">{lab}</div>'
    for i, (fn, ko) in enumerate(ps):
        f2 += fc(fn, ko, 40 + i * 158, y + 54, 148, 170, px='88%' if fn == 'Lee Do-hyeong' else '50%')
f2 += f'''<div style="position:absolute;right:-40px;top:900px;width:520px;height:640px;overflow:hidden"><img src="{u(AG + "Lee Do-hyeong_default.avif")}" style="position:absolute;left:-90px;top:0;height:1020px"></div>
<div class="d" style="position:absolute;left:30px;top:960px;font-size:200px;line-height:1.04">{q("들어가.")}</div>
<div class="src" style="position:absolute;left:42px;top:1200px;width:360px">이도형 · {q("턱짓과 함께, 작전 개시 명령의 전문(全文)")}</div>'''
plate('fake2', 'B-5', 1540, f2)
arca('B-5', aq('B-5', '넌 이미 진실을 알아 버렸어. 요원이 되는 것 말고는 남은 선택지가 없어. 대학은 왜 가? 좋은 직장 가려고 가는 거잖아. 축하해, 취직했어. 요원으로.', '김조학 · ' + q('영입 권유의 마무리'))
     + aq('B-5', 'UI 말입니다. 개선할 점이 있으면 말씀해 주세요.', '사장 · ' + q('업무 피드백처럼 생긴 질문'))
     + aq('B-5', '내가 때려잡은 괴이들을 한 줄로 세우면 지구를 한 바퀴 돈다.', '조성춘 · ' + q('회식 자리, 매번'))
     + aflow('B-5', [('자칭', '관리국 ✂️본인들 기준 진짜✂️'), ('모집 방식', '❗납치❗')], '#FFC53D'), pad='26px 4.65% 40px')

# =====================================================================
# B-6 — 백일몽
# =====================================================================
plate('dream', 'B-6', 1012, f'''
{flr('B-6', 'left:260px;top:40px;font-size:100px')}
<div class="d" style="position:absolute;left:40px;top:50px;font-size:60px">{q("백일몽")}</div>
<div style="position:absolute;right:0;top:110px;width:400px;height:890px;overflow:hidden"><img src="{u(AG + "Lee Seong-hae_default.avif")}" style="position:absolute;left:-190px;top:0;height:1160px"></div>
<div class="d" style="position:absolute;left:40px;top:160px;width:470px;font-size:80px;line-height:1.16;word-break:keep-all">{q("이런 건 저처럼 스트레스 안 받는 사람이 해야 돼여.")}</div>
<div class="src" style="position:absolute;left:42px;top:556px;width:420px">이성해 · {q("처형 임무를 맡으며")}</div>
<div style="position:absolute;left:40px;top:680px;width:480px">
{kv('퇴사', '부서에 따라 불가능 ✂️평생직장 실현✂️', 62, 0, 'plain')}
</div>
''')
d2 = f'<div class="k" style="position:absolute;left:42px;top:30px;font-weight:800">{q("백일몽 주식회사")}</div><div class="k" style="position:absolute;left:546px;top:30px;font-weight:800">{q("연구1팀")}</div>'
for i, (fn, ko) in enumerate([('Cheong Dal-lae', '청달래'), ('Ho Yu-won', '호유원'), ('Lee Byeong-jin', '이병진')]):
    d2 += fc(fn, ko, 40 + i * 158, 84, 148, 170)
for i, (fn, ko) in enumerate([('Kwak Je-gang', '곽제강'), ('Lee Yeon-hwa', '이연화')]):
    d2 += fc(fn, ko, 544 + i * 158, 84, 148, 170)
d2 += f'<div class="k" style="position:absolute;left:42px;top:340px;font-weight:800">{q("현장탐사팀")}</div>'
tm = [('Baek Seok-ju', '백석주', 'A조'), ('Jin Na-sol', '진나솔', 'A조'), ('Lee Seong-hae', '이성해', 'B조'), ('Lee Ja-heon', '이자헌', 'D조'), ('Eun Ha-je', '은하제', 'D조'),
      ('Park Min-seong', '박민성', 'D조'), ('Baek Sa-heon', '백사헌', 'F조'), ('Go Young-eun', '고영은', 'R조'), ('Kang I-hak', '강이학', 'I조'), ('Jang Heo-un', '장허운', 'Y조')]
for i, (fn, ko, jo) in enumerate(tm):
    d2 += fc(fn, ko, 40 + (i % 5) * 158, 394 + (i // 5) * 290, 148, 170, jo)
d2 += f'<div class="k" style="position:absolute;left:42px;top:990px;font-weight:800">{q("보안관리부")}</div>'
d2 += fc('Jay', '제이', 40, 1044, 186, 220)
d2 += f'''<div class="d" style="position:absolute;left:270px;top:1036px;width:560px;font-size:46px;line-height:1.28;word-break:keep-all">{q("도넛을 좋아하는데… 회사까지 배달해 주는 데가 없고… 낮에는 나갈 수가 없어서……")}</div>
<div class="src" style="position:absolute;left:272px;top:1232px;width:540px">{q("좋아하는 것을 묻자")}</div>'''
plate('dream2', 'B-6', 1350, d2)
arca('B-6', aq('B-6', '이 부서는 다들 1년쯤 되면 주임 달아. 너도 곧 달 거야. 그 전에 죽을 수도 있지만.', '박민성 · ' + q('박민성, 해맑게').replace('박민성, ', ''))
     + aflow('B-6', [('진나솔 · 좋아하는 것', '포인트, 정시 퇴근, 조용함 ✂️셋 다 회사에 없다✂️'), ('은하제 · 퇴사 선언 횟수', '측정 불가 ✂️퇴사는 0회✂️'), ('백일몽 본사 · 출입', '사원증 ✂️그리고 살아 있을 것✂️')], '#FFC53D'), pad='26px 4.65% 40px')

# =====================================================================
# B-7 — 괴이
# =====================================================================
plate('anom', 'B-7', 1560, f'''
{flr('B-7', 'right:-30px;top:-34px;font-size:220px')}
<div class="led" style="position:absolute;left:40px;top:150px;width:780px;font-size:64px;line-height:1.3;word-break:keep-all">{q("이번 역은, 슬픔, 슬픔역입니다. 내리실 문은 오른쪽입니다.")}</div>
<div class="src" style="position:absolute;left:42px;top:420px;width:780px">{q("심연교통공사 열차 안내 방송. 목소리가 지나치게 평온하다")}</div>
<div class="px" style="position:absolute;left:0;top:540px;width:860px;height:620px;background-image:url('{u(AN + "Abyss Transit Authority.avif")}');background-size:860px auto;background-position:0 30%"></div>
<div style="position:absolute;left:40px;top:1204px;width:780px">
<div class="kv" style="margin-bottom:34px"><div class="k">심연교통공사 · 탑승 방법</div><div class="v" style="font-size:66px">{q("졸면 된다")}<br><s>{q("수도권 시민 대부분 해당")}</s></div></div>
<div class="k">정차역</div><div class="led" style="font-size:44px;line-height:1.3">{q("슬픔, 원한, 황홀, 분노, 증오…")}</div>
</div>
''')
arca('B-7', aq('B-7', '지금부터 역내 고객 여러분을 도려내기 시작하겠습니다. 이용에 불편을 드려 죄송합니다.', '원숭이 꿈 괴담 · ' + q('차장의 안내 방송. 생환자 다수가 거의 같은 문장으로 기억한다'))
     + aq('B-7', '관객 여러분께 안내 말씀 드립니다. 지금부터 일부 관객분들께서는 붉은 숙녀와 함께하시게 됩니다. 남은 관객 여러분께서는 2막을 즐겨 주시기 바랍니다.', '뮤지컬 붉은 숙녀 · ' + q('인터미션 안내 방송'))
     + aq('B-7', '이거 보는 사람 있으면 우리 엄마한테 나 우유 사러 나왔다가 늦는 거라고 전해 줘. 아직 늦는 중이라고.', '룩키마트 · ' + q('영수증 뒷면 메모. 날짜 칸은 이십 년 전이었다'), mb=4), pad='26px 4.65% 40px')

# =====================================================================
# B-8 — 세광 순환선
# =====================================================================
st = [('세광역', 'Segwang Station', '임종의 숲길'), ('자정역', 'Midnight Station', '신체 카지노'), ('한밤역', 'Deep Night Station', '한빛도서관'),
      ('황혼역', 'Dusk Station', '양심판매대'), ('오후역', 'Afternoon Station', '혈액 방송국'), ('한낮역', 'Midday Station', '낮잠용 쉼터'), ('아침역', 'Morning Station', '저울 재판소')]
slits = ''
for i, (nm, fn, sub) in enumerate(st):
    x = 40 + i * 113.3
    slits += f'''<div class="gap px" style="left:{x}px;top:170px;width:100px;height:600px;background-image:url('{u(AN + fn + ".avif")}');background-size:auto 600px;background-position:50% 0"></div>
<div style="position:absolute;left:{x - 6}px;top:782px;width:112px;font-size:32px;font-weight:800;text-align:center;white-space:nowrap">{q(nm)}</div>'''
plate('loop', 'B-8', 1470, f'''
<div class="d" style="position:absolute;left:40px;top:50px;font-size:76px;line-height:1">{q("세광 순환선")}</div>
{flr('B-8', 'right:30px;top:36px;font-size:100px')}
{slits}
<div class="d" style="position:absolute;left:40px;top:880px;width:780px;font-size:66px;line-height:1.2;word-break:keep-all">{q("엄마 밥 냄새가 났어. 진짜로. 된장찌개. 우리 엄마는 세광에 산 적도 없는데.")}</div>
<div class="src" style="position:absolute;left:42px;top:1140px;width:780px">{q("한낮역 생환자, 익명 게시판")}</div>
<div style="position:absolute;left:40px;top:1236px;width:780px">
<div class="kv"><div class="k">세광특별시 · 인구</div><div class="v" style="font-size:54px">{q("재난 이전 수십만,")}<br>{q("현재 약 25명 + 기타")} <s>{q("기타가 더 많다")}</s></div></div>
</div>
''')
extra = {'세광역': ('현재 수용 인원', '세지 마라'), '자정역': ('영업시간', '24시간 ✂️정확히는 영원히✂️'), '한밤역': ('입장료', '❗무료❗ ✂️진짜다, 그래서 더 무섭다✂️'),
         '황혼역': ('결제 방식', '양심껏'), '오후역': ('월세', '피로 받음 ✂️전세 사기는 없다, 대신 전혈 사기가 있다✂️'), '한낮역': ('현재 시각', '❗정오❗ ✂️몇 년째✂️'), '아침역': ('변호인', '✂️국선은 없다✂️')}
t = alabel('B-8', q('7개 역 순환선 (내선만 운행)'))
for nm, fn, sub in st:
    k, v = extra[nm]
    t += (f'<div style="border-top:1px solid rgba(255,230,184,0.22);padding:9px 0 10px 0;"><div style="color:{SAND};{G}font-size:17px;font-weight:800;">{nm} <span style="color:rgba(255,230,184,0.66);{G}font-size:14px;font-weight:400;">부역명 {q(sub)}</span></div>'
          f'<div style="color:rgba(255,230,184,0.9);{G}font-size:15px;word-break:keep-all;">{k} — {awk(q(v), "#FFB000")}</div></div>')
arca('B-8', t, pad='22px 4.65% 40px')

# =====================================================================
# B-9 — 괴이 63곳
# =====================================================================
def tile(fn, x, y, w, h, pos='50% 50%'):
    return f'<i class="px" style="position:absolute;left:{x}px;top:{y}px;width:{w}px;height:{h}px;background-image:url(&quot;{u(AN + fn + ".avif")}&quot;);background-size:cover;background-position:{pos}"></i>'


plate('anom2', 'B-9', 1390, f'''
{flr('B-9', 'right:-20px;top:10px;font-size:170px')}
<div class="d" style="position:absolute;left:40px;top:50px;font-size:120px;line-height:1">괴이 63곳</div>
{tile('Sora Land', 0, 220, 860, 560, '50% 62%')}
<div class="d" style="position:absolute;left:40px;top:796px;font-size:46px">{q("소라 랜드")}</div>
{tile('Lookymart', 0, 890, 425, 425)}{tile('Tuesday Quiz Show', 435, 890, 425, 425)}
<div class="d" style="position:absolute;left:40px;top:1328px;font-size:40px">{q("룩키마트")}</div>
<div class="d" style="position:absolute;left:475px;top:1328px;font-size:40px">{q("화요퀴즈쇼")}</div>
''')
named = [('Myeongil Apartment', '명일 아파트'), ('Forbidden Video', '금지된 비디오'), ('Hungry Hangman', '헝그리 행맨'), ('Monkey Dream', '원숭이 꿈 괴담'),
         ('Jogyesa', '조계사'), ('Dreamsception', '몽중몽'), ('Yu-gye Station', '유계역'), ("Saint's City", '성자의 도시')]
a3 = ''
for i, (fn, ko) in enumerate(named):
    x, y = (i % 4) * 217, 20 + (i // 4) * 270
    a3 += tile(fn, x, y, 209, 209) + f'<div style="position:absolute;left:{x + 6}px;top:{y + 214}px;width:212px;font-size:30px;font-weight:700;white-space:nowrap;letter-spacing:-0.04em">{q(ko)}</div>'
tiny = ['Cheongak Mary Hospital', 'Dream and Hope Theater', 'Frost Waterpark', "Red Lady's Musical Theater", 'Jisan Village Festival', 'Yukoae Theme Park',
        'Flower Golden Resort', 'Cosmic Fantasy Zoo', 'Hotel Inspiration', 'Fairytale Park', 'Sotos Department Store', 'Mystery World Adventure Park']
for i, fn in enumerate(tiny):
    a3 += tile(fn, i * 71.67, 580, 71.67, 150)
a3 += f'''<div style="position:absolute;left:40px;top:780px;width:780px">
<div class="kv"><div class="k">금지된 비디오 · 러닝타임</div><div class="v" style="font-size:76px">{q("끝까지 본 사람이")}<br>{q("없음")}</div></div></div>'''
plate('anom3', 'B-9', 1030, a3)
arca('B-9', aflow('B-9', [('소라 랜드 · 마스코트', '많음, 다들 어딘가 하나씩 없음'), ('인류의 신비전 · 관람료', '있음 ✂️본인이 내는 건 아님✂️'),
                         ('강변 · 위치', '서울을 가로지르는 그 강 ✂️한강이라고 하면 서울시가 싫어한다✂️'), ('룩키마트 · 층수', '지하 1층, 지상 3층, ❗없는 4층❗'),
                         ('뮤지컬 붉은 숙녀 · 예매', '매진, 매번 ✂️취소표도 매진✂️'), ('미스테리 월드 어드벤쳐 파크 · 입장 방법', '❗정문에서 표를 산다❗ ✂️그게 제일 무섭다✂️'),
                         ('소토스 백화점 · 계산대', '없음 ✂️궁금해하지 마라✂️')], '#FFB000'), pad='22px 4.65% 40px')

# =====================================================================
# B-10 — 특수 장소
# =====================================================================
MS = 'assets/wiki/Mystic Sites/'
vend = [('결제 수단', '❗신체 부위만❗'), ('환불', '없음'), ('취소', '없음'), ('흥정', '없음')]
vr = ''.join(f'<div class="vrow"><span class="k">{k}</span><span class="v d">{wk(q(v), "plain")}</span></div>' for k, v in vend)
vr += f'<div class="vrow"><span class="k">이름값</span><span class="v d">{wk(q("❗못 한다❗"), "plain")}</span><span class="k" style="margin-top:6px">{q("(무엇이든은 아님)")}</span></div>'
plate('sites', 'B-10', 1420, f'''
{flr('B-10', 'right:30px;bottom:30px;font-size:120px')}
<div class="gap px" style="left:40px;top:60px;width:300px;height:900px;background-image:url('{u(MS + "Anything Vending Machine.avif")}');background-size:auto 900px;background-position:50% 0"></div>
<div class="d" style="position:absolute;left:380px;top:54px;font-size:56px">{q("무엇이든 자판기")}</div>
<div style="position:absolute;left:380px;top:150px;width:440px">{vr}</div>
<div class="led" style="position:absolute;left:40px;top:1010px;width:780px;font-size:54px;line-height:1.32;word-break:keep-all">{q("딩동댕~ 구매해 주셔서 감사합니다! 오늘도 행복한 하루 되세요!")}</div>
<div class="src" style="position:absolute;left:42px;top:1240px;width:520px">{q("생환자들이 공통으로 기억하는 결제 완료 멘트")}</div>
''')
arca('B-10', alabel('B-10', '특수 장소 11곳')
     + aflow('B-10', [('이정 책방 · 주인', '❗오른손만 보인다❗'), ('도깨비 공방 · 애프터서비스', '❗판매 후 추적까지 해 준다❗ ✂️원치 않아도✂️'),
                          ('우주 쇼핑몰 · 결제', '현금, 신용카드, 체크카드 ✂️할부는 물어본 사람이 없다✂️'), ('얼굴 없는 장터 · 주소', '❗모든 맨홀❗ ✂️도로명 주소 미지원✂️'),
                          ('여우상담실 · 상담료', '대개 무료 ✂️대개✂️')], '#FFB000'), pad='22px 4.65% 40px')

# =====================================================================
# B-11 — 화면
# =====================================================================
SC = '.scratch/arca/kit/screens/'


def shot(path, x, y, w, h, bw, bx=0, by=0, cls=''):
    return f'<div class="shot {cls}" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;background-image:url(\'{u(SC + path)}\');background-size:{bw}px auto;background-position:{-bx}px {-by}px"></div>'


plate('screens', 'B-11', 840, f'''
{flr('B-11', 'left:40px;top:60px;font-size:96px')}
{shot("promo/phone-play-03-map.png", 270, 60, 590, 720, 640, 0, 82)}
<div class="d" style="position:absolute;left:40px;top:330px;font-size:104px;line-height:1">임무</div>
<div style="position:absolute;left:42px;top:460px;width:210px;font-size:34px;font-weight:600;line-height:1.4;word-break:keep-all">지도에서 장소를 골라 요원 넷을 편성해 출동</div>
''')
plate('screens2', 'B-11', 1060, f'''
{shot("promo/phone-play-04-phone.png", 0, 40, 580, 960, 660, 0, 150)}
<div class="d" style="position:absolute;left:616px;top:80px;font-size:76px;line-height:1">괴담톡</div>
<div style="position:absolute;left:618px;top:186px;width:210px;font-size:34px;font-weight:600;line-height:1.4;word-break:keep-all">연락처<br>대화<br>공지<br>전화<br>단톡</div>
''')
plate('screens3', 'B-11', 950, f'''
{shot("s-hs/pc_1_와이드.png", 0, 20, 860, 700, 3078, 920, 520, 'px')}
<div class="d" style="position:absolute;left:40px;top:752px;font-size:110px;line-height:1">망상홈쇼핑</div>
<div class="src" style="position:absolute;left:42px;top:876px">인터넷 안의 생방송</div>
''')
plate('screens4', 'B-11', 1420, f'''
{shot("promo/phone-play-05-net.png", 40, 40, 380, 560, 425, 0, 110)}
{shot("s-wiki/phone-01-home.png", 440, 40, 420, 560, 425, 0, 110)}
<div class="d" style="position:absolute;left:40px;top:640px;font-size:96px;line-height:1">인터넷</div>
<div style="position:absolute;left:42px;top:756px;width:780px;font-size:34px;font-weight:600;line-height:1.45;word-break:keep-all">괴담넷 · 괴담 갤러리 · 세정게 · 연어 마켓 · 우주 쇼핑몰 · 괴이위키 · 백일몽 포인트몰 · 망상홈쇼핑</div>
{shot("promo/pc-play-02-board.png", 40, 950, 820, 190, 1792, 483, 890)}
<div class="d" style="position:absolute;left:40px;top:1176px;font-size:96px;line-height:1">상황판</div>
<div class="src" style="position:absolute;left:42px;top:1290px;width:780px">요원 화면, 지금 벌어진 괴이 · 사건 · 특수 상황</div>
''')
t = ''
for k, v in [('소지품', '무기 2칸 · 장비 4칸 장착, 가계부'), ('기록', '일지 · 연대기 · 인물 · 세력'), ('언어', '한국어 · English')]:
    t += (f'<div style="padding:4px 0 6px 0;"><span style="display:inline-block;width:76px;color:#FFB000;{G}font-size:17px;font-weight:800;vertical-align:top;">{k}</span>'
          f'<span style="display:inline-block;width:72%;color:{SAND};{G}font-size:17px;word-break:keep-all;vertical-align:top;">{v}</span></div>')
arca('B-11', t, pad='22px 4.65% 40px')

# =====================================================================
# B-12 — 받기
# =====================================================================
plate('get', 'B-12', 1110, f'''
<div class="px" style="position:absolute;left:0;top:0;width:860px;height:600px;background-image:url('{u(SI + "Situation Anomaly Elevator 2.avif")}');background-size:860px auto;background-position:0 28%"></div>
<div class="led" style="position:absolute;left:40px;top:650px;width:780px;font-size:66px;line-height:1.3;word-break:keep-all">{q("목적지에 도착했습니다. 안내를 종료합니다.")}</div>
<div class="src" style="position:absolute;left:42px;top:840px;width:780px">인스피레이션 호텔 · {q("생환자들의 내비게이션, 아무것도 없는 숲 한가운데서")}</div>
<div class="k" style="position:absolute;left:42px;top:978px">차원 승강기 · 최저 기록</div>
<div class="led" style="position:absolute;left:400px;top:930px;font-size:130px;line-height:1">{q("B-12")}</div>
''')
URL = 'https://github.com/leepc25/goei-plugin/releases/latest'
arca('B-12', f'''<div style="text-align:center;padding:6px 0 0 0;"><a href="{URL}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;"><span style="display:inline-block;padding:18px 0;width:100%;max-width:520px;background:#FFB000;border-radius:6px;text-align:center;"><span style="color:#1B130A;font-size:22px;font-weight:900;letter-spacing:0.04em;">받기</span></span></a></div>
<div style="text-align:center;color:rgba(255,230,184,0.6);{G}font-size:14px;margin-top:12px;word-break:break-all;">github.com/leepc25/goei-plugin/releases/latest</div>''', pad='10px 4.65% 48px')


# ---------- 묶기 ----------
CSS = '''
@font-face{font-family:'DungGeunMo';src:url('https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_six@1.2/DungGeunMo.woff') format('woff');font-weight:normal;font-style:normal}
body{margin:0;width:860px}
.plate{position:relative;width:860px;overflow:hidden;box-sizing:border-box;background:var(--bg);box-shadow:0 2px 0 var(--bg),0 -2px 0 var(--bg);color:var(--fg);font-family:'IBM Plex Sans KR','Noto Sans KR',sans-serif;letter-spacing:-0.01em}
.plate *{box-sizing:border-box}
.plate .d{font-family:'Black Han Sans','Noto Sans KR',sans-serif;font-weight:400;letter-spacing:-0.015em}
.plate .led{font-family:'DungGeunMo',monospace;color:#FFB000;letter-spacing:0}
.plate .px{image-rendering:pixelated}
.plate .flr{position:absolute;font-family:'DungGeunMo',monospace;line-height:1;white-space:nowrap;letter-spacing:0}
.plate .tag{font-weight:500;opacity:.72;margin-right:14px}
.plate .k{font-size:34px;font-weight:600;line-height:1.2;opacity:.8}
.plate .ind{display:inline-block;background:#1B130A;color:#FFB000;font-family:'DungGeunMo',monospace;font-size:42px;line-height:1;padding:11px 16px 9px;border-radius:5px}
.plate .mark .nm{font-family:'Black Han Sans';font-size:44px;line-height:1}
.plate .band{position:absolute;left:0;top:0;width:860px;background:#1B130A}
.plate .band .title{position:absolute;left:40px;top:64px;font-size:112px;line-height:1;white-space:nowrap}
.plate .band .ind.big{position:absolute;right:40px;top:34px;font-size:92px;padding:6px 20px 2px;background:#2b2013}
.plate .jang{display:inline-block;width:56px;height:86px;position:relative;vertical-align:-6px}
.plate .jang b{position:absolute;left:17px;width:22px;height:22px;background:#FFB000}
.plate .jang b:first-child{top:16px}.plate .jang b:last-child{top:54px}
.plate .gap{position:absolute;background-repeat:no-repeat;box-shadow:inset 0 0 0 5px #1B130A, inset 22px 0 26px -12px rgba(0,0,0,.7), inset -22px 0 26px -12px rgba(0,0,0,.7)}
.plate .leafline{position:absolute;width:3px;background:rgba(27,19,10,.55)}
.plate .src{font-size:34px;line-height:1.34;font-weight:500;opacity:.8;word-break:keep-all}
.plate .kv .k{margin-bottom:8px}
.plate .kv .v{font-family:'Black Han Sans';line-height:1.12;letter-spacing:-0.015em;word-break:keep-all}
.plate s{text-decoration-thickness:.07em;opacity:.62}
.plate b.em{font-weight:inherit;color:#9C1708}
.plate b.plain{font-weight:inherit}
.plate .rule{position:absolute;left:40px;width:780px;height:3px;background:currentColor;opacity:.5}
.plate .panel{position:absolute;right:40px;top:60px;width:330px;height:1130px;background:#1B130A;border-radius:10px;padding:22px 26px;color:#FFF0D2}
.plate .prow{display:flex;align-items:center;gap:18px;height:83.5px}
.plate .btn{display:flex;align-items:center;justify-content:center;flex:none;width:64px;height:64px;border-radius:50%;border:3px solid #6b5327;color:#c79a3c;font-family:'DungGeunMo';font-size:24px}
.plate .btn.lit{background:#FFB000;border-color:#FFB000;color:#1B130A;box-shadow:0 0 18px rgba(255,176,0,.6)}
.plate .pl{font-size:32px;font-weight:700;white-space:nowrap}
.plate .faces{position:absolute;left:0;top:0;width:860px;display:flex;flex-wrap:wrap;background:#1B130A}
.plate .face{display:block;background-repeat:no-repeat;background-color:rgba(255,240,210,.07);box-shadow:inset 0 0 0 1px rgba(0,0,0,.5)}
.plate .vrow{border-top:3px solid rgba(255,230,184,.3);padding:12px 0 16px}
.plate .vrow .k{display:block;font-size:32px;font-weight:500;opacity:.75}
.plate .vrow .v{display:block;font-size:56px;line-height:1.1;color:#FFB000}
.plate .shot{position:absolute;background-repeat:no-repeat}
'''
html = ('<!doctype html><html lang="ko"><head><meta charset="utf-8">'
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=IBM+Plex+Sans+KR:wght@400;500;600;700&display=swap">'
        f'<style>{CSS}</style></head><body>\n' + '\n'.join(out) + '\n</body></html>')
open(ROOT + '.scratch/arca/c/page.html', 'w').write(html)
json.dump(USED, open(ROOT + '.scratch/arca/c/used_quotes.json', 'w'), ensure_ascii=False, indent=1)
print('plates', sum('class="plate"' in o for o in out), 'arca', sum('class="arca"' in o for o in out), 'quotes', len(USED))
