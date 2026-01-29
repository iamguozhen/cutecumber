// 👇 每次更新程式碼後，請務必修改這裡的版本號 (例如 v7.1 -> v7.2)
// 這樣瀏覽器才會知道有新版本，並強制更新 Service Worker
const CACHE_NAME = 'cutecumber-v7.2'; 

// 核心檔案：App 的骨架，這些一定要存
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://www.gstatic.com/charts/loader.js'
];

// 1. 安裝 (Install)
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Install');
  // 強制讓新的 SW 立刻接管頁面，不用等使用者關閉分頁
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching app shell');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 2. 啟動 (Activate) - 清理舊快取
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activate');
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// 3. 攔截請求 (Fetch) - 混合策略
self.addEventListener('fetch', (event) => {
  // 只處理 GET 請求
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // === 策略 A：圖片資源 (Cache First - 快取優先) ===
  // 如果是圖片，先看快取有沒有。有就直接用 (秒開)，沒有才去網路下載並存起來。
  if (event.request.destination === 'image' || url.pathname.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      event.respondWith(
          caches.match(event.request).then((cachedResponse) => {
              // 1. 如果快取有，直接回傳 (離線顯示的關鍵！)
              if (cachedResponse) {
                  return cachedResponse;
              }
              // 2. 如果快取沒有，去網路抓
              return fetch(event.request).then((networkResponse) => {
                  // 檢查回應是否有效 (跨域圖片 status 可能是 0，這是正常的 opaque response)
                  if (!networkResponse || networkResponse.type === 'error') {
                      return networkResponse;
                  }
                  
                  // 下載成功後，複製一份進快取，給下次離線用
                  const responseClone = networkResponse.clone();
                  caches.open(CACHE_NAME).then((cache) => {
                      cache.put(event.request, responseClone);
                  });
                  
                  return networkResponse;
              }).catch(() => {
                  // 圖片下載失敗 (真的沒網路且沒快取)，可以回傳一個預設的破圖佔位符 (選填)
                  // return caches.match('./icons/icon-192.png'); 
              });
          })
      );
      return; // 結束，不執行下面的策略 B
  }

  // === 策略 B：其他資源 (HTML/JS/API) (Network First - 網路優先) ===
  // 確保程式邏輯永遠是最新的
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 網路請求成功 -> 更新快取
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
            if (event.request.url.startsWith('http')) {
                cache.put(event.request, responseClone);
            }
        });
        return response;
      })
      .catch(() => {
        // 網路請求失敗 (離線模式) -> 讀取快取
        console.log('[Service Worker] Fetch failed; returning offline cache');
        return caches.match(event.request).then((cachedResponse) => {
             if (cachedResponse) return cachedResponse;
             // SPA 離線導回首頁
             if (event.request.mode === 'navigate') return caches.match('./index.html');
        });
      })
  );
});