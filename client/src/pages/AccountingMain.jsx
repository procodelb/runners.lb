import React, { useEffect, useState } from 'react';
import AccountingTable from '../components/AccountingTable';
import { fetchEntities } from '../api/accounting';
import { formatCurrency } from '../utils/formatters';

export default function AccountingMain() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [onlyUncashed, setOnlyUncashed] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    try {
      setLoading(true); setError('');
      const resp = await fetchEntities({ search });
      const data = resp?.data || {};
      const unified = [];
      (data.clients || []).forEach(x => unified.push({ type: 'Client', name: x.name, phone: x.phone, email: x.email || '', total_orders: x.total_orders, uncashed_orders: x.uncashed_orders, uncashed_total_usd: x.uncashed_total_usd, uncashed_total_lbp: x.uncashed_total_lbp }));
      (data.drivers || []).forEach(x => unified.push({ type: 'Driver', name: x.name, phone: x.phone, email: x.email || '', total_orders: x.total_orders, uncashed_orders: x.uncashed_orders, uncashed_total_usd: x.uncashed_total_usd, uncashed_total_lbp: x.uncashed_total_lbp }));
      (data.third_parties || []).forEach(x => unified.push({ type: 'Third Party', name: x.name, phone: '', email: '', total_orders: x.total_orders, uncashed_orders: x.uncashed_orders, uncashed_total_usd: x.uncashed_total_usd, uncashed_total_lbp: x.uncashed_total_lbp }));
      setRows(unified);
    } catch (e) {
      setError(e?.message || 'Failed to load entities');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const columns = [
    { key: 'type', title: 'Type', width: 120 },
    { key: 'name', title: 'Name', width: 240 },
    { key: 'phone', title: 'Phone', width: 140 },
    { key: 'email', title: 'Email', width: 180 },
    { key: 'total_orders', title: 'Total Orders', width: 120 },
    { key: 'uncashed_orders', title: 'Uncashed Orders', width: 140 },
    { key: 'uncashed_total_usd', title: 'Uncashed Total USD', width: 160, render: (v) => formatCurrency(v, 'USD') },
    { key: 'uncashed_total_lbp', title: 'Uncashed Total LBP', width: 160, render: (v) => formatCurrency(v, 'LBP') },
  ];

  const filtered = rows.filter(r => !onlyUncashed || (Number(r.uncashed_orders) > 0));

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        <input className="border rounded px-3 py-2" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
        <button className="px-3 py-2 bg-blue-600 text-white rounded" onClick={load} disabled={loading}>Search</button>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyUncashed} onChange={e => setOnlyUncashed(e.target.checked)} /> Uncashed Only
        </label>
      </div>
      {error ? <div className="text-red-600 text-sm">{error}</div> : null}
      {loading ? <div>Loading...</div> : (
        <AccountingTable columns={columns} rows={filtered} />
      )}
    </div>
  );
}


