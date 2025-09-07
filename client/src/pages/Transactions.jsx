import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, Plus, DollarSign, TrendingUp, TrendingDown, Calendar, User, FileText, Download, Eye, Users, Truck, Building } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import api from '../api';

const Transactions = () => {
  const [filters, setFilters] = useState({
    actor_type: '',
    actor_id: '',
    tx_type: '',
    from_date: '',
    to_date: '',
    group_by: 'date' // 'date', 'person', 'type'
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedActor, setSelectedActor] = useState(null);
  const [newTransaction, setNewTransaction] = useState({
    tx_type: '',
    amount_usd: '',
    amount_lbp: '',
    debit_account: '',
    credit_account: '',
    actor_type: '',
    actor_id: '',
    details: {},
    // Structured form fields
    order_id: '',
    driver_id: '',
    client_id: '',
    fuel_amount: '',
    delivery_fee: '',
    third_party_fee: '',
    description: ''
  });

  const queryClient = useQueryClient();

  const { data: transactions, isLoading, error, refetch } = useQuery(
    ['transactions', filters],
    () => api.get('/transactions', { params: filters }),
    {
      refetchOnWindowFocus: false,
      retry: 1
    }
  );

  const { data: drivers } = useQuery(
    ['drivers'],
    () => api.get('/drivers'),
    { 
      refetchOnWindowFocus: false,
      select: (response) => response.data?.data || []
    }
  );

  const { data: clients } = useQuery(
    ['clients'],
    () => api.get('/clients'),
    { 
      refetchOnWindowFocus: false,
      select: (response) => response.data?.data || []
    }
  );

  const { data: orders } = useQuery(
    ['orders'],
    () => api.get('/orders'),
    { 
      refetchOnWindowFocus: false,
      select: (response) => response.data?.data || []
    }
  );

  const addTransactionMutation = useMutation(
    (data) => api.post('/transactions', data),
    {
      onSuccess: () => {
        toast.success('Transaction added successfully!');
        setShowAddModal(false);
        setNewTransaction({
          tx_type: '',
          amount_usd: '',
          amount_lbp: '',
          debit_account: '',
          credit_account: '',
          actor_type: '',
          actor_id: '',
          details: {},
          order_id: '',
          driver_id: '',
          client_id: '',
          fuel_amount: '',
          delivery_fee: '',
          third_party_fee: '',
          description: ''
        });
        queryClient.invalidateQueries(['transactions']);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to add transaction');
      }
    }
  );

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      actor_type: '',
      actor_id: '',
      tx_type: '',
      from_date: '',
      to_date: '',
      group_by: 'date'
    });
  };

  const handleAddTransaction = () => {
    if (!newTransaction.tx_type) {
      toast.error('Please select a transaction type');
      return;
    }

    // Build transaction data based on type
    let transactionData = {
      tx_type: newTransaction.tx_type,
      actor_type: newTransaction.actor_type,
      actor_id: newTransaction.actor_id,
      details: {
        description: newTransaction.description
      }
    };

    // Handle different transaction types
    switch (newTransaction.tx_type) {
      case 'driver_fuel':
        transactionData.amount_lbp = newTransaction.fuel_amount;
        transactionData.actor_type = 'driver';
        transactionData.actor_id = newTransaction.driver_id;
        transactionData.details.description = `Driver ${getActorName({ actor_type: 'driver', actor_id: newTransaction.driver_id })} paid ${newTransaction.fuel_amount} LBP for gasoline`;
        break;
      
      case 'order_payment':
        transactionData.amount_usd = newTransaction.amount_usd;
        transactionData.amount_lbp = newTransaction.delivery_fee;
        transactionData.actor_type = 'client';
        transactionData.actor_id = newTransaction.client_id;
        transactionData.details.description = `Bought $${newTransaction.amount_usd} order for ${getActorName({ actor_type: 'client', actor_id: newTransaction.client_id })}, with ${newTransaction.delivery_fee} LBP delivery fee`;
        break;
      
      case 'order_delivered':
        transactionData.amount_usd = newTransaction.amount_usd;
        transactionData.amount_lbp = newTransaction.delivery_fee;
        transactionData.actor_type = 'client';
        transactionData.actor_id = newTransaction.client_id;
        transactionData.details.description = `Delivered $${newTransaction.amount_usd} order, customer paid ${newTransaction.delivery_fee} LBP delivery fee`;
        break;
      
      case 'third_party_delivery':
        transactionData.amount_usd = newTransaction.amount_usd;
        transactionData.third_party_fee = newTransaction.third_party_fee;
        transactionData.actor_type = 'third_party';
        transactionData.details.description = `Third-party delivered $${newTransaction.amount_usd} order, took $${newTransaction.third_party_fee || 0} for their delivery and $${newTransaction.amount_usd - (newTransaction.third_party_fee || 0)} for ours`;
        break;
      
      default:
        transactionData.amount_usd = newTransaction.amount_usd;
        transactionData.amount_lbp = newTransaction.amount_lbp;
        transactionData.debit_account = newTransaction.debit_account;
        transactionData.credit_account = newTransaction.credit_account;
    }

    addTransactionMutation.mutate(transactionData);
  };

  const exportToPDF = async (transaction) => {
    try {
      const response = await api.get(`/transactions/${transaction.id}/print`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `transaction-${transaction.id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Transaction exported successfully!');
    } catch (error) {
      toast.error('Failed to export transaction');
    }
  };

  const viewTransactionDetails = (transaction) => {
    setSelectedTransaction(transaction);
    setShowDetailsModal(true);
  };

  const getTransactionTypeIcon = (txType) => {
    switch (txType) {
      case 'order':
      case 'order_payment':
      case 'order_delivered':
        return <FileText className="h-4 w-4" />;
      case 'driver_payment':
      case 'driver_fuel':
        return <Truck className="h-4 w-4" />;
      case 'cash_in':
        return <TrendingUp className="h-4 w-4" />;
      case 'cash_out':
        return <TrendingDown className="h-4 w-4" />;
      case 'third_party_fee':
      case 'third_party_delivery':
        return <Building className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getTransactionTypeColor = (txType) => {
    switch (txType) {
      case 'order':
      case 'order_payment':
      case 'order_delivered':
        return 'bg-blue-100 text-blue-800';
      case 'driver_payment':
      case 'driver_fuel':
        return 'bg-green-100 text-green-800';
      case 'cash_in':
        return 'bg-emerald-100 text-emerald-800';
      case 'cash_out':
        return 'bg-red-100 text-red-800';
      case 'third_party_fee':
      case 'third_party_delivery':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getActorName = (transaction) => {
    if (transaction.actor_type === 'driver') {
      const driver = Array.isArray(drivers) ? drivers.find(d => d.id === transaction.actor_id) : undefined;
      return driver?.full_name || 'Unknown Driver';
    } else if (transaction.actor_type === 'client') {
      const client = Array.isArray(clients) ? clients.find(c => c.id === transaction.actor_id) : undefined;
      return client?.business_name || 'Unknown Client';
    }
    return transaction.actor_type || 'System';
  };

  const getStructuredDescription = (transaction) => {
    if (transaction.details?.description) {
      return transaction.details.description;
    }

    const actorName = getActorName(transaction);
    const amount = transaction.amount_usd > 0 ? `$${transaction.amount_usd}` : `${transaction.amount_lbp} LBP`;
    
    switch (transaction.tx_type) {
      case 'driver_fuel':
        return `Driver ${actorName} paid ${transaction.amount_lbp} LBP for gasoline`;
      case 'order_payment':
        return `Bought ${amount} order for ${actorName}, unpaid, with ${transaction.amount_lbp} LBP delivery fee`;
      case 'order_delivered':
        return `Delivered ${amount} order, customer paid ${transaction.amount_lbp} LBP delivery fee`;
      case 'third_party_delivery':
        return `Third-party delivered ${amount} order, took $${transaction.third_party_fee || 0} for their delivery and $${transaction.amount_usd - (transaction.third_party_fee || 0)} for ours`;
      default:
        return `${transaction.tx_type.replace('_', ' ')} - ${amount}`;
    }
  };

  const groupTransactions = (transactions) => {
    if (!transactions?.data || !Array.isArray(transactions.data)) {
      console.log('⚠️ Transactions data is not an array:', transactions);
      return [];
    }

    switch (filters.group_by) {
      case 'person':
        const groupedByPerson = {};
        transactions.data.forEach(tx => {
          const key = `${tx.actor_type}_${tx.actor_id}`;
          if (!groupedByPerson[key]) {
            groupedByPerson[key] = {
              actor: { type: tx.actor_type, id: tx.actor_id, name: getActorName(tx) },
              transactions: []
            };
          }
          groupedByPerson[key].transactions.push(tx);
        });
        return Object.values(groupedByPerson);

      case 'type':
        const groupedByType = {};
        transactions.data.forEach(tx => {
          if (!groupedByType[tx.tx_type]) {
            groupedByType[tx.tx_type] = {
              type: tx.tx_type,
              transactions: []
            };
          }
          groupedByType[tx.tx_type].transactions.push(tx);
        });
        return Object.values(groupedByType);

      default: // date
        const groupedByDate = {};
        transactions.data.forEach(tx => {
          const date = format(new Date(tx.created_at), 'yyyy-MM-dd');
          if (!groupedByDate[date]) {
            groupedByDate[date] = {
              date,
              transactions: []
            };
          }
          groupedByDate[date].transactions.push(tx);
        });
        return Object.values(groupedByDate).sort((a, b) => new Date(b.date) - new Date(a.date));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Error loading transactions</p>
        <button 
          onClick={() => refetch()}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const groupedTransactions = groupTransactions(transactions);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Transactions</h1>
          <p className="text-gray-600 mt-2">Track all financial transactions with detailed structured forms</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={async () => {
              const params = new URLSearchParams();
              Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
              const token = localStorage.getItem('token');
              const apiBase = import.meta.env.VITE_API_URL || 'https://soufiam-erp-backend.onrender.com';
              const resp = await fetch(`${apiBase}/api/transactions/export/csv?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              const blob = await resp.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'transactions_export.csv';
              document.body.appendChild(a);
              a.click();
              a.remove();
              URL.revokeObjectURL(url);
            }}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Add Transaction</span>
          </button>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
      >
        <div className="flex items-center space-x-2 mb-4">
          <Filter className="h-5 w-5 text-gray-500" />
          <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Transaction Type
            </label>
            <select
              value={filters.tx_type}
              onChange={(e) => handleFilterChange('tx_type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Types</option>
              <option value="driver_fuel">Driver Fuel</option>
              <option value="order_payment">Order Payment</option>
              <option value="order_delivered">Order Delivered</option>
              <option value="third_party_delivery">Third Party Delivery</option>
              <option value="cash_in">Cash In</option>
              <option value="cash_out">Cash Out</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Group By
            </label>
            <select
              value={filters.group_by}
              onChange={(e) => handleFilterChange('group_by', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="date">Date</option>
              <option value="person">Person</option>
              <option value="type">Type</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              From Date
            </label>
            <input
              type="date"
              value={filters.from_date}
              onChange={(e) => handleFilterChange('from_date', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              To Date
            </label>
            <input
              type="date"
              value={filters.to_date}
              onChange={(e) => handleFilterChange('to_date', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div className="flex items-end">
            <button
              onClick={() => refetch()}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Apply
            </button>
          </div>
          
          <div className="flex items-end">
            <button
              onClick={clearFilters}
              className="w-full px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      </motion.div>

      {/* Grouped Transactions */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-6"
      >
        {(groupedTransactions || []).map((group, groupIndex) => (
          <motion.div
            key={groupIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: groupIndex * 0.1 }}
            className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
          >
            {/* Group Header */}
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {filters.group_by === 'person' && (
                    <>
                      <Users className="h-5 w-5 text-gray-500" />
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{group.actor.name}</h3>
                        <p className="text-sm text-gray-500 capitalize">{group.actor.type}</p>
                      </div>
                    </>
                  )}
                  {filters.group_by === 'type' && (
                    <>
                      {getTransactionTypeIcon(group.type)}
                      <h3 className="text-lg font-semibold text-gray-900 capitalize">
                        {group.type.replace('_', ' ')}
                      </h3>
                    </>
                  )}
                  {filters.group_by === 'date' && (
                    <>
                      <Calendar className="h-5 w-5 text-gray-500" />
                      <h3 className="text-lg font-semibold text-gray-900">
                        {format(new Date(group.date), 'EEEE, MMMM dd, yyyy')}
                      </h3>
                    </>
                  )}
                </div>
                <div className="text-sm text-gray-500">
                  {group.transactions.length} transaction{group.transactions.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>

            {/* Transactions in Group */}
            <div className="divide-y divide-gray-200">
              {(group.transactions || []).map((transaction) => (
                <div key={transaction.id} className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className={`p-2 rounded-lg ${getTransactionTypeColor(transaction.tx_type)}`}>
                        {getTransactionTypeIcon(transaction.tx_type)}
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-lg font-semibold text-gray-900">
                            {transaction.tx_type.replace('_', ' ').toUpperCase()}
                          </span>
                          <span className="text-sm text-gray-500">
                            #{transaction.id}
                          </span>
                        </div>
                        
                        <div className="text-sm text-gray-600">
                          {getStructuredDescription(transaction)}
                        </div>
                        
                        <div className="text-xs text-gray-500">
                          {format(new Date(transaction.created_at), 'MMM dd, yyyy HH:mm')}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right space-y-1">
                      {transaction.amount_usd > 0 && (
                        <div className="text-lg font-semibold text-gray-900">
                          ${transaction.amount_usd.toFixed(2)}
                        </div>
                      )}
                      {transaction.amount_lbp > 0 && (
                        <div className="text-lg font-semibold text-gray-900">
                          {transaction.amount_lbp.toLocaleString()} LBP
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => viewTransactionDetails(transaction)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => exportToPDF(transaction)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Export PDF"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
        
        {groupedTransactions.length === 0 && (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No transactions found</p>
            <p className="text-gray-400 text-sm">Try adjusting your filters or add a new transaction</p>
          </div>
        )}
      </motion.div>

      {/* Add Transaction Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">
                  Add New Transaction
                </h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Transaction Type *
                  </label>
                  <select
                    value={newTransaction.tx_type}
                    onChange={(e) => setNewTransaction(prev => ({ ...prev, tx_type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Type</option>
                    <option value="driver_fuel">Driver Fuel Payment</option>
                    <option value="order_payment">Order Payment</option>
                    <option value="order_delivered">Order Delivered</option>
                    <option value="third_party_delivery">Third Party Delivery</option>
                    <option value="cash_in">Cash In</option>
                    <option value="cash_out">Cash Out</option>
                  </select>
                </div>

                {/* Dynamic form fields based on transaction type */}
                {newTransaction.tx_type === 'driver_fuel' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Driver *
                      </label>
                      <select
                        value={newTransaction.driver_id}
                        onChange={(e) => setNewTransaction(prev => ({ ...prev, driver_id: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select Driver</option>
                        {drivers?.map(driver => (
                          <option key={driver.id} value={driver.id}>{driver.full_name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Fuel Amount (LBP) *
                      </label>
                      <input
                        type="number"
                        placeholder="150000"
                        value={newTransaction.fuel_amount}
                        onChange={(e) => setNewTransaction(prev => ({ ...prev, fuel_amount: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </>
                )}

                {newTransaction.tx_type === 'order_payment' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Client *
                      </label>
                      <select
                        value={newTransaction.client_id}
                        onChange={(e) => setNewTransaction(prev => ({ ...prev, client_id: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select Client</option>
                        {clients?.map(client => (
                          <option key={client.id} value={client.id}>{client.business_name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Order Amount (USD) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="20.00"
                        value={newTransaction.amount_usd}
                        onChange={(e) => setNewTransaction(prev => ({ ...prev, amount_usd: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Delivery Fee (LBP) *
                      </label>
                      <input
                        type="number"
                        placeholder="200000"
                        value={newTransaction.delivery_fee}
                        onChange={(e) => setNewTransaction(prev => ({ ...prev, delivery_fee: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </>
                )}

                {newTransaction.tx_type === 'third_party_delivery' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Order Amount (USD) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="50.00"
                        value={newTransaction.amount_usd}
                        onChange={(e) => setNewTransaction(prev => ({ ...prev, amount_usd: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Third Party Fee (USD) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="3.00"
                        value={newTransaction.third_party_fee}
                        onChange={(e) => setNewTransaction(prev => ({ ...prev, third_party_fee: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </>
                )}

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    placeholder="Additional transaction details..."
                    value={newTransaction.description}
                    onChange={(e) => setNewTransaction(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-end space-x-3 mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddTransaction}
                  disabled={addTransactionMutation.isLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {addTransactionMutation.isLoading ? 'Adding...' : 'Add Transaction'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Transaction Details Modal */}
      {showDetailsModal && selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">
                  Transaction Details - #{selectedTransaction.id}
                </h3>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Transaction Information</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Type:</span>
                        <span className="font-medium">{selectedTransaction.tx_type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Actor Type:</span>
                        <span className="font-medium">{selectedTransaction.actor_type || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Actor Name:</span>
                        <span className="font-medium">{getActorName(selectedTransaction)}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Financial Details</h4>
                    <div className="space-y-2 text-sm">
                      {selectedTransaction.amount_usd > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Amount USD:</span>
                          <span className="font-medium">${selectedTransaction.amount_usd.toFixed(2)}</span>
                        </div>
                      )}
                      {selectedTransaction.amount_lbp > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Amount LBP:</span>
                          <span className="font-medium">{selectedTransaction.amount_lbp.toLocaleString()} LBP</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Description</h4>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600">
                        {getStructuredDescription(selectedTransaction)}
                      </p>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Timeline</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Created:</span>
                        <span className="font-medium">
                          {format(new Date(selectedTransaction.created_at), 'MMM dd, yyyy HH:mm')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-end space-x-3 mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={() => exportToPDF(selectedTransaction)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                >
                  <Download className="h-4 w-4" />
                  <span>Export PDF</span>
                </button>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Transactions;
