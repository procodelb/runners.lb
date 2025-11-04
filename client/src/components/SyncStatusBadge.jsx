import React from 'react';
import { Wifi, WifiOff, Pause, Clock, CheckCircle } from 'lucide-react';

/**
 * SyncStatusBadge - Shows current sync status
 * 
 * States:
 * - ONLINE: Connected and syncing
 * - OFFLINE: No network connection
 * - SYNC PAUSED: User manually paused sync
 * - SYNC PENDING: Actions queued for sync
 */

const SyncStatusBadge = ({ 
  isOnline = false, 
  isPaused = false, 
  queueLength = 0,
  className = '' 
}) => {
  const getStatusInfo = () => {
    if (isPaused) {
      return {
        icon: Pause,
        text: 'SYNC PAUSED',
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-100',
        borderColor: 'border-yellow-300'
      };
    }
    
    if (!isOnline) {
      return {
        icon: WifiOff,
        text: 'OFFLINE',
        color: 'text-red-600',
        bgColor: 'bg-red-100',
        borderColor: 'border-red-300'
      };
    }
    
    if (queueLength > 0) {
      return {
        icon: Clock,
        text: `SYNC PENDING (${queueLength})`,
        color: 'text-orange-600',
        bgColor: 'bg-orange-100',
        borderColor: 'border-orange-300'
      };
    }
    
    return {
      icon: Wifi,
      text: 'ONLINE',
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      borderColor: 'border-green-300'
    };
  };

  const statusInfo = getStatusInfo();
  const Icon = statusInfo.icon;

  return (
    <div 
      className={`
        inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium
        border ${statusInfo.borderColor} ${statusInfo.bgColor} ${statusInfo.color}
        ${className}
      `}
    >
      <Icon className="w-3 h-3" />
      <span>{statusInfo.text}</span>
    </div>
  );
};

export default SyncStatusBadge;
