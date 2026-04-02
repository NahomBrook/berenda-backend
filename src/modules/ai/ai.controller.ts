// backend/src/modules/ai/ai.controller.ts
import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { GoogleGenerativeAI } from "@google/generative-ai";

const prisma = new PrismaClient();

type ConversationMessage = { role: "user" | "model"; parts: { text: string }[] };
type ConversationHistory = ConversationMessage[];

// Store conversation history per "conversation key" (userId and/or conversationId)
const conversations = new Map<string, ConversationHistory>();

const SYSTEM_INSTRUCTION = `
You are the Berenda AI Assistant. You help users with the Berenda platform, a property rental and hosting platform in Addis Ababa.
Always be polite, helpful, clear, and concise. Format responses clearly. Use emojis naturally.
Here is your core knowledge base:
1. Finding Properties: Users can search (e.g., 'Bole', 'Kazanchis'), filter by price and bedrooms, and check dates.
2. Booking: 1. Find property 2. Select dates 3. Add guests 4. Check availability 5. Complete payment.
3. Hosting: 1. Click 'Host a Berenda' 2. Add details/photos 3. Set monthly price 4. Set map location 5. Submit.
4. Areas in Addis Ababa: Bole (Upscale, embassies, nightlife), Kazanchis (Business district, UNECA/AU), Megenagna (Shopping), Piassa (Historic), Entoto (Mountain views).
5. Amenities: WiFi, Kitchen, Washer/Dryer, AC, Heating, Pool, Free Parking, Pet Friendly, TV.
6. Pricing: Properties are priced MONTHLY. Users can filter by price range.
If the user asks something outside this scope, politely relate it back to Berenda if possible, or explain you are specialized in Berenda's platform.
`;

const AREA_KB: Record<string, { title: string; description: string }> = {
  bole: {
    title: "Bole",
    description: "Upscale area with embassies and nightlife. Great for business travelers and convenient access to services.",
  },
  kazanchis: {
    title: "Kazanchis",
    description: "Business district near UNECA/AU. Ideal if you want to stay close to major institutions and corporate offices.",
  },
  megenagna: {
    title: "Megenagna",
    description: "Shopping-focused area. Good for visitors who want access to markets and everyday conveniences.",
  },
  piassa: {
    title: "Piassa",
    description: "Historic neighborhood with a lively atmosphere. Great for exploring local culture and heritage.",
  },
  entoto: {
    title: "Entoto",
    description: "Mountain views and a calmer atmosphere. Good if you want fresh air and scenic views.",
  },
};

const normalizeText = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

const getConversationKey = (userId: string, conversationId?: string) => {
  const cid = typeof conversationId === "string" ? conversationId.trim() : "";
  if (cid) return `conv:${cid}`;
  return `user:${userId}`;
};

const extractLocation = (text: string) => {
  const t = normalizeText(text);
  const found: string[] = [];
  for (const key of Object.keys(AREA_KB)) {
    if (t.includes(key)) found.push(key);
  }
  return found;
};

const extractPriceRange = (text: string) => {
  const t = normalizeText(text);
  const numbers = [...t.matchAll(/(\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
  const hasBetween = t.includes("between") && numbers.length >= 2;
  const hasUnder = t.includes("under") || t.includes("below") || t.includes("less than") || t.includes("max");
  const hasOver = t.includes("over") || t.includes("above") || t.includes("more than") || t.includes("min");

  if (hasBetween) {
    const a = numbers[0];
    const b = numbers[1];
    if (a <= b) return { min: a, max: b };
    return { min: b, max: a };
  }

  if (hasUnder && numbers.length >= 1) return { min: undefined as number | undefined, max: numbers[0] };
  if (hasOver && numbers.length >= 1) return { min: numbers[0], max: undefined as number | undefined };

  if (t.includes("budget") && numbers.length >= 1) return { min: undefined as number | undefined, max: numbers[0] };

  return { min: undefined as number | undefined, max: undefined as number | undefined };
};

const isGreeting = (text: string) => {
  const t = normalizeText(text);
  return ["hi", "hello", "hey", "good morning", "good afternoon", "good evening", "salam"].some((g) => t === g || t.startsWith(g));
};

const buildRuleBasedResponse = async (opts: {
  message: string;
  history: ConversationHistory;
}) => {
  const { message, history } = opts;
  const normalized = normalizeText(message);

  const lastUser = [...history]
    .reverse()
    .find((m) => m.role === "user")
    ?.parts?.[0]?.text;

  const effectiveText = normalized.length < 8 && lastUser ? `${lastUser} ${message}` : message;

  const locations = extractLocation(effectiveText);
  const price = extractPriceRange(effectiveText);

  if (isGreeting(message) || normalized.includes("your name") || normalized.includes("who are you")) {
    return [
      "👋 Hi! I’m your Berenda AI Assistant.",
      "",
      "I can help you:",
      "- Find properties in Addis Ababa (Bole, Kazanchis, Megenagna, Piassa, Entoto)",
      "- Understand bookings and payments",
      "- Explain how to host your property on Berenda",
      "",
      "Tell me what you’re looking for (area + budget + dates/guests).",
    ].join("\n");
  }

  const wantsBooking = /booking|book|pay|payment|reserve|reservation|checkout/.test(normalized);
  const wantsHosting = /host|hosting|list|become a host|berenda host/.test(normalized);

  if (wantsBooking) {
    return [
      "✅ Booking flow on Berenda:",
      "1) Choose the property",
      "2) Select check-in and check-out dates",
      "3) Add guest count",
      "4) Check availability",
      "5) Proceed to payment with Chapa (Telebirr/CBE/card/bank)",
      "",
      "If you tell me the area and your budget, I can suggest good options to book.",
    ].join("\n");
  }

  if (wantsHosting) {
    return [
      "🏡 Hosting on Berenda:",
      "1) Click “Host a Berenda”",
      "2) Add details and photos",
      "3) Set your monthly price",
      "4) Add your map location",
      "5) Submit for review",
      "",
      "Want to host a studio, apartment, or a family home? Share the area and your monthly price and I’ll guide you.",
    ].join("\n");
  }

  if (locations.length > 0 && normalized.length <= 25) {
    return locations
      .map((loc) => `📍 **${AREA_KB[loc].title}**: ${AREA_KB[loc].description}`)
      .join("\n\n");
  }

  const isSearching =
    locations.length > 0 ||
    /price|budget|under|below|between|max|min|rent/i.test(effectiveText);

  if (isSearching) {
    try {
      const where: any = {
        deletedAt: null,
        approvalStatus: "approved",
        isAvailable: true,
      };

      if (locations.length > 0) {
        where.location = { contains: AREA_KB[locations[0]].title, mode: "insensitive" };
      }

      if (price.min !== undefined || price.max !== undefined) {
        where.monthlyPrice = {};
        if (price.min !== undefined) where.monthlyPrice.gte = price.min;
        if (price.max !== undefined) where.monthlyPrice.lte = price.max;
      }

      const properties = await prisma.property.findMany({
        where,
        include: {
          media: {
            where: { mediaType: "image" },
            take: 3,
          },
        },
        take: 4,
        orderBy: { createdAt: "desc" },
      });

      if (properties.length === 0) {
        return [
          "I couldn’t find exact matches with that area/budget right now.",
          "",
          "Try adjusting your budget slightly or choosing a nearby area (Bole, Kazanchis, Megenagna, Piassa, Entoto).",
        ].join("\n");
      }

      const lines = properties.map((p) => {
        const img = p.media?.[0]?.mediaUrl ? ` ${p.media[0].mediaUrl}` : "";
        return `- **${p.title}** (${p.location}) — ${p.monthlyPrice}/month${img}`;
      });

      const refine: string[] = [];
      refine.push("Want me to narrow it further by bedrooms/guests/dates?");
      if (price.max !== undefined) refine.push(`I’ll focus on options under ${price.max}/month.`);

      return [
        "Here are some Berenda options that match your preferences:",
        "",
        ...lines,
        "",
        ...refine,
      ].join("\n");
    } catch (e) {
      // If Prisma query fails, fall through to generic guidance.
    }
  }

  if (/bole|kazanchis|megenagna|piassa|entoto/.test(normalized)) {
    return Object.entries(AREA_KB)
      .map(([_, v]) => `📍 **${v.title}**: ${v.description}`)
      .join("\n\n");
  }

  if (normalized.includes("what can you do") || normalized.includes("help")) {
    return [
      "I can help with:",
      "- Finding properties in Addis Ababa by area and budget",
      "- Explaining booking and payments",
      "- Explaining how to host on Berenda",
      "",
      "Tell me: area + budget + dates (if you have them).",
    ].join("\n");
  }

  return [
    "I can help with Berenda bookings, hosting, and property search in Addis Ababa. 🙂",
    "",
    "What are you looking for today?",
    "- A place to rent (area + budget)?",
    "- Or hosting guidance?",
  ].join("\n");
};

export const sendAIMessage = async (req: Request, res: Response): Promise<any> => {
  try {
    // Allow anonymous users - use "anonymous" as default userId if not authenticated
    const userFromToken = (req as any).user;
    const userId = userFromToken?.userId || userFromToken?.id || "anonymous";
    const { message, conversationId } = req.body as { message?: string; conversationId?: string };

    console.log("🤖 AI Request:", { userId, message: message?.substring(0, 50) });

    if (!message || !message.trim()) {
      return res.status(400).json({ message: "Message is required" });
    }

    const conversationKey = getConversationKey(userId, conversationId);

    if (!conversations.has(conversationKey)) {
      conversations.set(conversationKey, []);
    }
    const history = conversations.get(conversationKey)!;

    history.push({ role: "user", parts: [{ text: message }] });

    let responseText = "";
    const apiKey = process.env.GEMINI_API_KEY || "";

    if (apiKey) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          model: "gemini-2.5-flash",
          systemInstruction: SYSTEM_INSTRUCTION,
        });

        const chat = model.startChat({
          history: history,
          generationConfig: { maxOutputTokens: 1000 },
        });

        const result = await chat.sendMessage(message);
        responseText = result.response.text();
      } catch (e) {
        console.warn("Gemini failed; using rule-based fallback.", e);
        responseText = "";
      }
    }

    if (!responseText) {
      try {
        responseText = await buildRuleBasedResponse({ message, history: history.slice() });
      } catch (e) {
        console.warn("Rule-based fallback failed; using generic response.", e);
        responseText = [
          "Sorry, I'm having trouble generating a response right now.",
          "",
          "But I can still help with Berenda basics: finding properties in Addis Ababa, and explaining booking/hosting steps.",
        ].join("\n");
      }
    }

    history.push({ role: "model", parts: [{ text: responseText }] });

    if (history.length > 20) {
      history.splice(0, 2);
    }

    conversations.set(conversationKey, history);

    return res.json({
      id: `ai-${Date.now()}`,
      senderId: userId,
      message: responseText,
      createdAt: new Date().toISOString(),
      isAi: true,
    });
  } catch (error) {
    console.error("Error in sendAIMessage:", error);
    const generic = [
      "Sorry, I'm having trouble generating a response right now.",
      "",
      "I can still help you with Berenda basics: finding properties in Addis Ababa, and explaining booking/hosting steps.",
    ].join("\n");

    return res.json({
      id: `ai-${Date.now()}`,
      senderId: "anonymous",
      message: generic,
      createdAt: new Date().toISOString(),
      isAi: true,
    });
  }
};

export const clearConversation = async (req: Request, res: Response): Promise<any> => {
  try {
    const userFromToken = (req as any).user;
    const userId = userFromToken?.userId || userFromToken?.id;
    const { conversationId } = (req.body || {}) as { conversationId?: string };
    
    if (userId) {
      const conversationKey = getConversationKey(userId, conversationId);
      conversations.delete(conversationKey);
    }
    
    return res.json({ success: true, message: "Conversation cleared" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to clear conversation" });
  }
};