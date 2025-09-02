import React, { useState, useEffect } from 'react';
import { Loader2, Wifi, WifiOff, AlertCircle } from 'lucide-react';
import { apiHelpers } from '../api';

const LoadingSpinner = ({ 
  isLoading = false, 
  error = null, 
  message = 'Loading...', 
  size = 'default',
  showServerStatus = false 
}) => {
  const [serverStatus, setServerStatus] = useState(null);

  useEffect(() => {
    if (showServerStatus) {
      checkServerHealth();
    }
  }, [showServerStatus]);

  const checkServerHealth = async () => {
    try {
      const isHealthy = await apiHelpers.checkServerHealth();
      setServerStatus(isHealthy);
    } catch (error) {
      setServerStatus(false);
    }
  };

  const sizeClasses = {
    small: 'w-4 h-4',
    default: 'w-6 h-6',
    large: 'w-8 h-8'
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <AlertCircle className={`${sizeClasses[size]} text-red-500 mb-4`} />
        <p className="text-red-600 font-medium mb-2">Error</p>
        <p className="text-gray-600 text-sm">{error}</p>
        {showServerStatus && serverStatus === false && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center text-red-600">
              <WifiOff className="w-4 h-4 mr-2" />
              <span className="text-sm">Server not reachable</span>
            </div>
            <p className="text-xs text-red-500 mt-1">
              Please check if the server is running on port 5000
            </p>
          </div>
        )}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <Loader2 className={`${sizeClasses[size]} text-blue-500 animate-spin mb-4`} />
        <p className="text-gray-600 font-medium">{message}</p>
        {showServerStatus && serverStatus === false && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center text-yellow-600">
              <WifiOff className="w-4 h-4 mr-2" />
              <span className="text-sm">Server connection issues</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (showServerStatus && serverStatus !== null) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className={`flex items-center text-sm ${
          serverStatus ? 'text-green-600' : 'text-red-600'
        }`}>
          {serverStatus ? (
            <Wifi className="w-4 h-4 mr-2" />
          ) : (
            <WifiOff className="w-4 h-4 mr-2" />
          )}
          <span>
            {serverStatus ? 'Server connected' : 'Server disconnected'}
          </span>
        </div>
      </div>
    );
  }

  return null;
};

export default LoadingSpinner;

