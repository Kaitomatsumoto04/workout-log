// ===== Service Worker =====
// ホーム画面から起動したときや電波が無いときでもアプリが開くよう、
// ファイルをキャッシュ（端末に保存）しておく係。
// ※ ファイルを変えたときは CACHE_NAME の数字を上げる（古いキャッシュを捨てるため）

const CACHE_NAME = "workout-log-v1";

// 最初に保存しておくファイル一覧
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "https://cdn.jsdelivr.net/npm/chart.js@4"
];

// インストール時：一覧のファイルをまとめてキャッシュする
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(ASSETS);
    }).then(function () {
      return self.skipWaiting(); // 新しいSWをすぐ有効にする
    })
  );
});

// 有効化時：古いバージョンのキャッシュを消す
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }));
    }).then(function () {
      return self.clients.claim(); // 開いているページにもすぐ適用する
    })
  );
});

// ファイル取得時：まずネットワーク、失敗したらキャッシュ（ネットワーク優先）
// キャッシュ優先にすると、更新をpushしても古い画面が出続けるため
self.addEventListener("fetch", function (event) {
  const request = event.request;

  // GET以外と http(s) 以外は普通に通す
  if (request.method !== "GET" || !request.url.startsWith("http")) {
    return;
  }

  event.respondWith(
    fetch(request).then(function (response) {
      // 取れた新しい内容をキャッシュに上書きしておく
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(request, copy);
        });
      }
      return response;
    }).catch(function () {
      // オフライン時：キャッシュから返す。無ければトップページを返す
      return caches.match(request).then(function (cached) {
        return cached || caches.match("./index.html");
      });
    })
  );
});
