const { query, run } = require('../config/database');

const lebanonFees = [
  { area: 'El Koura', in_house_usd: 2.00, third_party_usd: 4.00 },
  { area: 'Baabda', in_house_usd: 3.00, third_party_usd: 5.00 },
  { area: 'El Nabatieh', in_house_usd: 3.00, third_party_usd: 5.00 },
  { area: 'Sour', in_house_usd: 3.00, third_party_usd: 5.00 },
  { area: 'El Batroun', in_house_usd: 2.00, third_party_usd: 4.00 },
  { area: 'El Meten', in_house_usd: 3.00, third_party_usd: 5.00 },
  { area: 'Bcharre', in_house_usd: 2.00, third_party_usd: 4.00 },
  { area: 'Jbeil', in_house_usd: 3.00, third_party_usd: 5.00 },
  { area: 'Aley', in_house_usd: 3.00, third_party_usd: 5.00 },
  { area: 'Saida', in_house_usd: 3.00, third_party_usd: 5.00 },
  { area: 'Kesrwane', in_house_usd: 3.00, third_party_usd: 5.00 },
  { area: 'Zgharta', in_house_usd: 2.00, third_party_usd: 4.00 },
  { area: 'Marjaayoun', in_house_usd: 3.00, third_party_usd: 5.00 },
  { area: 'Beirut', in_house_usd: 3.00, third_party_usd: 5.00 },
  { area: 'El Minieh-Dennie', in_house_usd: 2.00, third_party_usd: 4.00 },
  { area: 'Akkar', in_house_usd: 2.00, third_party_usd: 4.00 },
  { area: 'Jezzine', in_house_usd: 3.00, third_party_usd: 5.00 },
  { area: 'Baalbek', in_house_usd: 3.00, third_party_usd: 5.00 },
  { area: 'Rachaya', in_house_usd: 3.00, third_party_usd: 5.00 },
  { area: 'Bent Jbeil', in_house_usd: 3.00, third_party_usd: 5.00 },
  { area: 'Zahle', in_house_usd: 3.00, third_party_usd: 5.00 },
  { area: 'Chouf', in_house_usd: 3.00, third_party_usd: 5.00 },
  { area: 'West Bekaa', in_house_usd: 3.00, third_party_usd: 5.00 },
  { area: 'El Hermel', in_house_usd: 3.00, third_party_usd: 5.00 },
  { area: 'Hasbaya', in_house_usd: 3.00, third_party_usd: 5.00 },
  { area: 'Tripoli', in_house_usd: 2.00, third_party_usd: 3.00 }
];

async function populateLebanonFees() {
  try {
    console.log('Starting to populate Lebanon delivery fees...');
    
    // Wait a bit for database to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // First, clear existing Lebanon entries
    await run('DELETE FROM price_list WHERE country = ?', ['Lebanon']);
    console.log('Cleared existing Lebanon entries');
    
    // Insert new entries
    for (const fee of lebanonFees) {
      const insertQuery = `
        INSERT INTO price_list (country, area, fees_usd, fees_lbp, third_party_fee_usd, third_party_fee_lbp)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      // Convert USD to LBP (approximate rate: 1 USD = 89,000 LBP)
      const in_house_lbp = Math.round(fee.in_house_usd * 89000);
      const third_party_lbp = Math.round(fee.third_party_usd * 89000);
      
      await run(insertQuery, [
        'Lebanon',
        fee.area,
        fee.in_house_usd,
        in_house_lbp,
        fee.third_party_usd,
        third_party_lbp
      ]);
      
      console.log(`Added: ${fee.area} - In-house: $${fee.in_house_usd}, Third-party: $${fee.third_party_usd}`);
    }
    
    console.log('Successfully populated Lebanon delivery fees!');
    console.log(`Total entries added: ${lebanonFees.length}`);
    
  } catch (error) {
    console.error('Error populating Lebanon fees:', error);
    throw error;
  }
}

// Run the script if called directly
if (require.main === module) {
  populateLebanonFees()
    .then(() => {
      console.log('Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

module.exports = populateLebanonFees;
