import { Router } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import Candidate from "../models/Candidate.js";
import Interview from "../models/Interview.js";

const router = Router();

//login 
router.post("/login-by-interview", async (req, res) => {
  try {
    const { interviewId, password } = req.body;

    console.log("\n🔐 LOGIN BY INTERVIEW");
    console.log("Interview ID:", interviewId);

    if (!interviewId) {
      return res.status(400).json({ error: "Interview ID required" });
    }

    if (!password) {
      return res.status(400).json({ error: "Password required" });
    }

    // Find interview
    const interview = await Interview.findOne({ interviewId }).exec();
    if (!interview) {
      return res.status(404).json({ error: "Interview not found" });
    }

    // Check if expired
    if (interview.expiresAt) {
      const expiresAt = new Date(interview.expiresAt);
      if (new Date() > expiresAt) {
        return res.status(410).json({ error: "Interview link expired (24 hours)" });
      }
    }

    // Check if already completed
    if (interview.status === "completed") {
      return res.status(400).json({ error: "This interview has already been completed - you can only take it once" });
    }

    // ⭐ CHECK IF ALREADY LOGGED IN (One-time login enforcement)
    if (interview.session?.activeToken) {
      return res.status(403).json({ 
        error: "Already logged in",
        message: "This interview session is already active. You can only login once. If you believe this is an error, please contact support."
      });
    }

    // Find candidate
    const candidate = await Candidate.findOne({ candidateId: interview.candidateId }).exec();
    if (!candidate) {
      return res.status(401).json({ error: "Candidate not found" });
    }

    // Verify password
    const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
    const passwordHash = sha256(password);
    
    if (!candidate.auth?.passwordHash || candidate.auth.passwordHash !== passwordHash) {
      return res.status(401).json({ error: "Invalid password" });
    }

    // Generate JWT token for URL
    const token = jwt.sign(
      { 
        interviewId: interview.interviewId,
        candidateId: candidate.candidateId,
        type: "interview_access",
        loginAt: new Date().toISOString()
      },
      process.env.JWT_SECRET || "dev-secret-key",
      { expiresIn: "3h" }
    );

    // ⭐ SAVE TOKEN TO DATABASE (One-time login tracking)
    await Interview.findOneAndUpdate(
      { interviewId }, 
      { 
        status: "in_progress",
        "session.activeToken": token,
        "session.loginAt": new Date(),
        $inc: { "session.loginCount": 1 }
      }
    );

    console.log("✅ Login successful - Session token stored");

    return res.json({
      ok: true,
      token, 
      candidate: {
        candidateId: candidate.candidateId,
        name: candidate.name,
        email: candidate.email,
      },
      interview: {
        interviewId: interview.interviewId,
        role: interview.role,
      }
    });

  } catch (error) {
    console.error("❌ Login error:", error.message);
    return res.status(500).json({ error: error.message });
  }
});

// ⭐ NEW ENDPOINT: Validate token (optional - for extra security)
router.post("/validate-session", async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Token required" });
    }

    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev-secret-key");

    // Check if token exists in database
    const interview = await Interview.findOne({ 
      interviewId: decoded.interviewId,
      "session.activeToken": token
    }).exec();

    if (!interview) {
      return res.status(401).json({ 
        error: "Invalid session",
        message: "Your session is no longer valid. Please contact support if you need assistance."
      });
    }

    if (interview.status === "completed") {
      return res.status(400).json({ error: "Interview already completed" });
    }

    return res.json({ 
      ok: true,
      valid: true,
      interviewId: interview.interviewId
    });

  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    return res.status(500).json({ error: error.message });
  }
});

// ⭐ NEW ENDPOINT: Logout/Clear session (optional - for testing or support)
router.post("/logout", async (req, res) => {
  try {
    const { interviewId } = req.body;

    if (!interviewId) {
      return res.status(400).json({ error: "Interview ID required" });
    }

    await Interview.findOneAndUpdate(
      { interviewId },
      {
        "session.activeToken": null
      }
    );

    console.log("✅ Session cleared for interview:", interviewId);

    return res.json({ ok: true, message: "Session cleared" });

  } catch (error) {
    console.error("❌ Logout error:", error.message);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
