/**
 * DOM 目标定位模块
 * 负责生成和解析元素的 XPath / CSS 选择器，用于批注持久化
 */

/**
 * 生成元素的最短唯一 XPath
 */
function getXPath(element) {
  if (!element || element.nodeType !== 1) return null;

  // 如果有唯一 id，直接用
  if (element.id) {
    return `//*[@id="${element.id}"]`;
  }

  const parts = [];
  let current = element;

  while (current && current.nodeType === 1 && current !== document.documentElement) {
    let index = 1;
    let sibling = current.previousSibling;
    while (sibling) {
      if (sibling.nodeType === 1 && sibling.tagName === current.tagName) {
        index++;
      }
      sibling = sibling.previousSibling;
    }
    const tag = current.tagName.toLowerCase();
    parts.unshift(`${tag}[${index}]`);
    current = current.parentNode;
  }

  return '/html/' + parts.join('/');
}

/**
 * 解析 XPath，返回对应元素
 */
function resolveXPath(xpath) {
  if (!xpath) return null;
  try {
    const result = document.evaluate(
      xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    return result.singleNodeValue;
  } catch (e) {
    return null;
  }
}

/**
 * 生成简短 CSS 选择器
 * 如果元素有 id 用 id，否则用 nth-child 路径
 */
function getCSSSelector(element) {
  if (!element || element.nodeType !== 1) return null;
  if (element.id) return `#${element.id}`;

  const parts = [];
  let current = element;

  while (current && current !== document.body && current.nodeType === 1) {
    let selector = current.tagName.toLowerCase();

    if (current.id) {
      selector = `#${current.id}`;
      parts.unshift(selector);
      break;
    }

    // 只有在有同名兄弟时才加 nth-child
    const siblings = Array.from(current.parentNode?.children || []).filter(
      (s) => s.tagName === current.tagName
    );
    if (siblings.length > 1) {
      const index = siblings.indexOf(current) + 1;
      selector += `:nth-of-type(${index})`;
    }

    parts.unshift(selector);
    current = current.parentNode;
  }

  return parts.join(' > ');
}

/**
 * 提取选中文字内容（作为 textQuote fallback）
 */
function getTextQuote(element) {
  const text = element.textContent?.trim();
  if (!text || text.length > 200) return null;
  return text;
}

/**
 * 获取元素相对于文档的位置（非视口）
 */
function getElementRect(element) {
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top + window.scrollY,
    left: rect.left + window.scrollX,
    width: rect.width,
    height: rect.height,
  };
}

// 导出（Extension 用 window 挂载，SDK 用 module.exports）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getXPath, resolveXPath, getCSSSelector, getTextQuote, getElementRect };
} else {
  window.WebpinDomMapper = { getXPath, resolveXPath, getCSSSelector, getTextQuote, getElementRect };
}
