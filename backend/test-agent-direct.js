#!/usr/bin/env node

// Get the real OpenAI API key from the environment
const env = require('./dist/config/env');

const testInput = {
  question: "Which hospitals offer weight loss programs?",
  company_name: "TestCorp",
  enable_web_search: false,
  provider: "openai"
};

console.log('Testing answer agent with real API key...');
console.log('Input:', JSON.stringify(testInput, null, 2));

const { spawn } = require('child_process');
const path = require('path');

const pythonPath = 'python3';
const scriptDir = path.resolve(__dirname, 'src');
const moduleName = 'pydantic_agents.agents.answer_agent';

const pythonProcess = spawn(pythonPath, ['-m', moduleName], {
  cwd: scriptDir,
  env: {
    ...process.env,
    PYTHONPATH: scriptDir,
    OPENAI_API_KEY: env.default.OPENAI_API_KEY,
    PYDANTIC_PROVIDER_ID: 'openai',
    PYDANTIC_MODEL_ID: 'openai:gpt-4o-mini'
  },
  stdio: ['pipe', 'pipe', 'pipe']
});

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
  console.log('\n--- STDOUT ---');
  console.log(stdout);
  
  if (stderr) {
    console.log('\n--- STDERR ---');
    console.log(stderr);
  }
  
  console.log(`\nProcess exited with code: ${code}`);
  
  if (code === 0) {
    try {
      const result = JSON.parse(stdout);
      console.log('\n--- PARSED RESULT ---');
      console.log(JSON.stringify(result, null, 2));
      
      if (result.question && result.answer) {
        console.log('\n✅ SUCCESS: Got valid answer!');
        
        // Check for brand tags
        const brandTags = (result.answer.match(/<brand>.*?<\/brand>/g) || []);
        console.log(`🏷️  Brand tags found: ${brandTags.length}`);
        if (brandTags.length > 0) {
          console.log(`🏷️  Tagged brands: ${brandTags.join(', ')}`);
        }
      } else {
        console.log('❌ ISSUE: Missing question or answer in result');
      }
    } catch (e) {
      console.log('❌ ISSUE: Could not parse JSON result');
    }
  } else {
    console.log('❌ ISSUE: Process failed');
  }
});