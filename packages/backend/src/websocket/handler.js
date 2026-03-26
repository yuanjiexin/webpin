/**
 * Socket.io 实时同步处理
 * 客户端加入一个 "room"（project:url 组合），同一房间的所有用户会收到批注变更
 */
function setupWebSocket(io) {
  io.on('connection', (socket) => {
    // 加入项目+页面 room
    socket.on('join', ({ projectId, url }) => {
      if (!projectId || !url) return;
      const room = `${projectId}:${encodeURIComponent(url)}`;
      socket.join(room);
      socket.data.room = room;
    });

    // 离开 room
    socket.on('leave', () => {
      if (socket.data.room) {
        socket.leave(socket.data.room);
      }
    });

    socket.on('disconnect', () => {
      // 自动离开所有 room
    });
  });
}

/**
 * 广播批注事件给同一 room 的其他用户
 */
function broadcast(io, projectId, url, event, data) {
  const room = `${projectId}:${encodeURIComponent(url)}`;
  io.to(room).emit(event, data);
}

module.exports = { setupWebSocket, broadcast };
