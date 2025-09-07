import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Truck, 
  Building, 
  FileText, 
  Download, 
  Eye, 
  Search,
  Filter,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  RefreshCw,
  Clock
} from 'lucide-react';
import api from '../api';
import { format } from 'date-fns';
import { formatCurrency } from '../utils/formatters';
import html2canvas from 'html2canvas';

const Accounting = () => {
  const [selectedView, setSelectedView] = useState('overview');
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({
    from: format(new Date().setDate(1), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd')
  });
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  const queryClient = useQueryClient();

  // Fetch list data per view
  const { data: listData, isLoading, error, refetch } = useQuery(
    ['accounting-list', selectedView, dateRange, searchTerm],
    async () => {
      if (selectedView === 'clients') {
        const res = await api.get('/accounting/clients', { params: { from_date: dateRange.from, to_date: dateRange.to, search: searchTerm } });
        return res.data?.data || [];
      }
      if (selectedView === 'drivers') {
        const res = await api.get('/accounting/drivers', { params: { from_date: dateRange.from, to_date: dateRange.to, search: searchTerm } });
        return res.data?.data || [];
      }
      if (selectedView === 'third_parties') {
        const res = await api.get('/accounting/thirdparty', { params: { from_date: dateRange.from, to_date: dateRange.to, search: searchTerm } });
        return res.data?.data || [];
      }
      // Fallback to overview endpoint already available
      const res = await api.get('/accounting/overview');
      return res.data?.data || {};
    },
    { refetchInterval: 30000 }
  );

  // Fetch entity details when selected
  const { data: entityDetails } = useQuery(
    ['accounting-entity', selectedView, selectedEntity?.id || selectedEntity?.name, dateRange],
    async () => {
      if (!selectedEntity) return null;
      if (selectedView === 'clients') {
        const res = await api.get(`/accounting/clients/${selectedEntity.id}`, { params: { from_date: dateRange.from, to_date: dateRange.to } });
        return res.data?.data;
      }
      if (selectedView === 'drivers') {
        const res = await api.get(`/accounting/drivers/${selectedEntity.id}`, { params: { from_date: dateRange.from, to_date: dateRange.to } });
        return res.data?.data;
      }
      if (selectedView === 'third_parties') {
        const res = await api.get(`/accounting/thirdparty/${selectedEntity.name}`, { params: { from_date: dateRange.from, to_date: dateRange.to } });
        return res.data?.data;
      }
      return null;
    },
    { enabled: !!selectedEntity && selectedView !== 'overview' }
  );

  // Add transaction mutation
  const addTransactionMutation = useMutation(
    (transactionData) => api.post('/transactions', transactionData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['accounting']);
        queryClient.invalidateQueries(['transactions']);
        setIsTransactionModalOpen(false);
        toast.success('Transaction added successfully!');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to add transaction');
      }
    }
  );

  const handleViewChange = (view) => {
    setSelectedView(view);
    setSelectedEntity(null);
  };

  const handleEntitySelect = (entity) => {
    setSelectedEntity(entity);
  };

  const handleAddTransaction = () => {
    setIsTransactionModalOpen(true);
  };

  const handleViewReceipt = (transaction) => {
    setSelectedTransaction(transaction);
    setIsReceiptModalOpen(true);
  };

  const downloadStatement = async (actorType, actorId, format = 'csv') => {
    try {
      const response = await api.get('/accounting/statement', {
        params: { actorType, actorId, from_date: dateRange.from, to_date: dateRange.to, format },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `statement-${actorType}-${actorId}.${format === 'csv' ? 'csv' : 'pdf'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Statement downloaded');
    } catch (e) {
      toast.error('Failed to download statement');
    }
  };

  const exportSectionAsImage = async (elementRef, filenamePrefix = 'account') => {
    try {
      if (!elementRef?.current) return;
      const canvas = await html2canvas(elementRef.current, { scale: 2, useCORS: true });
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${filenamePrefix}-${new Date().toISOString().slice(0,10)}.png`;
      link.click();
    } catch (e) {
      toast.error('Failed to export image');
    }
  };

  // Cashout actions
  const cashoutMutation = useMutation(
    async ({ scope, idOrName, amount_usd = 0, amount_lbp = 0, description }) => {
      if (scope === 'clients') {
        return api.post(`/accounting/clients/${idOrName}/cashout`, { amount_usd, amount_lbp, description });
      } else if (scope === 'drivers') {
        return api.post(`/accounting/drivers/${idOrName}/cashout`, { amount_usd, amount_lbp, description });
      } else if (scope === 'third_parties') {
        return api.post(`/accounting/thirdparty/${idOrName}/cashout`, { amount_usd, amount_lbp, description });
      }
    },
    {
      onSuccess: () => {
        toast.success('Cashout completed');
        refetch();
      },
      onError: (e) => toast.error(e.response?.data?.message || 'Cashout failed')
    }
  );

  const handleTransactionSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    const transactionData = {
      tx_type: formData.get('tx_type'),
      amount_usd: parseFloat(formData.get('amount_usd')) || 0,
      amount_lbp: parseInt(formData.get('amount_lbp')) || 0,
      debit_account: formData.get('debit_account'),
      credit_account: formData.get('credit_account'),
      actor_type: formData.get('actor_type'),
      actor_id: formData.get('actor_id') ? parseInt(formData.get('actor_id')) : null,
      details: {
        description: formData.get('description'),
        reference: formData.get('reference'),
        notes: formData.get('notes')
      }
    };

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
      link.setAttribute('download', `receipt-${transaction.id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Receipt downloaded successfully!');
    } catch (error) {
      toast.error('Failed to download receipt');
    }
  };

  const getViewData = () => {
    if (selectedView === 'overview') return listData || {};
    return Array.isArray(listData) ? listData : [];
  };

  const getTotalAmounts = (items) => {
    // Ensure items is an array before using reduce
    const itemsArray = Array.isArray(items) ? items : [];
    return itemsArray.reduce((acc, item) => {
      acc.usd += parseFloat(item.total_usd || 0);
      acc.lbp += parseInt(item.total_lbp || 0);
      return acc;
    }, { usd: 0, lbp: 0 });
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
        <p className="text-red-600">Error loading accounting data: {error.message}</p>
        <button
          onClick={() => refetch()}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <RefreshCw className="w-4 h-4 inline mr-2" />
          Retry
        </button>
      </div>
    );
  }

  const viewData = getViewData();
  const totalAmounts = getTotalAmounts(selectedView === 'overview' ? [] : viewData);

  // Safety check - if no data is available, show a message
  if (!accountingData && !isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Accounting & Finance</h1>
            <p className="text-gray-600">Track all financial transactions and balances</p>
          </div>
        </div>
        <div className="bg-white p-8 rounded-lg shadow-sm border text-center">
          <div className="text-gray-500 text-lg mb-4">No accounting data available</div>
          <p className="text-gray-400">Accounting data will appear here once transactions are added.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accounting & Finance</h1>
          <p className="text-gray-600">Track all financial transactions and balances</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleAddTransaction}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Transaction
        </motion.button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search transactions, clients, or drivers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* View Tabs */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { key: 'overview', label: 'Overview', icon: TrendingUp },
              { key: 'clients', label: 'Clients', icon: Users },
              { key: 'drivers', label: 'Drivers', icon: Truck },
              { key: 'third_parties', label: 'Third Parties', icon: Building }
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => handleViewChange(key)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  selectedView === key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {selectedView === 'overview' ? (
            <OverviewView data={viewData} totalAmounts={totalAmounts} />
          ) : (
            <EntityListView 
              data={viewData} 
              viewType={selectedView}
              onEntitySelect={handleEntitySelect}
              selectedEntity={selectedEntity}
              entityDetails={entityDetails}
              onViewReceipt={handleViewReceipt}
              onDownloadStatement={downloadStatement}
              onCashout={(payload) => cashoutMutation.mutate(payload)}
              onExportImage={exportSectionAsImage}
            />
          )}
        </div>
      </div>

      {/* Add Transaction Modal */}
      <AnimatePresence>
        {isTransactionModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-4">Add New Transaction</h2>
                <form onSubmit={handleTransactionSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Transaction Type *
                      </label>
                      <select
                        name="tx_type"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="order">Order</option>
                        <option value="driver_payment">Driver Payment</option>
                        <option value="cash_in">Cash In</option>
                        <option value="cash_out">Cash Out</option>
                        <option value="third_party_fee">Third Party Fee</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Actor Type
                      </label>
                      <select
                        name="actor_type"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Select Type</option>
                        <option value="client">Client</option>
                        <option value="driver">Driver</option>
                        <option value="third_party">Third Party</option>
                        <option value="system">System</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      name="description"
                      placeholder="Transaction description"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Amount (USD)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        name="amount_usd"
                        placeholder="0.00"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Amount (LBP)
                      </label>
                      <input
                        type="number"
                        name="amount_lbp"
                        placeholder="0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Debit Account *
                      </label>
                      <select
                        name="debit_account"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="cashbox">Cashbox</option>
                        <option value="accounts_receivable">Accounts Receivable</option>
                        <option value="driver_payable">Driver Payable</option>
                        <option value="third_party_payable">Third Party Payable</option>
                        <option value="expenses">Expenses</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Credit Account *
                      </label>
                      <select
                        name="credit_account"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="cashbox">Cashbox</option>
                        <option value="revenue">Revenue</option>
                        <option value="accounts_payable">Accounts Payable</option>
                        <option value="driver_payable">Driver Payable</option>
                        <option value="third_party_payable">Third Party Payable</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Reference
                    </label>
                    <input
                      type="text"
                      name="reference"
                      placeholder="Order ID, invoice number, etc."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes
                    </label>
                    <textarea
                      name="notes"
                      rows={3}
                      placeholder="Additional notes..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setIsTransactionModalOpen(false)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={addTransactionMutation.isLoading}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {addTransactionMutation.isLoading ? 'Adding...' : 'Add Transaction'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Receipt Modal */}
      <AnimatePresence>
        {isReceiptModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">Transaction Receipt</h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => exportToPDF(selectedTransaction)}
                      className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      PDF
                    </button>
                    <button
                      onClick={() => setIsReceiptModalOpen(false)}
                      className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Close
                    </button>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg mb-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-gray-500">Transaction ID:</span>
                      <p className="font-medium">#{selectedTransaction?.id}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Date:</span>
                      <p className="font-medium">
                        {selectedTransaction?.created_at ? 
                          format(new Date(selectedTransaction.created_at), 'PPP') : 'N/A'
                        }
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Type:</span>
                      <p className="font-medium capitalize">{selectedTransaction?.tx_type?.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Amount:</span>
                      <p className="font-medium">
                        {formatCurrency(selectedTransaction?.amount_usd, 'USD')} / 
                        {formatCurrency(selectedTransaction?.amount_lbp, 'LBP')}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <span className="text-sm text-gray-500">Description:</span>
                    <p className="font-medium">{selectedTransaction?.details?.description || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Reference:</span>
                    <p className="font-medium">{selectedTransaction?.details?.reference || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Notes:</span>
                    <p className="font-medium">{selectedTransaction?.details?.notes || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Accounts:</span>
                    <p className="font-medium">
                      {selectedTransaction?.debit_account} → {selectedTransaction?.credit_account}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Overview Component
const OverviewView = ({ data, totalAmounts }) => {
  const stats = [
    {
      title: 'Total Revenue',
      value: formatCurrency(totalAmounts.usd, 'USD'),
      subtitle: formatCurrency(totalAmounts.lbp, 'LBP'),
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      title: 'Pending Payments',
      value: formatCurrency(data.pending_usd || 0, 'USD'),
      subtitle: formatCurrency(data.pending_lbp || 0, 'LBP'),
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100'
    },
    {
      title: 'Total Expenses',
      value: formatCurrency(data.expenses_usd || 0, 'USD'),
      subtitle: formatCurrency(data.expenses_lbp || 0, 'LBP'),
      icon: TrendingDown,
      color: 'text-red-600',
      bgColor: 'bg-red-100'
    },
    {
      title: 'Cashbox Balance',
      value: formatCurrency(data.cashbox_usd || 0, 'USD'),
      subtitle: formatCurrency(data.cashbox_lbp || 0, 'LBP'),
      icon: DollarSign,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white p-6 rounded-lg border border-gray-200"
          >
            <div className="flex items-center">
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-500">{stat.subtitle}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Recent Transactions</h3>
          <div className="space-y-3">
            {(data.recent_transactions || []).slice(0, 5).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-sm">{tx.tx_type}</p>
                  <p className="text-xs text-gray-500">{tx.details?.description}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-sm">{formatCurrency(tx.amount_usd, 'USD')}</p>
                  <p className="text-xs text-gray-500">{formatCurrency(tx.amount_lbp, 'LBP')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Top Clients</h3>
          <div className="space-y-3">
            {(data.top_clients || []).slice(0, 5).map((client) => (
              <div key={client.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-sm">{client.business_name}</p>
                  <p className="text-xs text-gray-500">{client.contact_person}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-sm">{formatCurrency(client.total_usd, 'USD')}</p>
                  <p className="text-xs text-gray-500">{formatCurrency(client.total_lbp, 'LBP')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Entity List Component
const EntityListView = ({ data, viewType, onEntitySelect, selectedEntity, entityDetails, onViewReceipt, onDownloadStatement, onCashout, onExportImage }) => {
  const getEntityIcon = (type) => {
    switch (type) {
      case 'clients': return Users;
      case 'drivers': return Truck;
      case 'third_parties': return Building;
      default: return Users;
    }
  };

  const getEntityTitle = (type) => {
    switch (type) {
      case 'clients': return 'Client';
      case 'drivers': return 'Driver';
      case 'third_parties': return 'Third Party';
      default: return 'Entity';
    }
  };

  const Icon = getEntityIcon(viewType);
  const entityTitle = getEntityTitle(viewType);

  const sectionRef = useRef(null);

  const handleCashout = () => {
    if (!selectedEntity) return;
    const amount_usd = parseFloat(prompt('Enter cashout amount in USD (0 if none):', '0')) || 0;
    const amount_lbp = parseInt(prompt('Enter cashout amount in LBP (0 if none):', '0')) || 0;
    const description = prompt('Optional description:', 'Cashout');
    const idOrName = viewType === 'third_parties' ? selectedEntity.name : selectedEntity.id;
    onCashout({ scope: viewType, idOrName, amount_usd, amount_lbp, description });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Entity List */}
      <div className="lg:col-span-1">
        <h3 className="text-lg font-semibold mb-4">{entityTitle}s</h3>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {data.map((entity) => (
            <motion.button
              key={entity.id}
              onClick={() => onEntitySelect(entity)}
              className={`w-full p-4 text-left rounded-lg border transition-colors ${
                selectedEntity?.id === entity.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Icon className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {entity.business_name || entity.full_name || entity.name}
                  </p>
                  <p className="text-sm text-gray-500 truncate">
                    {entity.contact_person || entity.phone || entity.address}
                  </p>
                </div>
              </div>
              <div className="mt-2 text-right">
                <p className="text-sm font-medium text-gray-900">
                  {formatCurrency(entity.total_usd || 0, 'USD')}
                </p>
                <p className="text-xs text-gray-500">
                  {formatCurrency(entity.total_lbp || 0, 'LBP')}
                </p>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Transactions */}
      <div className="lg:col-span-2" ref={sectionRef}>
        <h3 className="text-lg font-semibold mb-4">
          {selectedEntity ? `${entityTitle} Transactions` : 'All Transactions'}
        </h3>
        {selectedEntity ? (
          <div className="space-y-3">
            <div className="flex justify-end gap-2 mb-2">
              <button
                onClick={() => onExportImage(sectionRef, `${entityTitle.toLowerCase()}-${selectedEntity.id || selectedEntity.name}`)}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                Export Image
              </button>
              <button
                onClick={() => onDownloadStatement(viewType.slice(0,-1), selectedEntity.id, 'csv')}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                Download CSV
              </button>
              <button
                onClick={() => onDownloadStatement(viewType.slice(0,-1), selectedEntity.id, 'pdf')}
                className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                Download PDF
              </button>
              <button
                onClick={handleCashout}
                className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Cash Out
              </button>
            </div>
            {(entityDetails?.transactions || []).map((tx) => (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white p-4 rounded-lg border border-gray-200 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        tx.amount_usd > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {tx.amount_usd > 0 ? 'Credit' : 'Debit'}
                      </span>
                      <span className="text-sm font-medium text-gray-900 capitalize">
                        {tx.tx_type?.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {tx.details?.description || 'No description'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {tx.created_at ? format(new Date(tx.created_at), 'PPP') : 'N/A'}
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-medium text-gray-900">
                      {formatCurrency(tx.amount_usd, 'USD')}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatCurrency(tx.amount_lbp, 'LBP')}
                    </p>
                    <button
                      onClick={() => onViewReceipt(tx)}
                      className="mt-2 px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                    >
                      View Receipt
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
            {(entityDetails?.transactions || []).length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No transactions found for this {entityTitle.toLowerCase()}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            Select a {entityTitle.toLowerCase()} to view their transactions
          </div>
        )}
      </div>
    </div>
  );
};

export default Accounting;
