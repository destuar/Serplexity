# Serplexity Docker Setup

This directory contains the Docker configuration and management scripts for the Serplexity application.

## Quick Start

### Option 1: Using the Rebuild Script (Recommended)

```bash
# From project root
./infra/docker/docker-rebuild.sh
```

### Option 2: Manual Docker Compose

```bash
# From project root
docker-compose -f infra/docker/docker-compose.yml up -d
```

## Scripts

### 🚀 `docker-rebuild.sh`

Comprehensive rebuild script with cleanup and optimization.

**Usage:**

```bash
./infra/docker/docker-rebuild.sh [OPTIONS]

Options:
  --clean-volumes    Remove unused volumes (WARNING: data loss)
  --no-cache         Build without using cache
  --help, -h         Show help message
```

**Examples:**

```bash
# Normal rebuild with cleanup
./infra/docker/docker-rebuild.sh

# Rebuild without cache (for major changes)
./infra/docker/docker-rebuild.sh --no-cache

# Full cleanup including volumes (removes data)
./infra/docker/docker-rebuild.sh --clean-volumes
```

### 🧹 `docker-cleanup.sh`

Disk space cleanup script for Docker resources.

**Usage:**

```bash
./infra/docker/docker-cleanup.sh [OPTIONS]

Options:
  --volumes     Also remove unused volumes (WARNING: may cause data loss)
  --help, -h    Show help message
```

## Architecture

### Services

- **Backend**: Node.js/Express API server
- **Frontend**: React SPA served by Nginx
- **PostgreSQL**: Database
- **Redis**: Cache and queue storage
- **Jaeger**: Distributed tracing

### Resource Limits

- **Backend**: 1GB memory limit, 512MB reserved
- **Frontend**: 512MB memory limit, 256MB reserved
- **PostgreSQL**: 512MB memory limit, 256MB reserved
- **Redis**: 256MB memory limit, 128MB reserved
- **Jaeger**: 512MB memory limit, 256MB reserved

## Optimizations

### Build Optimizations

- **Multi-stage builds** for smaller production images
- **Layer caching** optimization for faster rebuilds
- **npm cache cleanup** to reduce disk usage
- **BuildKit** enabled for better performance
- **Memory limits** for Node.js processes

### Runtime Optimizations

- **Health checks** for all services
- **Dependency ordering** with health check conditions
- **Resource limits** to prevent memory issues
- **Restart policies** for reliability

## Troubleshooting

### Common Issues

#### 1. Disk Space Issues

```bash
# Check Docker disk usage
docker system df

# Clean up Docker resources
./infra/docker/docker-cleanup.sh
```

#### 2. Build Failures

```bash
# Rebuild without cache
./infra/docker/docker-rebuild.sh --no-cache

# Check logs for specific service
docker-compose -f infra/docker/docker-compose.yml logs backend
```

#### 3. Memory Issues

```bash
# Check container resource usage
docker stats

# Restart specific service
docker-compose -f infra/docker/docker-compose.yml restart backend
```

### Environment Variables

Make sure you have the required environment files:

- `backend/.env` - Backend configuration
- See `backend/.env.example` for required variables

### Port Mappings

- **Frontend**: http://localhost:80
- **Backend**: http://localhost:8001
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379
- **Jaeger UI**: http://localhost:16686

## Development vs Production

### Development

```bash
# Start services
docker-compose -f infra/docker/docker-compose.yml up -d

# View logs
docker-compose -f infra/docker/docker-compose.yml logs -f

# Stop services
docker-compose -f infra/docker/docker-compose.yml down
```

### Production

The same compose file is used, but with production environment variables and optimizations.

## Monitoring

### Health Checks

All services have health checks configured. Check status with:

```bash
docker-compose -f infra/docker/docker-compose.yml ps
```

### Logs

```bash
# All services
docker-compose -f infra/docker/docker-compose.yml logs -f

# Specific service
docker-compose -f infra/docker/docker-compose.yml logs -f backend
```

### Metrics

Access Jaeger UI at http://localhost:16686 for distributed tracing.

## Best Practices

1. **Use the rebuild script** for consistent builds
2. **Monitor disk usage** regularly
3. **Check logs** for errors and performance issues
4. **Keep environment files** up to date
5. **Use health checks** to verify service status
6. **Clean up** unused resources periodically
