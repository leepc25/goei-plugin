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

# =====================================================================
# 1층 — 표지
# =====================================================================
plate('cover', '1', 1380, f'''
<div class="band" style="height:168px"><div class="title led">괴이<i class="jang"><b></b><b></b></i>ANOMALY</div><div class="ind big">1</div></div>
<div class="leafline" style="left:524px;top:168px;height:1212px"></div>
<div class="gap px" style="left:548px;top:168px;width:254px;height:1212px;background-image:url('{u(AN + "Samangdan.avif")}');background-size:auto 1212px;background-position:54% 0"></div>
<div class="leafline" style="left:826px;top:168px;height:1212px"></div>
<div class="d" style="position:absolute;left:34px;top:236px;font-size:330px;line-height:1">{q("띵.")}</div>
<div class="d" style="position:absolute;left:40px;top:640px;font-size:104px;line-height:1.12">{q("1층입니다.")}</div>
<div class="d" style="position:absolute;left:40px;top:768px;font-size:74px;line-height:1.12">{q("문이 열립니다.")}</div>
<div class="src" style="position:absolute;left:42px;top:880px;width:460px">{q("차원 승강기의 첫 안내 방송")}</div>
<div data-deco style="position:absolute;left:440px;top:940px;width:56px;height:128px;background:#1B130A;border-radius:6px"><i style="position:absolute;left:14px;top:16px;width:28px;height:28px;border-radius:50%;border:3px solid #6b5327"></i><i style="position:absolute;left:14px;top:60px;width:28px;height:28px;border-radius:50%;background:#FFB000;box-shadow:0 0 14px rgba(255,176,0,.8)"></i><i style="position:absolute;left:18px;top:102px;width:20px;height:8px;background:#3a2c16"></i></div>
<div style="position:absolute;left:42px;bottom:56px;font-size:36px;font-weight:700;line-height:1.3">RisuAI용<br>괴담 시뮬레이션 봇</div>
''')

arca('1', f'''
<div style="color:{INK};{G}font-size:18px;font-weight:600;line-height:1.75;word-break:keep-all;">{awk(q("야근을 마치고 낡은 사무실 건물 엘리베이터를 탔다. 버튼을 눌렀다. 문이 닫히고, 내려가는 느낌이 들고, \"띵\" 소리와 함께 문이 열렸다. 1층이다. 그런데 ❗로비가 아니다.❗ 비슷하게 생겼는데 어딘가 틀렸다. 뒤돌아 엘리베이터 패널을 보면 아까는 없던 숫자들이 빼곡하게 생겨나 있다."), "#8E1A0B")}</div>
<div style="color:rgba(27,19,10,0.72);{G}font-size:14px;margin-top:6px;">괴이위키 「차원 승강기」 개요</div>
''', pad='34px 4.65% 10px')

# 층별 안내
rows = ''
for i, (c, n) in enumerate(NAMES):
    lit = ' lit' if i == 0 else ''
    rows += f'<div class="prow"><span class="btn{lit}" data-deco>{c}</span><span class="pl">{n}</span></div>'
plate('panel', '1', 1250, f'''
<div class="d" style="position:absolute;left:40px;top:70px;width:440px;font-size:76px;line-height:1.16;word-break:keep-all">{q("층마다 다른 세상이고, 층마다 다른 규칙이 있다.")}</div>
<div class="src" style="position:absolute;left:42px;top:450px;width:420px">괴이위키 「차원 승강기」</div>
<div class="px" style="position:absolute;left:40px;bottom:60px;width:400px;height:620px;background-position:50% 50%;background-image:url('{u(AN + "Dimensional Elevator.avif")}');background-size:cover"></div>
<div class="panel">{rows}</div>
''')

# =====================================================================
# B-1 — 세계
# =====================================================================
plate('world', 'B-1', 1500, f'''
{mark('B-1')}
<div class="leafline" style="left:616px;top:0;height:1500px"></div>
<div class="gap px" style="left:640px;top:0;width:180px;height:1500px;background-image:url('{u(FA + "Management Bureau.avif")}');background-size:auto 1500px;background-position:58% 0"></div>
<div style="position:absolute;left:40px;top:160px;width:560px">
{kv('관리국 · 사내 분위기', '군대보다 회사', 86)}
{kv('관리국 · 회식', '근처 파스타집', 86)}
{kv('소라 랜드 · 재방문 후기', '없음', 270, 30)}
{kv('명일 아파트 · 엘리베이터', '있음, 버튼이 가끔 하나 많음', 62)}
{kv('명일 아파트 · 위험도', '❗아래로 갈수록 나쁨❗', 86, 0, 'plain')}
</div>
''')

arca('B-1', alabel('B-1', '관리국 근무 수칙 · 첫 장면 「근무 수칙」에서')
     + ''.join(f'<div style="color:{INK};{G}font-size:17px;font-weight:700;line-height:1.6;margin:0 0 10px 0;word-break:keep-all;">{q(t)}</div>' for t in [
         '2. 이상현상에 대한 자료를 전자기기에 입력하지 마십시오. 이는 안전을 위한 것입니다.',
         '3. 식사 시간을 준수해 주십시오. 이는 안전을 위한 것입니다.',
         '7. 관리국의 불이 꺼지는 일은 없습니다. 불이 꺼졌다고 생각될 경우 그 무엇도 믿지 말고 당장 건물 바깥으로 탈출하십시오. 이는 안전을 위한 것입니다.'])
     + '<div style="height:14px;">&nbsp;</div>'
     + aq('B-1', '회사가 좋아서 다니는 사람 없어. 여기 아니면 못 구하는 게 있어서 다니는 거지. 그리고 그걸 회사도 알아.', '괴이위키 「백일몽」 · ' + q('어느 현장탐사팀 대리'), 21, mb=6))

# =====================================================================
# B-2 — 시작하는 자리
# =====================================================================
fimg = {'관리국': 'Management Bureau', '가짜 관리국': 'Fake Management Bureau', '백일몽 주식회사': 'Baekilmong', '민간인': 'Civilian', '프리랜서': 'Freelancer'}


def frow(f, i, top):
    left = i % 2 == 0
    titles = ' · '.join(q(s['label']) for s in f['scenarios'] if s['kind'] == 'opening')
    ix = 40 if left else 600
    tx = 290 if left else 40
    return f'''<div class="gap px" style="left:{ix}px;top:{top}px;width:220px;height:370px;background-image:url('{u(FA + fimg[f["name"]] + ".avif")}');background-size:auto 370px;background-position:50% 0"></div>
<div style="position:absolute;left:{tx}px;top:{top - 6}px;width:530px">
<div class="d" style="font-size:{62 if len(f["name"]) > 6 else 80}px;line-height:1.1;margin-bottom:14px">{q(f["name"])}</div>
<div style="font-size:30px;line-height:1.42;font-weight:500;word-break:keep-all;margin-bottom:16px">{q(f["blurb"])}</div>
<div style="font-size:30px;line-height:1.36;font-weight:800;word-break:keep-all">{titles}</div></div>'''


fs = scn['factions']
plate('start1', 'B-2', 1420, mark('B-2') + ''.join(frow(f, i, 160 + i * 420) for i, f in enumerate(fs[:3])))
plate('start2', 'B-2', 870, ''.join(frow(f, i + 3, 20 + i * 420) for i, f in enumerate(fs[3:])))
arca('B-2', f'<div style="color:{INK};{G}font-size:16px;font-weight:600;word-break:keep-all;">굵은 글씨는 세력마다 고를 수 있는 첫 장면 제목. 세력마다 「{q("직접 입력")}」과 「{q("커스텀 임무")}」가 따로 있다.</div>', pad='6px 4.65% 34px')

# =====================================================================
# B-3 — 이면의 주민들
# =====================================================================
solo = [('Blaret', '블라렛', '교황청'), ('Saladin', '살라딘', '이슬람'), ('Avensha', '아벤샤', '발푸르기스'),
        ('Secriem', '세크리엠', '흡혈귀'), ('Brownie', '브라우니', '독립 괴이'), ('Aestheticism', '탐미주의', '혼자서 하나의 세력')]
cells = ''
for i, (fn, nm, org) in enumerate(solo):
    sz, oy = (700, -40) if fn == 'Aestheticism' else (470, -8)
    x = 40 + (i % 3) * 265
    y = 470 + (i // 3) * 500
    cells += f'''<div class="gap" style="left:{x}px;top:{y}px;width:250px;height:380px;background-color:#1B130A;background-image:url('{u(AG + fn + "_default.avif")}');background-size:{sz}px auto;background-position:50% {oy}px"></div>
<div style="position:absolute;left:{x}px;top:{y + 388}px;width:250px;font-size:34px;font-weight:800;line-height:1.2">{nm}</div>'''
plate('residents', 'B-3', 1500, f'''
{mark('B-3')}
<div class="d" style="position:absolute;left:40px;top:150px;width:780px;font-size:104px;line-height:1.12;word-break:keep-all">{q("어두운 쪽이 장사가 잘된다.")}</div>
<div class="src" style="position:absolute;left:42px;top:398px;width:780px">첫 장면 「{q("도금이에요, 자기야")}」 · 마덕희</div>
{cells}
''')

lines = [('차여진', '특별한 의뢰'), ('서윤지', '녹음기'), ('고연지', '선불입니다'), ('윤지아', '야간 접수'), ('마덕희', '도금이에요, 자기야'),
         ('문혜란', '사인 먼저, 밥은 나중에'), ('신유리', '십. 퍼센트. 매주.'), ('블라렛', '이교도와 수녀'), ('살라딘', '여기서 불타리라'),
         ('아벤샤', '마녀의 산책'), ('세크리엠', '갇힌 여자'), ('탐미주의', '넌 내 최고의 작품이야'), ('브라우니', '화요일의 즐거움, 화요일의 열기')]
t = alabel('B-3', '이면의 주민들 13명 · 그 인물로 시작하는 첫 장면')
for nm, lb in lines:
    t += (f'<div style="border-top:1px solid rgba(27,19,10,0.3);padding:8px 0 9px 0;"><span style="display:inline-block;width:92px;color:rgba(27,19,10,0.75);{G}font-size:15px;vertical-align:top;">{nm}</span>'
          f'<span style="display:inline-block;color:{INK};{G}font-size:17px;font-weight:800;">{q(lb)}</span></div>')
arca('B-3', t, pad='10px 4.65% 34px')

plate('residents2', 'B-3', 1330, f'''
<div class="d" style="position:absolute;left:40px;top:40px;font-size:44px">특수재난대응협회</div>
<div style="position:absolute;left:0;top:110px;width:478px;height:582px;overflow:hidden"><img src="{u(AG + "Cha Yeo-jin_default.avif")}" style="position:absolute;left:-75px;top:10px;height:640px">
<img src="{u(AG + "Seo Yun-ji_default.avif")}" style="position:absolute;left:105px;top:10px;height:640px"></div>
<div class="d" style="position:absolute;left:490px;top:150px;width:340px;font-size:56px;line-height:1.2;word-break:keep-all">{q("재량은 오류가 기록에 들어오는 경로입니다.")}</div>
<div class="src" style="position:absolute;left:492px;top:540px;width:330px">서윤지 · {q("재량을 쓰라는 지시에")}</div>
<div class="rule" style="top:690px"></div>
<div class="d" style="position:absolute;left:40px;top:720px;font-size:44px">중림 지하상가</div>
<div class="d" style="position:absolute;left:40px;top:800px;width:780px;font-size:60px;line-height:1.2;word-break:keep-all">{q("울려면 밖에서 울어. 눈물 때문에 책상 녹슬어.")}</div>
<div class="src" style="position:absolute;left:42px;top:956px;width:780px">신유리 · {q("우는 손님에게")}</div>
''' + ''.join(f'<img src="{u(AG + n + "_default.avif")}" style="position:absolute;left:{-40 + i * 152}px;top:1010px;height:500px">' for i, n in enumerate(['Go Yeon-ji', 'Yun Ji-a', 'Ma Deok-hee', 'Mun Hye-ran', 'Shin Yuri'])))

# =====================================================================
# B-4 — 관리국
# =====================================================================
plate('bureau', 'B-4', 1180, f'''
{mark('B-4')}
<img src="{u(AG + "Geshugan_default.avif")}" style="position:absolute;right:-150px;top:120px;height:1240px">
<div class="d" style="position:absolute;left:34px;top:170px;font-size:270px;line-height:1.04">{q("그래.<br>미안.")}</div>
<div class="src" style="position:absolute;left:42px;top:750px;width:400px">게슈간 · {q("팀원을 죽인 일에 대한 완전한 사과")}</div>
<div class="d" style="position:absolute;left:40px;top:900px;font-size:86px;line-height:1.1">{q("알았어. 미안.")}</div>
<div class="src" style="position:absolute;left:42px;top:1010px;width:400px">{q("위 사과의 긴 버전")}</div>
''')

bur = ['Jyaldi', 'Spangdal', 'Jaemtri', 'Aileen', 'Gognija', 'Kyuras', 'Gorgodio', 'Dejure', 'Deadpole', 'Geshugan', 'Rojemon', 'Konjyuce']
exps = ['annoyed', 'smug', 'pouting', 'scared', 'laughing', 'bored']
plate('bureau2', 'B-4', 1010, f'''
<div class="faces">{''.join(face(n, 143, 172, 330) for n in bur)}</div>
<div class="d" style="position:absolute;left:40px;top:410px;width:780px;font-size:104px;line-height:1.12;word-break:keep-all">{q("현장 출동이면<br>난 안 가.")}</div>
<div class="src" style="position:absolute;left:42px;top:656px;width:780px">로제몬 · {q("공식 기록, 이후 출동함")}</div>
<div class="faces" style="top:740px">{''.join(f'<i class="face" style="width:143px;height:200px;background-image:url(&quot;{u("assets/portraits/Rojemon/Rojemon_" + e + ".avif")}&quot;);background-size:360px auto;background-position:50% -6px"></i>' for e in exps)}</div>
<div style="position:absolute;left:42px;top:950px;font-size:30px;font-weight:700">인물마다 표정 41종</div>
''')

arca('B-4', alabel('B-4', '위 얼굴 순서 · 쟈알디, 스팡달, 잼트리, 에일린, 고그니쟈, 큐라스 / 고르고디오, 데쥬레, 데드폴, 게슈간, 로제몬, 콘쥬스')
     + '<div style="height:10px;">&nbsp;</div>'
     + aq('B-4', '하아. 잼트리. 이것 좀 어떻게 해 봐.', '쟈알디 · ' + q('사무실에서 하루 평균 n회'))
     + aq('B-4', '가다가 죽지 마. 시신 회수 귀찮아.', '에일린 · ' + q('떠나는 사람에게'))
     + aq('B-4', '아, 그건 비상 탈출 장치라네!', '고그니쟈 · ' + q('지하 연구실의 창문에 대해'))
     + aq('B-4', '여기서 제가 한 번 죽으면 시간이 벌리니까요.', '데드폴 · ' + q('작전 회의, 아무렇지 않게'), mb=4), pad='22px 4.65% 34px')

# =====================================================================
# B-5 — 가짜 관리국
# =====================================================================
plate('fake', 'B-5', 1060, f'''
{mark('B-5')}
<img src="{u(AG + "Lee Do-hyeong_default.avif")}" style="position:absolute;left:250px;top:330px;height:1180px">
<div class="d" style="position:absolute;left:30px;top:150px;font-size:250px;line-height:1.04">{q("들어가.")}</div>
<div class="src" style="position:absolute;left:42px;top:440px;width:300px">이도형 · {q("턱짓과 함께, 작전 개시 명령의 전문(全文)")}</div>
''')
fk = ['Sa-jang', 'Do Pil-heon', 'Lee Gil-hwan', 'Lee Gi-seok', 'Kim Jo-hak', 'Lee Do-hyeong', 'Go Young-hoon', 'No Gi-gyun', 'Song Ju-ik', 'Kwak Seong-ju', 'Cho Seong-choon', 'Yun Byeong-su', 'Kim Seong-jin', 'Song Jin-seob']
plate('fake2', 'B-5', 900, f'''<div class="faces">{''.join(face(n, 122.857, 150, 290) for n in fk)}</div>
<div style="position:absolute;right:0;top:300px;width:470px;height:600px;overflow:hidden"><img src="{u(AG + "Go Young-hoon_default.avif")}" style="position:absolute;left:-60px;top:30px;height:900px"></div>
<div class="d" style="position:absolute;left:30px;top:400px;font-size:230px;line-height:1.04">{q("정지.")}</div>
<div class="src" style="position:absolute;left:42px;top:670px;width:380px">고영훈 · {q("고영훈 어록의 약 40%")}</div>
''')
arca('B-5', alabel('B-5', '위 얼굴 순서 · 사장, 도필헌, 이길환, 이기석, 김조학, 이도형, 고영훈 / 노기균, 송주익, 곽성주, 조성춘, 윤병수, 김성진, 송진섭')
     + '<div style="height:10px;">&nbsp;</div>'
     + aq('B-5', '넌 이미 진실을 알아 버렸어. 요원이 되는 것 말고는 남은 선택지가 없어. 대학은 왜 가? 좋은 직장 가려고 가는 거잖아. 축하해, 취직했어. 요원으로.', '김조학 · ' + q('영입 권유의 마무리'))
     + aq('B-5', 'UI 말입니다. 개선할 점이 있으면 말씀해 주세요.', '사장 · ' + q('업무 피드백처럼 생긴 질문'))
     + aq('B-5', '내가 때려잡은 괴이들을 한 줄로 세우면 지구를 한 바퀴 돈다.', '조성춘 · ' + q('회식 자리, 매번'))
     + arow('B-5', '가짜 관리국 · 자칭', '관리국 ✂️본인들 기준 진짜✂️')
     + arow('B-5', '가짜 관리국 · 모집 방식', '❗납치❗', '#FFC53D'), pad='22px 4.65% 34px')

# =====================================================================
# B-6 — 백일몽
# =====================================================================
bm = ['Cheong Dal-lae', 'Ho Yu-won', 'Lee Byeong-jin', 'Baek Seok-ju', 'Jin Na-sol', 'Lee Seong-hae', 'Lee Ja-heon', 'Eun Ha-je',
      'Park Min-seong', 'Baek Sa-heon', 'Go Young-eun', 'Kang I-hak', 'Jang Heo-un', 'Kwak Je-gang', 'Lee Yeon-hwa', 'Jay']
plate('dream', 'B-6', 1240, f'''
{mark('B-6')}
<div style="position:absolute;right:0;top:110px;width:400px;height:860px;overflow:hidden"><img src="{u(AG + "Lee Seong-hae_default.avif")}" style="position:absolute;left:-190px;top:0;height:1160px"></div>
<div class="d" style="position:absolute;left:40px;top:160px;width:470px;font-size:80px;line-height:1.16;word-break:keep-all">{q("이런 건 저처럼 스트레스 안 받는 사람이 해야 돼여.")}</div>
<div class="src" style="position:absolute;left:42px;top:560px;width:420px">이성해 · {q("처형 임무를 맡으며")}</div>
<div style="position:absolute;left:40px;top:716px;width:480px">
{kv('백일몽 · 퇴사', '부서에 따라 불가능 ✂️평생직장 실현✂️', 62, 0, 'plain')}
</div>
<div class="faces" style="top:970px">{''.join(face(n, 107.5, 130, 250) for n in bm)}</div>
''')
arca('B-6', alabel('B-6', '위 얼굴 순서 · 청달래, 호유원, 이병진, 백석주, 진나솔, 이성해, 이자헌, 은하제 / 박민성, 백사헌, 고영은, 강이학, 장허운, 곽제강, 이연화, 제이')
     + '<div style="height:10px;">&nbsp;</div>'
     + aq('B-6', '이 부서는 다들 1년쯤 되면 주임 달아. 너도 곧 달 거야. 그 전에 죽을 수도 있지만.', '박민성 · ' + q('박민성, 해맑게').replace('박민성, ', ''))
     + aq('B-6', '도넛을 좋아하는데… 회사까지 배달해 주는 데가 없고… 낮에는 나갈 수가 없어서……', '제이 · ' + q('좋아하는 것을 묻자'))
     + arow('B-6', '진나솔 · 좋아하는 것', '포인트, 정시 퇴근, 조용함 ✂️셋 다 회사에 없다✂️')
     + arow('B-6', '백일몽 · 입사 시험', '❗괴담에 들어갔다 살아 나오기❗', '#FFC53D')
     + arow('B-6', '은하제 · 퇴사 선언 횟수', '측정 불가 ✂️퇴사는 0회✂️')
     + arow('B-6', '백일몽 본사 · 출입', '사원증 ✂️그리고 살아 있을 것✂️'), pad='22px 4.65% 34px')

# =====================================================================
# B-7 — 괴이
# =====================================================================
plate('anom', 'B-7', 1540, f'''
{mark('B-7')}
<div class="led" style="position:absolute;left:40px;top:140px;width:780px;font-size:62px;line-height:1.3;word-break:keep-all">{q("이번 역은, 슬픔, 슬픔역입니다. 내리실 문은 오른쪽입니다.")}</div>
<div class="src" style="position:absolute;left:42px;top:400px;width:780px">{q("심연교통공사 열차 안내 방송. 목소리가 지나치게 평온하다")}</div>
<div class="px" style="position:absolute;left:0;top:500px;width:860px;height:620px;background-image:url('{u(AN + "Abyss Transit Authority.avif")}');background-size:860px auto;background-position:0 30%"></div>
<div style="position:absolute;left:40px;top:1164px;width:780px">
{kv('심연교통공사 · 탑승 방법', '졸면 된다 ✂️수도권 시민 대부분 해당✂️', 62, 30, 'plain')}
{kv('심연교통공사 · 노선도', '없다', 62, 0)}
</div>
''')
arca('B-7', aq('B-7', '지금부터 역내 고객 여러분을 도려내기 시작하겠습니다. 이용에 불편을 드려 죄송합니다.', '원숭이 꿈 괴담 · ' + q('차장의 안내 방송. 생환자 다수가 거의 같은 문장으로 기억한다'))
     + aq('B-7', '관객 여러분께 안내 말씀 드립니다. 지금부터 일부 관객분들께서는 붉은 숙녀와 함께하시게 됩니다. 남은 관객 여러분께서는 2막을 즐겨 주시기 바랍니다.', '뮤지컬 붉은 숙녀 · ' + q('인터미션 안내 방송'))
     + aq('B-7', '이거 보는 사람 있으면 우리 엄마한테 나 우유 사러 나왔다가 늦는 거라고 전해 줘. 아직 늦는 중이라고.', '룩키마트 · ' + q('영수증 뒷면 메모. 날짜 칸은 이십 년 전이었다'), mb=4), pad='10px 4.65% 34px')

# =====================================================================
# B-8 — 세광 순환선
# =====================================================================
st = [('세광역', 'Segwang Station', '임종의 숲길'), ('자정역', 'Midnight Station', '신체 카지노'), ('한밤역', 'Deep Night Station', '한빛도서관'),
      ('황혼역', 'Dusk Station', '양심판매대'), ('오후역', 'Afternoon Station', '혈액 방송국'), ('한낮역', 'Midday Station', '낮잠용 쉼터'), ('아침역', 'Morning Station', '저울 재판소')]
slits = ''
for i, (nm, fn, sub) in enumerate(st):
    x = 40 + i * 113.3
    slits += f'''<div class="gap px" style="left:{x}px;top:140px;width:100px;height:600px;background-image:url('{u(AN + fn + ".avif")}');background-size:auto 600px;background-position:50% 0"></div>
<div style="position:absolute;left:{x - 4}px;top:752px;width:112px;font-size:32px;font-weight:800;text-align:center">{q(nm)}</div>'''
plate('loop', 'B-8', 1430, f'''
{mark('B-8')}
{slits}
<div class="d" style="position:absolute;left:40px;top:850px;width:780px;font-size:66px;line-height:1.2;word-break:keep-all">{q("엄마 밥 냄새가 났어. 진짜로. 된장찌개. 우리 엄마는 세광에 산 적도 없는데.")}</div>
<div class="src" style="position:absolute;left:42px;top:1110px;width:780px">{q("한낮역 생환자, 익명 게시판")}</div>
<div style="position:absolute;left:40px;top:1200px;width:780px">
{kv('세광특별시 · 인구', '재난 이전 수십만, 현재 약 25명 + 기타 ✂️기타가 더 많다✂️', 54, 0, 'plain')}
</div>
''')
extra = {'세광역': ('현재 수용 인원', '세지 마라'), '자정역': ('영업시간', '24시간 ✂️정확히는 영원히✂️'), '한밤역': ('입장료', '❗무료❗ ✂️진짜다, 그래서 더 무섭다✂️'),
         '황혼역': ('결제 방식', '양심껏'), '오후역': ('월세', '피로 받음 ✂️전세 사기는 없다, 대신 전혈 사기가 있다✂️'), '한낮역': ('현재 시각', '❗정오❗ ✂️몇 년째✂️'), '아침역': ('변호인', '✂️국선은 없다✂️')}
t = alabel('B-8', '세광 순환선 · ' + q('7개 역 순환선 (내선만 운행)'))
for nm, fn, sub in st:
    k, v = extra[nm]
    t += (f'<div style="border-top:1px solid rgba(255,230,184,0.22);padding:9px 0 10px 0;"><div style="color:{SAND};{G}font-size:17px;font-weight:800;">{nm} <span style="color:rgba(255,230,184,0.66);{G}font-size:14px;font-weight:400;">부역명 {q(sub)}</span></div>'
          f'<div style="color:rgba(255,230,184,0.9);{G}font-size:15px;word-break:keep-all;">{k} — {awk(q(v), "#FFB000")}</div></div>')
arca('B-8', t, pad='6px 4.65% 34px')

# =====================================================================
# B-9 — 괴이 (그림 넉넉히)
# =====================================================================
grid = ['Sora Land', 'Forbidden Video', 'Lookymart', 'Tuesday Quiz Show', 'Myeongil Apartment',
        'Cheongak Mary Hospital', 'Dream and Hope Theater', 'Frost Waterpark', "Red Lady's Musical Theater", 'Hungry Hangman',
        'Jisan Village Festival', 'Desire Room', 'Yukoae Theme Park', 'Gangbuk Special Hospital', 'Monkey Dream',
        'Flower Golden Resort', 'Saint Anticus Boarding School', 'Cosmic Fantasy Zoo', 'Dark Garden', 'Hotel Inspiration',
        'Twinkle Dragon Palace', 'Corrupted cathedral', 'Fairytale Park', 'Sotos Department Store', 'The Church']
cells = ''.join(f'<i style="display:block;float:left;width:172px;height:172px;background-image:url(&quot;{u(AN + g + ".avif")}&quot;);background-size:cover"></i>' for g in grid)
plate('anom2', 'B-9', 1350, f'''
{mark('B-9', '괴이 63곳')}
<div style="position:absolute;left:0;top:130px;width:860px;height:860px">{cells}</div>
<div style="position:absolute;left:40px;top:1030px;width:780px">
{kv('금지된 비디오 · 러닝타임', '끝까지 본 사람이 없음', 66, 34)}
{kv('욕망의 방 · 성인 시설 여부', '❗아니라고 본인이 적어 놨다❗', 66, 0, 'plain')}
</div>
''')
arca('B-9', arow('B-9', '소라 랜드 · 마스코트', '많음, 다들 어딘가 하나씩 없음')
     + arow('B-9', '인류의 신비전 · 관람료', '있음 ✂️본인이 내는 건 아님✂️')
     + arow('B-9', '강변 · 위치', '서울을 가로지르는 그 강 ✂️한강이라고 하면 서울시가 싫어한다✂️')
     + arow('B-9', '룩키마트 · 층수', '지하 1층, 지상 3층, ❗없는 4층❗', '#FFB000')
     + arow('B-9', '뮤지컬 붉은 숙녀 · 예매', '매진, 매번 ✂️취소표도 매진✂️')
     + arow('B-9', '미스테리 월드 어드벤쳐 파크 · 입장 방법', '❗정문에서 표를 산다❗ ✂️그게 제일 무섭다✂️', '#FFB000')
     + arow('B-9', '소토스 백화점 · 계산대', '없음 ✂️궁금해하지 마라✂️'), pad='6px 4.65% 34px')

# =====================================================================
# B-10 — 특수 장소
# =====================================================================
MS = 'assets/wiki/Mystic Sites/'
vend = [('결제 수단', '❗신체 부위만❗'), ('환불', '없음'), ('취소', '없음'), ('흥정', '없음'), ('이름값', '❗못 한다❗ (무엇이든은 아님)')]
vr = ''.join(f'<div class="vrow"><span class="k">{k}</span><span class="v d">{wk(q(v), "plain")}</span></div>' for k, v in vend)
plate('sites', 'B-10', 1400, f'''
{mark('B-10')}
<div class="gap px" style="left:40px;top:140px;width:300px;height:830px;background-image:url('{u(MS + "Anything Vending Machine.avif")}');background-size:auto 830px;background-position:50% 0"></div>
<div class="d" style="position:absolute;left:380px;top:134px;font-size:52px">무엇이든 자판기</div>
<div style="position:absolute;left:380px;top:226px;width:440px">{vr}</div>
<div class="led" style="position:absolute;left:40px;top:1020px;width:780px;font-size:54px;line-height:1.32;word-break:keep-all">{q("딩동댕~ 구매해 주셔서 감사합니다! 오늘도 행복한 하루 되세요!")}</div>
<div class="src" style="position:absolute;left:42px;top:1250px;width:780px">{q("생환자들이 공통으로 기억하는 결제 완료 멘트")}</div>
''')
arca('B-10', alabel('B-10', '특수 장소 11곳')
     + arow('B-10', '이정 책방 · 주인', '❗오른손만 보인다❗', '#FFB000')
     + arow('B-10', '도깨비 공방 · 애프터서비스', '❗판매 후 추적까지 해 준다❗ ✂️원치 않아도✂️', '#FFB000')
     + arow('B-10', '우주 쇼핑몰 · 결제', '현금, 신용카드, 체크카드 ✂️할부는 물어본 사람이 없다✂️')
     + arow('B-10', '얼굴 없는 장터 · 주소', '❗모든 맨홀❗ ✂️도로명 주소 미지원✂️', '#FFB000')
     + arow('B-10', '여우상담실 · 상담료', '대개 무료 ✂️대개✂️'), pad='6px 4.65% 34px')

# =====================================================================
# B-11 — 화면
# =====================================================================
SC = '.scratch/arca/kit/screens/'
plate('screens', 'B-11', 1560, f'''
{mark('B-11')}
<div class="shot" style="left:40px;top:140px;width:780px;height:517px;background-image:url('{u(SC + "promo/pc-play-03-map.png")}');background-size:886px auto;background-position:-53px -39px"></div>
<div class="d" style="position:absolute;left:40px;top:676px;font-size:50px">임무</div>
<div style="position:absolute;left:170px;top:686px;width:650px;font-size:30px;font-weight:500;line-height:1.3">지도에서 장소를 골라 요원 넷과 출동</div>
<div class="shot" style="left:40px;top:800px;width:370px;height:660px;background-image:url('{u(SC + "promo/phone-play-04-phone.png")}');background-size:370px auto;background-position:0 0"></div>
<div class="d" style="position:absolute;left:40px;top:1478px;font-size:50px">괴담톡</div>
<div class="shot" style="left:450px;top:800px;width:370px;height:660px;background-image:url('{u(SC + "s-wiki/phone-01-home.png")}');background-size:370px auto;background-position:0 0"></div>
<div class="d" style="position:absolute;left:450px;top:1478px;font-size:50px">괴이위키</div>
''')
plate('screens2', 'B-11', 800, f'''
<div class="shot px" style="left:40px;top:20px;width:780px;height:640px;background-image:url('{u(SC + "s-hs/pc_1_와이드.png")}');background-size:2792px auto;background-position:-834px -470px"></div>
<div class="d" style="position:absolute;left:40px;top:682px;font-size:50px">망상홈쇼핑</div>
<div style="position:absolute;left:330px;top:692px;font-size:30px;font-weight:500">인터넷 안의 생방송</div>
''')
bg, fg = FL['B-11']
t = ''
for k, v in [('상황판', '요원 화면, 지금 벌어진 괴이 · 사건 · 특수 상황'), ('임무', '지도에서 장소를 골라 요원 넷을 편성해 출동, 커스텀 임무'), ('괴담톡', '연락처 · 대화 · 공지, 전화, 단톡'),
             ('인터넷', '괴담넷, 괴담 갤러리, 세정게, 연어 마켓, 우주 쇼핑몰, 괴이위키, 백일몽 포인트몰, 망상홈쇼핑'), ('소지품', '무기 2칸 · 장비 4칸 장착, 가계부'), ('기록', '일지 · 연대기 · 인물 · 세력'), ('언어', '한국어 · English')]:
    t += (f'<div style="border-top:1px solid rgba(255,230,184,0.22);padding:9px 0 10px 0;"><span style="display:inline-block;width:76px;color:#FFB000;{G}font-size:16px;font-weight:800;vertical-align:top;">{k}</span>'
          f'<span style="display:inline-block;width:72%;color:{SAND};{G}font-size:16px;word-break:keep-all;vertical-align:top;">{v}</span></div>')
arca('B-11', t, pad='6px 4.65% 34px')

# =====================================================================
# B-12 — 받기
# =====================================================================
plate('get', 'B-12', 1180, f'''
{mark('B-12')}
<div class="px" style="position:absolute;left:0;top:130px;width:860px;height:600px;background-image:url('{u(SI + "Situation Anomaly Elevator 2.avif")}');background-size:860px auto;background-position:0 28%"></div>
<div class="led" style="position:absolute;left:40px;top:780px;width:780px;font-size:66px;line-height:1.3;word-break:keep-all">{q("목적지에 도착했습니다. 안내를 종료합니다.")}</div>
<div class="src" style="position:absolute;left:42px;top:970px;width:780px">인스피레이션 호텔 · {q("생환자들의 내비게이션, 아무것도 없는 숲 한가운데서")}</div>
<div style="position:absolute;left:42px;top:1090px;font-size:30px;font-weight:700">차원 승강기 · 최저 기록 {q("B-12")}</div>
''')
URL = 'https://github.com/leepc25/goei-plugin/releases/latest'
arca('B-12', f'''<div style="text-align:center;padding:6px 0 0 0;"><a href="{URL}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;"><span style="display:inline-block;padding:18px 0;width:100%;max-width:520px;background:#FFB000;border-radius:6px;text-align:center;"><span style="color:#1B130A;font-size:22px;font-weight:900;letter-spacing:0.04em;">받기</span></span></a></div>
<div style="text-align:center;color:rgba(255,230,184,0.6);{G}font-size:14px;margin-top:12px;word-break:break-all;">github.com/leepc25/goei-plugin/releases/latest</div>''', pad='10px 4.65% 48px')

# ---------- 묶기 ----------
CSS = '''
@font-face{font-family:'DungGeunMo';src:url('https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_six@1.2/DungGeunMo.woff') format('woff');font-weight:normal;font-style:normal}
body{margin:0;width:860px}
.plate{position:relative;width:860px;overflow:hidden;box-sizing:border-box;background:var(--bg);color:var(--fg);font-family:'IBM Plex Sans KR','Noto Sans KR',sans-serif;letter-spacing:-0.01em}
.plate *{box-sizing:border-box}
.plate .d{font-family:'Black Han Sans','Noto Sans KR',sans-serif;font-weight:400;letter-spacing:-0.015em}
.plate .led{font-family:'DungGeunMo',monospace;color:#FFB000;letter-spacing:0}
.plate .px{image-rendering:pixelated}
.plate .mark{position:absolute;left:40px;top:40px;display:flex;align-items:center;gap:18px}
.plate .ind{display:inline-block;background:#1B130A;color:#FFB000;font-family:'DungGeunMo',monospace;font-size:42px;line-height:1;padding:11px 16px 9px;border-radius:5px}
.plate .mark .nm{font-family:'Black Han Sans';font-size:44px;line-height:1}
.plate .band{position:absolute;left:0;top:0;width:860px;background:#1B130A}
.plate .band .title{position:absolute;left:40px;top:38px;font-size:92px;line-height:1;white-space:nowrap}
.plate .band .ind.big{position:absolute;right:40px;top:34px;font-size:92px;padding:6px 20px 2px;background:#2b2013}
.plate .jang{display:inline-block;width:46px;height:70px;position:relative;vertical-align:-4px}
.plate .jang b{position:absolute;left:14px;width:18px;height:18px;background:#FFB000}
.plate .jang b:first-child{top:12px}.plate .jang b:last-child{top:44px}
.plate .gap{position:absolute;background-repeat:no-repeat;box-shadow:inset 0 0 0 5px #1B130A, inset 22px 0 26px -12px rgba(0,0,0,.7), inset -22px 0 26px -12px rgba(0,0,0,.7)}
.plate .leafline{position:absolute;width:3px;background:rgba(27,19,10,.55)}
.plate .src{font-size:30px;line-height:1.34;font-weight:500;opacity:.8;word-break:keep-all}
.plate .kv .k{font-size:30px;font-weight:600;line-height:1.2;opacity:.8;margin-bottom:8px}
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
.plate .vrow .k{display:block;font-size:30px;font-weight:500;opacity:.75}
.plate .vrow .v{display:block;font-size:56px;line-height:1.1;color:#FFB000}
.plate .shot{position:absolute;background-repeat:no-repeat;border-radius:10px;box-shadow:0 0 0 3px rgba(255,230,184,.25)}
'''
html = ('<!doctype html><html lang="ko"><head><meta charset="utf-8">'
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=IBM+Plex+Sans+KR:wght@400;500;600;700&display=swap">'
        f'<style>{CSS}</style></head><body>\n' + '\n'.join(out) + '\n</body></html>')
open(ROOT + '.scratch/arca/c/page.html', 'w').write(html)
json.dump(USED, open(ROOT + '.scratch/arca/c/used_quotes.json', 'w'), ensure_ascii=False, indent=1)
print('plates', sum('class="plate"' in o for o in out), 'arca', sum('class="arca"' in o for o in out), 'quotes', len(USED))
