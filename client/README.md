# soufiamERP - Offline-First Frontend

## Overview

This is the frontend application for soufiamERP, built with React and Vite. The application features a robust offline-first architecture that ensures the ERP system never crashes due to network issues and provides seamless offline functionality.

## Key Features

### 🌐 Offline-First Architecture
- **Self-healing API client** with automatic retry and queue management
- **Persistent request queue** using IndexedDB for offline storage
- **Automatic replay** of queued requests when network reconnects
- **Manual sync controls** for user-controlled synchronization

### 🔄 Network Resilience
- **Exponential backoff retry** with jitter for failed requests
- **Idempotency key support** to prevent duplicate operations
- **WebSocket auto-reconnection** with keep-alive pings
- **Graceful error handling** without UI crashes

### 📱 User Experience
- **Real-time sync status** indicators
- **Queue management** with detailed request tracking
- **Toast notifications** for user feedback
- **Manual pause/resume** controls

## Architecture

### Core Components

#### 1. API Client (`src/lib/apiClient.js`)
- Custom Axios wrapper with offline-first capabilities
- Automatic idempotency key generation
- Request queuing and replay functionality
- Exponential backoff retry logic

#### 2. WebSocket Hook (`src/hooks/useAutoWebSocket.js`)
- Auto-reconnecting WebSocket connections
- Keep-alive ping mechanism
- Manual pause/resume controls
- Connection status tracking

#### 3. Sync Components
- **SyncStatusBadge**: Shows current sync status (ONLINE/OFFLINE/SYNC PAUSED/SYNC PENDING)
- **SyncControls**: Manual sync control buttons (Pause/Resume/Sync Now/View Queue)
- **QueueModal**: Detailed view of queued requests with management options

## Getting Started

### Prerequisites
- Node.js 18 or higher
- npm or yarn package manager

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **Build for production:**
   ```bash
   npm run build
   ```

### Environment Setup

Create a `.env` file in the client directory:

```bash
VITE_API_BASE_URL=http://localhost:5000/api
VITE_WS_URL=ws://localhost:5000
VITE_APP_NAME=soufiamERP
```

## Usage

### Basic API Usage

The offline-first API client automatically handles network issues:

```javascript
import apiClient from './lib/apiClient';

// GET request - works offline, caches responses
const data = await apiClient.get('/orders');

// POST request - automatically queued if offline
const result = await apiClient.post('/orders', orderData);

// PUT request - idempotency handled automatically
const updated = await apiClient.put('/orders/123', updateData);
```

### WebSocket Usage

```javascript
import useAutoWebSocket from './hooks/useAutoWebSocket';

const { connected, send, on, off } = useAutoWebSocket('ws://localhost:5000');

// Send message
send('order-updated', { orderId: 123, status: 'completed' });

// Listen to events
on('order-created', (data) => {
  console.log('New order:', data);
});
```

### Sync Controls

```javascript
import SyncStatusBadge from './components/SyncStatusBadge';
import SyncControls from './components/SyncControls';

// Show sync status
<SyncStatusBadge 
  isOnline={isOnline} 
  isPaused={isPaused} 
  queueLength={queueLength}
/>

// Show sync controls
<SyncControls 
  onQueueView={() => setShowQueueModal(true)}
  size="sm"
  showLabels={true}
/>
```

## Offline Behavior

### When Online
- Requests are sent immediately to the server
- Responses are cached for future offline use
- WebSocket maintains real-time connection
- Sync status shows "ONLINE"

### When Offline
- Mutating requests (POST, PUT, PATCH, DELETE) are queued locally
- GET requests use cached responses when available
- WebSocket attempts to reconnect automatically
- Sync status shows "OFFLINE" with queue count

### When Sync Paused
- All requests are queued locally
- No automatic retries or reconnections
- Sync status shows "SYNC PAUSED"
- User can manually resume or sync

## Testing Offline Functionality

### 1. Simulate Offline Mode

**Chrome DevTools:**
1. Open DevTools (F12)
2. Go to Network tab
3. Select "Offline" from the dropdown
4. Try creating/updating data
5. Check the sync status badge

**Programmatic:**
```javascript
// Pause sync to simulate offline behavior
window.__ERP_QUEUE__.pause();

// Create some orders (they'll be queued)
await apiClient.post('/orders', orderData);

// Check queue
const queue = await window.__ERP_QUEUE__.getQueue();
console.log('Queued requests:', queue);

// Resume sync
window.__ERP_QUEUE__.resume();
```

### 2. Test Request Replay

1. Go offline
2. Create 5 orders
3. Check queue modal - should show 5 pending requests
4. Go back online
5. Watch as requests are automatically replayed
6. Verify no duplicates in the database

### 3. Test Manual Controls

1. Click "Pause Sync" button
2. Create some orders - they should be queued
3. Click "Resume Sync" - requests should replay
4. Click "View Queue" to see detailed request information
5. Click "Sync Now" to force immediate sync

## Debugging

### Debug Console

The API client exposes debugging functions on `window.__ERP_QUEUE__`:

```javascript
// Get current queue
const queue = await window.__ERP_QUEUE__.getQueue();

// Force sync all queued requests
await window.__ERP_QUEUE__.flushQueue();

// Clear all queued requests
await window.__ERP_QUEUE__.clearQueue();

// Pause sync
window.__ERP_QUEUE__.pause();

// Resume sync
window.__ERP_QUEUE__.resume();

// Get sync status
const status = window.__ERP_QUEUE__.getStatus();
```

### Console Logging

The API client provides detailed console logging:

- `🌐 API Request:` - Outgoing requests
- `✅ API Response:` - Successful responses
- `❌ API Error:` - Failed requests
- `📦 Request queued:` - Offline queuing
- `🔄 Retrying request:` - Retry attempts
- `🔄 Processing queued requests` - Queue replay

## Configuration

### Retry Configuration

Modify retry behavior in `src/lib/apiClient.js`:

```javascript
this.retryConfig = {
  maxRetries: 3,        // Maximum retry attempts
  baseDelay: 1000,      // Base delay in milliseconds
  maxDelay: 10000,      // Maximum delay in milliseconds
  jitter: true          // Add random jitter to delays
};
```

### WebSocket Configuration

Modify WebSocket behavior in `src/hooks/useAutoWebSocket.js`:

```javascript
const { connected, send } = useAutoWebSocket('ws://localhost:5000', {
  autoConnect: true,           // Auto-connect on mount
  reconnect: true,             // Auto-reconnect on disconnect
  reconnectInterval: 1000,     // Base reconnection delay
  maxReconnectAttempts: 10,    // Maximum reconnection attempts
  pingInterval: 30000,         // Keep-alive ping interval
  pingTimeout: 5000            // Ping timeout
});
```

## Performance Considerations

### IndexedDB Storage
- Queue data is stored in IndexedDB for persistence
- Automatic cleanup of old queued requests
- Efficient storage and retrieval

### Memory Management
- Automatic cleanup of completed requests
- Bounded queue size to prevent memory leaks
- Efficient retry logic to avoid infinite loops

### Network Optimization
- Request deduplication using idempotency keys
- Intelligent retry with exponential backoff
- Connection pooling and reuse

## Troubleshooting

### Common Issues

1. **Requests not queuing when offline**
   - Check if the request method is mutating (POST, PUT, PATCH, DELETE)
   - Verify IndexedDB is available in the browser
   - Check console for error messages

2. **Queue not replaying when online**
   - Ensure sync is not paused
   - Check network connectivity
   - Verify server is responding to requests

3. **WebSocket not connecting**
   - Check WebSocket URL configuration
   - Verify server supports WebSocket connections
   - Check browser console for connection errors

4. **Duplicate requests in database**
   - Ensure backend supports idempotency keys
   - Check that idempotency keys are being generated correctly
   - Verify server is handling duplicate keys properly

### Error Messages

- `"Idempotency-Key header is required"` - Backend doesn't support idempotency
- `"Network error - please check your connection"` - No network connectivity
- `"Max reconnection attempts exceeded"` - WebSocket can't connect to server
- `"Failed to queue request"` - IndexedDB storage issue

## Contributing

### Code Style
- Use ESLint for code linting
- Follow React best practices
- Use TypeScript for type safety (optional)

### Testing
- Write unit tests for API client functions
- Test offline/online scenarios
- Verify WebSocket reconnection logic

### Pull Requests
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue in the repository
- Check the troubleshooting section
- Review the console logs for error details

---

**Built with ❤️ for soufiamERP - Never lose data to network issues again!**
