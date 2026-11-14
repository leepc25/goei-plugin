# -*- coding: utf-8 -*-
# 「백지 화보」 page.html 생성기. 문장은 전부 자료 파일에서 직접 꺼내고, 자른 문장은 원문에 들어 있는지 확인한다.
import json, re, sys
from urllib.parse import quote as uq

ROOT = '/home/user/goei-plugin'
KIT = ROOT + '/.scratch/arca/kit'
OUT = ROOT + '/.scratch/arca/a/page.html'
SP = '/tmp/claude-0/-home-user/4628beb8-e27e-545e-a16e-1b961f3e453e/scratchpad'
W = json.load(open(KIT + '/wiki_infobox.json'))
G = json.load(open(ROOT + '/src/data/world/greetings.json'))
SC = json.load(open(ROOT + '/src/data/world/scenes.json'))['인물']
SN = json.load(open(ROOT + '/src/data/scenarios.json'))
HEADS = json.load(open(SP + '/heads.json'))
USED = []

PAPER = '#f5f3ee'; INK = '#141312'; RED = '#cf2a1c'; GRAY = '#86817a'

def U(p):
    return 'file://' + uq(ROOT + '/' + p)

def mk(s, arca=False):
    """위키 표기 → HTML. ✂️취소선✂️ ❗강조❗"""
    if arca:
        s = re.sub(r'✂️(.*?)✂️', r'<span style="text-decoration:line-through;color:%s;background-color:rgba(0,0,0,0.004);">\1</span>' % GRAY, s)
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
    USED.append((text, '위키 「%s」 인용 — %s' % (title, src)))
    return text, src

def IB(title, key, arca=False):
    v = W[title]['infobox'][key]
    assert key != '나이'
    USED.append(('%s: %s' % (key, v), '위키 「%s」 정보상자' % title))
    return mk(v, arca)

def GR(key, s):
    t = G['texts'][G['index'][key]].replace('**', '')
    assert s in t, s
    assert '{{user}}' not in s
    USED.append((s, 'greetings.json %s' % key))
    return s

FAC = {f['name']: f for f in SN['factions']}
def blurb(n):
    USED.append((FAC[n]['blurb'], 'scenarios.json %s blurb' % n)); return FAC[n]['blurb']
def scenes(n):
    return [s['label'] for s in FAC[n]['scenarios'] if s['kind'] == 'opening']

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

def agent(n):
    return U('assets/agents/%s_default.avif' % FILE[n])

def fig(n, h, left, top, extra=''):
    """전신 그림. h=높이(px)."""
    return '<img class="fig" src="%s" style="height:%dpx;left:%dpx;top:%dpx;%s">' % (agent(n), h, left, top, extra)

def face(n, w=150, h=172, srcw=380, lift=30):
    hd = HEADS[FILE[n]]; s = w / srcw
    return ('<span class="face" style="width:%dpx;height:%dpx"><img src="%s" style="width:%.1fpx;left:%.1fpx;top:%.1fpx"></span>'
            % (w, h, agent(n), 832 * s, -(hd['cx'] - srcw / 2) * s, -(hd['top'] - lift) * s))

def an(f):
    return U('assets/wiki/Anomalies/%s.avif' % f)

def pic(src, w, h=None, style='', pos='50% 50%'):
    h = h or w
    return '<div class="pic" style="width:%dpx;height:%dpx;background-image:url(\'%s\');background-position:%s;%s"></div>' % (w, h, src, pos, style)

def facerow(label, names, w=150):
    cells = ''.join('<div class="fc">%s<b>%s</b></div>' % (face(n), n) for n in names)
    return '<div class="frow"><div class="flabel">%s</div><div class="fcells">%s</div></div>' % (label, cells)

# ───────────────────────── .arca 조각 도우미 ─────────────────────────
SERIF = "'Pretendard','Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif"
SANS = "'Pretendard','Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif"
GUARD = 'background-color:rgba(0,0,0,0.004);'

def arca(inner, pad='30px 6% 34px'):
    return ('<div class="arca"><div style="background:linear-gradient(180deg,%s,%s);color:%s;%spadding:%s;font-family:%s;font-size:15px;line-height:1.7;word-break:keep-all;">%s</div></div>\n'
            % (PAPER, PAPER, INK, GUARD, pad, SANS, inner))

def a_quote(text, src, size=19):
    return ('<div style="margin:0 0 22px 0;"><div style="font-family:%s;font-size:%dpx;line-height:1.6;font-weight:800;color:%s;%s">“%s”</div>'
            '<div style="font-size:14px;line-height:1.5;color:%s;%smargin-top:6px;">%s</div></div>' % (SERIF, size, INK, GUARD, text, GRAY, GUARD, src))

def a_label(t):
    return ('<div style="border-top:1px solid %s;padding-top:9px;margin:0 0 16px 0;font-size:14px;font-weight:700;color:%s;%s">%s</div>' % (INK, INK, GUARD, t))

def a_rows(rows, keyw=92):
    out = ''
    for k, v in rows:
        out += ('<div style="display:table;width:100%%;border-bottom:1px solid #d9d5cc;"><div style="display:table-cell;width:%dpx;padding:7px 8px 7px 0;font-size:14px;color:%s;%svertical-align:top;">%s</div>'
                '<div style="display:table-cell;padding:6px 0;font-family:%s;font-size:15px;font-weight:700;color:%s;%svertical-align:top;">%s</div></div>' % (keyw, GRAY, GUARD, k, SERIF, INK, GUARD, v))
    return '<div style="margin:0 0 24px 0;">%s</div>' % out

def a_info(title, keys, head=None):
    return a_rows([(k, IB(title, k, True)) for k in keys])

P = []  # 조각들

# ════════════════ 1. 표지 ════════════════
q, s = Q('에일린', 3)
P.append(f'''<section class="plate" data-name="cover" style="height:1500px">
  <div class="mast">괴이</div>
  {fig('에일린', 1290, 150, 250)}
  <div class="sub" style="left:54px;top:528px"><i class="red">ː</i>ANOMALY</div>
  <div class="cap" style="left:56px;top:660px;width:300px">RisuAI용<br>괴담 시뮬레이션 봇</div>
  <div class="coverq" style="left:54px;top:860px;width:330px">“{q}”</div>
  <div class="cap gray" style="left:56px;top:1150px;width:300px">에일린<br>{s}</div>
  <div style="position:absolute;left:0;right:0;top:1404px;height:96px;background:{PAPER}"></div>
  <div class="rule" style="left:54px;right:54px;top:1404px"></div>
  <div class="cap" style="left:54px;top:1424px;right:54px">인물 55 · 괴이 63 · 조직 17 · 위키 문서 143</div>
</section>''')

# ════════════════ 2. 근무 수칙 (조용한 장) ════════════════
r2 = GR('A00-ko-3', '2. 이상현상에 대한 자료를 전자기기에 입력하지 마십시오. 이는 안전을 위한 것입니다.')
r3a = GR('A00-ko-3', '3. 식사 시간을 준수해 주십시오.'); r3b = GR('A00-ko-3', '이는 안전을 위한 것입니다.')
r7 = GR('A00-ko-3', '7. 관리국의 불이 꺼지는 일은 없습니다. 불이 꺼졌다고 생각될 경우 그 무엇도 믿지 말고 당장 건물 바깥으로 탈출하십시오. 이는 안전을 위한 것입니다.')
P.append(f'''<section class="plate" data-name="rules" style="padding:80px 54px 70px">
  <div class="kicker">관리국 근무 수칙</div>
  <p class="small gray" style="margin:60px 0 0;width:620px">{r2}</p>
  <p class="huge" style="margin:44px 0 0">{r3a.replace('3. ','3.<br>').replace('시간을 ','시간을<br>').replace('준수해 ','준수해<br>')}</p>
  <p class="huge thin" style="margin:6px 0 0">{r3b.replace('안전을 ','안전을<br>')}</p>
  <p class="small gray" style="margin:50px 0 0 240px;width:510px">{r7}</p>
  <div class="cap gray" style="position:static;margin:50px 0 0">첫 장면 「근무 수칙」에서</div>
</section>''')

q, s = Q('불이 꺼진 관리국', 0)
P.append(arca(a_label('관리국') + a_info('관리국', ['분류', '본부', '인원', '이름', '사내 분위기', '회식', '천적'])
              + a_quote(q, s) + a_rows([('공식 입장', IB('불이 꺼진 관리국', '공식 입장', True)), ('비공식 입장', IB('불이 꺼진 관리국', '비공식 입장', True))])))

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
q2, s2 = Q('원숭이 꿈 괴담', 2)
P.append(arca(a_quote(q, s) + a_quote(q2, '원숭이 꿈 괴담 — ' + s2)))

# ════════════════ 4·5. 시작하는 자리 ════════════════
def facblock(name, img, size, side, namesize, top, h, imgtop=0):
    sc = '&nbsp;· '.join(x.replace(' ', '&nbsp;') for x in scenes(name))
    if side == 'R':
        return f'''<div class="fb" style="top:{top}px;height:{h}px">
      {pic(U(img), size, style=f'position:absolute;right:0;top:{imgtop}px')}
      <div class="fname" style="font-size:{namesize}px">{name}</div>
      <p class="fblurb" style="width:{752-size-30}px">{blurb(name)}</p>
      <p class="fscn" style="width:{752-size-30}px">{sc}</p></div>'''
    return f'''<div class="fb" style="top:{top}px;height:{h}px">
      {pic(U(img), size, style=f'position:absolute;left:0;top:0')}
      <div style="margin-left:{size+36}px"><div class="fname" style="font-size:{namesize}px">{name}</div>
      <p class="fblurb">{blurb(name)}</p>
      <p class="fscn">{sc}</p></div></div>'''

P.append(f'''<section class="plate" data-name="start-a" style="height:1190px">
  <div class="kicker abs" style="left:54px;top:70px;right:54px">시작하는 자리 <em>세력 다섯 곳 · 첫 장면</em></div>
  <div style="position:absolute;left:54px;right:54px;top:0">
  {facblock('관리국', 'assets/wiki/Factions/Management Bureau.avif', 330, 'R', 150, 190, 520)}
  {facblock('가짜 관리국', 'assets/wiki/Factions/Fake Management Bureau.avif', 210, 'L', 92, 780, 400)}
  </div>
</section>''')
P.append(f'''<section class="plate" data-name="start-b" style="height:1500px">
  <div style="position:absolute;left:54px;right:54px;top:0">
  {facblock('백일몽 주식회사', 'assets/wiki/Factions/Baekilmong.avif', 250, 'R', 104, 20, 500, 150)}
  {facblock('민간인', 'assets/wiki/Factions/Civilian.avif', 300, 'L', 110, 520, 480)}
  {facblock('프리랜서', 'assets/wiki/Factions/Freelancer.avif', 170, 'R', 130, 1020, 440)}
  </div>
</section>''')

# ════════════════ 6. 이면의 주민들 ════════════════
P.append(f'''<section class="plate" data-name="residents" style="height:1010px">
  {pic(U('assets/wiki/Factions/Residents of the Hidden World.avif'), 640, 860, style='position:absolute;right:0;top:70px', pos='42% 50%')}
  <div class="vert" style="left:50px;top:70px">이면의 주민들</div>
  <div class="cap" style="left:54px;top:822px;width:150px">13명</div>
  <div class="cap gray" style="left:54px;top:868px;width:160px">그 인물로 시작하는 첫 장면</div>
</section>''')
RES = ['차여진', '서윤지', '고연지', '윤지아', '마덕희', '문혜란', '신유리', '블라렛', '살라딘', '아벤샤', '세크리엠', '탐미주의', '브라우니']
keys = sorted(SC.keys()); assert len(keys) == 13
cells = ''
for n, k in zip(RES, keys):
    assert n in SC[k]['ko'][:1500], (n, k)
    USED.append((SC[k]['label'], 'scenes.json %s 제목 (%s)' % (k, n)))
    cells += ('<div style="display:inline-block;width:47%%;min-width:136px;vertical-align:top;margin:0 2%% 14px 0;"><div style="font-size:14px;color:%s;%s">%s</div>'
              '<div style="font-family:%s;font-size:16px;line-height:1.45;font-weight:700;color:%s;%s">%s</div></div>' % (GRAY, GUARD, n, SERIF, INK, GUARD, SC[k]['label']))
P.append(arca(a_label('이면의 주민들 · 첫 장면 제목') + cells))

# ════════════════ 7. 쟈알디 ════════════════
q, s = Q('쟈알디', 2)
qq = q.replace('하아. ', '하아.<br>').replace('잼트리. ', '잼트리.<br>').replace('이것 좀 ', '이것 좀<br>').replace('어떻게 ', '어떻게<br>')
P.append(f'''<section class="plate" data-name="jyaldi" style="height:1340px">
  <div class="kicker abs" style="left:54px;top:70px;right:54px">인물 <em>관리국 종합대응팀</em></div>
  {fig('쟈알디', 1190, -236, 150)}
  <div class="col" style="left:530px;top:190px;width:290px">
  <div class="bigq" style="font-size:72px">“{qq}”</div>
  <div class="cap gray" style="margin-top:34px">쟈알디<br>{s}</div>
  <div class="mini" style="margin-top:60px">
    <div><span>직책</span>{IB('쟈알디','직책')}</div>
    <div><span>커피</span>{IB('쟈알디','커피')}</div>
    <div><span>특기</span>{IB('쟈알디','특기')}</div>
  </div></div>
</section>''')

# ════════════════ 8. 3인조 ════════════════
t3 = IB('데드폴', '소속 조')
trio = [('데드폴', Q('데드폴', 3), ('사망 횟수', IB('데드폴', '사망 횟수'))),
        ('게슈간', Q('게슈간', 0), ('사과', IB('게슈간', '사과'))),
        ('로제몬', Q('로제몬', 1), ('전투력', IB('로제몬', '전투력')))]
cols = ''
for i, (n, (q, s), (k, v)) in enumerate(trio):
    cols += f'''<div class="tcol" style="left:{54+i*262}px"><b>{n}</b><p>“{q}”</p><i>{s}</i><u><span>{k}</span> {v}</u></div>'''
P.append(f'''<section class="plate" data-name="trio" style="height:1480px">
  <div class="h2" style="position:absolute;left:54px;top:60px">{t3}</div>
  {fig('데드폴', 780, -60, 190)}{fig('게슈간', 780, 180, 200)}{fig('로제몬', 780, 420, 190)}
  <div style="position:absolute;left:0;right:0;top:960px;bottom:0;background:{PAPER}"></div>
  <div class="rule" style="left:54px;right:54px;top:960px"></div>
  {cols}
</section>''')

# ════════════════ 9. 관리국 얼굴 ════════════════
P.append(f'''<section class="plate" data-name="bureau-faces" style="padding:60px 54px 70px">
  <div class="kicker">관리국 <em>12명</em></div>
  {facerow('종합<br>대응팀', ['쟈알디','스팡달','잼트리','에일린'])}
  {facerow('', ['데드폴','게슈간','로제몬','콘쥬스'])}
  {facerow('진압팀', ['큐라스','고르고디오'])}
  {facerow('격리팀', ['고그니쟈','데쥬레'])}
</section>''')
q, s = Q('고그니쟈', 2); q2, s2 = Q('큐라스', 0)
P.append(arca(a_quote(q, '고그니쟈 — ' + s) + a_quote(q2, s2)))

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
  <div class="midq" style="left:54px;top:1112px;width:750px">“{q}”</div>
  <div class="cap gray" style="left:54px;top:1356px;width:740px">김조학 — {s}</div>
  <div class="mini wide" style="left:54px;top:1430px;width:752px">
    <div><span>복장</span>{IB('가짜 관리국','복장')}</div>
    <div><span>모집 방식</span>{IB('가짜 관리국','모집 방식')}</div>
  </div>
</section>''')

# ════════════════ 11. 가짜 관리국 얼굴 ════════════════
P.append(f'''<section class="plate" data-name="fake-faces" style="padding:60px 54px 70px">
  <div class="kicker">가짜 관리국 <em>14명</em></div>
  {facerow('사장실<br>국장실', ['사장','도필헌'])}
  {facerow('신입 교육<br>심문', ['이길환','이기석','김조학'])}
  {facerow('검사부대', ['이도형','고영훈','노기균','송주익'])}
  {facerow('진압부대', ['곽성주','조성춘','윤병수','김성진'])}
  {facerow('', ['송진섭'])}
</section>''')
q, s = Q('이길환', 1); q2, s2 = Q('송주익', 2)
P.append(arca(a_quote(q, '이길환 — ' + s) + a_quote(q2, '송주익 — ' + s2)
              + a_rows([('자칭', IB('가짜 관리국', '자칭', True)), ('표어', IB('가짜 관리국', '표어', True)), ('관리국과의 관계', IB('가짜 관리국', '관리국과의 관계', True))], 118)))

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
P.append(arca(a_quote(q, s) + a_info('백일몽', ['분류', '실제 상품', '현장 복장', '입사 시험', '퇴사', '복지'])))

# ════════════════ 13. 백일몽 얼굴 ════════════════
P.append(f'''<section class="plate" data-name="daydream-faces" style="padding:60px 54px 70px">
  <div class="kicker">백일몽 주식회사 <em>16명</em></div>
  {facerow('임원<br>행정지원', ['청달래','호유원','이병진'])}
  {facerow('현장<br>탐사팀', ['백석주','진나솔','이성해','이자헌'])}
  {facerow('', ['은하제','박민성','백사헌','고영은'])}
  {facerow('', ['강이학','장허운'])}
  {facerow('연구1팀<br>보안관리부', ['곽제강','이연화','제이'])}
</section>''')
q, s = Q('박민성', 0); q2, s2 = Q('제이', 1)
P.append(arca(a_quote(q, s) + a_quote(q2, '제이 — ' + s2)))

# ════════════════ 14. 중림 지하상가 · 협회 ════════════════
q, s = Q('마덕희', 2)
P.append(f'''<section class="plate" data-name="jungnim" style="height:1580px">
  <div class="kicker abs" style="left:54px;top:70px;right:54px">중림 지하상가 <em>헐값매입</em></div>
  {fig('마덕희', 760, 420, 130)}
  <div class="eighty" style="left:40px;top:140px">{q.split(' ')[0]}</div>
  <div class="col" style="left:54px;top:440px;width:400px">
  <div class="midq" style="font-size:46px">“{q}”</div>
  <div class="cap gray" style="margin-top:22px">마덕희 — {s}</div></div>
  <div style="position:absolute;left:0;right:0;top:780px;height:800px;background:{PAPER};padding:0 54px">
    <div class="rule" style="position:static;margin-bottom:4px"></div>
    {facerow('중림<br>지하상가', ['고연지','윤지아','마덕희','문혜란'])}
    {facerow('', ['신유리'])}
    {facerow('특수재난<br>대응협회', ['차여진','서윤지'])}
  </div>
</section>''')
q, s = Q('고연지', 3); q2, s2 = Q('서윤지', 3); q3, s3 = Q('프리랜서', 0)
P.append(arca(a_quote(q, '고연지 — ' + s) + a_quote(q2, '서윤지 — ' + s2) + a_quote(q3, s3)))

# ════════════════ 15. 혼자인 이들 ════════════════
solo = [('블라렛', IB('블라렛', '소속'), Q('블라렛', 1)), ('살라딘', IB('살라딘', '소속'), Q('살라딘', 2)),
        ('아벤샤', IB('아벤샤', '소속'), Q('아벤샤', 3)), ('세크리엠', IB('세크리엠', '분류'), Q('흡혈귀', 0)),
        ('브라우니', IB('브라우니', '소속'), Q('브라우니', 2)), ('탐미주의', IB('탐미주의', '소속'), Q('탐미주의', 1))]
rows = ''
for i, (n, aff, (q, s)) in enumerate(solo):
    rows += f'''<div class="srow {'alt' if i%2 else ''}">{face(n, 168, 190)}<div class="stext"><b>{n}</b><i>{aff}</i><p>“{q}”</p></div></div>'''
P.append(f'''<section class="plate" data-name="others" style="padding:60px 54px 50px">
  <div class="kicker">그 밖의 세력 <em>한 사람씩</em></div>
  {rows}
</section>''')

# ════════════════ 16. 괴이: 심연교통공사 ════════════════
q, s = Q('심연교통공사', 0, cut='이번 역은, 슬픔, 슬픔역입니다. 내리실 문은 오른쪽입니다.')
P.append(f'''<section class="plate" data-name="abyss" style="height:1300px">
  <div class="kicker abs" style="left:54px;top:70px;right:54px">괴이 <em>63곳</em></div>
  {pic(an('Abyss Transit Authority'), 470, 1010, style='position:absolute;left:0;top:170px', pos='38% 50%')}
  <div class="midq" style="left:520px;top:170px;width:300px;font-size:50px;line-height:1.36">“{q.replace('슬픔, 슬픔역','슬픔,<br>슬픔역')}”</div>
  <div class="cap gray" style="left:522px;top:690px;width:290px">{s.split('.')[0]}</div>
  <div class="mini" style="left:522px;top:820px;width:290px">
    <div><span>탑승 방법</span>{IB('심연교통공사','탑승 방법')}</div>
    <div><span>노선도</span>{IB('심연교통공사','노선도')}</div>
  </div>
</section>''')

# ════════════════ 17. 괴이: 크기가 다른 도판들 ════════════════
def plateitem(f, size, left, top, title, key, capw=None, capleft=None, captop=None):
    v = IB(title, key)
    cl = left if capleft is None else capleft
    ct = top + size + 14 if captop is None else captop
    return (pic(an(f), size, style=f'position:absolute;left:{left}px;top:{top}px')
            + f'<div class="pcap" style="left:{cl}px;top:{ct}px;width:{capw or size}px"><b>{title}</b><span>{key}</span> {v}</div>')
P.append(f'''<section class="plate" data-name="plates" style="height:1600px">
  {plateitem('Lookymart', 520, 0, 60, '룩키마트', '층수', capw=430, capleft=54)}
  {plateitem('Dimensional Elevator', 150, 656, 60, '차원 승강기', '층수', capw=250, capleft=556, captop=226)}
  {plateitem('Myeongil Apartment', 300, 506, 760, '명일 아파트', '엘리베이터', capw=310, capleft=506)}
  {plateitem('Cheongak Mary Hospital', 210, 54, 880, '청악메리병원', '퇴사', capw=330)}
  {plateitem('Tuesday Quiz Show', 300, 54, 1240, '화요퀴즈쇼', '방청객', capw=400, capleft=390, captop=1240)}
</section>''')
q, s = Q('룩키마트', 1); q2, s2 = Q('차원 승강기', 0)
P.append(arca(a_quote(q, '룩키마트 — ' + s) + a_quote(q2, s2)))

# ════════════════ 18. 괴이: 밀착 인화 ════════════════
sheet = ['Sora Land', 'Samangdan', 'Jogyesa', 'Monkey Dream', 'Fearble Theater', 'Forbidden Video',
         'Hanseol Human Meat Factory', 'Dream and Hope Theater', 'School of Nightmare', 'Midnight Station', 'Flower Golden Resort', 'The Basement',
         'Dark Garden', 'Morning Station', 'Yu-gye Station', 'Segwang Station', 'Gangseo University Hospital', 'Frost Waterpark',
         'Yukoae Theme Park', 'Saint Anticus Boarding School', 'Jisan Village Festival', 'Dusk Station', 'Hotel Inspiration', 'The Church',
         'Midday Station', 'Twinkle Dragon Palace', 'Hungry Hangman', 'Cosmic Fantasy Zoo', 'Living Orphanage', 'Saint\'s City']
cs = ''.join(pic(an(f), 112, style='display:inline-block;margin:0 16px 16px 0') for f in sheet)
P.append(f'''<section class="plate" data-name="contact" style="padding:70px 54px 60px">
  <div style="width:780px;line-height:0;margin-left:0">{cs}</div>
  <div class="irow first" style="margin-top:40px"><span>사망단길</span><b>{IB('사망단길','결제 수단')}</b></div>
  <div class="irow"><span>조계사</span><b>{IB('조계사','이용 후기')}</b></div>
  <div class="irow last"><span>금지된 비디오</span><b>{IB('금지된 비디오','러닝타임')}</b></div>
</section>''')
more = [('인류의 신비전', '관람료'), ('강변', '위치'), ('욕망의 방', '성인 시설 여부'), ('샛별 고시원', '방 크기'), ('유계역', '위험도'),
        ('한밤역', '입장료'), ('세광특별시', '인구'), ('영원마을', '화폐'), ('코즈믹 판타지 동물원', '전시 동물'), ('미스테리 월드 어드벤쳐 파크', '입장 방법')]
rows = ''
for t, k in more:
    rows += ('<div style="border-bottom:1px solid #d9d5cc;padding:8px 0;"><span style="font-size:14px;color:%s;%s">%s · %s</span><br>'
             '<span style="font-family:%s;font-size:15px;font-weight:700;color:%s;%s">%s</span></div>' % (GRAY, GUARD, t, k, SERIF, INK, GUARD, IB(t, k, True)))
q, s = Q('탐미주의', 0)
P.append(arca(a_label('괴이위키 정보상자에서') + '<div style="margin:0 0 26px 0;">' + rows + '</div>' + a_quote(q, '탐미주의 — ' + s, 17)))

# ════════════════ 19. 화면 (PC) ════════════════
SCR = 'file://' + uq(KIT + '/screens/')
def crop(path, w, x0, y0, x1, y1, style='', srcw=2560):
    """원본 px 기준 (x0,y0)-(x1,y1) 를 폭 w 로."""
    s = w / (x1 - x0)
    return ('<div class="shot" style="width:%dpx;height:%dpx;background-image:url(\'%s\');background-size:%.1fpx auto;background-position:%.1fpx %.1fpx;%s"></div>'
            % (w, round((y1 - y0) * s), SCR + uq(path), srcw * s, -x0 * s, -y0 * s, style))
P.append(f'''<section class="plate" data-name="screens-pc" style="height:1100px">
  <div class="kicker abs" style="left:54px;top:70px;right:54px">화면 <em>실제 캡처</em></div>
  {crop('promo/pc-play-02-board.png', 752, 156, 113, 2405, 1607, 'position:absolute;left:54px;top:170px;border-radius:12px')}
  <div class="cap" style="left:54px;top:690px;width:300px"><b>상황판</b></div>
  {crop('s-boards/pc-08-wpf.png', 500, 640, 400, 2400, 1250, 'position:absolute;left:306px;top:790px')}
  <div class="cap" style="left:54px;top:948px;width:240px"><b>세계정치<br>게시판</b></div>
</section>''')

# ════════════════ 20. 화면 (폰) ════════════════
def phone(path, left, top, w=232):
    return ('<div class="shot ph" style="position:absolute;left:%dpx;top:%dpx;width:%dpx;height:%dpx;background-image:url(\'%s\');background-size:%dpx auto"></div>'
            % (left, top, w, round(w * 1688 / 780), SCR + uq(path), w))
P.append(f'''<section class="plate" data-name="screens-phone" style="height:1130px">
  {phone('promo/phone-play-04-phone.png', 54, 60)}<div class="cap" style="left:54px;top:580px"><b>괴담톡</b></div>
  {phone('promo/phone-play-03-map.png', 314, 190)}<div class="cap" style="left:314px;top:710px"><b>임무</b></div>
  {phone('s-hs/phone_2_진행자.png', 574, 320)}<div class="cap" style="left:574px;top:840px"><b>망상홈쇼핑</b></div>
  {phone('s-wiki/phone-05-doc.png', 54, 700, 190).replace('height:411px','height:330px')}<div class="cap" style="left:54px;top:1048px"><b>괴이위키</b></div>
</section>''')
facts = [('상황판', '요원 화면 · 지금 벌어진 괴이 / 사건 / 특수 상황'), ('임무', '지도에서 장소를 골라 요원 넷을 편성해 출동 · 커스텀 임무'),
         ('괴담톡', '연락처 · 대화 · 공지 · 전화 · 단톡'), ('인터넷', '괴담넷 · 괴담 갤러리 · 세정게 · 연어 마켓 · 우주 쇼핑몰 · 괴이위키 · 백일몽 포인트몰 · 망상홈쇼핑'),
         ('소지품', '무기 2칸 · 장비 4칸 장착 · 가계부'), ('기록', '일지 · 연대기 · 인물 · 세력'), ('그림', '인물당 표정 41종'), ('언어', '한국어 · English')]
P.append(arca(a_label('화면') + a_rows(facts, 70)))

# ════════════════ 21. 맺음 ════════════════
q, s = Q('잼트리', 0)
P.append(f'''<section class="plate" data-name="closing" style="height:1120px">
  {fig('잼트리', 1080, 330, 90)}
  <div class="bigq" style="left:54px;top:150px;width:420px;font-size:92px">“{q.replace('후배, ','후배,<br>').replace('어머, ','어머,<br>')}”</div>
  <div class="cap gray" style="left:58px;top:620px;width:300px">잼트리<br>{s}</div>
</section>''')
URL = 'https://github.com/leepc25/goei-plugin/releases/latest'
P.append(arca(
    '<div style="border-top:1px solid %s;padding-top:26px;">' % INK
    + '<div style="font-family:%s;font-size:26px;line-height:1.3;font-weight:900;color:%s;%s">괴이 ː ANOMALY</div>' % (SERIF, INK, GUARD)
    + '<div style="font-size:14px;color:%s;%smargin:6px 0 22px 0;">RisuAI용 괴담 시뮬레이션 봇 · 인물 55명 · 괴이 63곳 · 조직 17곳 · 특수 장소 11곳</div>' % (GRAY, GUARD)
    + '<a href="%s" target="_blank" rel="noopener noreferrer" style="text-decoration:none;"><span style="display:inline-block;padding:15px 44px;background:linear-gradient(180deg,#141312,#141312);border:1px solid #141312;color:#f5f3ee;font-size:16px;font-weight:800;">받기</span></a>' % URL
    + '<div style="font-size:14px;color:%s;%smargin-top:14px;word-break:break-all;">%s</div>' % (GRAY, GUARD, URL.replace('https://', ''))
    + '</div>', pad='10px 6% 60px'))

CSS = f'''
body{{margin:0;width:860px;background:#fff}}
.plate{{width:860px;box-sizing:border-box;position:relative;overflow:hidden;background:{PAPER};color:{INK};font-family:'Noto Serif KR',serif;-webkit-font-smoothing:antialiased;word-break:keep-all}}
.plate *{{box-sizing:border-box}}
.plate p{{margin:0}}
.plate s{{text-decoration:line-through;text-decoration-color:{RED};text-decoration-thickness:2px;color:{GRAY}}}
.red{{color:{RED};font-style:normal}} .gray{{color:{GRAY}}}
.fig{{position:absolute;width:auto;max-width:none}}
.pic{{background-size:cover;background-repeat:no-repeat;image-rendering:pixelated}}
.shot{{background-repeat:no-repeat;box-shadow:0 18px 50px rgba(20,19,18,.22)}}
.shot.ph{{border-radius:22px}}
.rule{{position:absolute;height:0;border-top:1.5px solid {INK}}}
.cap{{position:absolute;font-family:'Pretendard',sans-serif;font-size:30px;line-height:1.38;letter-spacing:-.02em;font-weight:400}}
.cap b{{font-weight:700}}
.kicker{{font-family:'Pretendard',sans-serif;font-size:30px;font-weight:700;letter-spacing:-.02em;border-top:1.5px solid {INK};padding-top:16px}}
.kicker.abs{{position:absolute}}
.kicker em{{font-style:normal;font-weight:400;color:{GRAY};float:right}}
.mast{{position:absolute;left:14px;top:-40px;font-size:450px;line-height:1;font-weight:900;letter-spacing:-.07em;white-space:nowrap}}
.sub{{position:absolute;font-family:'Bodoni Moda',serif;font-size:60px;line-height:1;font-weight:500;letter-spacing:.02em;white-space:nowrap}}
.sub .red{{font-family:'Noto Serif KR',serif;font-weight:900;font-size:120px;line-height:.5;vertical-align:-14px;margin:0 4px 0 -12px}}
.coverq{{position:absolute;font-size:46px;line-height:1.36;font-weight:700;letter-spacing:-.04em}}
.small{{font-size:30px;line-height:1.6;font-weight:400;letter-spacing:-.03em}}
.huge{{font-size:112px;line-height:1.14;font-weight:900;letter-spacing:-.06em}}
.huge.thin{{font-weight:200}}
.h1{{font-size:132px;line-height:1.05;font-weight:900;letter-spacing:-.06em;margin-bottom:34px}}
.h2{{font-size:84px;line-height:1.1;font-weight:900;letter-spacing:-.06em}}
.irow{{display:flex;align-items:baseline;border-top:1px solid {INK};padding:15px 0 16px}}
.irow.last{{border-bottom:1.5px solid {INK}}}
.irow span{{flex:0 0 220px;font-family:'Pretendard',sans-serif;font-size:30px;color:{GRAY};letter-spacing:-.02em}}
.irow b{{font-size:34px;line-height:1.4;font-weight:700;letter-spacing:-.04em}}
.irow b.giant{{font-size:190px;line-height:1;font-weight:900;letter-spacing:-.07em}}
.fb{{position:absolute;left:0;right:0}}
.fname{{font-weight:900;line-height:1.05;letter-spacing:-.07em;white-space:nowrap}}
.fblurb{{font-size:32px;line-height:1.5;font-weight:400;letter-spacing:-.04em;margin-top:24px !important}}
.fscn{{font-family:'Pretendard',sans-serif;font-size:30px;line-height:1.45;color:{GRAY};letter-spacing:-.03em;margin-top:18px !important}}
.vert{{position:absolute;writing-mode:vertical-rl;font-size:118px;line-height:1;font-weight:900;letter-spacing:-.02em;white-space:nowrap}}
.bigq{{position:absolute;font-size:84px;line-height:1.16;font-weight:900;letter-spacing:-.06em}}
.midq{{position:absolute;font-size:54px;line-height:1.36;font-weight:700;letter-spacing:-.05em}}
.mega{{position:absolute;font-size:400px;line-height:1;font-weight:900;letter-spacing:-.08em;white-space:nowrap}}
.ye{{position:absolute;font-size:410px;line-height:1;font-weight:900;letter-spacing:-.06em;white-space:nowrap}}
.eighty{{position:absolute;font-family:'Bodoni Moda',serif;font-size:300px;line-height:1;font-weight:700;letter-spacing:-.04em;white-space:nowrap}}
.mini{{position:absolute;font-size:30px;line-height:1.4;font-weight:700;letter-spacing:-.04em}}
.mini div{{border-top:1px solid {INK};padding:10px 0 12px}}
.mini span{{display:block;font-family:'Pretendard',sans-serif;font-weight:400;color:{GRAY};letter-spacing:-.02em}}
.mini.wide div{{display:flex}} .mini.wide span{{flex:0 0 220px}}
.tcol{{position:absolute;top:990px;width:236px}}
.tcol b{{display:block;font-size:44px;font-weight:900;letter-spacing:-.05em;line-height:1.2}}
.tcol p{{font-size:32px;line-height:1.42;font-weight:700;letter-spacing:-.05em;margin-top:14px !important;min-height:184px}}
.tcol i{{display:block;font-style:normal;font-family:'Pretendard',sans-serif;font-size:30px;line-height:1.35;color:{GRAY};letter-spacing:-.04em;min-height:84px}}
.tcol u{{display:block;text-decoration:none;font-size:30px;line-height:1.35;font-weight:700;letter-spacing:-.05em;border-top:1px solid {INK};padding-top:10px;margin-top:10px}}
.tcol u span{{display:block;font-family:'Pretendard',sans-serif;font-weight:400;color:{GRAY}}}
.frow{{display:flex;margin-top:34px}}
.flabel{{flex:0 0 152px;font-family:'Pretendard',sans-serif;font-size:30px;line-height:1.3;color:{GRAY};letter-spacing:-.04em;padding-top:4px}}
.fcells{{display:flex}}
.fc{{width:150px;margin-right:0}}
.fc b{{display:block;font-size:30px;font-weight:700;letter-spacing:-.07em;line-height:1.2;margin-top:8px;white-space:nowrap}}
.face{{display:block;position:relative;overflow:hidden}}
.face img{{position:absolute;max-width:none}}
.fc .face{{width:138px !important}}
.srow{{display:flex;align-items:flex-start;border-top:1px solid {INK};padding:18px 0 16px;margin-top:0}}
.kicker+.srow{{margin-top:40px;border-top:0}}
.srow.alt{{flex-direction:row-reverse}}
.srow .stext{{flex:1;padding:0 0 0 34px}} .srow.alt .stext{{padding:0 34px 0 0}}
.stext b{{display:block;font-size:48px;font-weight:900;letter-spacing:-.06em;line-height:1.15}}
.stext i{{display:block;font-style:normal;font-family:'Pretendard',sans-serif;font-size:30px;color:{GRAY};letter-spacing:-.03em;line-height:1.3;margin-top:4px}}
.stext p{{font-size:32px;line-height:1.42;font-weight:700;letter-spacing:-.05em;margin-top:14px !important}}
.col{{position:absolute}} .col>.cap,.col>.bigq,.col>.midq,.col>.mini{{position:static}}
.pcap{{position:absolute;font-size:30px;line-height:1.4;font-weight:700;letter-spacing:-.04em}}
.pcap b{{display:block;font-size:40px;font-weight:900;letter-spacing:-.06em;line-height:1.2;margin-bottom:6px}}
.pcap span{{font-family:'Pretendard',sans-serif;font-weight:400;color:{GRAY};margin-right:6px}}
'''
html = ('<!doctype html><html lang="ko"><head><meta charset="utf-8">\n'
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@200;400;700;900&family=Bodoni+Moda:ital,opsz,wght@0,6..96,500;0,6..96,700;1,6..96,500&display=swap">\n'
        '<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">\n'
        '<style>' + CSS + '</style></head>\n<body>\n' + '\n'.join(P) + '\n</body></html>\n')
open(OUT, 'w').write(html)
print('plates', sum('class="plate"' in p for p in P), 'arca', sum('class="arca"' in p for p in P))
json.dump(USED, open(SP + '/used.json', 'w'), ensure_ascii=False, indent=0)
