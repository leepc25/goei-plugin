/** 다른 이름과 실제 개체 종류를 잇는 공용 표. solo는 짝을 스스로 부른다. 옛 승강기 층 이름은 2026-10-28에 지웠다. */
export const KIND_ALIAS: Record<string, { kind: string; solo?: boolean }> = {};
export const enemyKind = (kind: string) => KIND_ALIAS[kind]?.kind ?? kind;
