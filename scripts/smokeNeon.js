const fs = require('fs');
const path = require('path');
const axios = require('axios');

async function main() {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const report = {
    startedAt: new Date().toISOString(),
    dbUrlMasked: (process.env.DATABASE_URL || '').replace(/\/\/.*@/, '//***:***@') || 'unknown',
    steps: [],
    success: false
  };

  const base = process.env.API_BASE || 'http://localhost:5000/api';

  async function step(name, fn) {
    const entry = { name, ok: false };
    try {
      const data = await fn();
      entry.ok = true;
      entry.data = data;
    } catch (e) {
      entry.ok = false;
      entry.error = e?.response?.data || e?.message || String(e);
    }
    report.steps.push(entry);
    return entry;
  }

  await step('health', async () => {
    const r = await axios.get(base + '/health');
    return r.data;
  });

  // Ensure auth: signup or login
  let token = null;
  await step('auth', async () => {
    try {
      const s = await axios.post(base + '/auth/signup', { email: 'test@example.com', password: 'test123', full_name: 'Test User' }, { withCredentials: true });
      token = s.data?.data?.token;
      return { mode: 'signup', ok: !!token };
    } catch (_) {
      const l = await axios.post(base + '/auth/login', { email: 'test@example.com', password: 'test123' }, { withCredentials: true });
      token = l.data?.data?.token;
      return { mode: 'login', ok: !!token };
    }
  });

  const authed = axios.create({ baseURL: base, headers: token ? { Authorization: 'Bearer ' + token } : {} });

  await step('price-list', async () => {
    const r = await authed.get('/price-list');
    const arr = Array.isArray(r.data?.data) ? r.data.data : [];
    const sample = arr[0] || null;
    return {
      count: arr.length,
      sampleTypes: sample ? {
        fee_usd: typeof sample.fee_usd,
        fee_lbp: typeof sample.fee_lbp,
        third_party_fee_usd: typeof sample.third_party_fee_usd,
        third_party_fee_lbp: typeof sample.third_party_fee_lbp
      } : null
    };
  });

  await step('create-order', async () => {
    const payload = {
      customer_name: 'Smoke Client',
      customer_phone: '+96170123456',
      customer_address: 'Beirut',
      total_usd: '12.50',
      total_lbp: '0',
      deliver_method: 'in_house',
      delivery_mode: 'direct',
      status: 'new',
      payment_status: 'unpaid'
    };
    // retry once if transient
    try {
      const r1 = await authed.post('/orders', payload);
      return { id: r1.data?.data?.id, computed_total_usd: r1.data?.data?.computed_total_usd, computed_total_lbp: r1.data?.data?.computed_total_lbp };
    } catch (e) {
      await new Promise(r => setTimeout(r, 500));
      const r2 = await authed.post('/orders', payload);
      return { id: r2.data?.data?.id, computed_total_usd: r2.data?.data?.computed_total_usd, computed_total_lbp: r2.data?.data?.computed_total_lbp };
    }
  });

  await step('accounting-thirdparty', async () => {
    const r = await authed.get('/accounting/thirdparty');
    const arr = Array.isArray(r.data?.data) ? r.data.data : [];
    return { count: arr.length };
  });

  report.finishedAt = new Date().toISOString();
  report.success = report.steps.every(s => s.ok);
  const outPath = path.join(process.cwd(), `cursor-neon-fix-report-${ts}.json`);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
  console.log('WROTE_REPORT', outPath);
  console.log('RESULT', report.success ? 'OK' : 'FAIL');
}

main().catch(e => {
  console.error('Smoke script crashed:', e);
  process.exit(1);
});


