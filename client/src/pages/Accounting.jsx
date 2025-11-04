import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Calendar, 
  Filter, 
  Download, 
  Plus, 
  RefreshCw, 
  Printer, 
  Eye,
  Edit3,
  CheckCircle,
  XCircle,
  DollarSign,
  Users,
  Truck,
  Building2,
  ChevronRight,
  ArrowLeft
} from 'lucide-react';
import { format } from 'date-fns';
import PaymentModal from '../components/PaymentModal';
import SyncStatusBadge from '../components/SyncStatusBadge';
import SyncControls from '../components/SyncControls';
import QueueModal from '../components/QueueModal';
import apiClient from '../lib/apiClient';
import { toast } from 'react-hot-toast';

const Accounting = () => {
  const [activeTab, setActiveTab] = useState('clients');
  const [data, setData] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    fromDate: '',
    toDate: '',
    clientId: '',
    driverId: '',
    thirdPartyId: '',
    orderType: '',
    deliveryMethod: '',
    paymentStatus: '',
    currencyView: 'both', // 'usd', 'lbp', 'both'
    searchTerm: '', // Search by client name or reference
    statusFilter: 'delivered' // 'delivered', 'prepaid', 'all'
  });
  const [editingCell, setEditingCell] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showOrderDetail, setShowOrderDetail] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [exchangeRate, setExchangeRate] = useState(89000);
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [selectedThirdParty, setSelectedThirdParty] = useState(null);
  const [clientOrders, setClientOrders] = useState([]);
  const [driverOrders, setDriverOrders] = useState([]);
  const [thirdPartyOrders, setThirdPartyOrders] = useState([]);
  const [viewMode, setViewMode] = useState('summary'); // 'summary' or 'detail'
  const [selectedOrders, setSelectedOrders] = useState(new Set());
  const [showBulkCashOutModal, setShowBulkCashOutModal] = useState(false);
  
  // Sync state
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isPaused, setIsPaused] = useState(false);
  const [queueLength, setQueueLength] = useState(0);
  const [showQueueModal, setShowQueueModal] = useState(false);

  // WebSocket connection - using the global socket from context
  // const { connected: wsConnected, send: wsSend } = useAutoWebSocket('ws://localhost:5000', {
  //   autoConnect: true,
  //   reconnect: true
  // });

  // Monitor network status and queue
  useEffect(() => {
    const updateNetworkStatus = () => {
      setIsOnline(navigator.onLine);
    };

    const updateQueueLength = async () => {
      try {
        const queue = await apiClient.getQueue();
        setQueueLength(queue.length);
      } catch (error) {
        console.error('Failed to get queue length:', error);
      }
    };

    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
    
    updateQueueLength();
    const interval = setInterval(updateQueueLength, 2000);

    return () => {
      window.removeEventListener('online', updateNetworkStatus);
      window.removeEventListener('offline', updateNetworkStatus);
      clearInterval(interval);
    };
  }, []);

  // Fetch data based on active tab using offline-first API client
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Clear summaries when switching tabs to prevent mixing data
      setSummaries([]);
      setData([]);
      
      const params = new URLSearchParams();
      if (filters.fromDate) params.append('fromDate', filters.fromDate);
      if (filters.toDate) params.append('toDate', filters.toDate);
      if (filters.clientId) params.append('clientId', filters.clientId);
      if (filters.driverId) params.append('driverId', filters.driverId);
      if (filters.thirdPartyId) params.append('thirdPartyId', filters.thirdPartyId);
      if (filters.searchTerm) params.append('search', filters.searchTerm);
      if (filters.statusFilter) params.append('statusFilter', filters.statusFilter);

      const result = await apiClient.get(`/accounting/${activeTab}?${params}`);
      console.log(`${activeTab} data response:`, result);
      
      // Validate summaries structure based on active tab
      let validSummaries = result.summaries || [];
      if (activeTab === 'drivers') {
        // Ensure driver summaries have driverId field
        validSummaries = validSummaries.filter(s => s.driverId || s.driver_id).map(s => ({
          ...s,
          driverId: s.driverId || s.driver_id,
          driver_id: s.driver_id || s.driverId,
          driverName: s.driverName || s.driver_name,
          driver_name: s.driver_name || s.driverName
        }));
      }
      
      setData(result.data || []);
      setSummaries(validSummaries);
    } catch (error) {
      console.error('Error fetching accounting data:', error);
      // Clear data on error
      setData([]);
      setSummaries([]);
      // Error is already handled gracefully by apiClient
    } finally {
      setLoading(false);
    }
  }, [activeTab, filters]);

  // Fetch exchange rates using offline-first API client
  const fetchExchangeRates = useCallback(async () => {
    try {
      const result = await apiClient.get('/accounting/exchange-rates');
      if (result.data && result.data.length > 0) {
        setExchangeRate(result.data[0].usd_to_lbp_rate);
      }
    } catch (error) {
      console.error('Error fetching exchange rates:', error);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchExchangeRates();
  }, [fetchData, fetchExchangeRates]);

  // Fetch client orders using offline-first API client
  const fetchClientOrders = useCallback(async (clientId) => {
    try {
      const params = new URLSearchParams();
      if (filters.fromDate) params.append('fromDate', filters.fromDate);
      if (filters.toDate) params.append('toDate', filters.toDate);
      params.append('clientId', clientId);

      const result = await apiClient.get(`/accounting/clients?${params}`);
      setClientOrders(result.data || []);
    } catch (error) {
      console.error('Error fetching client orders:', error);
    }
  }, [filters]);

  // Fetch driver orders using offline-first API client
  const fetchDriverOrders = useCallback(async (driverId) => {
    try {
      // Validate driverId before making request
      if (!driverId || driverId === 'undefined' || driverId === 'null' || driverId === undefined || driverId === null) {
        console.error('Invalid driverId provided to fetchDriverOrders:', driverId);
        toast.error('Invalid driver ID. Cannot fetch orders.');
        setDriverOrders([]);
        return;
      }

      const params = new URLSearchParams();
      if (filters.fromDate) params.append('fromDate', filters.fromDate);
      if (filters.toDate) params.append('toDate', filters.toDate);
      // Only append driverId if it's valid
      if (driverId && driverId !== 'undefined' && driverId !== 'null') {
        params.append('driverId', String(driverId));
      }

      const result = await apiClient.get(`/accounting/drivers?${params}`);
      setDriverOrders(result.data || []);
    } catch (error) {
      console.error('Error fetching driver orders:', error);
      toast.error('Failed to fetch driver orders. Please try again.');
      setDriverOrders([]);
    }
  }, [filters]);

  // Fetch third party orders using offline-first API client
  const fetchThirdPartyOrders = useCallback(async (thirdPartyName) => {
    try {
      const params = new URLSearchParams();
      if (filters.fromDate) params.append('fromDate', filters.fromDate);
      if (filters.toDate) params.append('toDate', filters.toDate);
      if (filters.paymentStatus) params.append('paymentStatus', filters.paymentStatus);
      
      // Handle unnamed third parties
      if (thirdPartyName === 'Unnamed Third Party') {
        // Don't add thirdPartyName filter to get all orders with null third_party_name
      } else {
        params.append('thirdPartyName', thirdPartyName);
      }

      const result = await apiClient.get(`/accounting/third-party?${params}`);
      setThirdPartyOrders(result.data || []);
    } catch (error) {
      console.error('Error fetching third party orders:', error);
    }
  }, [filters]);

  // Column definitions for each tab
  const getColumns = () => {
    const baseColumns = {
      clients: [
        { key: 'reference', label: 'Reference', width: 100, sortable: true },
        { key: 'customer_name', label: 'Customer Name', width: 120, sortable: true },
        { key: 'customer_phone', label: 'Customer Phone', width: 110, sortable: true },
        { key: 'customer_location', label: 'Customer Address', width: 140, sortable: true },
        { key: 'total_usd', label: 'Price USD', width: 90, sortable: true, type: 'currency' },
        { key: 'total_lbp', label: 'Price LBP', width: 100, sortable: true, type: 'currency' },
        { key: 'delivery_fee_usd', label: 'Delivery Fee USD', width: 110, sortable: true, type: 'currency' },
        { key: 'delivery_fee_lbp', label: 'Delivery Fee LBP', width: 120, sortable: true, type: 'currency' },
        { key: 'payment_status', label: 'Payment Status', width: 100, sortable: true },
        { key: 'date', label: 'Date', width: 100, sortable: true, type: 'date' }
      ],
      drivers: [
        { key: 'reference', label: 'Reference', width: 100, sortable: true },
        { key: 'total_usd', label: 'Order Price USD', width: 110, sortable: true, type: 'currency' },
        { key: 'total_lbp', label: 'Order Price LBP', width: 120, sortable: true, type: 'currency' },
        { key: 'fee_usd', label: 'Fee USD', width: 90, sortable: true, type: 'currency' },
        { key: 'fee_lbp', label: 'Fee LBP', width: 100, sortable: true, type: 'currency' },
        { key: 'customer_name', label: 'Customer', width: 120, sortable: true },
        { key: 'customer_phone', label: 'Customer Phone', width: 110, sortable: true },
        { key: 'customer_location', label: 'Customer Location', width: 130, sortable: true },
        { key: 'driver_name', label: 'Driver Name', width: 120, sortable: true },
        { key: 'date', label: 'Date', width: 100, sortable: true, type: 'date' },
        { key: 'payment_status', label: 'Payment Status', width: 100, sortable: true },
        { key: 'order_status', label: 'Order Status', width: 100, sortable: true },
        { key: 'delivery_method', label: 'Delivery Method', width: 110, sortable: true }
      ],
      'third-party': [
        { key: 'reference', label: 'Reference', width: 120, sortable: true },
        { key: 'total_usd', label: 'Order Price USD', width: 130, sortable: true, type: 'currency' },
        { key: 'total_lbp', label: 'Order Price LBP', width: 140, sortable: true, type: 'currency' },
        { key: 'third_party_fee_usd', label: 'Third Party Fee USD', width: 150, sortable: true, type: 'currency' },
        { key: 'third_party_fee_lbp', label: 'Third Party Fee LBP', width: 160, sortable: true, type: 'currency' },
        { key: 'driver_fee_usd', label: 'Driver Fee USD', width: 120, sortable: true, type: 'currency' },
        { key: 'driver_fee_lbp', label: 'Driver Fee LBP', width: 130, sortable: true, type: 'currency' },
        { key: 'customer_name', label: 'Customer Name', width: 150, sortable: true },
        { key: 'customer_location', label: 'Customer Location', width: 150, sortable: true },
        { key: 'third_party_name', label: 'Third Party Name', width: 150, sortable: true },
        { key: 'date', label: 'Date', width: 120, sortable: true, type: 'date' },
        { key: 'payment_status', label: 'Payment Status', width: 120, sortable: true }
      ]
    };

    return baseColumns[activeTab] || [];
  };

  // Format currency values - compact version
  const formatCurrency = (value, currency = 'USD') => {
    if (!value) return '0.00';
    const numValue = Number(value);
    if (currency === 'USD') {
      return `$${numValue.toFixed(2)}`;
    } else {
      return `${numValue.toLocaleString()} LBP`;
    }
  };

  // Format currency values - compact version for tables
  const formatCurrencyCompact = (value, currency = 'USD') => {
    if (!value) return '0';
    const numValue = Number(value);
    if (currency === 'USD') {
      return `$${numValue.toFixed(0)}`;
    } else {
      return `${(numValue / 1000).toFixed(0)}K`;
    }
  };

  // Format date values
  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return dateString;
    }
  };

  // Handle cell editing
  const handleCellEdit = (rowIndex, columnKey, value) => {
    const newData = [...data];
    newData[rowIndex][columnKey] = value;
    setData(newData);
    setEditingCell(null);
  };


  // Handle client selection
  const handleClientSelect = (client) => {
    console.log('Selected client:', client);
    setSelectedClient(client);
    setSelectedDriver(null);
    setSelectedThirdParty(null);
    setViewMode('detail');
    setSelectedOrders(new Set()); // Clear previous selections
    fetchClientOrders(client.clientId || client.client_account_ref);
  };

  // Handle driver selection
  const handleDriverSelect = (driver) => {
    console.log('Selected driver:', driver);
    const driverId = driver.driverId || driver.driver_id;
    
    // Validate driverId before proceeding
    if (!driverId || driverId === 'undefined' || driverId === 'null') {
      console.error('Invalid driver ID:', driverId);
      toast.error('Invalid driver ID. Please select a valid driver.');
      return;
    }
    
    setSelectedDriver(driver);
    setSelectedClient(null);
    setSelectedThirdParty(null);
    setViewMode('detail');
    setSelectedOrders(new Set()); // Clear previous selections
    fetchDriverOrders(driverId);
  };

  // Handle third party selection
  const handleThirdPartySelect = (thirdParty) => {
    console.log('Selected third party:', thirdParty);
    setSelectedThirdParty(thirdParty);
    setSelectedClient(null);
    setSelectedDriver(null);
    setViewMode('detail');
    setSelectedOrders(new Set()); // Clear previous selections
    fetchThirdPartyOrders(thirdParty.thirdPartyName || thirdParty.third_party_name);
  };

  // Go back to summary view
  const handleBackToSummary = () => {
    setViewMode('summary');
    setSelectedClient(null);
    setSelectedDriver(null);
    setSelectedThirdParty(null);
    setClientOrders([]);
    setDriverOrders([]);
    setThirdPartyOrders([]);
    setSelectedOrders(new Set()); // Clear selected orders
  };

  // Helper function to check if order is eligible for cash out
  const isOrderEligibleForCashOut = (order) => {
    // Check for delivered status - try both status and order_status fields
    const isDelivered = order.status === 'delivered' || 
                       order.order_status === 'delivered' || 
                       order.status === 'completed' ||
                       order.order_status === 'completed';
    
    // Check for paid status - try both cases
    const isPaid = order.payment_status === 'Paid' || 
                   order.payment_status === 'paid';
    
    // Check if not already cashed out
    const notCashedOut = !order.accounting_cashed && !order.moved_to_history;
    
    return isDelivered && isPaid && notCashedOut;
  };

  // Handle order selection for bulk operations
  const handleOrderSelect = (orderId, isSelected) => {
    const newSelectedOrders = new Set(selectedOrders);
    if (isSelected) {
      newSelectedOrders.add(orderId);
    } else {
      newSelectedOrders.delete(orderId);
    }
    setSelectedOrders(newSelectedOrders);
  };

  // Handle select all orders
  const handleSelectAll = (orders) => {
    const eligibleOrders = orders.filter(isOrderEligibleForCashOut);
    if (selectedOrders.size === eligibleOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(eligibleOrders.map(order => order.id)));
    }
  };

  // Get current orders based on active tab
  const getCurrentOrders = () => {
    if (activeTab === 'clients' && selectedClient) return clientOrders;
    if (activeTab === 'drivers' && selectedDriver) return driverOrders;
    if (activeTab === 'third-party' && selectedThirdParty) return thirdPartyOrders;
    return [];
  };

  // Bulk cash out orders
  const handleBulkCashOut = async () => {
    const ordersToCashOut = Array.from(selectedOrders);
    if (ordersToCashOut.length === 0) {
      toast.error('No orders selected for cash out');
      return;
    }

    try {
      const results = await Promise.allSettled(
        ordersToCashOut.map(orderId => handleCashOut(orderId))
      );

      const successful = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.filter(result => result.status === 'rejected').length;

      if (successful > 0) {
        toast.success(`${successful} orders cashed out successfully`);
        setSelectedOrders(new Set());
        setShowBulkCashOutModal(false);
        
        // Refresh data
        fetchData();
        if (selectedClient) {
          fetchClientOrders(selectedClient.clientId || selectedClient.client_account_ref);
        }
        if (selectedDriver) {
          const driverId = selectedDriver.driverId || selectedDriver.driver_id;
          if (driverId && driverId !== 'undefined' && driverId !== 'null') {
            fetchDriverOrders(driverId);
          }
        }
        if (selectedThirdParty) {
          fetchThirdPartyOrders(selectedThirdParty.thirdPartyName || selectedThirdParty.third_party_name);
        }
      }

      if (failed > 0) {
        toast.error(`${failed} orders failed to cash out`);
      }
    } catch (error) {
      console.error('Error in bulk cash out:', error);
      toast.error('Failed to process bulk cash out');
    }
  };

  // Cash out order
  const handleCashOut = async (orderId) => {
    try {
      // Find the order in the current orders array instead of fetching it
      const currentOrders = getCurrentOrders();
      const order = currentOrders.find(o => o.id === orderId);
      
      if (!order) {
        toast.error('Order not found in current data');
        return;
      }

      // Determine cashout mode based on active tab
      // If we're on the drivers tab, use driver mode
      // If we're on the third-party tab, use third_party mode
      // Otherwise, use client mode
      let cashoutMode = 'client';
      if (activeTab === 'drivers') {
        cashoutMode = 'driver';
      } else if (activeTab === 'third-party') {
        cashoutMode = 'third_party';
      }
      
      console.log('💵 Cashout request:', {
        orderId,
        orderRef: order.order_ref || order.reference,
        activeTab,
        cashoutMode,
        orderStatus: order.status || order.order_status,
        paymentStatus: order.payment_status,
        accounting_cashed: order.accounting_cashed,
        moved_to_history: order.moved_to_history
      });
      
      // Check if order is eligible for cash out
      const isDelivered = order.status === 'delivered' || 
                         order.order_status === 'delivered' || 
                         order.status === 'completed' ||
                         order.order_status === 'completed';
      
      if (!isDelivered) {
        toast.error('Order must be delivered or completed to cash out');
        return;
      }

      // For driver and third-party cashout, payment status is optional
      // For client cashout, payment status must be paid
      if (cashoutMode === 'client') {
        const isPaid = order.payment_status === 'Paid' || 
                       order.payment_status === 'paid';
        
        if (!isPaid) {
          toast.error('Order must be paid to cash out');
          return;
        }
      }

      // For driver and third-party cashout, allow even if accounting_cashed is true (might be cashed for client but not driver/third-party)
      if ((cashoutMode === 'driver' || cashoutMode === 'third_party') && order.accounting_cashed) {
        console.log(`⚠️ Order already cashed for client accounting, but proceeding with ${cashoutMode} cashout`);
      } else if (cashoutMode === 'client' && (order.accounting_cashed || order.moved_to_history)) {
        toast.error('Order already cashed out');
        return;
      }
      
      // Handle different order types
      if (order.type === 'ecommerce' || order.type === 'instant') {
        // For ecommerce/instant orders, move to order history
        const requestBody = {
          mode: cashoutMode,
          createdBy: 1 // You might want to get this from auth context
        };
        console.log('📤 Sending cashout request:', { url: `/accounting/cashout/${orderId}`, body: requestBody });
        const result = await apiClient.post(`/accounting/cashout/${orderId}`, requestBody);
        
        if (result.success) {
          let successMessage = '';
          if (cashoutMode === 'driver') {
            successMessage = `Order ${order.order_ref || order.reference} marked as cashed for driver accounting!`;
          } else if (cashoutMode === 'third_party') {
            successMessage = `Order ${order.order_ref || order.reference} marked as cashed for third-party accounting!`;
          } else {
            successMessage = `Order ${order.order_ref || order.reference} moved to order history!`;
          }
          toast.success(successMessage);
          // Refresh data to show updated status
          fetchData();
          if (selectedClient) {
            fetchClientOrders(selectedClient.clientId || selectedClient.client_account_ref);
          }
          if (selectedDriver) {
            const driverId = selectedDriver.driverId || selectedDriver.driver_id;
            if (driverId && driverId !== 'undefined' && driverId !== 'null') {
              fetchDriverOrders(driverId);
            }
          }
          if (selectedThirdParty) {
            fetchThirdPartyOrders(selectedThirdParty.thirdPartyName || selectedThirdParty.third_party_name);
          }
        }
      } else {
        // For prepaid/go-to-market orders, add money to cash account
        const requestBody = {
          mode: cashoutMode,
          createdBy: 1 // You might want to get this from auth context
        };
        console.log('📤 Sending cashout request:', { url: `/accounting/cashout/${orderId}`, body: requestBody });
        const result = await apiClient.post(`/accounting/cashout/${orderId}`, requestBody);
        
        if (result.success) {
          let successMessage = '';
          if (cashoutMode === 'driver') {
            successMessage = `Order ${order.order_ref || order.reference} marked as cashed for driver accounting!`;
          } else if (cashoutMode === 'third_party') {
            successMessage = `Order ${order.order_ref || order.reference} marked as cashed for third-party accounting!`;
          } else {
            successMessage = `Order ${order.order_ref || order.reference} cashed out successfully! Money added to cash account.`;
          }
          toast.success(successMessage);
          // Refresh data to show updated status
          fetchData();
          if (selectedClient) {
            fetchClientOrders(selectedClient.clientId || selectedClient.client_account_ref);
          }
          if (selectedDriver) {
            const driverId = selectedDriver.driverId || selectedDriver.driver_id;
            if (driverId && driverId !== 'undefined' && driverId !== 'null') {
              fetchDriverOrders(driverId);
            }
          }
          if (selectedThirdParty) {
            fetchThirdPartyOrders(selectedThirdParty.thirdPartyName || selectedThirdParty.third_party_name);
          }
        }
      }
    } catch (error) {
      console.error('Error cashing out order:', error);
      // Show detailed error message from API if available
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          'Failed to cash out order';
      toast.error(errorMessage);
      
      // Log detailed error for debugging
      if (error.response?.data) {
        console.error('Cashout error details:', {
          message: error.response.data.message,
          error: error.response.data.error,
          orderStatus: error.response.data.orderStatus,
          paymentStatus: error.response.data.paymentStatus,
          mode: error.response.data.mode,
          isDriverCashout: error.response.data.isDriverCashout,
          accounting_cashed: error.response.data.accounting_cashed,
          moved_to_history: error.response.data.moved_to_history,
          details: error.response.data.details
        });
      }
    }
  };

  // Export data using offline-first API client
  const handleExport = async (format = 'csv') => {
    try {
      // For PDF export of client account, use the specific endpoint
      if (format === 'pdf' && activeTab === 'clients' && selectedClient) {
        const clientId = selectedClient.clientId || selectedClient.client_name || selectedClient.client_account_ref;
        if (!clientId) {
          toast.error('Please select a client first');
          return;
        }
        
        const params = new URLSearchParams();
        if (filters.fromDate) params.append('fromDate', filters.fromDate);
        if (filters.toDate) params.append('toDate', filters.toDate);
        
        const response = await apiClient.get(`/accounting/clients/${encodeURIComponent(clientId)}/export/pdf?${params}`, {
          responseType: 'blob'
        });
        
        const blob = new Blob([response], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const clientName = selectedClient.clientName || selectedClient.client_name || clientId;
        const fileName = `${clientName.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('PDF file downloaded successfully');
        return;
      }
      
      // For other exports (CSV or PDF without selected client)
      const params = new URLSearchParams();
      if (filters.fromDate) params.append('fromDate', filters.fromDate);
      if (filters.toDate) params.append('toDate', filters.toDate);
      if (filters.searchTerm) params.append('search', filters.searchTerm);
      if (filters.statusFilter) params.append('statusFilter', filters.statusFilter);
      params.append('format', format);

      const response = await apiClient.get(`/accounting/export/orders?${params}`, {
        responseType: 'blob'
      });

      if (format === 'csv') {
        const blob = new Blob([response], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `orders-${filters.statusFilter || 'delivered'}-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('CSV file downloaded successfully');
      } else if (format === 'pdf') {
        const blob = new Blob([response], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `orders-${filters.statusFilter || 'delivered'}-${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('PDF file downloaded successfully');
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error('Failed to export data');
    }
  };

  // Render client summary rows
  const renderClientSummaryRows = () => {
    console.log('Client summaries:', summaries);
    if (summaries.length === 0) return null;

    return (
      <div className="p-3">
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-1 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client Name</th>
                <th className="px-1 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Old Balance</th>
                <th className="px-1 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Orders Sum</th>
                <th className="px-1 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Delivery Fees</th>
                <th className="px-1 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Payments</th>
                <th className="px-1 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">New Balance</th>
                <th className="px-1 py-1 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {summaries.map((summary, index) => (
                <tr 
                  key={index} 
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => handleClientSelect(summary)}
                >
                  <td className="px-1 py-1 text-xs font-medium text-gray-900">
                    {summary.clientName || summary.client_name}
                  </td>
                  <td className="px-1 py-1 text-xs text-gray-900 text-right">
                    {formatCurrencyCompact(summary.oldBalanceUsd)} / {formatCurrencyCompact(summary.oldBalanceLbp, 'LBP')}
                  </td>
                  <td className="px-1 py-1 text-xs text-gray-900 text-right">
                    {formatCurrencyCompact(summary.ordersSumUsd)} / {formatCurrencyCompact(summary.ordersSumLbp, 'LBP')}
                  </td>
                  <td className="px-1 py-1 text-xs text-gray-900 text-right">
                    {formatCurrencyCompact(summary.deliveryFeesUsd || summary.thirdPartyFeesUsd)} / {formatCurrencyCompact(summary.deliveryFeesLbp || summary.thirdPartyFeesLbp, 'LBP')}
                  </td>
                  <td className="px-1 py-1 text-xs text-gray-900 text-right">
                    {formatCurrencyCompact(summary.paymentsReceivedUsd || summary.paymentsUsd)} / {formatCurrencyCompact(summary.paymentsReceivedLbp || summary.paymentsLbp, 'LBP')}
                  </td>
                  <td className="px-1 py-1 text-xs text-right">
                    <span className={`font-semibold ${summary.newBalanceUsd >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrencyCompact(summary.newBalanceUsd)} / {formatCurrencyCompact(summary.newBalanceLbp, 'LBP')}
                    </span>
                  </td>
                  <td className="px-1 py-1 text-center">
                    <ChevronRight className="w-3 h-3 text-gray-400 mx-auto" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    );
  };

  // Render driver summary rows
  const renderDriverSummaryRows = () => {
    console.log('Driver summaries:', summaries);
    if (summaries.length === 0) return null;

    return (
      <div className="p-3">
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-1 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver Name</th>
                <th className="px-1 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Old Balance</th>
                <th className="px-1 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Orders Sum</th>
                <th className="px-1 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Driver Fees</th>
                <th className="px-1 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Payments</th>
                <th className="px-1 py-1 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {summaries.map((summary, index) => (
                <tr 
                  key={index} 
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => handleDriverSelect(summary)}
                >
                  <td className="px-1 py-1 text-xs font-medium text-gray-900">
                    {summary.driverName || summary.driver_name}
                  </td>
                  <td className="px-1 py-1 text-xs text-gray-900 text-right">
                    {formatCurrencyCompact(summary.oldBalanceUsd)} / {formatCurrencyCompact(summary.oldBalanceLbp, 'LBP')}
                  </td>
                  <td className="px-1 py-1 text-xs text-gray-900 text-right">
                    {formatCurrencyCompact(summary.ordersSumUsd)} / {formatCurrencyCompact(summary.ordersSumLbp, 'LBP')}
                  </td>
                  <td className="px-1 py-1 text-xs text-gray-900 text-right">
                    {formatCurrencyCompact(summary.driverFeesUsd || 0)} / {formatCurrencyCompact(summary.driverFeesLbp || 0, 'LBP')}
                  </td>
                  <td className="px-1 py-1 text-xs text-gray-900 text-right">
                    {formatCurrencyCompact(summary.paymentsReceivedUsd || summary.paymentsUsd || 0)} / {formatCurrencyCompact(summary.paymentsReceivedLbp || summary.paymentsLbp || 0, 'LBP')}
                  </td>
                  <td className="px-1 py-1 text-center">
                    <ChevronRight className="w-3 h-3 text-gray-400 mx-auto" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    );
  };

  // Render third party summary rows
  const renderThirdPartySummaryRows = () => {
    console.log('Third party summaries:', summaries);
    if (summaries.length === 0) return null;

    return (
      <div className="p-3">
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-1 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Third Party Name</th>
                <th className="px-1 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Orders Sum</th>
                <th className="px-1 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Delivery Fees</th>
                <th className="px-1 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Third Party Fees</th>
                <th className="px-1 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Driver Fees</th>
                <th className="px-1 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-1 py-1 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {summaries.map((summary, index) => (
                <tr 
                  key={index} 
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => handleThirdPartySelect(summary)}
                >
                  <td className="px-1 py-1 text-xs font-medium text-gray-900">
                    {summary.thirdPartyName || summary.third_party_name}
                  </td>
                  <td className="px-1 py-1 text-xs text-gray-900 text-right">
                    {formatCurrencyCompact(summary.ordersSumUsd)} / {formatCurrencyCompact(summary.ordersSumLbp, 'LBP')}
                  </td>
                  <td className="px-1 py-1 text-xs text-gray-900 text-right">
                    {formatCurrencyCompact(summary.deliveryFeesUsd || 0)} / {formatCurrencyCompact(summary.deliveryFeesLbp || 0, 'LBP')}
                  </td>
                  <td className="px-1 py-1 text-xs text-gray-900 text-right">
                    {formatCurrencyCompact(summary.thirdPartyFeesUsd)} / {formatCurrencyCompact(summary.thirdPartyFeesLbp, 'LBP')}
                  </td>
                  <td className="px-1 py-1 text-xs text-gray-900 text-right">
                    {formatCurrencyCompact(summary.driverFeesUsd)} / {formatCurrencyCompact(summary.driverFeesLbp, 'LBP')}
                  </td>
                  <td className="px-1 py-1 text-xs text-right">
                    <span className="font-semibold text-blue-600">
                      {formatCurrencyCompact(summary.ordersSumUsd + (summary.deliveryFeesUsd || 0) + summary.thirdPartyFeesUsd)} / {formatCurrencyCompact(summary.ordersSumLbp + (summary.deliveryFeesLbp || 0) + summary.thirdPartyFeesLbp, 'LBP')}
                    </span>
                  </td>
                  <td className="px-1 py-1 text-center">
                    <ChevronRight className="w-3 h-3 text-gray-400 mx-auto" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    );
  };

  // Render client detail view
  const renderClientDetailView = () => {
    if (!selectedClient) return null;

    const totalOrdersUsd = clientOrders.reduce((sum, order) => sum + (Number(order.total_usd) || 0), 0);
    const totalOrdersLbp = clientOrders.reduce((sum, order) => sum + (Number(order.total_lbp) || 0), 0);
    const totalDeliveryFeesUsd = clientOrders.reduce((sum, order) => sum + (Number(order.delivery_fee_usd) || 0), 0);
    const totalDeliveryFeesLbp = clientOrders.reduce((sum, order) => sum + (Number(order.delivery_fee_lbp) || 0), 0);
    // For client view, we only show delivery fees (no driver fees)
    const totalFeesUsd = totalDeliveryFeesUsd; // Only delivery fees for clients
    const totalFeesLbp = totalDeliveryFeesLbp; // Only delivery fees for clients
    const totalPaymentsUsd = clientOrders.reduce((sum, order) => sum + (Number(order.payments_usd) || 0), 0);
    const totalPaymentsLbp = clientOrders.reduce((sum, order) => sum + (Number(order.payments_lbp) || 0), 0);
    const oldBalanceUsd = selectedClient.oldBalanceUsd || 0;
    const oldBalanceLbp = selectedClient.oldBalanceLbp || 0;
    
    // Calculate new balance based on order types:
    // - Ecommerce orders: new balance = Orders Sum minus Fees
    // - Instant orders: new balance = Orders Sum plus Fees
    // - Other orders: orders + fees
    let ecommerceOrdersUsd = 0, ecommerceOrdersLbp = 0, ecommerceFeesUsd = 0, ecommerceFeesLbp = 0;
    let instantOrdersUsd = 0, instantOrdersLbp = 0, instantFeesUsd = 0, instantFeesLbp = 0;
    
    clientOrders.forEach(order => {
      const orderType = String(order.order_type || order.type || '').toLowerCase().trim();
      if (orderType === 'ecommerce') {
        ecommerceOrdersUsd += Number(order.total_usd || 0);
        ecommerceOrdersLbp += Number(order.total_lbp || 0);
        ecommerceFeesUsd += Number(order.delivery_fee_usd || 0);
        ecommerceFeesLbp += Number(order.delivery_fee_lbp || 0);
      } else if (orderType === 'instant') {
        instantOrdersUsd += Number(order.total_usd || 0);
        instantOrdersLbp += Number(order.total_lbp || 0);
        instantFeesUsd += Number(order.delivery_fee_usd || 0);
        instantFeesLbp += Number(order.delivery_fee_lbp || 0);
      }
    });
    
    const ecommerceBalanceUsd = ecommerceOrdersUsd - ecommerceFeesUsd;
    const ecommerceBalanceLbp = ecommerceOrdersLbp - ecommerceFeesLbp;
    const instantBalanceUsd = instantOrdersUsd + instantFeesUsd;
    const instantBalanceLbp = instantOrdersLbp + instantFeesLbp;
    const otherOrdersUsd = totalOrdersUsd - ecommerceOrdersUsd - instantOrdersUsd;
    const otherOrdersLbp = totalOrdersLbp - ecommerceOrdersLbp - instantOrdersLbp;
    const otherFeesUsd = totalFeesUsd - ecommerceFeesUsd - instantFeesUsd;
    const otherFeesLbp = totalFeesLbp - ecommerceFeesLbp - instantFeesLbp;
    const otherBalanceUsd = otherOrdersUsd + otherFeesUsd;
    const otherBalanceLbp = otherOrdersLbp + otherFeesLbp;
    
    const calculatedNewBalanceUsd = ecommerceBalanceUsd + instantBalanceUsd + otherBalanceUsd;
    const calculatedNewBalanceLbp = ecommerceBalanceLbp + instantBalanceLbp + otherBalanceLbp;
    
    const newBalanceUsd = oldBalanceUsd + calculatedNewBalanceUsd - totalPaymentsUsd;
    const newBalanceLbp = oldBalanceLbp + calculatedNewBalanceLbp - totalPaymentsLbp;

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <button
                onClick={handleBackToSummary}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <h2 className="text-xl font-semibold text-gray-900">
                {selectedClient.clientName || selectedClient.client_name} - Orders
              </h2>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleExport('pdf')}
                className="bg-red-600 text-white px-3 py-1.5 rounded-md hover:bg-red-700 flex items-center space-x-1 text-sm"
              >
                <Printer className="w-4 h-4" />
                <span>Export PDF</span>
              </button>
              <button
                onClick={() => handleExport('csv')}
                className="bg-green-600 text-white px-3 py-1.5 rounded-md hover:bg-green-700 flex items-center space-x-1 text-sm"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filters for Client Orders */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
          <div className="flex items-center space-x-2 mb-3">
            <Filter className="w-4 h-4 text-gray-500" />
            <h3 className="text-sm font-medium text-gray-700">Filter Orders</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">From Date</label>
              <input
                type="date"
                value={filters.fromDate}
                onChange={(e) => setFilters({...filters, fromDate: e.target.value})}
                className="w-full px-1 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">To Date</label>
              <input
                type="date"
                value={filters.toDate}
                onChange={(e) => setFilters({...filters, toDate: e.target.value})}
                className="w-full px-1 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Payment Status</label>
              <select
                value={filters.paymentStatus}
                onChange={(e) => setFilters({...filters, paymentStatus: e.target.value})}
                className="w-full px-1 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">All Status</option>
                <option value="Paid">Paid</option>
                <option value="Unpaid">Unpaid</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => fetchClientOrders(selectedClient.clientId || selectedClient.client_account_ref)}
                className="w-full bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 flex items-center justify-center space-x-1 text-sm"
              >
                <Filter className="w-4 h-4" />
                <span>Apply</span>
              </button>
            </div>
          </div>
        </div>

        {/* Orders List */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-1 py-1 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={clientOrders.length > 0 && selectedOrders.size === clientOrders.filter(isOrderEligibleForCashOut).length}
                    onChange={() => handleSelectAll(clientOrders)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-1 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</th>
                <th className="px-1 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer Name</th>
                <th className="px-1 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer Phone</th>
                <th className="px-1 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer Address</th>
                <th className="px-1 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Order Total USD</th>
                <th className="px-1 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Order Total LBP</th>
                <th className="px-1 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Fee USD</th>
                <th className="px-1 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Fee LBP</th>
                
                <th className="px-1 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Status</th>
                <th className="px-1 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-1 py-1 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {clientOrders.map((order, index) => {
                const totalFeesUsd = Number(order.delivery_fee_usd || 0); // Only delivery fees for clients
                const totalFeesLbp = Number(order.delivery_fee_lbp || 0); // Only delivery fees for clients
                const grandTotalUsd = Number(order.total_usd || 0) + totalFeesUsd;
                const grandTotalLbp = Number(order.total_lbp || 0) + totalFeesLbp;
                
                return (
                  <tr key={index} className={`hover:bg-gray-50 ${selectedOrders.has(order.id) ? 'bg-blue-50' : ''}`}>
                    <td className="px-1 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={selectedOrders.has(order.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleOrderSelect(order.id, e.target.checked);
                        }}
                        disabled={!isOrderEligibleForCashOut(order)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                      />
                    </td>
                    <td className="px-1 py-1 text-xs font-medium text-gray-900">{order.reference}</td>
                    <td className="px-1 py-1 text-xs text-gray-900">{order.customer_name || 'N/A'}</td>
                    <td className="px-1 py-1 text-xs text-gray-900">{order.customer_phone || 'N/A'}</td>
                    <td className="px-1 py-1 text-xs text-gray-900">{order.customer_location || 'N/A'}</td>
                    <td className="px-1 py-1 text-xs text-gray-900 text-right">{formatCurrency(order.total_usd)}</td>
                    <td className="px-1 py-1 text-xs text-gray-900 text-right">{formatCurrency(order.total_lbp, 'LBP')}</td>
                    <td className="px-1 py-1 text-xs text-gray-900 text-right">{formatCurrency(order.delivery_fee_usd)}</td>
                    <td className="px-1 py-1 text-xs text-gray-900 text-right">{formatCurrency(order.delivery_fee_lbp, 'LBP')}</td>
                    
                    <td className="px-1 py-1 text-xs">
                      <span className={`font-medium ${order.payment_status === 'Paid' ? 'text-green-600' : 'text-red-600'}`}>
                        {order.payment_status}
                      </span>
                    </td>
                    <td className="px-1 py-1 text-xs text-gray-900">{formatDate(order.date)}</td>
                    <td className="px-1 py-1 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        {/* Add Payment Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOrder(order);
                            setShowPaymentModal(true);
                          }}
                          className="bg-blue-600 text-white px-1 py-0.5 rounded text-xs hover:bg-blue-700 transition-colors"
                          title="Add Payment"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        
                        {/* Cash Out Button */}
                        {isOrderEligibleForCashOut(order) ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCashOut(order.id);
                            }}
                            className="bg-green-600 text-white px-1 py-0.5 rounded text-xs hover:bg-green-700 transition-colors"
                            title="Cash Out"
                          >
                            Cash Out
                          </button>
                        ) : order.accounting_cashed ? (
                          <span className="text-green-600 text-xs font-medium">✓ Cashed Out</span>
                        ) : (
                          <span className="text-gray-400 text-xs">
                            {order.status !== 'delivered' ? 'Not Delivered' : 'Not Paid'}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedOrders.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sticky bottom-0 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-sm font-medium text-blue-900">
                  {selectedOrders.size} order{selectedOrders.size !== 1 ? 's' : ''} selected
                </span>
                <button
                  onClick={() => setSelectedOrders(new Set())}
                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                >
                  Clear Selection
                </button>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowBulkCashOutModal(true)}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center space-x-2"
                >
                  <DollarSign className="w-4 h-4" />
                  <span>Cash Out Selected ({selectedOrders.size})</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Summary Footer */}
        <div className="bg-white border border-gray-200 rounded-md p-3 sticky bottom-0">
          <div className="grid grid-cols-6 gap-3 text-xs">
            <div className="text-right">
              <div className="text-gray-500 text-xs">Old Balance</div>
              <div className="font-semibold text-sm">
                {formatCurrency(oldBalanceUsd)} / {formatCurrency(oldBalanceLbp, 'LBP')}
              </div>
            </div>
            <div className="text-right">
              <div className="text-gray-500 text-xs">Orders Sum</div>
              <div className="font-semibold text-sm">
                {formatCurrency(totalOrdersUsd)} / {formatCurrency(totalOrdersLbp, 'LBP')}
              </div>
            </div>
            <div className="text-right">
              <div className="text-gray-500 text-xs">Fees</div>
              <div className="font-semibold text-sm">
                {formatCurrency(totalDeliveryFeesUsd)} / {formatCurrency(totalDeliveryFeesLbp, 'LBP')}
              </div>
            </div>
            <div className="text-right">
              <div className="text-gray-500 text-xs">Total Fees</div>
              <div className="font-semibold text-sm text-blue-600">
                {formatCurrency(totalFeesUsd)} / {formatCurrency(totalFeesLbp, 'LBP')}
              </div>
            </div>
            <div className="text-right">
              <div className="text-gray-500 text-xs">Payments</div>
              <div className="font-semibold text-sm">
                {formatCurrency(totalPaymentsUsd)} / {formatCurrency(totalPaymentsLbp, 'LBP')}
              </div>
            </div>
            <div className="text-right">
              <div className="text-gray-500 text-xs">New Balance</div>
              <div className={`font-bold text-base ${newBalanceUsd >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(newBalanceUsd)} / {formatCurrency(newBalanceLbp, 'LBP')}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render driver detail view
  const renderDriverDetailView = () => {
    if (!selectedDriver) return null;

    const totalOrdersUsd = driverOrders.reduce((sum, order) => sum + (Number(order.total_usd) || 0), 0);
    const totalOrdersLbp = driverOrders.reduce((sum, order) => sum + (Number(order.total_lbp) || 0), 0);
    const totalFeesUsd = driverOrders.reduce((sum, order) => sum + (Number(order.fee_usd) || 0), 0);
    const totalFeesLbp = driverOrders.reduce((sum, order) => sum + (Number(order.fee_lbp) || 0), 0);
    const totalPaymentsUsd = driverOrders.reduce((sum, order) => sum + (Number(order.payments_usd) || 0), 0);
    const totalPaymentsLbp = driverOrders.reduce((sum, order) => sum + (Number(order.payments_lbp) || 0), 0);
    const oldBalanceUsd = selectedDriver.oldBalanceUsd || 0;
    const oldBalanceLbp = selectedDriver.oldBalanceLbp || 0;
    const totalUsd = totalOrdersUsd + totalFeesUsd;
    const totalLbp = totalOrdersLbp + totalFeesLbp;

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <button
                onClick={handleBackToSummary}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <h2 className="text-xl font-semibold text-gray-900">
                {selectedDriver.driverName || selectedDriver.driver_name} - Orders
              </h2>
            </div>
          </div>
        </div>

        {/* Filters for Driver Orders */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
          <div className="flex items-center space-x-2 mb-3">
            <Filter className="w-4 h-4 text-gray-500" />
            <h3 className="text-sm font-medium text-gray-700">Filter Orders</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">From Date</label>
              <input
                type="date"
                value={filters.fromDate}
                onChange={(e) => setFilters({...filters, fromDate: e.target.value})}
                className="w-full px-1 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">To Date</label>
              <input
                type="date"
                value={filters.toDate}
                onChange={(e) => setFilters({...filters, toDate: e.target.value})}
                className="w-full px-1 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Payment Status</label>
              <select
                value={filters.paymentStatus}
                onChange={(e) => setFilters({...filters, paymentStatus: e.target.value})}
                className="w-full px-1 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">All Status</option>
                <option value="Paid">Paid</option>
                <option value="Unpaid">Unpaid</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  const driverId = selectedDriver.driverId || selectedDriver.driver_id;
                  if (driverId && driverId !== 'undefined' && driverId !== 'null') {
                    fetchDriverOrders(driverId);
                  } else {
                    toast.error('Invalid driver ID. Cannot fetch orders.');
                  }
                }}
                className="w-full bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 flex items-center justify-center space-x-1 text-sm"
              >
                <Filter className="w-4 h-4" />
                <span>Apply</span>
              </button>
            </div>
          </div>
        </div>

        {/* Orders List */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-1 py-1 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={driverOrders.length > 0 && selectedOrders.size === driverOrders.filter(isOrderEligibleForCashOut).length}
                    onChange={() => handleSelectAll(driverOrders)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-1 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</th>
                <th className="px-1 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-1 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer Phone</th>
                <th className="px-1 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer Location</th>
                <th className="px-1 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Order Price USD</th>
                <th className="px-1 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Order Price LBP</th>
                <th className="px-1 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Fee USD</th>
                <th className="px-1 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Fee LBP</th>
                <th className="px-1 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Status</th>
                <th className="px-1 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-1 py-1 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {driverOrders.map((order, index) => (
                <tr key={index} className={`hover:bg-gray-50 ${selectedOrders.has(order.id) ? 'bg-blue-50' : ''}`}>
                  <td className="px-1 py-1 text-center">
                    <input
                      type="checkbox"
                      checked={selectedOrders.has(order.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleOrderSelect(order.id, e.target.checked);
                      }}
                      disabled={!isOrderEligibleForCashOut(order)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                    />
                  </td>
                  <td className="px-1 py-1 text-xs font-medium text-gray-900">{order.reference}</td>
                  <td className="px-1 py-1 text-xs text-gray-900">{order.customer_name || 'N/A'}</td>
                  <td className="px-1 py-1 text-xs text-gray-900">{order.customer_phone || 'N/A'}</td>
                  <td className="px-1 py-1 text-xs text-gray-900">{order.customer_location}</td>
                  <td className="px-1 py-1 text-xs text-gray-900 text-right">{formatCurrency(order.total_usd)}</td>
                  <td className="px-1 py-1 text-xs text-gray-900 text-right">{formatCurrency(order.total_lbp, 'LBP')}</td>
                  <td className="px-1 py-1 text-xs text-gray-900 text-right">{formatCurrency(order.fee_usd || 0)}</td>
                  <td className="px-1 py-1 text-xs text-gray-900 text-right">{formatCurrency(order.fee_lbp || 0, 'LBP')}</td>
                  <td className="px-1 py-1 text-xs">
                    <span className={`font-medium ${order.payment_status === 'Paid' ? 'text-green-600' : 'text-red-600'}`}>
                      {order.payment_status}
                    </span>
                  </td>
                  <td className="px-1 py-1 text-xs text-gray-900">{formatDate(order.date)}</td>
                  <td className="px-1 py-1 text-center">
                    <div className="flex items-center justify-center space-x-1">
                      {/* Add Payment Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOrder(order);
                          setShowPaymentModal(true);
                        }}
                        className="bg-blue-600 text-white px-1 py-0.5 rounded text-xs hover:bg-blue-700 transition-colors"
                        title="Add Payment"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      
                      {/* Cash Out Button */}
                      {isOrderEligibleForCashOut(order) ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCashOut(order.id);
                          }}
                          className="bg-green-600 text-white px-1 py-0.5 rounded text-xs hover:bg-green-700 transition-colors"
                          title="Cash Out"
                        >
                          Cash Out
                        </button>
                      ) : order.accounting_cashed ? (
                        <span className="text-green-600 text-xs font-medium">✓ Cashed Out</span>
                      ) : (
                        <span className="text-gray-400 text-xs">
                          {order.status !== 'delivered' ? 'Not Delivered' : 'Not Paid'}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedOrders.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sticky bottom-0 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-sm font-medium text-blue-900">
                  {selectedOrders.size} order{selectedOrders.size !== 1 ? 's' : ''} selected
                </span>
                <button
                  onClick={() => setSelectedOrders(new Set())}
                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                >
                  Clear Selection
                </button>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowBulkCashOutModal(true)}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center space-x-2"
                >
                  <DollarSign className="w-4 h-4" />
                  <span>Cash Out Selected ({selectedOrders.size})</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Summary Footer */}
        <div className="bg-white border border-gray-200 rounded-md p-3 sticky bottom-0">
          <div className="grid grid-cols-5 gap-3 text-xs">
            <div className="text-right">
              <div className="text-gray-500 text-xs">Old Balance</div>
              <div className="font-semibold text-sm">
                {formatCurrency(oldBalanceUsd)} / {formatCurrency(oldBalanceLbp, 'LBP')}
              </div>
            </div>
            <div className="text-right">
              <div className="text-gray-500 text-xs">Orders Sum</div>
              <div className="font-semibold text-sm">
                {formatCurrency(totalOrdersUsd)} / {formatCurrency(totalOrdersLbp, 'LBP')}
              </div>
            </div>
            <div className="text-right">
              <div className="text-gray-500 text-xs">Delivery Fees</div>
              <div className="font-semibold text-sm">
                {formatCurrency(totalFeesUsd)} / {formatCurrency(totalFeesLbp, 'LBP')}
              </div>
            </div>
            <div className="text-right">
              <div className="text-gray-500 text-xs">Payments</div>
              <div className="font-semibold text-sm">
                {formatCurrency(totalPaymentsUsd)} / {formatCurrency(totalPaymentsLbp, 'LBP')}
              </div>
            </div>
            <div className="text-right">
              <div className="text-gray-500 text-xs">Total</div>
              <div className="font-bold text-base text-blue-600">
                {formatCurrency(totalUsd)} / {formatCurrency(totalLbp, 'LBP')}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render third party detail view
  const renderThirdPartyDetailView = () => {
    if (!selectedThirdParty) return null;

    const totalOrdersUsd = thirdPartyOrders.reduce((sum, order) => sum + (Number(order.order_price_usd) || 0), 0);
    const totalOrdersLbp = thirdPartyOrders.reduce((sum, order) => sum + (Number(order.order_price_lbp) || 0), 0);
    const totalDeliveryFeesUsd = thirdPartyOrders.reduce((sum, order) => sum + (Number(order.delivery_fee_usd) || 0), 0);
    const totalDeliveryFeesLbp = thirdPartyOrders.reduce((sum, order) => sum + (Number(order.delivery_fee_lbp) || 0), 0);
    const totalThirdPartyFeesUsd = thirdPartyOrders.reduce((sum, order) => sum + (Number(order.third_party_fee_usd) || 0), 0);
    const totalThirdPartyFeesLbp = thirdPartyOrders.reduce((sum, order) => sum + (Number(order.third_party_fee_lbp) || 0), 0);
    const totalDriverFeesUsd = thirdPartyOrders.reduce((sum, order) => sum + (Number(order.driver_fee_usd) || 0), 0);
    const totalDriverFeesLbp = thirdPartyOrders.reduce((sum, order) => sum + (Number(order.driver_fee_lbp) || 0), 0);

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <button
                onClick={handleBackToSummary}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <h2 className="text-xl font-semibold text-gray-900">
                {selectedThirdParty.thirdPartyName || selectedThirdParty.third_party_name} - Orders
              </h2>
            </div>
          </div>
        </div>

        {/* Filters for Third Party Orders */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
          <div className="flex items-center space-x-2 mb-3">
            <Filter className="w-4 h-4 text-gray-500" />
            <h3 className="text-sm font-medium text-gray-700">Filter Orders</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">From Date</label>
              <input
                type="date"
                value={filters.fromDate}
                onChange={(e) => setFilters({...filters, fromDate: e.target.value})}
                className="w-full px-1 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">To Date</label>
              <input
                type="date"
                value={filters.toDate}
                onChange={(e) => setFilters({...filters, toDate: e.target.value})}
                className="w-full px-1 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Payment Status</label>
              <select
                value={filters.paymentStatus}
                onChange={(e) => setFilters({...filters, paymentStatus: e.target.value})}
                className="w-full px-1 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">All Status</option>
                <option value="Paid">Paid</option>
                <option value="Unpaid">Unpaid</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => fetchThirdPartyOrders(selectedThirdParty.thirdPartyName || selectedThirdParty.third_party_name)}
                className="w-full bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 flex items-center justify-center space-x-1 text-sm"
              >
                <Filter className="w-4 h-4" />
                <span>Apply</span>
              </button>
            </div>
          </div>
        </div>

        {/* Orders List */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-1 py-1 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={thirdPartyOrders.length > 0 && selectedOrders.size === thirdPartyOrders.filter(isOrderEligibleForCashOut).length}
                    onChange={() => handleSelectAll(thirdPartyOrders)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-1 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</th>
                <th className="px-1 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer Name</th>
                <th className="px-1 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer Location</th>
                <th className="px-1 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Order Price USD</th>
                <th className="px-1 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Order Price LBP</th>
                <th className="px-1 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Third Party Fee USD</th>
                <th className="px-1 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Third Party Fee LBP</th>
                <th className="px-1 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Status</th>
                <th className="px-1 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-1 py-1 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {thirdPartyOrders.map((order, index) => (
                <tr key={index} className={`hover:bg-gray-50 ${selectedOrders.has(order.id) ? 'bg-blue-50' : ''}`}>
                  <td className="px-1 py-1 text-center">
                    <input
                      type="checkbox"
                      checked={selectedOrders.has(order.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleOrderSelect(order.id, e.target.checked);
                      }}
                      disabled={!isOrderEligibleForCashOut(order)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                    />
                  </td>
                  <td className="px-1 py-1 text-xs font-medium text-gray-900">{order.reference}</td>
                  <td className="px-1 py-1 text-xs text-gray-900">{order.customer_name || 'N/A'}</td>
                  <td className="px-1 py-1 text-xs text-gray-900">{order.customer_location || 'N/A'}</td>
                  <td className="px-1 py-1 text-xs text-gray-900 text-right">{formatCurrency(order.order_price_usd)}</td>
                  <td className="px-1 py-1 text-xs text-gray-900 text-right">{formatCurrency(order.order_price_lbp, 'LBP')}</td>
                  <td className="px-1 py-1 text-xs text-gray-900 text-right">{formatCurrency(order.third_party_fee_usd)}</td>
                  <td className="px-1 py-1 text-xs text-gray-900 text-right">{formatCurrency(order.third_party_fee_lbp, 'LBP')}</td>
                  <td className="px-1 py-1 text-xs">
                    <span className={`font-medium ${order.payment_status === 'Paid' ? 'text-green-600' : 'text-red-600'}`}>
                      {order.payment_status}
                    </span>
                  </td>
                  <td className="px-1 py-1 text-xs text-gray-900">{formatDate(order.date)}</td>
                  <td className="px-1 py-1 text-center">
                    <div className="flex items-center justify-center space-x-1">
                      {/* Add Payment Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOrder(order);
                          setShowPaymentModal(true);
                        }}
                        className="bg-blue-600 text-white px-1 py-0.5 rounded text-xs hover:bg-blue-700 transition-colors"
                        title="Add Payment"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      
                      {/* Cash Out Button */}
                      {isOrderEligibleForCashOut(order) ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCashOut(order.id);
                          }}
                          className="bg-green-600 text-white px-1 py-0.5 rounded text-xs hover:bg-green-700 transition-colors"
                          title="Cash Out"
                        >
                          Cash Out
                        </button>
                      ) : order.accounting_cashed ? (
                        <span className="text-green-600 text-xs font-medium">✓ Cashed Out</span>
                      ) : (
                        <span className="text-gray-400 text-xs">
                          {order.status !== 'delivered' ? 'Not Delivered' : 'Not Paid'}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedOrders.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sticky bottom-0 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-sm font-medium text-blue-900">
                  {selectedOrders.size} order{selectedOrders.size !== 1 ? 's' : ''} selected
                </span>
                <button
                  onClick={() => setSelectedOrders(new Set())}
                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                >
                  Clear Selection
                </button>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowBulkCashOutModal(true)}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center space-x-2"
                >
                  <DollarSign className="w-4 h-4" />
                  <span>Cash Out Selected ({selectedOrders.size})</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Summary Footer */}
        <div className="bg-white border border-gray-200 rounded-md p-3 sticky bottom-0">
          <div className="grid grid-cols-6 gap-3 text-xs">
            <div className="text-right">
              <div className="text-gray-500 text-xs">Orders Sum</div>
              <div className="font-semibold text-sm">
                {formatCurrency(totalOrdersUsd)} / {formatCurrency(totalOrdersLbp, 'LBP')}
              </div>
            </div>
            <div className="text-right">
              <div className="text-gray-500 text-xs">Delivery Fees</div>
              <div className="font-semibold text-sm">
                {formatCurrency(totalDeliveryFeesUsd)} / {formatCurrency(totalDeliveryFeesLbp, 'LBP')}
              </div>
            </div>
            <div className="text-right">
              <div className="text-gray-500 text-xs">Third Party Fees</div>
              <div className="font-semibold text-sm">
                {formatCurrency(totalThirdPartyFeesUsd)} / {formatCurrency(totalThirdPartyFeesLbp, 'LBP')}
              </div>
            </div>
            <div className="text-right">
              <div className="text-gray-500 text-xs">Driver Fees</div>
              <div className="font-semibold text-sm">
                {formatCurrency(totalDriverFeesUsd)} / {formatCurrency(totalDriverFeesLbp, 'LBP')}
              </div>
            </div>
            <div className="text-right">
              <div className="text-gray-500 text-xs">Total Orders</div>
              <div className="font-semibold text-sm">{thirdPartyOrders.length}</div>
            </div>
            <div className="text-right">
              <div className="text-gray-500 text-xs">Total Value</div>
              <div className="font-bold text-base text-blue-600">
                {formatCurrency(totalOrdersUsd + totalDeliveryFeesUsd + totalThirdPartyFeesUsd)} / {formatCurrency(totalOrdersLbp + totalDeliveryFeesLbp + totalThirdPartyFeesLbp, 'LBP')}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };


  const columns = getColumns();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Accounting</h1>
              <p className="text-sm text-gray-600">Manage orders, payments, and financial records</p>
            </div>
            <div className="flex items-center space-x-4">
              {/* Sync Status and Controls */}
              <div className="flex items-center space-x-3">
                <SyncStatusBadge 
                  isOnline={isOnline} 
                  isPaused={isPaused} 
                  queueLength={queueLength}
                />
                <SyncControls 
                  onQueueView={() => setShowQueueModal(true)}
                  size="sm"
                  showLabels={false}
                />
              </div>
              
              {/* Action Buttons */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 flex items-center space-x-1 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Payment</span>
                </button>
                <button
                  onClick={() => handleExport('csv')}
                  className="bg-green-600 text-white px-3 py-1.5 rounded-md hover:bg-green-700 flex items-center space-x-1 text-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={() => handleExport('pdf')}
                  className="bg-red-600 text-white px-3 py-1.5 rounded-md hover:bg-red-700 flex items-center space-x-1 text-sm"
                >
                  <Printer className="w-4 h-4" />
                  <span>Export PDF</span>
                </button>
                <button
                  onClick={fetchData}
                  className="bg-gray-600 text-white px-3 py-1.5 rounded-md hover:bg-gray-700 flex items-center space-x-1 text-sm"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Refresh</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="px-4">
          <nav className="flex space-x-6">
            <button
              onClick={() => setActiveTab('clients')}
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'clients'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-1">
                <Users className="w-4 h-4" />
                <span>Clients</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('drivers')}
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'drivers'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-1">
                <Truck className="w-4 h-4" />
                <span>Drivers</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('third-party')}
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'third-party'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-1">
                <Building2 className="w-4 h-4" />
                <span>Third Party</span>
              </div>
            </button>
          </nav>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Total USD */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Total USD</p>
                <p className="text-2xl font-bold text-blue-900">
                  {formatCurrency(summaries.reduce((sum, s) => sum + (s.totalValueUsd || s.ordersSumUsd || 0), 0))}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          {/* Total LBP */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Total LBP</p>
                <p className="text-2xl font-bold text-green-900">
                  {formatCurrency(summaries.reduce((sum, s) => sum + (s.totalValueLbp || s.ordersSumLbp || 0), 0), 'LBP')}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
          </div>

          {/* Total Accounts */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600">Total Accounts</p>
                <p className="text-2xl font-bold text-purple-900">
                  {summaries.length}
                </p>
              </div>
              <Users className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Data Grid */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex flex-col">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
            <div className="flex-1 overflow-x-auto overflow-y-auto">
              <div className="min-w-full">
                {viewMode === 'summary' ? (
                  <>
                    {activeTab === 'clients' && renderClientSummaryRows()}
                    {activeTab === 'drivers' && renderDriverSummaryRows()}
                    {activeTab === 'third-party' && renderThirdPartySummaryRows()}
                  </>
                ) : (
                  <>
                    {activeTab === 'clients' && selectedClient && renderClientDetailView()}
                    {activeTab === 'drivers' && selectedDriver && renderDriverDetailView()}
                    {activeTab === 'third-party' && selectedThirdParty && renderThirdPartyDetailView()}
                  </>
                )}
              </div>
              </div>
            )}
        </div>
      </div>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        order={selectedOrder}
        accountType={activeTab === 'clients' ? 'client' : activeTab === 'drivers' ? 'driver' : 'third_party'}
        onPaymentSuccess={() => {
          fetchData(); // Refresh data after payment
          // Refresh specific order data if in detail view
          if (selectedClient) {
            fetchClientOrders(selectedClient.clientId || selectedClient.client_account_ref);
          }
          if (selectedDriver) {
            const driverId = selectedDriver.driverId || selectedDriver.driver_id;
            if (driverId && driverId !== 'undefined' && driverId !== 'null') {
              fetchDriverOrders(driverId);
            }
          }
          if (selectedThirdParty) {
            fetchThirdPartyOrders(selectedThirdParty.thirdPartyName || selectedThirdParty.third_party_name);
          }
        }}
      />

      {/* Queue Modal */}
      <QueueModal
        isOpen={showQueueModal}
        onClose={() => setShowQueueModal(false)}
      />

      {/* Order Detail Modal */}
      {showOrderDetail && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Order Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Reference</label>
                <p className="text-sm text-gray-900">{selectedOrder.reference}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Order Type</label>
                <p className="text-sm text-gray-900">{selectedOrder.order_type}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Delivery Method</label>
                <p className="text-sm text-gray-900">{selectedOrder.delivery_method}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Payment Status</label>
                <p className="text-sm text-gray-900">{selectedOrder.payment_status}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Total USD</label>
                <p className="text-sm text-gray-900">{formatCurrency(selectedOrder.total_order_value_usd)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Total LBP</label>
                <p className="text-sm text-gray-900">{formatCurrency(selectedOrder.total_order_value_lbp, 'LBP')}</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowOrderDetail(false)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowOrderDetail(false);
                  setShowPaymentModal(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Record Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Cash Out Confirmation Modal */}
      {showBulkCashOutModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-green-100 p-2 rounded-full">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Bulk Cash Out</h3>
                <p className="text-sm text-gray-600">Confirm cash out for selected orders</p>
              </div>
            </div>
            
            <div className="mb-6">
              <p className="text-sm text-gray-700 mb-3">
                You are about to cash out <span className="font-semibold text-blue-600">{selectedOrders.size}</span> order{selectedOrders.size !== 1 ? 's' : ''}.
              </p>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <div className="bg-yellow-100 p-1 rounded-full mt-0.5">
                    <CheckCircle className="w-4 h-4 text-yellow-600" />
                  </div>
                  <div className="text-xs text-yellow-800">
                    <p className="font-medium mb-1">Important:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Only delivered and paid orders will be processed</li>
                      <li>Ecommerce/Instant orders will be moved to order history</li>
                      <li>Prepaid/Go-to-market orders will add money to cash account</li>
                      <li>This action cannot be undone</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowBulkCashOutModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkCashOut}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center space-x-2"
              >
                <DollarSign className="w-4 h-4" />
                <span>Cash Out {selectedOrders.size} Orders</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Accounting;