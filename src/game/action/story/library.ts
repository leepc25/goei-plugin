// 모든 대본을 한 서고로 묶는다. 옛 출동 대본(본부 임무 창구·승강기 현장·컷신)은 2026-10-28에 지웠다.
import { ScriptLibrary } from './script';

export function buildLibrary(): ScriptLibrary {
  return new ScriptLibrary();
}
