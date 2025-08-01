#!/bin/sh
set -e

echo "🚀 Starting Serplexity Backend (Docker)..."

# Set Python path and module path
export PYTHON_PATH="python3"
export PYTHONPATH="/app:/app/src:$PYTHONPATH"
echo "✅ PYTHON_PATH set to: $PYTHON_PATH"
echo "✅ PYTHONPATH set to: $PYTHONPATH"

# Test Python module imports
echo "🔍 Testing Python module imports..."
if $PYTHON_PATH -c "import pydantic_agents.agents.answer_agent" 2>/dev/null; then
    echo "✅ PydanticAI agents are importable"
else
    echo "❌ PydanticAI agents import failed - checking structure..."
    ls -la /app/src/pydantic_agents/
    ls -la /app/src/pydantic_agents/agents/
    $PYTHON_PATH -c "import sys; print('Python path:', sys.path)"
fi

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

# Prisma client should already be generated during build

# Start the server (like local start.sh does)
echo "🎯 Starting server..."
exec node dist/server.js