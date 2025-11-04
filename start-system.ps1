# Soufian ERP System Startup Script
Write-Host "🚀 Starting Soufian ERP System with Neon PostgreSQL..." -ForegroundColor Green
Write-Host ""

# Set environment variables
$env:DATABASE_URL = "postgresql://neondb_owner:npg_wieBPlL4S8Hc@ep-odd-breeze-adojmdlg-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
$env:USE_SQLITE = "false"
$env:PG_SSL = "true"

Write-Host "🔧 Environment variables set for Neon PostgreSQL" -ForegroundColor Yellow
Write-Host "📡 Database URL: postgresql://***:***@ep-odd-breeze-adojmdlg-pooler.c-2.us-east-1.aws.neon.tech/neondb" -ForegroundColor Gray
Write-Host ""

# Start server in background
Write-Host "🖥️  Starting Server..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\server'; `$env:DATABASE_URL='$env:DATABASE_URL'; `$env:USE_SQLITE='$env:USE_SQLITE'; `$env:PG_SSL='$env:PG_SSL'; npm start"

# Wait a moment for server to start
Start-Sleep -Seconds 3

# Start client in background
Write-Host "🌐 Starting Client..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\client'; npm run dev"

Write-Host ""
Write-Host "✅ Both server and client are starting..." -ForegroundColor Green
Write-Host "🖥️  Server: http://localhost:5000" -ForegroundColor Blue
Write-Host "🌐 Client: http://localhost:5175" -ForegroundColor Blue
Write-Host ""
Write-Host "🔑 Login credentials:" -ForegroundColor Yellow
Write-Host "   Email: soufian@gmail.com" -ForegroundColor White
Write-Host "   Password: Soufi@n123" -ForegroundColor White
Write-Host ""
Write-Host "Press any key to continue..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
