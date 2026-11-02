// 머리 위 상태 이상 이름 (작은 글자). 인물 AI(fighter/ai.ts)·엔진 적(enemy/enemy.ts)이 몸 자리 기준으로 부른다
export function drawAilments(ctx: CanvasRenderingContext2D, names: string[], y: number): void {
  if (!names.length) return;
  ctx.save();
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0,0,0,.8)';
  ctx.fillStyle = '#ffb4e6';
  const t = names.join(' · ');
  ctx.strokeText(t, 0, y);
  ctx.fillText(t, 0, y);
  ctx.restore();
}
