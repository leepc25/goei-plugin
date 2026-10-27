#!/usr/bin/env python3
"""relations-base.json · aliases.json 검사.

검사 항목
- JSON 유효성 (두 파일)
- relations-base.people 이름 집합 == game-src/dialogue/characters/*.json 의 name 집합 (52명)
- people: faction 이 대사 JSON faction 과 같음, values 1~120자, express 0~3 정수, temper.open/grudge 0.5~1.5, english 는 문자열 배열
- pairs: 키 형식 A>B, A != B, 둘 다 people 에 있음, aff 가 허용 표(0/90/150/210/270/-25/-60/-100) 안, src 비어 있지 않음
- pairs: 대사 JSON relations 의 close/hostile 쌍이 전부 들어 있고 부호가 맞음(close → 양수, hostile → 음수)
- orgs: 키 형식 X>Y (X 인물 조직, Y 유저 조직 A00/B00/C00/D00/E00), 값은 0 또는 -25, people 에 나오는 모든 faction 이 다섯 유저 조직 전부에 대해 키를 가짐
- aliases.names 의 이름이 전부 people 에 있고 그 반대도 성립, aliases/titles 는 문자열 배열, 조사 붙은 꼴(…은/는/이/가/을/를/에게/한테)로 끝나는 별명 없음, 별명이 다른 사람 이름과 겹치지 않음
- aliases.ambiguous: titles 보유자 목록과 정확히 일치

사용: python3 tools/check_relations_base.py   (문제 0이면 종료 코드 0)
"""
import glob
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REL = os.path.join(ROOT, 'game-src', 'dialogue', 'relations-base.json')
ALI = os.path.join(ROOT, 'game-src', 'dialogue', 'aliases.json')
CHARS = os.path.join(ROOT, 'game-src', 'dialogue', 'characters', '*.json')

ALLOWED_AFF = {0, 90, 150, 210, 270, -25, -60, -100}
USER_FACTIONS = ['A00', 'B00', 'C00', 'D00', 'E00']
JOSA_TAIL = re.compile(r'(은|는|이|가|을|를|의|도|에게|한테|께|과|와|으로|로)$')

problems = []


def bad(msg):
    problems.append(msg)


def load(path):
    try:
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:  # noqa: BLE001
        bad(f'{os.path.relpath(path, ROOT)}: JSON 읽기 실패: {e}')
        return None


def main():
    rel = load(REL)
    ali = load(ALI)
    dialogue = {}
    for f in sorted(glob.glob(CHARS)):
        try:
            with open(f, encoding='utf-8') as fh:
                d = json.load(fh)
        except Exception as e:  # noqa: BLE001
            bad(f'{os.path.relpath(f, ROOT)}: JSON 읽기 실패: {e}')
            continue
        name = d.get('name')
        if os.path.basename(f)[:-5] != name:
            bad(f'{os.path.relpath(f, ROOT)}: 파일 이름과 name 불일치 ({name})')
        dialogue[name] = d
    if rel is None or ali is None:
        return
    if not dialogue:
        bad('대사 JSON 을 하나도 읽지 못함')
        return

    # ---- relations-base ----
    if rel.get('version') != 1:
        bad('relations-base: version 이 1 이 아님')
    people = rel.get('people')
    if not isinstance(people, dict):
        bad('relations-base: people 이 객체가 아님')
        return
    names = set(people)
    dnames = set(dialogue)
    if names != dnames:
        bad(f'relations-base: people 이름 불일치. 없는 사람: {sorted(dnames - names)}, 남는 사람: {sorted(names - dnames)}')
    if len(people) != 52:
        bad(f'relations-base: people 수 {len(people)} (52 이어야 함)')
    factions = set()
    for name, p in people.items():
        if not isinstance(p, dict):
            bad(f'people[{name}]: 객체가 아님')
            continue
        d = dialogue.get(name)
        if d and p.get('faction') != d.get('faction'):
            bad(f'people[{name}]: faction {p.get("faction")!r} 이 대사 JSON {d.get("faction")!r} 과 다름')
        factions.add(p.get('faction'))
        v = p.get('values')
        if not isinstance(v, str) or not (1 <= len(v) <= 120):
            bad(f'people[{name}]: values 가 1~120자 문자열이 아님 (len={len(v) if isinstance(v, str) else "?"})')
        ex = p.get('express')
        if not (isinstance(ex, int) and not isinstance(ex, bool) and 0 <= ex <= 3):
            bad(f'people[{name}]: express {ex!r} 가 0~3 정수가 아님')
        t = p.get('temper')
        if not isinstance(t, dict):
            bad(f'people[{name}]: temper 가 객체가 아님')
        else:
            for k in ('open', 'grudge'):
                x = t.get(k)
                if not (isinstance(x, (int, float)) and not isinstance(x, bool) and 0.5 <= x <= 1.5):
                    bad(f'people[{name}]: temper.{k} {x!r} 가 0.5~1.5 밖')
            for k in t:
                if k not in ('open', 'grudge'):
                    bad(f'people[{name}]: temper 에 모르는 키 {k}')
        en = p.get('english')
        if not (isinstance(en, list) and all(isinstance(x, str) and x for x in en)):
            bad(f'people[{name}]: english 가 문자열 배열이 아님')
        for k in p:
            if k not in ('faction', 'values', 'express', 'temper', 'english'):
                bad(f'people[{name}]: 모르는 키 {k}')

    pairs = rel.get('pairs')
    if not isinstance(pairs, dict):
        bad('relations-base: pairs 가 객체가 아님')
        pairs = {}
    for key, v in pairs.items():
        m = re.fullmatch(r'([^>]+)>([^>]+)', key)
        if not m:
            bad(f'pairs[{key}]: 키 형식이 A>B 가 아님')
            continue
        a, b = m.groups()
        if a == b:
            bad(f'pairs[{key}]: 자기 자신')
        for n in (a, b):
            if n not in names:
                bad(f'pairs[{key}]: {n} 이 people 에 없음')
        if not isinstance(v, dict):
            bad(f'pairs[{key}]: 값이 객체가 아님')
            continue
        aff = v.get('aff')
        if not (isinstance(aff, int) and not isinstance(aff, bool) and aff in ALLOWED_AFF):
            bad(f'pairs[{key}]: aff {aff!r} 가 허용 표 {sorted(ALLOWED_AFF)} 밖')
        if not (isinstance(v.get('src'), str) and v['src'].strip()):
            bad(f'pairs[{key}]: src(근거) 가 비어 있음')
        for k in v:
            if k not in ('aff', 'src'):
                bad(f'pairs[{key}]: 모르는 키 {k}')
    # 대사 JSON close/hostile 쌍 포함 여부
    for name, d in dialogue.items():
        for other, kind in (d.get('relations') or {}).items():
            if kind not in ('close', 'hostile'):
                continue
            if other not in names:
                continue  # 위키 인물이 아닌 상대(세크리엠 등)
            key = f'{name}>{other}'
            v = pairs.get(key)
            if not isinstance(v, dict):
                bad(f'pairs: 대사 JSON {name} relations {other}={kind} 가 pairs 에 없음')
                continue
            aff = v.get('aff')
            if isinstance(aff, int) and ((kind == 'close' and aff <= 0) or (kind == 'hostile' and aff >= 0)):
                bad(f'pairs[{key}]: 대사 JSON {kind} 인데 aff={aff}')

    orgs = rel.get('orgs')
    if not isinstance(orgs, dict):
        bad('relations-base: orgs 가 객체가 아님')
        orgs = {}
    for key, v in orgs.items():
        m = re.fullmatch(r'([^>]+)>([^>]+)', key)
        if not m:
            bad(f'orgs[{key}]: 키 형식이 X>Y 가 아님')
            continue
        x, y = m.groups()
        if y not in USER_FACTIONS:
            bad(f'orgs[{key}]: 유저 조직 {y} 가 {USER_FACTIONS} 밖')
        if x not in factions:
            bad(f'orgs[{key}]: 인물 조직 {x} 가 people 의 faction 에 없음')
        if v not in (0, -25) or isinstance(v, bool):
            bad(f'orgs[{key}]: 값 {v!r} 는 0 또는 -25 여야 함')
    for x in sorted(f for f in factions if f):
        for y in USER_FACTIONS:
            if f'{x}>{y}' not in orgs:
                bad(f'orgs: {x}>{y} 키가 없음')


    for k in rel:
        if k not in ('version', 'people', 'pairs', 'orgs'):
            bad(f'relations-base: 모르는 최상위 키 {k}')

    # ---- aliases ----
    if ali.get('version') != 1:
        bad('aliases: version 이 1 이 아님')
    anames = ali.get('names')
    if not isinstance(anames, dict):
        bad('aliases: names 가 객체가 아님')
        return
    if set(anames) != names:
        bad(f'aliases: names 이름 불일치. 없는 사람: {sorted(names - set(anames))}, 남는 사람: {sorted(set(anames) - names)}')
    owners = {}
    alias_owner = {}
    # 이름 자체가 호칭인 사람(「사장」): 그 이름은 title 로 쓰여도 됨
    title_names = {n for n, e in anames.items() if isinstance(e, dict) and n in (e.get('titles') or [])}
    for name, e in anames.items():
        if not isinstance(e, dict):
            bad(f'aliases[{name}]: 객체가 아님')
            continue
        for k in ('aliases', 'titles'):
            arr = e.get(k)
            if not (isinstance(arr, list) and all(isinstance(x, str) and x.strip() for x in arr)):
                bad(f'aliases[{name}].{k}: 문자열 배열이 아님')
                continue
            if len(set(arr)) != len(arr):
                bad(f'aliases[{name}].{k}: 중복 항목')
            for x in arr:
                if x == name and k == 'aliases':
                    bad(f'aliases[{name}].aliases: 이름 자체 {x!r} 는 넣지 않음')
                if x in names and x != name and x not in title_names:
                    bad(f'aliases[{name}].{k}: {x!r} 는 다른 사람 이름')
                if k == 'aliases' and not re.search(r'[A-Za-z]', x) and JOSA_TAIL.search(x) and len(x) > 2 and not any(x.endswith(n) for n in names):
                    # 한국어 별명이 조사 꼴로 끝나면 의심 (영문·두 글자·이름으로 끝나는 꼴은 제외)
                    bad(f'aliases[{name}].aliases: {x!r} 는 조사 붙은 꼴로 보임')
        for t in e.get('titles') or []:
            owners.setdefault(t, []).append(name)
        for a in e.get('aliases') or []:
            if a in alias_owner and alias_owner[a] != name:
                bad(f'aliases: 별명 {a!r} 가 {alias_owner[a]} 와 {name} 둘에게 있음 (titles 로 옮겨야 함)')
            alias_owner[a] = name
        for k in e:
            if k not in ('aliases', 'titles'):
                bad(f'aliases[{name}]: 모르는 키 {k}')
    # 별명이 다른 사람의 호칭과 겹치면 안 됨
    for a, n in alias_owner.items():
        if a in owners and owners[a] != [n]:
            bad(f'aliases: {n} 의 별명 {a!r} 가 다른 사람의 title 과 겹침 {owners[a]}')
    amb = ali.get('ambiguous')
    if not isinstance(amb, dict):
        bad('aliases: ambiguous 가 객체가 아님')
    else:
        want = {t: sorted(v) for t, v in owners.items()}
        got = {t: sorted(v) if isinstance(v, list) else v for t, v in amb.items()}
        for t in sorted(set(want) | set(got)):
            if want.get(t) != got.get(t):
                bad(f'ambiguous[{t}]: 파일 {got.get(t)} ≠ titles 보유자 {want.get(t)}')
    for k in ali:
        if k not in ('version', 'names', 'ambiguous'):
            bad(f'aliases: 모르는 최상위 키 {k}')


main()
if problems:
    for p in problems:
        print('문제:', p)
    print(f'\n문제 {len(problems)}건')
    sys.exit(1)
print('문제 0건: relations-base.json · aliases.json 이상 없음')
