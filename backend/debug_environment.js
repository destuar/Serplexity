#!/usr/bin/env node

require('dotenv').config();

console.log('🔍 Environment Debug Information');
console.log('================================');
console.log();

console.log('📍 Process Information:');
console.log(`  PID: ${process.pid}`);
console.log(`  Working Directory: ${process.cwd()}`);
console.log(`  Node Path: ${process.execPath}`);
console.log(`  Platform: ${process.platform}`);
console.log();

console.log('📦 Module Paths:');
console.log(`  Main Module: ${require.main?.filename}`);
console.log(`  Module Paths: ${JSON.stringify(require.main?.paths?.slice(0, 3), null, 2)}`);
console.log();

console.log('🔧 Environment Variables:');
console.log(`  NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`  SECRETS_PROVIDER: ${process.env.SECRETS_PROVIDER}`);
console.log(`  DATABASE_SECRET_NAME: ${process.env.DATABASE_SECRET_NAME}`);
console.log(`  AWS_REGION: ${process.env.AWS_REGION}`);
console.log();

console.log('🗄️ Database Configuration:');
try {
    // Try to load database config
    const { getDbClient } = require('./src/config/database');
    console.log('  ✅ Database module loaded successfully');
    
    // Test database client creation
    getDbClient().then(() => {
        console.log('  ✅ Database client created successfully');
    }).catch(err => {
        console.log('  ❌ Database client creation failed:', err.message);
        console.log('  🔍 Error details:', err);
    });
} catch (err) {
    console.log('  ❌ Failed to load database module:', err.message);
}

console.log();
console.log('🔌 Redis Configuration:');
console.log(`  REDIS_HOST: ${process.env.REDIS_HOST}`);
console.log(`  REDIS_PORT: ${process.env.REDIS_PORT}`);
console.log(`  REDIS_PASSWORD: ${process.env.REDIS_PASSWORD ? '***' : 'NOT SET'}`);
console.log();

console.log('⚙️ BullMQ Configuration:');
console.log(`  BULLMQ_QUEUE_PREFIX: ${process.env.BULLMQ_QUEUE_PREFIX}`);

// Try to initialize worker
console.log();
console.log('👷 Worker Initialization Test:');
try {
    console.log('  Loading reportWorker module...');
    require('./src/queues/reportWorker');
    console.log('  ✅ Worker module loaded');
} catch (err) {
    console.log('  ❌ Worker module failed to load:', err.message);
    console.log('  🔍 Stack trace:', err.stack);
}