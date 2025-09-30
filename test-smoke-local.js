/*
  Local smoke tests against dev server (http://localhost:5000)
  - Login
  - GET /api/price-list
  - GET /api/accounting/thirdparty
  - POST /api/orders (test payload)
  - Save JSON report to cursor-fix-report-<timestamp>.json
*/

const fs = require('fs');
const path = require('path');
const axios = require('axios').default;

async function main() {
  const base = 'http://localhost:5000/api';
  const report = { startedAt: new Date().toISOString(), steps: [] };

  function logStep(name, result) {
    report.steps.push({ name, ...result });
  }

  try {
    // Login
    let token = null;
    try {
      const loginRes = await axios.post(`${base}/auth/login`, {
        email: 'soufian@gmail.com',
        password: 'Soufi@n123'
      });
      token = loginRes?.data?.data?.token || null;
      logStep('login', { ok: !!token });
    } catch (err) {
      logStep('login', { ok: false, error: err.response?.data || err.message });
    }

    const api = axios.create({
      baseURL: base,
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });

    // Price list
    try {
      const res = await api.get('/price-list');
      const data = res.data;
      const first = Array.isArray(data?.data) ? data.data[0] : null;
      const numericOk = !first || ([
        'fee_usd','fee_lbp','third_party_fee_usd','third_party_fee_lbp'
      ].every(k => typeof first[k] === 'number'));
      logStep('price-list', { ok: data?.success === true && Array.isArray(data?.data), sample: first, numericOk });
    } catch (err) {
      logStep('price-list', { ok: false, error: err.response?.data || err.message });
    }

    // Accounting thirdparty
    try {
      const res = await api.get('/accounting/thirdparty');
      const data = res.data;
      logStep('accounting-thirdparty', { ok: data?.success === true && Array.isArray(data?.data), count: (data?.data || []).length });
    } catch (err) {
      logStep('accounting-thirdparty', { ok: false, error: err.response?.data || err.message });
    }

    // Create order
    try {
      const payload = {
        customer_name: 'Test Customer',
        customer_phone: '70000000',
        customer_address: 'Beirut',
        deliver_method: 'in_house',
        delivery_mode: 'direct',
        type: 'ecommerce',
        total_usd: 10.5,
        total_lbp: 1000000,
        driver_fee_usd: 2,
        driver_fee_lbp: 200000
      };
      const res = await api.post('/orders', payload);
      logStep('create-order', { ok: res.data?.success === true, id: res.data?.data?.id, data: res.data });
    } catch (err) {
      logStep('create-order', { ok: false, error: err.response?.data || err.message });
    }

  } finally {
    report.finishedAt = new Date().toISOString();
    const out = JSON.stringify(report, null, 2);
    const file = path.join(process.cwd(), `cursor-fix-report-${new Date().toISOString().replace(/[:.]/g,'-')}.json`);
    fs.writeFileSync(file, out, 'utf8');
    console.log('Saved report:', file);
  }
}

main().catch((e) => {
  console.error('Smoke test failed:', e.message);
  process.exit(1);
});


