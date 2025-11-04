// Debug script to check frontend configuration
console.log('=== Frontend Configuration Debug ===');
console.log('Window location:', window.location);
console.log('Hostname:', window.location.hostname);
console.log('Port:', window.location.port);
console.log('Protocol:', window.location.protocol);
console.log('Full URL:', window.location.href);

// Check environment variables
console.log('VITE_API_URL:', import.meta.env.VITE_API_URL);
console.log('NODE_ENV:', import.meta.env.NODE_ENV);
console.log('MODE:', import.meta.env.MODE);

// Simulate the hostname detection logic
const hostname = window.location.hostname;
let apiBase, socketBase;

if (hostname === 'localhost' || hostname === '127.0.0.1') {
  apiBase = 'http://localhost:5000';
  socketBase = 'http://localhost:5000';
  console.log('✅ Detected localhost - using local server');
} else if (hostname.includes('vercel.app')) {
  apiBase = 'https://soufiam-erp-backend.onrender.com';
  socketBase = 'https://soufiam-erp-backend.onrender.com';
  console.log('✅ Detected Vercel - using remote server');
} else {
  apiBase = 'https://soufiam-erp-backend.onrender.com';
  socketBase = 'https://soufiam-erp-backend.onrender.com';
  console.log('✅ Default - using remote server');
}

console.log('API Base:', apiBase);
console.log('Socket Base:', socketBase);
console.log('=====================================');
