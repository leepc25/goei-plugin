// 컷신 도트 애니메이션 목록·컷 길이·자막. 그림은 GPT가 만든다(docs/GPT요청_컷신영상.md), 컷 길이와 자막 시각은 그 콘티와 같다.
// 파일: game-src/art/cutscene/frames/<이름>/<컷>/0001.png…(장마다 640×360) + 같은 폴더 timing.json, 선택 <이름>/sound.ogg.
// 글자는 그림에 넣지 않고 여기 자막으로 띄운다. text에 {call}은 요원별 승강기 호명 한 줄로 바뀐다.
export interface VideoSub {
  /** 초 */
  t: number;
  /** 몇 초 보일지 (없으면 다음 자막까지, 마지막은 3초) */
  dur?: number;
  who?: string;
  text: string;
}
export interface VideoDef {
  /** 컷 길이(초). 컷 이름은 c1, c2, … 순서 */
  cuts: number[];
  subs: VideoSub[];
  /** sound.ogg가 있음 (없는 파일을 불러 콘솔 오류를 내지 않게, 받으면 켠다) */
  sound?: boolean;
}

// 옛 출동 컷신(오프닝·첫 출근·첫 투입·다락방·후송·출구·회식)은 차원 승강기와 같이 지웠다 (2026-10-28). 새 컷신이 생기면 여기에.
export const VIDEOS: Record<string, VideoDef> = {};
export const VIDEO_DIR = 'game-src/art/cutscene/frames/';
