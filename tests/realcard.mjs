// 단위 시험이 쓰는 「실제 카드」 module.json 자리. 차례로 찾는다:
//   1) 환경 변수 GOEI_REAL_MODULE  2) dist-test/real-module.json (npm run build → tests/extract_module.py 가 card/원본_봇카드.jpeg 에서 품)
//   3) 옛 자리 /mnt/project-files/analysis/extracted/module.json
// 하나도 없으면 그 시험들은 건너뛴다 (existsSync(REAL) 가 false).
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const candidates = [
  process.env.GOEI_REAL_MODULE,
  fileURLToPath(new URL('../dist-test/real-module.json', import.meta.url)),
  '/mnt/project-files/analysis/extracted/module.json',
].filter(Boolean);

export const REAL = candidates.find((p) => existsSync(p)) ?? candidates[candidates.length - 1];
