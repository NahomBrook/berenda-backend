// backend/src/modules/favorites/favorite.controller.ts
import { Request, Response } from "express";
import prisma from "../../lib/prisma";

// Helper function to safely get string from params
const getStringParam = (param: any): string => {
  if (Array.isArray(param)) return param[0];
  return String(param || "");
};

// Define the type for the favorite with nested property
type FavoriteWithProperty = {
  id: string;
  userId: string;
  propertyId: string;
  createdAt: Date;
  property: {
    id: string;
    title: string;
    location: string;
    monthlyPrice: number;
    description: string;
    bedrooms: number | null;
    bathrooms: number | null;
    area: number | null;
    maxGuests: number | null;
    latitude: number;
    longitude: number;
    isAvailable: boolean;
    approvalStatus: string;
    ownerId: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    media: Array<{
      id: string;
      mediaUrl: string;
      mediaType: string;
      propertyId: string;
      createdAt: Date;
    }>;
    reviews: Array<{
      rating: number;
    }>;
  };
};

export const getFavorites = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const favorites = await prisma.favorite.findMany({
      where: { userId },
      include: {
        property: {
          include: {
            media: {
              where: { mediaType: 'image' },
              take: 1,
            },
            reviews: {
              select: {
                rating: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Type assertion to fix the TypeScript error
    const typedFavorites = favorites as unknown as FavoriteWithProperty[];
    
    const wishlistItems = typedFavorites.map((fav) => {
      const property = fav.property;
      const avgRating = property.reviews && property.reviews.length > 0
        ? property.reviews.reduce((sum, review) => sum + review.rating, 0) / property.reviews.length
        : 4.5;
      
      return {
        id: property.id,
        title: property.title,
        location: property.location,
        price: property.monthlyPrice,
        imageUrl: property.media && property.media[0]?.mediaUrl || "/placeholder.png",
        rating: Number(avgRating.toFixed(1)),
        favoriteId: fav.id,
      };
    });

    res.json({
      success: true,
      data: wishlistItems,
    });
  } catch (error) {
    console.error("Error fetching favorites:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch favorites",
    });
  }
};

export const addFavorite = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const { propertyId } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!propertyId) {
      return res.status(400).json({
        success: false,
        message: "Property ID is required",
      });
    }

    // Ensure propertyId is a string
    const propertyIdStr = getStringParam(propertyId);

    const property = await prisma.property.findUnique({
      where: { id: propertyIdStr },
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    const existing = await prisma.favorite.findUnique({
      where: {
        userId_propertyId: {
          userId,
          propertyId: propertyIdStr,
        },
      },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Property already in favorites",
      });
    }

    const favorite = await prisma.favorite.create({
      data: {
        userId,
        propertyId: propertyIdStr,
      },
    });

    res.json({
      success: true,
      data: favorite,
      message: "Added to favorites",
    });
  } catch (error) {
    console.error("Error adding favorite:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add favorite",
    });
  }
};

export const removeFavorite = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const { propertyId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!propertyId) {
      return res.status(400).json({
        success: false,
        message: "Property ID is required",
      });
    }

    // Ensure propertyId is a string
    const propertyIdStr = getStringParam(propertyId);

    await prisma.favorite.delete({
      where: {
        userId_propertyId: {
          userId,
          propertyId: propertyIdStr,
        },
      },
    });

    res.json({
      success: true,
      message: "Removed from favorites",
    });
  } catch (error) {
    console.error("Error removing favorite:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove favorite",
    });
  }
};