// ===== 筋トレメニューの提案（Gemini API） =====
// アプリから条件と直近の記録を受け取り、Gemini にメニューを考えてもらって返す。
// Gemini の APIキーはサーバーにだけ置き、ログインしている人だけが使えるようにする。

import { jwtVerify, importX509 } from "jose";

const FIREBASE_PROJECT_ID = "workout-log-87f89";
// 無料枠で使えるモデルを、使いたい順に並べる。
// 混み合っている（503）・回数制限（429）・提供終了（404）のときは、次のモデルに切り替えて頼み直す
// （回数制限はモデルごとに別なので、別のモデルなら使えることが多い）
// ※ gemini-2.5-flash は新しい利用者には提供終了（404）だったため外した（2026-09-30）
const GEMINI_MODELS = ["gemini-3.5-flash", "gemini-3.8-flash", "gemini-3.5-flash-lite"];
const RETRY_STATUSES = [404, 429, 503, "retry"]; // 次のモデルで頼み直す失敗

// アプリの部位と同じ並び。Gemini にはこの中からしか部位を選ばせない
const PARTS = ["胸", "背中", "肩", "腹筋", "腕", "下半身", "ランニング", "HIIT"];
const PLACES = ["ジム", "自宅（ダンベルあり）", "自宅（自重のみ）", "屋外"];

// ----- ログインの確認（Firebase の IDトークンを検証する） -----

// Google の公開鍵（証明書）の置き場所。トークンの署名が本物かをこれで確かめる
const CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

let cachedCerts = null;     // 取ってきた証明書
let certsExpireAt = 0;      // 取り直す時刻（ミリ秒）

async function getCerts() {
  if (cachedCerts !== null && Date.now() < certsExpireAt) {
    return cachedCerts;
  }
  const response = await fetch(CERTS_URL);
  // Cache-Control の max-age（秒）の間は同じ証明書を使ってよい
  const match = /max-age=(\d+)/.exec(response.headers.get("Cache-Control") || "");
  const maxAge = match ? Number(match[1]) : 3600;
  cachedCerts = await response.json();
  certsExpireAt = Date.now() + maxAge * 1000;
  return cachedCerts;
}

// 本物のトークンなら、ログインしているユーザーのID（uid）を返す。偽物なら例外を投げる
async function verifyIdToken(token) {
  const certs = await getCerts();
  const { payload } = await jwtVerify(
    token,
    async function (header) {
      const cert = certs[header.kid]; // トークンに書かれた鍵の番号（kid）で証明書を選ぶ
      if (!cert) {
        throw new Error("unknown kid");
      }
      return importX509(cert, "RS256");
    },
    {
      algorithms: ["RS256"],
      issuer: "https://securetoken.google.com/" + FIREBASE_PROJECT_ID,
      audience: FIREBASE_PROJECT_ID
      // exp（期限切れ）と iat は jwtVerify が自動で確認する
    }
  );
  if (typeof payload.sub !== "string" || payload.sub === "") {
    throw new Error("no sub");
  }
  if (typeof payload.auth_time !== "number" || payload.auth_time * 1000 > Date.now()) {
    throw new Error("bad auth_time");
  }
  return payload.sub;
}

// ----- Gemini への頼み方 -----

// Gemini に返してほしい JSON の形
const MENU_SCHEMA = {
  type: "OBJECT",
  properties: {
    message: { type: "STRING", description: "最初の声かけ。直近の記録に具体的に触れ、今日のメニューの狙いを伝える（2〜3文）" },
    title: { type: "STRING", description: "メニューの短いタイトル" },
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          part: { type: "STRING", enum: PARTS },
          exercise: { type: "STRING", description: "種目名（日本語）" },
          sets: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                weight: { type: "NUMBER", description: "重量kg（2.5kg刻み）。自重・ランニング・HIITは0" },
                reps: { type: "INTEGER", description: "回数（1以上）。ランニング・HIITは0" },
                distance: { type: "NUMBER", description: "ランニングの距離km。それ以外は0" },
                minutes: { type: "NUMBER", description: "HIITの時間（分）。それ以外は0" }
              },
              // 全項目を必須にする（任意にすると、モデルが回数などを省くことがあるため）
              required: ["weight", "reps", "distance", "minutes"]
            }
          },
          restSeconds: { type: "INTEGER", description: "セット間の休憩（秒）" },
          point: { type: "STRING", description: "トレーナーからのワンポイント。フォームのコツや意識する筋肉を話し言葉で1〜2文" }
        },
        required: ["part", "exercise", "sets", "restSeconds", "point"]
      }
    },
    advice: { type: "STRING", description: "締めの声かけ。休憩・栄養・次回への励ましなど（1〜2文）" }
  },
  required: ["message", "title", "items", "advice"]
};

const SYSTEM_INSTRUCTION = [
  "あなたは利用者専属の「AIトレーナー」です。明るく前向きで、頼りになるパーソナルトレーナーとして、利用者の条件と直近のトレーニング記録から今日のメニューを日本語で提案してください。",
  "話し方:",
  "- 利用者に直接話しかける、親しみやすい丁寧語（です・ます）。堅すぎず、なれなれしすぎない。",
  "- 記録に具体的に触れてほめる・気づかせる（例: 前回より重量が上がった、しばらく間が空いている部位がある、同じ部位が続いている）。記録が無いときは、はじめての人への励ましにする。",
  "- 根拠の無いほめ言葉や大げさな表現は使わない。絵文字は使わない。",
  "メニューのルール:",
  "- 合計時間（休憩を含む）が、指定された時間に収まるようにする。",
  "- 部位が「おまかせ」のときは、直近の記録で間が空いている部位を優先する。",
  "- 場所・器具で実施できない種目は入れない。",
  "- 種目数は時間に合わせる（目安: 30分なら3〜4種目、45分なら4〜5種目、60分なら5〜6種目、90分なら7〜8種目）。",
  "- 筋トレ種目は各3〜4セット。1セットずつ sets に入れ、回数は必ず1以上にする。",
  "- 重量は直近の記録を参考に、同じ種目があればその重量の前後にする。記録が無い種目は控えめな重量にする。重量は2.5kg刻み、自重種目は0。",
  "- 種目名は、種目リストにある名前をできるだけそのまま使う。",
  "- 部位が「ランニング」の種目は distance（km）、「HIIT」は minutes（分）、それ以外は weight と reps に値を入れ、関係ない項目は0にする。",
  "- 安全を最優先し、無理な重量や回数は提案しない。医学的な診断や助言はしない。"
].join("\n");

// アプリから届いた内容を確認して、Gemini に渡す文章を作る。おかしければ null
function buildPrompt(data) {
  const part = data.part === "おまかせ" || PARTS.includes(data.part) ? data.part : null;
  const minutes = Number(data.minutes);
  const place = PLACES.includes(data.place) ? data.place : null;
  if (part === null || place === null || !(minutes >= 10 && minutes <= 180)) {
    return null;
  }

  // 直近の記録は、必要な項目だけにして件数も絞る（送る量と悪用を抑えるため）
  const recentRecords = Array.isArray(data.recentRecords) ? data.recentRecords.slice(0, 100) : [];
  const records = recentRecords.map(function (r) {
    return { date: r.date, part: r.part, exercise: r.exercise, sets: r.sets };
  });
  const master = typeof data.master === "object" && data.master !== null ? data.master : {};

  // 日本時間の今日の日付（記録が何日前かを判断してもらうため）
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const prompt = [
    "今日の日付: " + today,
    "",
    "【条件】",
    "鍛えたい部位: " + part,
    "使える時間: " + minutes + "分",
    "場所・器具: " + place,
    "",
    "【種目リスト（部位ごと）】",
    JSON.stringify(master),
    "",
    "【直近2週間の記録】",
    records.length > 0 ? JSON.stringify(records) : "記録なし"
  ].join("\n");

  // 極端に大きい入力は断る（無料枠の使いすぎを防ぐ）
  return prompt.length <= 30000 ? prompt : null;
}

// モデルを順番に試す。どれかがちゃんと答えてくれたらそれを返す
async function askGemini(prompt, apiKey) {
  let result = { status: 502 };
  for (const model of GEMINI_MODELS) {
    result = await askGeminiModel(model, prompt, apiKey);
    if (result.status === 200) {
      return result;
    }
    // 混雑・回数制限・提供終了・使えない返事なら次のモデルへ。
    // それ以外の失敗（キーが無効など）は、ほかのモデルでも同じなのでやめる
    if (!RETRY_STATUSES.includes(result.status)) {
      return result;
    }
  }
  // 全部だめだった。混雑・回数制限はそのまま、それ以外は 502 としてアプリに返す
  return { status: result.status === 503 || result.status === 429 ? result.status : 502 };
}

// 小数を決まった刻みに丸める（例: 40.00000186 → 40）。step は 0.5 や 0.1
function roundTo(value, step) {
  const k = 1 / step;
  return Math.round((Number(value) || 0) * k) / k;
}

// Gemini の返事を、アプリで使える形に整える
// ・部位に合った項目だけ残し、数字を丸める ・回数や距離が0のセット、セットが無い種目は捨てる
function normalizeMenu(menu) {
  const items = (Array.isArray(menu.items) ? menu.items : []).filter(function (item) {
    return PARTS.includes(item.part) && typeof item.exercise === "string" && item.exercise !== "";
  }).map(function (item) {
    const sets = (Array.isArray(item.sets) ? item.sets : []).map(function (s) {
      if (item.part === "ランニング") {
        return { distance: roundTo(s.distance, 0.1) };
      }
      if (item.part === "HIIT") {
        return { minutes: roundTo(s.minutes, 1) };
      }
      return { weight: roundTo(s.weight, 0.5), reps: Math.round(Number(s.reps) || 0) };
    }).filter(function (s) {
      return (s.reps || s.distance || s.minutes) > 0;
    });
    return {
      part: item.part,
      exercise: item.exercise,
      sets: sets,
      restSeconds: Math.round(Number(item.restSeconds) || 0),
      point: String(item.point || "")
    };
  }).filter(function (item) {
    return item.sets.length > 0;
  });
  return {
    message: String(menu.message || ""),
    title: String(menu.title || ""),
    items: items,
    advice: String(menu.advice || "")
  };
}

async function askGeminiModel(model, prompt, apiKey) {
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent";
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey // キーはURLに入れず、ヘッダーで渡す（ログに残りにくい）
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: MENU_SCHEMA
      }
    })
  });

  if (!response.ok) {
    console.log("Gemini エラー（" + model + "）:", response.status, await response.text());
    // 429 は回数制限、503 は混雑、404 はモデルの提供終了。それ以外はまとめて 502（Gemini 側の失敗）
    if (response.status === 429 || response.status === 503 || response.status === 404) {
      return { status: response.status };
    }
    return { status: 502 };
  }

  const result = await response.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
  let menu;
  try {
    menu = normalizeMenu(JSON.parse(text));
  } catch (error) {
    console.log("Gemini の返事が JSON になっていない（" + model + "）:", text);
    return { status: "retry" };
  }
  if (menu.items.length === 0) {
    console.log("Gemini の返事に使える種目が無い（" + model + "）:", text);
    return { status: "retry" };
  }
  console.log("メニューを作成（" + model + "）: " + menu.items.length + "種目");
  return { status: 200, menu: menu };
}

// ----- /menu の受付 -----

export async function handleMenu(request, env, headers) {
  // Authorization: Bearer <IDトークン> の形で届く
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  try {
    await verifyIdToken(token);
  } catch (error) {
    return new Response("Unauthorized", { status: 401, headers });
  }

  let data;
  try {
    data = await request.json();
  } catch (error) {
    return new Response("Bad Request", { status: 400, headers });
  }
  const prompt = buildPrompt(data);
  if (prompt === null) {
    return new Response("Bad Request", { status: 400, headers });
  }

  const result = await askGemini(prompt, env.GEMINI_API_KEY);
  if (result.status !== 200) {
    return new Response("Gemini Error", { status: result.status, headers });
  }
  return new Response(JSON.stringify(result.menu), {
    headers: { ...headers, "Content-Type": "application/json" }
  });
}
