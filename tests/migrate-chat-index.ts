// migrate-chat-index.ts
// Migration script to generate chats/index.json from all existing chat session files in S3.
// Usage: npx ts-node ./tests/migrate-chat-index.ts

// Load environment variables from .env/.env.local for AWS credentials and bucket name
import 'dotenv/config';

// Debug: print loaded environment variables
console.log('Loaded env:', {
  AWS_S3_BUCKET_NAME: process.env.AWS_S3_BUCKET_NAME,
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
});
// AWS SDK v3 is CommonJS, so use default import for runtime and type import for types
import pkg from "@aws-sdk/client-s3";
const { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } = pkg;
import type { ListObjectsV2CommandOutput } from "@aws-sdk/client-s3";
import type { ChatSession, ChatSessionMetadata } from "../types";

// S3 configuration (must match app config)
const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME!;
const CHATS_PREFIX = "chats/";
const CHAT_INDEX_FILE = `${CHATS_PREFIX}index.json`;
const REGION = process.env.AWS_REGION || "us-east-2";

const s3Client = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

async function listAllChatSessionKeys(): Promise<string[]> {
  // List all objects under chats/ prefix
  const keys: string[] = [];
  let ContinuationToken: string | undefined = undefined;
  do {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: CHATS_PREFIX,
      ContinuationToken,
    });
    const response = await s3Client.send(command) as ListObjectsV2CommandOutput;
    if (response.Contents) {
      for (const obj of response.Contents) {
        if (obj.Key && obj.Key.endsWith('.json') && obj.Key !== CHAT_INDEX_FILE) {
          keys.push(obj.Key);
        }
      }
    }
    // Use explicit type for IsTruncated and NextContinuationToken
    ContinuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return keys;
}

async function getSessionMetadataFromS3(key: string): Promise<ChatSessionMetadata | null> {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });
    const response = await s3Client.send(command);
    if (!response.Body) return null;
    const content = await response.Body.transformToString();
    const session: ChatSession = JSON.parse(content);
    return session.metadata;
  } catch (error) {
    console.error(`Failed to read session file ${key}:`, error);
    return null;
  }
}

async function writeIndexFile(index: ChatSessionMetadata[]): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: CHAT_INDEX_FILE,
    Body: JSON.stringify(index, null, 2),
    ContentType: "application/json",
  });
  await s3Client.send(command);
}

async function main() {
  console.log("--- Chat Session Index Migration ---");
  console.log(`Bucket: ${BUCKET_NAME}`);
  console.log(`Region: ${REGION}`);
  console.log("Listing all chat session files in S3...");
  const keys = await listAllChatSessionKeys();
  console.log(`Found ${keys.length} session files.`);

  const index: ChatSessionMetadata[] = [];
  for (const key of keys) {
    const meta = await getSessionMetadataFromS3(key);
    if (meta) {
      index.push(meta);
      console.log(`Indexed: ${meta.sessionId}`);
    } else {
      console.warn(`Skipped: ${key}`);
    }
  }

  // Sort by startTime descending (newest first)
  index.sort((a, b) => b.startTime - a.startTime);
  console.log(`Writing index file with ${index.length} entries...`);
  await writeIndexFile(index);
  console.log("Migration complete! chats/index.json updated.");
}

main().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
}); 