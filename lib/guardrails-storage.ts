/**
 * Database storage service for guardrails configuration
 * Stores guardrails settings in AWS S3 as JSON (following existing pattern)
 */

import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

// S3 client configuration (following existing pattern)
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME!;
const GUARDRAILS_CONFIG_KEY = 'system/guardrails-config.json';

export interface GuardrailsConfig {
  blockedTopics: string[];
  mentalHealthTopics: string[];
  blockedResponses: string[];
  mentalHealthResources: {
    counselingPhone: string;
    crisisLine: string;
    additionalInfo: string;
  };
  lastUpdated: string;
  updatedBy: string;
}

// Default configuration - single source of truth
export const DEFAULT_GUARDRAILS_CONFIG: GuardrailsConfig = {
  blockedTopics: [
    'politics', 'political', 'election', 'vote', 'republican', 'democrat', 'conservative', 'liberal',
    'suicide', 'self-harm', 'mental health crisis',
    'drugs', 'alcohol', 'party', 'dating', 'relationship', 'sex', 'sexual',
    'religion', 'religious', 'god', 'church', 'faith', 'belief',
    'write my essay', 'do my homework', 'write my paper', 'plagiarize'
  ],
  mentalHealthTopics: [
    'depression', 'anxiety', 'stress', 'mental health', 'counseling', 'therapy'
  ],
  blockedResponses: [
    "I'm here to help with questions about CWRU and Weatherhead School. Is there something about academics, campus life, or school programs I can help you with?",
    "I focus on providing information about Case Western Reserve University and the Weatherhead School. What can I tell you about our programs or campus?",
    "Let's keep our conversation focused on CWRU and academic topics. What would you like to know about the university or Weatherhead School?"
  ],
  mentalHealthResources: {
    counselingPhone: "216-368-5872",
    crisisLine: "988",
    additionalInfo: "Student support services available through Student Affairs"
  },
  lastUpdated: new Date().toISOString(),
  updatedBy: "System"
};

class GuardrailsStorage {
  /**
   * Get current guardrails configuration
   */
  async getConfig(): Promise<GuardrailsConfig> {
    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: GUARDRAILS_CONFIG_KEY,
      });

      const result = await s3Client.send(command);
      if (result.Body) {
        const configData = JSON.parse(await result.Body.transformToString());
        return configData;
      }
      
      // If no config exists, return default and save it
      await this.saveConfig(DEFAULT_GUARDRAILS_CONFIG);
      return DEFAULT_GUARDRAILS_CONFIG;
    } catch (error: any) {
      if (error.name === 'NoSuchKey') {
        // Config doesn't exist, create default
        await this.saveConfig(DEFAULT_GUARDRAILS_CONFIG);
        return DEFAULT_GUARDRAILS_CONFIG;
      }
      console.error('Error loading guardrails config:', error);
      throw new Error('Failed to load guardrails configuration');
    }
  }

  /**
   * Save guardrails configuration
   */
  async saveConfig(config: GuardrailsConfig): Promise<void> {
    try {
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: GUARDRAILS_CONFIG_KEY,
        Body: JSON.stringify(config, null, 2),
        ContentType: 'application/json',
      });

      await s3Client.send(command);
    } catch (error) {
      console.error('Error saving guardrails config:', error);
      throw new Error('Failed to save guardrails configuration');
    }
  }

  /**
   * Update specific parts of the configuration
   */
  async updateConfig(updates: Partial<GuardrailsConfig>, updatedBy: string = 'Unknown'): Promise<GuardrailsConfig> {
    const currentConfig = await this.getConfig();
    const updatedConfig: GuardrailsConfig = {
      ...currentConfig,
      ...updates,
      lastUpdated: new Date().toISOString(),
      updatedBy,
    };

    await this.saveConfig(updatedConfig);
    return updatedConfig;
  }

  /**
   * Reset configuration to defaults
   */
  async resetToDefaults(updatedBy: string = 'Unknown'): Promise<GuardrailsConfig> {
    const defaultConfig: GuardrailsConfig = {
      ...DEFAULT_GUARDRAILS_CONFIG,
      lastUpdated: new Date().toISOString(),
      updatedBy,
    };

    await this.saveConfig(defaultConfig);
    return defaultConfig;
  }
}

// Export singleton instance
export const guardrailsStorage = new GuardrailsStorage();