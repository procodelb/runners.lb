# Soufiam ERP — Production-Ready Delivery & Logistics System

Complete ERP system for delivery and logistics management with real-time accounting, cashbox management, and order tracking.

## 🏗️ Architecture

- **Backend**: Node.js + TypeScript + Express + PostgreSQL
- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS
- **Database**: PostgreSQL with Knex.js migrations
- **Real-time**: Socket.IO
- **Auth**: JWT + bcrypt
- **Testing**: Jest + Supertest + Playwright
- **Infrastructure**: Docker + Docker Compose

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18
- PostgreSQL >= 14
- Docker & Docker Compose (optional)

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd soufiamERP

# Install dependencies
npm run install:all

# Setup environment
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Configure your DATABASE_URL in backend/.env

# Run migrations
cd backend
npm run migrate:latest

# Seed database (optional)
npm run seed:run

# Start development servers
cd ..
npm run dev
```

### Docker (Recommended)

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## 📁 Project Structure

```
soufiamERP/
├── backend/                 # Node.js + TypeScript backend
│   ├── src/
│   │   ├── config/         # Configuration files
│   │   ├── controllers/    # Route controllers
│   │   ├── middleware/     # Express middleware
│   │   ├── models/         # Database models
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── utils/          # Utilities
│   │   └── server.ts       # Express server
│   ├── migrations/         # Knex migrations
│   ├── seeds/              # Database seeds
│   ├── tests/              # Backend tests
│   └── package.json
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── api/            # API clients
│   │   ├── hooks/          # Custom hooks
│   │   ├── contexts/       # React contexts
│   │   └── utils/          # Utilities
│   ├── tests/              # Frontend tests
│   └── package.json
├── docs/                   # Documentation
├── docker-compose.yml      # Docker orchestration
├── .github/                # GitHub Actions CI
└── README.md

```

## 🎯 Key Features

### Orders Management
- Excel-like grid with batch entry
- Multiple order types: Ecommerce, Instant, Go-to-Market, Prepaid
- Real-time status tracking
- Driver assignment
- Location tracking

### Cashbox & Accounting
- Atomic cashbox updates with row-level locking
- Dual currency support (USD/LBP)
- Automatic exchange rate handling
- Transaction history
- Client accounting with detailed statements
- Driver accounting

### Real-time Updates
- Socket.IO for live updates
- Cashbox balance sync
- Order status updates
- Dashboard KPIs

### Reporting & Exports
- CSV export
- PDF generation with Puppeteer
- Financial reports
- Client statements

## 🧪 Testing

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:coverage
```

## 🚢 Deployment

### Backend (Production)

```bash
cd backend
npm run build
npm start
```

### Frontend (Production)

```bash
cd frontend
npm run build
# Deploy dist/ to your hosting service
```

### Docker Production

```bash
docker-compose -f docker-compose.prod.yml up -d
```

## 📊 Database Migrations

```bash
# Create new migration
cd backend
npm run migrate:make <migration-name>

# Run migrations
npm run migrate:latest

# Rollback
npm run migrate:rollback

# Check migration status
npm run migrate:status
```

## 🔐 Environment Variables

See `.env.example` files in `backend/` and `frontend/` for required environment variables.

### Backend Key Variables
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret
- `PORT` - Server port (default: 5000)

### Frontend Key Variables
- `VITE_API_URL` - Backend API URL
- `VITE_SOCKET_URL` - Socket.IO URL

## 📖 API Documentation

API documentation available at `/api-docs` when running the backend.

## 🔧 Development

```bash
# Start backend in watch mode
cd backend
npm run dev

# Start frontend in watch mode
cd frontend
npm run dev

# Run linters
npm run lint

# Format code
npm run format
```

## 📝 Contributing

1. Create a feature branch
2. Make your changes
3. Write tests
4. Run the test suite
5. Submit a pull request

## 📄 License

MIT

## 🆘 Support

For issues and questions, please open a GitHub issue.

