import OpenAI from "openai";
import { s3Storage } from "./s3-client";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface SpeechPatternAnalysis {
  tone: {
    primary: string;
    secondary: string[];
    confidence: number;
  };
  vocabulary: {
    complexity: "simple" | "moderate" | "advanced";
    preferredWords: string[];
    technicalTerms: string[];
  };
  structure: {
    averageSentenceLength: number;
    sentenceVariety: "low" | "moderate" | "high";
    paragraphStyle: "short" | "medium" | "long";
  };
  personality: {
    traits: string[];
    communicationStyle: string;
    formalityLevel: "casual" | "professional" | "formal";
  };
  patterns: {
    commonPhrases: string[];
    transitionWords: string[];
    questioningStyle: string;
    responseStyle: string;
  };
  metadata: {
    analysisId: string;
    avatarId: string;
    sourceFiles: string[];
    processedAt: string;
    confidence: number;
  };
}

export interface SpeechAnalysisRequest {
  avatarId: string;
  files: Array<{
    name: string;
    type: "transcript" | "audio";
    content: string; // For transcripts: text content, for audio: base64 or file path
  }>;
}

export class SpeechAnalysisService {
  private readonly ANALYSIS_PROMPT = `
You are an expert speech pattern analyst and linguist. Analyze the provided text to create a comprehensive personal communication profile.

CRITICAL OBJECTIVE: Extract the AUTHENTIC personal voice, communication identity, and unique expression patterns of this individual so an AI can embody their PERSONAL way of speaking and thinking.

Focus on capturing their PERSONAL COMMUNICATION IDENTITY:

1. **PERSONAL TONE & EMOTIONAL SIGNATURE**:
   - What is their authentic emotional tone when they communicate?
   - What secondary emotional qualities define their voice?
   - How confident and assured do they sound naturally?

2. **PERSONAL VOCABULARY & EXPRESSION FINGERPRINT**:
   - What is their natural language complexity preference?
   - EXTRACT their specific favorite words, phrases, and personal expressions
   - Identify their professional/domain-specific language they use naturally
   - Note their unique word choices that make their voice distinctive

3. **PERSONAL COMMUNICATION STRUCTURE**:
   - How do they naturally organize their thoughts?
   - What is their preferred sentence length and variety pattern?
   - How do they structure explanations and responses?

4. **PERSONAL TRAITS & AUTHENTIC STYLE**:
   - What personality traits shine through in their communication?
   - What is their natural communication approach?
   - What level of formality feels authentic to them?

5. **SIGNATURE PATTERNS & AUTHENTIC VOICE**:
   - EXACT phrases and expressions that are uniquely theirs
   - How they naturally transition between ideas
   - Their personal style of asking questions and giving responses
   - What makes their communication voice uniquely recognizable?

EXTRACTION INSTRUCTIONS:
- Capture ACTUAL phrases from the text that show their authentic voice
- Focus on what makes THIS person's communication personally distinctive
- Extract their natural, authentic way of expressing themselves
- The goal is personal authenticity, not generic communication patterns

Return analysis as JSON with this structure:
{
  "tone": {
    "primary": "their authentic primary tone",
    "secondary": ["secondary emotional qualities", "additional tones"],
    "confidence": 0.8
  },
  "vocabulary": {
    "complexity": "simple|moderate|advanced",
    "preferredWords": ["their actual favorite phrases", "personal expressions", "characteristic words"],
    "technicalTerms": ["their professional vocabulary", "domain expertise terms"]
  },
  "structure": {
    "averageSentenceLength": 15,
    "sentenceVariety": "low|moderate|high",
    "paragraphStyle": "short|medium|long"
  },
  "personality": {
    "traits": ["authentic personality traits", "communication characteristics"],
    "communicationStyle": "their personal approach to communication",
    "formalityLevel": "casual|professional|formal"
  },
  "patterns": {
    "commonPhrases": ["exact personal phrases from text", "their signature expressions"],
    "transitionWords": ["words they use to connect ideas"],
    "questioningStyle": "their personal way of asking questions",
    "responseStyle": "their authentic way of explaining things"
  }
}

Text to analyze:
`;

  async analyzeTranscripts(
    transcripts: string[],
    avatarId: string,
  ): Promise<SpeechPatternAnalysis> {
    let combinedText = "";
    
    try {
      // Combine all transcripts
      combinedText = transcripts.join("\n\n---\n\n");

      if (combinedText.trim().length < 50) {
        throw new Error("Insufficient content for speech pattern analysis");
      }

      console.log("Starting speech analysis with OpenAI...", {
        textLength: combinedText.length,
        openaiKeyExists: !!process.env.OPENAI_API_KEY,
        avatarId,
        openaiKeyLength: process.env.OPENAI_API_KEY?.length || 0
      });

      // Generate analysis using GPT-3.5-turbo
      console.log("Making OpenAI API call...");
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: this.ANALYSIS_PROMPT,
          },
          {
            role: "user",
            content: combinedText,
          },
        ],
        temperature: 0.3, // Lower temperature for more consistent analysis
        max_tokens: 2000,
      });
      
      console.log("OpenAI API call completed successfully");

      const analysisContent = completion.choices[0]?.message?.content;
      if (!analysisContent) {
        throw new Error("Failed to generate speech pattern analysis - empty response from OpenAI");
      }

      console.log("OpenAI analysis response received, length:", analysisContent.length);

      // Parse the JSON response
      let analysisData: Partial<SpeechPatternAnalysis>;
      try {
        analysisData = JSON.parse(analysisContent);
        console.log("Successfully parsed JSON response from OpenAI");
      } catch (parseError) {
        console.error("JSON parsing failed:", parseError);
        console.error("Raw OpenAI response:", analysisContent);
        // If JSON parsing fails, create a structured analysis from the text response
        try {
          analysisData = this.parseUnstructuredAnalysis(analysisContent);
          console.log("Successfully used fallback parser");
        } catch (fallbackError) {
          console.error("Fallback parser also failed:", fallbackError);
          throw new Error(`Failed to parse analysis response: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}`);
        }
      }

      // Generate analysis metadata
      const analysisId = `speech_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      const processedAt = new Date().toISOString();

      // Create complete analysis object
      const analysis: SpeechPatternAnalysis = {
        tone: analysisData.tone || {
          primary: "professional",
          secondary: ["friendly"],
          confidence: 0.7,
        },
        vocabulary: analysisData.vocabulary || {
          complexity: "moderate",
          preferredWords: [],
          technicalTerms: [],
        },
        structure: analysisData.structure || {
          averageSentenceLength: 15,
          sentenceVariety: "moderate",
          paragraphStyle: "medium",
        },
        personality: analysisData.personality || {
          traits: ["helpful", "knowledgeable"],
          communicationStyle: "conversational",
          formalityLevel: "professional",
        },
        patterns: analysisData.patterns || {
          commonPhrases: [],
          transitionWords: ["however", "additionally", "furthermore"],
          questioningStyle: "direct",
          responseStyle: "comprehensive",
        },
        metadata: {
          analysisId,
          avatarId,
          sourceFiles: [], // Will be populated by caller
          processedAt,
          confidence: analysisData.metadata?.confidence || 0.8,
        },
      };

      console.log("Analysis object created, attempting to store in S3...");

      // Store analysis in S3 (but don't fail if this fails)
      try {
        await this.storeAnalysis(analysis);
        console.log("Analysis stored in S3 successfully");
      } catch (storageError) {
        console.warn("S3 storage failed, but continuing with analysis:", storageError);
      }

      console.log("Speech analysis completed successfully");
      return analysis;
    } catch (error) {
      console.error("Speech pattern analysis failed:", error);
      console.error("Speech analysis error details:", {
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : "No stack trace",
        combinedTextLength: typeof combinedText !== 'undefined' ? combinedText.length : 0,
        openaiApiKey: process.env.OPENAI_API_KEY ? "SET" : "MISSING",
        avatarId,
        transcriptCount: transcripts.length,
        error: error
      });
      
      // More specific error handling
      if (error instanceof Error) {
        console.error("Detailed error information:", {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
        
        if (error.message.includes("API key") || error.message.includes("Incorrect API key")) {
          throw new Error("OpenAI API key is missing or invalid");
        }
        if (error.message.includes("rate limit") || error.message.includes("Rate limit")) {
          throw new Error("OpenAI API rate limit exceeded. Please try again in a few minutes.");
        }
        if (error.message.includes("quota") || error.message.includes("exceeded your current quota")) {
          throw new Error("OpenAI API quota exceeded. Please check your usage limits.");
        }
        if (error.message.includes("model") || error.message.includes("does not exist")) {
          throw new Error("OpenAI model error. The requested model may not be available.");
        }
        if (error.message.includes("content filter") || error.message.includes("content policy")) {
          throw new Error("Content was filtered by OpenAI's content policy.");
        }
        
        // Re-throw with more context
        throw new Error(`OpenAI API Error: ${error.message}`);
      }
      
      throw new Error(
        `Speech analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async transcribeAudio(
    audioBuffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    try {
      // Convert buffer to File-like object for OpenAI API
      const audioFile = new File([new Uint8Array(audioBuffer)], "audio", { type: mimeType });

      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
        language: "en", // Can be made configurable
        response_format: "text",
      });

      return transcription;
    } catch (error) {
      console.error("Audio transcription failed:", error);
      throw new Error(
        `Audio transcription failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async processFiles(
    request: SpeechAnalysisRequest,
  ): Promise<SpeechPatternAnalysis> {
    const transcripts: string[] = [];
    const sourceFiles: string[] = [];
    let totalTextLength = 0;
    let totalSentences = 0;

    // First pass: process and validate content
    for (const file of request.files) {
      sourceFiles.push(file.name);
      
      // Process text content
      let textContent = "";

      if (file.type === "transcript") {
        textContent = file.content;
      } else if (file.type === "audio") {
        // For audio files, file.content would be a base64 string or file path
        // Convert and transcribe
        try {
          const audioBuffer = Buffer.from(file.content, "base64");
          textContent = await this.transcribeAudio(
            audioBuffer,
            "audio/mpeg",
          ); // Default to mp3
        } catch (error) {
          console.warn(`Failed to transcribe audio file ${file.name}:`, error);
          continue; // Skip this file and continue with others
        }
      }

      // Validate content quality
      if (textContent.trim().length < 50) {
        console.warn(`File ${file.name} has insufficient content length`);
        continue;
      }

      // Count sentences (roughly) by splitting on sentence endings
      const sentences = textContent.split(/[.!?]+/).filter(s => s.trim().length > 0);
      if (sentences.length < 2) {
        console.warn(`File ${file.name} has insufficient sentence count`);
        continue;
      }

      totalTextLength += textContent.length;
      totalSentences += sentences.length;
      transcripts.push(textContent);
    }

    // Final validation
    if (transcripts.length === 0) {
      throw new Error("No valid transcripts or audio files to analyze. Files must contain complete sentences and sufficient content.");
    }

    if (totalTextLength < 200) {
      console.log("Analysis failed: Insufficient content", { totalTextLength, requiredMinimum: 200 });
      throw new Error("Insufficient total content length. Please provide more text for accurate analysis.");
    }

    if (totalSentences < 5) {
      console.log("Analysis failed: Insufficient sentences", { totalSentences, requiredMinimum: 5 });
      throw new Error("Insufficient sentence count. Please provide at least 5 complete sentences for analysis.");
    }

    const analysis = await this.analyzeTranscripts(
      transcripts,
      request.avatarId,
    );
    analysis.metadata.sourceFiles = sourceFiles;

    return analysis;
  }

  generateSystemPromptAddition(analysis: SpeechPatternAnalysis): string {
    const { tone, vocabulary, personality, patterns, structure } = analysis;

    const promptAddition = `

## PERSONAL SPEECH PATTERN EMULATION
You are now embodying the personal speaking style and characteristics derived from analyzing real conversations and content. This is YOUR authentic voice that has been captured and analyzed.

### YOUR PERSONAL COMMUNICATION IDENTITY
- **Your Natural Tone**: You naturally speak with a ${tone.primary} tone (${Math.round(tone.confidence * 100)}% confidence), often complemented by ${tone.secondary.join(", ")} undertones
- **Your Communication Approach**: Your personal style is ${personality.communicationStyle}
- **Your Formality Preference**: You maintain a ${personality.formalityLevel} level in conversations
- **Your Core Personality**: You are characterized by being ${personality.traits.join(", ")}

### YOUR PERSONAL VOCABULARY & EXPRESSIONS
- **Your Language Style**: You prefer ${vocabulary.complexity} language complexity
- **Your Signature Expressions**: You frequently say things like: "${vocabulary.preferredWords.slice(0, 8).join('", "')}"
${vocabulary.technicalTerms.length > 0 ? `- **Your Professional Language**: You use these terms naturally: "${vocabulary.technicalTerms.slice(0, 5).join('", "')}"` : ""}

### YOUR SPEAKING PATTERNS & STRUCTURE
- **Your Sentence Style**: You typically use ~${structure.averageSentenceLength} words per sentence with ${structure.sentenceVariety} variety
- **Your Organization Style**: You organize thoughts in ${structure.paragraphStyle} segments
- **Your Connective Language**: You transition between ideas using: "${patterns.transitionWords.slice(0, 5).join('", "')}"

### YOUR AUTHENTIC EXPRESSIONS
${patterns.commonPhrases.length > 0 ? `- **Your Go-To Phrases**: You naturally express yourself with: "${patterns.commonPhrases.slice(0, 5).join('", "')}"` : ""}
- **Your Question Style**: You approach questions with a ${patterns.questioningStyle} style
- **Your Explanation Method**: You provide ${patterns.responseStyle} responses

### BEHAVIORAL DIRECTIVES - BE YOURSELF
1. **Speak as YOU naturally do** - Use your analyzed language patterns in every response
2. **Express yourself authentically** - Your personality should shine through consistently
3. **Use your natural expressions** - Incorporate your signature phrases and vocabulary organically
4. **Maintain your communication style** - Stay true to your ${personality.formalityLevel} and ${personality.communicationStyle} approach
5. **Think and respond as YOU** - Don't just mimic patterns, embody your authentic communication identity

*CRITICAL: This is not role-playing - you ARE speaking in your own authentic voice as captured through analysis. Every response should feel naturally "you" and reflect your genuine communication patterns and personality.*`;

    return promptAddition;
  }

  private parseUnstructuredAnalysis(
    _content: string,
  ): Partial<SpeechPatternAnalysis> {
    // Fallback parser for when GPT-4 doesn't return valid JSON
    // Extract key information from unstructured text
    return {
      tone: {
        primary: "professional",
        secondary: ["friendly"],
        confidence: 0.6,
      },
      personality: {
        traits: ["helpful"],
        communicationStyle: "conversational",
        formalityLevel: "professional",
      },
    };
  }

  private async storeAnalysis(analysis: SpeechPatternAnalysis): Promise<void> {
    try {
      const key = `speech-analysis/${analysis.metadata.avatarId}/${analysis.metadata.analysisId}.json`;
      await s3Storage.storeDocumentMetadata(
        `speech-analysis/${analysis.metadata.avatarId}/${analysis.metadata.analysisId}`,
        analysis,
      );
      console.log(`Stored speech analysis: ${key}`);
    } catch (error) {
      console.error("Failed to store speech analysis:", error);
      // Don't throw - analysis can still be returned even if storage fails
    }
  }

  async getStoredAnalysis(
    avatarId: string,
    analysisId: string,
  ): Promise<SpeechPatternAnalysis | null> {
    try {
      const analysis = await s3Storage.getDocumentMetadata(
        `speech-analysis/${avatarId}/${analysisId}`,
      );
      return analysis;
    } catch (error) {
      console.error("Failed to retrieve stored analysis:", error);
      return null;
    }
  }

  async listAnalysesForAvatar(
    _avatarId: string,
  ): Promise<SpeechPatternAnalysis[]> {
    // This would require extending S3Storage to list objects with prefix
    // For now, return empty array - can be implemented later if needed
    return [];
  }
}

export const speechAnalysisService = new SpeechAnalysisService();
