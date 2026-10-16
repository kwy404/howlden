// One accessible menu for the whole app: context menus (right click, long
// press, the Menu key or Shift+F10) and menus opened from buttons.
//
// An item is one of:
//   { label, icon, run, danger, disabled, hint, keys }        a plain item
//   { label, checked, run }                                   a checkbox item
//   { label, checked, radio: true, run }                      a radio item
//   { label, icon, items: [...] | () => [...] }               a submenu
//   { range: { label, value, min, max, step, oninput, format } } a slider row
//   { row: [{ label, icon, run, pressed }] }                  a row of icon buttons
//   { heading: 'text' }                                       a small label
//   '-'                                                       a separator
//
// Keyboard: arrows move, Home and End jump, typing a letter jumps to the next
// item starting with it, Enter and Space run, Right opens a submenu, Left and
// Escape close one level, Tab closes everything. Menus flip and shift so they
// never leave the viewport.

import { h } from './dom.js';
import { icon } from './icons.js';

const EDGE = 8;
const stack = [];
let opener = null;
let lastOpen = 0;
let typed = '';
let typedAt = 0;
let hoverTimer = null;
// A press on the button that opened the open menu closes it, and the click that follows must not reopen it.
let guard = null;

const isItem = (el) => el && el.matches('[role^="menuitem"]') && el.getAttribute('aria-disabled') !== 'true';
const focusables = (menu) => [...menu.querySelectorAll(':scope > [role^="menuitem"], :scope > .menu-range input, :scope > .menu-row > button')].filter((el) => el.getAttribute('aria-disabled') !== 'true' && !el.disabled);

/** Stops for the up and down arrows: a row of buttons counts once (the focused one, or its first). */
function stops(menu) {
  const active = document.activeElement;
  return focusables(menu).filter((el) => !el.closest('.menu-row') || (el.closest('.menu-row').contains(active) ? el === active : el === el.parentNode.firstElementChild));
}

/** Where focus lands when a menu opens: the first real item, not the row of quick buttons. */
const firstStop = (menu) => focusables(menu).find((el) => !el.closest('.menu-row')) || focusables(menu)[0];

/** Whether a menu is open right now. */
export function menuOpen() {
  return stack.length > 0;
}

/** Close every open menu. Focus goes back to whatever opened the menu when asked. */
export function closeMenus({ restore = false } = {}) {
  clearTimeout(hoverTimer);
  while (stack.length) stack.pop().el.remove();
  document.removeEventListener('pointerdown', outside, true);
  document.removeEventListener('keydown', onKey, true);
  window.removeEventListener('resize', onWindow);
  window.removeEventListener('blur', onWindow);
  document.removeEventListener('wheel', onScroll, true);
  document.removeEventListener('touchmove', onScroll, true);
  const back = opener;
  opener = null;
  if (back?.anchor) back.anchor.setAttribute('aria-expanded', 'false');
  if (restore && back?.focus?.isConnected) back.focus.focus({ preventScroll: true });
  back?.onClose?.();
}

function closeFrom(level, { focusParent = true } = {}) {
  clearTimeout(hoverTimer);
  while (stack.length > level) {
    const m = stack.pop();
    m.el.remove();
    m.parentItem?.setAttribute('aria-expanded', 'false');
    if (focusParent && stack.length === level && m.parentItem) m.parentItem.focus({ preventScroll: true });
  }
}

function outside(e) {
  if (stack.some((m) => m.el.contains(e.target))) return;
  if (opener?.anchor?.contains(e.target)) {
    // A second press on the button that opened the menu closes it.
    guard = { anchor: opener.anchor, until: performance.now() + 600 };
    closeMenus();
    return;
  }
  closeMenus();
}

function onWindow() {
  closeMenus();
}

function onScroll(e) {
  if (stack.some((m) => m.el.contains(e.target))) return;
  // A finger still resting after a long press is not a scroll.
  if (e.type === 'touchmove' && performance.now() - lastOpen < 900) return;
  closeMenus();
}

function levelOf(el) {
  return stack.findIndex((m) => m.el.contains(el));
}

function onKey(e) {
  const top = stack[stack.length - 1];
  if (!top) return;
  const active = document.activeElement;
  let level = levelOf(active);
  if (level < 0) level = stack.length - 1;
  const menu = stack[level];
  menu.el.classList.remove('by-pointer');
  const list = stops(menu.el);
  const row = focusables(menu.el).filter((el) => el.closest('.menu-row'));
  const i = list.indexOf(active);
  const move = (to) => {
    e.preventDefault();
    e.stopPropagation();
    const next = list[(to + list.length) % list.length];
    next?.focus({ preventScroll: false });
    if (stack.length > level + 1) closeFrom(level + 1, { focusParent: false });
  };
  const inRange = active?.matches?.('.menu-range input');
  switch (e.key) {
    case 'ArrowDown':
      return move(i + 1);
    case 'ArrowUp':
      return move(i < 0 ? list.length - 1 : i - 1);
    case 'Home':
      return move(0);
    case 'End':
      return move(list.length - 1);
    case 'ArrowRight':
      if (inRange) return;
      if (active?.closest('.menu-row')) {
        e.preventDefault();
        return row[(row.indexOf(active) + 1) % row.length]?.focus();
      }
      if (active?.getAttribute('aria-haspopup') === 'menu') {
        e.preventDefault();
        e.stopPropagation();
        openSub(active, level, true);
      }
      return;
    case 'ArrowLeft':
      if (inRange) return;
      if (active?.closest('.menu-row')) {
        e.preventDefault();
        return row[(row.indexOf(active) - 1 + row.length) % row.length]?.focus();
      }
      if (level > 0) {
        e.preventDefault();
        e.stopPropagation();
        closeFrom(level);
      }
      return;
    case 'Escape':
      e.preventDefault();
      e.stopPropagation();
      if (level > 0) closeFrom(level);
      else closeMenus({ restore: true });
      return;
    case 'Tab':
      e.preventDefault();
      closeMenus({ restore: true });
      return;
    case 'Enter':
    case ' ':
      if (inRange) {
        if (e.key === 'Enter') {
          e.preventDefault();
          closeMenus({ restore: true });
        }
        return;
      }
      if (isItem(active) || active?.closest('.menu-row')) {
        e.preventDefault();
        e.stopPropagation();
        active.click();
      }
      return;
    default:
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && !inRange) {
        const now = performance.now();
        typed = now - typedAt > 600 ? e.key.toLowerCase() : typed + e.key.toLowerCase();
        typedAt = now;
        const items = focusables(menu.el).filter((el) => el.matches('[role^="menuitem"]'));
        const start = Math.max(0, items.indexOf(active));
        const order = [...items.slice(start + (typed.length === 1 ? 1 : 0)), ...items.slice(0, start + (typed.length === 1 ? 1 : 0))];
        const hit = order.find((el) => (el.dataset.label || el.textContent).trim().toLowerCase().startsWith(typed));
        if (hit) {
          e.preventDefault();
          e.stopPropagation();
          hit.focus();
        }
      }
  }
}

/** Place a menu at a point, flipping to the other side of the point when it does not fit. */
function place(el, { x, y, flipX = 0, flipY = 0 }) {
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  el.style.maxHeight = `${vh - EDGE * 2}px`;
  const w = el.offsetWidth;
  const hgt = el.offsetHeight;
  let left = x;
  let top = y;
  if (left + w > vw - EDGE) left = (flipX || x) - w;
  if (top + hgt > vh - EDGE) top = flipY ? flipY - hgt : vh - EDGE - hgt;
  el.style.left = `${Math.round(Math.max(EDGE, Math.min(left, vw - w - EDGE)))}px`;
  el.style.top = `${Math.round(Math.max(EDGE, Math.min(top, vh - hgt - EDGE)))}px`;
}

function build(items, level, label) {
  const el = h('div', { class: 'ctx-menu', role: 'menu', tabindex: '-1', 'aria-label': label || null, 'aria-orientation': 'vertical' });
  let prevSep = true;
  for (const it of items.filter(Boolean)) {
    if (it === '-') {
      if (!prevSep) el.append(h('div', { class: 'ctx-sep', role: 'separator' }));
      prevSep = true;
      continue;
    }
    prevSep = false;
    if (it.heading) {
      el.append(h('div', { class: 'ctx-heading', role: 'presentation' }, it.heading));
      continue;
    }
    if (it.range) {
      const r = it.range;
      const out = h('output', { class: 'ctx-range-val' }, r.format ? r.format(r.value) : `${r.value}%`);
      const input = h('input', {
        type: 'range',
        min: r.min ?? 0,
        max: r.max ?? 100,
        step: r.step ?? 1,
        value: r.value,
        'aria-label': r.label,
        style: { '--fill': `${((r.value - (r.min ?? 0)) / ((r.max ?? 100) - (r.min ?? 0))) * 100}%` },
        oninput: (e) => {
          const v = Number(e.target.value);
          out.textContent = r.format ? r.format(v) : `${v}%`;
          e.target.style.setProperty('--fill', `${((v - (r.min ?? 0)) / ((r.max ?? 100) - (r.min ?? 0))) * 100}%`);
          r.oninput(v);
        },
      });
      el.append(h('div', { class: 'menu-range', role: 'none' }, h('span', { class: 'ctx-range-head' }, h('span', null, r.label), out), input));
      continue;
    }
    if (it.row) {
      el.append(
        h(
          'div',
          { class: 'menu-row', role: 'group', 'aria-label': it.label || null },
          it.row.map((b) =>
            h(
              'button',
              {
                class: `ctx-row-btn${b.pressed ? ' on' : ''}`,
                type: 'button',
                tabindex: '-1',
                'aria-label': b.label,
                title: b.label,
                'aria-pressed': b.pressed == null ? null : String(!!b.pressed),
                onclick: () => {
                  closeMenus({ restore: !b.keepFocus });
                  b.run();
                },
              },
              b.node || icon(b.icon, { size: 20 }),
            ),
          ),
        ),
      );
      continue;
    }
    const sub = it.items;
    const role = it.checked == null ? 'menuitem' : it.radio ? 'menuitemradio' : 'menuitemcheckbox';
    const btn = h(
      'button',
      {
        class: `ctx-item${it.danger ? ' danger' : ''}${it.brand ? ' brand' : ''}`,
        type: 'button',
        role,
        tabindex: '-1',
        'aria-checked': it.checked != null ? String(!!it.checked) : null,
        'aria-disabled': it.disabled ? 'true' : null,
        'aria-haspopup': sub ? 'menu' : null,
        'aria-expanded': sub ? 'false' : null,
        dataset: { label: it.label },
        title: it.title || null,
      },
      it.icon ? icon(it.icon, { size: 18, cls: 'ctx-ico' }) : h('span', { class: 'ctx-ico blank', 'aria-hidden': 'true' }),
      h('span', { class: 'ctx-label' }, it.label, it.hint ? h('small', { class: 'ctx-hint' }, it.hint) : null),
      it.keys ? h('kbd', { class: 'ctx-keys', 'aria-hidden': 'true' }, it.keys) : null,
      it.checked != null ? h('span', { class: `ctx-check${it.radio ? ' radio' : ''}${it.checked ? ' on' : ''}`, 'aria-hidden': 'true' }, it.checked && !it.radio ? icon('check', { size: 14 }) : null) : null,
      sub ? icon('chevron-right', { size: 16, cls: 'ctx-sub' }) : null,
    );
    btn._sub = sub;
    btn._label = it.label;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (it.disabled) return;
      if (sub) return openSub(btn, level, true);
      closeMenus({ restore: !it.keepFocus });
      it.run?.();
    });
    btn.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'touch') return;
      btn.focus({ preventScroll: true });
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => {
        if (!btn.isConnected) return;
        if (sub) openSub(btn, level, false);
        else if (stack.length > level + 1) closeFrom(level + 1, { focusParent: false });
      }, sub ? 120 : 200);
    });
    el.append(btn);
  }
  while (el.lastChild?.classList?.contains('ctx-sep')) el.lastChild.remove();
  return el;
}

function openSub(item, level, focusFirst) {
  if (stack[level + 1]?.parentItem === item) {
    if (focusFirst) firstStop(stack[level + 1].el)?.focus();
    return;
  }
  closeFrom(level + 1, { focusParent: false });
  const items = typeof item._sub === 'function' ? item._sub() : item._sub;
  const el = build(items, level + 1, item._label);
  el.classList.add('ctx-submenu');
  el.style.visibility = 'hidden';
  document.body.append(el);
  const r = item.getBoundingClientRect();
  const parent = stack[level].el.getBoundingClientRect();
  place(el, { x: parent.right - 4, y: r.top - 6, flipX: parent.left + 4, flipY: r.bottom + 6 });
  el.style.visibility = '';
  item.setAttribute('aria-expanded', 'true');
  stack.push({ el, parentItem: item });
  if (focusFirst) firstStop(el)?.focus();
}

/**
 * Open a menu. Give either a point (x, y) for a context menu, or an anchor
 * element to open next to (below it, or above with placement 'above').
 */
export function openMenu(items, { x, y, anchor = null, placement = 'below', label = '', focus = null, onClose = null, className = '', keyboard = false } = {}) {
  if (anchor && guard?.anchor === anchor && performance.now() < guard.until) {
    guard = null;
    return null;
  }
  guard = null;
  closeMenus();
  const list = items.filter(Boolean);
  if (!list.some((it) => it !== '-')) return null;
  const el = build(list, 0, label);
  if (className) el.classList.add(...className.split(' '));
  el.style.visibility = 'hidden';
  document.body.append(el);
  if (anchor) {
    const r = anchor.getBoundingClientRect();
    const w = el.offsetWidth;
    if (placement === 'above') place(el, { x: r.right - w, y: r.top - 6 - el.offsetHeight, flipY: r.bottom + 6 });
    else if (placement === 'right') place(el, { x: r.right + 6, y: r.top, flipX: r.left - 6 });
    else if (placement === 'left') place(el, { x: r.left - 6 - w, y: r.top, flipX: r.right + 6 });
    else place(el, { x: r.left, y: r.bottom + 6, flipX: r.right, flipY: r.top - 6 });
    if (placement === 'above' && parseFloat(el.style.top) + el.offsetHeight > r.top) place(el, { x: r.right - w, y: r.bottom + 6 });
    anchor.setAttribute('aria-expanded', 'true');
  } else {
    place(el, { x, y, flipX: x, flipY: y });
  }
  el.style.visibility = '';
  stack.push({ el, parentItem: null });
  opener = { anchor, focus: focus || anchor || document.activeElement, onClose };
  lastOpen = performance.now();
  document.addEventListener('pointerdown', outside, true);
  document.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', onWindow);
  window.addEventListener('blur', onWindow);
  // The user scrolling the page closes the menu; the app scrolling by itself does not.
  document.addEventListener('wheel', onScroll, { capture: true, passive: true });
  document.addEventListener('touchmove', onScroll, { capture: true, passive: true });
  const first = firstStop(el);
  // A pointer opened menu still takes focus so the arrows work right away.
  if (first) first.focus({ preventScroll: true });
  else el.focus({ preventScroll: true });
  if (!keyboard) el.classList.add('by-pointer');
  return el;
}

// Context menus by delegation: register a resolver for a selector; the
// innermost match wins, and a resolver marked merge adds the items of the
// next match outside it (a link inside a message gets both menus).

const resolvers = [];

/** Register a context menu for every element matching selector. resolve(el, event) returns items. */
export function contextMenu(selector, resolve, { merge = false, label = null } = {}) {
  resolvers.push({ selector, resolve, merge, label });
}

function itemsAt(target, e) {
  const out = [];
  let node = target;
  let label = '';
  let lastEl = null;
  while (node && node !== document.body) {
    if (node.nodeType === 1) {
      const r = resolvers.find((x) => node.matches(x.selector));
      if (r) {
        const items = r.resolve(node, e) || [];
        if (items.length) {
          if (out.length) out.push('-');
          out.push(...items);
          label = label || (typeof r.label === 'function' ? r.label(node) : r.label) || '';
          lastEl = lastEl || node;
        }
        if (!r.merge) break;
      }
    }
    node = node.parentNode;
  }
  return { items: out, label, el: lastEl };
}

function selectionItems(target) {
  const sel = window.getSelection?.();
  const text = sel && !sel.isCollapsed ? sel.toString() : '';
  if (!text.trim() || !sel.anchorNode || !target.contains(sel.anchorNode)) return [];
  return [{ label: copyLabel, icon: 'copy', keys: 'Ctrl+C', run: () => navigator.clipboard?.writeText(text).catch(() => {}) }, '-'];
}

let copyLabel = 'Copy';

/** Set the label of the copy selection item (it follows the interface language). */
export function setCopyLabel(text) {
  copyLabel = text;
}

const editable = (el) => !!el?.closest?.('input, textarea, select, [contenteditable="true"], .ctx-menu');

function openAt(target, e, point, keyboard) {
  const found = itemsAt(target, e);
  if (!found.items.length) return false;
  const items = [...selectionItems(found.el || target), ...found.items];
  openMenu(items, { x: point.x, y: point.y, label: found.label, focus: keyboard ? document.activeElement : null, keyboard });
  if (found.el) {
    found.el.classList.add('ctx-target');
    const el = found.el;
    const prev = opener.onClose;
    opener.onClose = () => {
      el.classList.remove('ctx-target');
      prev?.();
    };
  }
  return true;
}

function keyboardPoint(el) {
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.left + Math.min(r.width / 2, 48)), y: Math.round(r.top + Math.min(r.height, 40)) };
}

/** Wire the document once: right click, Shift+right click for the browser menu, long press and the keyboard. */
export function initContextMenus() {
  document.addEventListener('contextmenu', (e) => {
    if (e.shiftKey || editable(e.target)) return;
    if (performance.now() - lastOpen < 400 && stack.length) {
      e.preventDefault();
      return;
    }
    // Keyboard made contextmenu events have no real point: use the focused element.
    const keyboard = e.button !== 2 && e.clientX === 0 && e.clientY === 0;
    const target = keyboard ? document.activeElement || e.target : e.target;
    const point = keyboard ? keyboardPoint(target) : { x: e.clientX, y: e.clientY };
    if (openAt(target, e, point, keyboard)) e.preventDefault();
  });
  document.addEventListener(
    'keydown',
    (e) => {
      const isMenuKey = e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey);
      if (!isMenuKey || stack.length || editable(e.target)) return;
      const target = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
      if (target && openAt(target, e, keyboardPoint(target), true)) e.preventDefault();
    },
    true,
  );
  // Long press on touch screens. A press that opened a menu does not also click.
  let press = null;
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType !== 'touch' || editable(e.target)) return;
      const target = e.target;
      const start = { x: e.clientX, y: e.clientY };
      clearTimeout(press?.timer);
      press = {
        start,
        fired: false,
        timer: setTimeout(() => {
          if (!press) return;
          if (openAt(target, e, start, false)) {
            press.fired = true;
            navigator.vibrate?.(10);
            window.getSelection?.()?.removeAllRanges();
          }
        }, 480),
      };
    },
    { passive: true },
  );
  const cancel = (e) => {
    if (!press) return;
    if (e.type === 'pointermove' && Math.hypot(e.clientX - press.start.x, e.clientY - press.start.y) < 10) return;
    clearTimeout(press.timer);
    if (!press.fired) press = null;
  };
  document.addEventListener('pointermove', cancel, { passive: true });
  document.addEventListener('pointercancel', cancel, { passive: true });
  document.addEventListener('pointerup', (e) => {
    if (!press) return;
    clearTimeout(press.timer);
    if (press.fired) {
      const swallow = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
      };
      document.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => document.removeEventListener('click', swallow, true), 400);
    }
    press = null;
    void e;
  });
}
