import { DurableObject } from "cloudflare:workers";
import webpush from "web-push";

// リクエストを受け付けてよいサイト（公開ページと Live Server）
const ALLOWED_ORIGINS = [
  "https://kaitomatsumoto04.github.io",
  "http://127.0.0.1:5500",
  "http://127.0.0.1:5501"
];

// ===== タイマー係（端末1台につき1つ作られる Durable Object） =====
export class TimerObject extends DurableObject {
  // タイマーを予約する
  async start(subscription, endTime) {
    await this.ctx.storage.put("subscription", subscription); // 通知の宛先を覚えておく
    await this.ctx.storage.setAlarm(endTime);                 // この時刻に alarm() が呼ばれる
  }

  // 予約を取り消す（一時停止・リセットのとき）
  async cancel() {
    await this.ctx.storage.deleteAlarm();
  }

  // 予約した時刻になると、Cloudflare が自動で呼んでくれる
  async alarm() {
    const subscription = await this.ctx.storage.get("subscription");
    if (!subscription) {
      return;
    }

    webpush.setVapidDetails(
      this.env.VAPID_SUBJECT,
      this.env.VAPID_PUBLIC_KEY,
      this.env.VAPID_PRIVATE_KEY
    );
    const payload = JSON.stringify({
      title: "インターバル終了",
      body: "次のセットを始めましょう"
    });

    try {
      // TTL: 届けられなかったとき何秒まで再送を待つか。休憩の通知は遅れて届いても意味がないので短くする
      await webpush.sendNotification(subscription, payload, { TTL: 60 });
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        // 宛先が無効になっている（通知をオフにした等）ので忘れる
        await this.ctx.storage.delete("subscription");
      } else {
        console.log("通知の送信に失敗:", error.statusCode, error.body);
      }
    }
  }
}

// ===== 受付係（Worker） =====

// CORS のヘッダー（別のサイトからのリクエストを許可するための印）
function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    if (!ALLOWED_ORIGINS.includes(origin)) {
      return new Response("Forbidden", { status: 403 });
    }
    const headers = corsHeaders(origin);

    // 本番のリクエストの前に、ブラウザが「送ってもいい？」と確認してくる（プリフライト）
    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers });
    }

    const data = await request.json();
    if (!data.subscription || !data.subscription.endpoint) {
      return new Response("Bad Request", { status: 400, headers });
    }

    // endpoint（端末ごとに違うURL）を名前にして、その端末専用のタイマー係を呼び出す
    const timer = env.TIMER.getByName(data.subscription.endpoint);
    const path = new URL(request.url).pathname;

    if (path === "/start") {
      if (typeof data.endTime !== "number") {
        return new Response("Bad Request", { status: 400, headers });
      }
      await timer.start(data.subscription, data.endTime);
    } else if (path === "/cancel") {
      await timer.cancel();
    } else {
      return new Response("Not Found", { status: 404, headers });
    }

    return new Response("OK", { headers });
  }
};
