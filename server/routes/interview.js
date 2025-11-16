import { Router } from "express";
import jwt from "jsonwebtoken";
import { GoogleGenerativeAI } from "@google/generative-ai";
import axios from "axios";
import Interview from "../models/Interview.js";

const router = Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ⭐ Get interview by ID
router.get("/:interviewId", async (req, res) => {
  try {
    console.log("\n📋 GET INTERVIEW");
    console.log("Interview ID:", req.params.interviewId);
    
    const doc = await Interview.findOne({ interviewId: req.params.interviewId });
    
    if (!doc) {
      console.log("❌ Interview not found");
      return res.status(404).json({ error: "Interview not found" });
    }
    
    console.log("✅ Interview found");
    
    return res.json({
      ok: true,
      interviewId: doc.interviewId,
      candidateId: doc.candidateId,
      role: doc.role,
      experience: doc.experience,
      skills: doc.skills || [],
      questions: doc.questions || [],
      conversationHistory: doc.conversationHistory || [],
      answers: doc.answers || [],
      status: doc.status,
      expiresAt: doc.expiresAt
    });

  } catch (e) {
    console.error("❌ Error:", e.message);
    return res.status(500).json({ error: e.message });
  }
});

// ⭐ FIXED: Get interview by token (accepts JWT or direct interviewId)
router.get("/token/:token", async (req, res) => {
  try {
    const { token } = req.params;

    console.log("\n🔐 VERIFYING TOKEN");
    console.log("Token:", token.substring(0, 20) + "...");

    if (!token) {
      return res.status(400).json({ error: "Token required" });
    }

    let interview = null;

    // Try as JWT first
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev-secret-key");
      console.log("✅ JWT decoded");
      if (decoded.type === "interview_access") {
        interview = await Interview.findOne({ interviewId: decoded.interviewId }).exec();
      }
    } catch (jwtErr) {
      console.log("   JWT validation failed, trying as direct interviewId...");
    }

    // ⭐ If not found, try as direct interviewId (from email link)
    if (!interview) {
      console.log("   Trying direct interviewId lookup...");
      interview = await Interview.findOne({ interviewId: token }).exec();
      if (interview) {
        console.log("✅ Found by direct interviewId");
      }
    }

    if (!interview) {
      console.log("❌ Interview not found");
      return res.status(404).json({ error: "Interview not found" });
    }

    if (interview.status === "completed") {
      console.log("❌ Interview already completed");
      return res.status(400).json({ error: "Interview already completed" });
    }

    console.log("✅ Token verified successfully");

    return res.json({
      ok: true,
      interviewId: interview.interviewId,
      candidateId: interview.candidateId,
      role: interview.role,
      experience: interview.experience,
      skills: interview.skills || [],
      conversationHistory: interview.conversationHistory || [],
      answers: interview.answers || [],
      status: interview.status,
      expiresAt: interview.expiresAt
    });

  } catch (error) {
    console.error("❌ Token error:", error.message);
    return res.status(500).json({ error: error.message });
  }
});

// ⭐ Generate next AI question
router.post("/:interviewId/next-question", async (req, res) => {
  try {
    const { interviewId } = req.params;
    const { lastAnswer, isFirstQuestion } = req.body;

    console.log("\n🤖 GENERATING NEXT QUESTION");
    console.log("Interview ID:", interviewId);
    console.log("Is First:", isFirstQuestion);

    const interview = await Interview.findOne({ interviewId }).exec();
    if (!interview) {
      return res.status(404).json({ error: "Interview not found" });
    }

    const conversationHistory = interview.conversationHistory || [];
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    let prompt = "";

    if (isFirstQuestion) {
      prompt = `You are a Professional AI Interviewer conducting an interview for: ${interview.role}

Required Skills: ${interview.skills.join(", ")}
Experience Level: ${interview.experience} years

🎯 YOUR TASK:
Start the interview with a warm, friendly opening question. Ask the candidate to introduce themselves briefly and tell you about their background.

IMPORTANT: Return ONLY the question text, no analysis, no commentary, no formatting.

Example: "Hello! Thank you for joining us today. To start, could you please introduce yourself and tell me about your background and experience?"`;

    } else {
      const conversationContext = conversationHistory.map((item, idx) => 
        `Q${idx + 1}: ${item.question}\nA${idx + 1}: ${item.answer}`
      ).join("\n\n");

      prompt = `You are a Professional AI Interviewer for: ${interview.role} (${interview.experience} years experience, Skills: ${interview.skills.join(", ")})

📌 INTERVIEW STRUCTURE:
1. Introduction (completed)
2. Technical Skills Assessment
3. Experience-Based Questions
4. Problem-Solving Scenarios
5. Behavioral Questions
6. Closing

🧠 RULES:
- Generate ONE question at a time
- Each question MUST be DIFFERENT from previous questions
- Adapt difficulty based on candidate's responses
- If answer is weak → ask easier follow-up
- If answer is strong → go deeper with advanced topics
- Reference previous answers when relevant
- Keep questions SHORT and CLEAR
- Focus on required skills: ${interview.skills.join(", ")}

CONVERSATION SO FAR:
${conversationContext}

CANDIDATE'S LAST ANSWER: 
${lastAnswer}

Based on the above conversation, generate the NEXT UNIQUE QUESTION.

⚠️ CRITICAL:
- Return ONLY the next question text
- Do NOT repeat any previous questions
- If sufficient evaluation (${conversationHistory.length} exchanges), return exactly: "INTERVIEW_COMPLETE"`;

    }

    console.log("📤 Sending prompt to AI...");
    const result = await model.generateContent(prompt);
    const nextQuestion = result.response.text().trim();

    console.log("✅ AI Question generated");

    // Check for completion
    if (nextQuestion === "INTERVIEW_COMPLETE" || conversationHistory.length >= 15) {
      console.log("🏁 Interview complete");
      return res.json({
        ok: true,
        question: null,
        isComplete: true,
        message: "Thank you! The interview is complete."
      });
    }

    // Check if question already asked
    const isDuplicate = conversationHistory.some(item => 
      item.question.toLowerCase().includes(nextQuestion.toLowerCase().substring(0, 50))
    );

    if (isDuplicate) {
      console.log("⚠️ Duplicate detected, regenerating...");
      const retryPrompt = prompt + "\n\nIMPORTANT: The previous question was a duplicate. Generate a COMPLETELY DIFFERENT question.";
      const retryResult = await model.generateContent(retryPrompt);
      const retryQuestion = retryResult.response.text().trim();
      
      return res.json({
        ok: true,
        question: retryQuestion,
        isComplete: false,
        questionNumber: conversationHistory.length + 1
      });
    }

    return res.json({
      ok: true,
      question: nextQuestion,
      isComplete: false,
      questionNumber: conversationHistory.length + 1
    });

  } catch (error) {
    console.error("❌ Question generation error:", error.message);
    return res.status(500).json({ error: error.message });
  }
});

// ⭐ Save answer
router.post("/:interviewId/answer", async (req, res) => {
  try {
    const { interviewId } = req.params;
    const { question, answer, duration, questionId, text, attempt } = req.body;

    console.log("\n💾 SAVE ANSWER");
    console.log("Interview:", interviewId);

    if (!interviewId) return res.status(400).json({ error: "interviewId required" });

    const interview = await Interview.findOne({ interviewId }).exec();
    if (!interview) {
      console.log("❌ Interview not found");
      return res.status(404).json({ error: "Interview not found" });
    }

    console.log("✅ Interview found");

    // Handle dynamic format
    if (question && answer) {
      console.log("📝 Saving as conversationHistory (dynamic mode)");
      
      const updatedWithConversation = await Interview.findOneAndUpdate(
        { interviewId },
        {
          $push: {
            conversationHistory: {
              question,
              answer,
              duration: duration || 0,
              timestamp: new Date()
            }
          }
        },
        { new: true }
      ).exec();

      console.log("✅ Conversation saved, total exchanges:", updatedWithConversation.conversationHistory?.length);

      return res.json({ 
        ok: true, 
        message: "Answer saved",
        count: updatedWithConversation.conversationHistory?.length
      });
    } 
    // Handle traditional format
    else if (questionId && text) {
      console.log("📝 Saving as answers (traditional mode)");
      
      const questionExists = interview.questions?.some(q => q.id === questionId);
      if (!questionExists) {
        console.log("❌ Question not found");
        return res.status(400).json({ error: "Question not found" });
      }

      const updatedWithAnswer = await Interview.findOneAndUpdate(
        { interviewId },
        {
          $push: {
            answers: {
              questionId,
              text: text || "",
              duration: duration || 0,
              ts: new Date(),
              attempt: attempt || 1
            }
          }
        },
        { new: true }
      ).exec();

      console.log("✅ Answer saved, total:", updatedWithAnswer.answers?.length);

      return res.json({ 
        ok: true, 
        message: "Answer saved",
        count: updatedWithAnswer.answers?.length
      });
    } 
    else {
      console.log("❌ Invalid request format");
      return res.status(400).json({ error: "Invalid request format" });
    }

  } catch (error) {
    console.error("❌ EXCEPTION:", error.message);
    return res.status(500).json({
      error: "Server error",
      details: error.message
    });
  }
});

// Complete on close
router.post("/:interviewId/complete-on-close", async (req, res) => {
  try {
    const { interviewId } = req.params;
    const { status, reason, tabWarnings, fullscreenWarnings } = req.body;

    console.log("🚪 Browser closed - Completing interview:", interviewId);

    const interview = await Interview.findOne({ interviewId }).exec();
    if (!interview) {
      return res.status(404).json({ error: "Interview not found" });
    }

    await Interview.findOneAndUpdate(
      { interviewId },
      {
        status: "completed",
        completedAt: new Date(),
        "result.status": "INCOMPLETE",
        "result.reason": reason || "User closed browser/tab",
        "result.tabWarnings": tabWarnings || 0,
        "result.fullscreenWarnings": fullscreenWarnings || 0,
        "result.completedAt": new Date()
      }
    ).exec();

    axios.post(
      `${process.env.API_URL || "http://localhost:4000/api"}/interview/${interviewId}/evaluate`,
      {
        tabWarnings: tabWarnings || 0,
        fullscreenWarnings: fullscreenWarnings || 0,
        isFailed: false,
        isIncomplete: true
      }
    ).catch(err => {
      console.error("Evaluation failed:", err.message);
    });

    console.log("✅ Interview marked as completed");

    return res.json({ ok: true, message: "Interview completed" });
  } catch (error) {
    console.error("❌ Complete on close error:", error.message);
    return res.status(500).json({ error: error.message });
  }
});

// Update status
router.post("/:interviewId/status", async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = new Set(["scheduled", "in_progress", "completed"]);
    
    if (!allowed.has(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const interview = await Interview.findOne({ interviewId: req.params.interviewId });
    if (interview && interview.status === "completed") {
      return res.status(400).json({ 
        error: "This interview is already completed" 
      });
    }
    
    const doc = await Interview.findOneAndUpdate(
      { interviewId: req.params.interviewId },
      { 
        $set: { 
          status,
          completedAt: status === "completed" ? new Date() : null
        } 
      },
      { new: true }
    ).exec();
    
    if (!doc) return res.status(404).json({ error: "Interview not found" });
    
    console.log("✅ Status updated to:", status);
    return res.json({ ok: true, status: doc.status });

  } catch (e) {
    console.error("❌ Error:", e.message);
    return res.status(500).json({ error: e.message });
  }
});

// ⭐ Evaluate interview
router.post("/:interviewId/evaluate", async (req, res) => {
  try {
    const { interviewId } = req.params;
    const { tabWarnings = 0, fullscreenWarnings = 0, isFailed = false, isIncomplete = false } = req.body;

    console.log("\n🤖 EVALUATING INTERVIEW");
    console.log("Interview ID:", interviewId);

    const interview = await Interview.findOne({ interviewId }).exec();
    if (!interview) {
      return res.status(404).json({ error: "Interview not found" });
    }

    let evaluation = null;

    // Handle failures
    if (isFailed) {
      evaluation = {
        overallScore: 0,
        answers: [],
        strengths: [],
        weaknesses: ["Failed to maintain focus on interview"],
        summary: "Interview terminated due to 3 violations.",
        recommendation: "FAIL",
        evaluatedAt: new Date()
      };

      await Interview.findOneAndUpdate(
        { interviewId },
        { $set: { evaluation, result: { status: "FAIL", reason: "Security violations", tabWarnings, fullscreenWarnings, completedAt: new Date() } } }
      ).exec();

      return res.json({ ok: true, evaluation, result: { status: "FAIL" } });
    }

    if (isIncomplete) {
      evaluation = {
        overallScore: 0,
        answers: [],
        strengths: [],
        weaknesses: ["Interview not completed"],
        summary: "Interview was closed before completion.",
        recommendation: "INCOMPLETE",
        evaluatedAt: new Date()
      };

      await Interview.findOneAndUpdate(
        { interviewId },
        { $set: { evaluation, result: { status: "INCOMPLETE", reason: "Closed before completion", tabWarnings, fullscreenWarnings, completedAt: new Date() } } }
      ).exec();

      return res.json({ ok: true, evaluation, result: { status: "INCOMPLETE" } });
    }

    // Check if answers exist
    const isDynamic = interview.conversationHistory && interview.conversationHistory.length > 0;
    const isTraditional = interview.answers && interview.answers.length > 0;

    console.log("   - Dynamic:", isDynamic, "Count:", interview.conversationHistory?.length || 0);
    console.log("   - Traditional:", isTraditional, "Count:", interview.answers?.length || 0);

    if (!isDynamic && !isTraditional) {
      return res.status(400).json({ error: "No answers to evaluate" });
    }

    // Prepare evaluation text
    let evaluationText = "";
    
    if (isDynamic) {
      console.log("📊 Evaluating DYNAMIC interview");
      
      const validConversations = interview.conversationHistory.filter(item => 
        item.answer && item.answer.trim().length > 10
      );

      if (validConversations.length === 0) {
        return res.status(400).json({ error: "No valid answers to evaluate" });
      }

      evaluationText = validConversations.map((item, idx) => 
        `Q${idx + 1}: ${item.question}\nA${idx + 1}: ${item.answer.trim()} (${item.duration}s)`
      ).join("\n\n");
    } else {
      console.log("📊 Evaluating TRADITIONAL interview");
      const answersWithQuestions = interview.answers.map(answer => {
        const question = interview.questions.find(q => q.id === answer.questionId);
        return {
          question: question?.text || "Unknown",
          answer: answer.text || "",
          duration: answer.duration || 0
        };
      });

      evaluationText = answersWithQuestions.map((item, i) => 
        `Q${i + 1}: ${item.question}\nA${i + 1}: ${item.answer} (${item.duration}s)`
      ).join("\n\n");
    }

    if (!evaluationText || evaluationText.trim().length < 50) {
      return res.status(400).json({ error: "Insufficient content to evaluate" });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const evaluationPrompt = `You are an expert interview evaluator. Evaluate the following interview for a ${interview.role} position requiring ${interview.experience} years experience.

Required Skills: ${interview.skills.join(", ")}

INTERVIEW RESPONSES:
${evaluationText}

Provide comprehensive evaluation in VALID JSON format (no markdown, no code blocks):

{
  "answers": [
    {"questionIndex": 0, "score": 75, "feedback": "Good technical understanding"},
    {"questionIndex": 1, "score": 80, "feedback": "Clear communication"}
  ],
  "overallScore": 78,
  "strengths": ["Technical knowledge", "Communication skills", "Problem-solving"],
  "weaknesses": ["More depth needed", "Practical examples lacking"],
  "summary": "Candidate demonstrates solid understanding with room for growth.",
  "recommendation": "PASS"
}`;

    console.log("📤 Sending to AI...");
    
    const result = await model.generateContent(evaluationPrompt);
    const responseText = result.response.text();

    console.log("✅ AI Response received");

    // Extract JSON
    let jsonMatch = responseText.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      const cleanedText = responseText.replace(/``````\n?/g, '');
      jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    }

    if (!jsonMatch) {
      console.error("❌ Could not parse AI response");
      throw new Error("Invalid AI response format");
    }

    evaluation = JSON.parse(jsonMatch[0]);

    console.log("✅ Evaluation parsed");
    console.log("   - Score:", evaluation.overallScore);
    console.log("   - Recommendation:", evaluation.recommendation);

    const finalResult = {
      status: evaluation.overallScore >= 75 ? "PASS" : "FAIL",
      reason: "Auto-evaluated",
      tabWarnings,
      fullscreenWarnings,
      completedAt: new Date()
    };

    await Interview.findOneAndUpdate(
      { interviewId },
      {
        $set: {
          evaluation: {
            overallScore: evaluation.overallScore,
            answers: evaluation.answers,
            strengths: evaluation.strengths,
            weaknesses: evaluation.weaknesses,
            summary: evaluation.summary,
            recommendation: evaluation.recommendation,
            evaluatedAt: new Date()
          },
          result: finalResult
        }
      }
    ).exec();

    console.log("✅ Evaluation saved");

    return res.json({
      ok: true,
      evaluation: {
        overallScore: evaluation.overallScore,
        answers: evaluation.answers,
        strengths: evaluation.strengths,
        weaknesses: evaluation.weaknesses,
        summary: evaluation.summary,
        recommendation: evaluation.recommendation
      },
      result: finalResult
    });

  } catch (error) {
    console.error("❌ Evaluation error:", error.message);
    console.error("Stack:", error.stack);
    return res.status(500).json({ 
      error: "Evaluation failed", 
      details: error.message 
    });
  }
});

export default router;
