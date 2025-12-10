import { Router } from "express";
import jwt from "jsonwebtoken";
import { GoogleGenerativeAI } from "@google/generative-ai";
import axios from "axios";
import Interview from "../models/Interview.js";

const router = Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// get interview by id
router.get("/:interviewId", async (req, res) => {
  try {
    console.log("\n get interview");
    console.log("Interview ID:", req.params.interviewId);
    
    const doc = await Interview.findOne({ interviewId: req.params.interviewId });
    
    if (!doc) {
      console.log("Interview not found");
      return res.status(404).json({ error: "Interview not found" });
    }
    
    console.log("Interview found");
    
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
    console.error("Error:", e.message);
    return res.status(500).json({ error: e.message });
  }
});

// get interview by token 
router.get("/token/:token", async (req, res) => {
  try {
    const { token } = req.params;

    console.log("\n verifying token");
    console.log("Token:", token.substring(0, 20) + "...");

    if (!token) {
      return res.status(400).json({ error: "Token required" });
    }

    let interview = null;

    // try jwt validation
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev-secret-key");
      console.log("jwt decoded");
      if (decoded.type === "interview_access") {
        interview = await Interview.findOne({ interviewId: decoded.interviewId }).exec();
      }
    } catch (jwtErr) {
      console.log("jwt validation failed, trying direct interviewId...");
    }

    // fallback: direct interviewId
    if (!interview) {
      console.log("trying direct interviewId lookup...");
      interview = await Interview.findOne({ interviewId: token }).exec();
      if (interview) {
        console.log("found by direct interviewId");
      }
    }

    if (!interview) {
      console.log("Interview not found");
      return res.status(404).json({ error: "Interview not found" });
    }

    if (interview.status === "completed") {
      console.log("Interview already completed");
      return res.status(400).json({ error: "Interview already completed" });
    }

    console.log("token verified successfully");

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
    console.error("token error:", error.message);
    return res.status(500).json({ error: error.message });
  }
});

// generate next ai question
router.post("/:interviewId/next-question", async (req, res) => {
  try {
    const { interviewId } = req.params;
    const { lastAnswer, isFirstQuestion } = req.body;

    console.log("\n generating next question");
    console.log("Interview ID:", interviewId);
    console.log("Is First:", isFirstQuestion);

    const interview = await Interview.findOne({ interviewId }).exec();
    if (!interview) {
      return res.status(404).json({ error: "Interview not found" });
    }

    const conversationHistory = interview.conversationHistory || [];
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // ✅ FIXED

    let prompt = "";

    // first question prompt
    if (isFirstQuestion) {
      prompt = `You are a Professional AI Interviewer conducting an interview for: ${interview.role}

Required Skills: ${interview.skills.join(", ")}
Experience Level: ${interview.experience} years

Your task:
Start the interview with a simple introduction question asking the candidate to introduce themselves.

Return only the question text without any explanation.`;

    } else {
      const conversationContext = conversationHistory.map((item, idx) => 
        `Q${idx + 1}: ${item.question}\nA${idx + 1}: ${item.answer}`
      ).join("\n\n");

      // dynamic next question prompt
      prompt = `You are an AI interviewer for: ${interview.role} (${interview.experience} years experience)

Rules:
- Generate one unique question
- No repetition
- Adjust question difficulty based on last answer
- Keep it short and clear

Conversation so far:
${conversationContext}

Candidate's last answer:
${lastAnswer}

Generate the next question. If interview is complete return only: INTERVIEW_COMPLETE`;
    }

    const result = await model.generateContent(prompt);
    const nextQuestion = result.response.text().trim();

    console.log("ai question generated");

    // mark interview complete
    if (nextQuestion === "INTERVIEW_COMPLETE" || conversationHistory.length >= 15) {
      return res.json({
        ok: true,
        question: null,
        isComplete: true,
        message: "Interview complete."
      });
    }

    // detect duplicate question
    const isDuplicate = conversationHistory.some(item => 
      item.question.toLowerCase().includes(nextQuestion.toLowerCase().substring(0, 50))
    );

    if (isDuplicate) {
      console.log("duplicate detected, regenerating...");
      const retryPrompt = prompt + "\nGenerate a different question.";
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
    console.error("question generation error:", error.message);
    return res.status(500).json({ error: error.message });
  }
});

// save answer
router.post("/:interviewId/answer", async (req, res) => {
  try {
    const { interviewId } = req.params;
    const { question, answer, duration, questionId, text, attempt } = req.body;

    console.log("\n save answer");
    console.log("Interview:", interviewId);

    if (!interviewId) return res.status(400).json({ error: "interviewId required" });

    const interview = await Interview.findOne({ interviewId }).exec();
    if (!interview) {
      return res.status(404).json({ error: "Interview not found" });
    }

    // dynamic mode
    if (question && answer) {
      const updated = await Interview.findOneAndUpdate(
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

      return res.json({ 
        ok: true, 
        message: "Answer saved",
        count: updated.conversationHistory?.length
      });
    } 
    // traditional mode
    else if (questionId && text) {
      const questionExists = interview.questions?.some(q => q.id === questionId);
      if (!questionExists) return res.status(400).json({ error: "Question not found" });

      const updated = await Interview.findOneAndUpdate(
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

      return res.json({ 
        ok: true, 
        message: "Answer saved",
        count: updated.answers?.length
      });
    } 
    else {
      return res.status(400).json({ error: "Invalid request format" });
    }

  } catch (error) {
    console.error("exception:", error.message);
    return res.status(500).json({
      error: "Server error",
      details: error.message
    });
  }
});

// complete when tab/browser closed
router.post("/:interviewId/complete-on-close", async (req, res) => {
  try {
    const { interviewId } = req.params;
    const { status, reason, tabWarnings, fullscreenWarnings } = req.body;

    console.log("browser closed - marking interview completed:", interviewId);

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
        "result.reason": reason || "User closed browser",
        "result.tabWarnings": tabWarnings || 0,
        "result.fullscreenWarnings": fullscreenWarnings || 0,
        "result.completedAt": new Date()
      }
    ).exec();

    axios.post(
      `${process.env.API_URL || "https://mekyek-ai-interview-bc.onrender.com/api"}/interview/${interviewId}/evaluate`,
      {
        tabWarnings: tabWarnings || 0,
        fullscreenWarnings: fullscreenWarnings || 0,
        isFailed: false,
        isIncomplete: true
      }
    ).catch(err => console.error("Evaluation failed:", err.message));

    return res.json({ ok: true, message: "Interview completed" });
  } catch (error) {
    console.error("complete on close error:", error.message);
    return res.status(500).json({ error: error.message });
  }
});

// update status
router.post("/:interviewId/status", async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = new Set(["scheduled", "in_progress", "completed"]);
    
    if (!allowed.has(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const interview = await Interview.findOne({ interviewId: req.params.interviewId });
    if (interview && interview.status === "completed") {
      return res.status(400).json({ error: "This interview is already completed" });
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
    
    return res.json({ ok: true, status: doc.status });

  } catch (e) {
    console.error("error:", e.message);
    return res.status(500).json({ error: e.message });
  }
});

// evaluate interview
// evaluate interview
router.post("/:interviewId/evaluate", async (req, res) => {
  try {
    const { interviewId } = req.params;
    const { tabWarnings = 0, fullscreenWarnings = 0, isFailed = false, isIncomplete = false } = req.body;

    console.log("\n evaluating interview");
    console.log("Interview ID:", interviewId);

    const interview = await Interview.findOne({ interviewId }).exec();
    if (!interview) {
      return res.status(404).json({ error: "Interview not found" });
    }

    let evaluation = null;

    // fail cases
    if (isFailed) {
      evaluation = {
        overallScore: 0,
        answers: [],
        strengths: [],
        weaknesses: ["Failed to maintain focus"],
        summary: "Interview terminated due to violations.",
        recommendation: "FAIL",
        evaluatedAt: new Date()
      };

      await Interview.findOneAndUpdate(
        { interviewId },
        { $set: { evaluation, result: { status: "FAIL", reason: "Security violations", tabWarnings, fullscreenWarnings, completedAt: new Date() } } }
      ).exec();

      return res.json({ ok: true, evaluation, result: { status: "FAIL" } });
    }

    // incomplete cases
    if (isIncomplete) {
      evaluation = {
        overallScore: 0,
        answers: [],
        strengths: [],
        weaknesses: ["Interview not completed"],
        summary: "Interview was closed early.",
        recommendation: "INCOMPLETE",
        evaluatedAt: new Date()
      };

      await Interview.findOneAndUpdate(
        { interviewId },
        { $set: { evaluation, result: { status: "INCOMPLETE", reason: "Closed early", tabWarnings, fullscreenWarnings, completedAt: new Date() } } }
      ).exec();

      return res.json({ ok: true, evaluation, result: { status: "INCOMPLETE" } });
    }

    // detect answer type
    const isDynamic = interview.conversationHistory && interview.conversationHistory.length > 0;
    const isTraditional = interview.answers && interview.answers.length > 0;

    if (!isDynamic && !isTraditional) {
      return res.status(400).json({ error: "No answers to evaluate" });
    }

    // prepare evaluation text
    let evaluationText = "";
    
    if (isDynamic) {
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

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const evaluationPrompt = `You are an interview evaluator. Evaluate the following interview for a ${interview.role} position requiring ${interview.experience} years experience.

Required Skills: ${interview.skills.join(", ")}

Interview Responses:
${evaluationText}

Return evaluation in valid JSON format with these fields:
- overallScore (number 0-100)
- answers (array of objects with: question, score, feedback)
- strengths (array of strings)
- weaknesses (array of strings)
- summary (string)
- recommendation (string: PASS/FAIL)`;

    const result = await model.generateContent(evaluationPrompt);
    const responseText = result.response.text();

    // ✅ FIXED: Extract JSON with proper regex
    let jsonMatch = responseText.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      // Remove markdown code blocks (``````)
      const cleanedText = responseText.replace(/``````\n?/g, '');
      jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    }

    if (!jsonMatch) {
      console.error("AI Response:", responseText);
      throw new Error("Invalid AI response format");
    }

    evaluation = JSON.parse(jsonMatch[0]);

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
    console.error("evaluation error:", error.message);
    return res.status(500).json({ 
      error: "Evaluation failed", 
      details: error.message 
    });
  }
});


export default router;
