// 통합판 연결: 본부(hq/)와 층(stage/)이 열어 둔 대사 자리에 이 모듈의 대사를 넣는다.
// 화면은 각 모듈 것을 그대로 쓴다 (본부 말칸, 층의 world.say). 여기는 글만 고른다.
import type { LineProvider, LineCtx, Line } from '../hq/lines';
import type { StageHooks } from '../stage/module';
import type { AgentId } from './types';
import { AGENTS, agentLine, EVAC_PAIRS } from './lines/agents';
import { CALLS, FAVOR_LINES } from './lines/elevator';
import { CAST } from './cast';

const pick = <T>(xs: readonly T[], r: () => number) => xs[Math.floor(r() * xs.length) % xs.length];
const isAgent = (a: string): a is AgentId => a in AGENTS;
const nameOf = (a: string) => (isAgent(a) ? AGENTS[a].name : a);
const J = CAST.jaemtri.name;
const K = CAST.konjyuce.name;
const D = CAST.dejure.name;
const G = CAST.gognija.name;

/** 본부 말칸. 태그는 hq/lines.ts 머리말. 모르는 태그는 null → 본부 기본 문장 */
export const hqLines: LineProvider = (tag, c) => {
  const r = c.rand;
  const a = c.agent as string;
  const me = (text: string): Line => ({ who: c.agentName || nameOf(a), text });
  const t = (who: string, ...xs: string[]): Line[] => [{ who, text: pick(xs, r) }];
  const male = a === 'gorgodio' || a === 'kyuras';
  const boss = a === 'jyaldi';
  switch (tag) {
    case 'npc:jaemtri':
      // 잼트리는 부장(쟈알디)에게만 존댓말, 나머지 요원에게는 「후배」 반말 (위키 「잼트리」)
      if (boss) return t(J, '부장님, 태블릿에 새 글 올라왔어요. 보실래요?', '부장님, 블랙 내려 뒀어요. …연유 조금만 넣어 볼까요?', '출동 전에 규칙서 한 번만 더 보세요. 진짜로요.', '서류는 제가 정리할게요. 부장님은 고르기만 하세요.');
      return t(J, '어머, 후배, 왔어? 커피 먼저 할래, 일 먼저 할래?', '태블릿에 새 글 올라왔어. 볼래?', '우리 후배 고생했지~ 자, 서류부터.', '출동 전에 규칙서 한 번만 더 봐. 진짜로.', '연유 커피 남았는데, 마실래? 그건 이견이 없어.');
    case 'npc:chief':
      if (a === 'jyaldi') return [{ who: '', text: '부장실. 주인은 지금 밖에 나와 있다. 재떨이는 비어 있다.' }];
      return t(nameOf('jyaldi'), '목표 달성하면 바로 로프. 다들 살아서 와. 이상.', '보고서는 짧게.', '…블랙.');
    case 'npc:supply':
      if (boss) return t(K, '부장님! 오늘 뭐 챙겨 가세요?', '아이템 네 칸, 유물 두 칸이요. 부장님은 아시죠?', '부장님, 저도 이 팀 정식 멤버거든요! 마스코트 아니에요!');
      return male ? t(K, '아저씨, 오셨어요? 아, 아니 오빠!', '오빠, 안녕하세요! 오늘 뭐 챙겨 가요?', '아이템 네 칸, 유물 두 칸이요. 무거운 건 제가 들어 드릴게요.') : t(K, '선배님, 오셨어요?', '언니! 오늘 뭐 챙겨 가요?', '아이템 네 칸, 유물 두 칸이요. 무거운 건 제가 들어 드릴게요.', '저도 이 팀 정식 멤버거든요! 마스코트 아니에요!');
    case 'npc:appraisal':
      if (a === 'spangdal') return [{ who: D, text: '아, 아와와…!' }, { who: nameOf('spangdal'), text: `${D}. 그 애, 원래 내 후배였지. 미안해. 후후.` }];
      return t(D, '아, 아와와…! 아, 요원님이시구나… 죄송해요…', '저기… 그… 회수물… 있으세요…?', '본 적 있는 걸 다시 보여 드릴 수 있어요. 진술로 복원한 거라… 조금 달라요.');
    case 'npc:lab':
      return t(G, '왔는가! 데쥬레!!! 커피 좀 타 오게! 달달한 걸로, 빨리!!!', '오오! 살아 돌아왔군! 훌륭하네! 표본은 가져왔나?', '차원 승강기 말인가! 인사하면 대우가 달라진다니, 예절을 아는 의식이란 말일세!', '감정한 자료가 쌓이면 연구가 진행되네! 유물, 강화, 위험 단계! 전부 여기서 나오지!');
    case 'npc:office':
      if (c.fatigue >= 2) return [me('…또 나가? 좀 쉬고 싶은데.')];
      return isAgent(a) ? [me(agentLine(a, 'offer', r) ?? '갈 데 있으면 불러.')] : null;
    case 'npc:pantry':
    case 'pantry:chat':
      return pantry(a, r);
    case 'brief:jaemtri':
      return [
        { who: J, text: c.rules?.length ? `${boss ? '알려진 규칙부터 읽어 드릴게요.' : '알려진 규칙부터 읽어 줄게.'} ${c.rules.slice(0, 2).join(' / ')}` : boss ? '아직 아는 규칙이 별로 없어요. 들어가시면 벽부터 읽으세요.' : '아직 아는 규칙이 별로 없어. 들어가면 벽부터 읽어.' },
        ...(c.variantHint ? [{ who: J, text: c.variantHint }] : []),
      ];
    case 'brief:chief':
      if (a === 'jyaldi') return [{ who: J, text: '부장님이 직접 가시니까 지시는 생략할게요. …담배는 밖에서 끄고 가세요.' }];
      return [{ who: nameOf('jyaldi'), text: `목표: ${c.mission ?? '조사'}. 달성하면 바로 로프. 다들 살아서 와. 이상.` }];
    case 'brief:reply':
      return isAgent(a) ? [me(agentLine(a, 'brief', r) ?? '확인.')] : null;
    case 'return:return':
      return [{ who: J, text: boss ? '부장님, 오셨어요? 살아서 오셨네요. 그럼 됐어요.' : '어머, 후배, 왔어? 살아서 왔네. 그럼 됐어.' }, ...(isAgent(a) ? [me(agentLine(a, 'settle', r) ?? '…')] : [])];
    case 'return:withdraw':
      return [{ who: J, text: boss ? '철수하셨네요. 잘하셨어요. 돌아오는 것도 일이에요.' : '철수했구나. 잘했어. 돌아오는 것도 일이야.' }, ...(isAgent(a) ? [me(agentLine(a, 'settle', r) ?? '…')] : [])];
    case 'return:evac':
    case 'evac:wake': {
      const out: Line[] = [{ who: '', text: '의무실. 형광등. 소독약 냄새.' }];
      const pair = isAgent(a) ? EVAC_PAIRS[a] : undefined;
      if (pair?.length) {
        const p = pick(pair, r);
        out.push({ who: p.by === 'jaemtri' ? J : nameOf(p.by), text: p.lines[0] }, me(p.lines[1]));
      }
      out.push({ who: J, text: boss ? '송신하신 정보는 다 받았어요. 나머지는 절반. 괜찮아요. 다음에 또 가시면 돼요.' : '송신한 정보는 다 받았어. 나머지는 절반. 괜찮아. 다음에 또 가면 돼.' });
      return out;
    }
  }
  if (tag.startsWith('tired:')) return [{ who: nameOf(tag.slice(6)), text: '…오늘은 좀 쉴게.' }];
  return null;
};

function pantry(a: string, r: () => number): Line[] {
  const n = nameOf;
  if (a === 'spangdal') return [{ who: n('spangdal'), text: `있잖아, ${J}. ${D} 아직도 나 보면 펄쩍 뛰어?` }, { who: J, text: '응. 오늘 아침에도.' }, { who: n('spangdal'), text: '후후. 귀여워.' }, { who: J, text: '스팡달, 입.' }];
  if (a === 'gorgodio' || a === 'kyuras') return [{ who: n('kyuras'), text: '형님이 앞에서 다 받아 주니까 편하지!' }, { who: n('gorgodio'), text: '니가 뒤에서 다 태워 주니까 편하지.' }];
  if (a === 'eileen') return [{ who: K, text: '언니, 그거 뭐예요? 저도 해 봐도…' }, { who: n('eileen'), text: '만지지 마.' }, { who: K, text: '저도 정식 멤버거든요!' }];
  if (a === 'deadpole' || a === 'geshugan' || a === 'rojemon') return [{ who: n('deadpole'), text: '게슈간 씨, 타자 연습 오늘도 하실 거예요?' }, { who: n('geshugan'), text: '…안 해.' }, { who: n('rojemon'), text: '해. 보고서 나 혼자 쓰기 싫어.' }];
  return pick(
    [
      [{ who: J, text: '부장님, 연유 커피 한 번만 드셔 보세요. 한 모금만.' }, { who: n('jyaldi'), text: '블랙.' }],
      [{ who: D, text: '미, 믹스커피가 제일이에요…' }, { who: G, text: '믹스는 진리일세!!! 블랙 마시는 자는 설탕 두 스푼 추가일세!!!' }],
    ],
    r,
  );
}

type PassengerKind = 'three_years' | 'markers' | 'supply' | 'nothuman' | 'missing';

/** 층 모듈 대사 자리: 승강기 호명·요원 반응, 떠도는 승객. 결과(정직·거짓 효과)는 층 모듈이 정한다 */
export function stageHooks(): StageHooks {
  return {
    elevator: {
      // n: 이번 출동 탑승 횟수. 첫 번째는 사적인 호명, 그 뒤로는 총애에 따라
      callout(agent, favor, n) {
        if (!isAgent(agent)) return null;
        if (n <= 1 || favor === 0) return CALLS[agent][(n - 1 + CALLS[agent].length) % CALLS[agent].length];
        const list = favor > 0 ? FAVOR_LINES[agent].high : FAVOR_LINES[agent].low;
        return list[n % list.length] ?? null;
      },
      reaction(agent) {
        return isAgent(agent) ? (agentLine(agent, 'enter_elevator') ?? null) : null;
      },
    },
    passenger: {
      talk(kind: PassengerKind, honest, long) {
        switch (kind) {
          case 'three_years':
            return long
              ? ['나 여기 삼 년째야. 처음엔 정장 입은 사람들이랑 같이 왔어. 다섯 명이었지. 첫 층에서 하나, 추격하는 층에서 둘을 잃었어. 그 뒤로 문을 하나하나 다 열어 봤어.', '아무튼 내 말 들어. 진짜야. 믿어도 돼.']
              : ['나 여기 삼 년째야. 그러니까 내 말 들어.', honest ? '저쪽 문 말고 이쪽.' : '다음 버튼은… 내가 알아.'];
          case 'markers':
            // 표시 뜻은 층 모듈 규칙과 같아야 한다 (줄 하나 = 위험, 빈 동그라미 = 쉼터)
            return ['쉿. 벽 봤어? 우리가 남긴 거야.', '동그라미 안에 줄 하나면 위험, 비어 있으면 쉼터. 너희도 남겨. 다음 사람을 위해서.'];
          case 'supply':
            return long ? ['배낭 무거워 보이네. 다락방에 숨겨 둔 게 있는데, 같이 가면 나눠 줄게. 정말이야, 나 혼자 다 못 먹어.'] : ['다락방 오른쪽 구석에 약이랑 손전등 숨겨 놨어. 가져가. 나는 이제 필요 없어.'];
          case 'nothuman':
            return ['…………', '(벽에 기대 선 승객. 숨을 쉬지 않는다. 얼굴을 보려 하면 고개가 같이 돈다)'];
          case 'missing':
            // 층 모듈은 정직 여부와 상관없이 따라오게 한다. 늦은 구조(사람이 아니게 됨)는 아직 층 쪽에 없다
            return ['…관리국? 진짜요? 저 그냥 야근하고 집에 가려고…', '몇 층인지 모르겠어요. 계속 내려가기만 했어요. 같이 나가게 해 주세요.'];
        }
        return null;
      },
    },
  };
}

export type { LineCtx };
