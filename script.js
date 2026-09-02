// ===== 画面切り替え =====

// 指定したidの画面だけを表示する関数
function showScreen(screenId) {
  // いったん全画面から active を外す
  document.querySelectorAll(".screen").forEach(function (screen) {
    screen.classList.remove("active");
  });
  // 指定された画面にだけ active を付ける
  document.getElementById(screenId).classList.add("active");
}

// 各ボタンがクリックされたら、対応する画面へ切り替える
document.getElementById("go-record").addEventListener("click", function () {
  // カレンダーで日付を選んでいたら、記録画面の日付欄に入れておく
  if (selectedDate !== "") {
    document.getElementById("input-date").value = selectedDate;
  }
  showScreen("screen-record");
});

document.getElementById("go-review").addEventListener("click", function () {
  showScreen("screen-review");
});

document.getElementById("back-home-1").addEventListener("click", function () {
  showScreen("screen-home");
});

document.getElementById("back-home-2").addEventListener("click", function () {
  showScreen("screen-home");
});

// ===== 部位ごとの種目リスト（種目マスタ） =====

// 部位名をキーに、その部位の種目を配列で持つ
// 初期の種目リスト（何も保存が無いとき使う）
const defaultMaster = {
  "胸": ["ベンチプレス", "ダンベルプレス", "チェストプレス", "腕立て伏せ"],
  "背中": ["懸垂", "ラットプルダウン", "デッドリフト", "ローイング"],
  "腹筋": ["クランチ", "プランク", "レッグレイズ"],
  "腕": ["アームカール", "トライセプスプレスダウン", "ダンベルカール"],
  "下半身": ["スクワット", "レッグプレス", "レッグエクステンション", "カーフレイズ"],
  "ランニング": ["屋外ラン", "トレッドミル", "インターバル走"],
  "HIIT": ["バーピー", "マウンテンクライマー", "縄跳び", "サーキット"]
};

// 保存済みがあればそれを、無ければ初期リストを使う
let exerciseMaster = JSON.parse(localStorage.getItem("workout-master")) || defaultMaster;

// 種目マスタを保存する関数
function saveMaster() {
  localStorage.setItem("workout-master", JSON.stringify(exerciseMaster));
}

// 後から増やした部位は保存済みマスタに入っていないので、初期リストで補う
// （これが無いと、追加した部位を選んだとき種目リストが取れずエラーになる）
Object.keys(defaultMaster).forEach(function (part) {
  if (exerciseMaster[part] === undefined) {
    exerciseMaster[part] = defaultMaster[part];
  }
});
saveMaster();

// ===== 部位ごとの入力タイプ =====

// weight: 重量kg × 回数 / distance: 走行距離km / time: 時間(分)
// ここに書かれていない部位はすべて weight 扱い
const partInputType = {
  "ランニング": "distance",
  "HIIT": "time"
};

function getInputType(part) {
  return partInputType[part] || "weight";
}

// 種目プルダウンを、選ばれた部位に合わせて作り直す関数
function updateExerciseOptions(part) {
  const select = document.getElementById("input-exercise");
  select.innerHTML = ""; // いったん中身を空にする

  // 部位が未選択なら案内だけ入れて終了
  if (part === "") {
    select.innerHTML = '<option value="">先に部位を選択</option>';
    return;
  }

  // その部位の種目を1つずつ <option> にして入れる
  const list = exerciseMaster[part] || [];
  list.forEach(function (exercise) {
    const option = document.createElement("option");
    option.value = exercise;
    option.textContent = exercise;
    select.appendChild(option);
  });
}

// 部位が変わったら種目リストを更新
document.getElementById("input-part").addEventListener("change", function () {
  updateExerciseOptions(this.value);

  // 入力の形（重量×回数／距離／時間）が変わるときだけセット欄を作り直す
  // 同じ形のまま部位だけ変えたときは、入力済みの内容を消さない
  const setsArea = document.getElementById("sets-area");
  if (setsArea.dataset.type !== getInputType(this.value)) {
    renderSetsArea(this.value);
  }
});

// ===== 種目の追加 =====

document.getElementById("add-exercise").addEventListener("click", function () {
  const part = document.getElementById("input-part").value;

  // 部位が未選択なら追加できない
  if (part === "") {
    alert("先に部位を選んでください");
    return;
  }

  // 種目名を入力してもらう
  const newExercise = prompt("追加する種目名を入力してください");

  // キャンセルや空入力なら何もしない
  if (newExercise === null || newExercise.trim() === "") {
    return;
  }

  // その部位のリストに追加
  exerciseMaster[part].push(newExercise.trim());
  saveMaster(); 

  // プルダウンを作り直して、追加した種目を選択状態にする
  updateExerciseOptions(part);
  document.getElementById("input-exercise").value = newExercise.trim();
});

// ===== セット行の追加 =====

// セット1行分の要素を作って返す関数
// （追加・コピー・リセットの3か所で使い回す）
// type によって入力欄の中身が変わる
function createSetRow(type) {
  const row = document.createElement("div");
  row.className = "set-row";

  if (type === "distance") {
    // ランニング：走行距離だけ入力する
    row.innerHTML =
      '<input type="number" step="0.1" class="set-distance" placeholder="距離km">' +
      '<span>km</span>';
  } else if (type === "time") {
    // HIIT：時間（分）だけ入力する
    row.innerHTML =
      '<input type="number" class="set-minutes" placeholder="時間">' +
      '<span>分</span>';
  } else {
    // 筋トレ：重量×回数
    row.innerHTML =
      '<input type="number" class="set-weight" placeholder="重量kg">' +
      '<span>kg ×</span>' +
      '<input type="number" class="set-reps" placeholder="回数">' +
      '<span>回</span>';
  }

  return row;
}

// セット欄を、選ばれた部位に合った入力欄1行だけの状態にする
function renderSetsArea(part) {
  const type = getInputType(part);

  const setsArea = document.getElementById("sets-area");
  setsArea.innerHTML = "";
  setsArea.dataset.type = type; // 今どの形の入力欄が並んでいるかを覚えておく
  setsArea.appendChild(createSetRow(type));

  // 見出しも入力内容に合わせて変える
  const heading = document.getElementById("sets-heading");
  if (type === "distance") {
    heading.textContent = "距離";
  } else if (type === "time") {
    heading.textContent = "時間";
  } else {
    heading.textContent = "セット";
  }
}

document.getElementById("add-set").addEventListener("click", function () {
  // 今選ばれている部位に合った行を1行追加する
  const part = document.getElementById("input-part").value;
  document.getElementById("sets-area").appendChild(createSetRow(getInputType(part)));
});

// ===== 入力フォームを次の記録用にリセットする =====

function resetRecordForm() {
  // 日付は同じ日に続けて記録することが多いので残す
  // 部位は「選択してください」に戻す
  document.getElementById("input-part").value = "";
  // 種目は部位が未選択なので「先に部位を選択」に戻る
  updateExerciseOptions("");

  // セット欄を空の1行だけに戻す（前の種目の入力を消す）
  renderSetsArea("");
}

// ===== 記録の保存・読み込み・表示 =====

// 記録データの配列。起動時に localStorage から読み込む（無ければ空配列）
let records = JSON.parse(localStorage.getItem("workout-records")) || [];

// セットの中身を表示用の文字列にする関数
// 例) 60kg×10, 55kg×8 ／ 5km ／ 20分
function formatSets(sets) {
  return sets.map(function (s) {
    if (s.distance !== undefined) {
      return s.distance + "km";
    }
    if (s.minutes !== undefined) {
      return s.minutes + "分";
    }
    return s.weight + "kg×" + s.reps;
  }).join(", ");
}

// 配列を localStorage に保存する関数
function saveRecords() {
  localStorage.setItem("workout-records", JSON.stringify(records));
}

// 履歴一覧を画面に描き直す関数
// 履歴一覧を画面に描き直す関数（削除ボタン付き）
// 履歴一覧を日付ごとにまとめて描き直す関数
function renderHistory() {
  const list = document.getElementById("history-list");
  list.innerHTML = "";

  if (records.length === 0) {
    list.innerHTML = "<li>まだ記録がありません</li>";
    return;
  }

  // ① 日付をキーにして記録をグループ分けする
  const groups = {};
  records.forEach(function (record) {
    // その日付のグループがまだ無ければ空配列を用意
    if (groups[record.date] === undefined) {
      groups[record.date] = [];
    }
    groups[record.date].push(record);
  });

  // ② 日付の一覧を新しい順に並べる
  const dates = Object.keys(groups).sort(function (a, b) {
    return b.localeCompare(a);
  });

  // ③ 日付ごとに「見出し＋その日の種目リスト」を作る
  dates.forEach(function (date) {
    const li = document.createElement("li");
    li.className = "history-group";

    // 日付の見出し
    const dateHead = document.createElement("div");
    dateHead.className = "history-date";
    dateHead.textContent = date;
    li.appendChild(dateHead);

    // その日の記録を1件ずつ
    groups[date].forEach(function (record) {
      const setsText = formatSets(record.sets);

      const row = document.createElement("div");
      row.className = "history-row";

      const span = document.createElement("span");
      span.textContent = record.part + " " + record.exercise + " " + setsText;

      const delBtn = document.createElement("button");
      delBtn.textContent = "削除";
      delBtn.className = "delete-button";
      delBtn.addEventListener("click", function () {
        deleteRecord(record.id);
      });

      row.appendChild(span);
      row.appendChild(delBtn);
      li.appendChild(row);
    });

    list.appendChild(li);
  });
}

// 指定idの記録を削除する関数
function deleteRecord(id) {
  if (!confirm("この記録を削除しますか？")) {
    return;
  }
  // id が一致しないものだけ残す＝一致するものを消す
  records = records.filter(function (r) {
    return r.id !== id;
  });
  saveRecords();
  renderHistory();
}

// 「記録する」ボタン：入力を集めて保存
document.getElementById("save-record").addEventListener("click", function () {
  const date = document.getElementById("input-date").value;
  const part = document.getElementById("input-part").value;
  const exercise = document.getElementById("input-exercise").value;

  // 入力チェック
  if (date === "" || part === "" || exercise === "") {
    alert("日付・部位・種目を入力してください");
    return;
  }

  // セット行を集める（部位の入力タイプによって集める中身が変わる）
  const type = getInputType(part);
  const sets = [];
  document.querySelectorAll("#sets-area .set-row").forEach(function (row) {
    if (type === "distance") {
      const distance = row.querySelector(".set-distance").value;
      if (distance !== "") {
        sets.push({ distance: Number(distance) });
      }
    } else if (type === "time") {
      const minutes = row.querySelector(".set-minutes").value;
      if (minutes !== "") {
        sets.push({ minutes: Number(minutes) });
      }
    } else {
      // 重量・回数が両方入っている行だけ採用
      const weight = row.querySelector(".set-weight").value;
      const reps = row.querySelector(".set-reps").value;
      if (weight !== "" && reps !== "") {
        sets.push({ weight: Number(weight), reps: Number(reps) });
      }
    }
  });

  if (sets.length === 0) {
    if (type === "distance") {
      alert("距離を1つ以上入力してください");
    } else if (type === "time") {
      alert("時間を1つ以上入力してください");
    } else {
      alert("セットを1つ以上入力してください");
    }
    return;
  }

  // 記録オブジェクトを作る
  const record = {
    id: Date.now(),   // 今の時刻を区別用の番号に（削除で使う）
    date: date,
    part: part,
    exercise: exercise,
    sets: sets
  };

  // 配列に追加 → 保存 → 一覧を更新
  records.push(record);
  saveRecords();
  renderHistory();
  renderCalendar();
  resetRecordForm(); // 次の種目をすぐ入力できるようフォームを初期化

  // 続けて次の種目を記録できるよう、ホームには戻らず記録画面のままにする
  alert("記録しました");
});

// ===== 起動時：保存済みの履歴を表示 =====
renderHistory();

// ===== 振り返る画面（グラフ） =====

// 振り返り画面の部位が変わったら、種目リストを更新
document.getElementById("review-part").addEventListener("change", function () {
  const part = this.value;
  const select = document.getElementById("review-exercise");
  select.innerHTML = "";

  if (part === "") {
    select.innerHTML = '<option value="">先に部位を選択</option>';
    return;
  }

  const list = exerciseMaster[part] || [];
  list.forEach(function (exercise) {
    const option = document.createElement("option");
    option.value = exercise;
    option.textContent = exercise;
    select.appendChild(option);
  });
});

// 作ったグラフを覚えておく変数（描き直すとき前のを消すため）
let chartInstance = null;

// 「グラフを表示」ボタン
document.getElementById("show-graph").addEventListener("click", function () {
  const from = document.getElementById("review-from").value;
  const to = document.getElementById("review-to").value;
  const part = document.getElementById("review-part").value;
  const exercise = document.getElementById("review-exercise").value;
  const message = document.getElementById("review-message");

  if (part === "" || exercise === "") {
    message.textContent = "部位と種目を選んでください";
    return;
  }

  // 条件に合う記録だけを絞り込む
  const filtered = records.filter(function (r) {
    if (r.part !== part) return false;
    if (r.exercise !== exercise) return false;
    if (from !== "" && r.date < from) return false;  // 開始日より前は除外
    if (to !== "" && r.date > to) return false;      // 終了日より後は除外
    return true;
  });

  if (filtered.length === 0) {
    message.textContent = "該当する記録がありません";
    if (chartInstance !== null) {
      chartInstance.destroy();
      chartInstance = null;
    }
    return;
  }

  message.textContent = "";

  // 日付の古い順に並べる（グラフは左から右に時間が進む）
  filtered.sort(function (a, b) {
    return a.date.localeCompare(b.date);
  });

  // 縦軸に何を出すかは部位の入力タイプで変える
  // 筋トレ：その日の最大重量 / ランニング：合計距離 / HIIT：合計時間
  const type = getInputType(part);

  let datasetLabel = exercise + " の最大重量(kg)";
  let axisTitle = "重量(kg)";
  if (type === "distance") {
    datasetLabel = exercise + " の走行距離(km)";
    axisTitle = "距離(km)";
  } else if (type === "time") {
    datasetLabel = exercise + " の時間(分)";
    axisTitle = "時間(分)";
  }

  // 横軸（日付）と縦軸の値のデータを作る
  const labels = [];
  const data = [];
  filtered.forEach(function (r) {
    let value = 0;
    r.sets.forEach(function (s) {
      if (type === "distance") {
        value = value + s.distance;      // 合計する
      } else if (type === "time") {
        value = value + s.minutes;       // 合計する
      } else if (s.weight > value) {
        value = s.weight;                // 一番重い重量を残す
      }
    });
    labels.push(r.date);
    data.push(value);
  });

  // 前のグラフが残っていたら消す
  if (chartInstance !== null) {
    chartInstance.destroy();
  }

  // グラフを描く
  chartInstance = new Chart(document.getElementById("chart"), {
    type: "line",              // 折れ線グラフ
    data: {
      labels: labels,          // 横軸のラベル（日付）
      datasets: [{
        label: datasetLabel,
        data: data,            // 縦軸の値
        borderColor: "#2b6cb0",
        backgroundColor: "rgba(43,108,176,0.1)",
        tension: 0.2,          // 線のなめらかさ
        fill: true
      }]
    },
    options: {
      scales: {
        y: {
          beginAtZero: true,   // 縦軸を0から始める
          title: { display: true, text: axisTitle }
        }
      }
    }
  });
});
// ===== 月カレンダー =====

// 今表示している年月（最初は今月）
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth(); // 0=1月, 11=12月

// カレンダーで選んでいる日付（"YYYY-MM-DD"）。未選択なら空文字
// 「記録する」を押したとき、記録画面の日付欄に引き継ぐために覚えておく
let selectedDate = "";

// 日付を "YYYY-MM-DD" の形の文字列にする関数
// （記録データの date と同じ形にそろえるため）
function formatDate(year, month, day) {
  const m = String(month + 1).padStart(2, "0"); // 月は0始まりなので+1、2桁に
  const d = String(day).padStart(2, "0");
  return year + "-" + m + "-" + d;
}

// カレンダーを描く関数
function renderCalendar() {
  const title = document.getElementById("calendar-title");
  const daysArea = document.getElementById("calendar-days");

  // 見出し（例：2026年7月）
  title.textContent = currentYear + "年" + (currentMonth + 1) + "月";

  // 描き直すと選択中の枠線が消えるので、覚えている日付も未選択に戻す
  selectedDate = "";

  // その月の日数（翌月の0日目＝今月の最終日）
  const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
  // その月の1日の曜日（0=日曜）
  const firstWeekday = new Date(currentYear, currentMonth, 1).getDay();

  daysArea.innerHTML = "";

  // 1日の前に空白マスを入れる（曜日をそろえるため）
  for (let i = 0; i < firstWeekday; i++) {
    const empty = document.createElement("div");
    empty.className = "day empty";
    daysArea.appendChild(empty);
  }

  // 1日から最終日までマスを作る
  for (let day = 1; day <= lastDay; day++) {
    const dateStr = formatDate(currentYear, currentMonth, day);

    const cell = document.createElement("div");
    cell.className = "day";
    cell.textContent = day;

    // その日に記録があるか調べる（1件でもあれば true）
    const hasRecord = records.some(function (r) {
      return r.date === dateStr;
    });
    if (hasRecord) {
      cell.classList.add("has-record");
    }

    // マスをタップしたらその日の記録を表示
    cell.addEventListener("click", function () {
      showDayDetail(dateStr, cell);
    });

    daysArea.appendChild(cell);
  }
}

// 選んだ日の記録を下に表示する関数
function showDayDetail(dateStr, cell) {
  // 選択中の枠線をいったん全部外して、押されたマスだけに付ける
  document.querySelectorAll("#calendar-days .day").forEach(function (d) {
    d.classList.remove("selected");
  });
  cell.classList.add("selected");

  // 選んだ日付を覚えておく（「記録する」で日付欄に引き継ぐ）
  selectedDate = dateStr;

  const detail = document.getElementById("day-detail");
  const dayRecords = records.filter(function (r) {
    return r.date === dateStr;
  });

  if (dayRecords.length === 0) {
    detail.textContent = dateStr + "：記録なし";
    return;
  }

  // その日の記録を文章にする
  let text = dateStr + "\n";
  dayRecords.forEach(function (r) {
    const setsText = formatSets(r.sets);
    text += "・" + r.part + " " + r.exercise + " " + setsText + "\n";
  });

  detail.textContent = text;
  detail.style.whiteSpace = "pre-line"; // 改行を反映させる
}

// 前月・翌月ボタン
document.getElementById("prev-month").addEventListener("click", function () {
  currentMonth = currentMonth - 1;
  if (currentMonth < 0) {       // 1月から戻ったら前年の12月へ
    currentMonth = 11;
    currentYear = currentYear - 1;
  }
  renderCalendar();
});

document.getElementById("next-month").addEventListener("click", function () {
  currentMonth = currentMonth + 1;
  if (currentMonth > 11) {      // 12月から進んだら翌年の1月へ
    currentMonth = 0;
    currentYear = currentYear + 1;
  }
  renderCalendar();
});

// 起動時に描画
renderCalendar();

// ===== セットのコピー（最後の1行を複製） =====

document.getElementById("copy-set").addEventListener("click", function () {
  // 今あるセット行を全部取得
  const rows = document.querySelectorAll("#sets-area .set-row");
  const lastRow = rows[rows.length - 1]; // 一番最後の行

  // 最後の行の入力欄をすべて読む（部位によって入力欄の数が違うため）
  const lastInputs = lastRow.querySelectorAll("input");

  // 全部が空ならコピーしない
  let hasValue = false;
  lastInputs.forEach(function (input) {
    if (input.value !== "") {
      hasValue = true;
    }
  });
  if (!hasValue) {
    alert("コピーする内容を入力してください");
    return;
  }

  // 同じ形の新しい行を作り、読んだ値を同じ順番で入れておく
  const part = document.getElementById("input-part").value;
  const row = createSetRow(getInputType(part));
  const newInputs = row.querySelectorAll("input");
  lastInputs.forEach(function (input, i) {
    newInputs[i].value = input.value;
  });

  document.getElementById("sets-area").appendChild(row);
});

// ===== インターバルタイマー =====

let timerSeconds = 60;    // セットしている秒数（リセットで戻る値）
let timerRemaining = 60;  // 残り秒数
let timerEndTime = 0;     // 終了予定の時刻（ミリ秒）
let timerId = null;       // setInterval の番号。動いていないときは null
let audioCtx = null;      // アラーム音を作るための音源

// 秒数を "01:30" の形にする関数
function formatTime(totalSeconds) {
  const m = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  return m + ":" + s;
}

// 残り時間の表示を更新する関数
function updateTimerDisplay() {
  document.getElementById("timer-display").textContent = formatTime(timerRemaining);
}

// タイマーを止める関数（一時停止・停止の共通処理）
function stopTimer() {
  if (timerId !== null) {
    clearInterval(timerId); // 動いているタイマーを止める
    timerId = null;
  }
  document.getElementById("timer-start").textContent = "スタート";
}

// タイマーを開始する関数
function startTimer() {
  stopTimer();              // 二重に動き出さないよう、いったん止める
  if (timerRemaining <= 0) {
    timerRemaining = timerSeconds; // 0で押されたら最初から
  }

  // 「終了予定の時刻」を決めて、そこから残りを計算する
  // （1秒ずつ引く方式だと、裏画面にしたときブラウザが間引いてズレるため）
  timerEndTime = Date.now() + timerRemaining * 1000;
  document.getElementById("timer-start").textContent = "一時停止";

  timerId = setInterval(function () {
    timerRemaining = Math.round((timerEndTime - Date.now()) / 1000);

    if (timerRemaining <= 0) {
      timerRemaining = 0;
      updateTimerDisplay();
      stopTimer();
      ringAlarm();
      return;
    }

    updateTimerDisplay();
  }, 200); // 表示のズレを小さくするため0.2秒ごとに確認する

  updateTimerDisplay();
}

// 音を出す準備。ボタンを押した瞬間に呼ぶ
// （スマホのブラウザは「ユーザー操作のとき」しか音を許可しないため）
function prepareAudio() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    return;
  }
  if (audioCtx === null) {
    audioCtx = new AudioCtx();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

// アラームを鳴らす関数（音声ファイルを持たず、ブラウザで音を作る）
function ringAlarm() {
  // スマホを短く振動させる（対応していない端末では何も起きない）
  if (navigator.vibrate) {
    navigator.vibrate([200, 100, 200]);
  }

  // 画面でも知らせる（数字を赤く点滅）
  const display = document.getElementById("timer-display");
  display.classList.add("done");
  setTimeout(function () {
    display.classList.remove("done");
  }, 3000);

  if (audioCtx === null) {
    return; // 音が用意できていない環境では表示と振動だけ
  }

  // 「ピッ」を0.35秒おきに3回鳴らす
  for (let i = 0; i < 3; i++) {
    const osc = audioCtx.createOscillator();  // 音の波を作る
    const gain = audioCtx.createGain();       // 音量を調整する
    const start = audioCtx.currentTime + i * 0.35;

    osc.type = "sine";
    osc.frequency.value = 880; // ラの音

    // いきなり鳴らすとプツッと鳴るので、音量を短く上げ下げする
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.25);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + 0.3);
  }
}

// 秒数のプリセットボタン（60秒・90秒・2分・3分）
document.querySelectorAll(".preset-button").forEach(function (button) {
  button.addEventListener("click", function () {
    // 選択中の見た目を付け替える
    document.querySelectorAll(".preset-button").forEach(function (b) {
      b.classList.remove("active");
    });
    button.classList.add("active");

    stopTimer();
    timerSeconds = Number(button.dataset.seconds);
    timerRemaining = timerSeconds;
    updateTimerDisplay();
  });
});

// スタート／一時停止ボタン
document.getElementById("timer-start").addEventListener("click", function () {
  prepareAudio(); // 押された瞬間に音の準備をしておく

  if (timerId === null) {
    startTimer();
  } else {
    stopTimer(); // 動いている最中に押されたら一時停止
  }
});

// リセットボタン
document.getElementById("timer-reset").addEventListener("click", function () {
  stopTimer();
  timerRemaining = timerSeconds;
  updateTimerDisplay();
});

// 起動時に表示を合わせる
updateTimerDisplay();

// ===== PWA（ホーム画面に追加してアプリのように起動する） =====

// Service Worker を登録する
// ※ https か localhost でないと動かない（file:// では登録できない）
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("./sw.js").catch(function (error) {
      console.log("Service Workerの登録に失敗:", error);
    });
  });
}