import express from "express";
import crypto from "crypto";
import Interview from "../models/Interview.js";
import Candidate from "../models/Candidate.js";
import { sendInterviewEmail } from "../utils/email.js";
import { verifyAPIKey } from "../middleware/apiAuth.js"; 
const router = express.Router();

// helper functions
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
const randomPassword = (n = 12) => crypto.randomBytes(16).toString("base64url").slice(0, n);

// apply api key validation
router.use(verifyAPIKey);

// create interview route
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

    console.log("\nINTEGRATION: Creating interview");
    console.log("   Company:", companyName || externalCompanyId);
    console.log("   Candidate:", candidateName);
    console.log("   Email:", candidateEmail);
    console.log("   Role:", jobRole);

    // validation
    if (!candidateId || !candidateName || !candidateEmail || !jobRole) {
      console.log("Missing required fields");
      return res.status(400).json({ 
        error: "Missing required fields",
        required: ["candidateId", "candidateName", "candidateEmail", "jobRole"]
      });
    }

    // email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(candidateEmail)) {
      console.log("Invalid email format");
      return res.status(400).json({ error: "Invalid email format" });
    }

    // find or create candidate
    let candidate = await Candidate.findOne({ candidateId });
    
    if (!candidate) {
      candidate = await Candidate.create({
        candidateId,
        name: candidateName,
        email: candidateEmail,
      });
      console.log("New candidate created");
    } else {
      console.log("Existing candidate found");
      candidate.name = candidateName;
      candidate.email = candidateEmail;
      await candidate.save();
    }

    // generate password
    const tempPassword = randomPassword(12);
    candidate.auth = { passwordHash: sha256(tempPassword) };
    await candidate.save();

    console.log("Temporary password generated");

    // create interview
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

    console.log("Interview created:", interviewId);

    // send email
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
        companyName: companyName || "Your Company"
      });

      console.log("Email sent");
    } catch (emailError) {
      console.error("Email sending failed:", emailError.message);
      
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

    console.log("Interview setup complete\n");

    return res.json({
      ok: true,
      interviewId,
      candidateId: candidate.candidateId,
      message: "Interview created and email sent to candidate",
      loginUrl 
    });

  } catch (error) {
    console.error("Integration error:", error.message);
    return res.status(500).json({ 
      error: "Failed to create interview",
      details: process.env.NODE_ENV === "production" ? undefined : error.message
    });
  }
});

// get interview status
router.get("/interview-status/:interviewId", async (req, res) => {
  try {
    const { interviewId } = req.params;

    console.log("\nINTEGRATION: Status check");
    console.log("   Interview ID:", interviewId);

    const interview = await Interview.findOne({ interviewId }).lean().exec();
    
    if (!interview) {
      console.log("Interview not found");
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

    console.log("Status fetched");

    return res.json({ ok: true, data: response });

  } catch (error) {
    console.error("Status fetch error:", error.message);
    return res.status(500).json({ error: error.message });
  }
});

// get list of interviews for a company
router.get("/company-interviews/:companyId", async (req, res) => {
  try {
    const { companyId } = req.params;

    console.log("\nINTEGRATION: Fetching company interviews");
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

    console.log(`Found ${results.length} interviews`);

    return res.json({ 
      ok: true, 
      count: results.length,
      interviews: results 
    });

  } catch (error) {
    console.error("Fetch error:", error.message);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
