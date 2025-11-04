export function toNumber(value, precision) {
  const n = Number(value || 0);
  if (precision === 0) return Math.round(n);
  if (typeof precision === 'number') return Math.round(n * Math.pow(10, precision)) / Math.pow(10, precision);
  return n;
}

// Keep in sync with server/utils/computeDisplayedAmounts.js
export function computeDisplayAmounts(order, context = 'client') {
  const totalUSD = toNumber(order.total_usd, 2);
  const totalLBP = toNumber(order.total_lbp, 0);
  const deliveryFeesUSD = toNumber(order.delivery_fee_usd, 2);
  const deliveryFeesLBP = toNumber(order.delivery_fee_lbp, 0);
  const thirdPartyFeesUSD = toNumber(order.third_party_fee_usd, 2);
  const thirdPartyFeesLBP = toNumber(order.third_party_fee_lbp, 0);
  const driverFeeUSD = toNumber(order.driver_fee_usd, 2);
  const driverFeeLBP = toNumber(order.driver_fee_lbp, 0);
  const deliveryMethod = String(order.delivery_mode || order.deliver_method || '').toLowerCase();
  const orderType = String(order.type || order.order_type || '').toLowerCase();

  let displayedTotalUSD = 0;
  let displayedTotalLBP = 0;
  let deliveryFeesShownUSD = 0;
  let deliveryFeesShownLBP = 0;
  let showDeliveryFees = true;

  const isInHouse = deliveryMethod === 'in_house' || deliveryMethod === 'inhouse' || deliveryMethod === 'in house';
  const isThirdParty = deliveryMethod === 'third_party' || deliveryMethod === 'third party';
  const isInstant = orderType === 'instant';

  if (isInHouse) {
    if (!isInstant) {
      displayedTotalUSD = totalUSD;
      displayedTotalLBP = totalLBP;
      deliveryFeesShownUSD = deliveryFeesUSD;
      deliveryFeesShownLBP = deliveryFeesLBP;
    } else {
      displayedTotalUSD = totalUSD + driverFeeUSD;
      displayedTotalLBP = totalLBP + driverFeeLBP;
      deliveryFeesShownUSD = 0;
      deliveryFeesShownLBP = 0;
      showDeliveryFees = false;
    }
  } else if (isThirdParty) {
    if (!isInstant) {
      displayedTotalUSD = totalUSD + deliveryFeesUSD + thirdPartyFeesUSD;
      displayedTotalLBP = totalLBP + deliveryFeesLBP + thirdPartyFeesLBP;
      
      // For client context: show only own delivery fees
      // For accounting context: show both own and third party fees
      if (context === 'client') {
        deliveryFeesShownUSD = deliveryFeesUSD;
        deliveryFeesShownLBP = deliveryFeesLBP;
      } else {
        deliveryFeesShownUSD = deliveryFeesUSD + thirdPartyFeesUSD;
        deliveryFeesShownLBP = deliveryFeesLBP + thirdPartyFeesLBP;
      }
    } else {
      displayedTotalUSD = totalUSD + driverFeeUSD + thirdPartyFeesUSD;
      displayedTotalLBP = totalLBP + driverFeeLBP + thirdPartyFeesLBP;
      deliveryFeesShownUSD = 0;
      deliveryFeesShownLBP = 0;
      showDeliveryFees = false;
    }
  } else {
    displayedTotalUSD = totalUSD;
    displayedTotalLBP = totalLBP;
    deliveryFeesShownUSD = deliveryFeesUSD;
    deliveryFeesShownLBP = deliveryFeesLBP;
  }

  return {
    computedTotalUSD: toNumber(displayedTotalUSD, 2),
    computedTotalLBP: toNumber(displayedTotalLBP, 0),
    deliveryFeesUSDShown: toNumber(deliveryFeesShownUSD, 2),
    deliveryFeesLBPShown: toNumber(deliveryFeesShownLBP, 0),
    showDeliveryFees
  };
}

export function formatCurrency(value, currency) {
  const n = Number(value || 0);
  if (currency === 'LBP') return n.toLocaleString('en-LB');
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}


