require("dotenv").config();
const {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
} = require("@aws-sdk/client-s3");
const { gunzip } = require("zlib");
const { promisify } = require("util");

const gunzipAsync = promisify(gunzip);
const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;
const CHATS_PREFIX = "chats/";
const CHAT_INDEX_FILE = "chats/index.json";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-2",
});

async function rebuildIndex() {
  console.log("🔧 Rebuilding chat session index...");

  try {
    // List all compressed chat files
    const listCommand = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: CHATS_PREFIX,
    });

    const response = await s3Client.send(listCommand);
    const compressedFiles =
      response.Contents?.filter(
        (obj) => obj.Key?.endsWith(".json.gz") && !obj.Key?.includes("index")
      ) || [];

    console.log(` Found ${compressedFiles.length} compressed chat files`);

    const index = [];

    for (const file of compressedFiles) {
      if (!file.Key) continue;

      const sessionId = file.Key.replace(CHATS_PREFIX, "").replace(
        ".json.gz",
        ""
      );

      try {
        // Get the compressed file
        const getCommand = new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: file.Key,
        });

        const fileResponse = await s3Client.send(getCommand);
        if (!fileResponse.Body) continue;

        // Decompress and parse
        const compressedData = await fileResponse.Body.transformToByteArray();
        const buffer = Buffer.from(compressedData);
        const decompressedData = await gunzipAsync(buffer);
        const session = JSON.parse(decompressedData.toString("utf-8"));

        // Add metadata to index
        index.push(session.metadata);
        console.log(`✅ Added: ${sessionId}`);
      } catch (error) {
        console.log(`❌ Failed to process ${sessionId}: ${error.message}`);
      }
    }

    // Sort by startTime descending (newest first)
    index.sort((a, b) => b.startTime - a.startTime);

    // Save the new index
    const putCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: CHAT_INDEX_FILE,
      Body: JSON.stringify(index, null, 2),
      ContentType: "application/json",
    });

    await s3Client.send(putCommand);

    console.log(`✅ Index rebuilt with ${index.length} sessions`);
    console.log(` Total sessions: ${index.length}`);
  } catch (error) {
    console.error("❌ Failed to rebuild index:", error);
  }
}

rebuildIndex();
