#!/usr/bin/env npx ts-node

/**
 * Test Script: Python Agent Authentication Debugging
 * 
 * This script reproduces the 401 authentication issue with PydanticAI agents
 * by testing the research agent directly and checking all environment variables.
 */

import path from 'path';
import env from '../src/config/env';
import { pydanticLlmService } from '../src/services/pydanticLlmService';

interface TestResult {
  success: boolean;
  error?: string;
  data?: any;
  metadata?: any;
}

async function checkEnvironmentVariables(): Promise<void> {
  console.log('\n🔍 === ENVIRONMENT VARIABLE CHECK ===');
  
  const apiKeys = {
    PERPLEXITY_API_KEY: env.PERPLEXITY_API_KEY || process.env.PERPLEXITY_API_KEY,
    OPENAI_API_KEY: env.OPENAI_API_KEY || process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY,
    GEMINI_API_KEY: env.GEMINI_API_KEY || process.env.GEMINI_API_KEY,
  };

  for (const [keyName, keyValue] of Object.entries(apiKeys)) {
    if (keyValue) {
      console.log(`✅ ${keyName}: ${keyValue.substring(0, 8)}...${keyValue.substring(keyValue.length - 4)} (${keyValue.length} chars)`);
    } else {
      console.log(`❌ ${keyName}: MISSING`);
    }
  }
}

async function testResearchAgentDirectly(): Promise<TestResult> {
  console.log('\n🧪 === TESTING RESEARCH AGENT DIRECTLY ===');
  
  const testInput = {
    company_name: "Test Company",
    website_url: "https://example.com",
    industry: "Technology"
  };

  try {
    console.log('📤 Input data:', JSON.stringify(testInput, null, 2));
    console.log('🚀 Executing research agent...');
    
    const result = await pydanticLlmService.executeAgent(
      'research_agent.py',
      testInput,
      null, // No schema validation needed
      {
        modelId: 'sonar', // Explicitly use sonar model that's failing
        timeout: 30000,
      }
    );

    console.log('✅ Research agent succeeded!');
    console.log('📊 Metadata:', JSON.stringify(result.metadata, null, 2));
    console.log('📋 Data preview:', JSON.stringify(result.data, null, 2));

    return {
      success: true,
      data: result.data,
      metadata: result.metadata
    };
  } catch (error) {
    console.log('❌ Research agent failed!');
    console.log('💥 Error:', error instanceof Error ? error.message : String(error));
    
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function testAgentHealth(): Promise<void> {
  console.log('\n🏥 === AGENT HEALTH CHECK ===');
  
  try {
    const stats = pydanticLlmService.getServiceStatistics();
    console.log('📊 Service Statistics:', JSON.stringify(stats, null, 2));
    
    const providers = pydanticLlmService.getAvailableProviders();
    console.log('🔌 Available Providers:', JSON.stringify(providers, null, 2));
  } catch (error) {
    console.log('❌ Health check failed:', error instanceof Error ? error.message : String(error));
  }
}

async function testWithDifferentModels(): Promise<void> {
  console.log('\n🔄 === TESTING WITH DIFFERENT MODELS ===');
  
  const testInput = {
    company_name: "Test Company",
    website_url: "https://example.com"
  };

  const modelsToTest = [
    { id: 'sonar', name: 'Perplexity Sonar (failing)' },
    { id: 'openai:gpt-4.1-mini', name: 'OpenAI GPT-4.1-mini' },
    { id: 'anthropic:claude-3-5-haiku-20241022', name: 'Claude Haiku' },
  ];

  for (const model of modelsToTest) {
    console.log(`\n🧪 Testing ${model.name} (${model.id})...`);
    
    try {
      const result = await pydanticLlmService.executeAgent(
        'research_agent.py',
        testInput,
        null,
        {
          modelId: model.id,
          timeout: 30000,
        }
      );
      console.log(`✅ ${model.name}: SUCCESS`);
      console.log(`   Model used: ${result.metadata.modelUsed}`);
      console.log(`   Execution time: ${result.metadata.executionTime}ms`);
    } catch (error) {
      console.log(`❌ ${model.name}: FAILED`);
      console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

async function checkPythonEnvironment(): Promise<void> {
  console.log('\n🐍 === PYTHON ENVIRONMENT CHECK ===');
  
  const { spawn } = await import('child_process');
  
  return new Promise((resolve) => {
    const pythonPath = process.env.PYTHON_PATH || 'python3';
    console.log(`🔍 Using Python path: ${pythonPath}`);
    
    const checkScript = `
import os
import sys
print(f"Python version: {sys.version}")
print(f"Python path: {sys.executable}")

# Check if PydanticAI is available
try:
    import pydantic_ai
    print(f"✅ PydanticAI version: {pydantic_ai.__version__}")
except ImportError as e:
    print(f"❌ PydanticAI not available: {e}")

# Check API keys
api_keys = ['PERPLEXITY_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY']
for key in api_keys:
    value = os.getenv(key)
    if value:
        print(f"✅ {key}: ***{value[-4:]} ({len(value)} chars)")
    else:
        print(f"❌ {key}: MISSING")
`;

    const pythonProcess = spawn(pythonPath, ['-c', checkScript], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        // Explicitly pass the same environment variables as pydanticLlmService
        PERPLEXITY_API_KEY: env.PERPLEXITY_API_KEY || process.env.PERPLEXITY_API_KEY,
        OPENAI_API_KEY: env.OPENAI_API_KEY || process.env.OPENAI_API_KEY,
        ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY,
        GEMINI_API_KEY: env.GEMINI_API_KEY || process.env.GEMINI_API_KEY,
      }
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      console.log('📤 Python environment check output:');
      if (stdout) {
        console.log(stdout);
      }
      if (stderr) {
        console.log('⚠️ Stderr:', stderr);
      }
      console.log(`🔚 Exit code: ${code}`);
      resolve();
    });

    pythonProcess.on('error', (error) => {
      console.log(`❌ Python process error: ${error.message}`);
      resolve();
    });
  });
}

async function main(): Promise<void> {
  console.log('🔬 === PYTHON AGENT AUTHENTICATION DEBUG TEST ===');
  console.log(`🕐 Started at: ${new Date().toISOString()}`);
  
  try {
    // Step 1: Check environment variables
    await checkEnvironmentVariables();
    
    // Step 2: Check Python environment
    await checkPythonEnvironment();
    
    // Step 3: Check agent health
    await testAgentHealth();
    
    // Step 4: Test research agent directly
    const directTest = await testResearchAgentDirectly();
    
    // Step 5: Test different models if research agent fails
    if (!directTest.success) {
      await testWithDifferentModels();
    }
    
    console.log('\n📋 === SUMMARY ===');
    if (directTest.success) {
      console.log('✅ Research agent working correctly');
      console.log('🔍 Issue may be specific to queue worker context');
    } else {
      console.log('❌ Research agent failing in direct test');
      console.log('🔍 Issue is likely with API key or configuration');
      
      // Provide specific recommendations
      if (!env.PERPLEXITY_API_KEY && !process.env.PERPLEXITY_API_KEY) {
        console.log('\n💡 RECOMMENDATION:');
        console.log('   Missing PERPLEXITY_API_KEY environment variable');
        console.log('   Add to backend/.env: PERPLEXITY_API_KEY=your_api_key_here');
      }
    }
    
  } catch (error) {
    console.error('💥 Test script failed:', error instanceof Error ? error.message : String(error));
  }
  
  console.log(`\n🏁 Test completed at: ${new Date().toISOString()}`);
}

if (require.main === module) {
  main().catch(console.error);
}

export { main as testPythonAgentAuth };