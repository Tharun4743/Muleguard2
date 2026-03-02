# MongoDB Setup Script for MuleGuard
Write-Host "🚀 Setting up MongoDB for MuleGuard..." -ForegroundColor Green

# Check if MongoDB is already installed
try {
    $mongoVersion = mongod --version 2>$null
    Write-Host "✅ MongoDB is already installed" -ForegroundColor Green
} catch {
    Write-Host "❌ MongoDB not found. Installing MongoDB Community Server..." -ForegroundColor Yellow
    
    # Download MongoDB (you'll need to do this manually)
    Write-Host "Please follow these steps:" -ForegroundColor Cyan
    Write-Host "1. Download MongoDB from: https://www.mongodb.com/try/download/community" -ForegroundColor White
    Write-Host "2. Select Windows version and download the MSI installer" -ForegroundColor White
    Write-Host "3. Run the installer with default settings" -ForegroundColor White
    Write-Host "4. After installation, restart this script" -ForegroundColor White
    
    $continue = Read-Host "Have you installed MongoDB? (y/n)"
    if ($continue -ne 'y') {
        Write-Host "Please install MongoDB first and run this script again." -ForegroundColor Red
        exit 1
    }
}

# Create environment file
$envContent = @"
# MongoDB Configuration
MONGO_URI=mongodb://localhost:27017/mule_detection

# OpenRouter API Key for AI Fraud Detection
OPENROUTER_API_KEY=sk-or-v1-your-api-key-here

# Server Configuration
PORT=5000
NODE_ENV=development

# Banking API Integration (Optional)
BANKING_API_KEY=your-banking-api-key
BANKING_API_URL=https://api.bank.com/v1

# IP Geolocation Service
IPGEO_API_KEY=your-ip-geolocation-api-key
"@

$envPath = ".env"
if (Test-Path $envPath) {
    Write-Host "⚠️  .env file already exists. Skipping creation." -ForegroundColor Yellow
} else {
    $envContent | Out-File -FilePath $envPath -Encoding UTF8
    Write-Host "✅ Created .env file with MongoDB configuration" -ForegroundColor Green
}

# Start MongoDB service
try {
    Write-Host "🔄 Starting MongoDB service..." -ForegroundColor Yellow
    Start-Service MongoDB -ErrorAction Stop
    Write-Host "✅ MongoDB service started successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Could not start MongoDB service. Trying manual start..." -ForegroundColor Yellow
    
    # Try to start mongod manually
    try {
        Start-Process -FilePath "mongod" -ArgumentList "--dbpath", "C:\data\db" -NoNewWindow -PassThru
        Write-Host "✅ MongoDB started manually" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to start MongoDB. Please start it manually:" -ForegroundColor Red
        Write-Host "   Run: mongod --dbpath C:\data\db" -ForegroundColor White
        Write-Host "   Or install MongoDB Compass for GUI management" -ForegroundColor White
    }
}

# Test connection
Write-Host "🔍 Testing MongoDB connection..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

try {
    $testConnection = node -e "const mongoose = require('mongoose'); mongoose.connect('mongodb://localhost:27017/test', {serverSelectionTimeoutMS: 2000}).then(() => {console.log('✅ MongoDB connection successful'); process.exit(0)}).catch(err => {console.error('❌ Connection failed:', err.message); process.exit(1)})"
    Write-Host "✅ MongoDB is ready for MuleGuard!" -ForegroundColor Green
} catch {
    Write-Host "❌ Connection test failed. Please check MongoDB installation." -ForegroundColor Red
}

Write-Host "`n🎯 Next steps:" -ForegroundColor Cyan
Write-Host "1. Restart the MuleGuard server: npm start" -ForegroundColor White
Write-Host "2. Open http://localhost:5177/ in your browser" -ForegroundColor White
Write-Host "3. The system will now use MongoDB instead of in-memory storage" -ForegroundColor White
