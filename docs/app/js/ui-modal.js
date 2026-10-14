// Modal dialogs, confirmations, prompts and toasts.

import { h } from './dom.js';
import { icon } from './icons.js';

let counter = 0;

/** Open a modal built on the native dialog element (focus trap and Escape for free). */
export function modal({ title, lead, className = '', body = [], footer = [], onClose, dismissable = true, closeLabel = 'Close' }) {
  const id = `m${++counter}`;
  const bodyEl = h('div', { class: 'modal-body' }, body);
  const footEl = h('div', { class: 'modal-foot' }, footer);
  const dlg = h(
    'dialog',
    { class: `modal ${className}`, 'aria-labelledby': title ? `${id}-t` : null, 'aria-label': title ? null : closeLabel },
    h(
      'div',
      { class: 'modal-card' },
      title || dismissable
        ? h(
            'header',
            { class: 'modal-head' },
            title ? h('h2', { id: `${id}-t`, class: 'modal-title' }, title) : h('span'),
            lead ? h('p', { class: 'modal-lead' }, lead) : null,
            dismissable ? h('button', { class: 'icon-btn modal-x', type: 'button', 'aria-label': closeLabel, onclick: () => dlg.close() }, icon('x')) : null,
          )
        : null,
      bodyEl,
      footer.length ? footEl : null,
    ),
  );
  dlg.addEventListener('cancel', (e) => {
    if (!dismissable) e.preventDefault();
  });
  dlg.addEventListener('mousedown', (e) => {
    if (dismissable && e.target === dlg) dlg.close();
  });
  dlg.addEventListener('close', () => {
    onClose?.();
    dlg.remove();
  });
  document.body.append(dlg);
  dlg.showModal();
  return {
    el: dlg,
    body: bodyEl,
    foot: footEl,
    close: () => dlg.open && dlg.close(),
    get open() {
      return dlg.open;
    },
  };
}

/** Ask a yes or no question. Resolves to true on confirm. */
export function confirmDialog(t, { title, text, ok, danger = false }) {
  return new Promise((resolve) => {
    let result = false;
    const m = modal({
      title,
      closeLabel: t('common.close'),
      body: [h('p', { class: 'modal-text' }, text)],
      footer: [
        h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => m.close() }, t('common.cancel')),
        h(
          'button',
          {
            class: `btn ${danger ? 'btn-danger' : 'btn-brand'}`,
            type: 'button',
            onclick: () => {
              result = true;
              m.close();
            },
          },
          ok || t('common.ok'),
        ),
      ],
      onClose: () => resolve(result),
    });
  });
}

/** Ask for one line of text. Resolves to the text or null. */
export function promptDialog(t, { title, label, value = '', ok, type = 'text', hint, maxlength = 60 }) {
  return new Promise((resolve) => {
    let result = null;
    const input = h('input', { class: 'input field-input', type, value, maxlength, autocomplete: type === 'password' ? 'new-password' : 'off', required: true });
    const form = h(
      'form',
      {
        class: 'stack',
        onsubmit: (e) => {
          e.preventDefault();
          if (!input.value.trim()) return input.focus();
          result = input.value;
          m.close();
        },
      },
      h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), input, hint ? h('span', { class: 'field-hint' }, hint) : null),
      h('div', { class: 'modal-foot flush' }, h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => m.close() }, t('common.cancel')), h('button', { class: 'btn btn-brand', type: 'submit' }, ok || t('common.save'))),
    );
    const m = modal({ title, closeLabel: t('common.close'), body: [form], onClose: () => resolve(result) });
    setTimeout(() => {
      input.focus();
      input.select();
    }, 30);
  });
}

/** Short message at the bottom of the screen. */
export function toast(text, kind = 'info', ms = 4200) {
  const root = document.getElementById('toasts');
  if (!root) return;
  const el = h('div', { class: `toast toast-${kind}`, role: kind === 'error' ? 'alert' : 'status' }, icon(kind === 'error' ? 'warning' : kind === 'ok' ? 'check' : 'info', { size: 18 }), h('span', null, text));
  root.append(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 300);
  }, ms);
}
