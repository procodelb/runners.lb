import React from 'react';
import { format } from 'date-fns';
import { formatCurrency } from '../utils/formatters';
import { computeDisplayAmounts } from '../utils/accountingUtils';

export default function OrderDetailsModal({ order, onClose, onCashout, disableCashout }) {
  if (!order) return null;
  const c = computeDisplayAmounts(order);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Order #{order.id}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>

          <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg mb-4">
            <div>
              <div className="text-sm text-gray-500">Client</div>
              <div className="font-medium">{order.brand_name || order.customer_name || '—'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Date</div>
              <div className="font-medium">{order.created_at ? format(new Date(order.created_at), 'PPP') : 'N/A'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Payment</div>
              <div className="font-medium">{order.payment_status}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Status</div>
              <div className="font-medium">{order.status}</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Total</span>
              <span>{formatCurrency(order.total_usd, 'USD')} / {formatCurrency(order.total_lbp, 'LBP')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Delivery Fees</span>
              <span>
                {c.showDeliveryFees ? (
                  <>
                    {formatCurrency(c.deliveryFeesUSDShown, 'USD')} / {formatCurrency(c.deliveryFeesLBPShown, 'LBP')}
                  </>
                ) : 'Hidden for instant'}
              </span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Displayed Total</span>
              <span>{formatCurrency(c.computedTotalUSD, 'USD')} / {formatCurrency(c.computedTotalLBP, 'LBP')}</span>
            </div>
          </div>

          <div className="flex gap-3 pt-6">
            <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Close</button>
            <button onClick={onCashout} disabled={disableCashout} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">Cashout</button>
          </div>
        </div>
      </div>
    </div>
  );
}


