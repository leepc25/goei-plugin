// 첫 판 컷신 (기본 기획서 19.2, 설계서 13장 대본 초안). 좌표는 640×360 무대 기준.
// 배경 이름(bg)은 시연판 render.ts가 코드로 그리는 장면이고, 엔진은 같은 이름에 자기 배경을 붙이면 된다.
import type { CutsceneDef } from '../cutscene';

export const CUTSCENES: Record<string, CutsceneDef> = {
  first_day: {
    id: 'first_day',
    title: '첫 출근',
    form: '한 장 그림 + 도트',
    steps: [
      { k: 'fade', to: 'black', ms: 0 },
      { k: 'bg', scene: 'street' },
      { k: 'actor', id: 'agent', x: -40, y: 300, face: 1, show: true },
      { k: 'fade', to: 'clear', ms: 1200 },
      { k: 'caption', text: '오전 8시 40분. 종로.', ms: 1800 },
      { k: 'actor', id: 'agent', x: 250, anim: 'walk', ms: 2600 },
      { k: 'actor', id: 'agent', anim: 'idle' },
      { k: 'caption', text: '사람이 없다. 차도, 비둘기도. 인식의 장막 안쪽은 늘 이렇다.', ms: 2600 },
      { k: 'agentline', tag: 'enter' },
      { k: 'actor', id: 'agent', x: 470, anim: 'walk', ms: 1600 },
      { k: 'fade', to: 'black', ms: 600 },
      { k: 'bg', scene: 'office' },
      { k: 'actor', id: 'agent', x: 120, y: 300, anim: 'idle' },
      { k: 'actor', id: 'jaemtri', x: 420, y: 300, face: -1, show: true },
      { k: 'fade', to: 'clear', ms: 600 },
      { k: 'sfx', name: 'heels' },
      { k: 'wait', ms: 500 },
      { k: 'say', script: 'cs_first_day' },
      { k: 'emit', event: 'cutscene:done', arg: 'first_day' },
    ],
  },
  first_entry: {
    id: 'first_entry',
    title: '첫 투입',
    form: '한 장 그림 + 도트',
    steps: [
      { k: 'fade', to: 'black', ms: 0 },
      { k: 'bg', scene: 'elevator_in' },
      { k: 'actor', id: 'agent', x: 320, y: 300, face: 1, show: true },
      { k: 'fade', to: 'clear', ms: 1000 },
      { k: 'caption', text: '2000년 이전에 지은 낡은 사무실 건물. 정기 점검표. 서명란이 비어 있다.', ms: 2400 },
      { k: 'say', script: 'cs_first_entry' },
      { k: 'sfx', name: 'doors' },
      { k: 'fade', to: 'black', ms: 500 },
      { k: 'wait', ms: 900 },
      { k: 'sfx', name: 'ding' },
      { k: 'bark', who: 'elevator', text: '띵. 1층입니다. 문이 열립니다.', ms: 2400 },
      { k: 'wait', ms: 1200 },
      { k: 'bg', scene: 'lobby_wrong' },
      { k: 'fade', to: 'clear', ms: 900 },
      { k: 'caption', text: '로비 같은데, 로비가 아니다.', ms: 2000 },
      { k: 'actor', id: 'agent', face: -1 },
      { k: 'bg', scene: 'panel' },
      { k: 'panel', text: '1 2 3 4 5', ms: 0 },
      { k: 'panel', text: '1 2 3 4 5 B-1 B-2 B-3 B-4 B-5 B-6 B-7 B-8 B-9 B-10 B-11 B-12 B-?', ms: 2600 },
      { k: 'shake', ms: 300, amp: 2 },
      { k: 'caption', text: '패널에는 아까 없던 숫자가 빼곡하다.', ms: 2000 },
      { k: 'bg', scene: 'lobby_wrong' },
      { k: 'agentline', tag: 'enter_elevator' },
      { k: 'emit', event: 'cutscene:done', arg: 'first_entry' },
    ],
  },
  first_call: {
    id: 'first_call',
    title: '첫 호명',
    form: '도트',
    steps: [
      { k: 'bg', scene: 'elevator_in' },
      { k: 'actor', id: 'agent', x: 320, y: 300, face: 1, show: true },
      { k: 'sfx', name: 'intercom' },
      { k: 'shake', ms: 200, amp: 1 },
      { k: 'wait', ms: 600 },
      { k: 'say', script: 'cs_first_call' },
      { k: 'emit', event: 'cutscene:done', arg: 'first_call' },
    ],
  },
  attic: {
    id: 'attic',
    title: '다락방',
    form: '한 장 그림',
    steps: [
      { k: 'fade', to: 'black', ms: 300 },
      { k: 'bg', scene: 'attic' },
      { k: 'actor', id: 'agent', x: 160, y: 300, face: 1, show: true },
      { k: 'fade', to: 'clear', ms: 900 },
      { k: 'sfx', name: 'duct' },
      { k: 'caption', text: '덕트 사이 비좁은 공간. 긁어 쓴 지도. 버려진 배낭.', ms: 2400 },
      { k: 'camera', x: 470, y: 160, zoom: 1.6, ms: 1400 },
      { k: 'caption', text: '「여기 오래 있지 마」', ms: 2000 },
      { k: 'camera', x: 320, y: 180, zoom: 1, ms: 800 },
      { k: 'say', script: 'cs_attic' },
      { k: 'emit', event: 'cutscene:done', arg: 'attic' },
    ],
  },
  three_years: {
    id: 'three_years',
    title: '삼 년째 승객',
    form: '도트',
    steps: [
      { k: 'bg', scene: 'hall' },
      { k: 'actor', id: 'agent', x: 120, y: 300, face: 1, show: true },
      { k: 'actor', id: 'passenger', x: 560, y: 300, face: -1, show: true },
      { k: 'actor', id: 'passenger', x: 420, anim: 'walk', ms: 2000 },
      { k: 'actor', id: 'passenger', anim: 'idle' },
      { k: 'say', script: 'passenger_three' },
      { k: 'emit', event: 'cutscene:done', arg: 'three_years' },
    ],
  },
  return: {
    id: 'return',
    title: '귀환',
    form: '도트',
    steps: [
      { k: 'bg', scene: 'shaft' },
      { k: 'actor', id: 'agent', x: 320, y: 330, face: 1, anim: 'climb', show: true },
      { k: 'sfx', name: 'rope' },
      { k: 'par', steps: [
        { k: 'actor', id: 'agent', y: 60, anim: 'climb', ms: 6000 },
        { k: 'caption', text: '로프를 잡고 승강로를 오른다. 한참.', ms: 3000 },
      ] },
      { k: 'sfx', name: 'hatch' },
      { k: 'fade', to: 'black', ms: 400 },
      { k: 'bg', scene: 'lobby_real' },
      { k: 'actor', id: 'agent', x: 300, y: 300, anim: 'idle' },
      { k: 'fade', to: 'clear', ms: 1400 },
      { k: 'caption', text: '문을 열고 나왔다. 로비였다. 진짜.', ms: 2600 },
      { k: 'agentline', tag: 'win' },
      { k: 'emit', event: 'cutscene:done', arg: 'return' },
    ],
  },
  evac: {
    id: 'evac',
    title: '후송',
    form: '도트',
    steps: [
      { k: 'shake', ms: 400, amp: 6 },
      { k: 'fade', to: 'black', ms: 1200 },
      { k: 'caption', text: '로프가 당겨진다. 누가 끌어올리고 있다.', ms: 2200 },
      { k: 'bg', scene: 'medbay' },
      { k: 'actor', id: 'agent', x: 260, y: 300, anim: 'lie', show: true },
      { k: 'actor', id: 'buddy', x: 420, y: 300, face: -1, show: true },
      { k: 'fade', to: 'clear', ms: 1600 },
      { k: 'say', script: 'cs_evac' },
      { k: 'emit', event: 'cutscene:done', arg: 'evac' },
    ],
  },
  exit: {
    id: 'exit',
    title: '출구',
    form: '한 장 그림 + 도트',
    steps: [
      { k: 'bg', scene: 'panel' },
      { k: 'panel', text: 'B-12 B-11 … 1 EXIT', ms: 1800 },
      { k: 'caption', text: '패널에 EXIT가 떠 있다.', ms: 2000 },
      { k: 'say', script: 'cs_exit' },
      { k: 'sfx', name: 'ding' },
      { k: 'fade', to: 'black', ms: 800 },
      { k: 'bark', who: 'elevator', text: '…1층입니다. 문이 열립니다.', ms: 2400 },
      { k: 'wait', ms: 1600 },
      { k: 'bg', scene: 'exit_car' },
      { k: 'fade', to: 'clear', ms: 1600 },
      { k: 'caption', text: '관리국 차량. 문 앞에 시동이 걸려 있다.', ms: 2400 },
      { k: 'bark', who: 'elevator', text: '또 와요.', ms: 2600 },
      { k: 'wait', ms: 1800 },
      { k: 'emit', event: 'cutscene:done', arg: 'exit' },
    ],
  },
  dinner: {
    id: 'dinner',
    title: '공략 완료 회식',
    form: '한 장 그림 + 도트',
    steps: [
      { k: 'fade', to: 'black', ms: 0 },
      { k: 'bg', scene: 'pasta' },
      { k: 'actor', id: 'agent', x: 200, y: 300, face: 1, show: true },
      { k: 'actor', id: 'jaemtri', x: 440, y: 300, face: -1, show: true },
      { k: 'fade', to: 'clear', ms: 1200 },
      { k: 'caption', text: '근처 파스타집. 회식 메뉴 결정권은 늘 같은 사람에게 있다.', ms: 2600 },
      { k: 'say', script: 'cs_dinner' },
      { k: 'emit', event: 'cutscene:done', arg: 'dinner' },
    ],
  },
};

/** 컷신 안의 대화 */
export const CUTSCENE_SCRIPTS = String.raw`
=== cs_first_day
jaemtri(smile): 어머, 후배, 왔어?
jaemtri(smile): 길에 아무도 없어서 놀랐지? 인식의 장막이야. 종로가 원래 이렇게 조용하진 않아.
jaemtri: 여기가 종합대응팀 사무실. 지하는 훈련장이랑 격리 구역. 내려가면 시끄러운 아저씨가 있을 거야. 커피는 믹스로 받아.
jaemtri(smile): 그리고 나는 잼트리. 뭐 고민 있으면 꼭 언니한테 물어봐.
> agent pick
jaemtri(serious): 오늘 첫 건은 벌써 들어와 있어. 차원 승강기. 자리로 와.
> end

=== cs_first_entry
radio: (잼트리) 점검표요. 서명란이 비어 있으면 그게 입구래요. …네, 지금 타신 그거요.
> agent enter_elevator
radio: (잼트리) 타고 온 걸로는 못 돌아와요. 귀환은 다락방 로프. 꼭 기억해요.
> end

=== cs_first_call
elevator: (인터폰 잡음) …
> line el:call elevator
> agent called
elevator: 이번 층에서는 꼭 살아남아요.
> end

=== cs_attic
radio: (잼트리) 선배들의 다락방이래요. 관리국 선발대가 로프를 걸어 뒀고요.
radio: (잼트리) 저장하고, 정보 송신하고, 로프로 철수할 수 있어요. …오래 있지는 마세요.
> agent attic
> end

=== cs_evac
> agent evac
jaemtri: 송신한 건 다 받았어. 나머지는 절반. 괜찮아.
jaemtri(smile): 죽은 게 아니라 다쳐서 실려 온 거야. 다음에 또 가면 돼.
> end

=== cs_exit
> agent called
elevator: 거기, 그 버튼. 눌러도 돼요. 당신은.
> agent win
> end

=== cs_dinner
jaemtri(smile): 자, 오늘은 언니가 쏜다. 아니, 회사가 쏜다. 장부는 언니가 쥐고 있지만.
> agent win
jaemtri(smile): 다들 살아서 왔으니까 됐어. 건배.
> end
`;
