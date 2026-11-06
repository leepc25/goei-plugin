---
name: pixellab-concurrency
description: User rule 2026-11-01 — send PixelLab requests concurrently (up to 20 at once), never one by one
metadata:
  type: feedback
  modified: 2026-11-01T06:38:00.871Z
---
User (2026-11-01 06:37, 배경 thread): 「픽셀랩 차례로 보내지 말고 동시에 보내 20개까지 되잖아」.
**Why:** sequential/3-wide batches waste hours; PixelLab accepts ~20 concurrent jobs.
**How to apply:** batch generation scripts run ~10–20 in parallel (xargs -P / ThreadPoolExecutor). When several threads generate at once, keep the total under 20. Gate rule ([[goei-nude-hit-audit-1101]]) still applies to the count.
- 06:40 user: 「큐는 최대 20개까지 가능한데 왜 10개씩」 → always use the full 20 unless another thread is actively sending. Don't self-limit.
