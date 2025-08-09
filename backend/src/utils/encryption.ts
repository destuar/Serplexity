import type { EncryptCommandInput } from "@aws-sdk/client-kms";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
} from "crypto";

let kmsClient: any | null = null;

async function getKmsClient() {
  if (kmsClient) return kmsClient;
  const env = (await import("../config/env")).default;
  if (!env.AWS_KMS_KEY_ID) return null;
  const { KMSClient } = await import("@aws-sdk/client-kms");
  kmsClient = new KMSClient({ region: env.AWS_REGION });
  return kmsClient;
}

export async function encryptString(
  plaintext: string,
  context?: Record<string, string>
): Promise<string> {
  const env = (await import("../config/env")).default;
  // Prefer AWS KMS when configured
  const kms = await getKmsClient();
  if (kms && env.AWS_KMS_KEY_ID) {
    const { EncryptCommand } = await import("@aws-sdk/client-kms");
    const params: EncryptCommandInput = {
      KeyId: env.AWS_KMS_KEY_ID,
      Plaintext: Buffer.from(plaintext, "utf8"),
      EncryptionContext: {
        service: "serplexity",
        purpose: "oauth_token",
        ...(context || {}),
      },
    };
    const out = await kms.send(new EncryptCommand(params));
    if (!out.CiphertextBlob)
      throw new Error("KMS encryption failed: no ciphertext");
    return Buffer.from(out.CiphertextBlob).toString("base64");
  }

  // Dev/test fallback: AES-256-GCM using derived key from JWT_SECRET
  const key = scryptSync(env.JWT_SECRET, "serplexity-enc-v1", 32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, ciphertext]).toString("base64");
  return `enc:v1:gcm:${payload}`;
}

export async function decryptString(
  ciphertext: string,
  context?: Record<string, string>
): Promise<string> {
  const env = (await import("../config/env")).default;
  // Try AWS KMS path if the blob looks like raw base64 without prefix
  if (!ciphertext.startsWith("enc:v1:gcm:")) {
    const kms = await getKmsClient();
    if (kms && env.AWS_KMS_KEY_ID) {
      const { DecryptCommand } = await import("@aws-sdk/client-kms");
      const params = new DecryptCommand({
        CiphertextBlob: Buffer.from(ciphertext, "base64"),
        EncryptionContext: {
          service: "serplexity",
          purpose: "oauth_token",
          ...(context || {}),
        },
      } as any);
      const out = await kms.send(params);
      if (!out.Plaintext)
        throw new Error("KMS decryption failed: no plaintext");
      return Buffer.from(out.Plaintext).toString("utf8");
    }
  }

  // Dev/test fallback: AES-256-GCM
  if (!ciphertext.startsWith("enc:v1:gcm:")) {
    throw new Error("Unsupported ciphertext format");
  }
  const b64 = ciphertext.replace("enc:v1:gcm:", "");
  const data = Buffer.from(b64, "base64");
  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const enc = data.subarray(28);
  const key = scryptSync(env.JWT_SECRET, "serplexity-enc-v1", 32);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([
    decipher.update(enc),
    decipher.final(),
  ]).toString("utf8");
  return plaintext;
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}
