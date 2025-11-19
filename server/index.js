import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoSanitize from "express-mongo-sanitize";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Import routes
import candidateRoutes from "./routes/candidate.js";
import interviewRoutes from "./routes/interview.js";
import integrationRoutes from "./routes/integration.js";

const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));



// Rate limiting (100 requests per 15 minutes per IP)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", limiter);

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// CORS configuration
const allowLocalhost = /^http:\/\/localhost:\d+$/;
const allowedOrigins = [
  process.env.CLIENT_ORIGIN,
  "http://localhost:9000",
  "http://localhost:3001"
].filter(Boolean);

const corsOpts = {
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    
    const isAllowed = allowedOrigins.includes(origin) || allowLocalhost.test(origin);
    
    if (isAllowed) {
      return cb(null, true);
    } else {
      console.warn(`⚠️ CORS blocked origin: ${origin}`);
      return cb(new Error("CORS policy: Origin not allowed"), false);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"],
};

app.use(cors(corsOpts));

// MongoDB connection
(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log("✅ MongoDB connected");
    console.log(`   Database: ${mongoose.connection.db.databaseName}`);
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  }
})();

// Health check endpoints
app.get("/", (req, res) => {
  res.json({ 
    ok: true,
    service: "AI Interview Backend",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString()
  });
});

app.get("/health", (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  
  res.json({ 
    ok: true,
    status: "healthy",
    mongodb: dbStatus,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// API routes
app.use("/api/candidate", candidateRoutes);
app.use("/api/interview", interviewRoutes);
app.use("/api/integration", integrationRoutes);

// 404 handler
app.use((req, res) => {
  console.warn(`⚠️ 404: ${req.method} ${req.url}`);
  res.status(404).json({ 
    error: "Route not found",
    path: req.url,
    method: req.method
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("❌ ERROR:", err.message);
  
  if (process.env.NODE_ENV !== "production") {
    console.error(err.stack);
  }
  
  const status = err.status || 500;
  
  res.status(status).json({ 
    error: process.env.NODE_ENV === "production" && status === 500
      ? "Internal server error" 
      : err.message,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack })
  });
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("\n⚠️ SIGTERM received, shutting down gracefully...");
  
  try {
    await mongoose.connection.close();
    console.log("✅ MongoDB connection closed");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error during shutdown:", err);
    process.exit(1);
  }
});

process.on("SIGINT", async () => {
  console.log("\n⚠️ SIGINT received, shutting down gracefully...");
  
  try {
    await mongoose.connection.close();
    console.log("✅ MongoDB connection closed");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error during shutdown:", err);
    process.exit(1);
  }
});

// Start server
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log("\n🚀 Server started successfully");
  console.log(`   Port: ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   API: http://localhost:${PORT}/api`);
  console.log("");
});
