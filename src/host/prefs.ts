// 새 채팅 기본값을 플러그인 저장소에 둔다. 저장소는 Risu 저장 파일과 함께 보관·동기화된다.
import { getPrefs, setPrefs, type Prefs } from '../core/settings';

const KEY = 'goei:prefs';

export async function loadPrefs(): Promise<Prefs> {
  try {
    const raw: unknown = await risuai.pluginStorage.getItem(KEY);
    return setPrefs(typeof raw === 'string' ? JSON.parse(raw) : raw);
  } catch (error) {
    console.log(`[goei] 기본 설정을 읽지 못했어요: ${error instanceof Error ? error.message : String(error)}`);
    return getPrefs();
  }
}

/** 고친 값을 합쳐 저장한다 */
export async function savePrefs(change: (p: Prefs) => Prefs): Promise<Prefs> {
  const next = setPrefs(change(structuredClone(getPrefs())));
  await risuai.pluginStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
