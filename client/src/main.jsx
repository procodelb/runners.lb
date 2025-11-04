import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Global error handler to suppress runtime.lastError from browser extensions
window.addEventListener('error', (event) => {
  if (event.message && event.message.includes('runtime.lastError')) {
    console.log('Suppressed runtime.lastError from browser extension:', event.message);
    event.preventDefault();
    return false;
  }
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && event.reason.message && event.reason.message.includes('runtime.lastError')) {
    console.log('Suppressed runtime.lastError from promise rejection:', event.reason.message);
    event.preventDefault();
    return false;
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

