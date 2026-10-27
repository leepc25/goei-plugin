// 설치·점검 뒤 본체에 알리는 작은 고리 (ui → body). 설치로 카드가 괴이 카드가 되면 채팅 감시가 다시 판정하게 한다 (2026-10-27)
let onInstalled: (() => void) | null = null;

export function setInstalledHook(f: (() => void) | null): void {
  onInstalled = f;
}

export function notifyInstalled(): void {
  try {
    onInstalled?.();
  } catch {
    // 감시가 없으면 그만
  }
}
