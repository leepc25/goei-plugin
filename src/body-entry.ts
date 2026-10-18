// 본체 묶음의 입구: 시작기(src/loader/body.ts runBody)가 실행한 뒤 globalThis.__goeiBody를 집어 간다
import { start } from './body';

declare const __PLUGIN_VERSION__: string;
(globalThis as unknown as { __goeiBody: unknown }).__goeiBody = { version: __PLUGIN_VERSION__, start };
