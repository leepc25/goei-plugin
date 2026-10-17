import re
TOK=re.compile(r'\{\{|\}\}')
def parse(s):
    # returns list nodes: str | ('expr', inner_nodes)
    out=[];stack=[out];i=0
    for m in TOK.finditer(s):
        stack[-1].append(s[i:m.start()]); i=m.end()
        if m.group()=='{{': n=[];stack[-1].append(('e',n));stack.append(n)
        else:
            if len(stack)>1: stack.pop()
            else: stack[-1].append('}}')
    stack[-1].append(s[i:]); return out
def ev(nodes,vars):
    # handles #if blocks at sequence level
    res=[];i=0
    while i<len(nodes):
        n=nodes[i]
        if isinstance(n,str): res.append(n); i+=1; continue
        inner=ev(n[1],vars)
        if inner.startswith('#if ') or inner.startswith('#when '):
            cond=inner.split(' ',1)[1].strip()
            # find matching /if
            depth=1;j=i+1;body=[]
            while j<len(nodes):
                x=nodes[j]
                if not isinstance(x,str):
                    h=raw_head(x)
                    if h.startswith('#if') or h.startswith('#when'): depth+=1
                    elif h.startswith('/if') or h.startswith('/when') or h=='/': depth-=1
                    if depth==0: break
                body.append(x); j+=1
            if cond not in ('','0','false','null'): res.append(ev(body,vars))
            i=j+1; continue
        res.append(call(inner,vars)); i+=1
    return ''.join(res)
def raw_head(x):
    n=x[1]; return n[0] if n and isinstance(n[0],str) else ''
def call(inner,vars):
    p=inner.split('::')
    if p[0]=='getvar': return str(vars.get(p[1],'null'))
    if p[0]=='equal': return '1' if p[1]==p[2] else '0'
    if p[0]=='not_equal': return '1' if p[1]!=p[2] else '0'
    return '{{'+inner+'}}'
def render(s,vars): return ev(parse(s),vars)
