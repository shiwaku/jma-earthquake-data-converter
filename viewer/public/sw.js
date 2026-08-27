/**
 * アプリ本体だけをキャッシュするサービスワーカー。
 *
 * 地図データ（PMTiles・MLTタイル・地理院の背景）はキャッシュしない。
 * PMTiles は1本のファイルをRangeリクエストで断片的に読むため、Cache API に
 * 載せると古い版と新しい版の断片が混ざって壊れた読み取りになりうる。
 * ここでの目的はインストールできるようにすることと、2回目以降の起動を速くすること。
 * オフラインでは地図データが出ないので、画面の枠だけが立ち上がる。
 */
const CACHE = 'hypocenter-map-shell-v1'

// 名前が固定のものだけ先に入れる。JS/CSS はビルドごとにファイル名の
// ハッシュが変わるため、実際に取りに行ったものを都度足していく。
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      // addAll は1本でも失敗すると全体が落ちるので、個別に入れる
      await Promise.all(SHELL.map((url) => cache.add(url).catch(() => {})))
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key !== CACHE) await caches.delete(key)
      }
      await self.clients.claim()
    })(),
  )
})

async function put(request, response) {
  // 部分応答や他所からの応答は入れない
  if (!response || response.status !== 200 || response.type !== 'basic') return response
  const cache = await caches.open(CACHE)
  cache.put(request, response.clone())
  return response
}

async function cacheFirst(request) {
  const hit = await caches.match(request)
  if (hit) return hit
  return put(request, await fetch(request))
}

async function networkFirst(request) {
  try {
    return await put(request, await fetch(request))
  } catch (e) {
    const hit = await caches.match(request)
    if (hit) return hit
    // 画面遷移なら、少なくとも枠は出す
    if (request.mode === 'navigate') {
      const shell = await caches.match('./index.html')
      if (shell) return shell
    }
    throw e
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // 配信元が違うもの（タイル・フォント）は素通し
  if (url.origin !== self.location.origin) return
  // Range を伴う取得には触らない
  if (request.headers.has('range')) return

  // 画面そのものはネットワーク優先。新しいビルドを取りこぼさない
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request))
    return
  }
  // ビルド成果物はファイル名にハッシュが入っていて中身が変わらない
  if (url.pathname.includes('/assets/')) {
    event.respondWith(cacheFirst(request))
    return
  }
  // 残り（events.json・アイコン）は差し替わりうるのでネットワーク優先
  event.respondWith(networkFirst(request))
})
