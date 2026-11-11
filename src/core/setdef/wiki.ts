// 위키 설정 정의표. 버튼은 「wiki-열쇠」 꼴이다
import { onOff, type SetPage } from './types';

export const WIKI_SET: SetPage = {
  id: 'wiki',
  flat: true,
  groups: [
    {
      title: '',
      rows: [
        { key: 'auto', label: '자동 호출', common: 'auto', ctl: { t: 'seg', opts: [['0', '수동'], ['open', '창을 열 때'], ['turn', '매 턴']] }, help: '턴이 진행되면 문서 하나를 저절로 써요. 문서가 길어 호출 하나가 커요' },
        { key: 'auto_title', label: '자동 작성 제목', ctl: { t: 'seg', opts: [['model', '모델이 고름'], ['input', '직접 입력']] }, help: '모델이 고름 = 명부 항목 중 이번 이야기에 맞는 것' },
        { key: 'auto_query', label: '직접 입력', show: { key: 'auto_title', eq: 'input' }, ctl: { t: 'text', ph: '문서 제목' } },
        { key: 'model', label: '모델', common: 'model', ctl: { t: 'seg', opts: [['main', '메인 모델'], ['aux', '보조 모델']] }, help: '문서를 쓸 때 부를 모델이에요' },
        { key: 'adv_model_id', label: '전용 모델', ctl: { t: 'adv', item: 'model_id' } },
      ],
    },
    {
      title: '참조',
      rows: [
        { key: 'adv_turns', label: '챗로그 포함', ctl: { t: 'adv', item: 'turns' } },
        { key: 'adv_refs', label: '', ctl: { t: 'advchips', items: ['desc', 'authors', 'persona', 'active', 'related', 'secondary'] } },
        { key: 'adv_ref_count', label: '관련·2차 참조 최대', ctl: { t: 'adv', item: 'ref_count' } },
        { key: 'refresh_previous', label: '다시 쓸 때 이전 문서 참조', ctl: onOff(), help: '문서를 다시 쓸 때 이전 문서를 요청에 넣어요' },
        { key: 'adv_budget', label: '요청 토큰 상한', ctl: { t: 'adv', item: 'budget' } },
      ],
    },
    {
      title: '컨텍스트 포함',
      rows: [
        { key: 'context', label: '사용', common: 'ctx', ctl: onOff(), help: '장면에 나온 문서가 메인 요청에 붙어요' },
        { key: 'adv_ctx', label: '', ctl: { t: 'advchips', items: ['ctx_focus', 'ctx_lore', 'ctx_created'] } },
        { key: 'adv_ctx_count', label: '넣을 문서', ctl: { t: 'adv', item: 'ctx_count' } },
        { key: 'adv_ctx_tokens', label: '컨텍스트 토큰 상한', ctl: { t: 'adv', item: 'ctx_tokens' } },
      ],
    },
    {
      title: '문서',
      rows: [
        { key: 'length', label: '분량', ctl: { t: 'seg', opts: [['short', '짧게'], ['standard', '보통'], ['detailed', '상세']] }, help: '문서 길이예요' },
        { key: 'mode', label: '작성 모드', ctl: { t: 'seg', opts: [['expand', '확장'], ['faithful', '원본 충실']] }, help: '확장 = 원본 사실은 지키고 비어 있는 곳을 어울리는 새 내용으로 채워요 · 원본 충실 = 새 사건·능력·관계를 더하지 않고 있는 내용만 풀어 써요' },
        { key: 'images', label: '그림', ctl: { t: 'seg', opts: [['off', '끔'], ['infobox', '정보칸만'], ['body', '본문까지']] }, help: '본문까지면 괴이·특수·거점·조직 그림을 본문에 넣고, 인물 문서는 정보칸 표정을 모델이 골라요. 인물 그림은 본문에 넣지 않아요' },
        { key: 'footnotes', label: '주석', ctl: { t: 'seg', opts: [['pop', '뜨는 창'], ['inline', '펼치기']] }, help: '펼치기는 주석을 본문 안에 괄호로 둬요. 폰에서 읽기 편해요' },
        { key: 'request', label: '공용 지침', ctl: { t: 'area', ph: '모든 문서에 덧붙일 말투·형식·관점', rows: 3, cls: 'nw-reqbox' } },
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
  ],
};
