/**
 * API Key Authentication Middleware
 * Verifies requests from Mekyek platform
 */
export const verifyAPIKey = (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
      console.warn("⚠️ Missing API key");
      return res.status(401).json({ 
        error: "Unauthorized",
        message: "API key required. Include 'x-api-key' header."
      });
    }

    const validKey = process.env.MEKYEK_API_KEY;
    
    if (!validKey) {
      console.error("❌ MEKYEK_API_KEY not configured in environment");
      return res.status(500).json({ 
        error: "Server configuration error" 
      });
    }

    if (apiKey !== validKey) {
      console.warn("⚠️ Invalid API key attempt");
      console.warn(`   Received: ${apiKey.substring(0, 10)}...`);
      return res.status(403).json({ 
        error: "Forbidden",
        message: "Invalid API key"
      });
    }

    console.log("✅ API key verified - Mekyek Platform");
    next();

  } catch (error) {
    console.error("❌ API auth error:", error.message);
    return res.status(500).json({ 
      error: "Authentication failed",
      details: error.message 
    });
  }
};
