#!/usr/bin/env node

/**
 * Multiple Model Test
 * 
 * Tests multiple models through the fanout pipeline to ensure they all work properly
 * 
 * Usage: npm run test:multiple-models
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { config } from 'dotenv';

// Load environment variables from .env file
config({ path: path.join(__dirname, '../../.env') });

const MODELS_TO_TEST = [
  { id: 'gpt-4.1-mini', engine: 'openai' },
  { id: 'claude-3-5-haiku-20241022', engine: 'anthropic' },
  { id: 'gemini-2.5-flash', engine: 'gemini' },
  { id: 'sonar', engine: 'perplexity' }
];

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

    // Write input to stdin
    pythonProcess.stdin?.write(JSON.stringify(input));
    pythonProcess.stdin?.end();

    pythonProcess.on('close', (code: number) => {
      console.log(`🐍 Process exited with code: ${code}`);
      if (stderr.trim()) {
        console.log(`🐍 Stderr: ${stderr}`);
      }
      
      if (code !== 0) {
        reject(new Error(`Python process exited with code ${code}: ${stderr}`));
        return;
      }
      
      try {
        const result = JSON.parse(stdout);
        console.log(`📥 Output: ${JSON.stringify(result, null, 2)}`);
        resolve(result);
      } catch (e) {
        reject(new Error(`Failed to parse JSON output: ${e}\nStdout: ${stdout}`));
      }
    });

    pythonProcess.on('error', (error: Error) => {
      reject(error);
    });
  });
}

async function testModel(model: { id: string; engine: string }) {
  console.log(`\n🔄 Testing model: ${model.id} (${model.engine})`);
  console.log('='.repeat(60));
  
  const fanoutInput = {
    company_name: "Asana",
    industry: "Project Management Software",
    context: "Generate fanout questions for Asana in the Project Management Software industry",
    query_types: ["comparison", "best_for", "versus"],
    max_queries: 2, // Reduced for faster testing
    target_audiences: ["developers", "product managers"],
    provider: model.engine
  };

  const questionInput = {
    question: "What are the key differences between Asana and Trello for project management?",
    company_name: "Asana",
    competitors: ["Trello", "Monday.com", "Basecamp"],
    context: "Answer this question about project management tools, ensuring to mention relevant companies with <brand> tags",
    enable_web_search: true,
    provider: model.engine
  };

  try {
    // Test fanout generation
    console.log(`\n🔄 Testing fanout generation with ${model.id}`);
    const fanoutResult = await runPythonAgent('fanout_agent.py', fanoutInput);
    
    if (fanoutResult.error) {
      console.log(`❌ Fanout generation failed: ${fanoutResult.error}`);
      return { model: model.id, fanout: false, question: false, error: fanoutResult.error };
    }
    
    console.log(`✅ Fanout generation successful`);
    
    // Test question answering
    console.log(`\n💬 Testing question answering with ${model.id}`);
    const questionResult = await runPythonAgent('question_agent.py', questionInput);
    
    if (questionResult.error) {
      console.log(`❌ Question answering failed: ${questionResult.error}`);
      return { model: model.id, fanout: true, question: false, error: questionResult.error };
    }
    
    console.log(`✅ Question answering successful`);
    
    // Extract metrics
    const result = questionResult.result;
    const brandMentions = result?.brand_mentions_count || 0;
    const citations = result?.citations?.length || 0;
    const answerLength = result?.answer?.length || 0;
    
    console.log(`📊 Brand mentions: ${brandMentions}`);
    console.log(`📚 Citations: ${citations}`);
    console.log(`💬 Answer length: ${answerLength} characters`);
    
    return { 
      model: model.id, 
      fanout: true, 
      question: true, 
      brandMentions, 
      citations, 
      answerLength,
      webSearch: result?.has_web_search || false
    };
    
  } catch (error) {
    console.log(`❌ Test failed: ${error}`);
    return { model: model.id, fanout: false, question: false, error: String(error) };
  }
}

async function main() {
  console.log('🧪 Multiple Model Test');
  console.log('Testing fanout pipeline with multiple models');
  console.log('='.repeat(60));
  
  const results = [];
  
  for (const model of MODELS_TO_TEST) {
    const result = await testModel(model);
    results.push(result);
    
    // Add a small delay between tests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Print summary
  console.log('\n📊 Test Summary');
  console.log('='.repeat(60));
  
  console.log('| Model | Fanout | Question | Brand Mentions | Citations | Web Search |');
  console.log('|-------|--------|----------|---------------|-----------|------------|');
  
  for (const result of results) {
    const fanout = result.fanout ? '✅' : '❌';
    const question = result.question ? '✅' : '❌';
    const brandMentions = result.brandMentions || 0;
    const citations = result.citations || 0;
    const webSearch = result.webSearch ? '✅' : '❌';
    
    console.log(`| ${result.model} | ${fanout} | ${question} | ${brandMentions} | ${citations} | ${webSearch} |`);
  }
  
  const allPassed = results.every(r => r.fanout && r.question);
  console.log(`\n${allPassed ? '✅' : '❌'} Overall: ${allPassed ? 'All tests passed!' : 'Some tests failed'}`);
  
  process.exit(allPassed ? 0 : 1);
}

main().catch((error) => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});