// backend/src/modules/locations/location.controller.ts
import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const searchLocations = async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    
    console.log('🔍 Searching locations for:', q);
    
    if (!q || typeof q !== 'string' || q.length < 2) {
      return res.status(200).json({ success: true, data: [] });
    }

    // Search in properties for unique locations
    const properties = await prisma.property.findMany({
      where: {
        OR: [
          { location: { contains: q, mode: 'insensitive' } },
          { title: { contains: q, mode: 'insensitive' } }
        ],
        deletedAt: null,
        approvalStatus: 'approved'
      },
      select: {
        location: true,
        latitude: true,
        longitude: true,
        title: true
      },
      distinct: ['location'],
      take: 10
    });

    console.log(`📍 Found ${properties.length} matching locations`);

    // Format as locations
    const locations = properties.map(prop => {
      // Parse location string (format: "name, city, country")
      const parts = prop.location.split(',').map(p => p.trim());
      return {
        id: prop.location,
        name: parts[0] || prop.location,
        city: parts[1] || '',
        country: parts[2] || '',
        latitude: prop.latitude,
        longitude: prop.longitude
      };
    });

    // If no locations found from properties, add some mock popular locations
    if (locations.length === 0 && q.length > 2) {
      const mockLocations = [
        { id: "1", name: "New York", city: "New York", country: "USA", latitude: 40.7128, longitude: -74.0060 },
        { id: "2", name: "Los Angeles", city: "Los Angeles", country: "USA", latitude: 34.0522, longitude: -118.2437 },
        { id: "3", name: "Chicago", city: "Chicago", country: "USA", latitude: 41.8781, longitude: -87.6298 },
        { id: "4", name: "London", city: "London", country: "UK", latitude: 51.5074, longitude: -0.1278 },
        { id: "5", name: "Paris", city: "Paris", country: "France", latitude: 48.8566, longitude: 2.3522 },
        { id: "6", name: "Tokyo", city: "Tokyo", country: "Japan", latitude: 35.6762, longitude: 139.6503 }
      ].filter(loc => 
        loc.name.toLowerCase().includes(q.toLowerCase()) ||
        loc.city.toLowerCase().includes(q.toLowerCase())
      );
      
      return res.status(200).json({ success: true, data: mockLocations });
    }

    res.status(200).json({ success: true, data: locations });
  } catch (error: any) {
    console.error('Error searching locations:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to search locations' 
    });
  }
};