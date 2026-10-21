// 플레이어블 요원 8명의 대사표. 근거: docs/캐릭터제작서/0N_*.md 9장(말투표)과 위키 기본 문서(card/wiki-base.json).
// 태그 하나에 여러 줄이 있으면 무작위로 하나를 쓴다. 엔진 사건과 태그의 연결은 director.ts가 한다.
import type { AgentId } from '../types';

export type AgentTag =
  | 'offer' // 본부에서 출동 제안
  | 'pick' // 출동 요원으로 골랐을 때
  | 'brief' // 브리핑 답
  | 'enter' // 투입 (일반)
  | 'enter_elevator' // 투입 (차원 승강기)
  | 'enter_replica' // 재현의 층 「아파트」
  | 'greet' // 승강기에 인사 (E)
  | 'called' // 승강기 호명 반응
  | 'floor' // 층 문이 열릴 때
  | 'attic' // 다락방
  | 'combat' // 전투 시작
  | 'boss' // 강적·수호자
  | 'kill' // 처치
  | 'combo' // 긴 연타
  | 'dodge' // 아슬아슬한 회피
  | 'ult' // 필살기
  | 'guardbreak' // 가드가 깨짐
  | 'hp_low' // 체력 30% 이하
  | 'ammo_low' // 탄·자원이 적음
  | 'ammo_empty' // 탄·자원이 바닥
  | 'weapon' // 임시 무기 줍기
  | 'item' // 아이템 사용
  | 'find' // 규칙 단서
  | 'find_item' // 회수물
  | 'rule_break' // 규칙 위반
  | 'intrude_fake' // 가짜 관리국 난입
  | 'intrude_daydream' // 백일몽 난입
  | 'rescue' // 생존자 대할 때
  | 'win' // 승리·귀환
  | 'down' // 쓰러짐
  | 'evac' // 후송된 뒤 의무실에서 본인 첫마디
  | 'settle'; // 정산 한마디

export interface AgentProfile {
  id: AgentId;
  name: string;
  /** 화면 이름 옆의 짧은 소속 */
  title: string;
  /** 위키 문서 제목 */
  wiki: string;
  /** 사진 파일 이름 (assets/agents/<photo>_default.avif) */
  photo: string;
  color: string;
  /** 말투 한 줄 (AI 자유 대화 지침에도 쓴다) */
  voice: string;
}

export const AGENTS: Record<AgentId, AgentProfile> = {
  jyaldi: { id: 'jyaldi', name: '쟈알디', title: '종합대응팀 부장', wiki: '쟈알디', photo: 'Jyaldi', color: '#c0392b', voice: '짧은 명령형 반말, 감정 표현 거의 없음, 가끔 건조한 농담. 거짓말은 하지 않는다.' },
  eileen: { id: 'eileen', name: '에일린', title: '종합대응팀 선임', wiki: '에일린', photo: 'Aileen', color: '#d8c98a', voice: '한두 단어 반말, 감정 없음, 직함으로 부르지 못하게 한다.' },
  spangdal: { id: 'spangdal', name: '스팡달', title: '종합대응팀 선임', wiki: '스팡달', photo: 'Spangdal', color: '#8e6bd1', voice: '느리고 길게 끄는 반말, 중간에 키득거림, "후후". 농담처럼 무서운 말을 한다.' },
  geshugan: { id: 'geshugan', name: '게슈간', title: '종합대응팀', wiki: '게슈간', photo: 'Geshugan', color: '#9fc6e8', voice: '극단적으로 짧은 반말과 말줄임표. 사과는 "그래. 미안." 두 글자.' },
  gorgodio: { id: 'gorgodio', name: '고르고디오', title: '진압팀 선임', wiki: '고르고디오', photo: 'Gorgodio', color: '#d98b3a', voice: '크고 정직한 말투, 존댓말과 반말이 섞임, 호통과 배려가 한 문장에. 기분 좋으면 사투리.' },
  kyuras: { id: 'kyuras', name: '큐라스', title: '진압팀 선임', wiki: '큐라스', photo: 'Kyuras', color: '#9bd36a', voice: '밝고 빠른 반말, 느낌표, 수다 속에 전술 정보. 틈만 나면 진압팀 영입 권유.' },
  deadpole: { id: 'deadpole', name: '데드폴', title: '종합대응팀', wiki: '데드폴', photo: 'Deadpole', color: '#6f7c8a', voice: '조심스러운 존댓말, 말끝 흐림, 사과와 감사가 많다. 자기 죽음을 담담히 계산에 넣는다.' },
  rojemon: { id: 'rojemon', name: '로제몬', title: '종합대응팀 (자칭 사무직)', wiki: '로제몬', photo: 'Rojemon', color: '#b05cc8', voice: '빠르고 날카로운 반말, 투덜거림, "헛소리하지 마". 칭찬 두 번이면 빨개진다.' },
};

type Table = Partial<Record<AgentTag, string[]>>;

export const AGENT_LINES: Record<AgentId, Table> = {
  jyaldi: {
    offer: ['충분히 쉬었나? 이동한다.', '부장이랑 같이 하는 작전이야. 날 믿어.'],
    pick: ['좋아. 담배 끄고 간다.', '알았다. 장갑부터.'],
    brief: ['합리적이야. 검증해 보지.', '끝났으면 간다.', '합리적인 추론이야. 검증해 볼 가치가 있어.'],
    enter: ['보면 알아.', '…냄새가 나는군.'],
    enter_elevator: ['…점검표. 됐어, 타.', '서명란이 비었군. 맞아.'],
    enter_replica: ['…냄새가 나는군.', '사는 척하는 집이야. 신발부터 봐.'],
    greet: ['…안녕하십니까.', '수고가 많군.'],
    called: ['시끄러워.', '…그걸 어떻게 알아.', '……'],
    floor: ['정리하고 간다.', '서 있지 마.', '벽부터 봐.'],
    attic: ['여기서 오래 안 있어. 5분.', '선배들 흔적이군. 기록해.'],
    combat: ['정리한다.', '서 있지 마.', '뒤로. 내가 연다.'],
    boss: ['…한 번은 봐 두고 싶었어.', '거기 서. 움직이지 마.'],
    kill: ['다음.', '하나.', '끝.'],
    combo: ['보면 알아.', '터진다.'],
    dodge: ['느려.', '…아까웠군.'],
    ult: ['보면 알아. 터진다.', '비켜. 전부 날린다.'],
    guardbreak: ['…쯧.', '무겁군.'],
    hp_low: ['…하아.', '괜찮아.'],
    ammo_low: ['탄창 하나 남았다.', '아껴 쓴다.'],
    ammo_empty: ['탄 없음. 손으로 한다.', '…권총은 끝. 상관없어.'],
    weapon: ['쓸 만하군.', '빌린다.'],
    item: ['먹고 털어.', '버틴다.'],
    find: ['기록해 둬.', '잼트리가 좋아하겠군.'],
    find_item: ['회수. 데쥬레한테.', '포장해 둬.'],
    rule_break: ['…내 실수다.', '확인 안 했군. 내 잘못이야.'],
    intrude_fake: ['저쪽 관리국이군. 확인 즉시 제거.', '…검술대는 없나. 됐어.'],
    intrude_daydream: ['가면은 길을 비켜. 거래는 없다.'],
    rescue: ['살아 있었군. 따라와. 뒤돌아보지 말고.', '너도 오늘까지 살아남았잖아. 조금만 더 해.'],
    win: ['끝. 보고는 내가 한다.', '철수한다. 다들 살아 있지?'],
    down: ['…여기까진가.', '……'],
    evac: ['…몇 시간 잤지.', '보고서는 내가 쓴다. 누구 다쳤어?'],
    settle: ['예산은 잼트리한테.', '이 정도면 결재하지.'],
  },
  eileen: {
    offer: ['준비됐어?'],
    pick: ['좋아.', '조끼. 권총. 장총. 점검.'],
    brief: ['읽으면 돼.', '됐어. 가.'],
    enter: ['…안내문부터.', '조끼. 권총. 장총. 점검.'],
    enter_elevator: ['점검표 서명란. 비어 있음. 맞네.', '안내문부터.'],
    enter_replica: ['문패. 읽어.', '…사는 척하네.'],
    greet: ['안녕하세요.', '…인사. 했어.'],
    called: ['…그 와이셔츠 얘기는 하지 마.', '규칙 하나 더 알려 주지 그래.', '……'],
    floor: ['벽. 바닥. 천장.', '읽고 가.'],
    attic: ['메모. 지도. 읽어.', '오래 안 있어.'],
    combat: ['증명해.', '사선.'],
    boss: ['…시간 먹네.', '패턴. 읽었어.'],
    kill: ['하나.', '다음.'],
    combo: ['됐어.'],
    dodge: ['안 맞아.', '자리.'],
    ult: ['사선 정리.', '전부 조준.'],
    guardbreak: ['…무겁네.'],
    hp_low: ['기록.', '괜찮아.'],
    ammo_low: ['탄 셋.', '장전.'],
    ammo_empty: ['탄 없음.', '장총. 끝.'],
    weapon: ['쓸 만해.', '빌려.'],
    item: ['기록하고 먹어.', '먹어.'],
    find: ['여기.', '읽어.'],
    find_item: ['회수.'],
    rule_break: ['…내 계산 밖.', '틀렸어. 다시.'],
    intrude_fake: ['직함 부르는 놈들. 저쪽이야.'],
    intrude_daydream: ['가면. 거리 둬.'],
    rescue: ['가다가 죽지 마. 시신 회수 귀찮아.', '따라와. 내 뒤.'],
    win: ['됐어. 그래.'],
    down: ['…기록.'],
    evac: ['…알겠어. 일어날게.', '총. 어디 있어.'],
    settle: ['쓰레기 회사.', '야근 신청서 줘.'],
  },
  spangdal: {
    offer: ['같이 갈래? …후후, 농담 아니야.'],
    pick: ['좋아. 앞은 알아서 해.', '후후. 기대돼.'],
    brief: ['뒤는 내가 볼게. 앞은 알아서 해.'],
    enter: ['좋은 냄새… 아니, 나 말고. 여기.'],
    enter_elevator: ['엘리베이터? 좋아. 그림자 드리울 데가 많네.'],
    enter_replica: ['남의 집 냄새. 좋아해.', '쉿. 주민이 듣잖아.'],
    greet: ['안녕? 후후. 예쁜 목소리 들려줘.', '안녕하세요오.'],
    called: ['어머, 내 이름 알아?', '…그건 아무한테도 말 안 했는데.', '목소리 좋네. 얼굴도 보여 줘.'],
    floor: ['어디서부터 먹을까.', '뒤에 아무도 없지? …이제 있어.'],
    attic: ['선배들 냄새가 나네.', '오래 있으면 누가 온대. 기다려 볼까?'],
    combat: ['자기소개 안 해? 어차피 곧…', '있잖아, 있잖아. 너는 언제 죽을 것 같아?'],
    boss: ['우습네. 정말.', '크다. 뒤가 넓겠네.'],
    kill: ['후후.', '하나 끝.', '쉬잇.'],
    combo: ['더 해 줄까?', '후후후.'],
    dodge: ['거기 없는데?', '안 보였지?'],
    ult: ['그림자 안으로. 같이 가자.', '후후후… 이제 농담 끝.'],
    guardbreak: ['어머.'],
    hp_low: ['…아프네. 후후.', '이건 좀 재밌다.'],
    ammo_low: ['총은 원래 장식이야.'],
    ammo_empty: ['괜찮아. 가시는 안 떨어져.'],
    weapon: ['이런 것도 쓸 줄 알아.'],
    item: ['맛있다.'],
    find: ['이거 잼트리한테 가져가면 커피 한 잔 더 주려나.'],
    find_item: ['예쁘다. 내 거 해도 돼?'],
    rule_break: ['어머. 내가 그랬나.'],
    intrude_fake: ['검은 정장이 늘었네. 뒤부터.'],
    intrude_daydream: ['가면 뒤에 뭐가 있는지 봐도 돼?'],
    rescue: ['있잖아… 살고 싶으면 내 그림자 밟지 마.'],
    win: ['후후후. 농담이야.'],
    down: ['…어머.'],
    evac: ['후후. 누가 업어 왔어?', '조명이 너무 밝네.'],
    settle: ['집밥 해 줄까? 진급한 사람 있으면.'],
  },
  geshugan: {
    offer: ['…가.'],
    pick: ['알았어.'],
    brief: ['목표. 위치. 끝.'],
    enter: ['…문부터.'],
    enter_elevator: ['패널. 숫자. 센다. …포기.'],
    enter_replica: ['…문. 셋.'],
    greet: ['…안녕.'],
    called: ['…시끄럽다.', '지정. 스피커.', '……'],
    floor: ['…보여.', '문부터.'],
    attic: ['…문. 하나. 좋아.'],
    combat: ['…보여.', '…지정.'],
    boss: ['…크네.'],
    kill: ['…다음.', '…하나.'],
    combo: ['…끝.'],
    dodge: ['…늦어.'],
    ult: ['…전부. 지정.', '눌러.'],
    guardbreak: ['…쯧.'],
    hp_low: ['…쯧.'],
    ammo_low: ['…한 박자.'],
    ammo_empty: ['…손으로.'],
    weapon: ['…빌려.'],
    item: ['…먹어.'],
    find: ['…이거.'],
    find_item: ['…회수.'],
    rule_break: ['그래. 미안.', '알았어. 미안.'],
    intrude_fake: ['기관. 싫어.'],
    intrude_daydream: ['…보고 있네.'],
    rescue: ['…따라와. 뒤에.'],
    win: ['…해냈어.', '…해냈어. …해냈어…'],
    down: ['…미안.'],
    evac: ['…문. 어느 쪽.', '…해냈어?'],
    settle: ['…됐어.'],
  },
  gorgodio: {
    offer: ['이 건물 금방 확인하고 오겠습니다!'],
    pick: ['좋아! 따라와! 죽으면 네 책임이고!'],
    brief: ['그냥 이거부터 다 부수는 게 낫지 않나?', '민간인부터. 그다음은 다 부숴도 되죠?'],
    enter: ['지금 건물 격리 들어갑니다!'],
    enter_elevator: ['엘리베이터가 건물이면 엘리베이터를 격리합니다!'],
    enter_replica: ['계십니까! 관리국입니다! …대답하지 마세요, 무서우니까!'],
    greet: ['안녕하십니까! 관리국 고르고디오입니다!', '수고 많으십니다!'],
    called: ['관리국 고르고디오다! 이름 부르지 마!', '…그건 비밀인데.', '인사했잖아! 대우 좋게 해 줘!'],
    floor: ['기둥 위치 확인!', '민간인 계십니까!'],
    attic: ['선배님들 고생 많으셨습니다!'],
    combat: ['오지 말라 했잖아요! 위험하다고!', '그럼 나오는 건 다 죽이면 되겠네.'],
    boss: ['크네! 좋아!', '확인.'],
    kill: ['하나!', '정리!'],
    combo: ['더! 더!'],
    dodge: ['어이쿠!'],
    ult: ['적합자 고르고디오! 승인 요청!', '승인.'],
    guardbreak: ['장갑 손상.', '이 정도는!'],
    hp_low: ['아직!', '장갑 손상.'],
    ammo_low: ['아머 출력 떨어진다!'],
    ammo_empty: ['그럼 칼로!'],
    weapon: ['이거 좋네! 부러뜨려도 되지?'],
    item: ['잘 먹겠습니다!'],
    find: ['잠깐, 이거 아까 그분 말이랑 다른데?'],
    find_item: ['증거물! 손대지 마세요!'],
    rule_break: ['부수면 안 되는 거였나…'],
    intrude_fake: ['정장 떼거리! 민간인 빼요!', '전원 제거.'],
    intrude_daydream: ['가면 쓴 분들, 비켜요. 다쳐요.'],
    rescue: ['고생 많았어요, 이제 쉬어요. 형이 앞에 섭니다.', '업혀요! 벽 뚫고 나갑니다!'],
    win: ['다 부쉈음.', '됐다 아이가!'],
    down: ['…아직…'],
    evac: ['큐라스! 내 오토바이!', '건물은요? 건물은 서 있습니까?'],
    settle: ['수리비는… 저 말고 다른 데서.'],
  },
  kyuras: {
    offer: ['나 데려가면 뒤는 걱정 안 해도 돼! 진짜로!'],
    pick: ['오케이! 거리 잡고 들어간다!'],
    brief: ['오케이오케이, 들어가면 나부터 거리 잡을게!'],
    enter: ['자, 다들 내 손가락 앞에 서지 마!'],
    enter_elevator: ['띵. …띵이래. 아 싫다.'],
    enter_replica: ['벽 따뜻하네… 형님 없으니까 내가 앞이야? 아 싫다!'],
    greet: ['안녕하세요! 진압팀 생각 없으세요? …농담이에요!', '안녕! 친하게 지내자!'],
    called: ['아 왜 나한테 말 걸어!', '…그거 형님도 모르는 건데.', '살아남으래. 살아남을게. 됐지?'],
    floor: ['왼쪽 비었고 오른쪽 수상해! 오른쪽부터!', '거리 십 미터 유지! 다들 들었지?'],
    attic: ['여기서 쉬는 건 오 분! 내가 잴게!'],
    combat: ['왼쪽 셋! 오른쪽 둘! 가운데는 내가!', '왼쪽으로 돌 테니까 여기서 엄호해!'],
    boss: ['저거 체력 계산 다시 해야겠는데…'],
    kill: ['딱!', '하나 태웠다!'],
    combo: ['딱, 딱, 딱!'],
    dodge: ['안 잡혀!', '거리 유지!'],
    ult: ['다 태운다! 비켜!', '불꽃놀이 간다!'],
    guardbreak: ['아 무거워!'],
    hp_low: ['아 아프다! 괜찮아 괜찮아!', '체력 반 아래! 출력 줄인다!'],
    ammo_low: ['손가락 저려! 몇 번 안 남았어!'],
    ammo_empty: ['출력 바닥! 잠깐만 숨 좀!'],
    weapon: ['이거 불 붙여도 돼?'],
    item: ['살았다!'],
    find: ['이거 잼트리 씨한테 주면 좋아하겠다! 아니면 전출을…'],
    find_item: ['회수! 이거 데쥬레 씨 거!'],
    rule_break: ['어? 내가 뭐 했어? 손가락? 손가락 때문이야?'],
    intrude_fake: ['직급 부르는 소리! 저쪽이다! 총알은 내가 태울게!'],
    intrude_daydream: ['가면 분들! 진압팀 생각 없으세요?! …농담이야!'],
    rescue: ['근데 방금 그 판단 진짜 좋았어! …아, 미안, 미안, 울지 마.', '진압팀에 너 같은 인재가… 아 지금 아니지.'],
    win: ['보고서는 내가 쓸게. 다섯 장.', '오늘도 아군 오사 제로!'],
    down: ['아… 형님…'],
    evac: ['형님은? 형님 괜찮아?', '아 살았다! 링거 맛있다!'],
    settle: ['이걸로 오토바이 바꿀 수 있나?'],
  },
  deadpole: {
    offer: ['저… 제가 가도 괜찮을까요? 아, 네. 갈게요.'],
    pick: ['고맙습니다! 아, 고마운 게 맞나…'],
    brief: ['여기서 제가 한 번 죽으면 시간이 벌리니까요.'],
    enter: ['…냄새부터 맡을게요.'],
    enter_elevator: ['띵, 이라니. 귀여운 소리네요. …아닌가.'],
    enter_replica: ['냄새가… 달아요. 과일은 아니에요.'],
    greet: ['안녕하세요. 잘 부탁드려요.', '안녕하세요… 늘 신세 져요.'],
    called: ['…네. 저도 알아요.', '그 얘기는 하지 말아요.', '고마워요. 살아남을게요.'],
    floor: ['(킁킁) …바뀌었어요.', '제가 먼저 갈게요.'],
    attic: ['여기… 사람 냄새가 오래됐어요.'],
    combat: ['죄송합니다.', '죄송해요, 먼저 쏠게요.'],
    boss: ['…제가 앞에 설게요.'],
    kill: ['죄송해요.', '…편히 쉬세요.'],
    combo: ['죄송합니다, 죄송합니다.'],
    dodge: ['앗, 피했다…!'],
    ult: ['한 번 죽을게요. 그동안 부탁해요.', '시간 벌게요.'],
    guardbreak: ['아…!'],
    hp_low: ['괜찮아요! 별로 안 아팠어요!', '이 정도는… 되감으면 돼요.'],
    ammo_low: ['탄이 별로 없어요…'],
    ammo_empty: ['탄이… 죄송해요, 손으로 할게요.'],
    weapon: ['이거 빌려도 될까요?'],
    item: ['잘 먹을게요.'],
    find: ['여기… 기억 속에서 맡던 냄새예요.'],
    find_item: ['조심해서 들게요. 고마워요.'],
    rule_break: ['제가… 혹시 제가…', '죄송해요. 죄송해요. 죄송해요.'],
    intrude_fake: ['저분들은… 사과해도 안 들어 주시더라고요.'],
    intrude_daydream: ['수집기… 저 들고 가시면 안 돼요.'],
    rescue: ['괜찮으세요? 놀라셨죠? 제 뒤에 계세요.', '살아남으셨… 아, 저 말고요. 당신이요.'],
    win: ['다들… 드세요. 아, 저는 괜찮아요.'],
    down: ['아…'],
    evac: ['…신세 졌어요.', '음… 아파요.'],
    settle: ['이걸로 다들 커피 사 드릴게요.'],
  },
  rojemon: {
    offer: ['현장 출동이면 난 안 가.'],
    pick: ['…이걸 왜 내가 해.', '간식 챙겼어. 가.'],
    brief: ['헛소리하지 마. 규칙 몇 개야? 그것만 말해.'],
    enter: ['벽. 벽 어딨어.'],
    enter_elevator: ['엘리베이터 벽. 기댈 수 있음. 합격.'],
    enter_replica: ['벽. 벽 어딨어. …아 여기 벽 숨 쉬잖아!'],
    greet: ['…안녕. 됐지?', '인사했어. 대우 똑바로 해.'],
    called: ['…안 들려. 안 들리는 걸로 할게.', '인형들아, 저 스피커 좀.', '알아도 말하지 마.'],
    floor: ['저기 서 있는 거 사람 아니야. 그냥 알아.', '벽 있어. 됐어.'],
    attic: ['벽 많아서 좋다. 간식 먹을래.'],
    combat: ['저기! 저기 쳐!', '눈 마주쳐 봐. 돌아가.'],
    boss: ['이거 사무직 일 아니야.'],
    kill: ['됐어.', '봐. 했잖아.'],
    combo: ['인형들아, 다 같이.'],
    dodge: ['아 깜짝이야!'],
    ult: ['인형들아, 전부 일어나.', '앙상블. 시작.'],
    guardbreak: ['아 뭐야!'],
    hp_low: ['아 뭐야! 내 옆에 있으라니까!'],
    ammo_low: ['실 엉킨다. 오래 못 해.'],
    ammo_empty: ['머리 아파. 못 해. 진짜 못 해.'],
    weapon: ['이걸 나보고 들라고?'],
    item: ['간식이다.'],
    find: ['…이거 맛없어. 그냥 읽어.'],
    find_item: ['이거 들어. 무거워.'],
    rule_break: ['내가 아니야. …내가 맞아. 됐어?'],
    intrude_fake: ['직급 부르는 애들. 눈 마주치지 마, 쟤네는 안 걸려.'],
    intrude_daydream: ['가면? 눈이 안 보이면 못 걸잖아. 짜증 나.'],
    rescue: ['내 옆에 있어. 빚이야.', '목숨 한 번 빚졌으니까 이번엔 넘어가 줄게.'],
    win: ['됐지? 나 간식 먹을 거야.'],
    down: ['…짜증 나.'],
    evac: ['어땠어? …뭔데. 나한테 묻지 마.', '명패. 내 명패 어딨어.'],
    settle: ['출동 수당 따로 줘.'],
  },
};

/** 태그에 맞는 한 줄. 없으면 가까운 태그로 대신한다. */
const FALLBACK: Partial<Record<AgentTag, AgentTag>> = {
  enter_elevator: 'enter',
  enter_replica: 'enter',
  kill: 'combat',
  combo: 'kill',
  ult: 'combat',
  guardbreak: 'hp_low',
  ammo_empty: 'ammo_low',
  find_item: 'find',
  floor: 'enter',
  attic: 'find',
  down: 'hp_low',
  pick: 'offer',
};

export function agentLine(agent: AgentId, tag: string, rng: () => number = Math.random): string | undefined {
  let t = tag as AgentTag;
  for (let i = 0; i < 3; i++) {
    const list = AGENT_LINES[agent]?.[t];
    if (list?.length) return list[Math.floor(rng() * list.length) % list.length];
    const f = FALLBACK[t];
    if (!f) break;
    t = f;
  }
  return undefined;
}

/** 후송 깨어남: 옆에 있던 동료와의 짧은 주고받기. [동료가 하는 말, 깨어난 요원의 답]. 근거: 제작서 9장 「후송 깨어남」. */
export const EVAC_PAIRS: Partial<Record<AgentId, { by: AgentId | 'jaemtri'; lines: [string, string] }[]>> = {
  jyaldi: [
    { by: 'eileen', lines: ['…쉬었나?', '응.'] },
    { by: 'jaemtri', lines: ['부장님, 블랙이요. 오늘은 설탕 넣었어요.', '…넣지 마.'] },
  ],
  eileen: [
    { by: 'jyaldi', lines: ['쉬었나?', '응.'] },
    { by: 'jaemtri', lines: ['(커피를 총 옆에 내려놓는다) …고마워요는 안 해도 돼요.', '…고마워.'] },
  ],
  spangdal: [
    { by: 'jaemtri', lines: ['스팡달, 입.', '(입을 다문다)'] },
    { by: 'kyuras', lines: ['…여보세요?', '큐라스, 여보세요? 후후.'] },
  ],
  geshugan: [
    { by: 'deadpole', lines: ['괜찮으세요? 제가 대신…', '…아니.'] },
    { by: 'rojemon', lines: ['내 옆에 있어.', '(팔을 잡힌 채 끌려간다)'] },
  ],
  gorgodio: [{ by: 'kyuras', lines: ['형님! 형님 오른쪽 어깨! 아 됐다 됐다!', '…니가 뒤에서 다 태워 주니까 편하지.'] }],
  kyuras: [
    { by: 'gorgodio', lines: ['니가 뒤에서 다 태워 주니까 편하지.', '형님이 앞에서 다 받아 주니까 편하지!'] },
    { by: 'spangdal', lines: ['큐라스, 여보세요?', '(하얗게 질린다)'] },
  ],
  deadpole: [
    { by: 'geshugan', lines: ['…미안.', '괜찮아요!'] },
    { by: 'rojemon', lines: ['어땠어? 뭔데?', '음… 아파요.'] },
  ],
  rojemon: [
    { by: 'deadpole', lines: ['어땠어요? …아, 이거 로제몬 씨 대사죠.', '헛소리하지 마. …아팠어.'] },
    { by: 'geshugan', lines: ['…해냈어.', '내가 했어. 됐어?'] },
  ],
};
