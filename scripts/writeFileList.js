const fs = require('fs');
const path = require('path');

function main() {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const files = [
    'server/routes/orders.js',
    'server/routes/accountingEnhanced.js',
    'server/routes/priceList.js',
    'client/src/pages/Orders.jsx',
    'client/src/components/OrdersGrid.jsx',
    'client/src/pages/OrderHistory.jsx',
    'client/src/pages/PriceList.jsx',
    'client/src/App.jsx',
    'server/utils/computeDisplayedAmounts.js'
  ];
  const out = { files };
  const outPath = path.join(process.cwd(), `cursor-file-list-${ts}.json`);
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
  console.log('Wrote', outPath);
}

main();


