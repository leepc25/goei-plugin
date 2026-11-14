# -*- coding: utf-8 -*-
"""봇 소개 페이지(4차). python3 gen.py → img/*.jpg, page.html (전부 인라인 HTML, 그림 조각 없음)"""
import os, json, html
from PIL import Image
R='/home/user/goei-plugin/'; K=R+'.scratch/arca/kit/screens/'; O='img/'
os.makedirs(O,exist_ok=True)
AG=json.load(open(R+'src/data/world/agents.json'))['records']
AN=json.load(open(R+'src/data/world/anomalies.json'))['records']
PD=os.listdir(R+'assets/portraits'); AF=[f[:-5] for f in os.listdir(R+'assets/wiki/Anomalies')]
def save(im,name,q=86):
    im.convert('RGB').save(O+name,quality=q); return O+name
# ── 그림 ──
def cover():
    im=Image.open(R+'assets/wiki/Anomalies/Yu-gye Station.avif').convert('RGB').resize((1800,1800),Image.NEAREST)
    return save(im.crop((40,560,1760,1420)),'cover.jpg',88)
def face(ko):
    en=AG[ko]['keys'].split(',')[0].strip()
    d=next((p for p in PD if p==en or p.endswith(' '+en)),None)
    if not d: return None
    f=R+f'assets/portraits/{d}/{d}_expressionless.avif'
    if not os.path.exists(f): f=R+f'assets/portraits/{d}/'+sorted(os.listdir(R+'assets/portraits/'+d))[0]
    im=Image.open(f).convert('RGBA'); bg=Image.new('RGBA',im.size,(226,221,210,255)); bg.alpha_composite(im)
    w,h=bg.size; s=int(w*0.62); x=(w-s)//2; y=int(h*0.04)
    return save(bg.crop((x,y,x+s,y+s)).resize((192,192),Image.LANCZOS),'f_'+en.replace(' ','_')+'.jpg',84)
ANMAP={'인류의 신비전':"exhibition of humanity's mysteries",'명일 아파트':'Myeongil Apartment','교회':'The Church','강변':'The Riverside','예술가의 지하실':'The Basement','미술관':'Art Museum','인스피레이션 호텔':'Hotel Inspiration','한여름 밤의 꿈':"Midsummer Night's Dream",'욕망의 방':'Desire Room','광기로 점철된 성당':'Corrupted cathedral','원숭이 꿈 괴담':'Monkey Dream','성자의 도시':"Saint's City",'사망단길':'Samangdan','플라워 골든 리조트':'Flower Golden Resort','눈먼 자들의 저택':'Mansion of the Blind','검은 그늘 속에서':'In the Black Shadow','반짝반짝 용궁':'Twinkle Dragon Palace','성 안티쿠스 기숙학교':'Saint Anticus Boarding School','지산마을 명절 축제':'Jisan Village Festival','해피엔딩 홀':'Happy Ending Hall','유쾌연구소':'Yukwae Research Institute','샛별 고시원':'Saetbyeol Goshiwon','어두운 정원':'Dark Garden','거대한 세상':'Giant World','영원마을':'Yeongwon Village','프러스트 워터파크':'Frost Waterpark','피어블 극장':'Fearble Theater'}
def anom(ko,size):
    en=ANMAP.get(ko) or AN[ko]['keys'].split(',')[0].strip()
    f=R+f'assets/wiki/Anomalies/{en}.avif'
    if not os.path.exists(f):
        if ko=='기괴한 방탈출 카페': f=next(R+'assets/wiki/Anomalies/'+x for x in os.listdir(R+'assets/wiki/Anomalies') if x.startswith('Strange'))
        else: return None
    im=Image.open(f).convert('RGB')
    if size!=600: im=im.resize((size,size),Image.LANCZOS)
    return save(im,f'a{size}_'+''.join(c for c in en if c.isalnum())+'.jpg',82)
def fac(en):
    return save(Image.open(R+f'assets/wiki/Factions/{en}.avif'),'fac_'+en.replace(' ','_')+'.jpg',84)
def screen(path,name,box=(150,108,2408,1600)):
    im=Image.open(K+path+'.png').convert('RGB').crop(box); w=1400
    return save(im.resize((w,int(im.height*w/im.width)),Image.LANCZOS),name,84)

# ── 조판 ──
INK='#26231f'; SUB='#6b6459'; LINE='#d4cdbf'; PAPER='#f5f2ea'; ACC='#27685b'
SERIF="'Noto Serif KR','Nanum Myeongjo','AppleMyungjo','Batang',serif"
SANS="'Pretendard','Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif"
def p(t,mt=0): return f'<div style="font-size:16px;line-height:1.95;color:{INK};margin:{mt}px 0 0 0;word-break:keep-all;">{t}</div>'
def h(t): return f'<div style="margin:64px 0 18px 0;padding-top:18px;border-top:2px solid {INK};font-family:{SERIF};font-size:25px;font-weight:700;color:{INK};">{t}</div>'
def img(src,alt='',st=''): return f'<img src="{src}" alt="{html.escape(alt)}" style="display:block;width:100%;height:auto;margin:0;{st}">'
def people(rows):
    o='<div style="margin:18px 0 0 0;text-align:left;font-size:0;">'
    for ko,cap in rows:
        f=face(ko)
        pic=f'<img src="{f}" alt="{ko}" style="display:block;width:84px;height:84px;margin:0 auto;border-radius:50%;">' if f else f'<div style="width:84px;height:84px;margin:0 auto;border-radius:50%;background:#e2ddd2;font-size:0;">&nbsp;</div>'
        o+=f'<div style="display:inline-block;vertical-align:top;width:116px;margin:0 0 18px 0;text-align:center;">{pic}<div style="margin-top:7px;font-size:14px;font-weight:700;color:{INK};line-height:1.35;">{ko}</div><div style="font-size:12px;color:{SUB};line-height:1.4;padding:0 4px;word-break:keep-all;">{cap}</div></div>'
    return o+'</div>'
def scenes(names):
    s=''.join(f'<span style="display:inline-block;margin:0 16px 4px 0;color:{INK};">{n}</span>' for n in names)
    return f'<div style="margin:16px 0 0 0;font-size:14px;line-height:1.7;"><span style="display:inline-block;margin:0 14px 4px 0;color:{SUB};">첫 장면</span>{s}</div>'
def fold(title,sub,body,first=False):
    return (f'<details style="border-bottom:1px solid {LINE};{"border-top:1px solid "+LINE+";" if first else ""}">'
            f'<summary style="padding:17px 4px;list-style:none;"><span style="float:right;font-size:13px;color:{ACC};font-weight:700;margin-left:12px;">펼치기</span>'
            f'<span style="font-family:{SERIF};font-size:19px;font-weight:700;color:{INK};">{title}</span>'
            f'<div style="margin-top:4px;font-size:14px;color:{SUB};line-height:1.6;word-break:keep-all;">{sub}</div></summary>'
            f'<div style="padding:6px 4px 30px 4px;">{body}</div></details>')
def facbody(en,text,sc,rows=None):
    o=(f'<div style="font-size:0;"><div style="display:inline-block;vertical-align:top;width:220px;max-width:100%;margin:0 24px 14px 0;">{img(fac(en),"")}</div>'
       f'<div style="display:inline-block;vertical-align:top;width:540px;max-width:100%;">{p(text)}{scenes(sc) if sc else ""}</div></div>')
    return o+(people(rows) if rows else '')
def feat(ko,cls,text):
    return (f'<div style="margin:0 0 30px 0;font-size:0;"><div style="display:inline-block;vertical-align:top;width:260px;max-width:100%;margin:0 28px 12px 0;">{img(anom(ko,600),ko)}</div>'
            f'<div style="display:inline-block;vertical-align:top;width:490px;max-width:100%;"><div style="font-family:{SERIF};font-size:21px;font-weight:700;color:{INK};">{ko}</div>'
            f'<div style="font-size:13px;color:{SUB};margin:3px 0 10px 0;">{cls}</div>{p(text)}</div></div>')
def shot(src,name,text):
    return (f'<div style="margin:34px 0 0 0;"><div style="border:1px solid {LINE};">{img(src,name)}</div>'
            f'<div style="margin:14px 0 0 0;font-family:{SERIF};font-size:19px;font-weight:700;color:{INK};">{name}</div>{p(text,6)}</div>')

B=[]
B.append(img(cover(),'유계역'))
B.append(f'<div style="padding:30px 0 0 0;"><div style="font-family:{SERIF};font-size:34px;font-weight:900;color:{INK};line-height:1.25;">괴이 ː ANOMALY</div>'
         f'<div style="margin-top:8px;font-size:16px;color:{SUB};line-height:1.6;">괴담이 실제로 일어나는 한국에서 신입으로 일하는 RisuAI 봇</div></div>')
B.append('<div style="margin:38px 0 0 0;">'+p('저녁에 우유를 사러 나간 사람이 우유를 사서 돌아온다. 이 세계에서는 그게 다행인 일이다. 간판이 한 번 깜빡인 마트에 들어갔다가 돌아오지 못한 사람이 수십 년 동안 수백 명이고, 퇴근길 지하철에서 졸다가 노선도에 없는 역에 내린 사람도 있다. 이 세계의 괴담에는 주소가 있다.')
         +p('그런 곳으로 출근하는 사람들이 있다. 관리국 요원은 괴이를 가두고, 가둘 수 없는 곳에는 생존 규칙서를 써서 안에 가져다 놓는다. 백일몽 사원은 수집기를 들고 괴담 안으로 들어가 살아 나온 값을 회사에 납품한다. 하는 일은 끔찍한데 직장은 직장이라, 문명의 마지막 방어선이라는 사람들이 탕비실에서 믹스커피냐 아메리카노냐로 싸운다. 이 봇에서는 그 사무실에 신입으로 들어간다.',18)+'</div>')

B.append(h('시작하는 자리'))
B.append(p('첫 장면은 어느 조직의 신입인지에 따라 달라진다. 줄을 누르면 그곳이 어떤 데이고 누가 일하는지 펼쳐진다.'))
F=''
F+=fold('관리국','소수의 초인 요원으로 굴러가는 비밀 조직',facbody('Management Bureau','본부는 종로 한복판의 평범한 사무실 건물이다. 인식의 장막이 감싸고 있어서 지나가는 사람 눈에 보이기는 해도 기억에는 남지 않는다. 입사하면 본명은 금지되고 코드네임만 쓴다. 현장에서 요원 한 명을 만나는 것이 다른 조직 한 개 분대를 만나는 것과 비슷하다는 평이 있는데, 그 요원들이 출근해서 제일 먼저 하는 일은 편의점 커피 사 오기다.',
 ['면접','코드네임','근무 수칙','격리 실습','격리팀','교전','한설인육공장'],
 [('쟈알디','종합대응팀 부장'),('스팡달','종합대응팀 선임 요원'),('잼트리','종합대응팀 선임 요원'),('에일린','종합대응팀 선임 요원'),('고그니쟈','격리팀 연구 책임자'),('큐라스','진압팀 선임 요원'),('고르고디오','진압팀 선임 요원'),('데쥬레','격리팀 연구원'),('데드폴','종합대응팀 요원'),('게슈간','종합대응팀 요원'),('로제몬','종합대응팀 요원'),('콘쥬스','종합대응팀 요원')]),True)
F+=fold('가짜 관리국','자기들이 진짜라고 믿는 또 하나의 관리국',facbody('Fake Management Bureau','괴이를 찍어 올린 다음 날 괴이보다 먼저 집 앞에 와 있다는 검은 정장의 남자들이다. 이쪽도 본부는 종로이고 이쪽도 스스로를 관리국이라고 부른다. 진짜 관리국이 소수의 초인으로 굴러간다면 여기는 사람 수로 밀어붙인다. 신입은 대개 납치로 뽑는다.',
 ['취조실','신입 교육','오리엔테이션','스카우트','검사부대','데이터베이스','상황 발생'],
 [('사장','최고 책임자'),('도필헌','국장'),('이길환','신입 교육 과장'),('이기석','신입 교육 과장'),('김조학','수석 심문관'),('이도형','검사부대 부장'),('고영훈','검사부대 차장'),('노기균','검사부대 대리'),('송주익','검사부대 대리'),('곽성주','진압부대 과장'),('조성춘','진압부대 과장'),('윤병수','신입 7팀 팀장'),('김성진','신입 7팀 사원'),('송진섭','신입 7팀 사원')]))
F+=fold('백일몽 주식회사','괴담에서 살아 나온 경험을 약으로 만들어 파는 제약 회사',facbody('Baekilmong','겉으로는 강남에 본사를 둔 평범한 제약 회사다. 사원은 정장에 동물 가면을 쓰고 수집기를 든 채 괴담 안으로 들어간다. 살아서 나오면 그 경험이 수집기 안에서 액체가 되고, 회사는 그것을 정제해서 판다. 복지몰의 약과 장비는 전부 진짜인데, 그것을 받으려면 다시 괴담에 들어가야 한다.',
 ['신입 OT','D조 첫 출근','화요 퀴즈쇼','유쾌 테마파크','커스텀 장비','착한 친구','세광특별시'],
 [('청달래','개발본부 임원'),('호유원','이사'),('이병진','행정지원'),('백석주','정예 A조 조장'),('진나솔','정예 A조'),('이성해','정예 B조'),('이자헌','D조 조장'),('은하제','D조'),('박민성','D조'),('백사헌','F조'),('고영은','R조'),('강이학','I조'),('장허운','Y조'),('곽제강','연구1팀'),('이연화','연구1팀'),('제이','경비반장')]))
F+=fold('민간인','아무것도 모르는 채로 괴담과 마주치는 사람',facbody('Civilian','소속도 장비도 없다. 퇴근길 지하철에서 깜빡 졸았거나 저녁에 마트를 찾아 두리번거렸을 뿐이다. 겪은 일을 털어놓을 곳은 세계정치 게시판 정도인데, 거기서는 진짜 생존기에도 약 먹으라는 댓글이 달린다.',
 ['지하철의 여자','기독교 상점','세계정치 게시판','무엇이든 자판기','중림 지하상가']))
F+=fold('프리랜서','협회 면허를 사서 의뢰로 먹고사는 해결사',facbody('Freelancer','특수재난대응협회에 돈을 내고 면허를 받아 의뢰를 맡는다. 회사가 장비를 대 주지 않으니 면허와 몸 하나로 들어갔다 나와야 하고, 보수에서는 협회 수수료가 먼저 빠진다. 수수료와 장비값과 병원비를 떼고 나면 남는 것은 살아 돌아왔다는 사실이라고들 한다.',
 ['협회 접수창구','대박알선']))
F+=fold('이면의 주민들','그 세계에 이미 살고 있는 열세 명의 자리',facbody('Residents of the Hidden World','신입이 되는 대신 이미 그 세계에서 살고 있는 인물의 자리에서 시작한다. 협회 창구에 앉은 조정관도 있고 중림 지하상가의 상인도 있다. 사람을 재료로 작품을 만드는 괴이 탐미주의도 그 열세 명 가운데 하나다. 이름 아래 적힌 것이 그 사람의 첫 장면이다.',None,
 [('차여진','특별한 의뢰'),('서윤지','녹음기'),('고연지','선불입니다'),('윤지아','야간 접수'),('마덕희','도금이에요, 자기야'),('문혜란','사인 먼저, 밥은 나중에'),('신유리','십. 퍼센트. 매주.'),('블라렛','이교도와 수녀'),('살라딘','여기서 불타리라'),('아벤샤','마녀의 산책'),('세크리엠','갇힌 여자'),('탐미주의','넌 내 최고의 작품이야'),('브라우니','화요일의 즐거움, 화요일의 열기')]))
B.append('<div style="margin:22px 0 0 0;">'+F+'</div>')

B.append(h('괴이'))
B.append(p('괴이는 대부분 장소다. 마트나 지하철처럼 어제까지 멀쩡히 드나들던 곳이 어느 날 사람을 내보내 주지 않는다. 괴이위키에는 예순세 곳이 올라 있고 그중 세 곳만 꺼내 적는다.'))
B.append('<div style="margin:28px 0 0 0;">'
 +feat('룩키마트','대형마트형 괴담','오래전에 망한 할인마트를, 사람보다 소매업을 더 잘 아는 무언가가 다시 지어 놓았다. 형광등과 할인 포스터와 폐점 방송까지 2000년대 한국 마트 그대로인데 간판 철자가 LOOKY다. 저녁에 마트 어디 없나 하고 두리번거리는 사람 앞에 나타난다.')
 +feat('심연교통공사','지하철형 괴담','퇴근길 지하철에서 졸다가 눈을 뜨면 여전히 지하철이다. 휴대폰이 안 터지고, 안내 방송이 다음 역은 슬픔역이라고 말한다. 지하철로 출퇴근해 본 사람이면 누구나 타게 될 수 있어서 가장 억울한 괴담으로 꼽힌다.')
 +feat('한설인육공장','이계형 괴담','동네 정육점 진열대를 들여다보다가 고기가 사람 손으로 보이기 시작하면 이미 늦었다. 정신을 차리면 낯선 화장실 여덟 번째 칸이고, 문밖은 붉은 하늘 아래 돌아가는 통조림 공장이다. 규칙도 수수께끼도 없어서 생환자들은 제일 정직하게 무서운 곳이라고 부른다.')+'</div>')
G='<div style="font-size:0;">'
skip={'룩키마트','심연교통공사','한설인육공장'}; n=0
for ko in AN:
    if ko in skip: continue
    f=anom(ko,240)
    if not f: continue
    n+=1
    G+=f'<div style="display:inline-block;vertical-align:top;width:132px;margin:0 7px 14px 0;"><img src="{f}" alt="{ko}" style="display:block;width:132px;height:132px;margin:0;"><div style="margin-top:5px;font-size:12px;color:{INK};line-height:1.35;word-break:keep-all;">{ko}</div></div>'
G+='</div>'
B.append(fold('나머지 괴이','그림이 있는 '+str(n)+'곳을 한 번에 본다',G,True))

B.append(h('채팅창 옆의 창'))
B.append(p('봇에는 전용 창이 딸려 있다. 이야기가 진행되는 동안 그 세계의 지도와 전화와 인터넷이 이 창 안에서 따로 돌아간다.'))
B.append(shot(screen('promo/pc-play-03-map','s_map.jpg'),'임무','괴이가 터지면 지도에 뜬다. 장소를 누르고 같이 갈 사람 넷을 태워 출발하면 그 편성으로 다음 장면이 시작된다.'))
B.append(shot(screen('promo/pc-play-04-phone','s_talk.jpg'),'괴담톡','만난 사람은 연락처에 남는다. 문자를 보내면 그 사람 말투로 답이 오고 전화도 걸린다. 단톡방에서는 그 사람들끼리 떠드는 것을 지켜볼 수 있다.'))
B.append(shot(screen('s-boards/pc-01-gn','s_net.jpg',(150,108,2408,1600)),'인터넷','브라우저를 열면 그 세계 사람들이 쓰는 사이트가 나온다. 괴담넷과 세정게에는 글과 댓글이 올라오고, 괴이위키에서는 괴이와 인물 문서를 찾아 읽는다.'))
M=''
for src,name,t in [(screen('s-malls/pc-01-cos','s_cos.jpg'),'우주 쇼핑몰','현금과 카드를 받는 이상 물품 상점이다. 진열장에서 제일 싼 물건이 사회 초년생 월급을 통째로 가져간다. 산 물건은 소지품으로 들어온다.'),
                   (screen('s-malls/pc-08-bm','s_bm.jpg'),'백일몽 포인트몰','백일몽 사원만 들어가는 복지몰이다. 현금은 받지 않고 괴담에서 벌어 온 포인트로만 산다.'),
                   (screen('promo/pc-play-06-items','s_items.jpg'),'소지품','무기 두 칸과 장비 네 칸에 물건을 찬다. 번 돈과 쓴 돈은 가계부에 적힌다.'),
                   (screen('s-chron/pc_연대기','s_chron.jpg',(0,0,2200,1800)),'기록','겪은 사건과 만난 사람이 날짜별로 남는다.')]:
    M+=shot(src,name,t)
B.append('<div style="margin:36px 0 0 0;">'+fold('다른 화면','쇼핑몰 두 곳과 소지품과 기록',M,True)+'</div>')

B.append(h('받기'))
B.append(p('RisuAI에서 쓴다. 봇 카드와 전용 플러그인이 한 묶음으로 올라와 있다.'))
B.append(f'<div style="margin:22px 0 0 0;"><a href="https://github.com/leepc25/goei-plugin/releases/latest" target="_blank" rel="noopener noreferrer" style="text-decoration:none;"><span style="display:inline-block;padding:14px 34px;background:{INK};border-radius:4px;"><span style="color:#f5f2ea;font-size:15px;font-weight:700;">최신 판 받으러 가기</span></span></a></div>')
def li(i,t): return f'<div style="display:table;margin:0 0 10px 0;"><div style="display:table-cell;width:26px;font-family:{SERIF};font-size:16px;font-weight:700;color:{ACC};">{i}</div><div style="display:table-cell;font-size:15px;line-height:1.8;color:{INK};word-break:keep-all;">{t}</div></div>'
S=(li(1,'받는 곳에서 최신 zip을 받아 푼다.')+li(2,'Risu 설정의 플러그인 탭에서 goei-plugin.js를 가져오고, 뜨는 권한 확인 창을 모두 허용한다.')
   +li(3,'괴이_ANOMALY.charx를 캐릭터로 가져온다. 그림이 카드에 들어 있으므로 예전 에셋 모듈은 끈다.')
   +li(4,'카드를 처음 열면 플러그인 본체를 한 번 받는다. 받지 못하면 뜨는 창에 zip 안의 goei-body.js를 넣는다.')
   +li(5,'채팅 화면 구석의 유령 단추를 누르고 출발한다.'))
B.append('<div style="margin:26px 0 0 0;">'+fold('설치 순서','처음 설치하는 다섯 단계',S,True)+'</div>')

page=f'<div style="max-width:860px;margin:0 auto;background:{PAPER};color:{INK};font-family:{SANS};"><div style="padding:0 0 0 0;">{B[0]}</div><div style="padding:0 34px 56px 34px;">{"".join(B[1:])}</div></div>'
open('page.html','w').write('<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@700;900&display=swap"><link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"><body style="margin:0">\n<div class="arca">'+page+'</div>\n</body>')
open('arca.html','w').write(page)
print('ok',len(page),n)
