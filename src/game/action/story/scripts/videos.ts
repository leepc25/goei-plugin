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
}

export const VIDEOS: Record<string, VideoDef> = {
  opening: { cuts: [4, 3, 2, 4, 1.5, 2.5, 4, 6, 5], subs: [] },
  first_day: {
    cuts: [4, 4, 6, 4],
    subs: [
      { t: 8, who: '잼트리', text: '어머, 후배, 왔어?' },
      { t: 10.5, who: '잼트리', text: '길에 아무도 없어서 놀랐지? 인식의 장막이야.' },
      { t: 14, who: '잼트리', text: '오늘 첫 건은 벌써 들어와 있어. 차원 승강기.' },
    ],
  },
  first_entry: {
    cuts: [3, 4, 2, 4, 4, 3],
    subs: [
      { t: 4, dur: 4.5, who: '무전(잼트리)', text: '점검표 서명란이 비어 있으면 그게 입구래요.' },
      { t: 10, dur: 5, who: '무전(잼트리)', text: '타고 온 걸로는 못 돌아와요. 귀환은 다락방 로프.' },
      { t: 17.5, who: '승강기', text: '띵. 1층입니다. 문이 열립니다.' },
    ],
  },
  first_call: {
    cuts: [3, 4, 3],
    subs: [
      { t: 3.5, dur: 1.3, who: '승강기', text: '…' },
      { t: 5, who: '승강기', text: '{call}' },
      { t: 8, who: '승강기', text: '이번 층에서는 꼭 살아남아요.' },
    ],
  },
  attic: {
    cuts: [4, 3, 3, 4],
    subs: [
      { t: 2, dur: 4, who: '무전(잼트리)', text: '선배들의 다락방이래요. 로프를 걸어 뒀고요.' },
      { t: 8, dur: 2.5, text: '「여기 오래 있지 마」' },
      { t: 11, who: '무전(잼트리)', text: '…오래 있지는 마세요.' },
    ],
  },
  three_years: {
    cuts: [3, 4, 2, 3],
    subs: [
      { t: 3.5, dur: 3.3, who: '승객', text: '나 여기 삼 년째야. 그러니까 내 말 들어.' },
      { t: 7, who: '승객', text: '저쪽 문 말고 이쪽.' },
    ],
  },
  return: { cuts: [4, 2, 2, 6], subs: [{ t: 9, dur: 4, text: '문을 열고 나왔다. 로비였다. 진짜.' }] },
  evac: {
    cuts: [3, 3, 4, 2],
    subs: [
      { t: 1, dur: 2.5, text: '로프가 당겨진다. 누가 끌어올리고 있다.' },
      { t: 7, dur: 2.8, who: '잼트리', text: '송신한 건 다 받았어. 나머지는 절반. 괜찮아.' },
      { t: 10, who: '잼트리', text: '다음에 또 가면 돼.' },
    ],
  },
  exit: {
    cuts: [3, 4, 4, 3],
    subs: [
      { t: 1, dur: 2.6, who: '승강기', text: '거기, 그 버튼. 눌러도 돼요. 당신은.' },
      { t: 4, dur: 3, who: '승강기', text: '…1층입니다. 문이 열립니다.' },
      { t: 12, who: '승강기', text: '또 와요.' },
    ],
  },
  dinner: {
    cuts: [3, 5, 3, 3],
    subs: [
      { t: 8.5, dur: 2.8, who: '잼트리', text: '자, 오늘은 언니가 쏜다. 아니, 회사가 쏜다.' },
      { t: 11.5, who: '쟈알디', text: '…블랙.' },
    ],
  },
};

/** 저장소 기준 프레임 폴더. 엔진·플러그인은 StoryHost.videoUrl로 바꿀 수 있다 */
export const VIDEO_DIR = 'game-src/art/cutscene/frames/';
