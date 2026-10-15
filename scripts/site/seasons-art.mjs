// Seasonal art for the special dates in docs/seasons.js: the pack in costume,
// three or four icons per season in the howlden icon style, and a hero
// accent (a garland across the top of the landing page) in a dusk and a
// night version. Everything is flat SVG drawn here, like the rest of the art.
import { PAL } from './art.mjs';
import { figure } from './extras.mjs';
import { FURS } from './scenes.mjs';

export const SEASON_IDS = ['newyear', 'carnival', 'easter', 'valentine', 'junina', 'halloween', 'christmas'];
export const PACK = { luna: 'luna', fang: 'grey', pip: 'snow', nova: 'brown', moss: 'night', ember: 'rust' };
const PROPS = { luna: {}, fang: { headset: true, prop: 'pad' }, pip: { bow: true, prop: 'book' }, nova: { headset: true, prop: 'phone' }, moss: { glasses: true, prop: 'wave' }, ember: { headset: true } };

const doc = (vb, w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${w}" height="${h}">${body}</svg>\n`;
const paws = (P, y = 168, dx = 62) => `<ellipse cx="${-dx}" cy="${y}" rx="20" ry="16" fill="${P.furL}"/><ellipse cx="${dx}" cy="${y}" rx="20" ry="16" fill="${P.furL}"/>`;
const heartD = 'M0 30 C-40 4 -50 -24 -30 -40 C-16 -50 -4 -44 0 -32 C4 -44 16 -50 30 -40 C50 -24 40 4 0 30Z';

// ---------- Costume pieces, in face coordinates (face center at 0, 0) ----------

const witchHat = (body = '#2f2360', brim = '#241a45', band = '#ff8a3d') => `<g transform="translate(0 -70) rotate(-8)"><ellipse cx="0" cy="0" rx="106" ry="21" fill="${brim}"/><path d="M-58 -6 C-50 -60 -30 -112 10 -150 C30 -168 54 -166 66 -146 C46 -150 32 -130 32 -110 C34 -70 50 -30 58 -6 Z" fill="${body}"/><path d="M-30 -40 C-24 -80 -12 -112 8 -134" stroke="#ffffff" stroke-opacity=".14" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M-57 -9 C-20 0 20 0 57 -9 L53 -31 C18 -23 -18 -23 -52 -31 Z" fill="${band}"/><rect x="-12" y="-30" width="24" height="20" rx="3" fill="none" stroke="#ffd166" stroke-width="5"/><path d="M-100 4 C-50 22 50 22 100 4" stroke="#ffffff" stroke-opacity=".1" stroke-width="4" fill="none"/></g>`;
const batBand = () => `<path d="M-80 -30 C-82 -96 82 -96 80 -30" fill="none" stroke="#241a45" stroke-width="9" stroke-linecap="round"/><g transform="translate(0 -92)"><path d="M0 4 C-14 -14 -42 -20 -66 -10 C-56 -4 -54 4 -58 12 C-46 8 -36 10 -28 18 C-22 10 -12 8 0 12 C12 8 22 10 28 18 C36 10 46 8 58 12 C54 4 56 -4 66 -10 C42 -20 14 -14 0 4 Z" fill="#241a45"/><circle cx="0" cy="2" r="12" fill="#2f2360"/><path d="M-8 -6 L-10 -18 L-2 -10 Z M8 -6 L10 -18 L2 -10 Z" fill="#2f2360"/><circle cx="-4" cy="2" r="2.4" fill="#ff8a3d"/><circle cx="4" cy="2" r="2.4" fill="#ff8a3d"/></g>`;
const pumpkin = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="-22" cy="0" rx="26" ry="33" fill="#d9601a"/><ellipse cx="22" cy="0" rx="26" ry="33" fill="#d9601a"/><ellipse cx="0" cy="0" rx="30" ry="37" fill="#ff8a3d"/><path d="M-12 -30 C-16 -10 -16 14 -10 32 M12 -30 C16 -10 16 14 10 32" stroke="#e8701f" stroke-width="3" fill="none"/><path d="M-4 -35 C-4 -45 0 -51 9 -55" stroke="#4f8a4a" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M-27 -6 L-15 -19 L-8 -4 Z M27 -6 L15 -19 L8 -4 Z" fill="#ffd166"/><path d="M-24 9 C-12 25 12 25 24 9 L17 13 L11 7 L4 15 L-4 7 L-11 15 L-17 7 Z" fill="#ffd166"/></g>`;

const winterHat = () => `<g transform="translate(0 -64) rotate(-6)"><path d="M-80 0 C-72 -72 -10 -112 50 -102 C82 -96 98 -70 106 -40 C82 -60 62 -62 50 -50 C64 -30 72 -14 76 0 Z" fill="#d9434f"/><path d="M-40 -42 C-20 -72 18 -92 48 -94" stroke="#ffffff" stroke-opacity=".22" stroke-width="8" fill="none" stroke-linecap="round"/><rect x="-90" y="-14" width="180" height="30" rx="15" fill="#f4f1ff"/><circle cx="106" cy="-38" r="19" fill="#f4f1ff"/></g>`;
const scarf = (c = '#d9434f') => `<path d="M-64 42 C-30 64 30 64 64 42 L68 66 C30 90 -30 90 -68 66 Z" fill="${c}"/><path d="M-44 60 l5 22 M-14 66 l3 23 M16 67 l-2 22 M46 60 l-5 22" stroke="#f4f1ff" stroke-width="7"/><path d="M26 72 L52 70 L60 152 L34 154 Z" fill="${c}"/><path d="M30 96 L56 94 M32 122 L58 120" stroke="#f4f1ff" stroke-width="7"/><path d="M38 154 v12 M46 153 v12 M54 152 v12" stroke="${c}" stroke-width="4" stroke-linecap="round"/>`;
const gift = (P) => `<rect x="-36" y="126" width="72" height="58" rx="6" fill="#8b6bff"/><rect x="-42" y="116" width="84" height="16" rx="5" fill="#a586ff"/><path d="M0 116 v68" stroke="#ffd166" stroke-width="10"/><path d="M0 116 C-8 96 -32 98 -24 112 C-20 118 -8 118 0 116 C8 118 20 118 24 112 C32 98 8 96 0 116 Z" fill="#ffd166"/>${paws(P, 150, 50)}`;
const snow = () => [[-150, -180, 9], [140, -120, 7], [-120, 40, 6], [150, 60, 8], [-60, -230, 5], [100, -230, 6]].map(([x, y, r]) => `<g transform="translate(${x} ${y})" stroke="#f4f1ff" stroke-width="3" stroke-linecap="round"><path d="M0 ${-r * 1.8} V${r * 1.8} M${-r * 1.56} ${-r * 0.9} L${r * 1.56} ${r * 0.9} M${-r * 1.56} ${r * 0.9} L${r * 1.56} ${-r * 0.9}"/></g>`).join('');

const eyeMask = (c = '#8b6bff') => `<path fill-rule="evenodd" d="M-74 -22 C-62 -46 -36 -42 -16 -30 C-8 -26 8 -26 16 -30 C36 -42 62 -46 74 -22 C72 0 56 10 38 8 C24 6 12 -4 0 -6 C-12 -4 -24 6 -38 8 C-56 10 -72 0 -74 -22 Z M-45 -14 a15 12 0 1 0 30 0 a15 12 0 1 0 -30 0 Z M15 -14 a15 12 0 1 0 30 0 a15 12 0 1 0 -30 0 Z" fill="${c}"/>${[-60, -48, -36, 36, 48, 60].map((x, i) => `<circle cx="${x}" cy="${-34 + (i % 3 === 1 ? -4 : 0)}" r="3.4" fill="#ffd166"/>`).join('')}<path d="M-6 -24 L0 -16 L6 -24 Z" fill="#ffd166"/>`;
const plume = () => `<path d="M62 -32 C74 -76 96 -108 120 -128 C112 -94 98 -62 70 -24 Z" fill="#ff7eb3"/><path d="M58 -30 C60 -74 72 -112 90 -140 C92 -104 86 -66 66 -26 Z" fill="#3ee6a0"/><path d="M66 -28 C80 -70 100 -96 120 -128" stroke="#ffffff" stroke-opacity=".5" stroke-width="2" fill="none"/>`;
const confetti = () => [[-150, -160, '#ff7eb3', 20], [130, -190, '#ffd166', -30], [-110, -40, '#3ee6a0', 40], [150, -30, '#8b6bff', 10], [-170, 80, '#ffd166', -20], [160, 110, '#ff7eb3', 60], [-60, -220, '#3ee6a0', 15]].map(([x, y, c, r]) => `<rect x="${x}" y="${y}" width="14" height="8" rx="2" fill="${c}" transform="rotate(${r} ${x} ${y})"/>`).join('') + '<path d="M-140 -110 C-120 -130 -110 -100 -90 -120 S-60 -110 -50 -130" stroke="#ffd166" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M150 -70 C130 -60 140 -40 120 -30 S110 0 96 4" stroke="#ff7eb3" stroke-width="5" fill="none" stroke-linecap="round"/>';
const streamer = (P) => `<path d="M-84 96 C-66 76 -54 112 -34 92 S-4 112 14 92 S44 110 64 90" stroke="#ffd166" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M-70 130 C-50 116 -40 146 -20 128 S10 146 30 128" stroke="#3ee6a0" stroke-width="6" fill="none" stroke-linecap="round"/>${paws(P)}`;

const strawHat = () => `<g transform="translate(0 -72) rotate(-4)"><ellipse cx="0" cy="0" rx="120" ry="25" fill="#d29b52"/><path d="M-104 6 C-60 18 60 18 104 6" stroke="#b9843f" stroke-width="3" fill="none"/><path d="M-57 -4 C-57 -58 -30 -78 0 -78 C30 -78 57 -58 57 -4 Z" fill="#e8c27a"/><path d="M-40 -44 C-12 -52 18 -52 44 -44 M-48 -24 C-14 -32 18 -32 50 -24" stroke="#d1a35e" stroke-width="3" fill="none"/><path d="M-57 -6 C-20 4 20 4 57 -6 L55 -22 C20 -14 -20 -14 -55 -22 Z" fill="#d9434f"/><rect x="16" y="-62" width="24" height="19" rx="3" fill="#8b6bff" transform="rotate(10 28 -52)"/><path d="M19 -58 h18 M19 -48 h18" stroke="#f4f1ff" stroke-width="2" stroke-dasharray="3 3" transform="rotate(10 28 -52)"/></g>`;
const bandana = (id) => `<defs><pattern id="chk-${id}" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="#d9434f"/><rect width="8" height="8" fill="#f4f1ff" opacity=".8"/><rect x="8" y="8" width="8" height="8" fill="#f4f1ff" opacity=".8"/></pattern></defs><path d="M-62 44 C-20 62 20 62 62 44 L0 116 Z" fill="url(#chk-${id})"/>`;
const bonfire = (x, y) => `<g transform="translate(${x} ${y})"><ellipse cx="0" cy="22" rx="56" ry="9" fill="#000" opacity=".2"/><path d="M-46 18 L40 -6" stroke="#7a4e3b" stroke-width="15" stroke-linecap="round"/><path d="M46 18 L-40 -6" stroke="#5c3a2c" stroke-width="15" stroke-linecap="round"/><path d="M0 -96 C26 -66 40 -44 40 -22 A40 40 0 0 1 -40 -22 C-40 -40 -30 -52 -20 -62 C-18 -48 -12 -40 -4 -38 C-10 -58 -8 -78 0 -96 Z" fill="#ff8a3d"/><path d="M2 -52 C16 -38 22 -28 22 -18 A22 22 0 0 1 -22 -18 C-22 -30 -12 -40 2 -52 Z" fill="#ffd166"/></g>`;

const heartClip = (x = 62, y = -78, s = 0.42, c = '#ff5e7e') => `<path d="${heartD}" fill="${c}" transform="translate(${x} ${y}) scale(${s}) rotate(14)"/>`;
const balloon = () => `<path d="M62 158 C96 100 96 10 126 -96" stroke="#efeaff" stroke-width="3" fill="none"/><g transform="translate(128 -150) scale(1.7)"><path d="${heartD}" fill="#ff5e7e"/><path d="${heartD}" fill="none" stroke="#c2185b" stroke-width="2" opacity=".35"/><ellipse cx="-18" cy="-22" rx="8" ry="5" fill="#ffffff" opacity=".55" transform="rotate(-30 -18 -22)"/><path d="M-4 30 L4 30 L0 36 Z" fill="#c2185b"/></g>`;

const bunnyBand = () => `<path d="M-80 -30 C-82 -96 82 -96 80 -30" fill="none" stroke="#f4f1ff" stroke-width="9" stroke-linecap="round"/><g transform="translate(-28 -128) rotate(-12)"><ellipse rx="17" ry="48" fill="#f4f1ff"/><ellipse rx="8" ry="35" fill="#ffb3c6"/></g><g transform="translate(28 -128) rotate(14)"><ellipse rx="17" ry="48" fill="#f4f1ff"/><ellipse rx="8" ry="35" fill="#ffb3c6"/></g>`;
const egg = (x, y, c, d, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 -22 C12 -22 18 -6 18 4 A18 18 0 0 1 -18 4 C-18 -6 -12 -22 0 -22 Z" fill="${c}"/><path d="M-17 0 l6 5 6 -5 5 5 5 -5 6 5 6 -5" stroke="${d}" stroke-width="3" fill="none" stroke-linejoin="round"/></g>`;
const basket = (P) => `<path d="M-50 132 C-50 72 50 72 50 132" stroke="#a87436" stroke-width="9" fill="none"/>${egg(-28, 124, '#9be3c6', '#3ea57c')}${egg(2, 116, '#ffd166', '#e8701f')}${egg(30, 124, '#ff9fb8', '#c2185b')}<path d="M-62 130 H62 L50 188 H-50 Z" fill="#c48f45"/><path d="M-58 148 H58 M-54 166 H54" stroke="#a87436" stroke-width="4"/><path d="M-30 130 L-24 188 M0 130 V188 M30 130 L24 188" stroke="#a87436" stroke-width="3"/>${paws(P, 140, 64)}`;
const flower = (x, y) => `<g transform="translate(${x} ${y})">${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="0" cy="-9" rx="6" ry="9" fill="#f4f1ff" transform="rotate(${a})"/>`).join('')}<circle r="5" fill="#ffd166"/></g>`;

const partyHat = (c = '#8b6bff') => `<g transform="translate(22 -78) rotate(14)"><path d="M-42 0 L0 -122 L42 0 Z" fill="${c}"/><path d="M-30 -34 L30 -34 L26 -46 L-26 -46 Z M-16 -76 L16 -76 L12 -88 L-12 -88 Z" fill="#ffd166"/><path d="M-46 0 Q0 12 46 0" stroke="#ffd166" stroke-width="8" fill="none" stroke-linecap="round"/><circle cx="0" cy="-124" r="13" fill="#ffd166"/><path d="M-10 -136 L-16 -146 M10 -136 L16 -146 M0 -138 V-150" stroke="#ffd166" stroke-width="3" stroke-linecap="round"/></g>`;
const burst = (x, y, r, c) => `<g transform="translate(${x} ${y})" stroke="${c}" stroke-width="4" stroke-linecap="round">${Array.from({ length: 10 }, (_, i) => {
  const a = (i / 10) * Math.PI * 2;
  const p = (k) => (Math.round(Math.cos(a) * k * 10) / 10) + ' ' + (Math.round(Math.sin(a) * k * 10) / 10);
  return `<path d="M${p(r * 0.45)} L${p(r)}"/>`;
}).join('')}<circle r="4" fill="${c}" stroke="none"/></g>`;
const sparkler = (P) => `<path d="M62 168 L108 44" stroke="#a99fe0" stroke-width="5" stroke-linecap="round"/>${burst(112, 36, 26, '#ffd166')}${paws(P)}`;

/** The costume layers for one pack member in one season. */
function costume(season, who, P) {
  const lead = who === 'luna';
  switch (season) {
    case 'halloween': {
      if (who === 'fang' || who === 'moss') return { hat: batBand() };
      if (who === 'ember') return { hat: witchHat('#3a2a6e', '#2a1f55', '#3ee6a0'), held: `${pumpkin(0, 150, 1.2)}${paws(P, 150, 52)}` };
      if (lead) return { hat: witchHat(), held: `${pumpkin(0, 150, 1.35)}${paws(P, 146, 56)}`, back: `<g fill="#241a45">${[[-160, -150, 0.9], [150, -200, 0.7], [170, -60, 0.55]].map(([x, y, s]) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 4 C-14 -14 -42 -20 -66 -10 C-56 -4 -54 4 -58 12 C-46 8 -36 10 -28 18 C-22 10 -12 8 0 12 C12 8 22 10 28 18 C36 10 46 8 58 12 C54 4 56 -4 66 -10 C42 -20 14 -14 0 4 Z"/>`).join('')}</g>` };
      return { hat: who === 'nova' ? witchHat('#4b2b7a', '#36205e', '#ffd166') : witchHat() };
    }
    case 'christmas':
      return { hat: winterHat(), neck: scarf(who === 'nova' || who === 'moss' ? '#3ea57c' : '#d9434f'), ...(lead ? { held: gift(P), back: snow() } : {}) };
    case 'carnival':
      return { face: eyeMask(['#8b6bff', '#ff7eb3', '#3ee6a0', '#ffd166', '#8b6bff', '#ff8a3d'][Object.keys(PACK).indexOf(who)]), ...(lead ? { hat: plume(), back: confetti(), held: streamer(P) } : {}) };
    case 'junina':
      return { hat: strawHat(), neck: bandana(who), ...(lead ? { front: bonfire(150, 228) } : {}) };
    case 'valentine':
      return { face: heartClip(), ...(lead ? { back: balloon() } : {}) };
    case 'easter':
      return { hat: bunnyBand(), ...(lead ? { held: basket(P), front: `${flower(-150, 230)}${flower(-120, 244)}${flower(140, 236)}` } : {}) };
    case 'newyear':
      return { hat: partyHat(['#8b6bff', '#3ea57c', '#ff7eb3', '#e8701f', '#3d6fd9', '#d9434f'][Object.keys(PACK).indexOf(who)]), ...(lead ? { held: sparkler(P), back: `${burst(-160, -170, 44, '#ff7eb3')}${burst(150, -200, 36, '#3ee6a0')}${burst(-150, 20, 26, '#ffd166')}` } : {}) };
    default:
      return {};
  }
}

/** A pack member in costume. Luna is drawn on a square canvas for the app. */
export function costumed(season, who) {
  const P = { ...PAL.dark, ...FURS[PACK[who]] };
  const opts = who === 'luna' ? { headset: true } : PROPS[who];
  const art = figure(PACK[who], { ...opts, costume: costume(season, who, P) });
  const shadow = '<ellipse cx="0" cy="254" rx="96" ry="12" fill="#000" opacity=".22"/>';
  return who === 'luna' ? doc('-256 -250 512 512', 512, 512, `${shadow}${art}`) : doc('-150 -250 300 520', 300, 520, `${shadow}${art}`);
}

// ---------- Icons (32 by 32: line L, tint F, accent A) ----------

const batWing = 'M16 12 C12 8 6 8 2 11 C4 12 5 14 4 17 C7 16 9 17 10 19 C11 17 13 16 16 17 C19 16 21 17 22 19 C23 17 25 16 28 17 C27 14 28 12 30 11 C26 8 20 8 16 12 Z';

export const SEASON_ICONS = {
  halloween: {
    pumpkin: (L, F, A) => `<path d="M16 9c-7 0-12 4-12 10s5 10 12 10 12-4 12-10-5-10-12-10Z" fill="${F}" stroke="${L}"/><path d="M16 9c-3 4-3 16 0 20M16 9c3 4 3 16 0 20" stroke="${L}" stroke-width="1.6"/><path d="M16 9c0-3 1-5 3-6" stroke="${L}"/><path d="M9.5 17l2.5-3 2.5 3ZM17.5 17l2.5-3 2.5 3Z" fill="${A}" stroke="${A}" stroke-width="1"/><path d="M10.5 22c2.5 2.5 8.5 2.5 11 0" stroke="${A}"/>`,
    bat: (L, F, A) => `<path d="${batWing}" fill="${F}" stroke="${L}"/><circle cx="16" cy="13" r="3.4" fill="${L}"/><path d="M14 11l-1-3.5 2.4 1.8M18 11l1-3.5-2.4 1.8" stroke="${L}" stroke-width="1.6"/><circle cx="15" cy="13" r=".9" fill="${A}"/><circle cx="17" cy="13" r=".9" fill="${A}"/>`,
    ghost: (L, F, A) => `<path d="M8 28V14a8 8 0 0 1 16 0v14l-2.7-2.2-2.6 2.2-2.7-2.2-2.7 2.2-2.6-2.2Z" fill="${F}" stroke="${L}"/><ellipse cx="13" cy="15" rx="1.4" ry="2" fill="${L}"/><ellipse cx="19" cy="15" rx="1.4" ry="2" fill="${L}"/><ellipse cx="16" cy="20" rx="1.6" ry="1.9" fill="${A}"/>`,
    moon: (L, F, A) => `<path d="M21 4a12 12 0 1 0 7 17A10 10 0 0 1 21 4Z" fill="${F}" stroke="${L}"/><path d="M5 9c1.5-1.6 3-1.6 4 0 1-1.6 2.5-1.6 4 0-1.6.2-3 1.4-4 3-1-1.6-2.4-2.8-4-3Z" fill="${A}" stroke="${A}" stroke-width="1"/>`,
  },
  christmas: {
    gift: (L, F, A) => `<rect x="5" y="13" width="22" height="15" rx="2" fill="${F}" stroke="${L}"/><rect x="3.5" y="9" width="25" height="5" rx="1.5" fill="${F}" stroke="${L}"/><path d="M16 9v19" stroke="${A}"/><path d="M16 9c-2-4-7-5-7-2 0 2 4 2 7 2Zm0 0c2-4 7-5 7-2 0 2-4 2-7 2Z" stroke="${A}" stroke-width="1.8"/>`,
    snowflake: (L, F, A) => `<circle cx="16" cy="16" r="12" fill="${F}"/><path d="M16 4v24M5.6 10l20.8 12M5.6 22l20.8-12" stroke="${L}"/><path d="M13 6.5l3 2.5 3-2.5M13 25.5l3-2.5 3 2.5M6 14l3.5-1-1-3.5M26 18l-3.5 1 1 3.5M6 18l3.5 1-1 3.5M26 14l-3.5-1 1-3.5" stroke="${L}" stroke-width="1.6"/><circle cx="16" cy="16" r="2.2" fill="${A}"/>`,
    tree: (L, F, A) => `<path d="M16 4 8 15h4.5L6 24h20l-6.5-9H24Z" fill="${F}" stroke="${L}"/><path d="M16 24v4" stroke="${L}"/><circle cx="13" cy="19" r="1.4" fill="${A}"/><circle cx="19" cy="14" r="1.4" fill="${A}"/><circle cx="20" cy="21" r="1.4" fill="${A}"/><path d="M16 1.8l.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3Z" fill="${A}" stroke="${A}" stroke-width="1"/>`,
    bell: (L, F, A) => `<path d="M8 23c2-2.5 2-6 2-9a6 6 0 0 1 12 0c0 3 0 6.5 2 9Z" fill="${F}" stroke="${L}"/><path d="M6.5 23h19M16 5v3" stroke="${L}"/><circle cx="16" cy="26" r="2.4" fill="${A}"/><path d="M11 12c1-2 2-3 4-3.5" stroke="${A}" stroke-width="1.8"/>`,
  },
  carnival: {
    mask: (L, F, A) => `<path d="M3 12c4-3 9-2 13 1 4-3 9-4 13-1 0 6-3 10-8 10-3 0-4-2-5-4-1 2-2 4-5 4-5 0-8-4-8-10Z" fill="${F}" stroke="${L}"/><ellipse cx="10" cy="15" rx="2.6" ry="2" fill="${L}"/><ellipse cx="22" cy="15" rx="2.6" ry="2" fill="${L}"/><path d="M25 10c1-3 3-6 5-7M22 10c0-3 1-6 3-8" stroke="${A}"/>`,
    confetti: (L, F, A) => `<path d="M4 28 12 6l14 14Z" fill="${F}" stroke="${L}"/><path d="M8 17l5 5M10 11l8 8" stroke="${L}" stroke-width="1.6"/><path d="M20 5l2-2M26 9l3-1M24 13l3 2" stroke="${A}"/><circle cx="18" cy="9" r="1.3" fill="${A}"/><circle cx="28" cy="4" r="1.3" fill="${L}"/>`,
    streamer: (L, F, A) => `<circle cx="9" cy="9" r="5.5" fill="${F}" stroke="${L}"/><circle cx="9" cy="9" r="2" fill="${L}"/><path d="M13 13c3 3 1 6 4 8s6-1 8 2 0 5 2 6" stroke="${A}"/><rect x="20" y="4" width="4" height="2.5" rx="1" fill="${A}" transform="rotate(30 22 5)"/><rect x="4" y="22" width="4" height="2.5" rx="1" fill="${L}" transform="rotate(-20 6 23)"/>`,
  },
  junina: {
    bonfire: (L, F, A) => `<path d="M6 28l20-5M26 28 6 23" stroke="${L}"/><path d="M16 4c5 5 7 9 7 12a7 7 0 0 1-14 0c0-3 1.6-5 3-6 0 2 1 3 2 3-.2-3 0-6 2-9Z" fill="${F}" stroke="${L}"/><path d="M16 13c2 2 3 3.5 3 5a3 3 0 0 1-6 0c0-1.5 1-3 3-5Z" fill="${A}"/>`,
    flags: (L, F, A) => `<path d="M2 6c8 4 20 4 28 0" stroke="${L}"/><path d="M5 7.4l1.6 8.6 4.4-6.4Z" fill="${A}" stroke="${L}" stroke-width="1.6"/><path d="M13.5 9.6l1.6 8.4 4.3-8.2Z" fill="${F}" stroke="${L}" stroke-width="1.6"/><path d="M21.8 9l2.4 8.4 3.4-9.6Z" fill="${A}" stroke="${L}" stroke-width="1.6"/><path d="M8 24c3-2 5-2 8 0s5 2 8 0" stroke="${L}" stroke-width="1.6"/>`,
    hat: (L, F, A) => `<path d="M3 21c0 2 6 4 13 4s13-2 13-4-6-4-13-4-13 2-13 4Z" fill="${F}" stroke="${L}"/><path d="M9.5 20c0-6 3-9 6.5-9s6.5 3 6.5 9" fill="${F}" stroke="${L}"/><path d="M9.6 18c4 1.6 9 1.6 12.8 0" stroke="${A}" stroke-width="2.6"/>`,
  },
  valentine: {
    heart: (L, F, A) => `<path d="M16 27S4 20 4 12a6 6 0 0 1 12-2 6 6 0 0 1 12 2c0 8-12 15-12 15Z" fill="${F}" stroke="${L}"/><path d="M9 11a3 3 0 0 1 3-2.5" stroke="${A}"/>`,
    letter: (L, F, A) => `<rect x="3" y="8" width="26" height="18" rx="3" fill="${F}" stroke="${L}"/><path d="M4 10l12 9 12-9" stroke="${L}"/><path d="M16 24s-4-2.4-4-5a2 2 0 0 1 4-.6 2 2 0 0 1 4 .6c0 2.6-4 5-4 5Z" fill="${A}" stroke="${A}" stroke-width="1.2"/>`,
    balloon: (L, F, A) => `<path d="M16 20S7 15 7 9a4.5 4.5 0 0 1 9-1.5A4.5 4.5 0 0 1 25 9c0 6-9 11-9 11Z" fill="${F}" stroke="${L}"/><path d="M16 20c-2 3 2 5 0 9" stroke="${L}" stroke-width="1.6"/><path d="M11 9a2.4 2.4 0 0 1 2-2" stroke="${A}"/>`,
  },
  easter: {
    egg: (L, F, A) => `<path d="M16 4c5 0 9 8 9 15a9 9 0 0 1-18 0c0-7 4-15 9-15Z" fill="${F}" stroke="${L}"/><path d="M7.5 17.5l3 2 3-2 2.5 2 2.5-2 3 2 3-2" stroke="${A}"/><circle cx="13" cy="11" r="1.3" fill="${L}"/><circle cx="19" cy="12" r="1.3" fill="${L}"/><circle cx="16" cy="24" r="1.3" fill="${L}"/>`,
    basket: (L, F, A) => `<path d="M8 15c0-8 16-8 16 0" stroke="${L}"/><ellipse cx="12" cy="14" rx="3" ry="3.8" fill="${A}"/><ellipse cx="19.5" cy="13.5" rx="3" ry="3.8" fill="${F}" stroke="${L}" stroke-width="1.6"/><path d="M4 16h24l-3 11H7Z" fill="${F}" stroke="${L}"/><path d="M6 20.5h20" stroke="${L}" stroke-width="1.6"/>`,
    flower: (L, F, A) => `<path d="M16 22v8M16 26c-3 0-5-2-6-4 3 0 5 1 6 4Z" stroke="${L}"/>${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="16" cy="7" rx="3.4" ry="4.6" fill="${F}" stroke="${L}" stroke-width="1.6" transform="rotate(${a} 16 13)"/>`).join('')}<circle cx="16" cy="13" r="3" fill="${A}"/>`,
  },
  newyear: {
    firework: (L, F, A) => `<circle cx="16" cy="14" r="11" fill="${F}"/><path d="M16 3v5M16 20v5M5 14h5M22 14h5M8.2 6.2l3.5 3.5M20.3 18.3l3.5 3.5M23.8 6.2l-3.5 3.5M11.7 18.3l-3.5 3.5" stroke="${L}"/><circle cx="16" cy="14" r="2.4" fill="${A}"/><path d="M16 25v5" stroke="${A}"/>`,
    clock: (L, F, A) => `<circle cx="16" cy="17" r="11" fill="${F}" stroke="${L}"/><path d="M16 17V9.5M16 17l-1.5-5" stroke="${L}"/><circle cx="16" cy="17" r="1.8" fill="${A}"/><path d="M10 3.5l-3 2.5M22 3.5l3 2.5" stroke="${A}"/>`,
    hat: (L, F, A) => `<path d="M16 4 7 27h18Z" fill="${F}" stroke="${L}"/><path d="M12 15h8M10 21h12" stroke="${A}" stroke-width="2.6"/><circle cx="16" cy="3.5" r="2.2" fill="${A}"/>`,
  },
};

export const SEASON_ICON_COLORS = {
  light: { L: '#2b2155', F: '#ddd3ff', A: '#ff7a33' },
  dark: { L: '#efeaff', F: '#4b3c9e', A: '#ff9a4d' },
};
const iconBody = (fn, L, F, A) => `<g fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${fn(L, F, A)}</g>`;
export const seasonIconFile = (s, n, theme) => {
  const c = SEASON_ICON_COLORS[theme];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">${iconBody(SEASON_ICONS[s][n], c.L, c.F, c.A)}</svg>\n`;
};
/** Sprite symbols #s-<season>-<name>, following the page theme. */
export const seasonSymbols = () =>
  Object.entries(SEASON_ICONS)
    .flatMap(([s, set]) => Object.entries(set).map(([n, fn]) => `<symbol id="s-${s}-${n}" viewBox="0 0 32 32">${iconBody(fn, 'currentColor', 'var(--ic-f)', 'var(--ic-a)')}</symbol>`))
    .join('');
/** The icon the chip shows for each season. */
export const CHIP_ICON = { halloween: 'pumpkin', christmas: 'tree', carnival: 'mask', junina: 'bonfire', valentine: 'heart', easter: 'egg', newyear: 'firework' };

// ---------- Hero accents: a garland across the top of the hero ----------

const W = 1200;
const H = 130;
/** Points along the sagging string: two swoops across the width. */
function along(n, sag = 45, top = 12) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const half = t < 0.5 ? t * 2 : (t - 0.5) * 2;
    const x0 = t < 0.5 ? 0 : W / 2;
    const x = x0 + half * (W / 2);
    const y = top + 4 * sag * half * (1 - half);
    const slope = (4 * sag * (1 - 2 * half)) / (W / 2);
    pts.push([Math.round(x), Math.round(y), Math.round((Math.atan(slope) * 180) / Math.PI)]);
  }
  return pts;
}
/** A small seeded random generator, so the art is the same on every build. */
const rng = (seed) => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const string = (c, sag = 45, top = 12) => `<path d="M0 ${top} Q${W / 4} ${top + 2 * sag} ${W / 2} ${top} Q${(W * 3) / 4} ${top + 2 * sag} ${W} ${top}" fill="none" stroke="${c}" stroke-width="2.4"/>`;

const ACCENT_TONE = {
  light: { str: '#6b5fa6', ink: '#2b2155', bat: '#2f2360', glow: 0.35 },
  dark: { str: '#a99fe0', ink: '#efeaff', bat: '#3b2d80', glow: 0.6 },
};

function web(c) {
  const rays = [0, 18, 36, 54, 72, 90].map((a) => {
    const r = (a * Math.PI) / 180;
    return `M0 0 L${Math.round(Math.cos(r) * 130)} ${Math.round(Math.sin(r) * 130)}`;
  });
  const rings = [40, 72, 104].map((k) => {
    const pts = [0, 18, 36, 54, 72, 90].map((a) => {
      const r = (a * Math.PI) / 180;
      return `${Math.round(Math.cos(r) * k)} ${Math.round(Math.sin(r) * k)}`;
    });
    return `M${pts.join(' L')}`;
  });
  return `<path d="${rays.join(' ')} ${rings.join(' ')}" fill="none" stroke="${c}" stroke-width="1.6" opacity=".55"/>`;
}

export function heroAccent(season, theme) {
  const T = ACCENT_TONE[theme];
  let body = '';
  switch (season) {
    case 'halloween': {
      body = string(T.str, 45);
      body += along(9, 45).map(([x, y, r], i) => (i % 2
        ? `<g transform="translate(${x} ${y + 4}) rotate(${r})"><path d="M0 0v8" stroke="${T.str}" stroke-width="2"/>${pumpkin(0, 26, 0.38)}</g>`
        : `<g transform="translate(${x} ${y}) rotate(${r})"><path d="M0 0v8" stroke="${T.str}" stroke-width="2"/><g transform="translate(0 22) scale(.55)"><path d="M0 4 C-14 -14 -42 -20 -66 -10 C-56 -4 -54 4 -58 12 C-46 8 -36 10 -28 18 C-22 10 -12 8 0 12 C12 8 22 10 28 18 C36 10 46 8 58 12 C54 4 56 -4 66 -10 C42 -20 14 -14 0 4 Z" fill="${T.bat}"/><circle cx="0" cy="2" r="11" fill="${T.bat}"/><circle cx="-4" cy="1" r="2.6" fill="#ff8a3d"/><circle cx="4" cy="1" r="2.6" fill="#ff8a3d"/></g></g>`)).join('');
      body += `<g transform="translate(0 0)">${web(T.ink)}</g><g transform="translate(${W} 0) scale(-1 1)">${web(T.ink)}</g>`;
      body += `<path d="M1090 0 V70" stroke="${T.ink}" stroke-width="1.4" opacity=".6"/><g transform="translate(1090 78)"><ellipse rx="9" ry="11" fill="${T.bat}"/><circle cy="-11" r="6" fill="${T.bat}"/><path d="M-8 -4 L-20 -12 M-8 2 L-22 0 M-8 8 L-18 16 M8 -4 L20 -12 M8 2 L22 0 M8 8 L18 16" stroke="${T.bat}" stroke-width="2.4" stroke-linecap="round"/><circle cx="-2.4" cy="-12" r="1.6" fill="#ff8a3d"/><circle cx="2.4" cy="-12" r="1.6" fill="#ff8a3d"/></g>`;
      break;
    }
    case 'christmas': {
      const cols = ['#ff5e7e', '#ffd166', '#3ee6a0', '#8b6bff', '#ff8a3d'];
      body = string(T.str, 45) + along(16, 45).map(([x, y, r], i) => `<g transform="translate(${x} ${y}) rotate(${r})"><circle cy="20" r="16" fill="${cols[i % 5]}" opacity="${T.glow * 0.5}"/><rect x="-4" y="1" width="8" height="7" rx="1.5" fill="${T.ink}" opacity=".7"/><ellipse cy="18" rx="6.5" ry="10" fill="${cols[i % 5]}"/><ellipse cx="-2" cy="14" rx="1.6" ry="3" fill="#fff" opacity=".6"/></g>`).join('');
      body += [36, W - 36].map((x) => `<g transform="translate(${x} 4)"><path d="M0 0 L-20 26 H-10 L-26 50 H-12 L-30 76 H30 L12 50 H26 L10 26 H20 Z" fill="#2f9e6f"/><path d="M0 0 L-20 26 H-10 L-26 50 H-12 L-30 76 H0 Z" fill="#3ea57c"/><rect x="-5" y="76" width="10" height="10" fill="#7a4e3b"/><path d="M0 -10 l3 6 7 1 -5 5 1 7 -6 -3 -6 3 1 -7 -5 -5 7 -1 Z" fill="#ffd166"/><circle cx="-10" cy="44" r="3" fill="#ff5e7e"/><circle cx="12" cy="62" r="3" fill="#ffd166"/><circle cx="6" cy="30" r="3" fill="#8b6bff"/></g>`).join('');
      break;
    }
    case 'carnival': {
      const cols = ['#ff7eb3', '#ffd166', '#3ee6a0', '#8b6bff', '#ff8a3d'];
      body = `<path d="M0 24 C120 70 220 0 340 40 S560 80 680 32 S900 0 1020 48 S1160 64 1200 32" fill="none" stroke="#ff7eb3" stroke-width="5" stroke-linecap="round"/><path d="M0 56 C140 16 260 90 400 48 S640 8 760 56 S1000 90 1200 40" fill="none" stroke="#ffd166" stroke-width="5" stroke-linecap="round"/>`;
      const r = rng(7);
      for (let i = 0; i < 42; i++) {
        const x = Math.round(r() * W);
        const y = Math.round(10 + r() * 105);
        body += i % 3 ? `<rect x="${x}" y="${y}" width="12" height="7" rx="2" fill="${cols[i % 5]}" transform="rotate(${(i * 37) % 180} ${x} ${y})"/>` : `<circle cx="${x}" cy="${y}" r="4.5" fill="${cols[i % 5]}"/>`;
      }
      break;
    }
    case 'junina': {
      const cols = ['#ff5e3a', '#ffd166', '#3ea57c', '#3d6fd9', '#ff7eb3', '#8b6bff'];
      body = string(T.str, 40) + along(22, 40).map(([x, y, r], i) => `<path transform="translate(${x} ${y}) rotate(${r})" d="M-17 0 H17 L13 34 L0 26 L-13 34 Z" fill="${cols[i % 6]}"/>`).join('');
      body += string(T.str, 30, 56).replace('stroke-width="2.4"', 'stroke-width="2" opacity=".7"') + along(18, 30, 56).map(([x, y, r], i) => `<path transform="translate(${x} ${y}) rotate(${r})" d="M-14 0 H14 L11 28 L0 21 L-11 28 Z" fill="${cols[(i + 3) % 6]}" opacity=".85"/>`).join('');
      break;
    }
    case 'valentine': {
      body = string(T.str, 45) + along(13, 45).map(([x, y, r], i) => `<g transform="translate(${x} ${y}) rotate(${r})"><path d="M0 0v8" stroke="${T.str}" stroke-width="2"/><path d="${heartD}" transform="translate(0 30) scale(${i % 2 ? 0.42 : 0.55})" fill="${i % 3 ? '#ff5e7e' : '#ff9fb8'}"/></g>`).join('');
      break;
    }
    case 'easter': {
      const cols = [['#9be3c6', '#3ea57c'], ['#ffd166', '#e8701f'], ['#ff9fb8', '#c2185b'], ['#cdbdff', '#6a45f5']];
      body = string(T.str, 45) + along(14, 45).map(([x, y, r], i) => `<g transform="translate(${x} ${y}) rotate(${r})"><path d="M0 0v8" stroke="${T.str}" stroke-width="2"/>${egg(0, 30, cols[i % 4][0], cols[i % 4][1], 0.9)}</g>`).join('');
      body += `${flower(40, 30)}${flower(70, 18)}${flower(W - 40, 30)}${flower(W - 72, 18)}`;
      break;
    }
    case 'newyear': {
      const c = theme === 'light' ? ['#e8a400', '#e0457f', '#139e6a', '#6a45f5'] : ['#ffd166', '#ff7eb3', '#3ee6a0', '#cdbdff'];
      body = `${burst(150, 62, 50, c[0])}${burst(420, 40, 32, c[1])}${burst(760, 66, 44, c[2])}${burst(1050, 48, 38, c[3])}`;
      const r = rng(11);
      for (let i = 0; i < 26; i++) {
        const x = Math.round(r() * W);
        const y = Math.round(10 + r() * 105);
        body += `<path transform="translate(${x} ${y}) scale(${0.4 + (i % 3) * 0.2})" d="M0 -10 L2.5 -2.5 L10 0 L2.5 2.5 L0 10 L-2.5 2.5 L-10 0 L-2.5 -2.5 Z" fill="${i % 2 ? c[0] : T.ink}" opacity=".85"/>`;
      }
      break;
    }
    default:
  }
  return doc(`0 0 ${W} ${H}`, W, H, body);
}

/** Every file the seasons add, keyed by repository path. */
export function seasonFiles() {
  const files = {};
  for (const s of SEASON_IDS) {
    for (const who of Object.keys(PACK)) {
      const svg = costumed(s, who);
      files[`assets/seasons/${s}/${who}.svg`] = svg;
      files[`docs/assets/seasons/${s}/${who}.svg`] = svg;
    }
    for (const theme of ['light', 'dark']) {
      const h = heroAccent(s, theme);
      files[`assets/seasons/${s}/hero-${theme}.svg`] = h;
      files[`docs/assets/seasons/${s}/hero-${theme}.svg`] = h;
      for (const n of Object.keys(SEASON_ICONS[s])) {
        const f = seasonIconFile(s, n, theme);
        files[`assets/seasons/${s}/icons/${n}-${theme}.svg`] = f;
        files[`docs/assets/seasons/${s}/icons/${n}-${theme}.svg`] = f;
      }
    }
  }
  return files;
}
