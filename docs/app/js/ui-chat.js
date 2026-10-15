// The text channel view: message list, reactions, stickers, replies, edits,
// files and the composer with mentions and attachments.

import { h, replace, formatDay } from './dom.js';
import { icon, reactionIcon } from './icons.js';
import { stickerEl } from './stickers.js';
import { avatarImg, closePopover, colorOf, idBadge, memberCard, popover } from './ui-shell.js';
import { confirmDialog, modal, toast } from './ui-modal.js';
import { plainText, render as renderMarkdown } from '../core/markdown.js';
import { BASE_REACTIONS, BASE_STICKERS, REACTIONS, reactors } from '../core/history.js';
import { formatSize, MAX_FILE } from '../core/chunks.js';

const GROUP_MS = 7 * 60 * 1000;
const PAGE = 150;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function createChat(app) {
  const t = (k, v) => app.t(k, v);
  const list = h('div', { class: 'messages', role: 'log', 'aria-live': 'polite', 'aria-relevant': 'additions', tabindex: '0' });
  const scroller = h('div', { class: 'scroller' }, list);
  const typingLine = h('div', { class: 'typing', 'aria-live': 'polite' });
  const replyBar = h('div', { class: 'reply-bar', hidden: true });
  const attachBar = h('div', { class: 'attach-bar', hidden: true });
  const suggest = h('ul', { class: 'suggest', role: 'listbox', hidden: true });
  const input = h('textarea', { class: 'composer-input', rows: 1, maxlength: 4000, 'aria-label': 'Message', enterkeyhint: 'send' });
  const fileInput = h('input', { type: 'file', multiple: true, hidden: true, tabindex: '-1' });
  const attachBtn = h('button', { class: 'icon-btn composer-attach', type: 'button', onclick: () => fileInput.click() }, icon('attach', { size: 22 }));
  const sendBtn = h('button', { class: 'icon-btn composer-send', type: 'submit' }, icon('send', { size: 20 }));
  const stickerBtn = h('button', { class: 'icon-btn composer-sticker', type: 'button', 'aria-haspopup': 'menu', onclick: () => stickerPicker() }, icon('sticker', { size: 22 }));
  const form = h('form', { class: 'composer' }, replyBar, attachBar, suggest, h('div', { class: 'composer-box' }, attachBtn, input, stickerBtn, sendBtn), fileInput, typingLine);
  const dropHint = h('div', { class: 'drop-hint', hidden: true }, h('div', null, icon('file', { size: 40 }), h('p', null, '')));
  const el = h('section', { class: 'hl-chat' }, scroller, form, dropHint);

  const state = {
    session: null,
    channel: null,
    nodes: new Map(),
    limit: PAGE,
    reply: null,
    files: [],
    editing: null,
    newSince: 0,
    drafts: new Map(),
    suggestIndex: 0,
    suggestItems: [],
    // Reaction counts already on screen, so only new ones pop; primed once the first render is done.
    counts: new Map(),
    primed: false,
  };

  const memberName = (id) => state.session?.member(id)?.name || t('chat.unknown');
  const resolveMention = (id) => {
    const m = state.session?.member(id);
    return m ? { name: m.name, self: id === app.profile.id } : null;
  };

  function nearBottom() {
    return scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 120;
  }

  function scrollBottom() {
    scroller.scrollTop = scroller.scrollHeight;
  }

  function labels() {
    const c = state.session?.den.channels.find((x) => x.id === state.channel);
    const name = c?.name || '';
    input.placeholder = state.session?.status === 'offline' ? t('channel.offlinePlaceholder', { name }) : t('channel.placeholder', { name });
    input.setAttribute('aria-label', t('channel.placeholder', { name }));
    attachBtn.setAttribute('aria-label', t('chat.attach'));
    attachBtn.dataset.tip = t('chat.attach');
    sendBtn.setAttribute('aria-label', t('chat.send'));
    stickerBtn.setAttribute('aria-label', t('chat.stickers'));
    stickerBtn.dataset.tip = t('chat.stickers');
    dropHint.querySelector('p').textContent = t('chat.dropHere');
  }

  // Message rendering

  function timeLabel(ts) {
    const d = new Date(ts);
    const time = d.toLocaleTimeString(app.lang, { hour: '2-digit', minute: '2-digit' });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (ts >= today.getTime()) return t('chat.today', { time });
    if (ts >= today.getTime() - 86400000) return t('chat.yesterday', { time });
    return `${d.toLocaleDateString(app.lang)} ${time}`;
  }

  function signature(rec, grouped, extra) {
    const author = state.session.member(rec.author);
    const prog = rec.files?.map((f) => `${state.session.progress.get(f.id) ?? ''}${state.session.blobUrls.has(f.id) ? 'u' : ''}`).join(',');
    const ids = state.session.identityOf(rec.author);
    return JSON.stringify([rec.text, rec.editedAt, rec.deleted, rec.reactions, grouped, author?.name, author?.avatar, author?.accent, ids?.status, ids?.friend, prog, extra, app.lang, rec.reply && state.session.messages.get(rec.reply)?.text]);
  }

  function reactionRow(rec) {
    const row = h('div', { class: 'reactions' });
    const before = state.counts.get(rec.id);
    const now = {};
    for (const key of REACTIONS) {
      const who = reactors(rec, key);
      now[key] = who.length;
      if (!who.length) continue;
      const mine = who.includes(app.profile.id);
      const grew = state.primed && who.length > (before?.[key] || 0);
      row.append(
        h(
          'button',
          {
            class: `reaction${mine ? ' mine' : ''}${grew ? ' pop' : ''}`,
            type: 'button',
            'aria-pressed': String(mine),
            'aria-label': `${key}, ${who.length}`,
            title: t('chat.reactedBy', { names: who.map(memberName).join(', ') }),
            onclick: () => state.session.react(rec.id, key),
          },
          reactionIcon(key, { size: 16 }),
          h('span', null, String(who.length)),
        ),
      );
    }
    state.counts.set(rec.id, now);
    return row.childElementCount ? row : null;
  }

  function fileBlock(rec, f) {
    const s = state.session;
    const url = s.fileUrl(f.id);
    const progress = s.progress.get(f.id);
    const isImage = /^image\//.test(f.type) && (f.thumb || url);
    const status = progress != null ? h('span', { class: 'file-progress' }, h('span', { class: 'bar', style: { width: `${Math.round(progress * 100)}%` } }), h('span', { class: 'file-pct' }, t('chat.receiving', { pct: Math.round(progress * 100) }))) : null;
    const getBtn = !url && progress == null ? h('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: () => (s.requestFile(f.id, rec.author) ? null : toast(t('chat.unavailable'), 'error')) }, icon('download', { size: 16 }), t('chat.request')) : null;
    if (isImage) {
      const ratio = f.w && f.h ? Math.min(1, 400 / f.w, 300 / f.h) : 1;
      const img = h('img', { class: 'file-img', src: url || f.thumb, alt: f.name, loading: 'lazy', width: f.w ? Math.round(f.w * ratio) : null, height: f.h ? Math.round(f.h * ratio) : null });
      return h(
        'figure',
        { class: `file-image${url ? '' : ' preview'}` },
        h('button', { class: 'file-open', type: 'button', 'aria-label': f.name, onclick: () => (url ? lightbox(f, url) : getBtn?.click()) }, img),
        url ? null : h('figcaption', { class: 'file-overlay' }, status || getBtn),
      );
    }
    return h(
      'div',
      { class: 'file-card' },
      icon('file', { size: 32, cls: 'file-ico' }),
      h('div', { class: 'file-meta' }, url ? h('a', { class: 'file-name', href: url, download: f.name }, f.name) : h('span', { class: 'file-name' }, f.name), h('span', { class: 'file-size' }, formatSize(f.size)), status),
      url ? h('a', { class: 'icon-btn', href: url, download: f.name, 'aria-label': `${t('chat.download')} ${f.name}` }, icon('download', { size: 20 })) : getBtn,
    );
  }

  function lightbox(f, url) {
    modal({
      className: 'hl-lightbox',
      closeLabel: t('common.close'),
      body: [h('img', { src: url, alt: f.name }), h('div', { class: 'lightbox-bar' }, h('span', null, `${f.name}, ${formatSize(f.size)}`), h('a', { class: 'btn btn-ghost btn-sm', href: url, download: f.name }, icon('download', { size: 16 }), t('chat.download')))],
    });
  }

  function replyPreview(rec) {
    const target = state.session.messages.get(rec.reply);
    const author = target ? state.session.member(target.author) : null;
    return h(
      'button',
      { class: 'msg-reply', type: 'button', 'aria-label': t('chat.jump'), onclick: () => jumpTo(rec.reply) },
      target ? avatarImg(author?.avatar || target.author, { size: 16 }) : null,
      h('span', { class: 'msg-reply-name', style: { color: colorOf(author, target?.author) } }, target ? `@${author?.name || t('chat.unknown')}` : ''),
      h('span', { class: 'msg-reply-text' }, target ? (target.deleted ? t('chat.deleted') : target.sticker ? t('chat.stickerSent') : plainText(target.text, resolveMention).slice(0, 120) || (target.files?.[0]?.name ?? '')) : t('chat.deleted')),
    );
  }

  function buildMessage(rec, grouped, fresh = false) {
    const s = state.session;
    const author = s.member(rec.author);
    const mine = rec.author === app.profile.id;
    const mentioned = !mine && !rec.deleted && s.mentionsMe(rec);
    const content = h('div', { class: 'msg-content' });
    if (rec.deleted) content.append(h('em', { class: 'msg-deleted' }, t('chat.deleted')));
    else if (rec.sticker) content.append(stickerEl(rec.sticker, { size: 120, label: t(`chat.sticker.${rec.sticker}`), play: fresh && Date.now() - rec.ts < 60000 }));
    else {
      content.append(renderMarkdown(rec.text, { document, resolveMention }));
      if (rec.editedAt) content.append(h('span', { class: 'msg-edited', title: timeLabel(rec.editedAt) }, ` ${t('chat.edited')}`));
    }
    const actions = rec.deleted
      ? null
      : h(
          'div',
          { class: 'msg-actions', role: 'toolbar', 'aria-label': 'Message actions' },
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('chat.react'), 'data-tip': t('chat.react'), onclick: (e) => reactionPicker(rec, e.currentTarget) }, icon('react', { size: 18 })),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('chat.reply'), 'data-tip': t('chat.reply'), onclick: () => startReply(rec) }, icon('reply', { size: 18 })),
          mine && !rec.sticker ? h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('chat.edit'), 'data-tip': t('chat.edit'), onclick: () => startEdit(rec.id) }, icon('edit', { size: 18 })) : null,
          mine ? h('button', { class: 'icon-btn danger', type: 'button', 'aria-label': t('chat.delete'), 'data-tip': t('chat.delete'), onclick: () => deleteMessage(rec) }, icon('trash', { size: 18 })) : null,
        );
    const nameBtn = h('button', { class: 'msg-author', type: 'button', style: { color: colorOf(author, rec.author) }, onclick: (e) => memberCard(app, s, { ...(author || { id: rec.author, name: t('chat.unknown') }), id: rec.author, online: !!author?.online || mine }, e.currentTarget) }, author?.name || t('chat.unknown'));
    const header = grouped ? null : h('header', { class: 'msg-head' }, nameBtn, mine ? null : idBadge(app, s, rec.author), h('time', { class: 'msg-time', datetime: new Date(rec.ts).toISOString() }, timeLabel(rec.ts)));
    const side = grouped
      ? h('time', { class: 'msg-side-time', datetime: new Date(rec.ts).toISOString() }, new Date(rec.ts).toLocaleTimeString(app.lang, { hour: '2-digit', minute: '2-digit' }))
      : h('button', { class: 'msg-avatar-btn', type: 'button', tabindex: '-1', 'aria-hidden': 'true', onclick: (e) => nameBtn.dispatchEvent(new MouseEvent('click', { bubbles: true })) || e.preventDefault() }, avatarImg(author?.avatar || rec.author, { size: 40, cls: 'msg-avatar' }));
    return h(
      'article',
      { class: `msg${grouped ? ' grouped' : ''}${mentioned ? ' mentioned' : ''}${rec.reply && !rec.deleted ? ' has-reply' : ''}`, dataset: { id: rec.id }, 'aria-label': `${author?.name || ''}, ${timeLabel(rec.ts)}` },
      rec.reply && !rec.deleted ? replyPreview(rec) : null,
      h('div', { class: 'msg-row' }, h('div', { class: 'msg-gutter' }, side), h('div', { class: 'msg-body' }, header, content, rec.deleted ? null : h('div', { class: 'msg-files' }, (rec.files || []).map((f) => fileBlock(rec, f))), rec.deleted ? null : reactionRow(rec))),
      actions,
    );
  }

  function welcomeBlock() {
    const c = state.session.den.channels.find((x) => x.id === state.channel);
    return h('div', { class: 'hl-chat-start' }, h('div', { class: 'chat-start-ico' }, icon('hash', { size: 40 })), h('h2', null, t('channel.welcome', { name: c?.name || '' })), h('p', null, t('channel.start', { name: c?.name || '' })));
  }

  /** Bring the DOM in line with the records, touching only what changed. */
  function sync({ keepScroll = false } = {}) {
    const s = state.session;
    if (!s) return;
    const stick = pinned || nearBottom();
    const records = s.channelMessages(state.channel);
    const shown = records.slice(-state.limit);
    const want = [];
    if (records.length > shown.length) want.push(['older', h('button', { class: 'btn btn-ghost btn-sm older', type: 'button', onclick: () => ((state.limit += PAGE), sync({ keepScroll: true })) }, t('channel.older'))]);
    else want.push(['start', welcomeBlock()]);
    let prev = null;
    let dividerDone = false;
    for (const rec of shown) {
      const day = new Date(rec.ts).toDateString();
      const newDay = !prev || new Date(prev.ts).toDateString() !== day;
      if (newDay) want.push([`day:${day}`, null, () => h('div', { class: 'day-divider', role: 'separator' }, h('span', null, formatDay(rec.ts, app.lang)))]);
      if (!dividerDone && state.newSince && rec.ts > state.newSince && rec.author !== app.profile.id) {
        dividerDone = true;
        want.push(['new', null, () => h('div', { class: 'day-divider new', role: 'separator' }, h('span', null, t('chat.newMessages')))]);
      }
      const grouped = !newDay && prev && prev.author === rec.author && !prev.deleted && !rec.reply && rec.ts - prev.ts < GROUP_MS;
      want.push([rec.id, rec, grouped]);
      prev = rec;
    }
    const keep = new Set();
    const ordered = [];
    for (const [key, rec, extra] of want) {
      keep.add(key);
      let node = state.nodes.get(key);
      if (rec && typeof rec === 'object' && rec.id) {
        const sig = signature(rec, extra, state.editing === rec.id);
        if (!node || node.sig !== sig) {
          const el2 = state.editing === rec.id ? editBox(rec) : buildMessage(rec, extra, !node && state.primed);
          node?.el.replaceWith(el2);
          node = { el: el2, sig };
          state.nodes.set(key, node);
        }
      } else if (!node) {
        node = { el: typeof extra === 'function' ? extra() : rec, sig: '' };
        state.nodes.set(key, node);
      }
      ordered.push(node.el);
    }
    for (const [key, node] of state.nodes) {
      if (!keep.has(key)) {
        node.el.remove();
        state.nodes.delete(key);
      }
    }
    const before = scroller.scrollHeight - scroller.scrollTop;
    let cursor = list.firstChild;
    for (const node of ordered) {
      if (node !== cursor) list.insertBefore(node, cursor);
      else cursor = cursor.nextSibling;
    }
    if (keepScroll) scroller.scrollTop = scroller.scrollHeight - before;
    else if (stick) scrollBottom();
    state.primed = true;
    maybeRead();
  }

  function maybeRead() {
    if (state.session && document.visibilityState === 'visible' && nearBottom() && app.view === 'chat') state.session.markRead(state.channel);
  }

  let pinned = true;
  scroller.addEventListener('scroll', () => {
    pinned = nearBottom();
    if (pinned) maybeRead();
  });
  // Keep the newest message in view while images and files finish loading.
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
      if (pinned) scrollBottom();
    }).observe(list);
  }

  function jumpTo(id) {
    const node = state.nodes.get(id);
    if (!node) return;
    node.el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    node.el.classList.remove('flash');
    void node.el.offsetWidth;
    node.el.classList.add('flash');
  }

  // Actions

  function reactionPicker(rec, anchor) {
    popover(
      anchor,
      h(
        'div',
        { class: 'reaction-picker', role: 'menu', 'aria-label': t('chat.react') },
        BASE_REACTIONS.map((key) =>
          h(
            'button',
            {
              class: 'icon-btn',
              type: 'button',
              role: 'menuitem',
              'aria-label': key,
              onclick: () => {
                closePopover();
                state.session.react(rec.id, key);
              },
            },
            reactionIcon(key, { size: 26 }),
          ),
        ),
      ),
      { placement: 'above' },
    );
  }

  function stickerPicker() {
    const s = state.session;
    if (!s) return;
    popover(
      stickerBtn,
      h(
        'div',
        { class: 'sticker-picker', role: 'menu', 'aria-label': t('chat.stickers') },
        BASE_STICKERS.map((key) =>
          h(
            'button',
            {
              class: 'sticker-pick',
              type: 'button',
              role: 'menuitem',
              'aria-label': t(`chat.sticker.${key}`),
              title: t(`chat.sticker.${key}`),
              onclick: async () => {
                closePopover();
                const channel = state.channel;
                try {
                  await s.postSticker(channel, key);
                } catch (err) {
                  console.warn('howlden sticker:', err);
                  toast(t('chat.sendFailed'), 'error');
                }
                scrollBottom();
                input.focus({ preventScroll: true });
              },
            },
            stickerEl(key, { size: 64 }),
          ),
        ),
      ),
      { placement: 'above' },
    );
  }

  function startReply(rec) {
    state.reply = rec.id;
    renderReplyBar();
    input.focus();
  }

  function renderReplyBar() {
    if (!state.reply) {
      replyBar.hidden = true;
      return replace(replyBar);
    }
    const rec = state.session.messages.get(state.reply);
    replyBar.hidden = false;
    replace(
      replyBar,
      h('span', null, t('chat.replyingTo', { name: '' }), h('strong', null, memberName(rec?.author))),
      h(
        'button',
        {
          class: 'icon-btn',
          type: 'button',
          'aria-label': t('chat.cancelReply'),
          onclick: () => {
            state.reply = null;
            renderReplyBar();
          },
        },
        icon('x', { size: 16 }),
      ),
    );
  }

  function toEditable(text) {
    return text.replace(/<@([0-9a-f]{4,32})>/g, (_, id) => `@${memberName(id)}`);
  }

  function fromEditable(text) {
    let out = text;
    const members = state.session.members().filter((m) => m.name).sort((a, b) => b.name.length - a.name.length);
    for (const m of members) out = out.replace(new RegExp(`(^|[^\\p{L}\\p{N}_<])@${escapeRe(m.name)}(?![\\p{L}\\p{N}_])`, 'gu'), `$1<@${m.id}>`);
    return out;
  }

  function editBox(rec) {
    const ta = h('textarea', { class: 'edit-input', rows: 1, maxlength: 4000, 'aria-label': t('chat.edit') }, toEditable(rec.text));
    const save = () => {
      const text = fromEditable(ta.value.trim());
      state.editing = null;
      if (text && text !== rec.text) state.session.edit(rec.id, text);
      else if (!text) deleteMessage(rec);
      sync();
      input.focus();
    };
    const cancel = () => {
      state.editing = null;
      sync();
      input.focus();
    };
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      } else if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        save();
      }
    });
    ta.addEventListener('input', () => autosize(ta));
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
      autosize(ta);
    }, 0);
    const author = state.session.member(rec.author);
    return h(
      'article',
      { class: 'msg editing', dataset: { id: rec.id } },
      h(
        'div',
        { class: 'msg-row' },
        h('div', { class: 'msg-gutter' }, avatarImg(author?.avatar || rec.author, { size: 40, cls: 'msg-avatar' })),
        h('div', { class: 'msg-body' }, h('header', { class: 'msg-head' }, h('span', { class: 'msg-author', style: { color: colorOf(author, rec.author) } }, author?.name || '')), ta, h('p', { class: 'edit-hint' }, t('chat.editHint'), ' ', h('button', { class: 'link-btn', type: 'button', onclick: save }, t('chat.save')))),
      ),
    );
  }

  function startEdit(id) {
    state.editing = id;
    sync();
  }

  async function deleteMessage(rec) {
    if (await confirmDialog(t, { title: t('chat.delete'), text: t('chat.deleteConfirm'), ok: t('common.delete'), danger: true })) state.session.remove(rec.id);
  }

  // Composer

  function autosize(ta) {
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 300)}px`;
  }

  function renderAttachments() {
    attachBar.hidden = !state.files.length;
    replace(
      attachBar,
      state.files.map((f, i) =>
        h(
          'div',
          { class: 'attach-chip' },
          /^image\//.test(f.type) ? h('img', { src: f.preview, alt: '' }) : icon('file', { size: 28 }),
          h('span', { class: 'attach-name' }, f.name),
          h('span', { class: 'attach-size' }, formatSize(f.size)),
          h(
            'button',
            {
              class: 'icon-btn',
              type: 'button',
              'aria-label': t('chat.removeFile', { name: f.name }),
              onclick: () => {
                URL.revokeObjectURL(f.preview);
                state.files.splice(i, 1);
                renderAttachments();
              },
            },
            icon('trash', { size: 16 }),
          ),
        ),
      ),
    );
  }

  function addFiles(files) {
    for (const f of files) {
      if (f.size > MAX_FILE) {
        toast(t('chat.tooLarge'), 'error');
        continue;
      }
      if (state.files.length >= 10) break;
      f.preview = /^image\//.test(f.type) ? URL.createObjectURL(f) : '';
      state.files.push(f);
    }
    renderAttachments();
    input.focus();
  }

  fileInput.addEventListener('change', () => {
    addFiles([...fileInput.files]);
    fileInput.value = '';
  });

  async function submit() {
    const s = state.session;
    if (!s) return;
    const raw = input.value.trim();
    if (!raw && !state.files.length) return;
    const text = fromEditable(raw);
    const reply = state.reply;
    const files = state.files;
    input.value = '';
    state.drafts.delete(state.channel);
    state.reply = null;
    state.files = [];
    renderReplyBar();
    renderAttachments();
    autosize(input);
    hideSuggest();
    try {
      if (files.length) await s.postFiles(state.channel, text, files, reply);
      else await s.post(state.channel, text, { reply });
    } catch (err) {
      if (err.message !== 'too-large') console.warn('howlden send:', err);
      toast(err.message === 'too-large' ? t('chat.tooLarge') : t('chat.sendFailed'), 'error');
    }
    for (const f of files) if (f.preview) URL.revokeObjectURL(f.preview);
    scrollBottom();
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    submit();
  });

  input.addEventListener('keydown', (e) => {
    if (!suggest.hidden) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        state.suggestIndex = (state.suggestIndex + (e.key === 'ArrowDown' ? 1 : -1) + state.suggestItems.length) % state.suggestItems.length;
        renderSuggest();
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        pickSuggest(state.suggestItems[state.suggestIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        hideSuggest();
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      submit();
    } else if (e.key === 'ArrowUp' && !input.value) {
      const mine = state.session?.channelMessages(state.channel).filter((r) => r.author === app.profile.id && !r.deleted).pop();
      if (mine) {
        e.preventDefault();
        startEdit(mine.id);
      }
    } else if (e.key === 'Escape' && state.reply) {
      state.reply = null;
      renderReplyBar();
    }
  });

  input.addEventListener('input', () => {
    autosize(input);
    state.drafts.set(state.channel, input.value);
    if (input.value.trim()) state.session?.sendTyping(state.channel);
    updateSuggest();
  });

  input.addEventListener('paste', (e) => {
    const files = [...(e.clipboardData?.files || [])];
    if (files.length) {
      e.preventDefault();
      addFiles(files);
    }
  });

  // Mention suggestions

  function mentionQuery() {
    const before = input.value.slice(0, input.selectionStart);
    const m = /(^|\s)@([\p{L}\p{N}_.' -]{0,24})$/u.exec(before);
    return m ? { query: m[2], start: before.length - m[2].length - 1 } : null;
  }

  function updateSuggest() {
    const q = mentionQuery();
    if (!q || !state.session) return hideSuggest();
    const lower = q.query.toLowerCase();
    const members = state.session.members().filter((m) => m.id !== app.profile.id && m.name.toLowerCase().startsWith(lower));
    const items = [...members.map((m) => ({ id: m.id, name: m.name, avatar: m.avatar })), ...('everyone'.startsWith(lower) ? [{ id: 'everyone', name: 'everyone' }] : [])].slice(0, 8);
    if (!items.length) return hideSuggest();
    state.suggestItems = items;
    state.suggestIndex = Math.min(state.suggestIndex, items.length - 1);
    renderSuggest();
  }

  function renderSuggest() {
    suggest.hidden = false;
    replace(
      suggest,
      state.suggestItems.map((it, i) =>
        h(
          'li',
          {
            class: `suggest-item${i === state.suggestIndex ? ' active' : ''}`,
            role: 'option',
            'aria-selected': String(i === state.suggestIndex),
            onmousedown: (e) => {
              e.preventDefault();
              pickSuggest(it);
            },
          },
          it.id === 'everyone' ? icon('at', { size: 20 }) : avatarImg(it.avatar || it.id, { size: 22 }),
          h('span', null, it.name),
        ),
      ),
    );
  }

  function hideSuggest() {
    suggest.hidden = true;
    state.suggestIndex = 0;
  }

  function pickSuggest(it) {
    const q = mentionQuery();
    if (!q || !it) return hideSuggest();
    const before = input.value.slice(0, q.start);
    const after = input.value.slice(input.selectionStart);
    input.value = `${before}@${it.name} ${after}`;
    const pos = before.length + it.name.length + 2;
    input.setSelectionRange(pos, pos);
    hideSuggest();
    input.focus();
  }

  // Drag and drop

  let dragDepth = 0;
  el.addEventListener('dragenter', (e) => {
    if (![...(e.dataTransfer?.types || [])].includes('Files')) return;
    dragDepth++;
    dropHint.hidden = false;
  });
  el.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) dropHint.hidden = true;
  });
  el.addEventListener('dragover', (e) => {
    if ([...(e.dataTransfer?.types || [])].includes('Files')) e.preventDefault();
  });
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    dragDepth = 0;
    dropHint.hidden = true;
    addFiles([...(e.dataTransfer?.files || [])]);
  });

  // Spoilers reveal on click or keyboard
  list.addEventListener('click', (e) => {
    const sp = e.target.closest('.md-spoiler');
    if (sp) sp.classList.add('shown');
  });
  list.addEventListener('keydown', (e) => {
    const sp = e.target.closest?.('.md-spoiler');
    if (sp && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      sp.classList.add('shown');
    }
  });

  function renderTyping() {
    const s = state.session;
    if (!s) return replace(typingLine);
    const ids = s.typingIn(state.channel);
    const names = ids.map(memberName);
    const text = !names.length ? '' : names.length === 1 ? t('chat.typing1', { a: names[0] }) : names.length === 2 ? t('chat.typing2', { a: names[0], b: names[1] }) : t('chat.typingMany');
    replace(typingLine, text ? h('span', { class: 'typing-dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')) : null, text ? h('span', null, text) : null);
  }

  return {
    el,
    show(session, channelId) {
      if (state.session && state.channel) state.drafts.set(state.channel, input.value);
      const same = state.session === session && state.channel === channelId;
      state.session = session;
      state.channel = channelId;
      if (!same) {
        for (const node of state.nodes.values()) node.el.remove();
        state.nodes.clear();
        replace(list);
        state.limit = PAGE;
        state.reply = null;
        state.editing = null;
        state.counts.clear();
        state.primed = false;
        state.newSince = session.den.lastRead?.[channelId] || 0;
        input.value = state.drafts.get(channelId) || '';
        autosize(input);
        renderReplyBar();
      }
      labels();
      sync();
      if (!same) {
        pinned = true;
        scrollBottom();
      }
      renderTyping();
    },
    refresh() {
      if (!state.session) return;
      labels();
      sync();
    },
    rebuild() {
      for (const node of state.nodes.values()) node.el.remove();
      state.nodes.clear();
      state.primed = false;
      labels();
      sync();
    },
    typing: renderTyping,
    focus() {
      if (matchMedia('(min-width: 768px)').matches) input.focus({ preventScroll: true });
    },
    mention(m) {
      input.value = `${input.value}${input.value && !input.value.endsWith(' ') ? ' ' : ''}@${m.name} `;
      input.focus();
      autosize(input);
    },
    markRead: maybeRead,
  };
}
