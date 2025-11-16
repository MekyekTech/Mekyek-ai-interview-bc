import nodemailer from "nodemailer";

// Create transporter (Gmail SMTP)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || 587),
  secure: false, // Use TLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false // For development
  }
});

// Verify connection on startup
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ SMTP connection failed:", error.message);
    console.error("   Check SMTP_USER and SMTP_PASS in .env");
  } else {
    console.log("✅ Email service ready");
    console.log(`   Using: ${process.env.SMTP_USER}`);
  }
});

/**
 * Send interview invitation email
 * @param {Object} params - Email parameters
 * @param {string} params.to - Recipient email
 * @param {string} params.candidateName - Candidate name
 * @param {string} params.jobRole - Job position
 * @param {string} params.interviewId - Interview ID
 * @param {string} params.tempPassword - Temporary password
 * @param {Array|string} params.skills - Required skills
 * @param {string} params.loginUrl - Login URL
 */
export const sendInterviewEmail = async ({
  to,
  candidateName,
  jobRole,
  interviewId,
  tempPassword,
  skills,
  loginUrl
}) => {
  try {
    console.log('\n📧 Sending interview invitation');
    console.log('   To:', to);
    console.log('   Role:', jobRole);
    console.log('   Interview ID:', interviewId);

    const skillsList = Array.isArray(skills) ? skills.join(', ') : skills;
    const currentDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: to,
      subject: `Invitation to Interview at Mekyek`,
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Interview Invitation - Mekyek</title>
          <!--[if mso]>
          <style type="text/css">
            body, table, td {font-family: Arial, sans-serif !important;}
          </style>
          <![endif]-->
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
          
          <!-- Email Container -->
          <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
            <tr>
              <td align="center" style="padding: 40px 20px;">
                
                <!-- Main Card -->
                <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
                  
                  <!-- Header -->
                  <tr>
                    <td style="background-color: #ffffff; padding: 40px 32px 24px 32px; border-bottom: 1px solid #e5e7eb;">
                      <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #1f2937; letter-spacing: -0.3px;">
                        Mekyek
                      </h1>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 32px;">
                      
                      <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280; font-weight: 500;">
                        ${currentDate}
                      </p>
                      
                      <p style="margin: 0 0 24px 0; font-size: 16px; color: #374151; line-height: 1.6;">
                        Dear <strong>${candidateName}</strong>,
                      </p>
                      
                      <p style="margin: 0 0 20px 0; font-size: 16px; color: #374151; line-height: 1.7;">
                        We were impressed by your application and would like to invite you to interview for the <strong>${jobRole}</strong> position at <strong>Mekyek</strong>.
                      </p>
                      
                      <p style="margin: 0 0 28px 0; font-size: 16px; color: #374151; line-height: 1.7;">
                        This will be an AI-powered dynamic interview that adapts to your responses. Below are your login credentials:
                      </p>
                      
                      <!-- Credentials -->
                      <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; margin-bottom: 28px;">
                        <tr>
                          <td style="padding: 20px;">
                            <table role="presentation" style="width: 100%; border-collapse: collapse;">
                              
                              <tr style="border-bottom: 1px solid #e5e7eb;">
                                <td style="padding: 12px 0; font-size: 14px; color: #6b7280; font-weight: 500;">
                                  Interview ID:
                                </td>
                                <td style="padding: 12px 0; text-align: right;">
                                  <code style="background-color: #e5e7eb; padding: 6px 12px; border-radius: 4px; font-family: 'Monaco', 'Courier New', monospace; font-size: 13px; color: #1f2937; font-weight: 600;">
                                    ${interviewId}
                                  </code>
                                </td>
                              </tr>
                              
                              <tr style="border-bottom: 1px solid #e5e7eb;">
                                <td style="padding: 12px 0; font-size: 14px; color: #6b7280; font-weight: 500;">
                                  Password:
                                </td>
                                <td style="padding: 12px 0; text-align: right;">
                                  <code style="background-color: #fef3c7; padding: 6px 12px; border-radius: 4px; font-family: 'Monaco', 'Courier New', monospace; font-size: 13px; color: #92400e; font-weight: 700;">
                                    ${tempPassword}
                                  </code>
                                </td>
                              </tr>
                              
                              <tr style="border-bottom: 1px solid #e5e7eb;">
                                <td style="padding: 12px 0; font-size: 14px; color: #6b7280; font-weight: 500;">
                                  Position:
                                </td>
                                <td style="padding: 12px 0; text-align: right; font-size: 14px; color: #1f2937; font-weight: 500;">
                                  ${jobRole}
                                </td>
                              </tr>
                              
                              <tr style="border-bottom: 1px solid #e5e7eb;">
                                <td style="padding: 12px 0; font-size: 14px; color: #6b7280; font-weight: 500;">
                                  Required Skills:
                                </td>
                                <td style="padding: 12px 0; text-align: right; font-size: 14px; color: #1f2937; font-weight: 500;">
                                  ${skillsList}
                                </td>
                              </tr>
                              
                              <tr>
                                <td style="padding: 12px 0; font-size: 14px; color: #6b7280; font-weight: 500;">
                                  Duration:
                                </td>
                                <td style="padding: 12px 0; text-align: right; font-size: 14px; color: #1f2937; font-weight: 500;">
                                  ~45 minutes
                                </td>
                              </tr>
                              
                            </table>
                          </td>
                        </tr>
                      </table>
                      
                      <!-- Button -->
                      <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 28px;">
                        <tr>
                          <td align="center">
                            <a href="${loginUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.3);">
                              Start Interview
                            </a>
                          </td>
                        </tr>
                      </table>
                      
                      <p style="margin: 0 0 20px 0; font-size: 16px; color: #374151; line-height: 1.7;">
                        Please note that you can only take this interview once. Ensure you're in a quiet environment with:
                      </p>
                      
                      <ul style="margin: 0 0 28px 0; padding-left: 24px; font-size: 16px; color: #374151; line-height: 1.7;">
                        <li style="margin-bottom: 8px;">Stable internet connection</li>
                        <li style="margin-bottom: 8px;">Working webcam and microphone</li>
                        <li style="margin-bottom: 8px;">Desktop or laptop (mobile not recommended)</li>
                        <li style="margin-bottom: 8px;">At least 45 minutes of uninterrupted time</li>
                      </ul>
                      
                      <p style="margin: 0 0 8px 0; font-size: 16px; color: #374151; line-height: 1.7;">
                        Best regards,
                      </p>
                      
                      <p style="margin: 0; font-size: 16px; color: #374151; font-weight: 600;">
                        Mekyek Hiring Team
                      </p>
                      
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f9fafb; padding: 24px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
                      <p style="margin: 0 0 8px 0; font-size: 13px; color: #6b7280;">
                        This is an automated message from Mekyek
                      </p>
                      <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                        © ${new Date().getFullYear()} Mekyek. All rights reserved.
                      </p>
                    </td>
                  </tr>
                  
                </table>
                
              </td>
            </tr>
          </table>
          
        </body>
        </html>
      `,
      text: `
Dear ${candidateName},

We were impressed by your application and would like to invite you to interview for the ${jobRole} position at Mekyek.

Interview Details:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Interview ID: ${interviewId}
Password: ${tempPassword}
Position: ${jobRole}
Required Skills: ${skillsList}
Duration: ~45 minutes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Login here: ${loginUrl}

Please note that you can only take this interview once. Ensure you're in a quiet environment with:
- Stable internet connection
- Working webcam and microphone
- Desktop or laptop (mobile not recommended)
- At least 45 minutes of uninterrupted time

Best regards,
Mekyek Hiring Team

© ${new Date().getFullYear()} Mekyek. All rights reserved.
      `.trim()
    };

    const info = await transporter.sendMail(mailOptions);

    console.log('✅ Email sent successfully');
    console.log('   Message ID:', info.messageId);
    console.log('   Accepted:', info.accepted);

    return {
      success: true,
      messageId: info.messageId,
      accepted: info.accepted
    };

  } catch (error) {
    console.error('❌ Email sending failed:', error.message);
    
    // Log detailed error for debugging
    if (error.code) {
      console.error('   Error code:', error.code);
    }
    if (error.response) {
      console.error('   SMTP response:', error.response);
    }
    
    throw new Error(`Email sending failed: ${error.message}`);
  }
};

export default { sendInterviewEmail };
