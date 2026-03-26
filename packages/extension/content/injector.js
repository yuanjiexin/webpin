/**
 * Content Script 入口
 * 初始化 WebPin，监听来自 background/popup 的消息
 */

// 内联 CSS 供 Shadow DOM 使用
// 在 extension 中通过 fetch 加载 CSS 文件
async function loadCSS() {
  try {
    const url = chrome.runtime.getURL('styles/annotation.css');
    const res = await fetch(url);
    return await res.text();
  } catch (e) {
    return '';
  }
}

let overlay = null;
let apiClient = null;
let initialized = false;

async function init() {
  if (initialized) return;
  initialized = true;

  const css = await loadCSS();
  // 将 CSS 内容注入全局变量供 overlay.js 使用
  window.WEBPIN_CSS = css;

  apiClient = new WebpinApiClient();
  await apiClient.init();

  overlay = new WebpinOverlay(apiClient);
  overlay.init();

  // 如果已登录且有项目，自动加载当前页面的批注
  if (apiClient.isLoggedIn() && apiClient.getProjectId()) {
    await overlay.loadAnnotations(apiClient.getProjectId());
  }
}

// 监听来自 popup/background 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message.action) {
      case 'init':
        await init();
        sendResponse({ ok: true });
        break;

      case 'activate':
        await init();
        overlay.activate();
        sendResponse({ ok: true });
        break;

      case 'deactivate':
        if (overlay) overlay.deactivate();
        sendResponse({ ok: true });
        break;

      case 'showSidebar':
        await init();
        overlay.showSidebar();
        sendResponse({ ok: true });
        break;

      case 'reload':
        // 用户登录后重新加载批注
        if (overlay && apiClient) {
          await apiClient.init();
          if (apiClient.isLoggedIn() && apiClient.getProjectId()) {
            await overlay.loadAnnotations(apiClient.getProjectId());
          }
        }
        sendResponse({ ok: true });
        break;

      default:
        sendResponse({ ok: false, error: 'Unknown action' });
    }
  })();
  return true; // 异步响应
});

// 页面加载完成后自动初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
