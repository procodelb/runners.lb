/**
 * Unit tests for the useAutoWebSocket hook
 * 
 * Tests cover:
 * - WebSocket connection and disconnection
 * - Auto-reconnection logic
 * - Keep-alive ping mechanism
 * - Manual pause/resume controls
 * - Event handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useAutoWebSocket from '../src/hooks/useAutoWebSocket';

// Mock socket.io-client
const mockSocket = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  connected: false
};

const mockIo = vi.fn(() => mockSocket);

vi.mock('socket.io-client', () => ({
  io: mockIo
}));

// Mock timers
vi.useFakeTimers();

describe('useAutoWebSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.connected = false;
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('Initialization', () => {
    it('should initialize with default options', () => {
      const { result } = renderHook(() => useAutoWebSocket('ws://localhost:5000'));
      
      expect(result.current.connected).toBe(false);
      expect(result.current.isReconnecting).toBe(false);
      expect(result.current.lastError).toBe(null);
    });

    it('should not auto-connect when autoConnect is false', () => {
      renderHook(() => useAutoWebSocket('ws://localhost:5000', { autoConnect: false }));
      
      expect(mockIo).not.toHaveBeenCalled();
    });

    it('should auto-connect when autoConnect is true', () => {
      renderHook(() => useAutoWebSocket('ws://localhost:5000', { autoConnect: true }));
      
      expect(mockIo).toHaveBeenCalledWith('ws://localhost:5000', {
        autoConnect: false,
        reconnection: false,
        timeout: 10000
      });
    });
  });

  describe('Connection Management', () => {
    it('should connect when connect is called', () => {
      const { result } = renderHook(() => useAutoWebSocket('ws://localhost:5000', { autoConnect: false }));
      
      act(() => {
        result.current.connect();
      });
      
      expect(mockSocket.connect).toHaveBeenCalled();
    });

    it('should disconnect when disconnect is called', () => {
      const { result } = renderHook(() => useAutoWebSocket('ws://localhost:5000', { autoConnect: false }));
      
      act(() => {
        result.current.disconnect();
      });
      
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('should set manually closed flag when disconnect is called with manual=true', () => {
      const { result } = renderHook(() => useAutoWebSocket('ws://localhost:5000', { autoConnect: false }));
      
      act(() => {
        result.current.disconnect(true);
      });
      
      // After manual disconnect, connect should not work
      act(() => {
        result.current.connect();
      });
      
      expect(mockSocket.connect).not.toHaveBeenCalled();
    });

    it('should resume connection when resume is called after manual disconnect', () => {
      const { result } = renderHook(() => useAutoWebSocket('ws://localhost:5000', { autoConnect: false }));
      
      // Manual disconnect
      act(() => {
        result.current.disconnect(true);
      });
      
      // Resume
      act(() => {
        result.current.resume();
      });
      
      // Now connect should work
      act(() => {
        result.current.connect();
      });
      
      expect(mockSocket.connect).toHaveBeenCalled();
    });
  });

  describe('Event Handling', () => {
    it('should handle connect event', () => {
      const { result } = renderHook(() => useAutoWebSocket('ws://localhost:5000', { autoConnect: false }));
      
      // Simulate connect event
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      act(() => {
        connectHandler();
      });
      
      expect(result.current.connected).toBe(true);
      expect(result.current.isReconnecting).toBe(false);
      expect(result.current.lastError).toBe(null);
    });

    it('should handle disconnect event', () => {
      const { result } = renderHook(() => useAutoWebSocket('ws://localhost:5000', { autoConnect: false }));
      
      // First connect
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      act(() => {
        connectHandler();
      });
      
      // Then disconnect
      const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')[1];
      act(() => {
        disconnectHandler('transport close');
      });
      
      expect(result.current.connected).toBe(false);
      expect(result.current.isReconnecting).toBe(false);
    });

    it('should handle connect_error event', () => {
      const { result } = renderHook(() => useAutoWebSocket('ws://localhost:5000', { autoConnect: false }));
      
      const errorHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect_error')[1];
      const error = new Error('Connection failed');
      
      act(() => {
        errorHandler(error);
      });
      
      expect(result.current.lastError).toBe('Connection failed');
      expect(result.current.isReconnecting).toBe(false);
    });

    it('should handle error event', () => {
      const { result } = renderHook(() => useAutoWebSocket('ws://localhost:5000', { autoConnect: false }));
      
      const errorHandler = mockSocket.on.mock.calls.find(call => call[0] === 'error')[1];
      const error = new Error('Socket error');
      
      act(() => {
        errorHandler(error);
      });
      
      expect(result.current.lastError).toBe('Socket error');
    });
  });

  describe('Send Message', () => {
    it('should send message when connected', () => {
      const { result } = renderHook(() => useAutoWebSocket('ws://localhost:5000', { autoConnect: false }));
      
      // Mock connected state
      mockSocket.connected = true;
      
      const success = result.current.send('test-event', { data: 'test' });
      
      expect(success).toBe(true);
      expect(mockSocket.emit).toHaveBeenCalledWith('test-event', { data: 'test' });
    });

    it('should not send message when not connected', () => {
      const { result } = renderHook(() => useAutoWebSocket('ws://localhost:5000', { autoConnect: false }));
      
      // Mock disconnected state
      mockSocket.connected = false;
      
      const success = result.current.send('test-event', { data: 'test' });
      
      expect(success).toBe(false);
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });
  });

  describe('Event Listeners', () => {
    it('should add event listener', () => {
      const { result } = renderHook(() => useAutoWebSocket('ws://localhost:5000', { autoConnect: false }));
      
      const callback = vi.fn();
      result.current.on('test-event', callback);
      
      expect(mockSocket.on).toHaveBeenCalledWith('test-event', callback);
    });

    it('should remove event listener', () => {
      const { result } = renderHook(() => useAutoWebSocket('ws://localhost:5000', { autoConnect: false }));
      
      const callback = vi.fn();
      result.current.off('test-event', callback);
      
      expect(mockSocket.off).toHaveBeenCalledWith('test-event', callback);
    });
  });

  describe('Reconnection Logic', () => {
    it('should attempt reconnection on disconnect when reconnect is enabled', () => {
      const { result } = renderHook(() => useAutoWebSocket('ws://localhost:5000', { 
        autoConnect: false,
        reconnect: true,
        maxReconnectAttempts: 3
      }));
      
      // Connect first
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      act(() => {
        connectHandler();
      });
      
      // Disconnect
      const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')[1];
      act(() => {
        disconnectHandler('transport close');
      });
      
      // Should start reconnecting
      expect(result.current.isReconnecting).toBe(true);
    });

    it('should not attempt reconnection when reconnect is disabled', () => {
      const { result } = renderHook(() => useAutoWebSocket('ws://localhost:5000', { 
        autoConnect: false,
        reconnect: false
      }));
      
      // Connect first
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      act(() => {
        connectHandler();
      });
      
      // Disconnect
      const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')[1];
      act(() => {
        disconnectHandler('transport close');
      });
      
      // Should not start reconnecting
      expect(result.current.isReconnecting).toBe(false);
    });

    it('should stop reconnecting after max attempts', () => {
      const { result } = renderHook(() => useAutoWebSocket('ws://localhost:5000', { 
        autoConnect: false,
        reconnect: true,
        maxReconnectAttempts: 2
      }));
      
      // Connect first
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      act(() => {
        connectHandler();
      });
      
      // Disconnect multiple times to exceed max attempts
      const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')[1];
      
      for (let i = 0; i < 3; i++) {
        act(() => {
          disconnectHandler('transport close');
        });
        
        // Fast forward time to trigger reconnection
        act(() => {
          vi.advanceTimersByTime(1000);
        });
      }
      
      // Should stop reconnecting
      expect(result.current.isReconnecting).toBe(false);
    });
  });

  describe('Keep-Alive Pings', () => {
    it('should start keep-alive pings on connect', () => {
      const { result } = renderHook(() => useAutoWebSocket('ws://localhost:5000', { 
        autoConnect: false,
        pingInterval: 1000
      }));
      
      // Connect
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      act(() => {
        connectHandler();
      });
      
      // Fast forward time
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      
      expect(mockSocket.emit).toHaveBeenCalledWith('ping', expect.any(Number));
    });

    it('should stop keep-alive pings on disconnect', () => {
      const { result } = renderHook(() => useAutoWebSocket('ws://localhost:5000', { 
        autoConnect: false,
        pingInterval: 1000
      }));
      
      // Connect
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      act(() => {
        connectHandler();
      });
      
      // Disconnect
      const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')[1];
      act(() => {
        disconnectHandler('transport close');
      });
      
      // Clear previous calls
      mockSocket.emit.mockClear();
      
      // Fast forward time
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup on unmount', () => {
      const { unmount } = renderHook(() => useAutoWebSocket('ws://localhost:5000', { autoConnect: false }));
      
      unmount();
      
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });
  });
});
