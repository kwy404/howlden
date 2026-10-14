// Generated avatars: a small creature face drawn from a seed string, made
// locally so nobody needs to upload a picture. The SVG only contains numbers
// and colors computed here, never text from the seed.

function hash(text) {
  let h = 0x811c9dc5;
  for (const ch of String(text)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

function rng(seed) {
  let s = hash(seed) || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

const hsl = (h, s, l) => `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%)`;

/** Avatar traits for a seed. */
export function avatarTraits(seed) {
  const r = rng(seed);
  const hue = Math.floor(r() * 360);
  return {
    hue,
    bg: hsl(hue, 55 + r() * 20, 46 + r() * 8),
    fur: hsl((hue + 150 + r() * 60) % 360, 20 + r() * 25, 78 + r() * 12),
    inner: hsl((hue + 330) % 360, 50, 70),
    ears: Math.floor(r() * 3),
    eyes: Math.floor(r() * 3),
    mark: Math.floor(r() * 3),
  };
}

/** SVG markup for a seed. */
export function avatarSvg(seed) {
  const t = avatarTraits(seed);
  const ears = [
    'M22 44 L28 14 L44 34 Z M78 44 L72 14 L56 34 Z',
    'M20 46 L22 18 L42 32 Z M80 46 L78 18 L58 32 Z',
    'M24 42 Q24 14 44 30 Z M76 42 Q76 14 56 30 Z',
  ][t.ears];
  const inner = [
    'M28 38 L30 22 L38 32 Z M72 38 L70 22 L62 32 Z',
    'M26 40 L27 25 L37 33 Z M74 40 L73 25 L63 33 Z',
    'M29 38 Q29 22 39 31 Z M71 38 Q71 22 61 31 Z',
  ][t.ears];
  const eyes = [
    '<circle cx="39" cy="54" r="4.5"/><circle cx="61" cy="54" r="4.5"/>',
    '<ellipse cx="39" cy="54" rx="5" ry="3.2"/><ellipse cx="61" cy="54" rx="5" ry="3.2"/>',
    '<path d="M33 55 Q39 49 45 55 M55 55 Q61 49 67 55" fill="none" stroke="#1d1b26" stroke-width="3" stroke-linecap="round"/>',
  ][t.eyes];
  const mark = [
    '',
    `<path d="M50 30 L44 44 L56 44 Z" fill="${t.bg}" opacity=".55"/>`,
    `<circle cx="34" cy="64" r="4" fill="${t.inner}" opacity=".7"/><circle cx="66" cy="64" r="4" fill="${t.inner}" opacity=".7"/>`,
  ][t.mark];
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
    `<rect width="100" height="100" fill="${t.bg}"/>` +
    `<path d="${ears}" fill="${t.fur}"/><path d="${inner}" fill="${t.inner}"/>` +
    `<path d="M22 50 Q22 30 50 30 Q78 30 78 50 Q78 72 50 84 Q22 72 22 50 Z" fill="${t.fur}"/>` +
    mark +
    `<g fill="#1d1b26">${eyes}</g>` +
    `<path d="M44 66 Q50 72 56 66 Q50 62 44 66 Z" fill="#1d1b26"/>` +
    `<path d="M50 70 L50 75 M46 76 Q50 79 54 76" fill="none" stroke="#1d1b26" stroke-width="2" stroke-linecap="round"/>` +
    `</svg>`
  );
}

/** A data URL for an img element. */
export function avatarUrl(seed) {
  return `data:image/svg+xml,${encodeURIComponent(avatarSvg(seed))}`;
}

/** A display color for a name. The page sets --name-l lower on light backgrounds. */
export function nameColor(seed) {
  return `hsl(${avatarTraits(seed).hue} 70% var(--name-l, 62%))`;
}
