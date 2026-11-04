// 소리 모듈 순수 로직 시험 (npm run build 뒤). 실제 소리 렌더는 tests/audio-browser.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNotes, parseDrums, compileSong, chord, noteToMidi } from '../dist-test/audio/music.js';
import { SONGS, SONG_IDS } from '../dist-test/audio/songs.js';
import { pickSfx, SFX, SCENE_SONG, cleanSettings } from '../dist-test/audio/index.js';

test('음 표기', () => {
  assert.equal(noteToMidi('c4'), 60);
  assert.equal(noteToMidi('a4'), 69);
  assert.equal(noteToMidi('eb3'), 51);
  assert.equal(noteToMidi('f#5'), 78);
  const { evs, steps } = parseNotes('c4*4 . e4+g4! - | a4?');
  assert.equal(steps, 8);
  assert.deepEqual(evs.map((e) => [e.step, e.len, e.notes.length, e.vel]), [[0, 4, 1, 0.8], [5, 2, 2, 1], [7, 1, 1, 0.5]]);
  assert.equal(parseDrums('k.s. h|h').steps, 6);
  assert.deepEqual(chord('Am').tones, [52, 57, 60]); // 미3~솔4 자리로 접는다
  assert.throws(() => noteToMidi('h4'));
});

test('모든 곡: 한 패턴 안의 악기 줄 길이가 같고 마디(12·14·16칸)로 떨어진다', () => {
  for (const id of SONG_IDS) {
    const def = SONGS[id];
    for (const [pn, pat] of Object.entries(def.pats)) {
      const lens = Object.entries(pat).map(([ch, src]) => [ch, def.chans[ch].inst === 'drums' ? parseDrums(src).steps : parseNotes(src).steps]);
      const set = new Set(lens.map((l) => l[1]));
      assert.equal(set.size, 1, `${id}/${pn}: ${JSON.stringify(lens)}`);
      const n = lens[0][1];
      assert.ok(n % 16 === 0 || n % 12 === 0 || n % 14 === 0, `${id}/${pn} 길이 ${n}`);
    }
    const c = compileSong(def);
    assert.ok(c.steps > 0);
  }
});

test('엔진 사건 이름이 모두 효과음으로 이어진다 (docs/게임_모듈_연결.md)', () => {
  const evs = ['hit', 'whiff', 'shot', 'empty', 'reload', 'guard', 'guardBreak', 'evade', 'jump', 'land', 'hurt', 'down', 'ability', 'super', 'heal', 'item', 'pickup', 'enemyDie', 'enemySpawn', 'enemyTell', 'bossTell', 'bossRoar', 'step', 'door', 'ding', 'ruleFound', 'uiMove', 'uiOk', 'uiBack', 'uiError'];
  for (const type of evs) {
    const id = pickSfx({ type }, 'lobby');
    assert.ok(id && SFX[id], type);
  }
  assert.equal(pickSfx({ type: 'hit', strength: 3 }, null), 'hit3');
  assert.equal(pickSfx({ type: 'step' }, 'service'), 'stepMetal');
  assert.equal(pickSfx({ type: 'step', surface: 'carpet' }, 'service'), 'stepCarpet');
  assert.equal(pickSfx({ type: 'nope' }, null), null);
  assert.equal(pickSfx({ type: 'hp:low' }, null), 'heartbeat');
  assert.equal(pickSfx({ type: 'custom', name: 'knock' }, null), 'knock');
  assert.equal(SCENE_SONG.silent, null);
});

test('설정 정리', () => {
  assert.deepEqual(cleanSettings({ master: 2, music: -1, sfx: 'x', muted: 1 }), { master: 1, music: 0, sfx: 0.9, amb: 0.7, ui: 0.6, muted: false });
});
