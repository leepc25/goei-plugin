// 플러그인이 놓은 유저 메시지를 곧바로 보낸다 (채팅창 전송 버튼을 한 번 더 누르지 않게).
// Risu sendChat('')은 새 메시지 없이 전송만 하고, 응답이 끝날 때까지 기다린다.
// 권한 거부·이미 생성 중·플러그인 제공 모델(Risu가 막음)이면 바로 실패하므로, 잠깐만 기다려 실패 여부를 본다.
const QUICK_FAIL_MS = 700;

/** 보냈으면(또는 생성이 시작됐으면) true, 바로 실패했으면 false */
export async function sendNow(): Promise<boolean> {
  let sent: Promise<boolean>;
  try {
    sent = Promise.resolve(risuai.sendChat('')).then(
      (r) => (r as unknown) !== false,
      (e) => {
        console.log(`[goei] 자동 전송 실패: ${e instanceof Error ? e.message : String(e)}`);
        return false;
      },
    );
  } catch {
    return false;
  }
  return Promise.race([sent, new Promise<boolean>((r) => setTimeout(() => r(true), QUICK_FAIL_MS))]);
}

/** 자동 전송이 안 될 때 안내 */
export const SEND_FALLBACK = '채팅에 요청을 놓았어요. 자동 전송이 막혀 있어서(플러그인 모델 사용 등) 채팅창의 전송 버튼을 한 번 눌러 주세요.';

/** 안내 상자 모양: 자동 전송 안내는 오류가 아니라 일반 안내 색 */
export const noticeClass = (text: string): string => (text === SEND_FALLBACK ? 'gx-err info' : 'gx-err');
