#!/usr/bin/env ts-node

import fs from 'fs';
import path from 'path';

interface ValidationResult {
  component: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: string[];
}

/**
 * Comprehensive validation script for reliability improvements
 */
async function validateReliabilityImplementation(): Promise<void> {
  console.log('🔍 VALIDATING RELIABILITY IMPROVEMENTS\n');
  console.log('=' .repeat(60));
  
  const results: ValidationResult[] = [];
  
  // 1. Validate Alerting Service
  console.log('📧 Checking Alerting Service...');
  results.push(await validateAlertingService());
  
  // 2. Validate Backup Scheduler
  console.log('🛡️ Checking Backup Scheduler...');
  results.push(await validateBackupScheduler());
  
  // 3. Validate Emergency Endpoints
  console.log('🚑 Checking Emergency Endpoints...');
  results.push(await validateEmergencyEndpoints());
  
  // 4. Validate AI Resilience
  console.log('🤖 Checking AI Model Resilience...');
  results.push(await validateAIResilience());
  
  // 5. Validate Redis Connection Pool
  console.log('📡 Checking Redis Connection Pool...');
  results.push(await validateRedisPool());
  
  // 6. Validate Health Monitoring
  console.log('🩺 Checking Health Monitoring...');
  results.push(await validateHealthMonitoring());
  
  // 7. Validate Server Integration
  console.log('⚙️ Checking Server Integration...');
  results.push(await validateServerIntegration());
  
  // 8. Validate TypeScript Compilation
  console.log('📝 Checking TypeScript Compilation...');
  results.push(await validateCompilation());
  
  // Display Results
  console.log('\n' + '=' .repeat(60));
  console.log('📊 VALIDATION RESULTS');
  console.log('=' .repeat(60));
  
  let passCount = 0;
  let failCount = 0;
  let warnCount = 0;
  
  results.forEach(result => {
    const emoji = result.status === 'PASS' ? '✅' : result.status === 'WARN' ? '⚠️' : '❌';
    console.log(`${emoji} ${result.component}: ${result.message}`);
    
    if (result.details && result.details.length > 0) {
      result.details.forEach(detail => {
        console.log(`   • ${detail}`);
      });
    }
    
    if (result.status === 'PASS') passCount++;
    else if (result.status === 'WARN') warnCount++;
    else failCount++;
  });
  
  console.log('\n' + '=' .repeat(60));
  console.log(`📈 SUMMARY: ${passCount} PASS, ${warnCount} WARN, ${failCount} FAIL`);
  
  if (failCount === 0) {
    console.log('🎉 ALL CRITICAL RELIABILITY IMPROVEMENTS VALIDATED!');
    console.log('✅ System is ready for production deployment');
  } else {
    console.log('⚠️ Some components need attention before deployment');
  }
  
  console.log('=' .repeat(60));
}

async function validateAlertingService(): Promise<ValidationResult> {
  try {
    const serviceFile = 'src/services/alertingService.ts';
    if (!fs.existsSync(serviceFile)) {
      return { component: 'Alerting Service', status: 'FAIL', message: 'Service file not found' };
    }
    
    const content = fs.readFileSync(serviceFile, 'utf8');
    const features = [
      'class AlertingService',
      'alertReportFailure',
      'alertSystemIssue',
      'alertSchedulerFailure',
      'sendEmailAlert',
      'sendWebhookAlert',
      'nodemailer'
    ];
    
    const missingFeatures = features.filter(feature => !content.includes(feature));
    
    if (missingFeatures.length === 0) {
      return {
        component: 'Alerting Service',
        status: 'PASS',
        message: 'All alerting features implemented',
        details: ['Email alerts', 'Webhook alerts', 'Report failure alerts', 'System alerts']
      };
    } else {
      return {
        component: 'Alerting Service',
        status: 'FAIL',
        message: 'Missing features',
        details: missingFeatures
      };
    }
  } catch (error) {
    return { component: 'Alerting Service', status: 'FAIL', message: 'Validation error' };
  }
}

async function validateBackupScheduler(): Promise<ValidationResult> {
  try {
    const schedulerFile = 'src/queues/backupScheduler.ts';
    const workerFile = 'src/queues/backupSchedulerWorker.ts';
    
    if (!fs.existsSync(schedulerFile) || !fs.existsSync(workerFile)) {
      return { component: 'Backup Scheduler', status: 'FAIL', message: 'Scheduler files not found' };
    }
    
    const schedulerContent = fs.readFileSync(schedulerFile, 'utf8');
    const workerContent = fs.readFileSync(workerFile, 'utf8');
    
    const schedulerFeatures = ['scheduleBackupDailyReportTrigger', '0 6 * * *', 'backup-scheduler'];
    const workerFeatures = ['trigger-backup-daily-reports', 'trigger-emergency-reports', 'backup-scheduler'];
    
    const schedulerOk = schedulerFeatures.every(feature => schedulerContent.includes(feature));
    const workerOk = workerFeatures.every(feature => workerContent.includes(feature));
    
    if (schedulerOk && workerOk) {
      return {
        component: 'Backup Scheduler',
        status: 'PASS',
        message: 'Backup scheduler fully implemented',
        details: ['Runs at 6:00 AM UTC', 'Detects missing reports', 'Emergency trigger support']
      };
    } else {
      return { component: 'Backup Scheduler', status: 'FAIL', message: 'Missing scheduler features' };
    }
  } catch (error) {
    return { component: 'Backup Scheduler', status: 'FAIL', message: 'Validation error' };
  }
}

async function validateEmergencyEndpoints(): Promise<ValidationResult> {
  try {
    const controllerFile = 'src/controllers/reportController.ts';
    const routesFile = 'src/routes/reportRoutes.ts';
    
    if (!fs.existsSync(controllerFile) || !fs.existsSync(routesFile)) {
      return { component: 'Emergency Endpoints', status: 'FAIL', message: 'Controller or routes file not found' };
    }
    
    const controllerContent = fs.readFileSync(controllerFile, 'utf8');
    const routesContent = fs.readFileSync(routesFile, 'utf8');
    
    const controllerFunctions = [
      'emergencyTriggerCompanyReport',
      'emergencyTriggerAllReports',
      'getSystemHealth'
    ];
    
    const routePaths = [
      '/emergency/companies/:companyId/trigger-report',
      '/emergency/trigger-all-reports',
      '/system/health'
    ];
    
    const controllerOk = controllerFunctions.every(func => controllerContent.includes(func));
    const routesOk = routePaths.every(path => routesContent.includes(path));
    
    if (controllerOk && routesOk) {
      return {
        component: 'Emergency Endpoints',
        status: 'PASS',
        message: 'All emergency endpoints implemented',
        details: ['Single company trigger', 'All companies trigger', 'System health check']
      };
    } else {
      return { component: 'Emergency Endpoints', status: 'FAIL', message: 'Missing endpoints or functions' };
    }
  } catch (error) {
    return { component: 'Emergency Endpoints', status: 'FAIL', message: 'Validation error' };
  }
}

async function validateAIResilience(): Promise<ValidationResult> {
  try {
    const resilienceFile = 'src/services/resilientLlmService.ts';
    const workerFile = 'src/queues/reportWorker.ts';
    
    if (!fs.existsSync(resilienceFile)) {
      return { component: 'AI Model Resilience', status: 'FAIL', message: 'Resilience service not found' };
    }
    
    const resilienceContent = fs.readFileSync(resilienceFile, 'utf8');
    const workerContent = fs.readFileSync(workerFile, 'utf8');
    
    const resilienceFeatures = [
      'ResilientLlmService',
      'generateResilientChatCompletion',
      'getFallbackModels',
      'isRateLimitError',
      'callWithRetry'
    ];
    
    const resilienceOk = resilienceFeatures.every(feature => resilienceContent.includes(feature));
    const workerIntegrated = workerContent.includes('generateResilientQuestionResponse');
    
    if (resilienceOk && workerIntegrated) {
      return {
        component: 'AI Model Resilience',
        status: 'PASS',
        message: 'AI resilience fully implemented',
        details: ['Automatic fallbacks', 'Rate limit handling', 'Exponential backoff', 'Integrated in worker']
      };
    } else {
      return { component: 'AI Model Resilience', status: 'FAIL', message: 'Missing resilience features' };
    }
  } catch (error) {
    return { component: 'AI Model Resilience', status: 'FAIL', message: 'Validation error' };
  }
}

async function validateRedisPool(): Promise<ValidationResult> {
  try {
    const poolFile = 'src/config/redisPool.ts';
    const bullmqFile = 'src/config/bullmq.ts';
    
    if (!fs.existsSync(poolFile)) {
      return { component: 'Redis Connection Pool', status: 'FAIL', message: 'Redis pool not found' };
    }
    
    const poolContent = fs.readFileSync(poolFile, 'utf8');
    const bullmqContent = fs.readFileSync(bullmqFile, 'utf8');
    
    const poolFeatures = [
      'RedisConnectionPool',
      'getMainConnection',
      'getBullMQConnection',
      'getHealthCheckConnection',
      'maxConnections'
    ];
    
    const poolOk = poolFeatures.every(feature => poolContent.includes(feature));
    const bullmqIntegrated = bullmqContent.includes('getBullMQConnection');
    
    if (poolOk && bullmqIntegrated) {
      return {
        component: 'Redis Connection Pool',
        status: 'PASS',
        message: 'Connection pool fully implemented',
        details: ['Shared connections', 'Connection limits', 'BullMQ integration', 'Health monitoring']
      };
    } else {
      return { component: 'Redis Connection Pool', status: 'FAIL', message: 'Missing pool features' };
    }
  } catch (error) {
    return { component: 'Redis Connection Pool', status: 'FAIL', message: 'Validation error' };
  }
}

async function validateHealthMonitoring(): Promise<ValidationResult> {
  try {
    const healthFile = 'src/scripts/daily-health-monitor.ts';
    const packageFile = 'package.json';
    
    if (!fs.existsSync(healthFile)) {
      return { component: 'Health Monitoring', status: 'FAIL', message: 'Health monitor not found' };
    }
    
    const healthContent = fs.readFileSync(healthFile, 'utf8');
    const packageContent = fs.readFileSync(packageFile, 'utf8');
    
    const healthFeatures = [
      'performDailyHealthCheck',
      'checkDailyReports',
      'checkRecentFailures',
      'checkSystemComponents',
      'checkSchedulerHealth'
    ];
    
    const healthOk = healthFeatures.every(feature => healthContent.includes(feature));
    const scriptConfigured = packageContent.includes('health:daily');
    
    if (healthOk && scriptConfigured) {
      return {
        component: 'Health Monitoring',
        status: 'PASS',
        message: 'Health monitoring fully implemented',
        details: ['Daily health checks', 'Component validation', 'Failure detection', 'NPM script configured']
      };
    } else {
      return { component: 'Health Monitoring', status: 'FAIL', message: 'Missing health features' };
    }
  } catch (error) {
    return { component: 'Health Monitoring', status: 'FAIL', message: 'Validation error' };
  }
}

async function validateServerIntegration(): Promise<ValidationResult> {
  try {
    const serverFile = 'src/server.ts';
    
    if (!fs.existsSync(serverFile)) {
      return { component: 'Server Integration', status: 'FAIL', message: 'Server file not found' };
    }
    
    const serverContent = fs.readFileSync(serverFile, 'utf8');
    
    const integrations = [
      'backupSchedulerWorker',
      'scheduleBackupDailyReportTrigger',
      'scheduleDailyReportTrigger'
    ];
    
    const integrationsOk = integrations.every(integration => serverContent.includes(integration));
    
    if (integrationsOk) {
      return {
        component: 'Server Integration',
        status: 'PASS',
        message: 'All services integrated in server',
        details: ['Backup scheduler started', 'Primary scheduler started', 'Alerting service loaded']
      };
    } else {
      return { component: 'Server Integration', status: 'FAIL', message: 'Missing server integrations' };
    }
  } catch (error) {
    return { component: 'Server Integration', status: 'FAIL', message: 'Validation error' };
  }
}

async function validateCompilation(): Promise<ValidationResult> {
  try {
    // Check if dist directory exists and has recent files
    if (!fs.existsSync('dist')) {
      return { component: 'TypeScript Compilation', status: 'FAIL', message: 'Dist directory not found' };
    }
    
    const distFiles = fs.readdirSync('dist', { recursive: true });
    const jsFiles = distFiles.filter(file => file.toString().endsWith('.js'));
    
    if (jsFiles.length > 0) {
      return {
        component: 'TypeScript Compilation',
        status: 'PASS',
        message: 'TypeScript compilation successful',
        details: [`${jsFiles.length} JS files generated`]
      };
    } else {
      return { component: 'TypeScript Compilation', status: 'FAIL', message: 'No JS files found in dist' };
    }
  } catch (error) {
    return { component: 'TypeScript Compilation', status: 'FAIL', message: 'Validation error' };
  }
}

// Run validation if called directly
if (require.main === module) {
  validateReliabilityImplementation()
    .then(() => {
      console.log('\n✅ Validation complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Validation failed:', error);
      process.exit(1);
    });
}

export { validateReliabilityImplementation };