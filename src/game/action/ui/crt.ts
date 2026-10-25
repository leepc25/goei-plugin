// CRT 모니터 효과 (설정 「CRT 필터」): 게임 캔버스를 매 장 WebGL로 다시 그린다 (사용자 2026-10-25: 선만 긋는 게 아니라 진짜 브라운관처럼).
// 곡면 유리(배럴 왜곡) · 둥근 모서리 · 가장자리 색 갈라짐 · 빛 번짐(블룸) · 밝기에 따라 굵어지는 주사선 · RGB 형광 마스크(애퍼처 그릴) ·
// 비네팅 · 아주 약한 깜빡임과 잡음. WebGL이 없으면 옛 CSS 줄무늬로 대신한다.
const VS = `attribute vec2 p; varying vec2 uv; void main(){ uv = p * 0.5 + 0.5; uv.y = 1.0 - uv.y; gl_Position = vec4(p, 0.0, 1.0); }`;
const FS = `precision mediump float;
varying vec2 uv;
uniform sampler2D tex; uniform sampler2D prev;
uniform vec2 res; uniform vec2 src; uniform float time; uniform float bend;
vec2 curve(vec2 u){ if (bend < 0.5) return u; u = u * 2.0 - 1.0; vec2 o = abs(u.yx) / vec2(5.2, 4.2); u = u + u * o * o; return u * 0.5 + 0.5; }
vec3 sampleRGB(vec2 u, float ca){
  vec2 d = (u - 0.5) * ca;
  return vec3(texture2D(tex, u + d).r, texture2D(tex, u).g, texture2D(tex, u - d).b);
}
void main(){
  vec2 u = curve(uv);
  if (u.x < 0.0 || u.x > 1.0 || u.y < 0.0 || u.y > 1.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  // 둥근 모서리 (곡면 모드만)
  vec2 q = abs(u - 0.5) * 2.0; float corner = bend < 0.5 ? 1.0 : smoothstep(1.0, 0.985, length(max(q - vec2(0.93, 0.9), 0.0) / vec2(0.07, 0.1)));
  float edge = dot(u - 0.5, u - 0.5);
  vec3 col = sampleRGB(u, 0.0012 + edge * 0.006);
  // 빛 번짐: 둘레 8곳을 흐리게 모아 밝은 곳만 더한다
  vec2 px = 1.0 / src; vec3 b = vec3(0.0);
  for (int i = 0; i < 8; i++) { float a = float(i) * 0.785398; b += texture2D(tex, u + vec2(cos(a), sin(a)) * px * 2.5).rgb; }
  b /= 8.0; col += max(b - 0.55, 0.0) * 0.9;
  // 주사선: 원본 한 줄마다, 밝을수록 굵게(어두운 틈이 좁아짐)
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  float line = 0.5 + 0.5 * cos(u.y * src.y * 3.14159265); // 원본 두 줄마다 한 번 (물결무늬 없게)
  float scan = mix(1.0, mix(0.62, 0.9, lum), line);
  col *= scan;
  // RGB 형광 마스크 (화면 픽셀 세 칸마다 빨강·초록·파랑 세로줄)
  float m = mod(gl_FragCoord.x, 3.0);
  vec3 mask = m < 1.0 ? vec3(1.0, 0.72, 0.72) : m < 2.0 ? vec3(0.72, 1.0, 0.72) : vec3(0.72, 0.72, 1.0);
  col *= mix(vec3(1.0), mask, 0.32);
  // 비네팅 · 깜빡임 · 잡음 · 밝기 보정
  col *= 1.0 - edge * (bend < 0.5 ? 0.35 : 0.95);
  col *= 1.0 + 0.012 * sin(time * 113.0) + 0.006 * sin(time * 7.0);
  col += (fract(sin(dot(gl_FragCoord.xy + time, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.025;
  col = pow(col * 1.22, vec3(0.95));
  gl_FragColor = vec4(col * corner, 1.0);
}`;

export interface Crt { setOn(on: boolean, curved?: boolean): void; dispose(): void }

export function mountCrt(stageEl: HTMLElement, canvas: HTMLCanvasElement): Crt | null {
  const out = document.createElement('canvas');
  out.className = 'gs-crtgl';
  out.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;display:none';
  const gl = out.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false });
  if (!gl) return null;
  const sh = (type: number, srcText: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, srcText); gl.compileShader(s); return s; };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const mkTex = (unit: number) => {
    const t = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    return t;
  };
  const tex = mkTex(0);
  mkTex(1);
  gl.uniform1i(gl.getUniformLocation(prog, 'tex'), 0);
  gl.uniform1i(gl.getUniformLocation(prog, 'prev'), 1);
  const uRes = gl.getUniformLocation(prog, 'res'), uSrc = gl.getUniformLocation(prog, 'src'), uTime = gl.getUniformLocation(prog, 'time'), uBend = gl.getUniformLocation(prog, 'bend');
  stageEl.insertBefore(out, canvas.nextSibling);
  let on = false, raf = 0, bend = 1;
  const frame = (t: number) => {
    raf = requestAnimationFrame(frame);
    // 화면에 보이는 크기의 실제 픽셀로 그린다 (마스크·주사선이 화면 픽셀에 맞게)
    const cw = canvas.clientWidth || canvas.width, ch = canvas.clientHeight || canvas.height;
    const scale = (stageEl.getBoundingClientRect().width / (stageEl.offsetWidth || 1)) * (window.devicePixelRatio || 1);
    const W = Math.max(1, Math.round(cw * scale)), H = Math.max(1, Math.round(ch * scale));
    if (out.width !== W || out.height !== H) { out.width = W; out.height = H; }
    out.style.width = `${cw}px`; out.style.height = `${ch}px`;
    gl.viewport(0, 0, W, H);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.uniform2f(uRes, W, H);
    gl.uniform2f(uSrc, canvas.width, canvas.height);
    gl.uniform1f(uTime, t / 1000);
    gl.uniform1f(uBend, bend);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
  return {
    setOn(v, curved = true) {
      bend = curved ? 1 : 0;
      if (v === on) return;
      on = v;
      out.style.display = v ? 'block' : 'none';
      if (v) raf = requestAnimationFrame(frame);
      else cancelAnimationFrame(raf);
    },
    dispose() { cancelAnimationFrame(raf); out.remove(); },
  };
}
