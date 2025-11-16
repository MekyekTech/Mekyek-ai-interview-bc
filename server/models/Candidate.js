import mongoose from "mongoose";

const CandidateSchema = new mongoose.Schema(
  {
    candidateId: { type: String, unique: true, index: true }, 
    email: { type: String, required: true, index: true },
    name: { type: String },
    profile: {
      role: String,
      skills: [String],
      experience: Number,
    },
    auth: {
      passwordHash: String,
      resetToken: String,
    },
  },
  { timestamps: true }
);

export default mongoose.models.Candidate || mongoose.model("Candidate", CandidateSchema);
