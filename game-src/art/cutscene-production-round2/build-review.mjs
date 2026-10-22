// Planning review only: intentionally has no image generation, frame synthesis or runtime imports.
import { readFile, writeFile } from 'node:fs/promises';
const here = new URL('./', import.meta.url);
const plan = JSON.parse(await readFile(new URL('plan.json', here), 'utf8'));
if (plan.status !== 'blocked-before-generation' || plan.generatedFrames.length) {
  throw new Error('This blocked-state review must not present generated art; prepare a real frame review after production.');
}
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let at = 0;
const rows = plan.design.ms.map((ms, i) => {
  const key = plan.design.keyframes.find(k => k.frame === i + 1);
  const row = `<tr><td>${i + 1}</td><td>${at}–${at + ms} ms</td><td>${key ? escape(key.role) : '중간 프레임 · 미생성'}</td></tr>`;
  at += ms;
  return row;
}).join('');
await writeFile(new URL('round2-review.html', here), `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>PixelLab round2 · 제작 전 검수</title>
<style>body{background:#151d28;color:#e0e6ed;font:16px/1.6 system-ui;margin:24px auto;max-width:960px;padding:0 16px}h1{font-size:24px}.viewport{width:640px;max-width:100%;aspect-ratio:16/9;border:1px dashed #7f8994;display:grid;place-content:center;text-align:center;box-sizing:border-box}button{padding:10px;margin:16px 0}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #425064;text-align:left;padding:8px}.palette{display:flex;flex-wrap:wrap;gap:12px}.swatch{border-top:18px solid var(--color)}</style>
<h1>첫 출근 · 빈 본부 복도와 문</h1><p id="status"><strong>제작 중단 · 신규 프레임 0장 · 차감 0회</strong></p>
<p>실제 계정 조회가 인증 누락 401로 차단되어 생성하지 않았습니다. 지원 크기에 맞춘 부분 애니메이션 제작 설계는 준비됐습니다. 이 페이지는 설계 검수용이며 컷씬 시연판이 아닙니다.</p>
<div class="viewport" aria-label="640×360 제작 예정 화면">640×360<br>신규 이미지 없음<br>이전 컷씬·대체 그림 미삽입</div>
<button type="button" disabled>재생 불가 · 생성된 프레임 없음</button>
<p>계획: 입력 첫 장 + 신규 동작 16장 = 총 17장 / 2,400ms. 첫 장 400ms, 중간 15장 각각 100ms, 끝 장 500ms. 정지는 의도한 홀드이며 부드러움의 근거가 아닙니다. 실제 재생·일관성은 미검증입니다.</p>
<div class="palette">${plan.palette.map(c => `<span class="swatch" style="--color:${escape(c)}">${escape(c)}</span>`).join('')}</div>
<p>320×180 원본을 정수 2배로 표시합니다. 문 영역 96×144 동작 생성은 미실행이며 배경 포함 2호출, 예상 5회 차감입니다. 계정 견적과 생성 예약 확인은 대기입니다.</p>
<table><thead><tr><th>계획 프레임</th><th>계획 시간</th><th>동작</th></tr></thead><tbody>${rows}</tbody></table></html>`);
console.log(new URL('round2-review.html', here).pathname);
