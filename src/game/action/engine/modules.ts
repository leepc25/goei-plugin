// 최종 통합: 각 스레드 모듈을 엔진에 이어 붙이는 곳. 모듈이 없으면 엔진 기본(훈련장·임시 적·기본 HUD·기본 터치)을 쓴다.
import { createGameAudio } from '../audio';
import type { GameEvent } from './contract';
import type { EngineModules } from './game';
import { dummyStage, trainingStage } from './training';

const store = (key: string) => ({
  load: () => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  save: (v: string) => {
    try {
      localStorage.setItem(key, v);
    } catch {
      /* 저장 못 해도 진행 */
    }
  },
});

export function engineModules(): EngineModules {
  const audio = createGameAudio(store('goei-game-audio'));
  const listeners: ((e: GameEvent) => void)[] = [
    (e) => {
      audio.event(e as never);
      if (e.type === 'super') audio.duck(1.4);
    },
  ];
  return {
    stages: [trainingStage, dummyStage],
    hud: true,
    listeners,
    overlay: (_ctx, w) => {
      if (w) audio.setListener(w.camX + 640, 640);
    },
    onScene: (name) => {
      if (name === 'title' || name === 'hq') audio.floor(name as never);
    },
    onPause: (p) => (p ? audio.pause() : audio.resume()),
    dispose: () => audio.dispose(),
  };
}
