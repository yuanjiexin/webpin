/**
 * Shadow DOM 批注覆盖层
 * 所有 UI 元素都在 Shadow DOM 中渲染，不影响宿主页面样式
 */

const COLORS = ['#FFE082', '#80CBC4', '#EF9A9A', '#A5D6A7', '#90CAF9', '#CE93D8'];

class WebpinOverlay {
  constructor(apiClient) {
    this.apiClient = apiClient;
    this.host = null;
    this.shadow = null;
    this.isActive = false;         // 批注模式是否激活
    this.annotations = [];
    this.selectedColor = COLORS[0];
    this.activeBubble = null;
    this.highlightedEl = null;
    this._onMouseOver = this._onMouseOver.bind(this);
    this._onClick = this._onClick.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
  }

  /** 初始化 Shadow DOM 根节点 */
  init() {
    this.host = document.createElement('div');
    this.host.id = 'webpin-root';
    this.host.style.cssText = 'position:absolute;top:0;left:0;width:0;height:0;z-index:2147483640;pointer-events:none;overflow:visible;';
    this.shadow = this.host.attachShadow({ mode: 'open' });

    // Shadow DOM 内部样式（侧边栏、气泡、标签等）
    const style = document.createElement('style');
    style.textContent = window.WEBPIN_CSS || '';
    this.shadow.appendChild(style);

    // 页面级样式（highlight/selected 直接作用于宿主页面元素，必须注入 <head>）
    if (!document.getElementById('webpin-page-styles')) {
      const pageStyle = document.createElement('style');
      pageStyle.id = 'webpin-page-styles';
      pageStyle.textContent = `
        .webpin-highlight {
          outline: 2px solid #FF6B35 !important;
          outline-offset: 2px !important;
          cursor: crosshair !important;
          background-color: rgba(255, 107, 53, 0.06) !important;
        }
        .webpin-selected {
          outline: 2px dashed #FF6B35 !important;
          outline-offset: 3px !important;
          background-color: rgba(255, 107, 53, 0.08) !important;
        }
      `;
      document.head.appendChild(pageStyle);
    }

    this.root = document.createElement('div');
    this.root.id = 'webpin-container';
    this.shadow.appendChild(this.root);

    document.body.appendChild(this.host);
  }

  /** 激活批注模式 */
  activate() {
    if (this.isActive) return;
    this.isActive = true;
    document.addEventListener('mouseover', this._onMouseOver, true);
    document.addEventListener('click', this._onClick, true);
    document.addEventListener('keydown', this._onKeyDown, true);
    this._showToolbar();
  }

  /** 退出批注模式 */
  deactivate() {
    if (!this.isActive) return;
    this.isActive = false;
    document.removeEventListener('mouseover', this._onMouseOver, true);
    document.removeEventListener('click', this._onClick, true);
    document.removeEventListener('keydown', this._onKeyDown, true);
    this._removeHighlight();
    this._closeBubble();
    this._hideToolbar();
  }

  /** 鼠标悬停时高亮元素 */
  _onMouseOver(e) {
    if (!this.isActive) return;
    const target = e.target;
    if (!target || target.closest('#webpin-root')) return;

    this._removeHighlight();
    target.classList.add('webpin-highlight');
    this.highlightedEl = target;
  }

  _removeHighlight() {
    if (this.highlightedEl) {
      this.highlightedEl.classList.remove('webpin-highlight');
      this.highlightedEl = null;
    }
  }

  /** 点击目标元素，弹出批注输入框 */
  _onClick(e) {
    if (!this.isActive) return;
    if (e.target.closest('#webpin-root')) return;

    e.preventDefault();
    e.stopPropagation();

    const target = e.target;
    this._removeHighlight();
    this._closeBubble();

    // 气泡打开期间保持选中框
    target.classList.add('webpin-selected');
    this._selectedEl = target;

    this._showBubble(target, e.clientX, e.clientY);
  }

  /** ESC 退出批注模式或关闭气泡 */
  _onKeyDown(e) {
    if (e.key === 'Escape') {
      if (this.activeBubble) {
        this._closeBubble();
      } else {
        this.deactivate();
      }
    }
  }

  /** 显示批注输入气泡 */
  _showBubble(targetEl, clientX, clientY) {
    const user = this.apiClient.getUser();

    const bubble = document.createElement('div');
    bubble.className = 'webpin-bubble';
    bubble.style.pointerEvents = 'all';

    // 头部：作者信息
    const initial = user ? (user.name[0] || '?').toUpperCase() : '?';
    const avatarHtml = user?.avatar_url
      ? `<img src="${user.avatar_url}" alt="">`
      : initial;

    bubble.innerHTML = `
      <div class="webpin-bubble-header">
        <div class="webpin-avatar">${avatarHtml}</div>
        <span class="webpin-author-name">${user ? user.name : '匿名用户'}</span>
      </div>
      <textarea placeholder="添加批注... (Enter 提交)" rows="3" id="webpin-textarea"></textarea>
      <div class="webpin-bubble-footer">
        <div class="webpin-colors">
          ${COLORS.map(c => `<div class="webpin-color-dot${c === this.selectedColor ? ' active' : ''}" data-color="${c}" style="background:${c}"></div>`).join('')}
        </div>
        <div class="webpin-bubble-actions">
          <button class="webpin-btn webpin-btn-cancel" id="webpin-cancel">取消</button>
          <button class="webpin-btn webpin-btn-submit" id="webpin-submit" disabled>提交</button>
        </div>
      </div>
    `;

    // 定位气泡（避免超出视口）
    const vpW = window.innerWidth;
    const vpH = window.innerHeight;
    const bubbleW = 300;
    const bubbleH = 160;
    let left = clientX + 8;
    let top = clientY + 8;
    if (left + bubbleW > vpW - 8) left = vpW - bubbleW - 8;
    if (top + bubbleH > vpH - 8) top = clientY - bubbleH - 8;
    bubble.style.left = left + 'px';
    bubble.style.top = top + 'px';
    bubble.style.position = 'fixed';

    this.root.appendChild(bubble);
    this.activeBubble = bubble;
    this.activeBubbleTarget = targetEl;

    // 事件
    const textarea = bubble.querySelector('#webpin-textarea');
    const submitBtn = bubble.querySelector('#webpin-submit');

    textarea.addEventListener('input', () => {
      submitBtn.disabled = !textarea.value.trim();
    });

    // Enter 提交（Shift+Enter 换行）
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
        this.selectedColor = dot.dataset.color;
      });
    });

    bubble.querySelector('#webpin-cancel').addEventListener('click', () => this._closeBubble());

    submitBtn.addEventListener('click', async () => {
      const content = textarea.value.trim();
      if (!content) return;
      submitBtn.disabled = true;
      submitBtn.textContent = '提交中...';
      await this._submitAnnotation(targetEl, content);
    });

    textarea.focus();
  }

  _closeBubble() {
    if (this.activeBubble) {
      this.activeBubble.remove();
      this.activeBubble = null;
      this.activeBubbleTarget = null;
    }
    // 关闭气泡时移除选中框
    if (this._selectedEl) {
      this._selectedEl.classList.remove('webpin-selected');
      this._selectedEl = null;
    }
  }

  /** 提交批注到后端 */
  async _submitAnnotation(targetEl, content) {
    const { getXPath, getCSSSelector, getTextQuote, getElementRect } = window.WebpinDomMapper;

    const annotation = await this.apiClient.createAnnotation({
      target_url: window.location.href,
      selector_xpath: getXPath(targetEl),
      selector_css: getCSSSelector(targetEl),
      selector_text_quote: getTextQuote(targetEl),
      element_rect: getElementRect(targetEl),
      content,
      color: this.selectedColor,
    });

    if (annotation) {
      this.annotations.unshift(annotation);
      this._closeBubble();
      this._renderPin(annotation);
      this._updateSidebar();
    }
  }

  /** 清除页面上所有批注标记 */
  _clearPins() {
    // 移除所有标签元素
    this.root.querySelectorAll('.webpin-label').forEach(el => el.remove());
    // 恢复所有被标记元素的样式
    this.annotations.forEach(a => {
      const { resolveXPath } = window.WebpinDomMapper;
      const targetEl = resolveXPath(a.selector_xpath) ||
        (a.selector_css ? document.querySelector(a.selector_css) : null);
      if (targetEl && targetEl._webpinMarked) {
        targetEl.style.outline = '';
        targetEl.style.outlineOffset = '';
        targetEl._webpinMarked = null;
      }
    });
    this.annotations = [];
  }

  /** 加载并渲染已有批注 */
  async loadAnnotations(projectId) {
    this._clearPins();
    const list = await this.apiClient.getAnnotations(projectId, window.location.href);
    if (!list) return;
    this.annotations = list;
    list.forEach(a => this._renderPin(a));
    this._updateSidebar();
  }

  /** 渲染批注标记：虚线框住目标元素 + 内容预览标签 */
  _renderPin(annotation) {
    const { resolveXPath } = window.WebpinDomMapper;

    const targetEl = resolveXPath(annotation.selector_xpath) ||
      (annotation.selector_css ? document.querySelector(annotation.selector_css) : null);

    const color = annotation.color || '#FFE082';
    const rect = annotation.element_rect;
    if (!rect) return;

    // 给目标元素加虚线边框（直接作用于元素，清晰框选范围）
    if (targetEl && !targetEl._webpinMarked) {
      targetEl._webpinMarked = annotation.id;
      targetEl.style.outline = `2px dashed ${color}`;
      targetEl.style.outlineOffset = '3px';
    }

    // 内容预览标签（显示在元素正下方）
    const authorName = annotation.author_name || annotation.author?.name || '匿名';
    const snippet = annotation.content.length > 24
      ? annotation.content.slice(0, 24) + '…'
      : annotation.content;

    const label = document.createElement('div');
    label.className = 'webpin-label';
    label.dataset.annotationId = annotation.id;
    label.style.cssText = `
      position: absolute;
      top: ${rect.top + rect.height + 6}px;
      left: ${rect.left}px;
      pointer-events: all;
      background: ${color};
      max-width: ${Math.max(rect.width, 120)}px;
      ${annotation.is_resolved ? 'display:none;' : ''}
    `;
    label.innerHTML = `
      <span class="webpin-label-author">${authorName}</span>
      <span class="webpin-label-text">${this._escapeHtml(snippet)}</span>
    `;

    label.addEventListener('click', () => {
      this._highlightCard(annotation.id);
      this.showSidebar();
      if (targetEl) targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    this.root.appendChild(label);
    this.host.style.overflow = 'visible';
  }

  /** 显示/隐藏侧边栏 */
  showSidebar() {
    let sidebar = this.shadow.querySelector('.webpin-sidebar');
    if (!sidebar) {
      sidebar = this._createSidebar();
    }
    sidebar.classList.remove('hidden');
    sidebar.style.pointerEvents = 'all';
  }

  hideSidebar() {
    const sidebar = this.shadow.querySelector('.webpin-sidebar');
    if (sidebar) sidebar.classList.add('hidden');
  }

  _createSidebar() {
    const sidebar = document.createElement('div');
    sidebar.className = 'webpin-sidebar';
    sidebar.style.pointerEvents = 'all';

    const projectName = this.apiClient.getProjectName() || '未命名项目';

    sidebar.innerHTML = `
      <div class="webpin-sidebar-header">
        <div class="webpin-sidebar-title">
          <div class="webpin-logo">W</div>
          <div>
            <div style="font-size:13px;font-weight:700;color:#1a1a1a;">WebPin</div>
            <div style="font-size:11px;color:#999;font-weight:400;margin-top:1px;">📁 ${projectName}</div>
          </div>
          <span class="webpin-badge" id="webpin-count">0</span>
        </div>
        <button class="webpin-close-btn" id="webpin-sidebar-close">✕</button>
      </div>
      <div class="webpin-sidebar-filters">
        <button class="webpin-filter-btn active" data-filter="all">全部</button>
        <button class="webpin-filter-btn" data-filter="open">未解决</button>
        <button class="webpin-filter-btn" data-filter="resolved">已解决</button>
      </div>
      <div class="webpin-annotations-list" id="webpin-list"></div>
    `;

    sidebar.querySelector('#webpin-sidebar-close').addEventListener('click', () => this.hideSidebar());

    sidebar.querySelectorAll('.webpin-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        sidebar.querySelectorAll('.webpin-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._renderAnnotationList(btn.dataset.filter);
      });
    });

    this.shadow.appendChild(sidebar);
    this._updateSidebar();
    return sidebar;
  }

  _updateSidebar() {
    const countEl = this.shadow.querySelector('#webpin-count');
    if (countEl) countEl.textContent = this.annotations.length;
    this._renderAnnotationList('all');
  }

  _renderAnnotationList(filter = 'all') {
    const list = this.shadow.querySelector('#webpin-list');
    if (!list) return;

    let items = [...this.annotations].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    if (filter === 'open') items = items.filter(a => !a.is_resolved);
    if (filter === 'resolved') items = items.filter(a => a.is_resolved);

    if (items.length === 0) {
      list.innerHTML = `
        <div class="webpin-empty-state">
          <div class="webpin-empty-icon">💬</div>
          <div>暂无批注</div>
        </div>
      `;
      return;
    }

    list.innerHTML = items.map((a, i) => {
      const authorName = a.author_name || a.author?.name || '匿名用户';
      const initial = authorName[0].toUpperCase();
      const avatarHtml = a.author_avatar || a.author?.avatar_url
        ? `<img src="${a.author_avatar || a.author?.avatar_url}" alt="">`
        : initial;
      const time = new Date(a.created_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const replies = a.replies || [];

      return `
        <div class="webpin-card${a.is_resolved ? ' resolved' : ''}" data-id="${a.id}">
          <div class="webpin-card-header">
            <div class="webpin-card-author">
              <div class="webpin-avatar" style="width:24px;height:24px;font-size:11px;">${avatarHtml}</div>
              <span class="webpin-author-name">${authorName}</span>
            </div>
            <span class="webpin-card-meta">${time}</span>
          </div>
          <div class="webpin-card-content">${this._escapeHtml(a.content)}</div>
          <div class="webpin-card-actions">
            <button class="webpin-action-btn resolve" data-id="${a.id}" data-resolved="${a.is_resolved}">
              ${a.is_resolved ? '重新打开' : '✓ 标记解决'}
            </button>
            ${replies.length > 0 ? `<span class="webpin-card-meta">${replies.length} 条回复</span>` : ''}
          </div>
          ${this._renderReplies(a)}
        </div>
      `;
    }).join('');

    // 绑定事件
    list.querySelectorAll('.webpin-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.webpin-action-btn') || e.target.closest('.webpin-reply-submit')) return;
        this._highlightCard(card.dataset.id);
      });
    });

    list.querySelectorAll('.webpin-action-btn.resolve').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const resolved = btn.dataset.resolved === 'true';
        await this.apiClient.resolveAnnotation(btn.dataset.id, !resolved);
        const a = this.annotations.find(x => x.id === btn.dataset.id);
        if (a) {
          a.is_resolved = !resolved;
          this._updateSidebar();
          this._updatePins();
        }
      });
    });

    list.querySelectorAll('.webpin-reply-submit').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const row = btn.closest('.webpin-reply-input-row');
        const input = row.querySelector('.webpin-reply-input');
        const content = input.value.trim();
        if (!content) return;

        const annotationId = btn.dataset.annotationId;
        const reply = await this.apiClient.createReply(annotationId, content);
        if (reply) {
          const a = this.annotations.find(x => x.id === annotationId);
          if (a) {
            if (!a.replies) a.replies = [];
            a.replies.push(reply);
            this._updateSidebar();
          }
        }
      });
    });
  }

  _renderReplies(annotation) {
    const replies = annotation.replies || [];
    return `
      <div class="webpin-replies">
        ${replies.map(r => {
          const name = r.author_name || '匿名用户';
          return `
            <div class="webpin-reply">
              <div class="webpin-avatar" style="width:22px;height:22px;font-size:10px;flex-shrink:0;">${name[0].toUpperCase()}</div>
              <div class="webpin-reply-content">
                <div class="webpin-reply-author">${name}</div>
                <div class="webpin-reply-text">${this._escapeHtml(r.content)}</div>
              </div>
            </div>
          `;
        }).join('')}
        <div class="webpin-reply-input-row">
          <textarea class="webpin-reply-input" placeholder="回复..." rows="1"></textarea>
          <button class="webpin-reply-submit" data-annotation-id="${annotation.id}">发送</button>
        </div>
      </div>
    `;
  }

  _highlightCard(annotationId) {
    this.shadow.querySelectorAll('.webpin-card').forEach(c => c.classList.remove('active'));
    const card = this.shadow.querySelector(`.webpin-card[data-id="${annotationId}"]`);
    if (card) {
      card.classList.add('active');
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  _updatePins() {
    this.shadow.querySelectorAll('.webpin-label').forEach(label => {
      const a = this.annotations.find(x => x.id === label.dataset.annotationId);
      if (!a) return;
      label.style.display = a.is_resolved ? 'none' : '';
      // 同步移除目标元素的虚线框
      if (a.is_resolved) {
        const { resolveXPath } = window.WebpinDomMapper;
        const targetEl = resolveXPath(a.selector_xpath) ||
          (a.selector_css ? document.querySelector(a.selector_css) : null);
        if (targetEl && targetEl._webpinMarked === a.id) {
          targetEl.style.outline = '';
          targetEl.style.outlineOffset = '';
          targetEl._webpinMarked = null;
        }
      }
    });
  }

  _showToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'webpin-toolbar';
    toolbar.style.pointerEvents = 'all';
    toolbar.innerHTML = `
      <div class="webpin-toolbar-dot"></div>
      <span>批注模式已激活 — 点击任意元素添加批注</span>
      <button class="webpin-toolbar-exit" id="webpin-exit-mode">退出</button>
    `;
    toolbar.querySelector('#webpin-exit-mode').addEventListener('click', () => this.deactivate());
    this.root.appendChild(toolbar);
    this.activeToolbar = toolbar;
  }

  _hideToolbar() {
    if (this.activeToolbar) {
      this.activeToolbar.remove();
      this.activeToolbar = null;
    }
  }

  _escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WebpinOverlay;
} else {
  window.WebpinOverlay = WebpinOverlay;
}
