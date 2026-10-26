// 게임 다리: 살아 있는 인물 기록을 게임에 읽어 준다 (쓰기는 필드 장부 record 가 맡는다, host/game/field.ts).
import type { FactionView, GamePeople, PersonView } from '../../game/bridge';
import { factionNow, knownFactionCodes, userFactionOf } from '../../core/people/faction';
import { factionNamesOf } from '../people';
import { loadContext } from '../risu';
import { bookText } from '../../core/refs';
import { peopleStore, liveness, liveChanges, liveEntries } from '../../core/people/store';
import { peopleSettings } from '../../core/people/settings';
import { affinityView, addressOf } from '../../core/people/affinity';
import { personBlock, unknownTo } from '../../core/people/inject';
import { latestNote } from '../../core/people/updater';
import { temperOf } from '../../core/people/base';
import { onPeopleStatus } from '../people';

export function createPeople(): GamePeople {
  return {
    async people(names) {
      const c = await loadContext().catch(() => null);
      if (!c) return [];
      const settings = peopleSettings(c.chat.scriptstate);
      if (!settings.on) return [];
      const store = peopleStore(c.chat);
      const live = liveness(c.chat);
      const changes = liveChanges(store, live);
      const list = Object.values(store.people).filter((p) => !names || names.includes(p.name));
      return list.map((p): PersonView => {
        const aff = affinityView(p, changes, store.folded[p.name] ?? 0, { temper: temperOf(p.name), speed: settings.speed, turnCap: settings.turnCap });
        const texts = (k: 'state' | 'knowledge' | 'threads') => liveEntries(p.slots[k], live).map((e) => e.text);
        const note = settings.director === 'facts' ? latestNote(store, p.name, live) : null;
        return {
          name: p.name,
          faction: p.faction,
          aliases: p.aliases,
          affinity: { value: aff.value, stage: aff.stage.label, cell: aff.stage.cell },
          address: addressOf(p, changes),
          express: p.express,
          state: texts('state'),
          knowledge: texts('knowledge'),
          threads: texts('threads'),
          suspicion: liveEntries(p.slots.suspicion, live).map((e) => ({ target: e.target ?? '', kind: e.kind ?? '', text: e.text })),
          ...(note ? { note } : {}),
        };
      });
    },
    async sheet(name) {
      const c = await loadContext().catch(() => null);
      if (!c) return null;
      const settings = peopleSettings(c.chat.scriptstate);
      const store = peopleStore(c.chat);
      const p = store.people[name];
      const sheet = bookText({ char: c.char, chat: c.chat }, name) || null;
      if (!settings.on || !p) return sheet;
      const live = liveness(c.chat);
      const changes = liveChanges(store, live);
      return personBlock(p, store, live, changes, { sheet, mode: settings.inject === 'off' ? 'split' : settings.inject, unknown: settings.features.has('perception') ? unknownTo(p, store, live) : [], user: '방문자', note: settings.director === 'facts' ? latestNote(store, name, live) : null, temper: temperOf(name), speed: settings.speed, turnCap: settings.turnCap });
    },
    async factions() {
      const c = await loadContext().catch(() => null);
      if (!c) return [];
      const settings = peopleSettings(c.chat.scriptstate);
      if (!settings.on || !settings.features.has('faction_rep')) return [];
      const store = peopleStore(c.chat);
      const changes = liveChanges(store, liveness(c.chat));
      const names = factionNamesOf(c.char.globalLore);
      const uf = userFactionOf(store, c.chat);
      return knownFactionCodes(store, names).map((code): FactionView => {
        const f = factionNow(store, code, changes, uf, settings, names);
        return { code, name: f.name, value: f.value, stage: f.stage.id, stageLabel: f.stage.label, bounds: settings.factionBounds };
      });
    },
    onChange(cb) {
      let wasBusy = false;
      return onPeopleStatus((s) => {
        if (wasBusy && !s.busy) cb();
        wasBusy = s.busy;
      });
    },
  };
}
