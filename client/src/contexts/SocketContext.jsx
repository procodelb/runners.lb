import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children, socket }) => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);

  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      setIsConnected(true);
      console.log('Socket connected');
      
      // Join user-specific room
      if (user) {
        socket.emit('join-room', `user-${user.id}`);
      }
    };

    const handleDisconnect = (reason) => {
      setIsConnected(false);
      
      // Only log warnings for unexpected disconnects
      if (reason === 'io server disconnect') {
        console.log('Socket disconnected by server (intentional)');
        // Don't show error toast for server-initiated disconnects
      } else if (reason === 'io client disconnect') {
        console.log('Socket disconnected by client (intentional)');
      } else {
        console.warn('Socket disconnected:', reason);
        // Only show error for unexpected network issues
        if (reason === 'transport close' || reason === 'transport error') {
          toast.error('Connection lost. Reconnecting...', { duration: 3000 });
        }
      }
    };

    const handleOrderUpdate = (data) => {
      setLastMessage(data);
      toast.success(`Order ${data.orderRef} status updated to ${data.status}`);
    };

    const handlePaymentUpdate = (data) => {
      setLastMessage(data);
      toast.success(`Payment status updated for order ${data.orderRef}`);
    };

    const handleDriverUpdate = (data) => {
      setLastMessage(data);
      toast.success(`Driver ${data.driverName} status updated`);
    };

    const handleTransactionUpdate = (data) => {
      setLastMessage(data);
      toast.success(`New transaction: ${data.type}`);
    };

    const handleError = (error) => {
      console.error('Socket error:', error);
      toast.error('Connection error. Please refresh the page.');
    };

    // Event listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('order-update', handleOrderUpdate);
    socket.on('payment-update', handlePaymentUpdate);
    socket.on('driver-update', handleDriverUpdate);
    socket.on('transaction-update', handleTransactionUpdate);
    socket.on('error', handleError);
    socket.on('connect_error', (err) => {
      console.error('Socket connect_error:', err?.message || err);
    });

    // Cleanup
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('order-update', handleOrderUpdate);
      socket.off('payment-update', handlePaymentUpdate);
      socket.off('driver-update', handleDriverUpdate);
      socket.off('transaction-update', handleTransactionUpdate);
      socket.off('error', handleError);
    };
  }, [socket, user]);

  const emitEvent = (event, data) => {
    if (socket && isConnected) {
      socket.emit(event, data);
    }
  };

  const joinRoom = (room) => {
    if (socket && isConnected) {
      socket.emit('join-room', room);
    }
  };

  const leaveRoom = (room) => {
    if (socket && isConnected) {
      socket.emit('leave-room', room);
    }
  };

  const value = {
    socket,
    isConnected,
    lastMessage,
    emitEvent,
    joinRoom,
    leaveRoom,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

