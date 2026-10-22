// Optional plugin pack; standalone builds already embed these same original PNGs.
import type { BgPack } from './bg';
const assets: [string, string, string][] = [["hq_office", "hq_office_wall_1", "hq_office__hq_office_wall_1.png"], ["hq_office", "hq_office_wall_2", "hq_office__hq_office_wall_2.png"], ["hq_office", "hq_office_wall_4", "hq_office__hq_office_wall_4.png"], ["hq_office", "hq_office_wall_6", "hq_office__hq_office_wall_6.png"], ["hq_office", "hq_office_floor", "hq_office__hq_office_floor.png"], ["hq_office", "objects/hq_office_objects_1", "hq_office__objects_hq_office_objects_1.png"], ["hq_office", "objects/hq_office_objects_3", "hq_office__objects_hq_office_objects_3.png"], ["hq_office", "objects/hq_office_objects_4", "hq_office__objects_hq_office_objects_4.png"], ["hq_corridor", "hq_corridor_wall_2", "hq_corridor__hq_corridor_wall_2.png"], ["hq_corridor", "hq_corridor_floor", "hq_corridor__hq_corridor_floor.png"], ["hq_jaemtri", "objects/hq_jaemtri_objects_1", "hq_jaemtri__objects_hq_jaemtri_objects_1.png"], ["hq_chief", "objects/hq_chief_objects_1", "hq_chief__objects_hq_chief_objects_1.png"]];
export function prepareHqTextures(urlOf?: (file: string) => Promise<string>): () => void {
  let alive = true;
  const inserted: [string, string, string][] = [];
  if (urlOf) void Promise.all(assets.map(async ([place, name, file]) => {
    if (window.__GOEI_BG_ART__?.[place]?.[name]) return;
    try {
      const src = await urlOf(file);
      const im = new Image(); im.src = src; await im.decode();
      if (!alive) return;
      const pack: BgPack = window.__GOEI_BG_ART__ ??= {};
      const group = pack[place] ??= {};
      if (!group[name]) { group[name] = src; inserted.push([place, name, src]); }
    } catch { /* Optional art retains the procedural fallback. */ }
  }));
  return () => {
    alive = false;
    for (const [place, name, src] of inserted) {
      if (window.__GOEI_BG_ART__?.[place]?.[name] === src) delete window.__GOEI_BG_ART__[place][name];
    }
  };
}
