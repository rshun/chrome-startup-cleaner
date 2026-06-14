const historyCheckbox = document.querySelector("#clear-history");
const cacheCheckbox = document.querySelector("#clear-cache");
const timeRangeSelect = document.querySelector("#time-range");
const openOptionsButton = document.querySelector("#open-options");
const cleanNowButton = document.querySelector("#clean-now");
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

async function cleanNow() {
  // 先把当前勾选保存，确保按设置清理
  await saveSettings();

  cleanNowButton.disabled = true;
  cleanNowButton.textContent = "清理中…";
  status.textContent = "正在清理…";
  status.dataset.success = "";

  try {
    const result = await chrome.runtime.sendMessage({ type: "cleanNow" });
    if (!result?.success) {
      throw new Error(result?.error ?? "未知错误");
    }
    await loadState();
  } catch (error) {
    status.textContent = `清理失败：${error.message}`;
    status.dataset.success = "false";
  } finally {
    cleanNowButton.disabled = false;
    cleanNowButton.textContent = "立即清理";
  }
}

historyCheckbox.addEventListener("change", saveSettings);
cacheCheckbox.addEventListener("change", saveSettings);
timeRangeSelect.addEventListener("change", saveSettings);
cleanNowButton.addEventListener("click", () => {
  cleanNow().catch((error) => {
    status.textContent = `清理失败：${error.message}`;
    status.dataset.success = "false";
  });
});
openOptionsButton.addEventListener("click", () => chrome.runtime.openOptionsPage());

loadState().catch((error) => {
  status.textContent = `读取状态失败：${error.message}`;
  status.dataset.success = "false";
});
