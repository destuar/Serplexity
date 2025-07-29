#!/bin/sh
set -e

echo "🚀 Starting Serplexity Backend (Docker)..."

# Set Python path
export PYTHON_PATH="python3"
echo "✅ PYTHON_PATH set to: $PYTHON_PATH"

# Check PydanticAI availability
if $PYTHON_PATH -c "import pydantic_ai" 2>/dev/null; then
    echo "✅ PydanticAI is available"
else
    echo "❌ PydanticAI not found - attempting reinstall..."
    pip3 install --no-cache-dir --break-system-packages -r requirements.txt
    if $PYTHON_PATH -c "import pydantic_ai" 2>/dev/null; then
        echo "✅ PydanticAI installed successfully"
    else
        echo "❌ Critical: PydanticAI installation failed"
        exit 1
    fi
fi

# Run database migrations
echo "🔧 Running database migrations..."
node dist/scripts/run-with-secrets.js prisma migrate deploy || echo "⚠️ Database migrations skipped"

# Start the server
echo "🎯 Starting server..."
exec node dist/server.js