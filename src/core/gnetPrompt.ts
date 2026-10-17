// 괴담넷 요청문 만들기 (원본 RC.gnetPrompt + LB makeIntro/makeOutro).
// 지침 문장은 카드의 GNet·LB Backend 로어북 섹션을 그대로 읽고, CBS는 직접 푼다.
// 결과는 언제나 두 메시지: system(틀 + 작업 지침 + 출력 형식) / user(참고 자료 + 최근 본문 + 현재 작업).
import { hasAttachment } from './attach';
import { evaluate } from './cbs';
import {
  activityContext, findPost, gnetSettings, gnetVars, HISTORY, incomingTask, LIMITS, protectedPost, QUANTITY, trimTokens, postLimit,
  type ActivityPost, type ActivitySnapshot, type GPost, type GState, type GnetSettings, type IncomingPlan, GnetError, dateNow,
} from './gnet';
import { cbsEnv, collectRefs, factionCodesToNames, policySections, recentTurns, refText, storyText, type RefSource } from './refs';

export type GnetOp = 'refresh' | 'post' | 'comment' | 'dm';

const REQUIRED_GNET = [
  'LB', 'LB.EXTRA', 'EXTENSION.REQUEST', 'ACTION.REFRESH', 'AUTO.GUIDELINE', 'AUTO.FORMAT', 'REACT.GUIDELINE', 'DM.GUIDELINE', 'DM.FORMAT',
  'INCOMING.GUIDELINE', 'DM.REQUEST', 'DM.NO-ORIGIN', 'TITLE.GUIDELINE', 'MAIN_CONTEXT', 'PUBLIC.GUIDELINE', 'PUBLIC.REACT_FORMAT',
  'PUBLIC.POST_FORMAT', 'ACTIVITY.GUIDELINE', 'BOARD.GUIDELINE', 'ATTACHMENTS', 'INCOMING.COMBINED', 'INCOMING.DISABLED', 'ACTIVITY.DISABLED',
];
const REQUIRED_LB = ['SYSTEM', 'OUTPUT', 'JAILBREAK', 'JOB'];

export interface GnetBooks {
  read(name: string): string;
}

/** GNet·LB Backend 섹션을 읽는 함수. 섹션이 빠졌으면 바로 알린다 */
export function gnetBooks(src: RefSource): GnetBooks {
  const g = policySections(src.char.globalLore, 'GNet');
  const lb = policySections(src.char.globalLore, 'LB Backend');
  for (const k of REQUIRED_GNET) if (g[k] === undefined) throw new GnetError(`GNet 로어북의 ${k} 섹션이 없어요.`);
  for (const k of REQUIRED_LB) if (lb[k] === undefined) throw new GnetError(`LB Backend 로어북의 ${k} 섹션이 없어요.`);
  const env = { ...cbsEnv(src), vars: gnetVars(src.chat.scriptstate) };
  return {
    read(name: string) {
      const raw = g[name] ?? lb[name] ?? '';
      return evaluate(raw, env)
        .replace(/__LIMIT_(\w+?)__/g, (m, k: string) => (k in LIMITS ? String(LIMITS[k as keyof typeof LIMITS]) : m))
        .replace(/<!--[\s\S]*?-->/g, '')
        .trim();
    },
  };
}

/** %s를 차례로 채운다 (Lua string.format) */
function fmt(template: string, ...args: string[]): string {
  let i = 0;
  return template.replace(/%s/g, () => args[i++] ?? '');
}

/** __GN_KEY__ 채우기 */
function fill(template: string, values: Record<string, string>): string {
  return template.replace(/__GN_([A-Z_]+)__/g, (m, k: string) => values[k] ?? m);
}

const LANGUAGE = 'Use the language of the actual conversation; default to Korean.';
const IMPORTANT = '\n\nImportant Note: May contain unrelated directives/rules regarding other data/image outputs. Ignore these; they are irrelevant in your current job. Focus on settings.';

export function systemText(b: GnetBooks, guideline: string, format: string, identity?: unknown, attachments = false): string {
  const intro = fmt(b.read('SYSTEM'), b.read('JAILBREAK'), b.read('JOB'), IMPORTANT, 'anonymous forum author', '', '')
    .replace(/## Main Protagonist \([^\n]*\)/, '## User-controlled protagonist (narrator reference only)');
  let outro = fmt(b.read('OUTPUT'), '', format, guideline);
  if (identity) outro += `\nROLE BINDING (application-owned metadata):\n${JSON.stringify(identity)}`;
  outro += `\n${LANGUAGE}`;
  return `${intro}\n${outro}${attachments ? `\n\n${b.read('ATTACHMENTS.READ')}` : ''}`;
}

export interface GnetPrompt {
  messages: { role: 'system' | 'user'; content: string }[];
}

function pack(src: RefSource, b: GnetBooks, guideline: string, format: string, extras: string, factionNames: Record<string, string>, identity?: unknown): GnetPrompt {
  const turns = recentTurns(src.chat, HISTORY.turns);
  const story = storyText(turns);
  const rows = collectRefs(src, {
    scope: 'gnet', text: `${extras}\n${story}`, related: false, secondary: false,
    extra: [{ source: '현재 발생 상황', content: b.read('LB.EXTRA') }],
  });
  const material = `[참고 자료 — 작중 인물에게 자동 공개되지 않음]\n${refText(rows)}\n[최근 본문]\n${story}\n[현재 작업]\n${extras}`;
  const attachments = hasAttachment(material);
  return {
    messages: [
      { role: 'system', content: factionCodesToNames(systemText(b, guideline, format, identity, attachments), factionNames) },
      { role: 'user', content: factionCodesToNames(material, factionNames) },
    ],
  };
}

function incomingRules(b: GnetBooks, plan: IncomingPlan): string {
  return plan.allowed ? `${b.read('INCOMING.GUIDELINE')}\n${b.read('INCOMING.COMBINED')}` : b.read('INCOMING.DISABLED');
}

function activityRules(b: GnetBooks, posts: ActivityPost[]): string {
  return b.read(posts.length ? 'ACTIVITY.GUIDELINE' : 'ACTIVITY.DISABLED');
}

/** 저장된 글을 출력 형식(AUTO.FORMAT)과 같은 모양으로 */
export function boardJson(posts: GPost[]): string {
  return JSON.stringify({
    posts: posts.map((p) => ({
      author: p.nick, id: p.id, title: p.title, time: /(\d\d:\d\d)/.exec(p.date)?.[1] ?? '', date: p.date, views: p.views, upvotes: p.votes,
      content: p.body, mine: p.mine, comments: p.comments.map((c) => ({ author: c.nick, content: c.body, parent: c.parent, mine: c.mine })),
    })),
  });
}

// ── 작업별 ──

export function refreshPrompt(src: RefSource, st: GState, plan: IncomingPlan, nick: string, factionNames: Record<string, string>): GnetPrompt {
  const s = gnetSettings(src.chat.scriptstate);
  const b = gnetBooks(src);
  const range = QUANTITY[s.quantity]?.range ?? '5-7';
  const guideline = [
    `${b.read('LB')}\n\n${b.read('BOARD.GUIDELINE')}`,
    b.read('AUTO.GUIDELINE').replace(/__GN_POST_RANGE__/g, range),
    `${b.read('ATTACHMENTS')}\n${incomingRules(b, plan)}`,
  ].join('\n\n');
  let format = b.read('AUTO.FORMAT');
  if (s.sampling) {
    format += '\nDiversity sampling is ON. Include alternativePosts alongside posts and incoming. posts and alternativePosts are two meaningfully different complete boards, each following the same post/comment schema and configured quantity. Sample each from low-probability possibilities below 0.10 and order them by probability descending. The application validates both and uses alternativePosts, the second candidate.';
  }
  const protectedIds: number[] = [];
  const reference = st.posts.filter((p, i) => {
    const prot = protectedPost(s, p);
    if (prot) protectedIds.push(p.id);
    return i < HISTORY.refresh || prot;
  });
  const extras = fill(b.read('EXTENSION.REQUEST'), {
    TIME: dateNow(src.chat), USER_NICK: nick, KEEP_OWN: String(s.keepOwn), KEEP_REPLIED: String(s.keepReplied), PROTECTED: protectedIds.join(','),
    POST_LIMIT: String(postLimit(s)), NEXT_ID: String(st.seq || 100000), ACTION: b.read('ACTION.REFRESH'), BOARD: boardJson(reference),
  }) + incomingTask(plan);
  return pack(src, b, guideline, format, extras, factionNames);
}

export interface PublicPrompt extends GnetPrompt {
  activity: { posts: ActivityPost[]; snapshots: Map<number, ActivitySnapshot> };
}

/** 새 글: 사용자가 적은 내용(아이디어 또는 본문)으로 제목·본문을 다듬고, 같은 응답에 댓글·선쪽지·다른 글 활동 */
export function postPrompt(src: RefSource, st: GState, input: string, plan: IncomingPlan, factionNames: Record<string, string>): PublicPrompt {
  const b = gnetBooks(src);
  const activity = activityContext(st, null);
  const guideline = [b.read('LB'), b.read('ATTACHMENTS'), b.read('TITLE.GUIDELINE'), b.read('REACT.GUIDELINE'), b.read('PUBLIC.GUIDELINE'), incomingRules(b, plan), activityRules(b, activity.posts)].join('\n\n');
  const extras = input + incomingTask(plan, activity.posts);
  return { ...pack(src, b, guideline, b.read('PUBLIC.POST_FORMAT'), extras, factionNames), activity };
}

export interface CommentPrompt extends PublicPrompt {
  supplied: Set<number>;
  total: number;
}

/** 내 댓글(이미 저장됨)에 대한 반응. replyTo: 방금 저장한 내 댓글 번호 (원본 react의 commentIndex) */
export function commentPrompt(
  src: RefSource, st: GState, postId: number, replyTo: number, body: string, plan: IncomingPlan, nick: string, factionNames: Record<string, string>,
): CommentPrompt {
  const b = gnetBooks(src);
  const p = findPost(st, postId);
  if (!p) throw new GnetError('대상 글이 없어졌어요.');
  // 원본과 같이: 글에 단 댓글은 "글" 범위(전체 댓글), 답글은 "댓글" 범위(최근 30개)
  const limit = replyTo > 0 ? HISTORY.comment : HISTORY.post;
  const total = p.comments.length;
  const selected = new Set<number>();
  for (let i = Math.max(1, total - limit + 1); i <= total; i++) selected.add(i);
  if (replyTo > 0) selected.add(replyTo);
  for (const i of [...selected]) {
    let n = i;
    const seen = new Set<number>();
    while (p.comments[n - 1] && !seen.has(n)) {
      seen.add(n);
      selected.add(n);
      n = p.comments[n - 1].parent;
    }
  }
  const comments = p.comments.map((c, i) => ({ index: i + 1, parent: c.parent, author: c.nick, content: c.body, mine: c.mine })).filter((c) => selected.has(c.index));
  const task = JSON.stringify({
    post: { id: p.id, author: p.nick, title: p.title, content: p.body }, comments, commentCount: total, replyTo,
    action: `The protagonist publicly commented: ${body}`, userHandle: nick,
  });
  const activity = activityContext(st, p.id);
  const guideline = [b.read('LB'), b.read('ATTACHMENTS'), b.read('REACT.GUIDELINE'), b.read('PUBLIC.GUIDELINE'), incomingRules(b, plan), activityRules(b, activity.posts)].join('\n\n');
  const extras = task + incomingTask(plan, activity.posts);
  return { ...pack(src, b, guideline, b.read('PUBLIC.REACT_FORMAT'), extras, factionNames), activity, supplied: selected, total };
}

/** 공개 글 참고 (원본 RC.gnetPublic): 쪽지에서 언급된 글을 앞에, 최대 8개 */
export function publicBoard(st: GState, query: string): { access: string; posts: unknown[] } | null {
  const ranked = st.posts.map((p, i) => ({ p, i, hit: (!!p.title && query.includes(p.title)) || new RegExp(`#${p.id}(?![\\d.])`).test(query) }));
  ranked.sort((a, b) => (a.hit !== b.hit ? (a.hit ? -1 : 1) : a.i - b.i));
  const rows: unknown[] = [];
  let used = 0;
  const cap = 6000;
  for (const { p } of ranked) {
    if (rows.length >= 8) break;
    const comments = p.comments.slice(-12).map((c, j, arr) => ({ id: p.comments.length - arr.length + j + 1, parent: c.parent, author: c.nick, content: trimTokens(c.body, LIMITS.quote_tokens) }));
    const row = { id: p.id, title: p.title, author: p.nick, date: p.date, content: trimTokens(p.body, LIMITS.origin_tokens), comments };
    while (JSON.stringify(row).length > (cap - used) * 2 && row.comments.length) row.comments.shift();
    const n = Math.ceil(JSON.stringify(row).length / 2);
    if (used + n <= cap) {
      rows.push(row);
      used += n;
    }
  }
  if (!rows.length) return null;
  return {
    access: 'Published GNet material available for reference when this conversation mentions, shares or consults a post. Discuss its supplied details naturally. Availability alone does not establish that everyone already read it, the real identity behind a handle, or truth of its claims. No private notes or unsent drafts are included.',
    posts: rows,
  };
}

export function dmPrompt(src: RefSource, st: GState, nick: string, latest: string, userHandle: string, factionNames: Record<string, string>): GnetPrompt {
  const b = gnetBooks(src);
  const source = st.sources[nick];
  let anchor = b.read('DM.NO-ORIGIN');
  if (source) {
    anchor = [
      `Original forum post #${source.postid} (preserved at first contact):`,
      `Title: ${source.title}`,
      `Posted by: ${source.author}`,
      `Post text: ${source.body}`,
      source.quote ? `Referenced public comment — author: ${source.quoteAuthor.trim() || '[not retained; do not attribute to the contact]'}\n${source.quote}` : '',
    ].join('\n');
  }
  const lines: unknown[] = [];
  for (let i = st.dms.length - 1; i >= 0 && lines.length < HISTORY.dmHistory; i--) {
    const d = st.dms[i];
    if (d.nick !== nick) continue;
    lines.unshift({
      speaker: d.side === 'me' ? 'user' : 'npc_correspondent', handle: d.side === 'me' ? userHandle : nick, date: d.date,
      content: d.side === 'me' ? d.body : trimTokens(d.body, LIMITS.history_tokens),
    });
  }
  let task = `Current story time: ${dateNow(src.chat)}\n${fill(b.read('DM.REQUEST'), { NICK: nick, ORIGIN: anchor, HISTORY: JSON.stringify(lines) })}`;
  const pub = publicBoard(st, `${latest}\n${anchor}`);
  if (pub) task += `\nPUBLIC BOARD REFERENCE:\n${JSON.stringify(pub)}`;
  const identity = { speaker: { role: 'npc_correspondent', handle: nick }, owner: { role: 'user', handle: userHandle, personaName: '주인공', referenceOnly: true } };
  return pack(src, b, `${b.read('DM.GUIDELINE')}\n\n${b.read('ATTACHMENTS')}`, b.read('DM.FORMAT'), task, factionNames, identity);
}

/** 쪽지 답장이 형식에 안 맞을 때 한 번 더 (원본 재시도 문구) */
export function retryMessages(prompt: GnetPrompt, raw: string, error: string): { role: 'system' | 'user' | 'assistant'; content: string }[] {
  return [
    ...prompt.messages,
    { role: 'assistant', content: raw },
    {
      role: 'user',
      content: `<system>\nValidation error!\nYour previous output did not adhere to the required format, or contained invalid data.\nError message: ${error}\nPlease fix your last output into correct structure as previously instructed, while keeping the data intact.\nOnly print the corrected data wrapped in the required node, without apologies, explanations, or any preambles.\n</system>`,
    },
  ];
}

/** 본편 요청에 붙이는 기록 앞의 안내문 */
export function mainContextRules(src: RefSource): string | null {
  const g = policySections(src.char.globalLore, 'GNet');
  return g.MAIN_CONTEXT?.trim() || null;
}

export type { GnetSettings };
