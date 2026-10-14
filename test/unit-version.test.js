import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { VERSION } from '../src/version.js';

describe('version', () => {
  it('matches package.json and the changelog', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    expect(VERSION).toBe(pkg.version);
    expect(readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8')).toContain(`## [${VERSION}]`);
  });
});
