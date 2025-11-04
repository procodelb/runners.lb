import axios from 'axios';
import { get, set, del, keys } from 'idb-keyval';
import toast from 'react-hot-toast';

/**
 * Offline-First API Client with Self-Healing Capabilities
 * 
 * Features:
 * - Automatic idempotency key generation for mutating requests
 * - Exponential backoff retry with jitter
 * - Persistent request queue using IndexedDB
 * - Automatic replay of queued requests when online
 * - Manual pause/resume controls
 * - Graceful error handling without UI crashes
 */

class OfflineFirstApiClient {
  constructor() {
    this.baseURL = (import.meta?.env?.VITE_API_BASE_URL)
      ? import.meta.env.VITE_API_BASE_URL
      : '/api';
    this.isOnline = navigator.onLine;
    this.isPaused = false;
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      jitter: true
    };
    this.queueKey = 'api-request-queue';
    this.idempotencyKeyPrefix = 'erp';
    
    // Initialize axios instance
    this.axios = axios.create({
      baseURL: this.baseURL,
      timeout: 15000,
      withCredentials: true, // Include credentials for cookie-based auth
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
    this.setupNetworkListeners();
    this.initializeQueue();
  }

  /**
   * Setup axios request/response interceptors
   */
  setupInterceptors() {
    // Request interceptor - add auth and idempotency keys
    this.axios.interceptors.request.use(
      (config) => {
        // Include credentials for cookie-based auth
        config.withCredentials = true;
        
        // Add auth token from localStorage if available
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Add idempotency key for mutating requests
        if (this.isMutatingRequest(config.method)) {
          config.headers['Idempotency-Key'] = this.generateIdempotencyKey(config);
        }

        // Add request metadata for queue management
        config.metadata = {
          id: this.generateRequestId(),
          timestamp: Date.now(),
          method: config.method?.toUpperCase(),
          url: config.url,
          isRetry: config._retryCount > 0
        };

        console.log(`🌐 API Request: ${config.metadata.method} ${config.url}`, {
          idempotencyKey: config.headers['Idempotency-Key'],
          isRetry: config.metadata.isRetry,
          hasToken: !!token,
          withCredentials: config.withCredentials
        });

        return config;
      },
      (error) => {
        console.error('❌ Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor - handle errors and retries
    this.axios.interceptors.response.use(
      (response) => {
        console.log(`✅ API Response: ${response.status} ${response.config.url}`);
        
        // Handle idempotency replay responses
        if (response.headers['x-idempotency-status'] === 'replay') {
          console.log('🔄 Idempotency replay detected');
        }

        return response;
      },
      async (error) => {
        return this.handleResponseError(error);
      }
    );
  }

  /**
   * Setup network status listeners
   */
  setupNetworkListeners() {
    window.addEventListener('online', () => {
      console.log('🌐 Network: Online');
      this.isOnline = true;
      this.processQueue();
    });

    window.addEventListener('offline', () => {
      console.log('🌐 Network: Offline');
      this.isOnline = false;
    });
  }

  /**
   * Initialize request queue from IndexedDB
   */
  async initializeQueue() {
    try {
      const queue = await get(this.queueKey) || [];
      console.log(`📦 Initialized queue with ${queue.length} pending requests`);
      
      // Process queue if online
      if (this.isOnline && !this.isPaused) {
        this.processQueue();
      }
    } catch (error) {
      console.error('❌ Failed to initialize queue:', error);
    }
  }

  /**
   * Generate unique idempotency key
   */
  generateIdempotencyKey(config) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    const method = config.method?.toUpperCase() || 'GET';
    const url = config.url || '';
    
    return `${this.idempotencyKeyPrefix}-${method.toLowerCase()}-${timestamp}-${random}`;
  }

  /**
   * Generate unique request ID
   */
  generateRequestId() {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if request is mutating (POST, PUT, PATCH, DELETE)
   */
  isMutatingRequest(method) {
    return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method?.toUpperCase());
  }

  /**
   * Handle response errors with retry logic
   */
  async handleResponseError(error) {
    const config = error.config;
    const retryCount = config._retryCount || 0;
    const isNetworkError = !error.response;
    const isServerError = error.response?.status >= 500;
    const isRateLimited = error.response?.status === 429;
    const isUnauthorized = error.response?.status === 401;

    console.error('❌ API Error:', {
      status: error.response?.status,
      url: config?.url,
      message: error.message,
      retryCount,
      isNetworkError,
      isServerError,
      isUnauthorized
    });

    // Handle 401 Unauthorized - clear auth state and redirect to login
    if (isUnauthorized) {
      console.log('🔒 Unauthorized access - clearing auth state');
      localStorage.removeItem('token');
      // Dispatch custom event to notify auth context
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      return Promise.reject(this.createGracefulError(error));
    }

    // Don't retry if paused or max retries exceeded
    if (this.isPaused || retryCount >= this.retryConfig.maxRetries) {
      if (isNetworkError || isServerError) {
        await this.queueRequest(config);
      }
      return Promise.reject(this.createGracefulError(error));
    }

    // Retry for network errors, server errors, or rate limiting
    if (isNetworkError || isServerError || isRateLimited) {
      const delay = this.calculateRetryDelay(retryCount);
      
      console.log(`🔄 Retrying request in ${delay}ms (attempt ${retryCount + 1}/${this.retryConfig.maxRetries})`);
      
      await this.sleep(delay);
      
      config._retryCount = retryCount + 1;
      return this.axios.request(config);
    }

    // For client errors (4xx), don't retry but show user-friendly message
    return Promise.reject(this.createGracefulError(error));
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  calculateRetryDelay(retryCount) {
    const baseDelay = this.retryConfig.baseDelay;
    const maxDelay = this.retryConfig.maxDelay;
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
    
    if (this.retryConfig.jitter) {
      const jitter = Math.random() * 0.1 * exponentialDelay;
      return Math.floor(exponentialDelay + jitter);
    }
    
    return exponentialDelay;
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Queue request for later processing
   */
  async queueRequest(config) {
    if (this.isPaused) {
      console.log('⏸️ Request queued (sync paused)');
      return;
    }

    try {
      const queue = await get(this.queueKey) || [];
      const requestData = {
        id: config.metadata.id,
        method: config.method?.toUpperCase(),
        url: config.url,
        data: config.data,
        headers: config.headers,
        params: config.params,
        idempotencyKey: config.headers['Idempotency-Key'],
        createdAt: Date.now(),
        tries: (config._retryCount || 0) + 1,
        lastError: this.extractErrorMessage(config._lastError)
      };

      queue.push(requestData);
      await set(this.queueKey, queue);

      console.log(`📦 Request queued: ${requestData.method} ${requestData.url}`);
      
      // Show user-friendly notification
      this.showQueueNotification(queue.length);
      
    } catch (error) {
      console.error('❌ Failed to queue request:', error);
    }
  }

  /**
   * Extract error message for queue storage
   */
  extractErrorMessage(error) {
    if (!error) return 'Unknown error';
    if (error.response?.data?.message) return error.response.data.message;
    if (error.message) return error.message;
    return 'Network error';
  }

  /**
   * Show queue notification to user
   */
  showQueueNotification(queueLength) {
    if (queueLength === 1) {
      toast('Saved (queued) — will sync automatically when online', {
        icon: '📦',
        duration: 4000
      });
    } else if (queueLength > 1) {
      toast(`${queueLength} actions queued — will sync when online`, {
        icon: '📦',
        duration: 3000
      });
    }
  }

  /**
   * Process queued requests
   */
  async processQueue() {
    if (this.isPaused || !this.isOnline) {
      return;
    }

    try {
      const queue = await get(this.queueKey) || [];
      if (queue.length === 0) return;

      console.log(`🔄 Processing ${queue.length} queued requests`);

      // Process requests in order
      for (let i = queue.length - 1; i >= 0; i--) {
        const requestData = queue[i];
        
        try {
          const config = {
            method: requestData.method.toLowerCase(),
            url: requestData.url,
            data: requestData.data,
            headers: requestData.headers,
            params: requestData.params,
            _retryCount: 0 // Reset retry count for replay
          };

          const response = await this.axios.request(config);
          console.log(`✅ Queued request completed: ${requestData.method} ${requestData.url}`);
          
          // Remove from queue
          queue.splice(i, 1);
          
        } catch (error) {
          console.error(`❌ Failed to replay queued request: ${requestData.method} ${requestData.url}`, error);
          
          // Update retry count
          requestData.tries++;
          requestData.lastError = this.extractErrorMessage(error);
          
          // Remove if max retries exceeded
          if (requestData.tries > this.retryConfig.maxRetries) {
            console.log(`🗑️ Removing failed request after ${requestData.tries} attempts`);
            queue.splice(i, 1);
          }
        }
      }

      // Save updated queue
      await set(this.queueKey, queue);
      
      if (queue.length === 0) {
        toast('All queued actions synced successfully!', {
          icon: '✅',
          duration: 3000
        });
      }

    } catch (error) {
      console.error('❌ Failed to process queue:', error);
    }
  }

  /**
   * Create graceful error that won't crash the UI
   */
  createGracefulError(error) {
    const gracefulError = new Error();
    gracefulError.name = 'ApiError';
    gracefulError.message = this.getUserFriendlyMessage(error);
    gracefulError.originalError = error;
    gracefulError.status = error.response?.status;
    gracefulError.isNetworkError = !error.response;
    
    return gracefulError;
  }

  /**
   * Get user-friendly error message
   */
  getUserFriendlyMessage(error) {
    if (error.response?.status === 401) {
      return 'Please log in again';
    } else if (error.response?.status === 403) {
      return 'You don\'t have permission to perform this action';
    } else if (error.response?.status === 404) {
      return 'The requested resource was not found';
    } else if (error.response?.status === 422) {
      return error.response.data?.message || 'Please check your input and try again';
    } else if (error.response?.status >= 500) {
      return 'Server error - please try again later';
    } else if (error.code === 'ECONNABORTED') {
      return 'Request timeout - please check your connection';
    } else if (!error.response) {
      return 'Network error - please check your connection';
    }
    
    return error.response?.data?.message || 'An unexpected error occurred';
  }

  /**
   * Sanitize URL parameters to remove undefined/null values
   */
  sanitizeUrl(url) {
    // Handle relative URLs (most common case)
    if (!url.includes('://')) {
      const [path, query] = url.split('?');
      if (!query) return path;
      
      const params = new URLSearchParams(query);
      for (const [key, value] of params.entries()) {
        if (value === 'undefined' || value === 'null' || value === '' || value === null || value === undefined) {
          params.delete(key);
        }
      }
      const cleanQuery = params.toString();
      return cleanQuery ? `${path}?${cleanQuery}` : path;
    }
    
    // Handle absolute URLs
    try {
      const urlObj = new URL(url);
      const params = new URLSearchParams(urlObj.search);
      for (const [key, value] of params.entries()) {
        if (value === 'undefined' || value === 'null' || value === '' || value === null || value === undefined) {
          params.delete(key);
        }
      }
      urlObj.search = params.toString();
      return urlObj.pathname + urlObj.search;
    } catch (error) {
      // Fallback: manual string cleaning
      const [path, query] = url.split('?');
      if (!query) return path;
      const params = new URLSearchParams(query);
      for (const [key, value] of params.entries()) {
        if (value === 'undefined' || value === 'null' || value === '' || value === null || value === undefined) {
          params.delete(key);
        }
      }
      const cleanQuery = params.toString();
      return cleanQuery ? `${path}?${cleanQuery}` : path;
    }
  }

  /**
   * Main API methods
   */
  async get(url, config = {}) {
    try {
      // Sanitize URL to remove undefined/null parameters
      const sanitizedUrl = this.sanitizeUrl(url);
      const response = await this.axios.get(sanitizedUrl, config);
      return response.data;
    } catch (error) {
      throw this.createGracefulError(error);
    }
  }

  async post(url, data, config = {}) {
    try {
      const response = await this.axios.post(url, data, config);
      return response.data;
    } catch (error) {
      throw this.createGracefulError(error);
    }
  }

  async put(url, data, config = {}) {
    try {
      const response = await this.axios.put(url, data, config);
      return response.data;
    } catch (error) {
      throw this.createGracefulError(error);
    }
  }

  async patch(url, data, config = {}) {
    try {
      const response = await this.axios.patch(url, data, config);
      return response.data;
    } catch (error) {
      throw this.createGracefulError(error);
    }
  }

  async delete(url, config = {}) {
    try {
      const response = await this.axios.delete(url, config);
      return response.data;
    } catch (error) {
      throw this.createGracefulError(error);
    }
  }

  /**
   * Manual control methods
   */
  pause() {
    console.log('⏸️ API sync paused by user');
    this.isPaused = true;
    toast('Sync paused — actions will be queued', {
      icon: '⏸️',
      duration: 3000
    });
  }

  resume() {
    console.log('▶️ API sync resumed by user');
    this.isPaused = false;
    toast('Sync resumed — processing queued actions', {
      icon: '▶️',
      duration: 3000
    });
    this.processQueue();
  }

  async flushQueue() {
    console.log('🔄 Manually flushing queue');
    await this.processQueue();
  }

  async getQueue() {
    return await get(this.queueKey) || [];
  }

  async clearQueue() {
    console.log('🗑️ Clearing request queue');
    await del(this.queueKey);
    toast('Queue cleared', {
      icon: '🗑️',
      duration: 2000
    });
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const response = await this.axios.get('/health');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get sync status
   */
  getSyncStatus() {
    return {
      isOnline: this.isOnline,
      isPaused: this.isPaused,
      queueLength: 0 // Will be updated by getQueue()
    };
  }
}

// Create singleton instance
const apiClient = new OfflineFirstApiClient();

// Expose for debugging
if (typeof window !== 'undefined') {
  window.__ERP_QUEUE__ = {
    getQueue: () => apiClient.getQueue(),
    flushQueue: () => apiClient.flushQueue(),
    clearQueue: () => apiClient.clearQueue(),
    pause: () => apiClient.pause(),
    resume: () => apiClient.resume(),
    getStatus: () => apiClient.getSyncStatus()
  };
}

export default apiClient;
