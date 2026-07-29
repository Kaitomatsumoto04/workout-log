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
  "下半身": ["スクワット", "レッグプレス", "レッグエクステンション", "カーフレイズ"]
};

// 保存済みがあればそれを、無ければ初期リストを使う
let exerciseMaster = JSON.parse(localStorage.getItem("workout-master")) || defaultMaster;

// 種目マスタを保存する関数
function saveMaster() {
  localStorage.setItem("workout-master", JSON.stringify(exerciseMaster));
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
  const list = exerciseMaster[part];
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

document.getElementById("add-set").addEventListener("click", function () {
  // 新しいセット1行を作る
  const row = document.createElement("div");
  row.className = "set-row";
  row.innerHTML =
    '<input type="number" class="set-weight" placeholder="重量kg">' +
    '<span>kg ×</span>' +
    '<input type="number" class="set-reps" placeholder="回数">' +
    '<span>回</span>';

  // セット置き場に追加
  document.getElementById("sets-area").appendChild(row);
});

// ===== 記録の保存・読み込み・表示 =====

// 記録データの配列。起動時に localStorage から読み込む（無ければ空配列）
let records = JSON.parse(localStorage.getItem("workout-records")) || [];

// 配列を localStorage に保存する関数
function saveRecords() {
  localStorage.setItem("workout-records", JSON.stringify(records));
}

// 履歴一覧を画面に描き直す関数
// 履歴一覧を画面に描き直す関数（削除ボタン付き）
function renderHistory() {
  const list = document.getElementById("history-list");
  list.innerHTML = "";

  if (records.length === 0) {
    list.innerHTML = "<li>まだ記録がありません</li>";
    return;
  }

  const sorted = records.slice().sort(function (a, b) {
    return b.date.localeCompare(a.date);
  });

  sorted.forEach(function (record) {
    const setsText = record.sets.map(function (s) {
      return s.weight + "kg×" + s.reps;
    }).join(", ");

    const li = document.createElement("li");

    // 記録テキスト部分
    const span = document.createElement("span");
    span.textContent =
      record.date + " " + record.part + " " + record.exercise + " " + setsText;

    // 削除ボタン
    const delBtn = document.createElement("button");
    delBtn.textContent = "削除";
    delBtn.className = "delete-button";
    delBtn.addEventListener("click", function () {
      deleteRecord(record.id);
    });

    li.appendChild(span);
    li.appendChild(delBtn);
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

  // セット行を集める（重量・回数が両方入っている行だけ採用）
  const sets = [];
  document.querySelectorAll("#sets-area .set-row").forEach(function (row) {
    const weight = row.querySelector(".set-weight").value;
    const reps = row.querySelector(".set-reps").value;
    if (weight !== "" && reps !== "") {
      sets.push({ weight: Number(weight), reps: Number(reps) });
    }
  });

  if (sets.length === 0) {
    alert("セットを1つ以上入力してください");
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

  alert("記録しました");
  showScreen("screen-home"); // ホームに戻って履歴を確認
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

  exerciseMaster[part].forEach(function (exercise) {
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

  // 横軸（日付）と縦軸（その日の最大重量）のデータを作る
  const labels = [];
  const data = [];
  filtered.forEach(function (r) {
    // その記録のセットの中で一番重い重量を探す
    let maxWeight = 0;
    r.sets.forEach(function (s) {
      if (s.weight > maxWeight) {
        maxWeight = s.weight;
      }
    });
    labels.push(r.date);
    data.push(maxWeight);
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
        label: exercise + " の最大重量(kg)",
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
          title: { display: true, text: "重量(kg)" }
        }
      }
    }
  });
});