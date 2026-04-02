const { GoogleGenerativeAI } = require("@google/generative-ai");

// Get API key from environment or set directly for testing
const API_KEY = process.env.GEMINI_API_KEY || "YOUR_API_KEY_HERE";

async function testGemini() {
  console.log("Testing Gemini API...");
  
  if (API_KEY === "YOUR_API_KEY_HERE") {
    console.log("❌ Please set your Gemini API key first!");
    console.log("Get one from: https://aistudio.google.com/");
    return;
  }
  
  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });
  
  try {
    const result = await model.generateContent("Hello, are you working?");
    const response = await result.response;
    console.log("✅ API Working!");
    console.log("Response:", response.text());
  } catch (error) {
    console.error("❌ API Error:", error.message);
  }
}

testGemini();
