// ===== Service Worker =====
// ホーム画面から起動したときや電波が無いときでもアプリが開くよう、
// ファイルをキャッシュ（端末に保存）しておく係。
// ※ ファイルを変えたときは CACHE_NAME の数字を上げる（古いキャッシュを捨てるため）

const CACHE_NAME = "workout-log-v3";

// 最初に保存しておくファイル一覧
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "https://cdn.jsdelivr.net/npm/chart.js@4",
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js",
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js",
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js"
];

// キャッシュしてよい外部サイト（ライブラリの配布元）
// Firestore やログインの通信はキャッシュすると壊れるので、ここに入れない
const CACHEABLE_HOSTS = ["cdn.jsdelivr.net", "www.gstatic.com"];

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

  // このアプリのファイルと、ライブラリの配布元以外は普通に通す
  const url = new URL(request.url);
  if (url.origin !== self.location.origin && !CACHEABLE_HOSTS.includes(url.hostname)) {
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

// サーバーから通知が届いたとき：通知を表示する
// （iPhoneでは、届いたのに通知を出さないと購読を取り消されることがあるので、必ず表示する）
self.addEventListener("push", function (event) {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "インターバル終了", {
      body: data.body || "",
      icon: "./icon-192.png",
      tag: "interval-timer" // 同じtagの通知は上書きされ、溜まらない
    })
  );
});

// 通知をタップしたとき：開いているアプリを前に出す（開いていなければ開く）
self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return self.clients.openWindow("./");
    })
  );
});
