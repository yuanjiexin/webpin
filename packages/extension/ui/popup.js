const API_BASE = 'http://localhost:3001/api/v1';

// ===== 状态 =====
let currentUser = null;
let currentToken = null;
let projects = [];
let selectedProjectId = null;

// ===== 初始化 =====
async function initPopup() {
  const data = await storageGet(['token', 'user', 'projectId', 'projectName']);
  currentToken = data.token;
  currentUser = data.user;
  selectedProjectId = data.projectId;

  if (currentToken && currentUser) {
    showMainView();
  } else {
    showAuthView();
  }
}

// ===== 视图切换 =====
function showAuthView() {
  document.getElementById('view-auth').style.display = 'block';
  document.getElementById('view-main').style.display = 'none';
}

function showMainView() {
  document.getElementById('view-auth').style.display = 'none';
  document.getElementById('view-main').style.display = 'block';

  document.getElementById('user-name').textContent = currentUser.name;
  document.getElementById('user-email').textContent = currentUser.email;
  document.getElementById('user-avatar').textContent = (currentUser.name[0] || '?').toUpperCase();

  loadProjects();
}

// ===== 认证 =====
document.getElementById('go-register').addEventListener('click', () => {
  document.getElementById('login-form').style.display = 'none';
  document.getElementById('register-form').style.display = 'block';
  clearError();
});

document.getElementById('go-login').addEventListener('click', () => {
  document.getElementById('register-form').style.display = 'none';
  document.getElementById('login-form').style.display = 'block';
  clearError();
});

document.getElementById('login-btn').addEventListener('click', async () => {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  if (!email || !password) return showError('请填写所有字段');

  const btn = document.getElementById('login-btn');
  btn.disabled = true;
  btn.textContent = '登录中...';

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }).catch(e => { throw new Error('无法连接后端，请确认后端已启动 (http://localhost:3001)'); });

    const data = await res.json();
    if (!res.ok) return showError(data.error || '登录失败');

    await saveAuth(data.token, data.user);
    showMainView();
  } catch(e) {
    showError(e.message || '登录失败，请重试');
  } finally {
    btn.disabled = false;
    btn.textContent = '登录';
  }
});

document.getElementById('register-btn').addEventListener('click', async () => {
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  if (!name || !email || !password) return showError('请填写所有字段');

  const btn = document.getElementById('register-btn');
  btn.disabled = true;
  btn.textContent = '注册中...';

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    }).catch(e => { throw new Error('无法连接后端，请确认后端已启动 (http://localhost:3001)'); });

    const data = await res.json();
    if (!res.ok) return showError(data.error || '注册失败');

    await saveAuth(data.token, data.user);
    showMainView();
  } catch(e) {
    showError(e.message || '注册失败，请重试');
  } finally {
    btn.disabled = false;
    btn.textContent = '注册';
  }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await chrome.storage.local.remove(['token', 'user', 'projectId']);
  currentToken = null;
  currentUser = null;
  selectedProjectId = null;
  showAuthView();
});

// ===== 项目管理 =====
async function loadProjects() {
  try {
    const res = await fetch(`${API_BASE}/projects`, {
      headers: { Authorization: `Bearer ${currentToken}` },
    });
    if (!res.ok) return;
    projects = await res.json();
    renderProjectSelect();
    // 补存项目名（修复旧数据没有 projectName 的情况）
    if (selectedProjectId) {
      const p = projects.find(x => x.id === selectedProjectId);
      if (p) await chrome.storage.local.set({ projectName: p.name });
    }
  } catch (e) {
    console.error('load projects error:', e);
  }
}

function renderProjectSelect() {
  const select = document.getElementById('project-select');
  select.innerHTML = '<option value="">— 选择项目 —</option>';
  projects.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.name} (${p.open_annotation_count || 0} 条未解决)`;
    if (p.id === selectedProjectId) opt.selected = true;
    select.appendChild(opt);
  });
}

document.getElementById('project-select').addEventListener('change', async (e) => {
  selectedProjectId = e.target.value || null;
  const selectedProject = projects.find(p => p.id === selectedProjectId);
  await chrome.storage.local.set({
    projectId: selectedProjectId,
    projectName: selectedProject?.name || '',
  });
  // 通知 content script 重新加载批注
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { action: 'reload' }).catch(() => {});
  }
});

document.getElementById('create-project-btn').addEventListener('click', async () => {
  const name = document.getElementById('new-project-name').value.trim();
  if (!name) return;

  try {
    const res = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${currentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return;
    const project = await res.json();
    projects.unshift(project);
    selectedProjectId = project.id;
    await chrome.storage.local.set({ projectId: selectedProjectId, projectName: project.name });
    document.getElementById('new-project-name').value = '';
    renderProjectSelect();
    // 通知 content script 切换到新项目并刷新批注
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { action: 'reload' }).catch(() => {});
    }
  } catch (e) {
    console.error('create project error:', e);
  }
});


// ===== 批注操作 =====
document.getElementById('activate-btn').addEventListener('click', async () => {
  if (!selectedProjectId) {
    alert('请先选择或创建一个项目');
    return;
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    alert('无法获取当前标签页');
    return;
  }

  // chrome:// 页面无法注入脚本
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    alert('请先切换到一个普通网页（如 baidu.com），再激活批注模式');
    return;
  }

  try {
    // 先尝试发消息给已注入的 content script
    await chrome.tabs.sendMessage(tab.id, { action: 'activate' });
  } catch (e) {
    // content script 未注入，手动注入
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: [
          'content/dom-mapper.js',
          'content/api-client.js',
          'content/overlay.js',
          'content/injector.js',
        ],
      });
      // 等 injector 初始化完成
      await new Promise(r => setTimeout(r, 500));
      await chrome.tabs.sendMessage(tab.id, { action: 'activate' });
    } catch (e2) {
      alert('注入失败：' + e2.message);
      return;
    }
  }
  window.close();
});

document.getElementById('sidebar-btn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) { window.close(); return; }

  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    alert('请先切换到一个普通网页');
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'showSidebar' });
  } catch (e) {
    // content script 未注入，先注入再发消息
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content/dom-mapper.js', 'content/api-client.js', 'content/overlay.js', 'content/injector.js'],
      });
      await new Promise(r => setTimeout(r, 500));
      await chrome.tabs.sendMessage(tab.id, { action: 'showSidebar' });
    } catch (e2) {
      alert('打开失败：' + e2.message);
      return;
    }
  }
  window.close();
});

// ===== 工具函数 =====
function showError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  el.style.display = 'block';
}

function clearError() {
  const el = document.getElementById('auth-error');
  el.style.display = 'none';
}

async function saveAuth(token, user) {
  currentToken = token;
  currentUser = user;
  await chrome.storage.local.set({ token, user });
}

function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

// 启动
initPopup();
