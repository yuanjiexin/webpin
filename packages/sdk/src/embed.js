/**
 * WebPin SDK — embed.js
 * 网站开发者嵌入一行代码即可启用反馈收集：
 * <script src="https://your-domain.com/embed.js" data-project-id="xxx" data-api-key="yyy"></script>
 */

import { getXPath, getCSSSelector, getTextQuote, getElementRect, resolveXPath } from './dom-mapper';
import { ANNOTATION_CSS } from './styles';

const API_BASE = 'https://your-domain.com/api/v1'; // 部署时替换

class WebpinSDK {
  constructor(config) {
    this.projectId = config.projectId;
    this.apiKey = config.apiKey;
    this.position = config.position || 'bottom-right';
    this.apiBase = config.apiBase || API_BASE;

    this._host = null;
    this._shadow = null;
    this._user = null;
    this._token = config.userToken || null;
    this._isActive = false;
    this._annotations = [];
    this._selectedColor = '#FFE082';
    this._activeBubble = null;
    this._highlightedEl = null;

    this._onMouseOver = this._onMouseOver.bind(this);
    this._onClick = this._onClick.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
  }

  async init() {
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', () => this.init());
      return;
    }

    this._createContainer();
    this._renderWidget();
    await this._loadAnnotations();
  }

  // ===== Shadow DOM 容器 =====
  _createContainer() {
    this._host = document.createElement('div');
    this._host.id = 'webpin-sdk-root';
    this._host.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483640;pointer-events:none;';
    this._shadow = this._host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = ANNOTATION_CSS;
    this._shadow.appendChild(style);

    this._root = document.createElement('div');
    this._root.id = 'webpin-sdk-container';
    this._shadow.appendChild(this._root);

    document.body.appendChild(this._host);
  }

  // ===== 悬浮按钮 =====
  _renderWidget() {
    const btn = document.createElement('button');
    btn.id = 'webpin-fab';
    btn.title = '添加反馈';
    btn.style.cssText = `
      position: fixed;
      ${this._getPositionStyle()}
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #FF6B35;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(255,107,53,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2147483646;
      pointer-events: all;
      transition: transform 0.2s, box-shadow 0.2s;
      font-size: 20px;
      color: white;
    `;
    btn.innerHTML = '✏️';
    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'scale(1.1)';
      btn.style.boxShadow = '0 6px 24px rgba(255,107,53,0.5)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'scale(1)';
      btn.style.boxShadow = '0 4px 16px rgba(255,107,53,0.4)';
    });
    btn.addEventListener('click', () => {
      if (this._isActive) {
        this._deactivate();
        btn.innerHTML = '✏️';
        btn.style.background = '#FF6B35';
      } else {
        this._activate();
        btn.innerHTML = '✕';
        btn.style.background = '#1a1a1a';
      }
    });

    this._root.appendChild(btn);
    this._host.style.overflow = 'visible';
  }

  _getPositionStyle() {
    const positions = {
      'bottom-right': 'bottom: 20px; right: 20px;',
      'bottom-left': 'bottom: 20px; left: 20px;',
      'top-right': 'top: 20px; right: 20px;',
      'top-left': 'top: 20px; left: 20px;',
    };
    return positions[this.position] || positions['bottom-right'];
  }

  // ===== 批注模式 =====
  _activate() {
    this._isActive = true;
    document.addEventListener('mouseover', this._onMouseOver, true);
    document.addEventListener('click', this._onClick, true);
    document.addEventListener('keydown', this._onKeyDown, true);
    document.body.style.cursor = 'crosshair';
  }

  _deactivate() {
    this._isActive = false;
    document.removeEventListener('mouseover', this._onMouseOver, true);
    document.removeEventListener('click', this._onClick, true);
    document.removeEventListener('keydown', this._onKeyDown, true);
    document.body.style.cursor = '';
    this._removeHighlight();
    this._closeBubble();
  }

  _onMouseOver(e) {
    const target = e.target;
    if (!target || target.closest('#webpin-sdk-root')) return;
    this._removeHighlight();
    target.classList.add('webpin-highlight');
    this._highlightedEl = target;
  }

  _removeHighlight() {
    if (this._highlightedEl) {
      this._highlightedEl.classList.remove('webpin-highlight');
      this._highlightedEl = null;
    }
  }

  _onClick(e) {
    if (e.target.closest('#webpin-sdk-root')) return;
    e.preventDefault();
    e.stopPropagation();
    const target = e.target;
    this._removeHighlight();
    this._closeBubble();
    this._showBubble(target, e.clientX, e.clientY);
  }

  _onKeyDown(e) {
    if (e.key === 'Escape') {
      if (this._activeBubble) this._closeBubble();
      else this._deactivate();
    }
  }

  // ===== 批注气泡 =====
  _showBubble(targetEl, clientX, clientY) {
    const COLORS = ['#FFE082', '#80CBC4', '#EF9A9A', '#A5D6A7', '#90CAF9', '#CE93D8'];
    const authorName = this._user?.name || '访客';
    const initial = authorName[0].toUpperCase();

    const bubble = document.createElement('div');
    bubble.className = 'webpin-bubble';
    bubble.style.pointerEvents = 'all';
    bubble.innerHTML = `
      <div class="webpin-bubble-header">
        <div class="webpin-avatar">${initial}</div>
        <span class="webpin-author-name">${authorName}</span>
      </div>
      <textarea placeholder="添加反馈..." rows="3" id="wp-textarea"></textarea>
      <div class="webpin-bubble-footer">
        <div class="webpin-colors">
          ${COLORS.map(c => `<div class="webpin-color-dot${c === this._selectedColor ? ' active' : ''}" data-color="${c}" style="background:${c}"></div>`).join('')}
        </div>
        <div class="webpin-bubble-actions">
          <button class="webpin-btn webpin-btn-cancel" id="wp-cancel">取消</button>
          <button class="webpin-btn webpin-btn-submit" id="wp-submit" disabled>提交</button>
        </div>
      </div>
    `;

    const vpW = window.innerWidth, vpH = window.innerHeight;
    let left = clientX + 8, top = clientY + 8;
    if (left + 300 > vpW - 8) left = vpW - 308;
    if (top + 160 > vpH - 8) top = clientY - 168;
    bubble.style.cssText += `left:${left}px;top:${top}px;position:fixed;`;

    this._root.appendChild(bubble);
    this._activeBubble = bubble;
    this._activeBubbleTarget = targetEl;

    const textarea = bubble.querySelector('#wp-textarea');
    const submitBtn = bubble.querySelector('#wp-submit');

    textarea.addEventListener('input', () => {
      submitBtn.disabled = !textarea.value.trim();
    });
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (textarea.value.trim()) submitBtn.click();
      }
    });
    bubble.querySelectorAll('.webpin-color-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        bubble.querySelectorAll('.webpin-color-dot').forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        this._selectedColor = dot.dataset.color;
      });
    });
    bubble.querySelector('#wp-cancel').addEventListener('click', () => this._closeBubble());
    submitBtn.addEventListener('click', async () => {
      const content = textarea.value.trim();
      if (!content) return;
      submitBtn.disabled = true;
      await this._submitAnnotation(targetEl, content);
    });

    textarea.focus();
  }

  _closeBubble() {
    if (this._activeBubble) {
      this._activeBubble.remove();
      this._activeBubble = null;
    }
  }

  // ===== API 调用 =====
  async _loadAnnotations() {
    try {
      const url = encodeURIComponent(window.location.href);
      const res = await fetch(
        `${this.apiBase}/annotations?projectId=${this.projectId}&url=${url}`,
        { headers: this._headers() }
      );
      if (!res.ok) return;
      this._annotations = await res.json();
      this._annotations.forEach(a => this._renderPin(a));
    } catch (e) {
      console.warn('[WebPin SDK] Failed to load annotations:', e.message);
    }
  }

  async _submitAnnotation(targetEl, content) {
    try {
      const res = await fetch(`${this.apiBase}/annotations`, {
        method: 'POST',
        headers: { ...this._headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: this.projectId,
          target_url: window.location.href,
          selector_xpath: getXPath(targetEl),
          selector_css: getCSSSelector(targetEl),
          selector_text_quote: getTextQuote(targetEl),
          element_rect: getElementRect(targetEl),
          content,
          color: this._selectedColor,
        }),
      });
      if (!res.ok) return;
      const annotation = await res.json();
      this._annotations.push(annotation);
      this._closeBubble();
      this._renderPin(annotation);
    } catch (e) {
      console.error('[WebPin SDK] Submit failed:', e);
    }
  }

  _renderPin(annotation) {
    const pin = document.createElement('div');
    pin.className = `webpin-pin${annotation.is_resolved ? ' resolved' : ''}`;
    pin.style.background = annotation.color || '#FFE082';
    pin.style.position = 'absolute';
    pin.style.pointerEvents = 'all';

    const idx = this._annotations.indexOf(annotation) + 1;
    pin.innerHTML = `<span class="webpin-pin-number">${idx}</span>`;

    if (annotation.element_rect) {
      const r = annotation.element_rect;
      pin.style.top = (r.top - 14) + 'px';
      pin.style.left = (r.left + (r.width || 0) + 4) + 'px';
    }

    this._root.appendChild(pin);
    this._host.style.overflow = 'visible';
  }

  _headers() {
    const h = { 'X-Api-Key': this.apiKey };
    if (this._token) h['Authorization'] = `Bearer ${this._token}`;
    return h;
  }
}

// ===== 自动初始化 =====
(function autoInit() {
  const script = document.currentScript ||
    document.querySelector('script[data-project-id]');

  if (!script) return;

  const projectId = script.dataset.projectId;
  const apiKey = script.dataset.apiKey;
  const position = script.dataset.position;
  const apiBase = script.dataset.apiBase;

  if (!projectId) {
    console.warn('[WebPin SDK] data-project-id is required');
    return;
  }

  const sdk = new WebpinSDK({ projectId, apiKey, position, apiBase });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => sdk.init());
  } else {
    sdk.init();
  }

  // 暴露全局 API
  window.WebPin = sdk;
})();
