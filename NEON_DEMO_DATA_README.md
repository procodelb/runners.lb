# Neon Database Demo Data Seeding

This document describes the comprehensive demo data that has been seeded into the Neon PostgreSQL database for the Soufiam ERP system.

## 🎯 Overview

The Neon database has been successfully seeded with realistic demo data that mirrors the functionality of the local SQLite/PostgreSQL setup, ensuring consistency across all ERP modules.

## 🔑 Admin Credentials

**Email:** `runners.leb@gmail.com`  
**Password:** `123456789`

## 📊 Seeded Data Summary

### 👤 Users
- **1 Admin User** with full system access

### 💱 Exchange Rate
- **LBP/USD:** 89,000 (current Lebanese market rate)

### 💰 Price List (6 entries)
- **Beirut:** 200,000 LBP ($2.25 USD)
- **Mount Lebanon:** 250,000 LBP ($2.81 USD)
- **North Lebanon:** 300,000 LBP ($3.37 USD)
- **South Lebanon:** 300,000 LBP ($3.37 USD)
- **Bekaa:** 350,000 LBP ($3.93 USD)
- **Nabatieh:** 350,000 LBP ($3.93 USD)

### 👥 Clients (5 entries)
1. **Tech Solutions Lebanon** - Ahmad Al-Rashid (Technology)
2. **Lebanese Fashion House** - Sarah Mansour (Fashion)
3. **Cedar Restaurant** - Omar Khalil (Restaurant)
4. **Beirut Electronics** - Nadia Fares (Electronics)
5. **Mountain View Hotel** - George Abou Chakra (Hospitality)

### 🚗 Drivers (5 entries)
1. **Hassan Al-Zein** - Bourj Hammoud, Beirut (Reliable, night shifts)
2. **Mohammed Saad** - Achrafieh, Beirut (Experienced, fragile items)
3. **Ali Mansour** - Hamra, Beirut (Fast delivery, weekends)
4. **Karim Fares** - Gemmayze, Beirut (New driver, learning)
5. **Samir Khalil** - Ras Beirut, Beirut (Senior, VIP clients)

### 📦 Orders (5 entries)
1. **ORD-2024-001** - Tech Solutions Lebanon (Completed, Paid)
   - Electronics delivery, fragile items
   - $25.50 / 2,269,500 LBP
   - Driver: Hassan Al-Zein

2. **ORD-2024-002** - Lebanese Fashion House (In Transit, Partial)
   - Fashion items, third-party delivery
   - $45.75 / 4,071,750 LBP
   - Driver: Mohammed Saad

3. **ORD-2024-003** - Cedar Restaurant (Delivered, Paid)
   - Food delivery, keep hot
   - $15.25 / 1,357,250 LBP
   - Driver: Ali Mansour

4. **ORD-2024-004** - Beirut Electronics (Assigned, Unpaid)
   - High-value electronics, signature required
   - $125.00 / 11,125,000 LBP
   - Driver: Karim Fares

5. **ORD-2024-005** - Mountain View Hotel (New, Unpaid)
   - Hotel supplies delivery
   - $35.50 / 3,159,500 LBP
   - Driver: Samir Khalil

### 💳 Transactions (6 entries)
- **3 Order Payments** (ORD-2024-001, ORD-2024-002 partial, ORD-2024-003)
- **2 Driver Payments** (ORD-2024-001, ORD-2024-002)
- **1 Third Party Payment** (ORD-2024-002)

### 💰 Cashbox
- **Balance:** $60.52 / 5,385,750 LBP
- **6 Cashbox Entries** (3 income, 3 expenses)

## 🛠️ Scripts

### `seedNeonDemoData.js`
Main seeding script that populates all tables with demo data.

**Usage:**
```bash
cd server
node scripts/seedNeonDemoData.js
```

### `verifyNeonData.js`
Verification script that displays all seeded data for confirmation.

**Usage:**
```bash
cd server
node scripts/verifyNeonData.js
```

## 🔄 Data Consistency

The demo data maintains referential integrity across all tables:
- Orders reference valid drivers and clients
- Transactions reference valid orders and actors
- Cashbox entries reflect actual financial transactions
- All monetary amounts are consistent with the exchange rate

## 🌍 Geographic Coverage

The demo data covers all major Lebanese regions:
- Beirut (capital)
- Mount Lebanon (suburban areas)
- North Lebanon (Tripoli region)
- South Lebanon (Tyre/Sidon region)
- Bekaa Valley (agricultural region)
- Nabatieh (southern region)

## 💼 Business Categories

The demo clients represent diverse business sectors:
- **Technology** - Software and IT services
- **Fashion** - Clothing and accessories
- **Restaurant** - Food and beverage
- **Electronics** - Consumer electronics
- **Hospitality** - Hotels and tourism

## 📈 Financial Data

The demo data includes realistic financial scenarios:
- **Total Revenue:** $63.25 USD / 5,629,250 LBP
- **Total Expenses:** $2.73 USD / 243,500 LBP
- **Net Balance:** $60.52 USD / 5,385,750 LBP
- **Exchange Rate:** 89,000 LBP/USD

## 🚀 Ready for Testing

The Neon database is now fully populated and ready for:
- ✅ User authentication testing
- ✅ Order management workflows
- ✅ Driver assignment and tracking
- ✅ Financial transaction processing
- ✅ Cashbox management
- ✅ Client relationship management
- ✅ Price list management
- ✅ Reporting and analytics

## 🔧 Database Schema

The seeding script works with the complete Neon schema that includes:
- `users` - User authentication and roles
- `clients` - Customer relationship management
- `drivers` - Delivery personnel management
- `orders` - Order tracking and management
- `transactions` - Financial transaction history
- `cashbox` - Current cash balance
- `cashbox_entries` - Cash flow history
- `price_list` - Delivery pricing by region
- `exchange_rates` - Currency conversion rates

## 📝 Notes

- All data is realistic and representative of actual Lebanese business operations
- Phone numbers follow Lebanese format (+961)
- Addresses reference real Lebanese neighborhoods
- Business names and contacts are fictional but realistic
- Financial amounts reflect current Lebanese economic conditions
- All timestamps are set to recent dates for relevance

---

**Last Updated:** August 23, 2025  
**Database:** Neon PostgreSQL  
**Status:** ✅ Successfully Seeded
