const nodemailer = require('nodemailer');

// Create transporter based on environment
const createTransporter = () => {
  if (process.env.NODE_ENV === 'production') {
    // Production email configuration (e.g., SendGrid, AWS SES, etc.)
    return nodemailer.createTransporter({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  } else {
    // Development configuration (using Ethereal for testing)
    return nodemailer.createTransporter({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: {
        user: process.env.EMAIL_USER || 'ethereal.user@ethereal.email',
        pass: process.env.EMAIL_PASS || 'ethereal.pass'
      }
    });
  }
};

// Initialize transporter
let transporter;

const initializeEmailService = async () => {
  try {
    if (process.env.NODE_ENV === 'development' && (!process.env.EMAIL_USER || !process.env.EMAIL_PASS)) {
      // Create test account for development
      const testAccount = await nodemailer.createTestAccount();
      
      transporter = nodemailer.createTransporter({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
      
      console.log('📧 Email service initialized with test account:', testAccount.user);
    } else {
      transporter = createTransporter();
      console.log('📧 Email service initialized');
    }
    
    // Verify connection
    await transporter.verify();
    console.log('✅ Email service connection verified');
    
  } catch (error) {
    console.error('❌ Email service initialization failed:', error.message);
    // Don't throw error, allow app to continue without email
  }
};

// Send verification email
const sendVerificationEmail = async (email, firstName, otpCode) => {
  if (!transporter) {
    throw new Error('Email service not initialized');
  }

  const mailOptions = {
    from: {
      name: 'SuaTalk',
      address: process.env.EMAIL_FROM || 'noreply@suatalk.com'
    },
    to: email,
    subject: 'Verify Your Email - SuaTalk',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .otp-code { background: #4F46E5; color: white; font-size: 32px; font-weight: bold; padding: 15px; text-align: center; border-radius: 8px; margin: 20px 0; letter-spacing: 5px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
          .warning { background: #FEF3C7; border: 1px solid #F59E0B; padding: 15px; border-radius: 8px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to SuaTalk!</h1>
          </div>
          <div class="content">
            <h2>Hi ${firstName},</h2>
            <p>Thank you for registering with SuaTalk! To complete your registration, please verify your email address using the verification code below:</p>
            
            <div class="otp-code">${otpCode}</div>
            
            <p>This verification code will expire in <strong>10 minutes</strong>.</p>
            
            <div class="warning">
              <strong>Security Note:</strong> If you didn't create an account with SuaTalk, please ignore this email. Your email address will not be used for any further communications.
            </div>
            
            <p>If you have any questions, feel free to contact our support team.</p>
            
            <p>Best regards,<br>The SuaTalk Team</p>
          </div>
          <div class="footer">
            <p>This is an automated email. Please do not reply to this message.</p>
            <p>&copy; 2024 SuaTalk. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Hi ${firstName},
      
      Thank you for registering with SuaTalk! To complete your registration, please verify your email address using the verification code below:
      
      Verification Code: ${otpCode}
      
      This verification code will expire in 10 minutes.
      
      If you didn't create an account with SuaTalk, please ignore this email.
      
      Best regards,
      The SuaTalk Team
    `
  };

  const info = await transporter.sendMail(mailOptions);
  
  // Log preview URL for development
  if (process.env.NODE_ENV === 'development') {
    console.log('📧 Verification email sent to:', email);
    console.log('📧 Preview URL:', nodemailer.getTestMessageUrl(info));
  }
  
  return info;
};

// Send password reset email
const sendPasswordResetEmail = async (email, firstName, resetToken) => {
  if (!transporter) {
    throw new Error('Email service not initialized');
  }

  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

  const mailOptions = {
    from: {
      name: 'SuaTalk',
      address: process.env.EMAIL_FROM || 'noreply@suatalk.com'
    },
    to: email,
    subject: 'Reset Your Password - SuaTalk',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #DC2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #DC2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
          .warning { background: #FEF3C7; border: 1px solid #F59E0B; padding: 15px; border-radius: 8px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Hi ${firstName},</h2>
            <p>We received a request to reset your password for your SuaTalk account. Click the button below to reset your password:</p>
            
            <a href="${resetUrl}" class="button">Reset Password</a>
            
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #4F46E5;">${resetUrl}</p>
            
            <div class="warning">
              <strong>Security Note:</strong> This link will expire in 1 hour. If you didn't request a password reset, please ignore this email and your password will remain unchanged.
            </div>
            
            <p>Best regards,<br>The SuaTalk Team</p>
          </div>
          <div class="footer">
            <p>This is an automated email. Please do not reply to this message.</p>
            <p>&copy; 2024 SuaTalk. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Hi ${firstName},
      
      We received a request to reset your password for your SuaTalk account.
      
      Click this link to reset your password: ${resetUrl}
      
      This link will expire in 1 hour. If you didn't request a password reset, please ignore this email.
      
      Best regards,
      The SuaTalk Team
    `
  };

  const info = await transporter.sendMail(mailOptions);
  
  if (process.env.NODE_ENV === 'development') {
    console.log('📧 Password reset email sent to:', email);
    console.log('📧 Preview URL:', nodemailer.getTestMessageUrl(info));
  }
  
  return info;
};

module.exports = {
  initializeEmailService,
  sendVerificationEmail,
  sendPasswordResetEmail
}; 