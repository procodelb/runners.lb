/**
 * Unit tests for the offline-first API client
 * 
 * Tests cover:
 * - Request queuing and replay
 * - Idempotency key generation
 * - Retry logic
 * - Pause/resume functionality
 * - Error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import apiClient from '../src/lib/apiClient';

// Mock IndexedDB
const mockIndexedDB = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  keys: vi.fn()
};

// Mock axios
const mockAxios = {
  create: vi.fn(() => ({
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    request: vi.fn(),
    interceptors: {
      request: {
        use: vi.fn()
      },
      response: {
        use: vi.fn()
      }
    }
  }))
};

// Mock react-hot-toast
const mockToast = {
  success: vi.fn(),
  error: vi.fn()
};

// Mock modules
vi.mock('axios', () => mockAxios);
vi.mock('idb-keyval', () => mockIndexedDB);
vi.mock('react-hot-toast', () => mockToast);

describe('OfflineFirstApiClient', () => {
  let client;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(() => 'mock-token'),
        setItem: vi.fn(),
        removeItem: vi.fn()
      }
    });

    // Create new client instance
    client = new (await import('../src/lib/apiClient')).default();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Idempotency Key Generation', () => {
    it('should generate unique idempotency keys', () => {
      const key1 = client.generateIdempotencyKey({ method: 'POST', url: '/orders' });
      const key2 = client.generateIdempotencyKey({ method: 'POST', url: '/orders' });
      
      expect(key1).toMatch(/^erp-post-\d+-[a-z0-9]{9}$/);
      expect(key2).toMatch(/^erp-post-\d+-[a-z0-9]{9}$/);
      expect(key1).not.toBe(key2);
    });

    it('should include correct request type in key', () => {
      const postKey = client.generateIdempotencyKey({ method: 'POST', url: '/orders' });
      const putKey = client.generateIdempotencyKey({ method: 'PUT', url: '/orders/1' });
      
      expect(postKey).toContain('erp-post-');
      expect(putKey).toContain('erp-put-');
    });
  });

  describe('Request ID Generation', () => {
    it('should generate unique request IDs', () => {
      const id1 = client.generateRequestId();
      const id2 = client.generateRequestId();
      
      expect(id1).toMatch(/^req-\d+-[a-z0-9]{9}$/);
      expect(id2).toMatch(/^req-\d+-[a-z0-9]{9}$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('Mutating Request Detection', () => {
    it('should identify mutating requests correctly', () => {
      expect(client.isMutatingRequest('POST')).toBe(true);
      expect(client.isMutatingRequest('PUT')).toBe(true);
      expect(client.isMutatingRequest('PATCH')).toBe(true);
      expect(client.isMutatingRequest('DELETE')).toBe(true);
      expect(client.isMutatingRequest('GET')).toBe(false);
      expect(client.isMutatingRequest('HEAD')).toBe(false);
    });
  });

  describe('Retry Delay Calculation', () => {
    it('should calculate exponential backoff delays', () => {
      const delay1 = client.calculateRetryDelay(0);
      const delay2 = client.calculateRetryDelay(1);
      const delay3 = client.calculateRetryDelay(2);
      
      expect(delay1).toBeGreaterThan(0);
      expect(delay2).toBeGreaterThan(delay1);
      expect(delay3).toBeGreaterThan(delay2);
    });

    it('should respect maximum delay limit', () => {
      const delay = client.calculateRetryDelay(10); // High retry count
      expect(delay).toBeLessThanOrEqual(client.retryConfig.maxDelay);
    });
  });

  describe('Queue Management', () => {
    beforeEach(() => {
      mockIndexedDB.get.mockResolvedValue([]);
      mockIndexedDB.set.mockResolvedValue(undefined);
    });

    it('should queue requests when offline', async () => {
      // Mock offline state
      client.isOnline = false;
      
      const mockConfig = {
        method: 'POST',
        url: '/orders',
        data: { name: 'Test Order' },
        headers: { 'Idempotency-Key': 'test-key' },
        metadata: { id: 'req-123' }
      };

      await client.queueRequest(mockConfig);
      
      expect(mockIndexedDB.set).toHaveBeenCalledWith(
        'api-request-queue',
        expect.arrayContaining([
          expect.objectContaining({
            method: 'POST',
            url: '/orders',
            data: { name: 'Test Order' },
            idempotencyKey: 'test-key'
          })
        ])
      );
    });

    it('should not queue requests when paused', async () => {
      client.isPaused = true;
      
      const mockConfig = {
        method: 'POST',
        url: '/orders',
        data: { name: 'Test Order' },
        headers: { 'Idempotency-Key': 'test-key' },
        metadata: { id: 'req-123' }
      };

      await client.queueRequest(mockConfig);
      
      expect(mockIndexedDB.set).not.toHaveBeenCalled();
    });
  });

  describe('Pause/Resume Functionality', () => {
    it('should pause sync correctly', () => {
      client.pause();
      expect(client.isPaused).toBe(true);
    });

    it('should resume sync correctly', () => {
      client.isPaused = true;
      client.resume();
      expect(client.isPaused).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should create graceful errors', () => {
      const originalError = new Error('Network error');
      originalError.response = { status: 500 };
      
      const gracefulError = client.createGracefulError(originalError);
      
      expect(gracefulError.name).toBe('ApiError');
      expect(gracefulError.message).toBe('Server error - please try again later');
      expect(gracefulError.originalError).toBe(originalError);
      expect(gracefulError.status).toBe(500);
    });

    it('should provide user-friendly error messages', () => {
      const testCases = [
        { status: 401, expected: 'Please log in again' },
        { status: 403, expected: 'You don\'t have permission to perform this action' },
        { status: 404, expected: 'The requested resource was not found' },
        { status: 422, expected: 'Please check your input and try again' },
        { status: 500, expected: 'Server error - please try again later' }
      ];

      testCases.forEach(({ status, expected }) => {
        const error = { response: { status } };
        const message = client.getUserFriendlyMessage(error);
        expect(message).toBe(expected);
      });
    });

    it('should handle network errors', () => {
      const error = { code: 'ECONNABORTED' };
      const message = client.getUserFriendlyMessage(error);
      expect(message).toBe('Request timeout - please check your connection');
    });

    it('should handle no response errors', () => {
      const error = {};
      const message = client.getUserFriendlyMessage(error);
      expect(message).toBe('Network error - please check your connection');
    });
  });

  describe('Queue Operations', () => {
    beforeEach(() => {
      mockIndexedDB.get.mockResolvedValue([]);
      mockIndexedDB.set.mockResolvedValue(undefined);
      mockIndexedDB.del.mockResolvedValue(undefined);
    });

    it('should get queue correctly', async () => {
      const mockQueue = [
        { id: 'req-1', method: 'POST', url: '/orders' },
        { id: 'req-2', method: 'PUT', url: '/orders/1' }
      ];
      
      mockIndexedDB.get.mockResolvedValue(mockQueue);
      
      const queue = await client.getQueue();
      expect(queue).toEqual(mockQueue);
    });

    it('should clear queue correctly', async () => {
      await client.clearQueue();
      expect(mockIndexedDB.del).toHaveBeenCalledWith('api-request-queue');
    });
  });

  describe('Health Check', () => {
    it('should return true for healthy server', async () => {
      const mockAxiosInstance = client.axios;
      mockAxiosInstance.get.mockResolvedValue({ status: 200 });
      
      const isHealthy = await client.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should return false for unhealthy server', async () => {
      const mockAxiosInstance = client.axios;
      mockAxiosInstance.get.mockRejectedValue(new Error('Server error'));
      
      const isHealthy = await client.healthCheck();
      expect(isHealthy).toBe(false);
    });
  });

  describe('Sync Status', () => {
    it('should return correct sync status', () => {
      client.isOnline = true;
      client.isPaused = false;
      
      const status = client.getSyncStatus();
      
      expect(status).toEqual({
        isOnline: true,
        isPaused: false,
        queueLength: 0
      });
    });
  });
});

describe('API Client Integration', () => {
  let client;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new (await import('../src/lib/apiClient')).default();
  });

  describe('HTTP Methods', () => {
    beforeEach(() => {
      const mockAxiosInstance = client.axios;
      mockAxiosInstance.get.mockResolvedValue({ data: { success: true } });
      mockAxiosInstance.post.mockResolvedValue({ data: { success: true } });
      mockAxiosInstance.put.mockResolvedValue({ data: { success: true } });
      mockAxiosInstance.patch.mockResolvedValue({ data: { success: true } });
      mockAxiosInstance.delete.mockResolvedValue({ data: { success: true } });
    });

    it('should handle GET requests', async () => {
      const result = await client.get('/orders');
      expect(result).toEqual({ success: true });
    });

    it('should handle POST requests', async () => {
      const result = await client.post('/orders', { name: 'Test' });
      expect(result).toEqual({ success: true });
    });

    it('should handle PUT requests', async () => {
      const result = await client.put('/orders/1', { name: 'Updated' });
      expect(result).toEqual({ success: true });
    });

    it('should handle PATCH requests', async () => {
      const result = await client.patch('/orders/1', { status: 'completed' });
      expect(result).toEqual({ success: true });
    });

    it('should handle DELETE requests', async () => {
      const result = await client.delete('/orders/1');
      expect(result).toEqual({ success: true });
    });
  });

  describe('Error Handling in HTTP Methods', () => {
    it('should handle errors gracefully in GET', async () => {
      const mockAxiosInstance = client.axios;
      mockAxiosInstance.get.mockRejectedValue(new Error('Network error'));
      
      await expect(client.get('/orders')).rejects.toThrow('ApiError');
    });

    it('should handle errors gracefully in POST', async () => {
      const mockAxiosInstance = client.axios;
      mockAxiosInstance.post.mockRejectedValue(new Error('Network error'));
      
      await expect(client.post('/orders', {})).rejects.toThrow('ApiError');
    });
  });
});
