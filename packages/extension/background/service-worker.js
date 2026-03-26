/**
 * Manifest V3 Service Worker
 * 处理扩展图标点击、tab 事件等
 */

// 扩展图标点击时，向当前 tab 发送激活消息
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/dom-mapper.js', 'content/api-client.js', 'content/overlay.js', 'content/injector.js'],
    });
  } catch (e) {
    // 脚本可能已注入，忽略错误
  }

  // 检查当前状态，切换激活/关闭
  const response = await chrome.tabs.sendMessage(tab.id, { action: 'activate' }).catch(() => null);
});

// 安装时打开设置页
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('ui/popup.html') });
  }
});
