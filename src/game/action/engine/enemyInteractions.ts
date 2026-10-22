import { signalEnemies } from '../enemy';
import type { World } from './world';

/** 조사 입력과 스테이지에서 검증한 규칙 성공을 적 모듈에 연결한다. */
export function bindEnemyInteractions(w: World) {
  w.interactHooks.push((prop) => {
    const at = { x: w.player.x, y: w.player.y };
    signalEnemies(w, { kind: 'greet', ...at });
    signalEnemies(w, { kind: 'door', ...at });
    if (prop?.kind === 'crevice') signalEnemies(w, { kind: 'plug', x: prop.x });
    if (prop?.kind === 'bowl') signalEnemies(w, { kind: 'bowl', x: prop.x, y: prop.y });
  });
  w.on((event) => {
    if (event.type !== 'custom' || event.name !== 'guardianRule') return;
    const kind = (event.data as { kind?: unknown } | null)?.kind;
    // 일반 식탁이나 배경 문 E로 수호자 규칙을 우회하지 않는다.
    if (kind === 'mealThanks' || kind === 'childDoor') signalEnemies(w, { kind });
  });
}
