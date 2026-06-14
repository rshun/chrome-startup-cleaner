const historyCheckbox = document.querySelector("#clear-history");
const cacheCheckbox = document.querySelector("#clear-cache");
const timeRangeSelect = document.querySelector("#time-range");
const openOptionsButton = document.querySelector("#open-options");
const status = document.querySelector("#status");

function formatCleanup(cleanup) {
  if (!cleanup) {
    return "尚无清理记录";
  }

  const time = new Date(cleanup.finishedAt).toLocaleString("zh-CN");

  if (!cleanup.success) {
    return `上次清理失败：${cleanup.error ?? "未知错误"}`;
  }

  const names = {
    history: "历史记录",
    cache: "缓存"
  };
  const removed = cleanup.removed.map((item) => names[item]).join("、");
  const range = cleanup.rangeDays > 0
    ? `最近 ${cleanup.rangeDays} 天`
    : "全部时间";
  return `${time} 已清理${range}的：${removed || "无"}`;
}

async function loadState() {
  const state = await chrome.storage.local.get({
    clearHistory: true,
    clearCache: true,
    timeRangeDays: 0,
    lastCleanup: null
  });

  historyCheckbox.checked = state.clearHistory;
  cacheCheckbox.checked = state.clearCache;
  timeRangeSelect.value = String(state.timeRangeDays);
  status.textContent = formatCleanup(state.lastCleanup);
  status.dataset.success = state.lastCleanup?.success ?? "";
}

async function saveSettings() {
  await chrome.storage.local.set({
    clearHistory: historyCheckbox.checked,
    clearCache: cacheCheckbox.checked,
    timeRangeDays: Number(timeRangeSelect.value)
  });
}

historyCheckbox.addEventListener("change", saveSettings);
cacheCheckbox.addEventListener("change", saveSettings);
timeRangeSelect.addEventListener("change", saveSettings);
openOptionsButton.addEventListener("click", () => chrome.runtime.openOptionsPage());

loadState().catch((error) => {
  status.textContent = `读取状态失败：${error.message}`;
  status.dataset.success = "false";
});
