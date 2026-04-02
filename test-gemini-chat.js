const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

async function test() {
  const API_KEY = process.env.GEMINI_API_KEY || "";
  console.log("Key length:", API_KEY.length);
  const genAI = new GoogleGenerativeAI(API_KEY);

  const SYSTEM_INSTRUCTION = "You are a test bot.";
  const history = [];

  try {
    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash"
        // systemInstruction omitted for testing
    });

    const chat = model.startChat({
      history: history,
      generationConfig: {
        maxOutputTokens: 1000,
      },
    });

    const result = await chat.sendMessage("Hello!");
    console.log("Result object:", Object.keys(result));
    const responseText = result.response.text();
    console.log("Response text:", responseText);
  } catch (error) {
    console.error("Caught error:", error);
  }
}

test();
