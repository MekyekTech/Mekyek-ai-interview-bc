import mongoose from "mongoose";

const interviewSchema = new mongoose.Schema({
  interviewId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  candidateId: { 
    type: String, 
    required: true 
  },
  externalPlatformId: String,
  externalUserId: String,
  externalCompanyId: String,
  role: { 
    type: String, 
    required: true 
  },
  experience: { 
    type: Number, 
    default: 0 
  },
  skills: [String],
  
  questions: [
    {
      id: String,
      text: String,
    },
  ],
  
  answers: [
    {
      questionId: String,
      text: String,
      ts: { type: Date, default: Date.now },
      attempt: Number,
      duration: Number, // ⭐ ADDED: For speech duration
    },
  ],
  
  // ⭐ NEW: Store conversation history for dynamic interviews
  conversationHistory: [
    {
      question: String,
      answer: String,
      duration: Number,
      timestamp: { type: Date, default: Date.now }
    }
  ],
  
  evaluation: {
    overallScore: Number,
    answers: [
      {
        questionIndex: Number,
        score: Number,
        feedback: String,
      },
    ],
    strengths: [String],
    weaknesses: [String],
    summary: String,
    recommendation: String,
    evaluatedAt: Date,
  },
  
  result: {
    status: {
      type: String,
      enum: ["PASS", "FAIL", "INCOMPLETE"],
      default: null,
    },
    reason: String,
    tabWarnings: { 
      type: Number, 
      default: 0 
    },
    fullscreenWarnings: {
      type: Number,
      default: 0
    },
    completedAt: Date,
  },
  
  session: {
    activeToken: {
      type: String,
      default: null
    },
    loginAt: {
      type: Date,
      default: null
    },
    loginCount: {
      type: Number,
      default: 0
    }
  },
  
  status: {
    type: String,
    enum: ["scheduled", "in_progress", "completed"],
    default: "scheduled",
  },
  
  scheduledAt: Date,
  completedAt: Date,
  expiresAt: Date,
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
});

export default mongoose.model("Interview", interviewSchema);
