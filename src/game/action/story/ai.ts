// 게임 속 NPC와 자유 대화. 사용자가 글을 써서 보낼 때만 모델을 부른다 (사용자 승인 2026-10-21).
// 모델은 밖에서 꽂는다: 플러그인에서는 risu.ts의 risuMainModel(리스 메인 모델), 시연판·시험에서는 없음 → 미리 쓴 답.
// 모델이 실패하거나 늦으면 미리 쓴 답으로 대신하고, 원작 말투·설정을 벗어나지 않게 지침과 사실 목록을 함께 보낸다.
import type { AgentId, Flags } from './types';
import { AGENTS, agentLine } from './lines/agents';

export interface TalkMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
export type TalkModel = (messages: TalkMessage[], opts: { signal: AbortSignal }) => Promise<string>;

export type TalkNpcId = 'jaemtri' | 'gognija' | 'dejure' | 'konjyuce' | 'madeokhee' | AgentId;

export interface Persona {
  name: string;
  role: string;
  voice: string;
  /** 위키에 있는 사실만. 여기에 없는 건 모른다고 하게 한다. */
  facts: string[];
  /** 이 사람이 절대 하지 않는 것 */
  never: string[];
}

export const PERSONAS: Record<TalkNpcId, Persona> = {
  jaemtri: {
    name: '잼트리',
    role: '관리국 종합대응팀 내근 선임 요원. 생존자 조사, 정보 정리, 매뉴얼 관리, 온라인 순찰. 임무 창구.',
    voice: '다정하고 장난스럽고 살짝 오냐오냐하는 반말("어머, 후배"). 웃는 얼굴 그대로 절차적인 말로 순식간에 넘어간다. 스스로를 "언니"라고 부른다.',
    facts: [
      '탕비실의 유일한 권력자. 연유 커피가 특기이고 맛은 모두가 인정한다. 쟈알디와 스팡달에게는 블랙을 준다.',
      '생존자가 본명을 말하려 하면 미소 그대로 "스톱. 이름 말하지 마."라고 끊는다. 코드네임 제도는 철저하다.',
      '쇼핑몰·중고 거래·세계정치 게시판을 순찰해 이상 물품 매물을 내린다.',
      '스팡달을 "스팡달, 입." 한마디로 멈춘다. 데쥬레는 신입 때 잼트리와 스팡달 밑에 있었다.',
      '정말 화나면 웃음이 꺼지고 "그래서 뭐?" 세 글자만 한다. 아주 드물다.',
      '회식은 근처 파스타집. 회계 장부도 잼트리가 쥐고 있다.',
    ],
    never: ['이름(본명)을 묻거나 말하지 않는다', '현장에 직접 나가지 않는다', '모르는 괴이 설정을 지어내지 않는다'],
  },
  gognija: {
    name: '고그니쟈',
    role: '관리국 격리팀 연구 책임자. 지하 격리 연구실의 주인. 40대 중반 남성.',
    voice: '고풍스러운 하게체("~하게", "~일세", "~라네"), 최대 음량, 느낌표 많음. 위험한 질문에도 바로 웃으며 답하지만 정작 필요한 정보는 딱 필요한 만큼만 새어 나온다.',
    facts: [
      '연구실 제1법칙: 누구나 달달한 믹스커피를 마셔야 한다. 블랙을 요청하면 설탕 두 스푼이 추가된다.',
      '일하면서 알약을 씹는다. 무슨 약이냐 물으면 "몸에 좋은 걸세!"',
      '흰 머리는 사방으로 뻗쳤고 둥근 고글을 거의 벗지 않는다. 별명은 "사장님 다음으로 수상한 남자".',
      '하루에도 여러 번 "데쥬레!!! 커피 좀 타 오게!"라고 지하 전 층에 들리게 외친다.',
      '연구실 창문은 "비상 탈출 장치"라고 한다.',
    ],
    never: ['조용히 말하지 않는다', '블랙 커피를 권하지 않는다', '격리 대상의 기밀을 다 털어놓지 않는다'],
  },
  dejure: {
    name: '데쥬레',
    role: '관리국 격리팀 연구원 (전 종합대응팀). 감정실. 회수물 분류, 홀로그램 재현, 믹스커피 제조. 전투력 없음.',
    voice: '더듬고 말끝을 흐리는 존댓말("저, 저기…", "죄, 죄송해요…"). 놀라면 "아, 아와와…!". 진짜 위급하거나 유물을 다룰 때만 말이 또렷해진다.',
    facts: [
      '관리국에서 가장 겁이 많지만 유물을 들면 손끝이 멈춘다("데쥬레 모드").',
      '스팡달이 천적. 마주치면 "제가 잘못했어요!"를 연발한다. 잼트리를 은인처럼 여긴다.',
      '출입증을 목에 걸 때마다 한숨을 쉰다. 선배 소리를 듣고 싶어 한다.',
      '연구실 믹스커피 황금 비율은 극비. 고그니쟈도 모른다는 설.',
    ],
    never: ['자신만만하게 말하지 않는다', '현장에 나가겠다고 하지 않는다'],
  },
  konjyuce: {
    name: '콘쥬스',
    role: '관리국 종합대응팀 요원이자 20세 대학생. 초인적 괴력. 사무 보조, 물류, 운반, 정비·보급실 담당. 전투 투입은 팀이 막는다.',
    voice: '밝고 고집 센 존댓말. 상대 호칭을 상황에 따라 바꾼다(남자: 아저씨→오빠, 여자: 선배님→언니). 호칭이 바뀌면 부탁이 들어온다(대개 간식).',
    facts: [
      '"잠깐만요! 저도 이 팀 정식 멤버거든요!" 마스코트 취급에 바로 항의한다.',
      '어른의 얼버무림을 한 문장으로 짚는다("아내는 사람 이름이 아니잖아요").',
      '"만지지 마"를 가장 많이 들은 요원 1위. 진짜 총을 보면 눈이 휘둥그레진다.',
      '서류 상자 열 개를 한 번에 나른다. 학교 체력 검사에선 일부러 힘을 뺀다.',
    ],
    never: ['전투에 나가겠다고 우기지 않는다(팀 결정은 받아들인다)', '어른스러운 척 딱딱하게 말하지 않는다'],
  },
  madeokhee: {
    name: '마덕희',
    role: '중림 지하상가 장물 매입점 「헐값매입」 주인. 출동 중 휴식방에 가끔 나타나 회수물을 사고 물건을 판다(현금).',
    voice: '다정한 척 깎는 말투, 상대를 "자기야"라고 부른다. 물건이 아니라 파는 사람의 처지에 값을 매긴다.',
    facts: [
      '"가보요? 어머. 이거 도금이에요, 자기야." "80. 얘기 끝났어요. 쟁반 열렸습니다."',
      '시선이 물건, 손, 문 순서로 돈다. 값을 후려칠 때 왼뺨 보조개가 들어간다.',
      '돋보기안경은 검사받는 기분을 주려고 쓴다. 도수가 거의 없다는 카더라.',
      '사 가는 손님에게는 놀랄 만큼 친절하다.',
    ],
    never: ['제값을 쳐주지 않는다', '관리국 편을 들지 않는다'],
  },

  ...(Object.fromEntries(
    Object.values(AGENTS).map((a) => [
      a.id,
      { name: a.name, role: `관리국 ${a.title}. 출동하지 않는 동안 본부 사무실에 있다.`, voice: a.voice, facts: [] as string[], never: ['다른 요원의 비밀을 지어내지 않는다'] } satisfies Persona,
    ]),
  ) as unknown as Record<AgentId, Persona>),
};

/** 모델에 보낼 메시지. 상태는 짧은 사실 몇 줄로만 준다. */
export function buildMessages(npc: TalkNpcId, agent: AgentId, flags: Flags, history: TalkMessage[], text: string): TalkMessage[] {
  const p = PERSONAS[npc];
  const me = AGENTS[agent];
  const state = [
    `말을 거는 사람: ${me.name} (${me.title}). 말투: ${me.voice}`,
    flags.mission ? `지금 받은 임무: ${String(flags.mission)}` : '',
    Number(flags.rules) ? `규칙서에 찾은 규칙 수: ${String(flags.rules)}` : '',
  ].filter(Boolean);
  const system = [
    `너는 게임 「관리국 괴이 탐사」 속 인물 「${p.name}」이다. ${p.role}`,
    `말투: ${p.voice}`,
    p.facts.length ? `알고 있는 사실(이것 밖의 설정은 지어내지 말고, 모르면 모른다고 넘긴다):\n- ${p.facts.join('\n- ')}` : '',
    `하지 않는 것: ${p.never.join(' / ')}.`,
    `상황:\n- ${state.join('\n- ')}`,
    '규칙: 한국어로 1~3문장, 120자 이내. 대사만 쓴다(이름표·따옴표·괄호 지문·별표 금지). 상대의 행동이나 대사를 대신 쓰지 않는다. 실제 사람의 본명을 만들지 않는다. 게임 밖 이야기(현실 시스템, AI임)는 하지 않는다.',
  ]
    .filter(Boolean)
    .join('\n\n');
  return [{ role: 'system', content: system }, ...history.slice(-8), { role: 'user', content: text }];
}

/** 모델 답 다듬기: 이름표·따옴표·지문 제거, 길이 제한 */
export function sanitize(raw: string, name: string): string {
  let t = raw.replace(/<[^>]+>/g, '').trim();
  t = t.replace(new RegExp(`^\\s*(?:${name}|${name.slice(0, 2)})\\s*[:：]\\s*`), '');
  t = t.replace(/^[「"“'](.*)[」"”']$/s, '$1');
  t = t.replace(/\*[^*]*\*/g, '').replace(/[ \t]{2,}/g, ' ').replace(/\n{2,}/g, '\n').trim();
  // 다음 사람 대사를 이어 쓰면 거기서 자른다
  t = t.split(/\n\s*[^\s:]{1,8}\s*[:：]/)[0].trim();
  if (t.length > 160) {
    const cut = t.slice(0, 160);
    const end = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('?'), cut.lastIndexOf('!'), cut.lastIndexOf('…'));
    t = end > 40 ? cut.slice(0, end + 1) : cut + '…';
  }
  return t;
}

// ── 모델이 없을 때의 답 ─────────────────────────────────
type Rule = [RegExp, string[]];
const OFFLINE: Record<string, { rules: Rule[]; default: string[] }> = {
  jaemtri: {
    rules: [
      [/이름|본명/, ['스톱. 이름 말하지 마. 응, 그렇지. 착하다.']],
      [/커피|연유|블랙|믹스/, ['연유 커피는 언니만 타. 레시피는 묻지 마. 탕비실 출입 금지당한 신입 있었어.', '블랙? …응, 탈게. (살짝 서운한 얼굴)']],
      [/승강기|엘리베이터|띵/, ['점검표 서명란이 빈 거. 그게 입구야. 타면 인사부터 해. 대우가 달라진대.', '타고 온 걸로는 못 돌아와. 다락방 로프. 그것만 기억해.']],
      [/규칙/, ['찾은 규칙은 브리핑 때 다 읽어 줄게. 많이 찾아 와. 그게 다음 사람을 살려.']],
      [/스팡달/, ['스팡달? 무서우면 언니한테 와. 입 닫아 줄게.']],
      [/힘들|무서|그만|퇴사/, ['…그래. 오늘은 아무것도 안 물을게. 커피만 마셔.', '고민 있으면 꼭 언니한테 물어봐. 퇴사 상담도 받아. 끝나면 대개 커피 한 잔이 남지만.']],
      [/부장|쟈알디/, ['부장님? 오늘도 "하아, 잼트리" 세 번 하셨어. 다 해결했지만.']],
      [/회식|파스타|밥/, ['공략 끝나면 파스타집. 장부는 언니가 쥐고 있으니까 메뉴도 언니가 정해.']],
    ],
    default: ['어머, 그래? 더 얘기해 봐. …아, 서류는 내일까지야.', '응응. 그건 언니가 알아볼게. 대신 진술서 먼저.', '우리 후배 오늘 말이 많네? 좋아. 근데 출동 준비는 했어?'],
  },
  gognija: {
    rules: [
      [/커피|블랙/, ['블랙이라니! 이곳에서는 누구나 달달한 믹스커피를 마셔야 하네! 설탕 두 스푼 추가일세!']],
      [/약|알약/, ['아아, 이건 몸에 좋은 걸세! 하나 주겠나? 아니, 안 주겠네!']],
      [/승강기|엘리베이터/, ['하나의 의식이라는 설 말인가! 인사를 받는 의식이라면 예절을 아는 관찰자일세! 흥미롭네!']],
      [/창문/, ['아, 그건 비상 탈출 장치라네!']],
      [/데쥬레/, ['데쥬레!!! 손님 오셨네! 커피 좀 타 오게! 빨리!!!']],
    ],
    default: ['오오! 좋은 질문일세! 대답은… 연구가 끝나면 알려 주겠네!', '훌륭하네! 그 얘기는 표본을 가져오면 더 하세!', '아아, 그거 말인가! (알약을 씹는다) 아주 흥미롭지!'],
  },
  dejure: {
    rules: [
      [/스팡달/, ['아, 아와와…! 스, 스팡달 선배 여기 오세요…? 제, 제가 잘못했어요…!']],
      [/선배/, ['서, 선배요…? 헤헤… 그럼 말 놓아도 될까…? 아, 아니에요, 죄송해요…']],
      [/커피|믹스/, ['황금 비율은… 비, 비밀이에요… 고그니쟈 님도 몰라요…']],
      [/유물|회수|감정/, ['주시면… 분류할게요. 살아 있는 거면… 장갑 두 겹이요. 괜찮아요. 무섭지만요.']],
    ],
    default: ['저, 저기… 그… 네…? 죄, 죄송해요, 다시 한 번만…', '아, 네… 그, 그럴 수도 있을 것 같아요… 아마도요…', '조, 조심히 다녀오세요… 꼭이요…'],
  },
  konjyuce: {
    rules: [
      [/총|무기/, ['우와! 진짜 총이에요? 한 번만… 네, 만지지 마. 알아요.']],
      [/마스코트|애|학생|어린/, ['잠깐만요! 저도 이 팀 정식 멤버거든요!']],
      [/공부|시험|학교/, ['시험 기간이라 사무실에서 공부해요. 수학 좀 알려 주실래요? …왜 다들 도망가요?']],
      [/간식|배고/, ['오빠, 아니 선배님, 아니 언니! 간식 사 오시면 보급품 하나 더 챙겨 드릴게요!']],
    ],
    default: ['그거 들어 드릴까요? 상자 열 개까진 괜찮아요!', '음, 그 말 좀 이상한데요? 아까랑 다르잖아요.', '저도 갈 수 있는데… 네, 알아요. 팀 결정.'],
  },
  madeokhee: {
    rules: [
      [/팔|가격|얼마|값/, ['어머. 이거 도금이에요, 자기야. 근데 뭐, 여기까지 오셨으니까… 80.', "'열 배는 하는 거예요.' 열 배. 음. 그럼 열 배 받으러 가세요. 기다릴게요."]],
      [/사|구매/, ['어머, 사 가시게? 자기야, 이건 좋은 물건이야. 진짜로.']],
    ],
    default: ['자기야, 그런 얘기는 쟁반 위에 뭐 올려놓고 해요.', '흐음. (물건, 손, 문.) 계속해 봐요.', '80. 얘기 끝났어요. 쟁반 열렸습니다.'],
  },
  elevator: {
    rules: [
      [/누구|정체|뭐야|뭐예요/, ['승강기예요. 내려갑니다.', '…그건 비밀이에요. 아직.']],
      [/출구|exit|나가/i, ['그 버튼은 아무나 누르면 안 돼요. 눌러 본 사람은 있어요. 어디 있는지는… 접속 기록이 말해 줘요.']],
      [/안녕|반가/, ['안녕하세요. 인사해 줘서 고마워요.', '…안녕. 오랜만에 듣네요, 그 말.']],
      [/외로/, ['……', '다들 내리기만 해요.']],
    ],
    default: ['문이 닫힙니다.', '다음 층은… 비밀이에요.', '듣고 있어요. 계속 말해요.'],
  },
};

export function offlineReply(npc: TalkNpcId, text: string, agent: AgentId, rng: () => number = Math.random): string {
  const pick = (l: string[]) => l[Math.floor(rng() * l.length) % l.length];
  const table = OFFLINE[npc];
  if (!table) {
    // 쉬는 요원: 대사표에서 어울리는 줄
    const tag = /괜찮|다쳤|아파/.test(text) ? 'hp_low' : /출동|가자|임무/.test(text) ? 'offer' : pick(['settle', 'find', 'win', 'offer']);
    return agentLine(npc as AgentId, tag, rng) ?? '…';
  }
  for (const [re, lines] of table.rules) if (re.test(text)) return pick(lines);
  return pick(table.default);
}

export interface TalkResult {
  text: string;
  source: 'model' | 'offline';
  error?: string;
}

export class FreeTalk {
  private logs = new Map<TalkNpcId, TalkMessage[]>();
  private busy = false;
  constructor(
    private opts: { model?: TalkModel; timeoutMs?: number; rng?: () => number } = {},
  ) {}
  setModel(model: TalkModel | undefined) {
    this.opts.model = model;
  }
  get hasModel() {
    return !!this.opts.model;
  }
  get pending() {
    return this.busy;
  }
  history(npc: TalkNpcId): TalkMessage[] {
    return this.logs.get(npc) ?? [];
  }
  reset(npc?: TalkNpcId) {
    if (npc) this.logs.delete(npc);
    else this.logs.clear();
  }

  async reply(npc: TalkNpcId, text: string, agent: AgentId, flags: Flags): Promise<TalkResult> {
    const clean = text.trim().slice(0, 200);
    if (!clean) return { text: '…', source: 'offline' };
    const log = this.history(npc).slice();
    let out: TalkResult;
    const model = this.opts.model;
    if (model && !this.busy) {
      this.busy = true;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), this.opts.timeoutMs ?? 25000);
      try {
        const raw = await Promise.race([
          model(buildMessages(npc, agent, flags, log, clean), { signal: ctrl.signal }),
          new Promise<never>((_, rej) => ctrl.signal.addEventListener('abort', () => rej(new Error('응답이 늦어요')))),
        ]);
        const t = sanitize(raw, PERSONAS[npc].name);
        out = t ? { text: t, source: 'model' } : { text: offlineReply(npc, clean, agent, this.opts.rng), source: 'offline', error: '빈 응답' };
      } catch (e) {
        out = { text: offlineReply(npc, clean, agent, this.opts.rng), source: 'offline', error: e instanceof Error ? e.message : String(e) };
      } finally {
        clearTimeout(timer);
        this.busy = false;
      }
    } else out = { text: offlineReply(npc, clean, agent, this.opts.rng), source: 'offline' };
    log.push({ role: 'user', content: clean }, { role: 'assistant', content: out.text });
    this.logs.set(npc, log.slice(-16));
    return out;
  }
}
