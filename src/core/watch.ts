// 현재 화면 감시. 1초마다 캐릭터·채팅 번호(정수 2개)와 채팅 화면이 떠 있는지만 확인한다.
// 캐릭터 전체(로어북 1MB)는 캐릭터가 바뀔 때 한 번만 읽어 Lite 여부를 판단한다.
export interface WatchSnapshot {
  charIndex: number;
  chatIndex: number;
  /** Risu 채팅 화면(.default-chat-screen)이 보이는지. 설정 화면 등에서는 false */
  chatScreen: boolean;
}

export class WatchState {
  private charIndex = -2;
  private active = false;
  private isLite = false;

  /** 지금 캐릭터가 괴이봇 Lite인지 (채팅 화면 여부와 무관) */
  get lite(): boolean {
    return this.charIndex >= 0 && this.isLite;
  }

  needsCharacterCheck(s: WatchSnapshot): boolean {
    return s.charIndex !== this.charIndex;
  }

  /**
   * lite: 이번 캐릭터가 괴이봇 Lite인지 (needsCharacterCheck가 false면 생략, 이전 값 유지).
   * intro: 괴이봇 Lite 채팅 화면에 새로 들어온 순간마다 true (다른 봇·설정 화면에서 돌아올 때 포함).
   */
  update(s: WatchSnapshot, lite?: boolean): { changed: boolean; fabVisible: boolean; intro: boolean } {
    if (s.charIndex !== this.charIndex) this.isLite = lite ?? false;
    this.charIndex = s.charIndex;
    const active = s.charIndex >= 0 && s.chatIndex >= 0 && s.chatScreen && this.isLite;
    const changed = active !== this.active;
    const intro = active && !this.active;
    this.active = active;
    return { changed, fabVisible: active, intro };
  }
}
