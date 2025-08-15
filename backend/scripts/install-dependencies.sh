#!/bin/bash

# install-dependencies.sh
# Automated dependency installation script for Serplexity backend
# Ensures all Python and system dependencies are properly installed

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the correct directory
check_directory() {
    if [[ ! -f "requirements.txt" ]]; then
        log_error "requirements.txt not found. Please run this script from the backend directory."
        exit 1
    fi

    if [[ ! -f "package.json" ]]; then
        log_error "package.json not found. Please run this script from the backend directory."
        exit 1
    fi

    log_success "Found requirements.txt and package.json - we're in the right directory"
}

# Check Python installation
check_python() {
    log_info "Checking Python installation..."

    PYTHON_CMD="python3"
    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 --version 2>&1)
        log_success "Found Python: $PYTHON_VERSION"
    elif command -v python &> /dev/null; then
        PYTHON_VERSION=$(python --version 2>&1)
        if [[ $PYTHON_VERSION == *"Python 3"* ]]; then
            PYTHON_CMD="python"
            log_success "Found Python: $PYTHON_VERSION"
        else
            log_error "Python 3 is required, but found: $PYTHON_VERSION"
            exit 1
        fi
    else
        log_error "Python 3 is not installed. Please install Python 3.8 or higher."
        exit 1
    fi

    export PYTHON_CMD
}

# Check pip installation
check_pip() {
    log_info "Checking pip installation..."

    PIP_CMD="pip3"
    if command -v pip3 &> /dev/null; then
        PIP_VERSION=$(pip3 --version)
        log_success "Found pip: $PIP_VERSION"
    elif command -v pip &> /dev/null; then
        PIP_VERSION=$(pip --version)
        if [[ $PIP_VERSION == *"python 3"* ]]; then
            PIP_CMD="pip"
            log_success "Found pip: $PIP_VERSION"
        else
            log_error "pip for Python 3 is required"
            exit 1
        fi
    else
        log_error "pip is not installed. Please install pip for Python 3."
        exit 1
    fi

    export PIP_CMD
}

# Install Node.js dependencies
install_node_dependencies() {
    log_info "Installing Node.js dependencies..."

    if command -v npm &> /dev/null; then
        npm install
        log_success "Node.js dependencies installed successfully"
    else
        log_error "npm is not installed. Please install Node.js and npm."
        exit 1
    fi
}

# Create virtual environment if it doesn't exist
setup_virtual_environment() {
    log_info "Setting up Python virtual environment..."

    if [[ ! -d "venv" ]]; then
        log_info "Creating virtual environment..."
        $PYTHON_CMD -m venv venv
        log_success "Virtual environment created"
    else
        log_info "Virtual environment already exists"
    fi

    # Activate virtual environment
    source venv/bin/activate
    log_success "Virtual environment activated"

    # Upgrade pip in virtual environment
    pip install --upgrade pip
    log_success "pip upgraded in virtual environment"
}

# Install Python dependencies
install_python_dependencies() {
    log_info "Installing Python dependencies..."

    # Install requirements
    pip install -r requirements.txt

    # Verify installation
    if pip show pydantic-ai &> /dev/null; then
        PYDANTIC_VERSION=$(pip show pydantic-ai | grep Version | cut -d' ' -f2)
        log_success "PydanticAI installed successfully (version: $PYDANTIC_VERSION)"
    else
        log_error "PydanticAI installation failed"
        exit 1
    fi

    # Test import
    if python -c "import pydantic_ai; print('PydanticAI import successful')" &> /dev/null; then
        log_success "PydanticAI import test passed"
    else
        log_error "PydanticAI import test failed"
        exit 1
    fi
}

# Validate installation
validate_installation() {
    log_info "Validating installation..."

    # Test Node.js dependencies
    if node -e "console.log('Node.js working')" &> /dev/null; then
        log_success "Node.js validation passed"
    else
        log_error "Node.js validation failed"
        exit 1
    fi

    # Test Python dependencies
    if python -c "
import pydantic_ai
import pydantic
import typing_extensions
print('All Python dependencies working')
" &> /dev/null; then
        log_success "Python dependencies validation passed"
    else
        log_error "Python dependencies validation failed"
        exit 1
    fi

    # Test PydanticAI functionality
    if python -c "
from pydantic_ai import Agent
agent = Agent('test')
print('PydanticAI agent creation successful')
" &> /dev/null; then
        log_success "PydanticAI functionality test passed"
    else
        log_warning "PydanticAI functionality test failed - this might be due to missing API keys"
    fi
}

# Create activation script
create_activation_script() {
    log_info "Creating environment activation script..."

    cat > activate_env.sh << 'EOF'
#!/bin/bash
# Activation script for Serplexity backend environment

echo "🔍 Activating Serplexity backend environment..."

# Activate Python virtual environment
if [[ -d "venv" ]]; then
    source venv/bin/activate
    echo "✅ Python virtual environment activated"
else
    echo "❌ Virtual environment not found. Run install-dependencies.sh first."
    exit 1
fi

# Set Python path for the application
export PYTHON_PATH=$(which python)
echo "✅ PYTHON_PATH set to: $PYTHON_PATH"

# Verify installation
echo "🔍 Verifying dependencies..."
if python -c "import pydantic_ai; print('PydanticAI:', pydantic_ai.__version__)" 2>/dev/null; then
    echo "✅ PydanticAI is available"
else
    echo "❌ PydanticAI is not available"
fi

echo "🚀 Environment ready! You can now run: npm run dev"
EOF

    chmod +x activate_env.sh
    log_success "Created activate_env.sh script"
}

# Update package.json scripts
update_package_scripts() {
    log_info "Checking package.json scripts..."

    # Check if dev:python script exists
    if grep -q '"dev:python"' package.json; then
        log_info "dev:python script already exists"
    else
        log_info "Adding dev:python script to package.json..."
        # This would require jq or manual editing
        log_warning "Please add this script to package.json manually:"
        echo '  "dev:python": "source venv/bin/activate && npm run dev"'
    fi
}

# Create .env template if it doesn't exist
create_env_template() {
    if [[ ! -f ".env" && ! -f ".env.example" ]]; then
        log_info "Creating .env template..."

        cat > .env.example << 'EOF'
# Dependency Management
AUTO_REMEDIATE_DEPENDENCIES=false
DEPENDENCY_CHECK_ENABLED=true
FAIL_FAST_ON_DEPENDENCIES=false

# Python Environment
PYTHON_PATH=

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/serplexity

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# API Keys (required for PydanticAI)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
PERPLEXITY_API_KEY=
EOF

        log_success "Created .env.example template"
        log_warning "Please copy .env.example to .env and fill in your values"
    fi
}

# Main installation process
main() {
    log_info "🚀 Starting Serplexity backend dependency installation..."
    echo

    check_directory
    check_python
    check_pip

    echo
    log_info "📦 Installing dependencies..."

    install_node_dependencies
    setup_virtual_environment
    install_python_dependencies

    echo
    log_info "✅ Validating installation..."

    validate_installation
    create_activation_script
    update_package_scripts
    create_env_template

    echo
    log_success "🎉 Installation completed successfully!"
    echo
    echo "Next steps:"
    echo "1. Copy .env.example to .env and configure your settings"
    echo "2. Add your API keys to .env file"
    echo "3. Run: source activate_env.sh"
    echo "4. Run: npm run dev"
    echo
    echo "For future development sessions, just run: source activate_env.sh"
}

# Run main function
main "$@"
