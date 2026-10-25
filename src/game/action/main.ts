// 게임 진입점. 플러그인(코드 팩)과 시연판이 모두 이것 하나를 부른다: mountGame(box, bridge) → 정리 함수.
import type { GameBridge } from '../bridge';
import { prepareTestPeople } from './art/testPeople';
import { prepareStartRoom } from './art/startRoom';
import { prepareHqField } from './art/hqField';
import { prepareHqTextures } from './art/hqTextures';
import { prepareHqDoorRound2 } from './art/hqDoorRound2';
import { prepareVisitAgents } from './art/visitAgents';
import { loadArt } from './engine/art';
import { Game } from './engine/game';
import { engineModules } from './engine/modules';
import { mountTouch } from './engine/touch';

const CSS = `
.goei-engine{position:relative;width:100%;height:100%;background:#000;display:flex;align-items:center;justify-content:center;overflow:hidden}
.goei-engine-canvas{display:block;max-width:100%;max-height:100%;aspect-ratio:16/9;width:100%;height:auto;image-rendering:pixelated;touch-action:none}
.goei-engine-stage{position:relative;width:min(100%, calc(100dvh * 16 / 9));aspect-ratio:16/9;max-height:100%}
.goei-engine-hq{position:absolute;inset:0;overflow:auto;z-index:20;background:#0b0f12}
.goei-engine-hq.goei-engine-hq-panel{background:rgba(5,8,10,.72)}
.goei-engine-hq-close{position:sticky;top:8px;float:right;margin:8px;z-index:2;padding:8px 14px;border-radius:8px;border:1px solid #5b6a72;background:#1a2226;color:#ece6d4;font:15px sans-serif}
.goei-engine-elev{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:flex;flex-direction:column;gap:8px;padding:14px;border-radius:14px;background:rgba(20,24,27,.92);border:2px solid #6d767b;pointer-events:auto;z-index:20}
.goei-engine-elev[hidden]{display:none}
.goei-engine-elev button{width:64px;height:52px;border-radius:50%;border:2px solid #9aa6ad;background:#2c3236;color:#ece6d4;font:bold 20px sans-serif;cursor:pointer}
.goei-engine-elev button.here{border-color:#ffb34a;color:#ffb34a}
.goei-engine-elev button:disabled{opacity:.35;cursor:default}
.goei-engine-loading{color:#8e9aa1;font:16px sans-serif}
`;

export function mountGame(box: HTMLElement, bridge?: Partial<GameBridge>): () => void {
  const st = document.createElement('style');
  st.textContent = CSS;
  const root = document.createElement('div');
  root.className = 'goei-engine';
  const stage = document.createElement('div');
  stage.className = 'goei-engine-stage';
  stage.innerHTML = '<div class="goei-engine-loading">불러오는 중…</div>';
  root.appendChild(stage);
  box.append(st, root);
  let game: Game | null = null;
  let offTouch: (() => void) | null = null;
  let dead = false;
  const urlOf = bridge?.assets ? (f: string) => bridge.assets!.url('jyaldi', f) : undefined;
  const releaseHqArt = prepareHqTextures(bridge?.assets ? f => bridge.assets!.url('hq-textures', f) : undefined);
  const releaseDoorArt = prepareHqDoorRound2(bridge?.assets ? f => bridge.assets!.url('hq-door-round2', f) : undefined);
  const releaseField = prepareHqField(bridge?.assets ? f => bridge.assets!.url('hq-field', f) : undefined);
  const startRoom = prepareStartRoom(bridge?.assets ? f => bridge.assets!.url('start-room', f) : undefined);
  // 필드 시험: 사용자 PixelLab 시험 캐릭터 (임시)
  const testPeople = bridge?.visit || window.__GOEI_TEST_PEOPLE__ ? prepareTestPeople(bridge?.assets ? f => bridge.assets!.url('test-people', f) : undefined, bridge?.assets ? f => bridge.assets!.bytes('test-people', f) : undefined) : null;
  const visitArt = bridge?.visit ? prepareVisitAgents(bridge.assets ? f => bridge.assets!.url('visit-agents', f) : undefined, bridge.assets ? f => bridge.assets!.bytes('visit-agents', f) : undefined) : null;
  void Promise.all([loadArt(urlOf, bridge?.assets ? f => bridge.assets!.bytes('jyaldi', f) : undefined), startRoom.ready, visitArt?.ready, testPeople?.ready]).then(([art]) => {
    if (dead) return;
    stage.remove();
    root.style.display = 'block';
    const wiring = engineModules(root, bridge);
    game = new Game(wiring.box, art, wiring.mods);
    wiring.bind(game);
    if (!wiring.mods.surface) offTouch = mountTouch(stage, game.input);
    game.start();
    (globalThis as { __goeiEngine?: Game }).__goeiEngine = game;
  }).catch((e) => {
    console.error('[goei] 게임 시작 실패', e);
    if (dead) return;
    // 그림을 받은 뒤 엔진 조립에서 실패하면 stage가 이미 빠져 있다: 안내를 다시 붙인다
    stage.textContent = `게임을 시작하지 못했어요: ${e instanceof Error ? e.message : String(e)}`;
    if (!stage.isConnected) { root.style.display = ''; root.appendChild(stage); }
  });
  return () => {
    dead = true;
    releaseDoorArt();
    releaseField();
    releaseHqArt();
    startRoom.dispose();
    visitArt?.dispose();
    testPeople?.dispose();
    offTouch?.();
    game?.destroy();
    const g = globalThis as { __goeiEngine?: Game };
    if (g.__goeiEngine === game) delete g.__goeiEngine;
    game = null;
    root.remove();
    st.remove();
  };
}
