#!/bin/bash
set -e

echo "=== Docker Container Debug Information ==="
echo "Current working directory: $(pwd)"
echo "Contents of current directory:"
ls -la
echo ""
echo "Looking for docker-start.sh:"
find /app -name "docker-start.sh" -type f -exec ls -la {} \;
echo ""
echo "Docker-start.sh permissions:"
ls -la docker-start.sh 2>/dev/null || echo "docker-start.sh not found in current directory"
echo ""
echo "Attempting to execute docker-start.sh..."

if [ -f "./docker-start.sh" ]; then
    echo "File exists, attempting to run..."
    exec ./docker-start.sh
else
    echo "ERROR: docker-start.sh not found!"
    echo "Available files in /app:"
    find /app -type f -name "*.sh"
    exit 1
fi