const { io } = require('socket.io-client');

console.log('🧪 Testing WebSocket connection fix...');

// Test WebSocket connection
const socket = io('http://localhost:5000', {
  withCredentials: true,
  auth: {
    token: 'test-token'
  },
  autoConnect: true,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
  timeout: 10000
});

socket.on('connect', () => {
  console.log('✅ WebSocket connected successfully');
  
  // Test ping/pong
  console.log('🏓 Sending ping...');
  socket.emit('ping', Date.now());
});

socket.on('pong', (timestamp) => {
  console.log('🏓 Received pong:', timestamp);
});

socket.on('connected', (data) => {
  console.log('✅ Server confirmed connection:', data);
});

socket.on('disconnect', (reason) => {
  console.log('❌ WebSocket disconnected:', reason);
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error);
});

socket.on('error', (error) => {
  console.error('❌ Socket error:', error);
});

// Test for 10 seconds then disconnect
setTimeout(() => {
  console.log('🔌 Disconnecting test socket...');
  socket.disconnect();
  process.exit(0);
}, 10000);
