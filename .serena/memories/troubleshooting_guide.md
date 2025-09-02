# Troubleshooting Guide

## Common Issues & Solutions

### Port Conflicts
- **Backend**: Uses port 8001
- **Frontend**: Uses port 3000
- **Check**: `lsof -i :8001` or `lsof -i :3000`

### Database Issues
- **Schema changes**: Live/shared DBs → apply SQL patch via secrets wrapper; Local-only → `migrate:dev`
- **Always run** `npm run generate` after schema edits
- **Prisma client errors**: Run `npm run generate` after schema updates
- **AWS Secrets**: Ensure `DATABASE_SECRET_NAME` and AWS credentials are set

### Python Environment Issues
- **Solution**: Use `./start.sh` to ensure PydanticAI dependencies available
- **Virtual env location**: `backend/venv/`
- **Requirements**: `backend/requirements.txt`
- **Agent failures**: Run `npm run ops:health` to check status

### Queue & Redis Issues
- **Check Redis connection**: Verify `REDIS_HOST` and `REDIS_PORT` 
- **Queue prefix**: Check `BULLMQ_QUEUE_PREFIX` environment variable
- **Monitor queues**: `npm run ops:monitor`

### Build Failures
- **TypeScript errors**: Run `npm run typecheck` to catch type errors
- **Python errors**: Run `npm run python:check` for mypy/ruff/bandit issues
- **Missing dependencies**: Check if new libraries are in package.json

### Debug Commands
```bash
# Check service health
curl http://localhost:8001/api/health

# Monitor queue status  
cd backend && npm run ops:monitor

# Check Docker logs
docker-compose logs backend

# Check PydanticAI agent health
cd backend && npm run ops:health
```

## Error Investigation Process
1. **DO NOT JUMP TO CONCLUSIONS** - consider multiple possible causes
2. **Make minimal necessary changes** when fixing issues
3. **Use structured logging** with appropriate log levels
4. **Check recent git changes** for potential causes
5. **Verify environment variables** are properly set

## AWS Secrets Manager Integration
- **Database credentials**: Stored securely in AWS, not .env
- **Prisma operations**: Use `npm run prisma:dev` for secret management
- **Script wrapper**: `scripts/run-with-secrets.ts` fetches credentials
- **Fallback**: Falls back to `DATABASE_URL` if not using AWS secrets

## Security Troubleshooting
- **JWT tokens**: Check if access/refresh tokens are valid
- **Company isolation**: Verify `companyId` is properly enforced
- **Rate limiting**: Check if requests are being rate limited
- **CORS**: Verify `CORS_ORIGIN` matches frontend URL