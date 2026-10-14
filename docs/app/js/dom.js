// Tiny DOM helpers. Strings always become text nodes; there is no HTML parsing.

/**
 * Create an element.
 * h('button', { class: 'btn', onclick, 'aria-label': 'Close' }, 'text', child)
 */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value' || k === 'checked' || k === 'selected' || k === 'muted' || k === 'srcObject' || k === 'indeterminate') el[k] = v;
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  append(el, children);
  return el;
}

/** Append children, skipping null and false, turning strings into text. */
export function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false || c === '') continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

/** Replace all children. */
export function replace(el, ...children) {
  el.replaceChildren();
  return append(el, children);
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Run fn at most once per animation frame. */
export function frameThrottle(fn) {
  let queued = false;
  return () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fn();
    });
  };
}

/** Copy text to the clipboard, with a fallback for older browsers. */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = h('textarea', { style: { position: 'fixed', opacity: '0' } }, text);
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

/** Format a time for the message list. */
export function formatTime(ts, lang, { full = false } = {}) {
  const d = new Date(ts);
  const now = new Date();
  const time = d.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
  if (!full) return time;
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (ts >= day) return time;
  if (ts >= day - 86400000) return { yesterday: true, time };
  return `${d.toLocaleDateString(lang)} ${time}`;
}

/** Day label for date dividers. */
export function formatDay(ts, lang) {
  return new Date(ts).toLocaleDateString(lang, { year: 'numeric', month: 'long', day: 'numeric' });
}
