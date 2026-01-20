import {
  pineconeClient,
  type DocumentMetadata,
  type VectorRecord,
} from "./pinecone-client";
import { embeddingService } from "./embeddings";
import { documentProcessor } from "./document-processor";

export interface DocumentInput {
  buffer: Buffer;
  mimeType: string;
  filename: string;
  title?: string;
}

export interface ProcessingStatus {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  message: string;
  createdAt: string;
  completedAt?: string;
  error?: string;
}

export interface KnowledgeBaseEntry {
  id: string;
  title: string;
  source: "file";
  sourceId: string;
  avatarId?: string;
  uploadDate: string;
  chunkCount: number;
  status: "processing" | "completed" | "failed";
  summary?: string;
  filename?: string;
}

export interface RAGContext {
  chunks: {
    text: string;
    source: string;
    score: number;
    metadata: DocumentMetadata;
  }[];
  sources: string[];
}

export class RAGService {
  private processingStatus: Map<string, ProcessingStatus> = new Map();

  // Initialize RAG service
  async initialize(): Promise<void> {
    await pineconeClient.ensureIndex();
  }

  // Process document and store in knowledge base
  async processDocument(
    input: DocumentInput,
    avatarId?: string,
    isShared: boolean = false
  ): Promise<string> {
    const processingId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await this.updateProcessingStatus(processingId, {
      id: processingId,
      status: "processing",
      progress: 0,
      message: "Starting document processing...",
      createdAt: new Date().toISOString(),
    });

    try {
      // Store original file in S3
      const sourceId = `${isShared ? "shared" : avatarId}_${Date.now()}`;
      const s3Key = `knowledge-base/${sourceId}/${input.filename}`;

      await this.updateProcessingStatus(processingId, {
        ...this.processingStatus.get(processingId)!,
        progress: 10,
        message: "Storing original file...",
      });

      // Store in S3 (extend existing S3 client)
      await this.storeFileInS3(s3Key, input.buffer, input.mimeType);

      // Process document
      await this.updateProcessingStatus(processingId, {
        ...this.processingStatus.get(processingId)!,
        progress: 30,
        message: "Extracting text content...",
      });

      const processedDoc = await documentProcessor.processDocument(
        input.buffer,
        input.mimeType,
        sourceId,
        input.title || input.filename,
        "file"
      );

      // Generate embeddings
      await this.updateProcessingStatus(processingId, {
        ...this.processingStatus.get(processingId)!,
        progress: 60,
        message: "Generating embeddings...",
      });

      const embeddings = await embeddingService.generateEmbeddings(
        processedDoc.chunks.map((chunk) => chunk.text)
      );

      // Create vector records
      const vectors: VectorRecord[] = processedDoc.chunks.map(
        (chunk, index) => ({
          id: `${sourceId}_chunk_${chunk.chunkIndex}`,
          values: embeddings[index],
          metadata: {
            source: "file",
            sourceId,
            avatarId,
            uploadDate: new Date().toISOString(),
            chunkIndex: chunk.chunkIndex,
            totalChunks: chunk.totalChunks,
            title: processedDoc.title,
            originalText: chunk.text,
          },
        })
      );

      // Store in Pinecone
      await this.updateProcessingStatus(processingId, {
        ...this.processingStatus.get(processingId)!,
        progress: 90,
        message: "Storing in knowledge base...",
      });

      if (isShared) {
        await pineconeClient.storeSharedVectors(vectors);
      } else if (avatarId) {
        await pineconeClient.storeAvatarVectors(avatarId, vectors);
      }

      // Store metadata
      await this.storeDocumentMetadata(sourceId, {
        id: sourceId,
        title: processedDoc.title,
        source: "file",
        sourceId,
        avatarId,
        uploadDate: new Date().toISOString(),
        chunkCount: processedDoc.chunks.length,
        status: "completed",
        summary: documentProcessor.generateSummary(
          processedDoc.metadata.originalText
        ),
        filename: input.filename,
      });

      await this.updateProcessingStatus(processingId, {
        ...this.processingStatus.get(processingId)!,
        status: "completed",
        progress: 100,
        message: "Document processing completed",
        completedAt: new Date().toISOString(),
      });

      return processingId;
    } catch (error) {
      console.error("Failed to process document:", error);

      await this.updateProcessingStatus(processingId, {
        ...this.processingStatus.get(processingId)!,
        status: "failed",
        message: "Document processing failed",
        error: error instanceof Error ? error.message : "Unknown error",
        completedAt: new Date().toISOString(),
      });

      throw error;
    }
  }

  // Search knowledge base for relevant context
  async searchKnowledgeBase(
    query: string,
    avatarId?: string,
    topK: number = 5
  ): Promise<RAGContext> {
    try {
      // Generate query embedding
      const queryEmbedding = await embeddingService.generateEmbedding(query);

      // Search both shared and avatar-specific knowledge bases
      const searchResults = avatarId
        ? await pineconeClient.searchCombined(avatarId, queryEmbedding, topK)
        : await pineconeClient.searchShared(queryEmbedding, topK);

      // Filter results with minimum similarity threshold
      const filteredResults = searchResults.filter(
        (result) => result.score > 0.2
      );

      // Format context
      const chunks = filteredResults.map((result) => ({
        text: result.metadata.originalText,
        source: result.metadata.title,
        score: result.score,
        metadata: result.metadata,
      }));

      const sources = [...new Set(chunks.map((chunk) => chunk.source))];

      return {
        chunks,
        sources,
      };
    } catch (error) {
      console.error("Failed to search knowledge base:", error);

      return {
        chunks: [],
        sources: [],
      };
    }
  }

  // Delete document from knowledge base
  async deleteDocument(sourceId: string, avatarId?: string): Promise<void> {
    try {
      // Delete from Pinecone
      const isShared = !avatarId;

      await pineconeClient.deleteVectorsBySource(sourceId, isShared, avatarId);

      // Delete from S3
      await this.deleteFromS3(`knowledge-base/${sourceId}/`);

      // Delete metadata
      await this.deleteDocumentMetadata(sourceId);
    } catch (error) {
      console.error("Failed to delete document:", error);
      throw error;
    }
  }

  // Get processing status
  async getProcessingStatus(
    processingId: string
  ): Promise<ProcessingStatus | null> {
    // First check in-memory cache
    let status = this.processingStatus.get(processingId) || null;

    // If not in memory, try to load from S3 (for serverless persistence)
    if (!status) {
      try {
        status = await this.getProcessingStatusFromS3(processingId);
        if (status) {
          this.processingStatus.set(processingId, status);
        }
      } catch (error) {
        console.error("Failed to load processing status from S3:", error);
      }
    }

    return status;
  }

  // List documents in knowledge base
  async listDocuments(avatarId?: string): Promise<KnowledgeBaseEntry[]> {
    try {
      return await this.getDocumentMetadata(avatarId);
    } catch (error) {
      console.error("Failed to list documents:", error);

      return [];
    }
  }

  // Private helper methods
  private async updateProcessingStatus(
    id: string,
    status: ProcessingStatus
  ): Promise<void> {
    this.processingStatus.set(id, status);

    // Also store in S3 for persistence across serverless requests
    try {
      await this.storeProcessingStatus(id, status);
    } catch (error) {
      console.error("Failed to store processing status in S3:", error);
    }

    // Clean up completed/failed statuses after 10 minutes (give frontend time to poll)
    if (status.status === "completed" || status.status === "failed") {
      setTimeout(
        () => {
          this.processingStatus.delete(id);
          this.deleteProcessingStatus(id).catch(console.error);
        },
        10 * 60 * 1000 // 10 minutes instead of 1 hour
      );
    }
  }

  private async storeFileInS3(
    key: string,
    buffer: Buffer,
    contentType: string
  ): Promise<void> {
    try {
      const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
      const s3Client = new S3Client({
        region: process.env.AWS_REGION || "us-east-2",
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });

      const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME!;

      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      });

      await s3Client.send(command);
    } catch (error) {
      console.error(`Failed to upload file to S3 with key: ${key}`, error);
      throw error;
    }
  }

  private async deleteFromS3(prefix: string): Promise<void> {
    try {
      const { S3Client, ListObjectsV2Command, DeleteObjectsCommand } =
        await import("@aws-sdk/client-s3");
      const s3Client = new S3Client({
        region: process.env.AWS_REGION || "us-east-2",
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });

      const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME!;

      let continuationToken: string | undefined;

      do {
        // List objects with the prefix
        const listCommand = new ListObjectsV2Command({
          Bucket: BUCKET_NAME,
          Prefix: prefix,
          ContinuationToken: continuationToken,
          MaxKeys: 1000,
        });

        const listResponse = await s3Client.send(listCommand);
        const objects = listResponse.Contents || [];

        if (objects.length > 0) {
          // Delete objects in batches
          const deleteCommand = new DeleteObjectsCommand({
            Bucket: BUCKET_NAME,
            Delete: {
              Objects: objects.map((obj) => ({ Key: obj.Key! })),
            },
          });

          await s3Client.send(deleteCommand);
        }

        continuationToken = listResponse.NextContinuationToken;
      } while (continuationToken);
    } catch (error) {
      console.error(
        `Failed to delete S3 objects with prefix: ${prefix}`,
        error
      );
      throw error;
    }
  }

  private async storeDocumentMetadata(
    id: string,
    metadata: KnowledgeBaseEntry
  ): Promise<void> {
    // Store metadata in S3
    const { s3Storage } = await import("@/lib/s3-client");
    await s3Storage.storeDocumentMetadata(id, metadata);
  }

  private async deleteDocumentMetadata(id: string): Promise<void> {
    // Delete metadata from S3
    const { s3Storage } = await import("@/lib/s3-client");
    await s3Storage.deleteDocumentMetadata(id);
  }

  private async storeProcessingStatus(
    id: string,
    status: ProcessingStatus
  ): Promise<void> {
    try {
      const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
      const s3Client = new S3Client({
        region: process.env.AWS_REGION || "us-east-2",
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });

      const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME!;
      const key = `processing-status/${id}.json`;

      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: JSON.stringify(status, null, 2),
        ContentType: "application/json",
      });

      await s3Client.send(command);
    } catch (error) {
      console.error(`Failed to store processing status for ${id}:`, error);
    }
  }

  private async getProcessingStatusFromS3(
    id: string
  ): Promise<ProcessingStatus | null> {
    try {
      const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
      const s3Client = new S3Client({
        region: process.env.AWS_REGION || "us-east-2",
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });

      const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME!;
      const key = `processing-status/${id}.json`;

      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });

      const response = await s3Client.send(command);
      if (!response.Body) {
        return null;
      }

      const content = await response.Body.transformToString();
      return JSON.parse(content) as ProcessingStatus;
    } catch (error) {
      // File not found is expected for non-existent status
      return null;
    }
  }

  private async deleteProcessingStatus(id: string): Promise<void> {
    try {
      const { S3Client, DeleteObjectCommand } = await import(
        "@aws-sdk/client-s3"
      );
      const s3Client = new S3Client({
        region: process.env.AWS_REGION || "us-east-2",
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });

      const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME!;
      const key = `processing-status/${id}.json`;

      const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });

      await s3Client.send(command);
    } catch (error) {
      console.error(`Failed to delete processing status for ${id}:`, error);
    }
  }

  private async getDocumentMetadata(
    avatarId?: string
  ): Promise<KnowledgeBaseEntry[]> {
    try {
      const { s3Storage } = await import("@/lib/s3-client");

      // List all knowledge base objects from S3
      const { S3Client, ListObjectsV2Command } = await import(
        "@aws-sdk/client-s3"
      );
      const { KNOWLEDGE_BASE_PREFIX, METADATA_SUFFIX } = await import(
        "@/lib/s3-client"
      );

      const s3Client = new S3Client({
        region: process.env.AWS_REGION || "us-east-2",
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });

      const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME!;

      const documents: KnowledgeBaseEntry[] = [];
      let continuationToken: string | undefined;

      do {
        const listCommand = new ListObjectsV2Command({
          Bucket: BUCKET_NAME,
          Prefix: KNOWLEDGE_BASE_PREFIX,
          ContinuationToken: continuationToken,
          MaxKeys: 1000,
        });

        const listResponse = await s3Client.send(listCommand);
        const objects = listResponse.Contents || [];

        // Filter for metadata files and extract document info
        for (const obj of objects) {
          if (obj.Key?.endsWith(METADATA_SUFFIX)) {
            try {
              // Get the metadata
              const metadata = await s3Storage.getDocumentMetadata(
                obj.Key.replace(KNOWLEDGE_BASE_PREFIX, "").replace(
                  `/${METADATA_SUFFIX}`,
                  ""
                )
              );

              if (metadata) {
                // Filter by avatar if specified
                if (avatarId && metadata.avatarId !== avatarId) {
                  continue;
                }

                // Filter for shared documents if no avatarId specified
                if (!avatarId && metadata.avatarId) {
                  continue;
                }

                documents.push(metadata);
              }
            } catch (error) {
              console.error(`Failed to get metadata for ${obj.Key}:`, error);
            }
          }
        }

        continuationToken = listResponse.NextContinuationToken;
      } while (continuationToken);

      // Sort by upload date (newest first)
      documents.sort(
        (a, b) =>
          new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()
      );

      return documents;
    } catch (error) {
      console.error("Failed to get document metadata:", error);
      return [];
    }
  }
}

// Export singleton instance
export const ragService = new RAGService();
