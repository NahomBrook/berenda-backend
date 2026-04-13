// backend/src/modules/properties/property.controller.ts
import { Request, Response } from "express";
import prisma from "../../lib/prisma";


// Helper function to safely get string from query param
const getStringParam = (param: any): string | undefined => {
  if (param === undefined || param === null) return undefined;
  if (Array.isArray(param)) return String(param[0]);
  return String(param);
};

// Helper to convert any value to number safely
const getNumberParam = (param: any): number | undefined => {
  const str = getStringParam(param);
  if (str === undefined) return undefined;
  const num = Number(str);
  return isNaN(num) ? undefined : num;
};

// Helper to safely get ID from params
const getIdParam = (param: any): string | undefined => {
  if (param === undefined || param === null) return undefined;
  if (Array.isArray(param)) return String(param[0]);
  return String(param);
};

// GET ALL PROPERTIES (With Full Filters including checkIn/checkOut)
export const getProperties = async (req: Request, res: Response) => {
  try {
    const { 
      location, 
      minPrice, 
      maxPrice, 
      checkIn,
      checkOut,
      bedrooms,
      limit = '20',
      offset = '0'
    } = req.query;

    // Build where clause
    const where: any = {
      deletedAt: null,
      approvalStatus: 'approved',
      isAvailable: true,
    };

    // Location filter
    const locationStr = getStringParam(location);
    if (locationStr && locationStr.trim()) {
      where.location = {
        contains: locationStr.trim(),
        mode: 'insensitive'
      };
    }

    // Price range filter
    const minPriceNum = getNumberParam(minPrice);
    const maxPriceNum = getNumberParam(maxPrice);
    if (minPriceNum !== undefined || maxPriceNum !== undefined) {
      where.monthlyPrice = {};
      if (minPriceNum !== undefined && minPriceNum > 0) where.monthlyPrice.gte = minPriceNum;
      if (maxPriceNum !== undefined && maxPriceNum > 0) where.monthlyPrice.lte = maxPriceNum;
    }

    // Bedrooms filter
    const bedroomsNum = getNumberParam(bedrooms);
    if (bedroomsNum !== undefined && bedroomsNum > 0) {
      where.bedrooms = { gte: bedroomsNum };
    }

    // Date availability filter
    const checkInStr = getStringParam(checkIn);
    const checkOutStr = getStringParam(checkOut);
    if (checkInStr && checkOutStr) {
      const checkInDate = new Date(checkInStr);
      const checkOutDate = new Date(checkOutStr);
      
      where.bookings = {
        none: {
          AND: [
            { status: { in: ['confirmed', 'approved'] } },
            { startDate: { lt: checkOutDate } },
            { endDate: { gt: checkInDate } }
          ]
        }
      };
    }

    const limitNum = getNumberParam(limit) || 20;
    const offsetNum = getNumberParam(offset) || 0;

    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where,
        include: {
          owner: {
            select: {
              id: true,
              fullName: true,
              email: true,
              profileImageUrl: true
            }
          },
          media: {
            where: { mediaType: 'image' },
            take: 1,
            select: { mediaUrl: true }
          },
          _count: { select: { reviews: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: limitNum,
        skip: offsetNum
      }),
      prisma.property.count({ where })
    ]);

    // Fetch avg ratings in one aggregation query
    const propertyIds = properties.map(p => p.id);
    const ratingAggs = propertyIds.length > 0
      ? await prisma.review.groupBy({
          by: ['propertyId'],
          where: { propertyId: { in: propertyIds } },
          _avg: { rating: true },
        })
      : [];
    const ratingMap = Object.fromEntries(ratingAggs.map(r => [r.propertyId, r._avg.rating]));

    const propertiesWithRating = properties.map(property => ({
      ...property,
      averageRating: ratingMap[property.id] ?? null,
      reviewsCount: property._count.reviews,
    }));

    res.status(200).json({ 
      success: true, 
      count: properties.length,
      total,
      data: propertiesWithRating 
    });
  } catch (error: any) {
    console.error('Error fetching properties:', error);
    if (error?.code === 'P1001' || /Can't reach database server/.test(String(error?.message))) {
      return res.status(503).json({ success: false, message: 'Database unreachable. Please check DATABASE_URL and database server.' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// SEARCH PROPERTIES
export const searchProperties = async (req: Request, res: Response) => {
  try {
    const { q, location, minPrice, maxPrice, checkIn, checkOut, bedrooms } = req.query;

    const where: any = {
      deletedAt: null,
      approvalStatus: 'approved',
      isAvailable: true,
    };

    const qStr = getStringParam(q);
    const locationStr = getStringParam(location);
    const minPriceNum = getNumberParam(minPrice);
    const maxPriceNum = getNumberParam(maxPrice);
    const checkInStr = getStringParam(checkIn);
    const checkOutStr = getStringParam(checkOut);
    const bedroomsNum = getNumberParam(bedrooms);

    // Text search
    if (qStr && qStr.trim()) {
      where.OR = [
        { title: { contains: qStr, mode: 'insensitive' } },
        { description: { contains: qStr, mode: 'insensitive' } },
        { location: { contains: qStr, mode: 'insensitive' } },
      ];
    }

    // Location filter
    if (locationStr && locationStr.trim()) {
      where.location = { contains: locationStr, mode: 'insensitive' };
    }

    // Price range
    if (minPriceNum !== undefined || maxPriceNum !== undefined) {
      where.monthlyPrice = {};
      if (minPriceNum !== undefined && minPriceNum > 0) where.monthlyPrice.gte = minPriceNum;
      if (maxPriceNum !== undefined && maxPriceNum > 0) where.monthlyPrice.lte = maxPriceNum;
    }

    // Bedrooms
    if (bedroomsNum !== undefined && bedroomsNum > 0) {
      where.bedrooms = { gte: bedroomsNum };
    }

    // Date availability
    if (checkInStr && checkOutStr) {
      const checkInDate = new Date(checkInStr);
      const checkOutDate = new Date(checkOutStr);
      
      where.bookings = {
        none: {
          AND: [
            { status: { in: ['confirmed', 'approved'] } },
            { startDate: { lt: checkOutDate } },
            { endDate: { gt: checkInDate } }
          ]
        }
      };
    }

    const properties = await prisma.property.findMany({
      where,
      include: {
        owner: { select: { fullName: true, email: true } },
        media: { where: { mediaType: 'image' }, take: 1, select: { mediaUrl: true } },
        _count: { select: { reviews: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const searchIds = properties.map(p => p.id);
    const searchRatingAggs = searchIds.length > 0
      ? await prisma.review.groupBy({
          by: ['propertyId'],
          where: { propertyId: { in: searchIds } },
          _avg: { rating: true },
        })
      : [];
    const searchRatingMap = Object.fromEntries(searchRatingAggs.map(r => [r.propertyId, r._avg.rating]));

    const propertiesWithRating = properties.map(property => ({
      ...property,
      averageRating: searchRatingMap[property.id] ?? null,
      reviewsCount: property._count.reviews,
    }));

    res.json({ success: true, count: properties.length, data: propertiesWithRating });
  } catch (error) {
    console.error('Error searching properties:', error);
    res.status(500).json({ message: 'Search failed' });
  }
};

// GET PROPERTY BY ID
export const getPropertyById = async (req: Request, res: Response) => {
  try {
    const id = getIdParam(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: "Invalid property ID" });
    }
    
    const property = await prisma.property.findFirst({
      where: { id, deletedAt: null },
      include: { 
        owner: { select: { fullName: true, email: true, profileImageUrl: true } },
        media: true,
        amenities: { include: { amenity: true } },
        reviews: {
          include: {
            reviewer: {
              select: {
                fullName: true,
                profileImageUrl: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!property) {
      return res.status(404).json({ success: false, message: "Property not found" });
    }

    // Calculate average rating
    const avgRating = property.reviews.length > 0
      ? property.reviews.reduce((sum, review) => sum + review.rating, 0) / property.reviews.length
      : null;

    res.status(200).json({ 
      success: true, 
      data: {
        ...property,
        averageRating: avgRating,
        reviewsCount: property.reviews.length
      }
    });
  } catch (error: any) {
    console.error("Error getting property by ID:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// CREATE PROPERTY
export const createProperty = async (req: Request, res: Response) => {
  try {
    const { 
      title, 
      description, 
      location, 
      latitude, 
      longitude, 
      monthlyPrice,
      bedrooms,
      bathrooms,
      maxGuests,
      area
    } = req.body;
    
    const ownerId = (req as any).user?.userId || (req as any).user?.id;

    if (!ownerId) {
      return res.status(401).json({ success: false, message: "Unauthorized: No owner ID found" });
    }

    // Validate required fields
    if (!title || !description || !location || !monthlyPrice) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing required fields: title, description, location, monthlyPrice" 
      });
    }

    const newProperty = await prisma.property.create({
      data: {
        title,
        description,
        location,
        latitude: latitude ? parseFloat(latitude) : 0,
        longitude: longitude ? parseFloat(longitude) : 0,
        monthlyPrice: parseFloat(monthlyPrice),
        bedrooms: bedrooms ? parseInt(bedrooms) : null,
        bathrooms: bathrooms ? parseFloat(bathrooms) : null,
        maxGuests: maxGuests ? parseInt(maxGuests) : null,
        area: area ? parseFloat(area) : null,
        ownerId,
        approvalStatus: 'pending',
      },
      include: {
        media: true
      }
    });

    res.status(201).json({ success: true, data: newProperty });
  } catch (error: any) {
    console.error('Error creating property:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// UPDATE PROPERTY
export const updateProperty = async (req: Request, res: Response) => {
  try {
    const id = getIdParam(req.params.id);
    const ownerId = (req as any).user?.userId || (req as any).user?.id;

    if (!id || !ownerId) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    // Check if property exists and belongs to user
    const existingProperty = await prisma.property.findFirst({
      where: { id, ownerId, deletedAt: null }
    });

    if (!existingProperty) {
      return res.status(404).json({ success: false, message: "Property not found or unauthorized" });
    }

    const updateResult = await prisma.property.update({
      where: { id },
      data: req.body,
    });

    res.status(200).json({ success: true, message: "Property updated successfully", data: updateResult });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE PROPERTY (Soft Delete)
export const deleteProperty = async (req: Request, res: Response) => {
  try {
    const id = getIdParam(req.params.id);
    const ownerId = (req as any).user?.userId || (req as any).user?.id;

    if (!id || !ownerId) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const deleteResult = await prisma.property.updateMany({
      where: { id, ownerId },
      data: { deletedAt: new Date() },
    });

    if (deleteResult.count === 0) {
      return res.status(404).json({ success: false, message: "Property not found or unauthorized" });
    }

    res.status(200).json({ success: true, message: "Property deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET USER'S PROPERTIES (for Hosting tab)
export const getUserProperties = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const properties = await prisma.property.findMany({
      where: { 
        ownerId: userId,
        deletedAt: null,
      },
      include: {
        media: {
          where: { mediaType: 'image' },
          take: 1,
        },
        bookings: {
          where: {
            status: { in: ['pending', 'approved', 'confirmed'] }
          },
          take: 5
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: properties,
    });
  } catch (error) {
    console.error("Error fetching user properties:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch properties",
    });
  }
};

// GET PROPERTIES BY LOCATION
export const getPropertiesByLocation = async (req: Request, res: Response) => {
  try {
    const locationParam = getIdParam(req.params.location);
    
    if (!locationParam) {
      return res.status(400).json({ success: false, message: "Location parameter is required" });
    }
    
    const properties = await prisma.property.findMany({
      where: {
        location: {
          contains: locationParam,
          mode: 'insensitive'
        },
        deletedAt: null,
        approvalStatus: 'approved'
      },
      include: {
        media: { where: { mediaType: 'image' }, take: 1, select: { mediaUrl: true } },
        owner: {
          select: { fullName: true }
        }
      },
      take: 20
    });

    res.status(200).json({ success: true, data: properties });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// UPLOAD PROPERTY IMAGES
export const uploadPropertyImages = async (req: Request, res: Response) => {
  try {
    const propertyId = getIdParam(req.params.propertyId);
    const files = req.files as any[];

    if (!propertyId) {
      return res.status(400).json({ success: false, message: "Invalid property ID" });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: "No image files provided" });
    }

    // Check if property exists and user owns it
    const ownerId = (req as any).user?.userId || (req as any).user?.id;
    const property = await prisma.property.findFirst({
      where: { id: propertyId, ownerId }
    });

    if (!property) {
      return res.status(404).json({ success: false, message: "Property not found or unauthorized" });
    }

    const mediaEntries = [] as any[];
    for (const file of files) {
      const url = file.path || file.secure_url || file.location || file.url;
      if (!url) {
        return res.status(500).json({
          success: false,
          message: "Cloudinary (or remote storage) not configured: uploaded file has no remote URL. Configure CLOUDINARY_* or ensure uploads are handled by a remote storage provider.",
        });
      }

      const entry = await prisma.propertyMedia.create({
        data: { propertyId, mediaUrl: url, mediaType: "image" },
      });
      mediaEntries.push(entry);
    }

    res.status(201).json({
      success: true,
      message: `${mediaEntries.length} images uploaded successfully`,
      data: mediaEntries,
    });
  } catch (error: any) {
    console.error("Error uploading images:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// UPDATE PROPERTY STATUS (for admin)
export const updatePropertyStatus = async (req: Request, res: Response) => {
  try {
    const id = getIdParam(req.params.id);
    const { approvalStatus } = req.body;
    const userId = (req as any).user?.userId || (req as any).user?.id;

    if (!id) {
      return res.status(400).json({ success: false, message: "Invalid property ID" });
    }

    // Check if user is admin (you may want to add role check here)
    const property = await prisma.property.update({
      where: { id },
      data: { approvalStatus },
    });

    res.status(200).json({ 
      success: true, 
      message: `Property status updated to ${approvalStatus}`,
      data: property 
    });
  } catch (error: any) {
    console.error("Error updating property status:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};