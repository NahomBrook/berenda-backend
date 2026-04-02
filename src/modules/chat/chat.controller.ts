import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Get all chats for the current user
export const getChats = async (req: Request, res: Response) => {
  try {
    const userFromToken = (req as any).user;
    const userId = userFromToken?.userId || userFromToken?.id;
    
    console.log("Fetching chats for user:", userId);

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const chats = await prisma.chat.findMany({
      where: {
        participants: {
          some: {
            userId: userId,
          },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                profileImageUrl: true,
              },
            },
          },
        },
        messages: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const formattedChats = await Promise.all(
      chats.map(async (chat) => {
        const otherParticipant = chat.participants.find(
          (p) => p.userId !== userId
        )?.user;

        const lastMessage = chat.messages[0];
        
        // Count unread messages (messages sent by others that haven't been read)
        const unreadCount = await prisma.message.count({
          where: {
            chatId: chat.id,
            senderId: { not: userId },
            readAt: null,
          },
        });

        return {
          id: chat.id,
          createdAt: chat.createdAt,
          participant: otherParticipant
            ? {
                id: otherParticipant.id,
                fullName: otherParticipant.fullName,
                profileImage: otherParticipant.profileImageUrl,
              }
            : null,
          lastMessage: lastMessage
            ? {
                content: lastMessage.message,
                createdAt: lastMessage.createdAt,
                isFromMe: lastMessage.senderId === userId,
              }
            : null,
          unreadCount,
        };
      })
    );

    res.json({ chats: formattedChats });
  } catch (error) {
    console.error("Error in getChats:", error);
    res.status(500).json({ message: "Failed to fetch chats" });
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

    // Get all chats for the user
    const userChats = await prisma.chatParticipant.findMany({
      where: { userId },
      select: { chatId: true },
    });

    const chatIds = userChats.map((uc) => uc.chatId);

    // Count unread messages (messages not sent by user that haven't been read)
    const unreadCount = await prisma.message.count({
      where: {
        chatId: { in: chatIds },
        senderId: { not: userId },
        readAt: null,
      },
    });

    res.json({ count: unreadCount });
  } catch (error) {
    console.error("Error in getUnreadCount:", error);
    res.status(500).json({ message: "Failed to fetch unread count" });
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

    // Check if chat already exists
    const existingChat = await prisma.chat.findFirst({
      where: {
        AND: [
          { participants: { some: { userId } } },
          { participants: { some: { userId: participantId } } },
        ],
      },
    });

    if (existingChat) {
      return res.json({ chatId: existingChat.id });
    }

    // Create new chat
    const newChat = await prisma.chat.create({
      data: {
        participants: {
          create: [{ userId }, { userId: participantId }],
        },
      },
    });

    res.json({ chatId: newChat.id });
  } catch (error) {
    console.error("Error in createChat:", error);
    res.status(500).json({ message: "Failed to create chat" });
  }
};

// Get chat by ID
export const getChatById = async (req: Request, res: Response) => {
  try {
    const userFromToken = (req as any).user;
    const userId = userFromToken?.userId || userFromToken?.id;
    // const { chatId } = req.params;
        const chatId = req.params.id as string;


    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        participants: { some: { userId } },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                profileImageUrl: true,
              },
            },
          },
        },
      },
    });

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    const otherParticipant = chat.participants.find(
      (p) => p.userId !== userId
    )?.user;

    res.json({
      chat: {
        id: chat.id,
        createdAt: chat.createdAt,
        participant: otherParticipant,
      },
    });
  } catch (error) {
    console.error("Error in getChatById:", error);
    res.status(500).json({ message: "Failed to fetch chat" });
  }
};

// Get messages for a chat - UPDATED with read marking
export const getMessages = async (req: Request, res: Response) => {
  try {
    const userFromToken = (req as any).user;
    const userId = userFromToken?.userId || userFromToken?.id;
    const chatId = req.params.id as string;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Verify user is part of the chat
    const participant = await prisma.chatParticipant.findFirst({
      where: { chatId, userId },
    });

    if (!participant) {
      return res.status(403).json({ message: "Access denied" });
    }

    const messages = await prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: "asc" },
    });

    // Mark messages as read (messages sent by others that haven't been read)
    await prisma.message.updateMany({
      where: {
        chatId,
        senderId: { not: userId },
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
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
    const chatId = req.params.id as string;
    const { message } = req.body;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({ message: "Message is required" });
    }

    // Verify user is part of the chat
    const participant = await prisma.chatParticipant.findFirst({
      where: { chatId, userId },
    });

    if (!participant) {
      return res.status(403).json({ message: "Access denied" });
    }

    const newMessage = await prisma.message.create({
      data: {
        chatId,
        senderId: userId,
        message: message.trim(),
        isAi: false,
      },
    });

    res.json({
      id: newMessage.id,
      senderId: newMessage.senderId,
      message: newMessage.message,
      createdAt: newMessage.createdAt,
      isAi: newMessage.isAi,
    });
  } catch (error) {
    console.error("Error in sendMessage:", error);
    res.status(500).json({ message: "Failed to send message" });
  }
};
