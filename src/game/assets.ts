// 게임 그림. 빌드 때 데이터 URL로 플러그인 안에 들어간다 (실행 중 네트워크 없음)
import atlasJson from './assets/atlas.json';
import aJyaldi from './assets/a-jyaldi.png';
import aGorgo from './assets/a-gorgo.png';
import aGeshu from './assets/a-geshu.png';
import aDeadfall from './assets/a-deadfall.png';
import aSpandal from './assets/a-spandal.png';
import aEileen from './assets/a-eileen.png';
import aCuras from './assets/a-curas.png';
import aRose from './assets/a-rose.png';
import eCorner from './assets/e-corner.png';
import eWatchman from './assets/e-watchman.png';
import eStatue from './assets/e-statue.png';
import eMaster from './assets/e-master.png';
import faces from './assets/faces.png';
import bgBeltSchool from './assets/bg-belt-school.png';
import bgClassroom from './assets/bg-room-classroom.png';
import bgLab from './assets/bg-room-lab.png';
import bgBroadcast from './assets/bg-room-broadcast.png';
import bgCourtyard from './assets/bg-room-courtyard.png';
import bgCamp from './assets/bg-belt-camp.png';
import type { AgentId, BackId, EnemyId } from './data';

/** 프레임: [x, y, w, h, 발 기준 x, 발 기준 y, 몸 높이] */
export type Frame = [number, number, number, number, number, number, number] | null;

export const ATLAS = atlasJson as unknown as Record<AgentId | EnemyId, Frame[]>;

export const SHEETS: Record<AgentId | EnemyId, string> = {
  jyaldi: aJyaldi, gorgo: aGorgo, geshu: aGeshu, deadfall: aDeadfall, spandal: aSpandal, eileen: aEileen, curas: aCuras, rose: aRose,
  corner: eCorner, watchman: eWatchman, statue: eStatue, master: eMaster,
};

export const FACES = faces;

export const BACKS: Partial<Record<BackId, string>> = {
  'belt-school': bgBeltSchool, 'room-classroom': bgClassroom, 'room-lab': bgLab, 'room-broadcast': bgBroadcast,
  'room-courtyard': bgCourtyard, 'belt-camp': bgCamp,
};
