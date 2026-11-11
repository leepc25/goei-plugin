// 위키 설정 정의표. 버튼은 「wiki-열쇠」 꼴이다
import { onOff, type SetPage } from './types';

export const WIKI_SET: SetPage = {
  id: 'wiki',
  flat: true,
  groups: [
    {
      title: '자동 작성',
      rows: [
        { key: 'auto', label: '자동 호출', common: 'auto', ctl: { t: 'seg', opts: [['0', '수동'], ['open', '창을 열 때'], ['turn', '매 턴']] }, help: '채팅이 진행되면 문서 하나를 저절로 써요. 문서가 길어 호출 하나가 커요' },
        { key: 'auto_title', label: '제목', ctl: { t: 'seg', opts: [['model', '모델이 고름'], ['input', '직접 입력']] }, help: '모델이 고름 = 명부 항목 중 이번 이야기에 맞는 것' },
        { key: 'auto_query', label: '직접 입력', show: { key: 'auto_title', eq: 'input' }, ctl: { t: 'text', ph: '문서 제목' } },
      ],
    },
    {
      title: '문서 작성',
      rows: [
        { key: 'length', label: '분량', ctl: { t: 'seg', opts: [['short', '짧게'], ['standard', '보통'], ['detailed', '상세']] } },
        { key: 'mode', label: '작성 모드', ctl: { t: 'seg', opts: [['expand', '확장'], ['faithful', '원본 충실']] } },
        { key: 'model', label: '모델', common: 'model', ctl: { t: 'seg', opts: [['main', '메인 모델'], ['aux', '보조 모델']] } },
        { key: 'refresh_previous', label: '다시 쓸 때 이전 문서 참고', ctl: onOff() },
        { key: 'context', label: '컨텍스트에 포함', common: 'ctx', ctl: onOff(), help: '채팅에 나온 문서가 채팅 요청에 참고로 붙어요' },
        { key: 'footnotes', label: '주석', ctl: { t: 'seg', opts: [['pop', '뜨는 창'], ['inline', '펼치기']] }, help: '펼치기는 주석을 본문 안에 괄호로 둬요. 폰에서 읽기 편해요' },
        { key: 'images', label: '그림', ctl: { t: 'seg', opts: [['off', '끔'], ['infobox', '정보칸만'], ['body', '본문까지']] }, help: '본문까지면 괴이·특수·거점·조직 그림을 본문에 넣고, 인물 문서는 정보칸 표정을 모델이 골라요. 인물 그림은 본문에 넣지 않아요' },
      ],
    },
    { title: '공용 지침', rows: [{ key: 'request', label: '공용 지침', ctl: { t: 'area', ph: '모든 문서에 덧붙일 말투·형식·관점', rows: 3, cls: 'nw-reqbox' } }] },
  ],
};
