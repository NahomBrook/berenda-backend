// backend/src/modules/properties/property.controller.ts
import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

// GET ALL (With Full Filters including checkIn/checkOut)
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

    // Build where clause - using any to bypass strict Prisma typing for complex filters
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

    const properties = await prisma.property.findMany({
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
          take: 5
        }
      },
      orderBy: { createdAt: 'desc' },
      take: getNumberParam(limit) || 20,
      skip: getNumberParam(offset) || 0
    });

    const total = await prisma.property.count({ where });

    res.status(200).json({ 
      success: true, 
      count: properties.length,
      total,
      data: properties 
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
        media: { take: 5 },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({ success: true, count: properties.length, data: properties });
  } catch (error) {
    console.error('Error searching properties:', error);
    res.status(500).json({ message: 'Search failed' });
  }
};

// GET BY ID - FIXED: proper ID handling
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
        amenities: { include: { amenity: true } }
      }
    });

    if (!property) return res.status(404).json({ message: "Property not found" });
    res.status(200).json({ success: true, data: property });
  } catch (error: any) {
    console.error("Error getting property by ID:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// CREATE
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
      return res.status(401).json({ message: "Unauthorized: No owner ID found" });
    }

    const newProperty = await prisma.property.create({
      data: {
        title,
        description,
        location,
        latitude: latitude || 0,
        longitude: longitude || 0,
        monthlyPrice: parseFloat(monthlyPrice),
        bedrooms: bedrooms ? parseInt(bedrooms) : null,
        bathrooms: bathrooms ? parseFloat(bathrooms) : null,
        maxGuests: maxGuests ? parseInt(maxGuests) : null,
        area: area ? parseFloat(area) : null,
        ownerId,
        approvalStatus: 'pending',
      },
    });

    res.status(201).json({ success: true, data: newProperty });
  } catch (error: any) {
    console.error('Error creating property:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// UPDATE
export const updateProperty = async (req: Request, res: Response) => {
  try {
    const id = getIdParam(req.params.id);
    const ownerId = (req as any).user?.userId || (req as any).user?.id;

    if (!id || !ownerId) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const updateResult = await prisma.property.updateMany({
      where: { id, ownerId },
      data: req.body,
    });

    if (updateResult.count === 0) {
      return res.status(404).json({ message: "Property not found or unauthorized" });
    }

    res.status(200).json({ success: true, message: "Property updated successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE (Soft Delete)
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
      return res.status(404).json({ message: "Property not found or unauthorized" });
    }

    res.status(200).json({ success: true, message: "Property deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET PROPERTIES BY LOCATION
export const getPropertiesByLocation = async (req: Request, res: Response) => {
  try {
    const locationParam = getIdParam(req.params.location);
    
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
        media: true,
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

// UPLOAD IMAGES
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