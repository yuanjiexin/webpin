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
app.get('/health', async (req, res) => {
  const config = {
    database: !!process.env.DATABASE_URL,
    jwt: !!process.env.JWT_SECRET,
  };

  let dbStatus = 'not_configured';
  if (config.database) {
    try {
      await db.query('SELECT 1');
      dbStatus = 'ok';
    } catch (e) {
      dbStatus = 'error';
    }
  }

  res.json({ status: 'ok', config, db: dbStatus });
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
