# 통합창 자료표: 뱃지 번호 + 요원 능력치(힘·민·체·지·정) + 기술 이름·판정·속성·설명 한 줄. docs/퍽/능력치_55명.json·기술_속성표.json 에서 뽑는다.
# 사용: python3 tools/ui/char_window_table.py
import json, re
st = json.load(open('docs/퍽/능력치_55명.json'))
sk = json.load(open('docs/퍽/기술_속성표.json'))
stats = {x['name']: [x['str'], x['dex'], x['con'], x['int'], x['wil']] for x in st}
skills = {}
for x in sk:
    m = re.search(r'「([^」]+)」', x.get('why', ''))
    skills.setdefault(x['name'], {})[x['skill']] = [re.sub(r'\(.*?\)$', '', x['title']).strip(), x['form'], x['elem'], m.group(1) if m else '']
names = [l.split('|')[0] for l in open('docs/퍽/뱃지_그림_문구_1101.txt', encoding='utf-8') if l.strip() and not l.startswith('#')]
badge = {n: i for i, n in enumerate(names)}
out = ('// tools/ui/char_window_table.py 가 만든다. 손으로 고치지 말 것\n'
       '/** 이름 → [힘, 민, 체, 지, 정] */\n'
       f'export const CW_STATS: Record<string, number[]> = {json.dumps(stats, ensure_ascii=False)};\n'
       '/** 이름 → 기술 칸(사격·고유기·충전0~3·필살) → [이름, 판정, 속성, 설명] */\n'
       f'export const CW_SKILLS: Record<string, Record<string, string[]>> = {json.dumps(skills, ensure_ascii=False)};\n'
       '/** 능력 이름 → 뱃지 번호 (docs/퍽/뱃지_그림_문구_1101.txt 줄 순서 = 판 N = 번호/32+1, 칸 = 번호%32, 64px 8×4) */\n'
       f'export const CW_BADGE: Record<string, number> = {json.dumps(badge, ensure_ascii=False)};\n')
open('src/game/action/ui/charWindowTable.gen.ts', 'w').write(out)
print(len(stats), len(skills), len(out))
