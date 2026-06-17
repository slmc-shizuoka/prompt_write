/* PROMPT FORGE — Service Worker
   方針:
   - install時のキャッシュ登録は1件ずつ失敗許容（addAllは1件失敗で全滅するため使わない）
   - ナビゲーション要求(ページ遷移)は、ネット失敗時に必ず index.html を返す
     → これでPWA起動時のURLずれ・オフラインでも白画面/接続不可にならない
   - 版数を上げると古いキャッシュを自動破棄 */
const CACHE = 'promptforge-v3';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      // 1件ずつ登録し、失敗してもインストールを止めない
      Promise.all(ASSETS.map(url =>
        c.add(url).catch(err => console.warn('cache skip:', url, err))
      ))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // ページ遷移(ナビゲーション)は network-first。失敗したら index.html を返す
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(() =>
        caches.match('./index.html').then(r => r || caches.match('./'))
      )
    );
    return;
  }

  // その他リソースは cache-first + 取得できたら更新
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        if (res && res.status === 200 && (res.type === 'basic' || res.type === 'default')) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
