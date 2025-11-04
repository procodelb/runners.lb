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
  X,
  CreditCard,
  PiggyBank,
  ArrowUpDown,
  Settings,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate } from '../utils/formatters';
import api from '../api';
import { cashboxApi } from '../api/cashbox';

const Cashbox = () => {
  const [showCapitalModal, setShowCapitalModal] = useState(false);
  const [showEditCapitalModal, setShowEditCapitalModal] = useState(false);
  const [showExpenseCapitalModal, setShowExpenseCapitalModal] = useState(false);
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);

  const queryClient = useQueryClient();

  // Fetch cashbox balance
  const { data: cashboxData, isLoading: isLoadingCashbox } = useQuery(
    ['cashbox', 'balance'],
    () => cashboxApi.getBalance(),
    { 
      refetchInterval: 30000,
      refetchOnWindowFocus: true
    }
  );

  // Fetch cashbox timeline
  const { data: timelineData, isLoading: isLoadingTimeline } = useQuery(
    ['cashbox', 'timeline'],
    () => cashboxApi.getTimeline({ limit: 10 }),
    { 
      refetchInterval: 30000,
      refetchOnWindowFocus: true
    }
  );

  // Fetch expense categories
  const { data: expenseCategoriesData } = useQuery(
    ['cashbox', 'expense-categories'],
    () => cashboxApi.getExpenseCategories()
  );

  // Mutations
  const setCapitalMutation = useMutation(
    (capitalData) => cashboxApi.setCapital(capitalData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['cashbox']);
        queryClient.refetchQueries(['cashbox', 'balance']);
        queryClient.refetchQueries(['cashbox', 'timeline']);
        setShowCapitalModal(false);
        toast.success('Capital set successfully');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to set capital');
      }
    }
  );

  const editCapitalMutation = useMutation(
    (capitalData) => cashboxApi.editCapital(capitalData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['cashbox']);
        queryClient.refetchQueries(['cashbox', 'balance']);
        queryClient.refetchQueries(['cashbox', 'timeline']);
        setShowEditCapitalModal(false);
        toast.success('Capital updated successfully');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update capital');
      }
    }
  );

  const addIncomeMutation = useMutation(
    (incomeData) => cashboxApi.addIncome(incomeData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['cashbox']);
        queryClient.refetchQueries(['cashbox', 'balance']);
        queryClient.refetchQueries(['cashbox', 'timeline']);
        setShowIncomeModal(false);
        toast.success('Income added successfully');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to add income');
      }
    }
  );

  const addExpenseMutation = useMutation(
    (expenseData) => cashboxApi.addExpense(expenseData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['cashbox']);
        queryClient.refetchQueries(['cashbox', 'balance']);
        queryClient.refetchQueries(['cashbox', 'timeline']);
        setShowExpenseModal(false);
        toast.success('Expense added successfully');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to add expense');
      }
    }
  );

  const expenseCapitalMutation = useMutation(
    (capitalData) => cashboxApi.expenseCapital(capitalData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['cashbox']);
        queryClient.refetchQueries(['cashbox', 'balance']);
        queryClient.refetchQueries(['cashbox', 'timeline']);
        setShowExpenseCapitalModal(false);
        toast.success('Capital expense recorded successfully');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to record capital expense');
      }
    }
  );

  const transferMutation = useMutation(
    (transferData) => cashboxApi.transfer(transferData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['cashbox']);
        queryClient.refetchQueries(['cashbox', 'balance']);
        queryClient.refetchQueries(['cashbox', 'timeline']);
        setShowTransferModal(false);
        toast.success('Transfer completed successfully');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to process transfer');
      }
    }
  );

  const handleSetCapital = (capitalData) => {
    setCapitalMutation.mutate(capitalData);
  };

  const handleEditCapital = (capitalData) => {
    editCapitalMutation.mutate(capitalData);
  };

  const handleAddIncome = (incomeData) => {
    addIncomeMutation.mutate(incomeData);
  };

  const handleAddExpense = (expenseData) => {
    addExpenseMutation.mutate(expenseData);
  };

  const handleExpenseCapital = (capitalData) => {
    expenseCapitalMutation.mutate(capitalData);
  };

  const handleTransfer = (transferData) => {
    transferMutation.mutate(transferData);
  };

  const getEntryTypeColor = (type) => {
    const colors = {
      'cash_in': 'bg-green-100 text-green-800',
      'cash_out': 'bg-red-100 text-red-800',
      'income': 'bg-green-100 text-green-800',
      'expense': 'bg-red-100 text-red-800',
      'capital_add': 'bg-blue-100 text-blue-800',
      'capital_edit': 'bg-purple-100 text-purple-800',
      'capital_expense': 'bg-rose-100 text-rose-800',
      'driver_advance': 'bg-yellow-100 text-yellow-800',
      'driver_return': 'bg-blue-100 text-blue-800',
      'client_payment': 'bg-green-100 text-green-800',
      'order_deduction': 'bg-pink-100 text-pink-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const getEntryTypeIcon = (type) => {
    const icons = {
      'cash_in': <TrendingUp className="w-4 h-4" />,
      'cash_out': <TrendingDown className="w-4 h-4" />,
      'income': <TrendingUp className="w-4 h-4" />,
      'expense': <TrendingDown className="w-4 h-4" />,
      'capital_add': <PiggyBank className="w-4 h-4" />,
      'capital_edit': <Settings className="w-4 h-4" />,
      'capital_expense': <Minus className="w-4 h-4" />,
      'driver_advance': <Truck className="w-4 h-4" />,
      'driver_return': <Truck className="w-4 h-4" />,
      'client_payment': <DollarSign className="w-4 h-4" />,
      'order_deduction': <CreditCard className="w-4 h-4" />
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

  const cashbox = cashboxData?.data || {};
  const hasCapital = cashbox.initial_capital_usd > 0 || cashbox.initial_capital_lbp > 0;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header Section */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Cashbox Management</h1>
        <p className="text-lg text-gray-600">Manage your business finances and track cash flow</p>
      </div>

      {/* Action Buttons Row */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 text-center">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {!hasCapital ? (
            <button
              onClick={() => setShowCapitalModal(true)}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-4 py-3 rounded-lg flex flex-col items-center gap-2 transition-all duration-200 transform hover:scale-105 shadow-md"
            >
              <PiggyBank className="w-6 h-6" />
              <span className="font-medium">Set Capital</span>
            </button>
          ) : (
            <button
              onClick={() => setShowEditCapitalModal(true)}
              className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white px-4 py-3 rounded-lg flex flex-col items-center gap-2 transition-all duration-200 transform hover:scale-105 shadow-md"
            >
              <Edit className="w-6 h-6" />
              <span className="font-medium">Edit Capital</span>
            </button>
          )}
          <button
            onClick={() => setShowExpenseCapitalModal(true)}
            className="bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white px-4 py-3 rounded-lg flex flex-col items-center gap-2 transition-all duration-200 transform hover:scale-105 shadow-md"
          >
            <Minus className="w-6 h-6" />
            <span className="font-medium">Expense Capital</span>
          </button>
          <button
            onClick={() => setShowTransferModal(true)}
            className="bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white px-4 py-3 rounded-lg flex flex-col items-center gap-2 transition-all duration-200 transform hover:scale-105 shadow-md"
          >
            <ArrowUpDown className="w-6 h-6" />
            <span className="font-medium">Capital Transfer</span>
          </button>
          <button
            onClick={() => setShowIncomeModal(true)}
            className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-4 py-3 rounded-lg flex flex-col items-center gap-2 transition-all duration-200 transform hover:scale-105 shadow-md"
          >
            <Plus className="w-6 h-6" />
            <span className="font-medium">Add Income</span>
          </button>
          <button
            onClick={() => setShowExpenseModal(true)}
            className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-4 py-3 rounded-lg flex flex-col items-center gap-2 transition-all duration-200 transform hover:scale-105 shadow-md"
          >
            <Minus className="w-6 h-6" />
            <span className="font-medium">Add Expense</span>
          </button>
        </div>
      </div>

      {/* Main Balance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-gradient-to-br from-green-500 via-green-600 to-green-700 rounded-xl shadow-xl p-8 text-white transform hover:scale-105 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold opacity-90 mb-2">Total USD Balance</h3>
              <p className="text-5xl font-bold mb-2">
                {formatCurrency(cashbox.balance_usd || 0, 'USD')}
              </p>
              {hasCapital && (
                <div className="bg-white bg-opacity-20 rounded-lg p-3 mt-3">
                  <p className="text-sm opacity-90 font-medium">
                    Capital: {formatCurrency(cashbox.initial_capital_usd || 0, 'USD')}
                  </p>
                </div>
              )}
            </div>
            <div className="bg-white bg-opacity-20 rounded-full p-4">
              <DollarSign className="w-12 h-12 opacity-90" />
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 rounded-xl shadow-xl p-8 text-white transform hover:scale-105 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold opacity-90 mb-2">Total LBP Balance</h3>
              <p className="text-5xl font-bold mb-2">
                {formatCurrency(cashbox.balance_lbp || 0, 'LBP')}
              </p>
              {hasCapital && (
                <div className="bg-white bg-opacity-20 rounded-lg p-3 mt-3">
                  <p className="text-sm opacity-90 font-medium">
                    Capital: {formatCurrency(cashbox.initial_capital_lbp || 0, 'LBP')}
                  </p>
                </div>
              )}
            </div>
            <div className="bg-white bg-opacity-20 rounded-full p-4">
              <Wallet className="w-12 h-12 opacity-90" />
            </div>
          </div>
        </div>
      </div>

      {/* Account Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Cash Account */}
        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-3">
              <div className="bg-green-100 p-2 rounded-lg">
                <Wallet className="w-6 h-6 text-green-600" />
              </div>
              Cash Account
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="text-center bg-green-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 font-medium mb-2">USD</p>
              <p className="text-xl font-bold text-green-600 break-words">
                {formatCurrency(cashbox.cash_balance_usd || 0, 'USD')}
              </p>
            </div>
            <div className="text-center bg-green-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 font-medium mb-2">LBP</p>
              <p className="text-xl font-bold text-green-600 break-words">
                {formatCurrency(cashbox.cash_balance_lbp || 0, 'LBP')}
              </p>
            </div>
          </div>
        </div>

        {/* Wish Account */}
        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-500 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-3">
              <div className="bg-purple-100 p-2 rounded-lg">
                <CreditCard className="w-6 h-6 text-purple-600" />
              </div>
              Wish Account
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="text-center bg-purple-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 font-medium mb-2">USD</p>
              <p className="text-xl font-bold text-purple-600 break-words">
                {formatCurrency(cashbox.wish_balance_usd || 0, 'USD')}
              </p>
            </div>
            <div className="text-center bg-purple-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 font-medium mb-2">LBP</p>
              <p className="text-xl font-bold text-purple-600 break-words">
                {formatCurrency(cashbox.wish_balance_lbp || 0, 'LBP')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Timeline */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-blue-100 p-2 rounded-lg">
            <RefreshCw className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900">Recent Activity</h3>
        </div>
        <div className="space-y-4">
          {isLoadingTimeline ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-500 mt-4">Loading activity...</p>
            </div>
          ) : (timelineData?.data || []).length > 0 ? (
            (timelineData?.data || []).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors duration-200">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-full ${getEntryTypeColor(entry.tx_type)}`}>
                    {getEntryTypeIcon(entry.tx_type)}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{entry.tx_type.replace('_', ' ').toUpperCase()}</p>
                    <p className="text-sm text-gray-600 mt-1">{entry.description}</p>
                    {entry.account_type && (
                      <p className="text-xs text-blue-600 capitalize font-medium mt-1">
                        {entry.account_type} Account
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm text-gray-900">
                    {formatCurrency(entry.amount_usd, 'USD')}
                  </p>
                  <p className="text-sm text-gray-600">
                    {formatCurrency(entry.amount_lbp, 'LBP')}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatDate(entry.created_at)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-gray-500">
              <div className="bg-gray-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-lg font-medium">No recent activity</p>
              <p className="text-sm">Start by adding some transactions to see them here</p>
            </div>
          )}
        </div>
      </div>

      {/* Capital Modal */}
      <AnimatePresence>
        {showCapitalModal && (
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
                <h2 className="text-2xl font-bold">Set Initial Capital</h2>
                <button
                  onClick={() => setShowCapitalModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <CapitalForm onSubmit={handleSetCapital} onCancel={() => setShowCapitalModal(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Capital Modal */}
      <AnimatePresence>
        {showEditCapitalModal && (
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
                <h2 className="text-2xl font-bold">Edit Capital</h2>
                <button
                  onClick={() => setShowEditCapitalModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <CapitalForm 
                onSubmit={handleEditCapital} 
                onCancel={() => setShowEditCapitalModal(false)}
                initialData={{
                  amount_usd: cashbox.initial_capital_usd || 0,
                  amount_lbp: cashbox.initial_capital_lbp || 0
                }}
                isEdit={true}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expense Capital Modal */}
      <AnimatePresence>
        {showExpenseCapitalModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowExpenseCapitalModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Expense Capital</h2>
                <button
                  onClick={() => setShowExpenseCapitalModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <ExpenseCapitalForm 
                onSubmit={handleExpenseCapital}
                onCancel={() => setShowExpenseCapitalModal(false)}
                isLoading={expenseCapitalMutation.isLoading}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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

              <ExpenseForm 
                onSubmit={handleAddExpense} 
                onCancel={() => setShowExpenseModal(false)}
                categories={expenseCategoriesData?.data || []}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transfer Modal */}
      <AnimatePresence>
        {showTransferModal && (
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
                <h2 className="text-2xl font-bold">Transfer Between Accounts</h2>
                <button
                  onClick={() => setShowTransferModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <TransferForm onSubmit={handleTransfer} onCancel={() => setShowTransferModal(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

// Capital Form Component
const CapitalForm = ({ onSubmit, onCancel, initialData = {}, isEdit = false }) => {
  const [formData, setFormData] = useState({
    amount_usd: initialData.amount_usd !== undefined ? initialData.amount_usd : '',
    amount_lbp: initialData.amount_lbp !== undefined ? initialData.amount_lbp : '',
    account_type: 'cash',
    description: isEdit ? 'Capital adjustment' : 'Initial capital setup'
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
            min="0"
            placeholder="0.00"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            min="0"
            placeholder="0"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Account</label>
        <select
          name="account_type"
          value={formData.account_type}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="cash">Cash Account</option>
          <option value="wish">Wish Account</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
        <input
          type="text"
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="e.g., Initial capital, Capital adjustment"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
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
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          {isEdit ? 'Update Capital' : 'Set Capital'}
        </button>
      </div>
    </form>
  );
};

// Income Form Component
const IncomeForm = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    amount_usd: '',
    amount_lbp: '',
    description: '',
    account_type: 'cash',
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
        <label className="block text-sm font-medium text-gray-700 mb-2">Account</label>
        <select
          name="account_type"
          value={formData.account_type}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="cash">Cash Account</option>
          <option value="wish">Wish Account</option>
        </select>
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
const ExpenseForm = ({ onSubmit, onCancel, categories = [] }) => {
  const [formData, setFormData] = useState({
    amount_usd: '',
    amount_lbp: '',
    account_type: 'cash',
    category: '',
    subcategory: '',
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

  const selectedCategory = categories.find(cat => cat.title === formData.category);

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

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Account</label>
        <select
          name="account_type"
          value={formData.account_type}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <option value="cash">Cash Account</option>
          <option value="wish">Wish Account</option>
        </select>
      </div>

      {/* Expense Categories */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
          <select
            name="category"
            value={formData.category}
            onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value, subcategory: '' }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="">Select Category</option>
            {categories.map(category => (
              <option key={category.id} value={category.title}>{category.title}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Item</label>
          <select
            name="subcategory"
            value={formData.subcategory}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
            disabled={!selectedCategory}
          >
            <option value="">Select Item</option>
            {selectedCategory?.items?.map(item => (
              <option key={item} value={item}>{item}</option>
            ))}
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

// Transfer Form Component
const TransferForm = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    amount_usd: '',
    amount_lbp: '',
    from_account: 'cash',
    to_account: 'wish',
    description: ''
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">From Account</label>
          <select
            name="from_account"
            value={formData.from_account}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="cash">Cash Account</option>
            <option value="wish">Wish Account</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">To Account</label>
          <select
            name="to_account"
            value={formData.to_account}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="cash">Cash Account</option>
            <option value="wish">Wish Account</option>
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
          placeholder="e.g., Moving funds for payment"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          required
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
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          Transfer
        </button>
      </div>
    </form>
  );
};

// Expense Capital Form Component
const ExpenseCapitalForm = ({ onSubmit, onCancel, isLoading }) => {
  const [formData, setFormData] = useState({
    amount_usd: '',
    amount_lbp: '',
    account_type: 'cash',
    description: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.amount_usd && !formData.amount_lbp) {
      toast.error('Please enter an amount');
      return;
    }
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Account Type</label>
        <select
          value={formData.account_type}
          onChange={(e) => setFormData({ ...formData, account_type: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
          required
        >
          <option value="cash">Cash Account</option>
          <option value="wish">Wish Account</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Amount (USD)</label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={formData.amount_usd}
          onChange={(e) => setFormData({ ...formData, amount_usd: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
          placeholder="0.00"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Amount (LBP)</label>
        <input
          type="number"
          step="1"
          min="0"
          value={formData.amount_lbp}
          onChange={(e) => setFormData({ ...formData, amount_lbp: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
          placeholder="0"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
          rows="3"
          placeholder="Enter description for capital expense..."
        />
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50"
        >
          {isLoading ? 'Processing...' : 'Expense Capital'}
        </button>
      </div>
    </form>
  );
};

export default Cashbox;