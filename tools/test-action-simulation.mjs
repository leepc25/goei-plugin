// Isolated simulation checks without rebuilding unrelated bot release artifacts.
import { stripTypeScriptTypes } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
await mkdir('dist-test', { recursive: true });
for (const name of ['space', 'motion', 'sim']) {
  const source = await readFile(`src/game/action/${name}.ts`, 'utf8');
  const code = stripTypeScriptTypes(source).replace(/from '\.\/(space|motion)'/g, "from './action-$1.mjs'");
  await writeFile(`dist-test/action-${name}.mjs`, code);
}
const result = spawnSync(process.execPath, ['--test', 'tests/action.test.mjs'], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
