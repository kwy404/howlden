// Home: friends list, direct messages, and the first steps for new dens.

import { h, replace } from './dom.js';
import { icon } from './icons.js';
import { avatarImg, closePopover, popover } from './ui-shell.js';
import { confirmDialog } from './ui-modal.js';
import { avatarTraits } from '../core/avatar.js';
import { DM_TEXT } from './session.js';

const ago = (app, ts) => {
  if (!ts) return '';
  const min = Math.round((Date.now() - ts) / 60000);
  if (min < 1) return app.t('home.justNow');
  if (min < 60) return app.t('home.minutesAgo', { n: min });
  const hrs = Math.round(min / 60);
  if (hrs < 24) return app.t('home.hoursAgo', { n: hrs });
  return new Date(ts).toLocaleDateString(app.lang);
};

/** Sidebar on the home screen: friends link, direct messages, dens. */
export function renderHomeSide(app) {
  const t = app.t;
  const dms = [...app.sessions.values()].filter((s) => s.isDirect).sort((a, b) => lastTs(b) - lastTs(a));
  return [
    h('div', { class: 'side-head static' }, h('span', { class: 'side-title' }, 'howlden')),
    h(
      'nav',
      { class: 'channels', 'aria-label': t('app.home') },
      h('button', { class: `ch home-link${!app.activeDen ? ' active' : ''}`, type: 'button', 'aria-current': !app.activeDen ? 'page' : null, onclick: () => app.openHome() }, icon('members', { size: 20 }), h('span', { class: 'ch-name' }, t('home.friends'))),
      h('button', { class: 'ch', type: 'button', onclick: () => app.createDenFlow() }, icon('plus', { size: 20 }), h('span', { class: 'ch-name' }, t('home.create'))),
      h('button', { class: 'ch', type: 'button', onclick: () => app.joinFlow() }, icon('compass', { size: 20 }), h('span', { class: 'ch-name' }, t('home.join'))),
      h('div', { class: 'cat' }, h('span', { class: 'cat-label' }, t('home.dms')), h('button', { class: 'icon-btn cat-add', type: 'button', 'aria-label': t('home.addFriend'), 'data-tip': t('home.addFriend'), onclick: () => app.friendInviteFlow() }, icon('plus', { size: 16 }))),
      dms.length
        ? dms.map((s) => {
            const f = app.friends.get(s.den.peer) || s.member(s.den.peer) || { id: s.den.peer, name: s.den.name };
            const online = s.mesh?.links.has(s.den.peer);
            const u = s.unread(DM_TEXT);
            const active = app.activeDen === s;
            return h(
              'button',
              { class: `ch dm-link${active ? ' active' : ''}${u.count && !active ? ' unread' : ''}`, type: 'button', 'aria-current': active ? 'page' : null, onclick: () => app.openSession(s) },
              h('span', { class: 'avatar-wrap s32' }, avatarImg(f.avatar || f.id, { size: 32 }), h('span', { class: `status-dot ${online ? 'on' : 'off'}` })),
              h('span', { class: 'dm-text' }, h('span', { class: 'ch-name' }, f.name), f.status ? h('span', { class: 'dm-sub' }, f.status) : null),
              u.count && !active ? h('span', { class: 'badge-count' }, String(u.count)) : null,
            );
          })
        : h('p', { class: 'side-empty' }, t('home.noDms')),
    ),
  ];
}

function lastTs(s) {
  let ts = s.den.createdAt || 0;
  for (const r of s.messages.values()) if (r.ts > ts) ts = r.ts;
  return ts;
}

/** The friends page in the main area. */
export function renderHome(app, el) {
  const t = app.t;
  const tab = app.homeTab || 'all';
  const friends = app.friends.list();
  const online = friends.filter((f) => app.friends.isOnline(f.id));
  const tabBtn = (key, label) => h('button', { class: `tab${tab === key ? ' active' : ''}${key === 'add' ? ' tab-add' : ''}`, type: 'button', role: 'tab', 'aria-selected': String(tab === key), onclick: () => ((app.homeTab = key), app.render()) }, label);
  const head = h('div', { class: 'home-tabs', role: 'tablist', 'aria-label': t('home.friends') }, icon('members', { size: 20, cls: 'muted' }), h('strong', null, t('home.friends')), h('span', { class: 'hd-divider' }), tabBtn('online', t('home.online')), tabBtn('all', t('home.all')), tabBtn('add', t('home.addFriend')));
  let body;
  if (tab === 'add' || !friends.length) {
    body = h(
      'div',
      { class: 'home-add' },
      h(
        'section',
        { class: 'add-card' },
        friends.length ? null : h('img', { class: 'empty-art left', src: '../assets/art/characters/pip.svg', alt: '', width: 120, height: 120 }),
        h('h2', null, t('home.addFriend')),
        h('p', { class: 'muted' }, t('home.addFriendText')),
        h('div', { class: 'row-btns' }, h('button', { class: 'btn btn-brand', type: 'button', onclick: () => app.friendInviteFlow() }, icon('invite', { size: 18 }), t('home.friendInvite')), h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => app.joinFlow() }, icon('enter', { size: 18 }), t('home.pasteInvite'))),
      ),
      h(
        'div',
        { class: 'home-cards' },
        h('button', { class: 'home-card', type: 'button', onclick: () => app.createDenFlow() }, h('span', { class: 'home-card-ico' }, icon('plus', { size: 28 })), h('strong', null, t('home.create')), h('span', null, t('home.createHint'))),
        h('button', { class: 'home-card', type: 'button', onclick: () => app.joinFlow() }, h('span', { class: 'home-card-ico' }, icon('compass', { size: 28 })), h('strong', null, t('home.join')), h('span', null, t('home.joinHint'))),
      ),
      h('section', { class: 'home-how' }, h('h3', null, t('home.howTitle')), h('ol', null, h('li', null, t('home.how1')), h('li', null, t('home.how2')), h('li', null, t('home.how3')))),
      h('p', { class: 'home-privacy' }, icon('shield', { size: 18 }), t('home.privacy')),
    );
  } else {
    const shown = tab === 'online' ? online : friends;
    body = h(
      'div',
      { class: 'friends' },
      h('h2', { class: 'members-head' }, `${t(tab === 'online' ? 'home.online' : 'home.all')}, ${shown.length}`),
      shown.length
        ? h(
            'ul',
            { class: 'friend-list' },
            shown.map((f) => {
              const on = app.friends.isOnline(f.id);
              return h(
                'li',
                { class: 'friend' },
                h('button', { class: 'friend-main', type: 'button', onclick: () => app.messageFriend(f) }, h('span', { class: 'avatar-wrap s32' }, avatarImg(f.avatar || f.id, { size: 32 }), h('span', { class: `status-dot ${on ? 'on' : 'off'}` })), h('span', { class: 'friend-text' }, h('span', { class: 'friend-name' }, f.name, h('span', { class: 'friend-tag' }, `#${f.tag}`)), h('span', { class: 'friend-sub' }, f.status || (on ? t('home.connected') : t('home.lastSeen', { when: ago(app, f.lastSeen) }))))),
                h('span', { class: 'verified', title: t('id.verifiedHint') }, icon('shield', { size: 14 }), t('id.verified')),
                h(
                  'div',
                  { class: 'friend-actions' },
                  h('button', { class: 'round-sm', type: 'button', 'aria-label': t('home.message', { name: f.name }), 'data-tip': t('home.messageShort'), onclick: () => app.messageFriend(f) }, icon('send', { size: 18 })),
                  h('button', { class: 'round-sm', type: 'button', 'aria-label': t('call.voice', { name: f.name }), 'data-tip': t('call.voiceShort'), onclick: () => app.callFriend(f, false) }, icon('speaker', { size: 18 })),
                  h('button', { class: 'round-sm', type: 'button', 'aria-label': t('call.video', { name: f.name }), 'data-tip': t('call.videoShort'), onclick: () => app.callFriend(f, true) }, icon('camera', { size: 18 })),
                  h(
                    'button',
                    {
                      class: 'round-sm',
                      type: 'button',
                      'aria-label': t('home.more'),
                      'aria-haspopup': 'menu',
                      onclick: (e) =>
                        popover(
                          e.currentTarget,
                          h(
                            'div',
                            { class: 'menu', role: 'menu' },
                            h(
                              'button',
                              {
                                class: 'menu-item danger',
                                type: 'button',
                                role: 'menuitem',
                                onclick: async () => {
                                  closePopover();
                                  if (await confirmDialog(t, { title: t('home.removeFriend'), text: t('home.removeFriendText', { name: f.name }), ok: t('common.remove'), danger: true })) app.friends.remove(f.id);
                                },
                              },
                              h('span', null, t('home.removeFriend')),
                              icon('trash', { size: 16 }),
                            ),
                          ),
                          { placement: 'left' },
                        ),
                    },
                    icon('dots', { size: 18 }),
                  ),
                ),
              );
            }),
          )
        : h('p', { class: 'muted pad' }, t('home.nobodyOnline')),
      h('p', { class: 'home-note' }, icon('info', { size: 16 }), t('home.reconnectNote')),
    );
  }
  replace(el, head, body);
}

/** Header for a direct conversation. */
export function renderDmHeader(app, el, s) {
  const t = app.t;
  const f = app.friends.get(s.den.peer) || s.member(s.den.peer) || { id: s.den.peer, name: s.den.name };
  const online = s.mesh?.links.has(s.den.peer);
  const idState = s.identityOf(s.den.peer);
  replace(
    el,
    h('button', { class: 'icon-btn only-mobile', type: 'button', 'aria-label': t('common.menu'), onclick: () => app.drawer('left') }, icon('menu', { size: 22 })),
    h('span', { class: 'avatar-wrap s24' }, avatarImg(f.avatar || f.id, { size: 24 }), h('span', { class: `status-dot ${online ? 'on' : 'off'}` })),
    h('h1', { class: 'hd-title' }, f.name, h('span', { class: 'friend-tag' }, `#${f.tag || s.den.peer.slice(0, 4)}`)),
    idState?.status === 'verified' && idState.friend === 'known' ? h('span', { class: 'verified', title: t('id.verifiedHint') }, icon('shield', { size: 14 }), t('id.verified')) : null,
    idState?.status && idState.status !== 'verified' && idState.status !== 'pending' ? h('span', { class: 'warn-tag' }, icon('warning', { size: 14 }), t('id.failed')) : null,
    h('span', { class: 'hd-status' }, online ? t('home.connected') : t('home.notConnected')),
    h('span', { class: 'hd-spacer' }),
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('call.voice', { name: f.name }), 'data-tip': t('call.voiceShort'), onclick: () => app.callFriend(f, false) }, icon('speaker', { size: 22 })),
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('call.video', { name: f.name }), 'data-tip': t('call.videoShort'), onclick: () => app.callFriend(f, true) }, icon('camera', { size: 22 })),
    online ? null : h('button', { class: 'btn btn-brand btn-sm', type: 'button', onclick: () => app.reconnectFriend(f) }, icon('link', { size: 16 }), t('call.reconnect')),
  );
  el.style.setProperty('--den-hue', avatarTraits(f.avatar || f.id).hue);
}
