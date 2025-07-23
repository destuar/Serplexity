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

# Start the server
echo "🎯 Starting server..."
npm run dev