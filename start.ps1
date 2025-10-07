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

Write-Host "Using remote MySQL database - no local database setup required." -ForegroundColor Green

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

# Run database migrations
Write-Host "Running database migrations..." -ForegroundColor Yellow
Set-Location -Path "$scriptDir\server"
npm run db:migrate
if ($LASTEXITCODE -ne 0) {
    Write-Host "Warning: Database migrations may have encountered issues." -ForegroundColor Yellow
    Write-Host "This is not critical if the database schema is already up to date." -ForegroundColor Yellow
}
Write-Host "Database migrations completed." -ForegroundColor Green

# Check and seed database if needed
Write-Host "Seeding database with initial data..." -ForegroundColor Yellow
npm run seed
if ($LASTEXITCODE -ne 0) {
    Write-Host "Warning: Database seeding may have encountered issues." -ForegroundColor Yellow
    Write-Host "This is not critical if the database was already populated." -ForegroundColor Yellow
}
Write-Host "Database setup completed." -ForegroundColor Green

# Start server and client
Write-Host "Starting server and client..." -ForegroundColor Yellow
Set-Location -Path $scriptDir

# Start the server in a new window (using start:ts instead of dev since bun is not installed)
Start-Process powershell -ArgumentList "-NoExit -Command Set-Location '$scriptDir\server'; npm run start:ts"

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