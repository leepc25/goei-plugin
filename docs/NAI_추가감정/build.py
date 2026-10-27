"""작업/*.json(캐릭터별 15감정 프롬프트) → 결과/ NAI 불러오기 파일 4개 + 검사.
원본 v3 파일의 id·이름·순서를 그대로 쓰고 scenePrompt만 바꾼다."""
import json, re, sys, glob, os, collections
D = os.path.dirname(os.path.abspath(__file__))
SRC = {'01_bureau': '01_bureau_15_v3', '02_fake_bureau': '02_fake_bureau_15_v3',
       '03_baekilmong': '03_baekilmong_15_v3', '04_others': '04_others_15_v3'}
NAME = {'01_bureau': '관리국_추가감정_15종_설정반영', '02_fake_bureau': '가짜관리국_추가감정_15종_설정반영',
        '03_baekilmong': '백일몽_추가감정_15종_설정반영', '04_others': '기타_추가감정_15종_설정반영'}
EMO = ['suspicious', 'worried', 'relieved', 'disgusted', 'determined', 'jealous', 'pleading', 'forced smiling',
       'indifferent', 'guilty', 'pouting', 'angry smile', 'expressionless', 'tormented', 'crazy smile']
HAND = re.compile(r'^(hand|hands|own hands|crossed arms|arms? |adjusting|holding|pointing|beckoning|palm|outstretched|reaching|'
                  r'shrugging|scratching|facepalm|head rest|clenched hands?$|steepled|interlocked|covering|waving|salute|thumbs|'
                  r'index finger|finger|fist|wiping|tucking|twirling|playing with|cupping|clapping|v$|peace sign|spread arms|'
                  r'arm |arms behind|arms up|cigarette$|smoking$)')
PROP = re.compile(r'^(holding (?!own arm$).*|cigarette|smoke|smoking|mouth hold|chewing|monocle|blood on face|against wall|walkie-talkie|hamster|cup|phone)$')
OPEN = {'grin', 'teeth', 'open mouth', 'tongue out', 'clenched teeth', 'gritted teeth', 'parted lips'}
prompts = {}
for f in sorted(glob.glob(os.path.join(D, '작업', '*.json'))):
    for k, v in json.load(open(f, encoding='utf-8')).items():
        if k in prompts: sys.exit(f'중복 캐릭터 {k} ({f})')
        prompts[k] = v
probs, tagcount = [], collections.Counter()
os.makedirs(os.path.join(D, '결과'), exist_ok=True)
for out, src in SRC.items():
    d = json.load(open(os.path.join(D, '원본_GPT', src + '.json'), encoding='utf-8'))
    d['id'] = str(int(d['id']) + 1000)  # 옛 묶음과 안 겹치게
    d['name'] = NAME[out]
    for s in d['scenes']:
        who, emo = s['name'].rsplit('_', 1)
        p = prompts.get(who, {}).get(emo)
        if not p: probs.append(f'없음 {s["name"]}'); continue
        s['scenePrompt'] = p
        s['id'] = s['createdAt'] = str(int(s['id']) + 1000000)  # 옛 장면과 id 안 겹치게
        s['createdAt'] = int(s['createdAt'])
        if '::' in p or not p.endswith(','): probs.append(f'형식 {s["name"]}: {p}'); continue
        rest = [t.strip() for t in p.split(',') if t.strip()]
        tags = rest
        if [t for t in tags if PROP.match(t)]: probs.append(f'소품 {s["name"]}: {p}')
        tagcount.update(tags)
        if len(set(tags)) != len(tags): probs.append(f'중복태그 {s["name"]}')
        hands = [t for t in rest if HAND.match(t) and t not in ('holding cigarette',)]
        if len([t for t in hands if t not in ('cigarette', 'smoking')]) > 1: probs.append(f'손 {len(hands)}개 {s["name"]}: {hands}')
        if 'closed mouth' in tags and OPEN & set(tags): probs.append(f'입 모순 {s["name"]}: {OPEN & set(tags)}')
        if not 3 <= len(tags) <= 10: probs.append(f'태그 {len(tags)}개 {s["name"]}')
    json.dump(d, open(os.path.join(D, '결과', f'{out}_15_설정반영.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
# 고정 특징: 캐릭터 15장 공통 마지막 태그 vs 일부에만 있는 태그
for who, em in prompts.items():
    if set(em) != set(EMO): probs.append(f'감정 목록 {who}: {sorted(set(EMO) ^ set(em))}')
    last = collections.Counter(p.rstrip(',').split(',')[-1].strip() for p in em.values())
    for t, n in last.items():
        if 1 < n < 15 and t in {'sunglasses', 'black gloves', 'glasses', 'eyepatch', 'fangs', 'fang', 'doll joints', 'goggles'}:
            probs.append(f'고정특징 {who}: {t} {n}/15')
print('\n'.join(probs) or '검사 통과')
if '-t' in sys.argv:
    for t, n in sorted(tagcount.items()): print(n, t)
