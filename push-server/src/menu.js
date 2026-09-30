// ===== 筋トレメニューの提案（Gemini API） =====
// アプリから条件と直近の記録を受け取り、Gemini にメニューを考えてもらって返す。
// Gemini の APIキーはサーバーにだけ置き、ログインしている人だけが使えるようにする。

import { jwtVerify, importX509 } from "jose";

const FIREBASE_PROJECT_ID = "workout-log-87f89";
// 無料枠で使えるモデルを、使いたい順に並べる。
// 混み合っている（503）・回数制限（429）のときは、次のモデルに切り替えて頼み直す
// （回数制限はモデルごとに別なので、別のモデルなら使えることが多い）
const GEMINI_MODELS = ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-2.5-flash"];

// アプリの部位と同じ並び。Gemini にはこの中からしか部位を選ばせない
const PARTS = ["胸", "背中", "腹筋", "腕", "下半身", "ランニング", "HIIT"];
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
                weight: { type: "NUMBER", description: "重量kg。自重なら0" },
                reps: { type: "INTEGER", description: "回数" },
                distance: { type: "NUMBER", description: "ランニングの距離km" },
                minutes: { type: "NUMBER", description: "HIITの時間（分）" }
              }
            }
          },
          restSeconds: { type: "INTEGER", description: "セット間の休憩（秒）" },
          point: { type: "STRING", description: "フォームや注意点を1文で" }
        },
        required: ["part", "exercise", "sets", "restSeconds", "point"]
      }
    },
    advice: { type: "STRING", description: "メニュー全体についての一言" }
  },
  required: ["title", "items", "advice"]
};

const SYSTEM_INSTRUCTION = [
  "あなたは経験豊富なパーソナルトレーナーです。利用者の条件と直近のトレーニング記録から、今日の筋トレメニューを日本語で提案してください。",
  "ルール:",
  "- 合計時間（休憩を含む）が、指定された時間に収まるようにする。",
  "- 部位が「おまかせ」のときは、直近の記録で間が空いている部位を優先する。",
  "- 場所・器具で実施できない種目は入れない。",
  "- 重量は直近の記録を参考に、同じ種目があればその重量の前後にする。記録が無い種目は控えめな重量にする。",
  "- 種目名は、種目リストにある名前をできるだけそのまま使う。",
  "- 部位が「ランニング」の種目は sets に distance（km）だけ、「HIIT」は minutes（分）だけ、それ以外は weight と reps を入れる。",
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

  const prompt = [
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

// モデルを順番に試す。どれかが答えてくれたらそれを返す
async function askGemini(prompt, apiKey) {
  let result = { status: 502 };
  for (const model of GEMINI_MODELS) {
    result = await askGeminiModel(model, prompt, apiKey);
    // 成功、または混雑・回数制限以外の失敗（キーが無効など）なら、ほかのモデルでも同じなのでやめる
    if (result.status !== 503 && result.status !== 429) {
      return result;
    }
  }
  return result; // 全部のモデルが混雑・回数制限だった
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
    // 429 は回数制限、503 は混雑。それ以外はまとめて 502（Gemini 側の失敗）としてアプリに返す
    if (response.status === 429 || response.status === 503) {
      return { status: response.status };
    }
    return { status: 502 };
  }

  const result = await response.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
  try {
    return { status: 200, menu: JSON.parse(text) };
  } catch (error) {
    console.log("Gemini の返事が JSON になっていない:", text);
    return { status: 502 };
  }
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
