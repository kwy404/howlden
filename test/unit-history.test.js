import { describe, expect, it } from 'vitest';
import {
  HistorySync,
  MemoryStore,
  allowedChange,
  batchBySize,
  cleanRecord,
  createRecord,
  deleteRecord,
  diffManifest,
  editRecord,
  manifest,
  mergeRecord,
  reactors,
  sameRecord,
  sortRecords,
  toggleReaction,
  version,
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
