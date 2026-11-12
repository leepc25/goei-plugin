// 망상홈쇼핑 설정 정의표. 수 칸의 범위·단위·기본값은 core/homeshop.ts HS_NUM 에서 온다.
// 이 페이지에는 망상홈쇼핑에만 있는 줄만 둔다 (우주 쇼핑몰·포인트몰 페이지와 같은 규칙):
//   상점마다 따로 정하는 값(사용·자동 호출·모델·상품 수·값 기준)과 네 곳이 같이 쓰는 값(맥락 반영·챗로그 포함·참조 로어북·생각 단계·다양성 강화·지난 목록 피하기)은
//   설정 → 상점(ui/famtable.ts shopTable)에 있다. 메인 요청에 붙이는 것($hs_main·$hs_main_kinds·$hs_main_tokens, core/hslog.ts)도 상점 페이지의 격자에 둔다.
// 묶음과 차례는 여기 적힌 그대로 화면에 나온다 (ui/homeshop.ts homeshopSettingsPane 은 값만 잇는다).
import { HS_FORMS_DEFAULT, HS_KEY, HS_NUM, HS_READ_DEFAULT, HS_TEL_DEFAULT } from '../homeshop';
import { onOff, type SetCtl, type SetDef, type SetPage } from './types';

const on = onOff('1');
const num = (k: string): SetCtl => ({ t: 'num', lo: HS_NUM[k].lo, hi: HS_NUM[k].hi, unit: HS_NUM[k].unit });
const pair = (a: string, b: string): SetCtl => ({ t: 'minmax', lo: HS_NUM[a].lo, hi: HS_NUM[a].hi, unit: HS_NUM[a].unit, act: 'num', keys: [a, b] });
const SCALES: [string, string][] = [['auto', '자동'], ['fit', '폭 맞춤'], ['0.5', '0.5배'], ['1', '1배'], ['2', '2배']];
const row = (key: string, label: string, ctl: SetCtl, help?: SetDef['help'], more: Partial<SetDef> = {}): SetDef => ({ key, label, ctl, ...(help ? { help } : {}), ...more });
/** 최소·최대 줄: 줄 열쇠 → HS_NUM 의 두 열쇠 (화면이 지금 값을 읽을 때도 쓴다) */
export const HS_PAIRS: Record<string, [string, string]> = {
  cue: ['cueMin', 'cueMax'], chat: ['chatMin', 'chatMax'], sayCue: ['sayCueMin', 'sayCueMax'], sayChat: ['sayChatMin', 'sayChatMax'],
  call: ['callLo', 'callHi'], fill: ['fillLo', 'fillHi'], end: ['endLo', 'endHi'],
};
const mm = (k: string): SetCtl => pair(...HS_PAIRS[k]);
/** 줄 열쇠 → 그 줄이 적는 채팅 변수 (수 칸은 HS_NUM, 최소·최대는 HS_PAIRS 를 따른다). 화면의 처리기(ui/homeshop.ts)와 시험이 같이 본다 */
export const HS_TEL_KEY = '$hs_tel';
export const HS_RETRY_KEY = '$hs_retry';
/** 켬/끔 줄 */
export const HS_FLAG: Record<string, string> = { net: HS_KEY.net, cut: HS_KEY.cut, bulb: HS_KEY.bulb, tear: HS_KEY.tear, scan: HS_KEY.scan, turn: HS_KEY.turn, lock: HS_KEY.lock, drop: HS_KEY.drop, aud: HS_KEY.aud, peek: HS_KEY.peek, say: HS_KEY.say, barter: HS_KEY.barter };
/** 기본값이 든 글 줄: [변수, 기본값, 글자 수 상한] (core/deftext: 기본값과 같거나 비우면 저장하지 않는다) */
export const HS_DEF_TEXT: Record<string, [string, string, number]> = { tel: [HS_TEL_KEY, HS_TEL_DEFAULT, 20], forms: [HS_KEY.forms, HS_FORMS_DEFAULT, 200], read: [HS_KEY.read, HS_READ_DEFAULT, 200] };
/** 그 밖의 줄 */
export const HS_OTHER: Record<string, string> = { retry: HS_RETRY_KEY, clips: HS_KEY.clips, scalePc: HS_KEY.scalePc, scalePh: HS_KEY.scalePhone };
/** 줄 하나가 적는 변수 이름들 */
export function hsRowVars(key: string): string[] {
  if (HS_PAIRS[key]) return HS_PAIRS[key].map((k) => HS_NUM[k].key);
  if (HS_NUM[key]) return [HS_NUM[key].key];
  const one = HS_FLAG[key] ?? HS_DEF_TEXT[key]?.[0] ?? HS_OTHER[key];
  return one ? [one] : [];
}

export const HOMESHOP_SET: SetPage = {
  id: 'hs',
  groups: [
    {
      title: '',
      rows: [
        row('net', '인터넷에 상시 노출', on, '켜면 인터넷 즐겨찾기에 늘 보여요. 꺼도 메인 응답의 카드로 접속하면 열려요(설정 → 소지품 → 고유 상점).'),
        row('retry', '자동 다시 연결', { t: 'step', lo: 0, hi: 3, unit: '회', action: 'hs-retry', vkey: 'n' }, '편성을 받지 못하면 「신호 없음」 화면에서 스스로 다시 연결하는 횟수예요(0~3).'),
        row('say', '채팅 보내기', on, '내가 채팅을 쓰면 한 번 더 호출해 진행자와 시청자의 반응을 받아요.'),
        row('sayCue', '보낸 채팅마다 큐 줄 수', mm('sayCue'), '내가 보낸 채팅 하나에 진행자가 답하는 장면 수예요.'),
        row('sayChat', '보낸 채팅마다 채팅 줄 수', mm('sayChat'), '내가 보낸 채팅 하나에 다른 시청자가 다는 채팅 줄 수예요.'),
      ],
    },
    {
      title: '편성',
      rows: [
        row('cue', '상품마다 큐 줄 수', mm('cue'), '상품 하나에 진행자가 말하는 장면 수예요.', { aria: '큐 줄 수' }),
        row('chat', '상품마다 채팅 줄 수', mm('chat'), '상품 하나가 방송되는 동안 흘리는 시청자 채팅 줄 수예요. 다 흐르면 되풀이하지 않아요.'),
      ],
    },
    {
      title: '방송 흐름',
      rows: [
        row('speed', '자막 속도', num('speed'), '진행자 대사가 찍히는 빠르기예요. 대사 길이가 장면 길이를 정해요.'),
        row('hold', '대사 뒤 쉼', num('hold'), '대사가 다 찍힌 뒤 다음 장면으로 넘어가기까지예요(12 = 1.2초).'),
        row('frame', '동작 한 장 길이', num('frame'), '진행자 동작이 한 장 넘어가는 시간이에요. 작을수록 빨라요.'),
        row('chatGap', '채팅 간격', num('chatGap'), '채팅 한 줄이 올라오는 평균 간격이에요(22 = 2.2초).'),
        row('next', '다음 부까지', num('next'), '큐시트가 끝난 뒤 다음 상품으로 넘어가기까지예요. 0이면 스스로 넘어가지 않아요.'),
        row('turn', '턴이 넘어가면 다음 부로', on, '켜면 턴이 한 번 진행될 때마다 편성이 한 칸 넘어가요. 놓친 상품은 편성표에서 보기만 해요.'),
        row('lock', '지난 부 잠그기', on, '켜면 지난 부에 「매진」 딱지가 붙어요.'),
      ],
    },
    {
      title: '남은 수량',
      rows: [
        row('left', '남은 수량 시작 값', num('left')),
        row('drop', '수량 저절로 줄기', on, '켜면 방송 동안 남은 수량이 몇 초마다 조금씩 줄고, 전화 주문을 하면 1 줄어요. 저절로는 0이 되지 않고, 「매진」은 큐시트에 있을 때만 떠요. 끄면 큐시트의 「남은 수량 -N」 때만 줄어요.'),
        row('dropRate', '줄어드는 빠르기', num('dropRate'), '100이면 큐시트가 끝날 즈음 「끝날 때 남기는 수」에 닿아요. 크게 하면 더 일찍 닿아요.'),
        row('dropFast', '빨라질 때 배수', num('dropFast'), '「가격 공개」와 「주문 폭주」 뒤에는 이만큼 빨리 줄어요(20 = 2배).'),
        row('dropStep', '한 번에 줄어드는 수', num('dropStep'), '한 번 줄 때 1부터 이 수까지 줄어요.'),
        row('soonAt', '매진 임박 기준 수', num('soonAt'), '남은 수량이 이 수 이하가 되면 「매진 임박」 딱지가 저절로 붙어요. 0이면 큐시트에 있을 때만 붙어요.'),
        row('end', '끝날 때 남기는 수', mm('end'), '저절로 줄어드는 것은 이 사이의 수에서 멈춰요.'),
      ],
    },
    {
      title: '주문',
      rows: [
        row('barter', '물건 맞교환', on, '전화 주문에서 가진 물건 하나로 결제할 수 있어요. 맞교환은 할부 장부에 오르지 않아요.'),
        row('peek', '스티커 들추기', on, '상품 스티커 창에서 모서리를 들춰 아래 한 줄을 볼 수 있어요.'),
      ],
    },
    {
      title: '컨텍스트 포함',
      rows: [
        row('call', '할부 호출 간격', mm('call'), '주문한 뒤 이만큼 턴이 지날 때마다 메인 요청에 출연 호출을 한 번 넘기고 1회 납부로 쳐요. 평소에는 메인 요청에 아무것도 보내지 않아요.'),
        row('forms', '출연 형태', { t: 'text', ph: '', def: HS_FORMS_DEFAULT, max: 200 }, '호출 때 이 가운데 하나를 골라 넘겨요. 쉼표로 나눠요. 호출 글은 지침 → 망상홈쇼핑의 CALL 절에서 고쳐요.'),
        row('aud', '방청 신청', on, '신청하면 다음 턴 메인 요청에 한 줄만 넘겨요. 글은 지침의 AUDIENCE 절에서 고쳐요.'),
      ],
    },
    {
      title: '진행자 동작',
      note: '아무 일 없을 때는 「기본」 동작을 되풀이하다가, 정해진 횟수마다 「가끔」 동작을 하나 끼워요. 그 자리에서 확률로 「드물게」 동작이 대신 나와요. 「대사·사건」 동작은 큐시트의 표정에 맞춰서만 나와요. 같은 동작의 1·2판은 번갈아 써요.',
      rows: [
        row('fill', '「가끔」 동작 간격', mm('fill'), '기본 동작을 이만큼 되풀이한 뒤 하나 끼워요.', { aria: '가끔 동작 간격' }),
        row('fillCool', '「가끔」 다시 나오기까지', num('fillCool'), '같은 동작이 다시 나오기까지 기본 동작 되풀이 수예요.', { aria: '가끔 다시 나오기까지' }),
        row('rareP', '「드물게」 확률', num('rareP'), '「가끔」 자리마다 이 확률로 섬뜩한 동작이 나와요.', { aria: '드물게 확률' }),
        row('rareCool', '「드물게」 다시 나오기까지', num('rareCool'), undefined, { aria: '드물게 다시 나오기까지' }),
        row('read', '채팅 읽는 동작', { t: 'text', ph: '', def: HS_READ_DEFAULT, max: 200 }, '내가 보낸 채팅을 읽는 동안 기본 동작과 번갈아 나오는 동작이에요. 쉼표로 나눠요.'),
        row('clips', '동작 분류 고치기', { t: 'area', ph: '', rows: 4, cls: 'ms-area', labeled: true }),
      ],
    },
    {
      title: '방송 화면',
      rows: [
        row('tel', '주문 전화번호', { t: 'text', ph: '', def: HS_TEL_DEFAULT, max: 20 }, '방송 화면과 머리에 보이는 번호예요.'),
        row('cut', '컷 전환', on, '끄면 진행자 정면(바스트) 한 장면만 써요.'),
        row('bulb', '전구 반짝임', on),
        row('tear', '신호 찢김', on, '0.2~0.4초 동안 화면이 찢기고 다른 얼굴이 끼어들어요.'),
        row('tearP', '찢김 확률', num('tearP'), '장면이 바뀔 때마다 저절로 찢길 확률이에요. 큐시트의 「신호 찢김」은 늘 나와요.'),
        row('scan', '주사선', on),
        row('scalePc', 'PC 표시 배율', { t: 'seg', opts: SCALES }, '자동 = 채팅 칸·상품 칸이 같이 보이게 화면에 맞춤 (들어가면 1배·2배).'),
        row('scalePh', '폰 표시 배율', { t: 'seg', opts: SCALES }, '자동 = 화면 폭에 맞춤.'),
      ],
    },
  ],
};
