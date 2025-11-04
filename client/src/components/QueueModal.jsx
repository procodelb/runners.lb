import React, { useState, useEffect } from 'react';
import { 
  X, 
  RefreshCw, 
  Trash2, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import apiClient from '../lib/apiClient';

/**
 * QueueModal - Shows queued actions and their statuses
 * 
 * Features:
 * - List all queued requests
 * - Show request details
 * - Retry failed requests
 * - Clear individual or all requests
 * - Real-time updates
 */

const QueueModal = ({ isOpen, onClose }) => {
  const [queue, setQueue] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  // Load queue data
  const loadQueue = async () => {
    setIsLoading(true);
    try {
      const queueData = await apiClient.getQueue();
      setQueue(queueData);
    } catch (error) {
      console.error('Failed to load queue:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load queue when modal opens
  useEffect(() => {
    if (isOpen) {
      loadQueue();
      // Refresh every 2 seconds
      const interval = setInterval(loadQueue, 2000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  // Toggle item expansion
  const toggleExpanded = (itemId) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  // Retry a specific request
  const retryRequest = async (itemId) => {
    setIsProcessing(true);
    try {
      // Remove from queue and let it retry naturally
      const updatedQueue = queue.filter(item => item.id !== itemId);
      await apiClient.clearQueue();
      // The request will be retried automatically by the API client
      setQueue(updatedQueue);
    } catch (error) {
      console.error('Failed to retry request:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Clear a specific request
  const clearRequest = async (itemId) => {
    try {
      const updatedQueue = queue.filter(item => item.id !== itemId);
      await apiClient.clearQueue();
      setQueue(updatedQueue);
    } catch (error) {
      console.error('Failed to clear request:', error);
    }
  };

  // Clear all requests
  const clearAllRequests = async () => {
    if (window.confirm('Are you sure you want to clear all queued requests?')) {
      await apiClient.clearQueue();
      setQueue([]);
    }
  };

  // Force sync all
  const forceSyncAll = async () => {
    setIsProcessing(true);
    try {
      await apiClient.flushQueue();
      await loadQueue();
    } catch (error) {
      console.error('Failed to sync all:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  // Get status icon and color
  const getStatusInfo = (item) => {
    if (item.tries > 3) {
      return {
        icon: AlertCircle,
        color: 'text-red-600',
        bgColor: 'bg-red-100',
        text: 'Failed'
      };
    } else if (item.tries > 1) {
      return {
        icon: RefreshCw,
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-100',
        text: 'Retrying'
      };
    } else {
      return {
        icon: Clock,
        color: 'text-blue-600',
        bgColor: 'bg-blue-100',
        text: 'Pending'
      };
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <h3 className="text-lg font-semibold text-gray-900">
              Sync Queue ({queue.length} items)
            </h3>
            {queue.length > 0 && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={forceSyncAll}
                  disabled={isProcessing}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
                >
                  <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
                  <span>Sync All</span>
                </button>
                <button
                  onClick={clearAllRequests}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Clear All</span>
                </button>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">Loading queue...</span>
            </div>
          ) : queue.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">Queue is empty</h4>
              <p className="text-gray-600">All actions have been synced successfully!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {queue.map((item) => {
                const statusInfo = getStatusInfo(item);
                const StatusIcon = statusInfo.icon;
                const isExpanded = expandedItems.has(item.id);

                return (
                  <div
                    key={item.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-full ${statusInfo.bgColor}`}>
                          <StatusIcon className={`w-4 h-4 ${statusInfo.color}`} />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-gray-900">
                              {item.method} {item.url}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.bgColor} ${statusInfo.color}`}>
                              {statusInfo.text}
                            </span>
                          </div>
                          <div className="text-sm text-gray-500">
                            Created: {formatTimestamp(item.createdAt)} • 
                            Attempts: {item.tries}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => toggleExpanded(item.id)}
                          className="p-1 hover:bg-gray-100 rounded transition-colors"
                          title={isExpanded ? 'Hide details' : 'Show details'}
                        >
                          {isExpanded ? (
                            <EyeOff className="w-4 h-4 text-gray-500" />
                          ) : (
                            <Eye className="w-4 h-4 text-gray-500" />
                          )}
                        </button>
                        {item.tries > 1 && (
                          <button
                            onClick={() => retryRequest(item.id)}
                            disabled={isProcessing}
                            className="p-1 hover:bg-blue-100 rounded transition-colors disabled:opacity-50"
                            title="Retry request"
                          >
                            <RefreshCw className="w-4 h-4 text-blue-600" />
                          </button>
                        )}
                        <button
                          onClick={() => clearRequest(item.id)}
                          className="p-1 hover:bg-red-100 rounded transition-colors"
                          title="Remove from queue"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <label className="font-medium text-gray-700">Request ID:</label>
                            <p className="text-gray-600 font-mono text-xs">{item.id}</p>
                          </div>
                          <div>
                            <label className="font-medium text-gray-700">Idempotency Key:</label>
                            <p className="text-gray-600 font-mono text-xs">{item.idempotencyKey}</p>
                          </div>
                          <div>
                            <label className="font-medium text-gray-700">Last Error:</label>
                            <p className="text-gray-600">{item.lastError || 'None'}</p>
                          </div>
                          <div>
                            <label className="font-medium text-gray-700">Headers:</label>
                            <pre className="text-gray-600 font-mono text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                              {JSON.stringify(item.headers, null, 2)}
                            </pre>
                          </div>
                          {item.data && (
                            <div className="md:col-span-2">
                              <label className="font-medium text-gray-700">Request Data:</label>
                              <pre className="text-gray-600 font-mono text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                                {JSON.stringify(item.data, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            {queue.length > 0 && (
              <span>
                {queue.filter(item => item.tries > 3).length} failed, {' '}
                {queue.filter(item => item.tries > 1 && item.tries <= 3).length} retrying, {' '}
                {queue.filter(item => item.tries === 1).length} pending
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default QueueModal;
