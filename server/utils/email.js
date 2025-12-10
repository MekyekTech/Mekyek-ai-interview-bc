import * as brevo from '@getbrevo/brevo';

// Initialize Brevo API
let apiInstance = null;

const initBrevoAPI = () => {
  if (!apiInstance && process.env.BREVO_API_KEY) {
    apiInstance = new brevo.TransactionalEmailsApi();
    apiInstance.setApiKey(
      brevo.TransactionalEmailsApiApiKeys.apiKey,
      process.env.BREVO_API_KEY
    );
    console.log('✅ Brevo API initialized');
  }
  return apiInstance;
};

/**
 * Send interview invitation email via Brevo API
 * @param {Object} params - Email parameters
 */
export const sendInterviewEmail = async ({
  to,
  candidateName,
  jobRole,
  interviewId,
  tempPassword,
  skills,
  loginUrl,
  companyName = "Mekyek"
}) => {
  try {
    console.log('\n📧 Sending interview invitation via Brevo API');
    console.log('   To:', to);
    console.log('   Company:', companyName);
    console.log('   Role:', jobRole);
    console.log('   Interview ID:', interviewId);

    const api = initBrevoAPI();
    
    if (!api) {
      throw new Error('Brevo API not configured. Please set BREVO_API_KEY in environment variables.');
    }

    const skillsList = Array.isArray(skills) ? skills.join(', ') : skills;
    const currentDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const sendSmtpEmail = new brevo.SendSmtpEmail();
    
    sendSmtpEmail.subject = `AI Interview Invitation - ${jobRole} at ${companyName}`;
    sendSmtpEmail.to = [{ email: to, name: candidateName }];
    sendSmtpEmail.sender = { 
      name: companyName || 'MEKYEK', 
      email: 'mekyek.tech@gmail.com' 
    };
    sendSmtpEmail.replyTo = { 
      email: 'mekyek.tech@gmail.com', 
      name: companyName 
    };
    
    sendSmtpEmail.htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; font-family: Arial, sans-serif; background-color:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding:40px; text-align:center;">
              <h1 style="margin:0; color:#ffffff; font-size:28px;">🎯 AI Interview Invitation</h1>
              <p style="margin:10px 0 0; color:#ffffff; font-size:16px;">${companyName}</p>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="color:#6b7280; font-size:14px; margin:0 0 20px;">${currentDate}</p>
              
              <p style="color:#374151; font-size:16px; margin:0 0 20px;">Dear <strong>${candidateName}</strong>,</p>
              
              <p style="color:#374151; font-size:16px; line-height:1.6; margin:0 0 20px;">
                Congratulations! 🎉 We were impressed by your application and would like to invite you to an AI-powered interview for the <strong>${jobRole}</strong> position at <strong>${companyName}</strong>.
              </p>
              
              <!-- Credentials Box -->
              <table width="100%" cellpadding="20" cellspacing="0" style="background-color:#f0f4ff; border:2px solid #667eea; border-radius:8px; margin:20px 0;">
                <tr>
                  <td>
                    <p style="margin:0 0 15px; color:#667eea; font-size:14px; font-weight:bold;">🔐 YOUR LOGIN CREDENTIALS</p>
                    
                    <table width="100%" cellpadding="8" cellspacing="0">
                      <tr>
                        <td style="color:#6b7280; font-size:14px; padding:8px 0;">Interview ID:</td>
                        <td style="text-align:right; padding:8px 0;">
                          <span style="background-color:#ffffff; padding:8px 12px; border-radius:4px; font-family:monospace; font-size:14px; font-weight:bold; color:#1f2937; border:1px solid #e5e7eb; display:inline-block;">${interviewId}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="color:#6b7280; font-size:14px; padding:8px 0;">Password:</td>
                        <td style="text-align:right; padding:8px 0;">
                          <span style="background-color:#fef3c7; padding:8px 12px; border-radius:4px; font-family:monospace; font-size:14px; font-weight:bold; color:#92400e; border:1px solid #fbbf24; display:inline-block;">${tempPassword}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="color:#6b7280; font-size:14px; padding:8px 0;">Position:</td>
                        <td style="text-align:right; color:#1f2937; font-size:14px; font-weight:bold; padding:8px 0;">${jobRole}</td>
                      </tr>
                      <tr>
                        <td style="color:#6b7280; font-size:14px; padding:8px 0;">Duration:</td>
                        <td style="text-align:right; color:#1f2937; font-size:14px; font-weight:bold; padding:8px 0;">⏱️ ~45 minutes</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:30px 0;">
                <tr>
                  <td align="center">
                    <a href="${loginUrl}" style="display:inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color:#ffffff; padding:16px 48px; text-decoration:none; border-radius:8px; font-weight:bold; font-size:16px;">
                      🚀 Start Your Interview
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Warning Box -->
              <table width="100%" cellpadding="15" cellspacing="0" style="background-color:#fef3c7; border-left:4px solid #f59e0b; border-radius:6px; margin:20px 0;">
                <tr>
                  <td>
                    <p style="margin:0 0 8px; color:#92400e; font-size:15px; font-weight:bold;">⚠️ Important: One-Time Interview</p>
                    <p style="margin:0; color:#78350f; font-size:14px;">You can only take this interview <strong>once</strong>. Please ensure you're fully prepared before starting.</p>
                  </td>
                </tr>
              </table>
              
              <!-- Requirements -->
              <p style="color:#374151; font-size:15px; font-weight:bold; margin:20px 0 10px;">📋 Before You Start:</p>
              <ul style="color:#374151; font-size:15px; line-height:1.8; margin:0; padding-left:20px;">
                <li>Stable internet connection (minimum 5 Mbps)</li>
                <li>Working webcam and microphone</li>
                <li>Desktop or laptop (mobile not supported)</li>
                <li>Quiet environment with good lighting</li>
                <li>At least 60 minutes of uninterrupted time</li>
                <li>Chrome or Firefox browser (latest version)</li>
              </ul>
              
              <p style="color:#374151; font-size:16px; margin:30px 0 8px;">Good luck! We're excited to learn more about you. 🌟</p>
              <p style="color:#374151; font-size:16px; margin:0;">Best regards,</p>
              <p style="color:#667eea; font-size:16px; font-weight:bold; margin:5px 0 0;">${companyName} Hiring Team</p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color:#f9fafb; padding:24px; text-align:center; border-top:1px solid #e5e7eb;">
              <p style="margin:0 0 8px; color:#6b7280; font-size:13px;">This is an automated message from ${companyName}</p>
              <p style="margin:0; color:#9ca3af; font-size:12px;">Powered by Mekyek AI Interview Platform</p>
              <p style="margin:8px 0 0; color:#9ca3af; font-size:12px;">© ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    sendSmtpEmail.textContent = `
${companyName} - AI Interview Invitation

Dear ${candidateName},

Congratulations! We were impressed by your application and would like to invite you to an AI-powered interview for the ${jobRole} position at ${companyName}.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR LOGIN CREDENTIALS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Interview ID: ${interviewId}
Password: ${tempPassword}
Position: ${jobRole}
Duration: ~45 minutes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Start Interview: ${loginUrl}

⚠️ IMPORTANT: You can only take this interview ONCE. Please ensure you're fully prepared before starting.

BEFORE YOU START:
✅ Stable internet connection (minimum 5 Mbps)
✅ Working webcam and microphone
✅ Desktop or laptop (mobile not supported)
✅ Quiet environment with good lighting
✅ At least 60 minutes of uninterrupted time
✅ Chrome or Firefox browser (latest version)

Good luck! We're excited to learn more about you.

Best regards,
${companyName} Hiring Team

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Powered by Mekyek AI Interview Platform
© ${new Date().getFullYear()} ${companyName}. All rights reserved.
    `.trim();

    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);

    console.log('✅ Email sent successfully via Brevo API');
    console.log('   Message ID:', result.body.messageId);

    return {
      success: true,
      messageId: result.body.messageId,
    };

  } catch (error) {
    console.error('❌ Brevo API error:', error.message);
    
    if (error.response) {
      console.error('   API Response:', error.response.body);
    }
    
    throw new Error(`Brevo API failed: ${error.message}`);
  }
};

export default { sendInterviewEmail };
