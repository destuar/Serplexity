#!/usr/bin/env node

// Test the mention agent tagging directly
const testText = "Many hospitals offer weight loss programs, including well-known ones such as the Mayo Clinic, Cleveland Clinic, Johns Hopkins Hospital, and Massachusetts General Hospital.";

const testInput = {
  text: testText,
  company_name: "TestCorp",
  competitors: []
};

console.log('Testing mention agent tagging...');
console.log('Input text:', testText);

const { spawn } = require('child_process');
const path = require('path');
const env = require('./dist/config/env');

const pythonPath = 'python3';
const scriptDir = path.resolve(__dirname, 'src');
const moduleName = 'pydantic_agents.agents.mention_agent';

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
  console.log('\n--- MENTION AGENT RESULT ---');
  
  if (code === 0) {
    try {
      const result = JSON.parse(stdout);
      console.log(`✅ Detected ${result.result.total_count} mentions:`);
      
      result.result.mentions.forEach((mention, i) => {
        console.log(`  ${i+1}. ${mention.name} (${mention.type}) - confidence: ${mention.confidence}`);
      });
      
      console.log('\n🧪 Now testing tagging functionality...');
      
      // Test the tag_brands_in_text functionality with the actual mentions
      const tagTestInput = {
        text: testText,
        mentions: result.result.mentions,
        action: 'tag_only'  // We'll add this to test just the tagging
      };
      
      // We'll need to create a simple script to test just the tagging part
      console.log('✅ Mention detection working! Brands detected:', 
                  result.result.mentions.map(m => m.name).join(', '));
      
    } catch (e) {
      console.log('❌ Could not parse result:', e.message);
      console.log('Raw stdout:', stdout);
    }
  } else {
    console.log('❌ Process failed');
  }
  
  if (stderr) {
    console.log('\n--- STDERR ---');
    console.log(stderr);
  }
});