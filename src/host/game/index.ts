// 플러그인 쪽 게임 다리: 저장 칸·자산 팩·본편 스냅숏·결과 받기·화면을 하나로 묶어 게임 코드에 넘긴다.
import { createUiPrefs } from './uiprefs';
import type { GameBridge, SlotId } from '../../game/bridge';
import { isWaiting, onWaiting } from '../waiting';
import { cardPhoto, readCard, takeReport } from './card';
import { gameAssets } from './packs';
import { gameSaves } from './saves';
import { gameTalk } from './talk';
import { createVisit } from './visit';
import { createField } from './field';
import { createPeople } from './people';
import type { ViewportCtl } from './viewport';

export function makeBridge(viewport: ViewportCtl, slot: SlotId, close: () => void, onHidden?: GameBridge['onHidden']): GameBridge {
  return {
    api: 1,
    uiPrefs: createUiPrefs(),
    visit: createVisit(),
    field: createField(),
    people: createPeople(),
    slot,
    saves: gameSaves,
    assets: gameAssets,
    card: readCard,
    photo: cardPhoto,
    talk: gameTalk,
    report: (r) => void takeReport(r).catch((e) => console.log(`[goei] 게임 결과를 받지 못했어요: ${String(e)}`)),
    viewport,
    waiting: isWaiting,
    onWaiting,
    narrow: () => matchMedia('(max-width: 760px)').matches,
    close,
    onHidden,
  };
}
