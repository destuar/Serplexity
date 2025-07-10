#!/bin/bash

# Docker Cleanup Script for Serplexity
# This script helps free up disk space by cleaning Docker resources

set -e

echo "🧹 Serplexity Docker Cleanup Script"
echo "==================================="

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

# Show current disk usage
print_status "Current Docker disk usage:"
docker system df

print_status "Available disk space:"
df -h /var/lib/docker 2>/dev/null || df -h /

# Cleanup function
cleanup_docker() {
    print_status "Starting Docker cleanup..."
    
    # Stop all containers
    if [[ "$(docker ps -q)" ]]; then
        print_status "Stopping running containers..."
        docker stop $(docker ps -q)
    fi
    
    # Remove stopped containers
    if [[ "$(docker ps -aq)" ]]; then
        print_status "Removing stopped containers..."
        docker rm $(docker ps -aq)
    fi
    
    # Remove unused images
    print_status "Removing unused images..."
    docker image prune -a -f
    
    # Remove unused networks
    print_status "Removing unused networks..."
    docker network prune -f
    
    # Remove build cache
    print_status "Removing build cache..."
    docker builder prune -a -f
    
    # Remove unused volumes if requested
    if [[ "$1" == "--volumes" ]]; then
        print_warning "Removing unused volumes (this may remove data)..."
        docker volume prune -f
    fi
    
    # Final system prune
    print_status "Final system cleanup..."
    docker system prune -a -f
    
    print_success "Docker cleanup completed!"
}

# Show usage
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo "Options:"
    echo "  --volumes     Also remove unused volumes (WARNING: may cause data loss)"
    echo "  --help, -h    Show this help message"
}

# Main execution
main() {
    local remove_volumes=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --volumes)
                remove_volumes=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Confirm action
    if [[ "$remove_volumes" == true ]]; then
        print_warning "This will remove unused volumes and may cause data loss."
        read -p "Are you sure you want to continue? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "Cleanup cancelled."
            exit 0
        fi
        cleanup_docker --volumes
    else
        print_status "This will clean up Docker resources (keeping volumes)."
        read -p "Continue? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "Cleanup cancelled."
            exit 0
        fi
        cleanup_docker
    fi
    
    # Show final disk usage
    print_status "Final Docker disk usage:"
    docker system df
}

# Run main function
main "$@" 