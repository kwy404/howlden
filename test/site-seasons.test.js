// The special dates in docs/seasons.js: Easter, every window boundary, the
// pt-BR variants and the overrides.
import { beforeAll, describe, expect, it } from 'vitest';

let S;
beforeAll(async () => {
  await import('../docs/seasons.js');
  S = globalThis.howldenSeasons;
});

const at = (y, m, d) => new Date(y, m - 1, d, 12);
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

describe('seasons', () => {
  it('computes Easter Sunday for 2024 to 2030', () => {
    const known = { 2024: '2024-03-31', 2025: '2025-04-20', 2026: '2026-04-05', 2027: '2027-03-28', 2028: '2028-04-16', 2029: '2029-04-01', 2030: '2030-04-21' };
    for (const [y, d] of Object.entries(known)) expect(iso(S.easter(Number(y)))).toBe(d);
  });

  it.each([
    // New Year: Dec 30 to Jan 2
    [2026, 12, 29, ''], [2026, 12, 30, 'newyear'], [2027, 1, 1, 'newyear'], [2027, 1, 2, 'newyear'], [2027, 1, 3, ''],
    // Carnival 2027: Ash Wednesday is Feb 10, so Saturday Feb 6 to Feb 10
    [2027, 2, 5, ''], [2027, 2, 6, 'carnival'], [2027, 2, 9, 'carnival'], [2027, 2, 10, 'carnival'], [2027, 2, 11, ''],
    // Carnival 2026: Ash Wednesday is Feb 18
    [2026, 2, 13, ''], [2026, 2, 14, 'carnival'], [2026, 2, 18, 'carnival'], [2026, 2, 19, ''],
    // Easter 2027: Good Friday Mar 26 to Sunday Mar 28
    [2027, 3, 25, ''], [2027, 3, 26, 'easter'], [2027, 3, 28, 'easter'], [2027, 3, 29, ''],
    // Valentine's
    [2027, 2, 13, ''], [2027, 2, 14, 'valentine'], [2027, 2, 15, ''],
    // Festa Junina or Midsummer: June 13 to 29, for everyone
    [2027, 6, 12, ''], [2027, 6, 13, 'junina'], [2027, 6, 29, 'junina'], [2027, 6, 30, ''],
    // Halloween: Oct 24 to 31
    [2026, 10, 23, ''], [2026, 10, 24, 'halloween'], [2026, 10, 31, 'halloween'], [2026, 11, 1, ''],
    // Christmas: Dec 18 to 26
    [2026, 12, 17, ''], [2026, 12, 18, 'christmas'], [2026, 12, 26, 'christmas'], [2026, 12, 27, ''],
  ])('%i-%i-%i is "%s" in English', (y, m, d, id) => {
    expect(S.detect(at(y, m, d), 'en-US')).toBe(id);
  });

  it('adds June 12 as Valentine\'s only for pt-BR visitors', () => {
    expect(S.detect(at(2027, 6, 12), 'pt-BR')).toBe('valentine');
    expect(S.detect(at(2027, 6, 12), 'pt-br')).toBe('valentine');
    expect(S.detect(at(2027, 6, 12), 'en-US')).toBe('');
    expect(S.detect(at(2027, 6, 12), 'pt-PT')).toBe('');
    expect(S.detect(at(2027, 6, 13), 'pt-BR')).toBe('junina');
  });

  it('names June Festa Junina in pt-BR and Midsummer elsewhere', () => {
    expect(S.label('junina', 'pt-BR')).toBe('Festa Junina');
    expect(S.label('junina', 'en-US')).toBe('Midsummer');
    expect(S.label('halloween', 'en')).toBe('Halloween');
    expect(S.label('nope', 'en')).toBe('');
  });

  it('works at midnight and late at night, on local dates', () => {
    expect(S.detect(new Date(2026, 9, 24, 0, 0, 0), 'en')).toBe('halloween');
    expect(S.detect(new Date(2026, 9, 31, 23, 59, 59), 'en')).toBe('halloween');
    expect(S.detect(new Date(2026, 10, 1, 0, 0, 0), 'en')).toBe('');
  });

  it('lets ?season= force or disable a season', () => {
    const plain = at(2026, 7, 1);
    expect(S.resolve({ date: plain, search: '' }).id).toBe('');
    expect(S.resolve({ date: plain, search: '?season=halloween' })).toEqual({ id: 'halloween', avail: 'halloween', forced: true });
    expect(S.resolve({ date: plain, search: '?x=1&season=christmas' }).id).toBe('christmas');
    expect(S.resolve({ date: at(2026, 10, 30), search: '?season=off' }).id).toBe('');
    expect(S.resolve({ date: at(2026, 10, 30), search: '?season=bogus' }).id).toBe('');
    expect(S.resolve({ date: at(2026, 10, 30), search: '' }).id).toBe('halloween');
  });

  it('remembers the off switch per season', () => {
    const mem = new Map();
    globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
    try {
      const day = at(2026, 10, 30);
      S.setOff('halloween', true);
      expect(S.isOff('halloween')).toBe(true);
      expect(S.resolve({ date: day, search: '' })).toEqual({ id: '', avail: 'halloween', forced: false });
      expect(S.resolve({ date: at(2026, 12, 20), search: '' }).id).toBe('christmas');
      expect(S.resolve({ date: day, search: '?season=halloween' }).id).toBe('halloween');
      S.setOff('halloween', false);
      expect(S.resolve({ date: day, search: '' }).id).toBe('halloween');
    } finally {
      delete globalThis.localStorage;
    }
  });

  it('stays a small script', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../docs/seasons.js', import.meta.url), 'utf8');
    expect(src).not.toMatch(/\bimport\b|\bexport\b|\brequire\(/);
    expect(src.replace(/^\s*\/\/.*$/gm, '').replace(/\s+/g, ' ').length).toBeLessThan(3800);
  });
});
