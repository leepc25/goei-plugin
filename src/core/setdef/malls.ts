// 쇼핑몰(우주 쇼핑몰·백일몽 포인트몰) 설정 정의표. 두 사이트가 같은 틀이고 몇 줄의 이름·설명만 다르다.
// 버튼 값 앞에 사이트가 붙는다: 「ms-cfg」에 「cos:auto=turn」
// 진열 배정·1:1 상담·맞춤 주문·진짜 효과·시그니처 상품 묶음은 아직 화면 코드(ui/malls.ts)에 있다 (목록 편집이 얽힌 묶음)
import { MALL_NAME, type MallSite } from '../malls';
import { SHOP_SIZE_HI, SHOP_SIZE_LO } from '../shop';
import { onOff, type SetPage } from './types';

export const mallSet = (site: MallSite): SetPage => ({
  id: 'ms',
  groups: [
    {
      title: MALL_NAME[site],
      rows: [
        { key: 'auto', label: '자동 호출', common: 'auto', ctl: { t: 'seg', opts: [['manual', '수동'], ['open', '창을 열 때'], ['turn', '매 턴']] },
          help: { manual: '새로 고침을 눌렀을 때만 물건 목록을 새로 받아요.', open: '사이트를 열 때, 지난번에 받은 뒤로 턴이 진행됐으면 한 번 새로 받아요.', turn: '메인 응답마다 물건 목록을 새로 받아요(모델 호출 +1).' } },
        { key: 'model', label: '모델', common: 'model', ctl: { t: 'seg', opts: [['main', '메인 모델'], ['aux', '보조 모델']] }, help: `물건 목록${site === 'cos' ? '과 운영자 답' : ''}을 지을 모델이에요.` },
        { key: 'ctx', label: '맥락 반영', common: 'ctx', ctl: onOff(), help: '켜면 최근 본문·상태창·진행 중 괴이·신분을 같이 넘겨 지금 상황에 맞는 물건이 나와요.' },
        { key: 'size', label: '상품 수', ctl: { t: 'minmax', lo: SHOP_SIZE_LO, hi: SHOP_SIZE_HI, unit: '개', act: 'num', keys: ['min', 'max'] }, help: `한 번에 받을 물건 수예요(${SHOP_SIZE_LO}~${SHOP_SIZE_HI}).` },
        { key: 'feature', label: site === 'cos' ? '추천·할인 구획' : '한정·특가 구획', ctl: onOff(),
          help: site === 'cos' ? '켜면 「강하게 추천」 물건 하나와 ※할인!※ 물건을 받아 같은 목록 칸에 딱지로 표시해요.' : '켜면 「이달의 한정」 하나와 특가 상품을 따로 받아 분류에 보여 줘요.' },
        { key: 'price', label: '값 기준', ctl: { t: 'text', ph: '비우면 사이트에 어울리는 값', max: 80 } },
        { key: 'diverse', label: '다양성 강화', common: 'sampling', ctl: onOff(), help: '켜면 싼 것·비싼 것·흔한 것·특이한 것을 섞어요.' },
        { key: 'prev', label: '지난 목록 피하기', ctl: onOff(), help: '새로 받을 때 이미 보였던 물건을 피해요.' },
        { key: 'thoughts', label: '생각 단계', ctl: { t: 'seg', opts: [['off', '사용 안 함'], ['inner', '속으로만'], ['note', '적고 지움']] } },
        { key: 'turns', label: '챗로그 포함', ctl: { t: 'step', lo: 1, hi: 8, unit: '턴' }, help: '컨텍스트에 포함일 때 넘기는 최근 본문 턴 수예요(1~8).' },
        { key: 'refs', label: '참조 로어북', ctl: { t: 'step', lo: 0, hi: 12, unit: '개' }, help: '봇 설명·켜진 로어북·사이트 이름이 걸리는 로어북 가운데 최대 몇 개를 넘길지예요(0~12).' },
      ],
    },
  ],
});
