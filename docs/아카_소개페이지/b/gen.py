# page.html 을 만든다. 인용문은 Q()/IB() 로만 넣고, 원문에 그대로 있는지 대조한다.
import json, os, re, html, urllib.parse
R='/home/user/goei-plugin'
W=json.load(open(R+'/.scratch/arca/kit/wiki_infobox.json'))
SCN=json.load(open(R+'/src/data/scenarios.json'))
SCE=json.load(open(R+'/src/data/world/scenes.json'))
used=[]
def fmt(s):
    s=html.escape(s,quote=False)
    s=re.sub(r'✂️(.*?)✂️',r'<s>\1</s>',s); s=re.sub(r'❗(.*?)❗',r'<b>\1</b>',s)
    return s
def Q(doc,part,cut=None):
    """doc 문서의 인용 가운데 part 로 시작하는(또는 포함하는) 것. cut 을 주면 그 잘라낸 부분만 싣는다. (말, 출처)"""
    for q in W[doc]['quotes']:
        t,_,src=q.partition('|Source:')
        if part in t:
            show=cut or t
            assert show in t,(doc,show)
            used.append((show,doc,src)); return fmt(show),fmt(src)
    raise Exception('인용 없음 '+doc+' '+part)
def IB(doc,key):
    v=W[doc]['infobox'][key]; used.append((key+' = '+v,doc,'정보상자')); return fmt(v)
def img(p):
    f=R+'/assets/'+p; assert os.path.exists(f),f
    return 'file://'+urllib.parse.quote(f)
def scr(p):
    f=R+'/.scratch/arca/kit/screens/'+p; assert os.path.exists(f),f
    return 'file://'+urllib.parse.quote(f)
A=lambda n: img('wiki/Anomalies/%s.avif'%n)
AG=lambda n: img('agents/%s_default.avif'%n)

def sub(doc,part,cut=None,cls=''):
    t,s=Q(doc,part,cut); return f'<p class="sub {cls}">{t}</p><p class="src {cls}">{s}</p>'
def credits(doc,keys,cls=''):
    rows=''.join(f'<div class="k">{k}</div><div class="v">{IB(doc,k)}</div>' for k in keys)
    return f'<div class="cr {cls}">{rows}</div>'
def faces(lst,cols):
    w=(860-120-(cols-1)*14)//cols
    cells=''.join(f'<div class="face" style="width:{w}px"><i style="background-image:url({AG(f)});width:{w}px"></i><span>{n}</span></div>' for n,f in lst)
    return f'<div class="faces">{cells}</div>'
def cast(file,name,doc,side='l',h=760,keys=('부서','직책'),quote=None,extra=''):
    role=' · '.join(IB(doc,k) for k in keys)
    t,s=Q(doc,*quote)
    return f'''<div class="cast {side}" style="height:{h}px;--h:{h}px"><img src="{AG(file)}" style="width:{h}px;height:{h}px">
<div class="who"><div class="name">{name}</div><div class="role">{role}</div>{extra}</div>
<div class="say"><p class="sub">{t}</p><p class="src">{s}</p></div></div>'''

P=[]
def plate(name,body):
    parts=body.split('<!--cut-->')
    for i,b in enumerate(parts): P.append(f'<section class="plate" data-name="{name}{"-"+str(i+1) if len(parts)>1 else ""}">{b}</section>')
def arca(body): P.append(f'<div class="arca"><div style="background-color:#0e0e0e;padding:34px 22px 38px;font-family:\'Pretendard\',\'Noto Sans KR\',\'Apple SD Gothic Neo\',\'Malgun Gothic\',sans-serif;">{body}</div></div>')
H=lambda t: f'<div style="font-size:15px;color:#85827a;margin:0 0 18px;">{t}</div>'

# 1 표지
plate('cover',f'''
<div style="height:110px"></div>
<h1 class="title">괴이 ː ANOMALY</h1>
<p class="src" style="margin-top:10px">RisuAI 괴담 시뮬레이션 봇</p>
<div style="height:120px"></div>
<div class="frame"><img class="still px" src="{A('Sora Land')}" style="height:860px">
<div class="in">{sub('소라 랜드','꿈과 환상이')}</div></div>
<div style="height:70px"></div>
{credits('소라 랜드',['분류','영업시간','위험도','재방문 후기'])}
<div style="height:90px"></div>''')

# 2 관리국
plate('bureau',f'''
<div style="height:60px"></div>
<img class="still" src="{img('wiki/Bases/Base Management Bureau.avif')}" style="height:360px;object-position:50% 62%">
<div style="height:44px"></div>
{sub('에일린','쓰레기 회사')}
<div style="height:110px"></div>
<p class="slate">관리국</p>
{credits('관리국',['분류','본부','인원','이름','사내 분위기','회식'])}
<div style="height:110px"></div>''')

# arca: 시작하는 자리
rows=''
for f in SCN['factions']:
    sc=' · '.join(s['label'] for s in f['scenarios'] if s['kind']=='opening')
    rows+=f'''<div style="margin:0 0 26px;"><div style="font-size:19px;font-weight:700;color:#f1eee7;margin:0 0 6px;">{f['name']}</div><div style="font-size:15px;line-height:1.7;color:#cfccc4;margin:0 0 6px;">{f['blurb']}</div><div style="font-size:14px;line-height:1.7;color:#85827a;">첫 장면 &nbsp;{sc}</div></div>'''
    used.append((f['blurb'],'scenarios.json '+f['code'],'blurb'))
arca(H('시작하는 자리 — 세력 5곳')+rows+'<div style="font-size:14px;line-height:1.7;color:#85827a;">세력마다 직접 입력 · 커스텀 임무</div>')

# 3 관리국 배역
plate('bureau-cast',f'''
<div style="height:40px"></div>
{cast('Jyaldi','쟈알디','쟈알디','l',780,quote=('하아. 잼트리',))}
<div style="height:150px"></div>
{cast('Aileen','에일린','에일린','r',620,keys=('부서','직책'),quote=('증명해.',))}
<div style="height:120px"></div>''')

# 4 관리국 나머지 + 불이 꺼진 관리국
plate('bureau-rest',f'''
<div style="height:30px"></div>
<p class="slate">관리국 종합대응팀 · 격리팀 · 진압팀</p>
{faces([('스팡달','Spangdal'),('잼트리','Jaemtri'),('데드폴','Deadpole'),('게슈간','Geshugan'),('로제몬','Rojemon'),('콘쥬스','Konjyuce'),('고그니쟈','Gognija'),('데쥬레','Dejure'),('큐라스','Kyuras'),('고르고디오','Gorgodio')],5)}
<div style="height:60px"></div>
{sub('데드폴','살아남으셨')}
<div style="height:100px"></div><!--cut--><div style="height:50px"></div>
<div class="frame" style="margin-left:240px;width:620px"><img class="still px" src="{A('Bureau with the Lights Out')}" style="width:620px;height:820px;object-position:60% 50%"></div>
<div style="height:44px"></div>
{sub('불이 꺼진 관리국','불이 꺼지면')}
<div style="height:60px"></div>
{credits('불이 꺼진 관리국',['공식 입장','비공식 입장'])}
<div style="height:110px"></div>''')

# 5 가짜 관리국
plate('fake',f'''
<div style="height:60px"></div>
<div class="frame" style="margin-left:160px;width:700px"><img class="still" src="{img('wiki/Factions/Fake Management Bureau.avif')}" style="width:700px;height:700px">
<div class="in" style="padding-top:160px">{sub('가짜 관리국','이미 진실을','축하해, 취직했어. 요원으로.','tight')}</div></div>
<div style="height:90px"></div>
<p class="slate">가짜 관리국</p>
{credits('가짜 관리국',['자칭','본부','복장','모집 방식'])}
<div style="height:90px"></div><!--cut--><div style="height:40px"></div>
{cast('Sa-jang','사장','사장','l',700,keys=('소속','직책'),quote=('UI 말입니다',),extra=f'<div class="role" style="margin-top:22px">얼굴<br><span style="color:#e8e5de">{IB("사장","얼굴")}</span></div>')}
<div style="height:120px"></div>''')

# 6 가짜 관리국 배역
plate('fake-cast',f'''
<div style="height:30px"></div>
{cast('Lee Do-hyeong','이도형','이도형','r',540,quote=('들어가.',))}
<div style="height:150px"></div>
<p class="slate">가짜 관리국 국장실 · 신입 교육 · 심문 · 검사부대 · 진압부대</p>
{faces([('도필헌','Do Pil-heon'),('이길환','Lee Gil-hwan'),('이기석','Lee Gi-seok'),('김조학','Kim Jo-hak'),('고영훈','Go Young-hoon'),('노기균','No Gi-gyun'),('송주익','Song Ju-ik'),('곽성주','Kwak Seong-ju'),('조성춘','Cho Seong-choon'),('윤병수','Yun Byeong-su'),('김성진','Kim Seong-jin'),('송진섭','Song Jin-seob')],6)}
<div style="height:60px"></div>
{sub('조성춘','나도 무서워')}
<div style="height:100px"></div>''')

# 7 백일몽
plate('baek',f'''
<div style="height:60px"></div>
<div class="frame" style="margin-left:380px;width:480px"><img class="still" src="{img('wiki/Bases/Base Baekilmong corporation.avif')}" style="width:480px;height:680px;object-position:62% 50%"></div>
<div style="height:44px"></div>
{sub('백일몽','축하합니다')}
<div style="height:100px"></div>
<p class="slate">백일몽 주식회사</p>
{credits('백일몽',['표면 업종','실제 상품','입사 시험','퇴사','복지'])}
<div style="height:110px"></div>''')

# 8 백일몽 배역
plate('baek-cast',f'''
<div style="height:30px"></div>
{cast('Jay','제이','제이','l',700,quote=('도넛을 좋아하는데',))}
<div style="height:190px"></div><!--cut--><div style="height:30px"></div>
<p class="slate">백일몽 주식회사 임원 · 행정지원 · 원료개발부 · 현장탐사팀</p>
{faces([('청달래','Cheong Dal-lae'),('호유원','Ho Yu-won'),('이병진','Lee Byeong-jin'),('곽제강','Kwak Je-gang'),('이연화','Lee Yeon-hwa'),('백석주','Baek Seok-ju'),('진나솔','Jin Na-sol'),('이성해','Lee Seong-hae'),('이자헌','Lee Ja-heon'),('은하제','Eun Ha-je'),('박민성','Park Min-seong'),('백사헌','Baek Sa-heon'),('고영은','Go Young-eun'),('강이학','Kang I-hak'),('장허운','Jang Heo-un')],5)}
<div style="height:60px"></div>
{sub('박민성','이 부서는')}
<div style="height:110px"></div>''')

# 9 민간인 · 프리랜서
plate('civil',f'''
<div style="height:60px"></div>
<div class="frame" style="width:560px"><img class="still" src="{img('wiki/Factions/The World Politics Forum.avif')}" style="width:560px;height:560px"></div>
<div style="height:40px"></div>
<p class="slate">민간인 — 세계정치 게시판</p>
{sub('세계정치 게시판','괴.담')}
<div style="height:100px"></div><!--cut--><div style="height:50px"></div>
<div class="frame" style="margin-left:180px;width:680px"><img class="still" src="{img('wiki/Factions/Freelancer.avif')}" style="width:680px;height:460px;object-position:50% 40%"></div>
<div style="height:40px"></div>
<p class="slate">프리랜서</p>
{sub('프리랜서','간단한 조사')}
<div style="height:110px"></div>''')

# 10 협회 · 중림
plate('assoc',f'''
<div style="height:30px"></div>

<p class="slate">특수재난대응협회 의뢰조정실</p>
{faces([('차여진','Cha Yeo-jin'),('서윤지','Seo Yun-ji')],5)}
<div style="height:50px"></div>
{sub('차여진','위험 등급?')}
<div style="height:60px"></div>
{sub('서윤지','재량은')}
<div style="height:170px"></div>
<p class="slate">중림 지하상가</p>
{faces([('고연지','Go Yeon-ji'),('윤지아','Yun Ji-a'),('마덕희','Ma Deok-hee'),('문혜란','Mun Hye-ran'),('신유리','Shin Yuri')],5)}
<div style="height:50px"></div>
{sub('신유리','울려면 밖에서')}
<div style="height:110px"></div>''')

# 11 이면의 주민들 + 탐미주의
plate('residents',f'''
<div style="height:60px"></div>
<img class="still" src="{img('wiki/Factions/Residents of the Hidden World.avif')}" style="height:360px;object-position:50% 38%">
<div style="height:44px"></div>
<p class="slate">이면의 주민들</p>
<div style="height:90px"></div>
<div class="bust"><i style="background-image:url({AG('Aestheticism')})"></i>
<div class="who"><div class="name">탐미주의</div><div class="role">{IB('탐미주의','소속')}</div><div class="role" style="margin-top:22px">공식 대응 지침<br><span style="color:#e8e5de">{IB("탐미주의","공식 대응 지침")}</span></div></div></div>
<div style="height:50px"></div>
{sub('탐미주의','멀리 못 갔네')}
<div style="height:120px"></div>''')

# 12 브라우니 + 따로 선 네 사람
def solo(file,name,doc,keys,quote,side):
    role=' · '.join(IB(doc,k) for k in keys); t,s=Q(doc,*quote)
    im=f'<i class="solo" style="background-image:url({AG(file)})"></i>'
    tx=f'<div class="solotx"><div class="name" style="font-size:44px">{name}</div><div class="role">{role}</div><p class="sub in0">{t}</p></div>'
    return f'<div class="solorow {side}">{im}{tx}</div>'
plate('residents-2',f'''
<div style="height:30px"></div>
<div class="frame"><img class="still px" src="{A('Tuesday Quiz Show')}" style="height:520px;object-position:50% 40%">
<img class="onstage" src="{AG('Brownie')}"></div>
<div style="height:40px"></div>
<p class="slate">브라우니 — {IB('브라우니','소속')}</p>
{sub('브라우니','제가 맞혀 볼게요')}
<div style="height:100px"></div><!--cut--><div style="height:50px"></div>
{solo('Blaret','블라렛','블라렛',('소속','직위'),('재밌는 거',),'l')}
{solo('Saladin','살라딘','살라딘',('소속',),('형제여! 나를 따르시오!',),'r')}
{solo('Avensha','아벤샤','아벤샤',('소속',),('제 실력을',),'l')}
{solo('Secriem','세크리엠','세크리엠',('분류',),('아하하',),'r')}
<div style="height:90px"></div>''')

lab=' · '.join('「%s」'%o['label'] for o in SCE['인물'].values())
arca(H('이면의 주민들 — 그 인물로 시작하는 첫 장면 13개')+f'<div style="font-size:15px;line-height:2.0;color:#cfccc4;word-break:keep-all;">{lab}</div>')

# 13 괴이 A
plate('anom-a',f'''
<div style="height:260px"></div>
{sub('한밤역','이 글과 함께','학생들을 구해 달라. 우리를 찾지는 마라. 우리는 실패했다.')}
<div style="height:300px"></div>
<img class="still px" src="{A('Abyss Transit Authority')}" style="height:360px;object-position:50% 58%">
<div style="height:44px"></div>
{sub('심연교통공사','이번 역은','이번 역은, 슬픔, 슬픔역입니다. 내리실 문은 오른쪽입니다.')}
<div style="height:60px"></div>
{credits('심연교통공사',['탑승 방법','노선도'])}
<div style="height:100px"></div><!--cut--><div style="height:70px"></div>
<div class="frame" style="margin-left:200px;width:660px"><img class="still px" src="{A('Lookymart')}" style="width:660px;height:660px"></div>
<div style="height:44px"></div>
{sub('룩키마트','이거 보는 사람')}
<div style="height:110px"></div>''')

# 14 괴이 B
plate('anom-b',f'''
<div style="height:60px"></div>
<div class="frame" style="margin-left:60px;width:480px"><img class="still px" src="{A('Dimensional Elevator')}" style="width:480px;height:720px"></div>
<div style="height:44px"></div>
{sub('차원 승강기','띵.')}
<div style="height:60px"></div>
{credits('차원 승강기',['층수','최저 기록'])}
<div style="height:100px"></div><!--cut--><div style="height:70px"></div>
<div class="frame" style="margin-left:340px;width:520px"><img class="still px" src="{A('Forbidden Video')}" style="width:520px;height:520px"></div>
<div style="height:50px"></div>
<p class="slate">금지된 비디오</p>
{credits('금지된 비디오',['장르','러닝타임','관람 등급'])}
<div style="height:110px"></div>''')

# 15 밀착 인화
def fr(n,w,h,pos='50% 50%'): return f'<img class="px" src="{A(n)}" style="width:{w}px;height:{h}px;object-position:{pos}">'
plate('sheet',f'''
<div style="height:40px"></div>
<div class="sheet">
{fr('Monkey Dream',282,282)}{fr('Gangbuk Special Hospital',283,282)}{fr('Frost Waterpark',283,282)}
{fr('Samangdan',860,360,'50% 60%')}
<div class="col" style="width:340px">{fr('Red Lady\'s Musical Theater',340,526)}</div><div class="col" style="width:514px">{fr('Dusk Station',514,260,'50% 45%')}{fr('Morning Station',514,260,'50% 30%')}</div>
{fr('Hungry Hangman',210,210)}{fr('Dark Garden',211,210)}{fr('Yu-gye Station',211,210)}{fr('Twinkle Dragon Palace',210,210)}
</div>
<div style="height:60px"></div>''')

names=['원숭이 꿈 괴담','강북 특설병원','프러스트 워터파크','사망단길','뮤지컬 붉은 숙녀','황혼역','아침역','헝그리 행맨','어두운 정원','유계역','반짝반짝 용궁']
for n in names: assert n in W
def ibline(doc,key): return f'<div style="font-size:15px;line-height:1.9;color:#cfccc4;"><span style="color:#85827a;">{doc} · {key}</span> &nbsp;{IB(doc,key)}</div>'
arca(H('괴이 63곳 · 특수 장소 11곳 — 위 그림은 왼쪽 위부터')+f'<div style="font-size:15px;line-height:1.9;color:#cfccc4;word-break:keep-all;margin:0 0 26px;">{" · ".join(names)}</div>'
 +ibline('사망단길','결제 수단')+ibline('사망단길','숙박')+ibline('명일 아파트','엘리베이터')+ibline('소토스 백화점','계산대')+ibline('샛별 고시원','방 크기')+ibline('무엇이든 자판기','환불')+ibline('한낮역','현재 시각')+ibline('자정역','단골'))

# 16 화면
S=lambda w: w/2250
def pc(file,w,x0=155,y0=112,cw=2250,ch=1496,style=''):
    k=w/cw; return f'<i class="dev" style="width:{w}px;height:{ch*k:.0f}px;background-image:url({scr(file)});background-size:{2560*k:.1f}px auto;background-position:-{x0*k:.1f}px -{y0*k:.1f}px;border-radius:{44*k:.0f}px;{style}"></i>'
plate('screens',f'''
<div style="height:70px"></div>
<p class="slate" style="margin-bottom:26px">임무 — 지도에서 장소를 골라 요원 넷을 편성해 출동</p>
{pc('promo/pc-play-03-map.png',980,style='margin-left:60px')}
<div style="height:100px"></div><!--cut--><div style="height:40px"></div>
<div style="height:600px;position:relative">
<img class="dev" src="{scr('promo/phone-play-04-phone.png')}" style="position:absolute;right:60px;top:0;width:277px;height:600px;border-radius:26px">
<p class="slate" style="position:absolute;left:0;top:420px;width:400px">괴담톡 — 연락처 · 대화 · 공지, 전화, 단톡</p></div>
<div style="height:140px"></div>
<p class="slate" style="margin-bottom:26px">인터넷 — 괴담넷 · 괴이위키 · 망상홈쇼핑 외</p>
{pc('promo/pc-play-05-net.png',740,x0=630,y0=230,cw=1775,ch=1130,style='margin-left:60px;border-radius:0 0 18px 0')}
<div style="height:110px"></div>''')

arca(H('화면')+''.join(f'<div style="font-size:15px;line-height:1.9;color:#cfccc4;"><span style="color:#f1eee7;font-weight:700;">{a}</span> &nbsp;{b}</div>' for a,b in [
 ('상황판','요원 화면, 지금 벌어진 괴이 · 사건 · 특수 상황'),('임무','지도에서 장소를 골라 요원 넷을 편성해 출동, 커스텀 임무'),('괴담톡','연락처 · 대화 · 공지, 전화, 단톡'),
 ('인터넷','괴담넷, 괴담 갤러리, 세정게, 연어 마켓, 우주 쇼핑몰, 괴이위키, 백일몽 포인트몰, 망상홈쇼핑'),('소지품','무기 2칸 · 장비 4칸 장착, 가계부'),('기록','일지 · 연대기 · 인물 · 세력')])
 +'<div style="font-size:14px;line-height:1.9;color:#85827a;margin:18px 0 0;">인물 55명 · 인물당 표정 41종 · 조직 17곳 · 위키 문서 143개 · 한국어 · English</div>')

# 17 끝
plate('end',f'''
<div style="height:80px"></div>
<div class="frame" style="margin-left:60px;width:640px"><img class="still px" src="{A('Hotel Inspiration')}" style="width:640px;height:800px;object-position:55% 50%"></div>
<div style="height:44px"></div>
{sub('인스피레이션 호텔','목적지에 도착했습니다')}
<div style="height:100px"></div>''')

P.append('''<div class="arca"><div style="background-color:#0e0e0e;padding:10px 22px 70px;font-family:'Pretendard','Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif;"><div style="font-size:15px;color:#85827a;margin:0 0 16px;">받기 — 괴이 ː ANOMALY</div><a href="https://github.com/leepc25/goei-plugin/releases/latest" target="_blank" rel="noopener noreferrer" style="text-decoration:none;"><span style="display:inline-block;padding:14px 30px;background-color:#e8e5de;border-radius:2px;"><span style="color:#0a0a0b;font-size:16px;font-weight:700;">받기</span></span></a><div style="font-size:14px;color:#85827a;margin:14px 0 0;word-break:break-all;">github.com/leepc25/goei-plugin/releases/latest</div></div></div>''')

GR="url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .55 0'/></filter><rect width='300' height='300' filter='url(%23n)'/></svg>\")"
CSS='''
body{margin:0;width:860px;background:#0a0a0b}
.plate{width:860px;background:#0a0a0b;color:#e8e5de;font-family:'Noto Sans KR',sans-serif;position:relative;overflow:hidden;word-break:keep-all}
.plate::after{content:"";position:absolute;inset:0;background-image:GRAIN;opacity:.05;pointer-events:none;mix-blend-mode:screen}
.plate p{margin:0}
.title{font-family:'Noto Serif KR',serif;font-weight:600;font-size:50px;letter-spacing:.01em;margin:0 60px;color:#f1eee7}
.still{display:block;width:860px;object-fit:cover}
.px{image-rendering:pixelated;object-fit:cover}
.frame{position:relative;line-height:0}
.frame .in{position:absolute;left:0;right:0;bottom:0;padding:200px 0 46px;line-height:1.5;background:linear-gradient(180deg,rgba(10,10,11,0),rgba(10,10,11,.82) 55%,rgba(10,10,11,.96))}
.sub{font-size:36px;font-weight:500;line-height:1.52;letter-spacing:-.012em;margin:0 60px!important;color:#f1eee7;text-shadow:0 2px 3px rgba(0,0,0,.7)}
.src{font-size:30px;font-weight:400;line-height:1.45;color:#85827a;margin:14px 60px 0!important;letter-spacing:-.01em}
.slate{font-size:30px;color:#85827a;margin:0 60px 20px!important;line-height:1.45}
.cr{display:grid;grid-template-columns:210px 1fr;column-gap:30px;row-gap:14px;margin:0 60px;font-size:30px;line-height:1.45}
.cr .k{text-align:right;color:#85827a}
.cr .v{color:#e8e5de}
s{color:#85827a;text-decoration-thickness:2px}
b{font-weight:700;color:#fff}
.cast{position:relative}
.cast img{position:absolute;top:0;object-fit:contain}
.cast img{-webkit-mask-image:linear-gradient(#000 66%,transparent 97%);mask-image:linear-gradient(#000 66%,transparent 97%)}
.cast::before{content:"";position:absolute;top:-8%;width:var(--h);height:var(--h);background:radial-gradient(closest-side,#252528 0,#161618 45%,rgba(10,10,11,0) 100%)}
.cast.l img,.cast.l::before{left:-70px}
.cast.r img,.cast.r::before{right:-70px}
.bust{position:relative;height:420px}
.bust i{position:absolute;right:0;top:0;width:480px;height:420px;background-size:1000px auto;background-position:52% -95px;background-repeat:no-repeat;-webkit-mask-image:linear-gradient(#000 70%,transparent 99%),linear-gradient(90deg,transparent 0,#000 16%);-webkit-mask-composite:source-in;mask-image:linear-gradient(#000 70%,transparent 99%),linear-gradient(90deg,transparent 0,#000 16%);mask-composite:intersect}
.bust .who{position:absolute;left:60px;top:60px;width:330px}
.sub.in0{margin:22px 0 0!important;font-size:32px}
.sub.tight,.src.tight{margin-left:44px!important}
.cast .who{position:absolute;top:70px;width:330px}
.cast.l .who{right:50px}.cast.r .who{left:60px}
.cast .say{position:absolute;bottom:-70px;left:0;right:0}
.cast.l .say{padding-left:330px}.cast.r .say{padding-right:330px}
.cast .say .sub,.cast .say .src{margin-right:50px!important}
.cast.r .say .sub,.cast.r .say .src{margin-right:0!important}
.name{font-family:'Noto Serif KR',serif;font-weight:600;font-size:60px;line-height:1.2;color:#f1eee7}
.role{font-size:30px;line-height:1.5;color:#85827a;margin-top:14px}
.faces{display:flex;flex-wrap:wrap;gap:34px 14px;margin:0 60px}
.face i{display:block;height:230px;background-size:330px auto;background-position:50% -8px;background-repeat:no-repeat;background-color:#121214}
.face span{display:block;font-size:30px;margin-top:8px;color:#cfccc4;white-space:nowrap;letter-spacing:-.03em}
.onstage{position:absolute;left:250px;bottom:0;width:360px;height:360px}
.solorow{display:flex;align-items:flex-end;gap:36px;margin:0 60px 70px}
.solorow.r{flex-direction:row-reverse;text-align:right}
.solo{flex:none;display:block;width:250px;height:330px;background-size:470px auto;background-position:50% -6px;background-repeat:no-repeat;background-color:#121214}
.solotx{flex:1;padding-bottom:6px}
.sheet{display:flex;flex-wrap:wrap;gap:6px;line-height:0}
.sheet .col{display:flex;flex-direction:column;gap:6px}
.dev{display:block;background-repeat:no-repeat;box-shadow:0 0 0 1px rgba(255,255,255,.07),0 20px 70px rgba(60,170,150,.08)}
'''.replace('GRAIN',GR)
open(R+'/.scratch/arca/b/page.html','w').write('<!doctype html><html lang="ko"><head><meta charset="utf-8">\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&family=Noto+Serif+KR:wght@500;600&display=swap">\n<style>'+CSS+'</style></head>\n<body>\n'+'\n'.join(P)+'\n</body></html>')
json.dump(used,open(R+'/.scratch/arca/b/used_quotes.json','w'),ensure_ascii=False,indent=1)
print(len(P),'blocks',len(used),'quotes')
