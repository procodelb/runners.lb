const { db, run } = require('../config/database');

async function addCreatedByColumns() {
  try {
    console.log('🔧 Adding created_by columns to tables...');

    // Add created_by to transactions table
    try {
      await run('ALTER TABLE transactions ADD COLUMN created_by INTEGER');
      console.log('✅ Added created_by column to transactions table');
    } catch (error) {
      if (error.message.includes('duplicate column name')) {
        console.log('ℹ️ created_by column already exists in transactions table');
      } else {
        console.log('ℹ️ Could not add created_by to transactions table (might already exist)');
      }
    }

    // Add created_by to cashbox table
    try {
      await run('ALTER TABLE cashbox ADD COLUMN created_by INTEGER');
      console.log('✅ Added created_by column to cashbox table');
    } catch (error) {
      if (error.message.includes('duplicate column name')) {
        console.log('ℹ️ created_by column already exists in cashbox table');
      } else {
        console.log('ℹ️ Could not add created_by to cashbox table (might already exist)');
      }
    }

    // Add created_by to orders table
    try {
      await run('ALTER TABLE orders ADD COLUMN created_by INTEGER');
      console.log('✅ Added created_by column to orders table');
    } catch (error) {
      if (error.message.includes('duplicate column name')) {
        console.log('ℹ️ created_by column already exists in orders table');
      } else {
        console.log('ℹ️ Could not add created_by to orders table (might already exist)');
      }
    }

    // Add notes column to crm table
    try {
      await run('ALTER TABLE crm ADD COLUMN notes TEXT');
      console.log('✅ Added notes column to crm table');
    } catch (error) {
      if (error.message.includes('duplicate column name')) {
        console.log('ℹ️ notes column already exists in crm table');
      } else {
        console.log('ℹ️ Could not add notes to crm table (might already exist)');
      }
    }

    // Add order_ref column to orders table
    try {
      await run('ALTER TABLE orders ADD COLUMN order_ref TEXT');
      console.log('✅ Added order_ref column to orders table');
    } catch (error) {
      if (error.message.includes('duplicate column name')) {
        console.log('ℹ️ order_ref column already exists in orders table');
      } else {
        console.log('ℹ️ Could not add order_ref to orders table (might already exist)');
      }
    }

    // Add reference column to transactions table
    try {
      await run('ALTER TABLE transactions ADD COLUMN reference TEXT');
      console.log('✅ Added reference column to transactions table');
    } catch (error) {
      if (error.message.includes('duplicate column name')) {
        console.log('ℹ️ reference column already exists in transactions table');
      } else {
        console.log('ℹ️ Could not add reference to transactions table (might already exist)');
      }
    }

    // Add type column to orders table
    try {
      await run('ALTER TABLE orders ADD COLUMN type TEXT DEFAULT "ecommerce"');
      console.log('✅ Added type column to orders table');
    } catch (error) {
      if (error.message.includes('duplicate column name')) {
        console.log('ℹ️ type column already exists in orders table');
      } else {
        console.log('ℹ️ Could not add type to orders table (might already exist)');
      }
    }

    // Add is_purchase column to orders table
    try {
      await run('ALTER TABLE orders ADD COLUMN is_purchase BOOLEAN DEFAULT 0');
      console.log('✅ Added is_purchase column to orders table');
    } catch (error) {
      if (error.message.includes('duplicate column name')) {
        console.log('ℹ️ is_purchase column already exists in orders table');
      } else {
        console.log('ℹ️ Could not add is_purchase to orders table (might already exist)');
      }
    }

    // Add customer_phone column to orders table
    try {
      await run('ALTER TABLE orders ADD COLUMN customer_phone TEXT');
      console.log('✅ Added customer_phone column to orders table');
    } catch (error) {
      if (error.message.includes('duplicate column name')) {
        console.log('ℹ️ customer_phone column already exists in orders table');
      } else {
        console.log('ℹ️ Could not add customer_phone to orders table (might already exist)');
      }
    }

    // Add customer_name column to orders table
    try {
      await run('ALTER TABLE orders ADD COLUMN customer_name TEXT');
      console.log('✅ Added customer_name column to orders table');
    } catch (error) {
      if (error.message.includes('duplicate column name')) {
        console.log('ℹ️ customer_name column already exists in orders table');
      } else {
        console.log('ℹ️ Could not add customer_name to orders table (might already exist)');
      }
    }

    // Add customer_address column to orders table
    try {
      await run('ALTER TABLE orders ADD COLUMN customer_address TEXT');
      console.log('✅ Added customer_address column to orders table');
    } catch (error) {
      if (error.message.includes('duplicate column name')) {
        console.log('ℹ️ customer_address column already exists in orders table');
      } else {
        console.log('ℹ️ Could not add customer_address to orders table (might already exist)');
      }
    }

    // Add brand_name column to orders table
    try {
      await run('ALTER TABLE orders ADD COLUMN brand_name TEXT');
      console.log('✅ Added brand_name column to orders table');
    } catch (error) {
      if (error.message.includes('duplicate column name')) {
        console.log('ℹ️ brand_name column already exists in orders table');
      } else {
        console.log('ℹ️ Could not add brand_name to orders table (might already exist)');
      }
    }

    // Add voucher_code column to orders table
    try {
      await run('ALTER TABLE orders ADD COLUMN voucher_code TEXT');
      console.log('✅ Added voucher_code column to orders table');
    } catch (error) {
      if (error.message.includes('duplicate column name')) {
        console.log('ℹ️ voucher_code column already exists in orders table');
      } else {
        console.log('ℹ️ Could not add voucher_code to orders table (might already exist)');
      }
    }

    // Add deliver_method column to orders table
    try {
      await run('ALTER TABLE orders ADD COLUMN deliver_method TEXT DEFAULT "in_house"');
      console.log('✅ Added deliver_method column to orders table');
    } catch (error) {
      if (error.message.includes('duplicate column name')) {
        console.log('ℹ️ deliver_method column already exists in orders table');
      } else {
        console.log('ℹ️ Could not add deliver_method to orders table (might already exist)');
      }
    }

    // Add third_party_name column to orders table
    try {
      await run('ALTER TABLE orders ADD COLUMN third_party_name TEXT');
      console.log('✅ Added third_party_name column to orders table');
    } catch (error) {
      if (error.message.includes('duplicate column name')) {
        console.log('ℹ️ third_party_name column already exists in orders table');
      } else {
        console.log('ℹ️ Could not add third_party_name to orders table (might already exist)');
      }
    }

    // Add third_party_fee_usd column to orders table
    try {
      await run('ALTER TABLE orders ADD COLUMN third_party_fee_usd REAL DEFAULT 0');
      console.log('✅ Added third_party_fee_usd column to orders table');
    } catch (error) {
      if (error.message.includes('duplicate column name')) {
        console.log('ℹ️ third_party_fee_usd column already exists in orders table');
      } else {
        console.log('ℹ️ Could not add third_party_fee_usd to orders table (might already exist)');
      }
    }

    // Add third_party_fee_lbp column to orders table
    try {
      await run('ALTER TABLE orders ADD COLUMN third_party_fee_lbp INTEGER DEFAULT 0');
      console.log('✅ Added third_party_fee_lbp column to orders table');
    } catch (error) {
      if (error.message.includes('duplicate column name')) {
        console.log('ℹ️ third_party_fee_lbp column already exists in orders table');
      } else {
        console.log('ℹ️ Could not add third_party_fee_lbp to orders table (might already exist)');
      }
    }

    // Add driver_fee_usd column to orders table
    try {
      await run('ALTER TABLE orders ADD COLUMN driver_fee_usd REAL DEFAULT 0');
      console.log('✅ Added driver_fee_usd column to orders table');
    } catch (error) {
      if (error.message.includes('duplicate column name')) {
        console.log('ℹ️ driver_fee_usd column already exists in orders table');
      } else {
        console.log('ℹ️ Could not add driver_fee_usd to orders table (might already exist)');
      }
    }

    // Add driver_fee_lbp column to orders table
    try {
      await run('ALTER TABLE orders ADD COLUMN driver_fee_lbp INTEGER DEFAULT 0');
      console.log('✅ Added driver_fee_lbp column to orders table');
    } catch (error) {
      if (error.message.includes('duplicate column name')) {
        console.log('ℹ️ driver_fee_lbp column already exists in orders table');
      } else {
        console.log('ℹ️ Could not add driver_fee_lbp to orders table (might already exist)');
      }
    }

    // Add instant column to orders table
    try {
      await run('ALTER TABLE orders ADD COLUMN instant BOOLEAN DEFAULT 0');
      console.log('✅ Added instant column to orders table');
    } catch (error) {
      if (error.message.includes('duplicate column name')) {
        console.log('ℹ️ instant column already exists in orders table');
      } else {
        console.log('ℹ️ Could not add instant to orders table (might already exist)');
      }
    }

    // Add notes column to orders table
    try {
      await run('ALTER TABLE orders ADD COLUMN notes TEXT');
      console.log('✅ Added notes column to orders table');
    } catch (error) {
      if (error.message.includes('duplicate column name')) {
        console.log('ℹ️ notes column already exists in orders table');
      } else {
        console.log('ℹ️ Could not add notes to orders table (might already exist)');
      }
    }

    // Add status column to orders table
    try {
      await run('ALTER TABLE orders ADD COLUMN status TEXT DEFAULT "new"');
      console.log('✅ Added status column to orders table');
    } catch (error) {
      if (error.message.includes('duplicate column name')) {
        console.log('ℹ️ status column already exists in orders table');
      } else {
        console.log('ℹ️ Could not add status to orders table (might already exist)');
      }
    }

    // Add payment_status column to orders table
    try {
      await run('ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT "unpaid"');
      console.log('✅ Added payment_status column to orders table');
    } catch (error) {
      if (error.message.includes('duplicate column name')) {
        console.log('ℹ️ payment_status column already exists in orders table');
      } else {
        console.log('ℹ️ Could not add payment_status to orders table (might already exist)');
      }
    }

    // Add total_usd column to orders table
    try {
      await run('ALTER TABLE orders ADD COLUMN total_usd REAL DEFAULT 0');
      console.log('✅ Added total_usd column to orders table');
    } catch (error) {
      if (error.message.includes('duplicate column name')) {
        console.log('ℹ️ total_usd column already exists in orders table');
      } else {
        console.log('ℹ️ Could not add total_usd to orders table (might already exist)');
      }
    }

    // Add total_lbp column to orders table
    try {
      await run('ALTER TABLE orders ADD COLUMN total_lbp INTEGER DEFAULT 0');
      console.log('✅ Added total_lbp column to orders table');
    } catch (error) {
      if (error.message.includes('duplicate column name')) {
        console.log('ℹ️ total_lbp column already exists in orders table');
      } else {
        console.log('ℹ️ Could not add total_lbp to orders table (might already exist)');
      }
    }

    console.log('✅ Created_by columns addition completed');

  } catch (error) {
    console.error('❌ Error adding created_by columns:', error);
  }
}

// Run the fix if this file is executed directly
if (require.main === module) {
  addCreatedByColumns().then(() => {
    console.log('🎉 Created_by columns addition completed successfully!');
    process.exit(0);
  }).catch((error) => {
    console.error('❌ Created_by columns addition failed:', error);
    process.exit(1);
  });
}

module.exports = { addCreatedByColumns };
