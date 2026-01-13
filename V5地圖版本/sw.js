// 👇 每次更新程式碼後，請務必修改這裡的版本號 (例如 v6.0 -> v6.1)
const CACHE_NAME = 'cutecumber-v7.1'; // 已更新為 v7.1 以配合新成就與聖誕節修復

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// 1. 安裝 Service Worker (第一次下載檔案)
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching all assets');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  // 強制讓新的 SW 立刻接管頁面
  self.skipWaiting();
});

// 2. 啟動 Service Worker (刪除舊版本快取)
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activate');
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          // 如果發現快取名稱跟現在的不一樣 (例如 v5.7)，就刪掉它
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  // 讓新的 SW 立即控制所有客戶端
  return self.clients.claim();
});

// 3. 攔截網路請求 (Network First - 網路優先策略)
// 這是對開發者與使用者最友善的策略：
// 有網路 -> 抓最新版 -> 存入快取 -> 顯示最新版
// 沒網路 -> 抓快取 -> 顯示舊版 (離線模式)
self.addEventListener('fetch', (event) => {
  // 只處理 GET 請求
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 網路請求成功！
        // 我們把這份新的檔案複製一份，更新到快取裡
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
            // 只快取 http/https 開頭的資源
            if (event.request.url.startsWith('http')) {
                cache.put(event.request, responseClone);
            }
        });
        return response;
      })
      .catch(() => {
        // 網路請求失敗 (離線模式)
        // 這時候才去讀取快取
        console.log('[Service Worker] Fetch failed; returning offline cache');
        return caches.match(event.request).then((cachedResponse) => {
             if (cachedResponse) {
                 return cachedResponse;
             }
             // 如果是 HTML 頁面請求且沒快取，回傳首頁 (SPA Fallback)
             if (event.request.mode === 'navigate') {
                 return caches.match('./index.html');
             }
        });
      })
  );
});