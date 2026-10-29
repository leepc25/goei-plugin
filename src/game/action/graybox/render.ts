// 회색 상자 렌더러: 상자·글자·선만. 그림 없음. 크기 비교(128·96·80)는 요원 상자 높이로 보인다.
import { TYPE_COLOR, TYPE_LABEL, depthLabel } from './data';
import { LANE_MIN, type Floor } from './gen';
import { elevatorOptions, agentDef, wallAhead, H, W, type Run, type Ent } from './sim';
import { RULE_BY_ID, UPGRADES } from './data';

export class GrayRenderer {
  readonly ctx: CanvasRenderingContext2D;
  constructor(readonly canvas: HTMLCanvasElement) {
    canvas.width = W;
    canvas.height = H;
    this.ctx = canvas.getContext('2d')!;
  }
  private box(x: number, y: number, w: number, h: number, fill: string, stroke?: string) {
    const c = this.ctx;
    c.fillStyle = fill;
    c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    if (stroke) (c.strokeStyle = stroke), (c.lineWidth = 2), c.strokeRect(Math.round(x) + 1, Math.round(y) + 1, Math.round(w) - 2, Math.round(h) - 2);
  }
  private text(s: string, x: number, y: number, size = 14, color = '#e6e2cd', align: CanvasTextAlign = 'left') {
    const c = this.ctx;
    c.font = `${size}px monospace`;
    c.fillStyle = color;
    c.textAlign = align;
    c.fillText(s, Math.round(x), Math.round(y));
  }
  draw(run: Run, size: number) {
    const c = this.ctx;
    c.save();
    c.fillStyle = '#05080c';
    c.fillRect(0, 0, W, H);
    if (run.phase === 'hq' || run.phase === 'brief' || run.phase === 'settle') {
      c.restore();
      return;
    }
    const f: Floor = run.phase === 'service' && run.service ? run.service : run.floor;
    const p = run.player;
    const cam = Math.max(0, Math.min(f.width - W, p.x - W / 2));
    const sh = run.shake > 0 ? (Math.random() - 0.5) * 10 : 0;
    c.translate(-cam + sh, 0);
    // 조각 바닥·벽
    for (const ch of f.chunks) {
      const col = TYPE_COLOR[f.type];
      this.box(ch.x, 0, ch.w, H, col);
      this.box(ch.x, ch.laneMin - 20, ch.w, ch.laneMax - ch.laneMin + 60, ch.kind === 'attic' ? '#5a4a2e' : '#1b2327');
      c.strokeStyle = '#000';
      c.lineWidth = 1;
      c.strokeRect(ch.x + 0.5, 0.5, ch.w - 1, H - 1);
      this.text(ch.kind, ch.x + 8, 24, 13, '#8aa');
      if (ch.kind === 'step' || ch.kind === 'ledge') this.box(ch.feature![0], ch.laneMin - 80, ch.feature![1] - ch.feature![0], ch.laneMax - ch.laneMin + 120, '#36464c', '#6b8a92');
      if (ch.kind === 'gap') this.box(ch.feature![0], ch.laneMin - 20, ch.feature![1] - ch.feature![0], ch.laneMax - ch.laneMin + 60, '#000');
      if (ch.low) this.box(ch.feature![0], 0, ch.feature![1] - ch.feature![0], LANE_MIN - 110, '#2d2418', '#6a5a3a');
      if (ch.kind === 'guardian') this.text('수호자 방', ch.x + ch.w / 2, 60, 22, '#f0a0a0', 'center');
      if (ch.kind === 'goal') this.text('시험 목표 방', ch.x + ch.w / 2, 60, 22, '#a0d0f0', 'center');
      if (ch.kind === 'attic') this.text('다락방 (휴식·송신·로프)', ch.x + ch.w / 2, 60, 22, '#f0d0a0', 'center');
      if (ch.kind === 'hall_start' || ch.kind === 'hall_end') this.text('엘리베이터 홀', ch.x + ch.w / 2, 60, 18, '#ccc', 'center');
    }
    // 벽(막힘)
    const wallX = this.wall(run, f);
    if (wallX !== null) this.box(wallX, 0, 24, H, '#703030', '#f08080');
    // 추격
    if (run.chaserX > -5000) {
      this.box(run.chaserX - 400, 0, 400, H, 'rgba(120,20,20,0.85)');
      this.text('뒤의 것', run.chaserX - 120, 300, 26, '#ff8080');
    }
    // 소품
    for (const pr of f.props) {
      const colors: Record<string, string> = { sign: '#e0c060', door: '#8ab', lockdoor: '#a88', key: '#ee8', servicedoor: '#c8a060', hatch: '#c8a060', panel: '#9cf', mirror: '#cde', rope: '#e0b070', phone: '#9f9', pickup: '#8f8', table: '#b98', checklist: '#ff9', crate: '#a97', exit: '#0f0' };
      this.box(pr.x, pr.y, pr.w, pr.h, pr.used ? '#333' : colors[pr.kind] ?? '#888', '#000');
      const label: Record<string, string> = { sign: '표지 E', door: pr.data.includes('!') ? (pr.data.startsWith('ok') ? '문(정답)' : '문(죽음)') : pr.data === 'chase' ? '문 닫기 E' : '문 E', servicedoor: '점검문 E', hatch: pr.data === 'back' ? '해치(나가기) 점프+E' : '해치 점프+E', panel: pr.data === 'end' ? '승강기 E' : '타고 온 승강기', mirror: '거울 E', rope: '로프 E', phone: '인터폰 E', pickup: ['회복', '방어', '능력', '손전등'][Number(pr.data)] ?? '물건', table: pr.data === 'meal' ? '밥상' : '밥상', checklist: '점검표 E', crate: pr.data === 'gapcover' ? '틈새 막기 E' : '상자' };
      this.text(label[pr.kind] ?? pr.kind, pr.x + pr.w / 2, pr.y - 6, 12, pr.used ? '#666' : '#fff', 'center');
    }
    // 어둠
    const dark = f.type === 'dark';
    // 존재
    const drawEnt = (e: Ent) => {
      if (!e.alive || !e.spawned) return;
      if (e.special === 'invisible' && Math.abs(e.x - p.x) > 160 && p.lit <= 0) {
        this.text('…발소리', e.x, e.y + 20, 12, '#9ab', 'center');
        return;
      }
      if (dark && p.lit <= 0 && Math.abs(e.x - p.x) > 200) return;
      const scale = (size / 128) * (e.guardian ? 1.15 : 1);
      const w = e.w * 2 * scale * 0.5,
        h = e.h * 2 * scale * 0.5;
      const fill = e.guardian ? '#b03030' : e.special === 'passenger' ? '#4a8' : e.hostile ? (e.elite ? '#d07040' : '#a05050') : '#777';
      this.box(e.x - w / 2, e.y - h - e.z, w, h, e.flash > 0 ? '#fff' : fill, e.stun > 0 ? '#ff0' : '#000');
      if (e.armor) this.text('◆'.repeat(e.armor), e.x, e.y - h - e.z - 22, 12, '#fc8', 'center');
      this.text(`${e.label}${e.elite ? '★' : ''}`, e.x, e.y - h - e.z - 8, 12, '#fff', 'center');
      this.box(e.x - w / 2, e.y + 6, w, 6, '#300');
      this.box(e.x - w / 2, e.y + 6, (w * e.hp) / e.max, 6, '#f44');
      if (e.state === 'windup') this.text('!', e.x, e.y - h - e.z - 36, 20, '#ff0', 'center');
      // 방향
      this.box(e.x + e.dir * (w / 2 - 6), e.y - h * 0.8 - e.z, 6, 6, '#000');
    };
    const sorted = run.ents.slice().sort((a, b) => a.y - b.y);
    let playerDrawn = false;
    for (const e of sorted) {
      if (!playerDrawn && e.y > p.y) (this.drawPlayer(run, size), (playerDrawn = true));
      drawEnt(e);
    }
    if (!playerDrawn) this.drawPlayer(run, size);
    for (const b of run.bolts) this.box(b.x - 8, b.y - b.z - 3, 16, 6, b.enemy ? '#f88' : '#ff8');
    for (const e of run.effects) {
      const k = e.t / e.dur;
      if (e.kind === 'hit') this.box(e.x - 12, e.y - 12, 24, 24, `rgba(255,220,120,${1 - k})`);
      if (e.kind === 'blast') {
        c.strokeStyle = `rgba(255,150,80,${1 - k})`;
        c.lineWidth = 6;
        c.beginPath();
        c.arc(e.x, e.y, 40 + k * 160, 0, Math.PI * 2);
        c.stroke();
      }
      if (e.kind === 'guard') this.box(e.x - 30, e.y - 60, 60, 90, `rgba(120,200,255,${0.5 - k / 2})`);
      if (e.kind === 'ripple') {
        c.strokeStyle = `rgba(160,200,255,${1 - k})`;
        c.lineWidth = 2;
        c.beginPath();
        c.ellipse(e.x, e.y, 20 + k * 60, 8 + k * 20, 0, 0, Math.PI * 2);
        c.stroke();
      }
      if (e.kind === 'text' && e.text) this.text(e.text, e.x, e.y - k * 40, 16, `rgba(255,240,180,${1 - k})`, 'center');
    }
    // 어둠 가림
    if (dark) {
      c.fillStyle = 'rgba(0,0,0,0.9)';
      c.beginPath();
      c.rect(cam - 10, 0, W + 20, H);
      c.arc(p.x, p.y - 100, p.lit > 0 ? 420 : 180, 0, Math.PI * 2, true);
      c.fill();
    }
    c.restore();
    this.hud(run, f, size);
  }
  private wall(run: Run, f: Floor): number | null {
    return wallAhead(run, f, run.player.x);
  }
  private drawPlayer(run: Run, size: number) {
    const p = run.player,
      a = agentDef(run.agent);
    const h = (p.crouch ? size * 0.6 : size) * 2,
      w = size * 0.55 * 2 * 0.5;
    const y = p.y - h - p.z;
    this.box(p.x - w / 2, y, w, h, p.flash > 0 ? '#fff' : p.inv > 0 ? 'rgba(255,255,255,0.5)' : a.color, p.guarding ? '#8cf' : '#000');
    this.box(p.x + p.dir * (w / 2 - 8), y + 12, 8, 8, '#000');
    this.text(`${a.name} ${p.act}`, p.x, y - 8, 12, '#fff', 'center');
    if (p.z > 0) this.box(p.x - 20, p.y - 4, 40, 4, 'rgba(0,0,0,0.5)');
    if (run.cutin > 0) {
      const c = this.ctx;
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.fillStyle = 'rgba(0,0,0,0.5)';
      c.fillRect(0, H / 2 - 90, W, 180);
      this.text(`${a.name} 필살기 컷인 자리`, W / 2, H / 2 + 10, 36, '#ffd080', 'center');
      c.restore();
    }
  }
  private hud(run: Run, f: Floor, size: number) {
    const p = run.player,
      a = agentDef(run.agent);
    this.box(0, 0, W, 48, 'rgba(0,0,0,0.6)');
    this.text(`${depthLabel(run.depth)} ${TYPE_LABEL[f.type]}${f.variant ? ` · ${f.variant}` : ''} · 층 ${run.visited.length} · 총애 ${run.favor} · ${size}px`, 12, 20, 14, '#fff');
    this.text(`HP ${Math.ceil(p.hp)}/${p.max}  능력 ${Math.floor(p.energy)}  필살 ${Math.floor(p.gauge)}  고유기 ${p.uniqueCd > 0 ? p.uniqueCd.toFixed(1) : 'OK'}  아이템 1:${p.items[0]} 2:${p.items[1]} 3:${p.items[2]} 4:${p.items[3]}  규칙 ${run.found.length}(송신 ${run.sent.length})  현금 ${run.loot.cash} 예산 ${run.loot.budget} 연구 ${run.loot.research} 이빨 ${run.loot.teeth}`, 12, 40, 13, '#dde');
    this.box(W - 300, 8, 288, 10, '#300');
    this.box(W - 300, 8, (288 * p.hp) / p.max, 10, '#e44');
    this.box(W - 300, 22, 288, 6, '#333');
    this.box(W - 300, 22, (288 * p.gauge) / 100, 6, '#fc4');
    if (f.type === 'silent' || p.noise > 0) {
      this.box(W - 300, 32, 288, 6, '#333');
      this.box(W - 300, 32, (288 * p.noise) / 100, 6, '#8cf');
      this.text('소리', W - 340, 38, 12, '#8cf');
    }
    if (run.trial?.started && !run.trial.done) this.text(`시험: ${run.trial.kills}/${f.goal?.need} · ${Math.max(0, run.trial.left).toFixed(0)}초`, W / 2, 80, 22, '#a0d0f0', 'center');
    if (run.phase === 'service' && run.atticT > 0) this.text(`다락방 체류 ${run.atticT.toFixed(0)}초 / ${f.variant.includes('빠른') ? 45 : 90}`, W / 2, 80, 18, '#f0d0a0', 'center');
    if (p.reversed) this.text('조작 반전! 등을 돌려라', W / 2, 110, 20, '#f8f', 'center');
    // 미니맵: 가 본 층 세로 + 현재 층 가로
    const mx = W - 150,
      my = 70;
    this.box(mx - 10, my - 10, 150, Math.min(300, 24 + run.visited.length * 16), 'rgba(0,0,0,0.6)');
    this.text('지도 (Z)', mx, my + 4, 12, '#aaa');
    run.visited.slice(-16).forEach((v, i) => this.text(`${depthLabel(v.depth)} ${TYPE_LABEL[v.type]}`, mx, my + 22 + i * 16, 12, v.depth === run.depth ? '#ff8' : '#ccc'));
    const cw = 400 / f.width;
    this.box(mx - 10, H - 60, 150, 22, 'rgba(0,0,0,0.6)');
    for (const ch of f.chunks) this.box(mx - 8 + ch.x * cw * 0.35, H - 56, Math.max(2, ch.w * cw * 0.35 - 1), 14, ch.kind === 'guardian' ? '#a33' : ch.kind === 'attic' ? '#a83' : '#555');
    this.box(mx - 8 + p.x * cw * 0.35, H - 58, 4, 18, a.color);
    // 메시지·로그
    this.box(0, H - 36, W, 36, 'rgba(0,0,0,0.6)');
    this.text(run.message || run.log[run.log.length - 1] || '', 12, H - 12, 15, '#ffe');
    // 겹침 창
    if (run.dialog) {
      const d = run.dialog;
      this.box(140, 180, W - 280, 320, '#111a22', '#8ab');
      this.text(d.title, 170, 220, 22, '#ffd080');
      d.lines.forEach((l, i) => this.text(l, 170, 260 + i * 26, 15, '#eee'));
      d.options.forEach((o, i) => this.text(`[${i + 1}] ${o}`, 170, 360 + i * 30, 17, '#8cf'));
      this.text('숫자 키로 선택 · Esc 닫기', 170, 480, 12, '#888');
    }
    if (run.elevator) {
      this.box(140, 160, W - 280, 360, '#101418', '#9cf');
      this.text('엘리베이터 패널', 170, 200, 22, '#9cf');
      this.text(`총애 ${run.favor} · 버튼 ${run.elevator.buttons.length}개 · 유형은 총애 2 이상, 지도, 승객 정보가 있을 때만 보인다`, 170, 230, 13, '#aaa');
      elevatorOptions(run).forEach((o, i) => this.text(`[${i + 1}] ${o.label}`, 170, 280 + i * 32, 18, o.tag === 'button' ? '#ffe' : '#8cf'));
      this.text('Esc 내린다', 170, 500, 12, '#888');
    }
    if (run.upgradePick) {
      this.box(140, 200, W - 280, 260, '#1a1410', '#fc8');
      this.text('강화 선택 (수호자 보상)', 170, 240, 22, '#fc8');
      run.upgradePick.forEach((id, i) => this.text(`[${i + 1}] ${UPGRADES.find((u) => u.id === id)?.label}`, 170, 290 + i * 34, 18, '#ffe'));
    }
    if (run.hitstop > 0) void 0;
    if (run.ended) void 0;
    // 규칙 요약
    const known = run.found.slice(-3).map((id) => RULE_BY_ID[id]?.text ?? id);
    known.forEach((t, i) => this.text(t, 12, 70 + i * 16, 12, '#cfc'));
  }
}
