# Online Casino Startup Script (PowerShell version)
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "= Online Casino Startup Script      =" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Check for required tools
Write-Host "Checking for required software..." -ForegroundColor Yellow

# Check Node.js
try {
    $nodeVersion = node -v
    Write-Host "Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "Node.js not found. Please install Node.js from https://nodejs.org/" -ForegroundColor Red
    Write-Host "After installation, restart this script." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Check npm
try {
    $npmVersion = npm -v
    Write-Host "npm found: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "npm not found. Please reinstall Node.js." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Check MongoDB installation and start it directly
Write-Host "Checking MongoDB..." -ForegroundColor Yellow
$mongoPath = "C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe"
if (Test-Path $mongoPath) {
    Write-Host "MongoDB found at $mongoPath" -ForegroundColor Green
    
    # Create data directory if it doesn't exist
    $dataDir = "C:\data\db"
    if (!(Test-Path $dataDir)) {
        Write-Host "Creating MongoDB data directory at $dataDir..." -ForegroundColor Yellow
        New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
        Write-Host "Data directory created!" -ForegroundColor Green
    }
    
    # Start MongoDB directly (no service required)
    Write-Host "Starting MongoDB server..." -ForegroundColor Yellow
    try {
        # Start mongod in a new window
        Start-Process $mongoPath -ArgumentList "--dbpath `"$dataDir`"" -WindowStyle Minimized
        Write-Host "MongoDB server started successfully!" -ForegroundColor Green
        # Give MongoDB time to initialize
        Write-Host "Waiting for MongoDB to initialize..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5
    } catch {
        Write-Host "Failed to start MongoDB server: $_" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
} else {
    Write-Host "MongoDB not found at expected location: $mongoPath" -ForegroundColor Red
    Write-Host "Please make sure MongoDB is installed at the correct location." -ForegroundColor Red
    Write-Host "If MongoDB is installed elsewhere, please update this script with the correct path." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Install dependencies
$scriptDir = $PSScriptRoot

Write-Host "Installing server dependencies..." -ForegroundColor Yellow
Set-Location -Path "$scriptDir\server"
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to install server dependencies." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "Server dependencies installed." -ForegroundColor Green

Write-Host "Installing client dependencies..." -ForegroundColor Yellow
Set-Location -Path "$scriptDir\client"
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to install client dependencies." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "Client dependencies installed." -ForegroundColor Green

# Check and seed database if needed
Write-Host "Checking database..." -ForegroundColor Yellow
Set-Location -Path "$scriptDir\server"
npm run seed
if ($LASTEXITCODE -ne 0) {
    Write-Host "Warning: Database seeding may have encountered issues." -ForegroundColor Yellow
    Write-Host "This is not critical if the database was already populated." -ForegroundColor Yellow
}
Write-Host "Database setup completed." -ForegroundColor Green

# Start server and client
Write-Host "Starting server and client..." -ForegroundColor Yellow
Set-Location -Path $scriptDir

# Start the server in a new window
Start-Process powershell -ArgumentList "-NoExit -Command Set-Location '$scriptDir\server'; npm run dev"

# Wait a moment to ensure server starts first
Start-Sleep -Seconds 5

# Start the client in a new window
Start-Process powershell -ArgumentList "-NoExit -Command Set-Location '$scriptDir\client'; npm run dev"

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host " Online Casino startup complete!" -ForegroundColor Cyan
Write-Host " Server running at: http://localhost:5000" -ForegroundColor Cyan
Write-Host " Client running at: http://localhost:5173" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Login credentials:" -ForegroundColor Green
Write-Host "  Admin: username=admin, password=admin123" -ForegroundColor Green
Write-Host "  Players: username=player1 (or player2, player3, etc.), password=password123" -ForegroundColor Green
Write-Host ""
Write-Host "To stop the application, close the server and client windows." -ForegroundColor Yellow
Write-Host ""

Set-Location -Path $scriptDir
Write-Host "Script execution complete." -ForegroundColor Green
Read-Host "Press Enter to close this window"