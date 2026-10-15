// The howlden icon set. Every icon is drawn on a 24 by 24 grid with round
// 2px strokes, built with createElementNS so no markup string is parsed.

const NS = 'http://www.w3.org/2000/svg';

const P = (d) => ['path', { d }];
const C = (cx, cy, r) => ['circle', { cx, cy, r }];
const R = (x, y, width, height, rx = 0) => ['rect', { x, y, width, height, rx }];
const F = (d, fill) => ['path', { d, fill, stroke: 'none' }];

export const ICONS = {
  logo: [
    F('M3 2.5 8.6 7.6 12 6.8l3.4.8L21 2.5l-.6 8 1.6 2.7-4.4 2.2-3.4 6L12 22l-2.2-.6-3.4-6L2 13.2l1.6-2.7z', 'currentColor'),
    F('M7.1 11.3l3.5 1.4-2.8.6zM16.9 11.3l-3.5 1.4 2.8.6zM10.6 18.4h2.8L12 20zM5.2 5.6l2.4 2.7-1.9 1.1zM18.8 5.6l-2.4 2.7 1.9 1.1z', 'var(--logo-cut, #15161c)'),
  ],
  hash: [P('M5 9h15M4 15h15M10 4 8 20M16 4l-2 16')],
  speaker: [P('M4 9.5v5h3.5L12 19V5L7.5 9.5z'), P('M15.5 9a4.2 4.2 0 0 1 0 6'), P('M18 6.5a7.8 7.8 0 0 1 0 11')],
  mic: [R(9, 3, 6, 11, 3), P('M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6')],
  'mic-off': [P('M15 10V6a3 3 0 0 0-5.8-1M9 9v2a3 3 0 0 0 4.6 2.5'), P('M18.5 11a6.5 6.5 0 0 1-1.1 3.6M5.5 11a6.5 6.5 0 0 0 10.2 5.3M12 17.5V21M9 21h6'), P('M3 3l18 18')],
  headphones: [P('M4 16v-4a8 8 0 0 1 16 0v4'), P('M4 15h3.5v6H5.5A1.5 1.5 0 0 1 4 19.5zM20 15h-3.5v6h2a1.5 1.5 0 0 0 1.5-1.5z')],
  'headphones-off': [P('M4 16v-4a8 8 0 0 1 12.5-6.6M19.5 9.5c.3.8.5 1.6.5 2.5v4'), P('M4 15h3.5v6H5.5A1.5 1.5 0 0 1 4 19.5zM20 15h-3.5v6h2a1.5 1.5 0 0 0 1.5-1.5z'), P('M3 3l18 18')],
  gear: [C(12, 12, 3), P('M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7'), C(12, 12, 6.8)],
  plus: [P('M12 5v14M5 12h14')],
  x: [P('M6 6l12 12M18 6 6 18')],
  members: [C(9, 8, 3.5), P('M2.5 20a6.5 6.5 0 0 1 13 0'), C(17, 9, 2.6), P('M16.5 14a5 5 0 0 1 5.5 5')],
  invite: [C(10, 8, 4), P('M3 21a7 7 0 0 1 14 0'), P('M19 7v6M16 10h6')],
  camera: [R(3, 6.5, 12.5, 11, 2.5), P('M15.5 10.5 21 7.5v9l-5.5-3')],
  'camera-off': [P('M15.5 13.5 21 16.5v-9l-5.5 3M10.5 6.5h2.5a2.5 2.5 0 0 1 2.5 2.5v2.5M15.5 15v.5a2 2 0 0 1-2 2H5.5A2.5 2.5 0 0 1 3 15V9a2.5 2.5 0 0 1 2-2.4'), P('M3 3l18 18')],
  screen: [R(2.5, 4, 19, 12.5, 2), P('M8 20.5h8M12 16.5v4'), P('M9.5 10.5 12 8l2.5 2.5M12 8v5')],
  'screen-off': [R(2.5, 4, 19, 12.5, 2), P('M8 20.5h8M12 16.5v4'), P('M9.5 7.5l5 5.5M14.5 7.5l-5 5.5')],
  hangup: [F('M2.6 13.9c5.2-5.1 13.6-5.1 18.8 0 .5.5.5 1.2 0 1.7l-1.8 1.8c-.4.4-1 .5-1.5.2l-2.6-1.4a1.2 1.2 0 0 1-.6-1.1v-2.3a11 11 0 0 0-5.8 0v2.3c0 .5-.2.9-.6 1.1L5.9 17.6c-.5.3-1.1.2-1.5-.2l-1.8-1.8a1.2 1.2 0 0 1 0-1.7z', 'currentColor')],
  reply: [P('M10 7 4 12.5l6 5.5'), P('M4 12.5h10a6 6 0 0 1 6 6V20')],
  edit: [P('M4 20h4L19.5 8.5l-4-4L4 16z'), P('M13.5 6.5l4 4')],
  trash: [P('M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5M14 11v5')],
  react: [C(11, 12.5, 8), P('M8 14.5a4 4 0 0 0 6 0'), P('M8.5 10h.01M13.5 10h.01'), P('M19 2.5v5M16.5 5h5')],
  attach: [C(12, 12, 9.5), P('M12 7.5v9M7.5 12h9')],
  send: [P('M4 12 20 4l-5.5 16-3-6.5z'), P('M11.5 13.5 20 4')],
  'chevron-down': [P('M6 9l6 6 6-6')],
  'chevron-right': [P('M9 6l6 6-6 6')],
  'arrow-left': [P('M10 5 3 12l7 7M3 12h18')],
  menu: [P('M4 6.5h16M4 12h16M4 17.5h16')],
  copy: [R(8, 8, 12.5, 12.5, 2), P('M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8')],
  share: [C(18, 5.5, 2.5), C(6, 12, 2.5), C(18, 18.5, 2.5), P('M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1')],
  qr: [R(3.5, 3.5, 6.5, 6.5, 1), R(14, 3.5, 6.5, 6.5, 1), R(3.5, 14, 6.5, 6.5, 1), P('M14 14h2.5v2.5H14zM18 18h2.5v2.5H18zM18 14h2.5M14 18v2.5')],
  scan: [P('M4 8.5V5.5A1.5 1.5 0 0 1 5.5 4h3M15.5 4h3A1.5 1.5 0 0 1 20 5.5v3M20 15.5v3a1.5 1.5 0 0 1-1.5 1.5h-3M8.5 20h-3A1.5 1.5 0 0 1 4 18.5v-3'), P('M4 12h16')],
  check: [P('M5 12.5 9.5 17 19 7.5')],
  warning: [P('M12 3.5 21.5 20h-19z'), P('M12 10v4.5M12 17.5h.01')],
  lock: [R(5, 10.5, 14, 10.5, 2.5), P('M8 10.5V8a4 4 0 0 1 8 0v2.5M12 15v2')],
  shield: [P('M12 3l8 3v6c0 4.9-3.4 8-8 9.2C7.4 20 4 16.9 4 12V6z'), P('M8.8 12.2l2.2 2.2 4.3-4.4')],
  bell: [P('M6 16.5V11a6 6 0 0 1 12 0v5.5l1.8 1.8H4.2z'), P('M10 21h4')],
  globe: [C(12, 12, 9), P('M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z')],
  palette: [P('M12 3a9 9 0 1 0 0 18c1.4 0 2-.9 2-1.9 0-1.2-1-1.6-1-2.6 0-.9.8-1.5 1.8-1.5H17a4 4 0 0 0 4-4C21 6.5 17 3 12 3z'), P('M7.5 11.5h.01M9.5 7.5h.01M14.5 7.5h.01')],
  moon: [P('M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z')],
  sun: [C(12, 12, 4), P('M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4')],
  signal: [P('M4.5 20v-3M9.5 20v-7M14.5 20V9M19.5 20V4.5')],
  download: [P('M12 4v11.5M7 11l5 5 5-5M5 20h14')],
  file: [P('M6.5 3h7.5l5 5v13h-12.5z'), P('M14 3v5h5M9.5 13h6M9.5 16.5h6')],
  image: [R(3, 4, 18, 16, 2), C(8.5, 9.5, 1.8), P('M21 16l-5.5-5.5L5 20')],
  at: [C(12, 12, 4), P('M16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-3.6 7.2')],
  link: [P('M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1'), P('M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1')],
  expand: [P('M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5')],
  relay: [C(12, 10, 2), P('M8.3 13.7a5.3 5.3 0 0 1 0-7.4M15.7 6.3a5.3 5.3 0 0 1 0 7.4M5.5 16.5a9.2 9.2 0 0 1 0-13M18.5 3.5a9.2 9.2 0 0 1 0 13M12 12l-3 9M12 12l3 9')],
  logout: [P('M14.5 4h4a1.5 1.5 0 0 1 1.5 1.5v13a1.5 1.5 0 0 1-1.5 1.5h-4'), P('M9.5 8l-4 4 4 4M5.5 12h10')],
  enter: [P('M13 4h5.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H13'), P('M10 8l4 4-4 4M3.5 12H14')],
  shuffle: [P('M19.5 10.5A8 8 0 0 0 5.6 7M4.5 3.5V8h4.5'), P('M4.5 13.5A8 8 0 0 0 18.4 17M19.5 20.5V16H15')],
  keyboard: [R(2.5, 6, 19, 12, 2), P('M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M7 14h10')],
  eye: [P('M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z'), C(12, 12, 3)],
  dots: [P('M5.5 12h.01M12 12h.01M18.5 12h.01')],
  volume: [P('M4 9.5v5h3.5L12 19V5L7.5 9.5z'), P('M15.5 9a4.2 4.2 0 0 1 0 6')],
  trash2: [P('M4 7h16M6.5 7l1 13h9l1-13')],
  info: [C(12, 12, 9), P('M12 11v5.5M12 7.5h.01')],
  compass: [C(12, 12, 9), P('M15.5 8.5 13.5 13.5 8.5 15.5 10.5 10.5z')],
  focus: [P('M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'), R(8.5, 8.5, 7, 7, 1.5)],
  grid: [R(3.5, 3.5, 7, 7, 1.5), R(13.5, 3.5, 7, 7, 1.5), R(3.5, 13.5, 7, 7, 1.5), R(13.5, 13.5, 7, 7, 1.5)],
  sticker: [P('M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5V13l-7 7H6.5A2.5 2.5 0 0 1 4 17.5z'), P('M20 13h-4.5a2.5 2.5 0 0 0-2.5 2.5V20'), P('M8.5 9.5h.01M14.5 9.5h.01'), P('M8.5 13.5a4.5 4.5 0 0 0 3.5 1.2')],
  music: [P('M9 18V5.5l11-2V16'), C(6.5, 18, 2.5), C(17.5, 16, 2.5)],
  record: [C(12, 12, 9), ['circle', { cx: 12, cy: 12, r: 4, fill: 'currentColor' }]],
  ptt: [R(6.5, 7, 11, 14, 2.5), P('M9.5 7V3'), P('M9.5 11h5M9.5 14h5M9.5 17h5')],
  phone: [P('M5 4h3.5l1.8 4.5-2.3 1.4a11 11 0 0 0 6.1 6.1l1.4-2.3L20 15.5V19a1.5 1.5 0 0 1-1.6 1.5A16.5 16.5 0 0 1 3.5 5.6 1.5 1.5 0 0 1 5 4z'), P('M15 3.5a5.5 5.5 0 0 1 5.5 5.5M15 7a2 2 0 0 1 2 2')],
};

// Reaction icons are filled and colored. Keys match REACTIONS in src/history.js.
const FACE = '#f6c445';
const INK = '#3b2a12';
export const REACTION_ICONS = {
  like: [F('M7 10.5v9.5H4.2a1 1 0 0 1-1-1v-7.5a1 1 0 0 1 1-1z', '#e39b2d'), F('M8.5 10.5 12 3.6c1.5 0 2.6 1.2 2.3 2.8L13.7 9.5h5.6a2 2 0 0 1 2 2.4l-1.4 6.6a2 2 0 0 1-2 1.5H8.5z', FACE)],
  love: [F('M12 20.5s-8-4.7-9.4-9.6C1.6 7.3 4 4.2 7.3 4.2c2 0 3.6 1 4.7 2.7 1.1-1.7 2.7-2.7 4.7-2.7 3.3 0 5.7 3.1 4.7 6.7C20 15.8 12 20.5 12 20.5z', '#ef5a6f')],
  laugh: [F('M12 2.5a9.5 9.5 0 1 1 0 19 9.5 9.5 0 0 1 0-19z', FACE), ['path', { d: 'M7.2 9.8q1.5-1.6 3 0M13.8 9.8q1.5-1.6 3 0', fill: 'none', stroke: INK, 'stroke-width': 1.6 }], F('M6.8 13h10.4a5.2 5.2 0 0 1-10.4 0z', INK)],
  wow: [F('M12 2.5a9.5 9.5 0 1 1 0 19 9.5 9.5 0 0 1 0-19z', FACE), F('M8.8 8.2a1.3 1.6 0 1 1 0 3.2 1.3 1.6 0 0 1 0-3.2zM15.2 8.2a1.3 1.6 0 1 1 0 3.2 1.3 1.6 0 0 1 0-3.2zM12 13.2a2.2 2.8 0 1 1 0 5.6 2.2 2.8 0 0 1 0-5.6z', INK)],
  sad: [F('M12 2.5a9.5 9.5 0 1 1 0 19 9.5 9.5 0 0 1 0-19z', FACE), F('M8.8 9a1.2 1.4 0 1 1 0 2.8 1.2 1.4 0 0 1 0-2.8zM15.2 9a1.2 1.4 0 1 1 0 2.8 1.2 1.4 0 0 1 0-2.8z', INK), ['path', { d: 'M8.3 17.2q3.7-3.4 7.4 0', fill: 'none', stroke: INK, 'stroke-width': 1.6 }], F('M17.6 12.4c.9 1.3 1.4 2.1 1.4 2.7a1.4 1.4 0 0 1-2.8 0c0-.6.5-1.4 1.4-2.7z', '#5bb4f0')],
  fire: [F('M12 2c1 3.2 5.8 5.7 5.8 11.3A5.8 5.8 0 0 1 12 19.5a5.8 5.8 0 0 1-5.8-6.2c0-2.6 1.4-4.2 2.7-5.5.2 1.6.9 2.6 1.9 3.1C10.3 7.6 11 4.4 12 2z', '#f2643a'), F('M12 11.5c.6 1.8 2.8 2.7 2.8 5.1a2.8 2.8 0 0 1-5.6 0c0-1.4.9-2.3 1.6-3 .2.8.6 1.2 1 1.4-.1-1.4.1-2.6.2-3.5z', '#ffd23f')],
  howl: [F('M18.5 2.5a6 6 0 1 0 3 11.2A7 7 0 0 1 18.5 2.5z', '#ffe08a'), F('M3 21.5 5.2 12 4 8.2l3 1.6 2.6-3.3 1.1 3.9 4.6 3.4-1.8 1.2-2.3-.6L9 21.5z', '#8fa0c8')],
  check: [F('M5 2.5h14A2.5 2.5 0 0 1 21.5 5v14a2.5 2.5 0 0 1-2.5 2.5H5A2.5 2.5 0 0 1 2.5 19V5A2.5 2.5 0 0 1 5 2.5z', '#3fbf7f'), ['path', { d: 'M7 12.5l3.5 3.5L17.5 8', fill: 'none', stroke: '#fff', 'stroke-width': 2.4 }]],
};

function build(parts, { size = 20, label, cls } = {}) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('class', `ico${cls ? ` ${cls}` : ''}`);
  if (label) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', label);
  } else {
    svg.setAttribute('aria-hidden', 'true');
  }
  for (const [tag, attrs] of parts) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    svg.appendChild(el);
  }
  return svg;
}

/** An outline icon element. */
export function icon(name, options) {
  return build(ICONS[name] || ICONS.info, options);
}

/** A colored reaction icon element. */
export function reactionIcon(key, options) {
  return build(REACTION_ICONS[key] || REACTION_ICONS.like, options);
}
