import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

/**
 * Auto-reconnecting WebSocket hook with keep-alive and manual controls
 * 
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Keep-alive pings to prevent idle timeouts
 * - Manual pause/resume controls
 * - Connection status tracking
 * - Graceful error handling
 */

const useAutoWebSocket = (url, options = {}) => {
  const [connected, setConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [lastError, setLastError] = useState(null);
  
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const isManuallyClosed = useRef(false);
  const reconnectAttempts = useRef(0);
  
  const {
    autoConnect = true,
    reconnect = true,
    reconnectInterval = 2000,
    maxReconnectAttempts = 5,
    pingInterval = 45000, // 45 seconds - less aggressive
    pingTimeout = 10000, // 10 seconds timeout
    ...socketOptions
  } = options;

  /**
   * Calculate reconnection delay with exponential backoff and jitter
   */
  const getReconnectDelay = useCallback((attempt) => {
    const baseDelay = Math.min(reconnectInterval * Math.pow(2, attempt), 30000);
    const jitter = Math.random() * 0.1 * baseDelay;
    return Math.floor(baseDelay + jitter);
  }, [reconnectInterval]);

  /**
   * Connect to WebSocket
   */
  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      console.log('🔌 WebSocket already connected');
      return;
    }

    if (isManuallyClosed.current) {
      console.log('🔌 WebSocket connection manually closed, not reconnecting');
      return;
    }

    console.log(`🔌 Connecting to WebSocket: ${url}`);
    setIsReconnecting(true);
    setLastError(null);

    try {
      // Create socket instance
      socketRef.current = io(url, {
        autoConnect: false,
        reconnection: false, // We handle reconnection manually
        timeout: 10000,
        withCredentials: true,
        auth: {
          token: localStorage.getItem('token')
        },
        ...socketOptions
      });

      // Connection event handlers
      socketRef.current.on('connect', () => {
        console.log('✅ WebSocket connected');
        setConnected(true);
        setIsReconnecting(false);
        setLastError(null);
        reconnectAttempts.current = 0;
        
        // Start keep-alive pings
        startKeepAlive();
      });

      // Handle pong responses from server
      socketRef.current.on('pong', (timestamp) => {
        console.log('🏓 Received pong from server:', timestamp);
      });

      // Handle server connection confirmation
      socketRef.current.on('connected', (data) => {
        console.log('✅ Server confirmed connection:', data);
      });

      // Handle server errors
      socketRef.current.on('error', (error) => {
        console.error('❌ Server WebSocket error:', error);
        setLastError(error.message || 'Server error');
      });

      socketRef.current.on('disconnect', (reason) => {
        console.log('❌ WebSocket disconnected:', reason);
        setConnected(false);
        setIsReconnecting(false);
        
        // Stop keep-alive pings
        stopKeepAlive();
        
        // Attempt reconnection if not manually closed
        if (!isManuallyClosed.current && reconnect) {
          scheduleReconnect();
        }
      });

      socketRef.current.on('connect_error', (error) => {
        console.error('❌ WebSocket connection error:', error);
        setLastError(error.message);
        setIsReconnecting(false);
        
        // Attempt reconnection if not manually closed
        if (!isManuallyClosed.current && reconnect) {
          scheduleReconnect();
        }
      });

      socketRef.current.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
        setLastError(error.message);
      });

      // Connect the socket
      socketRef.current.connect();
      
    } catch (error) {
      console.error('❌ Failed to create WebSocket connection:', error);
      setLastError(error.message);
      setIsReconnecting(false);
      
      if (reconnect) {
        scheduleReconnect();
      }
    }
  }, [url, reconnect, socketOptions]);

  /**
   * Disconnect WebSocket
   */
  const disconnect = useCallback((manual = false) => {
    console.log(`🔌 Disconnecting WebSocket (manual: ${manual})`);
    
    if (manual) {
      isManuallyClosed.current = true;
    }
    
    // Clear reconnection timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // Stop keep-alive pings
    stopKeepAlive();
    
    // Disconnect socket
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    setConnected(false);
    setIsReconnecting(false);
  }, []);

  /**
   * Schedule reconnection attempt
   */
  const scheduleReconnect = useCallback(() => {
    if (isManuallyClosed.current || !reconnect) {
      return;
    }

    if (reconnectAttempts.current >= maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts exceeded');
      setLastError('Max reconnection attempts exceeded');
      setIsReconnecting(false);
      return;
    }

    const delay = getReconnectDelay(reconnectAttempts.current);
    reconnectAttempts.current++;
    
    console.log(`🔄 Scheduling reconnection in ${delay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`);
    
    setIsReconnecting(true);
    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, delay);
  }, [connect, reconnect, maxReconnectAttempts, getReconnectDelay]);

  /**
   * Start keep-alive pings
   */
  const startKeepAlive = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    
    pingIntervalRef.current = setInterval(() => {
      if (socketRef.current?.connected) {
        console.log('🏓 Sending keep-alive ping');
        socketRef.current.emit('ping', Date.now());
      }
    }, pingInterval);
  }, [pingInterval]);

  /**
   * Stop keep-alive pings
   */
  const stopKeepAlive = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  /**
   * Send message through WebSocket
   */
  const send = useCallback((event, data) => {
    if (socketRef.current?.connected) {
      console.log(`📤 Sending WebSocket message: ${event}`, data);
      socketRef.current.emit(event, data);
      return true;
    } else {
      console.warn('⚠️ WebSocket not connected, cannot send message');
      return false;
    }
  }, []);

  /**
   * Listen to WebSocket events
   */
  const on = useCallback((event, callback) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
    }
  }, []);

  /**
   * Remove WebSocket event listener
   */
  const off = useCallback((event, callback) => {
    if (socketRef.current) {
      socketRef.current.off(event, callback);
    }
  }, []);

  /**
   * Resume connection (if manually closed)
   */
  const resume = useCallback(() => {
    console.log('▶️ Resuming WebSocket connection');
    isManuallyClosed.current = false;
    reconnectAttempts.current = 0;
    connect();
  }, [connect]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      stopKeepAlive();
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [stopKeepAlive]);

  /**
   * Auto-connect on mount
   */
  useEffect(() => {
    if (autoConnect && !isManuallyClosed.current) {
      connect();
    }
  }, [autoConnect, connect]);

  return {
    connected,
    isReconnecting,
    lastError,
    connect,
    disconnect,
    send,
    on,
    off,
    resume,
    socket: socketRef.current
  };
};

export default useAutoWebSocket;
