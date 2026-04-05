// backend/src/modules/favorites/favorite.controller.ts
import { Request, Response } from "express";
import prisma from "../../lib/prisma";

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

    const wishlistItems = favorites.map(fav => {
      const avgRating = fav.property.reviews.length > 0
        ? fav.property.reviews.reduce((sum, review) => sum + review.rating, 0) / fav.property.reviews.length
        : 4.5;
      
      return {
        id: fav.property.id,
        title: fav.property.title,
        location: fav.property.location,
        price: fav.property.monthlyPrice,
        imageUrl: fav.property.media[0]?.mediaUrl || "/placeholder.png",
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
      error: "Failed to fetch favorites",
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

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
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
          propertyId,
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
        propertyId,
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
      error: "Failed to add favorite",
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

    await prisma.favorite.delete({
      where: {
        userId_propertyId: {
          userId,
          propertyId,
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
      error: "Failed to remove favorite",
    });
  }
};