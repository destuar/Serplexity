#!/bin/bash

# Serplexity Backend Startup Script
# Ensures proper Python environment and starts the server

echo "🚀 Starting Serplexity Backend..."

# Set the Python path to use virtual environment
export PYTHON_PATH="/Users/diegoestuar/Desktop/Serplexity/backend/venv/bin/python"
echo "✅ PYTHON_PATH set to: $PYTHON_PATH"

# Verify PydanticAI is available
if $PYTHON_PATH -c "import pydantic_ai" 2>/dev/null; then
    echo "✅ PydanticAI is available"
else
    echo "❌ PydanticAI not found - installing dependencies..."
    source venv/bin/activate
    pip install -r requirements.txt
    echo "✅ Dependencies installed"
fi

# Start server and workers concurrently (no hot-reload for workers)
echo "🎯 Starting server and workers..."

# Default log level (set LOG_LEVEL=DEBUG for verbose polling logs)
export LOG_LEVEL=${LOG_LEVEL:-INFO}

# Clean shutdown for both processes
cleanup() {
  echo "\n🛑 Stopping backend processes..."
  if [[ -n "$SERVER_PID" ]] && ps -p $SERVER_PID > /dev/null 2>&1; then
    kill $SERVER_PID 2>/dev/null || true
  fi
  if [[ -n "$WORKER_PID" ]] && ps -p $WORKER_PID > /dev/null 2>&1; then
    kill $WORKER_PID 2>/dev/null || true
  fi
  wait $SERVER_PID $WORKER_PID 2>/dev/null || true
  echo "✅ Backend processes stopped."
}

trap cleanup SIGINT SIGTERM EXIT

# Start workers (non–hot-reload)
echo "🧵 Starting workers (workers:dev)..."
npm run workers:dev &
WORKER_PID=$!
echo "✅ Workers started (pid: $WORKER_PID)"

# Start API (hot-reload)
echo "🌐 Starting API (dev)..."
npm run dev &
SERVER_PID=$!
echo "✅ API started (pid: $SERVER_PID)"

echo "🚦 Waiting for processes (press Ctrl+C to stop)"

# Portable wait loop (macOS bash/zsh compatible; no 'wait -n')
while true; do
  if ! ps -p $SERVER_PID > /dev/null 2>&1; then
    echo "⚠️  API process exited (pid: $SERVER_PID)"
    break
  fi
  if ! ps -p $WORKER_PID > /dev/null 2>&1; then
    echo "⚠️  Workers process exited (pid: $WORKER_PID)"
    break
  fi
  sleep 1
done
