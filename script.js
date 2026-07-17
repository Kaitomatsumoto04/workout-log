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