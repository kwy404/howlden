// Inviting and joining: the inviter shows six words and a QR code, the
// friend types or scans them, and the handshake travels encrypted through
// public relays that cannot read it.

import { h, replace, copyText } from './dom.js';
import { icon } from './icons.js';
import { modal, toast } from './ui-modal.js';
import { avatarSrc } from './ui-account.js';
import { codeErrorText, failureBox, qrElement } from './ui-flows.js';
import { findCode, readInvite, readReply } from '../core/invite.js';
import { MeshError } from '../core/mesh.js';
import { CODE_LIFETIME_MS, CodeCreator, CodeJoiner } from '../core/pairing.js';
import { WORDLIST } from '../core/wordlist.js';
import { WORD_COUNT, normalizeWord, resolvePhrase, resolveWord, splitPhrase, suggestWords, wordsFromLink, wordsLink } from '../core/words.js';
import { randomId } from '../core/crypto.js';

// Six word inputs

let datalistMade = false;

function ensureDatalist() {
  if (datalistMade) return;
  datalistMade = true;
  document.body.append(h('datalist', { id: 'bip39-words' }, WORDLIST.map((w) => h('option', { value: w }))));
}

/**
 * Six inputs with autocomplete from the BIP39 list. A whole phrase can be
 * pasted into any box, the first four letters are enough and a single typo is
 * fixed. onReady(words) runs when all six resolve.
 */
export function wordInputs(t, { idPrefix, onReady, auto = false }) {
  ensureDatalist();
  const inputs = [];
  const hints = [];
  const grid = h('div', { class: 'word-grid' });
  for (let i = 0; i < WORD_COUNT; i++) {
    const id = `${idPrefix}-${i}`;
    const input = h('input', { class: 'input word-field', id, type: 'text', list: 'bip39-words', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', enterkeyhint: i === WORD_COUNT - 1 ? 'go' : 'next', 'aria-describedby': `${id}-hint` });
    const hint = h('span', { class: 'word-hint', id: `${id}-hint`, 'aria-live': 'polite' });
    grid.append(h('div', { class: 'word-cell' }, h('label', { class: 'word-n', for: id }, h('span', { 'aria-hidden': 'true' }, String(i + 1)), h('span', { class: 'sr-only' }, t('words.n', { n: i + 1 }))), input, hint));
    inputs.push(input);
    hints.push(hint);
    input.addEventListener('paste', (e) => {
      if (spread(i, e.clipboardData?.getData('text') ?? '')) e.preventDefault();
    });
    input.addEventListener('input', (e) => {
      // Phone keyboards often insert clipboard text without a paste event.
      if (/[^A-Za-zÀ-ɏ]/.test(input.value.trim()) && spread(i, input.value)) return;
      update();
      if (e.inputType && !e.inputType.startsWith('insert')) return;
      const raw = normalizeWord(input.value);
      const r = resolveWord(raw);
      if (!r || r.how !== 'exact' || (raw.length < 4 && suggestWords(raw, 2).length !== 1)) return;
      if (i < WORD_COUNT - 1) inputs[i + 1].focus();
      else if (auto) ready(true);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (i < WORD_COUNT - 1) inputs[i + 1].focus();
        ready(true);
      } else if (e.key === ' ' && input.value.trim() && i < WORD_COUNT - 1) {
        e.preventDefault();
        inputs[i + 1].focus();
      } else if (e.key === 'Backspace' && !input.value && i > 0) {
        inputs[i - 1].focus();
      }
    });
    input.addEventListener('blur', () => {
      const r = resolveWord(input.value);
      if (r && r.how !== 'exact') input.value = r.word;
      update();
    });
  }

  // Puts a pasted phrase, invite text or link into the boxes, one word per box, starting at
  // the first box for a whole phrase. Returns false when the text holds a single word.
  function spread(i, text) {
    let parts = wordsFromLink(text) || splitPhrase(text);
    if (parts.length < 2) return false;
    if (parts.length > WORD_COUNT) {
      const known = parts.filter((p) => resolveWord(p)?.how === 'exact');
      if (known.length >= WORD_COUNT) parts = known.slice(-WORD_COUNT);
    }
    const start = parts.length >= WORD_COUNT ? 0 : i;
    inputs[i].value = '';
    parts.slice(0, WORD_COUNT - start).forEach((p, k) => (inputs[start + k].value = p));
    update();
    (inputs.find((x) => !resolveWord(x.value)) ?? inputs[WORD_COUNT - 1]).focus();
    if (auto) ready(true);
    return true;
  }

  function update() {
    inputs.forEach((input, i) => {
      const raw = input.value.trim();
      const r = resolveWord(raw);
      const cell = input.parentElement;
      cell.classList.toggle('is-ok', !!r);
      cell.classList.toggle('is-bad', !!raw && !r && raw.length >= 3);
      hints[i].textContent = r && r.how !== 'exact' ? r.word : raw && !r && raw.length >= 3 ? t('words.unknown') : '';
    });
    grid.classList.remove('is-wrong');
  }

  function ready(force = false) {
    const res = resolvePhrase(inputs.map((x) => x.value));
    if (res.ok && (force || !inputs.includes(document.activeElement))) onReady?.(res.words);
    return res;
  }

  return {
    el: grid,
    inputs,
    values: () => resolvePhrase(inputs.map((x) => x.value)),
    fill(words) {
      words.slice(0, WORD_COUNT).forEach((w, i) => (inputs[i].value = w));
      update();
    },
    reset() {
      for (const x of inputs) x.value = '';
      update();
    },
    focus: () => inputs[0].focus(),
    setError() {
      grid.classList.add('is-wrong');
    },
  };
}

/** Six words shown big, numbered. */
export function wordList(words, cls = '') {
  return h('ol', { class: `big-words ${cls}`, dataset: { words: words.join(' ') } }, words.map((w) => h('li', { class: 'big-word' }, h('span', { class: 'big-word-w' }, w))));
}

function relaysText(t, st) {
  return t('pair.relays', { n: st.connected.length, total: st.total });
}

// Inviting

/** Build the invite for a den, a direct conversation, or a new friend. */
async function makeInvite(app, { session, friend }) {
  if (friend) return app.newFriendInvite();
  const made = await session.createInvite();
  return { ...made, accept: async (reply, opts) => (await session.acceptReply(reply, opts), session), cancel: () => session.cancelInvite(made.inviteId) };
}

/**
 * Invite modal: the inviter shows six words and a QR code (which holds the
 * same words); the friend types or scans them and nothing has to be sent back.
 */
export async function inviteModal(app, { session, friend = false, autoShare = false, title, call = false }) {
  const t = app.t;
  const status = h('div', { class: 'invite-status', 'aria-live': 'polite' }, h('span', { class: 'spinner spinner-xs' }), t('pair.making'));
  const body = h('div', { class: 'hl-stack' }, status);
  const err = h('p', { class: 'form-error', role: 'alert' });
  const setError = (text) => (err.textContent = text);
  let invite = null;
  let creator = null;
  let countdown = null;
  let state = 'waiting';
  let peerName = '';
  const offs = [];
  const m = modal({
    title: title || (friend ? t('home.friendInvite') : t('invite.title', { den: session?.den.name || '' })),
    className: 'invite-modal',
    closeLabel: t('common.close'),
    body: [body],
    onClose: () => {
      offs.forEach((off) => off());
      clearInterval(countdown);
      creator?.stop();
      if (invite) app.invites.delete(invite.inviteId);
      if (invite && state === 'waiting') invite.cancel?.();
    },
  });

  const setStatus = (kind, ...content) => {
    replace(status, ...content);
    status.className = `invite-status${kind ? ` ${kind}` : ''}`;
  };

  const watch = (s, peerId, nonce) => {
    const onHeld = () => {
      if (state === 'done' || state === 'confirming') return;
      state = 'confirming';
      setStatus('', h('span', { class: 'spinner spinner-xs' }), t('pair.checking', { name: peerName }));
      // A known friend with a verified key is let in by the session itself; otherwise ask for the words.
      setTimeout(() => s.mesh?.held.has(peerId) && state !== 'done' && askConfirm(s, peerId, nonce), 2500);
    };
    const onOpen = () => {
      if (state === 'done') return;
      state = 'done';
      clearInterval(countdown);
      setStatus('ok', icon('check', { size: 18 }), t('invite.connected', { name: peerName }));
      setTimeout(() => m.close(), 1300);
    };
    // The link may already be open (fast local networks) by the time we listen.
    setTimeout(() => {
      if (s.mesh?.links.has(peerId)) onOpen();
      else if (s.mesh?.held.has(peerId)) onHeld();
    }, 0);
    offs.push(
      s.on('link-open', (id) => id === peerId && onOpen()),
      s.on('held', (id) => id === peerId && onHeld()),
      s.on('notice', (n) => {
        if (n.peerId !== peerId || state === 'done') return;
        if (n.kind === 'rejected') {
          state = 'done';
          setStatus('bad', icon('warning', { size: 18 }), t('invite.rejected', { name: n.name, count: n.count, max: n.max }));
        }
      }),
      s.on('link-failed', (f) => {
        if (f.peerId !== peerId || state === 'done') return;
        state = 'failed';
        replace(body, failureBox(app, f.diagnosis, () => (m.close(), inviteModal(app, { session, friend, title, call }))));
      }),
    );
  };

  function askConfirm(s, peerId, nonce) {
    const inputs = wordInputs(t, { idPrefix: 'confirm-word', onReady: () => check() });
    const cerr = h('p', { class: 'form-error', role: 'alert' });
    const btn = h('button', { class: 'btn btn-brand', type: 'button', onclick: () => check() }, t('pair.confirm'));
    const box = h('section', { class: 'hl-step confirm-step' }, h('h3', { class: 'step-title' }, t('pair.confirmTitle', { name: peerName })), h('p', { class: 'muted' }, t('pair.confirmHint', { name: peerName })), inputs.el, cerr, h('div', { class: 'row-btns' }, btn));
    replace(body, box, status);
    setStatus('', h('span', { class: 'dot alone' }), t('pair.confirmWaiting', { name: peerName }));
    setTimeout(() => inputs.focus(), 50);
    async function check() {
      const res = inputs.values();
      if (!res.ok) return (cerr.textContent = t('words.incomplete'));
      btn.disabled = true;
      const r = await s.confirmHeld(peerId, res.words, nonce);
      btn.disabled = false;
      if (r === 'ok') {
        replace(body, status);
        setStatus('', h('span', { class: 'spinner spinner-xs' }), t('invite.connecting', { name: peerName }));
      } else if (r === 'refused') {
        state = 'done';
        replace(body, h('div', { class: 'fail-box', role: 'alert' }, h('div', { class: 'fail-head' }, icon('warning', { size: 20 }), h('strong', null, t('pair.refusedHost', { name: peerName })))));
      } else {
        inputs.setError();
        cerr.textContent = t('pair.wrong', { left: r.left });
      }
    }
  }

  /** Apply a reply once. Repeats (paste then click, another tab, two relays) say "Already connected". */
  async function accept(reply, { hold = false, nonce } = {}) {
    if (state === 'connecting' || state === 'confirming' || state === 'done') {
      if (state === 'done') setStatus('ok', icon('check', { size: 18 }), t('fail.answered'));
      return;
    }
    if (reply.inviteId !== invite.inviteId) {
      const other = app.invites.get(reply.inviteId);
      if (other) return other.accept(reply);
      return setError(t('fail.expired'));
    }
    state = 'connecting';
    peerName = reply.peer.name;
    setStatus('', h('span', { class: 'spinner spinner-xs' }), t('invite.connecting', { name: peerName }));
    try {
      // Listen before the answer is applied: a full den can refuse the guest at once.
      if (session) watch(session, reply.peer.id, nonce);
      const target = await invite.accept(reply, { hold });
      // "Call a friend": ring them as soon as the link is up.
      if (call && target.isDirect && !target.pendingCall) target.pendingCall = 'voice';
      if (hold) target.expectPairing(reply.peer.id, nonce);
      if (target !== session) watch(target, reply.peer.id, nonce);
      setError('');
    } catch (e) {
      if (e instanceof MeshError && e.reason === 'answered') {
        state = 'done';
        return setStatus('ok', icon('check', { size: 18 }), t('fail.answered'));
      }
      state = 'waiting';
      setStatus('', h('span', { class: 'dot alone' }), t('invite.waiting'));
      setError(codeErrorText(t, e));
    }
  }

  try {
    invite = await makeInvite(app, { session, friend });
  } catch (e) {
    replace(body, h('p', { class: 'form-error' }, codeErrorText(t, e)));
    return;
  }
  if (!m.open) return invite.cancel?.();
  app.invites.set(invite.inviteId, { accept });
  const notes = [
    session?.den.locked ? h('p', { class: 'callout-warn' }, icon('lock', { size: 16 }), t('invite.locked')) : null,
    invite.full ? h('p', { class: 'callout-warn full-note', role: 'status' }, icon('members', { size: 16 }), t('invite.full', { count: invite.count, max: invite.max })) : null,
  ];


  const nonce = randomId(12);
  creator = new CodeCreator(Promise.resolve({ invite: invite.payload, nonce }));
  creator.on('status', (st) => relays && (relays.textContent = relaysText(t, st)));
  creator.on('expired', () => {
    if (state !== 'waiting') return;
    state = 'failed';
    clearInterval(countdown);
    replace(body, h('div', { class: 'fail-box', role: 'alert' }, h('div', { class: 'fail-head' }, icon('warning', { size: 20 }), h('strong', null, t('pair.expired'))), h('button', { class: 'btn btn-brand btn-sm', type: 'button', onclick: () => (m.close(), inviteModal(app, { session, friend, title, call })) }, t('fail.retry'))));
  });
  creator.on('answer', async (msg) => {
    creator.stop();
    clearInterval(countdown);
    try {
      await accept(readReply(msg.reply), { hold: true, nonce });
    } catch (e) {
      setError(codeErrorText(t, e));
    }
  });
  const relays = h('span', { class: 'pair-relays' }, t('pair.relaysConnecting'));
  let words;
  try {
    words = await creator.start();
  } catch {
    if (!m.open) return;
    creator.stop();
    replace(body, h('div', { class: 'fail-box', role: 'alert' }, h('div', { class: 'fail-head' }, icon('warning', { size: 20 }), h('strong', null, t('pair.norelay'))), h('button', { class: 'btn btn-brand btn-sm', type: 'button', onclick: () => (m.close(), inviteModal(app, { session, friend, title, call })) }, t('fail.retry'))));
    return;
  }
  if (!m.open) return creator.stop();
  relays.textContent = relaysText(t, creator.hub.status());
  const link = wordsLink(app.baseUrl, words);
  const timer = h('span', { class: 'pair-timer', 'aria-label': t('pair.expiresIn') });
  const tick = () => {
    const left = Math.max(0, creator.expires - Date.now());
    timer.textContent = `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}`;
    timer.classList.toggle('low', left < 60000);
    timer.style.setProperty('--left', String(left / CODE_LIFETIME_MS));
  };
  tick();
  countdown = setInterval(tick, 1000);
  const copyBtn = h(
    'button',
    {
      class: 'btn btn-ghost btn-sm',
      type: 'button',
      onclick: async () => {
        await copyText(words.join(' '));
        toast(t('notice.copied'), 'ok');
      },
    },
    icon('copy', { size: 16 }),
    t('pair.copyWords'),
  );
  const shareText = t('pair.shareText', { words: words.join(' ') });
  const shareBtn = navigator.share ? h('button', { class: `btn btn-sm ${call ? 'btn-brand' : 'btn-ghost'}`, type: 'button', onclick: () => shareWords(false) }, icon('share', { size: 16 }), t('invite.share')) : null;
  // Only the words are shared, as text. The share sheet needs a recent tap;
  // when the words took too long, the Share button asks for one.
  async function shareWords(auto) {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'howlden', text: shareText });
        return;
      } catch (e) {
        if (e?.name === 'AbortError') return;
        if (auto && shareBtn) {
          shareBtn.classList.add('nudge');
          shareBtn.focus({ preventScroll: true });
          return;
        }
      }
    }
    if (await copyText(shareText)) toast(t('notice.copiedWords'), 'ok');
  }
  replace(
    body,
    h('p', { class: 'muted' }, call ? t('pair.leadCall') : friend ? t('pair.leadFriend') : t('pair.lead')),
    h(
      'div',
      { class: 'pair-hero' },
      wordList(words, 'invite-words'),
      h('div', { class: 'pair-side' }, h('div', { class: 'share-qr small' }, qrElement(link, t('pair.qrLabel'))), h('span', { class: 'pair-scan' }, t('pair.scanHint')), h('div', { class: 'pair-meta' }, icon('signal', { size: 14 }), timer)),
    ),
    h('div', { class: 'row-btns' }, shareBtn, copyBtn, relays),
    notes,
    h('p', { class: 'pair-note' }, icon('shield', { size: 16 }), t('pair.privacy')),
    err,
    status,
  );
  setStatus('', h('span', { class: 'dot alone' }), t(call ? 'pair.waitingCall' : 'pair.waiting'));
  if (autoShare) await shareWords(true);
}

// Joining

function inviteCard(app, invite) {
  const t = app.t;
  const known = app.friends.get(invite.host.id);
  const clash = !known && app.friends.list().some((f) => f.name.toLowerCase() === invite.host.name.toLowerCase());
  const keyOk = !!known && known.publicKey === invite.host.publicKey;
  const badge = keyOk
    ? h('span', { class: 'verified' }, icon('shield', { size: 14 }), t('id.knownFriend'))
    : known
      ? h('span', { class: 'warn-tag' }, icon('warning', { size: 14 }), t('id.keyChanged'))
      : clash
        ? h('span', { class: 'warn-tag' }, icon('warning', { size: 14 }), t('id.nameClash'))
        : h('span', { class: 'new-tag' }, t('id.newPerson'));
  const hostName = invite.host.tag ? `${invite.host.name}#${invite.host.tag}` : invite.host.name;
  const pass = invite.den.locked ? h('input', { class: 'input field-input', type: 'password', autocomplete: 'off', required: true, id: 'join-pass' }) : null;
  const el = [
    h(
      'div',
      { class: 'join-hero' },
      h('img', { class: 'av', src: avatarSrc(invite.host.avatar || invite.host.id), alt: '', width: 72, height: 72 }),
      h('p', { class: 'muted' }, invite.kind === 'dm' ? t('join.dmFrom', { host: hostName }) : t('join.invited', { host: hostName })),
      invite.kind === 'dm' ? null : h('h3', { class: 'join-den' }, invite.den.name),
      badge,
    ),
    invite.den.full ? h('p', { class: 'callout-warn', role: 'status' }, icon('members', { size: 16 }), t('join.fullInvite', invite.den.full)) : null,
    (known && !keyOk) || clash ? h('p', { class: 'callout-warn' }, icon('warning', { size: 16 }), t(known ? 'id.keyChangedHint' : 'id.nameClashHint', { name: invite.host.name })) : null,
    pass ? h('label', { class: 'hl-field', for: 'join-pass' }, h('span', { class: 'field-label' }, t('join.passphrase')), pass, h('span', { class: 'field-hint' }, t('join.passphraseHint'))) : null,
    h('div', { class: 'join-as' }, h('span', { class: 'muted' }, t('join.as')), h('img', { class: 'av', src: avatarSrc(app.profile.avatar), alt: '', width: 24, height: 24 }), h('strong', null, `${app.profile.name}#${app.profile.tag}`)),
  ];
  return { el, pass, keyOk };
}

/**
 * Guest side, after the six words found the invite (options.joiner): the
 * reply goes back through the relays by itself, then the guest shows
 * confirmation words for the inviter to type.
 */
export function joinModal(app, invite, { joiner, nonce, m: existing } = {}) {
  const t = app.t;
  const card = inviteCard(app, invite);
  const err = h('p', { class: 'form-error', role: 'alert' });
  const body = existing ? existing.body.firstChild : h('div', { class: 'hl-stack' });
  const accept = h('button', { class: 'btn btn-brand btn-lg btn-block', type: 'button' }, t(invite.kind === 'dm' ? 'join.acceptDm' : 'join.accept'));
  replace(body, card.el, err, accept);
  const m =
    existing ||
    modal({
      title: t('join.title'),
      className: 'join-modal',
      closeLabel: t('common.close'),
      body: [body],
      onClose: () => joiner?.stop(),
    });
  let started = false;
  const go = async () => {
    if (started) return;
    if (card.pass && !card.pass.value) return card.pass.focus();
    started = true;
    accept.disabled = true;
    accept.textContent = t('join.making');
    let session;
    let reply;
    try {
      ({ session, reply } = await app.answerInvite(invite, card.pass?.value));
    } catch (e) {
      started = false;
      err.textContent = codeErrorText(t, e);
      accept.disabled = false;
      accept.textContent = t('join.accept');
      return;
    }
    if (!m.open) return;
    const status = h('div', { class: 'invite-status', 'aria-live': 'polite' }, h('span', { class: 'spinner spinner-xs' }), t('join.waiting', { host: invite.host.name }));
    joiner?.sendAnswer({ reply: reply.payload });
    replace(body, card.el[0], status);
    let welcomed = false;
    const fail = (text, cls = 'warning') => {
      offs.forEach((off) => off());
      joiner?.stop();
      replace(body, h('div', { class: 'fail-box', role: 'alert' }, h('div', { class: 'fail-head' }, icon(cls, { size: 20 }), h('strong', { class: 'full-msg' }, text))));
    };
    const offs = [
      session.on('link-open', async (id) => {
        if (id !== invite.host.id || !joiner) return;
        joiner.stop();
        const words = await session.confirmationWords(id, nonce);
        if (!words || welcomed) return;
        replace(body, card.el[0], h('section', { class: 'hl-step' }, h('h3', { class: 'step-title' }, t('pair.showTitle', { host: invite.host.name })), h('p', { class: 'muted' }, t('pair.showHint', { host: invite.host.name })), wordList(words, 'confirm-words')), status);
        replace(status, h('span', { class: 'spinner spinner-xs' }), t('pair.waitHost', { host: invite.host.name }));
      }),
      session.on('welcome', () => {
        welcomed = true;
        offs.forEach((off) => off());
        replace(body, status);
        replace(status, icon('check', { size: 18 }), t('join.connected', { den: session.isDirect ? invite.host.name : session.den.name }));
        status.className = 'invite-status ok';
        setTimeout(() => {
          m.close();
          app.openSession(session);
        }, 900);
      }),
      session.on('notice', (n) => {
        if (n.kind === 'full') {
          app.discardEmptyDen(session);
          fail(t('join.full', { count: n.count, max: n.max }), 'members');
        } else if (n.kind === 'refused') {
          app.discardEmptyDen(session);
          fail(t('pair.refusedGuest', { host: invite.host.name }));
        }
      }),
      session.on('link-failed', (f) => {
        if (f.peerId !== invite.host.id) return;
        offs.forEach((off) => off());
        replace(body, failureBox(app, f.diagnosis));
      }),
    ];
  };
  accept.addEventListener('click', go);
  // Calling a known friend needs only the six words: their key is already trusted.
  if (joiner && card.keyOk && invite.kind === 'dm' && !card.pass) go();
  return m;
}

/** Join with six words: find the invite on the relays, then continue as with a link. */
export async function joinWordsModal(app, words) {
  const t = app.t;
  const status = h('div', { class: 'invite-status', 'aria-live': 'polite' }, h('span', { class: 'spinner spinner-xs' }), t('pair.finding'));
  const body = h('div', { class: 'hl-stack' }, wordList(words, 'small'), status);
  const joiner = new CodeJoiner();
  let offered = false;
  const m = modal({ title: t('join.title'), className: 'join-modal', closeLabel: t('common.close'), body: [body], onClose: () => joiner.stop() });
  const fail = (text) => {
    joiner.stop();
    replace(body, h('div', { class: 'fail-box', role: 'alert' }, h('div', { class: 'fail-head' }, icon('warning', { size: 20 }), h('strong', { class: 'pair-fail' }, text))), h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => (m.close(), joinEntryModal(app)) }, t('pair.tryAgain')));
  };
  joiner.on('status', (st) => !offered && st.connected.length && replace(status, h('span', { class: 'spinner spinner-xs' }), t('pair.knocking', { n: st.connected.length, total: st.total })));
  joiner.on('timeout', () => !offered && fail(t('pair.nobody')));
  joiner.on('offer', (msg) => {
    if (offered || !m.open) return;
    let invite;
    try {
      invite = readInvite(msg.invite);
    } catch {
      return fail(t('fail.damaged'));
    }
    offered = true;
    if (invite.host.id === app.profile.id) return fail(t('fail.self'));
    joinModal(app, invite, { joiner, nonce: String(msg.nonce || '').slice(0, 64), m });
  });
  try {
    await joiner.start(words);
  } catch {
    if (m.open) fail(t('pair.norelayJoin'));
  }
}

/** The Join dialog: type the six words, or scan the QR code. */
export function joinEntryModal(app) {
  const t = app.t;
  const err = h('p', { class: 'form-error', role: 'alert' });
  let done = false;
  const goWords = (words) => {
    if (done) return;
    done = true;
    m.close();
    joinWordsModal(app, words);
  };
  const inputs = wordInputs(t, { idPrefix: 'join-word', auto: true, onReady: goWords });
  // A scanned QR code holds the words (as a link a phone camera can open).
  const goText = (text) => {
    const res = resolvePhrase(wordsFromLink(text) || splitPhrase(text));
    if (res.ok) return goWords(res.words);
    err.textContent = t(findCode(text) ? 'fail.oldLink' : 'words.incomplete');
  };
  const m = modal({
    title: t('join.title'),
    lead: t('pair.joinLead'),
    className: 'join-entry',
    closeLabel: t('common.close'),
    body: [
      h('section', { class: 'hl-step' }, h('h3', { class: 'step-title' }, t('pair.typeWords')), inputs.el, h('div', { class: 'row-btns' }, h('button', { class: 'btn btn-brand', type: 'button', onclick: () => (inputs.values().ok ? goWords(inputs.values().words) : (err.textContent = t('words.incomplete'))) }, t('join.continue')), h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => app.scanFlow((text) => goText(text)) }, icon('scan', { size: 16 }), t('invite.scan')))),
      err,
      h('p', { class: 'pair-note' }, icon('shield', { size: 16 }), t('pair.privacy')),
    ],
  });
  setTimeout(() => inputs.focus(), 30);
}
