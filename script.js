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
  // 編集中にホームへ戻ったら、その編集は取りやめる
  if (editingId !== null) {
    resetRecordForm();
  }
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

// 初期リストのコピーを作る関数
// （コピーせずに使うと、種目を追加したとき初期リストそのものが書き換わってしまうため）
function copyDefaultMaster() {
  return JSON.parse(JSON.stringify(defaultMaster));
}

// 種目リスト。ログインするとアカウントに保存されたもの（Firestore）に置き換わる
let exerciseMaster = copyDefaultMaster();

// 種目マスタをアカウント（Firestore）に保存する関数
// ※ 中身はログインの部分で定義している saveMasterToCloud にまかせる
function saveMaster() {
  saveMasterToCloud();
}

// 後から増やした部位は保存済みマスタに入っていないので、初期リストで補う
// （これが無いと、追加した部位を選んだとき種目リストが取れずエラーになる）
function fillMissingParts() {
  Object.keys(defaultMaster).forEach(function (part) {
    if (exerciseMaster[part] === undefined) {
      exerciseMaster[part] = defaultMaster[part].slice(); // slice() で配列をコピー
    }
  });
}

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

// セット欄の見出しを入力内容に合わせて変える
function updateSetsHeading(type) {
  const heading = document.getElementById("sets-heading");
  if (type === "distance") {
    heading.textContent = "距離";
  } else if (type === "time") {
    heading.textContent = "時間";
  } else {
    heading.textContent = "セット";
  }
}

// セット欄を、選ばれた部位に合った入力欄1行だけの状態にする
function renderSetsArea(part) {
  const type = getInputType(part);

  const setsArea = document.getElementById("sets-area");
  setsArea.innerHTML = "";
  setsArea.dataset.type = type; // 今どの形の入力欄が並んでいるかを覚えておく
  setsArea.appendChild(createSetRow(type));

  updateSetsHeading(type);
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

  // 編集モードだったら新規記録モードに戻す
  cancelEdit();
}

// ===== 記録の編集 =====

// 編集中の記録のid。新規記録のときは null
let editingId = null;

// 編集モードをやめて、新規記録モードの見た目に戻す関数
function cancelEdit() {
  editingId = null;
  document.getElementById("record-heading").textContent = "記録する";
  document.getElementById("save-record").textContent = "記録する";
}

// 指定idの記録を記録画面に読み込み、編集モードにする関数
function startEdit(id) {
  const record = records.find(function (r) {
    return r.id === id;
  });
  if (record === undefined) {
    return;
  }

  editingId = id;

  // 日付・部位を入れる
  document.getElementById("input-date").value = record.date;
  document.getElementById("input-part").value = record.part;
  updateExerciseOptions(record.part);

  // 種目を選ぶ。マスタから消された種目でも選べるよう、無ければ選択肢を足す
  const select = document.getElementById("input-exercise");
  select.value = record.exercise;
  if (select.value !== record.exercise) {
    const option = document.createElement("option");
    option.value = record.exercise;
    option.textContent = record.exercise;
    select.appendChild(option);
    select.value = record.exercise;
  }

  // セット欄を記録の内容で埋める（行数も記録に合わせる）
  const type = getInputType(record.part);
  const setsArea = document.getElementById("sets-area");
  setsArea.innerHTML = "";
  setsArea.dataset.type = type;
  record.sets.forEach(function (s) {
    const row = createSetRow(type);
    if (type === "distance") {
      row.querySelector(".set-distance").value = s.distance;
    } else if (type === "time") {
      row.querySelector(".set-minutes").value = s.minutes;
    } else {
      row.querySelector(".set-weight").value = s.weight;
      row.querySelector(".set-reps").value = s.reps;
    }
    setsArea.appendChild(row);
  });
  updateSetsHeading(type);

  // 編集中だと分かるように見出しとボタンの文字を変える
  document.getElementById("record-heading").textContent = "記録を編集";
  document.getElementById("save-record").textContent = "更新する";

  showScreen("screen-record");
}

// ===== 記録の保存・読み込み・表示 =====

// 記録データの配列。ログインすると、アカウント（Firestore）の記録がここに入る
let records = [];

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

      const editBtn = document.createElement("button");
      editBtn.textContent = "編集";
      editBtn.className = "edit-button";
      editBtn.addEventListener("click", function () {
        startEdit(record.id);
      });

      const delBtn = document.createElement("button");
      delBtn.textContent = "削除";
      delBtn.className = "delete-button";
      delBtn.addEventListener("click", function () {
        deleteRecord(record.id);
      });

      // ボタン2つは横並びでまとめる
      const actions = document.createElement("div");
      actions.className = "history-actions";
      actions.appendChild(editBtn);
      actions.appendChild(delBtn);

      row.appendChild(span);
      row.appendChild(actions);
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

  // 編集中の記録が消えたら、編集モードをやめる（更新先が無くなるため）
  if (editingId === id) {
    resetRecordForm();
  }

  deleteRecordFromCloud(id);
  renderHistory();
  renderCalendar(); // その日の最後の記録を消したらカレンダーの色も消す
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

  // 編集モードかどうかを先に覚えておく（あとでリセットすると消えるため）
  const isEdit = editingId !== null;

  const record = {
    // 編集ならidは変えない。新規は今の時刻を区別用の番号に（削除・編集で使う）
    id: isEdit ? editingId : Date.now(),
    date: date,
    part: part,
    exercise: exercise,
    sets: sets
  };

  if (isEdit) {
    // 編集モード：同じidの記録を上書きする（並び順は変えない）
    records = records.map(function (r) {
      return r.id === editingId ? record : r;
    });
  } else {
    // 新規：配列に追加
    records.push(record);
  }

  saveRecordToCloud(record);
  renderHistory();
  renderCalendar();
  resetRecordForm(); // 次の種目をすぐ入力できるようフォームを初期化

  if (isEdit) {
    alert("更新しました");
    showScreen("screen-home"); // 編集は1件で終わりなのでホームへ戻る
  } else {
    // 続けて次の種目を記録できるよう、ホームには戻らず記録画面のままにする
    alert("記録しました");
  }
});

// ===== 起動時：保存済みの履歴を表示 =====
renderHistory();

// ===== バックアップ（記録をファイルに書き出す／読み込む） =====

// 書き出す：記録と種目リストを1つのJSONファイルにまとめる
document.getElementById("export-data").addEventListener("click", async function () {
  const backup = {
    app: "workout-log", // このアプリのバックアップだと見分ける印
    version: 1,         // 将来、形式を変えたときに見分けるための番号
    exportedAt: new Date().toISOString(),
    records: records,
    master: exerciseMaster
  };
  const json = JSON.stringify(backup, null, 2); // 人が読めるよう改行と字下げを入れる

  const today = new Date();
  const fileName = "workout-log-" +
    formatDate(today.getFullYear(), today.getMonth(), today.getDate()) + ".json";
  const file = new File([json], fileName, { type: "application/json" });

  // スマホ：共有シートを開く（iPhoneは「"ファイル"に保存」で保存できる）
  if (navigator.maxTouchPoints > 0 && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
    } catch (error) {
      if (error.name !== "AbortError") { // 共有シートを閉じただけなら何もしない
        alert("書き出しに失敗しました");
      }
    }
    return;
  }

  // PC：ファイルとしてダウンロードする
  const url = URL.createObjectURL(file); // ファイルを指す一時的なURLを作る
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(function () {
    URL.revokeObjectURL(url); // 一時的なURLを片付ける（ダウンロード開始を待ってから）
  }, 1000);
});

// 読み込むボタン：隠してあるファイル選択を開く
document.getElementById("import-data").addEventListener("click", function () {
  document.getElementById("import-file").click();
});

// ファイルが選ばれたら中身を確認して、今の記録と置き換える
document.getElementById("import-file").addEventListener("change", async function (event) {
  const file = event.target.files[0];
  event.target.value = ""; // 同じファイルをもう一度選んでも反応するよう空にしておく
  if (!file) {
    return;
  }

  let backup;
  try {
    backup = JSON.parse(await file.text());
  } catch (error) {
    alert("ファイルを読み込めませんでした（JSONの形になっていません）");
    return;
  }
  if (backup.app !== "workout-log" || !Array.isArray(backup.records)) {
    alert("このアプリのバックアップファイルではありません");
    return;
  }

  // 今の記録は消えて置き換わるので、必ず確認する
  const ok = confirm(
    backup.records.length + "件の記録を読み込みます。\n" +
    "今の記録（" + records.length + "件）は置き換わります。よろしいですか？"
  );
  if (!ok) {
    return;
  }

  replaceAllRecordsInCloud(backup.records); // アカウントの記録も丸ごと置き換える
  records = backup.records;
  if (backup.master) {
    exerciseMaster = backup.master;
    fillMissingParts();
    saveMaster();
  }
  renderHistory();
  renderCalendar();
  alert("読み込みました");
});

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
    sendToPushServer("/cancel", {}); // サーバーの予約も取り消す
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
document.getElementById("timer-start").addEventListener("click", async function () {
  prepareAudio(); // 押された瞬間に音の準備をしておく

  if (timerId === null) {
    startTimer();
    await preparePush(); // 初回だけ、ここで通知の許可ダイアログが出る
    if (timerId !== null) {
      // 許可を待つ間に止められていなければ、終了時刻をサーバーに予約する
      sendToPushServer("/start", { endTime: timerEndTime });
    }
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

// ===== プッシュ通知（ほかのアプリを使っていてもインターバル終了を知らせる） =====

const PUSH_SERVER_URL = "https://push-server.kinntore.workers.dev"; // 公開したら Cloudflare のURLに変える
const VAPID_PUBLIC_KEY = "BMWDkGKxCuBbEfCfyVpq03uJZX8Mi7ivEtvOers1aZ5kiEjFBy4XGp8U6Xq6o4fwNCfq_7uf_29U2DaDpS4QBJM";

let pushSubscription = null; // 通知の宛先（購読情報）。用意できていないときは null

// 公開鍵の文字列を、ブラウザが受け取れる形（バイトの並び）に変換する
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes;
}

// 通知の許可をもらい、宛先を用意する。スタートボタンを押した瞬間に呼ぶ
// （iPhoneは許可のダイアログをユーザー操作のときしか出せないため）
async function preparePush() {
  if (!("Notification" in window) || !("PushManager" in window)) {
    return; // 対応していない環境（iPhoneはホーム画面から開いたときだけ対応）
  }
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return;
    }
    const registration = await navigator.serviceWorker.ready;
    // すでに購読していればそれを使い、無ければ新しく購読する
    let subscription = await registration.pushManager.getSubscription();
    if (subscription === null) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true, // 「届いたら必ず通知を表示する」という約束（無いと購読できない）
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }
    pushSubscription = subscription;
  } catch (error) {
    console.log("通知の準備に失敗:", error);
  }
}

// 通知サーバーに送る（/start で予約、/cancel で取り消し）
function sendToPushServer(path, data) {
  if (pushSubscription === null) {
    return; // 宛先が無ければ何もしない（音と画面だけで知らせる）
  }
  data.subscription = pushSubscription;
  fetch(PUSH_SERVER_URL + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }).catch(function (error) {
    console.log("通知サーバーへの送信に失敗:", error);
  });
}


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

// ===== ログイン（Firebase Authentication） =====

// Firebase の接続情報（公開してよい情報。データはセキュリティルールで守る）
const firebaseConfig = {
  apiKey: "AIzaSyDhwYqlfAa5TF-wpPar3Q2IRNBWyvukDEU",
  authDomain: "workout-log-87f89.firebaseapp.com",
  projectId: "workout-log-87f89",
  storageBucket: "workout-log-87f89.firebasestorage.app",
  messagingSenderId: "806015456461",
  appId: "1:806015456461:web:5227bb67c7e59d85488584"
};
const FIREBASE_URL = "https://www.gstatic.com/firebasejs/12.19.0/";

let authLib = null;     // Firebase のログイン関係の関数をまとめたもの
let auth = null;        // このアプリのログイン係
let currentUser = null; // ログイン中のユーザー。ログアウト中は null

// エラーコードを日本語のメッセージに置き換える表
const AUTH_ERROR_MESSAGES = {
  "auth/invalid-email": "メールアドレスの形が正しくありません",
  "auth/missing-password": "パスワードを入力してください",
  "auth/invalid-credential": "メールアドレスかパスワードが違います",
  "auth/email-already-in-use": "このメールアドレスはすでに登録されています",
  "auth/weak-password": "パスワードは6文字以上にしてください",
  "auth/too-many-requests": "失敗が続いたため一時的に止められています。しばらく待ってから試してください",
  "auth/network-request-failed": "通信できませんでした。電波の状況を確認してください"
};

function showLoginMessage(text) {
  document.getElementById("login-message").textContent = text;
}

// 表に無いエラーは、コードをそのまま出す（原因を調べられるように）
function showAuthError(error) {
  showLoginMessage(AUTH_ERROR_MESSAGES[error.code] || "エラーが起きました（" + error.code + "）");
}

function getLoginInputs() {
  return {
    email: document.getElementById("login-email").value.trim(), // 前後の余計なスペースを取る
    password: document.getElementById("login-password").value
  };
}

// Firebase を読み込んで、ログイン状態の見張りを始める
// （script.js は type="module" ではないので、import() であとから読み込む）
async function startFirebase() {
  try {
    const appLib = await import(FIREBASE_URL + "firebase-app.js");
    authLib = await import(FIREBASE_URL + "firebase-auth.js");
    fsLib = await import(FIREBASE_URL + "firebase-firestore.js");
    const app = appLib.initializeApp(firebaseConfig);
    auth = authLib.getAuth(app);
    db = createFirestore(app);
  } catch (error) {
    console.log("Firebaseの読み込みに失敗:", error);
    showScreen("screen-login");
    showLoginMessage("読み込みに失敗しました。電波の状況を確認して、開き直してください");
    return;
  }

  // ログイン状態が変わるたびに呼ばれる（起動時の自動ログインも、ここで分かる）
  authLib.onAuthStateChanged(auth, function (user) {
    currentUser = user;
    if (user) {
      document.getElementById("account-email").textContent = user.email + " でログイン中";
      document.getElementById("login-password").value = ""; // パスワードを画面に残さない
      showLoginMessage("");
      startSync();
      showScreen("screen-home");
    } else {
      stopSync();
      showScreen("screen-login");
    }
  });
}

// ログイン
document.getElementById("login-button").addEventListener("click", async function () {
  if (auth === null) {
    return; // まだ Firebase を読み込めていない
  }
  const input = getLoginInputs();
  showLoginMessage("ログインしています…");
  try {
    await authLib.signInWithEmailAndPassword(auth, input.email, input.password);
    // 成功すると onAuthStateChanged が呼ばれ、ホームに切り替わる
  } catch (error) {
    showAuthError(error);
  }
});

// 新規登録（登録できると、そのままログインした状態になる）
document.getElementById("signup-button").addEventListener("click", async function () {
  if (auth === null) {
    return;
  }
  const input = getLoginInputs();
  showLoginMessage("登録しています…");
  try {
    await authLib.createUserWithEmailAndPassword(auth, input.email, input.password);
  } catch (error) {
    showAuthError(error);
  }
});

// パスワード再設定のメールを送る
document.getElementById("reset-password").addEventListener("click", async function () {
  if (auth === null) {
    return;
  }
  const input = getLoginInputs();
  if (input.email === "") {
    showLoginMessage("先にメールアドレスを入力してください");
    return;
  }
  try {
    await authLib.sendPasswordResetEmail(auth, input.email);
    // 登録されていないアドレスでもエラーにならない（他人が登録の有無を調べられないようにするため）
    showLoginMessage("登録されていれば、パスワード再設定のメールを送りました（迷惑メールフォルダも確認してください）");
  } catch (error) {
    showAuthError(error);
  }
});

// ログアウト
document.getElementById("logout-button").addEventListener("click", function () {
  if (confirm("ログアウトしますか？")) {
    authLib.signOut(auth); // 成功すると onAuthStateChanged が呼ばれ、ログイン画面に切り替わる
  }
});

// ===== 記録の保存先（Firestore） =====
// データの形： users/{ユーザーID} … 種目リスト（master）
//              users/{ユーザーID}/records/{記録ID} … 記録1件ずつ

let fsLib = null;              // Firestore の関数をまとめたもの
let db = null;                 // このアプリのデータベース係
let unsubscribeRecords = null; // 記録の見張りをやめる関数（見張っていないときは null）
let unsubscribeMaster = null;  // 種目リストの見張りをやめる関数

// Firestore を用意する
// 端末の中にもコピーを持たせる（圏外でも読み書きでき、電波が戻ると自動で送られる）
function createFirestore(app) {
  try {
    return fsLib.initializeFirestore(app, {
      localCache: fsLib.persistentLocalCache({
        tabManager: fsLib.persistentMultipleTabManager() // タブを複数開いても壊れないように
      })
    });
  } catch (error) {
    console.log("端末へのコピーが使えないため、通常モードで動かします:", error);
    return fsLib.getFirestore(app);
  }
}

// 保存場所（パス）を作る関数
function userDoc() {
  return fsLib.doc(db, "users", currentUser.uid);
}
function recordsCollection() {
  return fsLib.collection(db, "users", currentUser.uid, "records");
}
function recordDoc(id) {
  return fsLib.doc(db, "users", currentUser.uid, "records", String(id)); // 記録IDは文字列にする
}

// 保存に失敗したときの共通処理
// （圏外は失敗ではなく「電波が戻ったら送る」扱いになるので、ここには来ない）
function showCloudError(error) {
  console.log("Firestoreとのやりとりに失敗:", error);
  alert("保存に失敗しました（" + error.code + "）");
}

// 記録1件を保存する（新規・編集のどちらも）
// ※ await しない：圏外だと電波が戻るまで完了しないため。画面は先に更新してよい
function saveRecordToCloud(record) {
  if (currentUser === null) {
    return;
  }
  fsLib.setDoc(recordDoc(record.id), record).catch(showCloudError);
}

// 記録1件を削除する
function deleteRecordFromCloud(id) {
  if (currentUser === null) {
    return;
  }
  fsLib.deleteDoc(recordDoc(id)).catch(showCloudError);
}

// 種目リストを保存する（丸ごと上書き）
function saveMasterToCloud() {
  if (currentUser === null) {
    return;
  }
  fsLib.setDoc(userDoc(), { master: exerciseMaster }).catch(showCloudError);
}

// たくさんの書き込みを、まとめて送る（1回のまとめ送りは500件までなので分ける）
async function commitInBatches(operations) {
  for (let i = 0; i < operations.length; i += 500) {
    const batch = fsLib.writeBatch(db);
    operations.slice(i, i + 500).forEach(function (op) {
      if (op.data) {
        // merge: true なら、書いた項目だけ更新する（ほかの項目は残す）
        batch.set(op.ref, op.data, { merge: op.merge === true });
      } else {
        batch.delete(op.ref);
      }
    });
    await batch.commit();
  }
}

// バックアップの読み込み用：アカウントの記録を丸ごと置き換える
function replaceAllRecordsInCloud(newRecords) {
  const newIds = newRecords.map(function (r) {
    return r.id;
  });
  const operations = [];
  // 今あってバックアップに無い記録は消す
  records.forEach(function (r) {
    if (!newIds.includes(r.id)) {
      operations.push({ ref: recordDoc(r.id) });
    }
  });
  // バックアップの記録はすべて書き込む
  newRecords.forEach(function (r) {
    operations.push({ ref: recordDoc(r.id), data: r });
  });
  commitInBatches(operations).catch(showCloudError);
}

// ログインしたら、アカウントのデータの見張りを始める
function startSync() {
  stopWatching(); // 念のため、前の見張りが残っていたら止める

  // 種目リスト：変わるたびに受け取る
  unsubscribeMaster = fsLib.onSnapshot(userDoc(), function (snapshot) {
    const data = snapshot.data();
    exerciseMaster = (data && data.master) ? data.master : copyDefaultMaster();
    fillMissingParts();
  }, showCloudError);

  // 記録：変わるたびに全件受け取って描き直す（ほかの端末で記録しても反映される）
  unsubscribeRecords = fsLib.onSnapshot(recordsCollection(), function (snapshot) {
    records = snapshot.docs.map(function (d) {
      return d.data();
    });
    // 記録した順（id＝記録した時刻）に並べる。今までの配列と同じ並びにするため
    records.sort(function (a, b) {
      return a.id - b.id;
    });
    renderHistory();
    renderCalendar();
  }, showCloudError);

  migrateLocalData();
}

// 見張りを止める
function stopWatching() {
  if (unsubscribeRecords !== null) {
    unsubscribeRecords();
    unsubscribeRecords = null;
  }
  if (unsubscribeMaster !== null) {
    unsubscribeMaster();
    unsubscribeMaster = null;
  }
}

// ログアウトしたら、見張りを止めて画面の記録も消す（次の人に見えないように）
function stopSync() {
  stopWatching();
  records = [];
  exerciseMaster = copyDefaultMaster();
  renderHistory();
  renderCalendar();
}

// この端末（localStorage）に残っている以前の記録を、アカウントへ引っ越す
// ・端末とアカウントの組み合わせごとに1回だけ行う
// ・同じ記録IDは上書きになるだけなので、途中で失敗して何度やり直しても二重にならない
// ・localStorage の記録は消さずに残しておく（万一のときの予備）
async function migrateLocalData() {
  const doneKey = "workout-migrated-" + currentUser.uid;
  if (localStorage.getItem(doneKey) !== null) {
    return; // 引っ越し済み
  }

  const localRecords = JSON.parse(localStorage.getItem("workout-records")) || [];
  const localMaster = JSON.parse(localStorage.getItem("workout-master"));
  if (localRecords.length === 0 && localMaster === null) {
    localStorage.setItem(doneKey, "done"); // 引っ越すものが無い
    return;
  }

  const ok = confirm(
    "この端末に保存されている記録（" + localRecords.length + "件）を、アカウントに引っ越しますか？\n" +
    "（キャンセルすると、次に開いたときにもう一度聞きます）"
  );
  if (!ok) {
    return;
  }

  const operations = localRecords.map(function (r) {
    return { ref: recordDoc(r.id), data: r };
  });

  // 種目リストは、アカウント側と合体させる（arrayUnion：無い種目だけ追加する）
  if (localMaster !== null) {
    const masterUpdate = {};
    Object.keys(localMaster).forEach(function (part) {
      if (localMaster[part].length > 0) {
        masterUpdate[part] = fsLib.arrayUnion(...localMaster[part]); // ... で配列をばらして渡す
      }
    });
    operations.push({ ref: userDoc(), data: { master: masterUpdate }, merge: true });
  }

  try {
    await commitInBatches(operations); // 圏外なら、電波が戻って送り終わるまで待つ
    localStorage.setItem(doneKey, "done");
    alert("引っ越しが終わりました（" + localRecords.length + "件）");
  } catch (error) {
    showCloudError(error);
  }
}

startFirebase();