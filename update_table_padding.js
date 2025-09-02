const fs = require('fs');
const path = require('path');

// Files to update with their specific patterns
const filesToUpdate = [
  {
    file: 'client/src/pages/OrderHistory.jsx',
    patterns: [
      { from: 'px-6 py-4', to: 'px-4 py-3' }
    ]
  },
  {
    file: 'client/src/pages/PriceList.jsx',
    patterns: [
      { from: 'px-6 py-4', to: 'px-4 py-3' }
    ]
  },
  {
    file: 'client/src/pages/Cashbox.jsx',
    patterns: [
      { from: 'px-6 py-4', to: 'px-4 py-3' }
    ]
  },
  {
    file: 'client/src/pages/Settings.jsx',
    patterns: [
      { from: 'px-6 py-4', to: 'px-4 py-3' }
    ]
  },
  {
    file: 'client/src/pages/Transactions.jsx',
    patterns: [
      { from: 'px-6 py-4', to: 'px-4 py-3' }
    ]
  }
];

function updateFile(filePath, patterns) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let updated = false;
    
    patterns.forEach(pattern => {
      if (content.includes(pattern.from)) {
        content = content.replace(new RegExp(pattern.from, 'g'), pattern.to);
        updated = true;
        console.log(`✅ Updated ${pattern.from} → ${pattern.to} in ${filePath}`);
      }
    });
    
    if (updated) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ File updated: ${filePath}`);
    } else {
      console.log(`ℹ️  No changes needed for: ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Error updating ${filePath}:`, error.message);
  }
}

console.log('🔧 Updating table padding across all pages...');

filesToUpdate.forEach(({ file, patterns }) => {
  updateFile(file, patterns);
});

console.log('✅ Table padding update completed!');
