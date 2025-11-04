# Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Prerequisites
- Node.js 18+
- PostgreSQL 14+ (or use Docker)
- npm or yarn

### 1. Install Dependencies

```bash
npm run install:all
```

### 2. Configure Environment

```bash
# Backend
cd server
cp .env.example .env
# Edit .env with your DATABASE_URL and JWT_SECRET

# Frontend
cd ../client
cp .env.example .env
# Edit .env with your API URL
```

### 3. Setup Database

Using Docker:
```bash
docker-compose up -d postgres
```

Or use your own PostgreSQL database.

### 4. Run Migrations

```bash
cd server
npm run setup:neon  # Or your preferred setup script
# Or run migrations manually
npm run migrate:latest
npm run seed:run
```

### 5. Start Development Servers

```bash
cd ..
npm run dev
```

This starts:
- Backend at http://localhost:5000
- Frontend at http://localhost:5173

### 6. Login

Navigate to http://localhost:5173/login

Default credentials:
- Email: `admin@soufiam.com` (or as set in seed)
- Password: `admin123` (change immediately!)

### 7. Run Tests

```bash
# Backend tests
cd server
npm test

# Frontend tests
cd ../client
npm test

# Acceptance tests
cd ../tests/acceptance
npm test
```

## 🐳 Docker Quick Start

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Reset database
docker-compose down -v
docker-compose up -d
```

## 🔧 Common Issues

### Database Connection Error
- Check DATABASE_URL in server/.env
- Ensure PostgreSQL is running
- Verify SSL settings for Neon

### CORS Error
- Add frontend URL to FRONTEND_URL in server/.env
- Check CORS configuration in server/index.js

### Migration Fails
- Ensure DATABASE_URL is correct
- Check PostgreSQL is accessible
- Verify database exists

### Socket Connection Error
- Check Socket.IO URL configuration
- Verify backend is running
- Check CORS settings

## 📞 Need Help?

- Check [Documentation](./docs/)
- See [API Docs](./docs/API.md)
- Review [Deployment Guide](./docs/DEPLOYMENT.md)

## 🎯 Next Steps

1. Change default passwords
2. Configure production environment
3. Set up backups
4. Review security settings
5. Train users

---

**Happy coding! 🎉**

