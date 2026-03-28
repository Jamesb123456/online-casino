#!/bin/bash
# Start both server and client for development

echo "=== Platinum Casino Development Server ==="
echo ""

# Check if node_modules exist
if [ ! -d "server/node_modules" ]; then
  echo "Installing server dependencies..."
  cd server && npm install && cd ..
fi

if [ ! -d "client/node_modules" ]; then
  echo "Installing client dependencies..."
  cd client && npm install && cd ..
fi

echo "Starting server on port 5000..."
cd server && npm run dev &
SERVER_PID=$!

echo "Starting client on port 5173..."
cd client && npm run dev &
CLIENT_PID=$!

echo ""
echo "Server: http://localhost:5000"
echo "Client: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers"

# Handle cleanup
trap "kill $SERVER_PID $CLIENT_PID 2>/dev/null; exit 0" INT TERM

wait
