const axios = require('axios');

async function main() {
  const backend = process.env.BACKEND_URL || 'http://localhost:5000';
  const api = axios.create({ baseURL: backend, timeout: 15000 });
  try {
    console.log('🔐 Logging in...');
    const res = await api.post('/api/auth/login', {
      email: 'soufian@gmail.com',
      password: 'Soufi@n123'
    });
    const token = res.data?.token || res.data?.data?.token;
    if (!token) {
      throw new Error('No token returned from login');
    }
    console.log('✅ Login OK');

    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    console.log('📊 Hitting dashboard/stats...');
    const dash = await api.get('/api/dashboard/stats');
    console.log('   Dashboard success:', !!dash.data?.success);

    console.log('💼 Hitting accounting...');
    const acc = await api.get('/api/accounting');
    console.log('   Accounting success:', !!acc.data?.success);

    console.log('🎉 Smoke auth OK');
  } catch (e) {
    console.error('❌ Smoke auth failed:', e.response?.status, e.response?.data || e.message);
    process.exit(1);
  }
}

main();


