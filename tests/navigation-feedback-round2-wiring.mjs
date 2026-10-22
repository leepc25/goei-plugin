// 공용 파일을 쓰지 않고 전달 패치를 esbuild/TypeScript의 읽기 단계에만 적용한다.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
export const patches = new Map();
const diff = readFileSync('docs/patches/navigation-feedback-round2.patch', 'utf8');
for (const block of diff.split(/(?=^--- a\/)/m).filter(Boolean)) {
  const path = block.match(/^--- a\/(.+)$/m)[1];
  let source = readFileSync(path, 'utf8');
  for (const hunk of block.split(/^@@[^\n]+\n/m).slice(1)) {
    const lines = hunk.split('\n').filter(l => /^[ +\-]/.test(l));
    const before = lines.filter(l => !l.startsWith('+')).map(l => l.slice(1)).join('\n') + '\n';
    const after = lines.filter(l => !l.startsWith('-')).map(l => l.slice(1)).join('\n') + '\n';
    if (!source.includes(before)) throw new Error(`패치 문맥 불일치: ${path}`);
    source = source.replace(before, after);
  }
  patches.set(resolve(path), source);
}
export const wiringPlugin = { name: 'navigation-feedback-round2-wiring', setup(build) {
  build.onLoad({ filter: /[\\/]engine[\\/](modules|render|hub)\.ts$/ }, args => {
    const contents = patches.get(args.path);
    return contents === undefined ? undefined : { contents, loader: 'ts', resolveDir: resolve(args.path, '..') };
  });
}};
if (process.argv.includes('--typecheck')) {
  const ts = (await import('typescript')).default;
  const config = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
  const host = ts.createCompilerHost(parsed.options), original = host.readFile;
  host.readFile = path => patches.get(resolve(path)) ?? original(path);
  const program = ts.createProgram(parsed.fileNames, parsed.options, host);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length) { console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCanonicalFileName: f => f, getCurrentDirectory: () => process.cwd(), getNewLine: () => '\n' })); process.exitCode = 1; }
  else console.log('PASS navigation-feedback-round2: 공용 연결 패치 포함 타입 검사');
}
