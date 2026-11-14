# -*- coding: utf-8 -*-
# 「백지 화보」 page.html 생성기 (2판). 문장은 전부 자료 파일에서 직접 꺼내고, 자른 문장은 원문에 들어 있는지 assert 로 확인한다.
import json, re
from urllib.parse import quote as uq

ROOT = '/home/user/goei-plugin'
KIT = ROOT + '/.scratch/arca/kit'
HERE = ROOT + '/.scratch/arca/a'
OUT = HERE + '/page.html'
SP = '/tmp/claude-0/-home-user/4628beb8-e27e-545e-a16e-1b961f3e453e/scratchpad'
W = json.load(open(KIT + '/wiki_infobox.json'))
G = json.load(open(ROOT + '/src/data/world/greetings.json'))
SC = json.load(open(ROOT + '/src/data/world/scenes.json'))['인물']
SN = json.load(open(ROOT + '/src/data/scenarios.json'))
HEADS = json.load(open(HERE + '/heads.json'))
USED = []

PAPER = '#f5f3ee'; INK = '#141312'; RED = '#cf2a1c'; GRAY = '#5f5b55'; DGRAY = '#a8a299'

def U(p):
    return 'file://' + uq(ROOT + '/' + p)

def mk(s, arca=None):
    """위키 표기 → HTML. ✂️취소선✂️ ❗강조❗"""
    if arca:
        s = re.sub(r'✂️(.*?)✂️', r'<span style="text-decoration:line-through;color:%s;%s">\1</span>' % (arca['gray'], arca['guard']), s)
    else:
        s = re.sub(r'✂️(.*?)✂️', r'<s>\1</s>', s)
    s = s.replace('❗', '')
    assert '📌' not in s and '➡️' not in s, s
    return s

def Q(title, i, cut=None):
    raw = W[title]['quotes'][i]
    text, src = raw.split('|Source:')
    if cut:
        assert cut in text, (cut, text)
        text = cut
    USED.append((text, '위키 「%s」 인용 %d — %s' % (title, i, src)))
    return text, src

def IB(title, key, arca=None):
    v = W[title]['infobox'][key]
    assert key not in ('나이', '신분')
    USED.append(('%s: %s' % (key, v), '위키 「%s」 정보상자' % title))
    return mk(v, arca)

def GR(key, s):
    t = G['texts'][G['index'][key]].replace('**', '')
    assert s in t, s
    assert '{{user}}' not in s
    USED.append((s, 'greetings.json %s' % key))
    return s

def br(s, *points):
    """줄 나눌 자리만 정한다(글자는 그대로). point 뒤의 공백을 <br>로."""
    for p in points:
        assert p + ' ' in s, (p, s)
        s = s.replace(p + ' ', p + '<br>', 1)
    return s

def nb(s, phrase):
    assert phrase in s, (phrase, s)
    return s.replace(phrase, '<span style="white-space:nowrap">%s</span>' % phrase, 1)

FAC = {f['name']: f for f in SN['factions']}
def blurb(n):
    USED.append((FAC[n]['blurb'], 'scenarios.json %s blurb' % n)); return FAC[n]['blurb']
def scn(n):
    ls = [s['label'] for s in FAC[n]['scenarios'] if s['kind'] == 'opening']
    for l in ls: USED.append((l, 'scenarios.json %s 첫 장면 제목' % n))
    rest = ' '.join('<span style="white-space:nowrap">%s%s</span>' % ('<i>/</i>' if i else '', x) for i, x in enumerate(ls[1:]))
    return '<div class="scn"><span>첫 장면</span><b>%s</b><p>%s</p></div>' % (ls[0], rest)

FILE = dict(쟈알디='Jyaldi', 스팡달='Spangdal', 잼트리='Jaemtri', 에일린='Aileen', 고그니쟈='Gognija', 큐라스='Kyuras', 고르고디오='Gorgodio',
            데쥬레='Dejure', 데드폴='Deadpole', 게슈간='Geshugan', 로제몬='Rojemon', 콘쥬스='Konjyuce',
            사장='Sa-jang', 도필헌='Do Pil-heon', 이길환='Lee Gil-hwan', 이기석='Lee Gi-seok', 김조학='Kim Jo-hak', 이도형='Lee Do-hyeong',
            고영훈='Go Young-hoon', 노기균='No Gi-gyun', 송주익='Song Ju-ik', 곽성주='Kwak Seong-ju', 조성춘='Cho Seong-choon',
            윤병수='Yun Byeong-su', 김성진='Kim Seong-jin', 송진섭='Song Jin-seob',
            청달래='Cheong Dal-lae', 호유원='Ho Yu-won', 이병진='Lee Byeong-jin', 이자헌='Lee Ja-heon', 은하제='Eun Ha-je', 박민성='Park Min-seong',
            곽제강='Kwak Je-gang', 이연화='Lee Yeon-hwa', 백석주='Baek Seok-ju', 진나솔='Jin Na-sol', 이성해='Lee Seong-hae', 백사헌='Baek Sa-heon',
            고영은='Go Young-eun', 강이학='Kang I-hak', 장허운='Jang Heo-un', 제이='Jay',
            고연지='Go Yeon-ji', 윤지아='Yun Ji-a', 마덕희='Ma Deok-hee', 문혜란='Mun Hye-ran', 신유리='Shin Yuri',
            차여진='Cha Yeo-jin', 서윤지='Seo Yun-ji', 블라렛='Blaret', 살라딘='Saladin', 아벤샤='Avensha', 세크리엠='Secriem',
            브라우니='Brownie', 탐미주의='Aestheticism')
assert len(FILE) == 55
SHOWN = set()

def agent(n):
    SHOWN.add(n)
    return U('assets/agents/%s_default.avif' % FILE[n])

def fig(n, h, left, top, extra=''):
    """전신 그림. h=높이(px)."""
    return '<img class="fig" src="%s" style="height:%dpx;left:%dpx;top:%dpx;%s">' % (agent(n), h, left, top, extra)

def figc(n, h, cx, top, extra=''):
    """머리 가운데를 cx 에 맞춘 전신."""
    s = h / 1216.0
    return fig(n, h, round(cx - HEADS[FILE[n]]['cx'] * s), top, extra)

def face(n, w=150, h=172, srcw=380, lift=30, dx=0):
    hd = HEADS[FILE[n]]; s = w / srcw
    return ('<span class="face" style="width:%dpx;height:%dpx"><img src="%s" style="width:%.1fpx;left:%.1fpx;top:%.1fpx"></span>'
            % (w, h, agent(n), 832 * s, -(hd['cx'] + dx - srcw / 2) * s, -(hd['top'] - lift) * s))

def an(f):
    return U('assets/wiki/Anomalies/%s.avif' % f)

def pic(src, w, h=None, style='', pos='50% 50%'):
    h = h or w
    return '<div class="pic" style="width:%dpx;height:%dpx;background-image:url(\'%s\');background-position:%s;%s"></div>' % (w, h, src, pos, style)

# ───────────────────────── .arca 조각 도우미 ─────────────────────────
SERIF = "'Noto Serif KR','Nanum Myeongjo','AppleMyungjo','Batang',serif"
SANS = "'Pretendard','Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif"
LT = dict(bg=PAPER, fg=INK, gray=GRAY, line='#d9d5cc', guard='background:linear-gradient(180deg,%s,%s);background-color:rgba(0,0,0,0.004);' % (PAPER, PAPER))
DK = dict(bg=INK, fg=PAPER, gray=DGRAY, line='#3a3835', guard='')

def arca(inner, pad='34px 6% 40px', T=LT):
    return ('<div class="arca"><div style="background:linear-gradient(180deg,%s,%s);%scolor:%s;padding:%s;font-family:%s;font-size:15px;line-height:1.7;word-break:keep-all;">%s</div></div>\n'
            % (T['bg'], T['bg'], 'background-color:rgba(0,0,0,0.004);' if T is LT else '', T['fg'], pad, SANS, inner))

def a_quote(text, src, size=19, T=LT):
    return ('<div style="margin:0 0 26px 0;"><div style="font-family:%s;font-size:%dpx;line-height:1.55;font-weight:700;letter-spacing:-0.03em;color:%s;%s">“%s”</div>'
            '<div style="font-family:%s;font-size:14px;line-height:1.5;color:%s;%smargin-top:8px;">%s</div></div>' % (SERIF, size, T['fg'], T['guard'], text, SANS, T['gray'], T['guard'], src))

def a_label(t, T=LT):
    return ('<div style="font-family:%s;font-size:14px;font-weight:700;color:%s;%smargin:0 0 14px 0;">%s</div>' % (SANS, T['fg'], T['guard'], t))

def a_rows(rows, T=LT):
    """항목 이름 위, 값 아래. PC 에서는 2단, 폰에서는 1단."""
    out = ''
    for k, v in rows:
        out += ('<div style="display:inline-block;width:46%%;min-width:236px;vertical-align:top;margin:0 3%% 16px 0;border-top:1px solid %s;padding-top:8px;">'
                '<div style="font-family:%s;font-size:14px;line-height:1.4;color:%s;%s">%s</div>'
                '<div style="font-family:%s;font-size:17px;line-height:1.5;font-weight:700;letter-spacing:-0.03em;color:%s;%s">%s</div></div>'
                % (T['line'], SANS, T['gray'], T['guard'], k, SERIF, T['fg'], T['guard'], v))
    return '<div style="margin:0 0 14px 0;">%s</div>' % out

def a_info(title, keys, T=LT):
    return a_rows([(k, IB(title, k, T)) for k in keys], T)

P = []  # 조각들

# ════════════════ 1. 표지 ════════════════
q, s = Q('에일린', 3)
P.append(f'''<section class="plate" data-name="cover" style="height:1500px">
  <div class="mast">괴이</div>
  {fig('에일린', 1290, 150, 250)}
  <div class="sub" style="left:54px;top:528px"><i class="red">ː</i>ANOMALY</div>
  <div class="cap" style="left:56px;top:660px;width:300px">RisuAI용<br>괴담 시뮬레이션 봇</div>
  <div class="coverq" style="left:54px;top:850px;width:340px">“{br(q, '하는', '쓰레기', '회사랑')}”</div>
  <div class="cap gray" style="left:56px;top:1150px;width:300px">에일린<br>{s}</div>
  <div style="position:absolute;left:0;right:0;top:1404px;height:96px;background:{PAPER}"></div>
  <div class="rule" style="left:54px;right:54px;top:1404px"></div>
  <div class="cap" style="left:54px;top:1424px;right:54px">인물 55 · 괴이 63 · 조직 17 · 위키 문서 143</div>
</section>''')

# ════════════════ 2. 근무 수칙 (조용한 장) ════════════════
r2 = GR('A00-ko-3', '2. 이상현상에 대한 자료를 전자기기에 입력하지 마십시오. 이는 안전을 위한 것입니다.')
r3a = GR('A00-ko-3', '3. 식사 시간을 준수해 주십시오.'); r3b = GR('A00-ko-3', '이는 안전을 위한 것입니다.')
r7 = GR('A00-ko-3', '7. 관리국의 불이 꺼지는 일은 없습니다. 불이 꺼졌다고 생각될 경우 그 무엇도 믿지 말고 당장 건물 바깥으로 탈출하십시오. 이는 안전을 위한 것입니다.')
P.append(f'''<section class="plate" data-name="rules" style="padding:90px 54px 80px">
  <div class="cap gray" style="position:static">첫 장면 「근무 수칙」에서</div>
  <p class="small gray" style="margin:50px 0 0;width:660px">{r2}</p>
  <p class="huge" style="margin:44px 0 0">{br(r3a, '3.', '시간을', '준수해')}</p>
  <p class="huge thin" style="margin:6px 0 0">{br(r3b, '안전을')}</p>
  <p class="small" style="margin:64px 0 0 190px;width:562px;font-weight:700">{r7}</p>
</section>''')

q, s = Q('불이 꺼진 관리국', 0)
P.append(arca(a_quote(q, s) + a_rows([('불이 꺼진 관리국 · 공식 입장', IB('불이 꺼진 관리국', '공식 입장', LT)), ('비공식 입장', IB('불이 꺼진 관리국', '비공식 입장', LT))])
              + a_label('관리국') + a_info('관리국', ['본부', '인원', '사내 분위기', '회식'])))

# ════════════════ 3. 소라 랜드 (큰 도판) ════════════════
P.append(f'''<section class="plate" data-name="soraland">
  {pic(an('Sora Land'), 860, 800, pos='50% 60%')}
  <div style="padding:46px 54px 70px">
    <div class="h1">소라 랜드</div>
    <div class="irow first"><span>분류</span><b>{IB('소라 랜드','분류')}</b></div>
    <div class="irow"><span>영업시간</span><b>{IB('소라 랜드','영업시간')}</b></div>
    <div class="irow"><span>마스코트</span><b>{IB('소라 랜드','마스코트')}</b></div>
    <div class="irow last"><span>재방문 후기</span><b class="giant">{IB('소라 랜드','재방문 후기')}</b></div>
  </div>
</section>''')
q, s = Q('소라 랜드', 1)
P.append(arca(a_quote(q, s), pad='10px 6% 30px'))

# ════════════════ 4. 시작하는 자리: 관리국 ↔ 가짜 관리국 (천적) ════════════════
P.append(f'''<section class="plate" data-name="start-a">
  <div style="padding:70px 54px 0">
    <div class="kicker">시작하는 자리 <em>세력 다섯 곳</em></div>
    <div style="margin-top:56px;overflow:hidden">
      {pic(U('assets/wiki/Factions/Management Bureau.avif'), 300, 380, style='float:right;margin:14px 0 0 30px', pos='60% 50%')}
      <div class="fname" style="font-size:150px">관리국</div>
      <p class="fblurb">{blurb('관리국')}</p>
    </div>
    {scn('관리국')}
    <div class="irow first" style="margin-top:44px;border-top-width:1.5px"><span>천적</span><b>{IB('관리국','천적')}</b></div>
  </div>
  <div class="dkband" style="padding:0 54px 76px">
    <div class="irow" style="border-top:0"><span>관리국과의 관계</span><b>{IB('가짜 관리국','관리국과의 관계')}</b></div>
    <div style="margin-top:40px;overflow:hidden">
      {pic(U('assets/wiki/Factions/Fake Management Bureau.avif'), 236, 300, style='float:left;margin:10px 30px 0 0')}
      <div class="fname" style="font-size:94px">가짜 관리국</div>
      <p class="fblurb">{blurb('가짜 관리국')}</p>
    </div>
    {scn('가짜 관리국')}
  </div>
</section>''')

# ════════════════ 5. 시작하는 자리: 백일몽 · 민간인 · 프리랜서 ════════════════
P.append(f'''<section class="plate" data-name="start-b">
  {pic(U('assets/wiki/Factions/Baekilmong.avif'), 860, 330, pos='50% 46%')}
  <div style="padding:34px 54px 0">
    <div class="fname" style="font-size:104px">백일몽 주식회사</div>
    <div style="display:flex;margin-top:6px">
      <p class="fblurb" style="flex:0 0 350px;margin-right:40px">{blurb('백일몽 주식회사')}</p>
      <div style="flex:1">{scn('백일몽 주식회사')}</div>
    </div>
  </div>
  <div style="display:flex;margin-top:90px;padding-right:54px">
    {pic(U('assets/wiki/Factions/Civilian.avif'), 330, 560, pos='55% 50%')}
    <div style="flex:1;padding:20px 0 0 40px">
      <div class="fname" style="font-size:128px">민간인</div>
      <p class="fblurb">{blurb('민간인')}</p>
      {scn('민간인')}
    </div>
  </div>
  <div style="display:flex;margin-top:90px;padding:0 54px 84px;align-items:flex-end">
    <div style="flex:1;padding-right:36px">
      <div class="fname" style="font-size:112px">프리랜서</div>
      <p class="fblurb">{blurb('프리랜서')}</p>
      {scn('프리랜서')}
    </div>
    {pic(U('assets/wiki/Factions/Freelancer.avif'), 250, 250)}
  </div>
</section>''')

# ════════════════ 6. 쟈알디 ════════════════
q, s = Q('쟈알디', 2)
P.append(f'''<section class="plate" data-name="jyaldi" style="height:1400px">
  <div class="kicker abs" style="left:54px;top:70px;right:54px">인물 <em>관리국 종합대응팀</em></div>
  {fig('쟈알디', 1190, -250, 150)}
  <div class="col" style="left:508px;top:190px;width:310px">
  <div class="bigq" style="font-size:72px">“{br(q, '하아.', '잼트리.', '이것 좀', '어떻게')}”</div>
  <div class="cap gray" style="margin-top:34px">쟈알디<br>{br(s, '사무실에서')}</div>
  <div class="mini" style="margin-top:56px">
    <div><span>직책</span>{IB('쟈알디','직책').replace(' <s>', '<br><s>')}</div>
    <div><span>커피</span>{IB('쟈알디','커피')}</div>
    <div><span>특기</span>{br(IB('쟈알디','특기'), '면담,')}</div>
  </div></div>
  <div style="position:absolute;left:0;right:0;top:1296px;height:104px;background:{PAPER}"></div>
  <div class="rule" style="left:54px;right:54px;top:1296px"></div>
</section>''')

# ════════════════ 7. 3인조 ════════════════
t3 = IB('데드폴', '소속 조')
trio = [('데드폴', Q('데드폴', 3), ('사망 횟수', IB('데드폴', '사망 횟수'))),
        ('게슈간', Q('게슈간', 0), ('사과', IB('게슈간', '사과'))),
        ('로제몬', Q('로제몬', 1), ('전투력', br(IB('로제몬', '전투력'), '없음')))]
cols = ''
for i, (n, (q, s), (k, v)) in enumerate(trio):
    cols += f'''<div class="tcol" style="left:{54+i*262}px"><b>{n}</b><p>“{q}”</p><i>{s}</i><u><span>{k}</span> {v}</u></div>'''
P.append(f'''<section class="plate" data-name="trio" style="height:1450px">
  <div class="h2" style="position:absolute;left:54px;top:10px">{t3}</div>
  {fig('데드폴', 780, -60, 150)}{fig('게슈간', 780, 180, 160)}{fig('로제몬', 780, 420, 150)}
  <div style="position:absolute;left:0;right:0;top:920px;bottom:0;background:{PAPER}"></div>
  <div class="rule" style="left:54px;right:54px;top:920px"></div>
  {cols.replace('class="tcol" style="', 'class="tcol" style="top:950px;')}
</section>''')

# ════════════════ 8. 종합대응팀 단체 ════════════════
back = ['쟈알디', '스팡달', '잼트리', '에일린']; front = ['데드폴', '게슈간', '로제몬', '콘쥬스']
bx = [176, 366, 556, 746]; fx = [82, 272, 462, 652]
g = ''.join(figc(n, 670, x, 150) for n, x in zip(back, bx)) + ''.join(figc(n, 680, x, 300) for n, x in zip(front, fx))
nm = ''.join(f'<div class="gname" style="left:{x-90}px;top:92px">{n}</div>' for n, x in zip(back, bx))
nm += ''.join(f'<div class="gname" style="left:{x-90}px;top:824px">{n}</div>' for n, x in zip(front, fx))
P.append(f'''<section class="plate" data-name="bureau-team" style="height:910px">
  <div class="cap gray" style="left:54px;top:20px">종합대응팀</div>
  {g}
  <div style="position:absolute;left:0;right:0;top:800px;bottom:0;background:{PAPER}"></div>
  <div class="rule" style="left:54px;right:54px;top:800px"></div>
  {nm}
</section>''')

# ════════════════ 9. 진압팀 · 격리팀 ════════════════
q1, s1 = Q('큐라스', 0); q2, s2 = Q('고그니쟈', 2)
P.append(f'''<section class="plate" data-name="bureau-pairs" style="height:1110px">
  {figc('고르고디오', 700, 300, 40)}{figc('큐라스', 640, 120, 100)}
  {figc('고그니쟈', 640, 590, 100)}{figc('데쥬레', 590, 760, 150)}
  <div style="position:absolute;left:0;right:0;top:640px;bottom:0;background:{PAPER}"></div>
  <div class="rule" style="left:54px;width:356px;top:640px"></div>
  <div class="rule" style="left:450px;width:356px;top:640px"></div>
  <div class="pcol" style="left:54px;top:660px"><span>진압팀</span><b>큐라스 · 고르고디오</b><p>“{q1}”</p><i>{s1}</i></div>
  <div class="pcol" style="left:450px;top:660px"><span>격리팀</span><b>고그니쟈 · 데쥬레</b><p>“{q2}”</p><i>고그니쟈 — {s2}</i></div>
</section>''')

# ════════════════ 10. 가짜 관리국: 물량 ════════════════
q, s = Q('김조학', 2, cut='대학은 왜 가? 좋은 직장 가려고 가는 거잖아. 축하해, 취직했어. 요원으로.')
line = ['이길환', '송주익', '고영훈', '김조학', '노기균', '윤병수', '곽성주']
figs = ''.join(fig(n, 660, -70 + i * 112, 420 + (0 if i % 2 == 0 else 18)) for i, n in enumerate(line))
P.append(f'''<section class="plate" data-name="fake-bureau" style="height:1560px">
  <div class="kicker abs" style="left:54px;top:70px;right:54px">가짜 관리국 <em>운영 방식</em></div>
  <div class="mega" style="left:40px;top:120px">{IB('가짜 관리국','운영 방식')}</div>
  {figs}
  <div style="position:absolute;left:0;right:0;top:1080px;height:480px;background:{PAPER}"></div>
  <div class="rule" style="left:54px;right:54px;top:1080px"></div>
  <div class="midq" style="left:54px;top:1112px;width:750px">“{br(q, '가려고', '취직했어.')}”</div>
  <div class="cap gray" style="left:54px;top:1356px;width:740px">김조학 — {s}</div>
  <div class="mini wide" style="left:54px;top:1430px;width:752px">
    <div><span>복장</span>{IB('가짜 관리국','복장')}</div>
    <div><span>모집 방식</span>{IB('가짜 관리국','모집 방식')}</div>
  </div>
</section>''')

# ════════════════ 11. 가짜 관리국 14명: 빽빽한 띠 ════════════════
q, s = Q('이길환', 1)
f14 = ['사장', '도필헌', '이길환', '이기석', '김조학', '이도형', '고영훈', '노기균', '송주익', '곽성주', '조성춘', '윤병수', '김성진', '송진섭']
band = ''.join('<div class="bc">%s<b>%s</b></div>' % (face(n, 108, 128, 330, 24), n) for n in f14)
P.append(f'''<section class="plate" data-name="fake-faces" style="padding:40px 0 80px">
  <p class="midq" style="position:static;margin:0 54px;font-size:44px;line-height:1.5">“{q}”</p>
  <div class="cap gray" style="position:static;margin:24px 54px 0">이길환 — {s}</div>
  <div class="band" style="margin:70px 52px 0">{band}</div>
</section>''')
q2, s2 = Q('송주익', 2)
P.append(arca(a_quote(q2, '송주익 — ' + s2) + a_rows([('가짜 관리국 · 자칭', IB('가짜 관리국', '자칭', LT)), ('표어', IB('가짜 관리국', '표어', LT))]), pad='6px 6% 40px'))

# ════════════════ 12. 이자헌 「예.」 ════════════════
q, s = Q('이자헌', 1)
P.append(f'''<section class="plate" data-name="jaheon" style="height:1380px">
  <div class="kicker abs" style="left:54px;top:70px;right:54px">백일몽 주식회사 <em>현장탐사팀 D조</em></div>
  <div class="ye" style="left:24px;top:130px">{q}</div>
  {fig('이자헌', 1220, 330, 190)}
  <div class="col" style="left:56px;top:760px;width:300px">
  <div class="cap gray">이자헌<br>{s}</div>
  <div class="mini" style="margin-top:60px">
    <div><span>가면</span>{IB('이자헌','가면')}</div>
    <div><span>장비</span>{IB('이자헌','장비')}</div>
    <div><span>말투</span>{IB('이자헌','말투')}</div>
  </div></div>
</section>''')
q, s = Q('백일몽', 1)
P.append(arca(a_quote(q, s) + a_label('백일몽 주식회사') + a_info('백일몽', ['실제 상품', '입사 시험', '퇴사', '복지'])))

# ════════════════ 13. 백일몽 16명: 가면 ════════════════
field = ['백석주', '진나솔', '이성해', '이자헌', '은하제', '박민성', '백사헌', '고영은', '강이학', '장허운']
mc = ''.join('<div class="mc">%s<b>%s</b><i>%s</i></div>' % (face(n, 138, 160), n, IB(n, '가면').replace('금빛 ', '금빛<br>')) for n in field)
staff = [('청달래', '개발본부<br>임원'), ('호유원', ''), ('이병진', '행정지원'), ('곽제강', '연구1팀'), ('이연화', '연구1팀'), ('제이', '보안관리부')]
st = ''.join('<div class="sc">%s<div><b>%s</b><i>%s</i></div></div>' % (face(n, 112, 132, 330, 24), n, d) for n, d in staff)
P.append(f'''<section class="plate" data-name="daydream-masks" style="padding:30px 54px 80px">
  <div class="glabel"><b>현장탐사팀</b> 가면</div>
  <div class="mgrid">{mc}</div>
  <div class="sgrid">{st}</div>
  <div class="mini wide" style="position:static;margin-top:40px">
    <div><span>이병진 · 가면</span>{IB('이병진','가면')}</div>
    <div><span>곽제강 · 가면</span>{IB('곽제강','가면')}</div>
  </div>
</section>''')
q, s = Q('박민성', 0); q2, s2 = Q('제이', 1)
P.append(arca(a_quote(q, s) + a_quote(q2, '제이 — ' + s2), pad='6px 6% 40px'))

# ════════════════ 14. 이면의 주민들 ════════════════
RES = ['차여진', '서윤지', '고연지', '윤지아', '마덕희', '문혜란', '신유리', '블라렛', '살라딘', '아벤샤', '세크리엠', '탐미주의', '브라우니']
keys = sorted(SC.keys()); assert len(keys) == 13
TITLE = {}
for n, k in zip(RES, keys):
    assert n in SC[k]['ko'][:1500], (n, k)
    TITLE[n] = SC[k]['label']
def stitle(n):
    USED.append((TITLE[n], 'scenes.json 첫 장면 제목 (%s)' % n)); return TITLE[n]
P.append(f'''<section class="plate" data-name="residents" style="height:1010px">
  {pic(U('assets/wiki/Factions/Residents of the Hidden World.avif'), 640, 860, style='position:absolute;right:0;top:70px', pos='42% 50%')}
  <div class="vert" style="left:50px;top:70px">이면의 주민들</div>
  <div class="cap" style="left:54px;top:800px;width:160px"><b>13명</b></div>
  <div class="cap gray" style="left:54px;top:846px;width:160px">그 인물로<br>시작하는<br>첫 장면</div>
</section>''')

# ════════════════ 15. 중림 지하상가 ════════════════
q, s = Q('마덕희', 2)
jn = ['고연지', '윤지아', '마덕희', '문혜란', '신유리']
jf = ''.join('<div class="jc">%s</div>' % face(n, 150, 176) for n in jn)
jl = ''.join('<div><span>%s</span><b>%s</b></div>' % (n, stitle(n)) for n in jn)
P.append(f'''<section class="plate" data-name="jungnim" style="height:1450px">
  <div class="cap" style="left:54px;top:60px"><b>중림 지하상가</b> <span class="gray">{IB('마덕희','가게')}</span></div>
  {fig('마덕희', 760, 420, 130)}
  <div class="eighty" style="left:40px;top:150px">{q.split(' ')[0]}</div>
  <div class="col" style="left:54px;top:450px;width:400px">
  <div class="midq" style="font-size:46px">“{br(q, '끝났어요.')}”</div>
  <div class="cap gray" style="margin-top:22px">마덕희 — {s}</div></div>
  <div style="position:absolute;left:0;right:0;top:780px;height:670px;background:{PAPER};padding:0 54px">
    <div class="rule" style="position:static"></div>
    <div class="jrow">{jf}</div>
    <div class="jlist">{jl}</div>
  </div>
</section>''')
q, s = Q('고연지', 3); q3, s3 = Q('프리랜서', 0)
P.append(arca(a_quote(q, '고연지 — ' + s) + a_quote(q3, s3), pad='6px 6% 40px'))

# ════════════════ 16. 특수재난대응협회 ════════════════
qa, sa = Q('차여진', 1); qb, sb = Q('서윤지', 3)
P.append(f'''<section class="plate" data-name="association" style="height:1400px">
  {figc('차여진', 900, 250, 60)}{figc('서윤지', 860, 560, 110)}
  <div style="position:absolute;left:0;right:0;top:800px;bottom:0;background:{PAPER}"></div>
  <div class="rule" style="left:54px;right:54px;top:800px"></div>
  <div class="cap" style="left:54px;top:816px;right:54px"><b>특수재난대응협회</b> <span class="gray">의뢰조정실</span></div>
  <div class="pcol" style="left:54px;top:900px;width:356px"><b>차여진</b><p>“{qa}”</p><i>{sa}</i><u><span>첫 장면</span>{stitle('차여진')}</u></div>
  <div class="pcol" style="left:450px;top:900px;width:356px"><b>서윤지</b><p>“{qb}”</p><i>{sb}</i><u><span>첫 장면</span>{stitle('서윤지')}</u></div>
</section>''')

# ════════════════ 17. 탐미주의 ════════════════
q, s = Q('탐미주의', 0)
qq = br(q, '멀리.', '맡겨라.', '것이다.', '죽어라.')
P.append(f'''<section class="plate" data-name="aestheticism" style="height:1500px">
  <div style="position:absolute;right:0;top:0">{face('탐미주의', 470, 600, 520, 40)}</div>
  <div class="cap" style="left:54px;top:70px;width:330px"><b>탐미주의</b><br><span class="gray">{IB('탐미주의','소속')}</span></div>
  <div class="cap gray" style="left:54px;top:420px;width:330px">{s}</div>
  <div class="run" style="left:28px;top:470px">{IB('탐미주의','공식 대응 지침')}</div>
  <p class="midq" style="left:54px;top:770px;width:752px;font-size:42px;line-height:1.56">{qq}</p>
  <div class="mini wide" style="left:54px;top:1290px;width:752px">
    <div><span>화구</span><em>{IB('탐미주의','화구')}</em></div>
    <div><span>첫 장면</span>{stitle('탐미주의')}</div>
  </div>
</section>''')

# ════════════════ 18. 브라우니 ════════════════
q, s = Q('브라우니', 2)
P.append(f'''<section class="plate" data-name="brownie" style="height:1450px">
  <div class="bigq" style="left:54px;top:60px;width:780px;font-size:80px">“{br(q, '볼게요.')}”</div>
  <div class="cap gray" style="left:58px;top:270px;width:700px">브라우니 — {s}</div>
  {figc('브라우니', 1040, 330, 350)}
  {pic(an('Tuesday Quiz Show'), 200, 200, style='position:absolute;right:54px;top:420px')}
  <div style="position:absolute;left:0;right:0;top:1170px;bottom:0;background:{PAPER}"></div>
  <div class="mini wide" style="left:54px;top:1170px;width:752px">
    <div><span>소속</span><em>{IB('브라우니','소속')}</em></div>
    <div><span>호칭</span><em>{IB('브라우니','호칭')}</em></div>
    <div><span>첫 장면</span><em>{stitle('브라우니')}</em></div>
  </div>
</section>''')

# ════════════════ 19. 블라렛 · 살라딘 · 아벤샤 · 세크리엠 (한 사람씩) ════════════════
four = [('블라렛', IB('블라렛', '소속'), Q('블라렛', 1)), ('살라딘', IB('살라딘', '소속'), Q('살라딘', 2)),
        ('아벤샤', IB('아벤샤', '소속'), Q('아벤샤', 3)), ('세크리엠', IB('세크리엠', '분류'), Q('흡혈귀', 0))]
tiles = ''
for i, (n, aff, (q, s)) in enumerate(four):
    left = 54 if i % 2 == 0 else 448; top = [70, 250, 880, 1060][i]
    tiles += f'''<div class="solo" style="left:{left}px;top:{top}px">{face(n, 358, 290 if n == '세크리엠' else 430, 640, 36)}<div class="srule"></div><b>{n}</b><i>{aff}</i><p>“{q}”</p><u><span>첫 장면</span>{stitle(n)}</u></div>'''
P.append(f'''<section class="plate" data-name="solos" style="height:1830px">{tiles}</section>''')

# ════════════════ 20. 괴이: 심연교통공사 (여기부터 먹바탕) ════════════════
q, s = Q('심연교통공사', 0, cut='이번 역은, 슬픔, 슬픔역입니다. 내리실 문은 오른쪽입니다.')
P.append(f'''<section class="plate dk" data-name="abyss" style="height:1390px">
  <div class="kicker abs" style="left:54px;top:90px;right:54px">괴이 <em>63곳</em></div>
  {pic(an('Abyss Transit Authority'), 470, 1100, style='position:absolute;left:0;top:190px', pos='38% 50%')}
  <div class="midq" style="left:520px;top:190px;width:300px;font-size:50px;line-height:1.36">“{br(q, '역은,', '슬픔,', '문은')}”</div>
  <div class="cap gray" style="left:522px;top:700px;width:290px">{s.split('.')[0]}</div>
  <div class="mini" style="left:522px;top:850px;width:290px">
    <div><span>탑승 방법</span>{IB('심연교통공사','탑승 방법').replace(' <s>', '<br><s>')}</div>
    <div><span>노선도</span>{IB('심연교통공사','노선도')}</div>
    <div><span>정차역</span>{IB('심연교통공사','정차역')}</div>
  </div>
</section>''')

# ════════════════ 21. 원숭이 꿈 괴담 ════════════════
q, s = Q('원숭이 꿈 괴담', 2)
P.append(f'''<section class="plate dk" data-name="monkey" style="height:900px">
  {pic(an('Monkey Dream'), 380, 760, style='position:absolute;right:0;top:0', pos='62% 50%')}
  <div class="midq" style="left:54px;top:70px;width:390px;font-size:46px;line-height:1.42">“{q}”</div>
  <div class="cap gray" style="left:54px;top:500px;width:380px">원숭이 꿈 괴담<br>{s.split('.')[0]}</div>
  <div class="mini wide" style="left:54px;top:790px;width:752px">
    <div><span>다음 역</span><em>{IB('원숭이 꿈 괴담','다음 역')}</em></div>
  </div>
</section>''')

# ════════════════ 22. 괴이: 크기가 다른 도판들 ════════════════
def plateitem(f, size, left, top, title, key, capw=None, capleft=None, captop=None):
    v = IB(title, key)
    cl = left if capleft is None else capleft
    ct = top + size + 14 if captop is None else captop
    return (pic(an(f), size, style=f'position:absolute;left:{left}px;top:{top}px')
            + f'<div class="pcap" style="left:{cl}px;top:{ct}px;width:{capw or size}px"><b>{title}</b><span>{key}</span> {v}</div>')
P.append(f'''<section class="plate dk" data-name="plates" style="height:1640px">
  {plateitem('Lookymart', 520, 0, 60, '룩키마트', '층수', capw=600, capleft=54)}
  {plateitem('Dimensional Elevator', 200, 606, 60, '차원 승강기', '층수', capw=250, capleft=556, captop=276)}
  {plateitem('Myeongil Apartment', 300, 506, 780, '명일 아파트', '엘리베이터', capw=310, capleft=506)}
  {plateitem('Cheongak Mary Hospital', 210, 54, 900, '청악메리병원', '퇴사', capw=330)}
  {plateitem('Tuesday Quiz Show', 300, 54, 1270, '화요퀴즈쇼', '방청객', capw=400, capleft=390, captop=1270)}
</section>''')
q, s = Q('룩키마트', 1); q2, s2 = Q('차원 승강기', 0)
P.append(arca(a_quote(q, '룩키마트 — ' + s, T=DK) + a_quote(q2, s2, T=DK), pad='10px 6% 30px', T=DK))

# ════════════════ 23. 괴이: 정보상자 농담 셋 ════════════════
def joke(title, key, cls=''):
    v = W[title]['infobox'][key]; USED.append(('%s: %s' % (key, v), '위키 「%s」 정보상자' % title))
    m = re.match(r'^(.*?) ✂️(.*)✂️$', v); assert m, v
    return '<div class="joke %s"><span>%s · <span style="display:inline;white-space:nowrap">%s</span></span><b>%s</b><s>%s</s></div>' % (cls, title, key, m.group(1).replace('❗', ''), m.group(2))
P.append(f'''<section class="plate dk" data-name="jokes">
  {pic(an('The Riverside'), 860, 380, pos='50% 62%')}
  <div style="padding:30px 54px 0">{joke('강변', '위치')}</div>
  <div style="display:flex;margin-top:110px;align-items:flex-end">
    {pic(an('Mystery World Adventure Park'), 330, 440, pos='30% 50%')}
    <div style="flex:1;padding:0 54px 0 36px">{joke('미스테리 월드 어드벤쳐 파크', '입장 방법', 'big')}</div>
  </div>
  <div style="display:flex;margin-top:110px;padding:0 0 90px 54px;align-items:flex-start">
    <div style="flex:1;padding-right:30px">{joke('영원마을', '화폐', 'huge2')}</div>
    {pic(an('Yeongwon Village'), 260, 340)}
  </div>
</section>''')

# ════════════════ 24·25. 괴이: 크기를 섞은 도판 ════════════════
def tile(f, w, h, name, cap='', pos='50% 50%'):
    return '<div class="tile" style="width:%dpx">%s<b>%s</b>%s</div>' % (w, pic(an(f), w, h, pos=pos), name, ('<i>%s</i>' % cap) if cap else '')
def capib(t, k):
    return '<em>%s</em> %s' % (k, IB(t, k).replace('<s>', '<s style="white-space:nowrap">'))
P.append(f'''<section class="plate dk" data-name="mosaic-a" style="padding:0 0 70px">
  {pic(an('Samangdan'), 860, 400, pos='50% 58%')}
  <div class="wcap"><b>사망단길</b>{capib('사망단길', '결제 수단')}</div>
  <div class="trow" style="margin-top:70px">
    {tile('Jogyesa', 240, 240, '조계사', capib('조계사', '이용 후기'))}
    {tile('Forbidden Video', 240, 240, '금지된 비디오', capib('금지된 비디오', '러닝타임'))}
    {tile('Hanseol Human Meat Factory', 240, 240, '한설인육공장', capib('한설인육공장', '입구'))}
  </div>
  <div class="trow" style="margin-top:70px">
    {tile('Fearble Theater', 300, 420, '피어블 극장', capib('피어블 극장', '주 관객층'), '30% 50%')}
    {tile('Flower Golden Resort', 436, 420, '플라워 골든 리조트', capib('플라워 골든 리조트', '퇴실'))}
  </div>
</section>''')
st4 = [('Midnight Station', '자정역'), ('Dusk Station', '황혼역'), ('Morning Station', '아침역'), ('Midday Station', '한낮역')]
stn = ''.join('<div class="stn">%s<b>%s</b><i>%s</i></div>' % (pic(an(f), 215, 300), n, IB(n, '부역명')) for f, n in st4)
P.append(f'''<section class="plate dk" data-name="mosaic-b" style="padding:20px 0 80px">
  <div class="wcap" style="margin-bottom:22px"><b>세광 순환선</b><em>부역명</em></div>
  <div style="display:flex">{stn}</div>
  <div class="trow" style="margin-top:90px;align-items:flex-end">
    {tile('Hungry Hangman', 470, 330, '헝그리 행맨', capib('헝그리 행맨', '원아'), '50% 40%')}
    {tile('Living Orphanage', 266, 266, '살아있는 보육원', capib('살아있는 보육원', '조명'))}
  </div>
  <div class="trow" style="margin-top:70px">
    {tile('Frost Waterpark', 240, 240, '프러스트 워터파크')}
    {tile('Sotos Department Store', 240, 240, '소토스 백화점')}
    {tile('Fairytale Park', 240, 240, '페어리테일 파크')}
  </div>
  <div style="margin-top:90px">{pic(an('Segwang Special City'), 860, 300, pos='50% 40%')}</div>
  <div class="wcap"><b>세광특별시</b>{capib('세광특별시', '인구').replace('수십만, ', '수십만,<br>')}</div>
</section>''')
more = [('인류의 신비전', '관람료'), ('샛별 고시원', '방 크기'), ('한밤역', '입장료'), ('코즈믹 판타지 동물원', '전시 동물')]
P.append(arca(a_label('괴이위키 정보상자에서', DK) + a_rows([('%s · %s' % (t, k), IB(t, k, DK)) for t, k in more], DK), pad='10px 6% 50px', T=DK))

# ════════════════ 26~29. 화면 (먹바탕) ════════════════
SCR = 'file://' + uq(KIT + '/screens/')
def crop(path, w, x0, y0, x1, y1, srcw, style=''):
    """원본 px 기준 (x0,y0)-(x1,y1) 를 폭 w 로."""
    s = w / (x1 - x0)
    return ('<div class="shot" style="width:%dpx;height:%dpx;background-image:url(\'%s\');background-size:%.1fpx auto;background-position:%.1fpx %.1fpx;%s"></div>'
            % (w, round((y1 - y0) * s), SCR + uq(path), srcw * s, -x0 * s, -y0 * s, style))
P.append(f'''<section class="plate dk" data-name="screen-talk" style="padding:90px 0 0">
  <div class="kicker" style="margin:0 54px">화면 <em>실제 캡처</em></div>
  <div class="slab" style="margin:50px 54px 40px"><b>괴담톡</b><span>연락처 · 대화 · 공지 · 전화 · 단톡</span></div>
  {crop('promo/phone-play-04-phone.png', 860, 0, 130, 780, 1160, 780)}
</section>''')
P.append(f'''<section class="plate dk" data-name="screen-hs" style="padding:110px 0 0">
  <div class="slab" style="margin:0 54px 40px"><b>망상홈쇼핑</b><span>인터넷 · 생방송</span></div>
  {crop('s-hs/phone_2_진행자.png', 860, 0, 302, 780, 1122, 780)}
</section>''')
P.append(f'''<section class="plate dk" data-name="screen-map" style="padding:110px 0 0">
  <div style="display:flex;align-items:flex-end">
    {crop('promo/phone-play-03-map.png', 500, 18, 252, 762, 836, 780)}
    <div class="slab" style="margin:0 54px 0 36px"><b>임무</b><span>지도에서 장소를 골라 요원 넷을 편성해 출동 · 커스텀 임무</span></div>
  </div>
  <div class="slab" style="margin:120px 54px 40px"><b>기록</b><span>일지 · 연대기 · 인물 · 세력</span></div>
  {crop('s-chron/phone_연대기.png', 860, 0, 238, 780, 1090, 780)}
</section>''')
P.append(f'''<section class="plate dk" data-name="screen-net" style="padding:110px 0 90px">
  <div class="slab" style="margin:0 54px 40px"><b>인터넷</b><span>괴담넷 · 괴담 갤러리 · 세정게 · 연어 마켓 · 우주 쇼핑몰 · 괴이위키 · 백일몽 포인트몰 · 망상홈쇼핑</span></div>
  {crop('s-malls/pc-01-cos.png', 860, 628, 436, 2390, 868, 2560)}
  <div class="scap">우주 쇼핑몰</div>
  {crop('s-boards/pc-08-wpf.png', 860, 630, 436, 2384, 700, 2560, 'margin-top:70px')}
  <div class="scap">세계정치 게시판</div>
  <div style="display:flex;align-items:flex-end;margin-top:70px">
    {crop('s-wiki/phone-05-doc.png', 470, 0, 440, 780, 1480, 780)}
    <div class="slab" style="flex:1;margin:0 54px 0 36px"><b style="font-size:72px">괴이위키</b><span>문서 143개</span></div>
  </div>
</section>''')
facts = [('상황판', '요원 화면 · 지금 벌어진 괴이 / 사건 / 특수 상황'), ('소지품', '무기 2칸 · 장비 4칸 장착 · 가계부'), ('그림', '인물당 표정 41종'), ('언어', '한국어 · English')]
P.append(arca(a_rows(facts, DK), pad='40px 6% 50px', T=DK))

# ════════════════ 30. 맺음 ════════════════
q, s = Q('잼트리', 0)
P.append(f'''<section class="plate" data-name="closing" style="height:1120px">
  {fig('잼트리', 1080, 330, 90)}
  <div class="bigq" style="left:54px;top:150px;width:420px;font-size:92px">“{br(q, '어머,', '후배,')}”</div>
  <div class="cap gray" style="left:58px;top:620px;width:300px">잼트리<br>{s}</div>
</section>''')
URL = 'https://github.com/leepc25/goei-plugin/releases/latest'
T = LT
P.append(arca(
    '<div style="border-top:1px solid %s;padding-top:26px;">' % INK
    + '<div style="font-family:%s;font-size:28px;line-height:1.3;font-weight:900;letter-spacing:-0.03em;color:%s;%s">괴이 ː ANOMALY</div>' % (SERIF, INK, T['guard'])
    + '<div style="font-size:14px;color:%s;%smargin:6px 0 22px 0;">RisuAI용 괴담 시뮬레이션 봇 · 인물 55명 · 괴이 63곳 · 조직 17곳 · 특수 장소 11곳</div>' % (GRAY, T['guard'])
    + '<a href="%s" target="_blank" rel="noopener noreferrer" style="text-decoration:none;"><span style="display:inline-block;padding:15px 44px;background:linear-gradient(180deg,#141312,#141312);border:1px solid #141312;color:#f5f3ee;font-family:%s;font-size:17px;font-weight:700;">받기</span></a>' % (URL, SERIF)
    + '<div style="font-size:14px;color:%s;%smargin-top:14px;word-break:break-all;">%s</div>' % (GRAY, T['guard'], URL.replace('https://', ''))
    + '</div>', pad='10px 6% 60px'))

assert SHOWN == set(FILE), set(FILE) - SHOWN

CSS = f'''
body{{margin:0;width:860px;background:#fff}}
.plate{{width:860px;box-sizing:border-box;position:relative;overflow:hidden;background:{PAPER};color:{INK};font-family:'Noto Serif KR',serif;-webkit-font-smoothing:antialiased;word-break:keep-all}}
.plate *{{box-sizing:border-box}}
.plate p{{margin:0}}
.plate s{{text-decoration:line-through;text-decoration-color:{RED};text-decoration-thickness:2px;color:{GRAY}}}
.red{{color:{RED};font-style:normal}} .gray{{color:{GRAY}}}
.plate.dk{{background:{INK};color:{PAPER}}}
.dk .gray,.dk s,.dkband s{{color:{DGRAY}}}
.dkband{{background:{INK};color:{PAPER}}}
.fig{{position:absolute;width:auto;max-width:none}}
.pic{{background-size:cover;background-repeat:no-repeat;image-rendering:pixelated;flex:none}}
.shot{{background-repeat:no-repeat;flex:none}}
.rule{{position:absolute;height:0;border-top:1.5px solid {INK}}}
.cap{{position:absolute;font-family:'Pretendard',sans-serif;font-size:31px;line-height:1.38;letter-spacing:-.02em;font-weight:400}}
.cap b{{font-weight:700}}
.kicker{{font-family:'Pretendard',sans-serif;font-size:31px;font-weight:700;letter-spacing:-.02em;border-top:1.5px solid currentColor;padding-top:16px}}
.kicker.abs{{position:absolute}}
.kicker em{{font-style:normal;font-weight:400;color:{GRAY};float:right}}
.dk .kicker em{{color:{DGRAY}}}
.mast{{position:absolute;left:14px;top:-40px;font-size:450px;line-height:1;font-weight:900;letter-spacing:-.07em;white-space:nowrap}}
.sub{{position:absolute;font-family:'Bodoni Moda',serif;font-size:60px;line-height:1;font-weight:500;letter-spacing:.02em;white-space:nowrap}}
.sub .red{{font-family:'Noto Serif KR',serif;font-weight:900;font-size:120px;line-height:.5;vertical-align:-14px;margin:0 4px 0 -12px}}
.coverq{{position:absolute;font-size:46px;line-height:1.36;font-weight:700;letter-spacing:-.04em}}
.small{{font-size:34px;line-height:1.6;font-weight:400;letter-spacing:-.03em}}
.huge{{font-size:112px;line-height:1.14;font-weight:900;letter-spacing:-.06em}}
.huge.thin{{font-weight:200}}
.h1{{font-size:132px;line-height:1.05;font-weight:900;letter-spacing:-.06em;margin-bottom:34px}}
.h2{{font-size:84px;line-height:1.1;font-weight:900;letter-spacing:-.06em}}
.irow{{display:flex;align-items:baseline;border-top:1px solid currentColor;padding:15px 0 16px}}
.irow.last{{border-bottom:1.5px solid currentColor}}
.irow span{{flex:0 0 250px;font-family:'Pretendard',sans-serif;font-size:31px;color:{GRAY};letter-spacing:-.02em}}
.dkband .irow span{{color:{DGRAY}}}
.irow b{{font-size:36px;line-height:1.4;font-weight:700;letter-spacing:-.04em}}
.irow b.giant{{font-size:190px;line-height:1;font-weight:900;letter-spacing:-.07em}}
.fname{{font-weight:900;line-height:1.08;letter-spacing:-.07em;white-space:nowrap}}
.fblurb{{font-size:33px;line-height:1.5;font-weight:400;letter-spacing:-.04em;margin-top:22px !important}}
.scn{{margin-top:34px}}
.scn>span{{display:block;font-family:'Pretendard',sans-serif;font-size:30px;color:{GRAY};letter-spacing:-.02em}}
.dkband .scn>span{{color:{DGRAY}}}
.scn b{{display:block;font-size:66px;line-height:1.2;font-weight:900;letter-spacing:-.06em;margin-top:2px}}
.scn p{{font-size:34px;line-height:1.5;font-weight:700;letter-spacing:-.04em;margin-top:10px !important}}
.scn p i{{font-style:normal;font-weight:200;color:{GRAY};margin:0 12px 0 4px}}
.vert{{position:absolute;writing-mode:vertical-rl;font-size:118px;line-height:1;font-weight:900;letter-spacing:-.02em;white-space:nowrap}}
.bigq{{position:absolute;font-size:84px;line-height:1.16;font-weight:900;letter-spacing:-.06em}}
.midq{{position:absolute;font-size:54px;line-height:1.36;font-weight:700;letter-spacing:-.05em}}
.mega{{position:absolute;font-size:400px;line-height:1;font-weight:900;letter-spacing:-.08em;white-space:nowrap}}
.run{{position:absolute;font-size:218px;line-height:1;font-weight:900;letter-spacing:-.08em;white-space:nowrap}}
.ye{{position:absolute;font-size:410px;line-height:1;font-weight:900;letter-spacing:-.06em;white-space:nowrap}}
.eighty{{position:absolute;font-family:'Bodoni Moda',serif;font-size:300px;line-height:1;font-weight:700;letter-spacing:-.04em;white-space:nowrap}}
.mini{{position:absolute;font-size:31px;line-height:1.4;font-weight:700;letter-spacing:-.04em}}
.mini div{{border-top:1px solid currentColor;padding:10px 0 12px}}
.mini span{{display:block;font-family:'Pretendard',sans-serif;font-weight:400;color:{GRAY};letter-spacing:-.02em}}
.dk .mini span{{color:{DGRAY}}}
.mini.wide div{{display:flex}} .mini.wide span{{flex:0 0 250px}} .mini em{{font-style:normal;display:block}}
.tcol{{position:absolute;top:990px;width:236px}}
.tcol b{{display:block;font-size:44px;font-weight:900;letter-spacing:-.05em;line-height:1.2}}
.tcol p{{font-size:32px;line-height:1.42;font-weight:700;letter-spacing:-.05em;margin-top:14px !important;min-height:184px}}
.tcol i{{display:block;font-style:normal;font-family:'Pretendard',sans-serif;font-size:30px;line-height:1.35;color:{GRAY};letter-spacing:-.04em;min-height:84px}}
.tcol u{{display:block;text-decoration:none;font-size:30px;line-height:1.35;font-weight:700;letter-spacing:-.05em;border-top:1px solid {INK};padding-top:10px;margin-top:10px}}
.tcol u span{{display:block;font-family:'Pretendard',sans-serif;font-weight:400;color:{GRAY}}}
.gname{{position:absolute;width:180px;text-align:center;font-size:32px;font-weight:700;letter-spacing:-.06em;line-height:1.2;white-space:nowrap}}
.pcol{{position:absolute;width:356px}}
.pcol span{{display:block;font-family:'Pretendard',sans-serif;font-size:30px;color:{GRAY};letter-spacing:-.02em;font-weight:400}}
.pcol b{{display:block;font-size:40px;font-weight:900;letter-spacing:-.06em;line-height:1.25}}
.pcol p{{font-size:34px;line-height:1.46;font-weight:700;letter-spacing:-.05em;margin-top:18px !important}}
.pcol i{{display:block;font-style:normal;font-family:'Pretendard',sans-serif;font-size:30px;line-height:1.35;color:{GRAY};letter-spacing:-.03em;margin-top:14px}}
.pcol u{{display:block;text-decoration:none;font-size:34px;line-height:1.35;font-weight:700;letter-spacing:-.05em;border-top:1px solid {INK};padding-top:10px;margin-top:22px}}
.face{{display:block;position:relative;overflow:hidden}}
.face img{{position:absolute;max-width:none}}
.band{{display:flex;flex-wrap:wrap;width:756px}}
.bc{{width:108px;margin-bottom:26px}}
.bc b{{display:block;font-size:30px;font-weight:700;letter-spacing:-.08em;line-height:1.2;margin-top:6px;white-space:nowrap}}
.glabel{{font-family:'Pretendard',sans-serif;font-size:31px;color:{GRAY};letter-spacing:-.02em}}
.glabel b{{color:{INK};font-weight:700;margin-right:10px}}
.mgrid{{display:flex;flex-wrap:wrap;margin-top:26px}}
.mc{{width:150px;margin-bottom:34px}}
.mc b{{display:block;font-size:32px;font-weight:900;letter-spacing:-.07em;line-height:1.2;margin-top:8px}}
.mc i{{display:block;font-style:normal;font-size:30px;font-weight:400;letter-spacing:-.07em;line-height:1.25;padding-right:8px}}
.sgrid{{display:flex;flex-wrap:wrap;border-top:1.5px solid {INK};padding-top:30px;margin-top:6px}}
.sc{{width:250px;display:flex;margin-bottom:26px}}
.sc>div{{padding:8px 0 0 12px}}
.sc b{{display:block;font-size:32px;font-weight:900;letter-spacing:-.07em;line-height:1.2}}
.sc i{{display:block;font-style:normal;font-family:'Pretendard',sans-serif;font-size:30px;color:{GRAY};letter-spacing:-.06em;line-height:1.25;margin-top:4px}}
.jrow{{display:flex;margin-top:36px}}
.jlist{{margin-top:30px}}
.jlist div{{display:flex;align-items:baseline;border-top:1px solid {INK};padding:9px 0 11px}}
.jlist span{{flex:0 0 150px;font-family:'Pretendard',sans-serif;font-size:31px;color:{GRAY};letter-spacing:-.03em}}
.jlist b{{font-size:38px;font-weight:900;letter-spacing:-.05em;line-height:1.3}}
.solo{{position:absolute;width:358px}}
.solo .srule{{border-top:1.5px solid {INK}}}
.solo b{{display:block;font-size:56px;font-weight:900;letter-spacing:-.06em;line-height:1.2;margin-top:14px}}
.solo i{{display:block;font-style:normal;font-family:'Pretendard',sans-serif;font-size:30px;color:{GRAY};letter-spacing:-.03em;line-height:1.3;margin-top:2px}}
.solo p{{font-size:34px;line-height:1.44;font-weight:700;letter-spacing:-.05em;margin-top:16px !important}}
.solo u{{display:block;text-decoration:none;font-size:32px;line-height:1.35;font-weight:700;letter-spacing:-.05em;margin-top:18px}}
.solo u span,.pcol u span{{display:block;font-family:'Pretendard',sans-serif;font-size:30px;font-weight:400;color:{GRAY};letter-spacing:-.02em}}
.col{{position:absolute}} .col>.cap,.col>.bigq,.col>.midq,.col>.mini{{position:static}}
.pcap{{position:absolute;font-size:31px;line-height:1.4;font-weight:700;letter-spacing:-.04em}}
.pcap b{{display:block;font-size:42px;font-weight:900;letter-spacing:-.06em;line-height:1.2;margin-bottom:6px}}
.pcap span{{font-family:'Pretendard',sans-serif;font-weight:400;color:{DGRAY};margin-right:6px}}
.joke span{{display:block;font-family:'Pretendard',sans-serif;font-size:31px;color:{DGRAY};letter-spacing:-.02em}}
.joke b{{display:block;font-size:62px;line-height:1.2;font-weight:900;letter-spacing:-.06em;margin-top:8px}}
.joke s{{display:block;font-size:40px;line-height:1.35;font-weight:400;letter-spacing:-.05em;margin-top:10px}}
.joke.big b{{font-size:76px}}
.joke.huge2 b{{font-size:104px;white-space:nowrap}}
.trow{{display:flex;justify-content:space-between;padding:0 54px}}
.tile b,.stn b{{display:block;font-family:'Pretendard',sans-serif;font-size:32px;font-weight:700;letter-spacing:-.05em;line-height:1.25;margin-top:12px}}
.tile i,.stn i{{display:block;font-style:normal;font-size:30px;font-weight:400;letter-spacing:-.05em;line-height:1.35;margin-top:4px}}
.tile em,.wcap em{{font-style:normal;font-family:'Pretendard',sans-serif;color:{DGRAY};margin-right:4px}}
.stn{{width:215px;text-align:center}}
.wcap{{padding:16px 54px 0;font-size:34px;line-height:1.4;font-weight:400;letter-spacing:-.04em}}
.wcap b{{font-family:'Pretendard',sans-serif;font-weight:700;margin-right:18px}}
.slab b{{display:block;font-size:96px;line-height:1.1;font-weight:900;letter-spacing:-.06em}}
.slab span{{display:block;font-family:'Pretendard',sans-serif;font-size:32px;line-height:1.45;color:{DGRAY};letter-spacing:-.02em;margin-top:12px}}
.scap{{font-family:'Pretendard',sans-serif;font-size:32px;font-weight:700;letter-spacing:-.03em;margin:14px 54px 0}}
'''
html = ('<!doctype html><html lang="ko"><head><meta charset="utf-8">\n'
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@200;400;700;900&family=Bodoni+Moda:ital,opsz,wght@0,6..96,500;0,6..96,700;1,6..96,500&display=swap">\n'
        '<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">\n'
        '<style>' + CSS + '</style></head>\n<body>\n' + '\n'.join(P) + '\n</body></html>\n')
open(OUT, 'w').write(html)
print('plates', sum('class="plate' in p for p in P), 'arca', sum('class="arca"' in p for p in P))
json.dump(USED, open(HERE + '/used.json', 'w'), ensure_ascii=False, indent=0)
