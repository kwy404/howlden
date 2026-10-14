// Original art for howlden: Luna the wolf, her pack, the icon set and the
// night scenes. Everything is drawn here as plain SVG strings, in a light
// (dusk) and a dark (night) palette, so the build can write standalone files
// to assets/ and docs/assets/ and inline the same shapes in the pages.

export const PAL = {
  light: {
    bg: '#f7f4ff', sky1: '#ddd3ff', sky2: '#f7f2ff', ink: '#221a4a', line: '#2b2155', soft: '#6b5fa6',
    fur: '#8f86c9', furD: '#6c61b0', furL: '#f1eeff', ear: '#ff9fb8', blush: '#ffb3c6',
    set: '#2d2552', setA: '#8b5cf6', glow: '#c9b8ff',
    fire: '#ff8a3d', fire2: '#ffd166', ember: '#ff5e3a', log: '#8a5a44', logD: '#6b4433',
    moon: '#fff4cf', moonD: '#f3e3a6', star: '#8d7fe0',
    hill1: '#cfc4f7', hill2: '#b1a2ec', hill3: '#8e7fdc', tree: '#6a5bc0', treeD: '#5546a8',
    denC: '#8576d8', scr: '#f1ecff', ring: '#1fbf86', paper: '#ffffff', paperD: '#e9e4fb', owl: '#b98a5e', owlD: '#8d6444', owlL: '#f3dfc4',
    rim: '#ffffff', edge: 'rgba(43,33,85,.18)', shade: 'rgba(43,33,85,.14)',
  },
  dark: {
    bg: '#0d0a1f', sky1: '#1b1545', sky2: '#0d0a1f', ink: '#efeaff', line: '#1a1338', soft: '#a99fe0',
    fur: '#9a91d6', furD: '#7469bd', furL: '#f3f0ff', ear: '#ff9fb8', blush: '#ff9fb8',
    set: '#241d47', setA: '#9b74ff', glow: '#cdbdff',
    fire: '#ff8a3d', fire2: '#ffd166', ember: '#ff5e3a', log: '#7a4e3b', logD: '#5c3a2c',
    moon: '#fff4cf', moonD: '#e9d79a', star: '#d9d0ff',
    hill1: '#2a2160', hill2: '#211a50', hill3: '#181240', tree: '#2f2670', treeD: '#251d5c',
    denC: '#3b3080', scr: '#2b2266', ring: '#3ee6a0', paper: '#f4f1ff', paperD: '#d8d0f5', owl: '#c99a6c', owlD: '#9a6f4c', owlL: '#f6e5cc',
    rim: '#efeaff', edge: 'rgba(0,0,0,.35)', shade: 'rgba(0,0,0,.28)',
  },
};

const num = (n) => String(Math.round(n * 100) / 100);

/**
 * A tiny drawing builder. Every shape is drawn in `art`; shapes that belong to
 * the outer outline are also kept in `sil`, so a sticker border can be drawn
 * behind the figure with one thick stroke.
 */
export function builder() {
  const art = [];
  const sil = [];
  return {
    art,
    sil,
    path(d, fill, { outline = true, extra = '' } = {}) {
      art.push(`<path d="${d}" fill="${fill}"${extra ? ` ${extra}` : ''}/>`);
      if (outline) sil.push(`<path d="${d}"/>`);
    },
    ellipse(cx, cy, rx, ry, fill, { outline = true, extra = '' } = {}) {
      const s = `cx="${num(cx)}" cy="${num(cy)}" rx="${num(rx)}" ry="${num(ry)}"`;
      art.push(`<ellipse ${s} fill="${fill}"${extra ? ` ${extra}` : ''}/>`);
      if (outline) sil.push(`<ellipse ${s}/>`);
    },
    line(d, stroke, w, { outline = false, extra = '' } = {}) {
      art.push(`<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${extra ? ` ${extra}` : ''}/>`);
      if (outline) sil.push(`<path d="${d}" fill="none" stroke-width="${w}"/>`);
    },
    raw(s, silS = '') {
      art.push(s);
      if (silS) sil.push(silS);
    },
    open(transform) {
      art.push(`<g transform="${transform}">`);
      sil.push(`<g transform="${transform}">`);
    },
    close() {
      art.push('</g>');
      sil.push('</g>');
    },
  };
}

/** The sticker: a rim colored border, a soft offset shadow and the figure. */
export function sticker(b, P, { rim = 18, shadow = true, edge = true } = {}) {
  const s = b.sil.join('');
  const sh = shadow ? `<g transform="translate(0 7)" fill="${P.shade}" stroke="${P.shade}" stroke-width="${rim * 2}" stroke-linejoin="round" stroke-linecap="round">${s}</g>` : '';
  const ed = edge ? `<g fill="${P.edge}" stroke="${P.edge}" stroke-width="${rim * 2 + 3}" stroke-linejoin="round" stroke-linecap="round">${s}</g>` : '';
  return `${sh}${ed}<g fill="${P.rim}" stroke="${P.rim}" stroke-width="${rim * 2}" stroke-linejoin="round" stroke-linecap="round">${s}</g>${b.art.join('')}`;
}

// ---------- Luna, howling into her headset mic ----------

/**
 * Luna sitting and howling, in a 512 by 512 box.
 * opts.eyes: 'closed' (default) or 'open'.
 */
export function lunaHowl(P, b = builder(), opts = {}) {
  const { head = -32, mouth = 'open', headset = true } = opts;
  P = { ...P, ...(opts.colors || {}) };
  const H = `translate(290 214) rotate(${head}) scale(1.08)`;
  // Tail, a fluffy curl behind her on the left.
  b.path('M196 452 C150 470 92 452 78 400 C68 362 86 326 112 322 C128 320 132 336 124 350 C114 372 124 398 150 410 C172 420 192 418 214 410 Z', P.furD);
  b.path('M112 322 C128 320 132 336 124 350 C118 362 118 374 122 384 C100 378 90 356 96 338 C100 328 106 323 112 322 Z', P.furL, { outline: false });
  // Body.
  b.path('M168 470 C140 420 150 340 214 296 C240 278 286 262 318 262 C350 300 364 360 356 412 C352 440 348 460 346 470 Z', P.fur);
  // Haunch and back shading.
  b.path('M150 470 C140 430 160 384 210 378 C254 374 278 410 270 470 Z', P.furD, { outline: false });
  b.path('M214 296 C200 320 192 346 196 370 C176 360 168 336 176 316 C186 304 198 298 214 296 Z', P.furD, { outline: false });
  // Chest fluff.
  // Front legs and paws.
  b.path('M284 380 C286 420 286 448 288 466 L322 466 C324 440 324 410 320 380 Z', P.fur);
  b.path('M318 384 C322 420 324 448 326 466 L356 466 C358 440 356 410 350 380 Z', P.fur);
  b.ellipse(304, 470, 28, 12, P.furL);
  b.ellipse(342, 470, 26, 12, P.furL);
  b.line('M296 466 v8 M308 466 v8 M334 466 v8 M346 466 v8', P.furD, 3);
  // Head, tilted up so the snout points at the sky.
  b.open(H);
  // Ears.
  b.path('M-44 -38 L-58 -122 L-2 -62 Z', P.fur);
  b.path('M-4 -58 L14 -132 L42 -50 Z', P.fur);
  b.path('M-38 -48 L-48 -104 L-14 -64 Z', P.ear, { outline: false });
  b.path('M6 -60 L16 -112 L32 -56 Z', P.ear, { outline: false });
  // Neck ruff, cranium and snout.
  b.path('M-70 20 C-90 60 -60 104 -10 112 C20 116 40 100 44 70 Z', P.fur);
  b.path('M34 36 C52 50 54 80 42 98 C30 114 6 118 -12 112 C8 96 22 70 34 36 Z', P.furL, { outline: false });
  b.path('M-64 -6 C-66 -50 -30 -74 6 -72 C46 -70 66 -46 72 -26 L148 -14 C160 -12 162 2 150 6 L70 16 C64 44 40 66 6 68 C-34 70 -62 40 -64 -6 Z', P.fur);
  // Lower jaw, open for the howl.
  b.path('M40 30 C74 34 112 32 140 22 C142 34 130 44 112 46 C84 50 54 46 40 30 Z', P.furL);
  if (mouth === 'open') {
    b.path('M70 16 L150 6 C150 14 146 18 140 22 C110 30 84 28 70 16 Z', P.line, { outline: false });
    b.path('M104 16 C118 14 132 14 140 18 C130 25 114 25 104 16 Z', P.ear, { outline: false });
  } else {
    b.line('M84 20 C104 22 124 18 142 12', P.line, 4);
  }
  // Face mask: light cheeks and muzzle.
  b.path('M-36 18 C-20 46 10 56 40 44 C56 36 64 22 70 14 L140 2 C120 -6 84 -8 56 -6 C30 -4 10 6 -36 18 Z', P.furL, { outline: false });
  b.path('M-10 -70 L4 -30 L18 -70 Z', P.furL, { outline: false });
  // Nose.
  b.path('M144 -22 C154 -24 162 -16 160 -6 C158 2 148 2 142 -4 C138 -10 138 -20 144 -22 Z', P.line, { outline: false });
  b.ellipse(150, -16, 3.6, 2.4, '#ffffff', { outline: false, extra: 'opacity=".6"' });
  // Eye.
  if (opts.eyes === 'open') {
    b.ellipse(34, -26, 9, 10, P.line, { outline: false });
    b.ellipse(37, -29, 3, 3, '#ffffff', { outline: false });
  } else {
    b.line('M20 -26 Q34 -40 48 -26', P.line, 6);
  }
  b.ellipse(30, 4, 12, 7, P.blush, { outline: false, extra: 'opacity=".75"' });
  b.close();
  if (opts.extraHead) opts.extraHead(b, H);
  // Throat and chest fluff, over the neck ruff.
  b.path('M322 252 C338 236 352 234 358 252 C364 290 362 330 357 358 C352 378 344 390 334 402 L328 386 L320 404 L313 388 L304 400 L302 382 C294 352 300 296 322 252 Z', P.furL, { outline: false });
  if (!headset) return b;
  b.open(H);
  // Headset: band over the head, cup over the ear, boom to the mouth.
  b.line('M-58 -4 C-64 -50 -38 -74 2 -73', P.set, 13, { outline: true });
  b.path('M-74 -10 C-74 -34 -42 -38 -38 -12 L-36 26 C-38 50 -72 48 -74 26 Z', P.set);
  b.path('M-66 -6 C-66 -22 -46 -24 -44 -8 L-44 22 C-46 36 -66 34 -66 20 Z', P.setA, { outline: false });
  b.ellipse(-55, 8, 6, 10, P.glow, { outline: false, extra: 'opacity=".8"' });
  b.line('M-48 40 C-30 88 70 92 130 56', P.set, 8, { outline: true });
  b.path('M122 44 C130 34 150 38 152 50 C154 62 140 70 130 66 C120 62 116 52 122 44 Z', P.set);
  b.ellipse(136, 53, 8, 7, P.fire, { outline: false });
  b.ellipse(134, 50, 3, 2.4, P.fire2, { outline: false });
  b.close();
  return b;
}

/** Sound waves leaving the mic. */
function howlWaves(P, x, y, rot = -34) {
  return `<g transform="translate(${x} ${y}) rotate(${rot})" fill="none" stroke="${P.setA}" stroke-width="9" stroke-linecap="round"><path d="M0 -26 Q16 0 0 26" opacity=".95"/><path d="M24 -44 Q50 0 24 44" opacity=".65"/><path d="M50 -60 Q84 0 50 60" opacity=".35"/></g>`;
}

/** The full mascot: Luna as a sticker with her howl. */
export function mascot(theme = 'light') {
  const P = PAL[theme];
  const b = lunaHowl(P);
  const glow = theme === 'dark' ? `<defs><radialGradient id="lg" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${P.setA}" stop-opacity=".35"/><stop offset="1" stop-color="${P.setA}" stop-opacity="0"/></radialGradient></defs><circle cx="256" cy="280" r="250" fill="url(#lg)"/>` : '';
  return svg(512, 512, `${glow}${sticker(b, P, { rim: 14 })}${howlWaves(P, 428, 100)}`, 'Luna the wolf howling into her headset mic');
}

// ---------- Luna, front facing head ----------

/** Luna's head facing front, centered on 0,0, about 200 units wide. */
export function lunaFace(P, b = builder(), opts = {}) {
  const { headset = true, eyes = 'open', fur = P.fur, furD = P.furD } = opts;
  // Ears.
  b.path('M-64 -28 L-84 -122 L-12 -66 Z', fur);
  b.path('M64 -28 L84 -122 L12 -66 Z', fur);
  b.path('M-57 -44 L-72 -104 L-28 -66 Z', P.ear, { outline: false });
  b.path('M57 -44 L72 -104 L28 -66 Z', P.ear, { outline: false });
  // Head with cheek tufts.
  b.path('M0 -74 C44 -74 74 -46 76 -10 L96 6 L76 14 L90 30 L64 38 C54 56 30 72 0 76 C-30 72 -54 56 -64 38 L-90 30 L-76 14 L-96 6 L-76 -10 C-74 -46 -44 -74 0 -74 Z', fur);
  b.path('M-66 -10 C-60 -50 -30 -70 0 -72 C-30 -60 -46 -30 -40 -4 Z', furD, { outline: false });
  b.path('M66 -10 C60 -50 30 -70 0 -72 C30 -60 46 -30 40 -4 Z', furD, { outline: false });
  // Light mask: forehead stripe, muzzle and cheeks.
  b.path('M-10 -72 L0 -26 L10 -72 Z', P.furL, { outline: false });
  b.path('M-74 14 C-60 8 -40 4 -26 6 C-14 -6 14 -6 26 6 C40 4 60 8 74 14 L62 36 C48 58 26 72 0 74 C-26 72 -48 58 -62 36 Z', P.furL, { outline: false });
  // Eyes.
  if (eyes === 'closed') {
    b.line('M-42 -14 Q-30 -26 -18 -14', P.line, 6);
    b.line('M18 -14 Q30 -26 42 -14', P.line, 6);
  } else {
    b.ellipse(-30, -14, 10, 11.5, P.line, { outline: false });
    b.ellipse(30, -14, 10, 11.5, P.line, { outline: false });
    b.ellipse(-26.5, -18, 3.6, 3.6, '#ffffff', { outline: false });
    b.ellipse(33.5, -18, 3.6, 3.6, '#ffffff', { outline: false });
  }
  b.ellipse(-46, 16, 11, 6.5, P.blush, { outline: false, extra: 'opacity=".7"' });
  b.ellipse(46, 16, 11, 6.5, P.blush, { outline: false, extra: 'opacity=".7"' });
  // Nose and smile.
  b.path('M-14 10 C-6 4 6 4 14 10 C12 22 6 26 0 27 C-6 26 -12 22 -14 10 Z', P.line, { outline: false });
  b.ellipse(-4, 11, 3.4, 2.2, '#ffffff', { outline: false, extra: 'opacity=".55"' });
  b.line('M0 27 V35 M-14 38 Q-7 46 0 36 Q7 46 14 38', P.line, 4.5);
  if (headset) {
    b.line('M-80 -8 C-84 -96 84 -96 80 -8', P.set, 12, { outline: true });
    b.path('M-100 -26 C-100 -40 -76 -42 -74 -26 L-72 18 C-74 32 -98 32 -100 18 Z', P.set);
    b.path('M-94 -20 C-94 -30 -80 -30 -79 -20 L-78 12 C-80 22 -94 22 -94 12 Z', P.setA, { outline: false });
    b.path('M100 -26 C100 -40 76 -42 74 -26 L72 18 C74 32 98 32 100 18 Z', P.set);
    b.path('M94 -20 C94 -30 80 -30 79 -20 L78 12 C80 22 94 22 94 12 Z', P.setA, { outline: false });
    b.line('M-86 30 C-82 58 -56 66 -30 58', P.set, 7, { outline: true });
    b.ellipse(-24, 56, 11, 9, P.set);
    b.ellipse(-22, 55, 5, 4, P.fire, { outline: false });
  }
  return b;
}

export function mascotHead(theme = 'light') {
  const P = PAL[theme];
  const b = builder();
  b.open('translate(128 140) scale(1)');
  lunaFace(P, b);
  b.close();
  return svg(256, 256, sticker(b, P, { rim: 10 }), 'Luna the wolf');
}

export function favicon() {
  const P = PAL.dark;
  const b = builder();
  b.open('translate(32 35) scale(.27)');
  lunaFace(P, b, { headset: true });
  b.close();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#1b1545"/><circle cx="47" cy="15" r="7" fill="${P.moon}" opacity=".9"/>${b.art.join('')}</svg>\n`;
}

// ---------- Helpers ----------

export function svg(w, h, body, title = '') {
  const t = title ? `<title>${title}</title>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img"${title ? ` aria-label="${title}"` : ''}>${t}${body}</svg>\n`;
}
