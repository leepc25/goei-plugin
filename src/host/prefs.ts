// 새 채팅 기본값을 플러그인 저장소에 둔다. 저장소는 Risu 저장 파일과 함께 보관·동기화된다.
import { getPrefs, PREF_VAR, setPrefs, type Prefs } from '../core/settings';

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

/** 기능 설정(괴담톡·괴담넷·위키) 화면의 「기본값으로 저장」: 이 채팅의 값을 새 채팅 기본값으로.
 *  채팅에 값이 없는(기본값 그대로인) 항목은 기본값에서도 지운다 */
export async function saveVarDefaults(prefixes: string[], state: Record<string, unknown> | undefined): Promise<void> {
  const mine = (k: string) => PREF_VAR.test(k) && prefixes.some((x) => k.startsWith(x));
  await savePrefs((p) => {
    const keys = [...new Set([...Object.keys(state ?? {}), ...Object.keys(p.vars ?? {})])].filter(mine);
    const vars = { ...(p.vars ?? {}) };
    for (const k of keys) {
      const v = state?.[k];
      if (v === undefined || v === null || v === '' || v === 'null') delete vars[k];
      else vars[k] = String(v);
    }
    return { ...p, vars };
  });
}

/** 「불러오기」 옛판: 기본값에 없는 항목을 ''로 채운다. ''를 0으로 읽는 칸이 있어 varDefaultsToLoad 로 옮길 것 (전수검사 11-13) */
export function loadVarDefaults(prefixes: string[], state: Record<string, unknown> | undefined): Record<string, string> {
  const mine = (k: string) => PREF_VAR.test(k) && prefixes.some((x) => k.startsWith(x));
  const saved = getPrefs().vars ?? {};
  const out: Record<string, string> = {};
  for (const k of [...new Set([...Object.keys(state ?? {}), ...Object.keys(saved)])].filter(mine)) out[k] = String(saved[k] ?? '');
  return out;
}

/** 「불러오기」 새판: 기본값에 있는 값은 set, 없는 항목은 drop(채팅 변수에서 지워 코드 기본값으로).
 *  ''로 덮으면 소지 칸·한도·선쪽지 확률 등이 0·최솟값으로 읽혀서 지운다 (전수검사 11-13) */
export function varDefaultsToLoad(prefixes: string[], state: Record<string, unknown> | undefined): { set: Record<string, string>; drop: string[] } {
  const mine = (k: string) => PREF_VAR.test(k) && prefixes.some((x) => k.startsWith(x));
  const saved = getPrefs().vars ?? {};
  const set: Record<string, string> = {};
  const drop: string[] = [];
  for (const k of [...new Set([...Object.keys(state ?? {}), ...Object.keys(saved)])].filter(mine)) {
    const v = saved[k];
    if (typeof v === 'string' && v !== '') set[k] = v;
    else drop.push(k);
  }
  return { set, drop };
}

/** 고친 값을 합쳐 저장한다 */
export async function savePrefs(change: (p: Prefs) => Prefs): Promise<Prefs> {
  const next = setPrefs(change(structuredClone(getPrefs())));
  await risuai.pluginStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
