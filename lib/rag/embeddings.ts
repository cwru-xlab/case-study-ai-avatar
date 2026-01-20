import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export interface EmbeddingRequest {
  text: string;
  chunkIndex?: number;
}

export interface EmbeddingResult {
  embedding: number[];
  chunkIndex?: number;
}

export class EmbeddingService {
  // Generate single embedding
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text.trim(),
        encoding_format: "float",
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error("Failed to generate embedding:", error);
      throw new Error("Failed to generate embedding");
    }
  }

  // Generate multiple embeddings in batch
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      // Process in batches to avoid API limits
      const batchSize = 100;
      const results: number[][] = [];

      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);

        const response = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: batch.map((text) => text.trim()),
          encoding_format: "float",
        });

        const batchEmbeddings = response.data.map((item) => item.embedding);

        results.push(...batchEmbeddings);
      }

      return results;
    } catch (error) {
      console.error("Failed to generate embeddings:", error);
      throw new Error("Failed to generate embeddings");
    }
  }

  // Generate embeddings with metadata
  async generateEmbeddingsWithMetadata(
    requests: EmbeddingRequest[],
  ): Promise<EmbeddingResult[]> {
    try {
      const texts = requests.map((req) => req.text);
      const embeddings = await this.generateEmbeddings(texts);

      return embeddings.map((embedding, index) => ({
        embedding,
        chunkIndex: requests[index].chunkIndex,
      }));
    } catch (error) {
      console.error("Failed to generate embeddings with metadata:", error);
      throw new Error("Failed to generate embeddings with metadata");
    }
  }

  // Calculate similarity between two embeddings
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error("Embeddings must have the same length");
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // Find most similar embeddings
  findMostSimilar(
    queryEmbedding: number[],
    candidateEmbeddings: { embedding: number[]; metadata: any }[],
    topK: number = 5,
  ): { similarity: number; metadata: any }[] {
    const similarities = candidateEmbeddings.map((candidate) => ({
      similarity: this.cosineSimilarity(queryEmbedding, candidate.embedding),
      metadata: candidate.metadata,
    }));

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }
}

// Export singleton instance
export const embeddingService = new EmbeddingService();
