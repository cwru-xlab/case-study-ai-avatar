/**
 * CTA STORAGE SERVICE - CALL TO ACTION FEATURE
 * 
 * This service manages the Call to Action feature for the AI Avatar Kiosk.
 * It handles configuration storage, form submission tracking, and S3 integration.
 * 
 * Features:
 * - CTA configuration management (admin-configurable settings)
 * - Form submission storage and retrieval
 * - Email template processing
 * - Chat transcript integration
 * - Analytics and reporting data
 * 
 * Storage Structure:
 * - cta/config.json - CTA configuration settings
 * - cta/submissions/{submissionId}.json - Individual form submissions
 * - cta/index.json - Submission metadata index for fast querying
 * 
 * Follows the same patterns as avatar-storage.ts and chat-storage.ts for consistency.
 */

import { s3Storage } from "./s3-client";
import type { 
  CTAConfig, 
  CTASubmission, 
  CTAFormData, 
  EmailTemplateVars,
  ChatSession 
} from "@/types";

// S3 prefixes for CTA storage
const CTA_PREFIX = "cta/";
const CTA_CONFIG_FILE = `${CTA_PREFIX}config.json`;
const CTA_SUBMISSIONS_PREFIX = `${CTA_PREFIX}submissions/`;
const CTA_INDEX_FILE = `${CTA_PREFIX}index.json`;

/**
 * Default CTA Configuration
 * 
 * Provides sensible defaults for the CTA system.
 * Can be overridden through the admin portal.
 */
export const DEFAULT_CTA_CONFIG: CTAConfig = {
  id: "main",
  enabled: true,
  emailRecipients: ["xyzz@gmail.edu"], // Default to generic admin email,willchange the default to a more specific email
  qrCodeBaseUrl: process.env.NEXT_PUBLIC_BASE_URL || "", // Empty to auto-detect
  formTitle: "Connect with Weatherhead School of Management",
  formDescription: "Thank you for chatting with our AI avatar! Please share your details to continue the conversation and connect with our team.",
  submitButtonText: "Submit & Connect",
  successMessage: "Thank you! We'll be in touch soon. Check your email for confirmation.",
  emailSubject: "New Avatar Chat Connection Request - {{userName}}",
  emailTemplate: `Hello {{userName}},

Thank you for connecting with the Weatherhead School of Management through our AI Avatar system!

Here are the details of your submission:
- Name: {{userName}}
- Email: {{userEmail}}
- Message: {{userMessage}}
- Chat with: {{avatarName}}
- Date: {{submissionDate}}
- Session ID: {{sessionId}}

We will review your message and get back to you soon.

Best regards,
The Weatherhead School of Management Team`,
  maxMessageLength: 500,
  lastUpdated: new Date().toISOString(),
  updatedBy: "System"
};

/**
 * CTA Storage Service Class
 * 
 * Manages all CTA-related data operations including configuration,
 * form submissions, and email processing.
 */
class CTAStorage {
  
  /**
   * Get CTA Configuration
   * 
   * Retrieves the current CTA configuration from S3.
   * Returns default configuration if none exists.
   */
  async getConfig(): Promise<CTAConfig> {
    try {
      const { body } = await s3Storage.downloadFile(CTA_CONFIG_FILE);
      const content = new TextDecoder().decode(body);
      return JSON.parse(content) as CTAConfig;
    } catch (error) {
      console.log("CTA config not found, using defaults");
      // Return default config if file doesn't exist
      return DEFAULT_CTA_CONFIG;
    }
  }

  /**
   * Update CTA Configuration
   * 
   * Saves updated CTA configuration to S3.
   * Used by admin portal to update settings.
   */
  async updateConfig(config: Partial<CTAConfig>, updatedBy: string): Promise<CTAConfig> {
    // Get current config and merge with updates
    const currentConfig = await this.getConfig();
    const updatedConfig: CTAConfig = {
      ...currentConfig,
      ...config,
      lastUpdated: new Date().toISOString(),
      updatedBy
    };

    // Save to S3
    await this.saveConfigToS3(updatedConfig);
    
    console.log(`CTA config updated by ${updatedBy}`);
    return updatedConfig;
  }

  /**
   * Save Form Submission
   * 
   * Stores a new CTA form submission with complete metadata.
   * Includes chat session details and analytics data.
   */
  async saveSubmission(
    formData: CTAFormData,
    metadata: {
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<CTASubmission> {
    // Generate unique submission ID
    const submissionId = this.generateSubmissionId();
    
    // Get chat session details
    const chatSession = await s3Storage.getChatSession(formData.sessionId);
    if (!chatSession) {
      throw new Error(`Chat session ${formData.sessionId} not found`);
    }

    // Calculate chat duration
    const { startTime, endTime } = chatSession.metadata;
    const chatDuration = endTime - startTime;

    // Create submission object
    const submission: CTASubmission = {
      submissionId,
      sessionId: formData.sessionId,
      userDetails: {
        name: formData.name,
        email: formData.email,
        message: formData.message
      },
      metadata: {
        submittedAt: new Date().toISOString(),
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        avatarId: chatSession.metadata.avatarId,
        avatarName: chatSession.metadata.avatarName,
        messageCount: chatSession.metadata.messageCount,
        chatDuration
      },
      status: "pending",
      emailSent: false,
      createdAt: new Date().toISOString()
    };

    // Save submission to S3
    await this.saveSubmissionToS3(submission);
    
    // Update submission index
    await this.updateSubmissionIndex(submission);

    console.log(`CTA submission saved: ${submissionId}`);
    return submission;
  }

  /**
   * Save Form Submission with Session Data
   * 
   * Enhanced version that works with both active and saved sessions.
   * Accepts pre-validated session data to avoid duplicate lookups.
   */
  async saveSubmissionWithSessionData(
    formData: CTAFormData,
    metadata: {
      ipAddress?: string;
      userAgent?: string;
    },
    sessionData: {
      sessionId: string;
      avatarId: string;
      avatarName: string;
      messageCount: number;
      isActive: boolean;
    }
  ): Promise<CTASubmission> {
    // Generate unique submission ID
    const submissionId = this.generateSubmissionId();
    
    // For active sessions, we need to calculate duration differently
    let chatDuration = 0;
    if (!sessionData.isActive) {
      // For saved sessions, try to get actual duration from S3
      try {
        const chatSession = await s3Storage.getChatSession(formData.sessionId);
        if (chatSession) {
          const { startTime, endTime } = chatSession.metadata;
          chatDuration = endTime - startTime;
        }
      } catch (error) {
        console.log("Could not get saved session duration, using default");
      }
    } else {
      // For active sessions, estimate duration based on session start time
      const sessionTimestamp = parseInt(formData.sessionId.split('_')[0]);
      chatDuration = Date.now() - sessionTimestamp;
    }

    // Create submission object
    const submission: CTASubmission = {
      submissionId,
      sessionId: formData.sessionId,
      userDetails: {
        name: formData.name,
        email: formData.email,
        message: formData.message
      },
      metadata: {
        submittedAt: new Date().toISOString(),
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        avatarId: sessionData.avatarId,
        avatarName: sessionData.avatarName,
        messageCount: sessionData.messageCount,
        chatDuration
      },
      status: "pending",
      emailSent: false,
      createdAt: new Date().toISOString()
    };

    // Save submission to S3
    await this.saveSubmissionToS3(submission);
    
    // Update submission index
    await this.updateSubmissionIndex(submission);

    console.log(`CTA submission saved: ${submissionId} (${sessionData.isActive ? 'active' : 'saved'} session)`);
    return submission;
  }

  /**
   * Process Form Submission
   * 
   * Processes a pending submission by sending emails and updating status.
   * This is called after initial submission storage.
   */
  async processSubmission(submissionId: string): Promise<void> {
    const submission = await this.getSubmission(submissionId);
    if (!submission) {
      throw new Error(`Submission ${submissionId} not found`);
    }

    if (submission.status !== "pending") {
      console.log(`Submission ${submissionId} already processed`);
      return;
    }

    try {
      // Get configuration
      const config = await this.getConfig();
      
      if (!config.enabled) {
        throw new Error("CTA feature is disabled");
      }

      // Get chat session for transcript
      const chatSession = await s3Storage.getChatSession(submission.sessionId);
      if (!chatSession) {
        throw new Error(`Chat session ${submission.sessionId} not found`);
      }

      // Prepare email template variables
      const templateVars = await this.prepareEmailTemplateVars(submission, chatSession, config);

      // Send emails (implementation will be in email service)
      await this.sendNotificationEmails(submission, config, templateVars);

      // Update submission status
      submission.status = "processed";
      submission.emailSent = true;
      submission.processedAt = new Date().toISOString();

      await this.saveSubmissionToS3(submission);
      await this.updateSubmissionIndex(submission);

      console.log(`CTA submission processed: ${submissionId}`);
    } catch (error) {
      console.error(`Failed to process submission ${submissionId}:`, error);
      
      // Update submission with error
      submission.status = "failed";
      submission.errorMessage = error instanceof Error ? error.message : "Unknown error";
      submission.processedAt = new Date().toISOString();

      await this.saveSubmissionToS3(submission);
      await this.updateSubmissionIndex(submission);
      
      throw error;
    }
  }

  /**
   * Process Form Submission with Session Data
   * 
   * Enhanced version that works with both active and saved sessions.
   * Processes a pending submission by sending emails and updating status.
   */
  async processSubmissionWithSessionData(
    submissionId: string,
    sessionData: {
      sessionId: string;
      avatarId: string;
      avatarName: string;
      messageCount: number;
      isActive: boolean;
    }
  ): Promise<void> {
    const submission = await this.getSubmission(submissionId);
    if (!submission) {
      throw new Error(`Submission ${submissionId} not found`);
    }

    if (submission.status !== "pending") {
      console.log(`Submission ${submissionId} already processed`);
      return;
    }

    try {
      // Get configuration
      const config = await this.getConfig();
      
      if (!config.enabled) {
        throw new Error("CTA feature is disabled");
      }

      // Get or create chat session data for email templates
      let chatSession = null;
      if (!sessionData.isActive) {
        // For saved sessions, try to get the actual chat session
        try {
          chatSession = await s3Storage.getChatSession(submission.sessionId);
        } catch (error) {
          console.log("Could not fetch saved session, using metadata from submission");
        }
      }

      // Create template variables with available data
      const templateVars = await this.prepareEmailTemplateVarsWithSessionData(
        submission, 
        chatSession, 
        sessionData, 
        config
      );

      // Send emails
      await this.sendNotificationEmails(submission, config, templateVars);

      // Update submission status
      submission.status = "processed";
      submission.emailSent = true;
      submission.processedAt = new Date().toISOString();

      await this.saveSubmissionToS3(submission);
      await this.updateSubmissionIndex(submission);

      console.log(`CTA submission processed: ${submissionId} (${sessionData.isActive ? 'active' : 'saved'} session)`);
    } catch (error) {
      console.error(`Failed to process submission ${submissionId}:`, error);
      
      // Update submission with error
      submission.status = "failed";
      submission.errorMessage = error instanceof Error ? error.message : "Unknown error";
      submission.processedAt = new Date().toISOString();

      await this.saveSubmissionToS3(submission);
      await this.updateSubmissionIndex(submission);
      
      throw error;
    }
  }

  /**
   * Get Form Submission
   * 
   * Retrieves a specific form submission by ID.
   */
  async getSubmission(submissionId: string): Promise<CTASubmission | null> {
    try {
      const key = `${CTA_SUBMISSIONS_PREFIX}${submissionId}.json`;
      const { body } = await s3Storage.downloadFile(key);
      const content = new TextDecoder().decode(body);
      return JSON.parse(content) as CTASubmission;
    } catch (error) {
      console.error(`Failed to get submission ${submissionId}:`, error);
      return null;
    }
  }

  /**
   * List Form Submissions
   * 
   * Returns submission metadata with filtering and pagination.
   * Uses index file for efficient querying.
   */
  async listSubmissions(options?: {
    avatarId?: string;
    startDate?: Date;
    endDate?: Date;
    status?: CTASubmission["status"];
    limit?: number;
    offset?: number;
  }): Promise<{
    submissions: CTASubmission[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      // Read submission index
      const index = await this.readSubmissionIndex();
      
      // Apply filters
      let filteredSubmissions = index;

      if (options?.avatarId) {
        filteredSubmissions = filteredSubmissions.filter(
          sub => sub.metadata.avatarId === options.avatarId
        );
      }

      if (options?.status) {
        filteredSubmissions = filteredSubmissions.filter(
          sub => sub.status === options.status
        );
      }

      if (options?.startDate) {
        const startTime = options.startDate.getTime();
        filteredSubmissions = filteredSubmissions.filter(
          sub => new Date(sub.createdAt).getTime() >= startTime
        );
      }

      if (options?.endDate) {
        const endTime = options.endDate.getTime();
        filteredSubmissions = filteredSubmissions.filter(
          sub => new Date(sub.createdAt).getTime() <= endTime
        );
      }

      // Sort by creation date (newest first)
      filteredSubmissions.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // Apply pagination
      const total = filteredSubmissions.length;
      const offset = options?.offset || 0;
      const limit = options?.limit || 50;
      
      const paginatedSubmissions = filteredSubmissions.slice(offset, offset + limit);
      const hasMore = offset + limit < total;

      return {
        submissions: paginatedSubmissions,
        total,
        hasMore
      };
    } catch (error) {
      console.error("Failed to list submissions:", error);
      return {
        submissions: [],
        total: 0,
        hasMore: false
      };
    }
  }

  /**
   * Delete Form Submission
   * 
   * Removes a submission from S3 and updates the index.
   */
  async deleteSubmission(submissionId: string): Promise<void> {
    try {
      // Delete submission file
      const key = `${CTA_SUBMISSIONS_PREFIX}${submissionId}.json`;
      await s3Storage.deleteFile(key);

      // Update index
      let index = await this.readSubmissionIndex();
      index = index.filter(sub => sub.submissionId !== submissionId);
      await this.writeSubmissionIndex(index);

      console.log(`CTA submission deleted: ${submissionId}`);
    } catch (error) {
      console.error(`Failed to delete submission ${submissionId}:`, error);
      throw error;
    }
  }



  // Private helper methods

  private generateSubmissionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `cta_${timestamp}_${random}`;
  }

  private async saveConfigToS3(config: CTAConfig): Promise<void> {
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const s3Client = new S3Client({
      region: process.env.AWS_REGION || "us-east-2",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME!,
      Key: CTA_CONFIG_FILE,
      Body: JSON.stringify(config, null, 2),
      ContentType: "application/json",
    });

    await s3Client.send(command);
  }

  private async saveSubmissionToS3(submission: CTASubmission): Promise<void> {
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const s3Client = new S3Client({
      region: process.env.AWS_REGION || "us-east-2",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    const key = `${CTA_SUBMISSIONS_PREFIX}${submission.submissionId}.json`;
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME!,
      Key: key,
      Body: JSON.stringify(submission, null, 2),
      ContentType: "application/json",
    });

    await s3Client.send(command);
  }

  private async readSubmissionIndex(): Promise<CTASubmission[]> {
    try {
      const { body } = await s3Storage.downloadFile(CTA_INDEX_FILE);
      const content = new TextDecoder().decode(body);
      return JSON.parse(content) as CTASubmission[];
    } catch (error) {
      // Index file doesn't exist, return empty array
      return [];
    }
  }

  private async writeSubmissionIndex(index: CTASubmission[]): Promise<void> {
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const s3Client = new S3Client({
      region: process.env.AWS_REGION || "us-east-2",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME!,
      Key: CTA_INDEX_FILE,
      Body: JSON.stringify(index, null, 2),
      ContentType: "application/json",
    });

    await s3Client.send(command);
  }

  private async updateSubmissionIndex(submission: CTASubmission): Promise<void> {
    let index = await this.readSubmissionIndex();
    
    // Remove existing entry if it exists
    index = index.filter(sub => sub.submissionId !== submission.submissionId);
    
    // Add updated submission
    index.push(submission);
    
    // Sort by creation date (newest first)
    index.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    await this.writeSubmissionIndex(index);
  }

  private async prepareEmailTemplateVarsWithSessionData(
    submission: CTASubmission,
    chatSession: ChatSession | null,
    sessionData: {
      sessionId: string;
      avatarId: string;
      avatarName: string;
      messageCount: number;
      isActive: boolean;
    },
    config: CTAConfig
  ): Promise<EmailTemplateVars> {
    // Format chat duration
    const durationMs = submission.metadata.chatDuration;
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    const chatDuration = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

    // Prepare template variables
    const templateVars: EmailTemplateVars = {
      userName: submission.userDetails.name,
      userEmail: submission.userDetails.email,
      userMessage: submission.userDetails.message,
      avatarName: submission.metadata.avatarName,
      submissionDate: new Date(submission.metadata.submittedAt).toLocaleDateString(),
      sessionId: submission.sessionId,
      messageCount: submission.metadata.messageCount,
      chatDuration
    };


    return templateVars;
  }

  private async prepareEmailTemplateVars(
    submission: CTASubmission,
    chatSession: ChatSession,
    config: CTAConfig
  ): Promise<EmailTemplateVars> {
    // Format chat duration
    const durationMs = submission.metadata.chatDuration;
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    const chatDuration = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

    // Prepare template variables
    const templateVars: EmailTemplateVars = {
      userName: submission.userDetails.name,
      userEmail: submission.userDetails.email,
      userMessage: submission.userDetails.message,
      avatarName: submission.metadata.avatarName,
      submissionDate: new Date(submission.metadata.submittedAt).toLocaleDateString(),
      sessionId: submission.sessionId,
      messageCount: submission.metadata.messageCount,
      chatDuration
    };

    // Chat transcript removed per user requirement - not including in emails

    return templateVars;
  }

  private async sendNotificationEmails(
    submission: CTASubmission,
    config: CTAConfig,
    templateVars: EmailTemplateVars
  ): Promise<void> {
    try {
      // Import email service
      const { emailService } = await import("./email-service");
      
      // Send emails to both user and admin
      const emailResults = await emailService.sendCTANotificationEmails(
        submission.userDetails.email,
        config.emailRecipients,
        config,
        templateVars
      );

      // Log email results
      if (!emailResults.userEmailResult.success) {
        console.error("Failed to send user email:", emailResults.userEmailResult.error);
        throw new Error(`User email failed: ${emailResults.userEmailResult.error}`);
      }

      if (!emailResults.adminEmailResult.success) {
        console.error("Failed to send admin email:", emailResults.adminEmailResult.error);
        // Don't throw error for admin email failure - user confirmation is more important
        console.warn("Admin email failed but user email succeeded");
      }

      console.log("CTA notification emails sent successfully", {
        submissionId: submission.submissionId,
        userEmailId: emailResults.userEmailResult.messageId,
        adminEmailId: emailResults.adminEmailResult.messageId
      });

    } catch (error) {
      console.error("Failed to send notification emails:", error);
      throw new Error("Email delivery failed");
    }
  }
}

/**
 * Export Singleton Instance
 * 
 * Follows the same pattern as other storage services.
 */
export const ctaStorage = new CTAStorage();