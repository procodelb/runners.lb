function toNumber(value, precision) {
  const n = Number(value || 0);
  if (precision === 0) return Math.round(n);
  if (typeof precision === 'number') return Math.round(n * Math.pow(10, precision)) / Math.pow(10, precision);
  return n;
}

// Canonical compute logic. Keep in sync with client src/utils/accountingUtils.js
function computeDisplayedAmounts(orderRow) {
  const totalUSD = toNumber(orderRow.total_usd, 2);
  const totalLBP = toNumber(orderRow.total_lbp, 0);
  const deliveryFeesUSD = toNumber(orderRow.delivery_fee_usd || orderRow.delivery_fees_usd, 2);
  const deliveryFeesLBP = toNumber(orderRow.delivery_fee_lbp || orderRow.delivery_fees_lbp, 0);
  const thirdPartyFeesUSD = toNumber(orderRow.third_party_fee_usd, 2);
  const thirdPartyFeesLBP = toNumber(orderRow.third_party_fee_lbp, 0);
  const driverFeeUSD = toNumber(orderRow.driver_fee_usd, 2);
  const driverFeeLBP = toNumber(orderRow.driver_fee_lbp, 0);
  const deliveryMethod = String(orderRow.delivery_mode || orderRow.deliver_method || '').toLowerCase();
  const orderType = String(orderRow.type || orderRow.order_type || '').toLowerCase();

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
      deliveryFeesShownUSD = deliveryFeesUSD + thirdPartyFeesUSD;
      deliveryFeesShownLBP = deliveryFeesLBP + thirdPartyFeesLBP;
    } else {
      displayedTotalUSD = totalUSD + driverFeeUSD + thirdPartyFeesUSD;
      displayedTotalLBP = totalLBP + driverFeeLBP + thirdPartyFeesLBP;
      deliveryFeesShownUSD = 0;
      deliveryFeesShownLBP = 0;
      showDeliveryFees = false;
    }
  } else {
    // Fallback: treat as in-house
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

module.exports = { computeDisplayedAmounts };


