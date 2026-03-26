export function getXPath(element) {
  if (!element || element.nodeType !== 1) return null;
  if (element.id) return `//*[@id="${element.id}"]`;

  const parts = [];
  let current = element;
  while (current && current.nodeType === 1 && current !== document.documentElement) {
    let index = 1;
    let sibling = current.previousSibling;
    while (sibling) {
      if (sibling.nodeType === 1 && sibling.tagName === current.tagName) index++;
      sibling = sibling.previousSibling;
    }
    parts.unshift(`${current.tagName.toLowerCase()}[${index}]`);
    current = current.parentNode;
  }
  return '/html/' + parts.join('/');
}

export function resolveXPath(xpath) {
  if (!xpath) return null;
  try {
    return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
  } catch { return null; }
}

export function getCSSSelector(element) {
  if (!element || element.nodeType !== 1) return null;
  if (element.id) return `#${element.id}`;
  const parts = [];
  let current = element;
  while (current && current !== document.body && current.nodeType === 1) {
    let selector = current.tagName.toLowerCase();
    if (current.id) { parts.unshift(`#${current.id}`); break; }
    const siblings = Array.from(current.parentNode?.children || []).filter(s => s.tagName === current.tagName);
    if (siblings.length > 1) selector += `:nth-of-type(${siblings.indexOf(current) + 1})`;
    parts.unshift(selector);
    current = current.parentNode;
  }
  return parts.join(' > ');
}

export function getTextQuote(element) {
  const text = element.textContent?.trim();
  return (!text || text.length > 200) ? null : text;
}

export function getElementRect(element) {
  const rect = element.getBoundingClientRect();
  return { top: rect.top + window.scrollY, left: rect.left + window.scrollX, width: rect.width, height: rect.height };
}
