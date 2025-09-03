import axios from 'axios';

// Create axios instance
const api = axios.create({
  // Use relative URL in production to work with Vercel proxy
  // In development, use the full backend URL
  baseURL: import.meta.env.DEV 
    ? (import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api'
    : '/api',
  timeout: 15000, // Increased timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    // Include credentials for cookie-based auth
    config.withCredentials = true;
    
    // Also add Authorization header if localStorage token exists (fallback)
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    console.log(`🌐 API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('❌ API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: ${response.status} ${response.config.url}`);
    console.log('📦 API Response data:', response.data);
    
    // Return the response as is - let individual components handle the data structure
    return response;
  },
  async (error) => {
    console.error('❌ API Response Error:', {
      status: error.response?.status,
      url: error.config?.url,
      message: error.response?.data?.message || error.message,
      data: error.response?.data
    });

    // Handle 429 Too Many Requests with retry logic
    if (error.response?.status === 429) {
      console.log('🔄 Rate limit exceeded, implementing retry logic...');
      
      // Get retry count from config
      const retryCount = error.config._retryCount || 0;
      const maxRetries = 3;
      
      if (retryCount < maxRetries) {
        // Calculate exponential backoff delay
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        
        console.log(`⏳ Retrying request in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
        
        // Wait for the delay
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Retry the request
        error.config._retryCount = retryCount + 1;
        return api.request(error.config);
      } else {
        console.error('❌ Max retries exceeded for rate-limited request');
        // Show user-friendly error message
        error.message = 'Too many requests. Please wait a moment and try again.';
      }
    }

    // Virtual API fallback for development
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Using virtual API response for development...');
      
      // Provide virtual responses for common endpoints
      const virtualResponses = {
        '/api/dashboard/stats': {
          data: {
            totalOrders: 25,
            pendingOrders: 8,
            completedOrders: 17,
            totalClients: 12,
            activeDrivers: 5,
            totalRevenue: { usd: 2500, lbp: 37500000 },
            pendingPayments: { usd: 800, lbp: 12000000 }
          }
        },
        '/api/orders': {
          data: [
            {
              id: 1,
              order_ref: 'ORD-001',
              customer_name: 'John Doe',
              pickup_address: 'Beirut, Lebanon',
              delivery_address: 'Tripoli, Lebanon',
              status: 'assigned',
              total_amount: 50,
              currency: 'USD',
              created_at: new Date().toISOString()
            },
            {
              id: 2,
              order_ref: 'ORD-002',
              customer_name: 'Jane Smith',
              pickup_address: 'Sidon, Lebanon',
              delivery_address: 'Beirut, Lebanon',
              status: 'delivered',
              total_amount: 75,
              currency: 'USD',
              created_at: new Date().toISOString()
            }
          ]
        },
        '/api/transactions': {
          data: [
            {
              id: 1,
              reference: 'TXN-001',
              type: 'income',
              amount: 50,
              currency: 'USD',
              description: 'Payment for ORD-001',
              created_at: new Date().toISOString()
            },
            {
              id: 2,
              reference: 'TXN-002',
              type: 'expense',
              amount: 25,
              currency: 'USD',
              description: 'Partial refund for ORD-002',
              created_at: new Date().toISOString()
            }
          ]
        },
        '/api/crm': {
          data: [
            {
              id: 1,
              name: 'John Doe',
              email: 'john@example.com',
              phone: '+96170123456',
              address: 'Beirut, Lebanon',
              created_at: new Date().toISOString()
            },
            {
              id: 2,
              name: 'Jane Smith',
              email: 'jane@example.com',
              phone: '+96170987654',
              address: 'Tripoli, Lebanon',
              created_at: new Date().toISOString()
            }
          ]
        },
        '/api/drivers': {
          data: [
            {
              id: 1,
              name: 'Ahmed Hassan',
              phone: '+96170123456',
              vehicle_number: 'ABC-123',
              status: 'active',
              created_at: new Date().toISOString()
            },
            {
              id: 2,
              name: 'Mohammed Ali',
              phone: '+96170987654',
              vehicle_number: 'XYZ-789',
              status: 'active',
              created_at: new Date().toISOString()
            }
          ]
        },
        '/api/price-list': {
          data: [
            {
              id: 1,
              from_location: 'Beirut',
              to_location: 'Tripoli',
              price_usd: 25,
              price_lbp: 375000,
              created_at: new Date().toISOString()
            },
            {
              id: 2,
              from_location: 'Beirut',
              to_location: 'Sidon',
              price_usd: 15,
              price_lbp: 225000,
              created_at: new Date().toISOString()
            }
          ]
        },
        '/api/cashbox': {
          data: {
            balance_usd: 1500,
            balance_lbp: 22500000,
            last_updated: new Date().toISOString()
          }
        },
        '/api/accounting': {
          data: {
            total_income: 5000,
            total_expenses: 2000,
            net_profit: 3000,
            currency: 'USD'
          }
        }
      };

      const url = error.config?.url;
      const virtualResponse = virtualResponses[url];
      
      if (virtualResponse) {
        console.log(`✅ Virtual response provided for: ${url}`);
        return Promise.resolve({
          data: virtualResponse,
          status: 200,
          statusText: 'OK',
          config: error.config
        });
      }
    }

    if (error.response?.status === 401) {
      // Token expired or invalid
      console.log('🔐 API: 401 Unauthorized - clearing auth state');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Only redirect if not already on login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    } else if (error.code === 'ECONNABORTED') {
      // Request timeout
      console.error('⏰ Request timeout - server might be down');
    } else if (!error.response) {
      // Network error - server not reachable
      console.error('🌐 Network error - server not reachable');
    }

    return Promise.reject(error);
  }
);

// API endpoints
export const endpoints = {
  // Health check
  health: '/health',
  
  // Auth
  auth: {
    login: '/auth/login',
    signup: '/auth/signup',
    logout: '/auth/logout',
    me: '/auth/me',
  },
  
  // CRM
  crm: {
    list: '/crm',
    create: '/crm',
    update: (id) => `/crm/${id}`,
    delete: (id) => `/crm/${id}`,
    search: '/crm/search',
  },
  
  // Orders
  orders: {
    list: '/orders',
    create: '/orders',
    update: (id) => `/orders/${id}`,
    delete: (id) => `/orders/${id}`,
    assignDriver: (id) => `/orders/${id}/assign-driver`,
    complete: (id) => `/orders/${id}/complete`,
    get: (id) => `/orders/${id}`,
  },
  
  // Drivers
  drivers: {
    list: '/drivers',
    create: '/drivers',
    update: (id) => `/drivers/${id}`,
    delete: (id) => `/drivers/${id}`,
    fees: (id) => `/drivers/${id}/fees`,
    advances: (id) => `/drivers/${id}/advances`,
  },
  
  // Accounting
  accounting: {
    transactions: '/accounting/transactions',
    reports: '/accounting/reports',
    balances: '/accounting/balances',
    export: '/accounting/export',
  },
  
  // Cashbox
  cashbox: {
    balance: '/cashbox',
    entry: '/cashbox/entry',
    history: '/cashbox/history',
    driverAdvance: '/cashbox/driver-advance',
  },
  
  // Price List
  priceList: {
    list: '/price-list',
    create: '/price-list',
    update: (id) => `/price-list/${id}`,
    delete: (id) => `/price-list/${id}`,
  },
  
  // Transactions
  transactions: {
    list: '/transactions',
    create: '/transactions',
    update: (id) => `/transactions/${id}`,
    delete: (id) => `/transactions/${id}`,
    print: (id) => `/transactions/${id}/print`,
  },
  
  // Settings
  settings: {
    profile: '/settings/profile',
    password: '/settings/password',
    preferences: '/settings',
    export: '/settings/export',
  },
  
  // Order History
  orderHistory: {
    list: '/orders/history',
    export: '/orders/history/export',
  },
};

// Helper functions
export const apiHelpers = {
  // Format currency
  formatCurrency: (amount, currency = 'USD') => {
    if (currency === 'USD') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amount);
    } else if (currency === 'LBP') {
      return new Intl.NumberFormat('ar-LB', {
        style: 'currency',
        currency: 'LBP',
      }).format(amount);
    }
    return amount;
  },
  
  // Format date
  formatDate: (date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  },
  
  // Format status
  formatStatus: (status) => {
    const statusMap = {
      new: 'New',
      assigned: 'Assigned',
      picked_up: 'Picked Up',
      in_transit: 'In Transit',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
    };
    return statusMap[status] || status;
  },
  
  // Format payment status
  formatPaymentStatus: (status) => {
    const statusMap = {
      unpaid: 'Unpaid',
      partial: 'Partial',
      paid: 'Paid',
      refunded: 'Refunded',
    };
    return statusMap[status] || status;
  },
  
  // Get status color
  getStatusColor: (status) => {
    const colorMap = {
      new: 'blue',
      assigned: 'yellow',
      picked_up: 'purple',
      in_transit: 'indigo',
      delivered: 'green',
      cancelled: 'red',
    };
    return colorMap[status] || 'gray';
  },
  
  // Get payment status color
  getPaymentStatusColor: (status) => {
    const colorMap = {
      unpaid: 'red',
      partial: 'yellow',
      paid: 'green',
      refunded: 'gray',
    };
    return colorMap[status] || 'gray';
  },
  
  // Validate email
  validateEmail: (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  },
  
  // Validate phone
  validatePhone: (phone) => {
    const re = /^[\+]?[1-9][\d]{0,15}$/;
    return re.test(phone);
  },
  
  // Generate order reference
  generateOrderRef: () => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `ORD-${timestamp}-${random}`.toUpperCase();
  },
  
  // Calculate exchange rate
  calculateExchangeRate: (usdAmount, lbpAmount) => {
    if (usdAmount && lbpAmount) {
      return lbpAmount / usdAmount;
    }
    return null;
  },
  
  // Convert USD to LBP
  usdToLbp: (usdAmount, exchangeRate) => {
    if (usdAmount && exchangeRate) {
      return Math.round(usdAmount * exchangeRate);
    }
    return 0;
  },
  
  // Convert LBP to USD
  lbpToUsd: (lbpAmount, exchangeRate) => {
    if (lbpAmount && exchangeRate) {
      return parseFloat((lbpAmount / exchangeRate).toFixed(2));
    }
    return 0;
  },

  // Error handler
  handleApiError: (error, defaultMessage = 'An error occurred') => {
    if (error.response?.data?.message) {
      return error.response.data.message;
    } else if (error.message) {
      return error.message;
    } else if (error.code === 'ECONNABORTED') {
      return 'Request timeout - please check your connection';
    } else if (!error.response) {
      return 'Network error - server not reachable';
    }
    return defaultMessage;
  },

  // Check if server is reachable
  checkServerHealth: async () => {
    try {
      const response = await api.get('/health');
      return response.status === 200;
    } catch (error) {
      console.error('Server health check failed:', error);
      return false;
    }
  }
};

export default api;

