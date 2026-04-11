// backend/src/modules/ai/ai.controller.ts
import { Request, Response } from "express";
import prisma from "../../lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";


type ConversationMessage = { role: "user" | "model"; parts: { text: string }[] };
type ConversationHistory = ConversationMessage[];

// Store conversation history per "conversation key" (userId and/or conversationId)
const conversations = new Map<string, ConversationHistory>();

const SYSTEM_INSTRUCTION = `
You are the Berenda (በረንዳ) AI Assistant — a friendly, knowledgeable guide for the Berenda property rental platform in Addis Ababa, Ethiopia.
Your personality: warm, concise, locally-aware. You know Addis Ababa well. Use emojis naturally but sparingly.
NEVER include image URLs, Cloudinary links, or markdown images in your responses.
If you know the user's name, address them by it naturally.

Core knowledge:
1. Finding Properties: Search by area (Bole, Kazanchis, Megenagna, Piassa, Entoto), filter by price and bedrooms, pick dates.
2. Booking flow: Find property → Select dates (check-in/check-out must be different days) → Add guests → Check availability → Pay via Chapa (Telebirr, CBE, card).
3. Hosting flow: Click "Host a Berenda" → Add title, description, photos → Set monthly price → Pin map location → Submit for admin review. Approval takes 1-2 days.
4. Addis Ababa areas:
   - Bole: Upscale, embassies, nightlife, near Bole International Airport.
   - Kazanchis: Business district, UNECA/AU, corporate offices.
   - Megenagna: Shopping, everyday conveniences, family-friendly.
   - Piassa: Historic, cultural, lively local atmosphere.
   - Entoto: Mountain views, fresh air, quieter.
5. Amenities available: WiFi, Kitchen, Washer/Dryer, AC, Heating, Pool, Free Parking, Pet Friendly, TV.
6. Pricing: All properties priced MONTHLY in ETB (Ethiopian Birr).
7. Payments: Processed via Chapa — supports Telebirr, CBE Birr, bank transfer, card.
8. After booking, the host must accept/decline the request from their hosting dashboard.

When helping a user find a property, ask about: area preference, budget (ETB/month), number of guests, and dates.
If asked something outside Berenda, politely say you specialize in Berenda and redirect.
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
const hasAmharic = (text: string) => /[\u1200-\u137F]/.test(text);

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
  amharic?: boolean;
}) => {
  const { message, history, amharic = false } = opts;
  const normalized = normalizeText(message);

  const lastUser = [...history]
    .reverse()
    .find((m) => m.role === "user")
    ?.parts?.[0]?.text;

  const effectiveText = normalized.length < 8 && lastUser ? `${lastUser} ${message}` : message;

  const locations = extractLocation(effectiveText);
  const price = extractPriceRange(effectiveText);

  if (isGreeting(message) || normalized.includes("your name") || normalized.includes("who are you")) {
    if (amharic) {
      return [
        "👋 ሰላም! እኔ የበረንዳ AI ረዳትዎ ነኝ።",
        "",
        "ልረዳዎ የምችለው:",
        "- በአዲስ አበባ ቤቶችን ማፈላለግ (ቦሌ፣ ካዛንቺስ፣ መገናኛ፣ ፒያሳ፣ እንጦጦ)",
        "- ቦታ ማስያዝ እና ክፍያ",
        "- ቤትዎን ማስተናገድ ሂደት",
        "",
        "ምን ይፈልጋሉ? (አካባቢ + ዋጋ + ቀን)",
      ].join("\n");
    }
    return [
      "👋 Hi! I'm your Berenda AI Assistant.",
      "",
      "I can help you:",
      "- Find properties in Addis Ababa (Bole, Kazanchis, Megenagna, Piassa, Entoto)",
      "- Understand bookings and payments",
      "- Explain how to host your property on Berenda",
      "",
      "Tell me what you're looking for (area + budget + dates/guests).",
    ].join("\n");
  }

  const wantsBooking = /booking|book|pay|payment|reserve|reservation|checkout/.test(normalized);
  const wantsHosting = /host|hosting|list|become a host|berenda host/.test(normalized);

  if (wantsBooking) {
    if (amharic) {
      return [
        "✅ በበረንዳ ቦታ የማስያዝ ሂደት:",
        "1) ቤቱን ይምረጡ",
        "2) የመግቢያ እና ወጪ ቀኖችን ያስቀምጡ",
        "3) የእንግዳ ቁጥር ያክሉ",
        "4) መገኛነቱን ያረጋግጡ",
        "5) በቻፓ (ቴሌቢር/CBE/ካርድ/ባንክ) ክፍያ ይፈጽሙ",
        "",
        "አካባቢ እና ዋጋዎን ቢነግሩኝ ጥሩ አማራጮችን ማሳየት እችላለሁ።",
      ].join("\n");
    }
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
    if (amharic) {
      return [
        "🏡 በበረንዳ ቤት ማስተናገድ:",
        "1) «ቤረንዳ አስተናግድ» ይጫኑ",
        "2) ዝርዝር እና ፎቶ ያክሉ",
        "3) ወርሃዊ ዋጋ ያስቀምጡ",
        "4) የካርታ አቀማመጥ ያስቀምጡ",
        "5) ለፍተሻ ያስገቡ",
        "",
        "ምን አይነት ቤት (ስቱዲዮ፣ አፓርትመንት፣ ቤት)? አካባቢ እና ዋጋ ቢነግሩኝ ልረዳዎ እችላለሁ።",
      ].join("\n");
    }
    return [
      "🏡 Hosting on Berenda:",
      "1) Click 'Host a Berenda'",
      "2) Add details and photos",
      "3) Set your monthly price",
      "4) Add your map location",
      "5) Submit for review",
      "",
      "Want to host a studio, apartment, or a family home? Share the area and your monthly price and I'll guide you.",
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
            take: 1,
          },
        },
        take: 4,
        orderBy: { createdAt: "desc" },
      });

      if (properties.length === 0) {
        if (amharic) {
          return [
            "በዚህ አካባቢ/ዋጋ ተስማሚ ቤቶችን አላገኘሁም።",
            "",
            "ዋጋዎን ትንሽ ቀይረው ወይም ሌላ አካባቢ (ቦሌ፣ ካዛንቺስ፣ መገናኛ፣ ፒያሳ፣ እንጦጦ) ይሞክሩ።",
          ].join("\n");
        }
        return [
          "I couldn't find exact matches with that area/budget right now.",
          "",
          "Try adjusting your budget slightly or choosing a nearby area (Bole, Kazanchis, Megenagna, Piassa, Entoto).",
        ].join("\n");
      }

      const lines = properties.map((p) => `- **${p.title}** (${p.location}) — ${p.monthlyPrice}/month`);

      if (amharic) {
        return [
          "ምርጫዎ ጋር የሚስማሙ የበረንዳ ቤቶች:",
          "",
          ...lines,
          "",
          "ተጨማሪ በክፍሎች/ቀን ልጣራ?",
        ].join("\n");
      }

      const refine: string[] = ["Want me to narrow it further by bedrooms/guests/dates?"];
      if (price.max !== undefined) refine.push(`I'll focus on options under ${price.max}/month.`);

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
    if (amharic) {
      return [
        "ልረዳዎ የምችለው:",
        "- በአዲስ አበባ ቤቶችን በአካባቢ እና ዋጋ ማፈላለግ",
        "- ቦታ ማስያዝ እና ክፍያ ማብራሪያ",
        "- ቤትዎን ማስተናገድ ሂደት",
        "",
        "አካባቢ + ዋጋ + ቀን ቢነግሩኝ ልጀምር።",
      ].join("\n");
    }
    return [
      "I can help with:",
      "- Finding properties in Addis Ababa by area and budget",
      "- Explaining booking and payments",
      "- Explaining how to host on Berenda",
      "",
      "Tell me: area + budget + dates (if you have them).",
    ].join("\n");
  }

  if (amharic) {
    return [
      "በበረንዳ ላይ ቤት ፈልጎ ለማግኘት፣ ቦታ ለማስያዝ ወይም ቤት ለማስተናገድ ልረዳዎ እችላለሁ። 🙂",
      "",
      "ዛሬ ምን ይፈልጋሉ?",
      "- ለመከራየት ቤት (አካባቢ + ዋጋ)?",
      "- ወይም ቤት ለማስተናገድ ምክር?",
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
    const { message, conversationId, language, userName } = req.body as { message?: string; conversationId?: string; language?: string; userName?: string };
    const useAmharic = language === "amharic" || hasAmharic(message || "");

    // Resolve name for personalization: optionalAuth attaches fullName, or fall back to body param
    const resolvedName: string = userFromToken?.fullName || userName || "";

    console.log("🤖 AI Request:", { userId, message: message?.substring(0, 50), useAmharic });

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
        const nameInstruction = resolvedName ? `\nThe user's name is ${resolvedName}. Address them by name naturally when appropriate.` : "";
        const langInstruction = useAmharic
          ? "\nIMPORTANT: The user is communicating in Amharic. You MUST respond entirely in Amharic (Ge'ez script). Do not use English."
          : "";
        const model = genAI.getGenerativeModel({
          model: "gemini-2.5-flash",
          systemInstruction: SYSTEM_INSTRUCTION + nameInstruction + langInstruction,
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
        responseText = await buildRuleBasedResponse({ message, history: history.slice(), amharic: useAmharic });
      } catch (e) {
        console.warn("Rule-based fallback failed; using generic response.", e);
        responseText = [
          "Sorry, I'm having trouble generating a response right now.",
          "",
          "But I can still help with Berenda basics: finding properties in Addis Ababa, and explaining booking/hosting steps.",
        ].join("\n");
      }
    }

    // Strip image URLs (Cloudinary or any direct image link) before sending
    responseText = responseText
      .replace(/!\[.*?\]\(.*?\)/g, "")
      .replace(/https?:\/\/res\.cloudinary\.com\/\S+/gi, "")
      .replace(/https?:\/\/\S+\.(jpg|jpeg|png|gif|webp|svg)(\?\S*)?/gi, "")
      .trim();

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