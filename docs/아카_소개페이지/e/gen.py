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
def h(t): return f'<div style="margin:56px 0 16px 0;font-size:22px;font-weight:800;letter-spacing:-0.3px;">{t}</div>'
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

B=[]
B.append(img(cover(),'유계역','border-radius:12px;'))
B.append(f'<div style="padding:24px 0 0 0;"><div style="font-size:34px;font-weight:900;letter-spacing:-0.8px;line-height:1.25;">괴이 ː ANOMALY</div>'
         f'<div style="margin-top:6px;font-size:16px;color:{SUB};line-height:1.6;">RisuAI용 괴담 세계관 시뮬레이션 봇</div></div>')

B.append(f'<div style="margin:18px 0 0 0;font-size:16px;line-height:1.8;word-break:keep-all;">괴이가 실제로 나타나는 한국을 무대로 한 괴담 시뮬레이션 봇입니다. 전용 플러그인이 함께 들어 있습니다.</div>')
st='<div style="margin:22px 0 0 0;font-size:0;">'
for n,l in [('5','세력'),('55','인물'),('63','괴이'),('143','위키 문서')]:
    st+=f'<div style="display:inline-block;width:25%;vertical-align:top;"><div style="font-size:26px;font-weight:900;color:{ACC};line-height:1.2;">{n}</div><div style="font-size:13px;color:{SUB};">{l}</div></div>'
B.append(st+'</div>')
B.append(h('스타트 패널'))
sp=save(Image.open(K+'promo/pc-start-01-open.png').convert('RGB').crop((705,95,1857,1630)).resize((691,921),Image.LANCZOS),'start.jpg',86)
def step(i,t,d): return f'<div style="display:table;margin:0 0 14px 0;"><div style="display:table-cell;width:28px;font-size:15px;font-weight:900;color:{ACC};">{i}</div><div style="display:table-cell;"><div style="font-size:16px;font-weight:800;line-height:1.4;">{t}</div><div style="font-size:13px;color:{SUB};line-height:1.5;">{d}</div></div></div>'
B.append(f'<div style="font-size:0;margin:0 0 26px 0;"><div style="display:inline-block;vertical-align:top;width:340px;max-width:100%;margin:0 32px 16px 0;">{img(sp,"스타트 패널")}</div>'
         f'<div style="display:inline-block;vertical-align:top;width:300px;max-width:100%;padding-top:10px;">{step(1,"세력","")}{step(2,"첫 장면","")}{step(3,"언어","한국어, English")}{step(4,"출발","")}</div></div>')
P={'관리국':[('쟈알디','종합대응팀 부장'),('스팡달','종합대응팀 선임 요원'),('잼트리','종합대응팀 선임 요원'),('에일린','종합대응팀 선임 요원'),('고그니쟈','격리팀 연구 책임자'),('큐라스','진압팀 선임 요원'),('고르고디오','진압팀 선임 요원'),('데쥬레','격리팀 연구원'),('데드폴','종합대응팀 요원'),('게슈간','종합대응팀 요원'),('로제몬','종합대응팀 요원'),('콘쥬스','종합대응팀 요원')],
 '가짜 관리국':[('사장','최고 책임자'),('도필헌','국장'),('이길환','신입 교육 과장'),('이기석','신입 교육 과장'),('김조학','수석 심문관'),('이도형','검사부대 부장'),('고영훈','검사부대 차장'),('노기균','검사부대 대리'),('송주익','검사부대 대리'),('곽성주','진압부대 과장'),('조성춘','진압부대 과장'),('윤병수','신입 7팀 팀장'),('김성진','신입 7팀 사원'),('송진섭','신입 7팀 사원')],
 '백일몽 주식회사':[('청달래','개발본부 임원'),('호유원','이사'),('이병진','행정지원'),('백석주','정예 A조 조장'),('진나솔','정예 A조'),('이성해','정예 B조'),('이자헌','D조 조장'),('은하제','D조'),('박민성','D조'),('백사헌','F조'),('고영은','R조'),('강이학','I조'),('장허운','Y조'),('곽제강','연구1팀'),('이연화','연구1팀'),('제이','경비반장')]}
EN={'관리국':'Management Bureau','가짜 관리국':'Fake Management Bureau','백일몽 주식회사':'Baekilmong','민간인':'Civilian','프리랜서':'Freelancer'}
F=''
for i,nm in enumerate(['관리국','가짜 관리국','백일몽 주식회사','민간인','프리랜서']):
    F+=fold(nm,BL[nm],facbody(EN[nm],SN[nm],P.get(nm)),i==0)
F+=fold('이면의 주민들','인물 열세 명의 첫 장면',facbody('Residents of the Hidden World',None,
 [('차여진','특별한 의뢰'),('서윤지','녹음기'),('고연지','선불입니다'),('윤지아','야간 접수'),('마덕희','도금이에요, 자기야'),('문혜란','사인 먼저, 밥은 나중에'),('신유리','십. 퍼센트. 매주.'),('블라렛','이교도와 수녀'),('살라딘','여기서 불타리라'),('아벤샤','마녀의 산책'),('세크리엠','갇힌 여자'),('탐미주의','넌 내 최고의 작품이야'),('브라우니','화요일의 즐거움, 화요일의 열기')]))
B.append(F)

B.append(h('괴이'))
top=['룩키마트','심연교통공사','한설인육공장','자정역','소라 랜드','화요퀴즈쇼']
B.append('<div style="font-size:0;margin:0 -5px;">'+''.join(tile(k,600,'33.33%',150) for k in top)+'</div>')
rest=[k for k in AN if k not in top]; G=''.join(tile(k,240,'16.66%',100) for k in rest); n=sum(1 for k in rest if anom(k,240))
B.append(fold('괴이 더 보기',f'{n}곳','<div style="font-size:0;margin:0 -5px;">'+G+'</div>',True))

B.append(h('전용 플러그인'))
def sub(label,items):
    o=f'<div style="margin:22px 0 10px 0;font-size:13px;font-weight:800;color:{ACC};">{label}</div><div style="font-size:0;margin:0 -5px;">'
    for src,name in items:
        o+=f'<div style="display:inline-block;vertical-align:top;width:50%;min-width:150px;margin:0 0 14px 0;"><div style="padding:0 5px;">{img(src,name,"border-radius:8px;")}<div style="margin-top:6px;font-size:13px;font-weight:700;">{name}</div></div></div>'
    return o+'</div>'
C=(0,0,2200,1800)
MENU=[('상황판','',screen('promo/pc-play-02-board','m_board.jpg'),''),
 ('임무','',screen('promo/pc-play-03-map','m_map.jpg'),''),
 ('괴담톡','',screen('promo/pc-play-04-phone','m_talk.jpg'),''),
 ('인터넷','',screen('promo/pc-play-05-net','m_net.jpg'),
   sub('게시판',[(screen('s-boards/pc-01-gn','n_gn.jpg'),'괴담넷'),(screen('s-boards/pc-04-gal','n_gal.jpg'),'괴담 갤러리'),(screen('s-boards/pc-08-wpf','n_wpf.jpg'),'세정게')])
   +sub('상점',[(screen('s-boards/pc-09-sm','n_sm.jpg'),'연어 마켓'),(screen('s-malls/pc-01-cos','n_cos.jpg'),'우주 쇼핑몰'),(screen('s-malls/pc-08-bm','n_bm.jpg'),'백일몽 포인트몰')])
   +sub('위키',[(screen('s-wiki/pc-01-home','n_wk.jpg'),'괴이위키')])),
 ('소지품','',screen('promo/pc-play-06-items','m_items.jpg'),
   sub('가계부',[(screen('s-chron/pc_가계부_달줄','i_led.jpg',C),'가계부')])),
 ('기록','',screen('promo/pc-play-07-records','m_rec.jpg'),
   sub('연대기',[(screen('s-chron/pc_연대기','r_chron.jpg',C),'연대기')]))]
ov='<div style="font-size:0;margin:0 -5px 18px -5px;">'
for nm,ds,src,_ in MENU:
    ov+=f'<div style="display:inline-block;vertical-align:top;width:33.33%;min-width:150px;margin:0 0 14px 0;"><div style="padding:0 5px;">{img(src,nm,"border-radius:8px;")}<div style="margin-top:6px;font-size:14px;font-weight:800;">{nm}</div></div></div>'
B.append(ov+'</div>')
B.append(''.join(fold(nm,ds,img(src,nm,"border-radius:10px;")+extra,i==0) for i,(nm,ds,src,extra) in enumerate(MENU)))

B.append(h('받기'))
B.append(f'<div><a href="https://github.com/leepc25/goei-plugin/releases/latest" target="_blank" rel="noopener noreferrer" style="text-decoration:none;"><span style="display:inline-block;padding:14px 34px;background:{ACC};border-radius:10px;"><span style="color:#ffffff;font-size:15px;font-weight:800;">최신 판 받기</span></span></a></div>')
def li(i,t): return f'<div style="display:table;margin:0 0 10px 0;"><div style="display:table-cell;width:26px;font-size:15px;font-weight:800;color:{ACC};">{i}</div><div style="display:table-cell;font-size:15px;line-height:1.8;word-break:keep-all;">{t}</div></div>'
S=(li(1,'받는 곳에서 최신 zip을 받아 푼다.')+li(2,'Risu 설정의 플러그인 탭에서 goei-plugin.js를 가져오고, 뜨는 권한 확인 창을 모두 허용한다.')
   +li(3,'괴이_ANOMALY.charx를 캐릭터로 가져온다. 그림이 카드에 들어 있으므로 예전 에셋 모듈은 끈다.')
   +li(4,'카드를 처음 열면 플러그인 본체를 한 번 받는다. 받지 못하면 뜨는 창에 zip 안의 goei-body.js를 넣는다.')
   +li(5,'채팅 화면 구석의 유령 단추를 누르고 출발한다.'))
B.append('<div style="margin:22px 0 0 0;">'+fold('설치 순서','',S,True)+'</div>')

page=f'<div style="max-width:860px;margin:0 auto;font-family:{SANS};">{"".join(B)}</div>'
open('arca.html','w').write(page)
print('ok',len(page),n)

import base64,re as _re
def emb(m):
    return 'src="data:image/jpeg;base64,'+base64.b64encode(open(m.group(1),'rb').read()).decode()+'"'
solo=_re.sub(r'src="(img/[^"]+)"',emb,page)
open('소개페이지.html','w').write('<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>괴이 ː ANOMALY</title><link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"></head><body style="margin:0;background:#fff;color:#222;font-size:15px;"><div style="padding:16px;">'+solo+'</div></body></html>')
print('solo',len(solo)//1024,'KB')
