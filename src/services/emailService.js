const { Resend } = require('resend');

class EmailService {
  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY || 're_8YGrgcBt_7nZiXcKiNP5drZxH63rGRtC8');
    this.defaultFrom = 'noreply@suatalk.site';
    this.isInitialized = false;
  }

  /**
   * Initialize the email service and validate configuration
   */
  async initialize() {
    try {
      // Test the API key by attempting to get domains (this will validate the key)
      // For now, we'll just mark as initialized since we can't test without domain setup
      this.isInitialized = true;
      console.log('✅ Email service initialized with Resend API');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize email service:', error.message);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Send a basic email
   * @param {Object} emailData - Email data
   * @param {string} emailData.to - Recipient email address
   * @param {string} emailData.subject - Email subject
   * @param {string} emailData.html - HTML content
   * @param {string} emailData.text - Plain text content (optional)
   * @param {string} emailData.from - Sender email (optional, uses default)
   * @param {Object} emailData.headers - Additional headers (optional)
   * @returns {Promise<Object>} Email sending result
   */
  async sendEmail({ to, subject, html, text = null, from = null, headers = {} }) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const emailOptions = {
        from: from || this.defaultFrom,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        headers: {
          'X-Mailer': 'SuaTalk-Backend',
          ...headers
        }
      };

      // Add text version if provided
      if (text) {
        emailOptions.text = text;
      }

      console.log(`📧 Sending email to: ${emailOptions.to.join(', ')} | Subject: ${subject}`);
      
      const { data, error } = await this.resend.emails.send(emailOptions);

      // If Resend returns an error object, log it and propagate failure
      if (error) {
        console.error('❌ Resend API error:', JSON.stringify(error));
        return {
          success: false,
          error,
          message: error?.message || 'Failed to send email'
        };
      }

      console.log(`✅ Email sent successfully | ID: ${data?.id}`);
      
      return {
        success: true,
        id: data?.id,
        message: 'Email sent successfully',
        data
      };

    } catch (error) {
      console.error('❌ Failed to send email:', error.message);
      
      return {
        success: false,
        error: error.message,
        message: 'Failed to send email'
      };
    }
  }

  /**
   * Send OTP verification email
   * @param {string} to - Recipient email
   * @param {string} otpCode - OTP code
   * @param {string} userName - User name (optional)
   * @returns {Promise<Object>} Email sending result
   */
  async sendOTPEmail(to, otpCode, userName = 'User') {
    const subject = 'SuaTalk - Email Verification Code';
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Email Verification</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              margin: 0;
              padding: 20px;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background: rgba(255, 255, 255, 0.95);
              backdrop-filter: blur(10px);
              border-radius: 20px;
              border: 1px solid rgba(255, 255, 255, 0.2);
              box-shadow: 0 8px 32px rgba(31, 38, 135, 0.37);
              padding: 40px;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .logo {
              font-size: 28px;
              font-weight: bold;
              color: #667eea;
              margin-bottom: 10px;
            }
            .otp-box {
              background: rgba(102, 126, 234, 0.1);
              border: 2px dashed #667eea;
              border-radius: 15px;
              padding: 25px;
              text-align: center;
              margin: 30px 0;
            }
            .otp-code {
              font-size: 36px;
              font-weight: bold;
              letter-spacing: 8px;
              color: #667eea;
              font-family: 'Courier New', monospace;
            }
            .footer {
              text-align: center;
              font-size: 14px;
              color: #666;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid rgba(102, 126, 234, 0.2);
            }
            .warning {
              background: rgba(255, 193, 7, 0.1);
              border-left: 4px solid #ffc107;
              padding: 15px;
              margin: 20px 0;
              border-radius: 5px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">SuaTalk</div>
              <h1 style="color: #667eea; margin: 0;">Email Verification</h1>
            </div>
            
            <p>Hello <strong>${userName}</strong>,</p>
            
            <p>Welcome to SuaTalk! To complete your email verification, please use the code below:</p>
            
            <div class="otp-box">
              <p style="margin: 0 0 10px 0; color: #666;">Your verification code is:</p>
              <div class="otp-code">${otpCode}</div>
            </div>
            
            <div class="warning">
              <strong>⚠️ Important:</strong> This code will expire in <strong>10 minutes</strong>. 
              If you didn't request this verification, please ignore this email.
            </div>
            
            <p>If you have any questions, feel free to contact our support team.</p>
            
            <div class="footer">
              <p>Best regards,<br><strong>SuaTalk Team</strong></p>
              <p style="font-size: 12px; color: #999;">
                This email was sent automatically. Please do not reply to this email.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
SuaTalk - Email Verification

Hello ${userName},

Welcome to SuaTalk! To complete your email verification, please use this code: ${otpCode}

This code will expire in 10 minutes. If you didn't request this verification, please ignore this email.

Best regards,
SuaTalk Team
    `;

    return await this.sendEmail({
      to,
      subject,
      html,
      text,
      headers: {
        'X-Email-Type': 'otp-verification'
      }
    });
  }

  /**
   * Send password reset email
   * @param {string} to - Recipient email
   * @param {string} resetToken - Password reset token
   * @param {string} userName - User name (optional)
   * @param {string} resetUrl - Password reset URL (optional)
   * @returns {Promise<Object>} Email sending result
   */
  async sendPasswordResetEmail(to, resetToken, userName = 'User', resetUrl = null) {
    const defaultResetUrl = `${process.env.FRONTEND_URL || 'https://suatalk.site'}/reset-password?token=${resetToken}`;
    const finalResetUrl = resetUrl || defaultResetUrl;
    
    const subject = 'SuaTalk - Password Reset Request';
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              margin: 0;
              padding: 20px;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background: rgba(255, 255, 255, 0.95);
              backdrop-filter: blur(10px);
              border-radius: 20px;
              border: 1px solid rgba(255, 255, 255, 0.2);
              box-shadow: 0 8px 32px rgba(31, 38, 135, 0.37);
              padding: 40px;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .logo {
              font-size: 28px;
              font-weight: bold;
              color: #667eea;
              margin-bottom: 10px;
            }
            .reset-button {
              display: inline-block;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 15px 30px;
              text-decoration: none;
              border-radius: 10px;
              font-weight: bold;
              margin: 20px 0;
              box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
            }
            .token-box {
              background: rgba(102, 126, 234, 0.1);
              border: 1px solid rgba(102, 126, 234, 0.3);
              border-radius: 10px;
              padding: 15px;
              font-family: 'Courier New', monospace;
              word-break: break-all;
              margin: 20px 0;
            }
            .footer {
              text-align: center;
              font-size: 14px;
              color: #666;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid rgba(102, 126, 234, 0.2);
            }
            .warning {
              background: rgba(220, 53, 69, 0.1);
              border-left: 4px solid #dc3545;
              padding: 15px;
              margin: 20px 0;
              border-radius: 5px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">SuaTalk</div>
              <h1 style="color: #667eea; margin: 0;">Password Reset</h1>
            </div>
            
            <p>Hello <strong>${userName}</strong>,</p>
            
            <p>We received a request to reset your password for your SuaTalk account. Click the button below to reset your password:</p>
            
            <div style="text-align: center;">
              <a href="${finalResetUrl}" class="reset-button">Reset Password</a>
            </div>
            
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <div class="token-box">${finalResetUrl}</div>
            
            <div class="warning">
              <strong>🔒 Security Notice:</strong> This link will expire in <strong>1 hour</strong>. 
              If you didn't request this password reset, please ignore this email and your password will remain unchanged.
            </div>
            
            <p>For security reasons, never share this link with anyone.</p>
            
            <div class="footer">
              <p>Best regards,<br><strong>SuaTalk Team</strong></p>
              <p style="font-size: 12px; color: #999;">
                This email was sent automatically. Please do not reply to this email.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
SuaTalk - Password Reset

Hello ${userName},

We received a request to reset your password for your SuaTalk account. 

To reset your password, visit this link: ${finalResetUrl}

This link will expire in 1 hour. If you didn't request this password reset, please ignore this email.

Best regards,
SuaTalk Team
    `;

    return await this.sendEmail({
      to,
      subject,
      html,
      text,
      headers: {
        'X-Email-Type': 'password-reset'
      }
    });
  }

  /**
   * Send welcome email
   * @param {string} to - Recipient email
   * @param {string} userName - User name
   * @returns {Promise<Object>} Email sending result
   */
  async sendWelcomeEmail(to, userName) {
    const subject = 'Welcome to SuaTalk! 🎉';
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to SuaTalk</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              margin: 0;
              padding: 20px;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background: rgba(255, 255, 255, 0.95);
              backdrop-filter: blur(10px);
              border-radius: 20px;
              border: 1px solid rgba(255, 255, 255, 0.2);
              box-shadow: 0 8px 32px rgba(31, 38, 135, 0.37);
              padding: 40px;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .logo {
              font-size: 28px;
              font-weight: bold;
              color: #667eea;
              margin-bottom: 10px;
            }
            .welcome-badge {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 10px 20px;
              border-radius: 25px;
              display: inline-block;
              font-weight: bold;
              margin: 20px 0;
            }
            .feature-list {
              background: rgba(102, 126, 234, 0.05);
              border-radius: 15px;
              padding: 25px;
              margin: 20px 0;
            }
            .feature-item {
              margin: 15px 0;
              padding-left: 30px;
              position: relative;
            }
            .feature-item:before {
              content: "✓";
              position: absolute;
              left: 0;
              color: #667eea;
              font-weight: bold;
              font-size: 18px;
            }
            .footer {
              text-align: center;
              font-size: 14px;
              color: #666;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid rgba(102, 126, 234, 0.2);
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">SuaTalk</div>
              <h1 style="color: #667eea; margin: 0;">Welcome Aboard! 🎉</h1>
              <div class="welcome-badge">Account Successfully Created</div>
            </div>
            
            <p>Hello <strong>${userName}</strong>,</p>
            
            <p>Congratulations! Your SuaTalk account has been successfully created. We're excited to have you join our community!</p>
            
            <div class="feature-list">
              <h3 style="color: #667eea; margin-top: 0;">What you can do with SuaTalk:</h3>
              <div class="feature-item">Connect with friends and family</div>
              <div class="feature-item">Share your thoughts and experiences</div>
              <div class="feature-item">Join interesting conversations</div>
              <div class="feature-item">Discover new communities</div>
              <div class="feature-item">Stay updated with latest trends</div>
            </div>
            
            <p>Ready to get started? Your account is now active and you can begin exploring SuaTalk!</p>
            
            <p>If you have any questions or need help getting started, don't hesitate to reach out to our support team.</p>
            
            <div class="footer">
              <p>Welcome to the SuaTalk family! 🚀</p>
              <p><strong>SuaTalk Team</strong></p>
              <p style="font-size: 12px; color: #999;">
                This email was sent automatically. Please do not reply to this email.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
Welcome to SuaTalk! 🎉

Hello ${userName},

Congratulations! Your SuaTalk account has been successfully created. We're excited to have you join our community!

What you can do with SuaTalk:
✓ Connect with friends and family
✓ Share your thoughts and experiences  
✓ Join interesting conversations
✓ Discover new communities
✓ Stay updated with latest trends

Ready to get started? Your account is now active and you can begin exploring SuaTalk!

Welcome to the SuaTalk family! 🚀
SuaTalk Team
    `;

    return await this.sendEmail({
      to,
      subject,
      html,
      text,
      headers: {
        'X-Email-Type': 'welcome'
      }
    });
  }

  /**
   * Send notification email
   * @param {string} to - Recipient email
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   * @param {string} userName - User name (optional)
   * @param {string} actionUrl - Action URL (optional)
   * @param {string} actionText - Action button text (optional)
   * @returns {Promise<Object>} Email sending result
   */
  async sendNotificationEmail(to, title, message, userName = 'User', actionUrl = null, actionText = 'View Details') {
    const subject = `SuaTalk - ${title}`;
    
    const actionButton = actionUrl ? `
      <div style="text-align: center; margin: 30px 0;">
        <a href="${actionUrl}" style="
          display: inline-block;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 12px 25px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: bold;
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        ">${actionText}</a>
      </div>
    ` : '';

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              margin: 0;
              padding: 20px;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background: rgba(255, 255, 255, 0.95);
              backdrop-filter: blur(10px);
              border-radius: 20px;
              border: 1px solid rgba(255, 255, 255, 0.2);
              box-shadow: 0 8px 32px rgba(31, 38, 135, 0.37);
              padding: 40px;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .logo {
              font-size: 28px;
              font-weight: bold;
              color: #667eea;
              margin-bottom: 10px;
            }
            .message-box {
              background: rgba(102, 126, 234, 0.05);
              border-radius: 15px;
              padding: 25px;
              margin: 20px 0;
            }
            .footer {
              text-align: center;
              font-size: 14px;
              color: #666;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid rgba(102, 126, 234, 0.2);
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">SuaTalk</div>
              <h1 style="color: #667eea; margin: 0;">${title}</h1>
            </div>
            
            <p>Hello <strong>${userName}</strong>,</p>
            
            <div class="message-box">
              <p>${message}</p>
            </div>
            
            ${actionButton}
            
            <div class="footer">
              <p>Best regards,<br><strong>SuaTalk Team</strong></p>
              <p style="font-size: 12px; color: #999;">
                This email was sent automatically. Please do not reply to this email.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
SuaTalk - ${title}

Hello ${userName},

${message}

${actionUrl ? `View details: ${actionUrl}` : ''}

Best regards,
SuaTalk Team
    `;

    return await this.sendEmail({
      to,
      subject,
      html,
      text,
      headers: {
        'X-Email-Type': 'notification'
      }
    });
  }

  /**
   * Send verification email
   * @param {string} to - Recipient email
   * @param {string} userName - User name
   * @param {string} otpCode - OTP code
   * @returns {Promise<Object>} Email sending result
   */
  async sendVerificationEmail(to, userName = 'User', otpCode) {
    // Backwards-compatibility wrapper – delegate to sendOTPEmail
    return this.sendOTPEmail(to, otpCode, userName);
  }

  /**
   * Get service status
   * @returns {Object} Service status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      provider: 'Resend',
      defaultFrom: this.defaultFrom,
      hasApiKey: !!process.env.RESEND_API_KEY
    };
  }
}

// Create and export singleton instance
const emailService = new EmailService();

module.exports = emailService; 