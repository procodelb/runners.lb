import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  Package, 
  Truck, 
  DollarSign,
  User,
  Phone,
  MapPin,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  X,
  Save,
  Loader2,
  Eye,
  UserCheck,
  CreditCard,
  Table,
  Download,
  Upload,
  CheckSquare,
  Square,
  Map
} from 'lucide-react';
import api from '../api';
import toast from 'react-hot-toast';
import { searchClients, formatClientForAutocomplete } from '../utils/clientSearch';
import { priceListApi } from '../api/priceList';
import { customersApi } from '../api/customers';
import { useDeliveryFeeLookup } from '../hooks/useDeliveryFeeLookup';
import PaymentModal from './PaymentModal';

const OrdersGrid = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('!cancelled');
  const [selectedType, setSelectedType] = useState('');
  const [selectedDeliveryMode, setSelectedDeliveryMode] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [editingRow, setEditingRow] = useState(null);
  const [newRows, setNewRows] = useState([]);
  const [clientSuggestions, setClientSuggestions] = useState([]);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(-1);
  const [activeSuggestionField, setActiveSuggestionField] = useState('client');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  
  // Add New Order Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  
  // Payment Modal states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState(null);
  
  // Enhanced delivery fee lookup hook
  const deliveryFeeLookup = useDeliveryFeeLookup();
  
  const queryClient = useQueryClient();

  // localStorage functions for customer phone and address
  const saveToLocalStorage = (key, value) => {
    if (key === 'customer_phone' || key === 'customer_address') {
      localStorage.setItem(key, value);
    }
  };

  const getFromLocalStorage = (key) => {
    if (key === 'customer_phone' || key === 'customer_address') {
      return localStorage.getItem(key) || '';
    }
    return '';
  };

  const [formData, setFormData] = useState({
    order_ref: '',
    client_name: '',
    client_id: '',
    customer_name: '',
    customer_phone: getFromLocalStorage('customer_phone') || '',
    customer_address: getFromLocalStorage('customer_address') || '',
    driver_id: '',
    type: 'ecommerce',
    deliver_method: 'in_house',
    status: 'new',
    payment_status: 'unpaid',
    notes: '',
    total_usd: '',
    total_lbp: '',
    delivery_fee_usd: '',
    delivery_fee_lbp: '',
    third_party_fee_usd: '',
    third_party_fee_lbp: '',
    driver_fee_usd: '',
    driver_fee_lbp: ''
  });

  // Fetch orders with search and filters
  const { data: orders, isLoading } = useQuery(
    ['orders', searchTerm, selectedStatus, selectedType, selectedDeliveryMode, dateFrom, dateTo],
    () => {
      // Only trigger search when searchTerm has 2+ characters or is empty
      if (searchTerm && searchTerm.length === 1) {
        return Promise.resolve({ data: { data: [] } });
      }
      const url = `/orders?search=${encodeURIComponent(searchTerm)}&status=${encodeURIComponent(selectedStatus)}&type=${selectedType}` + (selectedDeliveryMode ? `&delivery_mode=${selectedDeliveryMode}` : '') + (dateFrom ? `&date_from=${dateFrom}` : '') + (dateTo ? `&date_to=${dateTo}` : '');
      console.log('🔍 Frontend API call:', url);
      console.log('🔍 Selected delivery mode:', selectedDeliveryMode);
      return api.get(url);
    }, 
    {
      keepPreviousData: true,
      select: (response) => {
        console.log('🔍 Frontend API response:', response.data);
        return response.data?.data || [];
      }
    }
  );

  // Fetch drivers for assignment
  const { data: drivers } = useQuery('drivers', () => api.get('/drivers'), {
    select: (response) => response.data?.data || []
  });

  // Fetch clients for auto-fill
  const { data: clients } = useQuery('clients', () => api.get('/clients'), {
    select: (response) => response.data?.data || []
  });

  // Delete existing order
  const deleteOrderMutation = useMutation(
    (id) => api.delete(`/orders/${id}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('orders');
        toast.success('Order deleted successfully!');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to delete order');
      }
    }
  );

  // Update existing order (minimal editable fields)
  const updateOrderMutation = useMutation(
    ({ id, data }) => api.put(`/orders/${id}`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('orders');
        setEditingRow(null);
        toast.success('Order updated');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update order');
      }
    }
  );

  // Batch create orders mutation
  const batchCreateMutation = useMutation(
    (ordersData) => api.post('/orders/batch', { orders: ordersData }),
    {
      onSuccess: (response) => {
        queryClient.invalidateQueries('orders');
        setNewRows([]);
        const created = response.data?.data?.length || response.data?.length || 0;
        toast.success(`Successfully created ${created} orders!`);
        
        // Show errors if any
        if (response.data?.errors && response.data.errors.length > 0) {
          console.warn('Some orders had errors:', response.data.errors);
          toast.error(`${response.data.errors.length} orders had errors. Check console for details.`);
        }
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || error.message || 'Failed to create orders';
        const errors = error.response?.data?.errors;
        
        console.error('Batch create error:', error);
        console.error('Full error response:', error.response?.data);
        
        if (errors && Array.isArray(errors)) {
          console.error('Detailed errors:', errors);
          toast.error(`${errorMessage}. First error: ${errors[0]}`);
        } else {
          toast.error(errorMessage);
        }
      }
    }
  );

  // Batch assign driver mutation
  const batchAssignMutation = useMutation(
    ({ orderIds, driverId }) => api.patch('/orders/batch/assign', { order_ids: orderIds, driver_id: driverId })
  );

  // Bulk update status mutation
  const bulkStatusMutation = useMutation(
    ({ orderIds, status, paymentStatus }) => api.patch('/orders/bulk/status', { orderIds, status, paymentStatus }),
    {
      onSuccess: (response) => {
        queryClient.invalidateQueries('orders');
        setSelectedRows(new Set());
        toast.success(response.data.message || 'Orders updated successfully!');
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.error || error.message || 'Failed to update orders';
        toast.error(errorMessage);
        console.error('Bulk status update error:', error);
      }
    }
  );

  // State for controlling payment status dropdown reset
  const [paymentStatusDropdownKey, setPaymentStatusDropdownKey] = useState(0);

  // Bulk update payment status mutation
  const bulkPaymentStatusMutation = useMutation(
    ({ orderIds, paymentStatus }) => api.patch('/orders/bulk/payment-status', { orderIds, paymentStatus }),
    {
      onSuccess: (response) => {
        // Invalidate and refetch orders to show updated data
        queryClient.invalidateQueries(['orders']);
        queryClient.refetchQueries(['orders']);
        setSelectedRows(new Set());
        // Reset dropdown by changing key
        setPaymentStatusDropdownKey(prev => prev + 1);
        toast.success(response.data?.message || `Payment status updated successfully for ${response.data?.updatedCount || 0} order(s)!`);
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.error || error.message || 'Failed to update payment status';
        toast.error(errorMessage);
        console.error('Bulk payment status update error:', error);
      }
    }
  );

  // Client search mutation (unified /clients endpoint)
  const clientSearchMutation = useMutation(
    (query) => api.get(`/clients/search/${encodeURIComponent(query)}`),
    {
      onSuccess: (response) => {
        setClientSuggestions(response.data.data || []);
        setShowClientSuggestions(true);
      },
      onError: (error) => {
        console.error('Client search error:', error);
        setClientSuggestions([]);
      }
    }
  );

  // Customer search mutation for grid rows
  const customerSearchMutation = useMutation(
    (query) => api.get(`/customers/search/${encodeURIComponent(query)}`),
    {
      onSuccess: (response) => {
        setCustomerSuggestions(response.data.data || []);
        setShowCustomerSuggestions(true);
      },
      onError: (error) => {
        console.error('Customer search error:', error);
        setCustomerSuggestions([]);
      }
    }
  );

  // Add new order mutation
  const addOrderMutation = useMutation(
    (newOrder) => api.post('/orders', newOrder),
    {
      onSuccess: (response) => {
        queryClient.invalidateQueries('orders');
        setShowAddModal(false);
        resetForm();
        toast.success('Order created successfully!');
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || error.message || 'Failed to create order';
        toast.error(errorMessage);
        console.error('Add order error:', error);
      }
    }
  );

  // Update order mutation (for modal editing)
  const updateOrderModalMutation = useMutation(
    ({ id, orderData }) => api.put(`/orders/${id}`, orderData),
    {
      onSuccess: (response) => {
        queryClient.invalidateQueries('orders');
        setEditingOrder(null);
        resetForm();
        toast.success('Order updated successfully!');
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || error.message || 'Failed to update order';
        toast.error(errorMessage);
        console.error('Update order error:', error);
      }
    }
  );

  // Add new row
  const addNewRow = () => {
    const newRow = {
      id: `new-${Date.now()}`,
      client: '',
      client_id: '', // New field for CRM client linking
      phone: '',
      customer: '',
      customer_name: '',
      customer_phone: '',
      customer_address: '',
      address: '',
      google_maps_url: '',
      latitude: '',
      longitude: '',
      total_usd: '',
      total_lbp: '',
      delivery_fee_usd: '',
      delivery_fee_lbp: '',
      order_type: 'instant', // Only instant orders for add row
      delivery_mode: 'direct', // Only direct delivery for add row
      driver_id: '',
      payment_status: 'unpaid',
      order_status: 'new',
      note: '',
      isNew: true
    };
    setNewRows(prev => [...prev, newRow]);
  };

  // Remove new row
  const removeNewRow = (rowId) => {
    setNewRows(prev => prev.filter(row => row.id !== rowId));
  };

  // Update row data
  const updateRowData = (rowId, field, value) => {
    if (rowId.startsWith('new-')) {
      setNewRows(prev => {
        const newRows = [...prev];
        const rowIndex = newRows.findIndex(row => row.id === rowId);
        if (rowIndex !== -1) {
          newRows[rowIndex] = { ...newRows[rowIndex], [field]: value };
        }
        return newRows;
      });
    }
  };

  // Handle client name change with autocomplete
  const handleClientNameChange = (rowId, value) => {
    updateRowData(rowId, 'client', value);
    
    // Clear client_id if user is typing manually (not selecting from suggestions)
    updateRowData(rowId, 'client_id', '');
    
    if (value.length >= 2) {
      clientSearchMutation.mutate(value);
      setSuggestionIndex(rowId);
      setActiveSuggestionField('client');
    } else {
      setShowClientSuggestions(false);
      setClientSuggestions([]);
    }
  };

  // Handle phone change with autocomplete
  const handlePhoneChange = (rowId, value) => {
    updateRowData(rowId, 'phone', value);
    // Save to localStorage for customer phone
    saveToLocalStorage('customer_phone', value);
    
    if (value.length >= 2) {
      customerSearchMutation.mutate(value);
      setSuggestionIndex(rowId);
      setActiveSuggestionField('phone');
    } else {
      setShowCustomerSuggestions(false);
    }
  };

  // Handle address change with autocomplete
  const handleAddressChange = async (rowId, value) => {
    updateRowData(rowId, 'address', value);
    // Save to localStorage for customer address
    saveToLocalStorage('customer_address', value);
    
    if (value.length >= 2) {
      // Search both customers and price list for address suggestions
      customerSearchMutation.mutate(value);
      
      // Also search price list for delivery fee autofill
      try {
        const response = await api.get(`/price-list/search?q=${encodeURIComponent(value)}`);
        const priceListResults = response.data?.data || [];
        
        // If we find a matching address in price list, auto-fill delivery fees
        if (priceListResults.length > 0) {
          const match = priceListResults[0];
          updateRowData(rowId, 'delivery_fee_usd', String(match.fee_usd || 0));
          updateRowData(rowId, 'delivery_fee_lbp', String(match.fee_lbp || 0));
        }
      } catch (error) {
        console.error('Error searching price list:', error);
      }
      
      setSuggestionIndex(rowId);
      setActiveSuggestionField('address');
    } else {
      setShowCustomerSuggestions(false);
    }
  };

  // Enhanced customer phone change with autocomplete and auto-fill
  const handleCustomerPhoneChange = async (value) => {
    setFormData(prev => ({ ...prev, customer_phone: value }));
    
    // Clear previous suggestions
    setCustomerSuggestions([]);
    setShowCustomerSuggestions(false);
    
    if (value && value.length >= 2) {
      setIsSearchingCustomer(true);
      try {
        console.log('🔍 Searching customers for phone:', value);
        const response = await customersApi.search(value);
        console.log('📦 Customer search response:', response);
        
        if (response.success && response.data) {
          setCustomerSuggestions(response.data);
          setShowCustomerSuggestions(true);
        } else {
          setCustomerSuggestions([]);
          setShowCustomerSuggestions(false);
        }
      } catch (error) {
        console.error('❌ Error searching customers:', error);
        setCustomerSuggestions([]);
        setShowCustomerSuggestions(false);
      } finally {
        setIsSearchingCustomer(false);
      }
    }
  };

  // Handle customer name change
  const handleCustomerNameChange = (value) => {
    setFormData(prev => ({ ...prev, customer_name: value }));
  };

  // Enhanced customer address change with delivery fee lookup
  const handleCustomerAddressChange = (value) => {
    setFormData(prev => ({ ...prev, customer_address: value }));
    
    // Auto-fill delivery fees based on address
    if (value && value.length >= 3) {
      deliveryFeeLookup.updateDeliveryFees(value, formData.deliver_method, setFormData);
    }
  };

  // Enhanced select customer from suggestions with delivery fee lookup
  const selectCustomer = async (customer) => {
    console.log('👤 Selecting customer:', customer);
    setFormData(prev => ({
      ...prev,
      customer_phone: customer.phone,
      customer_name: customer.name,
      customer_address: customer.address || ''
    }));
    
    // Clear suggestions
    setCustomerSuggestions([]);
    setShowCustomerSuggestions(false);
    
    // Auto-fill delivery fees if address is available
    if (customer.address) {
      console.log('📍 Auto-filling delivery fees for address:', customer.address);
      deliveryFeeLookup.updateDeliveryFees(customer.address, formData.deliver_method, setFormData);
    }
  };

  // Enhanced get or create customer when phone is entered
  const handleCustomerPhoneBlur = async () => {
    const phone = formData.customer_phone;
    if (phone && phone.length >= 2) {
      try {
        console.log('🔍 Getting or creating customer for phone:', phone);
        const response = await customersApi.getOrCreate({
          phone: phone,
          name: formData.customer_name || '',
          address: formData.customer_address || ''
        });
        
        console.log('📦 Get or create response:', response);
        
        if (response.success && response.data) {
          const customer = response.data;
          console.log('👤 Customer data:', customer);
          
          setFormData(prev => ({
            ...prev,
            customer_name: customer.name,
            customer_address: customer.address || ''
          }));
          
          // Auto-fill delivery fees if address is available
          if (customer.address) {
            console.log('📍 Auto-filling delivery fees for address:', customer.address);
            deliveryFeeLookup.updateDeliveryFees(customer.address, formData.deliver_method, setFormData);
          }
        }
      } catch (error) {
        console.error('❌ Error getting/creating customer:', error);
      }
    }
  };

  // Enhanced customer phone change for new rows
  const handleRowCustomerPhoneChange = async (rowId, value) => {
    updateRowData(rowId, 'customer_phone', value);
    
    // Clear previous suggestions
    setCustomerSuggestions([]);
    setShowCustomerSuggestions(false);
    
    if (value && value.length >= 2) {
      setIsSearchingCustomer(true);
      try {
        console.log('🔍 Searching customers for row phone:', value);
        const response = await customersApi.search(value);
        console.log('📦 Row customer search response:', response);
        
        if (response.success && response.data) {
          setCustomerSuggestions(response.data);
          setShowCustomerSuggestions(true);
          setSuggestionIndex(rowId);
          setActiveSuggestionField('customer_phone');
        } else {
          setCustomerSuggestions([]);
          setShowCustomerSuggestions(false);
        }
      } catch (error) {
        console.error('❌ Error searching customers for row:', error);
        setCustomerSuggestions([]);
        setShowCustomerSuggestions(false);
      } finally {
        setIsSearchingCustomer(false);
      }
    }
  };

  // Handle customer name change for new rows
  const handleRowCustomerNameChange = (rowId, value) => {
    updateRowData(rowId, 'customer_name', value);
  };

  // Enhanced customer address change for new rows with delivery fee lookup
  const handleRowCustomerAddressChange = (rowId, value) => {
    updateRowData(rowId, 'customer_address', value);
    
    // Auto-fill delivery fees based on address
    if (value && value.length >= 3) {
      const row = newRows.find(r => r.id === rowId);
      if (row) {
        const feeData = deliveryFeeLookup.getDeliveryFee(value);
        if (feeData) {
          updateRowData(rowId, 'delivery_fee_usd', String(feeData.delivery_fee_usd));
          updateRowData(rowId, 'delivery_fee_lbp', String(feeData.delivery_fee_lbp));
        }
      }
    }
  };

  // Enhanced select customer for new rows with delivery fee lookup
  const selectRowCustomer = async (rowId, customer) => {
    console.log('👤 Selecting customer for row:', rowId, customer);
    updateRowData(rowId, 'customer_phone', customer.phone);
    updateRowData(rowId, 'customer_name', customer.name);
    updateRowData(rowId, 'customer_address', customer.address || '');
    
    // Clear suggestions
    setCustomerSuggestions([]);
    setShowCustomerSuggestions(false);
    
    // Auto-fill delivery fees if address is available
    if (customer.address) {
      console.log('📍 Auto-filling delivery fees for row address:', customer.address);
      const feeData = deliveryFeeLookup.getDeliveryFee(customer.address);
      if (feeData) {
        updateRowData(rowId, 'delivery_fee_usd', String(feeData.delivery_fee_usd));
        updateRowData(rowId, 'delivery_fee_lbp', String(feeData.delivery_fee_lbp));
      }
    }
  };

  // Enhanced get or create customer for new rows when phone is entered
  const handleRowCustomerPhoneBlur = async (rowId) => {
    const row = newRows.find(r => r.id === rowId);
    if (row && row.customer_phone && row.customer_phone.length >= 2) {
      try {
        console.log('🔍 Getting or creating customer for row phone:', row.customer_phone);
        const response = await customersApi.getOrCreate({
          phone: row.customer_phone,
          name: row.customer_name || '',
          address: row.customer_address || ''
        });
        
        console.log('📦 Row get or create response:', response);
        
        if (response.success && response.data) {
          const customer = response.data;
          console.log('👤 Row customer data:', customer);
          
          updateRowData(rowId, 'customer_name', customer.name);
          updateRowData(rowId, 'customer_address', customer.address || '');
          
          // Auto-fill delivery fees if address is available
          if (customer.address) {
            console.log('📍 Auto-filling delivery fees for row address:', customer.address);
            const feeData = deliveryFeeLookup.getDeliveryFee(customer.address);
            if (feeData) {
              updateRowData(rowId, 'delivery_fee_usd', String(feeData.delivery_fee_usd));
              updateRowData(rowId, 'delivery_fee_lbp', String(feeData.delivery_fee_lbp));
            }
          }
        }
      } catch (error) {
        console.error('❌ Error getting/creating customer for row:', error);
      }
    }
  };

  // Select client from suggestions
  const selectClient = (rowId, client) => {
    // For display: BUSINESS type shows business_name, INDIVIDUAL type shows business_name (which contains the client name)
    const displayName = client.business_name || '';
    updateRowData(rowId, 'client', displayName);
    updateRowData(rowId, 'client_id', client.id); // Set client_id for CRM linking
    updateRowData(rowId, 'phone', client.phone || '');
    updateRowData(rowId, 'address', client.address || client.location || '');
    
    // Try to auto-fill delivery fees from price list based on address
    if (client.address) {
      // This could be enhanced to lookup delivery fees from price list
      // For now, just set basic values if available
      if (client.default_delivery_fee_usd) updateRowData(rowId, 'delivery_fee_usd', String(client.default_delivery_fee_usd));
      if (client.default_delivery_fee_lbp) updateRowData(rowId, 'delivery_fee_lbp', String(client.default_delivery_fee_lbp));
    }
    
    // Autofill google map link/coordinates if available
    if (client.google_location) {
      const loc = String(client.google_location);
      if (/^https?:\/\//i.test(loc)) {
        updateRowData(rowId, 'google_maps_url', loc);
        const coords = parseGoogleMapsUrl(loc);
        if (coords) {
          updateRowData(rowId, 'latitude', coords.latitude.toString());
          updateRowData(rowId, 'longitude', coords.longitude.toString());
        }
      } else if (/^-?\d+\.\d+\s*,\s*-?\d+\.\d+$/.test(loc)) {
        const [lat, lng] = loc.split(',').map(s => s.trim());
        updateRowData(rowId, 'latitude', lat);
        updateRowData(rowId, 'longitude', lng);
      }
    }
    setShowClientSuggestions(false);
    setClientSuggestions([]);
  };


  // Toggle row selection
  const toggleRowSelection = (rowId) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(rowId)) {
      newSelected.delete(rowId);
    } else {
      newSelected.add(rowId);
    }
    setSelectedRows(newSelected);
  };

  // Select all rows
  const selectAllRows = () => {
    const allRowIds = [...(orders || []).map(order => order.id), ...newRows.map(row => row.id)];
    setSelectedRows(new Set(allRowIds));
  };

  // Deselect all rows
  const deselectAllRows = () => {
    setSelectedRows(new Set());
  };

  // Submit new rows
  const submitNewRows = () => {
    const targetRows = newRows.filter(r => selectedRows.has(r.id));
    const rowsToSubmit = targetRows.length > 0 ? targetRows : newRows;
    
    console.log('🔍 Debug - All rows to submit:', rowsToSubmit);
    console.log('🔍 Debug - Row data details:', rowsToSubmit.map(row => ({
      id: row.id,
      customer_name: row.customer_name,
      customer: row.customer,
      customer_phone: row.customer_phone,
      hasCustomerName: !!(row.customer_name && row.customer_name.trim().length > 0),
      hasCustomer: !!(row.customer && row.customer.trim().length > 0)
    })));
    
    // More flexible validation - check both customer_name and customer fields
    const validRows = rowsToSubmit.filter(row => {
      const hasCustomerName = row.customer_name && row.customer_name.trim().length > 0;
      const hasCustomer = row.customer && row.customer.trim().length > 0;
      return hasCustomerName || hasCustomer;
    });

    console.log('🔍 Debug - Valid rows after filtering:', validRows.length);

    if (validRows.length === 0) {
      toast.error('Please fill in at least customer name for new orders');
      return;
    }

    console.log('Submitting rows:', validRows);
    console.log('Mapped data will be:', validRows.map(row => ({
      brand_name: row.client || '', 
      client_id: row.client_id || null, 
      customer_name: row.customer_name || '',
      customer_phone: row.customer_phone || '',
      customer_address: row.customer_address || '',
      total_usd: parseFloat(row.total_usd) || 0,
      total_lbp: parseInt(row.total_lbp) || 0,
      delivery_fee_usd: parseFloat(row.delivery_fee_usd) || 0,
      delivery_fee_lbp: parseInt(row.delivery_fee_lbp) || 0,
      type: row.order_type || 'instant',
      deliver_method: row.delivery_mode === 'third_party' ? 'third_party' : 'in_house',
      delivery_mode: row.delivery_mode || 'direct',
      driver_id: row.driver_id ? parseInt(row.driver_id) : null,
      payment_status: row.payment_status || 'unpaid',
      status: row.order_status || 'new',
      notes: row.note || ''
    })));

    const toNumber = (v, int = false) => {
      const s = String(v ?? '').replace(/,/g, '').trim();
      const n = Number(s);
      if (!Number.isFinite(n)) return 0;
      return int ? Math.round(n) : Math.round(n * 100) / 100;
    };

    const ordersData = validRows.map(row => ({
      brand_name: row.client || '', // Client name for display
      client_id: row.client_id || null, // CRM client ID for linking
      customer_name: row.customer_name || '',
      customer_phone: row.customer_phone || '',
      customer_address: row.customer_address || '',
      latitude: row.latitude ? parseFloat(row.latitude) : null,
      longitude: row.longitude ? parseFloat(row.longitude) : null,
      total_usd: toNumber(row.total_usd, false),
      total_lbp: toNumber(row.total_lbp, true),
      delivery_fee_usd: toNumber(row.delivery_fee_usd, false),
      delivery_fee_lbp: toNumber(row.delivery_fee_lbp, true),
      type: row.order_type || 'instant',
      deliver_method: row.delivery_mode === 'third_party' ? 'third_party' : 'in_house',
      delivery_mode: row.delivery_mode || 'direct',
      driver_id: row.driver_id ? parseInt(row.driver_id) : null,
      payment_status: row.payment_status || 'unpaid',
      status: row.order_status || 'new',
      notes: row.note || '',
      instant: row.order_type === 'instant' ? true : false
    }));

    batchCreateMutation.mutate(ordersData);
  };

  // Batch assign driver
  const batchAssignDriver = (driverId) => {
    if (selectedRows.size === 0) {
      toast.error('Please select orders to assign driver');
      return;
    }

    const orderIds = Array.from(selectedRows).filter(id => !String(id).startsWith('new-'));
    
    if (orderIds.length === 0) {
      toast.error('Please select existing orders to assign driver');
      return;
    }

    // Find driver name for the success message
    const selectedDriver = drivers?.find(d => d.id === parseInt(driverId));
    const driverName = selectedDriver?.full_name || 'driver';

    batchAssignMutation.mutate(
      { orderIds, driverId: parseInt(driverId) },
      {
        onSuccess: (response) => {
          queryClient.invalidateQueries('orders');
          setSelectedRows(new Set());
          setSelectedDriverId(''); // Reset the dropdown
          const updatedCount = response.data?.data?.length || response.data?.length || orderIds.length;
          toast.success(`Successfully assigned ${driverName} to ${updatedCount} orders!`);
        },
        onError: (error) => {
          const errorMessage = error.response?.data?.message || error.message || 'Failed to assign driver';
          toast.error(errorMessage);
          console.error('Batch assign error:', error);
        }
      }
    );
  };

  // Bulk update order status
  const bulkUpdateStatus = (status) => {
    if (selectedRows.size === 0) {
      toast.error('Please select orders to update status');
      return;
    }

    const orderIds = Array.from(selectedRows).filter(id => !String(id).startsWith('new-'));
    
    if (orderIds.length === 0) {
      toast.error('Please select existing orders to update status');
      return;
    }

    bulkStatusMutation.mutate({ orderIds, status });
  };

  // Bulk update payment status
  const bulkUpdatePaymentStatus = (paymentStatus) => {
    if (selectedRows.size === 0) {
      toast.error('Please select orders to update payment status');
      return;
    }

    const orderIds = Array.from(selectedRows).filter(id => !String(id).startsWith('new-'));
    
    if (orderIds.length === 0) {
      toast.error('Please select existing orders to update payment status');
      return;
    }

    bulkPaymentStatusMutation.mutate({ 
      orderIds, 
      paymentStatus 
    });
  };

  // Parse Google Maps URL for coordinates
  const parseGoogleMapsUrl = (url) => {
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname.includes('google.com') && urlObj.pathname.includes('/maps')) {
        // Try different patterns for Google Maps URLs
        const patterns = [
          /@(-?\d+\.\d+),(-?\d+\.\d+)/,  // @lat,lng
          /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,  // !3dlat!4dlng
          /ll=(-?\d+\.\d+),(-?\d+\.\d+)/,  // ll=lat,lng
          /center=(-?\d+\.\d+)%2C(-?\d+\.\d+)/,  // center=lat%2Clng
        ];
        
        for (const pattern of patterns) {
          const match = url.match(pattern);
          if (match) {
            return {
              latitude: parseFloat(match[1]),
              longitude: parseFloat(match[2])
            };
          }
        }
      }
    } catch (error) {
      console.error('Error parsing Google Maps URL:', error);
    }
    return null;
  };

  // Handle Google Maps URL input
  const handleGoogleMapsUrlChange = (rowId, url) => {
    updateRowData(rowId, 'google_maps_url', url);
    
    if (url) {
      const coords = parseGoogleMapsUrl(url);
      if (coords) {
        updateRowData(rowId, 'latitude', coords.latitude.toString());
        updateRowData(rowId, 'longitude', coords.longitude.toString());
        toast.success('Coordinates extracted from Google Maps URL!');
      } else {
        toast.error('Could not extract coordinates from URL. Please check the format.');
      }
    } else {
      updateRowData(rowId, 'latitude', '');
      updateRowData(rowId, 'longitude', '');
    }
  };

  // Generate Google Maps link
  const generateGoogleMapsLink = (latitude, longitude) => {
    if (latitude && longitude) {
      return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    }
    return null;
  };

  // Reset form for modal
  const resetForm = () => {
    setFormData({
      order_ref: '',
      client_name: '',
      client_id: '',
      customer_name: '',
      customer_phone: getFromLocalStorage('customer_phone') || '',
      customer_address: getFromLocalStorage('customer_address') || '',
      driver_id: '',
      type: 'ecommerce',
      deliver_method: 'in_house',
      status: 'new',
      payment_status: 'unpaid',
      notes: '',
      total_usd: '',
      total_lbp: '',
      delivery_fee_usd: '',
      delivery_fee_lbp: '',
      third_party_fee_usd: '',
      third_party_fee_lbp: '',
      driver_fee_usd: '',
      driver_fee_lbp: ''
    });
    setSelectedClient(null);
    setSelectedAddress(null);
    setClientSuggestions([]);
    setAddressSuggestions([]);
    setCustomerSuggestions([]);
    setShowClientSuggestions(false);
    setShowAddressSuggestions(false);
    setShowCustomerSuggestions(false);
  };

  // Client search autocomplete - search CRM by business name or client name
  const handleClientSearch = async (query) => {
    if (query.length < 2) {
      setClientSuggestions([]);
      setShowClientSuggestions(false);
      return;
    }

    try {
      // Search clients by business name or client name from CRM
      const response = await api.get(`/clients/search/${encodeURIComponent(query)}`);
      const results = response.data?.data || [];
      
      // Format results for autocomplete display
      const formattedResults = results.map(client => ({
        id: client.id,
        business_name: client.business_name,
        client_name: client.client_name,
        contact_person: client.contact_person,
        phone: client.phone,
        address: client.address,
        category: client.category,
        client_type: client.client_type,
        google_location: client.google_location,
        default_delivery_fee_usd: client.default_delivery_fee_usd,
        default_delivery_fee_lbp: client.default_delivery_fee_lbp
      }));
      
      setClientSuggestions(formattedResults);
      setShowClientSuggestions(true);
    } catch (error) {
      console.error('Error searching clients:', error);
      setClientSuggestions([]);
      setShowClientSuggestions(false);
    }
  };

  // Address search autocomplete
  const handleAddressSearch = async (query) => {
    if (query.length < 2) {
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
      return;
    }

    try {
      const response = await priceListApi.searchPriceList(query);
      setAddressSuggestions(response.data || []);
      setShowAddressSuggestions(true);
    } catch (error) {
      console.error('Error searching addresses:', error);
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
    }
  };

  // Customer search autocomplete - search customers by phone or address
  const handleCustomerSearch = async (query, field) => {
    if (query.length < 2) {
      setCustomerSuggestions([]);
      setShowCustomerSuggestions(false);
      return;
    }

    try {
      // Search customers by phone or address
      const response = await api.get(`/customers/search/${encodeURIComponent(query)}`);
      const results = response.data?.data || [];
      
      setCustomerSuggestions(results);
      setShowCustomerSuggestions(true);
    } catch (error) {
      console.error('Error searching customers:', error);
      setCustomerSuggestions([]);
      setShowCustomerSuggestions(false);
    }
  };

  // Handle customer selection
  const handleCustomerSelect = (customer) => {
    setFormData(prev => ({
      ...prev,
      customer_name: customer.name,
      customer_phone: customer.phone,
      customer_address: customer.address
    }));
    // Save to localStorage
    saveToLocalStorage('customer_phone', customer.phone);
    saveToLocalStorage('customer_address', customer.address);
    setShowCustomerSuggestions(false);
  };

  // Handle client selection
  const handleClientSelect = (client) => {
    setSelectedClient(client);
    // For display: business_name contains the name regardless of client_type
    const displayName = client.business_name || '';
    setFormData(prev => ({
      ...prev,
      client_name: displayName,
      client_id: client.id,
      // Don't auto-fill customer fields - these are for the end customer, not the client
    }));
    setShowClientSuggestions(false);
  };

  // Handle address selection and price lookup
  const handleAddressSelect = (address) => {
    setSelectedAddress(address);
    const fullAddress = `${address.area}, ${address.country}`;
    setFormData(prev => ({
      ...prev,
      customer_address: fullAddress
    }));
    // Save to localStorage
    saveToLocalStorage('customer_address', fullAddress);
    setShowAddressSuggestions(false);
    
    // Auto-fill delivery fees based on delivery method
    updateDeliveryFees(address);
  };

  // Update delivery fees based on selected address and delivery method
  const updateDeliveryFees = (address) => {
    if (!address) return;

    const { deliver_method } = formData;
    const parseMoney = (val, precision = 2) => {
      if (val === null || val === undefined) return 0;
      const s = typeof val === 'string' ? val.replace(/,/g, '').trim() : val;
      const n = Number(s);
      if (!Number.isFinite(n)) return 0;
      return precision === 0 ? Math.round(n) : Math.round(n * Math.pow(10, precision)) / Math.pow(10, precision);
    };
    const feeUsd = parseMoney(address.fee_usd, 2);
    const feeLbp = parseMoney(address.fee_lbp, 0);
    const tpFeeUsd = parseMoney(address.third_party_fee_usd, 2);
    const tpFeeLbp = parseMoney(address.third_party_fee_lbp, 0);
    
    if (deliver_method === 'in_house') {
      setFormData(prev => ({
        ...prev,
        delivery_fee_usd: feeUsd,
        delivery_fee_lbp: feeLbp,
        third_party_fee_usd: 0,
        third_party_fee_lbp: 0
      }));
    } else if (deliver_method === 'third_party') {
      setFormData(prev => ({
        ...prev,
        delivery_fee_usd: feeUsd,
        delivery_fee_lbp: feeLbp,
        third_party_fee_usd: tpFeeUsd,
        third_party_fee_lbp: tpFeeLbp
      }));
    }
  };

  const generateOrderRef = () => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `ORD-${timestamp}-${random}`;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate that a client is selected from CRM
    if (!formData.client_id) {
      toast.error('Please select a client from the CRM suggestions');
      return;
    }
    
    // Transform form data to match API expectations
    const toNumber = (v, int = false) => {
      const s = String(v ?? '').replace(/,/g, '').trim();
      const n = Number(s);
      if (!Number.isFinite(n)) return 0;
      return int ? Math.round(n) : Math.round(n * 100) / 100;
    };

    const orderData = {
      order_ref: formData.order_ref || generateOrderRef(),
      type: formData.type || 'ecommerce',
      customer_name: formData.customer_name || '',
      customer_phone: formData.customer_phone || '',
      customer_address: formData.customer_address || '',
      brand_name: formData.client_name || '', // Use client_name as brand_name for backward compatibility
      client_id: formData.client_id || null, // New field to link to CRM client
      deliver_method: formData.deliver_method || 'in_house',
      // Align with backend: explicitly set delivery_mode for third-party vs direct
      delivery_mode: (formData.deliver_method === 'third_party') ? 'third_party' : 'direct',
      driver_id: formData.driver_id || null,
      notes: formData.notes || '',
      total_usd: toNumber(formData.total_usd, false),
      total_lbp: toNumber(formData.total_lbp, true),
      third_party_fee_usd: toNumber(formData.third_party_fee_usd, false),
      third_party_fee_lbp: toNumber(formData.third_party_fee_lbp, true),
      driver_fee_usd: toNumber(formData.driver_fee_usd, false),
      driver_fee_lbp: toNumber(formData.driver_fee_lbp, true),
      delivery_fee_usd: toNumber(formData.delivery_fee_usd, false),
      delivery_fee_lbp: toNumber(formData.delivery_fee_lbp, true),
      status: formData.status || 'new',
      payment_status: formData.payment_status || 'unpaid'
      // Note: For prepaid orders, cashbox is automatically deducted/credited based on payment_status='prepaid'
      // No need for separate prepaid_amount fields - system uses total_usd/total_lbp automatically
    };

    if (editingOrder) {
      updateOrderModalMutation.mutate({ id: editingOrder.id, orderData });
    } else {
      addOrderMutation.mutate(orderData);
    }
  };

  const handleEdit = (order) => {
    setEditingOrder(order);
    setFormData({
      order_ref: order.order_ref ?? '',
      client_name: order.brand_name ?? '', // Map brand_name to client_name for editing
      client_id: order.client_id ?? '', // Include client_id if available
      customer_name: order.customer_name ?? '',
      customer_phone: order.customer_phone ?? '',
      customer_address: order.customer_address ?? '',
      driver_id: order.driver_id ?? '',
      type: order.type ?? 'ecommerce',
      deliver_method: order.deliver_method ?? 'in_house',
      status: order.status ?? 'new',
      payment_status: order.payment_status ?? 'unpaid',
      notes: order.notes ?? '',
      total_usd: order.total_usd ?? '',
      total_lbp: order.total_lbp ?? '',
      third_party_fee_usd: order.third_party_fee_usd ?? '',
      third_party_fee_lbp: order.third_party_fee_lbp ?? '',
      driver_fee_usd: order.driver_fee_usd ?? '',
      driver_fee_lbp: order.driver_fee_lbp ?? ''
    });
    setShowAddModal(true);
  };

  const handlePayment = (order) => {
    setSelectedOrderForPayment(order);
    setShowPaymentModal(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Save to localStorage for customer phone and address
    saveToLocalStorage(name, value);

    // Handle client name search
    if (name === 'client_name' && value) {
      // Clear client_id if user is typing manually (not selecting from suggestions)
      setFormData(prev => ({ ...prev, client_id: '' }));
      handleClientSearch(value);
    }

    // Handle address search
    if (name === 'customer_address' && value) {
      handleAddressSearch(value);
    }

    // Handle customer phone search
    if (name === 'customer_phone' && value) {
      handleCustomerSearch(value, 'phone');
    }

    // Handle delivery method change - update fees if address is selected
    if (name === 'deliver_method' && selectedAddress) {
      updateDeliveryFees(selectedAddress);
    }
    
    // Enhanced delivery fee lookup for customer address
    if (name === 'deliver_method' && formData.customer_address) {
      deliveryFeeLookup.updateDeliveryFees(formData.customer_address, value, setFormData);
    }
  };

  const formatCurrency = (amount, currency = 'USD') => {
    if (currency === 'USD') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amount || 0);
    } else if (currency === 'LBP') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'LBP',
      }).format(amount || 0);
    }
    return amount || 0;
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      new: 'bg-blue-100 text-blue-800',
      assigned: 'bg-yellow-100 text-yellow-800',
      picked_up: 'bg-purple-100 text-purple-800',
      in_transit: 'bg-indigo-100 text-indigo-800',
      delivered: 'bg-green-100 text-green-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const allRows = [...(orders || []), ...newRows];

  return (
    <div className="w-full max-w-none px-2 py-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Orders Grid</h1>
        <div className="flex items-center space-x-2">
          <button
            onClick={addNewRow}
            className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add Row
          </button>
          <button
            onClick={() => {
              setEditingOrder(null);
              resetForm();
              setShowAddModal(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add New Order
          </button>
          <div className="flex items-center space-x-2">
            {/* Bulk Status Controls */}
            <div className="flex items-center space-x-1 border-r pr-2">
              <select
                onChange={(e) => e.target.value && bulkUpdateStatus(e.target.value)}
                className="px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm min-w-[120px]"
                disabled={selectedRows.size === 0 || bulkStatusMutation.isLoading}
              >
                <option value="">Change Status</option>
                <option value="new">New</option>
                <option value="assigned">Assigned</option>
                <option value="picked_up">Picked Up</option>
                <option value="in_transit">In Transit</option>
                <option value="delivered">Delivered</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <select
                key={paymentStatusDropdownKey}
                onChange={(e) => e.target.value && bulkUpdatePaymentStatus(e.target.value)}
                className="px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm min-w-[120px]"
                disabled={selectedRows.size === 0 || bulkPaymentStatusMutation.isLoading}
                value=""
              >
                <option value="">Payment Status</option>
                <option value="unpaid">Unpaid</option>
                <option value="prepaid">Prepaid</option>
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>

            {/* Driver Assignment */}
            <select
              value={selectedDriverId}
              onChange={(e) => setSelectedDriverId(e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm min-w-[160px]"
            >
              <option value="">Select driver…</option>
              {drivers?.map(driver => (
                <option key={driver.id} value={driver.id}>
                  {driver.full_name}
                </option>
              ))}
            </select>
            <button
              onClick={() => selectedDriverId && batchAssignDriver(selectedDriverId)}
              disabled={!selectedDriverId || selectedRows.size === 0 || batchAssignMutation.isLoading}
              className="bg-orange-600 hover:bg-orange-700 text-white px-2 py-1 rounded text-xs disabled:opacity-50 flex items-center gap-1"
            >
              {batchAssignMutation.isLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <UserCheck className="w-3 h-3" />
              )}
              Assign Selected ({Array.from(selectedRows).filter(id => !String(id).startsWith('new-')).length})
            </button>
            <button
              onClick={() => (selectedRows.size === allRows.length ? deselectAllRows() : selectAllRows())}
              className="px-2 py-1 border border-gray-300 rounded text-xs"
            >
              {selectedRows.size === allRows.length ? 'Deselect All' : 'Select All'}
            </button>
            <button
              onClick={submitNewRows}
              disabled={batchCreateMutation.isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs disabled:opacity-50"
            >
              Submit New Rows
            </button>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-md p-3 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
          <div>
            <input
              type="text"
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="!cancelled">All Except Cancelled</option>
              <option value="">All Statuses</option>
              <option value="new">New</option>
              <option value="assigned">Assigned</option>
              <option value="picked_up">Picked Up</option>
              <option value="in_transit">In Transit</option>
              <option value="delivered">Delivered</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">All Types</option>
              <option value="ecommerce">E-commerce</option>
              <option value="instant">Instant</option>
              <option value="go_to_market">Go to Market</option>
            </select>
          </div>
          <div>
            <select
              value={selectedDeliveryMode}
              onChange={(e) => setSelectedDeliveryMode(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">All Delivery</option>
              <option value="direct">Direct Delivery</option>
              <option value="third_party">Third Party</option>
            </select>
          </div>
          <div>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="From Date"
            />
          </div>
          <div>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="To Date"
            />
          </div>
        </div>
      </div>

      {/* Orders Grid */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto max-w-full">
          <table className="min-w-full divide-y divide-gray-200" style={{ minWidth: '1200px' }}>
            <thead className="bg-gray-50">
              <tr>
                <th className="px-1 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8">
                  <button
                    onClick={selectedRows.size === allRows.length ? deselectAllRows : selectAllRows}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {selectedRows.size === allRows.length ? (
                      <CheckSquare className="w-4 h-4" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="px-1 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                <th className="px-1 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer Phone</th>
                <th className="px-1 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer Name</th>
                <th className="px-1 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer Address</th>
                <th className="px-1 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                  <label htmlFor="total_usd_header">Price USD</label>
                </th>
                <th className="px-1 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                  <label htmlFor="total_lbp_header">Price LBP</label>
                </th>
                <th className="px-1 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Delivery Fees USD</th>
                <th className="px-1 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Delivery Fees LBP</th>
                <th className="px-1 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order Type</th>
                <th className="px-1 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Delivery Mode</th>
                <th className="px-1 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver</th>
                <th className="px-1 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
                <th className="px-1 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-1 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Note</th>
                <th className="px-1 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {allRows.map((row) => (
                <tr key={row.id} className={`hover:bg-gray-50 ${row.isNew ? 'bg-green-50' : ''}`}>
                  <td className="px-1 py-1 whitespace-nowrap">
                    <button
                      onClick={() => toggleRowSelection(row.id)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {selectedRows.has(row.id) ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap">
                    {row.isNew ? (
                      <div className="relative">
                        <input
                          type="text"
                          value={row.client || ''}
                          onChange={(e) => handleClientNameChange(row.id, e.target.value)}
                          className="w-full px-2 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="Client from CRM"
                        />
                        {showClientSuggestions && suggestionIndex === row.id && activeSuggestionField === 'client' && clientSuggestions.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
                            {clientSuggestions.map((client, index) => (
                              <div
                                key={client.id}
                                onClick={() => selectClient(row.id, client)}
                                className="px-2 py-1 hover:bg-gray-100 cursor-pointer text-xs"
                              >
                                <div className="font-medium">
                                  {client.business_name}
                                </div>
                                <div className="text-gray-500">{client.client_type} • {client.phone}</div>
                                {client.address && (
                                  <div className="text-gray-400 text-xs">{client.address}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-900">
                        {/* Display client name from CRM based on client_type */}
                        {row.client_business_name || row.brand_name || 'No Client'}
                      </div>
                    )}
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap">
                    {row.isNew ? (
                      <div className="relative">
                        <input
                          type="tel"
                          value={row.customer_phone || ''}
                          onChange={(e) => handleRowCustomerPhoneChange(row.id, e.target.value)}
                          onBlur={() => handleRowCustomerPhoneBlur(row.id)}
                          className="w-full px-2 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="Customer Phone"
                        />
                        {showCustomerSuggestions && suggestionIndex === row.id && activeSuggestionField === 'customer_phone' && customerSuggestions.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
                            {customerSuggestions.map((customer, index) => (
                              <div
                                key={index}
                                onClick={() => selectRowCustomer(row.id, customer)}
                                className="px-2 py-1 hover:bg-gray-100 cursor-pointer text-xs"
                              >
                                <div className="font-medium">{customer.phone}</div>
                                <div className="text-gray-500">{customer.name}</div>
                                {customer.address && (
                                  <div className="text-gray-400 text-xs">{customer.address}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Loading indicator for row customer phone */}
                        {isSearchingCustomer && suggestionIndex === row.id && activeSuggestionField === 'customer_phone' && (
                          <div className="absolute right-1 top-1/2 transform -translate-y-1/2">
                            <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-900">{row.customer_phone}</div>
                    )}
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap">
                    {row.isNew ? (
                      <input
                        type="text"
                        value={row.customer_name || ''}
                        onChange={(e) => handleRowCustomerNameChange(row.id, e.target.value)}
                        className="w-full px-2 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Customer Name"
                      />
                    ) : (
                      <div className="text-xs text-gray-900">{row.customer_name}</div>
                    )}
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap">
                    {row.isNew ? (
                      <input
                        type="text"
                        value={row.customer_address ?? ''}
                        onChange={(e) => handleRowCustomerAddressChange(row.id, e.target.value)}
                        className="w-full px-2 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Customer Address"
                      />
                    ) : (
                      editingRow === row.id ? (
                        <input
                          type="text"
                          value={row.customer_address ?? ''}
                          onChange={(e) => {
                            const updatedRow = { ...row, customer_address: e.target.value };
                            updateRowData(row.id, 'customer_address', e.target.value);
                          }}
                          onBlur={(e) => updateOrderMutation.mutate({ id: row.id, data: { customer_address: e.target.value } })}
                          className="w-full px-2 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      ) : (
                        <div className="text-xs text-gray-900">{row.customer_address ?? ''}</div>
                      )
                    )}
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap w-24">
                    {row.isNew ? (
                      <>
                        <label htmlFor={`total_usd_${row.id}`} className="sr-only">Price USD</label>
                        <input
                          type="number"
                          step="0.01"
                          id={`total_usd_${row.id}`}
                          name={`total_usd_${row.id}`}
                          value={row.total_usd || ''}
                          onChange={(e) => updateRowData(row.id, 'total_usd', e.target.value)}
                          className="w-full px-2 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="0.00"
                          aria-label="Price USD"
                        />
                      </>
                    ) : (
                      <div className="text-xs text-gray-900">{formatCurrency((row.computed_total_usd ?? row.total_usd ?? 0), 'USD')}</div>
                    )}
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap w-24">
                    {row.isNew ? (
                      <>
                        <label htmlFor={`total_lbp_${row.id}`} className="sr-only">Price LBP</label>
                        <input
                          type="number"
                          id={`total_lbp_${row.id}`}
                          name={`total_lbp_${row.id}`}
                          value={row.total_lbp || ''}
                          onChange={(e) => updateRowData(row.id, 'total_lbp', e.target.value)}
                          className="w-full px-2 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="0"
                          aria-label="Price LBP"
                        />
                      </>
                    ) : (
                      <div className="text-xs text-gray-900">{formatCurrency((row.computed_total_lbp ?? row.total_lbp ?? 0), 'LBP')}</div>
                    )}
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap">
                    {row.isNew ? (
                      <input
                        type="number"
                        step="0.01"
                        value={row.delivery_fee_usd || ''}
                        onChange={(e) => updateRowData(row.id, 'delivery_fee_usd', e.target.value)}
                        className="w-full px-2 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="0.00"
                      />
                    ) : (
                      <div className="text-xs text-gray-900">{formatCurrency(row.delivery_fee_usd, 'USD')}</div>
                    )}
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap">
                    {row.isNew ? (
                      <input
                        type="number"
                        value={row.delivery_fee_lbp || ''}
                        onChange={(e) => updateRowData(row.id, 'delivery_fee_lbp', e.target.value)}
                        className="w-full px-2 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="0"
                      />
                    ) : (
                      <div className="text-xs text-gray-900">{formatCurrency(row.delivery_fee_lbp, 'LBP')}</div>
                    )}
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap">
                    {row.isNew ? (
                      <div className="text-xs text-gray-900">instant</div>
                    ) : (
                      <div className="text-xs text-gray-900">{row.type}</div>
                    )}
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap">
                    {row.isNew ? (
                      <div className="text-xs text-gray-900">direct</div>
                    ) : (
                      <div className="text-xs text-gray-900">{row.delivery_mode}</div>
                    )}
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap">
                    {row.isNew ? (
                      <select
                        value={row.driver_id || ''}
                        onChange={(e) => updateRowData(row.id, 'driver_id', e.target.value)}
                        className="w-full px-2 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">—</option>
                        {drivers?.map(driver => (
                          <option key={driver.id} value={driver.id}>{driver.full_name}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="text-xs text-gray-900">{row.driver_name || '—'}</div>
                    )}
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap">
                    {row.isNew ? (
                      <div className="text-xs text-gray-900">unpaid</div>
                    ) : (
                      editingRow === row.id ? (
                        <select
                          value={row.payment_status ?? 'unpaid'}
                          onChange={(e) => {
                            // Update locally for immediate feedback
                            updateRowData(row.id, 'payment_status', e.target.value);
                          }}
                          onBlur={(e) => updateOrderMutation.mutate({ id: row.id, data: { payment_status: e.target.value } })}
                          className="w-full px-2 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="unpaid">unpaid</option>
                          <option value="prepaid">prepaid</option>
                          <option value="paid">paid</option>
                          <option value="refunded">refunded</option>
                        </select>
                      ) : (
                        <div className="text-xs text-gray-900">{row.payment_status ?? ''}</div>
                      )
                    )}
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap">
                    {row.isNew ? (
                      <div className="text-xs text-gray-900">new</div>
                    ) : (
                      editingRow === row.id ? (
                        <select
                          value={row.status ?? 'new'}
                          onChange={(e) => {
                            // Update locally for immediate feedback
                            updateRowData(row.id, 'status', e.target.value);
                          }}
                          onBlur={(e) => updateOrderMutation.mutate({ id: row.id, data: { status: e.target.value } })}
                          className="w-full px-2 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="new">new</option>
                          <option value="assigned">assigned</option>
                          <option value="picked_up">picked_up</option>
                          <option value="in_transit">in_transit</option>
                          <option value="delivered">delivered</option>
                          <option value="completed">completed</option>
                          <option value="cancelled">cancelled</option>
                        </select>
                      ) : (
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(row.status ?? 'new')}`}>
                          {row.status ?? 'new'}
                        </span>
                      )
                    )}
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap">
                    {row.isNew ? (
                      <input
                        type="text"
                        value={row.note || ''}
                        onChange={(e) => updateRowData(row.id, 'note', e.target.value)}
                        className="w-full px-2 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Note"
                      />
                    ) : (
                      <div className="text-xs text-gray-900">{row.notes || ''}</div>
                    )}
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap text-xs font-medium">
                    {row.isNew ? (
                      <button
                        onClick={() => removeNewRow(row.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEdit(row)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="Edit Order"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handlePayment(row)}
                          className="text-green-600 hover:text-green-900"
                          title="Record Payment"
                        >
                          <DollarSign className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm('Delete this order?')) deleteOrderMutation.mutate(row.id);
                          }}
                          className="text-red-600 hover:text-red-900"
                          title="Delete Order"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Submit Button for New Rows */}
      {newRows.length > 0 && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={submitNewRows}
            disabled={batchCreateMutation.isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-md flex items-center gap-2 transition-colors disabled:opacity-50 text-sm"
          >
            {batchCreateMutation.isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Submit {newRows.length} New Orders
          </button>
        </div>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg p-4 w-full max-w-4xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">
                  {editingOrder ? 'Edit Order' : 'Add New Order'}
                </h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Row 1: Reference, Client, Customer Phone */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Reference
                    </label>
                    <input
                      type="text"
                      name="order_ref"
                      value={formData.order_ref ?? ''}
                      onChange={handleInputChange}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Auto-generated if empty"
                    />
                  </div>

                  <div className="relative">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Client *
                    </label>
                    <input
                      type="text"
                      name="client_name"
                      value={formData.client_name ?? ''}
                      onChange={handleInputChange}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Type client name..."
                      required
                    />
                    
                    {/* Client Suggestions Dropdown */}
                    {showClientSuggestions && clientSuggestions.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {clientSuggestions.map((client) => (
                          <div
                            key={client.id}
                            onClick={() => handleClientSelect(client)}
                            className="px-2 py-1.5 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0 text-sm"
                          >
                            <div className="font-medium text-gray-900">
                              {client.business_name || client.client_name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {client.client_type} • {client.phone}
                            </div>
                            {client.address && (
                              <div className="text-xs text-gray-400">{client.address}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Customer Phone *
                    </label>
                    <input
                      type="tel"
                      name="customer_phone"
                      value={formData.customer_phone ?? ''}
                      onChange={(e) => handleCustomerPhoneChange(e.target.value)}
                      onBlur={handleCustomerPhoneBlur}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Type phone number..."
                      required
                    />
                    
                    {/* Enhanced Customer Phone Suggestions Dropdown */}
                    {showCustomerSuggestions && customerSuggestions.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {customerSuggestions.map((customer, index) => (
                          <div
                            key={index}
                            onClick={() => selectCustomer(customer)}
                            className="px-2 py-1.5 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0 text-sm"
                          >
                            <div className="font-medium text-gray-900">{customer.phone}</div>
                            <div className="text-xs text-gray-500">{customer.name}</div>
                            {customer.address && (
                              <div className="text-xs text-gray-400">{customer.address}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Loading indicator */}
                    {isSearchingCustomer && (
                      <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                      </div>
                    )}
                  </div>

                  {/* Row 2: Customer Name, Customer Address */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Customer Name
                    </label>
                    <input
                      type="text"
                      name="customer_name"
                      value={formData.customer_name ?? ''}
                      onChange={(e) => handleCustomerNameChange(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div className="relative">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Customer Address
                    </label>
                    <input
                      type="text"
                      name="customer_address"
                      value={formData.customer_address ?? ''}
                      onChange={(e) => handleCustomerAddressChange(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Type address..."
                    />
                    
                    {/* Address Suggestions Dropdown */}
                    {showAddressSuggestions && addressSuggestions.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {addressSuggestions.map((address, index) => (
                          <div
                            key={index}
                            onClick={() => handleAddressSelect(address)}
                            className="px-2 py-1.5 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0 text-sm"
                          >
                            <div className="font-medium text-gray-900">{address.area}, {address.country}</div>
                            <div className="text-xs text-gray-500">
                              In-House: ${address.fee_usd} / {address.fee_lbp} LBP
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div></div> {/* Empty div for spacing */}

                  {/* Row 3: Order Type, Delivery Method, Driver */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Order Type
                    </label>
                    <select
                      name="type"
                      value={formData.type ?? 'ecommerce'}
                      onChange={handleInputChange}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="ecommerce">E-commerce</option>
                      <option value="instant">Instant</option>
                      <option value="go_to_market">Go to Market</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Delivery Method
                    </label>
                    <select
                      name="deliver_method"
                      value={formData.deliver_method ?? 'in_house'}
                      onChange={handleInputChange}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="in_house">In House</option>
                      <option value="third_party">Third Party</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Driver
                    </label>
                    <select
                      name="driver_id"
                      value={formData.driver_id ?? ''}
                      onChange={handleInputChange}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">Select Driver</option>
                      {drivers?.map(driver => (
                        <option key={driver.id} value={driver.id}>
                          {driver.full_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Row 4: Price USD, Price LBP, Status */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Price USD
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      name="total_usd"
                      value={formData.total_usd ?? ''}
                      onChange={handleInputChange}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Price LBP
                    </label>
                    <input
                      type="number"
                      name="total_lbp"
                      value={formData.total_lbp ?? ''}
                      onChange={handleInputChange}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <select
                      name="status"
                      value={formData.status ?? 'new'}
                      onChange={handleInputChange}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="new">New</option>
                      <option value="assigned">Assigned</option>
                      <option value="picked_up">Picked Up</option>
                      <option value="in_transit">In Transit</option>
                      <option value="delivered">Delivered</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>

                  {/* Row 5: Delivery Fee USD, Delivery Fee LBP, Payment Status */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Delivery Fee USD
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      name="delivery_fee_usd"
                      value={formData.delivery_fee_usd ?? ''}
                      onChange={handleInputChange}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Delivery Fee LBP
                    </label>
                    <input
                      type="number"
                      name="delivery_fee_lbp"
                      value={formData.delivery_fee_lbp ?? ''}
                      onChange={handleInputChange}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Payment Status
                    </label>
                    <select
                      name="payment_status"
                      value={formData.payment_status ?? 'unpaid'}
                      onChange={handleInputChange}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="unpaid">Unpaid</option>
                      <option value="prepaid">Prepaid</option>
                      <option value="paid">Paid</option>
                      <option value="refunded">Refunded</option>
                    </select>
                  </div>

                  {/* Info message for prepaid orders */}
                  {formData.payment_status === 'prepaid' && (
                    <div className="md:col-span-2 bg-blue-50 border border-blue-200 rounded-md p-3 mb-2">
                      <p className="text-xs text-blue-800">
                        <strong>ℹ️ Prepaid Order:</strong> The order total (Price USD + Price LBP) will be automatically deducted from cash account when created, and restored when order status is "Delivered" and payment status is "Paid".
                      </p>
                    </div>
                  )}

                  {/* Third Party specific section - visible only when third party */}
                  {formData.deliver_method === 'third_party' && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Third Party Fee USD</label>
                        <input
                          type="number"
                          step="0.01"
                          name="third_party_fee_usd"
                          value={formData.third_party_fee_usd ?? ''}
                          onChange={handleInputChange}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Third Party Fee LBP</label>
                        <input
                          type="number"
                          name="third_party_fee_lbp"
                          value={formData.third_party_fee_lbp ?? ''}
                          onChange={handleInputChange}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Third Party Payment</label>
                        <select
                          name="payment_status"
                          value={formData.payment_status ?? 'prepaid'}
                          onChange={handleInputChange}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="prepaid">Prepaid</option>
                          <option value="unpaid">Unpaid</option>
                          <option value="canceled">Canceled</option>
                        </select>
                      </div>
                    </>
                  )}

                  {/* Notes - always visible, spans 2 columns */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Notes
                    </label>
                    <textarea
                      name="notes"
                      value={formData.notes ?? ''}
                      onChange={handleInputChange}
                      rows={2}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Additional notes about the order..."
                    />
                  </div>

                  {/* Third Party Order Status - only when third party */}
                  {formData.deliver_method === 'third_party' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Third Party Order Status</label>
                      <select
                        name="status"
                        value={formData.status ?? 'on_road'}
                        onChange={handleInputChange}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="on_road">Onroad</option>
                        <option value="delivered">Delivered</option>
                        <option value="canceled">Canceled</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addOrderMutation.isLoading || updateOrderModalMutation.isLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    {(addOrderMutation.isLoading || updateOrderModalMutation.isLoading) ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {editingOrder ? 'Update Order' : 'Create Order'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        order={selectedOrderForPayment}
        onPaymentSuccess={() => {
          queryClient.invalidateQueries('orders');
        }}
      />
    </div>
  );
};

export default OrdersGrid;