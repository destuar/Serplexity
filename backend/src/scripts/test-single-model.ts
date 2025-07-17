#!/usr/bin/env node

/**
 * Simple Single Model Test
 * 
 * Tests a single model through the fanout pipeline to debug issues
 * 
 * Usage: npm run test:single-model -- --model=gpt-4.1-mini
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { config } from 'dotenv';

// Load environment variables from .env file
config({ path: path.join(__dirname, '../../.env') });

const MODEL_ID = process.argv.find(arg => arg.startsWith('--model='))?.split('=')[1] || 'gpt-4.1-mini';

const ENGINES: Record<string, string> = {
  'gpt-4.1-mini': 'openai',
  'claude-3-5-haiku-20241022': 'anthropic',
  'gemini-2.5-flash': 'gemini',
  'sonar': 'perplexity'
};

async function runPythonAgent(scriptName: string, input: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, '..', 'pydantic_agents', 'agents', scriptName);
    
    console.log(`🐍 Running: python3 ${scriptPath}`);
    console.log(`📤 Input: ${JSON.stringify(input, null, 2)}`);
    
    const pythonProcess: ChildProcess = spawn('python3', [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PYTHONPATH: path.join(__dirname, '..'),
        PYDANTIC_PROVIDER_ID: input.provider || 'openai'
      }
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    pythonProcess.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code: number | null) => {
      console.log(`🐍 Process exited with code: ${code}`);
      if (stderr) console.log(`🐍 Stderr: ${stderr}`);
      
      if (code !== 0) {
        reject(new Error(`Python process exited with code ${code}: ${stderr}`));
      } else {
        try {
          const result = JSON.parse(stdout);
          console.log(`📥 Output: ${JSON.stringify(result, null, 2)}`);
          resolve(result);
        } catch (parseError) {
          console.log(`🐍 Raw stdout: ${stdout}`);
          reject(new Error(`Failed to parse JSON output: ${parseError}`));
        }
      }
    });

    pythonProcess.stdin?.write(JSON.stringify(input));
    pythonProcess.stdin?.end();
  });
}

async function testFanoutGeneration() {
  console.log(`\n🔄 Testing fanout generation with ${MODEL_ID}`);
  
  const input = {
    company_name: "Asana",
    industry: "Project Management Software",
    context: "Generate fanout questions for Asana in the Project Management Software industry",
    query_types: ["comparison", "best_for", "versus"],
    max_queries: 3,
    target_audiences: ["developers", "product managers"],
    provider: ENGINES[MODEL_ID as keyof typeof ENGINES]
  };

  try {
    const result = await runPythonAgent('fanout_agent.py', input);
    console.log('✅ Fanout generation successful');
    return result;
  } catch (error) {
    console.error('❌ Fanout generation failed:', error);
    throw error;
  }
}

async function testQuestionAnswering() {
  console.log(`\n💬 Testing question answering with ${MODEL_ID}`);
  
  const input = {
    question: "What are the key differences between Asana and Trello for project management?",
    company_name: "Asana",
    competitors: ["Trello", "Monday.com", "Basecamp"],
    context: "Answer this question about project management tools, ensuring to mention relevant companies with <brand> tags",
    enable_web_search: true,
    provider: ENGINES[MODEL_ID as keyof typeof ENGINES]
  };

  try {
    const result = await runPythonAgent('question_agent.py', input);
    console.log('✅ Question answering successful');
    
    if (result.result && result.result.answer) {
      const answer = result.result.answer;
      const brandMentions = (answer.match(/<brand>.*?<\/brand>/g) || []).length;
      const citations = result.result.citations || [];
      
      console.log(`📊 Brand mentions: ${brandMentions}`);
      console.log(`📚 Citations: ${citations.length}`);
      console.log(`💬 Answer: ${answer.substring(0, 300)}...`);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Question answering failed:', error);
    throw error;
  }
}

async function main() {
  console.log('🧪 Single Model Test');
  console.log(`🤖 Model: ${MODEL_ID}`);
  console.log(`⚙️  Engine: ${ENGINES[MODEL_ID as keyof typeof ENGINES]}`);
  console.log('='.repeat(50));

  try {
    await testFanoutGeneration();
    await testQuestionAnswering();
    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}