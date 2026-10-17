// 모델 호출 (위키·괴담넷·괴담톡 생성). 본편 요청과 따로, 사용자가 그 화면에서 누를 때만 부른다.
import { prepareAttachments } from '../core/attach';
import { photoData } from './photo';
export type ModelChoice = 'main' | 'aux';

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class LlmError extends Error {
  constructor(message: string, readonly raw = '') {
    super(message);
  }
}

/** 생각 블록 제거 */
function stripThoughts(s: string): string {
  return s.replace(/<(thoughts|think)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '').replace(/<(?:thoughts|think)\b[^>]*>[\s\S]*$/gi, '');
}

async function readStream(stream: ReadableStream<unknown>): Promise<string> {
  const reader = stream.getReader();
  let last = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (typeof value === 'string') last = value;
      else if (value && typeof value === 'object') last = String(Object.values(value as Record<string, unknown>)[0] ?? last);
    }
  } finally {
    reader.releaseLock();
  }
  return last;
}

/** ATTACHMENT DATA 메시지의 사진 경로를 실제 사진(multimodals)으로 바꾼다. 못 읽은 사진은 그렇다고 적는다 */
async function withPhotos(messages: (LlmMessage & { images?: string[] })[]): Promise<unknown[]> {
  return Promise.all(
    messages.map(async (m) => {
      if (!m.images?.length) return m;
      const { images, ...rest } = m;
      const data = await Promise.all(images.map(photoData));
      const missing = data.map((d, i) => (d ? 0 : i + 1)).filter(Boolean);
      return {
        ...rest,
        content: missing.length ? `${rest.content}\nImage ${missing.join(', ')} could not be loaded; do not describe it.` : rest.content,
        multimodals: data.filter((d): d is string => !!d).map((base64) => ({ type: 'image', base64 })),
      };
    }),
  );
}

export async function runModel(messages: LlmMessage[], model: ModelChoice): Promise<string> {
  let res: unknown;
  try {
    // allowPlugins: 사용자가 플러그인이 제공하는 모델(pluginmodel:::)을 메인·보조로 쓰면 이게 없을 때 Risu가 막는다.
    // 이 플러그인은 모델 제공 플러그인이 아니라서 서로 부르는 고리가 생기지 않는다.
    res = await risuai.runLLMModel({ messages: await withPhotos(prepareAttachments(messages)), mode: model === 'aux' ? 'submodel' : 'model', allowPlugins: true });
  } catch (error) {
    throw new LlmError(`모델 요청에 실패했어요: ${error instanceof Error ? error.message : String(error)}`);
  }
  let text = '';
  if (typeof res === 'string') text = res;
  else if (res && typeof res === 'object') {
    const r = res as { type?: string; result?: unknown };
    if (r.type === 'fail' && /Plugin calls are blocked/i.test(String(r.result ?? ''))) {
      throw new LlmError('Risu가 플러그인 모델 호출을 막았어요. 이 버전의 Risu는 플러그인이 제공하는 모델을 다른 플러그인에서 쓸 수 없어요. Risu를 최신으로 업데이트하거나, 위키·괴담넷 모델을 플러그인 모델이 아닌 쪽(메인/보조)으로 바꿔 보세요.', String(r.result));
    }
    if (r.type === 'fail') throw new LlmError(`모델 요청에 실패했어요. Risu의 모델 연결을 확인해 주세요.\n${String(r.result ?? '').slice(0, 300)}`, String(r.result ?? ''));
    if (r.type === 'multiline' && Array.isArray(r.result)) text = (r.result as [string, string][]).filter(([role]) => role === 'char').map(([, t]) => t).join('\n');
    else if (r.type === 'streaming' && r.result && typeof (r.result as ReadableStream).getReader === 'function') text = await readStream(r.result as ReadableStream<unknown>);
    else if (typeof r.result === 'string') text = r.result;
  }
  text = stripThoughts(text).trim();
  if (!text) throw new LlmError('모델이 빈 응답을 보냈어요.');
  return text;
}
