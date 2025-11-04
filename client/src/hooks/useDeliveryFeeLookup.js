import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { getDeliveryFeeFromAddress } from '../utils/addressUtils';

export function useDeliveryFeeLookup() {
  const [deliveryPrices, setDeliveryPrices] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch delivery prices on mount
  useEffect(() => {
    const fetchDeliveryPrices = async () => {
      setIsLoading(true);
      try {
        const response = await api.get('/delivery-prices');
        if (response.data.success) {
          setDeliveryPrices(response.data.data || []);
        }
      } catch (error) {
        console.error('Error fetching delivery prices:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDeliveryPrices();
  }, []);

  const getDeliveryFee = useCallback((address) => {
    if (!address || !deliveryPrices.length) return null;
    
    return getDeliveryFeeFromAddress(address, deliveryPrices);
  }, [deliveryPrices]);

  const updateDeliveryFees = useCallback((address, deliveryMethod, setFormData) => {
    const feeData = getDeliveryFee(address);
    if (!feeData) return;

    const { delivery_fee_usd, delivery_fee_lbp } = feeData;
    
    if (deliveryMethod === 'in_house') {
      setFormData(prev => ({
        ...prev,
        delivery_fee_usd: delivery_fee_usd,
        delivery_fee_lbp: delivery_fee_lbp,
        third_party_fee_usd: 0,
        third_party_fee_lbp: 0
      }));
    } else if (deliveryMethod === 'third_party') {
      // For third party, we might need to add additional fees
      // This could be enhanced based on business rules
      setFormData(prev => ({
        ...prev,
        delivery_fee_usd: delivery_fee_usd,
        delivery_fee_lbp: delivery_fee_lbp,
        third_party_fee_usd: delivery_fee_usd * 0.1, // 10% additional fee for third party
        third_party_fee_lbp: Math.round(delivery_fee_lbp * 0.1)
      }));
    }
  }, [getDeliveryFee]);

  return {
    deliveryPrices,
    isLoading,
    getDeliveryFee,
    updateDeliveryFees
  };
}
