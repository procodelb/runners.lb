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
  Clock,
  CheckCircle,
  AlertCircle,
  X,
  Save,
  Loader2,
  Edit3,
  Trash2,
  CreditCard,
  Receipt,
  FileSpreadsheet,
  Image
} from 'lucide-react';
import api from '../api';
import { format } from 'date-fns';
import html2canvas from 'html2canvas';

const NewAccounting = () => {
  const [activeTab, setActiveTab] = useState('clients');
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({
    from: format(new Date().setDate(1), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd')
  });
  const [showCashoutModal, setShowCashoutModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [cashoutData, setCashoutData] = useState({
    amount_usd: 0,
    amount_lbp: 0,
    description: ''
  });

  const queryClient = useQueryClient();
  const sectionRef = useRef(null);

  // Fetch entities based on active tab
  const { data: entities, isLoading, error, refetch } = useQuery(
    ['accounting-entities', activeTab, dateRange, searchTerm],
    async () => {
      let endpoint = '';
      switch (activeTab) {
        case 'clients':
          endpoint = '/accounting/clients';
          break;
        case 'drivers':
          endpoint = '/accounting/drivers';
          break;
        case 'third_parties':
          endpoint = '/accounting/thirdparty';
          break;
        default:
          endpoint = '/accounting/clients';
      }
      
      const res = await api.get(endpoint, { 
        params: { 
          from_date: dateRange.from, 
          to_date: dateRange.to, 
          search: searchTerm 
        } 
      });
      return res.data?.data || [];
    },
    { refetchInterval: 30000 }
  );

  // Fetch entity details when selected
  const { data: entityDetails } = useQuery(
    ['accounting-entity-details', activeTab, selectedEntity?.id || selectedEntity?.name, dateRange],
    async () => {
      if (!selectedEntity) return null;
      
      let endpoint = '';
      let identifier = '';
      
      switch (activeTab) {
        case 'clients':
          endpoint = `/accounting/clients/${selectedEntity.id}`;
          break;
        case 'drivers':
          endpoint = `/accounting/drivers/${selectedEntity.id}`;
          break;
        case 'third_parties':
          endpoint = `/accounting/thirdparty/${selectedEntity.name}`;
          break;
        default:
          return null;
      }
      
      const res = await api.get(endpoint, { 
        params: { 
          from_date: dateRange.from, 
          to_date: dateRange.to 
        } 
      });
      return res.data?.data;
    },
    { enabled: !!selectedEntity }
  );

  // Cashout mutation
  const cashoutMutation = useMutation(
    async (data) => {
      let endpoint = '';
      let identifier = '';
      
      switch (activeTab) {
        case 'clients':
          endpoint = `/accounting/clients/${selectedEntity.id}/cashout`;
          break;
        case 'drivers':
          endpoint = `/accounting/drivers/${selectedEntity.id}/cashout`;
          break;
        case 'third_parties':
          endpoint = `/accounting/thirdparty/${selectedEntity.name}/cashout`;
          break;
        default:
          throw new Error('Invalid tab');
      }
      
      return api.post(endpoint, data);
    },
    {
      onSuccess: () => {
        toast.success('Cashout completed successfully!');
        setShowCashoutModal(false);
        setCashoutData({ amount_usd: 0, amount_lbp: 0, description: '' });
        refetch();
        queryClient.invalidateQueries(['accounting-entity-details']);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Cashout failed');
      }
    }
  );

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSelectedEntity(null);
  };

  const handleEntitySelect = (entity) => {
    setSelectedEntity(entity);
  };

  const handleCashout = () => {
    if (!selectedEntity) return;
    setShowCashoutModal(true);
  };

  const handleCashoutSubmit = (e) => {
    e.preventDefault();
    cashoutMutation.mutate(cashoutData);
  };

  const exportToCSV = async () => {
    try {
      const response = await api.get('/accounting/export/csv', {
        params: {
          type: activeTab,
          entity_id: selectedEntity?.id || selectedEntity?.name,
          from_date: dateRange.from,
          to_date: dateRange.to
        },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${activeTab}-accounting-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('CSV exported successfully!');
    } catch (error) {
      toast.error('Failed to export CSV');
    }
  };

  const exportToExcel = async () => {
    try {
      const response = await api.get('/accounting/export/excel', {
        params: {
          type: activeTab,
          entity_id: selectedEntity?.id || selectedEntity?.name,
          from_date: dateRange.from,
          to_date: dateRange.to
        },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${activeTab}-accounting-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Excel file exported successfully!');
    } catch (error) {
      toast.error('Failed to export Excel file');
    }
  };

  const exportToPDF = async () => {
    try {
      const response = await api.get('/accounting/export/pdf', {
        params: {
          type: activeTab,
          entity_id: selectedEntity?.id || selectedEntity?.name,
          from_date: dateRange.from,
          to_date: dateRange.to
        },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${activeTab}-accounting-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('PDF exported successfully!');
    } catch (error) {
      toast.error('Failed to export PDF');
    }
  };

  const exportAsImage = async () => {
    try {
      if (!sectionRef.current) return;
      
      const canvas = await html2canvas(sectionRef.current, { 
        scale: 2, 
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${activeTab}-accounting-${new Date().toISOString().slice(0, 10)}.png`;
      link.click();
      
      toast.success('Image exported successfully!');
    } catch (error) {
      toast.error('Failed to export image');
    }
  };

  const formatCurrency = (amount, currency = 'USD') => {
    if (currency === 'USD') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amount || 0);
    } else if (currency === 'LBP') {
      return new Intl.NumberFormat('ar-LB', {
        style: 'currency',
        currency: 'LBP',
      }).format(amount || 0);
    }
    return amount || 0;
  };

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
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

  const Icon = getEntityIcon(activeTab);
  const entityTitle = getEntityTitle(activeTab);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accounting & Finance</h1>
          <p className="text-gray-600">Track all financial transactions and balances</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={exportAsImage}
            className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2"
          >
            <Image className="w-4 h-4" />
            Export Image
          </button>
          <button
            onClick={() => setShowExportModal(true)}
            className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder={`Search ${entityTitle.toLowerCase()}s...`}
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

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { key: 'clients', label: 'Clients Accounting', icon: Users },
              { key: 'drivers', label: 'Drivers Accounting', icon: Truck },
              { key: 'third_parties', label: 'Third Party Accounting', icon: Building }
            ].map(({ key, label, icon: TabIcon }) => (
              <button
                key={key}
                onClick={() => handleTabChange(key)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeTab === key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <TabIcon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6" ref={sectionRef}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Entity List */}
            <div className="lg:col-span-1">
              <h3 className="text-lg font-semibold mb-4">{entityTitle}s</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {entities.map((entity) => (
                  <motion.button
                    key={entity.id || entity.name}
                    onClick={() => handleEntitySelect(entity)}
                    className={`w-full p-4 text-left rounded-lg border transition-colors ${
                      selectedEntity?.id === entity.id || selectedEntity?.name === entity.name
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

            {/* Entity Details */}
            <div className="lg:col-span-2">
              {selectedEntity ? (
                <div className="space-y-6">
                  {/* Entity Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {entityTitle} Account Details
                      </h3>
                      <p className="text-sm text-gray-600">
                        {selectedEntity.business_name || selectedEntity.full_name || selectedEntity.name}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={handleCashout}
                        className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                      >
                        <CreditCard className="w-4 h-4" />
                        Cash Out
                      </button>
                    </div>
                  </div>

                  {/* Balance Summary */}
                  {entityDetails && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <div className="flex items-center">
                          <TrendingUp className="w-5 h-5 text-green-600" />
                          <div className="ml-3">
                            <p className="text-sm font-medium text-green-800">Total Revenue</p>
                            <p className="text-lg font-bold text-green-900">
                              {formatCurrency(entityDetails.total_revenue_usd || 0, 'USD')}
                            </p>
                            <p className="text-sm text-green-700">
                              {formatCurrency(entityDetails.total_revenue_lbp || 0, 'LBP')}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                        <div className="flex items-center">
                          <TrendingDown className="w-5 h-5 text-red-600" />
                          <div className="ml-3">
                            <p className="text-sm font-medium text-red-800">Total Expenses</p>
                            <p className="text-lg font-bold text-red-900">
                              {formatCurrency(entityDetails.total_expenses_usd || 0, 'USD')}
                            </p>
                            <p className="text-sm text-red-700">
                              {formatCurrency(entityDetails.total_expenses_lbp || 0, 'LBP')}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <div className="flex items-center">
                          <DollarSign className="w-5 h-5 text-blue-600" />
                          <div className="ml-3">
                            <p className="text-sm font-medium text-blue-800">Net Balance</p>
                            <p className="text-lg font-bold text-blue-900">
                              {formatCurrency(entityDetails.net_balance_usd || 0, 'USD')}
                            </p>
                            <p className="text-sm text-blue-700">
                              {formatCurrency(entityDetails.net_balance_lbp || 0, 'LBP')}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Orders/Transactions */}
                  <div>
                    <h4 className="text-md font-semibold text-gray-900 mb-4">
                      {activeTab === 'clients' ? 'Orders' : 'Operations'}
                    </h4>
                    <div className="space-y-3">
                      {(entityDetails?.orders || entityDetails?.transactions || []).map((item) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="bg-white p-4 rounded-lg border border-gray-200 hover:shadow-sm transition-shadow"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  item.amount_usd > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {item.amount_usd > 0 ? 'Credit' : 'Debit'}
                                </span>
                                <span className="text-sm font-medium text-gray-900">
                                  {item.order_ref || item.tx_type || 'Transaction'}
                                </span>
                                {item.status && (
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                    item.status === 'delivered' || item.status === 'completed' 
                                      ? 'bg-green-100 text-green-800'
                                      : item.status === 'paid' || item.status === 'prepaid'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {item.status}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 mt-1">
                                {item.customer_name || item.description || 'No description'}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {item.created_at ? format(new Date(item.created_at), 'PPP') : 'N/A'}
                              </p>
                            </div>
                            <div className="text-right ml-4">
                              <p className="font-medium text-gray-900">
                                {formatCurrency(item.total_usd || item.amount_usd, 'USD')}
                              </p>
                              <p className="text-sm text-gray-500">
                                {formatCurrency(item.total_lbp || item.amount_lbp, 'LBP')}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                    {(entityDetails?.orders || entityDetails?.transactions || []).length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        No {activeTab === 'clients' ? 'orders' : 'operations'} found for this {entityTitle.toLowerCase()}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Select a {entityTitle.toLowerCase()} to view their account details
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Cashout Modal */}
      <AnimatePresence>
        {showCashoutModal && (
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
              className="bg-white rounded-lg shadow-xl max-w-md w-full"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Cash Out</h3>
                  <button
                    onClick={() => setShowCashoutModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <form onSubmit={handleCashoutSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Amount (USD)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={cashoutData.amount_usd}
                      onChange={(e) => setCashoutData({ ...cashoutData, amount_usd: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Amount (LBP)
                    </label>
                    <input
                      type="number"
                      value={cashoutData.amount_lbp}
                      onChange={(e) => setCashoutData({ ...cashoutData, amount_lbp: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={cashoutData.description}
                      onChange={(e) => setCashoutData({ ...cashoutData, description: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Cashout description..."
                    />
                  </div>
                  
                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowCashoutModal(false)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={cashoutMutation.isLoading}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {cashoutMutation.isLoading ? 'Processing...' : 'Cash Out'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Export Modal */}
      <AnimatePresence>
        {showExportModal && (
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
              className="bg-white rounded-lg shadow-xl max-w-md w-full"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Export Data</h3>
                  <button
                    onClick={() => setShowExportModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      exportToCSV();
                      setShowExportModal(false);
                    }}
                    className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-3"
                  >
                    <FileSpreadsheet className="w-5 h-5" />
                    Export as CSV
                  </button>
                  
                  <button
                    onClick={() => {
                      exportToExcel();
                      setShowExportModal(false);
                    }}
                    className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-3"
                  >
                    <FileText className="w-5 h-5" />
                    Export as Excel
                  </button>
                  
                  <button
                    onClick={() => {
                      exportToPDF();
                      setShowExportModal(false);
                    }}
                    className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-3"
                  >
                    <Receipt className="w-5 h-5" />
                    Export as PDF
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NewAccounting;
