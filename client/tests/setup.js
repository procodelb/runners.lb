/**
 * Test setup file for Vitest
 * 
 * This file sets up the testing environment with necessary mocks and configurations
 */

import { vi } from 'vitest';

// Mock IndexedDB
const mockIndexedDB = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  keys: vi.fn()
};

// Mock localStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn()
  },
  writable: true
});

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true
});

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:3000',
    pathname: '/',
    search: '',
    hash: ''
  },
  writable: true
});

// Mock window.URL
Object.defineProperty(window, 'URL', {
  value: {
    createObjectURL: vi.fn(() => 'mock-url'),
    revokeObjectURL: vi.fn()
  },
  writable: true
});

// Mock document.createElement
const mockElement = {
  href: '',
  download: '',
  click: vi.fn()
};

Object.defineProperty(document, 'createElement', {
  value: vi.fn(() => mockElement),
  writable: true
});

// Mock document.body
Object.defineProperty(document, 'body', {
  value: {
    appendChild: vi.fn(),
    removeChild: vi.fn()
  },
  writable: true
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
};

// Global test utilities
global.mockIndexedDB = mockIndexedDB;
