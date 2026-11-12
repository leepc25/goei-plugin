// 괴담톡 설정 정의표
import { BANTER_ROWS, NOTICE_PAGE_SIZES, STORAGE_MAX } from '../phone';
import { onOff, type SetDef, type SetPage } from './types';

const KEEP_HELP = '최근 기록만 남기고, 지운 대화는 흐름 요약으로 남겨요';
const keep = (k: 'dm' | 'group' | 'notice', label: string): SetDef => ({
  key: `storage_auto_${k}`, label, ctl: onOff('0'), help: KEEP_HELP,
  inline: { key: `storage_limit_${k}`, lo: 1, hi: STORAGE_MAX, unit: '개', aria: '남길 수', whenOn: true },
});
const pct = (key: string) => ({ key, lo: 0, hi: 100, unit: '%', aria: '확률' });

export const PHONE_SET: SetPage = {
  id: 'ph',
  groups: [
    {
      title: '',
      rows: [
        { key: 'auto', label: '자동 호출', common: 'auto', ctl: { t: 'seg', opts: [['0', '수동'], ['open', '창을 열 때'], ['1', '매 턴']], fb: '0' },
          help: { '0': '새로고침 버튼을 누를 때만 확인해요', open: '턴이 진행된 뒤 괴담톡을 열면 한 번 확인해요', '1': '메인 응답이 끝날 때마다 모델을 한 번 더 불러요' } },
        { key: 'joint', label: '한 번에 요청', common: 'joint', ctl: { t: 'custom' },
          help: '켜면 자동 호출이 「매 턴」이고 모델이 같은 게시판과 괴담톡을 한 요청으로 묶어요. 인터넷 설정의 같은 줄과 한 값이에요.' },
        { key: 'model', label: '모델', common: 'model', ctl: { t: 'seg', opts: [['main', '메인 모델'], ['aux', '보조 모델']], fb: 'aux' },
          help: '답장·선톡·공지를 만들 때 부를 모델이에요.' },
      ],
    },
    // 기능마다 따로 정하는 「넘길 내용」·「넘길 양」 격자 (core/reffn.ts · ui/fngrid.ts). 옛 한 줄(챗로그 포함·넘길 내용·방마다 참조할 말풍선·요청 토큰 상한)을 대신한다
    { title: '넘길 내용 · 넘길 양', grid: 'fn', rows: [] },
    {
      title: '참조',
      rows: [
        { key: 'status', label: '요원 상태 참조', ctl: onOff('0'), help: '켜면 상황판의 요원 상태(출동 중·부상 등)를 답장 요청에 넣어요. 출동 중인 요원은 그에 맞게 답해요' },
      ],
    },
    {
      title: '컨텍스트 포함',
      rows: [
        { key: 'context', label: '사용', common: 'ctx', ctl: onOff('0'), help: '지금 장면과 관련된 괴담톡 대화가 메인 요청에 붙어요' },
        { key: 'adv_ctx', label: '붙일 것', ctl: { t: 'advchips', items: ['ctx_focus', 'ctx_messages', 'ctx_notices_on'] } },
        { key: 'adv_ctx_history', label: '넣을 말풍선', ctl: { t: 'adv', item: 'ctx_history' } },
        { key: 'adv_ctx_notices', label: '넣을 공지', ctl: { t: 'adv', item: 'ctx_notices' } },
        { key: 'adv_ctx_tokens', label: '컨텍스트 토큰 상한', ctl: { t: 'adv', item: 'ctx_tokens' } },
      ],
    },
    {
      title: '답장',
      rows: [
        { key: 'habits', label: '말버릇 기록', ctl: onOff('0'), help: '연락처마다 문자 습관(맞춤법·답장 속도)을 기억해 다음 답장에도 이어 가요' },
        { key: 'reactions', label: '이모지 반응', ctl: onOff('0'), help: '메시지에 👍3 같은 반응이 붙어요. 본 사람 수를 넘지 않고, 1:1에서는 상대가 내 메시지에만 달아요' },
      ],
    },
    {
      title: '새 메시지',
      rows: [
        { key: 'incoming', label: '선톡 받기', ctl: onOff('0'), inline: pct('incoming_chance') },
        { key: 'adv_cd_incoming', label: '선톡 받은 뒤 쉬는 턴', ctl: { t: 'adv', item: 'cd_incoming' } },
        { key: 'group_invites', label: '단톡방 초대 받기', ctl: onOff('0'), inline: pct('group_invite_chance') },
        { key: 'adv_cd_invite', label: '초대 받은 뒤 쉬는 턴', ctl: { t: 'adv', item: 'cd_invite' } },
        { key: 'banter', label: '단톡 수다', ctl: onOff('0'), inline: pct('banter_chance'), help: '새 메시지를 확인할 때 이 확률로 내 단톡방 하나에서 사람들끼리 대화가 오가요. 응답이 길어져요' },
        { key: 'banter', label: '단톡 수다 줄 수', ctl: { t: 'minmax', lo: BANTER_ROWS[0], hi: BANTER_ROWS[1], unit: '줄', act: 'num' }, help: `수다 한 번에 오가는 말 수예요(${BANTER_ROWS[0]}~${BANTER_ROWS[1]}). 그 안에서 모델이 정해요` },
      ],
    },
    {
      title: '공지',
      rows: [
        { key: 'announcements', label: '소속 공지 받기', ctl: onOff('0'), help: '내 소속 조직의 단체 공지(지시·안내)가 가끔 괴담톡에 와요' },
        { key: 'announcement_gap', label: '공지 대기 턴', ctl: { t: 'num', lo: 1, hi: 100, unit: '턴' }, help: '공지가 온 뒤 적어도 이만큼 턴이 지나야 다음 공지가 와요' },
        { key: 'announcement_history', label: '공지 참조 수', ctl: { t: 'num', lo: 1, hi: 50, unit: '개' }, help: '새 공지를 쓸 때 지난 공지를 몇 개까지 보여 주고 겹치지 않게 할지예요' },
        { key: 'announcement_page_size', label: '페이지당 공지', ctl: { t: 'seg', opts: NOTICE_PAGE_SIZES.map((n): [string, string] => [String(n), String(n)]) } },
      ],
    },
    {
      title: '보기 전용 방',
      rows: [
        { key: 'view_auto', label: '자동 호출', ctl: { t: 'seg', opts: [['manual', '수동'], ['open', '창을 열 때'], ['turn', '매 턴']] }, help: '매 턴이면 메인 응답마다 방을 하나 더 만들어요(모델 호출 +1)' },
        { key: 'view_preset', label: '종류', ctl: { t: 'seg', opts: [['side', '사이드스토리'], ['mono', '혼잣말'], ['multi', '다중인격 혼잣말']] },
          help: '사이드스토리 = 메인 응답에 안 나온 짧은 대화 · 혼잣말 = 시점 인물의 속마음 · 다중인격 혼잣말 = 마음속 여러 갈래가 단톡처럼 주고받아요' },
        { key: 'view_pov', label: '시점 인물', ctl: { t: 'text', ph: '비우면 주인공' } },
        { key: 'view_speak', label: '시점 인물 대사', ctl: onOff('0'), help: '켜면 시점 인물의 말도 모델이 써요. 끄면 시점 인물은 조용히 있어요' },
        { key: 'view_scope', label: '등장인물 범위', show: { key: 'view_preset', eq: 'side' }, ctl: { t: 'seg', opts: [['0', '주요 인물'], ['1', '장면 안'], ['2', '장면 안 주요 인물'], ['3', '자율']] } },
        { key: 'view_size', label: '방 크기', show: { key: 'view_preset', eq: 'side' }, ctl: { t: 'seg', opts: [['0', '자동'], ['1', '둘이서'], ['2', '여럿']] } },
      ],
    },
    {
      title: '연락처',
      rows: [
        { key: 'all_contacts', label: '모든 연락처 공개', ctl: onOff('0'), help: '내 소속과 관계없이 모든 탭을 보여요' },
        { key: 'anomaly_contacts', label: '괴이 연락처 공개', ctl: onOff('0'), help: '켜면 괴이(이물) 쪽 연락처 탭도 보여요. 끄면 사람·조직 연락처만' },
      ],
    },
    {
      title: '보관',
      rows: [
        keep('dm', '1:1 대화 정리'),
        keep('group', '단톡방 정리'),
        keep('notice', '공지 정리'),
      ],
    },
    {
      title: '생성 방식',
      rows: [
        { key: 'adv_thoughts', label: '생각 단계', ctl: { t: 'adv', item: 'thoughts' } },
        { key: 'adv_memo', label: '비망록', ctl: { t: 'adv', item: 'memo' } },
        { key: 'adv_reiterate', label: '다시 보기', ctl: { t: 'adv', item: 'reiterate' } },
      ],
    },
    {
      title: '길이·개수 상한',
      rows: [
        { key: 'adv_set_bubble', label: '말풍선', ctl: { t: 'advset', items: [['reply_tokens', '상대 말풍선'], ['events', '한 번에 받을 수'], ['input_tokens', '내가 보낼 글'], ['pause_tokens', '대기 설명']] } },
        { key: 'adv_set_group', label: '단톡방', ctl: { t: 'advset', items: [['topic_tokens', '주제'], ['members', '최대 상대'], ['room_name', '이름'], ['invitations', '한 번에 받을 초대']] } },
        { key: 'adv_set_notice', label: '공지 글', ctl: { t: 'advset', items: [['notices', '한 번에 받을 수'], ['notice_tokens', '본문'], ['notice_title', '제목'], ['notice_issuer', '발신처']] } },
        { key: 'adv_memo_tokens', label: '', ctl: { t: 'adv', item: 'memo_tokens' } },
      ],
    },
  ],
};
