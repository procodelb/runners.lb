// Currency formatting
export const formatCurrency = (amount, currency = 'USD') => {
  if (!amount && amount !== 0) return '-';
  
  if (currency === 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } else if (currency === 'LBP') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'LBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }
  return amount.toString();
};

// Date formatting
export const formatDate = (date) => {
  if (!date) return '-';
  
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
};

// Short date formatting
export const formatShortDate = (date) => {
  if (!date) return '-';
  
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
};

// Time formatting
export const formatTime = (date) => {
  if (!date) return '-';
  
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
};

// Status formatting
export const formatStatus = (status) => {
  const statusMap = {
    new: 'New',
    assigned: 'Assigned',
    picked_up: 'Picked Up',
    in_transit: 'In Transit',
    delivered: 'Delivered',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  return statusMap[status] || status;
};

// Payment status formatting
export const formatPaymentStatus = (status) => {
  const statusMap = {
    unpaid: 'Unpaid',
    partial: 'Partial',
    paid: 'Paid',
    refunded: 'Refunded',
  };
  return statusMap[status] || status;
};

// Get status color
export const getStatusColor = (status) => {
  const colorMap = {
    new: 'blue',
    assigned: 'yellow',
    picked_up: 'purple',
    in_transit: 'indigo',
    delivered: 'green',
    completed: 'green',
    cancelled: 'red',
  };
  return colorMap[status] || 'gray';
};

// Get payment status color
export const getPaymentStatusColor = (status) => {
  const colorMap = {
    unpaid: 'red',
    partial: 'yellow',
    paid: 'green',
    refunded: 'gray',
  };
  return colorMap[status] || 'gray';
};

// Format phone number
export const formatPhone = (phone) => {
  if (!phone) return '-';
  
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Format Lebanese phone numbers
  if (cleaned.startsWith('961')) {
    return `+${cleaned.slice(0, 3)} ${cleaned.slice(3, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8)}`;
  } else if (cleaned.startsWith('1')) {
    return `+${cleaned.slice(0, 1)} (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7, 11)}`;
  }
  
  return phone;
};

// Format order reference
export const formatOrderRef = (orderRef) => {
  if (!orderRef) return '-';
  return orderRef.toUpperCase();
};

// Format business name
export const formatBusinessName = (name) => {
  if (!name) return '-';
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
};

// Format address
export const formatAddress = (address) => {
  if (!address) return '-';
  return address.charAt(0).toUpperCase() + address.slice(1);
};

// Format notes
export const formatNotes = (notes, maxLength = 100) => {
  if (!notes) return '-';
  if (notes.length <= maxLength) return notes;
  return notes.substring(0, maxLength) + '...';
};

// Format percentage
export const formatPercentage = (value, decimals = 2) => {
  if (!value && value !== 0) return '-';
  return `${parseFloat(value).toFixed(decimals)}%`;
};

// Format file size
export const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Format duration
export const formatDuration = (minutes) => {
  if (!minutes) return '-';
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
};

// Format distance
export const formatDistance = (meters) => {
  if (!meters) return '-';
  
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
};

// Truncate text
export const truncateText = (text, maxLength = 50) => {
  if (!text) return '-';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

// Capitalize first letter
export const capitalize = (text) => {
  if (!text) return '-';
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

// Format number with commas
export const formatNumber = (number) => {
  if (!number && number !== 0) return '-';
  return new Intl.NumberFormat('en-US').format(number);
};

// Format decimal number
export const formatDecimal = (number, decimals = 2) => {
  if (!number && number !== 0) return '-';
  return parseFloat(number).toFixed(decimals);
};

