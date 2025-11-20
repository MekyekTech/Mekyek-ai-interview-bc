// FILE: server/routes/integration.js (UPDATED - ASYNC EMAIL)
import express from "express";
import crypto from "crypto";
import Interview from "../models/Interview.js";
import Candidate from "../models/Candidate.js";
import { sendInterviewEmail } from "../utils/email.js";
import { verifyAPIKey } from "../middleware/apiAuth.js"; 

const router = express.Router();

// Helper functions
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
const randomPassword = (n = 12) => crypto.randomBytes(16).toString("base64url").slice(0, n);

// Apply API key validation
router.use(verifyAPIKey);

// ✅ UPDATED: Create interview route with ASYNC email
router.post("/create-interview-simple", async (req, res) => {
  try {
    const {
      candidateId,
      candidateName,
      candidateEmail,
      jobRole,
      skills,
      experience,
      externalCompanyId, 
      companyName 
    } = req.body;

    console.log("\n🔗 INTEGRATION: Creating interview");
    console.log("   Company:", companyName || externalCompanyId);
    console.log("   Candidate:", candidateName);
    console.log("   Email:", candidateEmail);
    console.log("   Role:", jobRole);

    // Validation
    if (!candidateId || !candidateName || !candidateEmail || !jobRole) {
      console.log("❌ Missing required fields");
      return res.status(400).json({ 
        ok: false,
        error: "Missing required fields",
        required: ["candidateId", "candidateName", "candidateEmail", "jobRole"]
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(candidateEmail)) {
      console.log("❌ Invalid email format");
      return res.status(400).json({ 
        ok: false,
        error: "Invalid email format" 
      });
    }

    // Find or create candidate
    let candidate = await Candidate.findOne({ candidateId });
    
    if (!candidate) {
      candidate = await Candidate.create({
        candidateId,
        name: candidateName,
        email: candidateEmail,
      });
      console.log("✅ New candidate created");
    } else {
      console.log("✅ Existing candidate found");
      candidate.name = candidateName;
      candidate.email = candidateEmail;
      await candidate.save();
    }

    // Generate password
    const tempPassword = randomPassword(12);
    candidate.auth = { passwordHash: sha256(tempPassword) };
    await candidate.save();

    console.log("🔑 Temporary password generated");

    // Create interview
    const interviewId = `INT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    await Interview.create({
      interviewId,
      candidateId,
      role: jobRole,
      experience: experience || 0,
      skills: Array.isArray(skills) ? skills : [skills],
      status: "scheduled",
      scheduledAt: new Date(),
      externalCompanyId: externalCompanyId || "default-company",
      session: {
        activeToken: null,
        loginAt: null,
        loginCount: 0
      }
    });

    console.log("✅ Interview created:", interviewId);

    // Build login URL
    const loginUrl = `${process.env.CLIENT_ORIGIN || "http://localhost:9000"}/login?interviewId=${interviewId}`;

    // ✅ KEY CHANGE: SEND RESPONSE FIRST (before email)
    console.log("📤 Sending immediate response to caller");
    
    // Return success response immediately
    const response = {
      ok: true,
      interviewId,
      candidateId: candidate.candidateId,
      loginUrl,
      message: "Interview created successfully. Email will be sent shortly.",
      // ⚠️ For debugging - remove in production
      debug: {
        tempPassword: process.env.NODE_ENV !== 'production' ? tempPassword : undefined,
        emailQueued: true
      }
    };

    // Send response NOW (don't wait for email)
    res.status(201).json(response);

    // ✅ SEND EMAIL AFTER RESPONSE (async, non-blocking)
    console.log("📧 Queuing email send (non-blocking)...");
    
    // Use setImmediate to send email after response is sent
    setImmediate(async () => {
      try {
        console.log("📧 Sending interview invitation");
        console.log("   To:", candidateEmail);
        console.log("   Role:", jobRole);
        console.log("   Interview ID:", interviewId);

        await sendInterviewEmail({
          to: candidateEmail,
          candidateName,
          jobRole,
          interviewId,
          tempPassword,
          skills: Array.isArray(skills) ? skills : [skills],
          loginUrl,
          companyName: companyName || "Your Company"
        });

        console.log("✅ Email sent successfully to:", candidateEmail);
        
      } catch (emailError) {
        // Email failed but interview is already created
        console.error("❌ Email sending failed (non-critical):", emailError.message);
        console.error("   Error code:", emailError.code);
        
        // Log for monitoring/alerting
        console.log("⚠️  Interview created but email failed");
        console.log("   Interview ID:", interviewId);
        console.log("   Candidate:", candidateEmail);
        console.log("   Manual credentials needed:");
        console.log("   - Login URL:", loginUrl);
        console.log("   - Password:", tempPassword);
        
        // TODO: Add to retry queue or send notification to admin
      }
    });

    console.log("✅ Interview setup complete (email queued)\n");

  } catch (error) {
    console.error("❌ Integration error:", error.message);
    return res.status(500).json({ 
      ok: false,
      error: "Failed to create interview",
      details: process.env.NODE_ENV === "production" ? undefined : error.message
    });
  }
});

// ✅ Get interview status (unchanged)
router.get("/interview-status/:interviewId", async (req, res) => {
  try {
    const { interviewId } = req.params;

    console.log("\n📊 INTEGRATION: Status check");
    console.log("   Interview ID:", interviewId);

    const interview = await Interview.findOne({ interviewId }).lean().exec();
    
    if (!interview) {
      console.log("❌ Interview not found");
      return res.status(404).json({ 
        ok: false,
        error: "Interview not found" 
      });
    }

    const response = {
      interviewId: interview.interviewId,
      candidateId: interview.candidateId,
      externalCompanyId: interview.externalCompanyId,
      status: interview.status,
      scheduledAt: interview.scheduledAt,
      completedAt: interview.completedAt,
      result: interview.result || null,
      evaluation: interview.evaluation ? {
        overallScore: interview.evaluation.overallScore,
        recommendation: interview.evaluation.recommendation,
        summary: interview.evaluation.summary,
        strengths: interview.evaluation.strengths,
        weaknesses: interview.evaluation.weaknesses,
        answers: interview.evaluation.answers || []
      } : null,
    };

    console.log("✅ Status fetched");

    return res.json({ ok: true, data: response });

  } catch (error) {
    console.error("❌ Status fetch error:", error.message);
    return res.status(500).json({ 
      ok: false,
      error: error.message 
    });
  }
});

// ✅ Get list of interviews for a company (unchanged)
router.get("/company-interviews/:companyId", async (req, res) => {
  try {
    const { companyId } = req.params;

    console.log("\n📋 INTEGRATION: Fetching company interviews");
    console.log("   Company ID:", companyId);

    const interviews = await Interview.find({ 
      externalCompanyId: companyId 
    })
      .sort({ scheduledAt: -1 })
      .lean()
      .exec();

    const results = interviews.map(i => ({
      interviewId: i.interviewId,
      candidateId: i.candidateId,
      role: i.role,
      status: i.status,
      overallScore: i.evaluation?.overallScore || null,
      recommendation: i.evaluation?.recommendation || null,
      scheduledAt: i.scheduledAt,
      completedAt: i.completedAt,
    }));

    console.log(`✅ Found ${results.length} interviews`);

    return res.json({ 
      ok: true, 
      count: results.length,
      interviews: results 
    });

  } catch (error) {
    console.error("❌ Fetch error:", error.message);
    return res.status(500).json({ 
      ok: false,
      error: error.message 
    });
  }
});

export default router;
