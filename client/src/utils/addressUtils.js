// Utility functions for address parsing and delivery fee lookup

export function parseAddressForDelivery(address) {
  if (!address) return null;
  
  // Common Lebanese regions and areas
  const regions = [
    'Beirut', 'Mount Lebanon', 'North Lebanon', 'South Lebanon', 
    'Bekaa', 'Nabatieh', 'Akkar', 'Baalbek-Hermel'
  ];
  
  const areas = [
    'Hamra', 'Verdun', 'Achrafieh', 'Gemmayzeh', 'Mar Mikhael',
    'Jounieh', 'Kaslik', 'Zalka', 'Antelias', 'Dbayeh',
    'Tripoli', 'Zgharta', 'Koura', 'Bcharre', 'Batroun',
    'Sidon', 'Tyre', 'Nabatieh', 'Marjayoun', 'Hasbaya',
    'Zahle', 'Chtaura', 'Baalbek', 'Hermel', 'Rashaya',
    'Jezzine', 'Bint Jbeil', 'Marjayoun', 'Hasbaya'
  ];
  
  const addressLower = address.toLowerCase();
  
  // Try to extract region and area from address
  let region = null;
  let area = null;
  
  // Check for regions
  for (const r of regions) {
    if (addressLower.includes(r.toLowerCase())) {
      region = r;
      break;
    }
  }
  
  // Check for areas
  for (const a of areas) {
    if (addressLower.includes(a.toLowerCase())) {
      area = a;
      break;
    }
  }
  
  return {
    region: region || 'Beirut', // Default to Beirut if no region found
    area: area || null,
    fullAddress: address
  };
}

export function getDeliveryFeeFromAddress(address, deliveryPrices = []) {
  if (!address || !deliveryPrices.length) return null;
  
  const parsed = parseAddressForDelivery(address);
  if (!parsed) return null;
  
  // Find matching delivery price
  let match = deliveryPrices.find(price => 
    price.region === parsed.region && 
    (!parsed.area || price.sub_region === parsed.area) &&
    price.is_active
  );
  
  // If no exact match with area, try without area
  if (!match && parsed.area) {
    match = deliveryPrices.find(price => 
      price.region === parsed.region && 
      !price.sub_region &&
      price.is_active
    );
  }
  
  return match ? {
    delivery_fee_usd: match.price_usd || 0,
    delivery_fee_lbp: match.price_lbp || 0,
    region: parsed.region,
    area: parsed.area
  } : null;
}
