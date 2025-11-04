import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Trash2, 
  Save, 
  X, 
  Download, 
  Upload,
  Check,
  AlertCircle,
  Loader2,
  Eye,
  Edit3,
  Copy,
  Search,
  Filter
} from 'lucide-react';
import api from '../api';
import toast from 'react-hot-toast';

const ExcelOrderForm = ({ onClose, onSuccess }) => {
  const [orders, setOrders] = useState([]);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [isValidating, setIsValidating] = useState(false);
  const [validationResults, setValidationResults] = useState(null);
  const [showThirdPartyFields, setShowThirdPartyFields] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [editingRow, setEditingRow] = useState(null);
  const fileInputRef = useRef(null);

  const queryClient = useQueryClient();

  // Fetch template and options
  const { data: template, isLoading: templateLoading } = useQuery(
    'batch-template',
    () => api.get('/orders/batch/template'),
    {
      select: (response) => response.data?.data,
      onSuccess: (data) => {
        if (data && orders.length === 0) {
          // Initialize with one empty row
          setOrders([{ ...data.sample_row, id: Date.now() }]);
        }
      }
    }
  );

  // Batch create mutation
  const batchCreateMutation = useMutation(
    (ordersData) => api.post('/orders/batch', { orders: ordersData }),
    {
      onSuccess: (response) => {
        queryClient.invalidateQueries('orders');
        toast.success(`Successfully created ${response.data.data.summary.successful} orders!`);
        onSuccess?.(response.data.data);
        onClose();
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || 'Failed to create orders';
        toast.error(errorMessage);
      }
    }
  );

  // Validate orders mutation
  const validateMutation = useMutation(
    (ordersData) => api.post('/orders/batch/validate', { orders: ordersData }),
    {
      onSuccess: (response) => {
        setValidationResults(response.data.data);
        setIsValidating(false);
        if (response.data.data.summary.invalid === 0) {
          toast.success('All orders are valid!');
        } else {
          toast.error(`${response.data.data.summary.invalid} orders have validation errors`);
        }
      },
      onError: (error) => {
        setIsValidating(false);
        toast.error('Validation failed');
      }
    }
  );

  // Auto-fill client details
  const handleBrandNameChange = (rowIndex, value) => {
    const updatedOrders = [...orders];
    updatedOrders[rowIndex] = { ...updatedOrders[rowIndex], brand_name: value };
    
    // Find matching client and auto-fill client_id
    const client = template?.options?.clients?.find(c => 
      (c.business_name && c.business_name.toLowerCase() === value.toLowerCase()) ||
      (c.name && c.name.toLowerCase() === value.toLowerCase())
    );
    
    if (client) {
      updatedOrders[rowIndex] = {
        ...updatedOrders[rowIndex],
        client_id: client.id, // Link to CRM client
        // Auto-fill delivery fees if available
        delivery_fee_usd: client.default_delivery_fee_usd || updatedOrders[rowIndex].delivery_fee_usd,
        delivery_fee_lbp: client.default_delivery_fee_lbp || updatedOrders[rowIndex].delivery_fee_lbp
      };
    } else {
      // Clear client_id if no match found
      updatedOrders[rowIndex] = {
        ...updatedOrders[rowIndex],
        client_id: null
      };
    }
    
    setOrders(updatedOrders);
  };

  // Auto-fill by phone number
  const handlePhoneChange = (rowIndex, value) => {
    const updatedOrders = [...orders];
    updatedOrders[rowIndex] = { ...updatedOrders[rowIndex], customer_phone: value };
    
    // Find matching client by phone (you'd implement this with actual API call)
    // For now, just update the field
    setOrders(updatedOrders);
  };

  // Add new row
  const addRow = () => {
    const newRow = {
      ...template?.sample_row,
      id: Date.now() + Math.random(),
      order_ref: ''
    };
    setOrders([...orders, newRow]);
  };

  // Remove selected rows
  const removeSelectedRows = () => {
    if (selectedRows.size === 0) return;
    
    const updatedOrders = orders.filter((_, index) => !selectedRows.has(index));
    setOrders(updatedOrders);
    setSelectedRows(new Set());
  };

  // Duplicate selected rows
  const duplicateSelectedRows = () => {
    if (selectedRows.size === 0) return;
    
    const rowsToDuplicate = Array.from(selectedRows).map(index => ({
      ...orders[index],
      id: Date.now() + Math.random(),
      order_ref: '' // Clear order ref for duplicates
    }));
    
    setOrders([...orders, ...rowsToDuplicate]);
    setSelectedRows(new Set());
  };

  // Handle row selection
  const toggleRowSelection = (index) => {
    const newSelection = new Set(selectedRows);
    if (newSelection.has(index)) {
      newSelection.delete(index);
    } else {
      newSelection.add(index);
    }
    setSelectedRows(newSelection);
  };

  // Select all rows
  const selectAllRows = () => {
    if (selectedRows.size === filteredOrders.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredOrders.map((_, index) => index)));
    }
  };

  // Handle field changes
  const handleFieldChange = (rowIndex, field, value) => {
    const updatedOrders = [...orders];
    updatedOrders[rowIndex] = { ...updatedOrders[rowIndex], [field]: value };
    
    // Show/hide third party fields based on deliver_method
    if (field === 'deliver_method') {
      setShowThirdPartyFields(value === 'third_party');
    }
    
    setOrders(updatedOrders);
  };

  // Validate orders
  const validateOrders = () => {
    if (orders.length === 0) {
      toast.error('No orders to validate');
      return;
    }
    
    setIsValidating(true);
    validateMutation.mutate(orders);
  };

  // Submit orders
  const submitOrders = () => {
    if (orders.length === 0) {
      toast.error('No orders to submit');
      return;
    }
    
    // Filter out empty rows
    const validOrders = orders.filter(order => 
      order.customer_name && order.brand_name
    );
    
    if (validOrders.length === 0) {
      toast.error('No valid orders to submit');
      return;
    }
    
    batchCreateMutation.mutate(validOrders);
  };

  // Import from CSV
  const handleFileImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csv = e.target.result;
        const lines = csv.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        
        const importedOrders = lines.slice(1)
          .filter(line => line.trim())
          .map((line, index) => {
            const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
            const order = { id: Date.now() + index };
            
            headers.forEach((header, i) => {
              if (values[i]) {
                order[header] = values[i];
              }
            });
            
            return order;
          });
        
        setOrders(importedOrders);
        toast.success(`Imported ${importedOrders.length} orders`);
      } catch (error) {
        toast.error('Failed to import CSV file');
      }
    };
    
    reader.readAsText(file);
  };

  // Export to CSV
  const exportToCSV = () => {
    if (orders.length === 0) {
      toast.error('No orders to export');
      return;
    }
    
    const headers = template?.headers || Object.keys(orders[0]);
    const csvContent = [
      headers.join(','),
      ...orders.map(order => 
        headers.map(header => `"${order[header] || ''}"`).join(',')
      )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Orders exported to CSV');
  };

  // Filter orders
  const filteredOrders = orders.filter(order => {
    const matchesSearch = !searchTerm || 
      Object.values(order).some(value => 
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      );
    
    const matchesStatus = !filterStatus || order.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  if (templateLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-lg shadow-xl w-full max-w-7xl max-h-[95vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Excel Order Form</h2>
            <p className="text-gray-600">Create multiple orders in a spreadsheet-like interface</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <button
                onClick={addRow}
                className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Row
              </button>
              
              <button
                onClick={duplicateSelectedRows}
                disabled={selectedRows.size === 0}
                className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Duplicate ({selectedRows.size})
              </button>
              
              <button
                onClick={removeSelectedRows}
                disabled={selectedRows.size === 0}
                className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete ({selectedRows.size})
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileImport}
                accept=".csv"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Import CSV
              </button>
              
              <button
                onClick={exportToCSV}
                className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="flex items-center space-x-4 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="new">New</option>
              <option value="assigned">Assigned</option>
              <option value="delivered">Delivered</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        {/* Excel-like Table */}
        <div className="overflow-auto max-h-96">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-2 py-2 text-left">
                  <input
                    type="checkbox"
                    checked={selectedRows.size === filteredOrders.length && filteredOrders.length > 0}
                    onChange={selectAllRows}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order Ref
                </th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer Name
                </th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phone
                </th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Address
                </th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client (from CRM)
                </th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Driver
                </th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total USD
                </th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total LBP
                </th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment
                </th>
                {showThirdPartyFields && (
                  <>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Third Party
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      TP Fee USD
                    </th>
                  </>
                )}
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredOrders.map((order, index) => (
                <tr 
                  key={order.id} 
                  className={`hover:bg-gray-50 ${selectedRows.has(index) ? 'bg-blue-50' : ''}`}
                >
                  <td className="px-2 py-2">
                    <input
                      type="checkbox"
                      checked={selectedRows.has(index)}
                      onChange={() => toggleRowSelection(index)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      value={order.order_ref || ''}
                      onChange={(e) => handleFieldChange(index, 'order_ref', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                      placeholder="Auto-generated"
                    />
                  </td>
                  
                  <td className="px-2 py-2">
                    <select
                      value={order.type || 'ecommerce'}
                      onChange={(e) => handleFieldChange(index, 'type', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                    >
                      {template?.options?.types?.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </td>
                  
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      value={order.customer_name || ''}
                      onChange={(e) => handleFieldChange(index, 'customer_name', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                      placeholder="Customer name"
                    />
                  </td>
                  
                  <td className="px-2 py-2">
                    <input
                      type="tel"
                      value={order.customer_phone || ''}
                      onChange={(e) => handlePhoneChange(index, e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                      placeholder="Phone number"
                    />
                  </td>
                  
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      value={order.customer_address || ''}
                      onChange={(e) => handleFieldChange(index, 'customer_address', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                      placeholder="Address"
                    />
                  </td>
                  
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      value={order.brand_name || ''}
                      onChange={(e) => handleBrandNameChange(index, e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                      placeholder="Client business name"
                      list={`brands-${index}`}
                    />
                    <datalist id={`brands-${index}`}>
                      {template?.options?.clients?.map(client => (
                        <option key={client.id} value={client.business_name || client.name} />
                      ))}
                    </datalist>
                  </td>
                  
                  <td className="px-2 py-2">
                    <select
                      value={order.driver_id || ''}
                      onChange={(e) => handleFieldChange(index, 'driver_id', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">Select Driver</option>
                      {template?.options?.drivers?.map(driver => (
                        <option key={driver.id} value={driver.id}>{driver.name}</option>
                      ))}
                    </select>
                  </td>
                  
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      step="0.01"
                      value={order.total_usd || ''}
                      onChange={(e) => handleFieldChange(index, 'total_usd', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                      placeholder="0.00"
                    />
                  </td>
                  
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      value={order.total_lbp || ''}
                      onChange={(e) => handleFieldChange(index, 'total_lbp', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                      placeholder="0"
                    />
                  </td>
                  
                  <td className="px-2 py-2">
                    <select
                      value={order.status || 'new'}
                      onChange={(e) => handleFieldChange(index, 'status', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                    >
                      {template?.options?.statuses?.map(status => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </td>
                  
                  <td className="px-2 py-2">
                    <select
                      value={order.payment_status || 'unpaid'}
                      onChange={(e) => handleFieldChange(index, 'payment_status', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                    >
                      {template?.options?.payment_statuses?.map(status => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </td>
                  
                  {showThirdPartyFields && (
                    <>
                      <td className="px-2 py-2">
                        <select
                          value={order.third_party_id || ''}
                          onChange={(e) => handleFieldChange(index, 'third_party_id', e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">Select Third Party</option>
                          {template?.options?.third_parties?.map(tp => (
                            <option key={tp.id} value={tp.id}>{tp.name}</option>
                          ))}
                        </select>
                      </td>
                      
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          step="0.01"
                          value={order.third_party_fee_usd || ''}
                          onChange={(e) => handleFieldChange(index, 'third_party_fee_usd', e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                          placeholder="0.00"
                        />
                      </td>
                    </>
                  )}
                  
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      value={order.notes || ''}
                      onChange={(e) => handleFieldChange(index, 'notes', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                      placeholder="Notes"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Validation Results */}
        {validationResults && (
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Check className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-green-600">
                    {validationResults.summary.valid} Valid
                  </span>
                </div>
                {validationResults.summary.invalid > 0 && (
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <span className="text-sm font-medium text-red-600">
                      {validationResults.summary.invalid} Invalid
                    </span>
                  </div>
                )}
              </div>
              
              <div className="text-sm text-gray-600">
                Total: {validationResults.summary.total} orders
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            {orders.length} orders • {selectedRows.size} selected
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={validateOrders}
              disabled={isValidating || orders.length === 0}
              className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isValidating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Validate
            </button>
            
            <button
              onClick={submitOrders}
              disabled={batchCreateMutation.isLoading || orders.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {batchCreateMutation.isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Create Orders
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ExcelOrderForm;
