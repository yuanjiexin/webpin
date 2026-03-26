require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const authRoutes = require('./auth/routes');
const projectRoutes = require('./projects/routes');
const annotationRoutes = require('./annotations/routes');
const { setupWebSocket } = require('./websocket/handler');

const app = express();
const server = http.createServer(app);

// Socket.io 配置
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
  },
});

// 中间件
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(express.json());

// 健康检查
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// API 路由
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/projects', projectRoutes);
app.use('/api/v1/annotations', annotationRoutes);

// 全局错误处理
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// WebSocket
setupWebSocket(io);

// 导出 io 供路由使用广播
app.set('io', io);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`WebPin backend running on http://localhost:${PORT}`);
});

module.exports = { app, server };
