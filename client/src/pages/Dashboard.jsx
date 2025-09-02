import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { motion } from 'framer-motion';
import { 
  Package, 
  Users, 
  Truck, 
  DollarSign, 
  TrendingUp, 
  Clock,
  CheckCircle,
  AlertCircle,
  BarChart3,
  Calendar,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import api, { apiHelpers } from '../api';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';

const Dashboard = () => {
  const { user, isAuthenticated } = useAuth();
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    totalClients: 0,
    activeDrivers: 0,
    totalRevenue: { usd: 0, lbp: 0 },
    pendingPayments: { usd: 0, lbp: 0 }
  });

  // Safety function to ensure stats object is always valid
  const getSafeStats = () => {
    return {
      totalOrders: stats?.totalOrders || 0,
      pendingOrders: stats?.pendingOrders || 0,
      completedOrders: stats?.completedOrders || 0,
      totalClients: stats?.totalClients || 0,
      activeDrivers: stats?.activeDrivers || 0,
      totalRevenue: {
        usd: stats?.totalRevenue?.usd || 0,
        lbp: stats?.totalRevenue?.lbp || 0
      },
      pendingPayments: {
        usd: stats?.pendingPayments?.usd || 0,
        lbp: stats?.pendingPayments?.lbp || 0
      }
    };
  };

  const { data: dashboardData, isLoading, error } = useQuery(
    'dashboard-stats',
    () => api.get('/dashboard/stats'),
    {
      enabled: isAuthenticated && !!user, // Only run query when authenticated
      refetchInterval: 30000, // Refresh every 30 seconds
      staleTime: 10000,
      retry: 3,
      retryDelay: 1000,
      onError: (error) => {
        console.error('Dashboard stats error:', error);
      }
    }
  );

  const { data: recentOrders, isLoading: ordersLoading } = useQuery(
    'recent-orders',
    () => api.get('/orders?limit=5'),
    {
      enabled: isAuthenticated && !!user, // Only run query when authenticated
      refetchInterval: 15000,
      retry: 2,
      select: (response) => response.data?.data || [],
      onError: (error) => {
        console.error('Recent orders error:', error);
      }
    }
  );

  const { data: recentTransactions, isLoading: transactionsLoading } = useQuery(
    'recent-transactions',
    () => api.get('/transactions?limit=5'),
    {
      enabled: isAuthenticated && !!user, // Only run query when authenticated
      refetchInterval: 20000,
      retry: 2,
      select: (response) => response.data?.data || [],
      onError: (error) => {
        console.error('Recent transactions error:', error);
      }
    }
  );

  useEffect(() => {
    console.log('📊 Dashboard: dashboardData received:', dashboardData);
    if (dashboardData?.data) {
      console.log('📊 Dashboard: Setting stats with data:', dashboardData.data);
      // Ensure all required properties exist with default values
      const safeData = {
        totalOrders: dashboardData.data.totalOrders || 0,
        pendingOrders: dashboardData.data.pendingOrders || 0,
        completedOrders: dashboardData.data.completedOrders || 0,
        totalClients: dashboardData.data.totalClients || 0,
        activeDrivers: dashboardData.data.activeDrivers || 0,
        totalRevenue: {
          usd: dashboardData.data.totalRevenue?.usd || 0,
          lbp: dashboardData.data.totalRevenue?.lbp || 0
        },
        pendingPayments: {
          usd: dashboardData.data.pendingPayments?.usd || 0,
          lbp: dashboardData.data.pendingPayments?.lbp || 0
        }
      };
      setStats(safeData);
    } else if (dashboardData?.data?.data) {
      // Handle nested data structure from virtual responses
      console.log('📊 Dashboard: Setting stats with nested data:', dashboardData.data.data);
      const safeData = {
        totalOrders: dashboardData.data.data.totalOrders || 0,
        pendingOrders: dashboardData.data.data.pendingOrders || 0,
        completedOrders: dashboardData.data.data.completedOrders || 0,
        totalClients: dashboardData.data.data.totalClients || 0,
        activeDrivers: dashboardData.data.data.activeDrivers || 0,
        totalRevenue: {
          usd: dashboardData.data.data.totalRevenue?.usd || 0,
          lbp: dashboardData.data.data.totalRevenue?.lbp || 0
        },
        pendingPayments: {
          usd: dashboardData.data.data.pendingPayments?.usd || 0,
          lbp: dashboardData.data.data.pendingPayments?.lbp || 0
        }
      };
      setStats(safeData);
    }
  }, [dashboardData]);

  // Show loading if not authenticated yet
  if (!isAuthenticated || !user) {
    return (
      <div className="page-wrapper">
        <div className="page-header-section">
          <div className="page-title-section">
            <h1 className="page-title-main">Dashboard</h1>
            <p className="page-subtitle-main">Welcome to your ERP system overview</p>
          </div>
        </div>
        <div className="page-content-section">
          <LoadingSpinner isLoading={true} message="Loading dashboard..." />
        </div>
      </div>
    );
  }

  // Show loading spinner while data is being fetched
  if (isLoading && !dashboardData) {
    return (
      <div className="page-wrapper">
        <div className="page-header-section">
          <div className="page-title-section">
            <h1 className="page-title-main">Dashboard</h1>
            <p className="page-subtitle-main">Welcome to your ERP system overview</p>
          </div>
        </div>
        <div className="page-content-section">
          <LoadingSpinner isLoading={true} message="Loading dashboard data..." />
        </div>
      </div>
    );
  }

  // Show error state if there's an error
  if (error) {
    return (
      <div className="page-wrapper">
        <div className="page-header-section">
          <div className="page-title-section">
            <h1 className="page-title-main">Dashboard</h1>
            <p className="page-subtitle-main">Welcome to your ERP system overview</p>
          </div>
        </div>
        <div className="page-content-section">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <div className="text-red-500 text-4xl mb-4">⚠️</div>
            <h3 className="text-lg font-semibold text-red-800 mb-2">Error Loading Dashboard</h3>
            <p className="text-red-600 mb-4">
              {error.message || 'Failed to load dashboard data. Please try refreshing the page.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  const StatCard = ({ title, value, icon: Icon, color, subtitle, change, trend }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-white dark:bg-gray-800 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700 p-6 hover:shadow-soft-lg transition-all duration-300"
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        {trend && (
          <div className={`flex items-center text-sm font-medium ${
            trend === 'up' ? 'text-green-600' : 'text-red-600'
          }`}>
            {trend === 'up' ? (
              <ArrowUpRight className="w-4 h-4 mr-1" />
            ) : (
              <ArrowDownRight className="w-4 h-4 mr-1" />
            )}
            {change}%
          </div>
        )}
      </div>
      <div>
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{value}</h3>
        <p className="text-gray-600 dark:text-gray-400 text-sm">{title}</p>
        {subtitle && (
          <p className="text-gray-500 dark:text-gray-500 text-xs mt-1">{subtitle}</p>
        )}
      </div>
    </motion.div>
  );

  const QuickAction = ({ title, description, icon: Icon, onClick, color }) => (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-soft border border-gray-100 dark:border-gray-700 p-6 text-left hover:shadow-soft-lg transition-all duration-300 group"
    >
      <div className={`w-12 h-12 ${color} rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
      <p className="text-gray-600 dark:text-gray-400 text-sm">{description}</p>
    </motion.button>
  );

  if (isLoading) {
    return (
      <div className="page-wrapper">
        <div className="page-header-section">
          <div className="page-title-section">
            <h1 className="page-title-main">Dashboard</h1>
            <p className="page-subtitle-main">Welcome to your ERP system overview</p>
          </div>
        </div>
        <div className="page-content-section">
          <LoadingSpinner isLoading={true} message="Loading dashboard..." />
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      {/* Page Header */}
      <div className="page-header-section">
        <div className="page-title-section">
          <h1 className="page-title-main">Dashboard</h1>
          <p className="page-subtitle-main">Welcome to your ERP system overview</p>
        </div>
      </div>

      {/* Page Content */}
      <div className="page-content-section">
        {(() => {
          try {
            return (
              <>
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  <StatCard
                    title="Total Orders"
                    value={getSafeStats().totalOrders}
                    icon={Package}
                    color="bg-gradient-to-r from-blue-500 to-blue-600"
                    subtitle="All time orders"
                    change="12"
                    trend="up"
                  />
                  <StatCard
                    title="Pending Orders"
                    value={getSafeStats().pendingOrders}
                    icon={Clock}
                    color="bg-gradient-to-r from-yellow-500 to-yellow-600"
                    subtitle="Awaiting processing"
                    change="5"
                    trend="down"
                  />
                  <StatCard
                    title="Total Clients"
                    value={getSafeStats().totalClients}
                    icon={Users}
                    color="bg-gradient-to-r from-green-500 to-green-600"
                    subtitle="Registered clients"
                    change="8"
                    trend="up"
                  />
                  <StatCard
                    title="Active Drivers"
                    value={getSafeStats().activeDrivers}
                    icon={Truck}
                    color="bg-gradient-to-r from-purple-500 to-purple-600"
                    subtitle="Available drivers"
                    change="3"
                    trend="up"
                  />
                </div>

                {/* Revenue Stats */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="bg-white dark:bg-gray-800 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700 p-6"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Total Revenue</h3>
                      <DollarSign className="w-6 h-6 text-green-500" />
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 dark:text-gray-400">USD</span>
                        <span className="text-xl font-bold text-green-600">
                          ${getSafeStats().totalRevenue.usd.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 dark:text-gray-400">LBP</span>
                        <span className="text-xl font-bold text-blue-600">
                          {getSafeStats().totalRevenue.lbp.toLocaleString()} LBP
                        </span>
                      </div>
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="bg-white dark:bg-gray-800 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700 p-6"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Pending Payments</h3>
                      <AlertCircle className="w-6 h-6 text-yellow-500" />
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 dark:text-gray-400">USD</span>
                        <span className="text-xl font-bold text-yellow-600">
                          ${getSafeStats().pendingPayments.usd.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 dark:text-gray-400">LBP</span>
                        <span className="text-xl font-bold text-yellow-600">
                          {getSafeStats().pendingPayments.lbp.toLocaleString()} LBP
                        </span>
                      </div>
                    </div>
                  </motion.div>
                </div>

                {/* Quick Actions */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                  className="mb-8"
                >
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <QuickAction
                      title="New Order"
                      description="Create a new delivery order"
                      icon={Package}
                      color="bg-gradient-to-r from-blue-500 to-blue-600"
                      onClick={() => window.location.href = '/orders'}
                    />
                    <QuickAction
                      title="Add Client"
                      description="Register a new client"
                      icon={Users}
                      color="bg-gradient-to-r from-green-500 to-green-600"
                      onClick={() => window.location.href = '/crm'}
                    />
                    <QuickAction
                      title="Add Driver"
                      description="Register a new driver"
                      icon={Truck}
                      color="bg-gradient-to-r from-purple-500 to-purple-600"
                      onClick={() => window.location.href = '/drivers'}
                    />
                    <QuickAction
                      title="View Reports"
                      description="Check financial reports"
                      icon={BarChart3}
                      color="bg-gradient-to-r from-orange-500 to-orange-600"
                      onClick={() => window.location.href = '/accounting'}
                    />
                  </div>
                </motion.div>

                {/* Recent Activity */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Recent Orders */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.5 }}
                    className="bg-white dark:bg-gray-800 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700 p-6"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Orders</h3>
                      <Package className="w-5 h-5 text-gray-400" />
                    </div>
                    {(() => {
                      console.log('📦 Dashboard: Recent orders data:', recentOrders);
                      return null;
                    })()}
                    {ordersLoading ? (
                      <LoadingSpinner isLoading={true} message="Loading orders..." size="small" />
                    ) : recentOrders?.length > 0 ? (
                      <div className="space-y-3">
                        {recentOrders.slice(0, 5).map((order) => (
                          <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{order.order_ref}</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">{order.customer_name}</p>
                            </div>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              order.status === 'new' ? 'bg-blue-100 text-blue-800' :
                              order.status === 'assigned' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {order.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400 text-center py-4">No recent orders</p>
                    )}
                  </motion.div>

                  {/* Recent Transactions */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.6 }}
                    className="bg-white dark:bg-gray-800 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700 p-6"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Transactions</h3>
                      <DollarSign className="w-5 h-5 text-gray-400" />
                    </div>
                    {transactionsLoading ? (
                      <LoadingSpinner isLoading={true} message="Loading transactions..." size="small" />
                    ) : recentTransactions?.length > 0 ? (
                      <div className="space-y-3">
                        {recentTransactions.slice(0, 5).map((transaction) => (
                          <div key={transaction.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{transaction.reference}</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">{transaction.description}</p>
                            </div>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              transaction.type === 'income' ? 'bg-green-100 text-green-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {transaction.type}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400 text-center py-4">No recent transactions</p>
                    )}
                  </motion.div>
                </div>
              </>
            );
          } catch (e) {
            console.error('Error rendering dashboard content:', e);
            return (
              <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                <div className="text-red-500 text-4xl mb-4">⚠️</div>
                <h3 className="text-lg font-semibold text-red-800 mb-2">Error Loading Dashboard</h3>
                <p className="text-red-600 mb-4">
                  Failed to load dashboard data. Please try refreshing the page.
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Refresh Page
                </button>
              </div>
            );
          }
        })()}
      </div>
    </div>
  );
};

export default Dashboard;
