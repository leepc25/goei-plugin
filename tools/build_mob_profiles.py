"""몹 그림 신상 (src/game/world/mobProfiles.json): 그림 설계 문서(docs/동작표_3판/6.*.md)의 Subject·인상에서
성별·나이대·직업을 옮긴다 (10-31 사용자: 직업이 안 적힌 시민은 그냥 엑스트라 시민, 성별·나이대는 그림과 맞아야 함).
직업 = 인상에 적힌 것(시민 5장) 또는 그림 종류 자체가 직업인 것. 안 적힌 시민·불량배는 직업 없음.
사용법: python3 tools/build_mob_profiles.py
"""
import json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'docs/동작표_3판'
OUT = ROOT / 'src/game/world/mobProfiles.json'

# 인상 글에 직업이 적힌 시민 그림 (원문 낱말)
STATED = {'시민남5': '직장인', '시민남6': '대학생', '시민남9': '몸 쓰는 일', '시민여5': '사무직', '시민여9': '회사원'}
# 그림 종류 자체가 직업
TYPE_JOB = [('경찰', '경찰관'), ('상인', '상인'), ('의사', '의사'), ('간호사', '간호사'), ('청소부', '청소 노동자'), ('관리국', '관리국 요원'),
            ('가짜관리국검사', '가짜 관리국 검사부대'), ('가짜관리국진압', '가짜 관리국 진압부대'), ('백일몽', '백일몽 직원'), ('협회', '협회 직원'),
            ('프리랜서', '프리랜서'), ('학생', '고등학생')]
EN_AGE = {'early': '초반', 'mid': '중반', 'late': '후반'}
EN_DEC = {'teens': '10대', 'twenties': '20대', 'thirties': '30대', 'forties': '40대', 'fifties': '50대', 'sixties': '60대', 'seventies': '70대'}


def age_of(imp: str, sub: str) -> str:
    m = re.search(r'(\d0대(?: ?[초중후]반)?)', imp)
    if m:
        return m.group(1).replace('대초', '대 초').replace('대중', '대 중').replace('대후', '대 후')
    if re.search(r'high-school|여고생|남학생|여학생|미성년', sub + imp):
        return '10대(고등학생)'
    m = re.search(r'in (?:his|her) (early|mid|late)?-?\s*(\w+?ies)', sub)
    if m and m.group(2) in EN_DEC:
        return EN_DEC[m.group(2)] + (' ' + EN_AGE[m.group(1)] if m.group(1) else '')
    m = re.search(r'(\w+?ies)', sub)
    if m and m.group(1) in EN_DEC:
        return EN_DEC[m.group(1)]
    if re.search(r'young', sub) or '젊은' in imp:
        return '젊은 성인'
    return ''


def main():
    out = {}
    for f in sorted(SRC.glob('6.*.md')):
        name = f.stem.split('_', 1)[1]
        t = f.read_text(encoding='utf-8')
        sub = (re.search(r'Subject: `([^`]*)`', t) or [None, ''])[1]
        imp = (re.search(r'- 인상: (.*)', t) or [None, ''])[1]
        sex = '여' if re.search(r'\b(woman|girl|policewoman|her)\b', sub) else '남'
        job = STATED.get(name) or next((j for k, j in TYPE_JOB if name.startswith(k)), None)
        out[name] = {'sex': sex, 'age': age_of(imp, sub), **({'job': job} if job else {}), 'note': re.sub(r'\*\*', '', imp)}
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(len(out), 'profiles →', OUT.relative_to(ROOT))


if __name__ == '__main__':
    main()
