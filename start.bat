@echo off
echo =====================================
echo = Online Casino Startup Script      =
echo =====================================
echo.

REM Check for required tools
echo Checking for required software...

REM Check Node.js
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js not found. Please install Node.js from https://nodejs.org/
    echo After installation, restart this script.
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%a in ('node -v') do echo Node.js found: %%a
)

REM Check npm
npm -v >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: npm not found. Please reinstall Node.js.
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%a in ('npm -v') do echo npm found: %%a
)

echo Using remote MySQL database - no local database setup required.

REM Install dependencies
echo Installing server dependencies...
cd /d "%~dp0server"
call npm install
if %errorlevel% neq 0 (
    echo Failed to install server dependencies.
    pause
    exit /b 1
)
echo Server dependencies installed.

echo Installing client dependencies...
cd /d "%~dp0client"
call npm install
if %errorlevel% neq 0 (
    echo Failed to install client dependencies.
    pause
    exit /b 1
)
echo Client dependencies installed.

REM Run database migrations
echo Running database migrations...
cd /d "%~dp0server"
call npm run db:migrate
if %errorlevel% neq 0 (
    echo Warning: Database migrations may have encountered issues.
    echo This is not critical if the database schema is already up to date.
)
echo Database migrations completed.

REM Check and seed database if needed
echo Seeding database with initial data...
call npm run seed
if %errorlevel% neq 0 (
    echo Warning: Database seeding may have encountered issues.
    echo This is not critical if the database was already populated.
)
echo Database setup completed.

REM Start server and client
echo Starting server and client...
cd /d "%~dp0"

REM Start the server in a new window
start "Casino Server" cmd /k "cd /d "%~dp0server" && npm run dev"

REM Wait a moment to ensure server starts first
timeout /t 5 /nobreak >nul

REM Start the client in a new window
start "Casino Client" cmd /k "cd /d "%~dp0client" && npm run dev"

echo.
echo ================================================================
echo  Online Casino startup complete!
echo  Server running at: http://localhost:5000
echo  Client running at: http://localhost:5173
echo ================================================================
echo.
echo Login credentials:
echo   Admin: username=admin, password=admin123
echo   Players: username=player1 (or player2, player3, etc.), password=password123
echo.
echo To stop the application, close the server and client windows.
echo.

cd /d "%~dp0"
echo Script execution complete.
pause