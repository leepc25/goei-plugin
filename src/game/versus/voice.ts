// 대전 아나운서 목소리 (11-08 사용자): MR. HAPPY 오락실 처리판이 기본, K.O. 처럼 없는 말은 DRAGON. 출처 game-pack/vs-voice/LICENSE.txt
// 파일은 대전 공용 팩(vs-common)의 voice-<이름>.ogg (tools/build_vs_packs.py). 소리 크기는 게임 음량(전체×효과음)을 따른다
import { commonUrl } from '../action/art/charPacks';

export type VoiceId = 'choose' | 'round1' | 'round2' | 'round3' | 'final' | 'fight' | 'time' | 'ko' | 'knockout' | 'youwin' | 'youlose' | 'winner' | 'gameover' | 'p1' | 'p2' | 'sudden';

let volume = 0.8;
export const setVoiceVolume = (v: number) => { volume = Math.max(0, Math.min(1, v)); };
const urls = new Map<VoiceId, Promise<string | null>>();
let cur: HTMLAudioElement | null = null;

/** 한 번에 한 마디만 (앞 말은 끊는다) */
export function vsVoice(id: VoiceId): void {
  if (!urls.has(id)) urls.set(id, commonUrl(`voice-${id}.ogg`));
  void urls.get(id)!.then((u) => {
    if (!u || volume <= 0) return;
    cur?.pause();
    const a = new Audio(u);
    a.volume = volume;
    cur = a;
    void a.play().catch(() => {});
  });
}
