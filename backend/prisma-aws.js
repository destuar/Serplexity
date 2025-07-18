#!/usr/bin/env node

/**
 * Universal Prisma wrapper that injects AWS Secrets Manager DATABASE_URL
 * Usage: node prisma-aws.js <prisma-command> [args...]
 * Examples:
 *   node prisma-aws.js studio
 *   node prisma-aws.js db push
 *   node prisma-aws.js generate
 *   node prisma-aws.js migrate dev
 */

const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const { spawn } = require("child_process");

async function runPrismaWithAWS() {
  try {
    // Load environment variables
    require('dotenv').config();

    const client = new SecretsManagerClient({
      region: "us-east-2",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });

    const command = new GetSecretValueCommand({
      SecretId: "serplexity-db"
    });

    console.log("🔍 Fetching database credentials from AWS Secrets Manager...");
    const response = await client.send(command);
    const secret = JSON.parse(response.SecretString);
    
    const databaseUrl = `postgresql://${encodeURIComponent(secret.username)}:${encodeURIComponent(secret.password)}@${secret.host}:${secret.port}/${secret.dbname}?sslmode=require`;
    
    // Get Prisma command from arguments
    const prismaArgs = process.argv.slice(2);
    if (prismaArgs.length === 0) {
      console.error("❌ Usage: node prisma-aws.js <prisma-command> [args...]");
      process.exit(1);
    }
    
    console.log(`🚀 Running: npx prisma ${prismaArgs.join(' ')}`);
    console.log(`   Host: ${secret.host}`);
    console.log(`   Database: ${secret.dbname}`);
    
    // Run Prisma command with DATABASE_URL
    const prismaProcess = spawn('npx', ['prisma', ...prismaArgs], {
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl
      }
    });

    prismaProcess.on('close', (code) => {
      console.log(`\n✅ Prisma command exited with code ${code}`);
      process.exit(code);
    });

    prismaProcess.on('error', (error) => {
      console.error('❌ Failed to run Prisma command:', error);
      process.exit(1);
    });

  } catch (error) {
    console.error("❌ Error running Prisma command:", error);
    process.exit(1);
  }
}

runPrismaWithAWS();