# page.html 을 만든다(2차 조판). 페이지에 들어가는 문장은 Q()/L()/IB()/SC()/GR()/BL() 로만 넣고,
# 그때마다 원문에 그대로 있는지 대조(assert)한다. 쓴 문장은 used_quotes.json 에 남긴다.
import json, os, re, html, urllib.parse
R='/home/user/goei-plugin'
W=json.load(open(R+'/.scratch/arca/kit/wiki_infobox.json'))
SCN=json.load(open(R+'/src/data/scenarios.json'))
SCE=json.load(open(R+'/src/data/world/scenes.json'))['인물']
GRT=json.load(open(R+'/src/data/world/greetings.json'))
used=[]
def fmt(s):
    s=html.escape(s,quote=False)
    s=re.sub(r'✂️(.*?)✂️',r'<s>\1</s>',s); s=re.sub(r'❗(.*?)❗',r'<b>\1</b>',s)
    return s
def _q(doc,part):
    for q in W[doc]['quotes']:
        t,_,src=q.partition('|Source:')
        if part in t: return t,src
    raise Exception('인용 없음 '+doc+' '+part)
def Q(doc,part,cut=None):
    t,src=_q(doc,part); show=cut or t; assert show in t,(doc,show)
    used.append((show,'위키 '+doc,src)); return fmt(show),fmt(src)
def L(doc,part,segs):
    """인용을 내가 정한 자리에서 줄바꿈. 조각마다 원문에 그대로 있어야 한다."""
    t,src=_q(doc,part)
    for s in segs: assert s in t,(doc,s)
    used.append((' / '.join(segs),'위키 '+doc,src)); return '<br>'.join(fmt(s) for s in segs),fmt(src)
def IB(doc,key):
    v=W[doc]['infobox'][key]; used.append((key+' = '+v,'위키 '+doc,'정보상자')); return fmt(v)
def SC(pid,*segs):
    t=SCE[pid]['ko']
    for s in segs: assert s in t,(pid,s)
    used.append((' / '.join(segs),'scenes.json '+pid,SCE[pid]['label'])); return '<br>'.join(fmt(s) for s in segs)
def SL(pid): used.append((SCE[pid]['label'],'scenes.json '+pid,'label')); return fmt(SCE[pid]['label'])
def GR(key,*segs):
    t=GRT['texts'][GRT['index'][key]]
    for s in segs: assert s in t and '{{user}}' not in s,(key,s)
    used.append((' / '.join(segs),'greetings.json '+key,'첫 장면 본문')); return '<br>'.join(fmt(s) for s in segs)
FAC={f['code']:f for f in SCN['factions']}
def BL(code): used.append((FAC[code]['blurb'],'scenarios.json '+code,'blurb')); return fmt(FAC[code]['blurb'])
def FIRST(code):
    labs=[s['label'] for s in FAC[code]['scenarios'] if s['kind']=='opening']
    used.append((' · '.join(labs),'scenarios.json '+code,'첫 장면 제목'))
    return ' · '.join('<span class="nw">%s</span>'%fmt(l) for l in labs)
def img(p):
    f=R+'/assets/'+p; assert os.path.exists(f),f
    return 'file://'+urllib.parse.quote(f)
def scr(p):
    f=R+'/.scratch/arca/kit/screens/'+p; assert os.path.exists(f),f
    return 'file://'+urllib.parse.quote(f)
A=lambda n: img('wiki/Anomalies/%s.avif'%n)
F=lambda n: img('wiki/Factions/%s.avif'%n)
AG=lambda n: img('agents/%s_default.avif'%n)
PT=lambda n,e: img('portraits/%s/%s_%s.avif'%(n,n,e))
sp=lambda h: f'<div style="height:{h}px"></div>'

def cap(src,who=None,cls=''):
    return f'<p class="cap {cls}">{(who+" — ") if who else ""}{src}</p>'
def sub(doc,part,cut=None,who=None,size=None,cls=''):
    t,s=Q(doc,part,cut); st=f' style="font-size:{size}px"' if size else ''
    return f'<p class="sub {cls}"{st}>{t}</p>{cap(s,who,cls)}'
def big(doc,part,segs,size,who=None,cls='',lh=1.22):
    t,s=L(doc,part,segs)
    return f'<p class="big {cls}" style="font-size:{size}px;line-height:{lh}">{t}</p>{cap(s,who,cls)}'
def credits(doc,keys,cls=''):
    rows=''.join(f'<div class="k">{k}</div><div class="v">{IB(doc,k)}</div>' for k in keys)
    return f'<div class="cr {cls}">{rows}</div>'
def head(name,code,greet=None,gsrc=None):
    g=f'<p class="sub" style="margin-top:44px!important">{greet}</p>{cap(gsrc)}' if greet else ''
    return f'<h2 class="hd">{name}</h2><p class="blurb">{BL(code)}</p><p class="first"><span class="lab">첫 장면</span>{FIRST(code)}</p>{g}'
def face(f,w,h,z=2.25,y=-0.02,x=50,exp=None,extra=''):
    bw=w*z; u=PT(f,exp) if exp else AG(f)
    return f'<i class="fc" style="width:{w}px;height:{h}px;background-image:url({u});background-size:{bw:.0f}px auto;background-position:{x}% {y*bw:.0f}px;{extra}"></i>'
def row(f,name,doc,part,cut=None,rolekeys=('직책',),src=False,title=None,scene=None,fz=2.25,fy=-0.02,fx=50):
    role=' · '.join(IB(doc,k) for k in rolekeys)
    t,s=Q(doc,part,cut)
    ti=f'<div class="ti">{title}</div>' if title else ''
    sc=f'<div class="sc">{scene}</div>' if scene else ''
    return f'''<div class="row">{face(f,132,164,fz,fy,fx)}<div>{ti}<div class="n">{name}<span class="r">{role}</span></div>{sc}<div class="q">{t}</div>{f'<div class="s">{s}</div>' if src else ''}</div></div>'''
def fig(f,h,style):
    return f'<img class="fig" src="{AG(f)}" style="height:{h}px;width:{h*832/1216:.0f}px;{style}">'
def crop(file,Wd,sx,sy,sw,sh,natW,style='',rad=0):
    k=Wd/sw
    return f'<i class="dev" style="width:{Wd}px;height:{sh*k:.0f}px;background-image:url({scr(file)});background-size:{natW*k:.1f}px auto;background-position:-{sx*k:.1f}px -{sy*k:.1f}px;border-radius:{rad}px;{style}"></i>'
def tile(n,name,w,h,pos='50% 50%'):
    assert name in W,name
    return f'<div class="tile" style="width:{w}px;height:{h}px"><img class="px" src="{A(n)}" style="width:{w}px;height:{h}px;object-position:{pos}"><span>{name}</span></div>'

P=[]
def plate(name,body,cls=''):
    parts=body.split('<!--cut-->')
    for i,b in enumerate(parts): P.append(f'<section class="plate {cls}" data-name="{name}{"-"+str(i+1) if len(parts)>1 else ""}">{b}</section>')
AF="font-family:'Pretendard','Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif;"
def arca(body,pad='44px 7% 50px'): P.append(f'<div class="arca"><div style="background-color:#0b0b0c;padding:{pad};{AF}word-break:keep-all;">{body}</div></div>')

# ───────── 1 표지
t,s=L('소라 랜드','꿈과 환상이',['꿈과 환상이 가득한 소라 랜드로~','즐거운 소라 랜드로 오세요~'])
plate('cover',f'''
<div class="frame" style="height:1250px"><img class="px" src="{A('Sora Land')}" style="width:860px;height:1250px;object-position:26% 50%">
<div class="shade" style="top:0;height:520px;background:linear-gradient(180deg,rgba(6,6,7,.72),rgba(6,6,7,0))"></div>
<h1 class="title">괴이</h1>
<div class="title2"><span>ː</span>ANOMALY</div>
<div class="kind">RisuAI 괴담 시뮬레이션 봇</div>
<div class="in"><p class="sub" style="font-size:48px;line-height:1.36;font-weight:700">{t}</p>{cap(s)}</div></div>
{sp(70)}
{credits('소라 랜드',['분류','영업시간','마스코트','위험도','재방문 후기'])}
{sp(110)}''')

# ───────── 2 시작하는 자리
names=''.join(f'<div>{f["name"]}</div>' for f in SCN['factions'])
plate('start',f'''
{sp(70)}
<div style="position:relative;height:640px">
{crop('promo/phone-start-01-open.png',380,0,236,780,1090,780,'position:absolute;left:60px;top:0',22)}
<div style="position:absolute;left:490px;top:-6px;width:330px">
<p class="lab2">시작하는 자리</p>
<div class="five">{names}<div class="alt">이면의 주민들</div></div>
</div></div>
{sp(80)}
<div class="cr"><div class="k">세력</div><div class="v">5곳, 세력마다 첫 장면 · 직접 입력 · 커스텀 임무</div>
<div class="k">이면의 주민들</div><div class="v">13명, 그 인물로 시작하는 첫 장면</div>
<div class="k">인물</div><div class="v">55명, 인물당 표정 41종</div>
<div class="k">괴이</div><div class="v">63곳</div>
<div class="k">조직</div><div class="v">17곳</div>
<div class="k">특수 장소</div><div class="v">11곳</div>
<div class="k">괴이위키</div><div class="v">문서 143개</div>
<div class="k">언어</div><div class="v">한국어 · English</div></div>
{sp(120)}''')

# ───────── 3 관리국
plate('bureau',f'''
<img class="still" src="{img('wiki/Bases/Base Management Bureau.avif')}" style="height:360px;object-position:50% 62%">
{sp(70)}
{head('관리국','A00',GR('A00-ko-1','여기서는 다들 코드네임을 써.','본명은 어디서도 꺼내면 안 돼.'),'첫 장면에서, 잼트리')}
{sp(80)}
{credits('관리국',['분류','본부','인원','이름','사내 분위기','회식'])}
{sp(110)}''')

t,s=L('쟈알디','하아. 잼트리',['하아. 잼트리.','이것 좀 어떻게 해 봐.'])
t2,s2=Q('잼트리','어머, 후배')
plate('jyaldi',f'''
<div class="stage" style="height:1010px">
<div class="glow" style="left:-120px;top:-40px;width:800px;height:800px"></div>
{fig('Jyaldi',940,'left:-110px;top:20px')}
<div class="who" style="left:470px;top:110px;width:340px"><div class="name">쟈알디</div><div class="role">{IB('쟈알디','부서')}<br>{IB('쟈알디','직책')}</div>
<div class="role" style="margin-top:26px">커피<br><span class="w">{IB('쟈알디','커피')}</span></div><div class="role" style="margin-top:18px">약점<br><span class="w">{IB('쟈알디','약점')}</span></div></div>
<div class="over" style="left:60px;right:40px;bottom:0"><p class="big" style="font-size:78px;line-height:1.2;margin:0!important">{t}</p><p class="cap" style="margin:16px 0 0!important">쟈알디 — {s}</p></div>
</div>
{sp(110)}
<div class="pair r">{face('Jaemtri',230,280,2.1,-0.02)}<div><p class="big" style="font-size:60px;margin:0!important">{t2}</p><p class="cap" style="margin:14px 0 0!important">잼트리 — {s2}</p>
<div class="role" style="margin-top:26px">자칭 <span class="w">{IB('잼트리','자칭')}</span></div></div></div>
{sp(120)}''')

exps=['annoyed','smirk','exhausted','laughing','surprised','suspicious','crying','proud']
strip=''.join(face('Aileen',215,270,2.5,-0.035,50,exp=e) for e in exps)
t,s=Q('에일린','증명해.')
plate('aileen',f'''
{sp(40)}
<div class="filmstrip">{strip}</div>
{sp(34)}
<div class="m" style="display:flex;justify-content:space-between;align-items:baseline"><div class="name">에일린</div><div class="role" style="margin:0">인물마다 표정 41종</div></div>
<div class="role m" style="margin-top:10px">{IB('에일린','부서')} · {IB('에일린','직책')}</div>
{sp(90)}
<p class="big" style="font-size:210px;line-height:1;letter-spacing:-.04em">{t}</p>
<div style="height:14px"></div>{cap(s,'에일린')}
{sp(90)}
{big('에일린','쓰레기 회사',['관리국이 하는 일은','쓰레기 회사랑 다를 게 없어.'],56,who='에일린',lh=1.3)}
{sp(50)}
{credits('에일린',['능력','근속','호칭'])}
{sp(120)}''')

t1,s1=Q('고그니쟈','데쥬레!!!','데쥬레!!! 커피 좀 타 오게!')
t2,s2=Q('데쥬레','아와와')
t3,s3=Q('큐라스','진압팀엔')
t4,s4=Q('고르고디오','그냥 이거부터','그냥 이거부터 다 부수는 게 낫지 않나?')
def duo(a,b):
    return f'<div class="duo">{a}{b}</div>'
def duoc(f,name,doc,t,s,fz=2.1,fy=-0.02):
    return f'<div>{face(f,358,300,fz,fy)}<div class="n">{name}<span class="r">{IB(doc,"직책")}</span></div><div class="q">{t}</div><div class="s">{s}</div></div>'
plate('bureau-team',f'''
{sp(50)}
<p class="dept">관리국 종합대응팀</p>
{row('Spangdal','스팡달','스팡달','있잖아, 있잖아','있잖아, 있잖아. 너는 언제 죽을 것 같아?',src=True)}
{row('Deadpole','데드폴','데드폴','여기서 제가',src=True)}
{row('Geshugan','게슈간','게슈간','그래. 미안.',src=True)}
{row('Rojemon','로제몬','로제몬','현장 출동이면',src=True)}
{row('Konjyuce','콘쥬스','콘쥬스','잠깐만요!',src=True)}
{sp(60)}<!--cut-->{sp(50)}
<p class="dept">관리국 격리팀</p>
{duo(duoc('Gognija','고그니쟈','고그니쟈',t1,s1),duoc('Dejure','데쥬레','데쥬레',t2,s2))}
{sp(110)}
<p class="dept">관리국 진압팀</p>
{duo(duoc('Kyuras','큐라스','큐라스',t3,s3),duoc('Gorgodio','고르고디오','고르고디오',t4,s4))}
{sp(120)}''')

t,s=L('불이 꺼진 관리국','불이 꺼지면',['관리국의 불은','꺼지지 않는다.'])
t0,_=Q('불이 꺼진 관리국','불이 꺼지면','불이 꺼지면 아무것도 믿지 말고 뛰어라.')
plate('lightsout',f'''
<div class="frame" style="height:1180px"><img class="px" src="{A('Bureau with the Lights Out')}" style="width:860px;height:1180px;object-position:62% 50%">
<div class="in" style="padding-top:420px"><p class="sub" style="font-size:42px">{t0}</p>
<p class="big" style="font-size:112px;line-height:1.14;margin-top:18px!important">{t}</p>{cap(s)}</div></div>
{sp(60)}
<p class="lab2 m">불이 꺼진 관리국</p>
{credits('불이 꺼진 관리국',['분류','공식 입장','비공식 입장','사내 방송'])}
{sp(130)}''')

# ───────── 4 가짜 관리국 (밝은 바닥)
crowd=['Yun Byeong-su','Kim Jo-hak','Song Ju-ik','Do Pil-heon','Go Young-hoon','Lee Gil-hwan','Kwak Seong-ju','No Gi-gyun','Lee Gi-seok','Cho Seong-choon','Kim Seong-jin','Song Jin-seob','Lee Do-hyeong']
cr=''.join(f'<img src="{AG(f)}" style="left:{-118+i*70}px;height:{600 if i%2==0 else 570}px;top:{30 if i%2==0 else 56}px;z-index:{i}">' for i,f in enumerate(crowd))
plate('fake',f'''
<div class="crowd" style="height:500px">{cr}</div>
<div class="rule"></div>
{sp(36)}
<p class="sub" style="font-size:44px;font-weight:700">{GR('B00-ko-1','검은 정장을 입은.','선글라스의 사내들.')}</p>{cap('첫 장면에서')}
{sp(90)}
<h2 class="hd">가짜 관리국</h2><p class="blurb">{BL('B00')}</p><p class="first"><span class="lab">첫 장면</span>{FIRST('B00')}</p>
{sp(70)}
{credits('가짜 관리국',['분류','자칭','운영 방식','복장','모집 방식','관리국과의 관계'])}
{sp(110)}''','lt')

t,s=L('김조학','넌 이미 진실을',['축하해, 취직했어.','요원으로.'])
t0,_=Q('김조학','넌 이미 진실을','대학은 왜 가? 좋은 직장 가려고 가는 거잖아.')
plate('fake-chair',f'''
{sp(40)}
<img src="{F('Fake Management Bureau')}" style="display:block;width:620px;height:620px;margin-left:240px;object-fit:cover">
{sp(56)}
<p class="sub">{t0}</p>
<p class="big" style="font-size:104px;line-height:1.14;margin-top:14px!important">{t}</p>
{cap(s,'김조학')}
{sp(120)}''','lt')

t,s=L('사장','UI 말입니다',['UI 말입니다.','개선할 점이 있으면','말씀해 주세요.'])
t2,s2=L('이도형','들어가.',['들어가.'])
plate('fake-boss',f'''
<div class="stage" style="height:1080px">
{fig('Sa-jang',1040,'right:-210px;top:40px;-webkit-mask-image:linear-gradient(#000 60%,transparent 92%),linear-gradient(90deg,transparent 4%,#000 30%);-webkit-mask-composite:source-in;mask-image:linear-gradient(#000 60%,transparent 92%),linear-gradient(90deg,transparent 4%,#000 30%);mask-composite:intersect')}
<div class="who" style="left:60px;top:90px;width:400px"><div class="name">사장</div><div class="role">{IB('사장','소속')}<br>{IB('사장','직책')}</div>
<div class="role" style="margin-top:30px">본명<br><span class="w">{IB('사장','본명')}</span></div>
<div class="role" style="margin-top:18px">얼굴<br><span class="w">{IB('사장','얼굴')}</span></div>
<div class="role" style="margin-top:18px">선글라스<br><span class="w">{IB('사장','선글라스')}</span></div></div>
<div class="over" style="left:60px;right:40px;bottom:10px"><p class="big" style="font-size:66px;line-height:1.24;margin:0!important">{t}</p><p class="cap" style="margin:16px 0 0!important">사장 — {s}</p></div>
</div>
{sp(120)}<!--cut-->
<div class="stage" style="height:880px">
{fig('Lee Do-hyeong',900,'left:-120px;top:40px')}
<div class="who" style="left:440px;top:90px;width:380px"><div class="name">이도형</div><div class="role">{IB('이도형','부서')} · {IB('이도형','직책')}</div>
<div class="role" style="margin-top:26px">무기<br><span class="w">{IB('이도형','무기')}</span></div>
<div class="role" style="margin-top:18px">약점<br><span class="w">{IB('이도형','약점')}</span></div></div>
<div class="over" style="left:0;right:50px;bottom:0;text-align:right"><p class="big" style="font-size:230px;line-height:1;letter-spacing:-.05em;margin:0!important">{t2}</p></div>
</div>
<p class="cap" style="margin-top:20px!important;text-align:right">이도형 — <span class="nw">턱짓과 함께,</span> <span class="nw">작전 개시 명령의 전문(全文)</span></p>
{sp(120)}''','lt')

RK=('직책',)
plate('fake-team',f'''
{sp(50)}
<p class="dept">가짜 관리국 국장실</p>
{row('Do Pil-heon','도필헌','도필헌','만나서 반갑네.',rolekeys=('직급',),src=True)}
<p class="dept">신입 교육</p>
{row('Lee Gil-hwan','이길환','이길환','테스트, 테스트',src=True)}
{row('Lee Gi-seok','이기석','이기석','안 들립니다!',src=True)}
<p class="dept">심문·정보보안</p>
{row('Kim Jo-hak','김조학','김조학','어이, 나 김조학',src=True)}
<p class="dept">검사부대</p>
{row('Go Young-hoon','고영훈','고영훈','정지.',src=True)}
{row('No Gi-gyun','노기균','노기균','검의 세계로','검의 세계로 떠나자! 내 손을 잡아라!',src=True)}
{row('Song Ju-ik','송주익','송주익','막내가 하는','이, 이런 건 원래 막내가 하는 거라고요!',src=True)}
{sp(40)}<!--cut-->{sp(50)}
<p class="dept">가짜 관리국 진압부대</p>
{row('Kwak Seong-ju','곽성주','곽성주','시끄러',src=True)}
{row('Cho Seong-choon','조성춘','조성춘','나도 무서워',src=True)}
<p class="dept">진압부대 신입 7팀</p>
{row('Yun Byeong-su','윤병수','윤병수','이제야 기계',src=True)}
{row('Kim Seong-jin','김성진','김성진','우리 콤비가',src=True)}
{row('Song Jin-seob','송진섭','송진섭','혼자 기다리라고',src=True)}
{sp(110)}''','lt')

# ───────── 5 백일몽
t,s=L('백일몽','축하합니다',['축하합니다. 여러분은 오늘부터','백일몽의 정식 사원입니다.','사원증과 가면은','출구에서 받아 가세요.'])
plate('baek',f'''
{sp(90)}
{crop('s-malls/pc-08-bm.png',800,628,430,1776,1060,2560,'margin-left:60px',10)}
<p class="cap" style="margin-top:18px!important">인터넷 — 백일몽 포인트몰</p>
{sp(110)}
<p class="big" style="font-size:54px;line-height:1.36">{t}</p>{cap(s)}
{sp(110)}
<img src="{img('wiki/Bases/Base Baekilmong corporation.avif')}" style="display:block;width:860px;height:400px;object-fit:cover;object-position:50% 40%">
{sp(70)}
{head('백일몽 주식회사','C00',GR('C00-ko-2','참고로, 신입이 다 뒤져서','D조라는 별명이 있다.','농담이야.'),'첫 장면에서, D조 사무실')}
{sp(80)}
{credits('백일몽',['표면 업종','실제 상품','현장 복장','입사 시험','퇴사','복지'])}
{sp(120)}''')

t,s=L('제이','도넛을 좋아하는데',['도넛을 좋아하는데…','회사까지 배달해 주는 데가 없고…','낮에는 나갈 수가 없어서……'])
plate('jay',f'''
<div class="stage" style="height:1040px">
<div class="glow" style="right:-140px;top:-40px;width:800px;height:800px"></div>
{fig('Jay',960,'right:-120px;top:20px')}
<div class="who" style="left:60px;top:110px;width:400px"><div class="name">제이</div><div class="role">{IB('제이','소속')}<br>{IB('제이','부서')} · {IB('제이','직책')}</div>
<div class="role" style="margin-top:26px">식별명<br><span class="w">{IB('제이','식별명')}</span></div>
<div class="role" style="margin-top:18px">계약<br><span class="w">{IB('제이','계약')}</span></div></div>
<div class="over" style="left:60px;right:40px;bottom:0"><p class="big" style="font-size:47px;line-height:1.36;margin:0!important">{t}</p><p class="cap" style="margin:16px 0 0!important">제이 — {s}</p></div>
</div>
{sp(130)}''')

def mask(f,name,doc,fz=2.15,fy=-0.02):
    return f'<div class="mk">{face(f,200,250,fz,fy)}<div class="n">{name}</div><div class="s">{IB(doc,"가면")}</div></div>'
FT=[('Baek Seok-ju','백석주'),('Jin Na-sol','진나솔'),('Lee Seong-hae','이성해'),('Lee Ja-heon','이자헌'),('Eun Ha-je','은하제'),('Park Min-seong','박민성'),('Baek Sa-heon','백사헌'),('Go Young-eun','고영은'),('Kang I-hak','강이학'),('Jang Heo-un','장허운')]
t1,s1=L('박민성','이 부서는',['이 부서는 다들 1년쯤 되면','주임 달아. 너도 곧 달 거야.','그 전에 죽을 수도 있지만.'])
t2,s2=Q('이자헌','예.')
t3,s3=Q('백사헌','어차피 죽을 사람들인데요.')
t4,s4=Q('장허운','소원으로')
plate('baek-team',f'''
{sp(50)}
<p class="dept">백일몽 개발부 현장탐사팀 — 이름과 가면</p>
<div class="masks">{''.join(mask(f,n,n) for f,n in FT[:8])}</div>
{sp(40)}
<div class="masks">{''.join(mask(f,n,n) for f,n in FT[8:])}<div class="mkq"><p class="big" style="font-size:120px;line-height:1;margin:0!important">{t2}</p><p class="cap" style="margin:14px 0 0!important">이자헌 — {s2}</p></div></div>
{sp(110)}<!--cut-->{sp(60)}
<p class="big" style="font-size:60px;line-height:1.3">{t1}</p>{cap(s1)}
{sp(90)}
<p class="sub" style="text-align:right">{t3}</p><p class="cap" style="text-align:right">백사헌 — {s3}</p>
{sp(60)}
<p class="sub">{t4}</p><p class="cap">장허운 — {s4}</p>
{sp(130)}
<p class="dept">백일몽 주식회사 임원 · 행정지원 · 원료개발부 연구1팀</p>
{row('Cheong Dal-lae','청달래','청달래','왔는가.',rolekeys=('직급',),src=True)}
{row('Ho Yu-won','호유원','호유원','참 신기한 우연',rolekeys=('직급',),src=True)}
{row('Lee Byeong-jin','이병진','이병진','못 합니다.',rolekeys=('부서','직급'),src=True)}
{row('Kwak Je-gang','곽제강','곽제강','출구가 희생이',rolekeys=('직급',),src=True)}
{row('Lee Yeon-hwa','이연화','이연화','그거 대가가',rolekeys=('직급',),src=True)}
{sp(110)}''')

# ───────── 6 민간인 · 프리랜서
t,s=L('세계정치 게시판','괴.담',['괴.담 겪.은 사.람 있.으.면 연.락 좀.','검.색.어 걸.리.면 안. 됨.'])
t2,s2=L('프리랜서','간단한 조사',['의뢰서에 "간단한 조사"라고','적혀 있으면, 간단하게','죽을 수 있다는 뜻이다.'])
plate('civil',f'''
{sp(80)}
{crop('s-boards/pc-08-wpf.png',860,628,427,1776,575,2560)}
{sp(50)}
<p class="big" style="font-size:43px;line-height:1.45">{t}</p>{cap(s)}
{sp(100)}
<img src="{F('Civilian')}" style="display:block;width:480px;height:600px;margin-left:380px;object-fit:cover;object-position:40% 50%">
{sp(60)}
{head('민간인','D00',GR('D00-ko-1','잠깐 졸았더니 그만 갇혀버렸지 뭐니.'),'첫 장면에서, 셔터 안쪽의 여자')}
{sp(60)}
{credits('세계정치 게시판',['대외 평판','감시자','고정닉 생존율'])}
{sp(120)}<!--cut-->
<img class="still" src="{F('Freelancer')}" style="height:520px;object-position:50% 42%">
{sp(60)}
<p class="big" style="font-size:52px;line-height:1.34">{t2}</p>{cap(s2)}
{sp(100)}
{head('프리랜서','E00',GR('E00-ko-1','의뢰 보수는 굵은 글씨였다.','협회 수수료와 지급 조건은','그 아래 작은 글씨였다.'),'첫 장면에서, 협회 벽면 모니터')}
{sp(60)}
{credits('프리랜서',['신분','면허 없이 활동','주 수입원','주 지출'])}
{sp(130)}''')

# ───────── 7 이면의 주민들
t,s=L('탐미주의','멀리 못 갔네',['멀리 못 갔네, 응?'])
plate('residents',f'''
<img class="still" src="{F('Residents of the Hidden World')}" style="height:600px;object-position:50% 30%">
{sp(60)}
<h2 class="hd">이면의 주민들</h2>
<p class="blurb">13명, 그 인물로 시작하는 첫 장면 13개</p>
{sp(120)}
<div class="bust"><i style="background-image:url({AG('Aestheticism')})"></i>
<div class="who"><div class="ti2">{SL('P054')}</div><div class="name" style="margin-top:14px">탐미주의</div><div class="role">소속<br><span class="w">{IB('탐미주의','소속')}</span></div><div class="role" style="margin-top:18px">공식 대응 지침<br><span class="w">{IB("탐미주의","공식 대응 지침")}</span></div></div></div>
{sp(30)}
<p class="big" style="font-size:80px;line-height:1.1">{t}</p>{cap(s,'탐미주의')}
{sp(50)}
<p class="sub">{SC('P054','제3관. 벽이 숨을 쉬었다.')}</p>{cap('첫 장면에서')}
{sp(130)}''')

t,s=L('브라우니','제가 맞혀 볼게요',['제가 맞혀 볼게요.','…정답!'])
plate('brownie',f'''
<div class="frame" style="height:1060px"><img class="px" src="{A('Tuesday Quiz Show')}" style="width:860px;height:760px;object-position:50% 30%">
<div class="shade" style="top:520px;height:240px;background:linear-gradient(180deg,rgba(11,11,12,0),#0b0b0c)"></div>
<img class="onstage" src="{AG('Brownie')}">
</div>
<div style="margin-top:-70px;position:relative">
<div class="ti2 m">{SL('P055')}</div>
<div class="m" style="display:flex;align-items:baseline;gap:24px;margin-top:10px"><div class="name">브라우니</div><div class="role" style="margin:0">소속 <span class="w">{IB('브라우니','소속')}</span></div></div>
{sp(50)}
<p class="big" style="font-size:84px;line-height:1.18">{t}</p>{cap(s,'브라우니')}
{sp(50)}
<p class="sub">{SC('P055','방송인은 의상이 생명이다.')}</p>{cap('첫 장면에서')}
</div>
{sp(130)}''')

def card(f,bg,name,doc,key,pid,segs,h=640,x=-20,pos='50% 50%'):
    return f'''<div class="card"><div class="pic"><img class="bg" src="{bg}" style="object-position:{pos}"><img class="p" src="{AG(f)}" style="height:{h}px;left:{x}px"></div>
<div class="ti2">{SL(pid)}</div><div class="n">{name}</div><div class="s">{IB(doc,key)}</div><div class="q">{SC(pid,*segs)}</div></div>'''
plate('four',f'''
{sp(40)}
<div class="cards">
{card('Blaret',F('Vatican'),'블라렛','블라렛','소속','P050',['막차가 떠난 환승역은 금방 식는다.'])}
{card('Saladin',F('Islam'),'살라딘','살라딘','소속','P051',['숨길 생각이 없는 걸음이었다.','숨길 필요도 없었다.'])}
</div>
{sp(90)}<!--cut-->{sp(20)}
<div class="cards">
{card('Avensha',F('Walpurgis Society'),'아벤샤','아벤샤','소속','P052',['아벤샤는 그 골목을 산책하듯 걸었다.','실제로 산책이기도 했다.'])}
{card('Secriem',F('Vampires'),'세크리엠','세크리엠','분류','P053',['세크리엠은 그 통로를 하이힐 소리를 내며 걸었다.','일부러 내는 소리였다.'])}
</div>
{sp(120)}''')

def rrow(f,name,doc,keys,pid,part,cut=None,**kw):
    return row(f,name,doc,part,cut,rolekeys=keys,src=True,title=SL(pid),**kw)
plate('grey',f'''
<img class="still" src="{F('Special Disaster Response Association')}" style="height:360px;object-position:50% 55%">
{sp(50)}
<p class="dept">특수재난대응협회 의뢰조정실</p>
{rrow('Cha Yeo-jin','차여진','차여진',('직책',),'P043','위험 등급?')}
{rrow('Seo Yun-ji','서윤지','서윤지',('직책',),'P044','재량은')}
{sp(30)}
<p class="sub">{SC('P044','서윤지는 인사를 받지 않았다.','받지 않는 게 아니라 순서에 없었다.')}</p>{cap('첫 장면 「'+SL('P044')+'」에서')}
{sp(120)}<!--cut-->
<img class="still" src="{F('Jungnim Underground Shopping Center')}" style="height:360px;object-position:50% 50%">
{sp(50)}
<p class="dept">중림 지하상가</p>
{rrow('Go Yeon-ji','고연지','고연지',('직장','직업'),'P045','병원에는 심사위원회')}
{rrow('Yun Ji-a','윤지아','윤지아',('직장',),'P046','필요하면 제 손','필요하면 제 손 꽉 잡으세요, 그러라고 있는 손이에요.')}
{rrow('Ma Deok-hee','마덕희','마덕희',('가게','직업'),'P047','80. 얘기')}
{rrow('Mun Hye-ran','문혜란','문혜란',('가게','직업'),'P048','9조에')}
{rrow('Shin Yuri','신유리','신유리',('사무실','직업'),'P049','울려면 밖에서')}
{sp(30)}
<p class="sub">{SC('P047','어두운 쪽이 장사가 잘된다.')}</p>{cap('첫 장면 「'+SL('P047')+'」에서')}
{sp(130)}''')

# ───────── 8 괴이
t,s=L('한밤역','이 글과 함께',['학생들을 구해 달라.','우리를 찾지는 마라.','우리는 실패했다.'])
t2,s2=L('룩키마트','이거 보는 사람',['아직 늦는', '중이라고.'])
t20,_=Q('룩키마트','이거 보는 사람','이거 보는 사람 있으면 우리 엄마한테 나 우유 사러 나왔다가 늦는 거라고 전해 줘.')
plate('anom-a',f'''
<div class="frame" style="height:1200px"><img class="px" src="{A('Deep Night Station')}" style="width:860px;height:1200px;object-position:42% 50%">
<div class="in" style="padding-top:460px"><p class="big" style="font-size:78px;line-height:1.24">{t}</p>
<p class="cap">한밤역 — <span class="nw">세광공고 뒷마당에서 발견되었다는</span> <span class="nw">관리국 요원의 유서 (요지)</span></p></div></div>
{sp(60)}
<h2 class="hd">괴이</h2>
<p class="blurb">괴이 63곳 · 특수 장소 11곳</p>
{sp(120)}<!--cut-->
{sp(60)}
<div style="position:relative;height:660px"><img class="px" src="{A('Lookymart')}" style="position:absolute;right:0;top:0;width:620px;height:660px">
<p class="lab2" style="position:absolute;left:60px;bottom:-10px;white-space:nowrap">룩키마트</p></div>
{sp(50)}
<p class="sub">{t20}</p>
<p class="big" style="font-size:150px;line-height:1.08;letter-spacing:-.04em;margin-top:20px!important">{t2}</p>
{cap(s2)}
{sp(70)}
{credits('룩키마트',['간판','층수','실종자'])}
{sp(130)}''')

t,s=L('심연교통공사','이번 역은',['이번 역은, 슬픔, 슬픔역입니다.','내리실 문은 오른쪽입니다.'])
t2,s2=L('차원 승강기','띵.',['띵.'])
t3,_=L('차원 승강기','띵.',['1층입니다.','문이 열립니다.'])
plate('anom-b',f'''
<img class="still px" src="{A('Abyss Transit Authority')}" style="height:360px;object-position:50% 58%">
{sp(50)}
<p class="big" style="font-size:56px;line-height:1.34">{t}</p>{cap(s)}
{sp(60)}
<p class="lab2 m">심연교통공사</p>
{credits('심연교통공사',['탑승 방법','노선도','정차역'])}
{sp(130)}<!--cut-->
<div style="position:relative;height:900px"><img class="px" src="{A('Dimensional Elevator')}" style="position:absolute;left:60px;top:40px;width:430px;height:860px">
<div style="position:absolute;left:530px;bottom:0;right:0"><p class="big" style="font-size:230px;line-height:1;margin:0!important">{t2}</p><p class="sub" style="margin:10px 0 0!important">{t3}</p></div></div>
{sp(30)}
{cap(s2)}
{sp(60)}
<p class="lab2 m">차원 승강기</p>
{credits('차원 승강기',['입구','층수','최저 기록'])}
{sp(130)}
<div style="position:relative;height:440px"><img class="px" src="{A('Forbidden Video')}" style="position:absolute;right:60px;top:0;width:440px;height:440px">
<p class="lab2" style="position:absolute;left:60px;bottom:0;width:240px">금지된 비디오</p></div>
{sp(50)}
{credits('금지된 비디오',['장르','러닝타임','관람 등급','출연진'])}
{sp(130)}''')

plate('sheet',f'''
<div class="sheet">
{tile('Monkey Dream','원숭이 꿈 괴담',282,282)}{tile('Gangbuk Special Hospital','강북 특설병원',283,282)}{tile('Frost Waterpark','프러스트 워터파크',283,282)}
{tile('Samangdan','사망단길',860,360,'50% 60%')}
<div class="col" style="width:340px">{tile("Red Lady's Musical Theater",'뮤지컬 붉은 숙녀',340,526)}</div><div class="col" style="width:514px">{tile('Dusk Station','황혼역',514,260,'50% 45%')}{tile('Morning Station','아침역',514,260,'50% 30%')}</div>
{tile('Hungry Hangman','헝그리 행맨',282,282)}{tile('Dark Garden','어두운 정원',283,282)}{tile('Yu-gye Station','유계역',283,282)}
</div><!--cut-->
<div class="sheet" style="padding-top:6px">
{tile('Segwang Special City','세광특별시',860,330,'50% 62%')}
{tile('Hanseol Human Meat Factory','한설인육공장',427,427)}<div class="col" style="width:427px">{tile('Jogyesa','조계사',427,210,'50% 60%')}{tile('Living Orphanage','살아있는 보육원',427,211,'50% 40%')}</div>
{tile('Myeongil Apartment','명일 아파트',282,282)}{tile('Sotos Department Store','소토스 백화점',283,282)}{tile('Twinkle Dragon Palace','반짝반짝 용궁',283,282)}
{tile('Midnight Station','자정역',514,300,'50% 60%')}{tile('Midday Station','한낮역',340,300)}
{tile('Fairytale Park','페어리테일 파크',282,282)}{tile('Cheongak Mary Hospital','청악메리병원',283,282)}{tile('Jisan Village Festival','지산마을 명절 축제',283,282)}
</div>''')

def ibi(doc,key):
    v=IB(doc,key).replace('<s>','<span style="text-decoration:line-through;color:#9d998f;background-color:rgba(0,0,0,0.004);">').replace('</s>','</span>').replace('<b>','<span style="font-weight:700;color:#ffffff;background-color:rgba(0,0,0,0.004);">').replace('</b>','</span>')
    return f'<div style="display:inline-block;vertical-align:top;width:46%;min-width:290px;margin:0 3% 22px 0;"><div style="font-size:16px;line-height:1.5;color:#9d998f;background-color:rgba(0,0,0,0.004);">{doc} · {key}</div><div style="font-size:19px;line-height:1.6;color:#ebe8e1;background-color:rgba(0,0,0,0.004);">{v}</div></div>'
arca(ibi('사망단길','결제 수단')+ibi('명일 아파트','엘리베이터')+ibi('소토스 백화점','계산대')+ibi('샛별 고시원','방 크기')+ibi('무엇이든 자판기','환불')+ibi('한낮역','현재 시각')+ibi('자정역','단골')+ibi('뮤지컬 붉은 숙녀','예매')+ibi('욕망의 방','성인 시설 여부')+ibi('미스테리 월드 어드벤쳐 파크','입장 방법')+ibi('영원마을','화폐')+ibi('코즈믹 판타지 동물원','전시 동물'),'50px 7% 40px')

# ───────── 9 화면
t,s=_q('오후역','배송 얼마나')
chat=[x.strip() for x in t.split('/')]
for c in chat: assert c in t
used.append((' / '.join(chat),'위키 오후역',s))
plate('screens',f'''
{sp(110)}
<h2 class="hd">화면</h2>
<p class="blurb">인터넷 — 망상홈쇼핑</p>
{sp(50)}
{crop('s-hs/phone_2_진행자.png',860,0,306,762,1010,780)}
{sp(50)}
<div class="chat">{''.join(f'<p{" class=hot" if "나가는 길" in c else ""}>{fmt(c)}</p>' for c in chat)}</div>
{cap('오후역 — '+fmt(s))}
{sp(130)}<!--cut-->
{sp(40)}
<div class="wide">{crop('promo/phone-play-04-phone.png',560,0,0,780,1420,780,rad=30)}<div><p class="lab3">괴담톡</p><p class="fact">연락처 · 대화 · 공지, 전화, 단톡</p></div></div>
{sp(130)}<!--cut-->
{sp(40)}
<div class="two"><div><p class="lab2">괴이위키</p>{crop('s-wiki/phone-05-doc.png',360,0,0,780,1560,780,rad=20)}<p class="fact">문서 143개</p></div>
<div style="padding-top:150px"><p class="lab2">임무</p>{crop('promo/phone-play-03-map.png',360,0,0,780,1420,780,rad=20)}<p class="fact">지도에서 장소를 골라 요원 넷을 편성해 출동, 커스텀 임무</p></div></div>
{sp(130)}<!--cut-->
{sp(40)}
<div class="wide r">{crop('promo/phone-play-02-board.png',560,0,0,780,1500,780,rad=30)}<div><p class="lab3">상황판</p><p class="fact">요원 화면, 지금 벌어진 괴이 · 사건 · 특수 상황</p></div></div>
{sp(130)}<!--cut-->
{sp(40)}
<p class="lab2 m">인터넷 — 우주 쇼핑몰 · 괴담 갤러리 · 괴담넷</p>
{sp(10)}
{crop('s-malls/pc-01-cos.png',860,628,438,1776,424,2560)}
{sp(8)}
{crop('s-boards/pc-04-gal.png',860,628,435,1776,620,2560)}
{sp(8)}
{crop('s-boards/pc-01-gn.png',860,628,418,1776,560,2560)}
{sp(110)}
<div class="two"><div><p class="lab2">기록</p>{crop('s-chron/phone_연대기.png',360,0,0,780,1560,780,rad=20)}</div>
<div style="padding-top:60px"><div class="cr2"><div class="k">기록</div><div class="v">일지 · 연대기 · 인물 · 세력</div>
<div class="k">소지품</div><div class="v">무기 2칸 · 장비 4칸 장착, 가계부</div>
<div class="k">인터넷</div><div class="v">괴담넷, 괴담 갤러리, 세정게, 연어 마켓, 우주 쇼핑몰, 괴이위키, 백일몽 포인트몰, 망상홈쇼핑</div>
<div class="k">괴담톡</div><div class="v">연락처 · 대화 · 공지, 전화, 단톡</div></div></div></div>
{sp(130)}''')

# ───────── 10 끝
t,s=L('인스피레이션 호텔','목적지에 도착했습니다',['목적지에 도착했습니다.','안내를 종료합니다.','즐거운 숙박 되십시오.'])
plate('end',f'''
<div class="frame" style="height:1220px"><img class="px" src="{A('Hotel Inspiration')}" style="width:860px;height:1220px;object-position:55% 50%">
<div class="in" style="padding-top:420px"><p class="big" style="font-size:84px;line-height:1.24">{t}</p>{cap(s)}</div></div>
{sp(40)}''')

P.append(f'''<div class="arca"><div style="background-color:#0b0b0c;padding:26px 7% 90px;{AF}"><a href="https://github.com/leepc25/goei-plugin/releases/latest" target="_blank" rel="noopener noreferrer" style="text-decoration:none;"><span style="display:inline-block;padding:22px 72px;background-color:#ebe8e1;border-radius:2px;"><span style="color:#0b0b0c;font-size:22px;font-weight:700;">받기</span></span></a><div style="font-size:15px;line-height:1.6;color:#9d998f;background-color:rgba(0,0,0,0.004);margin:20px 0 0;">괴이 ː ANOMALY<br>github.com/leepc25/goei-plugin/<br>releases/latest</div></div></div>''')

CSS='''
body{margin:0;width:860px;background:#0b0b0c}
.plate{width:860px;background:#0b0b0c;color:#ebe8e1;font-family:'Noto Sans KR',sans-serif;position:relative;overflow:hidden;word-break:keep-all;line-height:1.45}
.plate p,.plate h1,.plate h2{margin:0}
.plate.lt{background:#d6d6d2;color:#0d0d0e}
.nw{white-space:nowrap}
.still{display:block;width:860px;object-fit:cover}
.px{image-rendering:pixelated;object-fit:cover;display:block}
.frame{position:relative;line-height:0;overflow:hidden}
.frame .in{position:absolute;left:0;right:0;bottom:0;padding:260px 0 50px;line-height:1.45;background:linear-gradient(180deg,rgba(11,11,12,0),rgba(11,11,12,.84) 52%,#0b0b0c)}
.shade{position:absolute;left:0;right:0}
.title{position:absolute;right:96px;top:84px;font-family:'Noto Serif KR',serif;font-weight:900;font-size:270px;line-height:1;letter-spacing:-.04em;color:#f4f1ea}
.title2 span{font-family:'Noto Sans KR',sans-serif;font-weight:700;font-size:70px;margin-right:.18em;letter-spacing:0}
.title2{position:absolute;right:92px;top:372px;font-family:'Noto Serif KR',serif;font-weight:600;font-size:58px;line-height:1;letter-spacing:.12em;color:#f4f1ea}
.kind{position:absolute;right:104px;top:40px;font-size:30px;line-height:1.3;color:#b9b5ab}
.sub{font-size:40px;font-weight:500;line-height:1.48;letter-spacing:-.015em;margin:0 60px!important;color:#f4f1ea}
.big{font-family:'Noto Serif KR',serif;font-weight:700;letter-spacing:-.025em;margin:0 60px!important;color:#f7f4ed}
.cap{font-size:31px;font-weight:400;line-height:1.42;color:#9d998f;margin:16px 60px 0!important;letter-spacing:-.015em}
.lt .sub,.lt .big{color:#0d0d0e}.lt .cap{color:#5c5a55}
.hd{font-family:'Noto Serif KR',serif;font-weight:700;font-size:96px;line-height:1.15;letter-spacing:-.03em;margin:0 60px!important}
.blurb{font-size:38px;line-height:1.5;margin:22px 60px 0!important;letter-spacing:-.015em}
.first{font-size:32px;line-height:1.6;color:#9d998f;margin:26px 60px 0!important;letter-spacing:-.015em}
.first .lab{color:#ebe8e1;margin-right:18px}
.lt .first{color:#5c5a55}.lt .first .lab{color:#0d0d0e}
.lab2{font-size:32px;color:#9d998f;line-height:1.4;margin:0 0 16px!important}
.lt .lab2{color:#5c5a55}
.dept{font-size:32px;color:#9d998f;margin:0 60px 30px!important;padding-top:20px;line-height:1.4}
.lt .dept{color:#5c5a55}
.cr{display:grid;grid-template-columns:200px 1fr;column-gap:30px;row-gap:14px;margin:0 60px;line-height:1.42}
.cr .k{text-align:right;color:#9d998f;font-size:31px;padding-top:5px}
.cr .v{font-size:36px;letter-spacing:-.015em}
.lt .cr .k{color:#5c5a55}
.cr2 .k{color:#9d998f;font-size:31px;margin-top:26px}.cr2 .v{font-size:33px;line-height:1.45;letter-spacing:-.02em}
s{color:#9d998f;text-decoration-thickness:2px}
.lt s{color:#6c6a64}
b{font-weight:700;color:#fff}
.lt b{color:#000}
.stage{position:relative}
.fig{position:absolute;object-fit:contain;-webkit-mask-image:linear-gradient(#000 62%,transparent 96%);mask-image:linear-gradient(#000 62%,transparent 96%)}
.glow{position:absolute;background:radial-gradient(closest-side,#26262a 0,#17171a 45%,rgba(11,11,12,0) 100%)}
.who{position:absolute}
.name{font-family:'Noto Serif KR',serif;font-weight:700;font-size:68px;line-height:1.2}
.role{font-size:31px;line-height:1.5;color:#9d998f;margin-top:14px}
.role .w{color:#ebe8e1;font-size:35px}
.lt .role{color:#5c5a55}.lt .role .w{color:#0d0d0e}
.over{position:absolute;text-shadow:0 0 30px #0b0b0c,0 0 12px #0b0b0c}
.lt .over{text-shadow:0 0 26px #d6d6d2,0 0 10px #d6d6d2}
.fc{display:block;flex:none;background-repeat:no-repeat;background-color:#131315}
.lt .fc{background-color:#c4c4c0}
.pair{display:flex;gap:40px;margin:0 60px;align-items:flex-end}
.pair.r{flex-direction:row-reverse;text-align:right}
.filmstrip{display:flex;flex-wrap:wrap;line-height:0}
.row{display:grid;grid-template-columns:132px 1fr;column-gap:30px;margin:0 60px 46px;align-items:start}
.row .ti{font-family:'Noto Serif KR',serif;font-weight:700;font-size:44px;line-height:1.25;margin:-6px 0 6px;letter-spacing:-.02em}
.row .n{font-size:36px;font-weight:700;line-height:1.3}
.row .r{font-size:31px;font-weight:400;color:#9d998f;margin-left:16px}
.row .q{font-size:36px;line-height:1.42;margin-top:8px;letter-spacing:-.015em}
.row .s{font-size:31px;line-height:1.4;color:#9d998f;margin-top:4px;letter-spacing:-.015em}
.lt .row .r,.lt .row .s{color:#5c5a55}
.duo{display:flex;gap:24px;margin:0 60px}
.duo>div{width:358px}
.duo .n{font-size:36px;font-weight:700;margin-top:16px;line-height:1.3}
.duo .r{display:block;font-size:31px;font-weight:400;color:#9d998f}
.duo .q{font-family:'Noto Serif KR',serif;font-weight:700;font-size:46px;line-height:1.28;margin-top:18px;letter-spacing:-.025em}
.duo .s{font-size:31px;line-height:1.4;color:#9d998f;margin-top:10px}
.crowd{position:relative;overflow:hidden}
.crowd img{position:absolute;width:auto}
.rule{height:3px;background:#0d0d0e}
.masks{display:flex;flex-wrap:wrap;gap:36px 13px;margin:0 60px}
.mk{width:175px}
.mk .fc{width:175px!important}
.mk .n{font-size:36px;font-weight:700;margin-top:10px;line-height:1.3}
.mk .s{font-size:30px;color:#9d998f;line-height:1.3;letter-spacing:-.05em;white-space:nowrap}
.mkq{flex:1;padding-left:40px;align-self:center}
.bust{position:relative;height:520px}
.bust i{position:absolute;right:0;top:0;width:560px;height:520px;background-size:1240px auto;background-position:52% -118px;background-repeat:no-repeat;-webkit-mask-image:linear-gradient(#000 72%,transparent 99%),linear-gradient(90deg,transparent 0,#000 18%);-webkit-mask-composite:source-in;mask-image:linear-gradient(#000 72%,transparent 99%),linear-gradient(90deg,transparent 0,#000 18%);mask-composite:intersect}
.bust .who{left:60px;top:20px;width:330px}
.ti2{font-size:32px;color:#9d998f;line-height:1.35}
.ti2::before{content:"첫 장면 「"}.ti2::after{content:"」"}
.onstage{position:absolute;left:120px;top:250px;width:620px;height:906px;object-fit:contain;filter:sepia(.35) saturate(1.3) brightness(.92) drop-shadow(0 0 40px rgba(0,0,0,.8));-webkit-mask-image:linear-gradient(#000 60%,transparent 88%);mask-image:linear-gradient(#000 60%,transparent 88%)}
.cards{display:flex;gap:20px;margin:0 60px}
.card{width:360px}
.card .pic{position:relative;width:360px;height:540px;overflow:hidden;background:#000}
.card .bg{position:absolute;inset:0;width:360px;height:540px;object-fit:cover;filter:brightness(.62)}
.card .p{position:absolute;top:36px;width:auto}
.card .ti2{margin-top:18px;min-height:88px}
.card .n{font-family:'Noto Serif KR',serif;font-weight:700;font-size:56px;line-height:1.2;margin-top:4px}
.card .s{font-size:31px;color:#9d998f;line-height:1.35}
.card .q{font-size:35px;line-height:1.45;margin-top:18px;letter-spacing:-.02em}
.sheet{display:flex;flex-wrap:wrap;gap:6px;line-height:0}
.sheet .col{display:flex;flex-direction:column;gap:6px}
.tile{position:relative;overflow:hidden}
.tile span{position:absolute;left:0;right:0;bottom:0;padding:50px 12px 9px;font-size:30px;line-height:1.2;letter-spacing:-.04em;color:#f4f1ea;white-space:nowrap;background:linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.78));text-shadow:0 1px 3px #000}
.dev{display:block;background-repeat:no-repeat;box-shadow:0 0 0 2px rgba(255,255,255,.10)}
.five{font-family:'Noto Serif KR',serif;font-weight:700;font-size:52px;line-height:1.62;letter-spacing:-.03em;white-space:nowrap}
.five .alt{color:#9d998f;margin-top:26px}
.chat{margin:0 60px}
.chat p{font-size:40px;line-height:1.55;color:#8d897f;letter-spacing:-.015em}
.chat p.hot{color:#f7f4ed;font-family:'Noto Serif KR',serif;font-weight:700;font-size:76px;line-height:1.3;margin:6px 0!important}
.two{display:flex;gap:20px;margin:0 60px;align-items:flex-start}
.two>div{width:360px}
.wide{display:flex;gap:30px;margin:0 60px 0 0;align-items:flex-end}
.wide.r{flex-direction:row-reverse;margin:0 0 0 60px}
.wide>div{flex:1;padding-bottom:30px}
.wide:not(.r)>div{padding-right:0}
.lab3{font-family:'Noto Serif KR',serif;font-weight:700;font-size:60px;line-height:1.2}
.fact{font-size:31px;line-height:1.42;color:#9d998f;margin-top:16px!important;letter-spacing:-.02em}
.m{margin-left:60px!important;margin-right:60px!important}
'''
open(R+'/.scratch/arca/b/page.html','w').write('<!doctype html><html lang="ko"><head><meta charset="utf-8">\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&family=Noto+Serif+KR:wght@600;700;900&display=swap">\n<style>'+CSS+'</style></head>\n<body>\n'+'\n'.join(P)+'\n</body></html>')
json.dump(used,open(R+'/.scratch/arca/b/used_quotes.json','w'),ensure_ascii=False,indent=1)
# 금지어 점검
txt=re.sub(r'<[^>]+>',' ','\n'.join(P))
for bad in ['당신','지금 바로','설까요','나이']:
    if bad in txt: print('!! 금지어',bad)
print(len(P),'blocks',len(used),'quotes')
