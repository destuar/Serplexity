import { exec } from "child_process";
import path from "path";
import env from "../config/env";
import {
  SecretsProviderFactory,
  type SecretsProviderType,
} from "../services/secretsProvider";

async function main() {
  const providerType = env.COMPUTED_SECRETS_PROVIDER as SecretsProviderType;

  if (providerType !== "aws") {
    console.log("Not using AWS secrets, skipping secret retrieval.");
    executeCommand(process.env["DATABASE_URL"]);
    return;
  }

  if (!env.DATABASE_SECRET_NAME) {
    throw new Error(
      "DATABASE_SECRET_NAME is not set in the environment variables."
    );
  }

  try {
    console.log(
      `Fetching secret '${env.DATABASE_SECRET_NAME}' from AWS Secrets Manager...`
    );

    const secretsProvider = SecretsProviderFactory.createProvider(providerType);
    const secretResult = await secretsProvider.getSecret(
      env.DATABASE_SECRET_NAME
    );
    const secret = secretResult.secret;

    if (!secret) {
      throw new Error("Secret value is empty.");
    }

    const dbname = secret.database || (secret as any).dbname;
    if (!dbname) {
      throw new Error(
        'Database name not found in secret. Checked for "database" and "dbname" properties.'
      );
    }

    const encodedUsername = encodeURIComponent(secret.username);
    const encodedPassword = encodeURIComponent(secret.password);

    const dbUrl = `postgresql://${encodedUsername}:${encodedPassword}@${secret.host}:${secret.port}/${dbname}`;

    console.log("Secret fetched successfully. Executing command...");
    executeCommand(dbUrl);
  } catch (error) {
    console.error("Error fetching secret or executing command:", error);
    process.exit(1);
  }
}

function executeCommand(databaseUrl?: string) {
  const command = process.argv.slice(2).join(" ");

  if (!command) {
    console.error("No command provided to execute.");
    process.exit(1);
  }

  const envVars = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    // Add the path to the prisma schema to the environment variables
    PRISMA_SCHEMA_PATH: path.resolve(process.cwd(), "prisma/schema.prisma"),
  };

  const commandWithSchema = `${command} --schema=${envVars.PRISMA_SCHEMA_PATH}`;

  const child = exec(commandWithSchema, { env: envVars });

  child.stdout?.pipe(process.stdout);
  child.stderr?.pipe(process.stderr);

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

main();
