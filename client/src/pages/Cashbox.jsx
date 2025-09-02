import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wallet, 
  Plus, 
  Minus, 
  DollarSign, 
  Truck, 
  User, 
  Building,
  Download,
  Eye,
  Edit,
  Trash2,
  Search,
  Filter,
  RefreshCw,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate } from '../utils/formatters';
import api from '../api';

const Cashbox = () => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDriverAdvanceModal, setShowDriverAdvanceModal] = useState(false);
  const [showDriverReturnModal, setShowDriverReturnModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage] = useState(20);

  const queryClient = useQueryClient();

  // Fetch cashbox data
  const { data: cashboxData, isLoading: isLoadingCashbox } = useQuery(
    ['cashbox', 'overview'],
    () => api.get('/cashbox'),
    { refetchInterval: 30000 }
  );

  // Fetch cashbox entries
  const { data: entriesData, isLoading: isLoadingEntries } = useQuery(
    ['cashbox', 'entries', currentPage, filterType, searchTerm],
    () => api.get(`/cashbox/entries?page=${currentPage}&type=${filterType}&search=${searchTerm}`),
    { 
      keepPreviousData: true,
      select: (response) => {
        // Ensure we always have a data array
        const data = response?.data?.data || [];
        const pagination = response?.data?.pagination || {};
        return { data, pagination };
      }
    }
  );

  // Fetch drivers for advance modal
  const { data: drivers } = useQuery(['drivers'], () => api.get('/drivers'), {
    select: (response) => response.data?.data || []
  });

  // Fetch clients for cash operations
  const { data: clients } = useQuery(['clients'], () => api.get('/clients'), {
    select: (response) => response.data?.data || []
  });

  // Mutations
  const addEntryMutation = useMutation(
    (entryData) => api.post('/cashbox/entry', entryData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['cashbox']);
        setShowAddModal(false);
        toast.success('Cashbox entry added successfully');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to add entry');
      }
    }
  );

  const driverAdvanceMutation = useMutation(
    (advanceData) => api.post('/cashbox/driver-advance', advanceData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['cashbox']);
        setShowDriverAdvanceModal(false);
        toast.success('Driver advance processed successfully');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to process advance');
      }
    }
  );

  const driverReturnMutation = useMutation(
    (returnData) => api.post('/cashbox/driver-return', returnData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['cashbox']);
        setShowDriverReturnModal(false);
        toast.success('Driver return processed successfully');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to process return');
      }
    }
  );

  const assignMutation = useMutation(
    (assignData) => api.post('/cashbox/assign', assignData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['cashbox']);
        setShowAssignModal(false);
        toast.success('Assignment recorded');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to assign');
      }
    }
  );

  const refundMutation = useMutation(
    (refundData) => api.post('/cashbox/refund', refundData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['cashbox']);
        setShowRefundModal(false);
        toast.success('Refund applied');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to apply refund');
      }
    }
  );

  const deleteEntryMutation = useMutation(
    (id) => api.delete(`/cashbox/entry/${id}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['cashbox']);
        toast.success('Entry deleted successfully');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to delete entry');
      }
    }
  );

  const handleAddEntry = (entryData) => {
    addEntryMutation.mutate(entryData);
  };

  const handleDriverAdvance = (advanceData) => {
    driverAdvanceMutation.mutate(advanceData);
  };

  const handleDriverReturn = (returnData) => {
    driverReturnMutation.mutate(returnData);
  };

  const handleDeleteEntry = (id) => {
    if (window.confirm('Are you sure you want to delete this entry?')) {
      deleteEntryMutation.mutate(id);
    }
  };

  const getEntryTypeColor = (type) => {
    const colors = {
      'cash_in': 'bg-green-100 text-green-800',
      'cash_out': 'bg-red-100 text-red-800',
      'driver_advance': 'bg-yellow-100 text-yellow-800',
      'driver_return': 'bg-blue-100 text-blue-800',
      'client_payment': 'bg-green-100 text-green-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const getEntryTypeIcon = (type) => {
    const icons = {
      'cash_in': <Plus className="w-4 h-4" />,
      'cash_out': <Minus className="w-4 h-4" />,
      'driver_advance': <Truck className="w-4 h-4" />,
      'driver_return': <Truck className="w-4 h-4" />,
      'client_payment': <DollarSign className="w-4 h-4" />
    };
    return icons[type] || <Wallet className="w-4 h-4" />;
  };

  if (isLoadingCashbox) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Cashbox Management</h1>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Entry
          </button>
          <button
            onClick={() => setShowDriverAdvanceModal(true)}
            className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Truck className="w-5 h-5" />
            Driver Advance
          </button>
          <button
            onClick={() => setShowDriverReturnModal(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Truck className="w-5 h-5" />
            Driver Return
          </button>
          <button
            onClick={() => setShowAssignModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Truck className="w-5 h-5" />
            Assign Cash
          </button>
          <button
            onClick={() => setShowRefundModal(true)}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <DollarSign className="w-5 h-5" />
            Refund
          </button>
        </div>
      </div>

      {/* Balance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">USD Balance</h3>
              <p className="text-3xl font-bold text-green-600">
                {formatCurrency(cashboxData?.data?.balance_usd || 0, 'USD')}
              </p>
            </div>
            <DollarSign className="w-12 h-12 text-green-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">LBP Balance</h3>
              <p className="text-3xl font-bold text-blue-600">
                {formatCurrency(cashboxData?.data?.balance_lbp || 0, 'LBP')}
              </p>
            </div>
            <Wallet className="w-12 h-12 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <input
              type="text"
              placeholder="Search entries..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="cash_in">Cash In</option>
              <option value="cash_out">Cash Out</option>
              <option value="driver_advance">Driver Advance</option>
              <option value="driver_return">Driver Return</option>
              <option value="client_payment">Client Payment</option>
            </select>
          </div>
          <div>
            <button
              onClick={() => queryClient.invalidateQueries(['cashbox'])}
              className="w-full px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md flex items-center justify-center gap-2 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Entries Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Entry Details
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actor
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {(entriesData?.data || []).map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-3 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className={`p-2 rounded-full ${getEntryTypeColor(entry.entry_type)}`}>
                        {getEntryTypeIcon(entry.entry_type)}
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900">
                          {entry.entry_type.replace('_', ' ').toUpperCase()}
                        </div>
                        <div className="text-sm text-gray-500">
                          {entry.description}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {formatCurrency(entry.amount_usd, 'USD')}
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatCurrency(entry.amount_lbp, 'LBP')}
                    </div>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {entry.driver_name || entry.created_by_name || 'System'}
                    </div>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {formatDate(entry.created_at)}
                    </div>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setSelectedEntry(entry)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteEntry(entry.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {entriesData?.pagination && entriesData.pagination.total > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6 mt-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {((entriesData.pagination.page - 1) * entriesData.pagination.limit) + 1} to{' '}
              {Math.min(entriesData.pagination.page * entriesData.pagination.limit, entriesData.pagination.total)} of{' '}
              {entriesData.pagination.total} results
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(prev => prev + 1)}
                disabled={currentPage >= entriesData.pagination.pages}
                className="px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Entry Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg p-6 w-full max-w-md"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Add Cashbox Entry</h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <AddEntryForm onSubmit={handleAddEntry} onCancel={() => setShowAddModal(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Driver Advance Modal */}
      <AnimatePresence>
        {showDriverAdvanceModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg p-6 w-full max-w-md"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Driver Advance</h2>
                <button
                  onClick={() => setShowDriverAdvanceModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <DriverAdvanceForm onSubmit={handleDriverAdvance} onCancel={() => setShowDriverAdvanceModal(false)} drivers={drivers} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Driver Return Modal */}
      <AnimatePresence>
        {showDriverReturnModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg p-6 w-full max-w-md"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Driver Return</h2>
                <button
                  onClick={() => setShowDriverReturnModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <DriverReturnForm onSubmit={handleDriverReturn} onCancel={() => setShowDriverReturnModal(false)} drivers={drivers} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Assign Modal */}
      <AnimatePresence>
        {showAssignModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-lg p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Assign Cash to Driver</h2>
                <button onClick={() => setShowAssignModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
              </div>
              <AssignForm onSubmit={(data) => assignMutation.mutate(data)} onCancel={() => setShowAssignModal(false)} drivers={drivers} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Refund Modal */}
      <AnimatePresence>
        {showRefundModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-lg p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Apply Refund to Cashbox</h2>
                <button onClick={() => setShowRefundModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
              </div>
              <RefundForm onSubmit={(data) => refundMutation.mutate(data)} onCancel={() => setShowRefundModal(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Entry Detail Modal */}
      <AnimatePresence>
        {selectedEntry && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg p-6 w-full max-w-md"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Entry Details</h2>
                <button
                  onClick={() => setSelectedEntry(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <EntryDetailView entry={selectedEntry} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Add Entry Form Component
const AddEntryForm = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    type: 'cash_in',
    amount_usd: '',
    amount_lbp: '',
    description: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Entry Type
        </label>
        <select
          name="type"
          value={formData.type}
          onChange={handleInputChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="cash_in">Cash In</option>
          <option value="cash_out">Cash Out</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Amount USD
        </label>
        <input
          type="number"
          step="0.01"
          name="amount_usd"
          value={formData.amount_usd}
          onChange={handleInputChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Amount LBP
        </label>
        <input
          type="number"
          name="amount_lbp"
          value={formData.amount_lbp}
          onChange={handleInputChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Description
        </label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleInputChange}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Add Entry
        </button>
      </div>
    </form>
  );
};

// Driver Advance Form Component
const DriverAdvanceForm = ({ onSubmit, onCancel, drivers }) => {
  const [formData, setFormData] = useState({
    driver_id: '',
    amount_usd: '',
    amount_lbp: '',
    description: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Driver
        </label>
        <select
          name="driver_id"
          value={formData.driver_id}
          onChange={handleInputChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        >
          <option value="">Select Driver</option>
          {drivers?.map(driver => (
            <option key={driver.id} value={driver.id}>
              {driver.full_name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Amount USD
        </label>
        <input
          type="number"
          step="0.01"
          name="amount_usd"
          value={formData.amount_usd}
          onChange={handleInputChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Amount LBP
        </label>
        <input
          type="number"
          name="amount_lbp"
          value={formData.amount_lbp}
          onChange={handleInputChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Description
        </label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleInputChange}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors"
        >
          Process Advance
        </button>
      </div>
    </form>
  );
};

// Driver Return Form Component
const DriverReturnForm = ({ onSubmit, onCancel, drivers }) => {
  const [formData, setFormData] = useState({
    driver_id: '',
    amount_usd: '',
    amount_lbp: '',
    description: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Driver
        </label>
        <select
          name="driver_id"
          value={formData.driver_id}
          onChange={handleInputChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        >
          <option value="">Select Driver</option>
          {drivers?.map(driver => (
            <option key={driver.id} value={driver.id}>
              {driver.full_name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Amount USD
        </label>
        <input
          type="number"
          step="0.01"
          name="amount_usd"
          value={formData.amount_usd}
          onChange={handleInputChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Amount LBP
        </label>
        <input
          type="number"
          name="amount_lbp"
          value={formData.amount_lbp}
          onChange={handleInputChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Description
        </label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleInputChange}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
        >
          Process Return
        </button>
      </div>
    </form>
  );
};

// Entry Detail View Component
const EntryDetailView = ({ entry }) => {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Entry Type</label>
        <p className="text-sm text-gray-900">{entry.entry_type.replace('_', ' ').toUpperCase()}</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Amount USD</label>
        <p className="text-sm text-gray-900">{formatCurrency(entry.amount_usd, 'USD')}</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Amount LBP</label>
        <p className="text-sm text-gray-900">{formatCurrency(entry.amount_lbp, 'LBP')}</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Description</label>
        <p className="text-sm text-gray-900">{entry.description || 'No description'}</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Created By</label>
        <p className="text-sm text-gray-900">{entry.created_by_name || 'System'}</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Date</label>
        <p className="text-sm text-gray-900">{formatDate(entry.created_at)}</p>
      </div>
    </div>
  );
};

export default Cashbox;


// Assign Form Component
const AssignForm = ({ onSubmit, onCancel, drivers }) => {
  const [formData, setFormData] = useState({
    assign_date: new Date().toISOString().slice(0,10),
    driver_id: '',
    assigned_usd: '',
    assigned_lbp: '',
    notes: ''
  });

  const handleSubmit = (e) => { e.preventDefault(); onSubmit(formData); };
  const handleInputChange = (e) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value })); };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
        <input type="date" name="assign_date" value={formData.assign_date} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Driver</label>
        <select name="driver_id" value={formData.driver_id} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" required>
          <option value="">Select Driver</option>
          {drivers?.map(driver => (<option key={driver.id} value={driver.id}>{driver.full_name}</option>))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Assigned USD</label>
        <input type="number" step="0.01" name="assigned_usd" value={formData.assigned_usd} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Assigned LBP</label>
        <input type="number" name="assigned_lbp" value={formData.assigned_lbp} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
        <textarea name="notes" value={formData.notes} onChange={handleInputChange} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div className="flex justify-end space-x-3">
        <button type="button" onClick={onCancel} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors">Assign</button>
      </div>
    </form>
  );
};

// Refund Form Component
const RefundForm = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({ refund_usd: '', refund_lbp: '' });
  const handleSubmit = (e) => { e.preventDefault(); onSubmit(formData); };
  const handleInputChange = (e) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value })); };
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Refund USD</label>
        <input type="number" step="0.01" name="refund_usd" value={formData.refund_usd} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Refund LBP</label>
        <input type="number" name="refund_lbp" value={formData.refund_lbp} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div className="flex justify-end space-x-3">
        <button type="button" onClick={onCancel} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
        <button type="submit" className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors">Apply Refund</button>
      </div>
    </form>
  );
};

