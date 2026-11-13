// 괴담넷 요청문 만들기 (원본 RC.gnetPrompt + LB makeIntro/makeOutro).
// 지침 문장은 카드의 GNet 로어북 섹션(옛 카드는 LB Backend도)을 그대로 읽고, CBS는 직접 푼다.
// 결과는 언제나 두 메시지: system(틀 + 작업 지침 + 출력 형식) / user(참고 자료 + 최근 본문 + 현재 작업).
import { sitePicList } from './sitepics';
import { hasAttachment } from './attach';
import { viewSite, type BoardSite } from './boards';
import { fillVars, GUIDE_LABEL, type GuideName } from './guides';
import { evaluate } from './cbs';
import {
  activityContext, findPost, gnetSettings, gnetVars, keyFigures, HISTORY, incomingTask, LIMITS, protectedPost, countText, trimTokens, postLimit,
  type ActivityPost, type ActivitySnapshot, type GPost, type GState, type GnetSettings, type IncomingPlan, GnetError, dateNow, whenField } from './gnet';
import { applyAdvanced, genSettings } from './advanced';
import { fnHistory, fnNum, fnRefs } from './reffn';
import { craftMessages, craftSettings, memoTexts, retryAnalyze, type CraftMessage } from './craft';
import { trimRelated, trimSecondary, trimTurns } from './budget';
import { cbsEnv, collectRefs, factionCodesToNames, policySections, recentTurns, refText, storyText, type RefSource } from './refs';

export type GnetOp = 'refresh' | 'post' | 'comment' | 'dm';

const REQUIRED_GNET = [
  'LB', 'LB.EXTRA', 'EXTENSION.REQUEST', 'ACTION.REFRESH', 'AUTO.GUIDELINE', 'AUTO.FORMAT', 'REACT.GUIDELINE', 'DM.GUIDELINE', 'DM.FORMAT',
  'INCOMING.GUIDELINE', 'DM.REQUEST', 'DM.NO-ORIGIN', 'TITLE.GUIDELINE', 'MAIN_CONTEXT', 'PUBLIC.GUIDELINE', 'PUBLIC.REACT_FORMAT',
  'PUBLIC.POST_FORMAT', 'ACTIVITY.GUIDELINE', 'BOARD.GUIDELINE', 'ATTACHMENTS', 'INCOMING.COMBINED', 'INCOMING.DISABLED', 'ACTIVITY.DISABLED',
];
const REQUIRED_LB = ['SYSTEM', 'OUTPUT', 'JAILBREAK', 'JOB'];

/** 사이트마다 따로 쓰는 지침 (2026-11-08 사용자: 공용 없이 전부 따로) */
const SITE_GUIDE: Record<BoardSite, GuideName> = { gn: 'GNet', gal: 'Gal', wpf: 'Wpf', sm: 'Salmon' };
/** 사이트 자체의 세계 로어(조직 항목 이름). 있으면 요청마다 「주제 원본」으로 넣는다 — 관점이 그 사이트 사람들 것이 되게 (11-09 사용자: 정보가 아니라 관점) */
const SITE_LORE: Partial<Record<BoardSite, string[]>> = { wpf: ['세계정치 게시판'] };

export interface GnetBooks {
  read(name: string): string;
  /** 출력 언어 문장 (고급 설정 → 생성 언어) */
  language: string;
}

/** GNet 섹션을 읽는 함수. 섹션이 빠졌으면 바로 알린다. 생성 틀(SYSTEM 등)은 옛 카드면 LB Backend에 있다 */
export function gnetBooks(src: RefSource): GnetBooks {
  const name = SITE_GUIDE[viewSite(src.chat.scriptstate)];
  const g = { ...policySections(src.char.globalLore, 'LB Backend'), ...policySections(src.char.globalLore, name) };
  for (const k of [...REQUIRED_GNET, ...REQUIRED_LB]) if (g[k] === undefined) throw new GnetError(`${GUIDE_LABEL[name]} 지침의 ${k} 섹션이 없어요.`);
  applyAdvanced(src.chat.scriptstate);
  const env = { ...cbsEnv(src), vars: gnetVars(src.chat.scriptstate) };
  const cs = gnetSettings(src.chat.scriptstate).counts;
  return {
    language: genSettings(src.chat.scriptstate).language ?? (g.LANGUAGE?.trim() || LANGUAGE),
    read(name: string) {
      const raw = g[name] ?? '';
      return evaluate(raw, env)
        // 사진 목록 머리말도 이 사이트 지침의 절 (PICS_*. 전수검사 11-13)
        .replace(/__SITE_PICS__/g, () => sitePicList(src.char, (k) => g[k]))
        .replace(/__GN_POST_RANGE__/g, countText(cs.post))
        .replace(/__GN_CMT_RANGE__/g, countText(cs.cmt))
        .replace(/__GN_ACT_RANGE__/g, countText(cs.act))
        .replace(/__GN_REPLY_RANGE__/g, countText([Math.min(LIMITS.replies_min, LIMITS.replies), LIMITS.replies]))
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

/** 지침 절이 있으면 그 글, 없으면(옛 글로 고쳐 둔 지침) 코드에 남긴 글. 아래 영어 글들은 모두 게시판 지침의 절로도 있다 (설정 → 지침에서 고침) */
const orOld = (b: GnetBooks, name: string, old: string): string => b.read(name) || old;

export function systemText(b: GnetBooks, guideline: string, format: string, identity?: unknown, attachments = false): string {
  const intro = fmt(b.read('SYSTEM'), b.read('JAILBREAK'), b.read('JOB'), `\n\n${orOld(b, 'IMPORTANT_NOTE', IMPORTANT.slice(2))}`, 'anonymous forum author', '', '')
    .replace(/## Main Protagonist \([^\n]*\)/, '## User-controlled protagonist (narrator reference only)');
  let outro = fmt(b.read('OUTPUT'), '', format, guideline);
  if (identity) outro += `\nROLE BINDING (application-owned metadata):\n${JSON.stringify(identity)}`;
  outro += `\n${b.language}`;
  return `${intro}\n${outro}${attachments ? `\n\n${b.read('ATTACHMENTS.READ')}` : ''}`;
}

export interface GnetPrompt {
  messages: CraftMessage[];
  /** 형식이 틀렸을 때 다시 묻는 글 (지침 절 RETRY.FORMAT). 없으면 코드에 남긴 글 */
  retryRule?: string;
}

/** 생각 순서표 절 (작업마다) */
type ThoughtsKey = 'THOUGHTS.REFRESH' | 'THOUGHTS.ACTION' | 'THOUGHTS.DM';

/** fn = 기능(요청 종류): 넘길 내용·챗로그 턴 수를 기능 표·양 표의 그 줄에서 읽는다 (core/reffn.ts) */
function pack(src: RefSource, b: GnetBooks, fn: GnetOp, thoughts: ThoughtsKey, guideline: string, format: string, extras: string, factionNames: Record<string, string>, identity?: unknown): GnetPrompt {
  const n = trimTurns(fnNum(src.chat.scriptstate, 'gn', fn, 'turns'));
  const story = n ? storyText(recentTurns(src.chat, n, genSettings(src.chat.scriptstate).userMessages)) : '';
  const t = fnRefs(src.chat.scriptstate, 'gn', fn);
  const rows = collectRefs(src, {
    scope: 'gnet', text: `${extras}\n${story}`, primaryNames: SITE_LORE[viewSite(src.chat.scriptstate)], description: t.description, authors: t.authors, persona: t.persona, active: t.active,
    related: t.related && !trimRelated(), secondary: t.secondary && !trimSecondary(),
    extra: [{ source: '현재 발생 상황', content: b.read('LB.EXTRA') }],
  });
  const material = `[참고 자료 — 작중 인물에게 자동 공개되지 않음]\n${refText(rows)}\n[최근 본문]\n${story}\n[현재 작업]\n${extras}`;
  const attachments = hasAttachment(material);
  const messages: CraftMessage[] = [
    { role: 'system', content: factionCodesToNames(systemText(b, guideline, format, identity, attachments), factionNames) },
    { role: 'user', content: factionCodesToNames(material, factionNames) },
  ];
  return { messages: craftMessages(messages, craftSettings(src.chat.scriptstate, 'gn'), { thoughts: b.read(thoughts), memo: memoTexts((k) => b.read(k)) }), retryRule: b.read('RETRY.FORMAT') };
}

function incomingRules(b: GnetBooks, plan: IncomingPlan): string {
  return plan.allowed ? `${b.read('INCOMING.GUIDELINE')}\n${b.read('INCOMING.COMBINED')}` : b.read('INCOMING.DISABLED');
}

function activityRules(b: GnetBooks, posts: ActivityPost[]): string {
  return b.read(posts.length ? 'ACTIVITY.GUIDELINE' : 'ACTIVITY.DISABLED');
}

/**
 * 댓글 시각 (v0.16.32): 새 댓글마다 모델이 「HH:MM」을 쓴다. 앱이 글 시각·부모 댓글·지금 사이로 맞추므로(gnet.ts stampComments)
 * 형식만 알려 준다. 옛 카드 지침에는 time 칸이 없어서 코드에서 붙인다.
 */
/** 분류 (2026-11-08): 글마다 그 게시판식 말머리를 하나. 옛 지침에는 tag 칸이 없어서 코드에서 붙인다 */
export const TAG_RULE = 'Post category: every post (new or retained) also has "tag": one short category label in Korean, the way this board sorts its posts (a 말머리). Reuse labels already used on the board when they fit; supplied tags on retained posts are records, never change them.';

/** 다양성 뽑기 안내 (지침 절 SAMPLING) */
const SAMPLING_RULE = 'Diversity sampling is ON. Include alternativePosts alongside posts and incoming. posts and alternativePosts are two meaningfully different complete boards, each following the same post/comment schema and configured quantity. Sample both at random from the tails of the distribution so that each has a probability lower than 0.10; put those numbers in top-level postsProb and alternativeProb, and order the two boards by probability descending. The application validates both and uses alternativePosts, the second candidate.';

export function commentTimeRule(now: string, b?: GnetBooks): string {
  const t = b?.read('COMMENT.TIME_RULE');
  if (t) return fillVars(t, { now: now ? ` (${now})` : '' });
  return `Comment time: every NEW comment (including replies and activity comments) also has "time": "HH:MM", the 24-hour narrative time it was posted. `
    + `It must be after its post and after the comment it replies to, and not later than the current narrative time${now ? ` (${now})` : ''}. `
    + 'Space comments realistically: quick replies minutes apart, slower threads hours apart. Supplied "time" values on existing comments are records; never change them.';
}

/** 저장된 글을 출력 형식(AUTO.FORMAT)과 같은 모양으로 */
export function boardJson(posts: GPost[]): string {
  return JSON.stringify({
    posts: posts.map((p) => ({
      author: p.nick, id: p.id, ...(p.tag ? { tag: p.tag } : {}), title: p.title, time: /(\d\d:\d\d)/.exec(p.date)?.[1] ?? '', date: p.date, views: p.views, upvotes: p.votes,
      content: p.body, mine: p.mine, comments: p.comments.map((c) => ({ author: c.nick, ...whenField(p, c), content: c.body, parent: c.parent, mine: c.mine })),
    })),
  });
}

/** 주요 인물 닉네임 (write = 이번 응답에 갱신을 쓰게 함). 라이트보드 미니보드 (2026-11-06) */
function boardExtras(src: RefSource, b: GnetBooks, write: boolean): { guideline: string; format: string } {
  const s = gnetSettings(src.chat.scriptstate);
  const parts: string[] = [];
  let format = '';
  if (s.keyFigures) {
    const kept = keyFigures(src.chat.scriptstate);
    if (kept.length) parts.push(fill(b.read('KEYFIGURES.PREVIOUS'), { KEYFIGURES: JSON.stringify(kept) }));
    if (write) {
      parts.push(b.read('KEYFIGURES'));
      format = `\n${orOld(b, 'KEYFIGURES.FORMAT', 'Also include a top-level "keyFigures" array (use [] when there are no updates).')}`;
    }
  }
  return { guideline: parts.filter(Boolean).join('\n\n'), format };
}

const seed = () => Math.floor(Math.random() * 2147483647).toString(36);

// ── 작업별 ──

export function refreshPrompt(src: RefSource, st: GState, plan: IncomingPlan, nick: string, factionNames: Record<string, string>): GnetPrompt {
  const s = gnetSettings(src.chat.scriptstate);
  const b = gnetBooks(src);
  const guideline = [
    `${b.read('LB')}\n\n${b.read('BOARD.GUIDELINE')}`,
    b.read('AUTO.GUIDELINE'),
    `${b.read('ATTACHMENTS')}\n${incomingRules(b, plan)}`,
  ];
  const ex = boardExtras(src, b, true);
  if (ex.guideline) guideline.push(ex.guideline);
  let format = `${b.read('AUTO.FORMAT')}\n${commentTimeRule(dateNow(src.chat), b)}\n${orOld(b, 'POST.TAG_RULE', TAG_RULE)}${ex.format}`;
  if (s.sampling) {
    // 원본 미니보드 5.0.0: 두 벌 각각 확률을 적게 하고, 요청마다 무작위 씨앗 둘을 넣는다
    format += `\n${orOld(b, 'SAMPLING', SAMPLING_RULE)}`
      + `\n<x-output-seed-a>${seed()}</x-output-seed-a>\n<x-output-seed-b>${seed()}</x-output-seed-b>`;
  }
  const protectedIds: number[] = [];
  const reference = st.posts.filter((p, i) => {
    const prot = protectedPost(s, p);
    if (prot) protectedIds.push(p.id);
    return prot || i < HISTORY.refresh;
  });
  const action = b.read('ACTION.REFRESH');
  const extras = fill(b.read('EXTENSION.REQUEST'), {
    TIME: dateNow(src.chat), USER_NICK: nick, KEEP_OWN: String(s.keepOwn), KEEP_REPLIED: String(s.keepReplied), PROTECTED: protectedIds.join(','),
    POST_LIMIT: String(postLimit(s)), NEXT_ID: String(st.seq || 100000), ACTION: action, BOARD: boardJson(reference),
  }) + incomingTask(plan);
  return pack(src, b, 'refresh', 'THOUGHTS.REFRESH', guideline.join('\n\n'), format, extras, factionNames);
}

export interface PublicPrompt extends GnetPrompt {
  activity: { posts: ActivityPost[]; snapshots: Map<number, ActivitySnapshot> };
}

/** 새 글: 사용자가 적은 내용(아이디어 또는 본문)으로 제목·본문을 다듬고, 같은 응답에 댓글·선쪽지·다른 글 활동 */
export function postPrompt(src: RefSource, st: GState, input: string, plan: IncomingPlan, factionNames: Record<string, string>): PublicPrompt {
  const b = gnetBooks(src);
  const activity = activityContext(st, null, fnHistory(src.chat.scriptstate, 'gn', 'post'));
  const guideline = [b.read('LB'), b.read('ATTACHMENTS'), b.read('TITLE.GUIDELINE'), b.read('REACT.GUIDELINE'), b.read('PUBLIC.GUIDELINE'), incomingRules(b, plan), activityRules(b, activity.posts), boardExtras(src, b, false).guideline].filter(Boolean).join('\n\n');
  const extras = input + incomingTask(plan, activity.posts);
  return { ...pack(src, b, 'post', 'THOUGHTS.ACTION', guideline, `${b.read('PUBLIC.POST_FORMAT')}\n${commentTimeRule(dateNow(src.chat), b)}\n${orOld(b, 'POST.TAG_FORMAT', 'Also give post.tag: one short category label in Korean for this post, the way this board sorts its posts.')}`, extras, factionNames), activity };
}

export interface CommentPrompt extends PublicPrompt {
  supplied: Set<number>;
  total: number;
}

/** 내 댓글(이미 저장됨)에 대한 반응. replyTo: 방금 저장한 내 댓글 번호 (원본 react의 commentIndex) */
export function commentPrompt(
  src: RefSource, st: GState, postId: number, replyTo: number, body: string, plan: IncomingPlan, nick: string, factionNames: Record<string, string>,
  action0?: string,
  /** 글 하나만 새로고침은 「새로고침」 줄을 따른다 */
  fn: GnetOp = 'comment',
): CommentPrompt {
  const b = gnetBooks(src);
  // 글 하나만 새로고침(POST_REFRESH_ACTION)과 내 댓글 알림 문장은 지침 절 ACTION.POST_REFRESH · ACTION.COMMENT
  const action = action0 === undefined
    ? (b.read('ACTION.COMMENT') ? fillVars(b.read('ACTION.COMMENT'), { body }) : `The protagonist publicly commented: ${body}`)
    : action0 === POST_REFRESH_ACTION ? orOld(b, 'ACTION.POST_REFRESH', POST_REFRESH_ACTION) : action0;
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
  const comments = p.comments.map((c, i) => ({ index: i + 1, parent: c.parent, author: c.nick, ...whenField(p, c), content: c.body, mine: c.mine })).filter((c) => selected.has(c.index));
  const task = JSON.stringify({
    post: { id: p.id, author: p.nick, title: p.title, content: p.body }, comments, commentCount: total, replyTo,
    action, userHandle: nick,
  });
  const activity = activityContext(st, p.id);
  const guideline = [b.read('LB'), b.read('ATTACHMENTS'), b.read('REACT.GUIDELINE'), b.read('PUBLIC.GUIDELINE'), incomingRules(b, plan), activityRules(b, activity.posts), boardExtras(src, b, false).guideline].filter(Boolean).join('\n\n');
  const extras = task + incomingTask(plan, activity.posts);
  return { ...pack(src, b, fn, 'THOUGHTS.ACTION', guideline, `${b.read('PUBLIC.REACT_FORMAT')}\n${commentTimeRule(dateNow(src.chat), b)}`, extras, factionNames), activity, supplied: selected, total };
}

/** 글 하나만 새로고침: 시간이 흘러 다른 사람들이 이 글에 댓글을 더 단다 (주인공은 아무것도 하지 않음) */
export const POST_REFRESH_ACTION =
  'Time has passed since this post was last viewed. The protagonist did nothing on this post. Other readers return to it: add a few new comments or replies that continue the existing discussion naturally, each from someone other than the protagonist, without repeating earlier comments.';

/** 공개 글 참고의 안내 글 (지금 보는 게시판 지침의 PUBLIC.ACCESS 절). 없으면 빈 글 → publicBoard 가 코드에 남긴 글을 쓴다 */
export const publicAccess = (src: RefSource): string => policySections(src.char.globalLore, SITE_GUIDE[viewSite(src.chat.scriptstate)])['PUBLIC.ACCESS']?.trim() ?? '';

/** 공개 글 참고 (원본 RC.gnetPublic): 쪽지에서 언급된 글을 앞에, 최대 8개 */
export function publicBoard(st: GState, query: string, access?: string): { access: string; posts: unknown[] } | null {
  const ranked = st.posts.map((p, i) => ({ p, i, hit: (!!p.title && query.includes(p.title)) || new RegExp(`#${p.id}(?![\\d.])`).test(query) }));
  ranked.sort((a, b) => (a.hit !== b.hit ? (a.hit ? -1 : 1) : a.i - b.i));
  const rows: unknown[] = [];
  let used = 0;
  const cap = 6000;
  for (const { p } of ranked) {
    if (rows.length >= 8) break;
    const comments = p.comments.slice(-12).map((c, j, arr) => ({ id: p.comments.length - arr.length + j + 1, parent: c.parent, author: c.nick, ...whenField(p, c), content: trimTokens(c.body, LIMITS.quote_tokens) }));
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
    access: access?.trim() || 'Published GNet material available for reference when this conversation mentions, shares or consults a post. Discuss its supplied details naturally. Availability alone does not establish that everyone already read it, the real identity behind a handle, or truth of its claims. No private notes or unsent drafts are included.',
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
      // 작성자 모름 문장은 지침 절 DM.QUOTE_UNKNOWN (없으면 옛 글. 전수검사 11-13)
      source.quote ? `Referenced public comment — author: ${source.quoteAuthor.trim() || orOld(b, 'DM.QUOTE_UNKNOWN', '[not retained; do not attribute to the contact]')}\n${source.quote}` : '',
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
  const pub = publicBoard(st, `${latest}\n${anchor}`, b.read('PUBLIC.ACCESS'));
  if (pub) task += `\nPUBLIC BOARD REFERENCE:\n${JSON.stringify(pub)}`;
  const identity = { speaker: { role: 'npc_correspondent', handle: nick }, owner: { role: 'user', handle: userHandle, personaName: '주인공', referenceOnly: true } };
  const about = /^## About the board\n[^\n]+/m.exec(b.read('LB'))?.[0] ?? '';
  return pack(src, b, 'dm', 'THOUGHTS.DM', [about, b.read('DM.GUIDELINE'), b.read('ATTACHMENTS')].filter(Boolean).join('\n\n'), b.read('DM.FORMAT'), task, factionNames, identity);
}

/** 쪽지 답장이 형식에 안 맞을 때 한 번 더 (원본 재시도 문구) */
export function retryMessages(prompt: GnetPrompt, raw: string, error: string, rule: string | undefined = prompt.retryRule): CraftMessage[] {
  return [
    ...prompt.messages,
    { role: 'assistant', content: raw },
    {
      role: 'user',
      content: rule?.trim() ? fillVars(rule.trim(), { error, analyze: retryAnalyze() }) : `<system>\nValidation error!\nYour previous output did not adhere to the required format, or contained invalid data.\nError message: ${error}\nPlease fix your last output into correct structure as previously instructed, while keeping the data intact.\n${retryAnalyze()}\n</system>`,
    },
  ];
}

/** 본편 요청에 붙이는 기록 앞의 안내문 */
export function mainContextRules(src: RefSource): string | null {
  const g = policySections(src.char.globalLore, SITE_GUIDE[viewSite(src.chat.scriptstate)]);
  return g.MAIN_CONTEXT?.trim() || null;
}

export type { GnetSettings };
