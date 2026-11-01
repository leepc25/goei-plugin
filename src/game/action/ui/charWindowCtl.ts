// 통합창(charWindow.ts)을 게임에 붙이는 조종기: ` 로 열고 ` · Esc 로 닫는다(11-01 사용자: Tab 은 다른 키라 ` ).
// 창 안: Q·E = 탭 넘기기, 방향키 = 고르기(기술·능력). 열려 있는 동안 게임은 멈춘다(shell.paused).
import { CHAR_TABS, drawCharWindow, type CharWindowData } from './charWindow';

export const CHAR_WINDOW_KEY = 'Backquote';

export class CharWindowCtl {
  open = false;
  tab = 0;
  skill = 0;
  perk = 0;
  private skills = 0;
  private perks = 0;
  toggle(on = !this.open) { this.open = on; }
  /** 창이 열려 있을 때 눌린 키 (닫기 키는 껍데기가 먼저 받는다) */
  key(code: string) {
    const n = CHAR_TABS.length;
    if (code === 'KeyQ') this.tab = (this.tab + n - 1) % n;
    else if (code === 'KeyE') this.tab = (this.tab + 1) % n;
    const tab = CHAR_TABS[this.tab];
    const dx = code === 'ArrowLeft' ? -1 : code === 'ArrowRight' ? 1 : 0, dy = code === 'ArrowUp' ? -1 : code === 'ArrowDown' ? 1 : 0;
    if (!dx && !dy) return;
    if (tab === '기술' && this.skills) {
      // 기술 칸 = 한 줄 3개, 두 줄
      const i = this.skill + dx + dy * 3;
      if (i >= 0 && i < this.skills) this.skill = i;
    } else if (tab === '능력' && this.perks) {
      const i = this.perk + dx + dy * 5; // 능력 칸 = 한 줄 5개
      if (i >= 0 && i < this.perks) this.perk = i;
    }
  }
  draw(c: CanvasRenderingContext2D, d: Omit<CharWindowData, 'perkPick' | 'pick'> & { pick: (i: number) => CharWindowData['pick'] }) {
    this.skills = d.skills.length; this.perks = d.perks.length;
    this.skill = Math.min(this.skill, Math.max(0, this.skills - 1));
    this.perk = Math.min(this.perk, Math.max(0, this.perks - 1));
    c.save();
    // 캔버스 크기가 화면마다 달라서(필드는 꽉 채움) 1280×720 창을 비율 그대로 가운데에
    const cw = c.canvas.width, ch = c.canvas.height, k = Math.min(cw / 1280, ch / 720);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(0, 0, cw, ch);
    c.setTransform(k, 0, 0, k, Math.round((cw - 1280 * k) / 2), Math.round((ch - 720 * k) / 2));
    c.imageSmoothingEnabled = false;
    drawCharWindow(c, { ...d, pick: d.pick(this.skill), perkPick: this.perk }, CHAR_TABS[this.tab]);
    c.restore();
  }
}
