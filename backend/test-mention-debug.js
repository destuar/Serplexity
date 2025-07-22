#!/usr/bin/env node

// Set up environment for AWS secrets
process.env.NODE_ENV = 'development';
process.env.SECRETS_PROVIDER = 'aws';
process.env.DATABASE_SECRET_NAME = 'serplexity-db';
process.env.AWS_ACCESS_KEY_ID = 'AKIAVFIWIQECD5NKMCUX';
process.env.AWS_SECRET_ACCESS_KEY = '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';
process.env.AWS_REGION = 'us-east-2';

// Also set OpenAI key for testing
process.env.OPENAI_API_KEY = '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';

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 Direct Python Test of Mention Agent');
console.log('=' .repeat(60));

const testInput = {
  text: `Mayo Clinic offers specialized care. Johns Hopkins Hospital provides excellent service. Apple makes the iPhone.`,
  company_name: "Mayo Clinic",
  competitors: ["Johns Hopkins Hospital"]
};

function runPythonScript() {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'src/pydantic_agents/agents/mention_agent.py');
    
    console.log('🐍 Running Python script:', scriptPath);
    console.log('📥 Input:', JSON.stringify(testInput, null, 2));
    
    const childProcess = spawn('python3', [scriptPath], {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PYTHONPATH: path.join(__dirname, 'src'),
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        GEMINI_API_KEY: process.env.GEMINI_API_KEY,
        PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY
      }
    });

    let stdout = '';
    let stderr = '';

    childProcess.stdin.write(JSON.stringify(testInput));
    childProcess.stdin.end();

    childProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    childProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    childProcess.on('close', (code) => {
      console.log('\n📤 Process finished with code:', code);
      console.log('📊 STDOUT:');
      console.log(stdout);
      console.log('\n📊 STDERR:');
      console.log(stderr);
      
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (error) {
          reject(new Error(`Failed to parse JSON: ${error.message}`));
        }
      } else {
        reject(new Error(`Process exited with code ${code}`));
      }
    });

    childProcess.on('error', (error) => {
      reject(new Error(`Failed to start process: ${error.message}`));
    });
  });
}

(async () => {
  try {
    const result = await runPythonScript();
    console.log('\n✅ Success! Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('\n❌ Failed:', error.message);
  }
})();