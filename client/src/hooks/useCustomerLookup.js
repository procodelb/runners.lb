import { useState, useCallback } from 'react';
import { customersApi } from '../api/customers';
import { useDebounce } from './useDebounce';

export function useCustomerLookup() {
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const searchCustomers = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await customersApi.search(query);
      setSuggestions(response.data || []);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Error searching customers:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const getOrCreateCustomer = useCallback(async (phone, name = '', address = '') => {
    if (!phone) return null;

    try {
      const response = await customersApi.getOrCreate({
        phone,
        name,
        address
      });
      
      if (response.success) {
        return response.data;
      }
      return null;
    } catch (error) {
      console.error('Error getting/creating customer:', error);
      return null;
    }
  }, []);

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
    setShowSuggestions(false);
  }, []);

  return {
    isSearching,
    suggestions,
    showSuggestions,
    searchCustomers,
    getOrCreateCustomer,
    clearSuggestions
  };
}

export function useDebouncedCustomerLookup(delay = 300) {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, delay);
  const customerLookup = useCustomerLookup();

  const handleSearchChange = useCallback((value) => {
    setSearchTerm(value);
    if (value.length >= 2) {
      customerLookup.searchCustomers(value);
    } else {
      customerLookup.clearSuggestions();
    }
  }, [customerLookup]);

  return {
    ...customerLookup,
    searchTerm,
    setSearchTerm,
    handleSearchChange
  };
}
