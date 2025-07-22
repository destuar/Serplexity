#!/usr/bin/env node

/**
 * Test script for search agent functionality
 */

const { spawn } = require('child_process');
const path = require('path');

async function testSearchAgent() {
  console.log('🔍 Testing Search Agent...');
  
  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
    console.log('⚠️  OPENAI_API_KEY not set, using placeholder for testing');
    process.env.OPENAI_API_KEY = 'placeholder-key-for-testing';
  }
  
  const testInput = {
    query: "What is the latest news about OpenAI?",
    model_id: "gpt-4o",
    enable_web_search: true
  };

  console.log('📥 Input:', JSON.stringify(testInput, null, 2));

  const pythonPath = process.env.PYTHON_PATH || 'python3';
  const scriptsPath = path.resolve(__dirname, 'src');
  const moduleName = 'pydantic_agents.agents.search_agent';

  const pythonProcess = spawn(pythonPath, ['-m', moduleName], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: scriptsPath,
    env: {
      ...process.env,
      PYTHONPATH: scriptsPath,
      PYDANTIC_PROVIDER_ID: 'openai',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY
    }
  });

  // Send input
  pythonProcess.stdin.write(JSON.stringify(testInput));
  pythonProcess.stdin.end();

  let stdout = '';
  let stderr = '';

  pythonProcess.stdout.on('data', (data) => {
    stdout += data.toString();
  });

  pythonProcess.stderr.on('data', (data) => {
    stderr += data.toString();
  });

  pythonProcess.on('close', (code) => {
    console.log('\n📤 Raw stdout:', stdout);
    if (stderr) {
      console.log('\n⚠️  Stderr:', stderr);
    }
    console.log('\n🔚 Process exited with code:', code);
    
    if (code === 0) {
      try {
        const result = JSON.parse(stdout);
        console.log('\n✅ Parsed result:');
        console.log(JSON.stringify(result, null, 2));
      } catch (e) {
        console.log('\n❌ Failed to parse JSON output');
      }
    }
  });

  pythonProcess.on('error', (error) => {
    console.error('❌ Process error:', error.message);
  });
}

if (require.main === module) {
  testSearchAgent().catch(console.error);
}