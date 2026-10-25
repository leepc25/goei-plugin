# 에일린 테스트룸(agent-motion-set: game-src/action/eileen/testroom/room.html)의 전투 스크립트를 게임 모듈로 옮긴다 (2026-10-25).
# 사용자 지시: 테스트룸 에일린이 완성본, 전투는 그대로 가져올 것. 그래서 스크립트를 손으로 다시 쓰지 않고 그대로 떼어 와서
# 샌드백(D)·화면 고정값(W·H·FLOOR)·키 처리·자체 HUD만 게임 쪽(env)으로 바꾼다. 결과: src/game/action/eileen/core.ts
# 사용: git show origin/claude/agent-motion-set:game-src/action/eileen/testroom/room.html > /tmp/room.html
#       python3 tools/port_eileen_room.py /tmp/room.html
import re, sys
from pathlib import Path
src = Path(sys.argv[1]).read_text(encoding='utf-8').split('\n')
L = lambda a, b: src[a - 1:b]   # 1부터, 끝 포함
def find(prefix, start=1):
    for i in range(start - 1, len(src)):
        if src[i].startswith(prefix): return i + 1
    raise SystemExit('not found: ' + prefix)
def block(prefix):
    """prefix로 시작하는 줄부터 다음 맨 앞 '}' 줄까지"""
    a = find(prefix); b = a
    while not src[b - 1].startswith('}'): b += 1
    return a, b

body = []
take = lambda a, b: body.extend(L(a, b))
# 공통 도우미 (vfxDur ~ groundBase), 이펙트 층, GLOW
take(find('// PixelLab 이펙트 그림 재생'), find('const groundBase'))
take(find('// 이펙트는 1/3 크기 층'), find('const GLOW'))
# 장 목록 도우미 ~ 상태 P
take(find('// ── 장 목록 도우미'), find('const D = ') - 1)
take(find('let zoom = 0'), find('function spReady'))
take(find('let fx = [];'), find('const items = '))
take(find('const KICK = '), find('const KICK = '))
# play ~ 효과 (muzzleFlash까지)
take(find('function play('), find('// 맞았는지: 샌드백') - 1)
# fireEv ~ 흐름 ~ 공격 ~ 이동 ~ 피격 ~ onPress/onRelease
a = find('function fireEv('); b = find('// ── 매 장 ──') - 1
take(a, b)
# updateFx
fa, fb = block('function updateFx(')
take(fa, fb)
# update (updateDummy 빼고)
ua, ub = block('function update(')
take(ua, ub)
# 그리기: silhouette ~ drawPlayer, star, drawVfxAt ~ drawChargeAim, drawDying
take(find('// ── 그리기 ──'), find('function drawBg(') - 1)
sa, sb = block('function shadow('); take(sa, sb)
sa, sb = block('function drawSprite('); take(sa, sb)
sa, sb = block('function drawPlayer('); take(sa, sb)
take(find('function star('), find('function star('))
take(find('function drawVfxAt('), find('function drawHud(') - 1)
sa, sb = block('function drawDying('); take(sa, sb)
code = '\n'.join(body)

def sub(old, new, count=1):
    global code
    n = code.count(old)
    if n < 1 or (count and n != count): raise SystemExit(f'{n}x: {old[:80]}')
    code = code.replace(old, new)

# ── 샌드백(D) → 실제 적(env) ──
sub("""    if (inReach(p.x, big ? 100 : 70, P.y - p.y)) {   // 때리는 높이 = 바닥에서 타점까지""",
    """    const tg = inReach(p.x, big ? 100 : 70, P.y - p.y);
    if (tg.length) {   // 때리는 높이 = 바닥에서 타점까지""")
sub("""      hurtDummy(big ? 34 : 12, e.kind || (e.ev === 'hitL' ? 'launch' : big ? 'heavy' : 'light'), p.x, p.y);""",
    """      for (const t of tg) hurtDummy(t, big ? 34 : 12, e.kind || (e.ev === 'hitL' ? 'launch' : big ? 'heavy' : 'light'));
      const D = tg[0];""")
sub("""    const hitD = showDummy && Math.abs(D.y - P.y) < 60 && (D.x - P.x) * P.face > 0;
    const endX = hitD ? D.x - P.face * 14 : (P.face > 0 ? W + 20 : -20);""",
    """    const D = frontTarget(60), hitD = !!D;
    const endX = hitD ? D.x - P.face * 14 : (P.face > 0 ? W + 20 : VX0 - 20);""")
sub("""    if (hitD) { sfx('hit', { strength: big ? 2 : 1, kind: 'bullet' }); hurtDummy(big ? 40 : e.ev === 'shotS' ? 9 : 7, big ? 'heavy' : 'light'); sparks(endX, p.y, big ? 16 : 5, big); if (big) hitstop = 0.08; }""",
    """    if (hitD) { sfx('hit', { strength: big ? 2 : 1, kind: 'bullet' }); hurtDummy(D, big ? 40 : e.ev === 'shotS' ? 9 : 7, big ? 'heavy' : 'light'); sparks(endX, p.y, big ? 16 : 5, big); if (big) hitstop = 0.08; }""")
sub("""    if (showDummy && Math.abs(D.y - P.y) < 30 + W_ && (D.x - P.x) * P.face > 0) { hitstop = [0, 0.08, 0.15, 0.24][lv]; hurtDummy([0, 30, 60, 110][lv], lv >= 2 ? 'launch' : 'heavy'); sparks(D.x, p.y, 10 + lv * 10, true, col); ring(D.x, p.y, 50 + lv * 30, 0.3, col, 4); }""",
    """    for (const D of targets().filter(D => Math.abs(D.y - P.y) < 30 + W_ && (D.x - P.x) * P.face > 0)) { hitstop = [0, 0.08, 0.15, 0.24][lv]; hurtDummy(D, [0, 30, 60, 110][lv], lv >= 2 ? 'launch' : 'heavy'); sparks(D.x, p.y, 10 + lv * 10, true, col); ring(D.x, p.y, 50 + lv * 30, 0.3, col, 4); }""")
sub("""  else if (e.ev === 'mark') { if (showDummy) { D.mark = 6; ring(D.x, D.y - 230, 40, 0.3, '#ff5a4a', 3); } }""",
    """  else if (e.ev === 'mark') { for (const D of targets().filter(D => (D.x - P.x) * P.face > 0 && Math.abs(D.y - P.y) < 120)) { marks.set(D.body, 6); ring(D.x, D.y - 230, 40, 0.3, '#ff5a4a', 3); } }""")
sub("""    const ddx = (D.x - p.x) * dir;
    if (showDummy && ddx > 30 && ddx < dist + 40 && Math.abs(D.y - P.y) < 70) {
      const bulletY = p.y + ddx * Math.tan(ang), dk = K(D.y);
      if (bulletY > D.y - D.z - 220 * dk && bulletY < D.y - D.z + 10) {
        later(ddx / 3200, () => { hurtDummy(7, 'light'); D.vx += dir * 140; D.stag = Math.max(D.stag, 0.45); D.flash = 0.06;""",
    """    for (const D of targets()) {
    const ddx = (D.x - p.x) * dir;
    if (ddx > 30 && ddx < dist + 40 && Math.abs(D.y - P.y) < 70) {
      const bulletY = p.y + ddx * Math.tan(ang), dk = K(D.y);
      if (bulletY > D.y - D.z - 220 * dk && bulletY < D.y - D.z + 10) {
        later(ddx / 3200, () => { hurtDummy(D, 7, 'light', { push: 5 });""")
# 제압사격 블록 닫기: 원래 '    }\n  }\n  else if (e.ev === 'rocket')' 앞에 for 닫기
sub("""      }
    }
  }
  else if (e.ev === 'rocket') {""", """      }
    }
    }
  }
  else if (e.ev === 'rocket') {""")
sub("""    if (!P.slideHit) { const p = framePt(id, f, a.reach[f], a.h * 0.8); if (showDummy && Math.abs(D.y - P.y) < 64 && Math.abs(D.x - p.x) < 70 * K(P.y)) {""",
    """    if (!P.slideHit) { const p = framePt(id, f, a.reach[f], a.h * 0.8); if (targets().some(D => Math.abs(D.y - P.y) < 64 && Math.abs(D.x - p.x) < 70 * K(P.y))) {""")
# explode
sub("""dust(x, gy, 10, 2); if (showDummy && Math.abs(D.x - x) < 200 && Math.abs(D.y - gy) < 70) hurtDummy(dmg, 'launch'); return; }""",
    """dust(x, gy, 10, 2); for (const D of targets()) if (Math.abs(D.x - x) < 200 && Math.abs(D.y - gy) < 70) hurtDummy(D, dmg, 'launch'); return; }""")
sub("""  if (showDummy && Math.abs(D.x - x) < 200 && Math.abs(D.y - gy) < 70) hurtDummy(140, 'launch');""",
    """  for (const D of targets()) if (Math.abs(D.x - x) < 200 && Math.abs(D.y - gy) < 70) hurtDummy(D, dmg, 'launch');""")
# 필살기 표적 자리: 지금 보이는 화면 + 적 자리
sub("""    for (let k = 0; k < 12; k++) spots.push({ x: 60 + Math.random() * (W - 120), y: FLOOR0 + 30 + Math.random() * (FLOOR1 - FLOOR0 - 30) });
    if (showDummy) spots.splice(Math.random() * spots.length | 0, 0, { x: D.x, y: D.y });""",
    """    for (let k = 0; k < 12; k++) spots.push({ x: VX0 + 60 + Math.random() * (W - VX0 - 120), y: FLOOR0 + 30 + Math.random() * (FLOOR1 - FLOOR0 - 30) });
    for (const D of targets()) if (D.x > VX0 && D.x < W) spots.splice(Math.random() * spots.length | 0, 0, { x: D.x, y: D.y });""")
# 로켓
sub("""      const hitD = showDummy && Math.abs(D.y - e.gy) < 60 && (D.x - e.x) * e.dir <= 0 && (D.x - e.x0) * e.dir > 0;
      if (hitD || e.x < -40 || e.x > W + 40) { e.t = 0; explode(hitD ? D.x : Math.max(20, Math.min(W - 20, e.x)), e.y, e.gy, hitD); }""",
    """      const D = targets().find(D => Math.abs(D.y - e.gy) < 60 && (D.x - e.x) * e.dir <= 0 && (D.x - e.x0) * e.dir > 0), hitD = !!D;
      if (hitD || e.x < VX0 - 40 || e.x > W + 40) { e.t = 0; explode(hitD ? D.x : Math.max(VX0 + 20, Math.min(W - 20, e.x)), e.y, e.gy, hitD); }""")
# update: 샌드백 갱신 빼고, 화면 끝 고정 대신 게임 바닥
sub("  updateDummy(dt);\n", "")
sub("  P.x = Math.max(70, Math.min(W - 70, P.x)); P.y = Math.max(FLOOR0 + 20, Math.min(FLOOR1, P.y));",
    "  env.clamp(P);")
# 체력은 게임이 관리한다 (테스트룸의 맞을 때 깎기·회복은 그림·소리만)
sub("P.hp = Math.max(1, P.hp - 4); ", "", 0)
sub(" P.hp = Math.max(1, P.hp - 8);", "")
sub(" P.hp = Math.max(1, P.hp - 18);", "")
# 화면 끝(왼쪽 0) → 보이는 화면 왼쪽
sub("const x2 = e.dir > 0 ? W : 0,", "const x2 = e.dir > 0 ? W : VX0,", 0)
sub("const p = 1 - k, x = e.dir > 0 ? e.x + p * (W - e.x) : e.x - p * e.x;", "const p = 1 - k, x = e.dir > 0 ? e.x + p * (W - e.x) : e.x - p * (e.x - VX0);")
sub("ctx.fillRect(Math.min(e.x, x), 0, Math.abs(x - e.x), H);", "ctx.fillRect(Math.min(e.x, x), 0, Math.abs(x - e.x), H);")
sub("ctx.lineTo(P.face > 0 ? W : 0, p.y);", "ctx.lineTo(P.face > 0 ? W : VX0, p.y);")
sub("const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.55, W / 2, H / 2, H * 0.95);", "const g = ctx.createRadialGradient(VX0 + 640, H / 2, H * 0.55, VX0 + 640, H / 2, H * 0.95);")
sub("  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);\n}", "  ctx.fillStyle = g; ctx.fillRect(VX0, 0, W - VX0, H);\n}")
# 올라설 수 있는 물건(데스크 등): 땅 높이 = env.ground(x, y) (사용자 2026-10-25: 점프로 넘고 올라타기)
sub("      if (P.z <= 0 && P.vz < 0) { land(); break; }", "      { const gz = env.ground(P.x, P.y); if (P.z <= gz && P.vz < 0) { P.z = gz; land(); break; } }")
sub("  sfx('land'); P.z = 0; P.vz = 0;", "  sfx('land'); P.z = env.ground(P.x, P.y); P.vz = 0;")
sub("  P.mode = 'air'; P.z = 0; P.vz = 0; P.jumps = 1;", "  P.mode = 'air'; P.vz = 0; P.jumps = 1;")
sub("  env.clamp(P);", """  // 물건 위에서 걸어 나가면 떨어진다
  if (P.mode === 'ground' || P.mode === 'chain') { const gz = env.ground(P.x, P.y); if (P.z > gz + 2) { P.mode = 'air'; P.vz = 0; P.jumps = 1; P.airAtk = false; P.takeoff = 0; P.spin = 0; P.airVX = 230; } else if (P.z >= gz - 10) P.z = gz; }
  env.clamp(P);""")
sub("if (!vfx('land_dust', P.x, P.y, 2.2)) dust(P.x, P.y, 5);", "if (!vfx('land_dust', P.x, P.y - P.z, 2.2)) dust(P.x, P.y - P.z, 5);")
sub("  shadow(P.x + fx0, P.y, P.z + lift * kk,", "  const gz0 = env.ground(P.x, P.y);   // 물건 위면 그림자도 그 윗면에\n  shadow(P.x + fx0, P.y - gz0, P.z - gz0 + lift * kk,")
# 디버그 표시 줄 없애기
sub("  if (showNo) { ctx.fillStyle = '#fff'; ctx.font = '14px monospace'; ctx.fillText(`${id} · ${f + 1}/${a.n} · ${kk.toFixed(2)}배`, P.x - 60, P.y + 26); }\n", "")
if 'D.' in re.sub(r"const D = (tg\[0\]|frontTarget\(60\)|targets\(\)[^\n]*)", '', code):
    for m in re.finditer(r'.{0,60}\bD\.[a-z]+.{0,40}', code):
        pass

head = '''// @ts-nocheck
// 에일린 테스트룸 전투 그대로 (tools/port_eileen_room.py가 room.html에서 떼어 와 만든 파일. 손으로 고치지 말고 변환기를 고친다).
// 바뀐 것: 샌드백(D) → env.targets()의 실제 적, 화면 고정값 → 지금 보이는 화면(VX0~W)·게임 바닥, 키 → env.held, 소리 → env.sfx, 체력 → 게임.
export function createEileenCore(env) {
  const A = env.A, IMG = env.IMG, VFX = env.VFX;
  let VX0 = 0, W = 1280, H = 720, FLOOR0 = 440, FLOOR1 = 669;
  const down = n => env.held.has(n);
  let ctx = null;
  const K = y => env.K(y);
  const store = { get: (k, d) => d, set() {} };
  const sfx = (type, extra = {}) => env.sfx(type, { x: P.x, ...extra });
  const marks = new Map();
  const targets = () => env.targets();
  /** 앞쪽 같은 줄에서 가장 가까운 적 */
  const frontTarget = (dy) => targets().filter(D => Math.abs(D.y - P.y) < dy && (D.x - P.x) * P.face > 0).sort((p, q) => Math.abs(p.x - P.x) - Math.abs(q.x - P.x))[0];
  /** 근접 판정: 같은 줄 앞쪽 사정거리 안의 적들 */
  function inReach(hx, pad = 60, hh = 100) {
    pad *= K(P.y);
    return targets().filter(D => { const dk = K(D.y), hOk = hh > D.z - 110 * dk && hh < D.z + 240 * dk; return Math.abs(D.y - P.y) < 64 && (D.x - P.x) * P.face > -20 && Math.abs(D.x - hx) < pad && hOk; });
  }
  /** 테스트룸 hurtDummy: 피해 숫자·게이지는 그대로, 맞는 반응은 게임 적에게 맡긴다 */
  function hurtDummy(D, dmg, kind, o = {}) {
    if ((marks.get(D.body) || 0) > 0) dmg = Math.round(dmg * 1.5);
    if (!(P.clip && (P.clip.id === '25' || P.clip.id === '25_1'))) gainSp(dmg * 0.45);
    const big = kind !== 'light';
    num(D.x + (Math.random() - 0.5) * 30, D.y - 200 - D.z, dmg, big);
    env.hurt(D, dmg, kind, P.face, hitstop, o);
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
  /** 캐릭터 */
  function drawBody(c) { ctx = c; drawPlayer(); }
  /** 이펙트 층 (1/3 크기 도트 층 + 그림 이펙트), 월드 좌표 */
  function drawFxLayer(c) {
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
    const v0 = VX0; VX0 = 0;
    drawDying();
    VX0 = v0;
    if (flash) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.5, flash * 3)})`; ctx.fillRect(0, 0, 1280, H); }
    if (cut) {
      const k = Math.min(1, (1.1 - cut) * 6), y = H / 2 - 80, Wd = 1280;
      ctx.fillStyle = 'rgba(10,10,12,.9)'; ctx.fillRect(0, y, Wd * k, 160);
      ctx.fillStyle = '#cfc7a6'; ctx.fillRect(0, y, Wd * k, 4); ctx.fillRect(0, y + 156, Wd * k, 4);
      ctx.font = env.font(77); ctx.fillText('증명해.', Wd - 560 * k, y + 100);
      ctx.font = env.font(22); ctx.fillStyle = '#aaa59a'; ctx.fillText('「규칙은 읽었어?」', Wd - 540 * k, y + 140);
    }
  }
  return {
    P, A, onPress, onRelease, takeHit, update, frameView, drawUnder, drawBody, drawFxLayer, drawScreen, armored,
    get hitstop() { return hitstop; }, get shake() { return shake; }, get zoom() { return zoom; },
    tickMarks(dt) { for (const [b, t] of marks) { if (t - dt <= 0) marks.delete(b); else marks.set(b, t - dt); } },
    knock, hit, stun,
  };
}
'''
out = head + code + tail
Path('src/game/action/eileen/core.ts').write_text(out, encoding='utf-8')
print('ok', len(out))
