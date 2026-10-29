# 통합 테스트룸(game-src/action/testroom3/room.html)의 전투·생활 스크립트를 게임 모듈로 옮긴다 (2026-10-29, 본 게임 탑재 2단계).
# 에일린 변환기(tools/port_eileen_room.py)와 같은 방식: 스크립트를 손으로 다시 쓰지 않고 그대로 떼어 와서 게임과 맞닿는 곳만 바꾼다.
#   샌드백(D) → env.targets()의 실제 적(가장 가까운 앞 상대를 D 로, 범위 검사(near·inReach·화면 전체)에 든 상대 모두에게 strike)
#   화면 고정값(W·H·FLOOR) → 지금 보이는 화면(VX0~W)·게임 바닥(frameView), 키 → env.held, 소리 → env.sfx, 체력 → 게임, DOM·저장·오디오 → 없음
#   인물(A·IMG·CH)·이펙트(VFX)·의자(CHAIR) → env 로 받음(인물마다 코어 하나)
# 결과: src/game/action/room3/core.ts   사용: python3 tools/port_room3.py
import re
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
src = (ROOT / 'game-src/action/testroom3/room.html').read_text(encoding='utf-8').split('\n')
L = lambda a, b: src[a - 1:b]   # 1부터, 끝 포함


def find(prefix, start=1):
    for i in range(start - 1, len(src)):
        if src[i].startswith(prefix): return i + 1
    raise SystemExit('not found: ' + prefix)


def block(prefix):
    """prefix 로 시작하는 줄부터 그 함수가 닫히는 줄까지(중괄호 셈)"""
    a = find(prefix); b = a; depth = 0; seen = False
    while True:
        line = src[b - 1]
        for ch in line:
            if ch == '{': depth += 1; seen = True
            elif ch == '}': depth -= 1
        if seen and depth <= 0: return a, b
        b += 1


body = []
take = lambda a, b: body.extend(L(a, b))
skip_blocks = []   # 떼어 온 범위 안에서 빼는 함수들
def drop(prefix): skip_blocks.append(block(prefix))

# 범위: vfxDur ~ drawCut 끝. 그 안에서 DOM·오디오·샌드백·HUD·배경 함수는 뺀다
for p in ('function boomSnd(', 'function startAudio(', 'function renderChairBox(', 'function nudgeChair(', 'function renderScenes(', 'function canRun(',
          'function updateDummy(', 'function drawBg(', 'function drawDummy(', 'function drawHud('):
    drop(p)
a0 = find('const INDEX = ') + 1; b0 = block('function drawCut(')[1]
cut_lines = set()
_a = find('const ACTIONS = ['); _b = _a   # 키 표(ACTIONS ~ '];')는 통째로
while not src[_b - 1].startswith('];'): _b += 1
skip_blocks.append((_a, _b))
for a, b in skip_blocks:
    for i in range(a, b + 1): cut_lines.add(i)
for i in range(a0, b0 + 1):
    if i not in cut_lines: body.append(src[i - 1])
code = '\n'.join(body)


def sub(old, new, count=1):
    global code
    n = code.count(old)
    if n < 1 or (count and n != count): raise SystemExit(f'{n}x: {old[:90]}')
    code = code.replace(old, new)


def drop_line(prefix):
    global code
    lines = code.split('\n'); out = [l for l in lines if not l.startswith(prefix)]
    if len(out) == len(lines): raise SystemExit('drop_line not found: ' + prefix)
    code = '\n'.join(out)


# ── 바깥 것들: 이펙트 그림·캔버스·저장·오디오·키 ──
drop_line('const VFX = window.__VFX')
drop_line('const cv = document.getElementById')
drop_line('const store = { get(k, d)')
drop_line('                set(k, v)')
drop_line('const W = 1280, H = 720, FLOOR0')
drop_line('const DEF = Object.fromEntries')
drop_line('let binds = Object.assign')
drop_line('const held = new Set();')
drop_line('const down = n =>')
drop_line('let runT = 0;')
drop_line('const actOf = code =>')
drop_line('const keyName = c =>')
drop_line('let audio = null;')
drop_line('try { audio = window.GoeiAudio')
drop_line('function sfx(type, extra = {})')
drop_line('let bctx = null, bnoise = null')
drop_line('let started = false, song =')
drop_line('let charScale = store.get')
drop_line('const K = y => charScale')
drop_line('const chairEdit = () => store.get')
drop_line('const CHAIR = {}; for (const [k, v] of Object.entries(window.__CHAIR')
drop_line('let seatIdx = -1, showChair = true;')
sub("function chairFit(dir, line) {", "const chairEdit = () => ({});\nlet seatIdx = -1, showChair = true;\nfunction chairFit(dir, line) {")
# 상태 줄: 샌드백 D 는 표적 대리로(아래 head 에서 정의)
drop_line('const D = { juggle: 0, bounced: false')
sub("let paused = false, hitstop = 0, shake = 0, flash = 0, dark = 0, cut = 0, speed = 1, showNo = false, showDummy = true, counter = false, last = performance.now();",
    "let paused = false, hitstop = 0, shake = 0, flash = 0, dark = 0, cut = 0, speed = 1, showNo = false, counter = false;")
# 인물 바꾸기 없이 env 로 고정
sub("let A = {}, IMG = {}, CH = { key: '', name: '', color: '#cfc7a6', picks: {}, loops: {}, hit: {}, skills: {}, gun: [], kick: [], ranged: {} }, CK = null;",
    "const A = env.A, IMG = env.IMG, CH = Object.assign({ picks: {}, loops: {}, hit: {}, skills: {}, gun: [], kick: [], ranged: {} }, env.CH), CK = CH.key;")
# DOM 호출 지우기
sub("play(s.sit, { seq: S(R(0, nOf(s.sit) - 1), SEAT_F), onEnd: seatIdle }); renderChairBox();", "play(s.sit, { seq: S(R(0, nOf(s.sit) - 1), SEAT_F), onEnd: seatIdle });")
sub("() => { P.seat = null; renderChairBox(); if (fast === 'hit') hit(); else toIdle(); }", "() => { P.seat = null; if (fast === 'hit') hit(); else toIdle(); }")
sub("  if (a === 'map') { const h = document.getElementById('help').parentElement; h.style.display = h.style.display === 'none' ? '' : 'none'; return; }\n", "")
sub("  if (a === 'prevChar' || a === 'nextChar') return stepChar(a === 'nextChar' ? 1 : -1);\n", "")
sub("grayT = Math.max(0, grayT - dt); cv.style.filter = grayT > 0 ? 'grayscale(1)' : ''; shake", "grayT = Math.max(0, grayT - dt); shake")
# 화면 고정값 → 보이는 화면·게임 바닥
sub("  P.x = Math.max(70, Math.min(W - 70, P.x)); P.y = Math.max(FLOOR0 + 20, Math.min(FLOOR1, P.y));", "  env.clamp(P);")
sub("if (e.x < -40 || e.x > W + 40) e.t = 0;", "if (e.x < VX0 - 40 || e.x > W + 40) e.t = 0;")
sub("if (e.x < -300 || e.x > W + 300) e.t = 0;", "if (e.x < VX0 - 300 || e.x > W + 300) e.t = 0;")
sub("const x2 = e.dir > 0 ? W : 0, len = Math.abs(x2 - e.x);", "const x2 = e.dir > 0 ? W : VX0, len = Math.abs(x2 - e.x);")
sub("const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.55, W / 2, H / 2, H * 0.95);", "const g = ctx.createRadialGradient(640, H / 2, H * 0.55, 640, H / 2, H * 0.95);")
sub("  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);\n}", "  ctx.fillStyle = g; ctx.fillRect(0, 0, 1280, H);\n}")
# 샌드백 갱신 → 표적 대리 갱신, 샌드백 자리로 되돌아오기 없음
sub("  updateDummy(dt);\n", "  updateProxies(dt);\n")
# 체력은 게임이 (테스트룸의 맞을 때 깎기는 그림·소리만)
code = re.sub(r" ?P\.hp = Math\.max\(1, P\.hp - \d+\);", "", code)
code = code.replace("P.hp = Math.min(100, P.hp + (s.v || 25));", "env.heal && env.heal(s.v || 25);")
# 올라설 물건(에일린 이식과 같게)
sub("      if (P.z <= 0 && P.vz < 0) { land(); break; }", "      { const gz = env.ground(P.x, P.y); if (P.z <= gz && P.vz < 0) { P.z = gz; land(); break; } }")
# 능력치 배율
sub('function gainSp(v) { if (P.noGain > P.t) return; const was = P.sp; P.sp = Math.min(100, P.sp + v);',
    'function gainSp(v) { if (P.noGain > P.t) return; v *= env.mod ? env.mod.sp() : 1; const was = P.sp; P.sp = Math.min(100, P.sp + v);')
sub("        const sp = (running ? 430 : 230) * (P.dying ? 0.6 : 1);", "        const sp = (running ? 430 : 230) * (P.dying ? 0.6 : 1) * (env.mod ? env.mod.speed() : 1);")
# 디버그 글자
sub("  if (showNo) { ctx.fillStyle = '#fff'; ctx.font = '14px monospace'; ctx.fillText(`${id} · ${f + 1}/${a.n} · ${kk.toFixed(2)}배`, P.x - 60, P.y + 26); }\n", "")
# 쓰러진 뒤 좌우 = 기기, 위 = 일어나기 (에일린 이식과 같게)
sub("  if (m === 'down') { if (a === 'crawl') return belly();", "  if (m === 'down') { if (a === 'crawl' || a === 'left' || a === 'right') return belly();")
sub("  if (m === 'belly') { if (a === 'jump' || a === 'crawl') return getUp(); return; }", "  if (m === 'belly') { if (a === 'jump' || a === 'crawl' || a === 'up') return getUp(); return; }")
# 샌드백 체력 되살리기 없음
sub("  if (D.hp === 0) setTimeout(() => { D.hp = 400; }, 1200);\n", "")
# hurtDummy: 표적 대리에 그대로 적용한 뒤 게임 적에게 넘김(마지막 줄에 끼움)
sub("  num(D.x + (Math.random() - 0.5) * 30, D.y - 200 - D.z, dmg, big);\n}", "  num(D.x + (Math.random() - 0.5) * 30, D.y - 200 - D.z, dmg, big);\n  if (D.body) env.hurt(D, dmg, kind, P.face, hitstop, { src: curSrc });\n}")
# strike: 범위 검사에 든 상대 전부에게
sub("""  for (let i = 0; i < n; i++) i ? later(i * (h.every || 0.1), () => one(i)) : one(0);
}""", """  const list = hitList.length ? [...hitList] : (D ? [D] : []); hitList = [];
  const all = i => { const d0 = D; for (const t of list) { D = t; one(i); } D = d0 || D; };
  if (!list.length) return;
  for (let i = 0; i < n; i++) i ? later(i * (h.every || 0.1), () => all(i)) : all(0);
}""")
# near·inReach: 상대 전부를 보고, 든 상대를 hitList 에
sub("const near = (x, gy, rx, ry = 90) => showDummy && Math.abs(D.x - x) < rx && Math.abs(D.y - gy) < ry;",
    "const near = (x, gy, rx, ry = 90) => { const l = proxies().filter(T => Math.abs(T.x - x) < rx && Math.abs(T.y - gy) < ry); if (l.length) { hitList = l; D = l[0]; } return l.length > 0; };")
sub("function inReach(hx, pad = 60, hh = 100, wide = false) { pad *= K(P.y); const dk = K(D.y), hOk = wide ? P.z < D.z + 215 * dk && hh > D.z - 120 * dk : hh > D.z - 110 * dk && hh < D.z + 240 * dk; /* 공중공격: 발이 허수아비 머리(190)보다 낮게 내려왔을 때만(10-28 허공에서 맞던 것) */ return showDummy && Math.abs(D.y - P.y) < (wide ? 100 : 80) && (D.x - P.x) * P.face > (wide ? -60 : -20) && Math.abs(D.x - hx) < pad && hOk; }",
    "function inReach(hx, pad = 60, hh = 100, wide = false) { pad *= K(P.y); const l = proxies().filter(D => { const dk = K(D.y), hOk = wide ? P.z < D.z + 215 * dk && hh > D.z - 120 * dk : hh > D.z - 110 * dk && hh < D.z + 240 * dk; return Math.abs(D.y - P.y) < (wide ? 100 : 80) && (D.x - P.x) * P.face > (wide ? -60 : -20) && Math.abs(D.x - hx) < pad && hOk; }); if (l.length) { hitList = l; D = l[0]; } return l.length > 0; }")
# 평타 맞음: inReach 에 든 상대 전부에게(hurtDummy 는 D 하나라 strike 처럼 돌림)
sub("      hurtDummy(atkDmg(id, big), e.kind || (big ? 'heavy' : 'light'));\n",
    "      { const list = [...hitList]; hitList = []; for (const t of list) { D = t; hurtDummy(atkDmg(id, big), e.kind || (big ? 'heavy' : 'light')); } D = list[0]; }\n")
# 화면 전체·sweep 등 「showDummy 면 모두」 → 상대 전부를 hitList 에
code = code.replace("s.at === 'screen' ? showDummy :", "s.at === 'screen' ? allT() :")
code = code.replace("s.at === 'center' ? showDummy :", "s.at === 'center' ? allT() :")
sub("if (showDummy && s.hit) { const n = s.hit.n || 5;", "if (allT() && s.hit) { const n = s.hit.n || 5;")
# 나머지 showDummy(가까운 상대 하나 기준) → D 가 있나
code = code.replace("showDummy", "(!!D)")
# 원거리 표시(능력치 배율용)
sub("    runFx([BAL().shotDmg ? { ...pj, hit: { ...(pj.hit || { kind: 'light' }), dmg: BAL().shotDmg } } : pj], { o: p, basic: true });",
    "    curSrc = 'ranged'; runFx([BAL().shotDmg ? { ...pj, hit: { ...(pj.hit || { kind: 'light' }), dmg: BAL().shotDmg } } : pj], { o: p, basic: true }); curSrc = null;")
# 남은 DOM
if 'document.' in code.replace("document.createElement('canvas')", ''): raise SystemExit('document 남음: ' + re.search(r'.{0,80}document\..{0,80}', code.replace("document.createElement('canvas')", '')).group(0))
if 'localStorage' in code or 'window.' in code.replace('window.AudioContext', ''):
    m = re.search(r'.{0,80}(localStorage|window\.).{0,80}', code); raise SystemExit('window 남음: ' + m.group(0))

head = '''// @ts-nocheck
// 통합 테스트룸 전투·생활 그대로 (tools/port_room3.py 가 game-src/action/testroom3/room.html 에서 떼어 와 만든 파일. 손으로 고치지 말고 변환기를 고친다).
// 바뀐 것: 샌드백(D) → env.targets()의 실제 적(가장 가까운 앞 상대 + 범위 검사에 든 상대 전부), 화면 고정값 → 보이는 화면(VX0~W)·게임 바닥, 키 → env.held, 소리 → env.sfx, 체력 → 게임.
// env: { A, IMG, CH, VFX, CHAIR, held:Set, K(y), sfx(type, extra), font(n), targets():[{body,x,y,z}], hurt(D, dmg, kind, face, hitstop, o), clamp(P), ground(x,y), mod?:{speed(),sp()}, heal?(v) }
export function createRoom3Core(env) {
  const VFX = env.VFX || {}, CHAIR = env.CHAIR || {};
  let VX0 = 0, W = 1280, H = 720, FLOOR0 = 440, FLOOR1 = 669;
  const down = n => env.held.has(n);
  let ctx = null;
  const K = y => env.K(y);
  const store = { get: (k, d) => d, set() {} };
  const sfx = (type, extra = {}) => env.sfx(type, { x: P.x, ...extra });
  const boomSnd = (strength = 2, x = 0) => env.sfx('boom', { strength, x });
  let runT = 0, curSrc = null;
  /** 표적 대리: 게임 적 몸 하나마다 테스트룸 샌드백 모양의 상태(mark·bindT·liftT·stunT…)를 붙여 둔다. D = 지금 가장 가까운 앞 상대 */
  const proxyMap = new Map();
  const proxyOf = t => { let p = proxyMap.get(t.body); if (!p) { p = { body: t.body, juggle: 0, bounced: false, stunT: 0, vx: 0, z: 0, vz: 0, ang: 0, va: 0, hits: 0, hitT: 0, flash: 0, stag: 0, hp: 400, mark: 0, atkT: 2.2, wind: 0, bindT: 0, bindC: '#7A3FB0', liftT: 0 }; proxyMap.set(t.body, p); } p.x = t.x; p.y = t.y; p.z = t.z + (p.liftT > 0 ? p.z : 0); return p; };
  let proxiesNow = [], hitList = [];
  const proxies = () => proxiesNow;
  /** 상대 전부를 맞을 목록에(화면 전체 기술) */
  const allT = () => { hitList = [...proxiesNow]; return hitList.length > 0; };
  let D = null;
  function updateProxies(dt) {
    const seen = new Set();
    proxiesNow = env.targets().map(t => { const p = proxyOf(t); seen.add(t.body); p.mark = Math.max(0, p.mark - dt); p.bindT = Math.max(0, p.bindT - dt); p.stunT = Math.max(0, p.stunT - dt); p.liftT = Math.max(0, (p.liftT || 0) - dt); p.stag = Math.max(0, p.stag - dt); p.hitT = Math.max(0, p.hitT - dt); if (p.hitT === 0) p.hits = 0; return p; });
    for (const b of [...proxyMap.keys()]) if (!seen.has(b)) proxyMap.delete(b);
    const front = proxiesNow.filter(p => Math.abs(p.y - P.y) < 120 && (p.x - P.x) * P.face > -40).sort((a, b) => Math.abs(a.x - P.x) - Math.abs(b.x - P.x));
    D = front[0] || proxiesNow.sort((a, b) => Math.abs(a.x - P.x) - Math.abs(b.x - P.x))[0] || null;
  }
'''
tail = '''
  // ── 게임 쪽 그리기 ──
  function frameView(v) { VX0 = v.x0; W = v.x0 + 1280; FLOOR0 = v.lane[0]; FLOOR1 = v.lane[1]; }
  /** 바닥 층 (사람보다 먼저): 어두워짐·표적·그을음·먼지·잔상·바닥 그림 이펙트 */
  function drawUnder(c) {
    ctx = c;
    if (dark) { ctx.fillStyle = `rgba(0,0,0,${Math.min(0.7, dark * 0.9)})`; ctx.fillRect(VX0, 0, 1280, H); }
    drawFxUnder();
    drawSheets(true);
    for (const it of items) { ctx.fillStyle = '#c94a4a'; ctx.fillRect(it.x - 6, it.y - 14, 12, 14); ctx.fillStyle = '#eee'; ctx.fillRect(it.x - 4, it.y - 18, 8, 4); drawVfxAt('item_sparkle', it.x + 6, it.y - 20, 2, P.t - it.t0); }
  }
  /** 캐릭터(의자 포함) */
  function drawBody(c) { ctx = c; drawPlayer(); }
  /** 중간 층(투사체·소환물·그림자 괴이) + 이펙트 층(1/3 크기 도트 층 + 그림 이펙트), 월드 좌표 */
  function drawFxLayer(c) {
    ctx = c; drawMid();
    const main = c;
    for (const g of [fxN, fxL]) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, fxNc.width, fxNc.height); g.setTransform(1 / FXS, 0, 0, 1 / FXS, -VX0 / FXS, 0); g.globalCompositeOperation = 'source-over'; }
    ctx = fxN; drawFx(false);
    ctx = fxL; fxL.globalCompositeOperation = 'lighter'; drawChargeAim(); drawHeat(); drawFx(true);
    ctx = main;
    ctx.drawImage(fxNc, VX0, 0, 1280, H);
    drawSheets();
    ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(fxLc, VX0, 0, 1280, H); ctx.globalCompositeOperation = 'source-over';
  }
  /** 화면 전체: 빈사 테두리·번쩍임·필살기 컷인 (화면 좌표) */
  function drawScreen(c) {
    ctx = c;
    drawDying();
    if (flash) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.5, flash * 3)})`; ctx.fillRect(0, 0, 1280, H); }
    const w0 = W; W = 1280; drawCut(); W = w0;
  }
  return {
    P, A, CH, onPress, onRelease, takeHit, update, frameView, drawUnder, drawBody, drawFxLayer, drawScreen, armored,
    get hitstop() { return hitstop; }, get shake() { return shake; }, get zoom() { return zoom; }, get D() { return D; },
    knock, hit, stun, die, sitAt, rise, seatAct, runScene, playLife, lifeIds, emote, act, toIdle, has, nOf,
  };
}
'''
out = head + code + tail
dst = ROOT / 'src/game/action/room3/core.ts'
dst.parent.mkdir(parents=True, exist_ok=True)
dst.write_text(out, encoding='utf-8')
print('ok', len(out.split('\n')), '줄')
