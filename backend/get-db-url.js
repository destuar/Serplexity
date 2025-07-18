#!/usr/bin/env node

/**
 * Script to get the actual database URL from AWS Secrets Manager
 * This will help you update your .env file with the correct DATABASE_URL
 */

const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");

async function getDatabaseUrl() {
  try {
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

    const response = await client.send(command);
    const secret = JSON.parse(response.SecretString);
    
    console.log("Full secret object:", secret);
    console.log("\nDatabase credentials from AWS Secrets Manager:");
    console.log("Host:", secret.host);
    console.log("Port:", secret.port);
    console.log("Database:", secret.database || secret.dbname || "NOT SET");
    console.log("Username:", secret.username);
    console.log("Password:", secret.password ? "***" : "NOT SET");
    
    const databaseUrl = `postgresql://${encodeURIComponent(secret.username)}:${encodeURIComponent(secret.password)}@${secret.host}:${secret.port}/${secret.dbname}?sslmode=require`;
    
    console.log("\n🔗 DATABASE_URL for your .env file:");
    console.log(databaseUrl);
    
    return databaseUrl;
  } catch (error) {
    console.error("Error getting database URL:", error);
    process.exit(1);
  }
}

// Load environment variables
require('dotenv').config();

getDatabaseUrl();