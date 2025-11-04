import React, { useState, useEffect } from 'react';
import { 
  Pause, 
  Play, 
  RefreshCw, 
  Eye, 
  Trash2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import apiClient from '../lib/apiClient';

/**
 * SyncControls - Manual sync control buttons
 * 
 * Features:
 * - Pause/Resume sync
 * - Manual sync now
 * - View queue
 * - Clear queue
 * - Status indicators
 */

const SyncControls = ({ 
  onQueueView, 
  className = '',
  showLabels = true,
  size = 'sm'
}) => {
  const [isPaused, setIsPaused] = useState(false);
  const [queueLength, setQueueLength] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  // Update queue length periodically
  useEffect(() => {
    const updateQueueLength = async () => {
      try {
        const queue = await apiClient.getQueue();
        setQueueLength(queue.length);
      } catch (error) {
        console.error('Failed to get queue length:', error);
      }
    };

    updateQueueLength();
    const interval = setInterval(updateQueueLength, 2000);
    return () => clearInterval(interval);
  }, []);

  const handlePause = () => {
    apiClient.pause();
    setIsPaused(true);
  };

  const handleResume = () => {
    apiClient.resume();
    setIsPaused(false);
  };

  const handleSyncNow = async () => {
    setIsProcessing(true);
    try {
      await apiClient.flushQueue();
      const queue = await apiClient.getQueue();
      setQueueLength(queue.length);
    } catch (error) {
      console.error('Failed to sync:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleViewQueue = () => {
    if (onQueueView) {
      onQueueView();
    }
  };

  const handleClearQueue = async () => {
    if (window.confirm('Are you sure you want to clear all queued actions?')) {
      await apiClient.clearQueue();
      setQueueLength(0);
    }
  };

  const buttonSize = size === 'sm' ? 'p-1.5' : 'p-2';
  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div className={`flex items-center space-x-1 ${className}`}>
      {/* Pause/Resume Button */}
      <button
        onClick={isPaused ? handleResume : handlePause}
        className={`
          ${buttonSize} rounded-md transition-colors
          ${isPaused 
            ? 'bg-green-100 text-green-700 hover:bg-green-200' 
            : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
          }
        `}
        title={isPaused ? 'Resume sync' : 'Pause sync'}
      >
        {isPaused ? (
          <Play className={iconSize} />
        ) : (
          <Pause className={iconSize} />
        )}
      </button>

      {/* Sync Now Button */}
      <button
        onClick={handleSyncNow}
        disabled={isProcessing || queueLength === 0}
        className={`
          ${buttonSize} rounded-md transition-colors
          ${isProcessing || queueLength === 0
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
          }
        `}
        title="Sync now"
      >
        <RefreshCw className={`${iconSize} ${isProcessing ? 'animate-spin' : ''}`} />
      </button>

      {/* View Queue Button */}
      <button
        onClick={handleViewQueue}
        disabled={queueLength === 0}
        className={`
          ${buttonSize} rounded-md transition-colors
          ${queueLength === 0
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
          }
        `}
        title="View queue"
      >
        <Eye className={iconSize} />
      </button>

      {/* Clear Queue Button */}
      {queueLength > 0 && (
        <button
          onClick={handleClearQueue}
          className={`
            ${buttonSize} rounded-md transition-colors
            bg-red-100 text-red-700 hover:bg-red-200
          `}
          title="Clear queue"
        >
          <Trash2 className={iconSize} />
        </button>
      )}

      {/* Queue Length Badge */}
      {queueLength > 0 && (
        <div className="flex items-center space-x-1">
          <div className="flex items-center space-x-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs">
            <AlertCircle className="w-3 h-3" />
            <span>{queueLength}</span>
          </div>
        </div>
      )}

      {/* Status Text */}
      {showLabels && (
        <span className={`${textSize} text-gray-600 ml-2`}>
          {isPaused ? 'Paused' : queueLength > 0 ? `${queueLength} queued` : 'Synced'}
        </span>
      )}
    </div>
  );
};

export default SyncControls;
