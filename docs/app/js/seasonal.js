// The app side of special dates. The season itself comes from the shared
// script (docs/seasons.js), which sets data-season on <html>; this module
// only reads it and offers the seasonal reaction and sticker while it lasts.

import { BASE_REACTIONS, BASE_STICKERS, SEASONAL } from '../core/history.js';

/** The season showing right now, or ''. */
export function season() {
  const id = document.documentElement.dataset.season || '';
  return SEASONAL[id] ? id : '';
}

/** The season available today even if switched off, or ''. */
export function seasonAvailable() {
  const id = document.documentElement.dataset.seasonAvail || '';
  return SEASONAL[id] ? id : '';
}

/** "Halloween", "Festa Junina" or "Midsummer", in the app language. */
export function seasonLabel(id, lang) {
  return globalThis.howldenSeasons?.label(id, lang === 'pt' ? 'pt-BR' : 'en') || id;
}

/** Reactions that can be picked now: the base set plus the season's own. */
export function pickableReactions() {
  const s = season();
  return s ? [...BASE_REACTIONS, SEASONAL[s]] : BASE_REACTIONS;
}

/** Stickers that can be picked now: the base set plus the season's own. */
export function pickableStickers() {
  const s = season();
  return s ? [s, ...BASE_STICKERS] : BASE_STICKERS;
}

/** Turn the season off (or back on) on this device. */
export function setSeasonOff(id, off) {
  globalThis.howldenSeasons?.setOff(id, off);
}
