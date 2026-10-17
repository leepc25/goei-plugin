// 로어북 문장에 들어 있는 Risu 템플릿(CBS) 중 이 카드가 쓰는 것만 해석한다.
// 원본은 Risu가 보낼 때 풀어 줬지만, 플러그인이 직접 모델을 부를 때는 우리가 풀어야 한다.
// 쓰는 것: getvar, #if, #when(::a::is::b, ::a::vis::b 등), :else, equal/not_equal/notequal, and/or/not,
// length, trim, user, char, char_desc, maxcontext, {{? 식}}. 모르는 태그는 그대로 둔다.

export interface CbsEnv {
  /** 채팅 변수 (키는 '$이름' 형식) */
  vars: Record<string, unknown>;
  user?: string;
  char?: string;
  charDesc?: string;
  maxContext?: number;
}

const truthy = (v: string) => v === '1' || v.toLowerCase() === 'true';

/** 중괄호 밖의 '::'로만 나눈다 */
function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '{' && s[i + 1] === '{') {
      depth++;
      cur += '{{';
      i++;
    } else if (s[i] === '}' && s[i + 1] === '}') {
      depth--;
      cur += '}}';
      i++;
    } else if (depth === 0 && s[i] === ':' && s[i + 1] === ':') {
      out.push(cur);
      cur = '';
      i++;
    } else cur += s[i];
  }
  out.push(cur);
  return out;
}

/** s[i]가 '{{'일 때 짝이 맞는 '}}' 바로 뒤 위치. 없으면 -1 */
function closeOf(s: string, i: number): number {
  let depth = 0;
  for (let j = i; j < s.length - 1; j++) {
    if (s[j] === '{' && s[j + 1] === '{') {
      depth++;
      j++;
    } else if (s[j] === '}' && s[j + 1] === '}') {
      depth--;
      j++;
      if (depth === 0) return j + 1;
    }
  }
  return -1;
}

function getvar(env: CbsEnv, name: string): string {
  const v = env.vars[`$${name.trim()}`] ?? env.vars[name.trim()];
  return v === undefined || v === null ? 'null' : String(v);
}

/** {{? 식}}: 비교·논리·사칙연산 정도 */
function calc(expr: string): string {
  const src = expr.trim();
  const tokens = src.match(/\d+(?:\.\d+)?|null|true|false|&&|\|\||==|!=|>=|<=|[-+*/%()<>!]|"[^"]*"|[^\s()<>=!&|+*/%-]+/g) ?? [];
  let pos = 0;
  type V = number | string | null | boolean;
  const peek = () => tokens[pos];
  const OPS = new Set(['&&', '||', '==', '!=', '>=', '<=', '+', '-', '*', '/', '%', '(', ')', '<', '>', '!']);
  const isWord = (t: string | undefined) => t !== undefined && !OPS.has(t);
  const num = (v: V) => (typeof v === 'number' ? v : typeof v === 'boolean' ? Number(v) : v === null ? 0 : Number(v));
  const atom = (): V => {
    const t = tokens[pos++];
    if (t === undefined) return null;
    if (t === '(') {
      const v = or();
      pos++;
      return v;
    }
    if (t === '!') return !truthyV(atom());
    if (t === '-') return -num(atom());
    if (t === 'null') return null;
    if (t === 'true') return true;
    if (t === 'false') return false;
    if (/^\d/.test(t) && !isWord(peek())) return Number(t);
    // 띄어쓰기가 있는 글(예: getvar로 풀린 "조용한 아저씨 말투")은 연산자가 나올 때까지 한 덩어리
    let word = t.replace(/^"|"$/g, '');
    while (isWord(peek())) word += ` ${tokens[pos++].replace(/^"|"$/g, '')}`;
    return word;
  };
  const truthyV = (v: V) => (typeof v === 'boolean' ? v : typeof v === 'number' ? v !== 0 : v !== null && v !== '' && v !== '0');
  const mul = (): V => {
    let v = atom();
    while (['*', '/', '%'].includes(peek())) {
      const op = tokens[pos++];
      const r = num(atom());
      v = op === '*' ? num(v) * r : op === '/' ? num(v) / r : num(v) % r;
    }
    return v;
  };
  const add = (): V => {
    let v = mul();
    while (['+', '-'].includes(peek())) {
      const op = tokens[pos++];
      const r = num(mul());
      v = op === '+' ? num(v) + r : num(v) - r;
    }
    return v;
  };
  const cmp = (): V => {
    let v = add();
    while (['>', '<', '>=', '<=', '==', '!='].includes(peek())) {
      const op = tokens[pos++];
      const r = add();
      const eq = (a: V, b: V) => (a === null || b === null ? a === b || (a === null && b === 'null') || (b === null && a === 'null') : String(a) === String(b));
      v = op === '==' ? eq(v, r) : op === '!=' ? !eq(v, r) : op === '>' ? num(v) > num(r) : op === '<' ? num(v) < num(r) : op === '>=' ? num(v) >= num(r) : num(v) <= num(r);
    }
    return v;
  };
  const and = (): V => {
    let v = cmp();
    while (peek() === '&&') {
      pos++;
      const r = cmp();
      v = truthyV(v) && truthyV(r);
    }
    return v;
  };
  const or = (): V => {
    let v = and();
    while (peek() === '||') {
      pos++;
      const r = and();
      v = truthyV(v) || truthyV(r);
    }
    return v;
  };
  try {
    const v = or();
    if (typeof v === 'boolean') return v ? '1' : '0';
    return v === null ? 'null' : String(v);
  } catch {
    return '0';
  }
}

function fn(inner: string, env: CbsEnv): string | null {
  if (inner.startsWith('?')) return calc(inner.slice(1));
  const parts = inner.split('::');
  const name = parts[0].trim().toLowerCase();
  const a = parts.slice(1);
  switch (name) {
    case 'getvar':
      return getvar(env, a[0] ?? '');
    case 'equal':
      return a[0] === a[1] ? '1' : '0';
    case 'not_equal':
    case 'notequal':
      return a[0] !== a[1] ? '1' : '0';
    case 'and':
      return a.every((x) => truthy(x.trim())) ? '1' : '0';
    case 'or':
      return a.some((x) => truthy(x.trim())) ? '1' : '0';
    case 'not':
      return truthy((a[0] ?? '').trim()) ? '0' : '1';
    case 'length':
      return String((a[0] ?? '').trim().length);
    case 'trim':
      return (a[0] ?? '').trim();
    case 'user':
      return env.user ?? '{{user}}';
    case 'char':
    case 'bot':
      return env.char ?? '{{char}}';
    case 'char_desc':
    case 'description':
      return env.charDesc ?? '';
    case 'maxcontext':
      return String(env.maxContext ?? 99999);
  }
  return null;
}

/** #when 조건: "::a::is::b", "::a::vis::b", "::조건", " 조건" */
function whenCond(head: string, env: CbsEnv): boolean {
  const rest = head.replace(/^#when/, '');
  if (!rest.startsWith('::')) return truthy(evaluate(rest, env).trim());
  const p = splitTop(rest.slice(2)).map((x) => evaluate(x, env));
  if (p.length === 1) return truthy(p[0].trim());
  if (p.length >= 3) {
    const [x, op, y] = [p[0], p[1].trim(), p[2]];
    switch (op) {
      case 'is': return x === y;
      case 'isnot': return x !== y;
      case 'vis': return getvar(env, x) === y;
      case 'visnot': return getvar(env, x) !== y;
      case 'and': return truthy(x) && truthy(y);
      case 'or': return truthy(x) || truthy(y);
      case '>': return Number(x) > Number(y);
      case '<': return Number(x) < Number(y);
      case '>=': return Number(x) >= Number(y);
      case '<=': return Number(x) <= Number(y);
    }
  }
  if (p.length === 2 && p[0].trim() === 'not') return !truthy(p[1].trim());
  return truthy(p[p.length - 1].trim());
}

/** 블록 {{#if …}} … {{/if}} 의 끝과 {{:else}} 위치 */
function blockEnd(s: string, from: number): { else: number; elseEnd: number; close: number; end: number } | null {
  let depth = 1;
  let elseAt = -1;
  let elseEnd = -1;
  let i = from;
  while (i < s.length) {
    const j = s.indexOf('{{', i);
    if (j < 0) return null;
    const k = closeOf(s, j);
    if (k < 0) return null;
    const inner = s.slice(j + 2, k - 2).trim();
    if (inner.startsWith('#if') || inner.startsWith('#when')) depth++;
    else if (inner === '/if' || inner === '/when' || inner === '/') {
      depth--;
      if (depth === 0) return { else: elseAt, elseEnd, close: j, end: k };
    } else if (depth === 1 && (inner === ':else' || inner === 'else')) {
      elseAt = j;
      elseEnd = k;
    }
    i = k;
  }
  return null;
}

export function evaluate(text: string, env: CbsEnv): string {
  if (!text.includes('{{')) return text;
  let out = '';
  let i = 0;
  while (i < text.length) {
    const j = text.indexOf('{{', i);
    if (j < 0) {
      out += text.slice(i);
      break;
    }
    out += text.slice(i, j);
    const k = closeOf(text, j);
    if (k < 0) {
      out += text.slice(j);
      break;
    }
    const raw = text.slice(j + 2, k - 2);
    const head = raw.trim();
    if (head.startsWith('#if') || head.startsWith('#when')) {
      const b = blockEnd(text, k);
      if (!b) {
        out += text.slice(j, k);
        i = k;
        continue;
      }
      const yes = head.startsWith('#if') ? truthy(evaluate(head.replace(/^#if(::)?/, ''), env).trim()) : whenCond(head, env);
      const body = yes ? text.slice(k, b.else >= 0 ? b.else : b.close) : b.else >= 0 ? text.slice(b.elseEnd, b.close) : '';
      out += evaluate(body, env);
      i = b.end;
      continue;
    }
    const inner = evaluate(raw, env);
    const v = fn(inner, env);
    out += v === null ? `{{${inner}}}` : v;
    i = k;
  }
  return out;
}
