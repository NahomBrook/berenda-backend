// backend/src/modules/chat/chat.controller.ts
import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Helper to safely get string from params
const getStringId = (param: any): string => {
  if (Array.isArray(param)) return param[0];
  return param || "";
};

// Generate AI response helper
async function generateAIResponse(userMessage: string): Promise<string> {
  const lowerMessage = userMessage.toLowerCase();
  
  if (lowerMessage.includes('property') || lowerMessage.includes('list')) {
    return "🏠 **Finding Properties**\n\nYou can browse all available properties on the homepage. Use the search bar to filter by location, price range, and dates. Would you like help finding something specific?";
  }
  
  if (lowerMessage.includes('book')) {
    return "📅 **Making a Booking**\n\nTo book a property: 1) Select your dates on the property page, 2) Click 'Book Now', 3) Review and confirm your reservation. Need help with an existing booking?";
  }
  
  if (lowerMessage.includes('host')) {
    return "🔑 **Become a Host**\n\nClick 'Host a Berenda' in the navigation bar to list your property. Add details, photos, set your price, and submit for approval within 24-48 hours.";
  }
  
  return "👋 Hello! I'm your Berenda AI Assistant. I can help with finding properties, making bookings, or becoming a host. What would you like to know?";
}

// Get all chats for the current user
export const getChats = async (req: Request, res: Response) => {
  try {
    const userFromToken = (req as any).user;
    const userId = userFromToken?.userId || userFromToken?.id;
    
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Use any type to bypass Prisma strict typing
    const chats = await (prisma.chat as any).findMany({
      where: {
        participants: {
          some: { userId }
        }
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, fullName: true, profileImageUrl: true }
            }
          }
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1
        }
      },
      orderBy: { createdAt: "desc" }
    });

    const formattedChats = await Promise.all(
      chats.map(async (chat: any) => {
        const otherParticipant = chat.participants?.find((p: any) => p.userId !== userId)?.user;
        const lastMessage = chat.messages?.[0];
        
        const unreadCount = await prisma.message.count({
          where: {
            chatId: chat.id,
            senderId: { not: userId },
            readAt: null
          }
        });

        return {
          id: chat.id,
          createdAt: chat.createdAt,
          participant: otherParticipant || null,
          lastMessage: lastMessage ? {
            content: lastMessage.message,
            createdAt: lastMessage.createdAt,
            isFromMe: lastMessage.senderId === userId
          } : null,
          unreadCount
        };
      })
    );

    res.json({ chats: formattedChats });
  } catch (error) {
    console.error("Error in getChats:", error);
    res.status(500).json({ message: "Failed to fetch chats" });
  }
};

// Get chat by ID
export const getChatById = async (req: Request, res: Response) => {
  try {
    const userFromToken = (req as any).user;
    const userId = userFromToken?.userId || userFromToken?.id;
    const chatId = getStringId(req.params.chatId);

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const chat = await (prisma.chat as any).findFirst({
      where: {
        id: chatId,
        participants: { some: { userId } }
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, fullName: true, profileImageUrl: true }
            }
          }
        }
      }
    });

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    const otherParticipant = chat.participants?.find((p: any) => p.userId !== userId)?.user;

    res.json({
      chat: {
        id: chat.id,
        createdAt: chat.createdAt,
        participant: otherParticipant
      }
    });
  } catch (error) {
    console.error("Error in getChatById:", error);
    res.status(500).json({ message: "Failed to fetch chat" });
  }
};

// Create a new chat
export const createChat = async (req: Request, res: Response) => {
  try {
    const userFromToken = (req as any).user;
    const userId = userFromToken?.userId || userFromToken?.id;
    const { participantId } = req.body;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!participantId) {
      return res.status(400).json({ message: "Participant ID is required" });
    }

    const existingChat = await (prisma.chat as any).findFirst({
      where: {
        AND: [
          { participants: { some: { userId } } },
          { participants: { some: { userId: participantId } } }
        ]
      }
    });

    if (existingChat) {
      return res.json({ chatId: existingChat.id });
    }

    const newChat = await prisma.chat.create({
      data: {
        participants: {
          create: [{ userId }, { userId: participantId }]
        }
      }
    });

    res.json({ chatId: newChat.id });
  } catch (error) {
    console.error("Error in createChat:", error);
    res.status(500).json({ message: "Failed to create chat" });
  }
};

// Get messages for a chat
export const getMessages = async (req: Request, res: Response) => {
  try {
    const userFromToken = (req as any).user;
    const userId = userFromToken?.userId || userFromToken?.id;
    const chatId = getStringId(req.params.chatId);

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const participant = await prisma.chatParticipant.findFirst({
      where: { chatId, userId }
    });

    if (!participant) {
      return res.status(403).json({ message: "Access denied" });
    }

    const messages = await prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: "asc" }
    });

    await prisma.message.updateMany({
      where: {
        chatId,
        senderId: { not: userId },
        readAt: null
      },
      data: { readAt: new Date() }
    });

    res.json({ messages });
  } catch (error) {
    console.error("Error in getMessages:", error);
    res.status(500).json({ message: "Failed to fetch messages" });
  }
};

// Send a message
export const sendMessage = async (req: Request, res: Response) => {
  try {
    const userFromToken = (req as any).user;
    const userId = userFromToken?.userId || userFromToken?.id;
    const chatId = getStringId(req.params.chatId);
    const { message } = req.body;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({ message: "Message is required" });
    }

    const participant = await prisma.chatParticipant.findFirst({
      where: { chatId, userId }
    });

    if (!participant) {
      return res.status(403).json({ message: "Access denied" });
    }

    const newMessage = await prisma.message.create({
      data: {
        chatId,
        senderId: userId,
        message: message.trim(),
        isAi: false
      }
    });

    res.json({
      id: newMessage.id,
      senderId: newMessage.senderId,
      message: newMessage.message,
      createdAt: newMessage.createdAt,
      isAi: newMessage.isAi
    });
  } catch (error) {
    console.error("Error in sendMessage:", error);
    res.status(500).json({ message: "Failed to send message" });
  }
};

// Get unread count
export const getUnreadCount = async (req: Request, res: Response) => {
  try {
    const userFromToken = (req as any).user;
    const userId = userFromToken?.userId || userFromToken?.id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userChats = await prisma.chatParticipant.findMany({
      where: { userId },
      select: { chatId: true }
    });

    const chatIds = userChats.map(uc => uc.chatId);

    const unreadCount = await prisma.message.count({
      where: {
        chatId: { in: chatIds },
        senderId: { not: userId },
        readAt: null
      }
    });

    res.json({ count: unreadCount });
  } catch (error) {
    console.error("Error in getUnreadCount:", error);
    res.status(500).json({ message: "Failed to fetch unread count" });
  }
};

// Send AI message
export const sendAIMessage = async (req: Request, res: Response) => {
  try {
    const userFromToken = (req as any).user;
    const userId = userFromToken?.userId || userFromToken?.id;
    const { message } = req.body;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({ message: "Message is required" });
    }

    const aiResponse = await generateAIResponse(message);

    res.json({
      id: `ai-${Date.now()}`,
      senderId: userId,
      message: aiResponse,
      createdAt: new Date().toISOString(),
      isAi: true
    });
  } catch (error) {
    console.error("Error in sendAIMessage:", error);
    res.status(500).json({ message: "Failed to get AI response" });
  }
};