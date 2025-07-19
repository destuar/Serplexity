#!/usr/bin/env node

/**
 * Test script for the Perplexity company research agent
 * This script tests the real API call with environment variables loaded
 */

const { spawn } = require('child_process');
const path = require('path');
require('dotenv').config(); // Load environment variables

async function testPerplexityAgent() {
    console.log('🧪 Testing Perplexity Company Research Agent');
    console.log('======================================');
    
    // Check if PERPLEXITY_API_KEY is loaded
    if (!process.env.PERPLEXITY_API_KEY) {
        console.error('❌ PERPLEXITY_API_KEY not found in environment variables');
        process.exit(1);
    }
    
    console.log('✅ PERPLEXITY_API_KEY loaded successfully');
    console.log(`🔑 API Key: ${process.env.PERPLEXITY_API_KEY.substring(0, 8)}...`);
    
    // Test data - using Cedars-Sinai as in the logs
    const testInput = {
        company_name: "Cedars-Sinai",
        website_url: "https://www.cedars-sinai.org",
        industry: "Healthcare & Medical"
    };
    
    console.log('\n📊 Test Input:');
    console.log(JSON.stringify(testInput, null, 2));
    
    // Set up Python environment
    const pythonPackageDir = path.resolve(__dirname, 'src');
    const existingPythonPath = process.env.PYTHONPATH || '';
    const pythonPath = existingPythonPath ? `${pythonPackageDir}:${existingPythonPath}` : pythonPackageDir;
    
    console.log('\n🐍 Python Configuration:');
    console.log(`Working Directory: ${pythonPackageDir}`);
    console.log(`PYTHONPATH: ${pythonPath}`);
    
    return new Promise((resolve, reject) => {
        console.log('\n🚀 Spawning Python agent...');
        
        const pythonProcess = spawn('python3', ['-m', 'pydantic_agents.agents.company_research_agent'], {
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: pythonPackageDir,
            env: {
                ...process.env,
                PYTHONPATH: pythonPath,
                PYDANTIC_PROVIDER_ID: 'perplexity',
                PYDANTIC_MODEL_ID: 'sonar'
            }
        });
        
        // Send input data
        pythonProcess.stdin.write(JSON.stringify(testInput));
        pythonProcess.stdin.end();
        
        let stdout = '';
        let stderr = '';
        
        pythonProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        
        pythonProcess.stderr.on('data', (data) => {
            stderr += data.toString();
            console.log('📝 Agent log:', data.toString().trim());
        });
        
        pythonProcess.on('close', (code) => {
            console.log(`\n🏁 Process finished with code: ${code}`);
            
            if (code === 0) {
                console.log('\n✅ Agent execution successful!');
                console.log('\n📤 Raw Output:');
                console.log(stdout);
                
                try {
                    const result = JSON.parse(stdout);
                    console.log('\n🎯 Parsed Result:');
                    console.log(JSON.stringify(result, null, 2));
                    
                    if (result.result && result.result.target_questions) {
                        console.log('\n🎉 SUCCESS! Generated Questions:');
                        result.result.target_questions.forEach((q, i) => {
                            console.log(`${i + 1}. ${q}`);
                        });
                        resolve(result);
                    } else {
                        console.log('\n⚠️  Warning: Result structure unexpected');
                        resolve(result);
                    }
                } catch (parseError) {
                    console.log('\n❌ Failed to parse JSON output:');
                    console.log(parseError.message);
                    reject(parseError);
                }
            } else {
                console.log('\n❌ Agent execution failed');
                console.log('Error output:', stderr);
                reject(new Error(`Process exited with code ${code}`));
            }
        });
        
        pythonProcess.on('error', (error) => {
            console.log('\n💥 Process error:', error);
            reject(error);
        });
    });
}

// Run the test
testPerplexityAgent()
    .then(() => {
        console.log('\n🎊 Test completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.log('\n💥 Test failed:', error.message);
        process.exit(1);
    });