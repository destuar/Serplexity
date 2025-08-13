import env from "../config/env";
import { SecretsProviderFactory } from "./secretsProvider";

export async function getProxyUrlFromSecrets(
  secretName: string = "serplexity-network-proxy"
): Promise<string | null> {
  try {
    const provider = await SecretsProviderFactory.createFromEnvironment();
    if (provider.getProviderName() !== "AWS_SECRETS_MANAGER") {
      return null;
    }

    const { SecretsManagerClient, GetSecretValueCommand } = await import(
      "@aws-sdk/client-secrets-manager"
    );

    const client = new SecretsManagerClient({
      region: env.AWS_REGION,
      credentials:
        env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
          ? {
              accessKeyId: env.AWS_ACCESS_KEY_ID,
              secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
            }
          : undefined,
    });

    const resp = await client.send(
      new GetSecretValueCommand({
        SecretId: secretName,
        VersionStage: "AWSCURRENT",
      })
    );

    const raw = resp.SecretString || "";
    if (!raw) return null;

    try {
      const json = JSON.parse(raw) as Record<string, unknown>;
      const url =
        (json["proxyUrl"] as string | undefined) ||
        (json["http_proxy"] as string | undefined) ||
        (json["https_proxy"] as string | undefined);
      return url || null;
    } catch {
      // fallback: secret is a bare URL string
      return raw.startsWith("http") ? raw : null;
    }
  } catch {
    return null;
  }
}
