// 게임 껍데기: 화면 틀 + 입력(키보드·터치·패드) + HUD + 효과 + 메뉴를 한 번에 붙인다.
// 엔진 쪽 사용법은 docs/게임_모듈_연결.md 와 이 폴더 README.md.
import { Fx } from './fx';
import { PadReader } from './gamepad';
import { Hud, statusHtml } from './hud';
import { InputHub } from './input';
import { ACTS, CODE, KEY_NAME, LABEL, PAD_NAME } from './keys';
import { Menu, choiceScreen, esc, type MenuItem, type Screen } from './menu';
import { DEFAULT_SETTINGS, localStore, parseSettings, type SettingsStore, type UiSettings } from './settings';
import { mountStage, type Stage } from './stage';
import { TouchPad } from './touch';

export { Fx, Hud, InputHub, Menu, PadReader, TouchPad, choiceScreen };
export type { FxEvent, TransitionKind } from './fx';
export type { HudState, HudItem, MapState } from './hud';
export { drawHud, drawMap, label, plate, font, FONT, setHudItemIcon, drawHudItemIcon, statusHtml } from './hud';
export type { UiSettings } from './settings';
export { W, H, mountStage } from './stage';
export { drawTitleBg, drawGoSign } from './title';
export { ensureKit, kitCss, PIXEL_FONT, agentFaces, nine, kitPiece, kitSlice } from './kit';
export * from './keys';

export interface ShellOptions {
  store?: SettingsStore;
  /** 타이틀 큰 글자 */
  title?: string;
  sub?: string;
  /** 터치·패드를 가짜 KeyboardEvent 로도 쏠지 (엔진이 window 키 이벤트만 듣는 경우) */
  synth?: boolean;
  /** 키보드를 받을 곳. 기본 window */
  keyTarget?: Window | HTMLElement;
  onNew?: () => void;
  onContinue?: () => void;
  hasSave?: () => boolean;
  /** 일시정지 메뉴의 「본부로 귀환」 */
  onRetreat?: () => void;
  onTitle?: () => void;
  /** 채우기: 가로로 긴 화면에서 캔버스를 옆으로 넓힌다. 엔진이 shell.stage.vw 폭으로 그릴 수 있을 때만 켠다 */
  fill?: boolean;
  /** 화면 좌표 → 요소 기준 좌표 (리스 플러그인 창이 게임을 돌릴 때 bridge.viewport.toLocal) */
  toLocal?: (clientX: number, clientY: number, el: HTMLElement) => { x: number; y: number };
  /** 일시정지 메뉴 위쪽 한 줄 요약 */
  pauseInfo?: () => string;
}

export interface Shell {
  stage: Stage;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  input: InputHub;
  pad: PadReader;
  touch: TouchPad;
  hud: Hud;
  fx: Fx;
  menu: Menu;
  settings: UiSettings;
  mode: 'title' | 'play';
  /** 메뉴가 열려 있으면 true: 엔진은 이때 시간을 멈춘다 */
  readonly paused: boolean;
  /** 터치 버튼이 화면에 보이는지 (HUD compact 로 넘긴다) */
  readonly touchShown: boolean;
  /** 매 화면 프레임마다: 패드 읽기, 효과 시간 진행 */
  frame(dt: number): void;
  play(): void;
  openTitle(): void;
  openPause(): void;
  openSettings(): void;
  openControls(): void;
  choose(o: { title: string; lines?: string[]; options: string[]; cancel?: boolean }): Promise<number>;
  confirm(text: string, yes?: string, no?: string): Promise<boolean>;
  info(title: string, lines: string[], button?: string): Promise<void>;
  /** 키를 한 번 짧게 누른다 (메뉴에서 자동 전환·판정 보기 등) */
  tap(code: string): void;
  saveSettings(): void;
  dispose(): void;
}

export function mountGameShell(box: HTMLElement, o: ShellOptions = {}): Shell {
  const stage = mountStage(box);
  const input = new InputHub();
  input.synth = !!o.synth;
  input.target = o.keyTarget ?? window;
  const pad = new PadReader(input);
  const hud = new Hud();
  const fx = new Fx();
  fx.rumble = (s, ms) => pad.rumble(s, ms);
  const menu = new Menu(stage.ui);
  const store = o.store ?? localStore;
  let settings: UiSettings = { ...DEFAULT_SETTINGS };
  const tap = (code: string) => {
    input.press(code, 'touch');
    setTimeout(() => input.release(code, 'touch'), 90);
  };
  const touch = new TouchPad(stage.touch, input, () => settings, (code) => {
    if (code === 'Escape') shell.openPause();
    else tap(code);
  });
  touch.vw = () => stage.vw;
  touch.toLocal = o.toLocal ?? ((x, y, el) => stage.toLocal(x, y, el));
  if (o.fill) stage.setFit('fill');
  const apply = () => {
    stage.setCrt(settings.crt);
    stage.setBright(settings.bright);
    stage.setPixel(settings.pixel);
    fx.opt = { shake: settings.shake, flash: settings.flash, numbers: settings.numbers };
    pad.setRumble(settings.vibrate);
    touch.refresh();
  };
  const saveSettings = () => void store.save(JSON.stringify(settings));
  menu.onChange = () => {
    apply();
    saveSettings();
  };
  menu.onOpen = (open) => {
    if (open) input.releaseSource('kb'), input.releaseSource('pad');
    touch.setVisible(!open && shell.mode === 'play');
  };
  // 메뉴가 열려 있으면 모든 키를 메뉴가 먹는다. 패드 B(KeyE)는 뒤로
  input.capture = (code, down) => {
    if (!menu.isOpen) {
      if (code === 'Escape' && shell.mode === 'play') {
        if (down) shell.openPause();
        return true;
      }
      return false;
    }
    if (!down) return true;
    menu.key(code === 'KeyE' && input.last === 'pad' ? 'Escape' : code === 'KeyA' && input.last === 'pad' ? 'Enter' : code);
    return true;
  };
  input.attachKeyboard(o.keyTarget ?? window, {
    prevent: (code) => code.startsWith('Arrow') || code === 'Space' || code === 'Tab' || code === 'Escape' || /^Key|^Digit|^Shift/.test(code),
  });
  stage.onResize(() => touch.layout());

  const controlsHtml = () => {
    const rows = ACTS.filter((a) => !['up', 'down', 'right'].includes(a))
      .map((a) => {
        const kb = a === 'left' ? '<kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd>' : `<kbd>${esc(KEY_NAME[a])}</kbd>`;
        const pd = PAD_NAME[CODE[a]] ?? '';
        const tc = a === 'left' ? '왼쪽 스틱' : a === 'menu' ? '☰' : a === 'auto' || a === 'hitbox' ? '메뉴' : a.startsWith('item') ? '아래 칸' : a === 'evade' ? '회피 (스틱 끝 = 달리기)' : '버튼';
        return `<tr><td>${esc(a === 'left' ? '이동 (좌우 + 안쪽·앞쪽)' : LABEL[a])}</td><td>${kb}</td><td>${esc(pd)}</td><td>${esc(tc)}</td></tr>`;
      })
      .join('');
    return `<table><tr><th>행동</th><th>키보드</th><th>게임패드</th><th>터치</th></tr>${rows}</table><p style="margin-top:10px">Shift 를 0.15초 안에 떼면 회피, 누르고 있으면 달리기. 같은 방향 두 번도 달리기. ↓ 두 번 앉기.</p>`;
  };
  const settingsItems = (): MenuItem[] => {
    const s = settings;
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    return [
      { type: 'head', label: '화면' },
      { type: 'toggle', label: 'CRT 필터 (주사선·모서리)', get: () => s.crt, set: (v) => (s.crt = v) },
      { type: 'slider', label: '화면 흔들림', get: () => s.shake, set: (v) => (s.shake = v), min: 0, max: 1, step: 0.25, fmt: pct },
      { type: 'toggle', label: '피격 섬광', get: () => s.flash, set: (v) => (s.flash = v) },
      { type: 'toggle', label: '피해 숫자', get: () => s.numbers, set: (v) => (s.numbers = v) },
      { type: 'slider', label: '밝기', get: () => s.bright, set: (v) => (s.bright = v), min: 0.7, max: 1.4, step: 0.05, fmt: pct },
      { type: 'toggle', label: '도트 선명하게', get: () => s.pixel, set: (v) => (s.pixel = v) },
      { type: 'button', label: '전체 화면', sub: '폰은 가로로 고정', act: () => void stage.fullscreen() },
      { type: 'head', label: '소리' },
      { type: 'slider', label: '전체', get: () => s.master, set: (v) => (s.master = v), min: 0, max: 1, step: 0.1, fmt: pct },
      { type: 'slider', label: '음악', get: () => s.music, set: (v) => (s.music = v), min: 0, max: 1, step: 0.1, fmt: pct },
      { type: 'slider', label: '효과음', get: () => s.sfx, set: (v) => (s.sfx = v), min: 0, max: 1, step: 0.1, fmt: pct },
      { type: 'head', label: '조작' },
      { type: 'choice', label: '터치 버튼', options: [['auto', '자동'], ['on', '항상'], ['off', '끄기']], get: () => s.touch, set: (v) => (s.touch = v as UiSettings['touch']) },
      { type: 'slider', label: '버튼 크기', get: () => s.touchSize, set: (v) => (s.touchSize = v), min: 0.7, max: 1.4, step: 0.05, fmt: pct },
      { type: 'slider', label: '버튼 진하기', get: () => s.touchAlpha, set: (v) => (s.touchAlpha = v), min: 0.3, max: 1, step: 0.05, fmt: pct },
      { type: 'toggle', label: '스틱 끝까지 밀면 달리기', get: () => s.stickRun, set: (v) => (s.stickRun = v) },
      { type: 'toggle', label: '왼손 배치', get: () => s.lefty, set: (v) => (s.lefty = v) },
      { type: 'toggle', label: '진동', get: () => s.vibrate, set: (v) => (s.vibrate = v) },
      { type: 'head', label: '대화' },
      { type: 'choice', label: 'NPC 대화 모델', options: [['main', '주 모델'], ['aux', '보조 모델']], get: () => s.talkModel, set: (v) => (s.talkModel = v as UiSettings['talkModel']) },
      { type: 'toggle', label: '본편 최근 채팅 같이 보내기', get: () => s.talkRecent, set: (v) => (s.talkRecent = v) },
      { type: 'html', html: `<p style="font-size:14px;color:#9aa6ab">게임패드: ${esc(pad.connected ? pad.connected.slice(0, 48) : '연결 안 됨 (버튼을 하나 누르면 잡힙니다)')}</p>` },
      { type: 'button', label: '기본값으로', act: () => ((settings = { ...DEFAULT_SETTINGS }), apply(), saveSettings(), menu.replace(settingsScreen())) },
    ];
  };
  const settingsScreen = (): Screen => ({ id: 'settings', title: '설정', items: settingsItems() });

  let mode: 'title' | 'play' = 'title';
  const shell: Shell = {
    stage,
    canvas: stage.canvas,
    ctx: stage.ctx,
    input,
    pad,
    touch,
    hud,
    fx,
    menu,
    get settings() {
      return settings;
    },
    get mode() {
      return mode;
    },
    set mode(m) {
      mode = m;
      touch.setVisible(m === 'play' && !menu.isOpen);
    },
    get paused() {
      return menu.isOpen || mode !== 'play';
    },
    get touchShown() {
      return touch.shown;
    },
    frame(dt) {
      pad.poll();
      fx.update(dt);
    },
    play() {
      menu.closeAll();
      shell.mode = 'play';
      stage.root.focus({ preventScroll: true });
    },
    openTitle() {
      shell.mode = 'title';
      menu.closeAll();
      const has = o.hasSave?.() ?? false;
      menu.open({
        id: 'title',
        look: 'title',
        title: o.title ?? '차원 승강기',
        sub: o.sub ?? 'ANOMALY SIMULATION · 관리국 액션',
        noBack: true,
        items: [
          ...(has ? [{ type: 'button' as const, label: '이어하기', act: () => o.onContinue?.() }] : []),
          { type: 'button', label: '새로 시작', act: () => o.onNew?.() },
          { type: 'button', label: '설정', act: () => shell.openSettings() },
          { type: 'button', label: '조작법', act: () => shell.openControls() },
        ],
      });
    },
    openPause() {
      if (menu.isOpen) return;
      menu.open({
        id: 'pause',
        title: '일시정지',
        sub: o.pauseInfo?.() ?? '',
        items: [
          ...(hud.last ? [{ type: 'html' as const, html: statusHtml(hud.last) }] : []),
          { type: 'button', label: '계속', sub: 'Esc', act: () => menu.closeAll() },
          { type: 'button', label: '설정', act: () => shell.openSettings() },
          { type: 'button', label: '조작법', act: () => shell.openControls() },
          { type: 'button', label: '자동 전환', sub: 'X', act: () => (menu.closeAll(), tap('KeyX')) },
          { type: 'button', label: '판정 보기', sub: 'H', act: () => (menu.closeAll(), tap('KeyH')) },
          ...(o.onRetreat ? [{ type: 'button' as const, label: '본부로 귀환', sub: '후송 처리', danger: true, act: () => void shell.confirm('출동을 포기하고 본부로 돌아갈까요? 송신하지 않은 정보는 절반만 남습니다.', '귀환', '계속 싸운다').then((y) => y && (menu.closeAll(), o.onRetreat!())) }] : []),
          { type: 'button', label: '타이틀로', act: () => void shell.confirm('타이틀 화면으로 나갈까요? 진행은 저장됩니다.').then((y) => y && (o.onTitle ? o.onTitle() : shell.openTitle())) },
        ],
      });
    },
    openSettings() {
      menu.open(settingsScreen());
    },
    openControls() {
      menu.open({ id: 'controls', title: '조작법', look: 'wide', items: [{ type: 'html', html: controlsHtml() }, { type: 'button', label: '닫기', act: () => menu.pop() }] });
    },
    choose(c) {
      return new Promise((res) => {
        menu.open(
          choiceScreen(menu, c, (i) => {
            menu.pop();
            res(i);
          }),
        );
      });
    },
    confirm(text, yes = '예', no = '아니오') {
      return new Promise((res) => {
        menu.open({
          id: 'confirm',
          title: '확인',
          back: () => (menu.pop(), res(false)),
          items: [
            { type: 'html', html: `<p>${esc(text)}</p>` },
            { type: 'button', label: yes, act: () => (menu.pop(), res(true)) },
            { type: 'button', label: no, act: () => (menu.pop(), res(false)) },
          ],
        });
      });
    },
    info(title, lines, button = '확인') {
      return new Promise((res) => {
        menu.open({
          id: 'info',
          title,
          look: 'wide',
          back: () => (menu.pop(), res()),
          items: [{ type: 'html', html: lines.map((l) => `<p>${esc(l)}</p>`).join('') }, { type: 'button', label: button, act: () => (menu.pop(), res()) }],
        });
      });
    },
    tap,
    saveSettings,
    dispose() {
      input.dispose();
      touch.dispose();
      menu.dispose();
      stage.dispose();
    },
  };
  void (async () => {
    settings = parseSettings(await store.load());
    apply();
  })();
  apply();
  return shell;
}
