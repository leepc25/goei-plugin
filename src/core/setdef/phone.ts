// 괴담톡 설정 정의표
import { BANTER_ROWS, NOTICE_PAGE_SIZES, STORAGE_MAX } from '../phone';
import { onOff, type SetDef, type SetPage } from './types';

const KEEP_HELP = '최근 기록만 남기고, 지운 대화는 흐름 요약으로 남겨요';
const keep = (k: 'dm' | 'group' | 'notice', label: string): SetDef => ({
  key: `storage_auto_${k}`, label, ctl: onOff('0'), help: KEEP_HELP,
  inline: { key: `storage_limit_${k}`, lo: 1, hi: STORAGE_MAX, unit: '개', aria: `storage_limit_${k}`, whenOn: true },
});
const pct = (key: string) => ({ key, lo: 0, hi: 100, unit: '%', aria: '확률' });

export const PHONE_SET: SetPage = {
  id: 'ph',
  groups: [
    {
      title: '괴담톡',
      rows: [
        { key: 'auto', label: '자동 호출', common: 'auto', ctl: { t: 'seg', opts: [['0', '수동'], ['open', '창을 열 때'], ['1', '매 턴']], fb: '0' },
          help: { '0': '새로고침 버튼을 누를 때만 확인해요', open: '채팅이 진행된 뒤 괴담톡을 열면 한 번 확인해요', '1': '채팅 응답이 끝날 때마다 모델을 한 번 더 불러요' } },
        { key: 'joint', label: '한 번에 요청', common: 'joint', ctl: { t: 'custom' },
          help: '괴담톡·괴담넷·괴담갤·세정게·연어 마켓 중 「매 턴」이고 모델이 같은 것들을 한 요청으로 묶어요 (다섯 페이지 공통 값, 쇼핑몰은 따로). 끄면 하나씩 따로 불러요.' },
        { key: 'model', label: '모델', common: 'model', ctl: { t: 'seg', opts: [['main', '메인 모델'], ['aux', '보조 모델']], fb: 'aux' },
          help: '괴담톡 답장·선톡·공지를 만들 때 부를 모델이에요. 보조 모델 = Risu의 보조 모델(싸고 빠름), 메인 모델 = 본편과 같은 모델' },
        { key: 'context', label: '컨텍스트에 포함', common: 'ctx', ctl: onOff('0'), help: '지금 장면과 관련된 대화가 채팅 요청에 참고로 붙어요' },
      ],
    },
    {
      title: '답장',
      rows: [
        { key: 'status', label: '요원 상태 참고', ctl: onOff('0'), help: '켜면 상황판의 요원 상태(출동 중·부상 등)를 답장 만들 때 참고해요. 출동 중인 요원은 그에 맞게 답해요' },
        { key: 'habits', label: '말버릇 기록', ctl: onOff('0'), help: '연락처마다 문자 습관(길이·연달아 보내기·맞춤법·답장 속도)을 기억해 다음 답장에도 이어 가요' },
        { key: 'reactions', label: '이모지 반응', ctl: onOff('0'), help: '메시지에 👍3 같은 반응이 붙어요. 본 사람 수를 넘지 않고, 1:1에서는 상대가 내 메시지에만 달아요' },
      ],
    },
    {
      title: '새 메시지',
      rows: [
        { key: 'incoming', label: '선톡 받기', ctl: onOff('0'), inline: pct('incoming_chance') },
        { key: 'group_invites', label: '단톡방 초대 받기', ctl: onOff('0'), inline: pct('group_invite_chance') },
        { key: 'banter', label: '단톡 수다', ctl: onOff('0'), inline: pct('banter_chance'), help: '새 메시지를 확인할 때 이 확률로 내 단톡방 하나에서 사람들끼리 대화가 오가요. 응답이 길어져요' },
        { key: 'banter', label: '단톡 수다 줄 수', ctl: { t: 'minmax', lo: BANTER_ROWS[0], hi: BANTER_ROWS[1], unit: '줄', act: 'num' }, help: `수다 한 번에 오가는 말 수예요(${BANTER_ROWS[0]}~${BANTER_ROWS[1]}). 그 안에서 모델이 정해요` },
        { key: 'announcements', label: '소속 공지 받기', ctl: onOff('0'), help: '내 소속 조직의 단체 공지(지시·안내)가 가끔 괴담톡에 와요' },
        { key: 'announcement_gap', label: '공지 대기 턴', ctl: { t: 'num', lo: 1, hi: 100, unit: '턴' }, help: '공지가 온 뒤 적어도 이만큼 턴이 지나야 다음 공지가 와요' },
        { key: 'announcement_history', label: '공지 참고 수', ctl: { t: 'num', lo: 1, hi: 50, unit: '개' }, help: '새 공지를 쓸 때 지난 공지를 몇 개까지 보여 주고 겹치지 않게 할지예요' },
      ],
    },
    {
      title: '보기 전용 방',
      rows: [
        { key: 'view_preset', label: '종류', ctl: { t: 'seg', opts: [['side', '사이드스토리'], ['mono', '혼잣말'], ['multi', '다중인격 혼잣말']] },
          help: '사이드스토리 = 본편에 안 나온 짧은 대화 · 혼잣말 = 시점 인물의 속마음 · 다중인격 혼잣말 = 마음속 여러 갈래가 단톡처럼 주고받아요' },
        { key: 'view_pov', label: '시점 인물', ctl: { t: 'text', ph: '비우면 주인공' } },
        { key: 'view_speak', label: '시점 인물 대사', ctl: onOff('0'), help: '켜면 시점 인물의 말도 모델이 써요. 끄면 시점 인물은 조용히 있어요' },
        { key: 'view_scope', label: '등장인물 범위', show: { key: 'view_preset', eq: 'side' }, ctl: { t: 'seg', opts: [['0', '주요 인물'], ['1', '장면 안'], ['2', '장면 안 주요 인물'], ['3', '자율']] } },
        { key: 'view_size', label: '방 크기', show: { key: 'view_preset', eq: 'side' }, ctl: { t: 'seg', opts: [['0', '자동'], ['1', '둘이서'], ['2', '여럿']] } },
        { key: 'view_auto', label: '자동 호출', ctl: { t: 'seg', opts: [['manual', '수동'], ['open', '창을 열 때'], ['turn', '매 턴']] }, help: '매 턴이면 채팅 응답마다 방을 하나 더 만들어요(모델 호출 +1)' },
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
        keep('dm', '1:1 대화 정리'), keep('group', '단톡방 정리'), keep('notice', '공지 정리'),
        { key: 'announcement_page_size', label: '페이지당 공지', ctl: { t: 'seg', opts: NOTICE_PAGE_SIZES.map((n): [string, string] => [String(n), String(n)]) } },
      ],
    },
  ],
};
