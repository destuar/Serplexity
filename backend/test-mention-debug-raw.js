#!/usr/bin/env node

// Raw debug test to see exactly what the Python mention agent outputs
process.env.NODE_ENV = 'development';
process.env.OPENAI_API_KEY = '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';

const { spawn } = require('child_process');
const path = require('path');

const testInput = {
  text: "Mayo Clinic offers specialized care. Apple makes the iPhone.",
  company_name: "Mayo Clinic"
};

console.log('🐍 RAW PYTHON OUTPUT DEBUG');
console.log('=' .repeat(50));

const pythonPackageDir = path.resolve(__dirname, "src");
const scriptPath = path.join(pythonPackageDir, "pydantic_agents/agents/mention_agent.py");

console.log(`📁 Python package dir: ${pythonPackageDir}`);
console.log(`📄 Script path: ${scriptPath}`);

const pythonProcess = spawn("python3", ["-m", "pydantic_agents.agents.mention_agent"], {
  stdio: ["pipe", "pipe", "pipe"],
  cwd: pythonPackageDir,
  env: {
    ...process.env,
    PYTHONPATH: pythonPackageDir,
    PYDANTIC_PROVIDER_ID: "openai",
    PYDANTIC_MODEL_ID: "openai:gpt-4.1-mini"
  },
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
  console.log(`\n🏁 Process exited with code: ${code}`);
  console.log('\n📊 RAW STDOUT:');
  console.log('```');
  console.log(stdout);
  console.log('```');
  
  console.log('\n📊 RAW STDERR:');
  console.log('```');
  console.log(stderr);
  console.log('```');
  
  if (stdout) {
    try {
      console.log('\n🔍 JSON PARSE ATTEMPT:');
      const result = JSON.parse(stdout);
      console.log('✅ Parsed successfully:');
      console.log(JSON.stringify(result, null, 2));
      
      console.log('\n📋 DATA STRUCTURE ANALYSIS:');
      console.log(`- Has 'result' property: ${!!result.result}`);
      console.log(`- Has 'data' property: ${!!result.data}`);
      console.log(`- Top-level keys: ${Object.keys(result).join(', ')}`);
      
      if (result.result) {
        console.log(`- result.result keys: ${Object.keys(result.result).join(', ')}`);
        console.log(`- result.result.mentions length: ${result.result.mentions?.length || 0}`);
      }
      
      if (result.data) {
        console.log(`- result.data keys: ${Object.keys(result.data).join(', ')}`);
        console.log(`- result.data.mentions length: ${result.data.mentions?.length || 0}`);
      }
      
    } catch (e) {
      console.log(`❌ JSON parse failed: ${e.message}`);
    }
  }
});

pythonProcess.on('error', (error) => {
  console.error('❌ Process error:', error.message);
});