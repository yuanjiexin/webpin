/**
 * WebPin API 客户端（Content Script 版本）
 * 通过 chrome.storage 读取 token，与后端通信
 */

const DEFAULT_API_BASE = 'https://webpin-backend.netlify.app/api/v1';

class WebpinApiClient {
  constructor() {
    this._user = null;
    this._token = null;
    this._projectId = null;
    this._apiBase = DEFAULT_API_BASE;
  }

  async init() {
    const data = await this._storageGet(['token', 'user', 'projectId', 'projectName', 'apiBase']);
    this._token = data.token || null;
    this._user = data.user || null;
    this._projectId = data.projectId || null;
    this._projectName = data.projectName || '';
    this._apiBase = normalizeApiBase(data.apiBase) || DEFAULT_API_BASE;
  }

  getUser() { return this._user; }
  getProjectId() { return this._projectId; }
  getProjectName() { return this._projectName; }

  isLoggedIn() {
    return !!this._token;
  }

  async getAnnotations(projectId, url) {
    try {
      const encodedUrl = encodeURIComponent(url);
      const res = await fetch(
        `${this._apiBase}/annotations?projectId=${projectId}&url=${encodedUrl}`,
        { headers: this._headers() }
      );
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.error('[WebPin] getAnnotations error:', e);
      return null;
    }
  }

  async createAnnotation(data) {
    try {
      const res = await fetch(`${this._apiBase}/annotations`, {
        method: 'POST',
        headers: { ...this._headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, projectId: this._projectId }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.error('[WebPin] createAnnotation error:', e);
      return null;
    }
  }

  async resolveAnnotation(annotationId, resolved) {
    try {
      const res = await fetch(`${this._apiBase}/annotations/${annotationId}/resolve`, {
        method: 'PATCH',
        headers: { ...this._headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.error('[WebPin] resolveAnnotation error:', e);
      return null;
    }
  }

  async createReply(annotationId, content) {
    try {
      const res = await fetch(`${this._apiBase}/annotations/${annotationId}/replies`, {
        method: 'POST',
        headers: { ...this._headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.error('[WebPin] createReply error:', e);
      return null;
    }
  }

  _headers() {
    const h = {};
    if (this._token) h['Authorization'] = `Bearer ${this._token}`;
    return h;
  }

  _storageGet(keys) {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(keys, resolve);
      } else {
        // fallback for SDK
        const result = {};
        keys.forEach(k => {
          const v = localStorage.getItem(`webpin_${k}`);
          if (v) result[k] = JSON.parse(v);
        });
        resolve(result);
      }
    });
  }
}

function normalizeApiBase(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  return v.endsWith('/') ? v.slice(0, -1) : v;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = WebpinApiClient;
} else {
  window.WebpinApiClient = WebpinApiClient;
}
