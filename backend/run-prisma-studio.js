#!/usr/bin/env node

/**
 * Script to run Prisma Studio with AWS Secrets Manager database URL
 * This avoids having to put DATABASE_URL in your .env file
 */

const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const { spawn } = require("child_process");

async function runPrismaStudio() {
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
    
    console.log("🚀 Starting Prisma Studio with AWS Secrets Manager credentials...");
    console.log(`   Host: ${secret.host}`);
    console.log(`   Database: ${secret.dbname}`);
    console.log(`   User: ${secret.username}`);
    
    // Set the DATABASE_URL environment variable for this process only
    process.env.DATABASE_URL = databaseUrl;
    
    // Run Prisma Studio
    const prismaProcess = spawn('npx', ['prisma', 'studio'], {
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl
      }
    });

    prismaProcess.on('close', (code) => {
      console.log(`\n✅ Prisma Studio exited with code ${code}`);
    });

    prismaProcess.on('error', (error) => {
      console.error('❌ Failed to start Prisma Studio:', error);
    });

  } catch (error) {
    console.error("❌ Error running Prisma Studio:", error);
    process.exit(1);
  }
}

runPrismaStudio();