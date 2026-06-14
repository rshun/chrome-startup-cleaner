const historyCheckbox = document.querySelector("#clear-history");
const cacheCheckbox = document.querySelector("#clear-cache");
const timeRangeSelect = document.querySelector("#time-range");
const saveStatus = document.querySelector("#save-status");
const cleanupStatus = document.querySelector("#cleanup-status");

function formatCleanup(cleanup) {
  if (!cleanup) {
    return "尚无启动清理记录。";
  }

  if (!cleanup.success) {
    return `上次启动清理失败：${cleanup.error ?? "未知错误"}`;
  }

  const names = {
    history: "历史记录",
    cache: "缓存"
  };
  const removed = cleanup.removed.map((item) => names[item]).join("、") || "无";
  const range = cleanup.rangeDays > 0 ? `最近 ${cleanup.rangeDays} 天` : "全部时间";
  const time = new Date(cleanup.finishedAt).toLocaleString("zh-CN");
  return `上次启动清理：${time}，${range}，已清理 ${removed}。`;
}

async function loadSettings() {
  const settings = await chrome.storage.local.get({
    clearHistory: true,
    clearCache: true,
    timeRangeDays: 0,
    lastCleanup: null
  });

  historyCheckbox.checked = settings.clearHistory;
  cacheCheckbox.checked = settings.clearCache;
  timeRangeSelect.value = String(settings.timeRangeDays);
  cleanupStatus.textContent = formatCleanup(settings.lastCleanup);
}

async function saveSettings() {
  await chrome.storage.local.set({
    clearHistory: historyCheckbox.checked,
    clearCache: cacheCheckbox.checked,
    timeRangeDays: Number(timeRangeSelect.value)
  });

  saveStatus.textContent = "设置已自动保存";
  setTimeout(() => {
    saveStatus.textContent = "";
  }, 1500);
}

historyCheckbox.addEventListener("change", saveSettings);
cacheCheckbox.addEventListener("change", saveSettings);
timeRangeSelect.addEventListener("change", saveSettings);

loadSettings().catch((error) => {
  saveStatus.textContent = `读取设置失败：${error.message}`;
});
