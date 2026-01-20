import PDFParser from "pdf2json";
import mammoth from "mammoth";

export interface TextChunk {
  text: string;
  chunkIndex: number;
  totalChunks: number;
}

export interface ProcessedDocument {
  title: string;
  chunks: TextChunk[];
  metadata: {
    source: "file";
    sourceId: string;
    originalText: string;
    processingDate: string;
  };
}

export class DocumentProcessor {
  // Extract text from PDF buffer
  async extractTextFromPDF(buffer: Buffer): Promise<string> {
    try {
      const pdfParser = new PDFParser();

      return new Promise((resolve, reject) => {
        pdfParser.on("pdfParser_dataError", (errData: any) => {
          reject(new Error(`PDF parsing error: ${errData.parserError}`));
        });

        pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
          try {
            // Extract text from all pages
            let fullText = "";
            pdfData.Pages.forEach((page: any) => {
              page.Texts.forEach((text: any) => {
                text.R.forEach((run: any) => {
                  fullText += decodeURIComponent(run.T);
                });
              });
              fullText += "\n";
            });
            resolve(fullText);
          } catch (error) {
            reject(new Error(`Failed to extract text from PDF data: ${error}`));
          }
        });

        pdfParser.parseBuffer(buffer);
      });
    } catch (error) {
      console.error("Failed to extract text from PDF:", error);
      throw new Error("Failed to extract text from PDF");
    }
  }

  // Extract text from TXT buffer
  async extractTextFromTXT(buffer: Buffer): Promise<string> {
    try {
      // First, try UTF-8 with validation
      const utf8Text = buffer.toString('utf-8');

      // Check for UTF-8 validity by looking for replacement characters
      // that indicate invalid UTF-8 sequences
      if (utf8Text.includes('\uFFFD')) {
        console.warn("Invalid UTF-8 detected, attempting fallback encodings");

        // Try common fallback encodings
        try {
          // Try Latin-1 (ISO-8859-1) which can decode any byte sequence
          const latin1Text = buffer.toString('latin1');
          console.info("Successfully decoded using Latin-1 encoding");
          return latin1Text;
        } catch (latin1Error) {
          // Try ASCII as last resort
          try {
            const asciiText = buffer.toString('ascii');
            console.info("Successfully decoded using ASCII encoding");
            return asciiText;
          } catch (asciiError) {
            throw new Error("Unable to decode text file with UTF-8, Latin-1, or ASCII encoding");
          }
        }
      }

      return utf8Text;
    } catch (error) {
      console.error("Failed to extract text from TXT:", error);
      if (error instanceof Error && error.message.includes("encoding")) {
        throw new Error(`Text encoding error: ${error.message}`);
      }
      throw new Error("Failed to extract text from TXT file");
    }
  }

  // Extract text from DOCX buffer
  async extractTextFromDOCX(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      console.error("Failed to extract text from DOCX:", error);
      throw new Error("Failed to extract text from DOCX file");
    }
  }

  // Extract text based on file type
  async extractText(buffer: Buffer, mimeType: string): Promise<string> {
    switch (mimeType) {
      case "application/pdf":
        return await this.extractTextFromPDF(buffer);
      case "text/plain":
        return await this.extractTextFromTXT(buffer);
      case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return await this.extractTextFromDOCX(buffer);
      default:
        throw new Error(`Unsupported file type: ${mimeType}. Supported types: PDF, TXT, DOCX`);
    }
  }

  // Clean extracted text
  cleanText(text: string): string {
    return text
      .replace(/\s+/g, " ") // Replace multiple whitespace with single space
      .replace(/\n{3,}/g, "\n\n") // Replace multiple newlines with double newline
      .trim(); // Remove leading/trailing whitespace
  }

  // Split text into chunks
  chunkText(
    text: string,
    maxTokens: number = 500,
    overlapTokens: number = 50,
  ): TextChunk[] {
    const cleanedText = this.cleanText(text);

    // Rough token estimation: ~4 characters per token
    const maxChars = maxTokens * 4;
    const overlapChars = overlapTokens * 4;

    const chunks: TextChunk[] = [];
    let startIndex = 0;
    let chunkIndex = 0;

    while (startIndex < cleanedText.length) {
      let endIndex = startIndex + maxChars;

      // If we're not at the end of the text, find a good break point
      if (endIndex < cleanedText.length) {
        // Look for sentence ending within the last 100 characters
        const searchStart = Math.max(endIndex - 100, startIndex);
        const sentenceEnd = cleanedText.lastIndexOf(".", endIndex);
        const questionEnd = cleanedText.lastIndexOf("?", endIndex);
        const exclamationEnd = cleanedText.lastIndexOf("!", endIndex);

        const bestEnd = Math.max(sentenceEnd, questionEnd, exclamationEnd);

        if (bestEnd > searchStart) {
          endIndex = bestEnd + 1;
        } else {
          // Fall back to word boundary
          const spaceIndex = cleanedText.lastIndexOf(" ", endIndex);

          if (spaceIndex > searchStart) {
            endIndex = spaceIndex;
          }
        }
      }

      const chunkText = cleanedText.slice(startIndex, endIndex).trim();

      if (chunkText.length > 0) {
        chunks.push({
          text: chunkText,
          chunkIndex,
          totalChunks: 0, // Will be updated after all chunks are created
        });
        chunkIndex++;
      }

      // Move start index with overlap
      startIndex = endIndex - overlapChars;

      // Ensure we don't go backwards
      if (startIndex <= 0) {
        startIndex = endIndex;
      }
    }

    // Update total chunks count
    chunks.forEach((chunk) => {
      chunk.totalChunks = chunks.length;
    });

    return chunks;
  }

  // Process document from buffer
  async processDocument(
    buffer: Buffer,
    mimeType: string,
    sourceId: string,
    title: string,
    source: "file" = "file",
  ): Promise<ProcessedDocument> {
    try {
      // Extract text
      const rawText = await this.extractText(buffer, mimeType);

      // Clean and chunk text
      const chunks = this.chunkText(rawText);

      return {
        title,
        chunks,
        metadata: {
          source,
          sourceId,
          originalText: rawText,
          processingDate: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error("Failed to process document:", error);
      throw new Error("Failed to process document");
    }
  }

  // Get supported MIME types
  getSupportedMimeTypes(): string[] {
    return [
      "application/pdf",
      "text/plain",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];
  }

  // Check if file type is supported
  isSupported(mimeType: string): boolean {
    return this.getSupportedMimeTypes().includes(mimeType);
  }

  // Estimate token count (rough approximation)
  estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4);
  }

  // Generate document summary
  generateSummary(text: string, maxLength: number = 200): string {
    const cleaned = this.cleanText(text);

    if (cleaned.length <= maxLength) {
      return cleaned;
    }

    // Find a good break point near the max length
    const breakPoint = cleaned.lastIndexOf(".", maxLength);

    if (breakPoint > maxLength * 0.5) {
      return cleaned.slice(0, breakPoint + 1);
    }

    return cleaned.slice(0, maxLength) + "...";
  }
}

// Export singleton instance
export const documentProcessor = new DocumentProcessor();
