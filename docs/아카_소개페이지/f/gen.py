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
def cover_old():
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
    return save(bg.crop((x,y,x+s,y+s)).resize((224,224),Image.LANCZOS),'f_'+en.replace(' ','_')+'.jpg',84)
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


def cover():
    im=Image.open(R+'assets/wiki/Anomalies/Yu-gye Station.avif').convert('RGB').resize((1800,1800),Image.NEAREST)
    return save(im.crop((40,560,1760,1420)),'cover.jpg',88)
SC=json.load(open(R+'src/data/scenarios.json'))['factions']
BL={f['name']:f['blurb'] for f in SC}; SN={f['name']:[x['label'] for x in f['scenarios'] if x['kind']=='opening'] for f in SC}
import re
W=json.load(open(R+'card/wiki-base.json'))
def cls(ko):
    m=re.search(r'\|분류:([^|\n]*)',W.get(ko,'')); t=m.group(1) if m else ''
    return re.sub(r'✂️.*?✂️|❗','',t).split(',')[0].split('(')[0].strip()
SUB='#8a8a8a'; LINE='rgba(128,128,128,0.35)'; ACC='#2f9e86'
SANS="'Pretendard','Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif"
def h(t): return f'<div style="margin:72px 0 26px 0;padding:14px 18px;background:{ACC};border-radius:10px;"><span style="font-size:20px;font-weight:800;color:#ffffff;">{t}</span></div>'
def img(src,alt='',st=''): return f'<img src="{src}" alt="{html.escape(alt)}" style="display:block;width:100%;height:auto;margin:0;{st}">'
def people(rows):
    o='<div style="margin:22px 0 0 0;font-size:0;">'
    for ko,cap in rows:
        f=face(ko)
        pic=f'<img src="{f}" alt="{ko}" style="display:block;width:100%;height:auto;margin:0;border-radius:10px;">'
        o+=f'<div style="display:inline-block;vertical-align:top;width:16.66%;min-width:104px;margin:0 0 16px 0;"><div style="padding:0 6px;">{pic}<div style="margin-top:6px;font-size:14px;font-weight:700;line-height:1.35;">{ko}</div><div style="font-size:12px;color:{SUB};line-height:1.4;word-break:keep-all;">{cap}</div></div></div>'
    return o+'</div>'
def scenes(names):
    s=''.join(f'<span style="display:inline-block;margin:0 8px 8px 0;padding:5px 11px;border:1px solid {LINE};border-radius:999px;font-size:13px;">{n}</span>' for n in names)
    return f'<div style="margin:16px 0 0 0;"><div style="font-size:12px;color:{SUB};margin:0 0 8px 0;">첫 장면</div>{s}</div>'
def fold(title,sub,body,first=False):
    return (f'<details style="border-bottom:1px solid {LINE};{"border-top:1px solid "+LINE+";" if first else ""}">'
            f'<summary style="padding:16px 2px;list-style:none;"><span style="float:right;font-size:13px;color:{ACC};font-weight:700;margin-left:12px;">펼치기</span>'
            f'<span style="font-size:18px;font-weight:800;">{title}</span>'
            +(f'<div style="margin-top:4px;font-size:14px;color:{SUB};line-height:1.6;word-break:keep-all;">{sub}</div>' if sub else '')+'</summary>'
            f'<div style="padding:4px 2px 30px 2px;">{body}</div></details>')
def mini(label,body):
    return (f'<details style="margin:14px 0 0 0;"><summary style="list-style:none;"><span style="display:inline-block;padding:8px 16px;border:1px solid {LINE};border-radius:999px;font-size:13px;font-weight:700;">{label} <span style="color:{ACC};">펼치기</span></span></summary><div style="padding:4px 0 0 0;">{body}</div></details>')
def faccard(nm,en,blurb,sc,rows,label):
    o=(f'<div style="margin:0 0 28px 0;padding:0 0 28px 0;border-bottom:1px solid {LINE};font-size:0;"><div style="display:inline-block;vertical-align:top;width:240px;max-width:100%;margin:0 24px 12px 0;">{img(fac(en),nm,"border-radius:10px;")}</div>'
       f'<div style="display:inline-block;vertical-align:top;width:560px;max-width:100%;"><div style="font-size:20px;font-weight:800;">{nm}</div>'
       f'<div style="margin-top:6px;font-size:15px;line-height:1.7;word-break:keep-all;">{blurb}</div>{scenes(sc) if sc else ""}</div></div>')
    if rows: o=o[:-6]+mini(label,people(rows))+'</div>'
    return o
def facbody(en,sc,rows=None):
    o=f'<div style="max-width:520px;">{img(fac(en),"","border-radius:10px;")}</div>'
    return o+(scenes(sc) if sc else '')+(people(rows) if rows else '')
def tile(ko,size,wpct,minw):
    f=anom(ko,size)
    if not f: return ''
    return f'<div style="display:inline-block;vertical-align:top;width:{wpct};min-width:{minw}px;margin:0 0 16px 0;"><div style="padding:0 5px;">{img(f,ko,"border-radius:8px;")}<div style="margin-top:6px;font-size:{15 if size==600 else 12}px;font-weight:700;line-height:1.35;word-break:keep-all;">{ko}</div>'+(f'<div style="font-size:12px;color:{SUB};line-height:1.4;">{cls(ko)}</div>' if size==600 else '')+'</div></div>'
def shot(src,name,text):
    return (f'<div style="margin:0 0 34px 0;">{img(src,name,"border-radius:10px;")}'
            f'<div style="margin:10px 0 0 0;"><span style="font-size:16px;font-weight:800;">{name}</span><span style="font-size:14px;color:{SUB};margin-left:10px;">{text}</span></div></div>')


def para(t,mt=0): return f'<div style="margin:{mt}px 0 0 0;font-size:16px;line-height:1.85;word-break:keep-all;">{t}</div>'
def sub(label,items,text=''):
    o=f'<div style="margin:22px 0 6px 0;font-size:15px;font-weight:800;color:{ACC};">{label}</div>'+(f'<div style="margin:0 0 10px 0;font-size:15px;line-height:1.8;word-break:keep-all;">{text}</div>' if text else '')+'<div style="font-size:0;margin:0 -5px;">'
    for src,name in items:
        o+=f'<div style="display:inline-block;vertical-align:top;width:50%;min-width:150px;margin:0 0 14px 0;"><div style="padding:0 5px;">{img(src,name,"border-radius:8px;")}<div style="margin-top:6px;font-size:13px;font-weight:700;">{name}</div></div></div>'
    return o+'</div>'
def sset(path,name,box=(552,113,1628,1010)):
    return save(Image.open(K+path+'.png').convert('RGB').crop(box),name,86)
def block(nm,text,src,extra=''):
    return (f'<div style="margin:0 0 30px 0;padding:0 0 30px 0;border-bottom:1px solid {LINE};"><div style="font-size:19px;font-weight:800;margin:0 0 8px 0;">{nm}</div>'
            f'{para(text)}<div style="margin:14px 0 0 0;">{img(src,nm,"border-radius:10px;")}</div>{extra}</div>')
CB=(625,225,2408,1600)
B=[]
B.append(img(cover(),'유계역','border-radius:12px;'))
B.append(f'<div style="padding:24px 0 0 0;"><div style="font-size:34px;font-weight:900;letter-spacing:-0.8px;line-height:1.25;">괴이 ː ANOMALY</div>'
         f'<div style="margin-top:6px;font-size:16px;color:{SUB};line-height:1.6;">RisuAI용 괴담 세계관 시뮬레이션 봇</div></div>')
B.append(para('괴담이 실제로 벌어지는 현대 한국을 배경으로 한 시뮬레이션 봇입니다. 봇 카드와 전용 플러그인을 함께 씁니다.',20))

B.append(h('스타트 패널'))
B.append(para('새 채팅에서 유령 단추를 누르면 열립니다. 세력과 첫 장면, 언어를 정하고 출발을 누르면 그 장면으로 채팅이 시작됩니다.'))
sp=save(Image.open(K+'promo/pc-start-01-open.png').convert('RGB').crop((705,95,1857,1630)).resize((691,921),Image.LANCZOS),'start.jpg',86)
B.append(f'<div style="margin:18px 0 30px 0;max-width:420px;">{img(sp,"스타트 패널")}</div>')
B.append(f'<div style="font-size:17px;font-weight:800;margin:0 0 6px 0;">세력</div>'+para('세력마다 준비된 첫 장면이 있고, 장면을 직접 써서 시작하거나 커스텀 임무로 시작할 수도 있습니다.')+'<div style="height:22px;font-size:0;">&nbsp;</div>')
P={'관리국':[('쟈알디','종합대응팀 부장'),('스팡달','종합대응팀 선임 요원'),('잼트리','종합대응팀 선임 요원'),('에일린','종합대응팀 선임 요원'),('고그니쟈','격리팀 연구 책임자'),('큐라스','진압팀 선임 요원'),('고르고디오','진압팀 선임 요원'),('데쥬레','격리팀 연구원'),('데드폴','종합대응팀 요원'),('게슈간','종합대응팀 요원'),('로제몬','종합대응팀 요원'),('콘쥬스','종합대응팀 요원')],
 '가짜 관리국':[('사장','최고 책임자'),('도필헌','국장'),('이길환','신입 교육 과장'),('이기석','신입 교육 과장'),('김조학','수석 심문관'),('이도형','검사부대 부장'),('고영훈','검사부대 차장'),('노기균','검사부대 대리'),('송주익','검사부대 대리'),('곽성주','진압부대 과장'),('조성춘','진압부대 과장'),('윤병수','신입 7팀 팀장'),('김성진','신입 7팀 사원'),('송진섭','신입 7팀 사원')],
 '백일몽 주식회사':[('청달래','개발본부 임원'),('호유원','이사'),('이병진','행정지원'),('백석주','정예 A조 조장'),('진나솔','정예 A조'),('이성해','정예 B조'),('이자헌','D조 조장'),('은하제','D조'),('박민성','D조'),('백사헌','F조'),('고영은','R조'),('강이학','I조'),('장허운','Y조'),('곽제강','연구1팀'),('이연화','연구1팀'),('제이','경비반장')]}
EN={'관리국':'Management Bureau','가짜 관리국':'Fake Management Bureau','백일몽 주식회사':'Baekilmong','민간인':'Civilian','프리랜서':'Freelancer'}
F=''
for nm in ['관리국','가짜 관리국','백일몽 주식회사','민간인','프리랜서']:
    F+=faccard(nm,EN[nm],BL[nm],SN[nm],P.get(nm),f'소속 인물 {len(P.get(nm,[]))}명')
F+=faccard('이면의 주민들','Residents of the Hidden World','조직의 신입이 아니라 그 세계에 사는 인물 열세 명 가운데 한 사람으로 시작합니다.',None,[('차여진','특별한 의뢰'),('서윤지','녹음기'),('고연지','선불입니다'),('윤지아','야간 접수'),('마덕희','도금이에요, 자기야'),('문혜란','사인 먼저, 밥은 나중에'),('신유리','십. 퍼센트. 매주.'),('블라렛','이교도와 수녀'),('살라딘','여기서 불타리라'),('아벤샤','마녀의 산책'),('세크리엠','갇힌 여자'),('탐미주의','넌 내 최고의 작품이야'),('브라우니','화요일의 즐거움, 화요일의 열기')],'인물 13명과 첫 장면')
B.append(F)

B.append(h('괴이'))
B.append(para('괴이 63곳의 설정과 위키 문서가 들어 있습니다. 진행 중에 괴이가 발생하면 상황판과 지도에 올라옵니다.'))
top=['룩키마트','심연교통공사','한설인육공장','자정역','소라 랜드','화요퀴즈쇼']
B.append('<div style="font-size:0;margin:20px -5px 0 -5px;">'+''.join(tile(k,600,'33.33%',150) for k in top)+'</div>')
rest=[k for k in AN if k not in top]; G=''.join(tile(k,240,'16.66%',100) for k in rest); n=sum(1 for k in rest if anom(k,240))
B.append(mini(f'나머지 괴이 {n}곳','<div style="font-size:0;margin:14px -5px 0 -5px;">'+G+'</div>'))

B.append(h('전용 플러그인'))
B.append(para('채팅 화면의 유령 단추를 누르면 열리는 창입니다.')+'<div style="height:26px;font-size:0;">&nbsp;</div>')
C=(0,0,2200,1800)
B.append(block('상황판','응답이 올 때마다 새로 발생한 괴이와 사건을 판정해 올리고, 요원들이 대기 중인지 출동 중인지를 함께 보여 줍니다.',screen('promo/pc-play-02-board','m_board.jpg')))
B.append(block('임무','지도에서 상황이 벌어진 곳에 요원을 넷까지 편성해 출발하면 그 편성으로 다음 장면이 이어집니다. 상황을 직접 써서 만드는 커스텀 임무도 여기에 있습니다.',screen('promo/pc-play-03-map','m_map.jpg',CB)))
B.append(block('괴담톡','인물들과 문자와 전화를 주고받는 메신저입니다. 인물이 먼저 문자를 보내거나 단톡방에 초대하기도 하고, 여기서 나눈 대화는 본편에 반영됩니다.',screen('promo/pc-play-04-phone','m_talk.jpg',CB)))
B.append(block('인터넷','게시판과 상점과 위키를 브라우저처럼 여는 메뉴입니다.',screen('promo/pc-play-05-net','m_net.jpg',CB),
   mini('게시판, 상점, 위키 화면',
   sub('게시판',[(screen('s-boards/pc-01-gn','n_gn.jpg',CB),'괴담넷'),(screen('s-boards/pc-04-gal','n_gal.jpg',CB),'괴담 갤러리'),(screen('s-boards/pc-08-wpf','n_wpf.jpg',CB),'세정게')],'게시판마다 글과 댓글이 올라오고, 직접 글을 쓰면 답글이 달립니다.')
   +sub('상점',[(screen('s-boards/pc-09-sm','n_sm.jpg',CB),'연어 마켓'),(screen('s-malls/pc-01-cos','n_cos.jpg',CB),'우주 쇼핑몰'),(screen('s-malls/pc-08-bm','n_bm.jpg',CB),'백일몽 포인트몰')],'산 물건은 소지품에, 쓴 돈은 가계부에 남아 본편에 반영됩니다.')
   +sub('위키',[(screen('s-wiki/pc-01-home','n_wk.jpg',CB),'괴이위키')],'괴이와 인물, 조직 문서를 읽고, 없는 문서는 새로 요청할 수 있습니다.'))))
B.append(block('소지품','가진 물건과 장착한 무기, 장비가 기록되어 본편에 반영되고, 번 돈과 쓴 돈은 가계부에 남습니다.',screen('promo/pc-play-06-items','m_items.jpg',CB),
   mini('가계부 화면',sub('가계부',[(screen('s-chron/pc_가계부_달줄','i_led.jpg',C),'가계부')]))))
B.append(block('기록','사건이 끝날 때마다 일지와 보고서가 쌓이고, 만난 인물의 기록과 세력의 평판도 여기서 봅니다.',screen('promo/pc-play-07-records','m_rec.jpg',CB),
   mini('연대기 화면',sub('연대기',[(screen('s-chron/pc_연대기','r_chron.jpg',C),'연대기')]))))

B.append(h('설정'))
B.append(para('기능을 켜고 끄는 것은 물론, 모델에 보내는 지침과 세계 자료까지 직접 고칠 수 있습니다.')+'<div style="height:26px;font-size:0;">&nbsp;</div>')
FB=(552,113,1628,1040)
g1=sub('호출',[(sset('s-set/pc_manage_flow','t_flow.jpg'),'호출 흐름'),(sset('s-set/pc_set_lore','t_lore.jpg'),'로어북 호출'),(sset('s-set/pc_set_adv','t_adv.jpg'),'생성 공통')],'한 턴에 모델을 부르는 순서와 횟수, 요청에 넣을 로어북을 정합니다.')
g2=sub('표시',[(sset('s-set/pc_set_screen','t_screen.jpg'),'화면'),(sset('s-set/pc_set_image','t_image.jpg'),'캐릭터 이미지'),(sset('s-set/pc_set_status','t_status.jpg'),'상태창')],'채팅에 띄우는 인물 표정 그림과 상태창의 칸 구성을 정합니다.')
g3=sub('기능',[(sset('s-set/pc_set_board','t_board.jpg'),'상황판'),(sset('s-set/pc_set_net','t_net.jpg'),'인터넷'),(sset('s-set/pc_set_phone','t_phone.jpg'),'괴담톡'),(sset('s-set/pc_set_wiki','t_wiki.jpg'),'위키'),(sset('s-set/pc_set_items','t_items.jpg'),'소지품'),(sset('s-set/pc_set_shop','t_shop.jpg'),'상점'),(sset('s-set/pc_set_journal','t_journal.jpg'),'일지'),(sset('s-set/pc_set_factions','t_fac.jpg'),'세력')],'기능마다 자동 호출 여부와 사용할 모델, 본편에 반영할지를 따로 정합니다.')
B.append(block('기능','기능별 설정을 모은 탭입니다. 아래 화면은 인물 페이지로, 응답이 끝날 때마다 보조 모델이 인물별 호감과 호칭, 관계를 갱신해 다음 응답에 반영하는 기능과 그 호출 순서를 보여 줍니다.',sset('s-set/pc_set_people','t_people.jpg',FB),mini('기능 탭의 다른 페이지',g1+g2+g3)))
B.append(block('세계','요원과 조직, 괴이의 자료를 직접 고치거나 새로 추가하는 탭입니다. 세력 관계와 지도 거점, 스타트 패널의 구성도 여기서 바꿉니다.',sset('s-set2/pc_agent_open','t_world.jpg')))
B.append(block('지침','모델에 보내는 지침을 기능별로 모아 둔 탭입니다. 절 단위로 고칠 수 있고, 기본 지침은 그대로 둔 채 자기 규칙만 덧붙일 수도 있습니다.',sset('s-set2/pc_guide_RP','t_guide.jpg')))
B.append(block('점검','설치와 업데이트, 호출 기록 확인, 설정 내보내기와 가져오기를 하는 탭입니다.',sset('s-set2/pc_manage_backup','t_check.jpg')))
B.append(para('설정 창의 AI 상담에 증상을 적으면 맞는 설정을 찾아 바꿔 줍니다.'))

B.append(h('받기'))
B.append(f'<div><a href="https://github.com/leepc25/goei-plugin/releases/latest" target="_blank" rel="noopener noreferrer" style="text-decoration:none;"><span style="display:inline-block;padding:14px 34px;background:{ACC};border-radius:10px;"><span style="color:#ffffff;font-size:15px;font-weight:800;">최신 판 받기</span></span></a></div>')
def li(i,t): return f'<div style="display:table;margin:0 0 10px 0;"><div style="display:table-cell;width:26px;font-size:15px;font-weight:800;color:{ACC};">{i}</div><div style="display:table-cell;font-size:15px;line-height:1.8;word-break:keep-all;">{t}</div></div>'
S=(li(1,'받는 곳에서 최신 zip을 받아 풉니다.')+li(2,'Risu 설정의 플러그인 탭에서 goei-plugin.js를 가져오고, 뜨는 권한 확인 창을 모두 허용합니다.')
   +li(3,'괴이_ANOMALY.charx를 캐릭터로 가져옵니다. 그림이 카드에 들어 있으므로 예전 에셋 모듈은 끕니다.')
   +li(4,'카드를 처음 열면 플러그인 본체를 한 번 받습니다. 받지 못하면 뜨는 창에 zip 안의 goei-body.js를 넣습니다.')
   +li(5,'채팅 화면 구석의 유령 단추를 누르면 스타트 패널이 열립니다.'))
B.append('<div style="margin:30px 0 0 0;"><div style="font-size:18px;font-weight:800;margin:0 0 14px 0;">설치 순서</div>'+S+'</div>')

page=f'<div style="max-width:860px;margin:0 auto;font-family:{SANS};">{"".join(B)}</div>'
open('arca.html','w').write(page)
print('ok',len(page),n)
import base64,re as _re
def emb(m): return 'src="data:image/jpeg;base64,'+base64.b64encode(open(m.group(1),'rb').read()).decode()+'"'
solo=_re.sub(r'src="(img/[^"]+)"',emb,page)
open('소개페이지.html','w').write('<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>괴이 ː ANOMALY</title><link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"></head><body style="margin:0;background:#fff;color:#222;font-size:15px;"><div style="padding:16px;">'+solo+'</div></body></html>')
print('solo',len(solo)//1024,'KB')
