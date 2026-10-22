/** 층 계획의 이름과 실제 개체 종류를 잇는 공용 표. solo는 짝을 스스로 부른다. */
export const KIND_ALIAS: Record<string, { kind: string; solo?: boolean }> = {
  nothuman: { kind: 'hollow' },
  warmth: { kind: 'shade' },
  conductor: { kind: 'proctor' },
  elder: { kind: 'elder_f', solo: true },
  family208: { kind: 'family_f', solo: true },
};
export const enemyKind = (kind: string) => KIND_ALIAS[kind]?.kind ?? kind;
