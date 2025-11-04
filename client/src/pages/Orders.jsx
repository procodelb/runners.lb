import React, { useState } from 'react';
import OrdersGrid from '../components/OrdersGrid';

const Orders = () => {
  return (
    <div className="w-full max-w-none">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Orders Management</h1>
      </div>

      {/* Render Grid View Only */}
      <OrdersGrid />
    </div>
  );
};

export default Orders;

