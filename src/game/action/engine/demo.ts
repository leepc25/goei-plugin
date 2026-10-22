// 단독 시연판 (release/demo/goei-action-game.html). 그림은 빌드가 window.__GOEI_ENGINE_ART__로 내장한다.
import { mountGame } from '../main';

const box = document.getElementById('box')!;
let off: (() => void) | null = mountGame(box);
// 시험용: 닫기·다시 열기 (플러그인 창처럼). 객체가 남는지 잴 때 쓴다. open(bridge)는 가짜 다리(NPC 대화 모델 등)로 연다
(globalThis as { __goeiDemo?: unknown }).__goeiDemo = {
  close: () => (off?.(), (off = null)),
  open: (bridge?: Parameters<typeof mountGame>[1]) => (off?.(), (off = mountGame(box, bridge))),
};
