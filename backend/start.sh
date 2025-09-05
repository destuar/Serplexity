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
STOP_REQUESTED=0

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

# Honor Ctrl+C: on SIGINT/SIGTERM run cleanup and exit; also run cleanup on normal EXIT
trap 'STOP_REQUESTED=1; cleanup; exit 0' SIGINT SIGTERM
trap cleanup EXIT

# Helper to (re)start API
start_api() {
  echo "🌐 Starting API (dev)..."
  npm run dev &
  SERVER_PID=$!
  echo "✅ API started (pid: $SERVER_PID)"
}

# Helper to (re)start workers
start_workers() {
  echo "🧵 Starting workers (workers:dev)..."
  npm run workers:dev &
  WORKER_PID=$!
  echo "✅ Workers started (pid: $WORKER_PID)"
}

# Initial start
start_workers
start_api

echo "🚦 Supervising API and Workers (press Ctrl+C to stop)"

# Supervision loop: if one exits, respawn it; keep the other running
while true; do
  if [ "$STOP_REQUESTED" = "1" ]; then
    break
  fi
  if ! ps -p $SERVER_PID > /dev/null 2>&1; then
    if [ "$STOP_REQUESTED" = "1" ]; then break; fi
    echo "♻️  API exited (old pid: $SERVER_PID); respawning..."
    start_api
  fi
  if ! ps -p $WORKER_PID > /dev/null 2>&1; then
    if [ "$STOP_REQUESTED" = "1" ]; then break; fi
    echo "♻️  Workers exited (old pid: $WORKER_PID); respawning..."
    start_workers
  fi
  sleep 1
done
