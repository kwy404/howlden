// howlden service worker: keeps the app shell available offline and opens
// the right channel when a mention notification is clicked.

const CACHE = 'howlden-app-v3';
const SHELL = [
  './',
  'index.html',
  'app.css',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'js/main.js',
  'js/dom.js',
  'js/icons.js',
  'js/i18n.js',
  'js/store.js',
  'js/account.js',
  'js/friends.js',
  'js/session.js',
  'js/media.js',
  'js/ui-modal.js',
  'js/ui-shell.js',
  'js/ui-chat.js',
  'js/ui-voice.js',
  'js/ui-home.js',
  'js/ui-account.js',
  'js/ui-flows.js',
  'js/ui-settings.js',
  'js/ui-pair.js',
  'js/sounds.js',
  'js/stickers.js',
  'js/denoise-worklet.js',
  'core/avatar.js',
  'core/bytes.js',
  'core/call.js',
  'core/dsp.js',
  'core/mqtt.js',
  'core/pairing.js',
  'core/relay.js',
  'core/rendezvous.js',
  'core/sha256.js',
  'core/wordlist.js',
  'core/words.js',
  'core/chunks.js',
  'core/crypto.js',
  'core/denstate.js',
  'core/history.js',
  'core/identity.js',
  'core/invite.js',
  'core/markdown.js',
  'core/mesh.js',
  'core/qr.js',
  'core/rtc.js',
  'core/version.js',
  'https://cdn.jsdelivr.net/npm/monsooncss@0.2.0/dist/monsoon.min.css',
  '../assets/mascot-head.svg',
  '../assets/art/characters/luna.svg',
  '../assets/art/characters/ember.svg',
  '../assets/art/characters/pip.svg',
  '../assets/art/characters/fang.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => Promise.all(SHELL.map((url) => cache.add(url).catch(() => null))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('howlden-app-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Stale while revalidate: answer from the cache, refresh it in the background.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  if (!same && !['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname)) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const key = req.mode === 'navigate' ? 'index.html' : req;
      const hit = await cache.match(key, { ignoreSearch: req.mode === 'navigate' });
      const fresh = fetch(req)
        .then((res) => {
          if (res.ok && (same || res.type === 'cors')) cache.put(key, res.clone());
          return res;
        })
        .catch(() => hit);
      return hit || fresh;
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const client = list.find((c) => new URL(c.url).pathname.startsWith(new URL(self.registration.scope).pathname));
      if (client) {
        client.postMessage({ type: 'open', den: data.den, channel: data.channel });
        return client.focus();
      }
      return self.clients.openWindow('./');
    }),
  );
});
