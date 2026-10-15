import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DICTS, translator } from '../docs/app/js/i18n.js';
import { MAX_MEMBERS } from '../src/mesh.js';
import { REACTIONS, STICKERS } from '../src/history.js';
import { COMMANDS } from '../src/commands.js';
import { SOUND_NAMES } from '../docs/app/js/sounds.js';

const dir = new URL('../docs/app/js/', import.meta.url);
const sources = readdirSync(dir).map((f) => readFileSync(new URL(f, dir), 'utf8'));

describe('interface text', () => {
  it('has every key used in the code, in both languages', () => {
    const used = new Set();
    for (const src of sources) {
      for (const m of src.matchAll(/'((?:app|onboard|home|rail|den|channel|chat|members|voice|user|invite|join|fail|notice|scan|pass|create|common|settings|account|call|crop|id|login|pin|profile|reply|pair|words|sound|poll|thread|pins|search|gallery|saved|remind|forward|format|cmd|season)\.[A-Za-z0-9.-]+)'/g)) used.add(m[1]);
    }
    for (const n of ['logo', 'moon', 'sun', 'bell', 'globe', 'file']) used.add(`login.pick.${n}`);
    for (const k of ['offline', 'blocked', 'no-stun', 'strict-nat', 'timeout', 'answered', 'expired', 'den', 'self', 'already', 'full', 'closed', 'damaged', 'version', 'kind']) used.add(`fail.${k}`);
    for (const k of SOUND_NAMES) used.add(`sound.${k}`);
    for (const k of STICKERS) used.add(`chat.sticker.${k}`);
    for (const k of REACTIONS) used.add(`chat.reaction.${k}`);
    for (const c of COMMANDS) used.add(`cmd.about.${c.name}`);
    for (const k of ['meUsage', 'rollUsage', 'pollUsage', 'nickUsage', 'unknown']) used.add(`cmd.${k}`);
    for (const k of ['bold', 'italic', 'strike', 'spoiler', 'code', 'codeblock', 'quote']) used.add(`format.${k}`);
    for (const k of ['off', 'standard', 'strong']) used.add(`voice.noise.${k}`).add(`voice.noise.${k}Hint`);
    for (const k of ['empty', 'format', 'auth']) used.add(`settings.turnErr.${k}`);
    for (const k of ['format', 'password', 'other']) used.add(`account.err.${k}`);
    for (const k of ['mic-denied', 'mic-missing', 'mic-failed', 'camera-denied', 'camera-failed', 'screen-unsupported', 'screen-failed', 'autoplay', 'record-failed']) used.add(`notice.${k}`);
    expect(used.size).toBeGreaterThan(300);
    const missing = [...used].filter((k) => !(k in DICTS.en) || !(k in DICTS.pt));
    expect(missing).toEqual([]);
  });

  it('keeps both languages in step and fills placeholders', () => {
    expect(Object.keys(DICTS.pt).sort()).toEqual(Object.keys(DICTS.en).sort());
    for (const [key, text] of Object.entries(DICTS.en)) {
      const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      expect(vars(DICTS.pt[key]), key).toEqual(vars(text));
    }
    const t = translator('pt');
    expect(t('chat.typing2', { a: 'Ana', b: 'Bia' })).toBe('Ana e Bia estão digitando');
    expect(translator('xx')('common.ok')).toBe('OK');
    expect(t('no.such.key')).toBe('no.such.key');
  });

  it('describes security honestly', () => {
    const all = JSON.stringify(DICTS).toLowerCase();
    expect(all).not.toMatch(/impossible to hack|unhackable|100% secure|military grade/);
    expect(DICTS.en['settings.security3']).toMatch(/cannot read/);
    expect(DICTS.en['login.checkHint']).toMatch(/not a security feature/);
  });

  it('states the den limit from the single constant, everywhere', () => {
    expect(MAX_MEMBERS).toBe(5);
    expect(translator('en')('home.lead', { max: MAX_MEMBERS })).toContain('up to 5 people');
    expect(translator('pt')('notice.full', { count: 5, max: 5 })).toBe('Esta toca está cheia (5 de 5).');
    expect(translator('en')('fail.full', { count: 5, max: 5 })).toBe('This den is full (5 of 5).');
    const old = /\b(up to|até) (8|eight|oito)\b|\b(8|eight) (people|peers|members|wolves)\b|\b8 pessoas\b|\b\d\/8\b|\bof (8|eight)\b|caps at 8/i;
    expect(JSON.stringify(DICTS)).not.toMatch(old);
    const site = ['README.md', 'i18n/README.pt-BR.md', ...readdirSync(new URL('../docs/', import.meta.url)).filter((f) => f.endsWith('.html')).map((f) => `docs/${f}`)];
    for (const f of site) expect(readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'), f).not.toMatch(old);
  });
});
