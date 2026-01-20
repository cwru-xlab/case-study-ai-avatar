import { Pinecone } from "@pinecone-database/pinecone";

// Initialize Pinecone client
let pinecone: Pinecone | null = null;

function getPineconeClient(): Pinecone {
  if (!pinecone) {
    if (!process.env.PINECONE_API_KEY) {
      throw new Error("PINECONE_API_KEY environment variable is required");
    }
    pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });
  }
  return pinecone;
}

// Single index with namespaces
export const MAIN_INDEX = process.env.PINECONE_INDEX_NAME || "case-study-ai-knowledge";
export const SHARED_NAMESPACE = "shared";
export const AVATAR_NAMESPACE_PREFIX = "avatar-";

// Embedding dimensions for OpenAI text-embedding-3-small
export const EMBEDDING_DIMENSION = 1536;

export interface DocumentMetadata {
  source: "file";
  sourceId: string;
  avatarId?: string;
  uploadDate: string;
  chunkIndex: number;
  totalChunks: number;
  title: string;
  originalText: string;
  [key: string]: any; // Index signature for Pinecone compatibility
}

export interface VectorRecord {
  id: string;
  values: number[];
  metadata: DocumentMetadata;
}

export interface SearchResult {
  id: string;
  score: number;
  metadata: DocumentMetadata;
}

export class PineconeClient {
  // Ensure main index exists
  async ensureIndex(): Promise<void> {
    const pinecone = getPineconeClient();
    const existingIndexes = await pinecone.listIndexes();
    const indexNames = existingIndexes.indexes?.map((idx) => idx.name) || [];

    // Create main index if it doesn't exist
    if (!indexNames.includes(MAIN_INDEX)) {
      await pinecone.createIndex({
        name: MAIN_INDEX,
        dimension: EMBEDDING_DIMENSION,
        metric: "cosine",
        spec: {
          serverless: {
            cloud: "aws",
            region: "us-east-1",
          },
        },
      });
      console.log(`Created main index: ${MAIN_INDEX}`);

      // Wait for index to be ready
      await this.waitForIndexReady(MAIN_INDEX);
    }
  }

  // Get namespace for avatar
  private getAvatarNamespace(avatarId: string): string {
    return `${AVATAR_NAMESPACE_PREFIX}${avatarId}`;
  }

  // Wait for index to be ready
  private async waitForIndexReady(indexName: string): Promise<void> {
    const pinecone = getPineconeClient();
    const maxAttempts = 30; // Wait up to 30 attempts (30 seconds)
    const delayMs = 1000; // 1 second between attempts

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const indexDesc = await pinecone.describeIndex(indexName);
        if (indexDesc.status?.ready) {
          console.log(`Index ${indexName} is ready`);
          return;
        }
      } catch (error) {
        console.log(`Attempt ${attempt + 1}: Index ${indexName} not ready yet`);
      }

      // Wait before next attempt
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    throw new Error(
      `Index ${indexName} did not become ready within ${maxAttempts} seconds`
    );
  }

  // Delete avatar namespace
  async deleteAvatarNamespace(avatarId: string): Promise<void> {
    const pinecone = getPineconeClient();
    const index = pinecone.index(MAIN_INDEX);
    const namespace = this.getAvatarNamespace(avatarId);

    try {
      // Delete all vectors in the namespace
      await index.namespace(namespace).deleteAll();
      console.log(`Deleted avatar namespace: ${namespace}`);
    } catch (error) {
      console.error(`Failed to delete avatar namespace ${namespace}:`, error);
    }
  }

  // Store vectors in shared knowledge base
  async storeSharedVectors(vectors: VectorRecord[]): Promise<void> {
    const pinecone = getPineconeClient();
    const index = pinecone.index(MAIN_INDEX);

    // Upsert vectors in batches of 100 using shared namespace
    const batchSize = 100;

    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);

      await index.namespace(SHARED_NAMESPACE).upsert(batch);
    }
  }

  // Store vectors in avatar-specific knowledge base
  async storeAvatarVectors(
    avatarId: string,
    vectors: VectorRecord[]
  ): Promise<void> {
    const pinecone = getPineconeClient();
    const index = pinecone.index(MAIN_INDEX);
    const namespace = this.getAvatarNamespace(avatarId);

    // Ensure main index exists
    await this.ensureIndex();

    // Upsert vectors in batches of 100 using avatar namespace
    const batchSize = 100;

    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);

      await index.namespace(namespace).upsert(batch);
    }
  }

  // Search shared knowledge base
  async searchShared(
    queryVector: number[],
    topK: number = 5,
    filter?: Record<string, any>
  ): Promise<SearchResult[]> {
    const pinecone = getPineconeClient();
    const index = pinecone.index(MAIN_INDEX);

    const response = await index.namespace(SHARED_NAMESPACE).query({
      vector: queryVector,
      topK,
      includeMetadata: true,
      filter,
    });

    return (
      response.matches?.map((match) => ({
        id: match.id,
        score: match.score || 0,
        metadata: match.metadata as unknown as DocumentMetadata,
      })) || []
    );
  }

  // Search avatar-specific knowledge base
  async searchAvatar(
    avatarId: string,
    queryVector: number[],
    topK: number = 5,
    filter?: Record<string, any>
  ): Promise<SearchResult[]> {
    const pinecone = getPineconeClient();
    const index = pinecone.index(MAIN_INDEX);
    const namespace = this.getAvatarNamespace(avatarId);

    try {
      const response = await index.namespace(namespace).query({
        vector: queryVector,
        topK,
        includeMetadata: true,
        filter,
      });

      return (
        response.matches?.map((match) => ({
          id: match.id,
          score: match.score || 0,
          metadata: match.metadata as unknown as DocumentMetadata,
        })) || []
      );
    } catch (error) {
      console.error(`Failed to search avatar namespace ${namespace}:`, error);

      return [];
    }
  }

  // Combined search (shared + avatar)
  async searchCombined(
    avatarId: string,
    queryVector: number[],
    topK: number = 5
  ): Promise<SearchResult[]> {
    const [sharedResults, avatarResults] = await Promise.all([
      this.searchShared(queryVector, Math.ceil(topK / 2)),
      this.searchAvatar(avatarId, queryVector, Math.ceil(topK / 2)),
    ]);

    // Combine and sort by score
    const combined = [...sharedResults, ...avatarResults];

    combined.sort((a, b) => b.score - a.score);

    return combined.slice(0, topK);
  }

  // Delete vectors by source
  async deleteVectorsBySource(
    sourceId: string,
    isShared: boolean = false,
    avatarId?: string
  ): Promise<void> {
    const pinecone = getPineconeClient();
    const index = pinecone.index(MAIN_INDEX);
    const namespace = isShared
      ? SHARED_NAMESPACE
      : this.getAvatarNamespace(avatarId!);

    try {
      const namespaceIndex = index.namespace(namespace);

      // Use ID pattern matching since we know our IDs follow the pattern: ${sourceId}_chunk_${chunkIndex}
      const vectorIdsToDelete: string[] = [];

      // Method 1: Try to delete by ID pattern (most reliable)
      // We'll attempt to delete chunks 0-999 (should cover most documents)
      const idPatternIds: string[] = [];
      for (let i = 0; i < 1000; i++) {
        idPatternIds.push(`${sourceId}_chunk_${i}`);
      }

      // Try to delete by ID pattern in batches
      const batchSize = 100;
      for (let i = 0; i < idPatternIds.length; i += batchSize) {
        const batchIds = idPatternIds.slice(i, i + batchSize);
        try {
          await namespaceIndex.deleteMany(batchIds);
        } catch (error) {
          // Some IDs might not exist, which is fine
        }
      }

      // Method 2: Fallback - search for any remaining vectors with this sourceId
      // Use multiple random vectors to increase coverage
      const searchVectors = [
        new Array(EMBEDDING_DIMENSION).fill(0.1), // Small positive values
        new Array(EMBEDDING_DIMENSION).fill(-0.1), // Small negative values
        new Array(EMBEDDING_DIMENSION).fill(0), // Zero vector
      ];

      for (const searchVector of searchVectors) {
        let hasMoreResults = true;

        while (hasMoreResults) {
          const queryResponse = await namespaceIndex.query({
            vector: searchVector,
            topK: 1000,
            includeMetadata: true,
          });

          if (queryResponse.matches && queryResponse.matches.length > 0) {
            queryResponse.matches.forEach((match) => {
              if (
                match.metadata?.sourceId === sourceId &&
                match.id &&
                !vectorIdsToDelete.includes(match.id)
              ) {
                vectorIdsToDelete.push(match.id);
              }
            });

            hasMoreResults = queryResponse.matches.length === 1000;
          } else {
            hasMoreResults = false;
          }
        }
      }

      // Delete by specific vector IDs
      if (vectorIdsToDelete.length > 0) {
        await namespaceIndex.deleteMany(vectorIdsToDelete);
      }
    } catch (error) {
      console.error(
        `Failed to delete vectors from namespace ${namespace}:`,
        error
      );
    }
  }

  // Get index stats
  async getIndexStats(): Promise<any> {
    const pinecone = getPineconeClient();
    try {
      const index = pinecone.index(MAIN_INDEX);

      return await index.describeIndexStats();
    } catch (error) {
      console.error(`Failed to get stats for ${MAIN_INDEX}:`, error);

      return null;
    }
  }

  // Get namespace stats
  async getNamespaceStats(namespace: string): Promise<any> {
    const pinecone = getPineconeClient();
    try {
      const index = pinecone.index(MAIN_INDEX);
      const stats = await index.describeIndexStats();

      // Return stats for the specific namespace
      return stats.namespaces?.[namespace] || null;
    } catch (error) {
      console.error(`Failed to get stats for namespace ${namespace}:`, error);

      return null;
    }
  }
}

// Export singleton instance
export const pineconeClient = new PineconeClient();
