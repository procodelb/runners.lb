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
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState('');

  const queryClient = useQueryClient();

  // Fetch cashbox balance
  const { data: cashboxData, isLoading: isLoadingCashbox } = useQuery(
    ['cashbox', 'balance'],
    () => api.get('/cashbox/balance'),
    { refetchInterval: 30000 }
  );

  // Fetch cashbox timeline
  const { data: timelineData, isLoading: isLoadingTimeline } = useQuery(
    ['cashbox', 'timeline'],
    () => api.get('/cashbox/timeline?limit=10'),
    { refetchInterval: 30000 }
  );

  // Mutations
  const addIncomeMutation = useMutation(
    (incomeData) => api.post('/cashbox/income', incomeData),
    {
      onSuccess: () => {
        // Invalidate all cashbox-related queries (balance, timeline)
        queryClient.invalidateQueries('cashbox');
        setShowIncomeModal(false);
        toast.success('Income added successfully');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to add income');
      }
    }
  );

  const addExpenseMutation = useMutation(
    (expenseData) => api.post('/cashbox/expense', expenseData),
    {
      onSuccess: () => {
        // Invalidate all cashbox-related queries
        queryClient.invalidateQueries('cashbox');
        setShowExpenseModal(false);
        toast.success('Expense added successfully');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to add expense');
      }
    }
  );

  const handleAddIncome = (incomeData) => {
    addIncomeMutation.mutate(incomeData);
  };

  const handleAddExpense = (expenseData) => {
    addExpenseMutation.mutate(expenseData);
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
            onClick={() => setShowIncomeModal(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 transition-colors text-lg font-medium"
          >
            <Plus className="w-6 h-6" />
            Add Income
          </button>
          <button
            onClick={() => setShowExpenseModal(true)}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 transition-colors text-lg font-medium"
          >
            <Minus className="w-6 h-6" />
            Add Expense
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

      {/* Recent Timeline */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
        <div className="space-y-3">
          {isLoadingTimeline ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : (timelineData?.data || []).length > 0 ? (
            (timelineData?.data || []).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${getEntryTypeColor(entry.tx_type)}`}>
                    {getEntryTypeIcon(entry.tx_type)}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{entry.tx_type.replace('_', ' ').toUpperCase()}</p>
                    <p className="text-xs text-gray-500">{entry.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-sm">
                    {formatCurrency(entry.amount_usd, 'USD')}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatCurrency(entry.amount_lbp, 'LBP')}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatDate(entry.created_at)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">
              No recent activity
            </div>
          )}
        </div>
      </div>

      {/* Income Modal */}
      <AnimatePresence>
        {showIncomeModal && (
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
                <h2 className="text-2xl font-bold">Add Income</h2>
                <button
                  onClick={() => setShowIncomeModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <IncomeForm onSubmit={handleAddIncome} onCancel={() => setShowIncomeModal(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expense Modal */}
      <AnimatePresence>
        {showExpenseModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setShowExpenseModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Add Expense</h2>
                <button
                  onClick={() => setShowExpenseModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <ExpenseForm onSubmit={handleAddExpense} onCancel={() => setShowExpenseModal(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

// Income Form Component
const IncomeForm = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    amount_usd: '',
    amount_lbp: '',
    description: '',
    notes: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Amount USD</label>
          <input
            type="number"
            name="amount_usd"
            value={formData.amount_usd}
            onChange={handleChange}
            step="0.01"
            placeholder="0.00"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Amount LBP</label>
          <input
            type="number"
            name="amount_lbp"
            value={formData.amount_lbp}
            onChange={handleChange}
            step="1000"
            placeholder="0"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
        <input
          type="text"
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="e.g., Sales revenue, Service payment"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
        <textarea
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          rows={3}
          placeholder="Additional details..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
        >
          Add Income
        </button>
      </div>
    </form>
  );
};

// Expense Form Component
const ExpenseForm = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    amount_usd: '',
    amount_lbp: '',
    category_title: '',
    category_item: '',
    description: '',
    notes: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const description = formData.description || `${formData.category_title} - ${formData.category_item}`;
    onSubmit({
      amount_usd: formData.amount_usd,
      amount_lbp: formData.amount_lbp,
      description
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Amount USD</label>
          <input
            type="number"
            name="amount_usd"
            value={formData.amount_usd}
            onChange={handleChange}
            step="0.01"
            placeholder="0.00"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Amount LBP</label>
          <input
            type="number"
            name="amount_lbp"
            value={formData.amount_lbp}
            onChange={handleChange}
            step="1000"
            placeholder="0"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
      </div>

      {/* Expense Categories */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
          <select
            value={formData.category_title}
            onChange={(e) => setFormData(prev => ({ ...prev, category_title: e.target.value, category_item: '' }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="">Select Category</option>
            <option value="Operations / Fleet">Operations / Fleet</option>
            <option value="Staff & HR">Staff & HR</option>
            <option value="Office & Admin">Office & Admin</option>
            <option value="Marketing & Sales">Marketing & Sales</option>
            <option value="Operations Support">Operations Support</option>
            <option value="Technology & Systems">Technology & Systems</option>
            <option value="Financial & Other">Financial & Other</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Item</label>
          <select
            value={formData.category_item}
            onChange={(e) => setFormData(prev => ({ ...prev, category_item: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="">Select Item</option>
            {formData.category_title === 'Operations / Fleet' && (
              <>
                <option>Driver Salaries & Wages</option>
                <option>Driver Overtime</option>
                <option>Delivery Fees Paid to Subcontractors</option>
                <option>Fuel Expense</option>
                <option>Vehicle Maintenance & Repairs</option>
                <option>Vehicle Insurance</option>
                <option>Vehicle Registration & Licensing</option>
                <option>Bike/Car Rental</option>
              </>
            )}
            {formData.category_title === 'Staff & HR' && (
              <>
                <option>Staff Salaries & Wages</option>
                <option>Employee Benefits</option>
                <option>Training & Recruitment</option>
              </>
            )}
            {formData.category_title === 'Office & Admin' && (
              <>
                <option>Rent</option>
                <option>Utilities</option>
                <option>Office Supplies</option>
                <option>Software Subscriptions</option>
                <option>Phone & Communication</option>
                <option>Bank Fees & Charges</option>
                <option>Professional Fees</option>
              </>
            )}
            {formData.category_title === 'Marketing & Sales' && (
              <>
                <option>Advertising & Promotions</option>
                <option>Branding & Design</option>
                <option>Sponsorships / Community Events</option>
              </>
            )}
            {formData.category_title === 'Operations Support' && (
              <>
                <option>Packaging Materials</option>
                <option>Uniforms</option>
              </>
            )}
            {formData.category_title === 'Technology & Systems' && (
              <>
                <option>Website & Hosting</option>
                <option>App Development & Maintenance</option>
                <option>IT Support & Repairs</option>
              </>
            )}
            {formData.category_title === 'Financial & Other' && (
              <>
                <option>Depreciation</option>
                <option>Currency Exchange / Transfer Fees</option>
                <option>Miscellaneous Expenses</option>
              </>
            )}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
        <input
          type="text"
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="e.g., Office supplies, Fuel, Maintenance"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
        <textarea
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          rows={3}
          placeholder="Additional details..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
        />
      </div>

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
        >
          Add Expense
        </button>
      </div>
    </form>
  );
};

export default Cashbox;

