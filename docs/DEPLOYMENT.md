# Deployment Guide

## Production Deployment

### Prerequisites

- Node.js >= 18
- PostgreSQL >= 14
- Docker & Docker Compose (optional)

### Backend Deployment

#### 1. Environment Setup

```bash
cd backend
cp .env.example .env
```

Configure `.env`:
```env
NODE_ENV=production
DATABASE_URL=postgresql://user:password@host:5432/db
JWT_SECRET=your-secret-key
PORT=5000
FRONTEND_URL=https://your-frontend-domain.com
```

#### 2. Database Migration

```bash
npm install
npm run migrate:latest
npm run seed:run
```

#### 3. Start Server

```bash
npm start
```

Or using PM2:
```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Frontend Deployment

#### 1. Environment Setup

```bash
cd frontend
cp .env.example .env
```

Configure `.env`:
```env
VITE_API_URL=https://api.your-domain.com
VITE_SOCKET_URL=https://api.your-domain.com
```

#### 2. Build

```bash
npm install
npm run build
```

#### 3. Deploy

Deploy the `dist/` folder to your hosting service (Vercel, Netlify, etc.)

### Docker Deployment

#### 1. Build

```bash
docker-compose -f docker-compose.prod.yml build
```

#### 2. Run

```bash
docker-compose -f docker-compose.prod.yml up -d
```

#### 3. View Logs

```bash
docker-compose logs -f
```

### Database Backup

```bash
# Backup
pg_dump DATABASE_URL > backup.sql

# Restore
psql DATABASE_URL < backup.sql
```

### Health Checks

- Backend: `GET https://api.your-domain.com/api/health`
- Frontend: Check if main page loads

### Monitoring

- Use PM2 or Docker logs for backend monitoring
- Set up error tracking (Sentry, LogRocket)
- Database query monitoring
- CPU/Memory monitoring

