// Stickers drawn for howlden: Luna the wolf in eight moods, on a 96 by 96 grid,
// built with createElementNS like the icons. Parts with an st-* class move
// when the sticker plays (on arrival and on hover); prefers-reduced-motion
// keeps them still.

import { STICKERS } from '../core/history.js';

const NS = 'http://www.w3.org/2000/svg';
const FUR = '#9a91d6';
const FUR_DARK = '#7469bd';
const CREAM = '#f3f0ff';
const PINK = '#ff9fb8';
const INK = '#1a1338';
const GOLD = '#ffd66b';

const path = (d, fill, extra = {}) => ['path', { d, fill, ...extra }];
const line = (d, extra = {}) => ['path', { d, fill: 'none', stroke: INK, 'stroke-width': 3.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...extra }];
const circle = (cx, cy, r, fill, extra = {}) => ['circle', { cx, cy, r, fill, ...extra }];
const ellipse = (cx, cy, rx, ry, fill, extra = {}) => ['ellipse', { cx, cy, rx, ry, fill, ...extra }];
const group = (attrs, ...children) => ['g', attrs, children];
const n = (v) => Math.round(v * 100) / 100;
/** A heart centered on (x, y) with half width r. */
const heart = (x, y, r, fill) => {
  const p = (dx, dy) => `${n(x + dx * r)} ${n(y + dy * r)}`;
  return path(`M${p(0, -0.3)}C${p(-0.1, -1.1)} ${p(-1, -1.1)} ${p(-1, -0.3)}C${p(-1, 0.3)} ${p(-0.4, 0.6)} ${p(0, 1)}C${p(0.4, 0.6)} ${p(1, 0.3)} ${p(1, -0.3)}C${p(1, -1.1)} ${p(0.1, -1.1)} ${p(0, -0.3)}z`, fill);
};

const EYES = {
  open: [circle(36, 46, 4.6, INK), circle(60, 46, 4.6, INK), circle(37.6, 44.3, 1.6, '#fff'), circle(61.6, 44.3, 1.6, '#fff')],
  happy: [line('M31 47.5q5-6 10 0'), line('M55 47.5q5-6 10 0')],
  sleepy: [line('M31 46q5 4.5 10 0'), line('M55 46q5 4.5 10 0')],
  wink: [circle(36, 46, 4.6, INK), circle(37.6, 44.3, 1.6, '#fff'), line('M55 47.5q5-6 10 0')],
  hearts: [heart(36, 46, 5, '#ef5a6f'), heart(60, 46, 5, '#ef5a6f')],
  shades: [path('M25 40h21v6.5a7 7 0 0 1-7 7h-7a7 7 0 0 1-7-7z', INK), path('M50 40h21v6.5a7 7 0 0 1-7 7h-7a7 7 0 0 1-7-7z', INK), line('M46 42.5h4'), group({ class: 'st-glint' }, path('M29 43l5-3h3l-5 3z', '#fff', { opacity: 0.8 }), path('M54 43l5-3h3l-5 3z', '#fff', { opacity: 0.8 }))],
};

const MOUTHS = {
  smile: [line('M42 67q6 5 12 0', { 'stroke-width': 2.6 })],
  smirk: [line('M42 67.5q7 3.5 12-2', { 'stroke-width': 2.6 })],
  open: [path('M39.5 65.5q8.5 15 17 0z', INK), path('M43.5 71q4.5 5 9 0q-4.5 2-9 0z', PINK)],
  howl: [ellipse(48, 69, 4.2, 5.4, INK), ellipse(48, 71, 2.4, 2, PINK)],
};

/** The front facing wolf head, in a group so a sticker can tilt or bob it. */
function head({ eyes = 'open', mouth = 'smile', blush = false, cls = '' } = {}) {
  return group(
    { class: `st-head ${cls}`.trim() },
    path('M23 36 17 7l24 17z', FUR),
    path('M73 36 79 7 55 24z', FUR),
    path('M25 31 22 14l13 11z', PINK),
    path('M71 31 74 14 61 25z', PINK),
    path('M16 56 6 62l12 2zM80 56l10 6-12 2z', FUR_DARK),
    path('M48 20c20 0 32 14 32 33 0 18-14 31-32 31S16 71 16 53c0-19 12-33 32-33z', FUR),
    path('M48 23l-5.5 17h11z', CREAM),
    ellipse(48, 65, 17.5, 13.5, CREAM),
    blush ? ellipse(29, 58, 5, 3, PINK, { opacity: 0.75 }) : null,
    blush ? ellipse(67, 58, 5, 3, PINK, { opacity: 0.75 }) : null,
    ...EYES[eyes],
    path('M42.5 57.5q5.5-3.5 11 0-1.5 5.5-5.5 5.5t-5.5-5.5z', INK),
    ...MOUTHS[mouth],
  );
}

const shadow = ellipse(48, 90, 24, 3.4, '#000', { opacity: 0.18 });
const paw = (x, y, cls = '') => group({ class: cls }, path(`M${x - 8} ${y + 10}c-1-9 1-17 8-18 7-1 10 5 9 12l-1 6z`, FUR), ellipse(x + 0.5, y - 1, 2.2, 1.8, PINK), ellipse(x - 4, y + 1, 1.8, 1.5, PINK), ellipse(x + 4.5, y + 1.5, 1.8, 1.5, PINK));

export const STICKER_ART = {
  wave: () => [shadow, head({ eyes: 'happy', mouth: 'open', blush: true }), paw(83, 62, 'st-wave')],
  howl: () => [
    group({ class: 'st-glow' }, path('M19 5a12 12 0 1 0 13 17A10 10 0 0 1 19 5z', GOLD)),
    shadow,
    group({ transform: 'rotate(-10 48 52)' }, head({ eyes: 'happy', mouth: 'howl', cls: 'st-tilt' })),
    group({ class: 'st-notes' }, line('M62 14q4-3 8 0', { stroke: FUR_DARK, 'stroke-width': 2.4 }), line('M66 8q5-4 10 0', { stroke: FUR_DARK, 'stroke-width': 2.4 }), line('M70 2q6-4 12 0', { stroke: FUR_DARK, 'stroke-width': 2.4 })),
  ],
  love: () => [shadow, head({ eyes: 'hearts', mouth: 'smile', blush: true }), group({ class: 'st-float' }, heart(80, 16, 7, '#ef5a6f'), heart(14, 24, 4.5, PINK))],
  laugh: () => [shadow, head({ eyes: 'happy', mouth: 'open', blush: true, cls: 'st-shake' }), group({ class: 'st-tears' }, path('M24 49c-3 4-4 7-1.5 8.5S28 56 24 49z', '#5bb4f0'), path('M72 49c3 4 4 7 1.5 8.5S68 56 72 49z', '#5bb4f0'))],
  party: () => [
    shadow,
    head({ eyes: 'open', mouth: 'open' }),
    group({ class: 'st-hat' }, path('M37 22 50 0l12 19z', '#ff8a3d'), path('M40.5 16.5 52.5 13l1.8 3.2-11.6 3.4zM45 9.2l7.5-2 1.6 2.9-7.6 2.1z', '#fff', { opacity: 0.85 }), circle(50, 1.5, 3.5, GOLD)),
    group({ class: 'st-confetti' }, ['rect', { x: 10, y: 22, width: 5, height: 3, rx: 1, fill: '#3ee6a0', transform: 'rotate(-20 12 23)' }], ['rect', { x: 80, y: 30, width: 5, height: 3, rx: 1, fill: GOLD, transform: 'rotate(25 82 31)' }], circle(84, 16, 2.2, '#ef5a6f'), circle(8, 38, 2, '#8fb8ff'), ['rect', { x: 70, y: 6, width: 4, height: 3, rx: 1, fill: '#8b6bff' }]),
  ],
  sleepy: () => [shadow, head({ eyes: 'sleepy', mouth: 'smile', blush: true, cls: 'st-breathe' }), group({ class: 'st-zzz' }, line('M66 22h7l-7 7h7', { stroke: FUR_DARK, 'stroke-width': 2.4 }), line('M77 9h9l-9 9h9', { stroke: FUR_DARK, 'stroke-width': 2.8 }))],
  thanks: () => [shadow, head({ eyes: 'wink', mouth: 'smile', blush: true }), group({ class: 'st-pulse' }, heart(48, 80, 8, '#ef5a6f')), paw(36, 80), paw(60, 80)],
  cool: () => [shadow, head({ eyes: 'shades', mouth: 'smirk', cls: 'st-nod' })],
};

function build([tag, attrs, children]) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const child of children || []) if (child) el.appendChild(build(child));
  return el;
}

/** A sticker element. `play` runs its little animation once it is in the page. */
export function stickerEl(key, { size = 128, label = '', play = false } = {}) {
  const art = STICKER_ART[STICKERS.includes(key) ? key : 'wave'];
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 96 96');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (const part of art()) if (part) svg.appendChild(build(part));
  const wrap = document.createElement('span');
  wrap.className = `sticker sticker-${key}${play ? ' play' : ''}`;
  if (label) {
    wrap.setAttribute('role', 'img');
    wrap.setAttribute('aria-label', label);
  }
  wrap.append(svg);
  // Hover plays it again once the arrival animation is over.
  if (play) setTimeout(() => wrap.classList.remove('play'), 2600);
  return wrap;
}
