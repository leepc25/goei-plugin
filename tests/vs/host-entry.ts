// 대전 플러그인 쪽 시험 (tests/vs/host.html): host/vs.ts 를 가짜 risuai 로 돌린다. 바깥 문서 = 가짜 Risu, 이 문서 = 플러그인 칸(iframe)
import { closeVersus, downloadVsCommon, toggleVersus, vsDataState, vsOpen } from '../../src/host/vs';
const w = window as unknown as Record<string, unknown>;
w.__vs = { closeVersus, downloadVsCommon, toggleVersus, vsDataState, vsOpen };
