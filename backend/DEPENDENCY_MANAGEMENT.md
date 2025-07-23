# Dependency Management & System Resilience

This document outlines the comprehensive dependency management system implemented to prevent cascade failures like the PydanticAI/database certificate issue.

## Overview

The system implements multiple layers of protection:

1. **Startup Validation** - Validates all dependencies before accepting traffic
2. **Graceful Degradation** - Continues operation with reduced functionality when non-critical services fail
3. **Enhanced Error Handling** - Prevents error handling from causing additional failures
4. **Automated Remediation** - Attempts to fix common dependency issues automatically
5. **Comprehensive Monitoring** - Provides detailed health checks and alerting

## Quick Start

### Automated Installation

```bash
# Run the automated installation script
cd backend
./scripts/install-dependencies.sh

# Activate the environment for development
source activate_env.sh

# Start the server
npm run dev
```

### Manual Installation

```bash
# Install Node.js dependencies
npm install

# Create Python virtual environment
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Verify installation
python -c "import pydantic_ai; print('PydanticAI installed successfully')"
```

## Architecture

### 1. Dependency Validator (`src/services/dependencyValidator.ts`)

Validates all critical system dependencies:

- **Python availability** - Checks if Python 3 is available
- **PydanticAI installation** - Verifies pydantic-ai package is installed
- **Requirements synchronization** - Ensures installed packages match requirements.txt
- **Database connectivity** - Tests database connection
- **Redis connectivity** - Tests Redis connection
- **AWS credentials** - Validates AWS configuration
- **PydanticAI agents** - Checks agent directory structure

#### Usage

```typescript
import DependencyValidator from './services/dependencyValidator';

const validator = DependencyValidator.getInstance();
const result = await validator.validateAll();

if (!result.success) {
  console.log('Critical failures:', result.criticalFailures);
  console.log('Warnings:', result.warnings);
}
```

### 2. System Validator (`src/startup/systemValidator.ts`)

Manages system-wide startup validation and determines operational mode:

- **Healthy Mode** - All dependencies validated successfully
- **Degraded Mode** - Core infrastructure works, but some AI services unavailable
- **Failed Mode** - Critical infrastructure failures prevent startup

#### Configuration

```bash
# Environment variables
DEPENDENCY_CHECK_ENABLED=true           # Enable dependency checking
FAIL_FAST_ON_DEPENDENCIES=false        # Fail immediately on dependency errors
AUTO_REMEDIATE_DEPENDENCIES=false      # Attempt automatic fixes
```

### 3. Enhanced Error Handling

#### Database Connection Resilience

The report worker now includes robust database error handling:

```typescript
// Enhanced error handling in reportWorker.ts
await this.safeUpdateReportStatus(runId, {
  status: "FAILED",
  stepStatus: error.message,
});
```

Features:
- **Retry logic** with exponential backoff
- **Connection error detection** (TLS, SSL, network issues)
- **Automatic reconnection** attempts
- **Fallback error reporting** when database is unavailable

#### Graceful Service Degradation

PydanticAI service now handles dependency failures gracefully:

```typescript
// In pydanticLlmService.ts
if (validation.success) {
  // Full functionality mode
} else {
  // Degraded mode - log detailed failures and continue
  logger.error("Running in degraded mode", {
    criticalFailures: validation.criticalFailures,
    remediationSteps: this.generateRemediationSteps(validation.results)
  });
}
```

## Health Check Endpoints

### System Health
```
GET /api/health/system
```
Returns overall system health with dependency status.

### Dependencies
```
GET /api/health/dependencies
```
Detailed dependency validation results.

### Readiness Probe
```
GET /api/health/ready
```
Kubernetes-compatible readiness probe.

### Liveness Probe
```
GET /api/health/live
```
Kubernetes-compatible liveness probe.

### Manual Validation
```
POST /api/health/validate
```
Force re-validation of all dependencies.

## Monitoring & Alerting

### Health Check Responses

**Healthy (200)**:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-23T...",
  "dependencies": {
    "total": 7,
    "healthy": 7,
    "unhealthy": 0,
    "criticalUnhealthy": 0
  }
}
```

**Degraded (206)**:
```json
{
  "status": "degraded",
  "timestamp": "2025-01-23T...",
  "dependencies": {
    "total": 7,
    "healthy": 5,
    "unhealthy": 2,
    "criticalUnhealthy": 0
  },
  "warnings": ["pydantic-ai-installation: Not installed"]
}
```

**Unhealthy (503)**:
```json
{
  "status": "unhealthy",
  "criticalFailures": [
    "database-connectivity: Connection failed",
    "redis-connectivity: Connection timeout"
  ]
}
```

## Troubleshooting

### Common Issues

#### 1. PydanticAI Not Installed
```
Error: No module named 'pydantic_ai'
```

**Solution**:
```bash
cd backend
source venv/bin/activate  # If using virtual environment
pip install -r requirements.txt
```

#### 2. Python Path Issues
```
Error: Python not available at path
```

**Solution**:
```bash
# Set explicit Python path
export PYTHON_PATH=/usr/bin/python3

# Or in .env file
PYTHON_PATH=/usr/bin/python3
```

#### 3. Database Certificate Errors
```
Error: bad certificate format
```

**Solution**: The system now handles this automatically with:
- Retry logic with exponential backoff
- Connection error detection
- Automatic reconnection attempts
- Fallback error reporting

#### 4. Virtual Environment Issues
```bash
# Recreate virtual environment
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Automated Remediation

When `AUTO_REMEDIATE_DEPENDENCIES=true`, the system will:

1. Detect missing Python packages
2. Automatically run `pip install -r requirements.txt`
3. Retry validation after installation
4. Log all remediation attempts

### Debug Commands

```bash
# Test Python dependencies manually
python3 -c "import pydantic_ai; print('OK')"

# Check installed packages
pip3 list | grep pydantic

# Validate system health
curl http://localhost:8001/api/health/system

# Force dependency validation
curl -X POST http://localhost:8001/api/health/validate
```

## Best Practices

### Development Workflow

1. **Always use the activation script**:
   ```bash
   source activate_env.sh
   npm run dev
   ```

2. **Check health before debugging**:
   ```bash
   curl http://localhost:8001/api/health/dependencies
   ```

3. **Monitor logs for degraded mode warnings**:
   ```
   grep "degraded mode" logs/server.log
   ```

### Production Deployment

1. **Enable dependency checking**:
   ```
   DEPENDENCY_CHECK_ENABLED=true
   FAIL_FAST_ON_DEPENDENCIES=true  # In production
   ```

2. **Set up monitoring**:
   - Monitor `/api/health/ready` for Kubernetes
   - Alert on status != "healthy"
   - Monitor dependency validation results

3. **Use virtual environments**:
   ```dockerfile
   # In Dockerfile
   RUN python3 -m venv /opt/venv
   ENV PATH="/opt/venv/bin:$PATH"
   RUN pip install -r requirements.txt
   ```

### Error Prevention

1. **Pin dependency versions** in requirements.txt
2. **Use virtual environments** to isolate Python dependencies
3. **Validate installations** in CI/CD pipelines
4. **Monitor dependency health** continuously
5. **Test degraded mode** scenarios

## Migration from Previous System

The old system had these problems:
- No dependency validation at startup
- Hard failures when Python dependencies missing
- Database errors during error handling causing cascade failures
- No graceful degradation
- Limited error visibility

The new system addresses all these issues with:
- ✅ Comprehensive startup validation
- ✅ Graceful degradation modes
- ✅ Enhanced database error handling
- ✅ Automated remediation capabilities
- ✅ Detailed health monitoring
- ✅ Fallback error reporting

## Future Enhancements

1. **Dependency caching** - Cache validation results for performance
2. **External monitoring integration** - Send health data to monitoring services
3. **Automatic dependency updates** - Smart dependency update system
4. **Advanced remediation** - More sophisticated auto-fix capabilities
5. **Predictive monitoring** - Predict dependency failures before they occur

---

This system ensures that the cascade failure scenario (PydanticAI → Database Certificate Error) cannot happen again, while providing comprehensive visibility into system health and automated recovery capabilities.