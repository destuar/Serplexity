#!/bin/bash

# Docker Rebuild Script for Serplexity
# This script helps rebuild Docker containers with proper cleanup

set -e

echo "🚀 Serplexity Docker Rebuild Script"
echo "=================================="

# Function to print colored output
print_status() {
    echo -e "\033[1;34m[INFO]\033[0m $1"
}

print_success() {
    echo -e "\033[1;32m[SUCCESS]\033[0m $1"
}

print_error() {
    echo -e "\033[1;31m[ERROR]\033[0m $1"
}

print_warning() {
    echo -e "\033[1;33m[WARNING]\033[0m $1"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker first."
    exit 1
fi

# Check available disk space
available_space=$(df -h /var/lib/docker 2>/dev/null | awk 'NR==2 {print $4}' || echo "Unknown")
print_status "Available Docker disk space: $available_space"

# Cleanup function
cleanup_docker() {
    print_status "Cleaning up Docker resources..."
    
    # Stop containers
    docker-compose -f infra/docker/docker-compose.yml down --remove-orphans 2>/dev/null || true
    
    # Remove unused containers, networks, images
    docker system prune -f
    
    # Remove dangling images
    docker image prune -f
    
    # Remove unused volumes (optional, be careful)
    if [[ "$1" == "--clean-volumes" ]]; then
        print_warning "Removing unused volumes..."
        docker volume prune -f
    fi
    
    print_success "Docker cleanup completed"
}

# Build function
build_services() {
    print_status "Building Docker services..."
    
    # Use BuildKit for better caching and performance
    export DOCKER_BUILDKIT=1
    export COMPOSE_DOCKER_CLI_BUILD=1
    
    # Build with no cache if requested
    if [[ "$1" == "--no-cache" ]]; then
        print_status "Building without cache..."
        docker-compose -f infra/docker/docker-compose.yml build --no-cache
    else
        print_status "Building with cache..."
        docker-compose -f infra/docker/docker-compose.yml build
    fi
    
    print_success "Build completed"
}

# Main execution
main() {
    local clean_volumes=false
    local no_cache=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --clean-volumes)
                clean_volumes=true
                shift
                ;;
            --no-cache)
                no_cache=true
                shift
                ;;
            --help|-h)
                echo "Usage: $0 [OPTIONS]"
                echo "Options:"
                echo "  --clean-volumes    Remove unused volumes (WARNING: data loss)"
                echo "  --no-cache         Build without using cache"
                echo "  --help, -h         Show this help message"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Check if we're in the right directory
    if [[ ! -f "infra/docker/docker-compose.yml" ]]; then
        print_error "Please run this script from the project root directory"
        exit 1
    fi
    
    # Cleanup first
    if [[ "$clean_volumes" == true ]]; then
        cleanup_docker --clean-volumes
    else
        cleanup_docker
    fi
    
    # Build services
    if [[ "$no_cache" == true ]]; then
        build_services --no-cache
    else
        build_services
    fi
    
    print_success "Docker rebuild completed successfully!"
    print_status "You can now run: docker-compose -f infra/docker/docker-compose.yml up -d"
}

# Run main function
main "$@" 