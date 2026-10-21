// 본부 모듈 바깥 입구. 엔진(engine/modules.ts)은 여기서만 가져간다.
export { createHq, type HqHost, type HqModule } from './view';
export { openRunMenu, useItem, addItem, addBag, newInventory, setItemIconDrawer, drawIcon, type RunInventory } from './runmenu';
export { setSupplyCatalog } from './logic';
export { setLineProvider, type LineProvider, type LineCtx, type Line } from './lines';
export { idbSaves, memorySaves, type SaveSlots, type SaveMeta } from './store';
export { HQ_SCHEMA, parseSave, newSave, type HqSave } from './state';
export type { MainLink, CardView, ReportPayload } from './link';
export * from './contract';
