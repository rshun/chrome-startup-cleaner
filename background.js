const DEFAULT_SETTINGS = {
  clearHistory: true,
  clearCache: true,
  timeRangeDays: 0
};

async function getSettings() {
  return chrome.storage.local.get(DEFAULT_SETTINGS);
}

async function cleanBrowsingData(trigger = "startup") {
  const settings = await getSettings();
  const dataToRemove = {};
  const rangeDays = Number(settings.timeRangeDays) || 0;
  const since = rangeDays > 0
    ? Date.now() - rangeDays * 24 * 60 * 60 * 1000
    : 0;

  if (settings.clearHistory) {
    dataToRemove.history = true;
  }

  if (settings.clearCache) {
    dataToRemove.cache = true;
  }

  const startedAt = new Date().toISOString();

  try {
    if (Object.keys(dataToRemove).length > 0) {
      await chrome.browsingData.remove({ since }, dataToRemove);
    }

    await chrome.storage.local.set({
      lastCleanup: {
        trigger,
        startedAt,
        finishedAt: new Date().toISOString(),
        success: true,
        removed: Object.keys(dataToRemove),
        rangeDays
      }
    });
  } catch (error) {
    await chrome.storage.local.set({
      lastCleanup: {
        trigger,
        startedAt,
        finishedAt: new Date().toISOString(),
        success: false,
        error: error.message
      }
    });

    throw error;
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get([
    "clearHistory",
    "clearCache",
    "timeRangeDays"
  ]);

  await chrome.storage.local.set({
    clearHistory: existing.clearHistory ?? DEFAULT_SETTINGS.clearHistory,
    clearCache: existing.clearCache ?? DEFAULT_SETTINGS.clearCache,
    timeRangeDays: existing.timeRangeDays ?? DEFAULT_SETTINGS.timeRangeDays
  });
});

// 开机后定时补清，覆盖“清完又被同步/恢复标签页回填”的情况
const RECLEAN_ALARM = "recleanup";
const RECLEAN_MAX = 4;        // 总共补清 4 次
const RECLEAN_PERIOD = 0.5;   // 每 30 秒一次

// 防抖：避免冷启动时 onStartup 与 onCreated 重复清理
let lastRunAt = 0;
function runCleanup(trigger) {
  const now = Date.now();
  if (now - lastRunAt < 5000) {
    return;
  }
  lastRunAt = now;
  cleanBrowsingData(trigger).catch((error) => {
    console.error("自动清理失败：", error);
  });

  // 安排开机后的几次补清
  chrome.storage.local.set({ recleanLeft: RECLEAN_MAX });
  chrome.alarms.create(RECLEAN_ALARM, {
    delayInMinutes: RECLEAN_PERIOD,
    periodInMinutes: RECLEAN_PERIOD
  });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== RECLEAN_ALARM) {
    return;
  }

  const { recleanLeft = 0 } = await chrome.storage.local.get("recleanLeft");
  if (recleanLeft <= 0) {
    chrome.alarms.clear(RECLEAN_ALARM);
    return;
  }

  await chrome.storage.local.set({ recleanLeft: recleanLeft - 1 });
  cleanBrowsingData("startup").catch((error) => {
    console.error("延迟补清失败：", error);
  });

  if (recleanLeft - 1 <= 0) {
    chrome.alarms.clear(RECLEAN_ALARM);
  }
});

// 冷启动（彻底退出后重新启动 Chrome）
chrome.runtime.onStartup.addListener(() => {
  runCleanup("startup");
});

// 打开本次会话的第一个窗口时（覆盖进程在后台常驻、重新开窗口的情况）
chrome.windows.onCreated.addListener(async (window) => {
  if (window.type && window.type !== "normal") {
    return;
  }

  const normalWindows = await chrome.windows.getAll({ windowTypes: ["normal"] });
  if (normalWindows.length <= 1) {
    runCleanup("startup");
  }
});

// 手动触发：popup 点“立即清理”时发来消息
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "cleanNow") {
    return false;
  }

  cleanBrowsingData("manual")
    .then(() => sendResponse({ success: true }))
    .catch((error) => sendResponse({ success: false, error: error.message }));

  // 返回 true 让 service worker 保活，等异步清理完成后再回复
  return true;
});
