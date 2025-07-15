#!/usr/bin/env ts-node

import { checkRedisHealth, redisManager } from '../config/redis';

async function checkHealth() {
  try {
    console.log('🔍 Checking Redis Health Status...\n');
    
    const health = await checkRedisHealth();
    console.log('📊 Redis Health Status:');
    console.log(JSON.stringify(health, null, 2));
    
    // Try to get a connection and check its status
    try {
      const connection = redisManager.getConnection();
      console.log('\n🔌 Connection Status:');
      console.log(`   Status: ${connection.status}`);
      console.log(`   Ready: ${connection.status === 'ready'}`);
      
      // Try to ping
      const pingResult = await connection.ping();
      console.log(`   Ping: ${pingResult}`);
      
    } catch (connError) {
      console.error('\n❌ Connection Error:', connError);
    }
    
  } catch (error) {
    console.error('❌ Health check failed:', error);
  }
}

checkHealth(); 