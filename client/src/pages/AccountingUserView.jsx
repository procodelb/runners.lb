import React, { useEffect, useState } from 'react';
import AccountingTable from '../components/AccountingTable';
import OrderDetailsModal from '../components/OrderDetailsModal';
import { fetchEntityOrders, cashoutOrder } from '../api/accounting';
import { formatCurrency } from '../utils/formatters';

export default function AccountingUserView({ type, id }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  async function load() {
    try {
      setLoading(true); setError('');
      const resp = await fetchEntityOrders(type, id, { uncashedOnly: true });
      setRows(resp?.data || []);
    } catch (e) {
      setError(e?.message || 'Failed to load orders');
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [type, id]);

  const columns = [
    { key: 'id', title: 'Order ID', width: 90 },
    { key: 'customer_name', title: 'Customer', width: 180 },
    { key: 'customer_phone', title: 'Phone', width: 140 },
    { key: 'customer_address', title: 'Address', width: 200 },
    { key: 'computed_total_usd', title: 'Total USD', width: 120, render: (v) => formatCurrency(v, 'USD') },
    { key: 'computed_total_lbp', title: 'Total LBP', width: 140, render: (v) => formatCurrency(v, 'LBP') },
    { key: 'deliveryFeesUSDShown', title: 'Delivery USD', width: 120, render: (v,row) => row.type === 'instant' ? '-' : formatCurrency(v, 'USD') },
    { key: 'deliveryFeesLBPShown', title: 'Delivery LBP', width: 120, render: (v,row) => row.type === 'instant' ? '-' : formatCurrency(v, 'LBP') },
    { key: 'driver_name', title: 'Driver', width: 140 },
    { key: 'payment_status', title: 'Payment', width: 120 },
    { key: 'status', title: 'Status', width: 120 },
  ];

  const onRowClick = (row) => setSelected(row);

  async function onCashout() {
    if (!selected) return;
    try {
      await cashoutOrder(selected.id, type);
      setSelected(null);
      await load();
    } catch (e) {
      alert(e?.response?.data?.message || 'Cashout failed');
    }
  }

  return (
    <div className="space-y-3">
      {error ? <div className="text-red-600 text-sm">{error}</div> : null}
      {loading ? <div>Loading...</div> : (
        <AccountingTable columns={columns} rows={rows} onRowClick={onRowClick} />
      )}
      {selected && (
        <OrderDetailsModal order={selected} onClose={() => setSelected(null)} onCashout={onCashout} disableCashout={!selected || selected.accountingCashed} />
      )}
    </div>
  );
}


