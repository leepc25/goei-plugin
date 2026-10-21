// 최종 통합: 각 스레드 모듈을 엔진에 이어 붙이는 곳. 모듈이 없으면 엔진 기본(훈련장·임시 적·기본 HUD·기본 터치)을 쓴다.
import type { EngineModules } from './game';
import { dummyStage, trainingStage } from './training';

export function engineModules(): EngineModules {
  return {
    stages: [trainingStage, dummyStage],
    hud: true,
    listeners: [],
  };
}
