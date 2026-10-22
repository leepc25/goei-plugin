# 현장용 반가면(눈·코만 가림) 도트. 옆얼굴(오른쪽을 봄) 기준, 원점 = 눈 위치. 결과 ../masks/<이름>.png + masks.json(눈 기준점)
# 글자: . 투명  k 외곽선  a 바탕  b 그늘  c 무늬  h 반사  e 눈구멍
import json,os
from PIL import Image
PAL={
 'lizard':  {'k':(20,20,24),'a':(226,228,222),'b':(170,176,172),'c':(132,146,140),'h':(255,255,250),'e':(12,12,14)},
 'falcon':  {'k':(20,18,16),'a':(150,122,92),'b':(104,84,64),'c':(46,40,36),'h':(214,196,160),'e':(12,12,14)},
 'badger':  {'k':(16,16,18),'a':(232,232,228),'b':(150,150,150),'c':(38,38,42),'h':(255,255,255),'e':(10,10,12)},
 'butterfly':{'k':(30,22,10),'a':(212,170,72),'b':(156,116,44),'c':(70,48,24),'h':(250,226,150),'e':(12,10,8)},
 'dolphin': {'k':(30,22,10),'a':(220,182,86),'b':(166,128,52),'c':(118,88,40),'h':(252,232,160),'e':(12,10,8)},
 'plain':   {'k':(22,22,26),'a':(214,214,210),'b':(160,160,158),'c':(120,120,120),'h':(244,244,240),'e':(12,12,14)},
 'fox':     {'k':(24,16,12),'a':(222,214,200),'b':(170,150,130),'c':(178,74,40),'h':(250,246,236),'e':(12,10,8)},
 'rabbit':  {'k':(22,22,26),'a':(236,232,232),'b':(182,174,178),'c':(214,150,160),'h':(255,255,255),'e':(12,12,14)},
 'crow':    {'k':(8,8,12),'a':(44,46,56),'b':(30,32,40),'c':(80,84,100),'h':(110,116,136),'e':(170,160,120)},
 'deer':    {'k':(26,18,12),'a':(168,124,82),'b':(122,88,58),'c':(232,220,200),'h':(206,170,120),'e':(12,10,8)},
 'cat':     {'k':(22,22,26),'a':(60,60,66),'b':(40,40,46),'c':(222,222,218),'h':(110,110,118),'e':(200,180,60)},
}
# 모양: 행 = 위→아래, 열 = 뒤(왼쪽)→앞(오른쪽). E 열/행 = 눈 자리(투명이 아니라 e)
SHAPE={
 'lizard':[  # 흰 도마뱀: 길쭉한 주둥이, 비늘 점
  "..kkkkkkk.....",
  ".kahachakk....",
  "kaacaacaahkk..",
  "kabaaeaacaahkk",
  "kbbcaaaacaaaak",
  ".kbbbcabbbbkk.",
  "..kkkkkkkkk...",
 ],
 'falcon':[  # 송골매: 굽은 부리 끝, 눈 아래 검은 줄
  "..kkkkkkk....",
  ".khhaaaaakk..",
  "kaaaaeaaaabk.",
  "kbacccaaaakkk",
  "kbbccbbaabkck",
  ".kbbcbbbbkkck",
  "..kkkkkkk..k.",
 ],
 'badger':[  # 오소리: 흰 바탕에 눈을 지나는 검은 띠
  ".kkkkkkkkk...",
  "kaahaaaaaakk.",
  "kccccceccccak",
  "kccccccccccak",
  "kaaaaaaaaaabk",
  ".kbbbbbbbbkkc",
  "..kkkkkkkk.kk",
 ],
 'butterfly':[  # 금 나비: 위아래 날개 끝이 튀어나옴
  "kk......kk...",
  "khk...kkhak..",
  "kaakkkaaaaak.",
  "kaaacaeaacaak",
  "kbaaccaacaabk",
  ".kbbkkkkkbbk.",
  "..kk.....kk..",
 ],
 'dolphin':[  # 금 돌고래: 둥근 이마, 짧은 부리
  "...kkkkkk.....",
  "..khhaaaakk...",
  ".kahaaeaaaakk.",
  "kaaaaaaaaaaahk",
  "kbaacaaaaaakk.",
  ".kbbbbbbbbk...",
  "..kkkkkkkk....",
 ],
 'plain':[
  ".kkkkkkkk...",
  "kahaaaaaakk.",
  "kaaaaeaaaahk",
  "kbaaaaaaaaak",
  ".kbbbbbbbbk.",
  "..kkkkkkkk..",
 ],
 'fox':[
  "k.kkkkkk.....",
  "kckhaaaakk...",
  "kcaaaeaaaakk.",
  "kaaaaaaaaaaak",
  "kbccaaaaaackk",
  ".kbbccccckk..",
  "..kkkkkkk....",
 ],
 'rabbit':[
  ".kk.kk.......",
  ".kck.kck.....",
  ".kck.kck.....",
  "kkkkkkkkkk...",
  "kahaaeaaaakk.",
  "kaaaaaaaaaack",
  ".kbbbbbbbbkk.",
  "..kkkkkkkk...",
 ],
 'crow':[
  "..kkkkkkk.....",
  ".khhaaaaakk...",
  "kaaaaeaaaaakk.",
  "kbaaaaaaaaaaak",
  "kbbaaaaaacckk.",
  ".kbbbbbbkk....",
  "..kkkkkk......",
 ],
 'deer':[
  "k.k..........",
  "kck.k........",
  ".kkkckkkk....",
  ".khaaaaaakk..",
  "kaaaaeaaaaakk",
  "kbaaaaaaacck.",
  ".kbbbbbbbkk..",
  "..kkkkkkk....",
 ],
 'cat':[
  ".k....k.....",
  "kak..kak....",
  "kaakkaaakk..",
  "kahaaeaaaak.",
  "kaccacaacaak",
  ".kbbbbbbbbk.",
  "..kkkkkkkk..",
 ],
}
OUT='../masks'
if __name__=='__main__':
    os.makedirs(OUT,exist_ok=True); meta={}
    for n,rows in SHAPE.items():
        w=max(len(r) for r in rows); h=len(rows); im=Image.new('RGBA',(w,h)); ey=ex=None
        for y,r in enumerate(rows):
            for x,ch in enumerate(r):
                if ch=='.': continue
                if ch=='e': ex,ey=x,y
                im.putpixel((x,y),PAL[n][ch]+(255,))
        im.save(f'{OUT}/{n}.png'); meta[n]={'w':w,'h':h,'eye':[ex,ey]}
    json.dump(meta,open(f'{OUT}/masks.json','w'),ensure_ascii=False,indent=1)
    sheet=Image.new('RGBA',(len(SHAPE)*18*6,12*6),(60,66,72,255))
    for i,n in enumerate(SHAPE):
        m=Image.open(f'{OUT}/{n}.png'); sheet.alpha_composite(m.resize((m.width*6,m.height*6),Image.NEAREST),(i*18*6,6))
    sheet.save(f'{OUT}/sheet.png'); print(meta)
