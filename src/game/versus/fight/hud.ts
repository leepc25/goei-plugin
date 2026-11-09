// 대전 HUD (경기 화면 위): 체력 막대·얼굴 칸·시간·판 표시·연타 수·가운데 큰 글자, 태그매치 대기 캐릭터.
// 모양은 11-08 사용자 확정 그대로 (예전 engine/modules.ts drawVersusBars·drawBench 에서 옮김). 읽는 값만 새 대전 몸(Fighter)으로 바꿨다
import { bigText, BIG_BLUE, BIG_FIRE, BIG_GOLD, BIG_INK, BIG_RED, type BigPal } from '../../action/ui/bigText';
import { vsVoice, type VoiceId } from '../voice';
import { dotText, HUD_DIM, HUD_INK } from '../../action/ui/pixelHud';
import { charFace, drawCharClip, hasCharClip } from '../../action/art/charPacks';
import { SCREEN_W } from '../../action/engine/contract';
import type { SfxId } from '../../action/audio';
import { view } from '../../action/engine/view';
import { versus, KO_SEC } from '../../action/engine/versus';
import { surv, waveOf } from '../../action/engine/survival';
import type { Fighter } from './fighter';

/** 태그매치 대기 인물 (11-08 사용자): 자기 편 뒤쪽 끝에 작게(원근) 서서 각자 동작. 판이 끝나면 이긴 편 환호·진 편 화내기 */
const BENCH_K = 0.72;
const BENCH_CLIPS = ['rest', 'limber', 'phone', 'coffee', 'smoke', 'snack', 'browse', 'call', 'pushup', 'talk'];
const benchT = new Map<string, { clip: string; since: number; until: number }>();
export function drawBench(c: CanvasRenderingContext2D, camX: number) {
  if (versus.mode !== 'team') return;
  const now = performance.now();
  const ended = versus.over ?? versus.ko;
  c.save();
  c.translate(-camX, 0);
  for (const side of [0, 1] as const) {
    const list = versus.team[side].slice(versus.cur[side] + 1);
    list.forEach((name, k) => {
      // 무대 양 끝에 겹치지 않게 나란히 (11-08 사용자), 싸우는 줄보다 뒤. 배경이 있으면 그 장면의 뒤 줄 높이·원근 (tools/build_vs_packs.py)
      // 배경 장면: tools/build_vs_packs.py fit_stage 가 필드 바닥·막힘 자료로 잡은 자리 (11-08 사용자: 배경 물건 무시하고 세우지 말 것)
      const sp = view.vsBg?.bench.spots[side]?.[k], L = view.vsLen, d = 220 + k * 200;
      const x = sp ? sp.x : side === 0 ? d : L - d, y = VS_LINE + (sp ? sp.dy : -150), bk = sp ? sp.k : BENCH_K;
      const dir: 1 | -1 = side === 0 ? 1 : -1;
      const key = `${side}|${name}`;
      let clip: string, since: number;
      if (ended) {
        // 판 끝: 이긴 편은 기뻐하기(35), 진 편은 화내기(32)
        const id = ended.side === side ? '35' : '32';
        clip = `line:${id}`; since = 0;
      } else {
        let st = benchT.get(key);
        if (!st || now > st.until) {
          const have = BENCH_CLIPS.filter((cl) => hasCharClip(name, cl));
          const pick = have.length ? have[Math.floor(Math.random() * have.length)] : 'idle';
          st = { clip: pick, since: now, until: now + 5000 + Math.random() * 4000 };
          benchT.set(key, st);
        }
        clip = st.clip; since = st.since;
      }
      // 원근: 대전 무대는 줄이 한 선이라 장면 원근이 거의 없다 → 뒤에 선 만큼 직접 작게 (발 기준)
      c.save(); c.translate(x, y); c.scale(bk, bk); c.translate(-x, -y);
      drawCharClip(c, name, x, y, dir, now, clip, since);
      c.restore();
    });
  }
  c.restore();
}

/** 대전 한 선의 발 높이(월드 y, 화면 720 중) */
const VS_LINE = 700;
/** 대전 체력 배율 */

/** 대전(투명 무대) HUD: 도트 HUD(pixelHud.ts, 10-25 PixelLab 틀) 칸 둘 — 왼쪽 1P, 오른쪽 상대(좌우 뒤집음). 초상화·체력(깎인 만큼 흰 잔상)·필살 게이지.
 *  칸 아래: 1:1 은 이긴 판 표시 두 칸, 팀전은 남은 사람 칸, 서바이벌은 쓰러뜨린 수. 가운데: ROUND n → FIGHT, K.O., 승리/패배 */
const vsSide = [{ trail: -1, last: -1, hurt: 0 }, { trail: -1, last: -1, hurt: 0 }];
let vsT = 0;
const vsBanner: { key: string; at: number; img: HTMLCanvasElement | null; out: { img: HTMLCanvasElement; at: number } | null } = { key: '', at: 0, img: null, out: null };
const vsCombo = { n: 0, at: 0 };
let vsClockSay = -1;
/** 알림 소리 (engineModules 가 audio 로 이어 둔다) */
let vsSay: ((id: SfxId) => void) | null = null;
export const setVsSay = (f: ((id: SfxId) => void) | null) => { vsSay = f; };
/** 아나운서 (투명 무대만) */
const vsCall = (id: VoiceId) => vsVoice(id);
const VS_GOLD = '#ffd35a';
/** 큰 알림 글자 (11-08 사용자 「격투게임처럼 화면 절반」): 똑바로 선 굵은 글자를 화면 폭의 약 55%로 (도트 한 칸 정수 px).
 *  U 는 예전 크기 힌트: 작은 글(부제 등)은 그대로 둔다 */
function bigFit(text: string, pal: BigPal, _U: number): HTMLCanvasElement {
  const one = bigText(text, pal, 1, { slant: false, bold: true });
  const u = Math.max(4, Math.min(18, Math.floor((1024 * 0.55) / one.width)));
  return bigText(text, pal, u, { slant: false, bold: true });
}
export function drawVersusBars(c: CanvasRenderingContext2D, me: Fighter | undefined, foes: Fighter[]) {
  const dt = 1 / 60;
  vsT += dt;
  // 오른쪽 칸: 1:1·팀전은 지금 상대, 서바이벌은 살아 있는 대장 → 주인공에게 가장 가까운 상대
  const live = foes.filter((b) => b.alive && b.hp > 0 && b.deadT < 0);
  const foe = versus.mode === 'survival'
    ? live.find((b) => b.boss) ?? (me ? live.sort((a, b) => Math.abs(a.x - me.x) - Math.abs(b.x - me.x))[0] : live[0])
    : foes[0];
  // 11-08 사용자: 화면이 가로로 늘어나도 체력바 묶음은 가운데 1280 폭 그대로
  const hudW = Math.min(c.canvas.width, SCREEN_W), hudX = Math.round((c.canvas.width - hudW) / 2);
  const k = 1.25, W = hudW / k, H = c.canvas.height / k;
  // 칸 자리: 그림판이 16:9보다 높아도 예전처럼 16:9 윗선 근처 (사용자 11-08 「꼭대기면 눈에 안 들어온다」)
  // 11-08 사용자: 캐릭터를 두 배로 키워서 막대를 더 위로 (머리와 겹치지 않게). 그림판 맨 위에서 남는 높이의 1/4 지점
  const top = 14 + Math.max(0, c.canvas.height - 720) / k * 0.25;
  c.save();
  c.setTransform(k, 0, 0, k, hudX, 0);
  c.imageSmoothingEnabled = false;
  // 11-08 사용자 「격투게임처럼 화면 구성」: 위쪽 = 바깥 얼굴 · 안쪽으로 길게 뻗은 체력 막대 · 가운데 시간, 막대 아래 이름·판 표시,
  // 얼굴 아래 대기 캐릭터 이름(태그매치), 아래 구석 = 필살 게이지·쌓인 수. 상자·띠 없이 도트 틀만 (본문을 덮지 않는다)
  // 11-08 사용자 「킹오파 비율로」: 얼굴 칸 폭의 약 1/9, 막대 높이 약 1/36, 시간 숫자는 막대 두 배 넘게
  const PS = 136, face0 = 12, timerHalf = 58;
  const barX0 = face0 + PS + 4, barX1 = W / 2 - timerHalf, barW = Math.round(barX1 - barX0), barH = 28;
  const barY = top + 8;
  const bar = (x: number, y: number, w: number, h: number, mirror: boolean, parts: { r: number; col: (row: number, h: number) => string }[], ticks = 0) => {
    x = Math.round(x); y = Math.round(y);
    c.fillStyle = '#07090b'; c.fillRect(x - 3, y - 3, w + 6, h + 6);          // 검은 테
    c.fillStyle = '#8a9098'; c.fillRect(x - 2, y - 2, w + 4, 1);              // 윗 테 밝은 줄
    c.fillStyle = '#3c4048'; c.fillRect(x - 2, y + h + 1, w + 4, 1);          // 아래 테 어두운 줄
    // 빈 칸: 줄어든 만큼 늘 보인다 (11-08 사용자). 어두운 붉은 속 + 위 그림자 줄
    c.fillStyle = '#3a1518'; c.fillRect(x, y, w, h);
    c.fillStyle = '#22090b'; c.fillRect(x, y, w, Math.max(2, Math.round(h / 5)));
    for (const pt of parts) {
      const fw = Math.round(w * Math.max(0, Math.min(1, pt.r)));
      if (fw <= 0) continue;
      const fx = mirror ? x : x + w - fw;   // 1P 막대는 가운데(오른쪽)에서 바깥으로 줄어든다, 2P 는 거울
      for (let row = 0; row < h; row++) { c.fillStyle = pt.col(row, h); c.fillRect(fx, y + row, fw, 1); }
    }
    c.fillStyle = 'rgba(7,9,11,.55)';
    // 체력 막대는 눈금 없이 매끄럽게 (11-08 사용자 「구간이 안 보여야」), 게이지만 칸
    for (let t = 1; t < ticks; t++) c.fillRect(x + Math.round((w * t) / ticks), y + 2, 1, h - 4);   // 눈금
  };
  const one = (i: 0 | 1, b: Fighter | undefined) => {
    if (!b) return;
    const f = b;
    const st = vsSide[i];
    // 새 판(체력이 다시 차면)에는 잔상도 새로
    if (st.last >= 0 && b.hp > st.last + 1) st.trail = -1;
    if (st.last >= 0 && b.hp < st.last) st.hurt = 0.35;
    if (st.trail < 0 || st.trail < b.hp) st.trail = b.hp;
    else st.trail = Math.max(b.hp, st.trail - b.hpMax * dt * 0.6);
    st.last = b.hp;
    st.hurt = Math.max(0, st.hurt - dt);
    const name = f.name;
    const mir = i === 1;
    // 얼굴: 바깥 구석, 2P 는 거울 자리에서 안쪽을 본다
    const px = mir ? W - face0 - PS : face0, py = top;
    // 얼굴 칸 (11-08 사용자 「기존 것 말고 격투게임처럼」): 검은 테 · 흰 줄 · 1P 파랑/2P 빨강 바탕에 얼굴을 두 배(정수배)로,
    // 얼굴은 가운데(상대)를 본다. 바탕은 두 단(위 밝게) — 그라데이션 아님
    const face = f.art ? charFace(f.art.key, 64, mir) : null;
    c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(px + 3, py + 3, PS, PS);               // 오른쪽 아래 그림자
    c.fillStyle = '#07090b'; c.fillRect(px, py, PS, PS);
    c.fillStyle = '#f2efe6'; c.fillRect(px + 2, py + 2, PS - 4, PS - 4);
    const ix = px + 4, iy = py + 4, iw = PS - 8;
    c.fillStyle = mir ? '#c8362a' : '#2f5fd0'; c.fillRect(ix, iy, iw, iw);
    c.fillStyle = mir ? '#e4583e' : '#4f86f0'; c.fillRect(ix, iy, iw, Math.round(iw * 0.4));
    if (face) c.drawImage(face, ix, iy, iw, iw);
    if (st.hurt > 0) { c.fillStyle = `rgba(255,40,40,${Math.min(0.6, st.hurt * 1.6)})`; c.fillRect(ix, iy, iw, iw); }
    // 체력 막대: 깎인 만큼 흰 띠가 늦게 따라온다, 4분의 1 아래면 깜빡
    const bx = mir ? W - barX0 - barW : barX0;
    const r = Math.max(0, b.hp) / b.hpMax, low = r < 0.25, blink = low && Math.sin(vsT * 10) > 0, hue = r > 0.5 ? 100 : r > 0.25 ? 48 : 4;
    bar(bx, barY, barW, barH, mir, [
      { r: st.trail / b.hpMax, col: () => '#d8d2c4' },
      { r, col: (row, h) => (row < 2 ? `hsl(${hue},75%,${blink ? 82 : 70}%)` : row >= h - 3 ? `hsl(${hue},70%,${blink ? 46 : 30}%)` : `hsl(${hue},68%,${blink ? 64 : 47}%)`) },
    ]);
    // 이름: 막대 아래 바깥쪽, 판 표시: 막대 아래 안쪽
    // 필살 게이지: 체력 막대 바로 밑에 붙여 (11-08 사용자). 바깥쪽에서 안쪽으로 찬다, 다 차면 금색으로 빛난다
    const g = Math.max(0, Math.min(100, f.gauge ?? 0)), full = g >= 100;
    const gh = 8, gw = Math.round(barW * 0.7), gy = barY + barH + 3;
    const gx = mir ? bx + barW - gw : bx;
    const pulse = full ? 0.5 + 0.5 * Math.sin(vsT * 7) : 0;
    bar(gx, gy, gw, gh, !mir, [{ r: g / 100, col: (row) => (full ? (row < 2 ? '#fff6d0' : `rgb(255,${205 + 30 * pulse},${90 + 60 * pulse})`) : row < 2 ? '#e8f4ff' : row >= gh - 2 ? '#4f7fa0' : '#9fc6e0') }], 5);
    const below = gy + gh + 6;
    const nt = dotText(name, HUD_INK, 3);
    c.drawImage(nt, mir ? Math.round(bx + barW - nt.width) : Math.round(bx), below);
    const marks = versus.mode === 'duel' ? Array.from({ length: 2 }, (_, n) => n < versus.wins[i])
      : versus.mode === 'team' ? versus.team[i].map((_, n) => n >= versus.cur[i]) : [];
    const sz = 14, gap = 6;
    marks.forEach((on, n) => {
      const mx = mir ? bx + n * (sz + gap) : bx + barW - sz - n * (sz + gap), my = below + 4;
      c.fillStyle = '#07090b'; c.fillRect(mx - 2, my - 2, sz + 4, sz + 4);
      c.fillStyle = on ? (versus.mode === 'duel' ? '#ffd35a' : '#e6e4dc') : '#2a3036';
      c.fillRect(mx, my, sz, sz);
      if (on) { c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(mx, my, sz, 2); }
    });
    // 얼굴 아래: 태그매치 대기 캐릭터 이름 (다음 차례부터)
    if (versus.mode === 'team') {
      versus.team[i].slice(versus.cur[i] + 1).forEach((n, j) => {
        const t = dotText(n, HUD_DIM, 2);
        c.drawImage(t, mir ? Math.round(px + PS - t.width) : px, py + PS + 4 + j * (t.height + 2));
      });
    }
    if (versus.mode === 'survival' && i === 0) {
      const t1 = dotText(`WAVE ${Math.max(1, surv.wave)}`, HUD_INK, 2), t2 = dotText(`${versus.kills} KO`, VS_GOLD, 2);
      const sx = Math.round(W / 2 - (t1.width + 10 + t2.width) / 2);
      c.drawImage(t1, sx, barY - 2); c.drawImage(t2, sx + t1.width + 10, barY - 2);
    }
  };
  // K.O. 순간에는 UI 를 숨긴다 (11-08 사용자). 큰 글자만
  const hud = !versus.ko;
  if (hud) { one(0, me); one(1, foe); }
  if (versus.mode === 'survival' && !foe) vsSide[1].last = -1;   // 다음에 나오는 상대 칸은 새로
  // 가운데 시간: 두 막대 사이, 큰 도트 숫자 (10초 아래면 빨갛게 깜빡)
  if (hud && versus.mode !== 'survival' && versus.mode !== 'practice') {
    const sec = Math.ceil(versus.clock), low = sec <= 10 && !versus.ko && !versus.over;
    const t = bigText(String(Math.max(0, sec)).padStart(2, '0'), low ? BIG_RED : BIG_FIRE, 6, { slant: false, bold: true, edge: 1 });
    if (!low || Math.floor(vsT * 4) % 2 === 0) c.drawImage(t, Math.round(W / 2 - t.width / 2), Math.round(barY + barH / 2 - t.height / 2) + 2);
    if (low && sec !== vsClockSay && sec > 0) { vsClockSay = sec; vsSay?.('timerWarn'); }
  }
  // 기술 연습: 체력 막대 아래 가운데에 키 안내
  if (hud && versus.mode === 'practice') {
    const t = dotText('R 처음 자리 · Esc 나가기', HUD_INK, 2);
    c.drawImage(t, Math.round(W / 2 - t.width / 2), Math.round(barY + barH + 34));
  }
  // 연타 수 (1P): 두 번째 맞힘부터 왼쪽에 「N HIT」, 늘 때마다 살짝 튄다
  const combo = me?.combo ?? 0;
  if (combo !== vsCombo.n) { if (combo > vsCombo.n) vsCombo.at = vsT; vsCombo.n = combo; }
  if (hud && combo >= 2) {
    const jump = vsT - vsCombo.at < 0.06 ? 6 : 0;
    const num = dotText(String(combo), VS_GOLD, 5), hit = dotText('HIT', HUD_INK, 2);
    const nx = 22, ny = Math.round(top + (H - top) * 0.3) - jump;
    c.drawImage(num, nx, ny);
    c.drawImage(hit, nx + num.width + 4, ny + num.height - hit.height - 4);
  }
  // 가운데 알림 (11-08 사용자): 띠·번쩍임 없이 큰 도트 글자만. 위아래로 펼쳐지며 나타나고, 접히며 옆으로 흘러 사라진다
  let key = '', text = '', sub = '', pal: BigPal = BIG_INK, U = 5, say: SfxId | null = null, call: VoiceId | null = null;
  if (versus.over && versus.mode === 'survival') { key = 'sover'; text = 'GAME OVER'; sub = `WAVE ${surv.wave} · ${versus.kills} KO`; pal = BIG_RED; say = 'down'; call = 'gameover'; }
  else if (versus.over) { const win = versus.over.side === 0; key = `over${win}`; text = win ? 'YOU WIN' : 'YOU LOSE'; pal = win ? BIG_GOLD : BIG_RED; U = 6; say = win ? 'levelUp' : 'down'; call = win ? 'youwin' : 'youlose'; }
  else if (versus.ko && versus.ko.t < KO_SEC - 1.4) {
    // K.O. 다음 WINNER (11-08 사용자): 이긴 쪽은 이때 승리 동작 (game.ts)
    key = `winner${versus.ko.side}`; text = 'WINNER'; sub = versus.ko.kind === 'perfect' ? 'PERFECT' : ''; pal = BIG_FIRE; say = 'levelUp'; call = 'winner';
  }
  else if (versus.ko) { const k2 = versus.ko.kind ?? 'ko'; key = `ko${k2}`; text = k2 === 'time' ? 'TIME OVER' : 'K.O.'; pal = BIG_RED; say = 'superHit'; call = k2 === 'time' ? 'time' : 'ko'; }
  else if (versus.intro > 0) {
    // ROUND → READY → GO! (INTRO_SEC 2.4)
    if (versus.intro > 1.4) { key = `r${versus.round}`; text = versus.mode === 'survival' ? 'SURVIVAL' : versus.mode === 'practice' ? 'TRAINING' : versus.mode === 'duel' && versus.round >= 3 ? 'FINAL ROUND' : `ROUND ${versus.round}`; pal = BIG_BLUE; U = 6; say = 'ding';
      call = versus.mode === 'survival' || versus.mode === 'practice' ? null : text === 'FINAL ROUND' ? 'final' : versus.round <= 3 ? (`round${versus.round}` as VoiceId) : 'final'; }
    else if (versus.intro > 0.6) { key = `ready${versus.round}`; text = 'READY'; pal = BIG_FIRE; U = 6; }
    else { key = `go${versus.round}`; text = 'GO!'; pal = BIG_FIRE; U = 9; say = 'superStart'; call = 'fight'; }
  } else if (versus.mode === 'survival' && surv.bannerT > 0) {
    const boss = waveOf(surv.wave).boss;
    key = `w${surv.wave}`; text = `WAVE ${surv.wave}`; sub = boss ? '대장 등장' : ''; pal = boss ? BIG_RED : BIG_BLUE; say = boss ? 'bossRoar' : 'enemySpawn';
  }
  const cy = Math.round(top + (H - top) * 0.34);
  // 판 사이 넘어가기 동안은 앞 판 글자(WINNER 등)를 남기지 않는다 (11-08 사용자 「지워져야지」)
  if (versus.trans) { vsBanner.key = ''; vsBanner.img = null; vsBanner.out = null; c.restore(); return; }
  if (key !== vsBanner.key) {
    // 앞 글자는 접히며 흘러 나간다
    // 앞 글자가 다 접혀 나간 뒤에 새 글자를 편다 (겹치지 않게)
    const gap = vsBanner.img ? 0.2 : 0;
    if (vsBanner.img) vsBanner.out = { img: vsBanner.img, at: vsT };
    vsBanner.key = key; vsBanner.at = vsT + gap; vsBanner.img = key ? bigFit(text, pal, U) : null;
    if (say) vsSay?.(say);
    if (call) vsCall(call);
  }
  const OPEN = 0.16, FOLD = 0.2;
  const draw = (img: HTMLCanvasElement, sy: number, dx: number, dy = 0) => {
    const h = Math.max(1, Math.round(img.height * sy));
    c.drawImage(img, Math.round(W / 2 - img.width / 2) + dx, cy - Math.round(h / 2) + dy, img.width, h);
  };
  if (vsBanner.out) {
    const d = (vsT - vsBanner.out.at) / FOLD;
    if (d >= 1) vsBanner.out = null;
    else draw(vsBanner.out.img, 1 - d, Math.round(d * d * W * 0.45));
  }
  if (vsBanner.img && vsT >= vsBanner.at) {
    const e = vsT - vsBanner.at;
    // 펼치기: 가운데 줄에서 위아래로 열리며 살짝 넘쳤다가 제 크기
    const sy = e < OPEN ? (e / OPEN) * 1.18 : e < OPEN + 0.08 ? 1.18 - ((e - OPEN) / 0.08) * 0.18 : 1;
    let dx = 0, dy = 0;
    if (e < 0.35 && key.startsWith('ko')) { dx = Math.round((Math.random() - 0.5) * 10); dy = Math.round((Math.random() - 0.5) * 8); }
    draw(vsBanner.img, sy, dx, dy);
    if (sub && e > 0.25) {
      const st = dotText(sub, HUD_INK, 2);
      c.drawImage(st, Math.round(W / 2 - st.width / 2), cy + Math.round(vsBanner.img.height / 2) + 4);
    }
  }
  c.restore();
}
