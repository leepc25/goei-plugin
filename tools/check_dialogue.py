#!/usr/bin/env python3
"""필드 대사 데이터 검사: python3 tools/check_dialogue.py [파일...]"""
import json, sys, glob, os, re

ROOT = os.path.join(os.path.dirname(__file__), '..', 'game-src', 'dialogue')
ORGS = ['A00', 'B00', 'C00', 'D00', 'E00']
REL = ['boss', 'close', 'peer', 'junior', 'hostile', 'outsider']
TIME = ['morning', 'day', 'evening', 'night']
SIT = ['deployed', 'returned', 'hurt', 'companion', 'alert']
BARK, TALK = 25, 70
errs = []


def err(f, m):
    errs.append(f'{os.path.basename(f)}: {m}')


def lines(f, where, v, n, limit, minimum=None):
    if not isinstance(v, list) or not all(isinstance(s, str) and s.strip() for s in v):
        return err(f, f'{where}: 문자열 목록이 아님')
    if len(v) < (minimum or n):
        err(f, f'{where}: {len(v)}줄 (최소 {minimum or n})')
    for s in v:
        if len(s) > limit:
            err(f, f'{where}: {len(s)}자 > {limit}: {s}')
        for ph in re.findall(r'\{[^}]*\}', s):
            if ph not in ('{호칭}',):
                err(f, f'{where}: 허용 안 된 빈칸 {ph}')


def cell(f, where, c, small=False):
    if not isinstance(c, dict):
        return err(f, f'{where}: 칸 없음')
    for side in ('ally', 'enemy'):
        s = c.get(side)
        if not isinstance(s, dict):
            err(f, f'{where}.{side}: 없음'); continue
        lines(f, f'{where}.{side}.bark', s.get('bark'), 3, BARK, 2 if small else None)
        lines(f, f'{where}.{side}.talk', s.get('talk'), 2, TALK, 1 if small else None)


def persona(f, d, org_npc):
    p = d.get('persona') or {}
    fac = d.get('faction')
    own = fac if fac in ORGS[:3] else None
    if own:
        if org_npc:
            cell(f, 'persona.same', p.get('same'))
        else:
            same = p.get('same') or {}
            for k in ('up', 'peer', 'down'):
                cell(f, f'persona.same.{k}', same.get(k))
    for o in ORGS + ['etc']:
        if o == own:
            continue
        cell(f, f'persona.{o}', p.get(o))


def check_char(f, d):
    for k in ('name', 'faction', 'rank', 'voice', 'address'):
        if k not in d:
            err(f, f'{k} 없음')
    a = d.get('address') or {}
    for k in ('self', 'up', 'peer', 'down', 'outsider'):
        if not isinstance(a.get(k), str):
            err(f, f'address.{k} 없음')
    persona(f, d, False)
    ch = d.get('chars') or {}
    for r in REL:
        cell(f, f'chars.{r}', ch.get(r))
    for name, c in (d.get('special') or {}).items():
        cell(f, f'special.{name}', c, small=True)
    for k, v in (d.get('relations') or {}).items():
        if v not in REL:
            err(f, f'relations.{k}: {v}')
    t = d.get('time') or {}
    for k in TIME:
        lines(f, f'time.{k}', t.get(k), 3, BARK)
    s = d.get('situation') or {}
    for k in SIT:
        lines(f, f'situation.{k}', s.get(k), 2, BARK)


def check_npc(f, d):
    for k in ('type', 'voice'):
        if k not in d:
            err(f, f'{k} 없음')
    persona(f, d, True)
    t = d.get('time') or {}
    for k in TIME:
        lines(f, f'time.{k}', t.get(k), 3, BARK)
    s = d.get('situation') or {}
    lines(f, 'situation.alert', s.get('alert'), 3, BARK)
    lines(f, 'situation.hurt', s.get('hurt'), 2, BARK)


def main():
    files = sys.argv[1:] or sorted(glob.glob(os.path.join(ROOT, 'characters', '*.json')) + glob.glob(os.path.join(ROOT, 'npc', '*.json')))
    total = 0
    for f in files:
        try:
            d = json.load(open(f, encoding='utf-8'))
        except Exception as e:
            err(f, f'JSON 오류 {e}'); continue
        (check_npc if 'type' in d else check_char)(f, d)
        n = 0
        def walk(o):
            nonlocal n
            if isinstance(o, list): n += sum(1 for s in o if isinstance(s, str))
            elif isinstance(o, dict): [walk(v) for k, v in o.items() if k not in ('address', 'relations')]
        walk({k: v for k, v in d.items() if k in ('persona', 'chars', 'special', 'time', 'situation')})
        total += n
    for e in errs:
        print(e)
    print(f'파일 {len(files)}개, 대사 {total}줄, 문제 {len(errs)}개')
    sys.exit(1 if errs else 0)


main()
