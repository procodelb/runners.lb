@echo off
echo Starting Soufian ERP Server with Neon PostgreSQL...
set DATABASE_URL=postgresql://neondb_owner:npg_wieBPlL4S8Hc@ep-odd-breeze-adojmdlg-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
set USE_SQLITE=false
set PG_SSL=true
cd server
npm start
