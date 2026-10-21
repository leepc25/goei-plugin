// 모든 대본을 한 서고로 묶는다.
import { ScriptLibrary } from './script';
import hq from './scripts/hq';
import field from './scripts/field';
import { CUTSCENE_SCRIPTS } from './scripts/cutscenes';

export function buildLibrary(): ScriptLibrary {
  return new ScriptLibrary().add(hq, 'hq').add(field, 'field').add(CUTSCENE_SCRIPTS, 'cutscenes');
}
