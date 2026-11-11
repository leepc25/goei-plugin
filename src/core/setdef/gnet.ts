// 게시판(괴담넷·괴담갤·세정게·연어 마켓) 설정 정의표. 네 사이트가 같은 표를 쓰고 저장 변수만 사이트마다 다르다.
import { COUNT_RANGE } from '../gnet';
import { onOff, type SetPage } from './types';

export const GNET_SET: SetPage = {
  id: 'gn',
  groups: [
    {
      title: '@page',
      rows: [
        { key: 'lazy', label: '자동 호출', common: 'auto', ctl: { t: 'seg', opts: [['1', '수동'], ['open', '창을 열 때'], ['0', '매 턴']], fb: '1' },
          help: { '1': '새로고침 버튼을 누를 때만 불러요', open: '채팅이 진행된 뒤 괴담넷을 열면 한 번 불러요', '0': '채팅 응답이 끝날 때마다 모델을 한 번 더 불러요' } },
        { key: 'joint', label: '한 번에 요청', common: 'joint', ctl: { t: 'custom' },
          help: '괴담톡·괴담넷·괴담갤·세정게·연어 마켓 중 「매 턴」이고 모델이 같은 것들을 한 요청으로 묶어요 (다섯 페이지 공통 값, 쇼핑몰은 따로). 끄면 하나씩 따로 불러요.' },
        { key: 'mode', label: '모델', common: 'model', ctl: { t: 'seg', opts: [['1', '메인 모델'], ['2', '보조 모델']], fb: '2' },
          help: '게시판 글·댓글·쪽지를 만들 때 부를 모델이에요. 보조 모델 = Risu의 보조 모델(싸고 빠름), 메인 모델 = 본편과 같은 모델' },
        { key: 'context', label: '컨텍스트에 포함', common: 'ctx', ctl: onOff('0', '0'), help: '지금 장면과 관련된 글과 쪽지가 채팅 요청에 참고로 붙어요' },
        { key: 'sampling', label: '다양성 강화', common: 'sampling', ctl: { t: 'seg', opts: [['0', 'OFF'], ['1', 'ON']], fb: '0' },
          help: '켜면 모델이 한 번에 서로 다른 게시판 두 벌을 쓰고, 플러그인이 뻔한 첫 벌 대신 두 번째 벌을 써요. 응답이 길어져 토큰을 더 써요' },
      ],
    },
    {
      title: '게시판',
      rows: [
        { key: 'post', label: '게시글 수', ctl: { t: 'minmax', lo: COUNT_RANGE.post[0], hi: COUNT_RANGE.post[1], unit: '개' }, help: `새로고침 한 번에 새로 만드는 글 수예요(${COUNT_RANGE.post[0]}~${COUNT_RANGE.post[1]}). 많을수록 토큰을 더 써요` },
        { key: 'cmt', label: '새 글 댓글 수', ctl: { t: 'minmax', lo: COUNT_RANGE.cmt[0], hi: COUNT_RANGE.cmt[1], unit: '개' }, help: `새로 만드는 글마다 달릴 댓글 수예요(${COUNT_RANGE.cmt[0]}~${COUNT_RANGE.cmt[1]}). 그 안에서 글마다 모델이 정해요` },
        { key: 'act', label: '활동 댓글 수', ctl: { t: 'minmax', lo: COUNT_RANGE.act[0], hi: COUNT_RANGE.act[1], unit: '개' }, help: `새로고침이나 답장 때 지난 글에 새로 붙는 댓글 수예요(${COUNT_RANGE.act[0]}~${COUNT_RANGE.act[1]}). 바뀐 글마다 이 안에서 붙어요` },
        { key: 'privacy', label: '사생활', ctl: { t: 'seg', opts: [['0', '이목집중'], ['1', '자율'], ['2', '약보호'], ['3', '강보호'], ['4', '언급금지']] },
          help: '게시판 사람들이 「보호 대상」(기본은 주인공)을 얼마나 입에 올리는지예요. 이목집중 = 목격담·소문이 자주 올라옴, 자율 = 이미 유명한 경우에만 멀리서 본 정도, 약보호 = 평범한 사람 취급(큰 사건의 여파만), 강보호 = 그보다 더 제한, 언급금지 = 본인 이야기는 전혀 없고 행동의 결과만' },
        { key: 'subject', label: '주제', ctl: { t: 'text', ph: '비우면 세계관에 맞는 다양한 주제' } },
        { key: 'mood', label: '분위기·말투', ctl: { t: 'text', ph: '비우면 익명 커뮤니티 말투' } },
        { key: 'protagonist', label: '보호 대상', ctl: { t: 'text', ph: '비우면 주인공' }, help: '위 「사생활」이 지켜 줄 사람 이름이에요. 비우면 주인공' },
        { key: 'keyfigures', label: '주요 인물 닉네임', ctl: { t: 'seg', opts: [['1', '보존'], ['0', '안 함']], fb: '1' }, help: '주요 인물이 게시판에서 쓰는 닉네임을 기억해 다음 새로고침에도 같은 닉네임을 써요' },
        { key: 'keepown', label: '새로고침 시 내 글', ctl: { t: 'seg', opts: [['1', '유지'], ['0', '교체']] }, help: '새로고침하면 옛 글이 새 글로 바뀌는데, 내가 쓴 글은 남길지예요' },
        { key: 'keepreplied', label: '내 댓글 있는 글', ctl: { t: 'seg', opts: [['1', '유지'], ['0', '교체']] }, help: '내가 댓글을 단 남의 글도 새로고침 때 남길지예요' },
      ],
    },
    {
      title: '쪽지',
      rows: [
        { key: 'incoming', label: '선쪽지 받기', ctl: { t: 'seg', opts: [['1', '받기'], ['0', '안 받기']], fb: '1' }, help: '게시판 사람이 먼저 나에게 쪽지를 보낼 수 있게 할지예요' },
        { key: 'storage', label: '쪽지 자동 정리', ctl: { t: 'custom' } },
      ],
    },
  ],
};
