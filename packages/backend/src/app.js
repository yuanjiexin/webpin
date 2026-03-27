require('dotenv').config();
const express = require('express');
const cors = require('cors');

const db = require('./db');
const authRoutes = require('./auth/routes');
const projectRoutes = require('./projects/routes');
const annotationRoutes = require('./annotations/routes');

const app = express();

// 中间件
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(express.json());

// 健康检查
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// 数据库连接测试（临时调试用）
app.get('/db-test', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW()');
    res.json({ ok: true, time: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// API 路由
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/projects', projectRoutes);
app.use('/api/v1/annotations', annotationRoutes);

// 全局错误处理
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// 本地开发时直接启动监听，Vercel/Netlify 部署时由平台托管
if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`WebPin backend running on http://localhost:${PORT}`);
  });
}

module.exports = app;
