// The text channel view: message list, reactions, stickers, polls, voice
// messages, replies and threads, pins, edits with their history, forwards,
// saved messages and reminders, search, the file gallery, read markers, and
// the composer with mentions, slash commands, formatting and attachments.

import { h, replace, formatDay, copyText } from './dom.js';
import { icon, reactionIcon } from './icons.js';
import { stickerEl } from './stickers.js';
import { avatarImg, closePopover, colorOf, idBadge, memberCard, popover } from './ui-shell.js';
import { confirmDialog, modal, promptDialog, toast } from './ui-modal.js';
import { forwardModal, formatBar, historyModal, pollBlock, pollDialog, recordVoice, remindMenu, voicePlayer } from './ui-chat-kinds.js';
import { pickableReactions, pickableStickers, season } from './seasonal.js';
import { plainText, render as renderMarkdown } from '../core/markdown.js';
import { REACTIONS, isPinned, reactors } from '../core/history.js';
import { formatSize, MAX_FILE } from '../core/chunks.js';
import { COMMANDS, parseCommand, suggestCommands } from '../core/commands.js';
import { HAS, emptySearch, matchRecord, parseSearch } from '../core/search.js';
import { formatDuration } from '../core/call.js';

const GROUP_MS = 7 * 60 * 1000;
const PAGE = 150;
const MAX_VOICE_MS = 5 * 60 * 1000;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function createChat(app) {
  const t = (k, v) => app.t(k, v);
  const list = h('div', { class: 'messages', role: 'log', 'aria-live': 'polite', 'aria-relevant': 'additions', tabindex: '0' });
  const jumpBar = h('button', { class: 'jump-bar', type: 'button', hidden: true });
  const scroller = h('div', { class: 'scroller' }, list);
  const typingLine = h('div', { class: 'typing', 'aria-live': 'polite' });
  const replyBar = h('div', { class: 'reply-bar', hidden: true });
  const attachBar = h('div', { class: 'attach-bar', hidden: true });
  const suggest = h('ul', { class: 'suggest', role: 'listbox', hidden: true });
  const input = h('textarea', { class: 'composer-input', rows: 1, maxlength: 4000, 'aria-label': 'Message', enterkeyhint: 'send' });
  const fileInput = h('input', { type: 'file', multiple: true, hidden: true, tabindex: '-1' });
  const attachBtn = h('button', { class: 'icon-btn composer-attach', type: 'button', 'aria-haspopup': 'menu', onclick: (e) => attachMenu(e.currentTarget) }, icon('attach', { size: 22 }));
  const sendBtn = h('button', { class: 'icon-btn composer-send', type: 'submit' }, icon('send', { size: 20 }));
  const micBtn = h('button', { class: 'icon-btn composer-mic', type: 'button', onclick: () => startVoice() }, icon('mic', { size: 22 }));
  const stickerBtn = h('button', { class: 'icon-btn composer-sticker', type: 'button', 'aria-haspopup': 'menu', onclick: () => stickerPicker() }, icon('sticker', { size: 22 }));
  const formatBtn = h('button', { class: 'icon-btn composer-format', type: 'button', 'aria-pressed': 'false', onclick: () => toggleFormat() }, icon('text', { size: 22 }));
  const toolbar = formatBar(app, input);
  toolbar.hidden = true;
  const box = h('div', { class: 'composer-box' }, attachBtn, input, formatBtn, stickerBtn, micBtn, sendBtn);
  const form = h('form', { class: 'composer' }, replyBar, attachBar, suggest, toolbar, box, fileInput, typingLine);
  const dropHint = h('div', { class: 'drop-hint', hidden: true }, h('div', null, icon('file', { size: 40 }), h('p', null, '')));
  const panel = h('aside', { class: 'chat-panel', hidden: true });
  const el = h('section', { class: 'hl-chat' }, jumpBar, scroller, form, dropHint, panel);

  const state = {
    session: null,
    channel: null,
    nodes: new Map(),
    limit: PAGE,
    reply: null,
    files: [],
    editing: null,
    newSince: 0,
    suggestIndex: 0,
    suggestItems: [],
    suggestKind: 'mention',
    // Reaction counts already on screen, so only new ones pop; primed once the first render is done.
    counts: new Map(),
    primed: false,
    // The side panel: { kind: 'thread' | 'pins' | 'search' | 'gallery' | 'saved', root, query }.
    panel: null,
    recording: null,
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
    for (const [btn, key] of [
      [attachBtn, 'chat.attach'],
      [stickerBtn, 'chat.stickers'],
      [formatBtn, 'format.title'],
      [micBtn, 'voice.msg.record'],
    ]) {
      btn.setAttribute('aria-label', t(key));
      btn.dataset.tip = t(key);
    }
    sendBtn.setAttribute('aria-label', t('chat.send'));
    dropHint.querySelector('p').textContent = t('chat.dropHere');
    updateSendMode();
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

  function threadInfo(rec) {
    if (rec.thread || !state.session) return null;
    const replies = state.session.threadOf(rec.id).filter((r) => !r.deleted);
    return replies.length ? { n: replies.length, last: replies[replies.length - 1].ts, people: [...new Set(replies.map((r) => r.author))].slice(0, 3) } : null;
  }

  function signature(rec, grouped, extra) {
    const s = state.session;
    const author = s.member(rec.author);
    const prog = rec.files?.map((f) => `${s.progress.get(f.id) ?? ''}${s.blobUrls.has(f.id) ? 'u' : ''}`).join(',');
    const ids = s.identityOf(rec.author);
    return JSON.stringify([rec.text, rec.editedAt, rec.deleted, rec.reactions, rec.votes, rec.pin, grouped, author?.name, author?.avatar, author?.accent, ids?.status, ids?.friend, prog, extra, app.lang, rec.reply && s.messages.get(rec.reply)?.text, threadInfo(rec), s.isSaved(rec.id)]);
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
            'aria-label': `${t(`chat.reaction.${key}`)}, ${who.length}`,
            title: t('chat.reactedBy', { names: who.map(memberName).join(', ') }),
            onclick: () => react(rec, key),
          },
          reactionIcon(key, { size: 16 }),
          h('span', null, String(who.length)),
        ),
      );
    }
    state.counts.set(rec.id, now);
    return row.childElementCount ? row : null;
  }

  function react(rec, key) {
    const mine = reactors(rec, key).includes(app.profile.id);
    if (!mine) {
      app.settings.reactUse = { ...app.settings.reactUse, [key]: (app.settings.reactUse?.[key] || 0) + 1 };
      app.saveSettings();
    }
    state.session.react(rec.id, key);
  }

  function fileBlock(rec, f) {
    const s = state.session;
    if (f.voice) return voicePlayer(app, s, rec, f);
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

  /** A one line summary of a record, for replies, pins, search and saved lists. */
  function summary(rec) {
    if (!rec) return t('chat.deleted');
    if (rec.deleted) return t('chat.deleted');
    if (rec.sticker) return t('chat.stickerSent');
    if (rec.poll) return `${t('poll.short')}: ${rec.poll.q}`;
    if (rec.files?.some((f) => f.voice)) return t('voice.msg.short', { time: formatDuration((rec.files.find((f) => f.voice).dur || 0) * 1000) });
    return plainText(rec.text, resolveMention).slice(0, 140) || (rec.files?.[0]?.name ?? '');
  }

  function replyPreview(rec) {
    const target = state.session.messages.get(rec.reply);
    const author = target ? state.session.member(target.author) : null;
    return h(
      'button',
      { class: 'msg-reply', type: 'button', 'aria-label': t('chat.jump'), onclick: () => jumpTo(rec.reply) },
      target ? avatarImg(author?.avatar || target.author, { size: 16 }) : null,
      h('span', { class: 'msg-reply-name', style: { color: colorOf(author, target?.author) } }, target ? `@${author?.name || t('chat.unknown')}` : ''),
      h('span', { class: 'msg-reply-text' }, summary(target)),
    );
  }

  function buildMessage(rec, grouped, fresh = false, { inPanel = false } = {}) {
    const s = state.session;
    const author = s.member(rec.author);
    const mine = rec.author === app.profile.id;
    const mentioned = !mine && !rec.deleted && s.mentionsMe(rec);
    const content = h('div', { class: `msg-content${rec.me ? ' msg-me' : ''}` });
    if (rec.deleted) content.append(h('em', { class: 'msg-deleted' }, t('chat.deleted')));
    else if (rec.sticker) content.append(stickerEl(rec.sticker, { size: 120, label: t(`chat.sticker.${rec.sticker}`), play: fresh && Date.now() - rec.ts < 60000 }));
    else if (rec.poll) content.append(pollBlock(app, s, rec));
    else {
      if (rec.me) content.append(h('span', { class: 'me-name' }, `${author?.name || t('chat.unknown')} `));
      content.append(renderMarkdown(rec.text, { document, resolveMention }));
      if (rec.editedAt) {
        content.append(' ', rec.history?.length ? h('button', { class: 'msg-edited link-like', type: 'button', title: timeLabel(rec.editedAt), onclick: () => historyModal(app, rec, resolveMention) }, t('chat.edited')) : h('span', { class: 'msg-edited', title: timeLabel(rec.editedAt) }, t('chat.edited')));
      }
    }
    const actions = rec.deleted
      ? null
      : h(
          'div',
          { class: 'msg-actions', role: 'toolbar', 'aria-label': t('chat.actions') },
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('chat.react'), 'data-tip': t('chat.react'), onclick: (e) => reactionPicker(rec, e.currentTarget) }, icon('react', { size: 18 })),
          inPanel ? null : h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('chat.reply'), 'data-tip': t('chat.reply'), onclick: () => startReply(rec) }, icon('reply', { size: 18 })),
          inPanel || rec.thread ? null : h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('chat.thread'), 'data-tip': t('chat.thread'), onclick: () => openPanel('thread', { root: rec.id }) }, icon('thread', { size: 18 })),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('chat.more'), 'data-tip': t('chat.more'), 'aria-haspopup': 'menu', onclick: (e) => messageMenu(rec, e.currentTarget) }, icon('dots', { size: 18 })),
        );
    const nameBtn = h('button', { class: 'msg-author', type: 'button', style: { color: colorOf(author, rec.author) }, onclick: (e) => memberCard(app, s, { ...(author || { id: rec.author, name: t('chat.unknown') }), id: rec.author, online: !!author?.online || mine }, e.currentTarget) }, author?.name || t('chat.unknown'));
    const tags = [isPinned(rec) ? h('span', { class: 'msg-tag pin', title: t('pins.pinned') }, icon('pin', { size: 12 }), t('pins.pinned')) : null, s.isSaved(rec.id) ? h('span', { class: 'msg-tag saved', title: t('saved.saved') }, icon('bookmark', { size: 12 })) : null];
    const header = grouped ? null : h('header', { class: 'msg-head' }, nameBtn, mine ? null : idBadge(app, s, rec.author), h('time', { class: 'msg-time', datetime: new Date(rec.ts).toISOString() }, timeLabel(rec.ts)), tags);
    const side = grouped
      ? h('time', { class: 'msg-side-time', datetime: new Date(rec.ts).toISOString() }, new Date(rec.ts).toLocaleTimeString(app.lang, { hour: '2-digit', minute: '2-digit' }))
      : h('button', { class: 'msg-avatar-btn', type: 'button', tabindex: '-1', 'aria-hidden': 'true', onclick: (e) => nameBtn.dispatchEvent(new MouseEvent('click', { bubbles: true })) || e.preventDefault() }, avatarImg(author?.avatar || rec.author, { size: 40, cls: 'msg-avatar' }));
    const info = inPanel ? null : threadInfo(rec);
    const threadLink = info
      ? h(
          'button',
          { class: 'thread-link', type: 'button', onclick: () => openPanel('thread', { root: rec.id }) },
          h(
            'span',
            { class: 'thread-faces' },
            info.people.map((id) => avatarImg(s.member(id)?.avatar || id, { size: 18 })),
          ),
          h('strong', null, t(info.n === 1 ? 'thread.reply1' : 'thread.replies', { n: info.n })),
          h('span', { class: 'muted' }, timeLabel(info.last)),
        )
      : null;
    const fwd = rec.fwd && !rec.deleted ? h('p', { class: 'msg-fwd' }, icon('forward', { size: 14 }), rec.fwd.from ? t('forward.fromIn', { name: rec.fwd.name, from: rec.fwd.from }) : t('forward.from', { name: rec.fwd.name })) : null;
    return h(
      'article',
      { class: `msg${grouped ? ' grouped' : ''}${mentioned ? ' mentioned' : ''}${rec.reply && !rec.deleted ? ' has-reply' : ''}${isPinned(rec) ? ' pinned' : ''}`, dataset: { id: rec.id }, 'aria-label': `${author?.name || ''}, ${timeLabel(rec.ts)}` },
      rec.reply && !rec.deleted ? replyPreview(rec) : null,
      h('div', { class: 'msg-row' }, h('div', { class: 'msg-gutter' }, side), h('div', { class: 'msg-body' }, header, fwd, content, rec.deleted ? null : h('div', { class: 'msg-files' }, (rec.files || []).map((f) => fileBlock(rec, f))), rec.deleted ? null : reactionRow(rec), threadLink)),
      actions,
    );
  }

  function welcomeBlock() {
    const s = state.session;
    const c = s.den.channels.find((x) => x.id === state.channel);
    const cleared = s.den.cleared?.[state.channel];
    return h(
      'div',
      { class: 'hl-chat-start' },
      season() ? h('div', { class: 'chat-start-art' }, stickerEl(season(), { size: 72 })) : h('div', { class: 'chat-start-ico' }, icon('hash', { size: 40 })),
      h('h2', null, t('channel.welcome', { name: c?.name || '' })),
      h('p', null, t('channel.start', { name: c?.name || '' })),
      cleared ? h('p', { class: 'cleared-note' }, icon('info', { size: 16 }), t('cmd.clearedNote', { when: timeLabel(cleared) }), ' ', h('button', { class: 'link-btn', type: 'button', onclick: () => s.clearChannel(state.channel, 0) }, t('cmd.showAll'))) : null,
    );
  }

  /** Bring the DOM in line with the records, touching only what changed. */
  function sync({ keepScroll = false } = {}) {
    const s = state.session;
    if (!s) return;
    const stick = pinned || nearBottom();
    const records = s.timeline(state.channel);
    const shown = records.slice(-state.limit);
    const want = [];
    if (records.length > shown.length) want.push(['older', h('button', { class: 'btn btn-ghost btn-sm older', type: 'button', onclick: () => ((state.limit += PAGE), sync({ keepScroll: true })) }, t('channel.older'))]);
    else want.push([`start:${s.den.cleared?.[state.channel] || 0}`, welcomeBlock()]);
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
      const grouped = !newDay && prev && prev.author === rec.author && !prev.deleted && !prev.poll && !rec.reply && !rec.fwd && rec.ts - prev.ts < GROUP_MS;
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
    updateJump();
    renderPanel();
  }

  function maybeRead() {
    if (state.session && document.visibilityState === 'visible' && nearBottom() && app.view === 'chat') state.session.markRead(state.channel);
  }

  // Read markers: a bar to jump to the first unread message when it is out of view.
  function updateJump() {
    const divider = state.nodes.get('new')?.el;
    const unread = state.session ? state.session.timeline(state.channel).filter((r) => r.ts > state.newSince && r.author !== app.profile.id && !r.deleted).length : 0;
    const above = divider && divider.offsetTop < scroller.scrollTop;
    jumpBar.hidden = !(above && unread);
    if (!jumpBar.hidden) replace(jumpBar, icon('chevron-down', { size: 16, cls: 'up' }), h('span', null, t(unread === 1 ? 'chat.unread1' : 'chat.unreadN', { n: unread })), h('strong', null, t('chat.jumpUnread')));
  }

  jumpBar.addEventListener('click', () => {
    const divider = state.nodes.get('new')?.el;
    if (divider) divider.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    jumpBar.hidden = true;
  });

  let pinned = true;
  scroller.addEventListener('scroll', () => {
    pinned = nearBottom();
    if (pinned) maybeRead();
    updateJump();
  });
  // Keep the newest message in view while images and files finish loading.
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
      if (pinned) scrollBottom();
    }).observe(list);
  }

  function flash(node) {
    node.classList.remove('flash');
    void node.offsetWidth;
    node.classList.add('flash');
  }

  /** Show a message wherever it is: this channel, another channel, or inside a thread. */
  function jumpTo(id, session = state.session) {
    const rec = session?.messages.get(id);
    if (!rec) return;
    if (session !== state.session || rec.channel !== state.channel) {
      app.openDen(session.id, rec.channel);
      setTimeout(() => jumpTo(id, session), 120);
      return;
    }
    if (rec.thread) {
      openPanel('thread', { root: rec.thread });
      const node = panel.querySelector(`.msg[data-id="${id}"]`);
      if (node) flash(node);
      return;
    }
    const all = state.session.timeline(state.channel);
    const index = all.findIndex((r) => r.id === id);
    if (index >= 0 && all.length - index > state.limit) {
      state.limit = all.length - index + 20;
      sync({ keepScroll: true });
    }
    const node = state.nodes.get(id);
    if (!node) return;
    node.el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    flash(node.el);
  }

  // Actions

  function reactionPicker(rec, anchor) {
    const pick = pickableReactions();
    const use = app.settings.reactUse || {};
    const frequent = Object.keys(use)
      .filter((k) => pick.includes(k) && use[k] > 0)
      .sort((a, b) => use[b] - use[a])
      .slice(0, 4);
    const btn = (key, size) =>
      h(
        'button',
        {
          class: 'icon-btn',
          type: 'button',
          role: 'menuitem',
          'aria-label': key,
          title: t(`chat.reaction.${key}`),
          onclick: () => {
            closePopover();
            react(rec, key);
          },
        },
        reactionIcon(key, { size }),
      );
    popover(
      anchor,
      h(
        'div',
        { class: 'reaction-picker', role: 'menu', 'aria-label': t('chat.react') },
        frequent.length ? [h('p', { class: 'picker-label' }, t('chat.frequent')), h('div', { class: 'picker-row frequent' }, frequent.map((k) => btn(k, 30)))] : null,
        h('p', { class: 'picker-label' }, t('chat.allReactions')),
        h('div', { class: 'picker-row' }, pick.map((k) => btn(k, 26))),
      ),
      { placement: 'above' },
    );
  }

  function messageMenu(rec, anchor) {
    const s = state.session;
    const mine = rec.author === app.profile.id;
    const item = (label, ico, run, cls = '') => h('button', { class: `hl-menu-item${cls}`, type: 'button', role: 'menuitem', onclick: () => (closePopover(), run()) }, h('span', null, label), icon(ico, { size: 16 }));
    popover(
      anchor,
      h(
        'div',
        { class: 'hl-menu', role: 'menu', 'aria-label': t('chat.more') },
        item(t(isPinned(rec) ? 'pins.unpin' : 'pins.pin'), 'pin', () => s.pin(rec.id, !isPinned(rec))),
        item(t(s.isSaved(rec.id) ? 'saved.remove' : 'saved.add'), 'bookmark', () => toast(t(s.toggleSaved(rec.id) ? 'saved.added' : 'saved.removed'), 'ok')),
        h('button', { class: 'hl-menu-item', type: 'button', role: 'menuitem', onclick: (e) => remindMenu(app, s, rec, e.currentTarget) }, h('span', null, t('remind.title')), icon('clock', { size: 16 })),
        item(t('forward.title'), 'forward', () => forwardModal(app, s, rec)),
        rec.thread ? null : item(t('chat.thread'), 'thread', () => openPanel('thread', { root: rec.id })),
        rec.text ? item(t('chat.copyText'), 'copy', async () => (await copyText(plainText(rec.text, resolveMention))) && toast(t('notice.copied'), 'ok')) : null,
        rec.history?.length ? item(t('chat.historyTitle'), 'history', () => historyModal(app, rec, resolveMention)) : null,
        mine && !rec.sticker && !rec.poll && !rec.files?.some((f) => f.voice) ? item(t('chat.edit'), 'edit', () => startEdit(rec.id)) : null,
        mine ? item(t('chat.delete'), 'trash', () => deleteMessage(rec), ' danger') : null,
      ),
      { placement: 'left' },
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
        pickableStickers().map((key) =>
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
                try {
                  await s.postSticker(state.channel, key, { reply: takeReply() });
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

  function attachMenu(anchor) {
    const item = (label, ico, run) => h('button', { class: 'hl-menu-item', type: 'button', role: 'menuitem', onclick: () => (closePopover(), run()) }, icon(ico, { size: 18 }), h('span', null, label));
    popover(anchor, h('div', { class: 'hl-menu', role: 'menu', 'aria-label': t('chat.attach') }, item(t('chat.uploadFile'), 'file', () => fileInput.click()), item(t('poll.title'), 'poll', () => createPoll()), item(t('voice.msg.record'), 'mic', () => startVoice())), { placement: 'above' });
  }

  async function createPoll() {
    const s = state.session;
    const poll = await pollDialog(app);
    if (!poll || !s) return;
    try {
      await s.postPoll(state.channel, poll, { reply: takeReply() });
      scrollBottom();
    } catch {
      toast(t('chat.sendFailed'), 'error');
    }
  }

  function takeReply() {
    const reply = state.reply;
    state.reply = null;
    renderReplyBar();
    return reply;
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

  async function startEdit(id) {
    const rec = state.session.messages.get(id);
    if (rec?.thread) {
      // Thread replies are edited in a small dialog.
      const value = await promptDialog(t, { title: t('chat.edit'), label: t('chat.edit'), value: toEditable(rec.text), ok: t('chat.save'), maxlength: 4000 });
      if (value != null && value.trim()) state.session.edit(id, fromEditable(value.trim()));
      return;
    }
    state.editing = id;
    sync();
  }

  async function deleteMessage(rec) {
    if (await confirmDialog(t, { title: t('chat.delete'), text: t('chat.deleteConfirm'), ok: t('common.delete'), danger: true })) state.session.remove(rec.id);
  }

  // Side panel: thread, pins, search, gallery and saved messages

  /** Open a side panel; the same header button again closes it. */
  function openPanel(kind, opts = {}) {
    if (state.panel?.kind === kind && !opts.root) return closePanel();
    state.panel = { kind, ...opts };
    renderPanel(true);
  }

  function closePanel() {
    state.panel = null;
    panel.hidden = true;
    el.classList.remove('has-panel');
    replace(panel);
  }

  const panelBodies = {};

  function renderPanel(focus = false) {
    const p = state.panel;
    const s = state.session;
    if (!p || !s) {
      panel.hidden = true;
      el.classList.remove('has-panel');
      return;
    }
    panel.hidden = false;
    el.classList.add('has-panel');
    const titles = { thread: t('thread.title'), pins: t('pins.title'), search: t('search.title'), gallery: t('gallery.title'), saved: t('saved.title') };
    const icons = { thread: 'thread', pins: 'pin', search: 'search', gallery: 'image', saved: 'bookmark' };
    let head = panel.querySelector('.panel-head');
    if (!head || head.dataset.kind !== p.kind) {
      head = h('header', { class: 'panel-head', dataset: { kind: p.kind } }, icon(icons[p.kind], { size: 20 }), h('h2', null, titles[p.kind]), h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('common.close'), onclick: () => closePanel() }, icon('x', { size: 20 })));
      panelBodies[p.kind] = panelBodies[p.kind] || {};
      replace(panel, head, h('div', { class: 'panel-body' }));
      panel.setAttribute('aria-label', titles[p.kind]);
    }
    const body = panel.querySelector('.panel-body');
    if (p.kind === 'thread') renderThread(body, p, focus);
    else if (p.kind === 'pins') renderPins(body);
    else if (p.kind === 'search') renderSearch(body, focus);
    else if (p.kind === 'gallery') renderGallery(body);
    else if (p.kind === 'saved') renderSaved(body);
  }

  function miniItem(sess, rec, { channelName = '', extra = null } = {}) {
    const author = sess.member(rec.author);
    return h(
      'li',
      { class: 'mini' },
      h(
        'button',
        { class: 'mini-main', type: 'button', onclick: () => jumpTo(rec.id, sess) },
        avatarImg(author?.avatar || rec.author, { size: 28 }),
        h('span', { class: 'mini-text' }, h('span', { class: 'mini-head' }, h('strong', { style: { color: colorOf(author, rec.author) } }, author?.name || t('chat.unknown')), channelName ? h('span', { class: 'mini-where' }, channelName) : null, h('time', null, timeLabel(rec.ts))), h('span', { class: 'mini-sum' }, summary(rec))),
      ),
      extra,
    );
  }

  // Thread

  const threadInput = h('textarea', { class: 'composer-input thread-input', rows: 1, maxlength: 4000, enterkeyhint: 'send' });
  const threadNodes = new Map();
  let threadRoot = null;

  async function sendThread() {
    const s = state.session;
    const text = threadInput.value.trim();
    if (!text || !threadRoot || !s) return;
    threadInput.value = '';
    autosize(threadInput);
    const root = s.messages.get(threadRoot);
    try {
      await s.post(root.channel, fromEditable(text), { thread: threadRoot });
    } catch {
      toast(t('chat.sendFailed'), 'error');
    }
  }
  threadInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      sendThread();
    }
  });
  threadInput.addEventListener('input', () => autosize(threadInput));

  function renderThread(body, p, focus) {
    const s = state.session;
    const root = s.messages.get(p.root);
    if (!root) return replace(body, h('p', { class: 'muted pad' }, t('chat.deleted')));
    if (threadRoot !== p.root) {
      threadRoot = p.root;
      threadNodes.clear();
      threadInput.value = '';
    }
    threadInput.placeholder = t('thread.placeholder');
    threadInput.setAttribute('aria-label', t('thread.placeholder'));
    const replies = s.threadOf(p.root);
    let listEl = body.querySelector('.thread-list');
    if (!listEl) {
      listEl = h('div', { class: 'thread-list' });
      replace(body, listEl, h('form', { class: 'thread-composer', onsubmit: (e) => (e.preventDefault(), sendThread()) }, h('div', { class: 'composer-box' }, threadInput, h('button', { class: 'icon-btn composer-send', type: 'submit', 'aria-label': t('chat.send') }, icon('send', { size: 20 })))));
    }
    const want = [root, ...replies];
    const keep = new Set();
    const ordered = [];
    want.forEach((rec, i) => {
      const key = rec.id;
      keep.add(key);
      const sig = signature(rec, false, `t${i === 0}`);
      let node = threadNodes.get(key);
      if (!node || node.sig !== sig) {
        const n = buildMessage(rec, false, !node && i > 0 && state.primed, { inPanel: true });
        if (i === 0) n.classList.add('thread-root');
        node?.el.replaceWith(n);
        node = { el: n, sig };
        threadNodes.set(key, node);
      }
      ordered.push(node.el);
    });
    for (const [key, node] of threadNodes) if (!keep.has(key)) (node.el.remove(), threadNodes.delete(key));
    const count = h('p', { class: 'thread-count' }, t(replies.length === 1 ? 'thread.reply1' : 'thread.replies', { n: replies.length }));
    replace(listEl, ordered[0], count, ordered.slice(1));
    listEl.scrollTop = listEl.scrollHeight;
    if (focus) setTimeout(() => threadInput.focus(), 30);
  }

  // Pins

  function renderPins(body) {
    const s = state.session;
    const pins = s
      .channelMessages(state.channel)
      .filter(isPinned)
      .sort((a, b) => b.pin[0] - a.pin[0]);
    replace(
      body,
      pins.length
        ? h(
            'ul',
            { class: 'mini-list' },
            pins.map((rec) => miniItem(s, rec, { extra: h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('pins.unpin'), 'data-tip': t('pins.unpin'), onclick: () => s.pin(rec.id, false) }, icon('x', { size: 16 })) })),
          )
        : emptyPanel('pin', t('pins.empty')),
    );
  }

  function emptyPanel(ico, text) {
    return h('div', { class: 'panel-empty' }, h('span', { class: 'panel-empty-ico' }, icon(ico, { size: 28 })), h('p', null, text));
  }

  // Search

  const searchInput = h('input', { class: 'input field-input', type: 'search', autocomplete: 'off', spellcheck: 'false' });
  const searchResults = h('div', { class: 'search-results', 'aria-live': 'polite' });
  let searchTimer = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(runSearch, 120);
  });

  function renderSearch(body, focus) {
    searchInput.placeholder = t('search.placeholder');
    searchInput.setAttribute('aria-label', t('search.title'));
    if (!body.contains(searchInput)) {
      const chip = (label, text) =>
        h(
          'button',
          {
            class: 'chip',
            type: 'button',
            onclick: () => {
              searchInput.value = `${searchInput.value.trim()} ${text}`.trimStart();
              searchInput.focus();
              runSearch();
            },
          },
          label,
        );
      const today = new Date().toISOString().slice(0, 10);
      replace(body, h('div', { class: 'search-box' }, searchInput, h('div', { class: 'chips' }, chip(t('search.fromMe'), 'from:me'), HAS.filter((x) => x !== 'pin').map((x) => chip(`has:${x}`, `has:${x}`)), chip(t('search.before'), `before:${today}`), chip(t('search.after'), `after:${today}`)), h('p', { class: 'field-hint' }, t('search.hint'))), searchResults);
    }
    runSearch();
    if (focus) setTimeout(() => searchInput.focus(), 30);
  }

  function runSearch() {
    const s = state.session;
    if (!s) return;
    const q = parseSearch(searchInput.value);
    if (emptySearch(q)) return replace(searchResults, emptyPanel('search', t('search.empty')));
    const channelName = (id) => s.den.channels.find((c) => c.id === id)?.name || '';
    const hits = [...s.messages.values()]
      .filter((r) => matchRecord(r, q, { text: plainText(r.text, resolveMention), author: memberName(r.author), me: r.author === app.profile.id }))
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 100);
    replace(searchResults, h('p', { class: 'muted search-count' }, t(hits.length === 1 ? 'search.count1' : 'search.count', { n: hits.length })), hits.length ? h('ul', { class: 'mini-list' }, hits.map((r) => miniItem(s, r, { channelName: s.isDirect ? '' : `#${channelName(r.channel)}` }))) : null);
  }

  // Gallery

  function renderGallery(body) {
    const s = state.session;
    const recs = s.channelMessages(state.channel).filter((r) => !r.deleted && r.files?.length);
    const images = [];
    const others = [];
    for (const r of recs) for (const f of r.files) (/^image\//.test(f.type) ? images : others).push({ r, f });
    images.reverse();
    others.reverse();
    if (!images.length && !others.length) return replace(body, emptyPanel('image', t('gallery.empty')));
    replace(
      body,
      images.length
        ? [
            h('h3', { class: 'panel-sub' }, t('gallery.images', { n: images.length })),
            h(
              'div',
              { class: 'gallery-grid' },
              images.map(({ r, f }) => {
                const url = s.fileUrl(f.id);
                return h('button', { class: 'gallery-item', type: 'button', 'aria-label': f.name, title: f.name, onclick: () => (url ? lightbox(f, url) : jumpTo(r.id)) }, f.thumb || url ? h('img', { src: url || f.thumb, alt: '', loading: 'lazy' }) : icon('image', { size: 28 }));
              }),
            ),
          ]
        : null,
      others.length
        ? [
            h('h3', { class: 'panel-sub' }, t('gallery.files', { n: others.length })),
            h(
              'ul',
              { class: 'gallery-files' },
              others.map(({ r, f }) => {
                const url = s.fileUrl(f.id);
                return h('li', null, icon(f.voice ? 'mic' : 'file', { size: 20 }), h('button', { class: 'link-like gallery-name', type: 'button', onclick: () => jumpTo(r.id) }, f.voice ? t('voice.msg.short', { time: formatDuration((f.dur || 0) * 1000) }) : f.name), h('small', { class: 'muted' }, `${formatSize(f.size)}, ${memberName(r.author)}`), url ? h('a', { class: 'icon-btn', href: url, download: f.name, 'aria-label': `${t('chat.download')} ${f.name}` }, icon('download', { size: 18 })) : null);
              }),
            ),
          ]
        : null,
    );
  }

  // Saved messages and reminders, across every den on this device

  function renderSaved(body) {
    const rows = [];
    const reminders = [];
    for (const sess of app.sessions.values()) {
      for (const [id, at] of Object.entries(sess.den.saved || {})) {
        const rec = sess.messages.get(id);
        if (rec) rows.push({ sess, rec, at });
      }
      for (const r of sess.den.reminders || []) {
        const rec = sess.messages.get(r.id);
        if (rec) reminders.push({ sess, rec, at: r.at });
      }
    }
    rows.sort((a, b) => b.at - a.at);
    reminders.sort((a, b) => a.at - b.at);
    const where = (sess, rec) => (sess.isDirect ? sess.den.name : `${sess.den.name} #${sess.den.channels.find((c) => c.id === rec.channel)?.name || ''}`);
    if (!rows.length && !reminders.length) return replace(body, emptyPanel('bookmark', t('saved.empty')));
    replace(
      body,
      reminders.length
        ? [
            h('h3', { class: 'panel-sub' }, t('remind.upcoming')),
            h(
              'ul',
              { class: 'mini-list' },
              reminders.map(({ sess, rec, at }) =>
                miniItem(sess, rec, {
                  channelName: `${where(sess, rec)}, ${new Date(at).toLocaleString(app.lang, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`,
                  extra: h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('remind.cancel'), 'data-tip': t('remind.cancel'), onclick: () => (sess.setLocal('reminders', (sess.den.reminders || []).filter((x) => x.id !== rec.id)), renderPanel()) }, icon('x', { size: 16 })),
                }),
              ),
            ),
          ]
        : null,
      rows.length
        ? [
            h('h3', { class: 'panel-sub' }, t('saved.title')),
            h(
              'ul',
              { class: 'mini-list' },
              rows.map(({ sess, rec }) => miniItem(sess, rec, { channelName: where(sess, rec), extra: h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('saved.remove'), 'data-tip': t('saved.remove'), onclick: () => (sess.toggleSaved(rec.id), renderPanel()) }, icon('x', { size: 16 })) })),
            ),
          ]
        : null,
    );
  }

  // Composer

  function autosize(ta) {
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 300)}px`;
  }

  function toggleFormat(force) {
    toolbar.hidden = force === undefined ? !toolbar.hidden : !force;
    formatBtn.setAttribute('aria-pressed', String(!toolbar.hidden));
    formatBtn.classList.toggle('on', !toolbar.hidden);
  }

  /** The microphone button takes the send button's place while the composer is empty. */
  function updateSendMode() {
    const empty = !input.value.trim() && !state.files.length;
    const canRecord = typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
    micBtn.hidden = !empty || !canRecord;
    sendBtn.hidden = empty && canRecord;
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
    updateSendMode();
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

  let draftTimer = null;
  function saveDraft() {
    const s = state.session;
    const channel = state.channel;
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      if (!s) return;
      const drafts = { ...s.den.drafts };
      if (input.value.trim() && s === state.session && channel === state.channel) drafts[channel] = input.value.slice(0, 4000);
      else if (s === state.session && channel === state.channel) delete drafts[channel];
      s.setLocal('drafts', drafts);
    }, 500);
  }

  function clearDraft() {
    clearTimeout(draftTimer);
    const s = state.session;
    if (s?.den.drafts?.[state.channel]) {
      const drafts = { ...s.den.drafts };
      delete drafts[state.channel];
      s.setLocal('drafts', drafts);
    }
  }

  /** Run a slash command. Returns true when the text was handled here. */
  async function runCommand(raw) {
    const s = state.session;
    const cmd = parseCommand(raw);
    if (!cmd) return false;
    const reply = takeReply();
    switch (cmd.type) {
      case 'text':
        await s.post(state.channel, fromEditable(cmd.text), { reply, me: cmd.me });
        break;
      case 'roll':
        await s.post(state.channel, t('cmd.rolled', { dice: `${cmd.count}d${cmd.sides}`, rolls: cmd.rolls.join(' + '), total: cmd.total }), { reply, me: true });
        break;
      case 'coin':
        await s.post(state.channel, t(cmd.heads ? 'cmd.heads' : 'cmd.tails'), { reply, me: true });
        break;
      case 'poll':
        await s.postPoll(state.channel, cmd.poll, { reply });
        break;
      case 'nick':
        await app.updateProfile({ name: cmd.name });
        toast(t('cmd.nickDone', { name: cmd.name }), 'ok');
        break;
      case 'clear':
        s.clearChannel(state.channel);
        toast(t('cmd.cleared'), 'ok');
        break;
      case 'help':
        modal({
          title: t('cmd.helpTitle'),
          className: 'help-modal',
          closeLabel: t('common.close'),
          body: [h('p', { class: 'muted' }, t('cmd.helpLead')), h('dl', { class: 'cmd-list' }, COMMANDS.map((c) => [h('dt', null, h('code', null, `/${c.name}${c.args ? ` ${c.args}` : ''}`)), h('dd', null, t(`cmd.about.${c.name}`))]))],
        });
        break;
      default:
        toast(t(cmd.key, { name: cmd.name }), 'error', 6000);
        return 'keep';
    }
    return true;
  }

  async function submit() {
    const s = state.session;
    if (!s) return;
    let raw = input.value.trim();
    if (!raw && !state.files.length) return;
    if (raw.startsWith('/') && !raw.startsWith('//') && !state.files.length) {
      try {
        const done = await runCommand(raw);
        if (done === 'keep') return;
        if (done) {
          input.value = '';
          clearDraft();
          autosize(input);
          hideSuggest();
          updateSendMode();
          scrollBottom();
          return;
        }
      } catch (err) {
        console.warn('howlden command:', err);
        toast(t('chat.sendFailed'), 'error');
        return;
      }
    }
    if (raw.startsWith('//')) raw = raw.slice(1);
    const text = fromEditable(raw);
    const reply = state.reply;
    const files = state.files;
    input.value = '';
    clearDraft();
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
      if (e.key === 'Tab' || (e.key === 'Enter' && state.suggestKind === 'mention') || (e.key === 'Enter' && state.suggestKind === 'command' && !COMMANDS.some((c) => `/${c.name}` === input.value.trim()))) {
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
    if ((e.ctrlKey || e.metaKey) && !e.altKey && ['b', 'i'].includes(e.key.toLowerCase())) {
      e.preventDefault();
      toolbar.querySelectorAll('button')[e.key.toLowerCase() === 'b' ? 0 : 1].click();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      submit();
    } else if (e.key === 'ArrowUp' && !input.value) {
      const mine = state.session?.timeline(state.channel).filter((r) => r.author === app.profile.id && !r.deleted && !r.sticker && !r.poll && !r.files?.some((f) => f.voice)).pop();
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
    saveDraft();
    if (input.value.trim() && !input.value.startsWith('/')) state.session?.sendTyping(state.channel);
    updateSuggest();
    updateSendMode();
  });

  input.addEventListener('paste', (e) => {
    const files = [...(e.clipboardData?.files || [])];
    if (files.length) {
      e.preventDefault();
      addFiles(files);
    }
  });

  // Suggestions: @mentions and /commands

  function mentionQuery() {
    const before = input.value.slice(0, input.selectionStart);
    const m = /(^|\s)@([\p{L}\p{N}_.' -]{0,24})$/u.exec(before);
    return m ? { query: m[2], start: before.length - m[2].length - 1 } : null;
  }

  function updateSuggest() {
    const cmds = suggestCommands(input.value);
    if (cmds.length) {
      state.suggestKind = 'command';
      state.suggestItems = cmds.map((c) => ({ id: c.name, name: `/${c.name}`, args: c.args }));
      state.suggestIndex = Math.min(state.suggestIndex, state.suggestItems.length - 1);
      return renderSuggest();
    }
    const q = mentionQuery();
    if (!q || !state.session) return hideSuggest();
    state.suggestKind = 'mention';
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
            class: `suggest-item${i === state.suggestIndex ? ' active' : ''}${state.suggestKind === 'command' ? ' cmd' : ''}`,
            role: 'option',
            'aria-selected': String(i === state.suggestIndex),
            onmousedown: (e) => {
              e.preventDefault();
              pickSuggest(it);
            },
          },
          state.suggestKind === 'command' ? icon('code', { size: 18 }) : it.id === 'everyone' ? icon('at', { size: 20 }) : avatarImg(it.avatar || it.id, { size: 22 }),
          h('span', null, it.name),
          state.suggestKind === 'command' ? h('small', { class: 'muted' }, [it.args, t(`cmd.about.${it.id}`)].filter(Boolean).join('  ')) : null,
        ),
      ),
    );
  }

  function hideSuggest() {
    suggest.hidden = true;
    state.suggestIndex = 0;
  }

  function pickSuggest(it) {
    if (!it) return hideSuggest();
    if (state.suggestKind === 'command') {
      input.value = `${it.name} `;
      input.setSelectionRange(input.value.length, input.value.length);
      hideSuggest();
      input.focus();
      return;
    }
    const q = mentionQuery();
    if (!q) return hideSuggest();
    const before = input.value.slice(0, q.start);
    const after = input.value.slice(input.selectionStart);
    input.value = `${before}@${it.name} ${after}`;
    const pos = before.length + it.name.length + 2;
    input.setSelectionRange(pos, pos);
    hideSuggest();
    input.focus();
  }

  // Voice messages

  async function startVoice() {
    const s = state.session;
    if (!s || state.recording) return;
    let rec;
    try {
      rec = await recordVoice(app);
    } catch (err) {
      toast(t(err?.name === 'NotAllowedError' ? 'notice.mic-denied' : 'notice.mic-failed'), 'error', 6000);
      return;
    }
    state.recording = rec;
    const time = h('span', { class: 'rec-time' }, '0:00');
    const bars = Array.from({ length: 28 }, () => h('span', { class: 'vm-bar' }));
    const live = h('div', { class: 'vm-wave live', 'aria-hidden': 'true' }, bars);
    const stopBtn = h('button', { class: 'icon-btn composer-send', type: 'button', 'aria-label': t('voice.msg.send'), 'data-tip': t('voice.msg.send') }, icon('send', { size: 20 }));
    const cancelBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('voice.msg.cancel'), 'data-tip': t('voice.msg.cancel') }, icon('trash', { size: 20 }));
    const bar = h('div', { class: 'composer-box recording', role: 'group', 'aria-label': t('voice.msg.recording') }, cancelBtn, h('span', { class: 'rec-dot' }), time, live, stopBtn);
    box.replaceWith(bar);
    const levels = [];
    const tick = setInterval(() => {
      const ms = rec.elapsed();
      time.textContent = formatDuration(ms);
      levels.push(rec.level());
      if (levels.length > bars.length) levels.shift();
      levels.forEach((v, i) => (bars[bars.length - levels.length + i].style.height = `${Math.max(10, Math.min(100, v * 400))}%`));
      if (ms > MAX_VOICE_MS) finish(true);
    }, 100);
    const done = () => {
      clearInterval(tick);
      state.recording = null;
      bar.replaceWith(box);
      input.focus({ preventScroll: true });
    };
    async function finish(send) {
      if (!state.recording) return;
      if (!send) {
        rec.cancel();
        return done();
      }
      const out = await rec.stop();
      done();
      if (out.dur < 0.5 || !out.blob.size) return toast(t('voice.msg.tooShort'), 'info');
      try {
        await s.postVoice(state.channel, out.blob, out, { reply: takeReply() });
        scrollBottom();
      } catch (err) {
        console.warn('howlden voice message:', err);
        toast(t('chat.sendFailed'), 'error');
      }
    }
    stopBtn.addEventListener('click', () => finish(true));
    cancelBtn.addEventListener('click', () => finish(false));
    bar.addEventListener('keydown', (e) => e.key === 'Escape' && finish(false));
    stopBtn.focus();
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
  el.addEventListener('click', (e) => {
    const sp = e.target.closest('.md-spoiler');
    if (sp) sp.classList.add('shown');
  });
  el.addEventListener('keydown', (e) => {
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
    const text = !names.length ? '' : names.length === 1 ? t('chat.typing1', { a: names[0] }) : names.length === 2 ? t('chat.typing2', { a: names[0], b: names[1] }) : names.length === 3 ? t('chat.typing3', { a: names[0], b: names[1], c: names[2] }) : t('chat.typingMany');
    replace(typingLine, text ? h('span', { class: 'typing-dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')) : null, text ? h('span', null, text) : null);
  }

  return {
    el,
    show(session, channelId) {
      const same = state.session === session && state.channel === channelId;
      if (state.session && state.channel && !same) {
        clearTimeout(draftTimer);
        const prev = state.session;
        const drafts = { ...prev.den.drafts };
        if (input.value.trim()) drafts[state.channel] = input.value.slice(0, 4000);
        else delete drafts[state.channel];
        prev.setLocal('drafts', drafts);
      }
      if (state.session !== session && state.panel?.kind !== 'saved') closePanel();
      else if (!same && state.panel && ['thread', 'pins', 'gallery'].includes(state.panel.kind)) closePanel();
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
        input.value = session.den.drafts?.[channelId] || '';
        autosize(input);
        renderReplyBar();
      }
      labels();
      sync();
      if (!same) {
        pinned = true;
        scrollBottom();
        updateJump();
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
      threadNodes.clear();
      state.primed = false;
      if (state.panel) replace(panel);
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
      updateSendMode();
    },
    openPanel,
    closePanel,
    panelKind: () => state.panel?.kind || null,
    jumpTo,
    markRead: maybeRead,
  };
}

