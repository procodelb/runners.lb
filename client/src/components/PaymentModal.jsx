import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import accountingAPI from '../api/accounting';
import { driversApi } from '../api/drivers';
import { ordersApi } from '../api/orders';
import { toast } from 'react-hot-toast';
import { 
  DollarSign, 
  User, 
  CreditCard, 
  AlertCircle,
  CheckCircle,
  X,
  Loader2
} from 'lucide-react';

const PaymentModal = ({ 
  isOpen, 
  onClose, 
  order, 
  accountType = 'client', // 'client', 'driver', 'third_party'
  onPaymentSuccess 
}) => {
  const [paymentData, setPaymentData] = useState({
    amount_usd: '',
    amount_lbp: '',
    payment_method: 'cash',
    notes: '',
    driver_advance_id: '',
    is_prepaid_payment: false,
    action: 'add' // 'add' or 'remove' - determines if money is added to or removed from cash account
  });
  const [errors, setErrors] = useState({});

  const queryClient = useQueryClient();

  // Fetch drivers for prepaid linking
  const { data: drivers } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => driversApi.getDrivers(),
    enabled: isOpen && order?.payment_status === 'prepaid'
  });

  // Fetch driver advances for the order if it's prepaid
  const { data: advancesData } = useQuery({
    queryKey: ['driver-advances', order?.id],
    queryFn: () => ordersApi.getDriverAdvances({ order_id: order?.id }),
    enabled: isOpen && order?.payment_status === 'prepaid'
  });

  // Create payment mutation
  const createPaymentMutation = useMutation({
    mutationFn: (data) => accountingAPI.recordPayment(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['orders']);
      queryClient.invalidateQueries(['driver-advances']);
      queryClient.invalidateQueries(['accounting']);
      toast.success('Payment recorded successfully');
      onPaymentSuccess?.();
      onClose();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to record payment');
    }
  });

  // Reset form when modal opens/closes or order changes
  useEffect(() => {
    if (isOpen && order) {
      setPaymentData({
        amount_usd: '',
        amount_lbp: '',
        payment_method: 'cash',
        notes: '',
        driver_advance_id: '',
        is_prepaid_payment: order.payment_status === 'prepaid',
        action: 'add' // Default to 'add'
      });
      setErrors({});
    }
  }, [isOpen, order]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setPaymentData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!paymentData.amount_usd && !paymentData.amount_lbp) {
      newErrors.amount = 'At least one amount (USD or LBP) is required';
    }
    
    if (paymentData.is_prepaid_payment && !paymentData.driver_advance_id) {
      newErrors.driver_advance_id = 'Please select a driver advance to link this payment to';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const submitData = {
      order_id: order.id,
      account_type: accountType,
      account_id: getAccountId(order, accountType),
      amount_usd: parseFloat(paymentData.amount_usd) || 0,
      amount_lbp: parseInt(paymentData.amount_lbp) || 0,
      payment_method: paymentData.payment_method,
      notes: paymentData.notes,
      action: paymentData.action, // 'add' or 'remove'
      created_by: 1 // You might want to get this from auth context
    };

    createPaymentMutation.mutate(submitData);
  };

  // Helper function to get account ID based on account type
  const getAccountId = (order, accountType) => {
    switch (accountType) {
      case 'client':
        return order.client_id || order.brand_name; // Use brand_name as client identifier
      case 'driver':
        return order.driver_id;
      case 'third_party':
        return order.third_party_name || order.third_party_id || 'Unknown Third Party';
      default:
        return null;
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

  const advances = advancesData?.data || [];

  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">
            Record Payment - {accountType === 'client' ? 'Client' : accountType === 'driver' ? 'Driver' : 'Third Party'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Order Info */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Order:</span>
              <div className="font-medium">{order.order_ref}</div>
            </div>
            <div>
              <span className="text-gray-500">Customer:</span>
              <div className="font-medium">{order.customer_name}</div>
            </div>
            <div>
              <span className="text-gray-500">Total USD:</span>
              <div className="font-medium">{formatCurrency(order.total_usd, 'USD')}</div>
            </div>
            <div>
              <span className="text-gray-500">Total LBP:</span>
              <div className="font-medium">{formatCurrency(order.total_lbp, 'LBP')}</div>
            </div>
            <div>
              <span className="text-gray-500">Payment Status:</span>
              <div className={`font-medium ${
                order.payment_status === 'prepaid' ? 'text-blue-600' : 
                order.payment_status === 'paid' ? 'text-green-600' : 
                'text-red-600'
              }`}>
                {order.payment_status?.toUpperCase()}
              </div>
            </div>
            {order.payment_status === 'prepaid' && (
              <div>
                <span className="text-gray-500">Prepaid by:</span>
                <div className="font-medium">{order.driver_name || 'Unknown Driver'}</div>
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Amount Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount USD
              </label>
              <input
                type="number"
                step="0.01"
                name="amount_usd"
                value={paymentData.amount_usd}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.amount ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount LBP
              </label>
              <input
                type="number"
                name="amount_lbp"
                value={paymentData.amount_lbp}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.amount ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="0"
              />
            </div>
          </div>
          {errors.amount && (
            <p className="text-red-500 text-sm flex items-center">
              <AlertCircle className="w-4 h-4 mr-1" />
              {errors.amount}
            </p>
          )}

          {/* Action Selection: Add or Remove from Cash Account */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Action
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="action"
                  value="add"
                  checked={paymentData.action === 'add'}
                  onChange={handleInputChange}
                  className="mr-2 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">
                  <CheckCircle className="w-4 h-4 inline mr-1 text-green-600" />
                  Add to Cash Account
                </span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="action"
                  value="remove"
                  checked={paymentData.action === 'remove'}
                  onChange={handleInputChange}
                  className="mr-2 text-red-600 focus:ring-red-500"
                />
                <span className="text-sm text-gray-700">
                  <X className="w-4 h-4 inline mr-1 text-red-600" />
                  Remove from Cash Account
                </span>
              </label>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {paymentData.action === 'add' 
                ? 'Money will be added to your cash account' 
                : 'Money will be removed from your cash account and deducted from the order total'}
            </p>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Method
            </label>
            <select
              name="payment_method"
              value={paymentData.payment_method}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="online">Online</option>
              <option value="bank_transfer">Bank Transfer</option>
            </select>
          </div>

          {/* Prepaid Order Linking */}
          {order.payment_status === 'prepaid' && advances.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Link to Driver Advance
              </label>
              <select
                name="driver_advance_id"
                value={paymentData.driver_advance_id}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.driver_advance_id ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Select Driver Advance</option>
                {advances.map(advance => (
                  <option key={advance.id} value={advance.id}>
                    Advance #{advance.id} - {advance.driver_name} - {formatCurrency(advance.amount_usd, 'USD')} / {formatCurrency(advance.amount_lbp, 'LBP')}
                  </option>
                ))}
              </select>
              {errors.driver_advance_id && (
                <p className="text-red-500 text-sm flex items-center mt-1">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.driver_advance_id}
                </p>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              name="notes"
              value={paymentData.notes}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Additional notes about this payment..."
            />
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createPaymentMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
            >
              {createPaymentMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <DollarSign className="w-4 h-4 mr-2" />
                  Record Payment
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PaymentModal;
