import { describe, expect, it } from 'vitest';
import {
  HistorySync,
  MemoryStore,
  SEASONAL,
  STICKERS,
  allowedChange,
  batchBySize,
  cleanRecord,
  createRecord,
  deleteRecord,
  diffManifest,
  editRecord,
  isPinned,
  manifest,
  mergeRecord,
  pollResults,
  reactors,
  sameRecord,
  setPinned,
  sortRecords,
  toggleReaction,
  version,
  votePoll,
} from '../src/history.js';
import { Mesh } from '../src/mesh.js';
import { FakeHub, settle } from './fake-transport.js';

const ANA = 'aaaa0001';
const BIA = 'bbbb0002';
const CAU = 'cccc0003';
const msg = (id, ts, author = ANA, text = `text ${id}`) => createRecord({ id, channel: 'general', author, ts, text });

describe('records', () => {
  it('edits, deletes and reacts', () => {
    const m = msg('0001', 100);
    const edited = editRecord(m, 'fixed', 50);
    expect(edited.text).toBe('fixed');
    expect(edited.editedAt).toBe(101);
    const liked = toggleReaction(edited, 'like', BIA, 200);
    expect(reactors(liked, 'like')).toEqual([BIA]);
    const unliked = toggleReaction(liked, 'like', BIA, 150);
    expect(reactors(unliked, 'like')).toEqual([]);
    expect(unliked.reactions.like[BIA][0]).toBe(201);
    expect(toggleReaction(m, 'nope', BIA, 1)).toBe(m);
    const gone = deleteRecord(liked, 300);
    expect(gone).toMatchObject({ deleted: true, text: '', files: [], reactions: {}, deletedAt: 300 });
    expect(editRecord(gone, 'back', 400)).toBe(gone);
    expect(version(liked)).toBe(200);
  });

  it('cleans hostile or broken records', () => {
    expect(cleanRecord(null)).toBe(null);
    expect(cleanRecord({ id: 'xyz', author: ANA, channel: 'g', ts: 1 })).toBe(null);
    expect(cleanRecord({ id: '0001', author: ANA, channel: 'g', ts: 'soon' })).toBe(null);
    const rec = cleanRecord({
      id: '0001',
      author: ANA,
      channel: 'general',
      ts: 5,
      text: 'x'.repeat(5000),
      evil: '<script>',
      files: [{ id: 'f001', name: 'a.png', size: 10, type: 'image/png', thumb: 'javascript:alert(1)' }, { id: 'bad id' }],
      reactions: { like: { [BIA]: [3, 1], 'not-hex': [1, 1] }, unknown: { [BIA]: [1, 1] } },
    });
    expect(rec.text.length).toBe(4000);
    expect(rec.evil).toBeUndefined();
    expect(rec.files).toHaveLength(1);
    expect(rec.files[0].thumb).toBeUndefined();
    expect(rec.reactions).toEqual({ like: { [BIA]: [3, 1] } });
    expect(cleanRecord({ ...msg('0002', 1), deleted: true }).text).toBe('');
  });

  it('allows only authors to change text or delete', () => {
    const m = msg('0001', 100);
    expect(allowedChange(m, editRecord(m, 'mine', 200), ANA)).toBe(true);
    expect(allowedChange(m, editRecord(m, 'yours', 200), BIA)).toBe(false);
    expect(allowedChange(m, deleteRecord(m, 200), BIA)).toBe(false);
    expect(allowedChange(m, toggleReaction(m, 'love', BIA, 200), BIA)).toBe(true);
    expect(allowedChange(m, { ...m, author: BIA }, BIA)).toBe(false);
    expect(allowedChange(null, m, CAU)).toBe(true);
  });
});

describe('stickers', () => {
  const sticker = (id, key = 'wave') => createRecord({ id, channel: 'general', author: ANA, ts: 500, text: 'ignored', sticker: key });

  it('carry a known key and no text, and cannot be edited', () => {
    const rec = sticker('0101');
    expect(rec).toMatchObject({ sticker: 'wave', text: '', files: [] });
    expect(STICKERS).toContain('howl');
    expect(() => sticker('0102', 'nope')).toThrow(/unknown sticker/);
    expect(editRecord(rec, 'text', 600)).toBe(rec);
    expect(reactors(toggleReaction(rec, 'love', BIA, 600), 'love')).toEqual([BIA]);
  });

  it('survive cleaning, merging and relaying, and vanish with a delete', () => {
    const rec = sticker('0103', 'party');
    expect(cleanRecord(JSON.parse(JSON.stringify(rec))).sticker).toBe('party');
    expect(cleanRecord({ ...rec, sticker: '<script>' }).sticker).toBeUndefined();
    expect(cleanRecord(msg('0104', 1)).sticker).toBeUndefined();
    const stripped = { ...rec };
    delete stripped.sticker;
    expect(mergeRecord(rec, stripped).sticker).toBe('party');
    expect(mergeRecord(stripped, rec).sticker).toBe('party');
    expect(sameRecord(mergeRecord(rec, stripped), mergeRecord(stripped, rec))).toBe(true);
    expect(allowedChange(rec, stripped, BIA)).toBe(false);
    expect(allowedChange(msg('0105', 500), { ...msg('0105', 500), sticker: 'wave' }, BIA)).toBe(false);
    expect(allowedChange(rec, toggleReaction(rec, 'like', BIA, 700), BIA)).toBe(true);
    const gone = deleteRecord(rec, 800);
    expect(gone.deleted).toBe(true);
    expect('sticker' in gone).toBe(false);
    expect('sticker' in mergeRecord(rec, gone)).toBe(false);
  });
});

describe('merge', () => {
  const base = msg('0001', 100);
  const variants = [
    base,
    editRecord(base, 'edit one', 200),
    editRecord(base, 'edit two', 300),
    toggleReaction(base, 'like', BIA, 250),
    toggleReaction(toggleReaction(base, 'like', BIA, 250), 'like', BIA, 260),
    toggleReaction(base, 'fire', CAU, 270),
    deleteRecord(base, 400),
  ];

  it('is commutative, associative and idempotent', () => {
    for (const a of variants) {
      expect(sameRecord(mergeRecord(a, a), a)).toBe(true);
      for (const b of variants) {
        expect(sameRecord(mergeRecord(a, b), mergeRecord(b, a))).toBe(true);
        for (const c of variants) {
          expect(sameRecord(mergeRecord(mergeRecord(a, b), c), mergeRecord(a, mergeRecord(b, c)))).toBe(true);
        }
      }
    }
  });

  it('keeps the latest edit and per member reaction state', () => {
    const merged = [variants[1], variants[2], variants[4], variants[5]].reduce(mergeRecord);
    expect(merged.text).toBe('edit two');
    expect(reactors(merged, 'like')).toEqual([]);
    expect(reactors(merged, 'fire')).toEqual([CAU]);
  });

  it('lets a delete win over everything', () => {
    const merged = variants.reduce(mergeRecord);
    expect(merged.deleted).toBe(true);
    expect(merged.text).toBe('');
  });

  it('rejects merging different ids and handles missing sides', () => {
    expect(() => mergeRecord(msg('0001', 1), msg('0002', 1))).toThrow();
    expect(mergeRecord(null, base)).toBe(base);
    expect(mergeRecord(base, undefined)).toBe(base);
  });
});

describe('manifest diff', () => {
  it('finds what each side lacks', () => {
    const a = msg('0001', 1);
    const b = msg('0002', 2);
    const c = msg('0003', 3);
    const local = new Map([[a.id, a], [b.id, editRecord(b, 'new', 10)]]);
    const remote = manifest([b, c, editRecord(a, 'newer', 20)]);
    const diff = diffManifest(local, remote);
    expect(diff.send).toEqual(['0002']);
    expect(diff.want.sort()).toEqual(['0001', '0003']);
    expect(diffManifest(new Map(), [])).toEqual({ send: [], want: [] });
  });

  it('batches by size and sorts by time then id', () => {
    const items = Array.from({ length: 30 }, (_, i) => ({ blob: 'x'.repeat(1000), i }));
    const batches = batchBySize(items, 5000);
    expect(batches.flat()).toHaveLength(30);
    for (const b of batches) expect(JSON.stringify(b).length).toBeLessThanOrEqual(5000);
    expect(batchBySize([])).toEqual([]);
    expect(sortRecords([msg('000b', 2), msg('000a', 2), msg('0001', 1)]).map((r) => r.id)).toEqual(['0001', '000a', '000b']);
  });
});

describe('HistorySync over the mesh', () => {
  async function den() {
    const hub = new FakeHub();
    const make = (id, host) => new Mesh({ self: { id, name: id }, den: { id: 'd0d0', name: 'd' }, transport: hub.transport(id), host });
    const a = make(ANA, true);
    const b = make(BIA);
    const { inviteId, sdp } = await a.createInvite();
    const reply = await b.acceptInvite({ inviteId, den: a.den, host: a.self, sdp });
    await a.acceptReply(reply);
    await settle();
    return { a, b };
  }

  function attach(mesh, store) {
    const changes = [];
    const sync = new HistorySync({
      store,
      send: (peer, body) => mesh.sendTo(peer, body),
      onChange: (recs) => changes.push(...recs.map((r) => r.id)),
    });
    mesh.on('message', ({ from, body }) => sync.handle(from, body));
    return { sync, changes };
  }

  it('merges both histories in one round trip', async () => {
    const { a, b } = await den();
    const shared = msg('0001', 10);
    const storeA = new MemoryStore([shared, msg('0002', 20), toggleReaction(msg('0004', 40, BIA), 'howl', ANA, 41)]);
    const storeB = new MemoryStore([editRecord(shared, 'edited offline', 15), msg('0003', 30, BIA), msg('0004', 40, BIA)]);
    const sa = attach(a, storeA);
    const sb = attach(b, storeB);
    await sb.sync.start(ANA);
    await settle();
    const all = (s) => sortRecords([...s.map.values()]).map((r) => [r.id, r.text, reactors(r, 'howl')]);
    expect(all(storeA)).toEqual(all(storeB));
    expect(all(storeA)).toEqual([
      ['0001', 'edited offline', []],
      ['0002', 'text 0002', []],
      ['0003', 'text 0003', []],
      ['0004', 'text 0004', [ANA]],
    ]);
    expect(sa.changes.sort()).toEqual(['0001', '0003']);
    expect(sb.changes.sort()).toEqual(['0002', '0004']);
  });

  it('pages large manifests and drops invalid records', async () => {
    const { a, b } = await den();
    const many = Array.from({ length: 1000 }, (_, i) => msg(i.toString(16).padStart(4, '0'), 1000 + i));
    const storeA = new MemoryStore(many);
    const storeB = new MemoryStore();
    attach(a, storeA);
    const sb = attach(b, storeB);
    await sb.sync.start(ANA);
    await settle(400);
    expect(storeB.map.size).toBe(1000);
    await sb.sync.handle(ANA, { type: 'sync-r', records: [{ id: 'zz' }, null, 5] });
    await sb.sync.handle(ANA, { type: 'sync-w', ids: 'nope' });
    expect(storeB.map.size).toBe(1000);
  });
});

describe('richer records', () => {
  const base = (extra = {}) => createRecord({ id: '0201', channel: 'general', author: ANA, ts: 1000, text: 'first', ...extra });

  it('keeps an edit history that both copies agree on', () => {
    const one = editRecord(base(), 'second', 1100);
    const two = editRecord(one, 'third', 1200);
    expect(two.history).toEqual([
      [1000, 'first'],
      [1100, 'second'],
    ]);
    expect(editRecord(two, 'third', 1300)).toBe(two);
    const merged = mergeRecord(one, two);
    expect(merged.text).toBe('third');
    expect(merged.history).toHaveLength(2);
    expect(sameRecord(mergeRecord(one, two), mergeRecord(two, one))).toBe(true);
    let many = base();
    for (let i = 0; i < 15; i++) many = editRecord(many, `v${i}`, 2000 + i);
    expect(many.history).toHaveLength(10);
    expect(allowedChange(one, two, BIA)).toBe(false);
    expect(allowedChange(one, two, ANA)).toBe(true);
    expect(cleanRecord(JSON.parse(JSON.stringify(two))).history).toEqual(two.history);
  });

  it('pins with the last word winning, and anyone may pin', () => {
    const rec = base();
    const pinned = setPinned(rec, true, 1500);
    expect(isPinned(pinned)).toBe(true);
    const unpinned = setPinned(pinned, false, 1400);
    expect(unpinned.pin[0]).toBe(1501);
    expect(isPinned(mergeRecord(pinned, unpinned))).toBe(false);
    expect(isPinned(mergeRecord(unpinned, pinned))).toBe(false);
    expect(allowedChange(rec, pinned, BIA)).toBe(true);
    expect(version(pinned)).toBe(1500);
    expect(isPinned(deleteRecord(pinned, 1600))).toBe(false);
  });

  it('runs polls with single and multiple choice', () => {
    const poll = createRecord({ id: '0202', channel: 'general', author: ANA, ts: 1000, poll: { q: 'Pizza or tacos?', options: ['Pizza', 'Tacos', ' ', 'Both'] } });
    expect(poll.poll).toEqual({ q: 'Pizza or tacos?', options: ['Pizza', 'Tacos', 'Both'], multi: false });
    let p = votePoll(poll, 0, BIA, 1100);
    p = votePoll(p, 1, BIA, 1200);
    p = votePoll(p, 1, CAU, 1300);
    expect(pollResults(p, BIA)).toEqual({ per: [[], [BIA, CAU], []], total: 2, mine: [false, true, false] });
    p = votePoll(p, 1, BIA, 1400);
    expect(pollResults(p, BIA).per[1]).toEqual([CAU]);
    expect(votePoll(p, 9, BIA, 1500)).toBe(p);
    const multi = createRecord({ id: '0203', channel: 'general', author: ANA, ts: 1000, poll: { q: 'Which days?', options: ['Fri', 'Sat'], multi: true } });
    const both = votePoll(votePoll(multi, 0, BIA, 1100), 1, BIA, 1200);
    expect(pollResults(both, BIA).mine).toEqual([true, true]);
    expect(() => createRecord({ id: '0204', channel: 'general', author: ANA, ts: 1, poll: { q: 'x', options: ['only'] } })).toThrow();
    const a = votePoll(poll, 0, BIA, 2000);
    const b = votePoll(poll, 1, CAU, 2001);
    expect(sameRecord(mergeRecord(a, b), mergeRecord(b, a))).toBe(true);
    expect(pollResults(mergeRecord(a, b), BIA).total).toBe(2);
    expect(allowedChange(poll, a, BIA)).toBe(true);
    expect(allowedChange(poll, { ...poll, poll: { ...poll.poll, q: 'Changed' } }, BIA)).toBe(false);
    expect(cleanRecord({ ...poll, poll: { q: 'x'.repeat(500), options: Array.from({ length: 20 }, (_, i) => `o${i}`) } }).poll.options).toHaveLength(10);
    expect(editRecord(poll, 'text', 3000)).toBe(poll);
  });

  it('carries threads, forwards, /me and voice message metadata', () => {
    const reply = createRecord({ id: '0205', channel: 'general', author: BIA, ts: 1100, text: 'in thread', thread: '0201', fwd: { name: 'Caio', from: 'Night owls' }, me: true });
    const clean = cleanRecord(JSON.parse(JSON.stringify(reply)));
    expect(clean).toMatchObject({ thread: '0201', fwd: { name: 'Caio', from: 'Night owls' }, me: true });
    expect(cleanRecord({ ...reply, thread: reply.id }).thread).toBeUndefined();
    expect(allowedChange(reply, { ...reply, thread: '0999' }, ANA)).toBe(false);
    const gone = deleteRecord(reply, 1200);
    expect(gone.thread).toBe('0201');
    expect(gone.fwd).toBeUndefined();
    const voice = cleanRecord({ ...msg('0206', 1), files: [{ id: 'ab12', name: 'voice.webm', size: 900, type: 'audio/webm', voice: true, dur: 3.5, wave: [...Array(80).keys()].map((i) => i * 3) }] });
    expect(voice.files[0]).toMatchObject({ voice: true, dur: 3.5 });
    expect(voice.files[0].wave).toHaveLength(48);
    expect(Math.max(...voice.files[0].wave)).toBe(100);
  });

  it('accepts seasonal reactions and stickers at any time', () => {
    expect(SEASONAL.halloween).toBe('pumpkin');
    expect(reactors(toggleReaction(msg('0207', 1), 'pumpkin', BIA, 2), 'pumpkin')).toEqual([BIA]);
    expect(createRecord({ id: '0208', channel: 'general', author: ANA, ts: 1, sticker: 'christmas' }).sticker).toBe('christmas');
  });
});
