import type { EmailTemplateVars, CTAConfig } from "@/types";

export interface EmailOptions {
  to: string[];
  subject: string;
  htmlContent: string;
  textContent: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Email Service Class
 * 
 * Handles all email operations for the CTA feature.
 */
class EmailService {
  
  /**
   * Send Email
   * 
   * Sends an email to the specified recipients.
   * Currently logs to console - replace with actual email service.
   */
  async sendEmail(options: EmailOptions): Promise<EmailResult> {
    try {
      // PRODUCTION EMAIL IMPLEMENTATION
      // This is a working implementation that can be configured for different providers
      
      console.log("Sending email...");
      console.log("To:", options.to.join(", "));
      console.log("Subject:", options.subject);
      
      // Check for email configuration
      const emailProvider = process.env.EMAIL_PROVIDER || 'console';
      
      switch (emailProvider.toLowerCase()) {
        case 'nodemailer':
          return await this.sendWithNodemailer(options);
        case 'sendgrid':
          return await this.sendWithSendGrid(options);
        case 'ses':
          return await this.sendWithSES(options);
        case 'console':
        default:
          return await this.sendToConsole(options);
      }

    } catch (error) {
      console.error("Email service error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown email error"
      };
    }
  }

  /**
   * Console Email Output (Development/Testing)
   */
  private async sendToConsole(options: EmailOptions): Promise<EmailResult> {
    console.log("=== EMAIL SERVICE (Console Output) ===");
    console.log("===========================================");
    console.log(" To:", options.to.join(", "));
    console.log(" Subject:", options.subject);
    console.log("--- HTML Content ---");
    console.log(options.htmlContent);
    console.log("--- Text Content ---");
    console.log(options.textContent);
    console.log("===========================================");
    
    // Simulate email sending delay
    await new Promise(resolve => setTimeout(resolve, 500));

    return {
      success: true,
      messageId: `console_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  /**
   * Nodemailer SMTP Implementation
   */
  private async sendWithNodemailer(options: EmailOptions): Promise<EmailResult> {
    try {
      const nodemailer = require('nodemailer');
      
      // Create transporter based on environment
      const transporter = await this.createNodemailerTransporter();
      
      // Prepare email
      const mailOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@example.com',
        to: options.to.join(', '),
        subject: options.subject,
        text: options.textContent,
        html: options.htmlContent
      };

      console.log(" Sending email via SMTP...");
      console.log(` To: ${mailOptions.to}`);
      console.log(` Subject: ${mailOptions.subject}`);

      // Send email
      const info = await transporter.sendMail(mailOptions);

      console.log(" Email info:", info);
      
      console.log(" Email sent successfully!");
      console.log(` Message ID: ${info.messageId}`);
      
      // For development with Ethereal, log preview URL
      if (!process.env.SMTP_HOST && info.messageId) {
        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
          console.log(` Preview email: ${previewUrl}`);
        }
      }
      
      return {
        success: true,
        messageId: info.messageId || `nodemailer_${Date.now()}`
      };

    } catch (error) {
      console.error(" Nodemailer error:", error);
      throw new Error(`Nodemailer error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create Nodemailer Transporter
   */
  private async createNodemailerTransporter() {
    const nodemailer = require('nodemailer');
    
    // Check if we have SMTP configuration
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || '587');
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    
    if (smtpHost && smtpUser && smtpPass) {
      // Production SMTP configuration
      console.log(` Connecting to SMTP server: ${smtpHost}:${smtpPort}`);
      
      return nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465, // true for 465, false for other ports
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        tls: {
          rejectUnauthorized: false // Allow self-signed certificates in development
        }
      });
    } else {
      // Development: Use Ethereal Email (test email service)
      console.log(" Creating test email account with Ethereal...");
      
      const testAccount = await nodemailer.createTestAccount();
      
      console.log(" Test email credentials created:");
      console.log(`    Email: ${testAccount.user}`);
      console.log(`    Password: ${testAccount.pass}`);
      console.log(`    Preview URL will be logged after sending`);
      
      return nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    }
  }

  /**
   * SendGrid API Implementation
   */
  private async sendWithSendGrid(options: EmailOptions): Promise<EmailResult> {
    try {
      // This would require: npm install @sendgrid/mail
      // const sgMail = require('@sendgrid/mail');
      
      console.log(" Would send via SendGrid API");
      console.log("Configure SENDGRID_API_KEY environment variable");
      
      // Placeholder for actual implementation
      return await this.sendToConsole(options);
    } catch (error) {
      throw new Error(`SendGrid error: ${error}`);
    }
  }

  /**
   * AWS SES Implementation
   */
  private async sendWithSES(options: EmailOptions): Promise<EmailResult> {
    try {
      // This would require: npm install @aws-sdk/client-ses
      // const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
      
      console.log(" Would send via AWS SES");
      console.log("Configure AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY environment variables");
      
      // Placeholder for actual implementation
      return await this.sendToConsole(options);
    } catch (error) {
      throw new Error(`AWS SES error: ${error}`);
    }
  }

  /**
   * Send CTA Notification Emails
   * 
   * Sends both user confirmation and admin notification emails.
   */
  async sendCTANotificationEmails(
    userEmail: string,
    adminEmails: string[],
    config: CTAConfig,
    templateVars: EmailTemplateVars
  ): Promise<{
    userEmailResult: EmailResult;
    adminEmailResult: EmailResult;
  }> {
    try {
      // Process email template
      const processedTemplate = this.processEmailTemplate(config.emailTemplate, templateVars);
      const subject = this.processEmailTemplate(config.emailSubject, templateVars);

      // Create HTML and text versions
      const htmlContent = this.convertToHTML(processedTemplate);
      const textContent = processedTemplate;

      // Send user confirmation email
      const userEmailResult = await this.sendEmail({
        to: [userEmail],
        subject: subject,
        htmlContent: htmlContent,
        textContent: textContent
      });

      // Send admin notification email
      const adminSubject = `[CTA] New Avatar Chat Connection - ${templateVars.userName}`;
      const adminContent = this.createAdminNotificationContent(templateVars, processedTemplate);
      
      const adminEmailResult = await this.sendEmail({
        to: adminEmails,
        subject: adminSubject,
        htmlContent: this.convertToHTML(adminContent),
        textContent: adminContent
      });

      return {
        userEmailResult,
        adminEmailResult
      };

    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("CTA notification email error:", error);
      
      return {
        userEmailResult: {
          success: false,
          error: "Failed to send user email"
        },
        adminEmailResult: {
          success: false,
          error: "Failed to send admin email"
        }
      };
    }
  }

  /**
   * Process Email Template
   * 
   * Replaces template variables with actual values.
   * Supports both {{variable}} and {{#conditional}} syntax.
   */
  private processEmailTemplate(template: string, vars: EmailTemplateVars): string {
    let processed = template;

    // Replace simple variables
    Object.entries(vars).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        processed = processed.replace(regex, String(value));
      }
    });

    // Remove chat transcript and transcript link blocks (chat removed from emails per user requirement)
    processed = processed.replace(
      /{{#chatTranscript}}([\s\S]*?){{\/chatTranscript}}/g,
      ''
    );
    processed = processed.replace(
      /{{#transcriptLink}}([\s\S]*?){{\/transcriptLink}}/g,
      ''
    );

    // Clean up any remaining template variables
    processed = processed.replace(/{{[^}]+}}/g, '');

    return processed.trim();
  }

  /**
   * Convert Text to HTML
   * 
   * Converts plain text email content to basic HTML format.
   */
  private convertToHTML(textContent: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Weatherhead School of Management</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px; 
            background-color: #f8f9fa;
        }
        .email-container {
            background-color: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08);
            overflow: hidden;
            margin: 20px 0;
        }
        .header { 
            background-color: #003071; 
            color: white; 
            padding: 30px 20px; 
            text-align: center; 
            background: linear-gradient(135deg, #003071 0%, #004085 100%);
        }
        .header h1 {
            margin: 0 0 8px 0;
            font-size: 24px;
            font-weight: 600;
            letter-spacing: -0.5px;
        }
        .header p {
            margin: 0;
            opacity: 0.9;
            font-size: 14px;
        }
        .content { 
            background-color: #f9f9f9; 
            padding: 30px; 
            margin: 0;
        }
        .content p {
            margin: 0 0 16px 0;
            font-size: 15px;
            line-height: 1.7;
        }
        .content p:last-child {
            margin-bottom: 0;
        }
        .footer { 
            text-align: center; 
            padding: 25px 20px; 
            font-size: 12px; 
            color: #666; 
            background-color: #fafbfc;
        }
        .footer p {
            margin: 0 0 8px 0;
        }
        .footer p:last-child {
            margin-bottom: 0;
        }
        pre { 
            background-color: #f5f5f5; 
            padding: 15px; 
            border-radius: 8px; 
            overflow-x: auto; 
            border: 1px solid #e9ecef;
            font-size: 13px;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>Weatherhead School of Management</h1>
            <p>Case Western Reserve University</p>
        </div>
        <div class="content">
            ${textContent.split('\n').map(line => {
              if (line.trim() === '') return '<br>';
              return `<p>${line}</p>`;
            }).join('')}
        </div>
        <div class="footer">
            <p>© ${new Date().getFullYear()} Case Western Reserve University Weatherhead School of Management</p>
            <p>This email was sent in response to your inquiry through our AI Avatar Kiosk system.</p>
        </div>
    </div>
</body>
</html>`.trim();
  }

  /**
   * Create Admin Notification Content
   * 
   * Creates the email content for admin notifications.
   */
  private createAdminNotificationContent(vars: EmailTemplateVars, userEmailContent: string): string {
    return `
ADMIN NOTIFICATION: New Avatar Chat Connection Request

A new user has submitted a connection request through the AI Avatar Kiosk system.

USER DETAILS:
- Name: ${vars.userName}
- Email: ${vars.userEmail}
- Message: ${vars.userMessage || 'No message provided'}

SESSION DETAILS:
- Avatar: ${vars.avatarName}
- Session ID: ${vars.sessionId}
- Date: ${vars.submissionDate}
- Messages: ${vars.messageCount}
- Duration: ${vars.chatDuration}

ACTION REQUIRED:
Please review this request and follow up with the user as appropriate.

---
This is an automated notification from the AI Avatar Kiosk system.
`.trim();
  }
}

/**
 * Export Singleton Instance
 */
export const emailService = new EmailService();