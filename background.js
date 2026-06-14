const DEFAULT_SETTINGS = {
  clearHistory: true,
  clearCache: true,
  timeRangeDays: 0
};

async function getSettings() {
  return chrome.storage.local.get(DEFAULT_SETTINGS);
}

async function cleanBrowsingData() {
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
        trigger: "startup",
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
        trigger: "startup",
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

chrome.runtime.onStartup.addListener(() => {
  cleanBrowsingData().catch((error) => {
    console.error("启动清理失败：", error);
  });
});
