import express from "express";
import crypto from "crypto";
import Interview from "../models/Interview.js";
import Candidate from "../models/Candidate.js";
import { sendInterviewEmail } from "../utils/email.js";
import { verifyAPIKey } from "../middleware/apiAuth.js"; // ⭐ NEW

const router = express.Router();

// Helper functions
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
const randomPassword = (n = 12) => crypto.randomBytes(16).toString("base64url").slice(0, n);

// ⭐ NEW: Apply API key authentication to all integration routes
router.use(verifyAPIKey);

/**
 * Create interview (with company isolation)
 * POST /api/integration/create-interview-simple
 */
router.post("/create-interview-simple", async (req, res) => {
  try {
    const {
      candidateId,
      candidateName,
      candidateEmail,
      jobRole,
      skills,
      experience,
      externalCompanyId, // ⭐ Company isolation
      companyName // ⭐ For email branding
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
        error: "Missing required fields",
        required: ["candidateId", "candidateName", "candidateEmail", "jobRole"]
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(candidateEmail)) {
      console.log("❌ Invalid email format");
      return res.status(400).json({ error: "Invalid email format" });
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

    // Generate temporary password
    const tempPassword = randomPassword(12);
    candidate.auth = { passwordHash: sha256(tempPassword) };
    await candidate.save();

    console.log("✅ Temporary password generated");

    // Create interview with company isolation
    const interviewId = `INT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    await Interview.create({
      interviewId,
      candidateId,
      role: jobRole,
      experience: experience || 0,
      skills: Array.isArray(skills) ? skills : [skills],
      status: "scheduled",
      scheduledAt: new Date(),
      externalCompanyId: externalCompanyId || "default-company", // ⭐ Company isolation
      session: {
        activeToken: null,
        loginAt: null,
        loginCount: 0
      }
    });

    console.log("✅ Interview created:", interviewId);

    // Send email with company branding
    const loginUrl = `${process.env.CLIENT_ORIGIN || "http://localhost:9000"}/login?interviewId=${interviewId}`;

    try {
      await sendInterviewEmail({
        to: candidateEmail,
        candidateName,
        jobRole,
        interviewId,
        tempPassword,
        skills: Array.isArray(skills) ? skills : [skills],
        loginUrl,
        companyName: companyName || "Your Company" // ⭐ Dynamic company name
      });

      console.log("✅ Email sent successfully");

    } catch (emailError) {
      console.error("⚠️ Email sending failed:", emailError.message);
      
      return res.status(201).json({
        ok: true,
        interviewId,
        message: "Interview created but email failed to send",
        emailError: emailError.message,
        manualCredentials: {
          interviewId,
          password: tempPassword,
          loginUrl
        }
      });
    }

    console.log("✅ Interview setup complete\n");

    return res.json({
      ok: true,
      interviewId,
      candidateId: candidate.candidateId,
      message: "Interview created and email sent to candidate",
      loginUrl // ⭐ Return login URL for Mekyek
    });

  } catch (error) {
    console.error("❌ Integration error:", error.message);
    return res.status(500).json({ 
      error: "Failed to create interview",
      details: process.env.NODE_ENV === "production" ? undefined : error.message
    });
  }
});

/**
 * Get interview status (company can only see their own)
 * GET /api/integration/interview-status/:interviewId
 */
router.get("/interview-status/:interviewId", async (req, res) => {
  try {
    const { interviewId } = req.params;

    console.log("\n🔗 INTEGRATION: Status check");
    console.log("   Interview ID:", interviewId);

    const interview = await Interview.findOne({ interviewId }).lean().exec();
    
    if (!interview) {
      console.log("❌ Interview not found");
      return res.status(404).json({ 
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
      } : null,
    };

    console.log("✅ Status fetched");

    return res.json({ ok: true, data: response });

  } catch (error) {
    console.error("❌ Status fetch error:", error.message);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Get all interviews for a company
 * GET /api/integration/company-interviews/:companyId
 */
router.get("/company-interviews/:companyId", async (req, res) => {
  try {
    const { companyId } = req.params;

    console.log("\n🔗 INTEGRATION: Fetching company interviews");
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
    return res.status(500).json({ error: error.message });
  }
});

// This stays as is - with setImmediate email sending
// setImmediate(async () => {
//   try {
//     await sendInterviewEmail({
//       to: candidateEmail,
//       candidateName,
//       jobRole,
//       interviewId,
//       tempPassword,
//       skills: Array.isArray(skills) ? skills : [skills],
//       loginUrl,
//       companyName: companyName || "Your Company"
//     });
//     console.log("✅ Email sent successfully to:", candidateEmail);
//   } catch (emailError) {
//     console.error("❌ Email sending failed (non-critical):", emailError.message);
//   }
// });


export default router;
