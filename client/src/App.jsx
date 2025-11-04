import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';
import { io } from 'socket.io-client';

// Context
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';

// Components
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import CRM from './pages/CRM';
import Orders from './pages/Orders';
import Drivers from './pages/Drivers';
import PriceList from './pages/PriceList';
import OrderHistory from './pages/OrderHistory';
import Settings from './pages/Settings';
import Cashbox from './pages/Cashbox';
import Reports from './pages/Reports';
import Accounting from './pages/Accounting';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

// Styles
import './index.css';

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry on 429 errors (rate limiting) - let the API interceptor handle it
        if (error?.response?.status === 429) {
          return false;
        }
        // Retry other errors up to 2 times
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: (failureCount, error) => {
        // Don't retry mutations on 429 errors
        if (error?.response?.status === 429) {
          return false;
        }
        return failureCount < 1;
      },
    },
  },
});

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('🚨 React Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="text-center max-w-md mx-auto p-6">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Something went wrong
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              An unexpected error occurred. Please refresh the page or try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Refresh Page
            </button>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-sm text-gray-500">Error Details</summary>
                <pre className="mt-2 text-xs text-red-500 bg-red-50 p-2 rounded overflow-auto">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Debug component for development
const DebugAuth = () => {
  const { user, token, loading, debugAuthState } = useAuth();
  const [apiHealth, setApiHealth] = useState('checking');
  
  if (process.env.NODE_ENV !== 'development') return null;

  // Check API health
  useEffect(() => {
    const checkHealth = async () => {
      try {
        // Force localhost for development
        const apiBase = 'http://localhost:5000';
        console.log('🔍 Health check using API base:', apiBase);
        const response = await fetch(`${apiBase}/api/health`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include'
        });
        if (response.ok) {
          setApiHealth('healthy');
        } else {
          setApiHealth('error');
        }
      } catch (error) {
        console.warn('Health check failed:', error);
        setApiHealth('unreachable');
      }
    };
    
    checkHealth();
    const interval = setInterval(checkHealth, 30000); // Check every 30 seconds (reduced frequency)
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: '#1f2937',
      color: 'white',
      padding: '10px',
      borderRadius: '8px',
      fontSize: '12px',
      zIndex: 9999,
      maxWidth: '300px'
    }}>
      <div><strong>Auth Debug:</strong></div>
      <div>User: {user ? '✅' : '❌'}</div>
      <div>Token: {token ? '✅' : '❌'}</div>
      <div>Loading: {loading ? '⏳' : '✅'}</div>
      <div>API: {apiHealth === 'healthy' ? '✅' : apiHealth === 'error' ? '⚠️' : '❌'}</div>
      <button 
        onClick={debugAuthState}
        style={{
          marginTop: '5px',
          padding: '2px 8px',
          background: '#3b82f6',
          border: 'none',
          borderRadius: '4px',
          color: 'white',
          cursor: 'pointer'
        }}
      >
        Debug State
      </button>
    </div>
  );
};

// Main App Component
const AppContent = () => {
  const { user, loading, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState(null);
  
  console.log('🏠 AppContent - user:', user, 'loading:', loading, 'isAuthenticated:', isAuthenticated);

  useEffect(() => {
    if (user && isAuthenticated) {
      console.log('🔌 AppContent: User authenticated, initializing Socket.IO...');
      // Force localhost for development
      let socketBase = 'http://localhost:5000';
      console.log('🔌 Socket connecting to:', socketBase);

      // Initialize Socket.IO connection
      const newSocket = io(socketBase, {
        withCredentials: true,
        auth: {
          token: localStorage.getItem('token')
        },
        autoConnect: true,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: Infinity, // Keep trying to reconnect
        timeout: 20000,
        forceNew: false,
        transports: ['websocket', 'polling']
      });

      newSocket.on('connect', () => {
        console.log('✅ Socket.IO connected to server');
      });

      newSocket.on('disconnect', (reason) => {
        console.log('❌ Socket.IO disconnected from server:', reason);
        
        // Only show error for unexpected disconnects, not intentional ones
        if (reason === 'io server disconnect') {
          // Server intentionally disconnected - don't reconnect automatically
          console.log('Server intentionally disconnected the client');
        } else if (reason === 'io client disconnect') {
          // Client intentionally disconnected - this is normal
          console.log('Client intentionally disconnected');
        } else {
          // Network issues or other errors - reconnect automatically
          console.log('Unexpected disconnect, will attempt to reconnect...');
        }
      });

      newSocket.on('connect_error', (error) => {
        console.error('❌ Socket.IO connection error:', error);
        // Suppress runtime.lastError by handling the error gracefully
        if (error.message) {
          console.log('Socket connection failed:', error.message);
        }
      });

      newSocket.on('error', (error) => {
        console.error('❌ Socket.IO error:', error);
        // Suppress runtime.lastError by handling the error gracefully
        if (error.message) {
          console.log('Socket error:', error.message);
        }
      });

      // Handle reconnection events
      newSocket.on('reconnect', (attemptNumber) => {
        console.log('✅ Socket.IO reconnected after', attemptNumber, 'attempts');
      });

      newSocket.on('reconnect_error', (error) => {
        console.error('❌ Socket.IO reconnection error:', error);
      });

      newSocket.on('reconnect_failed', () => {
        console.error('❌ Socket.IO reconnection failed - giving up');
      });

      // Handle ping/pong for keep-alive
      newSocket.on('ping', (timestamp) => {
        console.log('🏓 Received ping from server:', timestamp);
        newSocket.emit('pong', timestamp);
      });

      setSocket(newSocket);

      return () => {
        console.log('🔌 AppContent: Cleaning up Socket.IO connection...');
        newSocket.disconnect();
      };
    } else {
      console.log('👤 AppContent: No user or not authenticated, skipping Socket.IO initialization...');
    }
  }, [user, isAuthenticated]);

  // Show loading screen while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading application...</p>
        </div>
      </div>
    );
  }

  return (
    <SocketProvider socket={socket}>
      <DebugAuth />
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={
            user && isAuthenticated ? (
              (() => { 
                console.log('🔄 AppContent: Redirecting logged in user from /login to /dashboard'); 
                return <Navigate to="/dashboard" replace />; 
              })()
            ) : (
              (() => { 
                console.log('📝 AppContent: Showing login page for non-authenticated user'); 
                return <Login />; 
              })()
            )
          } />
          <Route path="/signup" element={
            user && isAuthenticated ? (
              (() => { 
                console.log('🔄 AppContent: Redirecting logged in user from /signup to /dashboard'); 
                return <Navigate to="/dashboard" replace />; 
              })()
            ) : (
              (() => { 
                console.log('📝 AppContent: Showing signup page for non-authenticated user'); 
                return <Signup />; 
              })()
            )
          } />
          
          {/* Protected Routes */}
          <Route path="/" element={
            (() => { 
              console.log('🏠 AppContent: Root route, redirecting to /dashboard'); 
              return <Navigate to="/dashboard" replace />; 
            })()
          } />
          
          {/* Accounting Route - No Authentication Required */}
          <Route path="/accounting" element={
            (() => { 
              console.log('💰 AppContent: Rendering accounting route'); 
              return (
                <Layout>
                  <Accounting />
                </Layout>
              ); 
            })()
          } />
          
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={
              (() => { 
                console.log('📊 AppContent: Rendering dashboard route'); 
                return (
                  <Layout>
                    <Dashboard />
                  </Layout>
                ); 
              })()
            } />
            <Route path="/crm" element={
              (() => { 
                console.log('👥 AppContent: Rendering CRM route'); 
                return (
                  <Layout>
                    <CRM />
                  </Layout>
                ); 
              })()
            } />
            <Route path="/orders" element={
              (() => { 
                console.log('📦 AppContent: Rendering orders route'); 
                return (
                  <Layout>
                    <Orders />
                  </Layout>
                ); 
              })()
            } />
            <Route path="/drivers" element={
              (() => { 
                console.log('🚚 AppContent: Rendering drivers route'); 
                return (
                  <Layout>
                    <Drivers />
                  </Layout>
                ); 
              })()
            } />
            <Route path="/price-list" element={
              (() => { 
                console.log('📋 AppContent: Rendering price list route'); 
                return (
                  <Layout>
                    <PriceList />
                  </Layout>
                ); 
              })()
            } />
            <Route path="/order-history" element={
              (() => { 
                console.log('📚 AppContent: Rendering order history route'); 
                return (
                  <Layout>
                    <OrderHistory />
                  </Layout>
                ); 
              })()
            } />
            <Route path="/cashbox" element={
              (() => { 
                console.log('💰 AppContent: Rendering cashbox route'); 
                return (
                  <Layout>
                    <Cashbox />
                  </Layout>
                ); 
              })()
            } />
            <Route path="/reports" element={
              (() => { 
                console.log('📊 AppContent: Rendering reports route'); 
                return (
                  <Layout>
                    <Reports />
                  </Layout>
                ); 
              })()
            } />
            <Route path="/settings" element={
              (() => { 
                console.log('⚙️ AppContent: Rendering settings route'); 
                return (
                  <Layout>
                    <Settings />
                  </Layout>
                ); 
              })()
            } />
          </Route>
          
          {/* 404 Route */}
          <Route path="*" element={
            (() => { 
              console.log('❓ AppContent: 404 route, redirecting to /dashboard'); 
              return <Navigate to="/dashboard" replace />; 
            })()
          } />
        </Routes>
      </Router>
    </SocketProvider>
  );
};

// Root App Component
const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ErrorBoundary>
          <AppContent />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                duration: 3000,
                iconTheme: {
                  primary: '#10B981',
                  secondary: '#fff',
                },
              },
              error: {
                duration: 5000,
                iconTheme: {
                  primary: '#EF4444',
                  secondary: '#fff',
                },
              },
            }}
          />
        </ErrorBoundary>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;

