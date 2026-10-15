// Stickers drawn for howlden: Luna the wolf in eight moods plus one costume
// per season, on a 96 by 96 grid, built with createElementNS like the icons.
// Parts with an st-* class move when the sticker plays (on arrival and on
// hover); prefers-reduced-motion keeps them still.

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

  // Seasonal Luna, offered only during her season (the key is the season id).
  newyear: () => [
    group({ class: 'st-confetti' }, burst(16, 18, 8, GOLD), burst(82, 22, 7, '#ef5a6f'), burst(76, 4, 5, '#8fb8ff')),
    shadow,
    head({ eyes: 'happy', mouth: 'open', blush: true }),
    group({ class: 'st-hat' }, path('M37 22 50 0l12 19z', '#2a2560'), path('M40.5 16.5 52.5 13l1.8 3.2-11.6 3.4zM45 9.2l7.5-2 1.6 2.9-7.6 2.1z', GOLD), circle(50, 1.5, 3.5, GOLD)),
  ],
  carnival: () => [
    group({ class: 'st-confetti' }, ['rect', { x: 8, y: 20, width: 5, height: 3, rx: 1, fill: '#3ee6a0', transform: 'rotate(-20 10 21)' }], ['rect', { x: 82, y: 28, width: 5, height: 3, rx: 1, fill: GOLD, transform: 'rotate(25 84 29)' }], circle(86, 12, 2.2, '#ef5a6f'), circle(10, 40, 2, '#8fb8ff'), circle(70, 6, 2, '#b06bff')),
    shadow,
    head({ eyes: 'happy', mouth: 'open', blush: true }),
    group({ class: 'st-nod' }, path('M22 40c8-5 18-5 26 0 8-5 18-5 26 0 0 9-5 14-11 14-5 0-8-4-15-4s-10 4-15 4c-6 0-11-5-11-14z', '#b06bff'), path('M30 45q6-4 12 0M54 45q6-4 12 0', '#ffd23f', { fill: 'none', stroke: GOLD, 'stroke-width': 2.2, 'stroke-linecap': 'round' }), path('M74 40c6-10 14-14 18-12-2 6-8 10-16 13z', '#ef5a6f')),
  ],
  easter: () => [
    shadow,
    group({ class: 'st-wave' }, path('M34 26c-6-12-6-24 0-26 6 2 7 14 4 26z', '#fff'), path('M35 22c-3-8-3-16 0-18 3 2 3 10 2 18z', PINK)),
    group({ class: 'st-tilt' }, path('M58 26c2-12 8-23 14-22 3 4-2 15-9 24z', '#fff'), path('M60 22c2-8 6-14 9-14 1 3-2 9-7 15z', PINK)),
    head({ eyes: 'happy', mouth: 'smile', blush: true }),
    group({ class: 'st-pulse' }, path('M48 70c6 0 10 6 10 12s-4 10-10 10-10-4-10-10 4-12 10-12z', '#9fd8ff'), path('M38.6 81.5l3-2 2.8 2 2.8-2 2.8 2 2.8-2 3 2', '#ff8fb8', { fill: 'none', stroke: '#ff8fb8', 'stroke-width': 2 })),
    paw(38, 82),
    paw(58, 82),
  ],
  valentine: () => [
    group({ class: 'st-float' }, ['path', { d: 'M78 40c-2 10-6 20-12 26', fill: 'none', stroke: '#c9bfe8', 'stroke-width': 1.6 }], heart(80, 22, 13, '#ef5a6f'), path('M73 16q3-4 7-3', '#fff', { fill: 'none', stroke: '#fff', 'stroke-width': 2, 'stroke-linecap': 'round', opacity: 0.7 })),
    shadow,
    head({ eyes: 'hearts', mouth: 'smile', blush: true }),
    paw(66, 66),
  ],
  junina: () => [
    shadow,
    group({ class: 'st-glow' }, path('M80 92c-3-6 0-10 4-14 1 3 3 4 4 4 0-4 2-7 4-9 2 6 4 10 2 16-2 3-10 5-14 3z', '#ff8a3d'), path('M84 90c-1-3 1-5 3-7 0 2 2 3 3 3 1 2 0 4-1 5-2 1-4 1-5-1z', '#ffd23f')),
    head({ eyes: 'happy', mouth: 'open', blush: true }),
    group({ class: 'st-hat' }, path('M18 30c9-4 51-4 60 0-6 4-54 4-60 0z', '#e8c46a'), path('M32 29c0-10 6-18 16-18s16 8 16 18c-9 2-23 2-32 0z', '#f2d27a'), path('M33 25c9 2 21 2 30 0v3c-9 2-21 2-30 0z', '#ef5a6f'), path('M40 15l3 3M52 14l-2 4M46 18l2-3', '#c79a3a', { fill: 'none', stroke: '#c79a3a', 'stroke-width': 1.4, 'stroke-linecap': 'round' })),
    circle(31, 60, 1.1, '#7a4a2a'),
    circle(34, 62, 1.1, '#7a4a2a'),
    circle(62, 62, 1.1, '#7a4a2a'),
    circle(65, 60, 1.1, '#7a4a2a'),
  ],
  halloween: () => [
    shadow,
    head({ eyes: 'wink', mouth: 'open', blush: false }),
    group({ class: 'st-hat' }, path('M14 30c10-6 58-6 68 0-8 5-60 5-68 0z', '#2a1f4a'), path('M30 28c4-12 10-22 24-28 2 6-2 10 0 14 2 6 6 10 10 14-11 3-23 3-34 0z', '#3a2b66'), path('M31 25c11 2 23 2 33 0l1 4c-11 3-24 3-35 0z', '#ff8a3d')),
    group({ class: 'st-pulse' }, path('M72 74c8 0 14 5 14 11s-6 10-14 10-14-4-14-10 6-11 14-11z', '#ff8a3d'), path('M72 74c3 0 5 5 5 11s-2 10-5 10-5-4-5-10 2-11 5-11z', '#f26a1b'), path('M71 70h2v5h-2z', '#3fbf7f'), path('M66 82l3-2v3zM78 82l-3-2v3zM67 88q5 3 10 0', INK, { fill: INK, stroke: INK, 'stroke-width': 1, 'stroke-linejoin': 'round' })),
  ],
  christmas: () => [
    shadow,
    head({ eyes: 'happy', mouth: 'smile', blush: true }),
    group({ class: 'st-hat' }, path('M28 26c4-14 16-24 30-22 8 1 12 8 14 16-3-4-7-6-10-4 0 4 0 8-2 10-10 2-22 2-32 0z', '#ef3b4f'), path('M26 24c10 4 34 4 44 0 2 2 2 6 0 8-10 4-34 4-44 0-2-2-2-6 0-8z', '#fff'), circle(75, 22, 5, '#fff')),
    group({ class: 'st-nod' }, path('M24 76c14 6 34 6 48 0l2 8c-16 7-36 7-52 0z', '#ef3b4f'), path('M33 79l3 8M45 81l1 8M57 80l-1 8', '#3fbf7f', { fill: 'none', stroke: '#3fbf7f', 'stroke-width': 3 }), path('M64 80l6 14 6-2-4-13z', '#ef3b4f')),
  ],
};

/** A small firework burst. */
function burst(cx, cy, r, color) {
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    return `M${n(cx + Math.cos(a) * r * 0.35)} ${n(cy + Math.sin(a) * r * 0.35)}L${n(cx + Math.cos(a) * r)} ${n(cy + Math.sin(a) * r)}`;
  }).join('');
  return ['path', { d: rays, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linecap': 'round' }];
}

function build([tag, attrs, children]) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const child of children || []) if (child) el.appendChild(build(child));
  return el;
}

/** A sticker element. `play` runs its little animation once it is in the page. */
export function stickerEl(key, { size = 128, label = '', play = false } = {}) {
  const art = (STICKERS.includes(key) && STICKER_ART[key]) || STICKER_ART.wave;
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
