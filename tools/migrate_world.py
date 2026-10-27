#!/usr/bin/env python3
"""카드 로어북(🙂요원·🌆세력·🚧괴이·🎁파밍·📎부록·🌐세계 Faction/Roster)을 플러그인 세계 데이터(src/data/world/*.json)로 옮긴다.

2026-10-27 사용자 결정(docs/설계안_세계편집.md): 글자는 고치지 않고 자리만 옮긴다. 절(####)은 통째로 칸에 넣고,
칸 제목과 다른 절 제목은 한 단계 내려(#####) 글 안에 남긴다. 어느 절이 어느 칸인지는 아래 표(수기)로 정한다.

사용법: python3 tools/migrate_world.py <경량카드.charx> [--check]
  --check: 옮긴 데이터로 다시 조립한 글이 원문과 같은지(공백·제목 줄 정규화 뒤) 확인한다.
"""
import json
import re
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_lite_card as blc  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'src' / 'data' / 'world'

SIM_NOTE = ('[Simulation-only] This entry defines anomaly mechanics, labels, and survival guidance for simulation control, '
            'not an in-world script, briefing, or known lore. No character has prior information about it. '
            'Never have a character speak, explain, hint at, or present this entry as guidance.')

# ── 칸 정의 (src/core/world/schema.ts 와 같아야 한다) ──
ANOMALY_FIELDS = {'identity': 'Identity', 'entry': 'Entry Conditions', 'space': 'Structure', 'rules': 'Rules',
                  'entities': 'Sub-Entities', 'survival': 'Survival and Clear', 'notes': 'Notes'}
SITE_FIELDS = {'identity': 'Identity', 'access': 'Access', 'location': 'Location and Appearance', 'environment': 'Environment',
               'rules': 'Rules and Trade', 'keeper': 'Keeper'}
ORG_FIELDS = {'intro': 'Identity', 'doctrine': 'Doctrine', 'hq': 'Headquarters and Sites', 'structure': 'Structure',
              'hierarchy': 'Hierarchy', 'recruitment': 'Recruitment', 'assets': 'Core Assets and Traits', 'personnel': 'Personnel'}

# 괴이: 기본 배정 (절 제목 → 칸). 없는 제목은 아래 ANOMALY_MAP(괴이별)에서.
ANOMALY_DEFAULT = {
    'Identity': 'identity', 'Entry Conditions': 'entry', 'Structure': 'space', 'Zones': 'space', 'Locations': 'space',
    'Characteristics': 'space', 'Sub-Entities': 'entities', 'Entities': 'entities',
    'Station Office and Institute Access': 'space',
}
A = dict(id='identity', en='entry', sp='space', ru='rules', et='entities', sv='survival', nt='notes')
ANOMALY_MAP = {
    '강변': {'Surface Incidents and Information Exposure': 'nt', 'Adaptive Rules and Passage Tolls': 'ru'},
    '강북 특설병원': {'Predatory Hospital': 'id', 'Surveillance and Feeding Logic': 'ru', 'False-Sky Resident': 'et'},
    '강서 대학병원': {'Hospital Atmosphere and Space': 'sp', 'Visitor Classification and Medical Logic': 'ru'},
    '거대한 세상': {'Identity and Dimensional Access': 'id', 'Giants and Captivity': 'et', 'Modified Pet Humans': 'et', 'Wilderness and Wild Humans': 'sp'},
    '검은 그늘 속에서': {'Exposure and Dream Scenario': 'id', 'Light, Gaze, and Recognition': 'ru', 'Functional School and Credentials': 'sp',
                  'Rooms, Schedule, and Teacher': 'sp', 'True Ending': 'sv'},
    '광기로 점철된 성당': {'Occupied Sacred Site': 'id', 'Approach and Physical Domain': 'sp', 'Fly Kingdom and Temptation': 'ru', 'Failure Window and Aftermath': 'sv'},
    '교회': {'Church and Intake': 'id', 'Mechanism': 'ru'},
    '금지된 비디오': {'Cassette, Casting, and Escape': 'en', 'Camera Reality': 'ru', 'Performance and Enforcement': 'ru'},
    '기괴한 방탈출 카페': {'Storefront and Game Frame': 'id', 'Rule Sheet': 'ru', 'Industrial Game Space': 'sp', 'Staff and Manager': 'et', 'Monster Customer Network': 'nt'},
    '꿈과 희망의 극단': {'Stage Control': 'ru', 'Extraction and Substitution Risk': 'sv'},
    '눈먼 자들의 저택': {'Exhibition and Contaminated Documentation': 'id', 'Free Hour and Admission Collection': 'ru', 'Navigation and Galleries': 'sp',
                   'Staff, Viewers, and Collector': 'et'},
    '룩키마트': {'Arrival and Operating Cycle': 'id', 'Status, Debt, and Exit Requirements': 'sv', 'Shoppers and Contact': 'et', 'Floors and Service Areas': 'sp', 'Lookymart Staff': 'et'},
    '명일 아파트': {'Living Building and Entry': 'id', 'Domestic Rules': 'ru'},
    '몽중몽': {'Dream Recognition, Frames, and Awakening': 'sv', 'Recurring Painted Motifs': 'et'},
    '뮤지컬 붉은 숙녀': {'Stage Reality': 'sp', 'Chances, Acts, and Genre Corruption': 'ru'},
    '미술관': {'Curated Atmosphere': 'ru', 'Owner and Living Collection': 'et'},
    '미스테리 월드 어드벤쳐 파크': {'Identity, Entry, and Public Appearance': 'id', 'Main Entrance, Promenade, and Impersonation': 'sp',
                       'World Tour Train and Stopped-Ride Entities': 'sp', 'The Lake': 'sp', 'Historical Costume Experience Zone': 'sp',
                       'Halloween House, Water Flash, and Cotton Candy Country': 'sp'},
    '반짝반짝 용궁': {'Slide Entry and Two Faces': 'id', 'Perception and Infection': 'ru', 'City Districts and Hosts': 'sp', 'Child Rescue and Return': 'sv'},
    '불이 꺼진 관리국': {'Blackout and Recurrence': 'id', 'Pursuers and Containment': 'et', 'Confirmed Route Through Reality Layers': 'sv'},
    '빛이 없으라': {'Brochure and Course': 'sp', 'The Light Rule': 'ru', 'Management Bureau File': 'nt', 'Prize Draw and Clear': 'sv', 'Light-Starter': 'sv'},
    '사망단길': {'App Entry and Commercial Otherworld': 'id', 'Ten-Thousand-Step Event': 'ru', 'Segments, Shops, and Residents': 'sp', 'Recorded Traders': 'et',
              'Payment and Irregular Boundaries': 'sv'},
    '살아있는 보육원': {'Contact and Wish Hazards': 'ru', 'Irreversible Furniture Victims': 'et'},
    '샛별 고시원': {'Lodging Lure and Rule Document': 'id', 'Recovered Usage Guidelines': 'ru', 'Punishment and Confirmed Escape': 'sv', 'Rooms and Shared Spaces': 'sp',
               'The Residents': 'et'},
    '생체 공장': {'Labor and Production Control': 'ru'},
    '성 안티쿠스 기숙학교': {'Enrollment and Absolute Gentility': 'id', 'Experiential Curriculum and Demerits': 'ru', 'Building and Housemaster': 'sp',
                    'Formal Candidacy and Wedding': 'ru', 'Release Limits': 'sv'},
    '성자의 도시': {'City and Religious Control': 'id', 'Distributed Sites and Captive System': 'sp', 'Blood as Orders, Information, and Access': 'ru', 'Household and Saint': 'et'},
    '세광역': {'Mandatory Arrival and Founding': 'id', 'Platform and Forest Concourse': 'sp', 'Etiquette: Two Speakers': 'ru', 'Recruitment, Fog, and Escalation': 'ru',
            "Rule 3's Real, Dangerous Exit": 'sv', 'Train Registration and Departure': 'sv'},
    '세광특별시': {'Sealed City and Day of Disaster': 'id', 'Entry, Death, and Claims': 'en', 'Subway, Surface, and Station Network': 'sp', 'Shelter Train Community': 'et',
              'Surface Mass and Bureau Remnants': 'et'},
    '소라 랜드': {'Park and Activation': 'id'},
    '소토스 백화점': {'Identity, Arrival, and Customer Status': 'id', 'Floors, Navigation, and Current Rules': 'sp', 'Chairman: Presence, Courtesy, and Conversion': 'et',
               'Employees and Cleaning Staff': 'et', '1F Customer Service Center': 'sp', 'Mannequins and Disposal Substitution': 'et', 'Deep Underground': 'sp'},
    '심연교통공사': {'Entry and Train': 'en', 'Individual Station Judgment': 'ru', 'Normal Escape and Passenger Cohesion': 'sv', 'Lost-and-Found: Exactly One Bypass': 'sv',
               'Temporary Stops': 'ru'},
    '아침역': {'Rescue Deliberation and Enrollment': 'id', 'Procedure and the Selection Officer': 'ru', 'Scale of Evil: Proper Use and Corruption': 'ru',
            'Chambers, Execution, and Jurors': 'sp', 'Surviving a Case Versus Termination': 'sv'},
    '어두운 정원': {'Identity, Arrival, and Layout': 'id', 'Path and Maze Mechanics': 'ru', 'Central Plaza, Contract, and Actual Exit': 'sv', 'Garden Slave Gardener': 'et'},
    '영원마을': {'Identity, Approach, and Concealment': 'id', 'Entrance Residents and Tests': 'et', 'Village Life, Currency, and Businesses': 'sp', 'Perimeter Threats and Transit': 'et'},
    '오후역': {'Station, Landlord, and Tenant': 'id', 'Two Access Relationships': 'en', 'Landlord Payments and Contract Ownership': 'ru',
            'Labor, Demonstrations, and Broadcasts': 'ru', 'Studio Spaces and City Hall Feed': 'sp', 'Broadcast Personnel and Callers': 'et', 'Documented Merchandise': 'nt'},
    '욕망의 방': {'Manifestation and Room': 'id', 'Five-Rule Signboard Notice': 'ru', "Standard Mode: Occupants' Desires": 'ru', 'Hidden Solo Mode: Rule 0': 'ru',
              'Signboard and Mode Diagnosis': 'sv', 'Binding Limits': 'ru'},
    '원숭이 꿈 괴담': {'Abduction and Railway Cycle': 'id', 'Railway and Hunting Force': 'sp', 'Colony and Blood Supply': 'sp', 'Extraction and Two-Stage Clear': 'sv'},
    '유계역': {'Entrances, Text, and Navigation': 'en', 'Etiquette and Station Staff': 'ru', 'Station Areas': 'sp', 'Rush Hour Mannequins': 'et', 'Shadow Figures and Beggars': 'et'},
    '유쾌 테마파크': {'Board Game and Guest Status': 'id', 'User Guide and Enforcement': 'ru', 'Territories and Mascots': 'sp', 'Facilities, Staff, and Prize': 'ru'},
    '유쾌연구소': {'Institute, Partnership, and Research Shift': 'id', 'Dream Incubator and Invitation Research': 'nt',
              "Angel's Sigh Music-Box Sabotage and Loss of the City's Protection": 'nt', 'Access and Seven Underground Branches': 'en',
              'Segwang Core Layer and Office 1004': 'sp', 'Institute Echo Beneath Baekilmong': 'sp'},
    '인류의 신비전': {'Exhibition and Entry': 'id'},
    '인스피레이션 호텔': {'Contracts and House Behavior': 'ru'},
    '자정역': {'Station, Admission, and Currency': 'id', 'Body Ownership, Billing, and Exposure': 'ru', 'Games and Facilities': 'sp', 'Addicts and Dealers': 'et'},
    '조계사': {'Temple Pressure': 'ru', 'Bargaining': 'ru'},
    '지산마을 명절 축제': {'Village and Festival Entry': 'id', 'Rooster Marks, Etiquette, and Contamination': 'ru', 'Lottery and Final-Day Offering': 'ru',
                  'Locations and Enforcement': 'sp', 'Rescue and Core Suppression': 'sv'},
    '차원 승강기': {'Entry and Vertical Complex': 'id', 'Documented Floor Types': 'ru', 'Route and Resource Trade-Offs': 'sv', 'Zones and Their Boundaries': 'sp',
               'Floor Guardians': 'et', 'Wandering Passengers': 'et', 'The Elevator Entity': 'et'},
    '청악메리병원': {'Hospital and Admission': 'id', 'Gatehouse and Guard Rulebook': 'ru', 'Patient Rulebook and Discharge': 'ru', 'Lobby, Wards, and Residents': 'sp',
               'Kim Seong-han and Terminal Processing': 'et'},
    '코즈믹 판타지 동물원': {'Identity, Access, and Grounds': 'id', 'Ticket, Human Tells, and Keepers': 'ru', 'Stitched-Skin Animals and Handling': 'et',
                    'Maze Garden, Yarn, and Genuine Exit': 'sv', 'Buried Floor Entities': 'et'},
    '페어리테일 파크': {'Identity, Entry, and Presentation': 'id', 'Lotus Sea': 'sp', "Sisters' Restaurant": 'sp', 'Tiled-Roof House of Flowers': 'sp',
                 'Stable of the Fox and Manager': 'sp', 'Fairy Castle': 'sp', 'Other Residents and Encounters': 'et'},
    '프러스트 워터파크': {'Identity, Arrival, and Water Rules': 'id', 'Public Sectors and Transactions': 'sp', 'Genuine Rest Lounge (휴게실): Home Return': 'sv',
                  'Staff Break Rooms (휴게실), Corridors, and Disposal': 'sp', 'Staff Hierarchy and Escalation': 'et'},
    '플라워 골든 리조트': {'Resort and Entry Vectors': 'id', 'Guest Rules and Employment': 'ru', 'Hotel Facilities': 'sp', 'Administration and Continuing Propagation': 'et'},
    '피어블 극장': {'Identity and Entry': 'id', 'Lobby, Scent Masking, and Admission': 'ru', 'Auditorium Rules and Performance Windows': 'ru',
               'Owner, Audience Network, and Staff': 'et', 'Backstage Restrooms': 'sp'},
    '학교의 악몽': {'Nightmare Cycle and Entry': 'id', 'School Space and Encounters': 'sp', 'Master, Defensive Escalation, and Clear': 'sv'},
    '한낮역': {'Failed Homecoming': 'id', 'Sleep, Symbolism, and Termination': 'ru', 'Neighborhood Movement and Shelter': 'sp', 'The Rested and Resident-Wish Echoes': 'et'},
    '한밤역': {'Public Library and Its Collection': 'id', 'Engraved Rules and Labyrinth': 'ru', 'Continuity Patrons and the Master': 'et', 'Self-Recognition Exam': 'sv',
            'Preserved Places and Records': 'sp'},
    '한설인육공장': {'Otherworld and Capture': 'id', 'Workforce and Work Cycle': 'et', 'Arrival Base and Survivor Notebook': 'sp', 'Factory Route': 'sp',
               'Wider World, Return Leads, and Core': 'sv'},
    '한여름 밤의 꿈': {'Casting and Scene Continuity': 'ru', 'Confession and Death': 'ru', 'Resolution': 'sv'},
    '해피엔딩 홀': {'Identity and Forced Recruitment': 'id', 'Initiation Route and Layout': 'sp', 'Lee Seo-yu and Her Powers': 'et', 'Seeker in the Box (상자 속 구도자)': 'et',
               'Scriptures and Tongue Parasites': 'nt'},
    '헝그리 행맨': {'Activation and Assigned Roles': 'id', 'Faculty Rules and Penalties': 'ru', 'Hangman Session': 'ru', 'Rooms and Personnel': 'sp',
               'Exceptional Rescue and Departure': 'sv'},
    '화요퀴즈쇼': {'Application and Studio': 'id', "Phase 1 — Baseline: Live Quiz and Brownie's Authority": 'ru', 'Transformation: Delayed Intake and Cancellation': 'ru',
              'Phase 2 — Recorded Replacement: Chorus of the Sacrifice': 'ru', 'Conditional Production-Collapse Route': 'sv', 'Outside Summoning: Purgatory Choir Parade': 'nt'},
    '환상드라마 민속촌': {'Identity and Village Atmosphere': 'id', 'Bus, Line 0, and Station Exit Exception': 'en', 'Recognition and Hanbok Wandering Dead': 'ru',
                  'Folktale Role-Play Attraction': 'sp', 'Village Well': 'sp', 'Curse Puppeteer / Yunmal and Human Captives': 'et'},
    '황혼역': {'Unmanned Market and Arrival': 'id', 'Conscience Ledger and Restitution': 'ru', 'Platform and Flea Market Concourse': 'sp'},
}

# 파밍: 절 제목 → 칸 (없으면 추가 칸)
SITE_DEFAULT = {
    'Identity': 'identity', 'Overview': 'identity', 'Origin': 'identity', 'Registration and Status': 'identity',
    'Access': 'access', 'Contact': 'access', 'Location and Access': 'access', 'Containment and Access': 'access', 'Access and Etiquette': 'access', 'How to obtain': 'access',
    'Location and Appearance': 'location', 'Location': 'location', 'Appearance': 'location', 'Space and Procedure': 'location',
    'Environment': 'environment',
    'Service flow': 'rules', 'Currency': 'rules', 'Transaction': 'rules', 'Trade Mechanics': 'rules', 'Visitor Protocol': 'rules', 'Nature and Function': 'rules',
    'Inventory and Pricing': 'rules', 'Inventory and Services': 'rules', 'Phone Orders': 'rules', 'Merchandise': 'rules', 'Crafting Procedure': 'rules',
    'Crafting and Inheritance Rules': 'rules', 'The Plant Prohibition': 'rules', 'Mechanism': 'rules', 'Effect': 'rules', 'Exit': 'rules', 'Nature and Risk': 'rules',
    'Survival Notes': 'rules', 'The Invitation Rite: enclosed instructions, full text': 'rules', 'Studio Audience': 'rules',
    'The Tattooist': 'keeper', 'The Owner': 'keeper', 'Dokkaebi': 'keeper', 'The Counselor': 'keeper', 'Personnel': 'keeper', 'The Summoned Entity': 'keeper',
    'The Machine': 'keeper',
}
# 조직: 절 제목 → 칸 (없으면 추가 칸). Hostile Organizations 는 세력 관계 메모·교리로 손으로 옮김 (ORG_HOSTILE)
ORG_DEFAULT = {
    'Identity': 'intro', 'Overview': 'intro',
    'Doctrine': 'doctrine', 'Doctrine of Force': 'doctrine', 'Method: Art as Vector': 'doctrine', 'The Law of the Stage': 'doctrine', 'Territorial Nature': 'doctrine',
    'Headquarters and Sites': 'hq', 'Headquarters': 'hq', 'Location': 'hq',
    'Structure': 'structure', 'HQ Structure': 'structure', 'Division': 'structure', 'User Structure': 'structure',
    'Hierarchy': 'hierarchy',
    'First Contact and Recruitment': 'recruitment', 'Recruitment': 'recruitment', 'Recruitment and Orientation': 'recruitment',
    'The Core Assets': 'assets', 'Characteristic': 'assets', 'The Database': 'assets', 'Uh-doom Classification': 'assets', 'Clear Reward': 'assets',
    'Personnel': 'personnel', 'Workers': 'personnel', 'Core Participants': 'personnel', 'Freelancers (프리랜서)': 'personnel', 'The Survivor Collective': 'personnel',
}
# 세력 로어북 이름 → 명부 조직 이름
ORG_LORE_TO_NAME = {'협회': '특수재난대응협회', '이슬람 서울중앙성원': '이슬람', '발푸르기스 협회': '발푸르기스'}
# Faction 요약 로어북의 제목 → 명부 조직 이름 (B00 시점 글은 variants.B00 로)
FACTION_HEAD = {
    'Management Bureau [A00]': '관리국', 'Fake Management Bureau [A00]': '관리국', 'Fake Management Bureau [B00]': '가짜 관리국', 'Management Bureau [B00]': '가짜 관리국', 'Baekilmong Co., Ltd [C00]': '백일몽', 'Civilian [D00]': '민간인',
    'Freelancer [E00]': '프리랜서', 'Special Disaster Response Association': '특수재난대응협회', 'Jungnim Underground Shopping Center': '중림 지하상가',
    'Vatican': '교황청', 'Islam': '이슬람', 'Walpurgis Society': '발푸르기스', 'Vampires': '흡혈귀', 'Mumyeong Chanrangyo': '무명찬란교', 'The Troupe': '극단',
    'The Hospital': '병원', 'The Aestheticism': '탐미주의', 'The World Politics Forum': '세계정치 게시판',
}
# Roster 조직 제목 → 명부 조직 이름
ROSTER_HEAD = {'Management Bureau [A00]': '관리국', 'Fake Management Bureau [B00]': '가짜 관리국', 'Baekilmong Co., Ltd.': '백일몽', 'The Vatican': '교황청',
               'Islam': '이슬람', 'Walpurgis Society': '발푸르기스', 'Vampires': '흡혈귀', 'Jungrim Underground Shopping Center': '중림 지하상가',
               'Special Disaster Response Association / SDRA': '특수재난대응협회'}

CBS_B00 = re.compile(r'\{\{#if \{\{not_equal::\{\{getvar::st_faction\}\}::B00\}\}\}\}(.*?)\{\{/if\}\}\{\{#if \{\{equal::\{\{getvar::st_faction\}\}::B00\}\}\}\}(.*?)\{\{/if\}\}')
CBS_B00_REV = re.compile(r'\{\{#if \{\{equal::\{\{getvar::st_faction\}\}::B00\}\}\}\}(.*?)\{\{/if\}\}\{\{#if \{\{not_equal::\{\{getvar::st_faction\}\}::B00\}\}\}\}(.*?)\{\{/if\}\}')


def split_sections(body):
    """'#### ' 절로 나눈다. 첫 절 앞 글은 ('', text). 각 절은 (title, text) — text 에 제목 줄은 없고 ##### 하위는 그대로."""
    out = []
    cur_title, cur = '', []
    for line in body.split('\n'):
        if line.startswith('#### '):
            out.append((cur_title, '\n'.join(cur)))
            cur_title, cur = line[5:].strip(), []
        else:
            cur.append(line)
    out.append((cur_title, '\n'.join(cur)))
    return [(t, x.strip('\n')) for t, x in out if t or x.strip()]


def demote(text):
    return re.sub(r'^(#{5,6}) ', lambda m: '#' + m.group(1) + ' ', text, flags=re.M)


def strip_tail(text):
    t = text.rstrip()
    t = re.sub(r'\n+---\s*$', '', t)
    return t.strip('\n')


def clean_body(content):
    body = content.replace('\r', '')
    body = re.sub(r'^\s*@@dont_activate[ \t]*\n', '', body)
    return strip_tail(body)


def note_order(rec, oid):
    """칸·추가 절이 원문에 나온 순서를 order 에 남긴다 (조립이 원문 순서를 따르게)"""
    o = rec.setdefault('order', [])
    if oid not in o:
        o.append(oid)


def put_section(rec, field_titles, field, title, text):
    """절을 칸에 넣는다. 칸 제목과 다른 절 제목은 ##### 로 글 안에 남긴다. 같은 칸에 둘째 절부터는 빈 줄로 잇는다."""
    text = strip_tail(text)
    chunk = text if title == field_titles[field] else f'##### {title}\n{demote(text)}'
    rec['fields'][field] = f"{rec['fields'][field]}\n\n{chunk}" if rec['fields'].get(field) else chunk
    note_order(rec, field)


def put_extra(rec, title, text, kind='block', at=None, sec=None):
    """추가 칸. kind=line 이면 「- 이름: 값」 한 줄로 sec 절 안 at 칸 뒤에(at='' 이면 절 맨 앞), block 이면 절 하나로 맨 뒤에."""
    e = {'name': title, 'value': strip_tail(demote(text)) if kind == 'block' else text.strip(), 'kind': kind}
    if sec is not None:
        e['sec'] = sec
        e['at'] = at or ''
    else:
        note_order(rec, f'x:{title}')
    rec['extra'].append(e)


# ── 요원 ──
IDENTITY_FIELDS = {'Age': 'age', 'Gender': 'gender', 'Role': 'role'}
APPEARANCE_FIELDS = {'Physique': 'physique', 'Appearance': 'appearance', 'Outfit': 'outfit'}


def parse_agent(name, entry):
    body = clean_body(entry['content'])
    m = re.match(r'### Character - (.+)\n', body)
    if not m:
        raise SystemExit(f'요원 {name}: 제목 줄이 없습니다')
    english_title = m.group(1).strip()
    body = body[m.end():]
    rec = {'keys': entry.get('key', ''), 'fields': {}, 'extra': []}
    for title, text in split_sections(body):
        if title == 'Identity':
            prev = ''
            for line in text.split('\n'):
                mm = re.match(r'^- ([A-Za-z ]+): ?(.*)$', line)
                if not mm:
                    raise SystemExit(f'요원 {name}: Identity 줄을 못 읽음: {line!r}')
                k, v = mm.group(1), mm.group(2).strip()
                if k == 'Organization':
                    # 관리국·가짜 관리국의 B00 분기 글은 호칭 표로 다시 만든다. 그 밖의 글은 그대로 보존 (요원마다 다른 표기)
                    if not CBS_B00.search(v):
                        rec['fields']['organization'] = v
                    prev = 'organization'
                elif k == 'Department':
                    rec['fields']['department_en'] = v
                    prev = 'department_en'
                elif k in IDENTITY_FIELDS:
                    rec['fields'][IDENTITY_FIELDS[k]] = v
                    prev = IDENTITY_FIELDS[k]
                else:
                    put_extra(rec, k, v, 'line', at=prev, sec='identity')
        elif title == 'Appearance':
            prev = ''
            for line in text.split('\n'):
                mm = re.match(r'^- ([A-Za-z ]+): ?(.*)$', line)
                if not mm:
                    raise SystemExit(f'요원 {name}: Appearance 줄을 못 읽음: {line!r}')
                k, v = mm.group(1), mm.group(2).strip()
                if k in APPEARANCE_FIELDS:
                    rec['fields'][APPEARANCE_FIELDS[k]] = v
                    prev = APPEARANCE_FIELDS[k]
                else:
                    put_extra(rec, k, v, 'line', at=prev, sec='appearance')
        elif title in ('Character', 'Voice', 'Background', 'Abilities'):
            rec['fields'][title.lower()] = strip_tail(text)
        else:
            put_extra(rec, title, text)
    return english_title, rec


# ── 괴이·파밍·조직 ──
def parse_place(name, entry, kind):
    body = clean_body(entry['content'])
    rec = {'keys': entry.get('key', ''), 'fields': {}, 'extra': []}
    sections = split_sections(body)
    head_title, head = sections[0] if sections and not sections[0][0] else ('', '')
    if head_title == '':
        sections = sections[1:] if sections and not sections[0][0] else sections
    if kind == 'anomaly':
        # 제목 줄: 「### Instructions for the Implementation of the Anomaly - 이름」. 두 개(세광특별시·유쾌연구소)는 'the Anomaly - ' 가 없어 제목 글 전체를 남긴다
        mm = re.match(r'### Instructions for the Implementation of (.+)\n\n' + re.escape(SIM_NOTE) + r'\s*$', head, re.S)
        if not mm:
            raise SystemExit(f'괴이 {name}: 공통 머리말이 다릅니다:\n{head[:300]}')
        t = mm.group(1).strip()
        rec['title'] = t[len('the Anomaly - '):] if t.startswith('the Anomaly - ') else t
        if not t.startswith('the Anomaly - '):
            rec['titleRaw'] = True
        fields, default, extra_map = ANOMALY_FIELDS, ANOMALY_DEFAULT, {A[v] if len(v) == 2 else v: None for v in ()}
        mapping = {k: A[v] for k, v in ANOMALY_MAP.get(name, {}).items()}
        for title, text in sections:
            f = mapping.get(title) or default.get(title)
            if not f:
                raise SystemExit(f'괴이 {name}: 배정 없는 절 {title!r}')
            put_section(rec, fields, f, title, text)
        used = set(mapping)
        for t in mapping:
            if t not in {s[0] for s in sections}:
                raise SystemExit(f'괴이 {name}: 표에 있는 절이 글에 없음 {t!r}')
    elif kind == 'site':
        mm = re.match(r'### (.+?)\s*$', head.strip(), re.S) if head else None
        if head:
            lines = head.strip().split('\n')
            if not lines[0].startswith('### '):
                raise SystemExit(f'파밍 {name}: 제목 줄이 없음')
            rec['title'] = lines[0][4:].strip()
            rest = '\n'.join(lines[1:]).strip('\n')
            if rest.strip():
                # 절 없는 글(이빨 요정): 정체로
                rec['fields']['identity'] = strip_tail(rest)
                note_order(rec, 'identity')
        for title, text in sections:
            f = SITE_DEFAULT.get(title)
            if f:
                put_section(rec, SITE_FIELDS, f, title, text)
            else:
                put_extra(rec, title, text)
    return rec


def parse_org(name, entry):
    body = clean_body(entry['content'])
    body = CBS_B00.sub(lambda m: m.group(1).strip(), body)  # 제목의 B00 분기는 기본(A00 시점)만. 이름은 호칭 표로 다시 찍는다
    rec = {'keys': entry.get('key', ''), 'fields': {}, 'extra': []}
    sections = split_sections(body)
    if sections and not sections[0][0]:
        head = sections[0][1]
        sections = sections[1:]
        lines = [l for l in head.split('\n')]
        if not lines[0].startswith('### '):
            raise SystemExit(f'조직 {name}: 제목 줄이 없음 {lines[0]!r}')
        rec['_title'] = lines[0][4:].strip()
        rest = '\n'.join(lines[1:])
        rest = re.sub(r'^\s*\[Affiliation code: \w+\]\s*', '', rest).strip('\n')
        if rest.strip():
            rec['fields']['intro'] = strip_tail(rest)  # 절 없는 조직(교황청·이슬람·발푸르기스·흡혈귀)
            note_order(rec, 'intro')
    for title, text in sections:
        if title in ('Hostile Organizations', 'Hostile and Rival Organizations'):
            rec.setdefault('_hostile', strip_tail(text))
            continue
        f = ORG_DEFAULT.get(title)
        if f:
            put_section(rec, ORG_FIELDS, f, title, text)
        else:
            put_extra(rec, title, text)
    return rec


def parse_appendix(name, entry):
    body = clean_body(entry['content'])
    lines = body.split('\n')
    if not lines[0].startswith('### '):
        raise SystemExit(f'부록 {name}: 제목 줄이 없음')
    return {'keys': entry.get('key', ''), 'fields': {'title': lines[0][4:].strip(), 'body': strip_tail('\n'.join(lines[1:]))}, 'extra': []}


# ── Faction 요약 ──
def parse_faction(content):
    """세력별 소개(기본 시점·B00 시점)와 뒤쪽 「Doctrine and Relations」 원문을 돌려준다."""
    text = content.replace('\r', '')
    i = text.index('## Faction Doctrine and Relations')
    intro_part, rel_part = text[:i], text[i:]
    out = {}
    # 분기: {{#if not B00}}### X{{/if}} → 기본, {{#if B00}}### Y{{/if}} → B00
    for m in re.finditer(r'\{\{#if \{\{(not_equal|equal)::\{\{getvar::st_faction\}\}::B00\}\}\}\}### (.+?)\n(.+?)\{\{/if\}\}', intro_part, re.S):
        kind, head, desc = m.group(1), m.group(2).strip(), m.group(3).strip()
        org = FACTION_HEAD[head]
        out.setdefault(org, {})['B00' if kind == 'equal' else 'base'] = desc
    plain = re.sub(r'\{\{#if .*?\{\{/if\}\}', '', intro_part, flags=re.S)
    for m in re.finditer(r'^### (.+?)\n(.+?)(?=\n### |\n## |\Z)', plain, re.S | re.M):
        head, desc = m.group(1).strip(), m.group(2).strip()
        out.setdefault(FACTION_HEAD[head], {})['base'] = desc
    return out, rel_part.strip()


def swap_cbs_to_codes(text):
    """관계 글의 이름 분기 → {A00}/{B00} 자리표 (조립 때 호칭 표로 채움)."""
    def rep(m):
        a, b = m.group(1).strip(), m.group(2).strip()
        # (not B00: X)(B00: Y): X 는 기본 시점 이름. Management Bureau → A00, Fake → B00
        return '{A00}' if a == 'Management Bureau' else '{B00}'
    text = CBS_B00.sub(rep, text)
    def rep2(m):
        a = m.group(1).strip()  # (B00: X)(not B00: Y) → Y 가 기본 시점 이름
        b = m.group(2).strip()
        return '{A00}' if b == 'Management Bureau' else '{B00}'
    text = CBS_B00_REV.sub(rep2, text)
    return text


# ── Roster ──
def parse_roster(content):
    text = CBS_B00.sub(lambda m: m.group(1).strip(), content.replace('\r', ''))
    intros, dept_en, group_notes = {}, {}, {}
    org, dept = '', ''
    for line in text.split('\n'):
        if line.startswith('### '):
            org = ROSTER_HEAD[line[4:].strip()]
            dept = ''
            continue
        if line.startswith('#### '):
            dept = line[5:].strip()
            continue
        if line.startswith('- ') and org:
            m = re.match(r'^- (.+?) (\(.*)$', line)
            if not m:
                raise SystemExit(f'Roster 줄을 못 읽음: {line!r}')
            intros[m.group(1).strip()] = (m.group(2).strip(), org, dept)
            continue
        s = line.strip()
        if s and not s.startswith('##') and not s.startswith('- ') and org:
            group_notes.setdefault(org, []).append((dept, s))
    return intros, group_notes


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    check = '--check' in sys.argv
    if not args:
        raise SystemExit(__doc__)
    with zipfile.ZipFile(args[0]) as z:
        module = blc.read_module(z.read('module.risum'))
    lore = module['lorebook']
    folders = {e['key']: e['comment'] for e in lore if e.get('mode') == 'folder'}
    by_folder = {}
    for e in lore:
        if e.get('mode') == 'folder' or not str(e.get('content', '')).strip():
            continue
        by_folder.setdefault(folders.get(e.get('folder'), ''), []).append(e)
    directory = json.loads(next(e for e in lore if e.get('comment') == 'Directory')['content'])
    by_name = lambda f: {e['comment']: e for e in by_folder.get(f, [])}

    # 요원
    agents = {}
    roster_intros, roster_notes = parse_roster(by_name('🌐세계')['🙂Roster']['content'])
    dir_agents = directory['요원']
    for e in by_folder['🙂요원']:
        name = e['comment']
        if re.match(r'^\s*-{2,}', name):
            continue
        english_title, rec = parse_agent(name, e)
        d = dir_agents.get(name)
        if not d:
            raise SystemExit(f'명부에 없는 요원 {name}')
        if d['english'] != english_title:
            print(f'[주의] {name}: 명부 영문명 {d["english"]!r} ≠ 제목 {english_title!r}', file=sys.stderr)
        ri = roster_intros.pop(d['english'], None) or roster_intros.pop(english_title, None)
        if ri:
            rec['fields']['intro'] = ri[0]
        else:
            print(f'[주의] {name}: Roster 줄 없음', file=sys.stderr)
        agents[name] = rec
    if roster_intros:
        raise SystemExit(f'Roster 에만 있는 이름: {list(roster_intros)}')

    # 조직
    faction_intro, relations_raw = parse_faction(by_name('🌐세계')['📜Faction']['content'])
    orgs = {}
    hostile = {}
    for e in by_folder['🌆세력']:
        name = ORG_LORE_TO_NAME.get(e['comment'], e['comment'])
        if name not in directory['조직']:
            raise SystemExit(f'명부에 없는 조직 {name}')
        rec = parse_org(name, e)
        if '_hostile' in rec:
            hostile[name] = rec.pop('_hostile')
        od = directory['조직'][name]
        default_title = f"{od.get('english', '') or name} ({name})"
        t = rec.pop('_title', '')
        if t and t != default_title:
            rec['title'] = t  # 「Baekilmong Namhae Branch (백일몽 남해지사)」처럼 영문명과 다른 제목만 저장
        orgs[name] = rec
    for org, v in faction_intro.items():
        if org not in orgs:
            # 세력 로어북이 없는 조직(민간인·프리랜서·탐미주의): Faction 요약에만 쓰고 세력 상세 로어는 만들지 않는다
            orgs[org] = {'keys': '', 'fields': {}, 'extra': [], 'summaryOnly': True}
        rec = orgs[org]
        base = v.get('base', '')
        cur = rec['fields'].get('intro', '')
        if base and base != cur:
            rec['fields']['intro'] = base if not cur else f'{base}\n\n{cur}'
        if 'B00' in v:
            rec.setdefault('variants', {})['B00'] = {'intro': v['B00']}
    # Roster 묶음 메모 → 조직 소개 끝에 (사용자 2026-10-27: 묶음 메모 칸은 두지 않는다)
    # 복장·장비 메모(문장)는 소개 끝에 한 줄씩, 조 꼬리표(「A Jo (Elite Jo)」처럼 요원 묶음 제목)는 Roster 조립용 roster_notes 로 남긴다
    for org, notes in roster_notes.items():
        rec = orgs[org]
        lines, sub = [], []
        for dept, text in notes:
            if re.match(r'^[A-Z] Jo\b', text):
                sub.append({'department': dept, 'label': text})
            else:
                lines.append(text if not dept else f'{dept}: {text}')
        if lines:
            rec['fields']['intro'] = (rec['fields'].get('intro', '') + '\n\n' + '\n'.join(f'- {l}' for l in lines)).strip()
        if sub:
            rec['roster_notes'] = sub
    # 부서 영문 표기 (Roster 제목 + 요원 Department 줄) → 조직 departments
    for name, rec in agents.items():
        d = dir_agents[name]
        org = next((o for o, od in directory['조직'].items() if od.get('code') == d['affiliation']), d['affiliation'])
        ri = roster_intros_by_dept = None
    dept_map = {}
    for eng, (_intro, org, dept) in parse_roster(by_name('🌐세계')['🙂Roster']['content'])[0].items():
        name = next((n for n, d in dir_agents.items() if d['english'] == eng), None)
        if name and dept:
            dept_map.setdefault(org, {})[dir_agents[name]['department']] = dept
    for org, m in dept_map.items():
        orgs[org]['departments'] = m

    # 괴이·파밍·부록
    anomalies = {e['comment']: parse_place(e['comment'], e, 'anomaly') for e in by_folder['🚧괴이']}
    sites = {e['comment']: parse_place(e['comment'], e, 'site') for e in by_folder['🎁파밍']}
    appendices = {e['comment']: parse_appendix(e['comment'], e) for e in by_folder['📎부록']}

    # 세력 관계: 격자 초기값 + 메모 + 공통 규칙 (Faction 「Doctrine and Relations」 + 조직별 Hostile 절을 손으로 배치)
    relations = build_relations(relations_raw, hostile)
    # Hostile 절의 나머지 항목(외부 조직 일반 방침)은 그 조직 교리 칸 끝에 (사용자 2026-10-27: 교리는 소개와 같은 기록 안에)
    for org, rest in relations.pop('_hostile_rest').items():
        if rest:
            f = orgs[org]['fields']
            f['doctrine'] = (f.get('doctrine', '') + '\n' + '\n'.join('- ' + re.sub(r'^\d+\.\s*', '', l.strip()) for l in rest.split('\n') if l.strip())).strip()

    DEFAULT_ORDER = {'anomaly': list(ANOMALY_FIELDS), 'site': list(SITE_FIELDS), 'org': list(ORG_FIELDS)}
    for kind, recs in (('anomaly', anomalies), ('site', sites), ('org', orgs)):
        for rec in recs.values():
            o = rec.get('order')
            if not o:
                continue
            base = [f for f in DEFAULT_ORDER[kind] if f in rec['fields']] + [f'x:{e["name"]}' for e in rec['extra'] if e['kind'] == 'block']
            if o == base:
                del rec['order']
    OUT.mkdir(parents=True, exist_ok=True)
    dump = lambda fn, kind, recs: (OUT / fn).write_text(json.dumps({'schema': 1, 'kind': kind, 'records': recs}, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    dump('agents.json', 'agent', agents)
    dump('orgs.json', 'org', orgs)
    dump('anomalies.json', 'anomaly', anomalies)
    dump('sites.json', 'site', sites)
    dump('appendices.json', 'appendix', appendices)
    (OUT / 'relations.json').write_text(json.dumps({'schema': 1, **relations}, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    sizes = {k: len(v) for k, v in [('요원', agents), ('조직', orgs), ('괴이', anomalies), ('파밍', sites), ('부록', appendices)]}
    print('옮김:', sizes)
    if check:
        run_check(lore, by_folder, agents, orgs, anomalies, sites, appendices, directory)


# 세력 관계 초기값 (사용자 2026-10-27: 5단계 = 평판 단계, 격자 값이 평판 시작값). Faction 「Doctrine and Relations」 문장을 메모로 옮김.
# 방향: 보는 쪽 → 대상. 중립은 적지 않는다.
def build_relations(raw, hostile):
    raw = swap_cbs_to_codes(raw)
    sec = {}
    cur = ''
    for line in raw.split('\n'):
        if line.startswith('### '):
            cur = line[4:].strip()
            sec[cur] = []
        elif line.startswith('- ') and cur:
            sec[cur].append(line[2:].strip())
    mp = sec['Mutual Perception']
    ed = sec['External Doctrine']
    ih = sec['Inter-Bureau Hostility']
    io = sec['Independent Operations and Cooperation']
    pairs = {}
    def pair(a, b, stage, *memos):
        pairs[f'{a}>{b}'] = {'stage': stage, 'memo': '\n'.join(m for m in memos if m)}
    # 양 관리국: 적대
    bureau = '\n'.join(ih)
    h1 = lambda o: re.sub(r'^\d+\.\s*', '', hostile.get(o, '').split('\n')[0]) if hostile.get(o) else ''
    pair('관리국', '가짜 관리국', 'hostile', mp[0], bureau, h1('관리국'))
    pair('가짜 관리국', '관리국', 'hostile', h1('가짜 관리국'))
    # 중립 세력(백일몽·프리랜서)의 눈: A00 경계(감시 회피·비공식 협력), B00 적대(접촉 = 납치·세뇌·죽음)
    neutral = ed[2]
    for n in ('백일몽', '프리랜서'):
        pair(n, '관리국', 'wary', neutral)
        pair(n, '가짜 관리국', 'hostile', neutral)
    # 백일몽 Hostile 절 1번(관리국) → 백일몽→관리국 메모에 덧붙임
    if hostile.get('백일몽'):
        pairs['백일몽>관리국']['memo'] += '\n' + h1('백일몽')
    # 관리국 → 백일몽: 경계 (옛 표 A00>C00 -25). 교리 문장은 공통 규칙으로 가므로 메모 없음
    pair('관리국', '백일몽', 'wary')
    pair('관리국', '프리랜서', 'neutral')
    # 가짜 관리국 → 백일몽·프리랜서: 적대 (모두 '이물')
    pair('가짜 관리국', '백일몽', 'hostile', ed[1])
    pair('가짜 관리국', '프리랜서', 'hostile', ed[1])
    # 옛 표(relations-base.orgs): 협회>B00 -25 → 경계
    pair('특수재난대응협회', '가짜 관리국', 'wary')
    pairs = {k: v for k, v in pairs.items() if v['stage'] != 'neutral'}
    # 공통 규칙: 상호 인식 2·3번째 문장, 대외 교리 1·2번째(관리국·가짜 관리국 방침) → 조직 교리로 가야 하나, 글자를 지키기 위해 공통 규칙에 둔다(2026-10-27 사용자: 소개에 합침). 독립 작전 전부
    common = ['### Mutual Perception', *(f'- {x}' for x in mp[1:]), '', '### External Doctrine', *(f'- {x}' for x in ed[:2]), '',
              '### Independent Operations and Cooperation', *(f'- {x}' for x in io)]
    # 조직별 Hostile 절의 2번째 항목(외부 조직 일반 방침)은 그 조직 교리에 붙여야 하므로 orgs 쪽에서 처리할 수 있게 돌려준다
    rest_hostile = {k: '\n'.join(v.split('\n')[1:]).strip() for k, v in hostile.items()}
    return {'stages': ['hostile', 'wary', 'neutral', 'favorable', 'friendly'], 'pairs': pairs, 'common': '\n'.join(common).strip(), '_hostile_rest': rest_hostile}


def run_check(lore, by_folder, agents, orgs, anomalies, sites, appendices, directory):
    """옮긴 데이터를 다시 조립해 원문과 비교한다 (조립은 dist-test/core.mjs 의 withWorldLore; 먼저 npm run build)."""
    import subprocess, tempfile
    tmp = Path(tempfile.gettempdir()) / 'goei-world-check-lore.json'
    tmp.write_text(json.dumps(lore, ensure_ascii=False), encoding='utf-8')
    r = subprocess.run(['node', str(ROOT / 'tools' / 'check-world.mjs'), str(tmp)], capture_output=True, text=True)
    print(r.stdout[-6000:], r.stderr[-2000:])


if __name__ == '__main__':
    main()
