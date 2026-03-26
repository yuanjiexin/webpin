# WebPin — 网页批注工具

类似 [markup.io](https://www.markup.io/) 的网页批注协作工具。

## 项目结构

```
webpin/
├── packages/
│   ├── backend/     # Node.js + Express + PostgreSQL API
│   ├── extension/   # Chrome Extension (Manifest V3)
│   └── sdk/         # JS SDK (嵌入式脚本)
├── docker-compose.yml
└── test-sdk.html    # SDK 测试页面
```

## 快速启动

### 1. 启动后端（需要 Docker）

```bash
cd webpin
docker-compose up -d
```

或者手动启动（需要本地 PostgreSQL）：

```bash
cd packages/backend
cp .env.example .env
# 编辑 .env 填入数据库连接信息
npm install
node src/migrate.js   # 初始化数据库
npm run dev           # 启动服务 (http://localhost:3001)
```

### 2. 加载 Chrome 扩展

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `packages/extension` 文件夹

### 3. 使用扩展

1. 点击扩展图标，注册/登录账号
2. 创建一个项目
3. 点击「激活批注模式」
4. 点击页面任意元素添加批注

### 4. 使用 SDK

在你的网页中嵌入：

```html
<script
  src="http://localhost:3001/embed.js"
  data-project-id="YOUR_PROJECT_ID"
  data-api-key="YOUR_API_KEY"
></script>
```

API Key 可在扩展的项目管理页面复制。

## API 文档

后端运行后访问：`http://localhost:3001/health` 验证服务状态

### 认证
- `POST /api/v1/auth/register` — 注册
- `POST /api/v1/auth/login` — 登录
- `GET /api/v1/auth/me` — 获取当前用户

### 项目
- `POST /api/v1/projects` — 创建项目
- `GET /api/v1/projects` — 获取我的项目列表

### 批注
- `GET /api/v1/annotations?projectId=&url=` — 获取页面批注
- `POST /api/v1/annotations` — 创建批注
- `PUT /api/v1/annotations/:id` — 编辑批注
- `DELETE /api/v1/annotations/:id` — 删除批注
- `PATCH /api/v1/annotations/:id/resolve` — 标记解决

### 回复
- `POST /api/v1/annotations/:id/replies` — 添加回复
- `GET /api/v1/annotations/:id/replies` — 获取回复列表

## 技术栈

| 层 | 技术 |
|---|---|
| Chrome Extension | Manifest V3, Vanilla JS |
| JS SDK | Vanilla JS + Rollup (IIFE) |
| 后端 | Node.js + Express + Socket.io |
| 数据库 | PostgreSQL |
| 认证 | JWT |
| 部署 | Docker Compose |
