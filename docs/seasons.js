// Special dates for the howlden site and app. A classic script with no
// dependencies: it finds the season for the visitor's local date and sets
// data-season on <html> (and data-season-avail, even when switched off).
// ?season=<id> forces a season, ?season=off disables it. The off switch is
// stored per season in localStorage. Also importable in Node for tests.
(function (root) {
  const IDS = ['newyear', 'carnival', 'easter', 'valentine', 'junina', 'halloween', 'christmas'];
  const NAMES = {
    en: { newyear: 'New Year', carnival: 'Carnival', easter: 'Easter', valentine: "Valentine's", junina: 'Midsummer', halloween: 'Halloween', christmas: 'Christmas' },
    pt: { newyear: 'Ano Novo', carnival: 'Carnaval', easter: 'Páscoa', valentine: 'Dia dos Namorados', junina: 'Festa Junina', halloween: 'Halloween', christmas: 'Natal' },
  };
  const KEY = 'howlden:season-off:';
  const isPt = (lang) => /^pt-br\b/i.test(String(lang || ''));

  /** Easter Sunday (anonymous Gregorian algorithm), as a local date. */
  function easter(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(y, month - 1, day);
  }

  /** The season id for a date and a language, or '' when none applies. */
  function detect(date, lang) {
    const y = date.getFullYear(), m = date.getMonth(), d = date.getDate();
    const t = new Date(y, m, d).getTime();
    const at = (base, n) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + n).getTime();
    if ((m === 11 && d >= 30) || (m === 0 && d <= 2)) return 'newyear';
    const e = easter(y);
    if (t >= at(e, -50) && t <= at(e, -46)) return 'carnival';
    if (t >= at(e, -2) && t <= at(e, 0)) return 'easter';
    if ((m === 1 && d === 14) || (m === 5 && d === 12 && isPt(lang))) return 'valentine';
    if (m === 5 && d >= 13 && d <= 29) return 'junina';
    if (m === 9 && d >= 24) return 'halloween';
    if (m === 11 && d >= 18 && d <= 26) return 'christmas';
    return '';
  }

  const label = (id, lang) => (isPt(lang) ? NAMES.pt : NAMES.en)[id] || '';
  const store = () => {
    try {
      return root.localStorage || null;
    } catch {
      return null;
    }
  };
  const isOff = (id) => store()?.getItem(KEY + id) === '1';

  /** { id, avail, forced }: the active season after the query and the off switch. */
  function resolve(opts = {}) {
    const lang = opts.lang ?? root.navigator?.language ?? 'en';
    const q = /[?&]season=([a-z]+)/.exec(opts.search ?? root.location?.search ?? '');
    if (q) return q[1] === 'off' || !IDS.includes(q[1]) ? { id: '', avail: '', forced: true } : { id: q[1], avail: q[1], forced: true };
    const avail = detect(opts.date || new Date(), lang);
    return { id: avail && !isOff(avail) ? avail : '', avail, forced: false };
  }

  function apply() {
    const doc = root.document;
    if (!doc) return null;
    const r = resolve();
    const html = doc.documentElement;
    for (const [name, v] of [['data-season', r.id], ['data-season-avail', r.avail]]) {
      if (v) html.setAttribute(name, v);
      else html.removeAttribute(name);
    }
    root.dispatchEvent?.(new root.CustomEvent('howlden:season', { detail: r }));
    return r;
  }

  function setOff(id, off) {
    try {
      if (off) store()?.setItem(KEY + id, '1');
      else store()?.removeItem(KEY + id);
    } catch {
      // private mode: the switch lasts for this page only
    }
    const html = root.document?.documentElement;
    if (html) {
      if (off) html.removeAttribute('data-season');
      else html.setAttribute('data-season', id);
      root.dispatchEvent?.(new root.CustomEvent('howlden:season', { detail: { id: off ? '' : id, avail: id, forced: false } }));
    }
  }

  root.howldenSeasons = { IDS, easter, detect, label, isOff, resolve, apply, setOff };
  if (root.document) apply();
})(globalThis);
