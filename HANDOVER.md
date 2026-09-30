# 引き継ぎ書 — workout-log（筋トレ記録ウェブアプリ）

最終更新: 2026-09-30

---

## 決定事項

- 技術構成: 素のHTML/CSS/JS（フレームワークなし）、データ保存は Firestore（ログイン必須。2026-09-30 に localStorage から移行）
- 公開: GitHub Pages / Public リポジトリ
  - リポジトリ: https://github.com/Kaitomatsumoto04/workout-log
  - 公開URL: https://kaitomatsumoto04.github.io/workout-log/
- 開発環境: VS Code + Live Server（`http://127.0.0.1:5500` で開く。5500が使用中だと `5501` になる）
- 作業フォルダ: `C:\Users\AVANT0059\Documents\workout-log`
- ブランチ: `main`
- UI方針: Apple HIG準拠 + ダークモード（黒ベース）。CSS変数（`:root`）で配色を一括管理
- 画面構成: 1ファイル内の3画面（ホーム／記録する／振り返る）をJSの表示切替で実現
- データ構造:
  - 記録: `{ id, date, part, exercise, sets: [{weight, reps}] }`
  - Firestore: `users/{uid}` に `master`（部位別種目リスト）、`users/{uid}/records/{記録ID}` に記録1件ずつ（記録IDは作成時刻の `Date.now()` を文字列化）
  - 旧localStorageキー `workout-records` / `workout-master` は移行後も消さずに予備として残している。`workout-migrated-{uid}` が引っ越し済みの印
- 実装済み機能: 画面切替 / 部位→種目連動 / 種目追加 / セット行追加 / セットコピー（最後の1行複製）/ 記録保存 / 履歴表示（日付ごとにグループ化）/ 削除 / 月カレンダー（記録日マーク・日タップで詳細・前月翌月）/ 振り返りグラフ（Chart.js・期間部位種目フィルタ・その日の最大重量を折れ線）/ ランニング・HIIT / インターバルタイマー / PWA化 / 記録の編集 / インターバル終了のプッシュ通知 / バックアップ（JSONの書き出し・読み込み）/ ログイン画面（新規登録・ログイン・ログアウト・パスワード再設定）/ Firestore保存（端末間の自動同期・圏外対応・旧データの引っ越し）/ AIトレーナー（Geminiでメニュー提案・種目ごとに記録画面へ）/ ホームの履歴は記録がある日の新しい3日分、古い記録はカレンダーの日付詳細から編集・削除
- プッシュ通知の構成:
  - サーバー: Cloudflare Workers + Durable Objects（無料プラン）。コードは `push-server/`
  - 公開URL: https://push-server.kinntore.workers.dev（`POST /start` で予約、`POST /cancel` で取り消し）
  - Durable Object: クラス `TimerObject` / バインディング `TIMER`。端末ごとに `getByName(購読情報のendpoint)` で1つ
  - 送信: `web-push` ライブラリ（`wrangler.jsonc` に `nodejs_compat` が必要）
  - VAPID鍵: 手元は `push-server/.dev.vars`、本番は `wrangler secret`。公開鍵のみ `script.js` に埋め込む
  - 受け付けるOrigin: GitHub Pages / `127.0.0.1:5500` / `127.0.0.1:5501`（`ALLOWED_ORIGINS`）
  - アプリ側: スタートで `/start`、`stopTimer` 内（動いていたときだけ）で `/cancel`。sw.js の `push` で通知表示、`notificationclick` でアプリを前面へ
- ログインとデータ保存: Firebase（Sparkプラン・無料）
  - プロジェクトID: `workout-log-87f89`。SDKは gstatic CDN の 12.19.0 を `import()` で読み込む（script.js はモジュールではないため）
  - ログイン方式: メールアドレス＋パスワード（Authentication）。ログイン必須
  - データベース: Firestore（Standard / asia-northeast1 東京 / 本番環境モード）
  - データの形: `users/{uid}`（種目リスト）/ `users/{uid}/records/{記録ID}`（記録）
  - セキュリティルール: `users/{userId}/{document=**}` は `request.auth.uid == userId` のときだけ読み書き可
  - 承認済みドメイン: `kaitomatsumoto04.github.io` / `127.0.0.1`
- AIトレーナー（Gemini API・無料枠）:
  - アプリ → `push-server` の `POST /menu`（Firebase の IDトークンを `Authorization: Bearer` で送る）→ Gemini `generateContent`
  - サーバー側コード: `push-server/src/menu.js`。IDトークンは jose で Google の公開鍵（x509）を使って検証
  - APIキー: `GEMINI_API_KEY`（wrangler secret のみ。請求先は未登録＝無料枠）
  - モデル: `gemini-3.5-flash` → `gemini-3.8-flash` → `gemini-3.5-flash-lite` の順に試す（404・429・503・使えない返事なら次へ）
  - 送るデータ: 直近2週間の記録（日付・部位・種目・セット）、条件（部位・時間・場所）、種目リスト。メールアドレスやuidは送らない
  - 返事は JSON（message / title / items / advice）。サーバーで数値の丸め・不正なセットの除去をしてから返す
- 進め方: 機能を1つずつ実装し、都度コミット。コードの変更・追加と git 操作（add / commit / push）は Claude が行い、本人は動作確認と判断を担当（2026-09-30 本人の指示で変更）

## その理由

- フレームワークなし: DOM操作・イベント・状態管理というJSの土台を理解するため。Reactは土台習得後
- localStorage（初期）: サーバー不要で即動き、「保存される達成感」を早く得られる
- Firestoreへ移行: 端末を消すと記録が消える問題の解消、複数端末の同期、フレンド機能の土台のため
- 保存は変わった1件だけ `setDoc` / `deleteDoc`、表示は `onSnapshot` で受け取って描き直す: 描画コードを変えずに済み、ほかの端末の変更も自動で反映される
- 書き込みを await しない: 圏外では電波が戻るまで完了しないため。端末内コピー（persistentLocalCache）に先に反映される
- sw.js は自サイトと CDN（jsdelivr / gstatic）だけキャッシュ: Firestore の長時間通信をキャッシュすると壊れるおそれがあるため
- GitHub Pages: 無料・pushで反映され、Git練習と公開が自然につながる
- Live Server: `file://` 直開きはセキュリティ制限でJSがエラーになるため（`'file:' URLs are treated as unique security origins`）
- CSS変数: `:root` の値だけでライト／ダークを切り替えられる
- 日付文字列 "YYYY-MM-DD": 文字列比較で期間判定でき、記録との一致判定も容易
- Web Push（サーバーから通知）: iPhoneは裏に回したアプリのJSを止めるため、ほかのアプリ使用中に通知するにはサーバー側で時間を数える必要がある
- Cloudflare Durable Objects: 無料プランで使え、`setAlarm` で指定時刻に処理を起こせる。サーバー管理不要
- `/cancel` を `stopTimer` 1か所に置く: 一時停止・リセット・秒数切替がすべて `stopTimer` を通るため
- VAPID秘密鍵をコミットしない: Publicリポジトリのため。漏れると第三者が通知を送れる

## 却下した案とNGの理由

- 最初からReact: ビルドツールとJS前提知識が必要で、初学段階では挫折リスクが高い
- 最初からバックエンド+DB: 学習コストが高く、最初の1本には重い
- MVPに月カレンダーを含める: 日付計算・月送り・マス描画で単体テーマ級の重さ。MVP完成後の第3弾に回した（実装済み）
- MVPにグラフを含める: 外部ライブラリの学習が必要。第2弾に回した（実装済み）
- セット数を1つの数値で持つ設計: 実際のトレは「1セット目60kg×10、2セット目55kg×8」と別々。sets配列に変更
- リポジトリをPrivate化: 無料プランではPrivateリポジトリのGitHub Pages公開が不可。公開されるのはコードのみ。記録データは Firestore のセキュリティルールで本人以外読めないため、Publicのまま運用（`firebaseConfig` は公開してよい情報。VAPID秘密鍵はコミットしない）
- Gemini の有料枠: 無料枠で十分なため。無料枠は送った内容が Google のサービス改善に使われることがあるので、送る項目を最小限にした
- Gemini の APIキーをアプリに置く: Publicリポジトリで漏れ、だれでも無料枠を使い切れてしまう
- `gemini-2.5-flash`: 新しい利用者には提供終了（404）
- ホームの履歴を「今日を含む3日間」にする: しばらく休んだあとに開くと空になるため、「記録がある日の新しい3日分」にした
- 本人がコードを手で書き、Claudeは提示と行番号案内のみ（〜2026-09-30）: 本人の指示により、Claudeが実装とgit操作まで行う方式に変更
- Googleログイン: iPhoneのホーム画面PWAではポップアップの結果がアプリに戻らない報告が多く、画面遷移方式はGitHub Pagesでは同一ドメインのログイン用ファイルを置けないため
- メールリンクでのログイン: リンクがSafariで開き、ホーム画面PWA側がログイン状態にならない
- ログイン任意（未ログインはlocalStorage、ログイン後はFirestore）: データの置き場所が2か所になり、ずれたときの処理が必要で複雑。フレンド機能の土台にもなりにくい
- 通知をアプリ内のNotification APIだけで出す: iPhoneでは裏に回るとJSが止まり、時間どおりに通知できない
- Wake Lock（タイマー中は画面を消さない）: ほかのアプリに切り替えると鳴らない
- ショートカットApp経由で純正タイマーを起動: 毎回アプリが切り替わり、一時停止・リセットと連動しない。JSの学習にもならない
- AGENTS.md（Cloudflare作成時の提案）: コードは本人が書く方針で使いどころが少なく、ファイルが増えて見通しが悪くなる

## 次のアクション

- 未実装機能
  - 前回記録との比較表示
- Firebase の小さな課題（急ぎではない）
  - 新規登録はだれでもできる状態。必要になったら制限を検討
  - Firebase SDK のバージョンを上げるときは script.js の `FIREBASE_URL` と sw.js の `ASSETS` の両方を変え、`CACHE_NAME` を上げる
- 通知の小さな課題（急ぎではない）
  - アプリを開いたまま0秒になると、音と通知が重なることがある
  - iPhoneは `navigator.vibrate` 非対応で振動しない。マナーモードで音が鳴らない可能性あり（未確認）
- 第3弾（大きなステップアップ）
  - ユーザーアカウント: 完了（Firebase Authentication + Firestore）
  - 残り: フレンドの記録閲覧。フレンド関係のデータ設計と、フレンドにだけ読ませるセキュリティルールの追加が必要
- Git運用の次の練習: ブランチを切って修正 → マージ（branch / merge）

## 作業再開時の手順

1. VS Codeで `C:\Users\AVANT0059\Documents\workout-log` を開く
2. `git status` / `git --no-pager log --oneline -5` で状態確認
3. `index.html` を右クリック → Open with Live Server（`file://` で開かない）
4. アプリを変更したら機能単位で `git add <ファイル名>` → `git commit -m "..."` → `git push`。push前に `git status` で変更ファイルが漏れていないか確認
5. 通知サーバー（`push-server/`）を変更したら、`push-server` フォルダで `npm run deploy`（GitHubへのpushではサーバーに反映されない）
6. サーバーのログを見るときは `push-server` フォルダで `npx wrangler tail`

## つまずきメモ

- `git log` の `(END)` 表示から抜けられない → `q` を押す。または `git --no-pager log --oneline`
- `git add.` はエラー → `git add .`（間にスペース）
- `git add .` は `server.md` などの手元メモまで入る → ファイル名を指定して add する
- JSはエラーに当たるとその場で停止し、以降のコードが動かない → 開発者ツール（`Ctrl+Shift+I`。F12は別機能に割り当て済み）のConsoleでエラーを読むのがデバッグの第一手
- Chart.jsは描き直す前に `chartInstance.destroy()` が必要
- ダーク背景ではChart.jsの文字色を明示指定しないと読めない
- iPhoneで変更が反映されない → まず変更がコミット・pushされているか確認。その後アプリを完全に終了して開き直す（2回）
- iPhoneのホーム画面アイコンは削除しない（記録が消えるおそれ）
- `wrangler.jsonc` の書き間違いで `npm run dev` が起動しない → `curl` が `Could not connect` になる。起動時の赤いエラーを読む
- CORSエラー（`No 'Access-Control-Allow-Origin'`）→ Live Serverのポート番号が `ALLOWED_ORIGINS` に入っているか確認
- `LF will be replaced by CRLF` の警告は改行コードの注意で、動作に影響なし
