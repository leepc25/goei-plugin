// 본부 대사 연결 자리. 대사 글과 대화 장치는 「대사와 컷신」 스레드(story/) 소관이다.
// 그쪽이 setLineProvider로 대사를 넣으면 그것을 쓰고, 없으면 아래 임시 대사(장소당 1~3줄)를 쓴다.
// 태그: npc:<장소> · enter:<장소> · brief:jaemtri · brief:chief · brief:reply · return:<return|withdraw|evac> · evac:wake · pantry:chat · tired:<요원>
import type { AgentId } from './contract';

export interface LineCtx {
  agent: AgentId;
  agentName: string;
  fatigue: number;
  day: number;
  mission?: string;
  variantHint?: string;
  rules?: string[];
  rand: () => number;
}
export interface Line {
  who: string;
  text: string;
}
export type LineProvider = (tag: string, ctx: LineCtx) => Line[] | null;

let provider: LineProvider | null = null;
export function setLineProvider(p: LineProvider | null) {
  provider = p;
}

const pick = <T>(xs: readonly T[], r: () => number) => xs[Math.floor(r() * xs.length) % xs.length];

// 임시 대사. 말투 근거는 기본기획서 18.3 (잼트리: 다정하지만 절차, 고그니쟈: 하게체 최대 음량, 데쥬레: 당황하면 더듬음, 콘쥬스: 호칭 시세).
const FALLBACK: Record<string, (c: LineCtx) => Line[]> = {
  'npc:jaemtri': (c) => [{ who: '잼트리', text: pick(['오늘 들어온 글 정리해 뒀어요. 하나 골라 주세요.', '출동 전에 규칙서 한 번만 더 봐요. 진짜로요.', '연유 커피 남았는데, 드실래요?'], c.rand) }],
  'npc:chief': (c) => [{ who: '부장', text: pick(['예산은 결과로 말하는 거야.', '위험 단계? 기준부터 가져와.'], c.rand) }],
  'npc:supply': (c) => [{ who: '콘쥬스', text: pick(['아저씨, 아니 오빠! 오늘 회복약 싸게 드릴게요.', '칸은 네 개예요. 욕심내면 다 못 써요.'], c.rand) }],
  'npc:pantry': (c) => [{ who: '데쥬레', text: '미, 믹스커피가 제일이에요. 아메리카노는… 그, 쓴 물이잖아요.' }, { who: '고그니쟈', text: '믹스는 진리일세!!! 아메리카노 마시는 자는 내 연구실 출입 금지일세!!!' }],
  'npc:appraisal': () => [{ who: '데쥬레', text: '이, 이거 가져오신 거예요? 감정해 볼게요. 터지지만 않으면요.' }],
  'npc:lab': () => [{ who: '고그니쟈', text: '자료를 가져왔나!!! 좋네!!! 연구는 돈과 시간이 드는 법일세!!!' }],
  'npc:tooth': () => [{ who: '격리팀', text: '이빨 요정은 이빨을 먹으면 상자를 줘요. 안에 뭐가 있는지는 저희도 몰라요.' }],
  'npc:office': (c) => [{ who: c.agentName, text: c.fatigue >= 2 ? '…또 나가요? 좀 쉬고 싶은데.' : '갈 데 있으면 불러요.' }],
  'npc:clinic': () => [{ who: '의무실', text: '다친 사람은 쉬거나, 예산을 쓰거나.' }],
  'npc:interview': () => [{ who: '면담실', text: '구조된 분들이 기다리고 있어요.' }],
  'npc:training': () => [{ who: '훈련장', text: '허수아비가 기다린다. 기록은 벽에 붙어 있다.' }],
  'npc:street': () => [{ who: '종로', text: '사람이 하나도 없는 거리. 인식의 장막 안쪽이다.' }],
  'npc:gallery': () => [{ who: '격리 구역', text: '진열장에 회수물이 하나둘 늘어 간다.' }],
  'npc:pasta': () => [{ who: '파스타집', text: '공략 축하는 여기서. 오늘은 부장님이 산대요.' }],
  'brief:jaemtri': (c) => [{ who: '잼트리', text: c.rules?.length ? `알려진 규칙부터요. ${c.rules.slice(0, 2).join(' / ')}` : '점검표요. 서명란이 비어 있으면 그게 입구래요. …네, 지금 타신 그거요.' }, ...(c.variantHint ? [{ who: '잼트리', text: c.variantHint }] : [])],
  'brief:chief': (c) => [{ who: '부장', text: `목표: ${c.mission ?? '조사'}. 위험하면 다락방 로프로 철수해. 살아서 오는 게 먼저다.` }],
  'brief:reply': (c) => [{ who: c.agentName, text: c.agent === 'jyaldi' ? '알겠어. 금방 갔다 온다.' : '확인. 다녀오겠습니다.' }],
  'return:return': () => [{ who: '잼트리', text: '돌아오셨네요! 보고서는 제가 정리할게요.' }],
  'return:withdraw': () => [{ who: '잼트리', text: '철수도 판단이에요. 잘하셨어요.' }],
  'return:evac': (c) => [{ who: '데쥬레', text: `${c.agentName} 씨, 깨, 깨어났어요? 의무실이에요. 다들 걱정했어요.` }],
  'pantry:chat': (c) => FALLBACK['npc:pantry'](c),
};

export function lines(tag: string, ctx: LineCtx): Line[] {
  const got = provider?.(tag, ctx);
  if (got && got.length) return got;
  return FALLBACK[tag]?.(ctx) ?? [];
}
