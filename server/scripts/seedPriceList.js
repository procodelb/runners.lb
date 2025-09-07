const { query, run } = require('../config/database');

const lebaneseCities = [
  {
    country: 'Lebanon',
    area: 'Tripoli',
    fees_usd: 0,
    fees_lbp: 200000
  },
  {
    country: 'Lebanon',
    area: 'Akkar',
    fees_usd: 0,
    fees_lbp: 200000
  },
  {
    country: 'Lebanon',
    area: 'Zgharta',
    fees_usd: 0,
    fees_lbp: 200000
  },
  {
    country: 'Lebanon',
    area: 'Beirut',
    fees_usd: 0,
    fees_lbp: 200000
  }
];

async function seedPriceList() {
  try {
    console.log('🌱 Seeding price list with Lebanese cities...');
    
    // Wait for database initialization
    console.log('⏳ Waiting for database initialization...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Clear existing price list
    await run('DELETE FROM price_list WHERE country = ?', ['Lebanon']);
    console.log('✅ Cleared existing Lebanese cities');
    
    // Insert new cities
    for (const city of lebaneseCities) {
      await run(`
        INSERT INTO price_list (country, area, fees_usd, fees_lbp, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        city.country,
        city.area,
        city.fees_usd,
        city.fees_lbp,
        new Date().toISOString(),
        new Date().toISOString()
      ]);
      console.log(`✅ Added ${city.area}: ${city.fees_lbp.toLocaleString()} LBP`);
    }
    
    console.log('🎉 Price list seeded successfully!');
    
    // Verify the data
    const result = await query('SELECT * FROM price_list WHERE country = ? ORDER BY area', ['Lebanon']);
    console.log('📋 Current Lebanese cities in price list:');
    result.forEach(city => {
      console.log(`  - ${city.area}: ${city.fees_lbp.toLocaleString()} LBP ($${city.fees_usd})`);
    });
    
  } catch (error) {
    console.error('❌ Error seeding price list:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  seedPriceList()
    .then(() => {
      console.log('✅ Seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = { seedPriceList };
