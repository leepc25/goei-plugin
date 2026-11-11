// 화면·캐릭터 이미지·상황판·상태창·가계부·소지품·상점 설정 정의표. 버튼은 「set-열쇠」 꼴이다.
// 조건에 따라 보이는 줄의 조건과, 값에 따라 달라지는 설명·조작은 아직 화면 코드(ui/settings.ts)에 있다
import type { SetPage } from './types';

export const SETTINGS_SET: SetPage = {
  id: 'set',
  flat: true,
  groups: [
    {
      title: '화면',
      rows: [
        { key: 'theme', label: '테마', ctl: { t: 'seg', opts: [['light', '라이트'], ['dark', '다크'], ['paper', '페이퍼']] } },
        { key: 'nav', label: '메뉴 위치', ctl: { t: 'seg', opts: [['left', '왼쪽'], ['right', '오른쪽']] }, help: 'PC 창에서 메뉴 목록을 놓을 쪽이에요.', scope: 'device' },
        { key: 'wiki-side', label: '위키 목록 위치', ctl: { t: 'seg', opts: [['left', '왼쪽'], ['right', '오른쪽']] }, help: '위키의 세로바와 숨은 목록 서랍을 놓을 쪽이에요. 폰의 「목록」 책갈피도 같은 쪽으로 가요.', scope: 'device' },
        { key: 'agents', label: '요원 칸', ctl: { t: 'seg', opts: [['wall', '모니터'], ['list', '목록']] }, help: '상황판 요원 칸 모양이에요.', scope: 'device' },
        { key: 'dim', label: '창 바깥 불투명도', ctl: { t: 'custom' }, help: '창 뒤 채팅 화면을 가리는 정도예요. 0%면 그대로 보이고 100%면 다 가려요.', scope: 'device' },
        { key: 'progress', label: '호출 진행 창', ctl: { t: 'seg', opts: [['1', 'ON'], ['0', 'OFF']] }, help: '채팅을 보내면 채팅 화면 오른쪽 위에 지금 도는 단계(라우터·디렉터·본편·갱신기·인터넷)와 모델·토큰·경과 시간을 보여 줘요. PC는 카드로 펼쳐졌다 끝나면 단추로 접히고, 폰은 점 다섯 개짜리 막대예요. 눌러서 지난 턴을 다시 볼 수 있어요.', scope: 'device' },
        { key: 'frame', label: '외부 프레임', ctl: { t: 'seg', opts: [['none', '없음'], ['tablet', '일반 태블릿'], ['tactical', '전술 태블릿']] }, scope: 'device' },
        { key: 'editor-width', label: '설정 창 폭', ctl: { t: 'seg', opts: [['60', '60%'], ['70', '70%'], ['80', '80%'], ['90', '90%'], ['100', '100%']] }, help: '이 설정 창이 화면 가로의 몇 %를 쓸지예요. 높이는 늘 화면의 90%. 폰에서는 늘 전체 화면이에요.', scope: 'device' },
      ],
    },
    {
      title: '캐릭터 이미지',
      rows: [
        { key: 'asset', label: '에셋 출력', ctl: { t: 'seg', opts: [['1', 'ON'], ['0', 'OFF']] }, help: '본문에 등장하는 캐릭터의 등록 이미지를 표시하도록 이미지 태그를 적어요. 이미지와 태그 목록은 봇 카드에 들어 있어요.' },
        { key: 'img-size', label: '이미지 크기', ctl: { t: 'custom' }, help: '채팅 속 캐릭터 이미지 칸의 크기예요. 100%가 원래 크기이고, 채팅 폭보다 커지지는 않아요.', scope: 'device' },
        { key: 'img-foldon', label: '이미지 접기', ctl: { t: 'seg', opts: [['1', '접기'], ['0', '펼침']] }, help: '이미지를 위쪽만 보이게 접어 두고 누르거나 마우스를 올리면 펼칠지, 늘 펼쳐 둘지예요.', scope: 'device' },
        { key: 'img-foldlock', label: '접힌 그림 펼치기', ctl: { t: 'seg', opts: [['1', '펼치기'], ['0', '안 펼침']] }, help: '접힌 그림을 누르거나 마우스를 올렸을 때 펼칠지, 늘 접힌 채 둘지예요.', scope: 'device' },
        { key: 'img-fold', label: '접힌 높이', ctl: { t: 'custom' }, help: '접혔을 때 그림 높이의 몇 %를 보여 줄지예요. 68%면 정사각형으로 보여요.', scope: 'device' },
        { key: 'img-show', label: '이미지 표시 범위', ctl: { t: 'custom' }, help: '이미지를 띄울 메시지예요. 「최근만」이면 마지막 메시지부터 정한 개수까지만 띄워요. 바꾼 값은 메시지를 다시 그릴 때 반영돼요.', scope: 'device' },
        { key: 'img-send', label: '요청 속 이미지 태그', ctl: { t: 'custom' }, help: '모델에 보내는 대화 기록에서 이미지 태그를 남길 메시지예요. 오래된 태그를 빼면 토큰이 줄어요. 최근 태그는 모델이 태그 쓰는 법을 따라 하도록 남겨요.', scope: 'device' },
        { key: 'asset-model', label: '출력 모델', ctl: { t: 'seg', opts: [['main', '메인 모델'], ['aux', '보조 모델']] }, help: '메인 모델은 본문과 함께 적고, 보조 모델은 응답이 끝난 뒤 한 번 더 불러 태그를 보충해요.' },
        { key: 'asset-player', label: '주인공 이미지', ctl: { t: 'seg', opts: [['1', 'ON'], ['0', 'OFF']] }, help: '「캐릭터로 플레이」로 고른 요원(내가 연기하는 주인공)에게도 이미지 태그를 붙일지예요. 끄면 페르소나처럼 주인공 이미지는 띄우지 않아요.' },
        { key: 'asset-limit', label: '캐릭터당 이미지 수', ctl: { t: 'seg', opts: [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']] }, help: '보조 모델이 한 응답에서 캐릭터 한 명에게 붙일 이미지 태그의 최대 개수' },
      ],
    },
    {
      title: '상황판',
      rows: [
        { key: 'anomaly', label: '괴이 발생 · 요원 시스템', ctl: { t: 'custom' } },
        { key: 'agent', label: '요원 표시 인원', ctl: { t: 'custom' } },
        { key: 'support', label: '지원 투입', ctl: { t: 'seg', opts: [['1', 'ON'], ['0', 'OFF']] }, help: '편성에서 등록 요원 외의 일반 지원 인원을 더할 수 있어요.' },
        { key: 'people', label: '인물 기록', ctl: { t: 'seg', opts: [['1', 'ON'], ['0', 'OFF']] } },
      ],
    },
    {
      title: '상태창',
      rows: [
        { key: 'status', label: '상태창', ctl: { t: 'seg', opts: [['auto', '테마'], ['dark', '다크'], ['light', '라이트'], ['paper', '페이퍼'], ['off', '미표시']] }, help: '채팅 속 상태창의 배색이에요. 「테마」는 위 테마를 따라가요. 미표시를 고르면 상자만 숨기고, 모델은 상태 태그를 계속 써요.', scope: 'device' },
      ],
    },
    {
      title: '가계부',
      rows: [
        { key: 'wallet-on', label: '가계부', ctl: { t: 'seg', opts: [['1', 'ON'], ['0', 'OFF']] }, help: '켜면 상태창에 잔고 칸을 두고, 본문에 금액이 적힌 거래를 인물 기록 갱신기가 뽑아 가계부에 더하고 빼요. 끄면 잔고 칸과 거래 기록이 빠져요. 소지품·상점과 따로 켜고 꺼요.' },
        { key: 'wallet-start', label: '시작 잔고', ctl: { t: 'custom' } },
        { key: 'wallet-edit', label: '잔고 직접 수정', ctl: { t: 'seg', opts: [['1', 'ON'], ['0', 'OFF']] }, help: '켜면 가계부에서 잔고를 고치고 거래를 지울 수 있고, 진행 중인 채팅의 시작 잔고도 바꿀 수 있어요. 이야기 밖에서 바뀐 잔고는 모델이 이유를 몰라 대화가 길어질수록 앞뒤가 꼬이기 쉬워요.' },
        { key: 'wallet-sync', label: '상태창 잔고 따르기', ctl: { t: 'seg', opts: [['1', 'ON'], ['0', 'OFF']] }, help: '켜면 모델이 상태창 잔고 칸을 바꿨을 때 가계부를 그 값에 맞춰요. 끄면 가계부 값만 믿고, 다음 요청에 넘기는 지난 상태창의 잔고를 가계부 값으로 덮어 모델이 고치게 해요.' },
        { key: 'wallet-loose', label: '거래 읽는 기준', ctl: { t: 'seg', opts: [['0', '금액이 적힌 것만'], ['1', '어림도 받기']] }, help: '금액이 적힌 것만이면 「3만 원을 냈다」처럼 금액이 글에 있는 거래만 적어요. 어림도 받기면 「밥을 사 먹었다」처럼 금액이 없는 거래도 보조 모델이 서울 물가로 어림해 메모에 「(어림)」을 붙여 적어요.' },
        { key: 'wallet-recent', label: '최근 거래 넘기기', ctl: { t: 'custom' } },
      ],
    },
    {
      title: '소지품',
      rows: [
        { key: 'inv-on', label: '소지품', ctl: { t: 'seg', opts: [['1', 'ON'], ['0', 'OFF']] }, help: '끄면 소지품 화면·[Inventory] 글·보조 모델 읽기·「다음 메시지에 사용」이 다 빠지고, 소지품에 딸린 상점도 같이 꺼져요. 가계부는 그대로예요.' },
        { key: 'items-push', label: '컨텍스트에 포함', ctl: { t: 'seg', opts: [['1', 'ON'], ['0', 'OFF']] }, help: '켜면 매 요청에 지금 가진 물건·한계·이번 턴 사건(사용·새로 산 것·넘침)을 [Inventory] 글로 넣어요. 모델이 상황을 알고 응답에 반영해요. 플러그인은 막거나 경고하지 않아요. 끄면 물건 목록은 안 가고, 상점이 켜져 있으면 상점 표식 지침과 상점 사건만 [Shop] 글로 가요.' },
        { key: 'items-auto', label: '보조 모델이 읽기', ctl: { t: 'seg', opts: [['1', 'ON'], ['0', 'OFF']] }, help: '켜면 인물 기록 갱신기가 응답을 읽어 본문에서 얻은·잃은 물건을 목록에 맞춰요(근거 문장이 있는 것만, 인물 기록이 켜져 있을 때). 끄면 직접 넣기·상점으로만 바뀌어요.' },
        { key: 'items-slots', label: '칸 수', ctl: { t: 'custom' } },
        { key: 'items-carry', label: '소지 한도', ctl: { t: 'custom' } },
        { key: 'items-edit', label: '고치기', ctl: { t: 'seg', opts: [['1', 'ON'], ['0', 'OFF']] }, help: '켜면 물건 창에 「고치기」 단추가 생겨 이름·설명·효과·장착·횟수·무게를 손으로 바꿀 수 있어요. 이야기 밖에서 바뀐 물건은 모델이 이유를 몰라서 기본은 꺼 둬요.' },
        { key: 'items-limit', label: '지닐 수 있는 한계', ctl: { t: 'custom' }, help: '모델에 알려 주는 한 줄이에요(Carry limit). 비우면 기본 문장으로 돌아가요.' },
        { key: 'items-alias', label: '그림 대체 말', ctl: { t: 'custom' }, help: '물건 그림을 찾을 때 이름의 끝 말을 바꿔 찾아요. 한 줄에 「외투 → 코트」. 비우면 기본 표(회색 글). 그림은 모델이 「종류/물건말」(옷/코트)로 적은 종류 안에서 먼저 찾고, 없으면 전체에서 찾아요. 그래도 없으면 상자 그림이에요.' },
        { key: 'items-pool', label: '분류 말은 골고루', ctl: { t: 'seg', opts: [['1', 'ON'], ['0', 'OFF']] }, help: '물건 이름이 「과자·다과·간식」처럼 세부 이름이 아니라 분류 말이면 그 분류의 그림 가운데 하나를 물건마다 뽑아 보여 줘요. 한 번 정해진 그림은 그 물건에 그대로 남아요. 끄면 분류마다 대표 그림 한 장만 나와요.' },
        { key: 'items-misses', label: '그림 못 찾은 말', ctl: { t: 'custom' }, help: '이번에 앱을 켠 뒤로 제 그림을 못 찾아 상자로 간 물건이에요. 그림을 더 뽑을 때 참고해요.' },
        { key: 'items-detail', label: '본편에 넘길 내용', ctl: { t: 'seg', opts: [['full', '전부'], ['state', '이름·판정'], ['name', '이름만']] }, help: '[Inventory] 한 줄에 무엇을 넣을지예요. 전부 = 이름·설명·효과·장착·남은 횟수·상태, 이름·판정 = 설명·효과를 빼고, 이름만 = 이름뿐. 물건이 많을 때 줄이면 토큰이 덜 들어요.' },
        { key: 'items-state', label: '상태 바꾸기', ctl: { t: 'seg', opts: [['1', 'ON'], ['0', 'OFF']] }, help: '켜면 보조 모델이 본문을 보고 물건을 손상·고장·파괴로 바꿔요. 끄면 손상·고장은 받지 않고, 부서진 물건은 「없어짐」으로만 빠져요.' },
        { key: 'items-spent', label: '다 쓴 물건', ctl: { t: 'seg', opts: [['remove', '목록에서 빼기'], ['keep', '남겨 두기']] }, help: '남은 횟수가 0이 된 소모품을 어떻게 할지예요. 남겨 두면 「다 씀」으로 칸에 남고 본편에도 used up 으로 넘어가요(빈 병·다 쓴 탄창처럼).' },
        { key: 'items-logturns', label: '사용·처분 기록 넘기기', ctl: { t: 'custom' } },
        { key: 'items-start', label: '시작 소지품', ctl: { t: 'seg', opts: [['1', 'ON'], ['0', 'OFF']] }, help: '고유 인물로 시작할 때 명부의 「시작 소지품」을 넣고 무기·장비를 장착할지예요. 새 채팅을 시작할 때만 쓰여요.' },
      ],
    },
    {
      title: '상점',
      rows: [
        { key: 'shop-on-locked', label: '상점', ctl: { t: 'custom' } },
        { key: 'shop-on', label: '상점', ctl: { t: 'seg', opts: [['1', 'ON'], ['0', 'OFF']] }, help: '켜면 지금 장면에 살 수 있는 곳이 있는지 판단해(아래 「상점 판단」), 있으면 그 응답 아래에 「상점 열기」가 붙어요. 물건은 열 때 보조 모델이 맥락대로 지어요. 잔고·소지품은 모델에 넘기지 않아요.' },
        { key: 'shop-judge', label: '상점 판단', ctl: { t: 'seg', opts: [['auto', '자동'], ['main', '메인 모델'], ['updater', '갱신기']] } },
        { key: 'shop-model', label: '모델', ctl: { t: 'seg', opts: [['main', '메인 모델'], ['aux', '보조 모델']] }, help: '진열대와 주인 대사를 지을 모델이에요.' },
        { key: 'shop-min', label: '진열대 분량', ctl: { t: 'custom' } },
        { key: 'shop-feature', label: '희귀·특가 구획', ctl: { t: 'seg', opts: [['1', 'ON'], ['0', 'OFF']] }, help: '켜면 진열대마다 희귀 물건 단 하나와 특가 물건 1~3개를 따로 받아, 희귀는 진열장에, 특가는 원래 값에 줄을 긋고 할인율을 붙여 따로 보여 줘요. 끄면 한 격자에 늘어놓아요.' },
        { key: 'shop-ctx', label: '맥락 반영', ctl: { t: 'seg', opts: [['1', '맥락'], ['0', '가게만']] }, help: '맥락이면 최근 본문·상태창(시각·장소)·진행 중 괴이·신분을 같이 넘겨 지금 상황에 맞는 물건이 나와요. 가게만이면 가게 정체와 참고 자료만 넘겨요.' },
        { key: 'shop-price', label: '값 기준', ctl: { t: 'custom' }, help: '모델에 알려 주는 값 기준 한 줄이에요. 비우면 그 가게에 어울리는 실제 물가로 지어요.' },
        { key: 'shop-diverse', label: '다양성', ctl: { t: 'seg', opts: [['1', 'ON'], ['0', 'OFF']] }, help: '켜면 뻔한 물건만 늘어놓지 않고 싼 것·비싼 것·흔한 것·특이한 것을 섞어요.' },
        { key: 'shop-thoughts', label: '생각 단계', ctl: { t: 'seg', opts: [['off', '사용 안 함'], ['inner', '속으로만'], ['note', '적고 지움']] }, help: '물건을 짓기 전에 가게·장면·주인을 먼저 정리하게 해요. 적고 지움은 응답이 길어져요.' },
        { key: 'shop-prev', label: '지난 진열대 피하기', ctl: { t: 'seg', opts: [['1', 'ON'], ['0', 'OFF']] }, help: '새로고침할 때 이번 방문에 이미 보였던 물건을 피해요.' },
        { key: 'shop-kick', label: '거래 끊음', ctl: { t: 'seg', opts: [['1', 'ON'], ['0', 'OFF']] }, help: '켜면 주인이 모욕·끝없는 흥정 같은 일에 거래를 끊을 수 있어요. 끊기면 진열대가 잠기고 다음 턴 본편에 넘어가요. 끄면 주인이 아무리 화나도 가게는 열려 있어요.' },
        { key: 'shop-where', label: '상점이 열리는 자리', ctl: { t: 'seg', opts: [['any', '어디서든'], ['shop', '가게 장면만']] }, help: '어디서든이면 판매자가 있는 가게뿐 아니라 온라인몰·홈쇼핑·카탈로그·자판기처럼 주인이 없는 곳에서도 「상점 열기」가 붙어요. 가게 장면만이면 판매자가 그 자리에 있는 가게·노점에서만 붙어요.' },
        { key: 'shop-turns', label: '최근 본문 턴 수', ctl: { t: 'custom' }, help: '진열대·주인 대사를 지을 때 넘기는 최근 본문 턴 수예요(1~8, 맥락 반영이 「맥락」일 때).' },
        { key: 'shop-refs', label: '참고 로어북 수', ctl: { t: 'custom' }, help: '봇 설명·지금 켜진 로어북·가게 이름과 주인 이름이 걸리는 로어북(주인 인물 포함)·위키의 가게 문서 가운데 최대 몇 개를 넘길지예요(0~12).' },
        { key: 'shop-note', label: '넘기는 것·남는 것', ctl: { t: 'custom' }, help: '모델에 가는 것: 가게 이름·주인, 가게 정체(첫 호출 뒤 고정), 위의 참고 로어북, 맥락이면 주인공 신분·상태창 마지막 줄·진행 중 괴이·최근 본문, 이번 방문 진열대·대화 전부. 안 가는 것: 잔고·소지품·페르소나·작가 노트. 본편에는 다음 턴 [Inventory] 글의 This turn 으로 「새로 산 것」·「판 것」·「주인과 나눈 대화 전부」·「쫓겨남」이 넘어가고, 산 물건은 소지품에, 돈은 가계부에 남아요. 조립된 요청 원문은 점검 → 호출 기록에서 봐요.' },
      ],
    },
  ],
};
