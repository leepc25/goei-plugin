// 차원 승강기 스테이지 모듈 진입점. 엔진 통합(engine/modules.ts)은 createElevatorStage만 쓰면 된다.
export { createElevatorStage, itemName, type ElevatorStage, type StageHooks, type StageStore } from './module';
export { makeFloor, validateFloor, pickType, pickSub, MAX_PIT, type GenContext } from './gen/floor';
export { makeService, validateService, cellAt } from './gen/service';
export { makeWorld, validateWorld, roomFloor, roomAt, across, edgeId, worldSize, lockCount, DIRS, OPP } from './gen/world';
export { narrowBack, narrowBackSpan, floorPlan, cellPlan, carPlan, endingPlan, type StagePlan } from './plan';
export { elevatorButtons, buttonCount, announce, type ElevatorButton, type ElevatorLines } from './elevator';
export { newMeta, newOuting, reshuffle, rulebook, exitOpen, exitProgress, currentKnown, sendFound, type StageMeta, type Outing } from './state';
export { RULES, RULE, ruleText } from './data/rules';
export { FLOOR_TYPES, depthLabel, budgetFor, B12 } from './data/floortypes';
export { ALL_CHUNKS, SERVICE_CHUNKS, COMMON_CHUNKS, TYPE_CHUNKS } from './data/chunks';
export * from './types';
